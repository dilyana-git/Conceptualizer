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

**The engine** (`src/engine/`), per §11's M1: the parameter schema (`params.ts`),
the state hook with URL sync (`useParams.ts`), the generated control panel
(`Controls.tsx`), the shared SVG plot primitive (`Plot.tsx`), the DPR-aware
canvas wrapper (`Canvas.tsx`), and supporting hooks.

**Five explorables**, each complete to the §12 checklist — pure model, tests
against analytical results, all five prose sections, mobile layout, accessible
description:

| Slug | Domain | What it shows |
|---|---|---|
| `tax-incidence` | Economics | Who bears a tax, and why the statutory side is irrelevant |
| `survival-analysis` | Statistics | Kaplan-Meier, and why censored rows are informative |
| `statistical-power` | Statistics | Power, plus the Type S and Type M errors it implies |
| `simpsons-paradox` | Statistics | How aggregation reverses a trend, via the variance decomposition |
| `bias-variance` | Statistics | Why training error recommends the worst model |

`src/lib/stats.ts` holds numerics shared by the statistics models — a seeded
generator, the normal distribution, and OLS.

## Departures from SPEC.md, and why

These are deliberate and worth reviewing:

- **A `statistics` domain and four explorables outside the §8 set.** §8 fixes v1
  at six named explorables across physics, maths and economics. The statistics
  four were requested directly. §0's "six excellent beat thirty stubs" was kept:
  each one is finished, and nothing is scaffolded that is not built.
- **M2 has not happened.** §11 reserves it for `wave-interference`, whose job is
  to break the engine's assumptions on a per-pixel field. The statistics
  explorables did stress the engine — see below — but none of them needed
  Canvas, so `Canvas.tsx` is still built and unused, and the per-pixel
  performance assumptions remain unverified.
- **`src/lib/` is not in the §3.2 layout.** Four models needed the same normal
  CDF and seeded generator. Three copies of an erf approximation is three
  chances to get it wrong in one place only. It holds pure numerics; anything
  that knows about a specific model still lives in that model's `model.ts`.
- **No index page.** §11 puts it last, on purpose. With five explorables and no
  router, reaching one means typing its slug. That is now the most useful thing
  to build next.

## What the new explorables changed in the engine

The engine survived, with two additions rather than a refactor:

- `View` takes a `controls` slot, so it can place the panel directly under the
  chart on a phone (§9) instead of below a wall of readouts.
- `useMediaQuery`, so a narrow viewport gets its own SVG viewBox. Scaling a
  660-wide coordinate system into a 375px column renders 11px ticks at ~6px.

Both landed while building explorable #1 and #2 and needed no further change for
#3, #4 or #5 — which is the signal §11 was asking for, on a smaller scale than
`wave-interference` would provide.

## Still to come

- **M2** `wave-interference` — the per-pixel case the engine has not met.
- **M3** the live draggable equation (§2.3). `engine/Equation.tsx` renders the
  static form it will be layered onto, and doubles as the degradation path §2.3
  requires.
- **M4** the remaining four §8 explorables.
- **M5** pre-rendering, sitemap, OG cards, analytics, and the index page.

## Notes on the build

- **Fonts.** §2.2 names Bodoni Moda, Source Serif 4 and IBM Plex Mono; §10
  requires them self-hosted as woff2 subsets and forbids Google's CDN. The
  subsets are not vendored yet (an M5 task), so `tokens.css` declares the stacks
  with system fallbacks. The type scale and rhythm are correct; only the faces
  differ.
- **Bundle.** Initial JS is ~84KB gzipped against the §9 budget of 150KB. KaTeX
  (~77KB gzipped on its own) is loaded on demand by `Equation.tsx` rather than
  shipped in the initial chunk.
- **Determinism.** §0 forbids nondeterminism, so every "sample" comes from a
  seeded generator keyed on the parameters. The same URL always produces the
  same dataset, and model tests can assert exact numbers.
- **Dependencies.** Only what §3.1 names. D3 is imported as `d3-scale` and
  `d3-shape` submodules, never the bundle, and is used as a maths library —
  React owns the DOM. No router was added for slug-based routing (§13: ask
  first).
