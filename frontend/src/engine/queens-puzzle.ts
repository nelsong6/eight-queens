// ============================================================================
// queens-puzzle.ts - Genetic algorithm for the 8-queens problem
// Ported from C# queenspuzzle.cs
//
// Implements:
//   - Fitness-proportionate (roulette wheel) selection
//   - Single-point crossover with configurable position range
//   - Random gene mutation
// ============================================================================

import {
  AlgorithmConfig,
  Individual,
  Age,
  PipelineRole,
  MutationRecord,
  GenerationResult,
  GenerationBreedingData,
  GenerationPipeline,
  PipelineOp,
  StepStatistics,
  MAX_FITNESS,
} from './types';
import {
  createSeededIndividual,
  cloneIndividual,
  mutate,
} from './individual';
import { assessFitness } from './fitness';

/**
 * QueensPuzzle manages the genetic algorithm state and execution.
 * Ported from C# queenspuzzle class.
 */
export class QueensPuzzle {
  private config: AlgorithmConfig;
  private parents: Individual[];
  private children: Individual[];
  private _generation: number;
  private _solved: boolean;
  private _solutionIndividual: Individual | null;
  private _populationSeed: number;
  private _seededCount: number; // how many individuals have been seeded so far
  private _nextId: number; // monotonically increasing ID counter

  // Visualization state: last breeding pair
  private _lastParentA: Individual | null;
  private _lastParentB: Individual | null;
  private _lastChildA: Individual | null;
  private _lastChildB: Individual | null;

  // Pre-mutation chromosome snapshots (captured after crossover, before mutate())
  private _preMutationChildren: Individual[];

  // Full breeding data (all pairs per generation)
  private _aParents: Individual[];
  private _bParents: Individual[];
  private _aChildren: Individual[];
  private _bChildren: Individual[];
  private _mutations: Individual[];
  private _mutationRecords: MutationRecord[];
  private _crossoverPoints: number[];
  private _avgFitnessEligibleParents: number;

  /** Synthetic seed parents created at gen 0 so gen 1 maturation is uniform. */
  private _seedParents: Individual[];

  constructor(config: AlgorithmConfig) {
    this.config = { ...config };
    this.children = [];
    this._generation = 0;
    this._solved = false;
    this._solutionIndividual = null;
    this._lastParentA = null;
    this._lastParentB = null;
    this._lastChildA = null;
    this._lastChildB = null;
    this._aParents = [];
    this._bParents = [];
    this._aChildren = [];
    this._bChildren = [];
    this._mutations = [];
    this._mutationRecords = [];
    this._crossoverPoints = [];
    this._preMutationChildren = [];

    // Eagerly create initial random population so it's visible at gen 0
    this._populationSeed = Math.floor(Math.random() * 0xFFFFFFFF);
    this._seededCount = this.config.populationSize;
    this.parents = [];
    for (let i = 0; i < this.config.populationSize; i++) {
      this.parents.push(createSeededIndividual(i, this._populationSeed));
    }
    this.parents.sort((a, b) => b.fitness - a.fitness);

    // Create synthetic seed parents — random individuals that exist solely
    // to be retired at gen 1 maturation, making the pipeline fully uniform.
    // Use a separate seed offset so they don't collide with the real population.
    this._seedParents = [];
    for (let i = 0; i < this.config.populationSize; i++) {
      const sp = createSeededIndividual(i + this.config.populationSize, this._populationSeed);
      sp.localIndex = i;
      sp.bornGeneration = -1; // marker for synthetic seed parent
      sp.age = 2; // adults (will become elders at gen 1 aging)
      this._seedParents.push(sp);
    }
    this._seedParents.sort((a, b) => b.fitness - a.fitness);
    this._nextId = this.config.populationSize * 2; // after initial pop + seed parents

    let totalFitness = 0;
    for (const parent of this.parents) {
      totalFitness += parent.fitness;
    }
    this._avgFitnessEligibleParents = this.parents.length > 0
      ? totalFitness / this.parents.length
      : 0;
  }

