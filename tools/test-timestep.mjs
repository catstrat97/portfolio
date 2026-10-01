// Headless check of the core timing guarantee:
// the simulation must advance ~60 steps per real second at ANY frame rate,
// so motion speed never depends on the device's refresh rate or load.
//
//   node tools/test-timestep.mjs

import { defaults } from '../prototype/src/params.js';

// ---------------------------------------------------------------- DOM stubs

let rafCb = null;
globalThis.requestAnimationFrame = (cb) => { rafCb = cb; return 1; };
globalThis.cancelAnimationFrame = () => { rafCb = null; };
globalThis.matchMedia = () => ({ matches: false });
globalThis.ResizeObserver = class { observe() {} disconnect() {} };
globalThis.Element = class {};
globalThis.document = {
  hidden: false,
  addEventListener() {},
  removeEventListener() {},
  documentElement: { classList: { toggle() {} } },
};
globalThis.window = { addEventListener() {}, removeEventListener() {}, devicePixelRatio: 2 };
globalThis.devicePixelRatio = 2;

const ctx = new Proxy({}, {
  get: (_t, k) => (k === 'measureText' ? () => ({ width: 10 }) : () => {}),
  set: () => true,
});
const canvas = {
  width: 0, height: 0,
  getContext: () => ctx,
  getBoundingClientRect: () => ({ width: 1200, height: 800, left: 0, top: 0 }),
};

const { createSwarm } = await import('../prototype/src/swarm.js');

// ---------------------------------------------------------------- harness

function run({ fps, seconds = 6, stallEvery = 0, stallMs = 0 }) {
  const params = { ...defaults, theme: '' };
  const swarm = createSwarm(canvas, params);
  swarm.start();
  const dt = 1000 / fps;
  let t = 0;
  const tick = (i) => {
    t += dt + (stallEvery && i % stallEvery === 0 ? stallMs : 0);
    rafCb(t);
  };
  // Warm-up, so a stall mid-recovery at either edge doesn't skew the rate.
  const warm = Math.round(fps);
  for (let i = 0; i < warm; i++) tick(i);
  const start = swarm.state().steps;
  const t0 = t;
  const frames = Math.round(fps * seconds);
  for (let i = 0; i < frames; i++) tick(warm + i);
  swarm.destroy();
  return (swarm.state().steps - start) / ((t - t0) / 1000);
}

const cases = [
  { name: '144 fps', fps: 144 },
  { name: '60 fps', fps: 60 },
  { name: '30 fps', fps: 30 },
  { name: '20 fps', fps: 20 },
  { name: '60 fps + 150ms stalls', fps: 60, stallEvery: 30, stallMs: 150 },
  { name: '12 fps', fps: 12 },
  { name: '6 fps (below catch-up limit)', fps: 6 },
];

let failed = 0;
for (const c of cases) {
  const rate = run(c);
  // 60 steps/s is the target; only below ~10fps does the substep cap limit catch-up.
  const expected = Math.min(60, 6 * c.fps);
  const ok = Math.abs(rate - expected) / expected < 0.06;
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${c.name.padEnd(30)} ${rate.toFixed(1)} steps/s (expect ~${expected})`);
}

console.log(failed ? `\n${failed} case(s) failed` : '\nall cases within 6% of target');
process.exit(failed ? 1 : 0);
