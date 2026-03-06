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
  /** Unique ID within the generation. */
  id: number;
  /** The solution array: index=column, value=row (0-7). */
  solution: number[];
  /** Fitness score (0-28). 28 = perfect solution. */
  fitness: number;
  /** The generation number in which this individual was created. */
  bornGeneration?: number;
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
 * Per-step statistics matching C# queenspuzzle's "Totals This Step" groupbox.
 */
export interface StepStatistics {
  eligibleParentsCount: number;
  avgFitnessEligibleParents: number;
  actualParentsCount: number;
  avgFitnessActualParents: number;
  childrenCount: number;
  avgFitnessChildren: number;
  mutationCount: number;
}

/**
 * Records what a mutation changed on an individual.
 */
export interface MutationRecord {
  individual: Individual;
  /** The full solution array before the mutation was applied. */
  preMutationSolution: number[];
  /** Fitness before the mutation. */
  preMutationFitness: number;
  geneIndex: number;
  oldValue: number;
  newValue: number;
}

/**
 * Detailed per-generation breeding data for listbox display.
 * All arrays sorted by fitness descending.
 */
export interface GenerationBreedingData {
  aParents: Individual[];
  bParents: Individual[];
  aChildren: Individual[];
  bChildren: Individual[];
  actualParents: Individual[];
  mutations: Individual[];
  mutationRecords: MutationRecord[];
  eligibleParents: Individual[];
  allChildren: Individual[];
  /** crossoverPoints[i] = splice position used for breeding pair i. */
  crossoverPoints: number[];
}

/**
 * Cumulative statistics across all generations.
 * Matches C# queenspuzzle's "Totals" groupbox.
 */
export interface CumulativeStatistics {
  totalEligibleParents: number;
  avgFitnessIncrease: number;
  totalActualParents: number;
  totalChildren: number;
  totalMutations: number;
  iterationCount: number;
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
  /** Full breeding data for listbox display. */
  breedingData: GenerationBreedingData;
  /** Per-step statistics. */
  stepStatistics: StepStatistics;
}
