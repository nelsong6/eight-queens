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
  GenerationResult,
  GenerationBreedingData,
  StepStatistics,
  MAX_FITNESS,
} from './types';
import {
  createRandomIndividual,
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
  private _crossoverPoints: number[];
  private _avgFitnessEligibleParents: number;

  constructor(config: AlgorithmConfig) {
    this.config = { ...config };
    this.parents = [];
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
    this._crossoverPoints = [];
    this._avgFitnessEligibleParents = 0;
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
    this._mutations.sort((a, b) => b.fitness - a.fitness);

    const breedingData: GenerationBreedingData = {
      aParents: this._aParents,
      bParents: this._bParents,
      aChildren: this._aChildren,
      bChildren: this._bChildren,
      actualParents,
      mutations: this._mutations,
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
    if (this._generation === 0) {
      // First generation: create random population
      this.parents = [];
      for (let i = 0; i < this.config.populationSize; i++) {
        this.parents.push(createRandomIndividual(i));
      }
    } else {
      // Subsequent generations: children become parents
      this.parents = this.children;
    }

    // Sort parents by fitness descending
    this.parents.sort((a, b) => b.fitness - a.fitness);

    // Compute avg fitness of eligible parents
    let totalFitness = 0;
    for (const parent of this.parents) {
      totalFitness += parent.fitness;
    }
    this._avgFitnessEligibleParents = this.parents.length > 0
      ? totalFitness / this.parents.length
      : 0;

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
      const childB = cloneIndividual(parentB);
      childB.id = this.children.length + 1;

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
      if (mutate(childA, this.config.mutationRate)) {
        mutationCount++;
        this._mutations.push(childA);
      }
      if (mutate(childB, this.config.mutationRate)) {
        mutationCount++;
        this._mutations.push(childB);
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
