// Single source of truth for every tunable value.
// The GUI is generated from this schema, and "copy params" exports the flat object.
// Speeds / forces are in px per frame @ 60fps (the sim normalises for real frame time).
// A section's `toggle` key is its on/off switch (shown as a dot in the section header).

// Colour array shared by balls, trails and circles. `random` draws only from COLORS.
export const COLORS = ['#ffe53e', '#ff5c3e', '#3e7aff', '#3cb54e', '#eeb4f9'];
export const PALETTE = [...COLORS, '#000000', '#ffffff'];

export const schema = [
  {
    section: 'Colour',
    items: [
      { key: 'bg', label: 'background', type: 'swatches', options: PALETTE, custom: true, value: '#000000' },
      { key: 'ballColor', label: 'balls', type: 'swatches', options: [...PALETTE, 'random'], custom: true, value: '#ffffff' },
      { key: 'trailColor', label: 'trails', type: 'swatches', options: ['ball', ...PALETTE], custom: true, value: 'ball' },
      { key: 'ballDifference', label: 'difference', type: 'toggle', value: false },
      { key: 'showField', label: 'show field', type: 'toggle', value: false },
    ],
  },
  {
    section: 'Swarm', toggle: 'swarmOn',
    items: [
      { key: 'count', label: 'count', min: 1, max: 150, step: 1, value: 40 },
      { key: 'radius', label: 'ball radius', min: 1, max: 30, step: 0.5, value: 9 },
      { key: 'maxSpeed', label: 'max speed', min: 0.5, max: 16, step: 0.1, value: 5 },
      { key: 'maxForce', label: 'max force', min: 0.01, max: 1, step: 0.01, value: 0.1 },
      { key: 'drag', label: 'drag', min: 0, max: 0.1, step: 0.001, value: 0.008 },
    ],
  },
  {
    section: 'Wander', toggle: 'wanderOn',
    items: [
      { key: 'wander', label: 'strength', min: 0, max: 3, step: 0.01, value: 1 },
      { key: 'wanderJitter', label: 'jitter', min: 0, max: 1, step: 0.01, value: 0.18 },
      { key: 'cruise', label: 'cruise speed', min: 0, max: 1, step: 0.01, value: 0.55 },
      { key: 'edgeMargin', label: 'edge margin', min: 0, max: 400, step: 1, value: 90 },
      { key: 'edgeForce', label: 'edge force', min: 0, max: 5, step: 0.05, value: 1.2 },
      { key: 'bounce', label: 'wall bounce', min: 0, max: 1, step: 0.01, value: 0.9 },
    ],
  },
  {
    section: 'Flock', toggle: 'flockOn',
    items: [
      { key: 'perception', label: 'perception', min: 10, max: 400, step: 1, value: 90 },
      { key: 'spacing', label: 'spacing', min: 0, max: 150, step: 1, value: 30 },
      { key: 'separation', label: 'separation', min: 0, max: 5, step: 0.05, value: 1.8 },
      { key: 'alignment', label: 'alignment', min: 0, max: 3, step: 0.05, value: 0.6 },
      { key: 'cohesion', label: 'cohesion', min: 0, max: 3, step: 0.05, value: 0.85 },
      { key: 'idleFlock', label: 'idle flocking', min: 0, max: 1, step: 0.01, value: 0.23 },
    ],
  },
  {
    section: 'Mouse field', toggle: 'mouseOn',
    items: [
      { key: 'attraction', label: 'attraction', min: 0, max: 5, step: 0.05, value: 1.4 },
      { key: 'followSpeed', label: 'follow speed', min: 0.2, max: 4, step: 0.05, value: 1.6 },
      { key: 'fieldRadius', label: 'field radius', min: 50, max: 2500, step: 10, value: 900 },
      { key: 'falloff', label: 'falloff', min: 0, max: 1, step: 0.01, value: 0.25 },
      { key: 'holdRadius', label: 'hold radius', min: 0, max: 300, step: 1, value: 80 },
      { key: 'arriveRadius', label: 'arrive radius', min: 1, max: 500, step: 1, value: 140 },
      { key: 'orbit', label: 'orbit', min: -2, max: 2, step: 0.01, value: 0.6 },
      { key: 'stagger', label: 'stagger', min: 0, max: 0.95, step: 0.01, value: 0.5 },
      { key: 'engageIn', label: 'engage rate', min: 0.005, max: 0.3, step: 0.005, value: 0.04 },
    ],
  },
  {
    section: 'Idle / disperse', toggle: 'disperseOn',
    items: [
      { key: 'idleDelay', label: 'idle after ms', min: 100, max: 6000, step: 50, value: 600 },
      { key: 'disperseForce', label: 'burst', min: 0, max: 12, step: 0.1, value: 9.9 },
      { key: 'disperseSpread', label: 'spread', min: 0, max: 3.14, step: 0.01, value: 1.55 },
      { key: 'disperseDecay', label: 'burst decay', min: 0.002, max: 0.1, step: 0.001, value: 0.018 },
      { key: 'engageOut', label: 'release rate', min: 0.005, max: 0.3, step: 0.005, value: 0.05 },
    ],
  },
  {
    section: 'Trail', toggle: 'trailOn',
    items: [
      { key: 'trailLength', label: 'length', min: 2, max: 300, step: 1, value: 146 },
      { key: 'trailWidth', label: 'width', min: 0.25, max: 6, step: 0.05, value: 1.4 },
      { key: 'trailOpacity', label: 'opacity', min: 0, max: 1, step: 0.01, value: 1 },
      { key: 'taper', label: 'taper', min: 0, max: 1, step: 0.01, value: 0 },
      { key: 'fade', label: 'fade', min: 0, max: 1, step: 0.01, value: 0.21 },
    ],
  },
  {
    section: 'Hulls', toggle: 'hullsOn',
    items: [
      { key: 'hullMax', label: 'max hulls', min: 0, max: 3, step: 1, value: 3 },
      { key: 'hullColor', label: 'colour', type: 'select', options: ['mix', 'green', 'magenta'], value: 'mix' },
      { key: 'hullMinBalls', label: 'min balls', min: 1, max: 20, step: 1, value: 1 },
      { key: 'hullMaxBalls', label: 'max balls', min: 1, max: 20, step: 1, value: 6 },
      { key: 'hullLifeMin', label: 'life min ms', min: 100, max: 10000, step: 50, value: 1200 },
      { key: 'hullLifeMax', label: 'life max ms', min: 100, max: 10000, step: 50, value: 4000 },
      { key: 'hullGap', label: 'spawn gap ms', min: 0, max: 5000, step: 50, value: 700 },
      { key: 'hullPadding', label: 'padding', min: 0, max: 60, step: 1, value: 6 },
      { key: 'hullWidth', label: 'stroke', min: 0.5, max: 4, step: 0.25, value: 1 },
    ],
  },
  {
    section: 'Circles', toggle: 'circlesOn',
    items: [
      { key: 'circleMode', label: 'mode', type: 'select', options: ['container', 'obstacle'], value: 'container' },
      { key: 'circleColor', label: 'colour', type: 'swatches', options: [...PALETTE, 'random'], custom: true, value: '#ffe53e' },
      { key: 'circleDifference', label: 'difference', type: 'toggle', value: false },
      { key: 'maxCircles', label: 'max circles', min: 1, max: 40, step: 1, value: 40 },
      { key: 'floatSpeed', label: 'float speed', min: 0, max: 2, step: 0.01, value: 0.15 },
      { key: 'obstacleForce', label: 'wall force', min: 0, max: 5, step: 0.05, value: 1.5 },
      { key: 'obstacleMargin', label: 'wall margin', min: 0, max: 200, step: 1, value: 40 },
    ],
  },
  {
    section: 'Burst (click a circle)', toggle: 'mousePop',
    items: [
      { key: 'blastShape', label: 'shape', type: 'select', options: ['spurs', 'clouds'], value: 'spurs' },
      { key: 'blastDetail', label: 'detail', min: 3, max: 40, step: 1, value: 12 },
      { key: 'blastStrength', label: 'strength', min: 0, max: 1.5, step: 0.01, value: 0.55 },
      { key: 'blastRatio', label: 'ratio', min: 0.1, max: 1, step: 0.01, value: 0.55 },
      { key: 'messy', label: 'messy', min: 0, max: 1, step: 0.01, value: 0.3 },
      { key: 'boil', label: 'boil fps', min: 0, max: 30, step: 1, value: 12 },
      { key: 'burstMs', label: 'duration ms', min: 150, max: 2500, step: 10, value: 700 },
      { key: 'burstScale', label: 'scale', min: 1, max: 4, step: 0.05, value: 2 },
      { key: 'burstRings', label: 'rings', min: 0, max: 5, step: 1, value: 2 },
      { key: 'blastFlash', label: 'flash', type: 'toggle', value: true },
      { key: 'shockwave', label: 'shockwave', min: 0, max: 20, step: 0.1, value: 6 },
    ],
  },
  {
    section: 'Cursor', toggle: 'cursorOn',
    items: [
      { key: 'cursorColor', label: 'grey', type: 'color', value: '#b9b9b9' },
      { key: 'cursorInk', label: 'black', type: 'color', value: '#010101' },
      { key: 'cursorLineWidth', label: 'line width', min: 0, max: 4, step: 0.5, value: 1 },
      { key: 'cursorOpacity', label: 'line opacity', min: 0, max: 1, step: 0.01, value: 1 },
      { key: 'cursorDifference', label: 'difference', type: 'toggle', value: true },
      { key: 'cursorSize', label: 'pointer size', min: 6, max: 32, step: 1, value: 16 },
    ],
  },
  {
    section: 'Drag frame', toggle: 'frameOn',
    items: [
      { key: 'frameWidth', label: 'border width', min: 0, max: 4, step: 0.25, value: 1 },
      { key: 'frameOpacity', label: 'border opacity', min: 0, max: 1, step: 0.01, value: 1 },
      { key: 'frameDash', label: 'dash', min: 0, max: 16, step: 1, value: 0 },
      { key: 'frameOffset', label: 'offset', min: 0, max: 30, step: 1, value: 0 },
      { key: 'handleSize', label: 'handle size', min: 0, max: 14, step: 1, value: 6 },
      { key: 'frameLabel', label: 'size label', type: 'toggle', value: true },
    ],
  },
];

