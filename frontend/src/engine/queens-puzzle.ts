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
  MutationRecord,
  GenerationResult,
  GenerationBreedingData,
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

  // Visualization state: last breeding pair
  private _lastParentA: Individual | null;
  private _lastParentB: Individual | null;
  private _lastChildA: Individual | null;
  private _lastChildB: Individual | null;

  // Full breeding data (all pairs per generation)
  private _aParents: Individual[];
  private _bParents: Individual[];
  private _aChildren: Individual[];
  private _bChildren: Individual[];
  private _mutations: Individual[];
  private _mutationRecords: MutationRecord[];
  private _crossoverPoints: number[];
  private _avgFitnessEligibleParents: number;

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

    // Eagerly create initial random population so it's visible at gen 0
    this._populationSeed = Math.floor(Math.random() * 0xFFFFFFFF);
    this._seededCount = this.config.populationSize;
    this.parents = [];
    for (let i = 0; i < this.config.populationSize; i++) {
      this.parents.push(createSeededIndividual(i, this._populationSeed));
    }
    this.parents.sort((a, b) => b.fitness - a.fitness);

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
  step(): GenerationResult | null {
    if (this._solved) return null;

    // Step 1: Prepare population
    this.prepareToStep();

    // Step 2: Build selection probability list
    const probabilityList = this.buildProbabilityList();

    // Step 3: Breed children
    const mutationCount = this.breedChildren(probabilityList);

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
      aParents: this._aParents,
      bParents: this._bParents,
      aChildren: this._aChildren,
      bChildren: this._bChildren,
      actualParents,
      mutations: this._mutations,
      mutationRecords: this._mutationRecords,
      eligibleParents: [...this.parents],
      allChildren: [...this.children],
      crossoverPoints: this._crossoverPoints,
    };

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
    };
  }

  // --------------------------------------------------------------------------
  // Population initialization (ported from queenspuzzle.prepare_to_step)
  // --------------------------------------------------------------------------

  private prepareToStep(): void {
    if (this._generation > 0) {
      // Subsequent generations: children become parents
      this.parents = this.children;
      this.parents.sort((a, b) => b.fitness - a.fitness);

      let totalFitness = 0;
      for (const parent of this.parents) {
        totalFitness += parent.fitness;
      }
      this._avgFitnessEligibleParents = this.parents.length > 0
        ? totalFitness / this.parents.length
        : 0;
    }
    // Gen 0: parents already created and sorted in constructor

    // Reset children and breeding lists
    this.children = [];
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
  private breedChildren(probabilityList: number[]): number {
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
      childA.id = this.children.length;
      childA.bornGeneration = this._generation + 1;
      const childB = cloneIndividual(parentB);
      childB.id = this.children.length + 1;
      childB.bornGeneration = this._generation + 1;

      // Single-point crossover at random position within range
      const [minPos, maxPos] = this.config.crossoverRange;
      const crossoverPos = randomInt(minPos, maxPos);
      this._crossoverPoints.push(crossoverPos);

      // Swap genes from crossover position onwards
      for (let i = crossoverPos; i < 8; i++) {
        const temp = childA.solution[i]!;
        childA.solution[i] = childB.solution[i]!;
        childB.solution[i] = temp;
      }

      // Recalculate fitness after crossover
      childA.fitness = assessFitness(childA.solution);
      childB.fitness = assessFitness(childB.solution);

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
   * No breeding has occurred — only eligibleParents is populated.
   */
  getInitialResult(): GenerationResult {
    const best = this.parents[0]!; // already sorted descending
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
        actualParents: [],
        mutations: [],
        mutationRecords: [],
        eligibleParents: [...this.parents],
        allChildren: [],
        crossoverPoints: [],
      },
      stepStatistics: {
        eligibleParentsCount: this.parents.length,
        avgFitnessEligibleParents: this._avgFitnessEligibleParents,
        actualParentsCount: 0,
        avgFitnessActualParents: 0,
        childrenCount: 0,
        avgFitnessChildren: 0,
        mutationCount: 0,
      },
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
