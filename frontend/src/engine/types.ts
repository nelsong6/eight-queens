// ============================================================================
// types.ts - Core types for the Eight Queens Genetic Algorithm
// Ported from C# Genetic-algorithm-8queens project
// ============================================================================

/**
 * Configuration for the genetic algorithm.
 * Matches the C# InitialSettings / queenspuzzle configurable parameters.
 */
export interface AlgorithmConfig {
  /** Number of individuals in the population. C# default: 10,000. */
  populationSize: number;
  /** Crossover position range [min, max] inclusive. C# default: [1, 6]. */
  crossoverRange: [number, number];
  /** Probability of mutation per child (0-1). C# default: 0.25. */
  mutationRate: number;
}

export const DEFAULT_CONFIG: AlgorithmConfig = {
  populationSize: 10000,
  crossoverRange: [1, 6],
  mutationRate: 0.25,
};

/** Maximum fitness: C(8,2) = 28 non-attacking queen pairs. */
export const MAX_FITNESS = 28;

/** Board size (always 8 for the 8-queens problem). */
export const BOARD_SIZE = 8;

/**
 * Represents a single individual (chromosome) in the population.
 * Each individual is an array of 8 integers (0-7), where index = column
 * and value = row position of the queen in that column.
 */
export interface Individual {
  /** The solution array: index=column, value=row (0-7). */
  solution: number[];
  /** Fitness score (0-28). 28 = perfect solution. */
  fitness: number;
}

/**
 * Summary of a single generation for logging/charting.
 */
export interface GenerationSummary {
  generationNumber: number;
  bestFitness: number;
  avgFitness: number;
  bestIndividual: number[];
  mutationCount: number;
}

/**
 * Result of running a single generation step.
 */
export interface GenerationResult {
  generationNumber: number;
  bestFitness: number;
  avgFitness: number;
  bestIndividual: Individual;
  mutationCount: number;
  solved: boolean;
  solutionIndividual: Individual | null;
  /** The parent pair for the last breeding event (for visualization). */
  lastParentA: Individual | null;
  lastParentB: Individual | null;
  lastChildA: Individual | null;
  lastChildB: Individual | null;
}