export const defaults = Object.fromEntries([
  ...schema.filter((s) => s.toggle).map((s) => [s.toggle, true]),
  ...schema.flatMap((s) => s.items.map((i) => [i.key, i.value])),
]);

// ---------------------------------------------------------------- themes
// A theme is a partial param set applied on top of the current params.
// Colour themes only touch colour keys, so your motion tuning stays put.
// `chip` = [background, accent] for the swatch in the panel.

const duo = (bg, ink, extra = {}) => ({
  chip: [bg, ink],
  values: {
    bg, ballColor: ink, trailColor: 'ball', circleColor: ink,
    cursorColor: ink, cursorInk: bg, cursorDifference: false,
    ballDifference: false, circleDifference: true, ...extra,
  },
});

export const themes = [
  {
    name: 'Mono',
    chip: ['#000000', '#ffffff'],
    values: {
      bg: '#000000', ballColor: '#ffffff', trailColor: 'ball', circleColor: 'random',
      cursorColor: '#b9b9b9', cursorInk: '#010101', cursorDifference: true,
      ballDifference: false, circleDifference: false,
    },
  },
  {
    // Tuned set from the Phase 1 session — full params (motion + colour).
    name: 'Tangerine / Violet',
    chip: ['#ff4d00', '#ba66ff'],
    values: {
      count: 40, radius: 15.5, maxSpeed: 5, maxForce: 0.1, drag: 0.008,
      wander: 1, wanderJitter: 0.18, cruise: 0.55, edgeMargin: 90, edgeForce: 1.2, bounce: 0.9,
      perception: 90, spacing: 30, separation: 1.8, alignment: 0.6, cohesion: 0.85, idleFlock: 0.23,
      attraction: 1.4, followSpeed: 1.6, fieldRadius: 900, falloff: 0.25, holdRadius: 80,
      arriveRadius: 304, orbit: 1.77, stagger: 0.74, engageIn: 0.04,
      idleDelay: 600, disperseForce: 9.9, disperseSpread: 1.55, disperseDecay: 0.018, engageOut: 0.1,
      trailLength: 146, trailWidth: 1.4, trailOpacity: 1, taper: 0, fade: 0.21,
      hullMax: 0, hullColor: 'green', hullMinBalls: 1, hullMaxBalls: 6,
      hullLifeMin: 2900, hullLifeMax: 6450, hullGap: 4350, hullPadding: 0, hullWidth: 1,
      circleColor: 'random', circleDifference: true, maxCircles: 40, floatSpeed: 0.15,
      obstacleForce: 1.5, obstacleMargin: 40,
      mousePop: true, blastShape: 'clouds', blastDetail: 29, blastStrength: 0, blastRatio: 0.72,
      messy: 0.26, boil: 0, burstMs: 700, burstScale: 2.1, burstRings: 2, blastFlash: false, shockwave: 18.9,
      cursorColor: '#ba66ff', cursorInk: '#ff4d00', cursorLineWidth: 1, cursorOpacity: 1,
      cursorDifference: true, cursorSize: 16,
      frameWidth: 3, frameOpacity: 1, frameDash: 9, frameOffset: 28, handleSize: 14, frameLabel: false,
      bg: '#ff4d00', ballColor: '#ba66ff', trailColor: 'ball', ballDifference: false, showField: true,
    },
  },
  { name: 'Cobalt / Lemon', ...duo('#1f3cff', '#ffe53e') },
  { name: 'Bubblegum / Forest', ...duo('#ff9ee8', '#0a6b38') },
  { name: 'Lime / Ink', ...duo('#c8ff00', '#000000', { circleDifference: false }) },
  { name: 'Tomato / Cream', ...duo('#ff2a1a', '#fff4dc') },
  { name: 'Ultramarine / Orange', ...duo('#0038ff', '#ff7a00') },
  { name: 'Mint / Magenta', ...duo('#6dffc0', '#ff00b8') },
  { name: 'Paper', ...duo('#ffffff', '#000000', { circleDifference: false }) },
];
