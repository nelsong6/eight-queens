// ============================================================================
// algorithm-runner.ts - Genetic algorithm orchestrator
// Wraps QueensPuzzle for the React frontend with generation-level execution.
// ============================================================================

import {
  AlgorithmConfig,
  DEFAULT_CONFIG,
  GenerationResult,
  GenerationSummary,
} from './types';
import { QueensPuzzle } from './queens-puzzle';

/**
 * AlgorithmRunner manages the genetic algorithm execution for the UI.
 * Runs one generation at a time, yielding results for visualization.
 */
export class AlgorithmRunner {
  private config: AlgorithmConfig;
  private puzzle: QueensPuzzle;
  private _generation: number;
  private _solved: boolean;

  constructor(config: AlgorithmConfig = DEFAULT_CONFIG) {
    this.config = { ...config };
    this.puzzle = new QueensPuzzle(this.config);
    this._generation = 0;
    this._solved = false;
  }

  /**
   * Run a single generation step.
   * Returns the generation result, or null if already solved.
   */
  runGeneration(): GenerationResult | null {
    if (this._solved) return null;

    const result = this.puzzle.step();
    if (!result) return null;

    this._generation = result.generationNumber;
    this._solved = result.solved;

    return result;
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
  }

  get generation(): number {
    return this._generation;
  }

  get solved(): boolean {
    return this._solved;
  }

  get algorithmConfig(): Readonly<AlgorithmConfig> {
    return this.config;
  }
}
