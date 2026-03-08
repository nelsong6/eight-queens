// ============================================================================
// specimen.ts - Specimen chromosome for the 8-queens problem
// Ported from C# individual.cs
// ============================================================================

import { Specimen, BOARD_SIZE, MutationRecord, Age } from './types';
import { assessFitness } from './fitness';

/**
 * Create a random specimen with 8 random queen positions.
 * Matches C# individual constructor.
 */
export function createRandomSpecimen(id: number): Specimen {
  const solution: number[] = [];
  for (let i = 0; i < BOARD_SIZE; i++) {
    solution.push(randomInt(0, 7));
  }
  return {
    id,
    localIndex: id,
    solution,
    fitness: assessFitness(solution),
    bornGeneration: 0,
    age: 1 as Age,
  };
}

/**
 * Create a specimen from an existing solution array.
 */
export function createSpecimen(id: number, solution: number[], bornGeneration?: number, localIndex?: number): Specimen {
  return {
    id,
    localIndex: localIndex ?? id,
    solution: [...solution],
    fitness: assessFitness(solution),
    bornGeneration,
    age: 0 as Age,
  };
}

/** Format a specimen's ID for display as gen.localIndex (e.g. "3.42", "-1.5"). */
export function formatId(spec: Specimen): string {
  return `${spec.bornGeneration ?? 0}.${spec.localIndex}`;
}

/**
 * Clone a specimen (deep copy).
 */
export function cloneSpecimen(spec: Specimen): Specimen {
  return {
    id: spec.id,
    localIndex: spec.localIndex,
    solution: [...spec.solution],
    fitness: spec.fitness,
    bornGeneration: spec.bornGeneration,
    age: spec.age,
    pipelineRole: spec.pipelineRole,
    partnerIds: spec.partnerIds ? [...spec.partnerIds] : undefined,
    parentAId: spec.parentAId,
    parentBId: spec.parentBId,
    crossoverPoint: spec.crossoverPoint,
    mutated: spec.mutated,
    preMutationSolution: spec.preMutationSolution ? [...spec.preMutationSolution] : undefined,
  };
}

/**
 * Apply mutation to a specimen.
 * With probability mutationRate, pick a random gene index and assign a random value.
 * Returns a MutationRecord if mutation occurred, or null otherwise.
 * Matches C# individual.mutate().
 */
export function mutate(spec: Specimen, mutationRate: number): MutationRecord | null {
  const roll = randomInt(1, 100);
  const threshold = Math.floor(mutationRate * 100);

  if (roll <= threshold) {
    const preMutationSolution = [...spec.solution];
    const preMutationFitness = spec.fitness;
    const mutateIndex = randomInt(0, 7);
    const oldValue = spec.solution[mutateIndex]!;
    const newValue = randomInt(0, 7);
    spec.solution[mutateIndex] = newValue;
    spec.fitness = assessFitness(spec.solution);
    spec.mutated = true;
    spec.preMutationSolution = preMutationSolution;
    return { specimen: spec, geneIndex: mutateIndex, oldValue, newValue, preMutationSolution, preMutationFitness };
  }

  return null;
}

/**
 * Create a specimen deterministically from a seed.
 * Specimen i always gets the same genes for a given seed,
 * regardless of population size.
 */
export function createSeededSpecimen(id: number, seed: number): Specimen {
  // Derive per-specimen state from seed + index (golden ratio hash for spread)
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
  return { id, localIndex: id, solution, fitness: assessFitness(solution), bornGeneration: 0, age: 1 as Age };
}

/**
 * Generate a random integer in [min, max] inclusive.
 */
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
