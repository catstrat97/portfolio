# Portfolio — project plan & notes

A one-page portfolio that will grow into several pages, with **no loading screens and no hard
page reloads**. The signature piece is an interactive swarm: 40 balls with bezier trails that
wander on their own, flock toward the cursor, and scatter when the cursor goes idle.

---

## Run the Phase 1 prototype

```bash
python3 -m http.server 5173 -d prototype
```

Open http://localhost:5173.

| Control | What it does |
|---|---|
| `H` | hide / show the panel |
| click the pill | collapse the panel |
| click a section title | fold that section |
| double-click a value | reset that one param to default |
| **copy params** | copies the full param object as JSON |
| **paste** | load a JSON param set (e.g. one you copied earlier) |
| **reset** | back to defaults |
| dot next to a section title | switch that whole section on / off |
| theme chips | apply a theme (colour themes keep your motion tuning) · **save theme** stores the current set · right-click a saved one to delete it |
| drag on canvas | draw a circle (Figma ellipse tool with Shift always held). **container** mode traps the balls it's drawn over; **obstacle** mode makes it a solid body |
| click a circle | POW-style burst; trapped balls are released by the shockwave |
| `Esc` / `⌘Z` | cancel the drag / remove the last circle |
| **clear circles** | remove all drawn circles |

Params auto-save to `localStorage`, so a refresh keeps your tuning. The cursor is ignored while it's
over the panel, so you can watch the idle/disperse behaviour while you tune.
When a set feels right, **copy params** and paste it into `prototype/src/params.js`
(or send it to me) to make it the new default.

```
prototype/
  index.html
  src/
    swarm.js    ← the simulation + renderer. Framework-agnostic, zero deps. This is the part that ships.
    params.js   ← schema: every tunable value, its range and default. GUI is generated from it.
    gui.js      ← param panel (throwaway tooling, styled from the Figma "about" panel)
    gui.css
    main.js     ← glue: load saved params → start swarm → build GUI
```

---

## Phases

| # | Phase | Output | Done when |
|---|---|---|---|
| **1** | **Interaction prototype** *(now)* | `swarm.js` + param GUI | The behaviour feels right and the params are locked |
| 2 | Visual system | Type scale, colour tokens, spacing, GUI-panel components, content map for each section | Static layout of the one-pager at desktop and mobile, in Figma or HTML |
| 3 | Next.js scaffold | `app/layout.tsx` with a persistent `<SwarmCanvas/>`; one-page sections; params as a JSON import | Deployed preview on Vercel; swarm runs at 60fps with content over it |
| 4 | Multi-page + transitions | New routes (`/work/[slug]`, `/about` …), `<Link>` navigation, View Transitions, swarm reacting to route changes | Moving between pages never blanks the screen or restarts the canvas |
| 5 | Polish & ship | `prefers-reduced-motion` fallback, touch tuning, perf budget, SEO/OG images, analytics | Lighthouse ≥ 90, works on a mid-range phone |

---

## Architecture: why "no loading screen" comes down to one idea

A normal multi-page site (MPA) makes the browser throw away the whole document on every
link click: white flash, scripts re-run, canvas restarts. **To avoid that, the page must never
fully unload.** JavaScript intercepts the click, fetches only the new content, swaps it in, and
updates the URL with the History API. The swarm lives *outside* the swapped region, so it keeps running.

Every tool below is a different way of doing that one thing.

### Barba.js
- **What it is:** a small library for *static* multi-page sites (plain HTML, Webflow, WordPress).
  Each page is a real HTML file. Barba intercepts link clicks, `fetch`es the next page, pulls out
  the `data-barba="container"` element, and swaps it in with hooks for GSAP transitions.
- **Good for:** hand-built HTML sites, Webflow exports, maximum control over enter/leave choreography.
- **Weak spots:** you manage everything yourself: re-initialising scripts per page, cleaning up
  listeners, SEO meta per page, image optimisation, and it doesn't prefetch data for you. It gets
  harder to manage as the page count grows.

### Next.js (App Router) — **recommended here**
- **What it is:** a React framework. Pages are files in `app/`. Anything in `app/layout.tsx` is a
  **persistent layout**: it stays mounted across navigations, so a canvas placed there never restarts.
