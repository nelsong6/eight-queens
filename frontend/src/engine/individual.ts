// ============================================================================
// individual.ts - Individual chromosome for the 8-queens problem
// Ported from C# individual.cs
// ============================================================================

import { Individual, BOARD_SIZE, MutationRecord, Age } from './types';
import { assessFitness } from './fitness';

/**
 * Create a random individual with 8 random queen positions.
 * Matches C# individual constructor.
 */
export function createRandomIndividual(id: number): Individual {
  const solution: number[] = [];
  for (let i = 0; i < BOARD_SIZE; i++) {
    solution.push(randomInt(0, 7));
  }
  return {
    id,
    solution,
    fitness: assessFitness(solution),
    bornGeneration: 0,
    age: 1 as Age,
  };
}

/**
 * Create an individual from an existing solution array.
 */
export function createIndividual(id: number, solution: number[], bornGeneration?: number): Individual {
  return {
    id,
    solution: [...solution],
    fitness: assessFitness(solution),
    bornGeneration,
    age: 0 as Age,
  };
}

/**
 * Clone an individual (deep copy).
 */
export function cloneIndividual(ind: Individual): Individual {
  return {
    id: ind.id,
    solution: [...ind.solution],
    fitness: ind.fitness,
    bornGeneration: ind.bornGeneration,
    age: ind.age,
  };
}

/**
 * Apply mutation to an individual.
 * With probability mutationRate, pick a random gene index and assign a random value.
 * Returns a MutationRecord if mutation occurred, or null otherwise.
 * Matches C# individual.mutate().
 */
export function mutate(ind: Individual, mutationRate: number): MutationRecord | null {
  const roll = randomInt(1, 100);
  const threshold = Math.floor(mutationRate * 100);

  if (roll <= threshold) {
    const preMutationSolution = [...ind.solution];
    const preMutationFitness = ind.fitness;
    const mutateIndex = randomInt(0, 7);
    const oldValue = ind.solution[mutateIndex]!;
    const newValue = randomInt(0, 7);
    ind.solution[mutateIndex] = newValue;
    ind.fitness = assessFitness(ind.solution);
    return { individual: ind, geneIndex: mutateIndex, oldValue, newValue, preMutationSolution, preMutationFitness };
  }

  return null;
}

/**
 * Create an individual deterministically from a seed.
 * Individual i always gets the same genes for a given seed,
 * regardless of population size.
 */
export function createSeededIndividual(id: number, seed: number): Individual {
  // Derive per-individual state from seed + index (golden ratio hash for spread)
  let s = ((seed + id * 0x9E3779B9) >>> 0);
  const next = (): number => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const seededInt = (min: number, max: number) =>
    Math.floor(next() * (max - min + 1)) + min;

  const solution: number[] = [];
  for (let i = 0; i < BOARD_SIZE; i++) {
    solution.push(seededInt(0, 7));
  }
  return { id, solution, fitness: assessFitness(solution), bornGeneration: 0, age: 1 as Age };
}

/**
 * Generate a random integer in [min, max] inclusive.
 */
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
