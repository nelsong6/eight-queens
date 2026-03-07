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
/** Lifecycle age: 0 = chromosome, 1 = child, 2 = adult, 3 = elder. */
export type Age = 0 | 1 | 2 | 3;

export interface Individual {
  /** Globally unique numeric ID. */
  id: number;
  /** Index within the generation (used for display: gen.localIndex). */
  localIndex: number;
  /** The solution array: index=column, value=row (0-7). */
  solution: number[];
  /** Fitness score (0-28). 28 = perfect solution. */
  fitness: number;
  /** The generation number in which this individual was created. */
  bornGeneration?: number;
  /** Lifecycle age: 0 = chromosome, 1 = child, 2 = adult, 3 = elder. */
  age: Age;
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

// ============================================================================
// Time Coordinate System
// ============================================================================

/** Type of atomic operation in the generation pipeline. */
export type OpType = 'transform' | 'add' | 'remove';

/** Display category grouping for operations. */
export type OpCategory = 'Aging' | 'Pruning' | 'Selection' | 'Crossover' | 'Mutation' | 'Birth';

/** Definition of one atomic operation in the generation pipeline. */
export interface OpDefinition {
  /** y-axis value (0–7). */
  index: number;
  /** Human-readable name, e.g. "Promote children". */
  name: string;
  type: OpType;
  category: OpCategory;
}

/**
 * A precise position in the GA pipeline.
 * Format: x.y.t where x=generation, y=operation (0–6), t=phase (0=before, 1=transform, 2=after).
 */
export interface TimeCoordinate {
  generation: number;
  operation: number;
  boundary: 0 | 1 | 2;
}

/** Named population pool at a given pipeline position. */
export type PoolName =
  | 'oldParents'
  | 'previousChildren'
  | 'eligibleAdults'
  | 'retiredParents'
  | 'selectedPairs'
  | 'unselected'
  | 'matedParents'
  | 'chromosomes'
  | 'finalChildren';

/** Identifies which pool an individual was observed in. */
export interface PoolOrigin {
  coordinate: TimeCoordinate;
  pool: PoolName;
  /** Optional qualifier, e.g. 'A' | 'B' for parent side. */
  qualifier?: string;
}

// ============================================================================
// Pipeline Snapshot System
// ============================================================================

/** Pool map at one boundary of one operation. Keys are PoolName values present at that coordinate. */
export type PipelineSnapshot = Partial<Record<PoolName, Individual[]>>;

/**
 * Three snapshots per operation: before (z=0), transform (z=1), after (z=2).
 * Transform is deep-cloned from before independently — currently the same data,
 * but kept separate so future work can customize what the transform screen shows
 * (e.g. individuals mid-transition, annotated with what's changing).
 */
export type PipelineOp = [PipelineSnapshot, PipelineSnapshot, PipelineSnapshot];

/** Complete pipeline for one generation: ops[y][z] = snapshot at operation y, boundary z. */
export interface GenerationPipeline {
  ops: PipelineOp[]; // length 7, indexed by operation (0–6)
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
  /** Complete pipeline snapshot: all pool states at every operation boundary. */
  pipeline: GenerationPipeline;
}
