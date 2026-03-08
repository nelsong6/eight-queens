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

- `types.ts` — all interfaces: `Specimen` (with `age: Age`), `Age` (0–3 lifecycle type), `AlgorithmConfig`, `GenerationResult`, `GenerationBreedingData`, `StepStatistics`, `CumulativeStatistics`, `GenerationSummary`, `MutationRecord`, plus time coordinate types: `OpType`, `OpCategory`, `OpDefinition`, `TimeCoordinate`, `PoolName`, `PoolOrigin`
- `time-coordinate.ts` — `GENERATION_OPS` array (7 atomic operations), utility functions: `formatCoordinate`, `getOp`, `poolDisplayName`, `getPoolsAtCoordinate`, `categoryToOrigin`, `OPS_PER_GENERATION`
- `fitness.ts` — `assessFitness(solution[])`: counts attacking pairs, returns 28 - attacks
- `specimen.ts` — `createRandomSpecimen`, `createSeededSpecimen` (deterministic from seed+id), `mutate`, `cloneSpecimen`

## UI Layout (App.tsx)

4-column layout. Sticky top bar.

**Top bar (sticky):**

- Header (title + subtitle)
- HelpBar — shows `data-help` text on hover; press `s` to pin/unpin
- BreadcrumbTrail — shows navigation context; click segments to navigate back
- Controls — Full/Micro granularity, play/pause/step/stepN/back/reset, speed slider

**Column 1: Board + Specimen**

- `Chessboard` — renders queens, shows attack lines when started
- `SpecimenPanel` — click any specimen to inspect: id, fitness, born gen, role, mutation, parentage, crossover point, sibling, matings; displays `PoolOrigin` coordinate showing exactly where in the pipeline the specimen was observed

**Column 2: Config (flex 0.7)**

- `ConfigPanel` — Initial Settings (population, crossover range, mutation %), Status, Totals This Step, Cumulative Totals; preset dropdown; inputs support mousewheel

**Column 3: Breeding / Walkthrough**

- `BreedingListboxes` — virtual-scroll lists for: Eligible parents, Actual parents, Children, Mutations; all sortable; Children view shows parent genomes color-coded by source; Mutations shows before/after diff; Actual parents has master/detail partner view; dropdown labels include time coordinates
- Replaced by `SubPhaseScreen` in micro mode — unified walkthrough screen driven by `TimeCoordinate`, showing pools present at each operation boundary

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

Every specimen's position in the GA pipeline is tracked with a 3-element coordinate `x.y.t`:

- `x` = generation number
- `y` = atomic operation index (0–6)
- `t` = boundary/phase: `0` (before), `t` (transform process, not a point in time), `1` (after) — internal array index is 0, 1, 2

7 operations × 3 phases = 21 screens per generation in micro mode. The transform screen (t) visualizes what the operation does — showing input/output pool flow, operation type badge, specimen count delta, and a detailed description of the mechanism.

Gen 0 is the synthetic seed — micro mode starts at `0.6.1` (the seed's connecting point, showing the completed initial population). The first real algorithm step begins at `1.0.0`.

### Atomic Operations (y-axis)

| y   | Name                    | Type      | Category   |
| --- | ----------------------- | --------- | ---------- |
| 0   | Age specimens           | transform | Aging      |
| 1   | Remove elders           | remove    | Pruning    |
| 2   | Select breeding pairs   | transform | Selection  |
| 3   | Mark pairs as mated     | transform | Crossover  |
| 4   | Generate chromosomes    | add       | Crossover  |
| 5   | Apply mutations         | transform | Mutation   |
| 6   | Realize children        | transform | Birth      |

Unselected adults (those not chosen for breeding) persist alongside mated parents through the pipeline and are naturally removed through the aging process in the next generation.

### Key Types

- `TimeCoordinate` — `{ generation, operation, boundary }` — precise pipeline position
- `PoolOrigin` — `{ coordinate, pool, qualifier? }` — where a specimen was observed
- `PoolName` — which named pool: `oldParents`, `previousChildren`, `eligibleAdults`, `retiredParents`, `selectedPairs`, `unselected`, `matedParents`, `chromosomes`, `finalChildren`
- `onSelectSpecimen(specimen, origin: PoolOrigin)` — all specimen selection passes structured origin, not free-form strings

### Synthetic Seed Parents (Gen 0)

`QueensPuzzle` constructor creates two populations: synthetic seed parents and the initial random population (as "children"). Gen 0's `getInitialResult()` returns seed parents as `actualParents` and the initial population as `allChildren`. This means gen 1 maturation is fully uniform — seed parents get retired, initial population gets promoted — no special cases.

## Micro Mode / Walkthrough

`WalkthroughState` tracks `{ operation, boundary, result, previousResult, browsePairIndex }`. Navigation advances boundary 0→1→2, then operation+1 boundary 0. After op 6 boundary 2, runs next generation starting at op 0 boundary 0. Back reverses; at op 0 boundary 0 goes back a full generation to op 6 boundary 2.

`SubPhaseScreen` renders three screen types per operation:

- **Before (t=0)**: Shows input pools with specimen lists
- **Transform (t=1)**: Visualizes the operation — input→output pool flow diagram, operation type badge, specimen count delta, and detailed mechanism description. Uses `getTransformDescription()` and `OP_POOL_TRANSITIONS` data.
- **After (t=2)**: Shows output pools with specimen lists

Uses `getPoolsAtCoordinate()` to determine which pools to display, and `resolvePool()` to map pool names to actual specimens from `result` and `previousResult`.

`BreadcrumbTrail` shows `Category — Operation name (Before/Transform/After)` with step counter. `Controls` shows `x/21` step indicator in micro mode.

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