  // --------------------------------------------------------------------------
  // Main algorithm step (ported from queenspuzzle.algorithm_step)
  // --------------------------------------------------------------------------

  /**
   * Run one generation of the genetic algorithm.
   *
   * Flow (matches C# queenspuzzle.algorithm_step):
   *   1. prepare_to_step() - generate/convert population
   *   2. build_probability_list() - roulette wheel selection array
   *   3. breed_children() - crossover + mutation + fitness check
   *
   * Returns a GenerationResult with stats and visualization data.
   */
  step(skipPipeline = false): GenerationResult | null {
    if (this._solved) return null;

    // Capture pre-aging state for pipeline op 0 before/transform (skipped when not needed)
    const preAgingOldParents = skipPipeline ? [] : (this._generation === 0)
      ? this._seedParents.map(cloneIndividual)
      : this.parents.map(cloneIndividual);
    const preAgingPrevChildren = skipPipeline ? [] : (this._generation === 0)
      ? this.parents.map(cloneIndividual)
      : this.children.map(cloneIndividual);

    // Step 1: Prepare population
    this.prepareToStep();

    // Capture post-aging state for pipeline op 0 after / op 1 before
    const retiredParents = skipPipeline ? [] : preAgingOldParents.map(ind => ({ ...ind, age: 3 as Age }));
    const eligibleAdultsSnap = skipPipeline ? [] : this.parents.map(cloneIndividual);

    // Step 2: Build selection probability list
    const probabilityList = this.buildProbabilityList();

    // Step 3: Breed children
    const mutationCount = this.breedChildren(probabilityList, skipPipeline);

    this._generation++;

    // Calculate stats
    let bestChild = this.children[0]!;
    let totalChildFitness = 0;

    for (const child of this.children) {
      totalChildFitness += child.fitness;
      if (child.fitness > bestChild.fitness) {
        bestChild = child;
      }
    }

    const avgFitness = totalChildFitness / this.children.length;

    // Deduplicate actual parents by ID
    const seenIds = new Set<number>();
    const actualParents: Individual[] = [];
    for (const p of [...this._aParents, ...this._bParents]) {
      if (!seenIds.has(p.id)) {
        seenIds.add(p.id);
        actualParents.push(p);
      }
    }
    actualParents.sort((a, b) => b.fitness - a.fitness);

    // Compute per-step statistics
    const avgFitnessActualParents = actualParents.length > 0
      ? actualParents.reduce((s, p) => s + p.fitness, 0) / actualParents.length
      : 0;
    const avgFitnessChildren = this.children.length > 0
      ? totalChildFitness / this.children.length
      : 0;

    const stepStatistics: StepStatistics = {
      eligibleParentsCount: this.parents.length,
      avgFitnessEligibleParents: this._avgFitnessEligibleParents,
      actualParentsCount: actualParents.length,
      avgFitnessActualParents,
      childrenCount: this.children.length,
      avgFitnessChildren,
      mutationCount,
    };

    // Sort breeding lists by fitness for display
    this._mutationRecords.sort((a, b) => b.individual.fitness - a.individual.fitness);
    this._mutations.sort((a, b) => b.fitness - a.fitness);

    const breedingData: GenerationBreedingData = {
      aParents: this._aParents.map(cloneIndividual),
      bParents: this._bParents.map(cloneIndividual),
      aChildren: this._aChildren.map(cloneIndividual),
      bChildren: this._bChildren.map(cloneIndividual),
      actualParents: actualParents.map(cloneIndividual),
      mutations: this._mutations.map(cloneIndividual),
      mutationRecords: this._mutationRecords.map(r => ({ ...r, individual: cloneIndividual(r.individual) })),
      eligibleParents: this.parents.map(cloneIndividual),
      allChildren: this.children.map(cloneIndividual),
      crossoverPoints: [...this._crossoverPoints],
    };

    // Assemble full pipeline snapshot (skipped for intermediate bulk steps)
    const emptyOps = (): GenerationPipeline => ({ ops: Array.from({ length: 7 }, (): PipelineOp => [[], [], []]) });

    let pipeline: GenerationPipeline;
    if (skipPipeline) {
      pipeline = emptyOps();
    } else {
      const selectedIds = new Set(actualParents.map(p => p.id));
      const unselected = eligibleAdultsSnap.filter(p => !selectedIds.has(p.id));

      // Build partner ID map: for each selected parent, record which other parents it was paired with
      const partnerIdMap = new Map<number, Set<number>>();
      for (let i = 0; i < this._aParents.length; i++) {
        const a = this._aParents[i]!;
        const b = this._bParents[i]!;
        if (!partnerIdMap.has(a.id)) partnerIdMap.set(a.id, new Set());
        if (!partnerIdMap.has(b.id)) partnerIdMap.set(b.id, new Set());
        partnerIdMap.get(a.id)!.add(b.id);
        partnerIdMap.get(b.id)!.add(a.id);
      }

      // Helper: tag a cloned individual with a pipeline role (and optional extra fields)
      const tag = (ind: Individual, role: PipelineRole, extra?: Partial<Individual>): Individual => ({
        ...cloneIndividual(ind), pipelineRole: role, ...extra,
      });

      // The transform snapshot (z=1) is seeded from before but is its own deep clone —
      // future work can populate it with transition-specific data independently.
      const makeOp = (before: Individual[], after: Individual[]): PipelineOp =>
        [before, before.map(cloneIndividual), after];

      // Build master-list snapshots for each boundary
      const snap00 = [ // op 0 before: old adults + previous children
        ...preAgingOldParents.map(i => tag(i, 'oldParent')),
        ...preAgingPrevChildren.map(i => tag(i, 'previousChild')),
      ];
      const snap02 = [ // op 0 after / op 1 before: retired elders + eligible adults
        ...retiredParents.map(i => tag(i, 'retiredParent')),
        ...eligibleAdultsSnap.map(i => tag(i, 'eligibleAdult')),
      ];
      const snap12 = eligibleAdultsSnap.map(i => tag(i, 'eligibleAdult')); // op 1 after / op 2 before
      const snap22 = [ // op 2 after / op 3 before: selected + unselected
        ...actualParents.map(i => tag(i, 'selectedPair')),
        ...unselected.map(i => tag(i, 'unselected')),
      ];
      const snap32 = [ // op 3 after / op 4 before: mated (with partners) + unselected
        ...actualParents.map(i => tag(i, 'matedParent', { partnerIds: [...(partnerIdMap.get(i.id) ?? new Set())] })),
        ...unselected.map(i => tag(i, 'unselected')),
      ];
      const preMutChromosomes = this._preMutationChildren.map(i => tag(i, 'chromosome'));
      const snap42 = [ // op 4 after / op 5 before: mated + unselected + pre-mutation chromosomes
        ...actualParents.map(i => tag(i, 'matedParent', { partnerIds: [...(partnerIdMap.get(i.id) ?? new Set())] })),
        ...unselected.map(i => tag(i, 'unselected')),
        ...preMutChromosomes,
      ];
      const postMutChromosomes = this.children.map(i => tag(i, 'chromosome'));
      const snap52 = [ // op 5 after / op 6 before: mated + unselected + post-mutation chromosomes
        ...actualParents.map(i => tag(i, 'matedParent', { partnerIds: [...(partnerIdMap.get(i.id) ?? new Set())] })),
        ...unselected.map(i => tag(i, 'unselected')),
        ...postMutChromosomes,
      ];
      const snap62 = [ // op 6 after: mated + unselected + realized children
        ...actualParents.map(i => tag(i, 'matedParent', { partnerIds: [...(partnerIdMap.get(i.id) ?? new Set())] })),
        ...unselected.map(i => tag(i, 'unselected')),
        ...this.children.map(i => tag(i, 'finalChild')),
      ];

      pipeline = {
        ops: [
          makeOp(snap00, snap02), // op 0: Age individuals
          makeOp(snap02, snap12), // op 1: Remove elders
          makeOp(snap12, snap22), // op 2: Select breeding pairs
          makeOp(snap22, snap32), // op 3: Mark pairs as mated
          makeOp(snap32, snap42), // op 4: Generate chromosomes
          makeOp(snap42, snap52), // op 5: Apply mutations
          makeOp(snap52, snap62), // op 6: Realize children
        ],
      };
    }

    return {
      generationNumber: this._generation,
      bestFitness: bestChild.fitness,
      avgFitness,
      bestIndividual: cloneIndividual(bestChild),
      mutationCount,
      solved: this._solved,
      solutionIndividual: this._solutionIndividual
        ? cloneIndividual(this._solutionIndividual)
        : null,
      lastParentA: this._lastParentA,
      lastParentB: this._lastParentB,
      lastChildA: this._lastChildA,
      lastChildB: this._lastChildB,
      breedingData,
      stepStatistics,
      pipeline,
    };
  }

