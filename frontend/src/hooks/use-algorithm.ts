import { useState, useCallback, useRef } from 'react';
import type {
  AlgorithmConfig,
  CumulativeStatistics,
  GenerationResult,
  GenerationSummary,
  Specimen,
} from '../engine/types';
import { AlgorithmRunner } from '../engine/algorithm-runner';

export function useAlgorithm() {
  const runnerRef = useRef<AlgorithmRunner | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [running, setRunning] = useState(false);
  const [speed, setSpeed] = useState(1); // speed value (1-500); delay = 501 - speed
  const speedToDelay = (s: number) => Math.max(1, 501 - s);
  const [generation, setGeneration] = useState(0);
  const [bestFitness, setBestFitness] = useState(0);
  const [avgFitness, setAvgFitness] = useState(0);
  const [bestSpecimen, setBestSpecimen] = useState<Specimen | null>(null);
  const [solved, setSolved] = useState(false);
  const [solutionSpecimen, setSolutionSpecimen] = useState<Specimen | null>(null);
  const [generationSummaries, setGenerationSummaries] = useState<GenerationSummary[]>([]);
  const [lastResult, setLastResult] = useState<GenerationResult | null>(null);
  const [algorithmConfig, setAlgorithmConfig] = useState<AlgorithmConfig | null>(null);
  const [cumulativeStats, setCumulativeStats] = useState<CumulativeStatistics | null>(null);

  const applyResult = useCallback((result: GenerationResult) => {
    setGeneration(result.generationNumber);
    setBestFitness(result.bestFitness);
    setAvgFitness(result.avgFitness);
    setBestSpecimen(result.bestSpecimen);
    setSolved(result.solved);
    setLastResult(result);

    if (result.solved && result.solutionSpecimen) {
      setSolutionSpecimen(result.solutionSpecimen);
    }

    setGenerationSummaries((prev) => [
      ...prev,
      AlgorithmRunner.toSummary(result),
    ]);

    // Update cumulative stats from runner
    const runner = runnerRef.current;
    if (runner) {
      setCumulativeStats({ ...runner.cumulativeStats });
    }
  }, []);

  const stopInterval = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setRunning(false);
  }, []);

  const runOne = useCallback((): GenerationResult | null => {
    const runner = runnerRef.current;
    if (!runner) return null;

    const result = runner.runGeneration();
    if (!result) {
      stopInterval();
      return null;
    }

    applyResult(result);

    if (result.solved) {
      stopInterval();
    }
    return result;
  }, [applyResult, stopInterval]);

  const start = useCallback(
    (config: AlgorithmConfig) => {
      stopInterval();

      const runner = new AlgorithmRunner(config);
      runnerRef.current = runner;

      setGeneration(0);
      setBestFitness(0);
      setAvgFitness(0);
      setBestSpecimen(null);
      setSolved(false);
      setSolutionSpecimen(null);
      setGenerationSummaries([]);
      setLastResult(null);
      setAlgorithmConfig(config);
      setCumulativeStats(null);
    },
    [stopInterval],
  );

  const resume = useCallback(() => {
    if (!runnerRef.current || solved) return;
    stopInterval();
    setRunning(true);
    intervalRef.current = setInterval(runOne, speedToDelay(speed));
  }, [runOne, speed, stopInterval, solved]);

  const pause = useCallback(() => {
    stopInterval();
  }, [stopInterval]);

  const stepOnce = useCallback((): GenerationResult | null => {
    stopInterval();
    return runOne();
  }, [stopInterval, runOne]);

  const stepN = useCallback(
    (count: number) => {
      stopInterval();
      const runner = runnerRef.current;
      if (!runner) return;

      const multi = runner.runGenerations(count);
      if (!multi) return;

      // Apply final result for UI (breeding data, etc.)
      const { finalResult, summaries } = multi;
      setGeneration(finalResult.generationNumber);
      setBestFitness(finalResult.bestFitness);
      setAvgFitness(finalResult.avgFitness);
      setBestSpecimen(finalResult.bestSpecimen);
      setSolved(finalResult.solved);
      setLastResult(finalResult);

      if (finalResult.solved && finalResult.solutionSpecimen) {
        setSolutionSpecimen(finalResult.solutionSpecimen);
      }

      // Add all intermediate summaries to chart
      setGenerationSummaries((prev) => [...prev, ...summaries]);

      // Update cumulative stats
      setCumulativeStats({ ...runner.cumulativeStats });
    },
    [stopInterval],
  );

  const reset = useCallback(() => {
    stopInterval();
    runnerRef.current = null;
    setRunning(false);
    setSpeed(1);
    setGeneration(0);
    setBestFitness(0);
    setAvgFitness(0);
    setBestSpecimen(null);
    setSolved(false);
    setSolutionSpecimen(null);
    setGenerationSummaries([]);
    setLastResult(null);
    setAlgorithmConfig(null);
    setCumulativeStats(null);
  }, [stopInterval]);

  const handleSpeedChange = useCallback(
    (newSpeed: number) => {
      setSpeed(newSpeed);
      if (running && intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = setInterval(runOne, speedToDelay(newSpeed));
      }
    },
    [running, runOne],
  );

  return {
    running,
    speed,
    setSpeed: handleSpeedChange,
    generation,
    bestFitness,
    avgFitness,
    bestSpecimen,
    solved,
    solutionSpecimen,
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
  };
}
