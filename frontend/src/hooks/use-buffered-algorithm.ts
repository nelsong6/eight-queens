import { useState, useCallback, useRef, useEffect } from 'react';
import type {
  AlgorithmConfig,
  CumulativeStatistics,
  GenerationResult,
  GenerationSummary,
  Individual,
} from '../engine/types';
import { AlgorithmRunner } from '../engine/algorithm-runner';
import { GenerationBuffer, type BufferEntry } from '../engine/generation-buffer';
import { AnimationClock } from '../engine/animation-clock';
import { isPipelineEmpty, reconstructPipeline } from '../engine/time-coordinate';

interface HistorySnapshot {
  result: GenerationResult;
  summariesLength: number;
  cumulativeStats: CumulativeStatistics;
}

const MAX_UNDO = 50;

export function useBufferedAlgorithm() {
  const bufferRef = useRef<GenerationBuffer | null>(null);
  const clockRef = useRef<AnimationClock | null>(null);
  const undoStackRef = useRef<HistorySnapshot[]>([]);
  const redoStackRef = useRef<HistorySnapshot[]>([]);
  const allSummariesRef = useRef<GenerationSummary[]>([]);
  const chartPlayheadRef = useRef(-1);
  const lookaheadSummaryRef = useRef<GenerationSummary | null>(null);

  // React state — same interface as useAlgorithm
  const [running, setRunning] = useState(false);
  const [speed, setSpeedState] = useState(1);
  const [generation, setGeneration] = useState(0);
  const [bestFitness, setBestFitness] = useState(0);
  const [avgFitness, setAvgFitness] = useState(0);
  const [bestIndividual, setBestIndividual] = useState<Individual | null>(null);
  const [solved, setSolved] = useState(false);
  const [solutionIndividual, setSolutionIndividual] = useState<Individual | null>(null);
  const [generationSummaries, setGenerationSummaries] = useState<GenerationSummary[]>([]);
  const [lastResult, setLastResult] = useState<GenerationResult | null>(null);
  const [algorithmConfig, setAlgorithmConfig] = useState<AlgorithmConfig | null>(null);
  const [cumulativeStats, setCumulativeStats] = useState<CumulativeStatistics | null>(null);
  const [canGoBack, setCanGoBack] = useState(false);

  // Apply a GenerationResult to React state
  const applyResult = useCallback((result: GenerationResult, stats: CumulativeStatistics) => {
    setGeneration(result.generationNumber);
    setBestFitness(result.bestFitness);
    setAvgFitness(result.avgFitness);
    setBestIndividual(result.bestIndividual);
    setSolved(result.solved);
    setLastResult(result);
    setCumulativeStats({ ...stats });

    if (result.solved && result.solutionIndividual) {
      setSolutionIndividual(result.solutionIndividual);
    }
  }, []);

  // Snapshot current state for undo stack
  const takeSnapshot = useCallback((): HistorySnapshot | null => {
    const result = lastResult;
    if (!result) return null;
    const stats = cumulativeStats ?? {
      totalEligibleParents: 0,
      avgFitnessIncrease: 0,
      totalActualParents: 0,
      totalChildren: 0,
      totalMutations: 0,
      iterationCount: 0,
    };
    return {
      result,
      summariesLength: allSummariesRef.current.length,
      cumulativeStats: { ...stats },
    };
  }, [lastResult, cumulativeStats]);

  // Push to undo stack with cap
  const pushUndo = useCallback((snapshot: HistorySnapshot) => {
    const stack = undoStackRef.current;
    stack.push(snapshot);
    if (stack.length > MAX_UNDO) {
      stack.shift();
    }
    setCanGoBack(true);
  }, []);

  // Update canGoBack state
  const updateCanGoBack = useCallback(() => {
    setCanGoBack(undoStackRef.current.length > 0);
  }, []);

  // ---- Actions ----

  const start = useCallback((config: AlgorithmConfig) => {
    // Tear down old
    if (clockRef.current) clockRef.current.reset();
    if (bufferRef.current) bufferRef.current.stopProducing();

    // Create new
    const buffer = new GenerationBuffer(config);
    const clock = new AnimationClock();
    clock.setSpeed(speed);

    bufferRef.current = buffer;
    clockRef.current = clock;
    undoStackRef.current = [];
    redoStackRef.current = [];
    allSummariesRef.current = [];
    chartPlayheadRef.current = -1;
    lookaheadSummaryRef.current = null;

    // Populate gen-0 state from initial random population
    const initialResult = buffer.getInitialResult();
    setRunning(false);
    setGeneration(0);
    setBestFitness(initialResult.bestFitness);
    setAvgFitness(initialResult.avgFitness);
    setBestIndividual(initialResult.bestIndividual);
    setSolved(false);
    setSolutionIndividual(null);
    setGenerationSummaries([]);
    setLastResult(initialResult);
    setAlgorithmConfig(config);
    setCumulativeStats(null);
    setCanGoBack(false);
  }, [speed]);

  // Finish any in-progress step sweep immediately (committing deferred state)
  const finishPendingSweep = useCallback(() => {
    const clock = clockRef.current;
    if (clock) clock.finishSweepImmediate();
  }, []);

  const resume = useCallback((stepsPerTick = 1, skipPipeline = false) => {
    const buffer = bufferRef.current;
    const clock = clockRef.current;
    if (!buffer || !clock || solved) return;

    buffer.skipPipeline = skipPipeline;

    // Finish any pending step animation before resuming
    finishPendingSweep();

    // If there are redo entries, prefill the buffer so animation replays them
    const redo = redoStackRef.current;
    if (redo.length > 0) {
      const redoEntries: BufferEntry[] = redo.map(snap => ({
        result: snap.result,
        summary: AlgorithmRunner.toSummary(snap.result),
      }));
      buffer.prefill(redoEntries);
      redoStackRef.current = [];
    }

    // Speed multiplier: consume 1 entry per boundary but cross boundaries N× faster
    clock.speedMultiplier = stepsPerTick;

    // Wire up callbacks
    clock.onBoundary = () => {
      const entry = buffer.consume();
      if (!entry) return;

      allSummariesRef.current = [...allSummariesRef.current, entry.summary];
      pushUndo({
        result: entry.result,
        summariesLength: allSummariesRef.current.length,
        cumulativeStats: { ...buffer.cumulativeStats },
      });

      setGenerationSummaries([...allSummariesRef.current]);
      applyResult(entry.result, buffer.cumulativeStats);

      if (entry.result.solved) {
        clock.stop();
        buffer.stopProducing();
        setRunning(false);
      }
    };

    clock.onTick = (playhead) => {
      chartPlayheadRef.current = playhead;
      // Update maxPlayhead so clock knows how far it can go
      // Use allSummariesRef (actual chart data) instead of buffer.consumedCount
      // since manual steps bypass the buffer's consume tracking
      clock.maxPlayhead = allSummariesRef.current.length + buffer.available;
      // Expose the next buffer entry's summary for chart lookahead interpolation
      lookaheadSummaryRef.current = buffer.peek(0)?.summary ?? null;
    };

    // Start producing and animating
    buffer.setBatchSize(Math.max(stepsPerTick, Math.ceil(speed / 100)));
    buffer.startProducing();

    // Set initial maxPlayhead
    clock.maxPlayhead = allSummariesRef.current.length + buffer.available;

    clock.start();
    setRunning(true);
  }, [solved, speed, applyResult, pushUndo, finishPendingSweep]);

  const pause = useCallback(() => {
    const clock = clockRef.current;
    const buffer = bufferRef.current;

    // Handle any pending sweep first (from stepOnce/stepN)
    finishPendingSweep();

    // Restore full pipeline capture so any post-pause steps have complete data
    if (buffer) buffer.skipPipeline = false;

    // If still running with a fractional playhead, let the chart animate
    // to the next whole generation before stopping
    if (clock && clock.running) {
      clock.stopAtNextBoundary();
      if (buffer) buffer.stopProducing();
      setRunning(false);
      return;
    }

    if (clock) clock.stop();
    if (buffer) buffer.stopProducing();
    setRunning(false);
  }, [finishPendingSweep]);

  const stepOnce = useCallback((): GenerationResult | null => {
    const buffer = bufferRef.current;
    if (!buffer) return null;

    // Finish any in-progress step animation first
    finishPendingSweep();

    // Pause if running
    if (clockRef.current?.running) {
      clockRef.current.stop();
      buffer.stopProducing();
      setRunning(false);
    }

    // Snapshot current state for undo (if we have a current state)
    const snapshot = takeSnapshot();
    if (snapshot) {
      pushUndo(snapshot);
    }

    let result: GenerationResult;
    let summary: GenerationSummary;
    let stats: CumulativeStatistics;

    // Check redo stack first
    const redo = redoStackRef.current;
    if (redo.length > 0) {
      const redoEntry = redo.shift()!;
      result = redoEntry.result;
      summary = AlgorithmRunner.toSummary(result);
      stats = redoEntry.cumulativeStats;
    } else {
      // Clear redo when computing fresh (shouldn't have redo here, but safety)
      redoStackRef.current = [];

      // Compute one generation synchronously
      const computed = buffer.computeOne();
      if (!computed) return null;
      result = computed.result;
      summary = computed.summary;
      stats = { ...buffer.cumulativeStats };
    }

    // Animate the chart with a sweep instead of snapping
    const clock = clockRef.current;
    const isFirstStep = allSummariesRef.current.length === 0;

    if (!isFirstStep && clock) {
      // Subsequent steps: sweep playhead with ease-in-out
      lookaheadSummaryRef.current = summary;

      const fromPlayhead = chartPlayheadRef.current;
      const targetPlayhead = fromPlayhead + 1;

      // Apply result immediately so board/UI update in sync
      applyResult(result, stats);

      clock.maxPlayhead = targetPlayhead;
      clock.onTick = (playhead) => {
        chartPlayheadRef.current = playhead;
      };
      clock.onBoundary = null;
      clock.onSweepComplete = () => {
        // Commit chart data when animation reaches the integer boundary
        allSummariesRef.current = [...allSummariesRef.current, summary];
        setGenerationSummaries([...allSummariesRef.current]);
        chartPlayheadRef.current = targetPlayhead;
        lookaheadSummaryRef.current = null;
        clock.setPlayhead(targetPlayhead);
        clock.onSweepComplete = null;
      };
      clock.startSweep(targetPlayhead, 300, 'ease-in-out');
    } else {
      // First step (or no clock): snap immediately, chart fade-in handles the reveal
      allSummariesRef.current = [...allSummariesRef.current, summary];
      setGenerationSummaries([...allSummariesRef.current]);
      chartPlayheadRef.current = allSummariesRef.current.length - 1;
      lookaheadSummaryRef.current = null;
      if (clock) clock.setPlayhead(chartPlayheadRef.current);
      applyResult(result, stats);
    }

    updateCanGoBack();

    return result;
  }, [takeSnapshot, pushUndo, applyResult, updateCanGoBack, finishPendingSweep]);

  const stepN = useCallback((count: number) => {
    const buffer = bufferRef.current;
    const clock = clockRef.current;
    if (!buffer) return;

    // Finish any pending step animation first
    finishPendingSweep();

    // Pause if running
    if (clock?.running) {
      clock.stop();
      buffer.stopProducing();
      setRunning(false);
    }

    // Snapshot current state for undo (one entry for the whole batch)
    const snapshot = takeSnapshot();
    if (snapshot) {
      pushUndo(snapshot);
    }

    // Clear redo stack — stepping N computes fresh
    redoStackRef.current = [];

    // Clear any buffered lookahead (we're jumping ahead)
    buffer.clearBuffer();

    // Compute all N synchronously
    const multi = buffer.computeImmediate(count);
    if (!multi) return;

    const { finalResult, summaries } = multi;

    // Add all summaries
    allSummariesRef.current = [...allSummariesRef.current, ...summaries];
    setGenerationSummaries([...allSummariesRef.current]);

    // Snap UI state to final result
    applyResult(finalResult, buffer.cumulativeStats);

    // Start fast-sweep animation on the chart
    const targetPlayhead = allSummariesRef.current.length - 1;

    if (clock) {
      clock.maxPlayhead = targetPlayhead;
      clock.onTick = (playhead) => {
        chartPlayheadRef.current = playhead;
      };
      clock.onBoundary = null; // state already set
      clock.onSweepComplete = () => {
        chartPlayheadRef.current = targetPlayhead;
        clock.onSweepComplete = null;
      };
      clock.startSweep(targetPlayhead, Math.min(800, Math.max(400, count * 6)));
    } else {
      chartPlayheadRef.current = targetPlayhead;
    }

    updateCanGoBack();
  }, [takeSnapshot, pushUndo, applyResult, updateCanGoBack, finishPendingSweep]);

  const goBack = useCallback((): { result: GenerationResult; previousResult: GenerationResult | null } | null => {
    // Finish any pending step animation first
    finishPendingSweep();

    const undoStack = undoStackRef.current;
    if (undoStack.length === 0) return null;

    // Prepend current state to redo (so redo stays in forward-chronological order)
    const currentSnapshot = takeSnapshot();
    if (currentSnapshot) {
      redoStackRef.current.unshift(currentSnapshot);
    }

    // Pop undo
    const prev = undoStack.pop()!;

    // Restore state
    applyResult(prev.result, prev.cumulativeStats);

    // Trim summaries
    allSummariesRef.current = allSummariesRef.current.slice(0, prev.summariesLength);
    setGenerationSummaries([...allSummariesRef.current]);

    // Snap playhead
    const newPlayhead = Math.max(0, prev.summariesLength - 1);
    chartPlayheadRef.current = newPlayhead;
    lookaheadSummaryRef.current = null;
    if (clockRef.current) {
      clockRef.current.setPlayhead(newPlayhead);
    }

    // Trim buffer's consumed summaries too
    if (bufferRef.current) {
      bufferRef.current.trimConsumedTo(prev.summariesLength);
      bufferRef.current.clearBuffer();
    }

    updateCanGoBack();
    // Return restored result and the result below it (for previousResult in walkthrough)
    const belowResult = undoStack.length > 0 ? undoStack[undoStack.length - 1]!.result : null;

    // Lazily reconstruct pipeline from breedingData if this entry was produced
    // during full-mode autoplay (skipPipeline=true) and has an empty pipeline stub.
    let restoredResult = prev.result;
    if (isPipelineEmpty(restoredResult)) {
      restoredResult = { ...restoredResult, pipeline: reconstructPipeline(restoredResult, belowResult) };
    }

    return { result: restoredResult, previousResult: belowResult };
  }, [takeSnapshot, applyResult, updateCanGoBack, finishPendingSweep]);

  const resizePopulation = useCallback((newSize: number) => {
    const buffer = bufferRef.current;
    if (!buffer) return;
    buffer.resizePopulation(newSize);
    const initialResult = buffer.getInitialResult();
    setBestFitness(initialResult.bestFitness);
    setAvgFitness(initialResult.avgFitness);
    setBestIndividual(initialResult.bestIndividual);
    setLastResult(initialResult);
  }, []);

  const reset = useCallback(() => {
    if (clockRef.current) clockRef.current.reset();
    if (bufferRef.current) bufferRef.current.stopProducing();

    bufferRef.current = null;
    clockRef.current = null;
    undoStackRef.current = [];
    redoStackRef.current = [];
    allSummariesRef.current = [];
    chartPlayheadRef.current = -1;
    lookaheadSummaryRef.current = null;

    setRunning(false);
    setSpeedState(1);
    setGeneration(0);
    setBestFitness(0);
    setAvgFitness(0);
    setBestIndividual(null);
    setSolved(false);
    setSolutionIndividual(null);
    setGenerationSummaries([]);
    setLastResult(null);
    setAlgorithmConfig(null);
    setCumulativeStats(null);
    setCanGoBack(false);
  }, []);

  /** Peek at the top of the undo stack without popping. Used for pipeline reconstruction. */
  const peekUndoResult = useCallback((): GenerationResult | null => {
    const stack = undoStackRef.current;
    return stack.length > 0 ? stack[stack.length - 1]!.result : null;
  }, []);

  const handleSpeedChange = useCallback((newSpeed: number) => {
    setSpeedState(newSpeed);
    if (clockRef.current) {
      clockRef.current.setSpeed(newSpeed);
    }
    if (bufferRef.current) {
      bufferRef.current.setBatchSize(Math.ceil(newSpeed / 100));
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (clockRef.current) clockRef.current.reset();
      if (bufferRef.current) bufferRef.current.stopProducing();
    };
  }, []);

  return {
    running,
    speed,
    setSpeed: handleSpeedChange,
    generation,
    bestFitness,
    avgFitness,
    bestIndividual,
    solved,
    solutionIndividual,
    generationSummaries,
    lastResult,
    algorithmConfig,
    cumulativeStats,
    start,
    resume,
    pause,
    step: stepOnce,
    stepN,
    reset,
    resizePopulation,
    goBack,
    canGoBack,
    peekUndoResult,
    chartPlayheadRef,
    allSummariesRef,
    lookaheadSummaryRef,
  };
}
