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

**The engine**, in `src/engine/` — the parameter schema (`params.ts`), the state
hook with URL sync (`useParams.ts`), the generated control panel
(`Controls.tsx`), the shared SVG plot primitive (`Plot.tsx`), the DPR-aware
canvas wrapper (`Canvas.tsx`), token reading for canvas drawing (`tokens.ts`),
and supporting hooks.

`src/lib/stats.ts` holds pure numerics shared across the statistics explorables
— a seeded generator, the normal distribution, and least squares. It is a
deliberate addition to the §3.2 layout, explained in that file's header.

**Eight explorables**, each complete to the §12 definition of done: a pure
model with tests against analytical results, all five prose sections, at most
six parameters, URL round-tripping, a 375px layout, and an `aria-live`
description.

| Slug | Domain | What it is about |
|---|---|---|
| `tax-incidence` | Economics | Who really pays a tax, and why the law does not decide |
| `survival-analysis` | Statistics | Censoring, and why discarding unfinished rows is not neutral |
| `bayes-base-rates` | Statistics | Why a very good test for a rare thing is mostly false alarms |
| `statistical-power` | Statistics | Power, and the exaggeration an underpowered win carries |
| `central-limit` | Statistics | How fast averages become normal, and when they have not |
| `simpsons-paradox` | Statistics | Aggregation reversing the sign of an effect |
| `bias-variance` | Statistics | Overfitting, and the decomposition of test error |
| `gradient-descent` | Statistics | Step size, conditioning, and momentum |

There is no index page yet, so an explorable is reached at its own path —
`/tax-incidence`, `/central-limit`, and so on. §11 puts the index last on
purpose, and it is still last.

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