  // --------------------------------------------------------------------------
  // Population initialization (ported from queenspuzzle.prepare_to_step)
  // --------------------------------------------------------------------------

  private prepareToStep(): void {
    if (this._generation > 0) {
      // Subsequent generations: children become parents (age up: child→adult)
      this.parents = this.children;
      for (const parent of this.parents) {
        parent.age = 2; // adult
      }
      this.parents.sort((a, b) => b.fitness - a.fitness);

      let totalFitness = 0;
      for (const parent of this.parents) {
        totalFitness += parent.fitness;
      }
      this._avgFitnessEligibleParents = this.parents.length > 0
        ? totalFitness / this.parents.length
        : 0;
    } else {
      // Gen 0: age initial population (child→adult), matching op 0 "Age individuals"
      for (const parent of this.parents) {
        parent.age = 2; // adult
      }
    }

    // Reset children and breeding lists
    this.children = [];
    this._preMutationChildren = [];
    this._lastParentA = null;
    this._lastParentB = null;
    this._lastChildA = null;
    this._lastChildB = null;
    this._aParents = [];
    this._bParents = [];
    this._aChildren = [];
    this._bChildren = [];
    this._mutations = [];
    this._mutationRecords = [];
    this._crossoverPoints = [];
  }

  // --------------------------------------------------------------------------
  // Roulette wheel selection (ported from queenspuzzle.build_probability_list)
  // --------------------------------------------------------------------------

