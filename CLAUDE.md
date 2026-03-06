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
- Termination: first individual with fitness == 28

## Engine Layer (frontend/src/engine/)

```
QueensPuzzle          - core GA class (ported from C#); step() runs one generation
AlgorithmRunner       - wraps QueensPuzzle; manages cumulative stats; runGeneration/runGenerations
GenerationBuffer      - async lookahead buffer (setTimeout); pre-computes gens ahead of animation
AnimationClock        - rAF-based fractional playhead; normal mode + sweep (ease-out/ease-in-out)
```

Hook: `useBufferedAlgorithm` wires everything to React state. Manages undo/redo (MAX_UNDO=50), chart refs, speed.

Key engine files:
- `types.ts` — all interfaces: `Individual`, `AlgorithmConfig`, `GenerationResult`, `GenerationBreedingData`, `StepStatistics`, `CumulativeStatistics`, `GenerationSummary`, `MutationRecord`
- `fitness.ts` — `assessFitness(solution[])`: counts attacking pairs, returns 28 - attacks
- `individual.ts` — `createRandomIndividual`, `createSeededIndividual` (deterministic from seed+id), `mutate`, `cloneIndividual`

## UI Layout (App.tsx)

4-column layout. Sticky top bar.

**Top bar (sticky):**
- Header (title + subtitle)
- HelpBar — shows `data-help` text on hover; press `s` to pin/unpin
- BreadcrumbTrail — shows navigation context; click segments to navigate back
- Controls — Full/Micro granularity, play/pause/step/stepN/back/reset, speed slider

**Column 1: Board + Specimen**
- `Chessboard` — renders queens, shows attack lines when started
- `SpecimenPanel` — click any individual to inspect: id, fitness, born gen, role, mutation, parentage, crossover point, sibling, matings

**Column 2: Config (flex 0.7)**
- `ConfigPanel` — Initial Settings (population, crossover range, mutation %), Status, Totals This Step, Cumulative Totals; preset dropdown; inputs support mousewheel

**Column 3: Breeding / Walkthrough**
- `BreedingListboxes` — virtual-scroll lists for: Eligible parents, Actual parents, Children, Mutations; all sortable; Children view shows parent genomes color-coded by source; Mutations shows before/after diff; Actual parents has master/detail partner view
- Replaced by walkthrough phases in micro mode: SelectionPhase, CrossoverPhase (per-pair browsing), MutationPhase, ResultsPhase

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

## Micro Mode / Walkthrough

4 phases per generation (0-indexed internally, 1/4–4/4 in UI):
- 0: Selection — roulette wheel picks
- 1: Crossover — single-point crossover per pair; browse pairs with prev/next
- 2: Mutation — shows what mutated
- 3: Results — generation summary

Back in micro mode steps through phases in reverse; at phase 0 goes back a full generation.

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
