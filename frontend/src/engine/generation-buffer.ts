import type {
  AlgorithmConfig,
  CumulativeStatistics,
  GenerationResult,
  GenerationSummary,
} from './types';
import { AlgorithmRunner, type MultiStepResult } from './algorithm-runner';

export interface BufferEntry {
  result: GenerationResult;
  summary: GenerationSummary;
}

/**
 * Pre-computes generations ahead of the animation playhead.
 * Holds a rolling buffer of GenerationResult + GenerationSummary pairs.
 * The producer loop runs via setTimeout(0) to stay non-blocking.
 */
export class GenerationBuffer {
  private runner: AlgorithmRunner;
  private buffer: BufferEntry[] = [];
  private consumedSummaries: GenerationSummary[] = [];
  private maxSize: number;
  private producing = false;
  private produceTimerId: ReturnType<typeof setTimeout> | null = null;
  private batchSize = 1;
  /** When true, background-produced entries skip pipeline assembly (full-mode autoplay). */
  skipPipeline = false;

  /** Called when buffer transitions from empty to non-empty */
  onBufferReady: (() => void) | null = null;

  constructor(config: AlgorithmConfig, maxSize = 18) {
    this.runner = new AlgorithmRunner(config);
    this.maxSize = maxSize;
  }

  /** Start the background producer loop */
  startProducing(): void {
    if (this.producing) return;
    this.producing = true;
    this.scheduleProduction();
  }

  /** Stop the producer loop */
  stopProducing(): void {
    this.producing = false;
    if (this.produceTimerId !== null) {
      clearTimeout(this.produceTimerId);
      this.produceTimerId = null;
    }
  }

  /** Set how many generations to compute per tick (for high speeds) */
  setBatchSize(size: number): void {
    this.batchSize = Math.max(1, Math.min(size, 20));
  }

  /** Number of unconsumed entries ready for animation */
  get available(): number {
    return this.buffer.length;
  }

  /** Total generations that have been consumed by the animation */
  get consumedCount(): number {
    return this.consumedSummaries.length;
  }

  /** Total generations computed (consumed + buffered) */
  get totalComputed(): number {
    return this.consumedSummaries.length + this.buffer.length;
  }

  /** Has the algorithm found a solution? */
  get solved(): boolean {
    return this.runner.solved;
  }

  /** Cumulative stats from the runner */
  get cumulativeStats(): Readonly<CumulativeStatistics> {
    return this.runner.cumulativeStats;
  }

  /** Peek at an entry by offset from the consume position (0 = next to consume) */
  peek(offset: number): BufferEntry | undefined {
    return this.buffer[offset];
  }

  /** Consume the next entry (animation crossed a generation boundary) */
  consume(): BufferEntry | undefined {
    const entry = this.buffer.shift();
    if (entry) {
      this.consumedSummaries.push(entry.summary);
      // Resume production if we fell below max
      if (this.producing && this.buffer.length < this.maxSize) {
        this.scheduleProduction();
      }
    }
    return entry;
  }

  /** Get all summaries (consumed + buffered) for chart data / API sync */
  getAllSummaries(): GenerationSummary[] {
    return [
      ...this.consumedSummaries,
      ...this.buffer.map(e => e.summary),
    ];
  }

  /** Get only consumed summaries (what the animation has passed through) */
  getConsumedSummaries(): GenerationSummary[] {
    return [...this.consumedSummaries];
  }

  /**
   * Prefill the buffer with entries (e.g. from redo stack) before producing new ones.
   * These will be consumed before any freshly computed generations.
   */
  prefill(entries: BufferEntry[]): void {
    this.buffer.unshift(...entries);
  }

  /**
   * Compute N generations immediately (synchronous, for stepN).
   * Does NOT go through the buffer — returns results directly.
   * Updates internal runner state.
   */
  computeImmediate(count: number): MultiStepResult | null {
    return this.runner.runGenerations(count);
  }

  /**
   * Compute a single generation immediately (synchronous, for manual step).
   * Does NOT go through the buffer.
   */
  computeOne(): { result: GenerationResult; summary: GenerationSummary } | null {
    const result = this.runner.runGeneration();
    if (!result) return null;
    return {
      result,
      summary: AlgorithmRunner.toSummary(result),
    };
  }

  /** Returns the gen-0 result (initial random population, no breeding yet) */
  getInitialResult(): GenerationResult {
    return this.runner.getInitialResult();
  }

  /** Resize the gen-0 population in place (seeded, deterministic). */
  resizePopulation(newSize: number): void {
    this.runner.resizePopulation(newSize);
  }

  /** Reset with a new config */
  reset(config: AlgorithmConfig): void {
    this.stopProducing();
    this.runner = new AlgorithmRunner(config);
    this.buffer = [];
    this.consumedSummaries = [];
  }

  /** Trim consumed summaries to a given length (for undo/back) */
  trimConsumedTo(length: number): void {
    this.consumedSummaries = this.consumedSummaries.slice(0, length);
  }

  /** Clear the lookahead buffer (for undo, keeps consumed intact) */
  clearBuffer(): void {
    this.buffer = [];
  }

  private scheduleProduction(): void {
    if (this.produceTimerId !== null) return;
    if (!this.producing) return;

    this.produceTimerId = setTimeout(() => {
      this.produceTimerId = null;
      if (!this.producing) return;

      const wasEmpty = this.buffer.length === 0;

      for (let i = 0; i < this.batchSize; i++) {
        if (this.buffer.length >= this.maxSize) break;
        if (this.runner.solved) {
          this.producing = false;
          break;
        }

        const result = this.runner.runGeneration(this.skipPipeline);
        if (!result) {
          this.producing = false;
          break;
        }

        this.buffer.push({
          result,
          summary: AlgorithmRunner.toSummary(result),
        });
      }

      if (wasEmpty && this.buffer.length > 0 && this.onBufferReady) {
        this.onBufferReady();
      }

      // Schedule next tick if still producing and not full
      if (this.producing && this.buffer.length < this.maxSize) {
        this.scheduleProduction();
      }
    }, 0);
  }
}
