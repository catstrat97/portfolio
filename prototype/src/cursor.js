// Custom cursor from Figma node 1055:1743 ("Mouse"):
// full-viewport 1px #b9b9b9 crosshair in difference blend + a 16px diamond marker.
// The native cursor is hidden over the canvas only; the GUI keeps the normal cursor.

export function createCursor(params, { ignoreSelector = '[data-swarm-ignore]' } = {}) {
  const root = document.createElement('div');
  root.className = 'xhair';
  root.setAttribute('aria-hidden', 'true');
  root.innerHTML = '<div class="xhair-h"></div><div class="xhair-v"></div><div class="xhair-dot"><i></i></div>';
  document.body.append(root);

  const h = root.children[0], v = root.children[1], dot = root.children[2];

  function onMove(e) {
    const off = !params.cursorOn || e.pointerType === 'touch'
      || (e.target instanceof Element && e.target.closest(ignoreSelector));
    root.classList.toggle('is-off', !!off);
    if (off) return;
    h.style.transform = `translate3d(0, ${e.clientY}px, 0)`;
    v.style.transform = `translate3d(${e.clientX}px, 0, 0)`;
    dot.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
  }
  function onOut(e) { if (!e.relatedTarget) root.classList.add('is-off'); }

  // Push the shared grey/black cursor params into CSS custom properties.
  function update() {
    const s = root.style;
    s.setProperty('--xh-grey', params.cursorColor);
    s.setProperty('--xh-black', params.cursorInk);
    s.setProperty('--xh-w', `${params.cursorLineWidth}px`);
    s.setProperty('--xh-opacity', params.cursorOpacity);
    s.setProperty('--xh-blend', params.cursorDifference ? 'difference' : 'normal');
    s.setProperty('--xh-size', `${params.cursorSize}px`);
    document.documentElement.classList.toggle('xhair-on', !!params.cursorOn);
    if (!params.cursorOn) root.classList.add('is-off');
  }
  update();

  root.classList.add('is-off');
  window.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener('pointerdown', onMove, { passive: true });
  window.addEventListener('mouseout', onOut);

  return {
    update,
    destroy() {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onMove);
      window.removeEventListener('mouseout', onOut);
      root.remove();
    },
  };
}
