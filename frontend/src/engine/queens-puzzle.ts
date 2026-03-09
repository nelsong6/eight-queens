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
  Specimen,
  Age,
  PipelineRole,
  MutationRecord,
  GenerationResult,
  GenerationBreedingData,
  GenerationPipeline,
  PipelineOp,
  BreedingPair,
  StepStatistics,
  MAX_FITNESS,
} from './types';
import {
  createSeededSpecimen,
  cloneSpecimen,
  mutate,
} from './specimen';
import { assessFitness } from './fitness';

/**
 * QueensPuzzle manages the genetic algorithm state and execution.
 * Ported from C# queenspuzzle class.
 */
export class QueensPuzzle {
  private config: AlgorithmConfig;
  private parents: Specimen[];
  private children: Specimen[];
  private _generation: number;
  private _solved: boolean;
  private _solutionSpecimen: Specimen | null;
  private _populationSeed: number;
  private _seededCount: number; // how many specimens have been seeded so far
  private _nextId: number; // monotonically increasing ID counter

  // Visualization state: last breeding pair
  private _lastParentA: Specimen | null;
  private _lastParentB: Specimen | null;
  private _lastChildA: Specimen | null;
  private _lastChildB: Specimen | null;

  // Pre-mutation chromosome snapshots (captured after crossover, before mutate())
  private _preMutationChildren: Specimen[];

  // Full breeding data (all pairs per generation)
  private _aParents: Specimen[];
  private _bParents: Specimen[];
  private _aChildren: Specimen[];
  private _bChildren: Specimen[];
  private _mutations: Specimen[];
  private _mutationRecords: MutationRecord[];
  private _crossoverPoints: number[];
  private _avgFitnessEligibleParents: number;

  /** Synthetic seed parents created at gen 0 so gen 1 maturation is uniform. */
  private _seedParents: Specimen[];

  constructor(config: AlgorithmConfig) {
    this.config = { ...config };
    this.children = [];
    this._generation = 0;
    this._solved = false;
    this._solutionSpecimen = null;
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
      this.parents.push(createSeededSpecimen(i, this._populationSeed));
    }
    this.parents.sort((a, b) => b.fitness - a.fitness);

