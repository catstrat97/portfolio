// Swarm — framework-agnostic steering-behaviour simulation + Canvas2D renderer.
//
//   const swarm = createSwarm(canvas, params);  swarm.start();  ...  swarm.destroy();
//
// No dependencies. `params` is read live every frame, so mutate it from anywhere
// (GUI, React state, route changes) and the sim reacts on the next frame.
// This exact module is what gets wrapped in a <SwarmCanvas/> client component in Phase 3.

import { COLORS } from './params.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export function createSwarm(canvas, params, { ignoreSelector = '[data-swarm-ignore]' } = {}) {
  const ctx = canvas.getContext('2d');
  const agents = [];
  const pointer = { x: 0, y: 0, inside: false, lastMove: -1e9 };
  const burstOrigin = { x: 0, y: 0 };

  let W = 0, H = 0, dpr = 1;
  let engage = 0;       // 0 = autonomous, 1 = fully locked onto the pointer
  let burst = 0;        // 1 right after a disperse, decays to 0
  let following = false;
  let raf = 0, last = 0, fps = 60;
  const hulls = [];     // { members: [agent indices], color, end }
  const obstacles = []; // drawn circles: { x, y, r, color, vx, vy, dead } — floating bodies, not particles
  let preview = null;   // circle being dragged out: { x, y, r, box }
  const blasts = [];    // popped circles mid-burst (POW-style), no longer obstacles
  let clock = 0;        // ms, last frame time — drives burst animation
  let nextHull = 0;

  // ---------------------------------------------------------------- setup

  function resize() {
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = r.width;
    H = r.height;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function spawn() {
    const ang = Math.random() * TAU;
    const s = params.maxSpeed * params.cruise;
    return {
      x: Math.random() * W,
      y: Math.random() * H,
      vx: Math.cos(ang) * s,
      vy: Math.sin(ang) * s,
      wander: Math.random() * TAU,
      bias: Math.random() * 2 - 1, // per-agent personality: who leads, who lags
      ci: (Math.random() * COLORS.length) | 0, // colour index used when ball colour is 'random'
      trap: null,                  // container circle this ball is locked inside
      trail: [],                   // flat [x0, y0, x1, y1, ...] oldest → newest
    };
  }

  function syncCount() {
    while (agents.length < params.count) agents.push(spawn());
    if (agents.length > params.count) agents.length = params.count;
  }

  // ---------------------------------------------------------------- input

  function onMove(e) {
    const ignored = e.target instanceof Element && e.target.closest(ignoreSelector);
    if (ignored) { pointer.inside = false; return; }
    const r = canvas.getBoundingClientRect();
    pointer.x = e.clientX - r.left;
    pointer.y = e.clientY - r.top;
    pointer.inside = true;
    pointer.lastMove = performance.now();
  }
  function onOut(e) { if (!e.relatedTarget) pointer.inside = false; }
  function onUp(e) { if (e.pointerType === 'touch') pointer.inside = false; }

  window.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener('pointerdown', onMove, { passive: true });
  window.addEventListener('pointerup', onUp, { passive: true });
  window.addEventListener('mouseout', onOut);
  function onBlur() { pointer.inside = false; }
  window.addEventListener('blur', onBlur);

  // ---------------------------------------------------------------- steering helpers

  // Reynolds steering: force = desired velocity − current velocity, capped.
  function steer(a, dx, dy, speed, cap, out) {
    const m = Math.hypot(dx, dy);
    if (m < 1e-6) return;
    let sx = (dx / m) * speed - a.vx;
    let sy = (dy / m) * speed - a.vy;
    const sm = Math.hypot(sx, sy);
    if (sm > cap) { sx = (sx / sm) * cap; sy = (sy / sm) * cap; }
    out.x += sx; out.y += sy;
  }

  // After a wall hit, point the wander target along the reflected heading
  // so the agent carries on outward instead of steering back into the wall.
  function bounced(a) {
    a.wander = Math.atan2(a.vy, a.vx);
  }

  // ---------------------------------------------------------------- simulation

  function updateEngagement(k, now) {
    const p = params;
    const active = p.mouseOn && pointer.inside && now - pointer.lastMove < p.idleDelay;

    if (active) {
      engage += (1 - engage) * p.engageIn * k;
      if (engage > 0.15) following = true;
    } else {
      if (following && engage > 0.2 && p.disperseOn) disperse();
      following = false;
      engage += (0 - engage) * p.engageOut * k;
    }
    burst = Math.max(0, burst - p.disperseDecay * k);
  }

  // One-shot scatter: kick every agent away from the last pointer position.
  function disperse() {
    const p = params;
    burst = 1;
    burstOrigin.x = pointer.x;
    burstOrigin.y = pointer.y;
    for (const a of agents) {
      const ang = Math.atan2(a.y - burstOrigin.y, a.x - burstOrigin.x)
        + (Math.random() * 2 - 1) * p.disperseSpread;
      const imp = p.disperseForce * (0.5 + Math.random());
      a.vx += Math.cos(ang) * imp;
      a.vy += Math.sin(ang) * imp;
      a.wander = ang; // continue wandering in the scatter direction, no snap-back
    }
  }

  // ---------------------------------------------------------------- hulls
  // Random subsets of balls get a live bounding rectangle for a random lifetime.

  const HULL_CAP = 3;
  const HULL_COLORS = { green: '#00ff00', magenta: '#ff00ff' };
  const between = (a, b) => { const lo = Math.min(a, b); return lo + Math.random() * (Math.max(a, b) - lo); };

  function updateHulls(now) {
    const p = params;
    for (let i = hulls.length - 1; i >= 0; i--) {
      const h = hulls[i];
      h.members = h.members.filter((m) => m < agents.length);
      if (now > h.end || !h.members.length) hulls.splice(i, 1);
    }
    const max = p.hullsOn ? Math.min(HULL_CAP, p.hullMax | 0) : 0;
    if (hulls.length > max) hulls.length = max;
    if (hulls.length >= max || now < nextHull || !agents.length) return;

    const size = Math.min(agents.length, Math.round(between(p.hullMinBalls, p.hullMaxBalls)));
    const pool = agents.map((_, i) => i);
    const members = [];
    for (let i = 0; i < size; i++) members.push(pool.splice((Math.random() * pool.length) | 0, 1)[0]);

    const mode = p.hullColor === 'mix' ? (Math.random() < 0.5 ? 'green' : 'magenta') : p.hullColor;
    hulls.push({ members, color: HULL_COLORS[mode] || HULL_COLORS.green, end: now + between(p.hullLifeMin, p.hullLifeMax) });
    nextHull = now + p.hullGap * (0.5 + Math.random());
  }

  function drawHulls() {
    const p = params;
    const pad = p.radius + p.hullPadding;
    ctx.lineWidth = p.hullWidth;
    for (const h of hulls) {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const i of h.members) {
        const a = agents[i];
        if (a.x < x0) x0 = a.x; if (a.x > x1) x1 = a.x;
        if (a.y < y0) y0 = a.y; if (a.y > y1) y1 = a.y;
      }
      ctx.strokeStyle = h.color;
      ctx.strokeRect(x0 - pad, y0 - pad, x1 - x0 + pad * 2, y1 - y0 + pad * 2);
    }
  }

  // ---------------------------------------------------------------- obstacles

  function addObstacle(c) {
    const o = {
      x: c.x, y: c.y, r: c.r, color: c.color,
      vx: 0, vy: 0, heading: Math.random() * TAU, dead: false,
    };
    obstacles.push(o);
    // Container mode: every ball the circle was drawn over is now locked inside it.
    if (params.circleMode === 'container' && o.r > params.radius * 1.2) {
      for (const a of agents) {
        if (Math.hypot(a.x - o.x, a.y - o.y) < o.r) a.trap = o;
      }
    }
    const max = Math.max(0, params.maxCircles | 0);
    if (obstacles.length > max) kill(obstacles.splice(0, obstacles.length - max));
  }

  // Removed circles release their trapped balls (checked via `dead` in step).
  function kill(list) { for (const o of list) o.dead = true; }

  // Slow, weightless drift; reflects off the canvas edges.
  function floatObstacles(k) {
    const sp = params.floatSpeed;
    for (const o of obstacles) {
      o.heading += (Math.random() * 2 - 1) * 0.04 * k;
      o.vx += (Math.cos(o.heading) * sp - o.vx) * 0.02 * k;
      o.vy += (Math.sin(o.heading) * sp - o.vy) * 0.02 * k;
      o.x += o.vx * k;
      o.y += o.vy * k;
      const r = Math.min(o.r, W / 2, H / 2);
      if (o.x < r) { o.x = r; o.vx = Math.abs(o.vx); o.heading = Math.atan2(o.vy, o.vx); }
      else if (o.x > W - r) { o.x = W - r; o.vx = -Math.abs(o.vx); o.heading = Math.atan2(o.vy, o.vx); }
      if (o.y < r) { o.y = r; o.vy = Math.abs(o.vy); o.heading = Math.atan2(o.vy, o.vx); }
      else if (o.y > H - r) { o.y = H - r; o.vy = -Math.abs(o.vy); o.heading = Math.atan2(o.vy, o.vx); }
    }
  }

  // ---------------------------------------------------------------- burst (POW-style mouse pop)
  //   anticipation squash → blast shape explodes outward → colour flips to outline and fades,
  //   with an inner flash, expanding rings and a shockwave that kicks nearby particles.

  const easeOutExpo = (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
  const easeInCubic = (t) => t * t * t;

  function obstacleAt(x, y) {
    for (let i = obstacles.length - 1; i >= 0; i--) {
      const o = obstacles[i];
      if (Math.hypot(x - o.x, y - o.y) <= o.r) return o;
    }
    return null;
  }

  function pop(o) {
    const p = params;
    const i = obstacles.indexOf(o);
    if (i < 0) return;
    obstacles.splice(i, 1);
    o.dead = true;
    blasts.push({ x: o.x, y: o.y, r: o.r, color: o.color, t0: clock, rot: Math.random() * TAU, seed: Math.random() * 1000, shape: p.blastShape });

    // Shockwave: radial kick, strongest at the rim, fading with distance.
    const range = o.r * p.burstScale + 160;
    for (const a of agents) {
      const dx = a.x - o.x, dy = a.y - o.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d > range) continue;
      const f = p.shockwave * (1 - d / range);
      a.vx += (dx / d) * f;
      a.vy += (dy / d) * f;
      a.wander = Math.atan2(dy, dx);
    }
    // Reuse the disperse speed-cap boost so the kick isn't clamped away instantly.
    burst = Math.max(burst, 0.5);
    burstOrigin.x = o.x; burstOrigin.y = o.y;
  }

  // Deterministic per-vertex jitter that re-rolls at `boil` fps (hand-drawn comic boil).
  function jitter(seed, i, frame) {
    const v = Math.sin(seed * 12.9898 + i * 78.233 + frame * 37.719) * 43758.5453;
    return (v - Math.floor(v)) * 2 - 1;
  }

  function blastPath(b, R, amt, boilFrame) {
    const p = params;
    const n = Math.max(3, p.blastDetail | 0);
    const valley = R * (1 + (p.blastRatio - 1) * amt);
    const peak = R * (1 + p.blastStrength * amt);
    const m = p.messy * amt;
    const step = TAU / n;
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const k = i % n;
      const a0 = b.rot + i * step + jitter(b.seed, k, boilFrame) * step * 0.25 * m;
      const rv = valley * (1 + jitter(b.seed + 1, k, boilFrame) * 0.3 * m);
      const vx = b.x + Math.cos(a0) * rv, vy = b.y + Math.sin(a0) * rv;
      if (i === 0) { ctx.moveTo(vx, vy); continue; }
      const am = a0 - step / 2;
      const rp = peak * (1 + jitter(b.seed + 2, k, boilFrame) * 0.45 * m);
      if (b.shape === 'clouds') {
        ctx.quadraticCurveTo(b.x + Math.cos(am) * rp * 1.15, b.y + Math.sin(am) * rp * 1.15, vx, vy);
      } else {
        ctx.lineTo(b.x + Math.cos(am) * rp, b.y + Math.sin(am) * rp);
        ctx.lineTo(vx, vy);
      }
    }
    ctx.closePath();
  }

  function drawBlasts() {
    const p = params;
    const boilFrame = p.boil > 0 ? Math.floor(clock / (1000 / p.boil)) : 0;
    for (let i = blasts.length - 1; i >= 0; i--) {
      const b = blasts[i];
      const v = (clock - b.t0) / p.burstMs;
      if (v >= 1) { blasts.splice(i, 1); continue; }

      const ANT = 0.12; // anticipation share of the timeline
      let scale, amt;
      if (v < ANT) {
        const u = v / ANT;
        scale = 1 - 0.15 * Math.sin(u * Math.PI / 2);
        amt = 0.15 * u;
      } else {
        const u = (v - ANT) / (1 - ANT);
        scale = 0.85 + (p.burstScale - 0.85) * easeOutExpo(u);
        amt = 0.15 + 0.85 * easeOutCubic(Math.min(1, u * 2.5));
      }
      const R = b.r * scale;
      const fade = 1 - easeInCubic(v);

      ctx.save();
      ctx.globalCompositeOperation = p.circleDifference ? 'difference' : 'source-over';
      ctx.globalAlpha = fade;

      // expanding rings
      ctx.strokeStyle = b.color;
      ctx.lineWidth = 1.5;
      for (let r = 0; r < (p.burstRings | 0); r++) {
        const rv = Math.max(0, v - ANT - r * 0.08);
        if (rv <= 0) continue;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r * (1 + easeOutExpo(rv) * p.burstScale * (1.25 + r * 0.35)), 0, TAU);
        ctx.stroke();
      }

      // body: solid, then flips to a thinning outline
      blastPath(b, R, amt, boilFrame);
      if (v < 0.55) {
        ctx.fillStyle = b.color;
        ctx.fill();
      } else {
        ctx.lineWidth = Math.max(0.5, 3 * (1 - v) / 0.45);
        ctx.stroke();
      }

      // inner flash in the foreground colour, right after the anticipation
      if (p.blastFlash && v > ANT && v < 0.45) {
        const f = (v - ANT) / (0.45 - ANT);
        ctx.globalAlpha = fade * (1 - f);
        ctx.fillStyle = ballHex(0);
        blastPath({ ...b, rot: b.rot + Math.PI / Math.max(3, p.blastDetail) }, R * 0.55 * (0.6 + f * 0.6), amt, boilFrame);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  function drawObstacles() {
    if (!obstacles.length) return;
    ctx.save();
    ctx.globalCompositeOperation = params.circleDifference ? 'difference' : 'source-over';
    for (const o of obstacles) {
      ctx.fillStyle = o.color;
      ctx.beginPath();
      ctx.arc(o.x, o.y, o.r, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  // Figma-style drag frame, in the cursor's grey/black: circle, border box, handles, size label.
  function drawPreview() {
    if (!preview) return;
    const p = params;
    const { x, y, r, color } = preview;
    ctx.save();
    ctx.globalCompositeOperation = p.circleDifference ? 'difference' : 'source-over';
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    ctx.restore();

    if (!p.frameOn) return;
    const e = r + p.frameOffset; // half-size of the frame box
    ctx.save();
    ctx.globalAlpha = p.frameOpacity;
    if (p.frameWidth > 0) {
      ctx.strokeStyle = p.cursorColor;
      ctx.lineWidth = p.frameWidth;
      ctx.setLineDash(p.frameDash > 0 ? [p.frameDash, p.frameDash] : []);
      ctx.strokeRect(x - e, y - e, e * 2, e * 2);
      ctx.setLineDash([]);
    }
    const hs = p.handleSize;
    if (hs > 0) {
      ctx.fillStyle = p.cursorInk;
      ctx.strokeStyle = p.cursorColor;
      ctx.lineWidth = Math.max(1, p.frameWidth);
      for (const [cx, cy] of [[x - e, y - e], [x + e, y - e], [x - e, y + e], [x + e, y + e]]) {
        ctx.fillRect(cx - hs / 2, cy - hs / 2, hs, hs);
        ctx.strokeRect(cx - hs / 2, cy - hs / 2, hs, hs);
      }
    }
    if (p.frameLabel) {
      const d = Math.round(r * 2);
      const label = `${d} × ${d}`;
      ctx.font = '11px "Helvetica Neue", Helvetica, Arial, sans-serif';
      const tw = ctx.measureText(label).width;
      const lx = x - tw / 2 - 6, ly = y + e + 8;
      ctx.fillStyle = p.cursorColor;
      ctx.beginPath(); ctx.roundRect(lx, ly, tw + 12, 17, 8.5); ctx.fill();
      ctx.fillStyle = p.cursorInk;
      ctx.textBaseline = 'middle';
      ctx.fillText(label, lx + 6, ly + 9);
    }
    ctx.restore();
  }

  const F = { x: 0, y: 0 };

  function step(k, now) {
    const p = params;
    syncCount();
    updateEngagement(k, now);
    updateHulls(now);
    floatObstacles(k);
    if (!p.swarmOn) return; // frozen: balls hold position, everything else keeps running

    const containers = p.circlesOn && p.circleMode === 'container';
    const solid = p.circlesOn && p.circleMode === 'obstacle';
    const per2 = p.perception * p.perception;
    const sp2 = p.spacing * p.spacing;
    const cruiseSpeed = p.maxSpeed * p.cruise;
    // Alignment + cohesion belong to the chase; idle agents stay individual,
    // and the flock bonds are cut while the disperse burst is active.
    const flockW = (p.idleFlock + (1 - p.idleFlock) * engage) * (1 - burst);
    const speedCap = p.maxSpeed
      * (1 + engage * Math.max(0, p.followSpeed * (1 + p.stagger) - 1))
      * (1 + burst * p.disperseForce * 0.3);

    for (let i = 0; i < agents.length; i++) {
      const a = agents[i];
      F.x = 0; F.y = 0;

      // 1. Wander — a target that drifts on a circle ahead of the agent.
      const autonomy = 1 - engage;
      if (a.trap && (a.trap.dead || !containers)) a.trap = null;

      if (p.wanderOn && p.wander > 0 && autonomy > 0.001) {
        a.wander += (Math.random() * 2 - 1) * p.wanderJitter * k;
        const sp = Math.hypot(a.vx, a.vy) || 1;
        const tx = (a.vx / sp) * 1.2 + Math.cos(a.wander);
        const ty = (a.vy / sp) * 1.2 + Math.sin(a.wander);
        steer(a, tx, ty, cruiseSpeed, p.maxForce * p.wander * autonomy, F);
      }

      // 2. Flock — separation / alignment / cohesion over neighbours in range.
      let n = 0, ax = 0, ay = 0, cx = 0, cy = 0, sx = 0, sy = 0, ns = 0;
      for (let j = 0; p.flockOn && j < agents.length; j++) {
        if (j === i) continue;
        const b = agents[j];
        const dx = b.x - a.x, dy = b.y - a.y;
        const d2 = dx * dx + dy * dy;
        if (d2 > per2 || d2 === 0) continue;
        n++;
        ax += b.vx; ay += b.vy;
        cx += b.x; cy += b.y;
        if (d2 < sp2) { sx -= dx / d2; sy -= dy / d2; ns++; }
      }
      if (ns && p.separation) steer(a, sx, sy, p.maxSpeed, p.maxForce * p.separation, F);
      if (n && flockW > 0.001) {
        if (p.alignment) steer(a, ax, ay, p.maxSpeed, p.maxForce * p.alignment * flockW, F);
        if (p.cohesion) steer(a, cx / n - a.x, cy / n - a.y, p.maxSpeed, p.maxForce * p.cohesion * flockW, F);
      }

      // 3. Mouse field — seek a ring around the pointer, with a tangential swirl.
      if (engage > 0.001) {
        const dx = pointer.x - a.x, dy = pointer.y - a.y;
        const dist = Math.hypot(dx, dy) || 1e-6;
        const nx = dx / dist, ny = dy / dist;
        const reach = 1 - p.falloff + p.falloff * clamp(1 - dist / p.fieldRadius, 0, 1);
        const resp = Math.max(0.05, 1 + a.bias * p.stagger);
        const radial = p.maxSpeed * p.followSpeed * resp
          * clamp((dist - p.holdRadius) / p.arriveRadius, -1, 1);
        const tang = p.orbit * p.maxSpeed * resp;
        const dvx = nx * radial - ny * tang;
        const dvy = ny * radial + nx * tang;
        let fx = dvx - a.vx, fy = dvy - a.vy;
        const cap = p.maxForce * p.attraction * resp;
        const fm = Math.hypot(fx, fy);
        if (fm > cap) { fx = (fx / fm) * cap; fy = (fy / fm) * cap; }
        const w = engage * reach;
        F.x += fx * w; F.y += fy * w;
      }

      // 4. Disperse — lingering push away from where the pointer went idle.
      if (burst > 0.01) {
        const dx = a.x - burstOrigin.x, dy = a.y - burstOrigin.y;
        const dist = Math.hypot(dx, dy) || 1;
        const s = p.maxForce * p.disperseForce * burst * 0.5;
        F.x += (dx / dist) * s; F.y += (dy / dist) * s;
      }

      // 4b. Circle walls — obstacles: steer around from outside; containers: steer back in.
      if (a.trap && p.obstacleForce > 0 && p.obstacleMargin > 0) {
        const o = a.trap;
        const dx = a.x - o.x, dy = a.y - o.y;
        const d = Math.hypot(dx, dy) || 1;
        const gap = o.r - p.radius - d;
        if (gap < p.obstacleMargin) {
          const s = p.maxForce * p.obstacleForce * (1 - Math.max(0, gap) / p.obstacleMargin);
          F.x -= (dx / d) * s; F.y -= (dy / d) * s;
        }
      }
      if (solid && p.obstacleForce > 0 && p.obstacleMargin > 0) {
        for (const o of obstacles) {
          const dx = a.x - o.x, dy = a.y - o.y;
          const gap = Math.hypot(dx, dy) - o.r - p.radius;
          if (gap >= p.obstacleMargin) continue;
          const d = Math.hypot(dx, dy) || 1;
          const s = p.maxForce * p.obstacleForce * (1 - Math.max(0, gap) / p.obstacleMargin);
          F.x += (dx / d) * s; F.y += (dy / d) * s;
        }
      }

      // 5. Soft edges — steer back inside before hitting the frame.
      const m = p.edgeMargin || 1;
      const ef = p.maxForce * p.edgeForce;
      if (a.x < m) F.x += ef * (1 - a.x / m);
      else if (a.x > W - m) F.x -= ef * (1 - (W - a.x) / m);
      if (a.y < m) F.y += ef * (1 - a.y / m);
      else if (a.y > H - m) F.y -= ef * (1 - (H - a.y) / m);

      // Integrate (semi-implicit Euler, frame-rate normalised by k).
      a.vx = (a.vx + F.x * k) * (1 - p.drag * k);
      a.vy = (a.vy + F.y * k) * (1 - p.drag * k);
      const s = Math.hypot(a.vx, a.vy);
      if (s > speedCap) { a.vx = (a.vx / s) * speedCap; a.vy = (a.vy / s) * speedCap; }
      a.x += a.vx * k;
      a.y += a.vy * k;

      // Hard walls — the ball's edge reflects off the canvas bounds, never leaves.
      const r = p.radius;
      if (a.x < r) { a.x = r; a.vx = Math.abs(a.vx) * p.bounce; bounced(a); }
      else if (a.x > W - r) { a.x = W - r; a.vx = -Math.abs(a.vx) * p.bounce; bounced(a); }
      if (a.y < r) { a.y = r; a.vy = Math.abs(a.vy) * p.bounce; bounced(a); }
      else if (a.y > H - r) { a.y = H - r; a.vy = -Math.abs(a.vy) * p.bounce; bounced(a); }

      // Container wall — trapped balls reflect off the inside of their circle.
      if (a.trap) {
        const o = a.trap;
        const dx = a.x - o.x, dy = a.y - o.y;
        const lim = Math.max(0, o.r - r);
        const d = Math.hypot(dx, dy);
        if (d > lim) {
          const nx = dx / d, ny = dy / d;
          a.x = o.x + nx * lim;
          a.y = o.y + ny * lim;
          const vn = a.vx * nx + a.vy * ny;
          if (vn > 0) {
            a.vx -= (1 + p.bounce) * vn * nx;
            a.vy -= (1 + p.bounce) * vn * ny;
            bounced(a);
          }
        }
      }

      // Obstacle mode — push out along the normal and reflect.
      for (let j = 0; solid && j < obstacles.length; j++) {
        const o = obstacles[j];
        const dx = a.x - o.x, dy = a.y - o.y;
        const R = o.r + r;
        const d2 = dx * dx + dy * dy;
        if (d2 >= R * R) continue;
        const d = Math.sqrt(d2) || 1e-6;
        const nx = d2 ? dx / d : 1, ny = d2 ? dy / d : 0;
        a.x = o.x + nx * R;
        a.y = o.y + ny * R;
        const vn = a.vx * nx + a.vy * ny;
        if (vn < 0) {
          a.vx -= (1 + p.bounce) * vn * nx;
          a.vy -= (1 + p.bounce) * vn * ny;
          bounced(a);
        }
      }

      a.trail.push(a.x, a.y);
      const max = Math.max(2, p.trailLength | 0) * 2;
      if (a.trail.length > max) a.trail.splice(0, a.trail.length - max);
    }
  }

  // ---------------------------------------------------------------- render

  const BANDS = 12; // tapered trails are drawn in bands of equal width/alpha

  function drawTrail(t) {
    const p = params;
    const n = t.length / 2;
    if (n < 2) return;
    if (n === 2) {
      ctx.beginPath(); ctx.moveTo(t[0], t[1]); ctx.lineTo(t[2], t[3]); ctx.stroke();
      return;
    }
    // Smooth curve: quadratic segments through midpoints, using samples as control points.
    const segs = n - 2;
    const bands = p.taper > 0 || p.fade > 0 ? Math.min(BANDS, segs) : 1;
    for (let b = 0; b < bands; b++) {
      const i0 = 1 + Math.floor((b * segs) / bands);
      const i1 = 1 + Math.floor(((b + 1) * segs) / bands);
      const f = (b + 1) / bands; // 0 at tail → 1 at head
      ctx.globalAlpha = p.trailOpacity * (1 - p.fade * (1 - f));
      ctx.lineWidth = p.trailWidth * (1 - p.taper * (1 - f));
      ctx.beginPath();
      if (i0 === 1) ctx.moveTo(t[0], t[1]);
      else ctx.moveTo((t[2 * i0 - 2] + t[2 * i0]) / 2, (t[2 * i0 - 1] + t[2 * i0 + 1]) / 2);
      for (let i = i0; i < i1; i++) {
        ctx.quadraticCurveTo(
          t[2 * i], t[2 * i + 1],
          (t[2 * i] + t[2 * i + 2]) / 2, (t[2 * i + 1] + t[2 * i + 3]) / 2
        );
      }
      if (b === bands - 1) ctx.lineTo(t[2 * n - 2], t[2 * n - 1]);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawField() {
    const p = params;
    const { x, y } = pointer;
    ctx.save();
    ctx.strokeStyle = ballHex(0);
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.25;
    ctx.beginPath();
    ctx.moveTo(0, y); ctx.lineTo(W, y);
    ctx.moveTo(x, 0); ctx.lineTo(x, H);
    ctx.stroke();
    ctx.setLineDash([3, 5]);
    ctx.beginPath(); ctx.arc(x, y, p.fieldRadius, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y, p.holdRadius, 0, TAU); ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = p.bg;
    ctx.beginPath();
    ctx.moveTo(x, y - 6); ctx.lineTo(x + 6, y); ctx.lineTo(x, y + 6); ctx.lineTo(x - 6, y);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  // Resolve the colour-array params to a hex for a given ball.
  function ballHex(ci) {
    const c = params.ballColor;
    return c === 'random' ? COLORS[ci % COLORS.length] : c;
  }
  function trailHex(ci) {
    return params.trailColor === 'ball' ? ballHex(ci) : params.trailColor;
  }

  function render() {
    const p = params;
    ctx.fillStyle = p.bg;
    ctx.fillRect(0, 0, W, H);
    if (p.showField && pointer.inside) drawField();

    // Circles first, so trapped balls read on top (or invert through them in difference mode).
    if (p.circlesOn) drawObstacles();

    ctx.save();
    ctx.globalCompositeOperation = p.ballDifference ? 'difference' : 'source-over';
    if (p.trailOn) {
      ctx.lineCap = 'butt';
      ctx.lineJoin = 'round';
      for (const a of agents) {
        ctx.strokeStyle = trailHex(a.ci);
        drawTrail(a.trail);
      }
    }
    for (const a of agents) {
      ctx.fillStyle = ballHex(a.ci);
      ctx.beginPath();
      ctx.arc(a.x, a.y, p.radius, 0, TAU);
      ctx.fill();
    }
    ctx.restore();

    drawBlasts();
    drawHulls();
    drawPreview();
  }

  // ---------------------------------------------------------------- loop

  function frame(t) {
    raf = requestAnimationFrame(frame);
    const dt = last ? Math.min(0.05, (t - last) / 1000) : 1 / 60; // clamp after tab-switch
    last = t;
    fps += (1 / Math.max(dt, 1e-3) - fps) * 0.05;
    clock = t;
    step(dt * 60, t);
    render();
  }

  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  return {
    params,
    start() { if (!raf) { last = 0; raf = requestAnimationFrame(frame); } },
    stop() { cancelAnimationFrame(raf); raf = 0; },
    addObstacle,
    removeLastObstacle() { kill(obstacles.splice(-1, 1)); },
    obstacleAt,
    pop,
    clearObstacles() { kill(obstacles.splice(0)); },
    get obstacles() { return obstacles; },
    get agents() { return agents; },
    setPreview(c) { preview = c; },
    scatter() { following = true; engage = Math.max(engage, 0.3); disperse(); },
    state() {
      const mode = burst > 0.05 ? 'disperse' : engage > 0.5 ? 'follow' : 'wander';
      const trapped = agents.filter((a) => a.trap).length;
      return { mode, engage, fps, trapped };
    },
    destroy() {
      cancelAnimationFrame(raf); raf = 0;
      ro.disconnect();
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('mouseout', onOut);
      window.removeEventListener('blur', onBlur);
    },
  };
}
