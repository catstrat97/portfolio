// Figma ellipse tool with Shift permanently held: drag from a corner,
// the box stays square, so the result is always a perfect circle.
//   drag          draw a circle (released circles become floating obstacles)
//   click circle  burst it (POW-style mouse pop)
//   Esc           cancel the current drag
//   ⌘Z / Ctrl+Z   remove the last circle

import { COLORS } from './params.js';
const MIN_RADIUS = 3;

export function createCircleTool(canvas, swarm, params, { ignoreSelector = '[data-swarm-ignore]' } = {}) {
  let drag = null; // { id, x0, y0, color }

  const local = (e) => {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const pickColor = () =>
    params.circleColor === 'random'
      ? COLORS[(Math.random() * COLORS.length) | 0]
      : params.circleColor;

  // Corner-anchored square (Shift): side = the larger drag axis, grows toward the pointer.
  function circleFrom(x1, y1) {
    const dx = x1 - drag.x0, dy = y1 - drag.y0;
    const side = Math.max(Math.abs(dx), Math.abs(dy));
    return {
      x: drag.x0 + (Math.sign(dx) || 1) * side / 2,
      y: drag.y0 + (Math.sign(dy) || 1) * side / 2,
      r: side / 2,
      color: drag.color,
    };
  }

  function onDown(e) {
    if (e.button !== 0 || drag || !params.circlesOn) return;
    if (e.target instanceof Element && e.target.closest(ignoreSelector)) return;
    const p = local(e);
    // Mouse pop: pressing on an existing circle bursts it instead of starting a new one.
    const hit = params.mousePop && swarm.obstacleAt(p.x, p.y);
    if (hit) { swarm.pop(hit); return; }
    drag = { id: e.pointerId, x0: p.x, y0: p.y, color: pickColor() };
  }

  function onMove(e) {
    if (!drag || e.pointerId !== drag.id) return;
    const p = local(e);
    swarm.setPreview(circleFrom(p.x, p.y));
  }

  function onUp(e) {
    if (!drag || e.pointerId !== drag.id) return;
    const p = local(e);
    const c = circleFrom(p.x, p.y);
    if (c.r >= MIN_RADIUS) swarm.addObstacle(c);
    cancel();
  }

  function cancel() {
    drag = null;
    swarm.setPreview(null);
  }

  function onKey(e) {
    if (e.key === 'Escape') cancel();
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      swarm.removeLastObstacle();
    }
  }

  window.addEventListener('pointerdown', onDown);
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', cancel);
  window.addEventListener('keydown', onKey);

  return {
    destroy() {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', cancel);
      window.removeEventListener('keydown', onKey);
    },
  };
}