    // Create synthetic seed parents — random specimens that exist solely
    // to be retired at gen 1 maturation, making the pipeline fully uniform.
    // Use a separate seed offset so they don't collide with the real population.
    this._seedParents = [];
    for (let i = 0; i < this.config.populationSize; i++) {
      const sp = createSeededSpecimen(i + this.config.populationSize, this._populationSeed);
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
      ? this._seedParents.map(cloneSpecimen)
      : this.parents.map(cloneSpecimen);
    const preAgingPrevChildren = skipPipeline ? [] : (this._generation === 0)
      ? this.parents.map(cloneSpecimen)
      : this.children.map(cloneSpecimen);

    // Step 1: Prepare population
    this.prepareToStep();

    // Capture post-aging state for pipeline op 0 after / op 1 before
    const retiredParents = skipPipeline ? [] : preAgingOldParents.map(spec => ({ ...spec, age: 3 as Age }));
    const eligibleAdultsSnap = skipPipeline ? [] : this.parents.map(cloneSpecimen);

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
    const actualParents: Specimen[] = [];
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
    this._mutationRecords.sort((a, b) => b.specimen.fitness - a.specimen.fitness);
    this._mutations.sort((a, b) => b.fitness - a.fitness);

    const breedingData: GenerationBreedingData = {
      aParents: this._aParents.map(cloneSpecimen),
      bParents: this._bParents.map(cloneSpecimen),
      aChildren: this._aChildren.map(cloneSpecimen),
      bChildren: this._bChildren.map(cloneSpecimen),
      actualParents: actualParents.map(cloneSpecimen),
      mutations: this._mutations.map(cloneSpecimen),
      mutationRecords: this._mutationRecords.map(r => ({ ...r, specimen: cloneSpecimen(r.specimen) })),
      eligibleParents: this.parents.map(cloneSpecimen),
      allChildren: this.children.map(cloneSpecimen),
      crossoverPoints: [...this._crossoverPoints],
    };

    // Assemble full pipeline snapshot (skipped for intermediate bulk steps)
    const emptyOps = (): GenerationPipeline => ({ ops: Array.from({ length: 6 }, (): PipelineOp => [[], [], []]) });

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

      // Helper: tag a cloned specimen with a pipeline role (and optional extra fields)
      const tag = (spec: Specimen, role: PipelineRole, extra?: Partial<Specimen>): Specimen => ({
        ...cloneSpecimen(spec), pipelineRole: role, ...extra,
      });

      // The transform snapshot (z=1) is seeded from before but is its own deep clone —
      // future work can populate it with transition-specific data independently.
      const makeOp = (before: Specimen[], after: Specimen[]): PipelineOp =>
        [before, before.map(cloneSpecimen), after];

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
      const selectedPairSnap = actualParents.map(i => tag(i, 'selectedPair', { partnerIds: [...(partnerIdMap.get(i.id) ?? new Set())] }));
      const unselectedSnap = unselected.map(i => tag(i, 'unselected'));
      const snap22 = [ // op 2 after / op 3 before: selected (with partners) + unselected
        ...selectedPairSnap,
        ...unselectedSnap,
      ];
      const preMutChromosomes = this._preMutationChildren.map(i => tag(i, 'chromosome'));
      const snap32 = [ // op 3 after / op 4 before: selected + unselected + pre-mutation chromosomes
        ...selectedPairSnap,
        ...unselectedSnap,
        ...preMutChromosomes,
      ];
      const postMutChromosomes = this.children.map(i => tag(i, 'chromosome'));
      const snap42 = [ // op 4 after / op 5 before: selected + unselected + post-mutation chromosomes
        ...selectedPairSnap,
        ...unselectedSnap,
        ...postMutChromosomes,
      ];
      const snap52 = [ // op 5 after: selected + unselected + realized children
        ...selectedPairSnap,
        ...unselectedSnap,
        ...this.children.map(i => tag(i, 'finalChild')),
      ];

      // Build breeding pairs for ops 2-3 transform data
      const buildPairs = (
        tagRole: PipelineRole,
        withPartners: boolean,
        withCrossover: boolean,
      ): BreedingPair[] => {
        const pairs: BreedingPair[] = [];
        for (let i = 0; i < this._aParents.length; i++) {
          const pA = tag(this._aParents[i]!, tagRole,
            withPartners ? { partnerIds: [...(partnerIdMap.get(this._aParents[i]!.id) ?? new Set())] } : undefined);
          const pB = tag(this._bParents[i]!, tagRole,
            withPartners ? { partnerIds: [...(partnerIdMap.get(this._bParents[i]!.id) ?? new Set())] } : undefined);
          const pair: BreedingPair = { index: i, parentA: pA, parentB: pB };
          if (withCrossover) {
            pair.crossoverPoint = this._crossoverPoints[i];
            pair.childA = preMutChromosomes[i * 2];
            pair.childB = preMutChromosomes[i * 2 + 1]; // may be undefined for last pair on early termination
          }
          pairs.push(pair);
        }
        return pairs;
      };

      pipeline = {
        ops: [
          makeOp(snap00, snap02), // op 0: Age specimens
          makeOp(snap02, snap12), // op 1: Remove elders
          makeOp(snap12, snap22), // op 2: Select breeding pairs
          makeOp(snap22, snap32), // op 3: Generate chromosomes
          makeOp(snap32, snap42), // op 4: Apply mutations
          makeOp(snap42, snap52), // op 5: Realize children
        ],
        transformData: {
          2: { pairs: buildPairs('selectedPair', true, false) },
          3: { pairs: buildPairs('selectedPair', true, true) },
        },
      };
    }

