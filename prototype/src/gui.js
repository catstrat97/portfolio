// Tiny schema-driven param panel (Figma "about" panel style). No dependencies.
//   H             hide / show
//   click head    collapse panel · click a section title to fold it
//   section dot   switch that whole section on / off
//   dbl-click a value to reset that single param
//   theme chips   apply a theme · right-click a saved theme to delete it

const decimals = (step) => (String(step).split('.')[1] || '').length;

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

export function createGui({
  schema, params, defaults, onChange = () => {}, status, title = 'params',
  actions: extra = [], themes = [], savedThemes = [], onSaveThemes = () => {},
}) {
  const root = el('aside', 'gui');
  root.setAttribute('data-swarm-ignore', '');

  const head = el('button', 'gui-pill gui-head');
  head.append(el('span', null, title), el('span', 'gui-head-hint', '—'));
  const panel = el('div', 'gui-panel');
  root.append(head, panel);

  head.addEventListener('click', () => {
    const closed = root.classList.toggle('is-collapsed');
    head.lastChild.textContent = closed ? '+' : '—';
  });

  const views = []; // { item, input, out }
  const sections = []; // { sec, node, toggle }
  const changed = () => { onChange(params); };

  // ---------------------------------------------------------------- rows

  function paint({ item, input, out }) {
    const v = params[item.key];
    if (item.type === 'toggle') input.checked = !!v;
    else if (item.type === 'select') input.value = v;
    else if (item.type === 'swatches') {
      let hit = false;
      for (const b of input.children) {
        const on = b.dataset.value === v;
        hit ||= on;
        b.classList.toggle('is-on', on);
      }
      const custom = input.querySelector('.is-custom');
      if (custom) {
        const isHex = /^#[0-9a-f]{6}$/i.test(v);
        custom.classList.toggle('is-on', !hit && isHex);
        if (isHex) custom.value = v;
      }
    } else if (item.type === 'color') { input.value = v; out.textContent = v; }
    else {
      input.value = v;
      out.textContent = Number(v).toFixed(decimals(item.step));
      input.style.setProperty('--p', `${((v - item.min) / (item.max - item.min)) * 100}%`);
    }
  }

  function swatches(item, view) {
    const wrap = el('div', 'gui-swatches');
    const set = (v) => { params[item.key] = v; paint(view); changed(); };
    for (const o of item.options) {
      const b = el('button', 'gui-swatch');
      b.type = 'button';
      b.dataset.value = o;
      b.title = o === 'ball' ? 'match balls' : o;
      if (o === 'random') b.classList.add('is-random');
      else if (o === 'ball') b.classList.add('is-match');
      else b.style.background = o;
      b.addEventListener('click', (e) => { e.preventDefault(); set(o); });
      wrap.append(b);
    }
    if (item.custom) {
      const c = el('input', 'gui-swatch is-custom');
      c.type = 'color';
      c.title = 'custom colour';
      c.addEventListener('input', () => set(c.value));
      wrap.append(c);
    }
    return wrap;
  }

  function row(item) {
    const r = el('label', 'gui-row');
    const name = el('span', 'gui-label', item.label);
    const out = el('output', 'gui-value');
    const view = { item, input: null, out };
    let input;

    if (item.type === 'toggle') {
      input = el('input', 'gui-toggle');
      input.type = 'checkbox';
      input.addEventListener('change', () => { params[item.key] = input.checked; changed(); });
      r.append(name, input, out);
    } else if (item.type === 'swatches') {
      input = swatches(item, view);
      r.append(name, input);
    } else if (item.type === 'select') {
      input = el('select', 'gui-select');
      for (const o of item.options) input.append(new Option(o, o));
      input.addEventListener('change', () => { params[item.key] = input.value; changed(); });
      r.append(name, input, out);
    } else if (item.type === 'color') {
      input = el('input', 'gui-color');
      input.type = 'color';
      input.addEventListener('input', () => { params[item.key] = input.value; paint(view); changed(); });
      r.append(name, input, out);
    } else {
      input = el('input', 'gui-range');
      Object.assign(input, { type: 'range', min: item.min, max: item.max, step: item.step });
      input.addEventListener('input', () => { params[item.key] = Number(input.value); paint(view); changed(); });
      r.append(name, input, out);
    }

    out.title = 'double-click to reset';
    out.addEventListener('dblclick', (e) => {
      e.preventDefault();
      params[item.key] = defaults[item.key];
      paint(view); changed();
    });

    view.input = input;
    views.push(view);
    paint(view);
    return r;
  }

  // ---------------------------------------------------------------- themes

  const themeSec = el('section', 'gui-sec');
  const themeHead = el('div', 'gui-sec-head');
  const themeTitle = el('button', 'gui-sec-title', 'Theme');
  themeTitle.addEventListener('click', () => themeSec.classList.toggle('is-folded'));
  themeHead.append(themeTitle);
  const themeBody = el('div', 'gui-sec-body');
  const themeChips = el('div', 'gui-themes');
  const themeName = el('p', 'gui-theme-name', ' ');
  themeBody.append(themeChips, themeName);
  themeSec.append(themeHead, themeBody);
  panel.append(themeSec);

  function applyTheme(t) {
    Object.assign(params, t.values);
    params.theme = t.name;
    refresh(); changed();
  }

  function renderThemes() {
    themeChips.replaceChildren();
    const all = [...themes, ...savedThemes.map((t) => ({ ...t, saved: true }))];
    for (const t of all) {
      const b = el('button', 'gui-theme');
      b.type = 'button';
      b.title = t.saved ? `${t.name} (right-click to delete)` : t.name;
      b.style.setProperty('--a', t.chip[0]);
      b.style.setProperty('--b', t.chip[1]);
      b.classList.toggle('is-on', params.theme === t.name);
      b.addEventListener('click', () => applyTheme(t));
      b.addEventListener('mouseenter', () => (themeName.textContent = t.name));
      b.addEventListener('mouseleave', () => (themeName.textContent = params.theme || ' '));
      if (t.saved) {
        b.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          savedThemes.splice(savedThemes.findIndex((s) => s.name === t.name), 1);
          onSaveThemes(savedThemes);
          renderThemes();
        });
      }
      themeChips.append(b);
    }
    themeName.textContent = params.theme || ' ';
  }

  // ---------------------------------------------------------------- sections

  for (const sec of schema) {
    const s = el('section', 'gui-sec');
    const h = el('div', 'gui-sec-head');
    const t = el('button', 'gui-sec-title', sec.section);
    t.addEventListener('click', () => s.classList.toggle('is-folded'));
    h.append(t);
    let toggle = null;
    if (sec.toggle) {
      toggle = el('input', 'gui-toggle gui-sec-toggle');
      toggle.type = 'checkbox';
      toggle.title = 'enable / disable section';
      toggle.addEventListener('change', () => {
        params[sec.toggle] = toggle.checked;
        s.classList.toggle('is-off', !toggle.checked);
        changed();
      });
      h.append(toggle);
    }
    const body = el('div', 'gui-sec-body');
    sec.items.forEach((it) => body.append(row(it)));
    s.append(h, body);
    panel.append(s);
    sections.push({ sec, node: s, toggle });
  }

  // ---------------------------------------------------------------- footer

  const foot = el('div', 'gui-foot');
  const stat = el('p', 'gui-status', ' ');
  const actions = el('div', 'gui-actions');
  const btn = (label, fn) => { const b = el('button', 'gui-pill gui-btn', label); b.addEventListener('click', fn); actions.append(b); return b; };

  const copyBtn = btn('copy params', async () => {
    const json = JSON.stringify(params, null, 2);
    try { await navigator.clipboard.writeText(json); }
    catch {
      const ta = Object.assign(document.createElement('textarea'), { value: json });
      document.body.append(ta); ta.select(); document.execCommand('copy'); ta.remove();
    }
    flash(copyBtn, 'copied');
  });
  const pasteBtn = btn('paste', () => {
    const txt = window.prompt('Paste params JSON');
    if (!txt) return;
    try {
      const data = JSON.parse(txt);
      for (const k of Object.keys(defaults)) if (k in data) params[k] = data[k];
      refresh(); changed(); flash(pasteBtn, 'loaded');
    } catch { flash(pasteBtn, 'invalid json'); }
  });
  const saveBtn = btn('save theme', () => {
    const name = window.prompt('Theme name');
    if (!name) return;
    const values = { ...params, theme: name };
    const chipB = params.ballColor === 'random' ? '#ffe53e' : params.ballColor;
    const i = savedThemes.findIndex((t) => t.name === name);
    const t = { name, chip: [params.bg, chipB], values };
    if (i >= 0) savedThemes[i] = t; else savedThemes.push(t);
    params.theme = name;
    onSaveThemes(savedThemes);
    renderThemes(); changed(); flash(saveBtn, 'saved');
  });
  btn('reset', () => { Object.assign(params, defaults); params.theme = ''; refresh(); changed(); });
  for (const a of extra) btn(a.label, a.fn);

  foot.append(stat, actions);
  panel.append(foot);

  function flash(b, text) {
    const prev = b.dataset.label || b.textContent;
    b.dataset.label = prev;
    b.textContent = text;
    clearTimeout(b._t);
    b._t = setTimeout(() => (b.textContent = prev), 1100);
  }

  function refresh() {
    views.forEach(paint);
    for (const { sec, node, toggle } of sections) {
      if (!toggle) continue;
      toggle.checked = !!params[sec.toggle];
      node.classList.toggle('is-off', !toggle.checked);
    }
    renderThemes();
  }
  refresh();

  if (status) {
    setInterval(() => {
      const s = status();
      stat.textContent = `${s.mode} · engage ${s.engage.toFixed(2)} · ${s.trapped} trapped · ${Math.round(s.fps)} fps`;
    }, 200);
  }

  window.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() !== 'h' || e.metaKey || e.ctrlKey) return;
    if (e.target instanceof HTMLInputElement && e.target.type === 'text') return;
    root.classList.toggle('is-hidden');
  });

  document.body.append(root);
  return { root, refresh };
}
