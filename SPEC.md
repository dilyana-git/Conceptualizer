# Explorables — Build Specification

A public web app hosting a small, hand-built library of interactive explanations for
concepts in physics, mathematics, and economics. Each concept is a live model the
reader manipulates with parameters, not a video and not a static diagram.

Hand this document to Claude Code as `SPEC.md` at the repo root.

---

## 0. Anti-goals

State these up front because they remove most of the ambiguity:

- **No LLM generation.** Nothing is generated at runtime. Every explorable is
  hand-authored code. No API keys, no inference costs, no nondeterminism.
- **No backend.** Static site. No database, no accounts, no auth, no sessions,
  no server-rendered personalisation.
- **No 3D / WebGL in v1.** SVG and Canvas 2D only. WebGL is a v2 conversation.
- **No comment system, no user-submitted content, no social features.**
- **No breadth-first content dump.** Six excellent explorables beat thirty stubs.

If a proposed feature requires a server, it is out of scope by definition.

---

## 1. Product definition

**Job of the site:** a reader arrives (usually from search or a shared link) not
understanding a concept, spends four to eight minutes manipulating a live model,
and leaves with a mechanical intuition they did not have before.

**Reader:** curious adult, numerate but not expert. Comfortable with a graph.
Not necessarily comfortable with a differential equation. Assume no login,
no prior visit, and a 50% chance of arriving on a phone.

**Unit of content:** one *explorable* — a self-contained page combining prose,
a live model, and a parameter control surface.

