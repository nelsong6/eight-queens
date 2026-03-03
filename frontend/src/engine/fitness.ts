// ============================================================================
// fitness.ts - Fitness calculation for the 8-queens problem
// Ported from C# individual.assess_fitness()
// ============================================================================

import { MAX_FITNESS, BOARD_SIZE } from './types';

/**
 * Calculate the fitness of a solution.
 * Counts the number of non-attacking queen pairs.
 *
 * Two queens attack each other if:
 *   - Same row: solution[i] === solution[j]
 *   - Same diagonal: |i - j| === |solution[i] - solution[j]|
 *
 * Maximum fitness = C(8,2) = 28 (no attacks).
 * Matches C# individual.assess_fitness().
 */
export function assessFitness(solution: number[]): number {
  let attacks = 0;

  for (let i = 0; i < BOARD_SIZE; i++) {
    for (let j = i + 1; j < BOARD_SIZE; j++) {
      // Same row
      if (solution[i] === solution[j]) {
        attacks++;
      }
      // Same diagonal
      else if (Math.abs(i - j) === Math.abs(solution[i]! - solution[j]!)) {
        attacks++;
      }
    }
  }

  return MAX_FITNESS - attacks;
}
