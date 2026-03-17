# eight-queens

Ported from C# genetic algorithm app to web (Vite + React + TypeScript).
Original C# code is in d:\repos\Genetic-algorithm-8queens.

## Overview

Frontend-only static app hosted at queens.romaine.life (Azure Static Web App).
No backend or API.

## Genetic Algorithm

- Population: configurable (default 100 for Quick Demo, 10K for Standard)
- Chromosome: array of 8 integers [0-7], index=column, value=row
- Fitness: count of non-attacking queen pairs; max = C(8,2) = 28
- Selection: fitness-proportionate roulette wheel (10K-slot array)
- Crossover: single-point at random position within configurable range [min, max]
- Mutation: per-child probability, replaces one random gene with random value
- Termination: first specimen with fitness == 28
- Specimen age lifecycle: 0 (chromosome) → 1 (child) → 2 (adult) → 3 (elder, then removed)

## Engine Layer (frontend/src/engine/)

```
QueensPuzzle          - core GA class (ported from C#); step() runs one generation
AlgorithmRunner       - wraps QueensPuzzle; manages cumulative stats; runGeneration/runGenerations
GenerationBuffer      - async lookahead buffer (setTimeout); pre-computes gens ahead of animation
AnimationClock        - rAF-based fractional playhead; normal mode + sweep (ease-out/ease-in-out)
```

Hook: `useBufferedAlgorithm` wires everything to React state. Manages undo/redo (MAX_UNDO=50), chart refs, speed.

Key engine files:

- `types.ts` — all interfaces: `Specimen` (with `age: Age`), `Age` (0–3 lifecycle type), `AlgorithmConfig`, `GenerationResult`, `GenerationBreedingData`, `StepStatistics`, `CumulativeStatistics`, `GenerationSummary`, `MutationRecord`, `BreedingPair` (parentA/B, crossoverPoint, childA/B), `PipelineTransformData`, plus time coordinate types: `OpType`, `OpCategory`, `OpDefinition`, `TimeCoordinate`, `PoolName`, `PoolOrigin`
- `time-coordinate.ts` — `GENERATION_OPS` array (6 atomic operations), utility functions: `formatCoordinate`, `getOp`, `poolDisplayName`, `getPoolsAtCoordinate`, `getPairsAtCoordinate`, `categoryToOrigin`, `OPS_PER_GENERATION`
- `fitness.ts` — `assessFitness(solution[])`: counts attacking pairs, returns 28 - attacks
- `specimen.ts` — `createRandomSpecimen`, `createSeededSpecimen` (deterministic from seed+id), `mutate`, `cloneSpecimen`

## UI Layout (App.tsx)

4-column layout. Sticky top bar. Client-side URL routing via History API (pushState/popstate, no library).

**Top bar (sticky):**

- Header (title + subtitle)
- HelpBar — shows `data-help` text on hover; press `s` to pin/unpin
- BreadcrumbTrail — shows navigation context; click segments to navigate back
- Controls — Full/Micro granularity, play/pause/step/stepN/back/reset, speed slider; spacebar toggles play/pause

**Column 1: Board + Specimen**

- `Chessboard` — renders queens, shows attack lines when started; accepts `zoomed` prop to scale board via ResizeObserver to fill container (used in specimen drill-down)
- `SpecimenPanel` — click any specimen to inspect: id, fitness, born gen, role, mutation, parentage, crossover point, sibling; displays `PoolOrigin` coordinate showing exactly where in the pipeline the specimen was observed
- Specimen drill-down view (replaces Column 3 content): 3-part flex row — scaled chessboard (height-constrained via `aspectRatio: 1`), SpecimenPanel column, MatedPairPanel column

**Column 2: Config (flex 0.7)**

- `ConfigPanel` — Initial Settings (population, crossover range, mutation %), Status, Totals This Generation, Cumulative Totals; preset dropdown; inputs support mousewheel

**Column 3: Breeding / Walkthrough**

- `SubPhaseScreen` — unified screen driven by `TimeCoordinate`, showing population (via `SpecimenList`) and breeding pairs (via `PairList`) at each completed operation. Used in both full step and micro modes. Panel uses flex layout so the specimen list fills available height above the fixed-height pair list.

**Column 4: Chart**

- `GenerationChart` — fitness history; fractional playhead from AnimationClock for smooth animation

All panels are zoomable (`ZoomablePanel`); ESC or backdrop click closes zoom. When breeding is zoomed, board appears as a small inset companion.

## Session Flow

```
config → running → review
```