**Success test for any single explorable:** the reader can be asked a
counterfactual question ("what happens to deadweight loss if supply is perfectly
elastic?") and can answer it by predicting, then checking, inside the widget.
If the widget cannot answer counterfactuals, it is decoration.

---

## 2. Aesthetic direction

The subject world here is scientific instruments and engraved plates — oscilloscopes,
graph paper, 19th-century diagram engravings, laboratory notebooks. Design from that,
not from generic "edtech."

### 2.1 Colour tokens

The palette carries one strict semantic rule: **signal colours are reserved
exclusively for quantities the reader controls.** Everything fixed by the model is
ink. This means colour is information, and a reader can tell at a glance what is
under their hand.

```css
--paper:        #F7F6F2;  /* page ground */
--paper-sunk:   #EFEDE6;  /* control panel wells, insets */
--graphite:     #1A1D21;  /* body text, static geometry, axes */
--rule:         #C9C6BC;  /* hairlines, grid, dividers */
--muted:        #6B6F76;  /* captions, secondary labels */
--signal:       #0F5EF7;  /* controlled quantity, primary */
--signal-warm:  #E8590C;  /* controlled quantity, secondary */
--signal-dim:   #0F5EF7 at 12% alpha;  /* fills, uncertainty bands */
```

No gradients. No drop shadows except a 1px hairline to seat control panels.
Never use `--signal` for a heading, a link, or a button that isn't a parameter.

### 2.2 Typography

| Role | Face | Use |
|---|---|---|
| Display | **Bodoni Moda** | Explorable titles and section heads only. High-contrast didone, reads as engraved plate. Never below 24px. |
| Body | **Source Serif 4** | All explanatory prose. 18px/1.6 desktop, 17px/1.65 mobile. Max measure 68ch. |
| Utility | **IBM Plex Mono** | Every numeric readout, axis tick, parameter value, unit label. |

Monospace for numerics is functional, not decorative: proportional digits jitter
as a value animates, and jitter reads as instability in the model.

Type scale: 13 / 15 / 17 / 20 / 26 / 34 / 46. Nothing between.

### 2.3 Signature element — the live equation

The one thing this site is remembered for.

Each explorable's governing equation is typeset with KaTeX above or beside the
model. **Symbols corresponding to controlled parameters are rendered in `--signal`
and are themselves drag targets.** Dragging the `k` in `F = -kx` horizontally
changes the spring constant and the model responds in real time. The equation
is the control panel.

Implementation: after KaTeX renders, query the DOM for the emitted spans matching
each parameter's `symbol` field, tag them, and attach pointer handlers that map
horizontal drag distance to the parameter's range. Slider controls remain present
below as the accessible, discoverable path — the draggable equation is an
enhancement layered on top, never the only way in.

Constraints: drag targets get a minimum 32×32px hit area regardless of glyph size;
they show a `col-resize` cursor; they are `tabindex`-focusable with arrow-key
support; and if KaTeX symbol matching fails, the feature degrades silently to a
normal static equation.

### 2.4 Motion

One orchestrated moment per explorable: on first scroll into view, the model
runs its default trajectory once, unattended, then settles and hands control to
the reader. That is the invitation. Everywhere else, motion is the simulation
itself. No scroll-triggered fades, no staggered card entrances.

Respect `prefers-reduced-motion`: the intro run is skipped and the model renders
at its settled state; the simulation still runs when a parameter is changed,
since that motion is the content.

---

## 3. Architecture

### 3.1 Stack

- **Vite + React 18 + TypeScript** (strict mode)
- **D3** for scales, axes, shapes, and data-driven SVG — *not* for DOM lifecycle.
  React owns the DOM; D3 is used as a maths and layout library.
- **Canvas 2D** for anything with more than ~400 moving elements or per-pixel fields.
- **KaTeX** for equation typesetting.
- **Zustand** for per-explorable parameter state. No global store.
- **Vitest** for the simulation layer. **Playwright** for smoke tests.
- Styling: **CSS Modules** with the tokens above as CSS custom properties in
  `:root`. No Tailwind, no CSS-in-JS runtime.

### 3.2 Repository layout

```
src/
  engine/
    params.ts          # parameter schema types + helpers
    useParams.ts       # schema → state hook, URL sync
    Controls.tsx       # schema → rendered control panel
    LiveEquation.tsx   # KaTeX + draggable symbol binding
    useAnimationFrame.ts
    useResizeObserver.ts
    Canvas.tsx         # DPR-aware canvas wrapper
    Plot.tsx           # shared SVG axes/grid primitive
  explorables/
    <slug>/
      meta.ts          # registry entry: title, domain, blurb, prose
      params.ts        # parameter schema
      model.ts         # PURE simulation — no React, no DOM
      model.test.ts
      View.tsx         # rendering only
      index.ts
  registry.ts          # imports every explorable's meta
  routes/
  styles/tokens.css
```

### 3.3 The hard separation

`model.ts` must be a pure module: it takes parameters and state, returns new state
or derived values. No React imports, no DOM access, no `requestAnimationFrame`.

This is non-negotiable and is the thing that makes the library testable and the
rendering swappable. `View.tsx` may not contain physics. If a formula appears in
a `.tsx` file, it is in the wrong place.

---

## 4. The parameter schema — core abstraction

Every explorable declares its parameters once. That single declaration drives the
control panel UI, the URL serialisation, the keyboard interaction, the equation
binding, and the reset behaviour. Authors never hand-write a slider.

```ts
export type ParamSpec =
  | {
      kind: 'continuous';
      id: string;
      label: string;          // human name, e.g. "Spring constant"
      symbol?: string;        // LaTeX symbol for equation binding, e.g. "k"
      unit?: string;          // e.g. "N/m"
      min: number;
      max: number;
      step: number;
      default: number;
      scale?: 'linear' | 'log';
      format?: (v: number) => string;
    }
  | {
      kind: 'discrete';
      id: string;
      label: string;
      options: { value: string; label: string }[];
      default: string;
    }
  | {
      kind: 'toggle';
      id: string;
      label: string;
      default: boolean;
      hint?: string;          // what turning it on reveals
    };

export type ParamSchema = readonly ParamSpec[];
export type ParamValues<S extends ParamSchema> = { /* inferred map */ };
```

`useParams(schema)` returns `{ values, set, reset, isDirty, shareUrl }`.

Rules the engine enforces so authors get them free:

- Every continuous param renders as a native `<input type="range">` with a
  `<label>`, a monospace live readout, and its unit. Native range inputs give
  keyboard support, screen reader support, and correct touch behaviour at no cost.
- Log-scale params map slider position through `d3.scaleLog`, and the readout
  shows the real value.
- A "Reset" affordance appears only when `isDirty`.
- Values round-trip through the URL (see §6).

**Cap: six parameters per explorable.** More than six and the reader is
fiddling, not reasoning. If a model needs more, it is two explorables.

---

## 5. Explorable module contract

```ts
// explorables/tax-incidence/meta.ts
export const meta: ExplorableMeta = {
  slug: 'tax-incidence',
  title: 'Who actually pays a tax',
  domain: 'economics',
  blurb: 'A tax is written into law as falling on one side of a market. ' +
         'Where it actually lands depends on something else entirely.',
  minutes: 6,
  prerequisites: ['supply-and-demand'],   // slugs, may be empty
  related: ['deadweight-loss'],
  equation: 'P_{consumer} - P_{producer} = t',
  updated: '2026-08-18',
};
```

The registry is a flat array. Adding an explorable = one folder + one import line.
No dynamic route generation from a CMS, no MDX pipeline. Prose lives in the
`meta.ts` as structured fields (see §7), typed, so it cannot drift from the model.

---

## 6. URL state and sharing

A shared link must reproduce exactly what the sharer was looking at. This is the
single highest-leverage growth feature on a public explorables site — people share
the *state that surprised them*, not the page.

- Encoding: `?<paramId>=<value>` for each param that differs from default.
  Human-readable, e.g. `/tax-incidence?elasticity_s=0.2&tax=4`.
  Do not compress; legibility is worth the characters.
- Defaults are omitted, so a clean URL stays clean.
- Values are clamped and validated against the schema on read; invalid values
  fall back to default silently rather than erroring.
- Writing to the URL is debounced at 400ms and uses `replaceState`, so dragging a
  slider does not fill the back-button history.
- A "Copy link to this state" control sits with the parameter panel, not in a
  share tray.
- Open Graph images: v1 uses one static, well-made card per explorable. Dynamic
  per-state OG images need a server and are explicitly deferred.

---

## 7. Pedagogical structure

Every explorable follows the same five-part spine. Enforce it as typed fields on
`meta.ts` so an incomplete explorable fails the build.

1. **Hook** — one or two sentences naming a concrete situation where the reader's
   default intuition is wrong. Never "In this explorable we will explore…"
2. **Play** — the model appears with sane defaults and a single opening prompt:
   *"Drag the tax rate. Watch which side of the market the price moves for."*
3. **Reveal** — the mechanism, in prose, after the reader has already felt it.
   The equation appears here, not before.
4. **Edges** — two or three challenge prompts with checkable answers:
   *"Find a setting where consumers bear none of the tax. What is true about
   demand there?"* These convert fiddling into inquiry.
5. **Limits** — what the model does not capture, stated plainly. Every model on
   this site is a lie of some useful size; say which lie. This is the section
   that distinguishes the site from a physics demo page.

---

## 8. v1 content set

Six explorables, chosen deliberately to stress six different rendering and
modelling paths. If the engine survives all six, it will survive anything added later.

| # | Slug | Domain | Model | Stresses |
|---|---|---|---|---|
| 1 | `orbital-two-body` | Physics | Velocity-Verlet integration of gravitational two-body motion; reader sets initial velocity, mass ratio, eccentricity | Canvas 2D, time integration, trail rendering, numerical stability |
| 2 | `wave-interference` | Physics | Superposition of two coherent sources on a field; reader sets separation, wavelength, phase offset | Per-pixel Canvas field computation, performance budget, colour mapping |
| 3 | `fourier-series` | Maths | Epicycle decomposition reconstructing a target waveform; reader sets harmonic count, waveform | Coupled dual-view (rotating epicycles ↔ traced output), SVG + Canvas together |
| 4 | `eigenvectors` | Maths | 2×2 linear transformation applied to a grid; reader sets matrix entries, watches which vectors keep direction | Draggable SVG grid warping, direct manipulation as input, live equation binding |
| 5 | `tax-incidence` | Economics | Linear supply/demand with a per-unit tax; reader sets both elasticities and tax size; shows surplus split and deadweight loss | Analytical geometry in SVG, area shading, algebraic readouts |
| 6 | `schelling-segregation` | Economics | Agent-based grid; reader sets tolerance threshold and density, watches segregation emerge from mild preferences | Agent grid, stepped rather than continuous time, run/pause/step controls |

Build order is the table order **only after** the engine milestone (§11).

Each explorable's `model.ts` gets a unit test asserting at least one analytically
known result — orbital period against Kepler's third law, Fourier coefficients
against closed form, tax incidence split against the elasticity ratio formula.
This catches the class of bug where the visualization looks plausible and is wrong.

---

## 9. Accessibility and performance

### Accessibility floor (non-negotiable)

- Every control is a native form element with a programmatic label.
- Every explorable carries a `<figcaption>`-level text description of what the
  visualization currently shows, updated on a debounced `aria-live="polite"`
  region — so a screen reader user gets the state change, not just the control value.
- Contrast: all text ≥ 4.5:1 against its ground. `--signal` on `--paper` passes;
  verify `--muted` at every size used.
- Full keyboard path through the page including the draggable equation symbols.
- Visible focus rings, 2px `--signal`, never removed.
- `prefers-reduced-motion` handled per §2.4.

### Performance budget

- 60fps on a mid-range Android device for explorables 1, 3, 4, 5, 6.
  Explorable 2 (per-pixel field) may target 30fps and must downscale its
  computation grid on narrow viewports.
- `requestAnimationFrame` loops use delta-time, never assume frame interval.
- Every simulation pauses via `IntersectionObserver` when scrolled out of view.
- Canvas is DPR-aware and re-sizes through `ResizeObserver`, not window resize.
- Initial page JS ≤ 150KB gzipped. Explorable modules are route-level code-split;
  D3 is imported as submodules (`d3-scale`, `d3-shape`), never the bundle.

### Mobile

Controls sit **below** the visualization on narrow viewports, never beside it,
and the visualization is capped at 45vh so both are visible simultaneously.
A reader who has to scroll between the slider and the effect learns nothing.
Test every explorable at 375px width before considering it done.

---

## 10. Discovery and deployment

- Static build, deployed to Cloudflare Pages or Netlify.
- Pre-render each route to real HTML with the Hook and Reveal prose present in
  the markup (`vite-plugin-ssr` or a simple build-time HTML shell generator).
  Search is the primary discovery channel; a client-rendered blank div is fatal.
- Per-route `<title>`, meta description from `blurb`, canonical URL, and static
  OG image.
- `sitemap.xml` generated from the registry at build time.
- Analytics: Plausible or Umami — cookieless, so no consent banner. Track only
  page views and a single custom event: `parameter_changed` (fired once per
  session per explorable), which measures whether people actually interact.
- No cookies, no third-party fonts loaded from Google's CDN — self-host the three
  faces as woff2 subsets.

---

## 11. Milestones

**The scope rule, stated plainly:** this project's failure mode is building three
beautiful explorables and then losing momentum before the engine pays off. Guard
against it by proving the engine on the two most dissimilar cases before building
anything else.

- **M1 — Engine + one explorable.** `params.ts`, `useParams`, `Controls`, URL sync,
  `Canvas`, `Plot`, plus `tax-incidence` complete end-to-end including prose,
  tests, mobile layout, and a11y. Nothing else exists. *Ship this to a URL.*
- **M2 — Second, maximally different explorable.** `wave-interference`. Its job is
  to break the engine's assumptions. Refactor the engine here, once. This is the
  cheapest moment to discover that the abstraction is wrong.
- **M3 — Live equation.** Build `LiveEquation.tsx` and retrofit M1 and M2.
- **M4 — Remaining four explorables.** These should now be mostly content work.
  If any of them requires an engine change, note it but do not refactor mid-flight.
- **M5 — Public launch.** Pre-rendering, sitemap, OG cards, analytics, index page.

The index page is deliberately last. It is the easiest thing to build and the
most tempting thing to build first.

---

## 12. Definition of done, per explorable

An explorable ships only when all of these are true:

- [ ] `model.ts` is pure and has a test asserting a known analytical result
- [ ] All five prose sections written, including **Limits**
- [ ] ≤ 6 parameters, all in the schema, none hard-coded in the view
- [ ] State round-trips through the URL
- [ ] Usable at 375px with visualization and controls both on screen
- [ ] Full keyboard path; `aria-live` description updates
- [ ] Holds frame budget on a throttled CPU profile (4× slowdown)
- [ ] At least two Edge challenge prompts that the widget can actually answer

---

## 13. Notes for Claude Code

- Read this file fully before writing code. Build M1 completely before scaffolding
  any other explorable directory.
- Do not create placeholder explorables. An empty folder for a future concept is
  a promise the codebase will not keep.
- When a physics or economics formula is implemented, cite the source form in a
  comment above it, and write the test before the view.
- If the parameter schema cannot express something an explorable needs, extend
  the schema — do not let the explorable reach around it. The whole value of the
  engine is that there is exactly one way to declare a parameter.
- Ask before adding a dependency.
