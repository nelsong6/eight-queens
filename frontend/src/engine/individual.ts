// ============================================================================
// individual.ts - Individual chromosome for the 8-queens problem
// Ported from C# individual.cs
// ============================================================================

import { Individual, BOARD_SIZE } from './types';
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
  };
}

/**
 * Create an individual from an existing solution array.
 */
export function createIndividual(id: number, solution: number[]): Individual {
  return {
    id,
    solution: [...solution],
    fitness: assessFitness(solution),
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
  };
}

/**
 * Apply mutation to an individual.
 * With probability mutationRate, pick a random gene index and assign a random value.
 * Returns true if mutation occurred.
 * Matches C# individual.mutate().
 */
export function mutate(ind: Individual, mutationRate: number): boolean {
  const roll = randomInt(1, 100);
  const threshold = Math.floor(mutationRate * 100);

  if (roll <= threshold) {
    const mutateIndex = randomInt(0, 7);
    ind.solution[mutateIndex] = randomInt(0, 7);
    ind.fitness = assessFitness(ind.solution);
    return true;
  }

  return false;
}

/**
 * Generate a random integer in [min, max] inclusive.
 */
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
