# Explorables

A small, hand-built library of interactive explanations. Each concept is a live
model the reader manipulates with parameters — not a video, not a static diagram.

Built to `SPEC.md`. **Current state: M1.**

## Running it

```
npm install
npm run dev          # dev server
npm run build        # production build
npm test             # unit tests (Vitest)
npm run test:e2e     # smoke tests (Playwright)
npm run lint:types   # tsc project build
```

## What exists

**M1 — engine plus one explorable**, per §11:

- `src/engine/` — the parameter schema (`params.ts`), the state hook with URL
  sync (`useParams.ts`), the generated control panel (`Controls.tsx`), the
  shared SVG plot primitive (`Plot.tsx`), the DPR-aware canvas wrapper
  (`Canvas.tsx`), and supporting hooks.
- `src/explorables/tax-incidence/` — "Who actually pays a tax", complete: pure
  model, tests against analytical results, all five prose sections, mobile
  layout, accessible description.

## What deliberately does not exist yet

Per §11 and §13 — no placeholder folders, since an empty folder for a future
concept is a promise the codebase will not keep.

- **M2** `wave-interference`, whose job is to break the engine's assumptions.
  `Canvas.tsx` is built and unused; it is waiting for that explorable.
- **M3** the live draggable equation (§2.3). `engine/Equation.tsx` renders the
  static form it will be layered onto, and doubles as the degradation path §2.3
  requires.
- **M4** the remaining four explorables.
- **M5** pre-rendering, sitemap, OG cards, analytics, and the index page — which
  §11 puts last on purpose.

## Notes on the build

- **Fonts.** §2.2 names Bodoni Moda, Source Serif 4 and IBM Plex Mono; §10
  requires them self-hosted as woff2 subsets and forbids Google's CDN. The
  subsets are not vendored yet (an M5 task), so `tokens.css` declares the stacks
  with system fallbacks. The type scale and rhythm are correct; only the faces
  differ.
- **Bundle.** Initial JS is ~64KB gzipped against the §9 budget of 150KB. KaTeX
  (~77KB gzipped on its own) is loaded on demand by `Equation.tsx` rather than
  shipped in the initial chunk.
- **Dependencies.** Only what §3.1 names. D3 is imported as `d3-scale` and
  `d3-shape` submodules, never the bundle, and is used as a maths library — React
  owns the DOM. No router was added for a single route (§13: ask first).