    return {
      generationNumber: this._generation,
      bestFitness: bestChild.fitness,
      avgFitness,
      bestSpecimen: cloneSpecimen(bestChild),
      mutationCount,
      solved: this._solved,
      solutionSpecimen: this._solutionSpecimen
        ? cloneSpecimen(this._solutionSpecimen)
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
      // Gen 0: age initial population (child→adult), matching op 0 "Age specimens"
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
      const childA = cloneSpecimen(parentA);
      childA.id = this._nextId++;
      childA.localIndex = this.children.length;
      childA.bornGeneration = this._generation + 1;
      childA.age = 1; // child
      const childB = cloneSpecimen(parentB);
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
        this._preMutationChildren.push(cloneSpecimen(childA));
        if (this.children.length + 1 < targetSize) {
          this._preMutationChildren.push(cloneSpecimen(childB));
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
      this._lastParentA = cloneSpecimen(parentA);
      this._lastParentB = cloneSpecimen(parentB);
      this._lastChildA = cloneSpecimen(childA);
      this._lastChildB = cloneSpecimen(childB);

      // Check for solution
      if (childA.fitness === MAX_FITNESS) {
        this._solved = true;
        this._solutionSpecimen = cloneSpecimen(childA);
        this.children.push(childA);
        return mutationCount;
      }

      this.children.push(childA);

      if (this.children.length < targetSize) {
        if (childB.fitness === MAX_FITNESS) {
          this._solved = true;
          this._solutionSpecimen = cloneSpecimen(childB);
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

  get solutionSpecimen(): Specimen | null {
    return this._solutionSpecimen;
  }

  getBestSpecimen(): Specimen | null {
    const pop = this._generation === 0 ? this.parents : this.children;
    if (pop.length === 0) return null;
    return pop.reduce((best, spec) => (spec.fitness > best.fitness ? spec : best));
  }

  /**
   * Returns a GenerationResult representing the initial random population (gen 0).
   * Includes synthetic seed parents as actualParents and the initial population
   * as allChildren, so gen 1 maturation can uniformly retire/promote them.
   */
  getInitialResult(): GenerationResult {
    const best = this.parents[0]!; // already sorted descending
    // Gen 0 micro mode starts at 0.5.2 — pre-aging pools are never visited.
    // Stub with all-empty ops; withPipeline() will reconstruct from breedingData on demand.
    const emptyOp = (): PipelineOp => [[], [], []];
    const pipeline: GenerationPipeline = {
      ops: [emptyOp(), emptyOp(), emptyOp(), emptyOp(), emptyOp(), emptyOp()],
    };

    // Build synthetic breeding pairs for gen 0 so they appear in micro-mode walkthrough.
    // Pairs seed parents consecutively and map them to the initial children.
    const numPairs = Math.floor(this._seedParents.length / 2);
    const syntheticCrossover = 4; // midpoint of 8-gene chromosome
    const allChildren = this.parents.map(cloneSpecimen);

    const tag = (spec: Specimen, role: PipelineRole, extra?: Partial<Specimen>): Specimen => ({
      ...cloneSpecimen(spec), pipelineRole: role, ...extra,
    });

    const syntheticAParents: Specimen[] = [];
    const syntheticBParents: Specimen[] = [];
    const syntheticCrossoverPoints: number[] = [];

    const buildSyntheticPairs = (
      tagRole: PipelineRole,
      withPartners: boolean,
      withCrossover: boolean,
    ): BreedingPair[] => {
      const pairs: BreedingPair[] = [];
      for (let i = 0; i < numPairs; i++) {
        const seedA = this._seedParents[i * 2]!;
        const seedB = this._seedParents[i * 2 + 1]!;
        const pA = tag(seedA, tagRole,
          withPartners ? { partnerIds: [seedB.id] } : undefined);
        const pB = tag(seedB, tagRole,
          withPartners ? { partnerIds: [seedA.id] } : undefined);
        const pair: BreedingPair = { index: i, parentA: pA, parentB: pB };
        if (withCrossover) {
          pair.crossoverPoint = syntheticCrossover;
          pair.childA = tag(allChildren[i * 2]!, 'chromosome');
          pair.childB = i * 2 + 1 < allChildren.length
            ? tag(allChildren[i * 2 + 1]!, 'chromosome')
            : undefined;
        }
        pairs.push(pair);
      }
      return pairs;
    };

    // Collect aParents/bParents for breedingData
    for (let i = 0; i < numPairs; i++) {
      syntheticAParents.push(this._seedParents[i * 2]!);
      syntheticBParents.push(this._seedParents[i * 2 + 1]!);
      syntheticCrossoverPoints.push(syntheticCrossover);
    }

    pipeline.transformData = {
      2: { pairs: buildSyntheticPairs('selectedPair', true, false) },
      3: { pairs: buildSyntheticPairs('selectedPair', true, true) },
    };

    return {
      generationNumber: 0,
      bestFitness: best.fitness,
      avgFitness: this._avgFitnessEligibleParents,
      bestSpecimen: cloneSpecimen(best),
      mutationCount: 0,
      solved: false,
      solutionSpecimen: null,
      lastParentA: null,
      lastParentB: null,
      lastChildA: null,
      lastChildB: null,
      breedingData: {
        aParents: syntheticAParents,
        bParents: syntheticBParents,
        aChildren: allChildren.filter((_, i) => i % 2 === 0).slice(0, numPairs),
        bChildren: allChildren.filter((_, i) => i % 2 === 1).slice(0, numPairs),
        actualParents: [...this._seedParents],
        mutations: [],
        mutationRecords: [],
        eligibleParents: [...this._seedParents],
        allChildren,
        crossoverPoints: syntheticCrossoverPoints,
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
   * Specimen i always gets the same genes regardless of population size.
   */
  resizePopulation(newSize: number): void {
    if (this._generation !== 0) return;
    this.config.populationSize = newSize;

    if (newSize > this.parents.length) {
      // Append new seeded specimens, continuing from where we left off
      const toAdd = newSize - this.parents.length;
      for (let i = 0; i < toAdd; i++) {
        this.parents.push(createSeededSpecimen(this._seededCount + i, this._populationSeed));
      }
      this._seededCount += toAdd;
    } else if (newSize < this.parents.length) {
      // Remove the most recently seeded specimens (highest IDs)
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
      const sp = createSeededSpecimen(i + newSize, this._populationSeed);
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
    for (const spec of pop) {
      if (spec.fitness > best) best = spec.fitness;
      total += spec.fitness;
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