  /**
   * Build a fitness-proportionate selection array.
   * Each parent appears in the array proportional to its fitness.
   * The array has 10,000 entries (matching C# implementation).
   */
  private buildProbabilityList(): number[] {
    const SELECTION_SIZE = 10000;
    const list: number[] = [];

    // Calculate total fitness
    let totalFitness = 0;
    for (const parent of this.parents) {
      totalFitness += parent.fitness;
    }

    // Guard against zero total fitness
    if (totalFitness === 0) {
      // Equal probability for all parents
      for (let i = 0; i < SELECTION_SIZE; i++) {
        list.push(i % this.parents.length);
      }
      return list;
    }

    // Fill the list proportionally
    for (let i = 0; i < this.parents.length; i++) {
      const slots = Math.floor(
        (this.parents[i]!.fitness * SELECTION_SIZE) / totalFitness,
      ) + 1;
      for (let j = 0; j < slots && list.length < SELECTION_SIZE; j++) {
        list.push(i);
      }
    }

    // Pad to exactly SELECTION_SIZE if needed
    while (list.length < SELECTION_SIZE) {
      list.push(Math.floor(Math.random() * this.parents.length));
    }

    return list;
  }

  // --------------------------------------------------------------------------
  // Breeding (ported from queenspuzzle.breed_children)
  // --------------------------------------------------------------------------

