// ============================================================================
// algorithm-runner.ts - Genetic algorithm orchestrator
// Wraps QueensPuzzle for the React frontend with generation-level execution.
// ============================================================================

import {
  AlgorithmConfig,
  CumulativeStatistics,
  DEFAULT_CONFIG,
  GenerationResult,
  GenerationSummary,
  StepStatistics,
} from './types';
import { QueensPuzzle } from './queens-puzzle';

/**
 * Result of running multiple generations at once.
 */
export interface MultiStepResult {
  summaries: GenerationSummary[];
  finalResult: GenerationResult;
}

/**
 * AlgorithmRunner manages the genetic algorithm execution for the UI.
 * Runs one generation at a time, yielding results for visualization.
 */
export class AlgorithmRunner {
  private config: AlgorithmConfig;
  private puzzle: QueensPuzzle;
  private _generation: number;
  private _solved: boolean;
  private _cumulativeStats: CumulativeStatistics;

  constructor(config: AlgorithmConfig = DEFAULT_CONFIG) {
    this.config = { ...config };
    this.puzzle = new QueensPuzzle(this.config);
    this._generation = 0;
    this._solved = false;
    this._cumulativeStats = this.emptyCumulativeStats();
  }

  private emptyCumulativeStats(): CumulativeStatistics {
    return {
      totalEligibleParents: 0,
      avgFitnessIncrease: 0,
      totalActualParents: 0,
      totalChildren: 0,
      totalMutations: 0,
      iterationCount: 0,
    };
  }

  private updateCumulativeStats(stats: StepStatistics): void {
    this._cumulativeStats.totalEligibleParents += stats.eligibleParentsCount;

    // Rolling average of fitness increase (matches C# updateAllTotals)
    const fitnessIncrease = stats.avgFitnessChildren - stats.avgFitnessEligibleParents;
    const prevTotal = this._cumulativeStats.avgFitnessIncrease * this._cumulativeStats.iterationCount;
    this._cumulativeStats.iterationCount++;
    this._cumulativeStats.avgFitnessIncrease =
      (prevTotal + fitnessIncrease) / this._cumulativeStats.iterationCount;

    this._cumulativeStats.totalActualParents += stats.actualParentsCount;
    this._cumulativeStats.totalChildren += stats.childrenCount;
    this._cumulativeStats.totalMutations += stats.mutationCount;
  }

  /**
   * Run a single generation step.
   * Returns the generation result, or null if already solved.
   */
  runGeneration(skipPipeline = false): GenerationResult | null {
    if (this._solved) return null;

    const result = this.puzzle.step(skipPipeline);
    if (!result) return null;

    this._generation = result.generationNumber;
    this._solved = result.solved;
    this.updateCumulativeStats(result.stepStatistics);

    return result;
  }

  /**
   * Run multiple generations in one call.
   * Returns summaries for all intermediate generations plus the full result
   * of the last generation (for breeding data display).
   * Accumulates cumulative stats for all generations.
   */
  runGenerations(count: number): MultiStepResult | null {
    if (this._solved) return null;

    const summaries: GenerationSummary[] = [];
    let lastResult: GenerationResult | null = null;

    for (let i = 0; i < count; i++) {
      const isLast = i === count - 1;
      const result = this.puzzle.step(/* skipPipeline */ !isLast);
      if (!result) break;

      this._generation = result.generationNumber;
      this._solved = result.solved;
      this.updateCumulativeStats(result.stepStatistics);

      summaries.push(AlgorithmRunner.toSummary(result));
      lastResult = result;

      if (result.solved) break;
    }

    if (!lastResult) return null;

    return { summaries, finalResult: lastResult };
  }

  /**
   * Convert a GenerationResult to a storable summary (for API persistence).
   */
  static toSummary(result: GenerationResult): GenerationSummary {
    return {
      generationNumber: result.generationNumber,
      bestFitness: result.bestFitness,
      avgFitness: result.avgFitness,
      bestIndividual: [...result.bestIndividual.solution],
      mutationCount: result.mutationCount,
    };
  }

  /**
   * Reset the algorithm with the same or new config.
   */
  reset(config?: AlgorithmConfig): void {
    const effectiveConfig = config ?? this.config;
    this.config = { ...effectiveConfig };
    this.puzzle = new QueensPuzzle(this.config);
    this._generation = 0;
    this._solved = false;
    this._cumulativeStats = this.emptyCumulativeStats();
  }

  /**
   * Returns a GenerationResult for the initial random population (gen 0).
   */
  getInitialResult(): GenerationResult {
    return this.puzzle.getInitialResult();
  }

  get generation(): number {
    return this._generation;
  }

  get solved(): boolean {
    return this._solved;
  }

  /**
   * Resize the gen-0 population in place (seeded, deterministic).
   */
  resizePopulation(newSize: number): void {
    if (this._generation !== 0) return;
    this.config.populationSize = newSize;
    this.puzzle.resizePopulation(newSize);
  }

  get algorithmConfig(): Readonly<AlgorithmConfig> {
    return this.config;
  }

  get cumulativeStats(): Readonly<CumulativeStatistics> {
    return this._cumulativeStats;
  }
}
