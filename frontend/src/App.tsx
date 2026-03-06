import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useBufferedAlgorithm } from './hooks/use-buffered-algorithm';
import { Chessboard } from './components/Chessboard';
import { ConfigPanel } from './components/ConfigPanel';
import { Controls } from './components/Controls';
import { BreedingListboxes, type CategoryKey } from './components/BreedingListboxes';

import { GenerationChart } from './components/GenerationChart';
import { HelpBar } from './components/HelpBar';
import { BreadcrumbTrail } from './components/BreadcrumbTrail';
import { DrillDownTransition } from './components/DrillDownTransition';
import { ZoomablePanel, type ExpandedRect } from './components/ZoomablePanel';
import { SpecimenPanel } from './components/SpecimenPanel';
import { SelectionPhase } from './components/walkthrough/SelectionPhase';
import { CrossoverPhase } from './components/walkthrough/CrossoverPhase';
import { MutationPhase } from './components/walkthrough/MutationPhase';
import { ResultsPhase } from './components/walkthrough/ResultsPhase';
import type { AlgorithmConfig, Individual, GenerationResult } from './engine/types';
import { createRandomIndividual } from './engine/individual';
import { PRESETS } from './data/presets';

type SessionPhase = 'config' | 'running' | 'review';

interface WalkthroughState {
  phase: number;
  result: GenerationResult;
  browsePairIndex: number;
}