  /**
   * Create the next generation through crossover and mutation.
   * Returns the number of mutations that occurred.
   */
  private breedChildren(probabilityList: number[], skipPipeline = false): number {
    let mutationCount = 0;
    const targetSize = this.config.populationSize;

    while (this.children.length < targetSize) {
      // Select parent A via roulette wheel
      const parentAIndex = probabilityList[randomInt(0, probabilityList.length - 1)]!;
      const parentA = this.parents[parentAIndex]!;

      // Select parent B (different from A) via roulette wheel
      let parentBIndex: number;
      do {
        parentBIndex = probabilityList[randomInt(0, probabilityList.length - 1)]!;
      } while (parentBIndex === parentAIndex && this.parents.length > 1);
      const parentB = this.parents[parentBIndex]!;

      // Track breeding pairs
      this._aParents.push(parentA);
      this._bParents.push(parentB);

      // Create children via crossover
      const childA = cloneIndividual(parentA);
      childA.id = this._nextId++;
      childA.localIndex = this.children.length;
      childA.bornGeneration = this._generation + 1;
      childA.age = 1; // child
      const childB = cloneIndividual(parentB);
      childB.id = this._nextId++;
      childB.localIndex = this.children.length + 1;
      childB.bornGeneration = this._generation + 1;
      childB.age = 1; // child

      // Single-point crossover at random position within range
      const [minPos, maxPos] = this.config.crossoverRange;
      const crossoverPos = randomInt(minPos, maxPos);
      this._crossoverPoints.push(crossoverPos);

      // Record parentage and crossover data on the children themselves
      childA.parentAId = parentA.id;
      childA.parentBId = parentB.id;
      childA.crossoverPoint = crossoverPos;
      childB.parentAId = parentA.id;
      childB.parentBId = parentB.id;
      childB.crossoverPoint = crossoverPos;

      // Swap genes from crossover position onwards
      for (let i = crossoverPos; i < 8; i++) {
        const temp = childA.solution[i]!;
        childA.solution[i] = childB.solution[i]!;
        childB.solution[i] = temp;
      }

      // Recalculate fitness after crossover
      childA.fitness = assessFitness(childA.solution);
      childB.fitness = assessFitness(childB.solution);

      // Snapshot pre-mutation state (after crossover, before mutate modifies in-place)
      if (!skipPipeline) {
        this._preMutationChildren.push(cloneIndividual(childA));
        if (this.children.length + 1 < targetSize) {
          this._preMutationChildren.push(cloneIndividual(childB));
        }
      }

      // Apply mutation
      const mutA = mutate(childA, this.config.mutationRate);
      if (mutA) {
        mutationCount++;
        this._mutations.push(childA);
        this._mutationRecords.push(mutA);
      }
      const mutB = mutate(childB, this.config.mutationRate);
      if (mutB) {
        mutationCount++;
        this._mutations.push(childB);
        this._mutationRecords.push(mutB);
      }

      // Track children
      this._aChildren.push(childA);
      this._bChildren.push(childB);

      // Store visualization data (last pair)
      this._lastParentA = cloneIndividual(parentA);
      this._lastParentB = cloneIndividual(parentB);
      this._lastChildA = cloneIndividual(childA);
      this._lastChildB = cloneIndividual(childB);

      // Check for solution
      if (childA.fitness === MAX_FITNESS) {
        this._solved = true;
        this._solutionIndividual = cloneIndividual(childA);
        this.children.push(childA);
        return mutationCount;
      }

      this.children.push(childA);

      if (this.children.length < targetSize) {
        if (childB.fitness === MAX_FITNESS) {
          this._solved = true;
          this._solutionIndividual = cloneIndividual(childB);
          this.children.push(childB);
          return mutationCount;
        }
        this.children.push(childB);
      }
    }

    // Sort children by fitness descending
    this.children.sort((a, b) => b.fitness - a.fitness);

    return mutationCount;
  }

  // --------------------------------------------------------------------------
  // State inspection
  // --------------------------------------------------------------------------

  get generation(): number {
    return this._generation;
  }

  get solved(): boolean {
    return this._solved;
  }

  get solutionIndividual(): Individual | null {
    return this._solutionIndividual;
  }

  getBestIndividual(): Individual | null {
    const pop = this._generation === 0 ? this.parents : this.children;
    if (pop.length === 0) return null;
    return pop.reduce((best, ind) => (ind.fitness > best.fitness ? ind : best));
  }

