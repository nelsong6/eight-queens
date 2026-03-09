// ============================================================================
// types.ts - Core types for the Eight Queens Genetic Algorithm
// Ported from C# Genetic-algorithm-8queens project
// ============================================================================

/**
 * Configuration for the genetic algorithm.
 * Matches the C# InitialSettings / queenspuzzle configurable parameters.
 */
export interface AlgorithmConfig {
  /** Number of specimens in the population. C# default: 10,000. */
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
 * Represents a single specimen (chromosome) in the population.
 * Each specimen is an array of 8 integers (0-7), where index = column
 * and value = row position of the queen in that column.
 */
/** Lifecycle age: 0 = chromosome, 1 = child, 2 = adult, 3 = elder. */
export type Age = 0 | 1 | 2 | 3;

/** Role of a specimen within the generation pipeline at a snapshot boundary. */
export type PipelineRole =
  | 'oldParent'       // op 0 before: prior-gen adults (or seed parents at gen 1)
  | 'previousChild'   // op 0 before: prior-gen children (to become adults)
  | 'retiredParent'   // op 0 after: aged to elder (age 3)
  | 'eligibleAdult'   // op 1 after / op 2 before: age 1-2, eligible for selection
  | 'selectedPair'    // op 2 after: chosen by roulette wheel, partnerIds set
  | 'unselected'      // op 2 after: not chosen, persists alongside
  | 'chromosome'      // op 3 after: new child pre-realization, crossover data set
  | 'finalChild';     // op 5 after: chromosome promoted to age-1 child

export interface Specimen {
  /** Globally unique numeric ID. */
  id: number;
  /** Index within the generation (used for display: gen.localIndex). */
  localIndex: number;
  /** The solution array: index=column, value=row (0-7). */
  solution: number[];
  /** Fitness score (0-28). 28 = perfect solution. */
  fitness: number;
  /** The generation number in which this specimen was created. */
  bornGeneration?: number;
  /** Lifecycle age: 0 = chromosome, 1 = child, 2 = adult, 3 = elder. */
  age: Age;
  /** Role in the generation pipeline snapshot; undefined outside pipeline context. */
  pipelineRole?: PipelineRole;
  /** IDs of mating partners (set at op 2+, can have multiple from roulette reselection). */
  partnerIds?: number[];
  /** ID of the A-side parent (set on chromosomes/children). */
  parentAId?: number;
  /** ID of the B-side parent (set on chromosomes/children). */
  parentBId?: number;
  /** Crossover split position used when this specimen was bred. */
  crossoverPoint?: number;
  /** Whether this chromosome was mutated during Apply Mutations (op 4). */
  mutated?: boolean;
  /** Gene values before mutation was applied (only if mutated). */
  preMutationSolution?: number[];
}

/**
 * Summary of a single generation for logging/charting.
 */
export interface GenerationSummary {
  generationNumber: number;
  bestFitness: number;
  avgFitness: number;
  bestSpecimen: number[];
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
 * Records what a mutation changed on a specimen.
 */
export interface MutationRecord {
  specimen: Specimen;
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
  aParents: Specimen[];
  bParents: Specimen[];
  aChildren: Specimen[];
  bChildren: Specimen[];
  actualParents: Specimen[];
  mutations: Specimen[];
  mutationRecords: MutationRecord[];
  eligibleParents: Specimen[];
  allChildren: Specimen[];
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
  /** y-axis value (0–5). */
  index: number;
  /** Human-readable name, e.g. "Promote children". */
  name: string;
  type: OpType;
  category: OpCategory;
}

/**
 * A precise position in the GA pipeline.
 * Format: x.y where x=generation, y=operation (0–5). Time implies the step is complete.
 */
export interface TimeCoordinate {
  generation: number;
  operation: number;
}

/** Named population pool at a given pipeline position. */
export type PoolName =
  | 'oldParents'
  | 'previousChildren'
  | 'eligibleAdults'
  | 'retiredParents'
  | 'selectedPairs'
  | 'unselected'
  | 'chromosomes'
  | 'finalChildren';

/** Identifies which pool a specimen was observed in. */
export interface PoolOrigin {
  coordinate: TimeCoordinate;
  pool: PoolName;
  /** Optional qualifier, e.g. 'A' | 'B' for parent side. */
  qualifier?: string;
}

// ============================================================================
// Pipeline Snapshot System
// ============================================================================

/**
 * Flat master list of all specimens present at one boundary of one operation.
 * Pool membership is derived from each specimen's `pipelineRole` field.
 * Use `resolvePoolFromPipeline` to filter by pool name.
 */
export type PipelineSnapshot = Specimen[];

/**
 * Three snapshots per operation: before (z=0), transform (z=1), after (z=2).
 * Transform is deep-cloned from before independently — currently the same data,
 * but kept separate so future work can customize what the transform screen shows
 * (e.g. specimens mid-transition, annotated with what's changing).
 */
export type PipelineOp = [PipelineSnapshot, PipelineSnapshot, PipelineSnapshot];

/**
 * A breeding pair: two specimens selected for crossover.
 * Created at op 2, annotated at op 3, pruned when source specimens are removed.
 */
export interface BreedingPair {
  /** Index of this pair within the generation's breeding sequence (0-based). */
  index: number;
  /** The A-side parent (contributes left portion of child A's chromosome). */
  parentA: Specimen;
  /** The B-side parent (contributes left portion of child B's chromosome). */
  parentB: Specimen;
  /** Crossover split position used for this pair. Set at op 3. */
  crossoverPoint?: number;
  /** The A-side child. Set at op 3. */
  childA?: Specimen;
  /** The B-side child. Set at op 3. */
  childB?: Specimen;
}

/** Per-operation transform data that supplements the specimen snapshots. */
export interface PipelineTransformData {
  pairs?: BreedingPair[];
}

/** Complete pipeline for one generation: ops[y][z] = snapshot at operation y, boundary z. */
export interface GenerationPipeline {
  ops: PipelineOp[]; // length 6, indexed by operation (0–5)
  /** Per-operation transform data keyed by operation index (0-5). Only present for ops with pair data. */
  transformData?: Record<number, PipelineTransformData>;
}

/**
 * Result of running a single generation step.
 */
export interface GenerationResult {
  generationNumber: number;
  bestFitness: number;
  avgFitness: number;
  bestSpecimen: Specimen;
  mutationCount: number;
  solved: boolean;
  solutionSpecimen: Specimen | null;
  /** The parent pair for the last breeding event (for visualization). */
  lastParentA: Specimen | null;
  lastParentB: Specimen | null;
  lastChildA: Specimen | null;
  lastChildB: Specimen | null;
  /** Full breeding data for listbox display. */
  breedingData: GenerationBreedingData;
  /** Per-step statistics. */
  stepStatistics: StepStatistics;
  /** Complete pipeline snapshot: all pool states at every operation boundary. */
  pipeline: GenerationPipeline;
}