const App: React.FC = () => {
  const algorithm = useBufferedAlgorithm();

  // Session lifecycle
  const [sessionPhase, setSessionPhase] = useState<SessionPhase>('config');

  // Walkthrough state
  const [walkthroughState, setWalkthroughState] = useState<WalkthroughState | null>(null);

  // Step granularity (applies to manual step only; auto-play always uses full step)
  const [granularity, setGranularity] = useState<'full' | 'micro'>('full');

  const handleGranularityChange = useCallback((g: 'full' | 'micro') => {
    setGranularity(g);
    if (g === 'full') {
      setWalkthroughState(null);
    }
  }, []);

  // Pending config from ConfigPanel (used for auto-start on first action)
  const [pendingConfig, setPendingConfig] = useState<AlgorithmConfig>({
    populationSize: 100,
    crossoverRange: [1, 6],
    mutationRate: 0.25,
  });
  const pendingConfigRef = useRef(pendingConfig);
  pendingConfigRef.current = pendingConfig;

  const handleConfigChange = useCallback((config: AlgorithmConfig) => {
    setPendingConfig(config);
  }, []);

  // Zoom state
  const [zoomedPanel, setZoomedPanel] = useState<string | null>(null);
  const [breedingCategory, setBreedingCategory] = useState<CategoryKey>('Eligible parents');
  const mainRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && zoomedPanel) {
        setZoomedPanel(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [zoomedPanel]);

  // Lock background scroll when a panel is zoomed
  useEffect(() => {
    if (zoomedPanel) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [zoomedPanel]);

  // Eagerly start the algorithm during config phase so gen-0 data is visible.
  // When only population size changes, resize in place (same seed, stable board).
  // For other config changes (or first start), do a full restart with a new seed.
  const algorithmStart = algorithm.start;
  const algorithmResize = algorithm.resizePopulation;
  const activeConfigRef = useRef<AlgorithmConfig | null>(null);
  useLayoutEffect(() => {
    if (sessionPhase !== 'config') return;
    const prev = activeConfigRef.current;
    // Skip if config hasn't changed (e.g. after a reset that already called start)
    if (
      prev &&
      prev.crossoverRange[0] === pendingConfig.crossoverRange[0] &&
      prev.crossoverRange[1] === pendingConfig.crossoverRange[1] &&
      prev.mutationRate === pendingConfig.mutationRate &&
      prev.populationSize === pendingConfig.populationSize
    ) {
      return;
    }
    if (
      prev &&
      prev.crossoverRange[0] === pendingConfig.crossoverRange[0] &&
      prev.crossoverRange[1] === pendingConfig.crossoverRange[1] &&
      prev.mutationRate === pendingConfig.mutationRate &&
      prev.populationSize !== pendingConfig.populationSize
    ) {
      algorithmResize(pendingConfig.populationSize);
      activeConfigRef.current = { ...pendingConfig };
    } else {
      algorithmStart(pendingConfig);
      activeConfigRef.current = { ...pendingConfig };
    }
  }, [pendingConfig, sessionPhase, algorithmStart, algorithmResize]);

  // Key to force remount of child components on reset
  const [resetKey, setResetKey] = useState(0);

  // Random individual shown before algorithm starts
  const [initialIndividual, setInitialIndividual] = useState<Individual>(() => createRandomIndividual(Math.floor(Math.random() * 50)));

  // Viewed individual state (for click-to-view from breeding listboxes)
  const [viewedIndividual, setViewedIndividual] = useState<Individual | null>(null);
  const [viewedSource, setViewedSource] = useState<string>('');

  const handleSelectIndividual = useCallback((individual: Individual, source: string) => {
    setViewedIndividual(individual);
    setViewedSource(source);
  }, []);

  // Clear viewed individual when generation advances
  useEffect(() => {
    setViewedIndividual(null);
    setViewedSource('');
  }, [algorithm.generation]);

  const handleStart = useCallback(
    (config: AlgorithmConfig) => {
      algorithm.start(config);
      setSessionPhase('running');
      setWalkthroughState(null);
    },
    [algorithm],
  );

  /** Auto-start the algorithm if still in config phase. */
  const ensureStarted = useCallback(() => {
    if (sessionPhase === 'config') {
      handleStart(pendingConfigRef.current);
    }
  }, [sessionPhase, handleStart]);

  const handleReset = useCallback(() => {
    // Start a fresh algorithm immediately so lastResult is never null (avoids flicker)
    algorithm.start(pendingConfigRef.current);
    activeConfigRef.current = { ...pendingConfigRef.current };
    setViewedIndividual(null);
    setViewedSource('');
    setSessionPhase('config');
    setWalkthroughState(null);
    setGranularity('full');
    setZoomedPanel(null);
    setBreedingCategory('Eligible parents');
    setInitialIndividual(createRandomIndividual(Math.floor(Math.random() * 50)));
    setResetKey((k) => k + 1);
  }, [algorithm]);

  const handleNewSession = useCallback(() => {
    handleReset();
  }, [handleReset]);

  // Walkthrough phases (0-indexed internally, shown as 1-4 in UI):
  //   0 = Selection  (Step 1/4) – picks parents via roulette wheel
  //   1 = Crossover   (Step 2/4) – single-point crossover produces children
  //   2 = Mutation    (Step 3/4) – random gene mutations on children
  //   3 = Results     (Step 4/4) – generation summary, best fitness
  // After phase 3, a new generation runs and we loop back to phase 0.
  const handleWalkThrough = useCallback(() => {
    ensureStarted();
    if (!walkthroughState) {
      // First entry: run a generation and start at phase 0 (Selection)
      const result = algorithm.step();
      if (result) {
        setWalkthroughState({ phase: 0, result, browsePairIndex: 0 });
      }
    } else if (walkthroughState.phase < 3) {
      // Advance to next phase within the current generation
      setWalkthroughState({ ...walkthroughState, phase: walkthroughState.phase + 1 });
    } else {
      // Phase 3 done → run next generation and loop back to phase 0
      const result = algorithm.step();
      if (result) {
        setWalkthroughState({ phase: 0, result, browsePairIndex: 0 });
      }
    }
  }, [walkthroughState, algorithm, ensureStarted]);

  const handleWalkthroughPairChange = useCallback((index: number) => {
    if (walkthroughState) {
      setWalkthroughState({ ...walkthroughState, browsePairIndex: index });
    }
  }, [walkthroughState]);

  const handlePlay = useCallback((stepCount: number) => {
    ensureStarted();
    setGranularity('full');
    setWalkthroughState(null);
    algorithm.resume(stepCount);
  }, [ensureStarted, algorithm]);

  const handleStep = useCallback(() => {
    ensureStarted();
    algorithm.step();
  }, [ensureStarted, algorithm]);

  const handleStepN = useCallback((count: number) => {
    ensureStarted();
    algorithm.stepN(count);
  }, [ensureStarted, algorithm]);

  const handlePause = useCallback(() => {
    algorithm.pause();
  }, [algorithm]);

  const handleBack = useCallback(() => {
    if (granularity === 'micro' && walkthroughState) {
      if (walkthroughState.phase > 0) {
        // Go back one micro phase within the same generation
        setWalkthroughState({ ...walkthroughState, phase: walkthroughState.phase - 1 });
        return;
      }
      // At phase 0: go back a full generation, land on phase 3
      const restoredResult = algorithm.goBack();
      if (restoredResult) {
        setWalkthroughState({ phase: 3, result: restoredResult, browsePairIndex: 0 });
      } else {
        setWalkthroughState(null);
      }
      return;
    }
    algorithm.goBack();
  }, [granularity, walkthroughState, algorithm]);

  const handleClearWalkthrough = useCallback(() => {
    setWalkthroughState(null);
  }, []);

  const handleClearZoom = useCallback(() => {
    setZoomedPanel(null);
  }, []);

  // Companion layout: when breeding is zoomed, overlay the board as a small inset
  const companionLayout = useMemo(() => {
    if (zoomedPanel !== 'breeding' || !mainRef.current) return null;
    const c = mainRef.current.getBoundingClientRect();
    const cs = window.getComputedStyle(mainRef.current);
    const pt = parseFloat(cs.paddingTop);
    const pl = parseFloat(cs.paddingLeft);
    const availH = window.innerHeight - c.top - pt;
    const size = Math.min(availH * 0.45, 220);

    return {
      boardRect: {
        top: window.innerHeight - size - 12,
        left: c.left + pl + 12,
        width: size,
        height: size,
      } as ExpandedRect,
    };
  }, [zoomedPanel]); // eslint-disable-line react-hooks/exhaustive-deps

  // Transition to review phase when solved
  useEffect(() => {
    if (algorithm.solved) {
      setSessionPhase('review');
      setWalkthroughState(null);
    }
  }, [algorithm.solved]);

  const hasStarted = algorithm.generation > 0 || algorithm.bestIndividual !== null;

  // Display logic: viewed individual takes priority, fall back to initial random
  const displayIndividual = viewedIndividual ?? algorithm.solutionIndividual ?? algorithm.bestIndividual ?? initialIndividual;
  const displayLabel = viewedIndividual
    ? `Viewing: ${viewedSource}`
    : algorithm.solved
      ? 'Solution Found!'
      : hasStarted
        ? 'Best Individual'
        : 'Random Placement';

  // Status message matching C# behavior
  const statusMessage = useMemo<{ label: string; value: string }>(() => {
    if (viewedIndividual) {
      return { label: viewedSource ?? 'Individual', value: `f:${viewedIndividual.fitness}/28` };
    }
    if (algorithm.solved && algorithm.solutionIndividual) {
      const sol = algorithm.solutionIndividual.solution.join(' ');
      return { label: 'Solution', value: `[${sol}]` };
    }
    if (algorithm.lastResult) {
      const best = algorithm.lastResult.bestIndividual;
      const sol = best.solution.join(' ');
      return { label: 'Best specimen', value: `[${sol}]` };
    }
    return { label: 'Best specimen', value: '' };
  }, [viewedIndividual, viewedSource, algorithm.solved, algorithm.solutionIndividual, algorithm.lastResult, algorithm.generation]);

  return (
    <div style={styles.app}>
      {/* Sticky top bar: header + help tooltip */}
      <div style={styles.stickyTop}>
        <header style={styles.header}>
          <div style={styles.headerLeft}>
            <div style={styles.titleRow}>
              <h1 style={styles.title} data-help="Place 8 queens on a chessboard so none attack each other — solved by evolving random placements">Eight Queens: Genetic Algorithm</h1>
            </div>
            <p style={styles.subtitle} data-help="Uses selection, crossover, and mutation to breed better solutions each generation">
              Evolving a solution to the classic 8-queens puzzle
            </p>
          </div>
        </header>
        <HelpBar />
        <BreadcrumbTrail
          sessionPhase={sessionPhase}
          granularity={granularity}
          walkthroughPhase={walkthroughState?.phase ?? null}
          browsePairIndex={walkthroughState?.browsePairIndex ?? null}
          zoomedPanel={zoomedPanel}
          breedingCategory={breedingCategory}
          onSetGranularity={handleGranularityChange}
          onClearWalkthrough={handleClearWalkthrough}
          onClearZoom={handleClearZoom}
        />
        <Controls
          sessionPhase={sessionPhase}
          isRunning={algorithm.running}
          onPlay={handlePlay}
          onPause={handlePause}
          onStep={granularity === 'micro' ? handleWalkThrough : handleStep}
          onStepN={handleStepN}
          onBack={handleBack}
          canGoBack={
            granularity === 'micro' && walkthroughState
              ? walkthroughState.phase > 0 || algorithm.canGoBack
              : algorithm.canGoBack
          }
          onReset={handleReset}
          onNewSession={handleNewSession}
          speed={algorithm.speed}
          onSpeedChange={algorithm.setSpeed}
          solved={algorithm.solved}
          walkthroughPhase={walkthroughState?.phase ?? null}
          granularity={granularity}
          onGranularityChange={handleGranularityChange}
        />
      </div>

      {/* Backdrop overlay when a panel is zoomed */}
      {zoomedPanel && (
        <div
          style={styles.backdrop}
          onClick={() => setZoomedPanel(null)}
        />
      )}

      {/* Main content */}
      <div ref={mainRef} style={styles.main}>
        <div style={styles.columns}>
          {/* Column 1: Board + Specimen Inspector */}
          <div style={styles.column}>
            <ZoomablePanel id="board" zoomedId={zoomedPanel} onZoom={setZoomedPanel} containerRef={mainRef} companionRect={companionLayout?.boardRect}>
              <Chessboard
                individual={displayIndividual}
                label={displayLabel}
                showAttacks={hasStarted}
                speed={algorithm.running ? Math.max(1, 501 - algorithm.speed) : undefined}
                zoomed={zoomedPanel === 'board' || zoomedPanel === 'breeding'}
              />
              <SpecimenPanel
                individual={displayIndividual}
                breedingData={algorithm.lastResult?.breedingData ?? null}
                generation={algorithm.generation}
                onSelectIndividual={handleSelectIndividual}
              />
            </ZoomablePanel>
          </div>

          {/* Column 2: Config */}
          <div style={{ ...styles.column, flex: '0.7 1 0' }}>
            <ZoomablePanel id="config" zoomedId={zoomedPanel} onZoom={setZoomedPanel} containerRef={mainRef}>
              <ConfigPanel
                key={`config-${resetKey}`}
                onConfigChange={handleConfigChange}
                sessionPhase={sessionPhase}
                presets={PRESETS}
                algorithmConfig={algorithm.algorithmConfig ?? pendingConfig}
                stepStatistics={algorithm.lastResult?.stepStatistics ?? null}
                cumulativeStats={algorithm.cumulativeStats}
                generation={algorithm.generation}
                bestFitness={algorithm.bestFitness}
                avgFitness={algorithm.avgFitness}
                solved={algorithm.solved}
                statusMessage={statusMessage}
              />
            </ZoomablePanel>
          </div>

          {/* Column 3: Breeding */}
          <div style={styles.column}>
            <ZoomablePanel id="breeding" zoomedId={zoomedPanel} onZoom={setZoomedPanel} containerRef={mainRef}>
              <DrillDownTransition
                isActive={granularity === 'micro' && walkthroughState !== null}
                normalContent={
                  <BreedingListboxes
                    breedingData={algorithm.lastResult?.breedingData ?? null}
                    generation={algorithm.generation}
                    onSelectIndividual={handleSelectIndividual}
                    selectedCategory={breedingCategory}
                    onCategoryChange={setBreedingCategory}
                  />
                }
                drillDownContent={
                  walkthroughState ? (
                    walkthroughState.phase === 0 ? (
                      <SelectionPhase result={walkthroughState.result} />
                    ) : walkthroughState.phase === 1 ? (
                      <CrossoverPhase
                        result={walkthroughState.result}
                        pairIndex={walkthroughState.browsePairIndex}
                        onPairChange={handleWalkthroughPairChange}
                        onSelectIndividual={handleSelectIndividual}
                      />
                    ) : walkthroughState.phase === 2 ? (
                      <MutationPhase result={walkthroughState.result} />
                    ) : (
                      <ResultsPhase result={walkthroughState.result} />
                    )
                  ) : (
                    <SelectionPhase />
                  )
                }
              />
            </ZoomablePanel>
          </div>

          {/* Column 4: Chart */}
          <div style={styles.column}>
            <ZoomablePanel id="chart" zoomedId={zoomedPanel} onZoom={setZoomedPanel} containerRef={mainRef}>
              <GenerationChart summariesRef={algorithm.allSummariesRef} playheadRef={algorithm.chartPlayheadRef} lookaheadRef={algorithm.lookaheadSummaryRef} />
            </ZoomablePanel>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles: Record<string, React.CSSProperties> = {
  app: {
    height: '100vh',
    backgroundColor: '#0d0d1a',
    color: '#e0e0e0',
    fontFamily: "'Segoe UI', 'Roboto', monospace",
    padding: 0,
    margin: 0,
    display: 'flex',
    flexDirection: 'column' as const,
    overflow: 'hidden',
  },
  stickyTop: {
    flexShrink: 0,
    zIndex: 160,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 24px',
    backgroundColor: '#12122a',
    borderBottom: '1px solid #2a2a4a',
    flexWrap: 'wrap' as const,
    gap: 12,
  },
  headerLeft: {
    display: 'flex',
    flexDirection: 'column' as const,
  },
  titleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  title: {
    margin: 0,
    fontSize: 22,
    fontWeight: 'bold',
    color: '#e0e0e0',
    fontFamily: 'monospace',
    letterSpacing: -0.5,
  },
  subtitle: {
    margin: '4px 0 0 0',
    fontSize: 12,
    color: '#888',
    fontFamily: 'monospace',
  },
  backdrop: {
    position: 'fixed' as const,
    inset: 0,
    zIndex: 150,
    backgroundColor: 'transparent',
  },
  main: {
    display: 'flex',
    flexDirection: 'column' as const,
    padding: '12px 24px',
    maxWidth: 1800,
    margin: '0 auto',
    flex: 1,
    minHeight: 0,
    width: '100%',
    boxSizing: 'border-box' as const,
  },
  columns: {
    display: 'flex',
    gap: 12,
    alignItems: 'stretch',
    flex: 1,
    minHeight: 0,
  },
  column: {
    flex: '1 1 0',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 8,
    minWidth: 0,
    minHeight: 0,
  },
};
