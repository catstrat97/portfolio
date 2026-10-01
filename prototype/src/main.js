import { createSwarm } from './swarm.js';
import { schema, defaults, themes } from './params.js';
import { createGui } from './gui.js';
import { createCircleTool } from './circle-tool.js';
import { createCursor } from './cursor.js';

const STORE = 'swarm-params-v1';
const THEMES = 'swarm-themes-v1';

function load() {
  try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch { return {}; }
}
function save(p) {
  try { localStorage.setItem(STORE, JSON.stringify(p)); } catch {}
}
function loadThemes() {
  try { return JSON.parse(localStorage.getItem(THEMES)) || []; } catch { return []; }
}
function saveThemes(list) {
  try { localStorage.setItem(THEMES, JSON.stringify(list)); } catch {}
}

// URL switches:
//   ?gui=0 / ?gui=1   force the param panel off / on (phones default to off)
//   ?theme=Name       apply a theme by name, e.g. ?theme=Tangerine
const q = new URLSearchParams(location.search);
const coarse = matchMedia('(pointer: coarse)').matches;
const showGui = q.has('gui') ? q.get('gui') !== '0' : !coarse;

const saved = load();
const params = { ...defaults };
for (const k of Object.keys(defaults)) if (k in saved) params[k] = saved[k];
params.theme = saved.theme || '';

const wanted = q.get('theme');
if (wanted) {
  const t = themes.find((x) => x.name.toLowerCase().startsWith(wanted.toLowerCase()));
  if (t) { Object.assign(params, t.values); params.theme = t.name; }
}

const swarm = createSwarm(document.getElementById('stage'), params);
swarm.start();
createCircleTool(document.getElementById('stage'), swarm, params);
const cursor = createCursor(params);

if (showGui) {
  createGui({
    schema,
    params,
    defaults,
    onChange: (p) => { save(p); cursor.update(); },
    status: swarm.state,
    title: 'swarm — phase 1',
    actions: [{ label: 'clear circles', fn: () => swarm.clearObstacles() }],
    themes,
    savedThemes: loadThemes(),
    onSaveThemes: saveThemes,
  });
}

window.swarm = swarm; // handy for poking from devtools