  /**
   * Returns a GenerationResult representing the initial random population (gen 0).
   * Includes synthetic seed parents as actualParents and the initial population
   * as allChildren, so gen 1 maturation can uniformly retire/promote them.
   */
  getInitialResult(): GenerationResult {
    const best = this.parents[0]!; // already sorted descending
    // Gen 0 micro mode starts at 0.6.2 — pre-aging pools are never visited.
    // Stub with all-empty ops; withPipeline() will reconstruct from breedingData on demand.
    const emptyOp = (): PipelineOp => [[], [], []];
    const pipeline: GenerationPipeline = {
      ops: [emptyOp(), emptyOp(), emptyOp(), emptyOp(), emptyOp(), emptyOp(), emptyOp()],
    };
    return {
      generationNumber: 0,
      bestFitness: best.fitness,
      avgFitness: this._avgFitnessEligibleParents,
      bestIndividual: cloneIndividual(best),
      mutationCount: 0,
      solved: false,
      solutionIndividual: null,
      lastParentA: null,
      lastParentB: null,
      lastChildA: null,
      lastChildB: null,
      breedingData: {
        aParents: [],
        bParents: [],
        aChildren: [],
        bChildren: [],
        actualParents: [...this._seedParents],
        mutations: [],
        mutationRecords: [],
        eligibleParents: [...this._seedParents],
        allChildren: this.parents.map(cloneIndividual),
        crossoverPoints: [],
      },
      stepStatistics: {
        eligibleParentsCount: this._seedParents.length,
        avgFitnessEligibleParents: this._avgFitnessEligibleParents,
        actualParentsCount: this._seedParents.length,
        avgFitnessActualParents: this._seedParents.length > 0
          ? this._seedParents.reduce((s, p) => s + p.fitness, 0) / this._seedParents.length
          : 0,
        childrenCount: this.parents.length,
        avgFitnessChildren: this._avgFitnessEligibleParents,
        mutationCount: 0,
      },
      pipeline,
    };
  }

  /**
   * Resize the gen-0 population in place using the same seed.
   * Individual i always gets the same genes regardless of population size.
   */
  resizePopulation(newSize: number): void {
    if (this._generation !== 0) return;
    this.config.populationSize = newSize;

    if (newSize > this.parents.length) {
      // Append new seeded individuals, continuing from where we left off
      const toAdd = newSize - this.parents.length;
      for (let i = 0; i < toAdd; i++) {
        this.parents.push(createSeededIndividual(this._seededCount + i, this._populationSeed));
      }
      this._seededCount += toAdd;
    } else if (newSize < this.parents.length) {
      // Remove the most recently seeded individuals (highest IDs)
      const cutoff = this._seededCount - (this.parents.length - newSize);
      this.parents = this.parents.filter(p => p.id < cutoff);
      this._seededCount = cutoff;
    } else {
      return; // no change
    }

    this.parents.sort((a, b) => b.fitness - a.fitness);

    // Rebuild seed parents to match new size
    this._seedParents = [];
    for (let i = 0; i < newSize; i++) {
      const sp = createSeededIndividual(i + newSize, this._populationSeed);
      sp.localIndex = i;
      sp.bornGeneration = -1; // marker for synthetic seed parent
      sp.age = 2; // adults (will become elders at gen 1 aging)
      this._seedParents.push(sp);
    }
    this._seedParents.sort((a, b) => b.fitness - a.fitness);
    this._nextId = newSize * 2; // after initial pop + seed parents

    let totalFitness = 0;
    for (const parent of this.parents) {
      totalFitness += parent.fitness;
    }
    this._avgFitnessEligibleParents = this.parents.length > 0
      ? totalFitness / this.parents.length
      : 0;
  }

  getPopulationStats(): { bestFitness: number; avgFitness: number; size: number } {
    const pop = this.children.length > 0 ? this.children : this.parents;
    if (pop.length === 0) return { bestFitness: 0, avgFitness: 0, size: 0 };

    let best = 0;
    let total = 0;
    for (const ind of pop) {
      if (ind.fitness > best) best = ind.fitness;
      total += ind.fitness;
    }
    return { bestFitness: best, avgFitness: total / pop.length, size: pop.length };
  }
}

// ============================================================================
// Random utility
// ============================================================================

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