- **Why no loading screens:** `<Link>` **prefetches** routes when they scroll into view, and statically
  generated pages are served from the CDN, so the next page is usually already in memory on click.
  Navigation is a client-side swap, not a reload.
- **Transitions:** the browser-native **View Transitions API** (Next has built-in support, and React
  has a `<ViewTransition>` component) gives cross-fades and morphs between pages. GSAP or
  Motion (formerly Framer Motion) work for custom choreography.
- **Also gives you:** per-page metadata/SEO, `next/image` optimisation, easy CMS hookup later, one-click
  deploys on Vercel. It scales to many pages without rework.
- **Cost:** you learn React, and it ships more JS than a static site.

### Astro — the honest alternative
Astro with `<ClientRouter />` plus `transition:persist` on the canvas does the same thing with
less JavaScript. Pick it if the site stays mostly static content (text + images) and you don't
want React. If you expect richer app-like pieces later, Next.js is the safer long-term base.

### How the swarm plugs into Next.js (Phase 3 preview)
```tsx
// app/layout.tsx — mounted once, survives every route change
<body>
  <SwarmCanvas />      {/* never unmounts */}
  {children}           {/* this part swaps per page */}
</body>

// components/SwarmCanvas.tsx
'use client';
export function SwarmCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const swarm = createSwarm(ref.current!, { ...lockedParams });
    swarm.start();
    return () => swarm.destroy();   // cleanup = no leaked listeners / double loops
  }, []);
  return <canvas ref={ref} className="fixed inset-0" />;
}
```
That's why `swarm.js` has `start / stop / destroy` and no framework code: it drops straight in.
Route changes can then drive it, e.g. `usePathname()` changes → mutate `swarm.params`
(tighter orbit on `/work`, calmer wander on `/about`).

---

## Concepts used in the prototype (for future reference)

**Steering behaviours, not a physics engine.** Libraries like Matter.js or Rapier simulate
*rigid bodies*: mass, collisions, gravity, restitution. Balls that *decide* where to go need
**Craig Reynolds' steering behaviours** (1987/1999), the basis of every boids and flocking system.
It's about 300 lines, fully tunable, with no dependency. Each frame, each agent adds up forces:

| Force | Idea |
|---|---|
| **seek / arrive** | `desired velocity − current velocity`, capped at `maxForce`. Arrive slows down within `arriveRadius`. |
| **wander** | Aim at a point on a circle ahead of you and nudge that point randomly each frame. This gives smooth, organic curves instead of jitter. |
| **separation** | Push away from neighbours closer than `spacing` (weighted 1/d²). |
| **alignment** | Match the average heading of neighbours within `perception`. |
| **cohesion** | Steer toward the neighbours' centre. |
| **orbit** | Tangential component around the cursor, which turns a clump into a swirl. |

`maxForce` vs `maxSpeed` is the key feel control: low force means lazy, wide turns; high force means snappy turns.

**Engagement state machine.** One value `engage` (0 to 1) blends *autonomous* and *following*.
It eases toward 1 while the cursor moves (`engage rate`). If the cursor stops for `idle after ms`,
a one-shot **disperse** impulse fires, flock bonds are cut while the burst decays, and `engage`
eases back to 0 (`release rate`). Alignment and cohesion scale with `engage`, so idle balls
behave as individuals and only flock when they chase.

**Stagger.** Each agent gets a fixed random `bias`. Its responsiveness is `1 ± stagger`, so some
lead and some lag. That produces the "catching up" feel.

**Frame-rate independence.** Movement is multiplied by `k = dt × 60`, so it looks the same
at 60Hz and 144Hz. `dt` is clamped so a background tab doesn't cause a teleport when it resumes.

**Trails.** Each agent stores its last *N* positions. They're drawn as quadratic béziers through
the *midpoints* of consecutive samples (the classic smoothing trick), split into 12 bands so
width (`taper`) and alpha (`fade`) can ramp from tail to head without 1000s of draw calls.

**HiDPI canvas.** The canvas backing size is `css size × devicePixelRatio` (capped at 2), with
`ctx.setTransform(dpr…)`, which keeps lines crisp on Retina screens.

**Why Canvas2D, not WebGL (yet).** 40 agents × 110-point trails is trivial for Canvas2D. If we
later want 1000+ agents, glow, or blur, the same `swarm.js` simulation can feed a WebGL/Three.js
renderer. Only `render()` would change.