- **config**: algorithm pre-runs eagerly so gen-0 data is visible. Changing only population size does `resizePopulation` (in-place, same seed). Other changes restart with new seed.
- **running**: step / stepN / play (auto) / back (undo). Granularity toggle: Full or Micro.
- **review**: shown when fitness == 28 (solved). New Session button resets.

## Time Coordinate System

Every specimen's position in the GA pipeline is tracked with a 2-element coordinate `x.y`:

- `x` = generation number
- `y` = atomic operation index (0–5)

Time implies the step is complete — each coordinate shows the finished state of that operation. 6 operations = 6 screens per generation in micro mode.

Gen 0 is the synthetic seed — micro mode starts at `0.5` (the seed's connecting point, showing the completed initial population). The first real algorithm step begins at `1.0`.

### Atomic Operations (y-axis)

| y   | Name                    | Type      | Category   |
| --- | ----------------------- | --------- | ---------- |
| 0   | Age specimens           | transform | Aging      |
| 1   | Remove elders           | remove    | Pruning    |
| 2   | Select breeding pairs   | transform | Selection  |
| 3   | Generate chromosomes    | add       | Crossover  |
| 4   | Apply mutations         | transform | Mutation   |
| 5   | Realize children        | transform | Birth      |

Unselected adults (those not chosen for breeding) persist alongside selected parents through the pipeline and are naturally removed through the aging process in the next generation.

### Dual-Set Model: Specimens + Breeding Pairs

The pipeline maintains two parallel sets visible on every granular step screen:

1. **`Set<Specimen>`** — the primary population, always present
2. **`Set<BreedingPair>`** — pairs formed by roulette wheel selection

Pair lifecycle follows specimens — when a parent is pruned, its pairs are removed:

| Op | Pairs state (completed) |
|----|------------|
| 0 (Age) | Previous gen's pairs persist (parents just aged) |
| 1 (Remove elders) | Pairs pruned alongside elder parents → typically empty |
| 2 (Select pairs) | New pairs created from roulette wheel selection |
| 3 (Crossover) | Pairs annotated (crossoverPoint, children) |
| 4-5 | Pairs persist from op 3 (children may be mutated/realized) |

`BreedingPair` = `{ index, parentA, parentB, crossoverPoint?, childA?, childB? }`. Stored in `GenerationPipeline.transformData` (keyed by op 2-3). Accessed via `getPairsAtCoordinate()`.

### Key Types

- `TimeCoordinate` — `{ generation, operation }` — precise pipeline position
- `PoolOrigin` — `{ coordinate, pool, qualifier? }` — where a specimen was observed
- `PoolName` — which named pool: `oldParents`, `previousChildren`, `eligibleAdults`, `retiredParents`, `selectedPairs`, `unselected`, `chromosomes`, `finalChildren`
- `BreedingPair` — `{ index, parentA, parentB, crossoverPoint?, childA?, childB? }` — a pair of specimens selected for crossover
- `onSelectSpecimen(specimen, origin: PoolOrigin)` — all specimen selection passes structured origin, not free-form strings

### Synthetic Seed Parents (Gen 0)

`QueensPuzzle` constructor creates two populations: synthetic seed parents and the initial random population (as "children"). Gen 0's `getInitialResult()` returns seed parents as `actualParents` and the initial population as `allChildren`. This means gen 1 maturation is fully uniform — seed parents get retired, initial population gets promoted — no special cases.

## Micro Mode / Walkthrough

`WalkthroughState` tracks `{ operation, result, previousResult, browsePairIndex }`. Navigation advances to the next operation. After op 5, runs next generation starting at op 0. Back reverses; at op 0 goes back a full generation to op 5.

Each operation shows the completed state. `SubPhaseScreen` renders one screen per operation showing the output pools with specimen lists and breeding pairs.

Uses `getPoolsAtCoordinate()` to determine which pools to display, and `resolvePoolFromPipeline()` to map pool names to actual specimens from `result`.

Both `SubPhaseScreen` and `OperationPanel` display two groups on every screen: a specimen list (via `SpecimenList`) and a breeding pair list (via `PairList`). The pair list shows pairs from `getPairsAtCoordinate()` and can be empty (e.g. after pruning at op 1).

`BreadcrumbTrail` shows `Category — Operation name` with step counter. `Controls` shows `x/6` step indicator in micro mode.

## Presets (frontend/src/data/presets.ts)

| id | name | pop | crossover | mutation |
|----|------|-----|-----------|----------|
| quick-demo | Quick Demo | 100 | [1,6] | 25% |
| standard | Standard | 10000 | [1,6] | 25% |
| high-mutation | High Mutation | 10000 | [1,6] | 50% |
| small-population | Small Population | 500 | [2,5] | 25% |

## UI Patterns

- **Help text**: Elements use `data-help` attributes. HelpBar (top bar) displays the text on hover. Press `s` to pin/unpin.
- **All styles**: inline `React.CSSProperties` objects at bottom of each file — no CSS files, no Tailwind, no CSS modules.
- **Virtual scrolling**: BreedingListboxes uses manual virtual scroll (absolute positioning, ResizeObserver) for large populations.
- **Animation**: AnimationClock drives a fractional playhead via rAF. `floor(playhead)` = generation index; fractional part = interpolation. Sweep mode animates the chart on step/stepN.

## Infra (tofu/)

OpenTofu (Terraform) in `tofu/`. Manages:
- `azurerm_resource_group` (eight-queens-rg)
- `azurerm_static_web_app` (eight-queens-app)
- DNS CNAME record for queens.romaine.life
- `azurerm_static_web_app_custom_domain` with cname-delegation validation

Shared infra vars injected by Spacelift from infra-bootstrap stack.

## CI/CD (.github/workflows/)

- `full-stack-deploy.yml` — Phase 3 CD; triggered by `spacelift_infra_ready` dispatch or manual. Builds Vite and deploys to Azure Static Web App.
- `lint.yml` — linting
- `spacelift-stack-to-main.yml` — Spacelift integration
- `tofu-lockfile-check.yml` / `tofu-lockfile-update.yml` — OpenTofu lock file management

## Change Log

### 2026-03-12

- SubPhaseScreen panel switched from `overflow: auto` to flex column layout (`overflow: hidden`, `display: flex`) so the Population list and Breeding Pairs section share available height without an outer scrollbar. `poolSection` is now `flex: 1` and `SpecimenList` receives `flex` prop to fill remaining space dynamically.
- Removed `MatedPairPanel` from Column 2 (Board + Specimen column) — pair detail no longer shown alongside the specimen inspector.
- "Watch a Full Run" / "Start Full" button now auto-plays continuously after switching to the Full tab (via `pendingAutoPlayRef` + `useEffect` that calls `handlePlay` once the tab switch renders).
- Horizontal padding removed from `tabContent` and moved to `columns` style so the controls row border-bottom extends full pane width while columns stay inset with consistent padding.
- Fixed app crash: spacebar `useEffect` referenced `handlePlay`/`handlePause` before their declarations — moved the effect after both `useCallback` definitions.
- Added spacebar keyboard shortcut to toggle play/pause globally. Skips when focus is on an input/textarea; prevents default page scroll; respects both full and micro mode play states.
- Aligned panel bottoms across all 4 columns in Full Step mode: removed `overflowY: 'auto'` from Column 3's div (Config already scrolls internally), added `flex: 1` to ConfigPanel and SpecimenPanel panel styles so they fill their ZoomablePanel wrappers.
- Fixed PairList horizontal scrollbar at 100% zoom: removed `minWidth: 520` from inner content, made parent genome containers flex-shrinkable (`flex: '1 1 0'`), reduced gene cell width (12→10px), pair index width (30→22px), parentId minWidth (32→24px), and tightened row gaps/margins. Row content now fits ~386px vs ~440px+ available.
- Specimen view layout: board now scales up using `zoomed` prop + `aspectRatio: 1` on its container, constrained to available height. SpecimenPanel and MatedPairPanel placed side-by-side in two equal flex columns (was stacked vertically in one column). Board uses full available height; detail columns scroll independently.
- Chessboard `transform: scale()` margin compensation now works for all scale values (was only applied for `scale < 1`). Uses `transformOrigin: 'top left'` uniformly so layout size matches visual size at any scale. Fixes board overflow when `zoomed` prop used inline (not just in ZoomablePanel).

### 2026-03-13

- Renamed "Totals This Step" → "Totals This Generation" in ConfigPanel UI heading, comment, types.ts doc comment, and CLAUDE.md documentation for clearer terminology.

### 2026-03-16

- Added client-side URL routing via History API (pushState/popstate, no library). Tab IDs map to URL paths (`/config`, `/full`, `/micro`, `/help`); default tab (`getting-started`) maps to `/`. Browser back/forward navigates between tabs. `navigateTab` wrapper replaces all direct `setActiveTab` calls outside the router core.
