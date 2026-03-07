import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useBufferedAlgorithm } from './hooks/use-buffered-algorithm';
import { Chessboard } from './components/Chessboard';
import { ConfigPanel } from './components/ConfigPanel';
import { Controls } from './components/Controls';
import type { CategoryKey } from './components/BreedingListboxes';

import { GenerationChart } from './components/GenerationChart';
import { HelpBar } from './components/HelpBar';
import { BreadcrumbTrail } from './components/BreadcrumbTrail';
import { ZoomablePanel } from './components/ZoomablePanel';
import { SpecimenPanel } from './components/SpecimenPanel';
import type { AlgorithmConfig, Individual, GenerationResult, PoolOrigin } from './engine/types';
import { poolDisplayName, OPS_PER_GENERATION, SCREENS_PER_OP, getOp, isPipelineEmpty, reconstructPipeline } from './engine/time-coordinate';
import { SubPhaseScreen } from './components/walkthrough/SubPhaseScreen';
import { createRandomIndividual } from './engine/individual';
import { PRESETS } from './data/presets';
import { colors } from './colors';

type SessionPhase = 'config' | 'running' | 'review';

interface WalkthroughState {
  operation: number;       // y-axis: 0–6
  boundary: 0 | 1 | 2;    // t-axis: before/transform/after
  result: GenerationResult;
  browsePairIndex: number;
}

const App: React.FC = () => {
  const algorithm = useBufferedAlgorithm();

  // Session lifecycle
  const [sessionPhase, setSessionPhase] = useState<SessionPhase>('config');

  // Walkthrough state
  const [walkthroughState, setWalkthroughState] = useState<WalkthroughState | null>(null);

  // Ensure a result has a populated pipeline before entering micro mode.
  // Results produced during full-mode autoplay have empty pipeline stubs;
  // reconstruct from breedingData (always computed) when needed.
  const withPipeline = useCallback((result: GenerationResult): GenerationResult => {
    if (!isPipelineEmpty(result)) return result;
    return { ...result, pipeline: reconstructPipeline(result, algorithm.peekUndoResult()) };
  }, [algorithm]);

  // Step granularity (applies to manual step only; auto-play always uses full step)
  const [granularity, setGranularity] = useState<'full' | 'micro'>('full');

  const handleStart = useCallback(
    (config: AlgorithmConfig) => {
      algorithm.start(config);
      setSessionPhase('running');
      setWalkthroughState(null);
    },
    [algorithm],
  );

  const handleGranularityChange = useCallback((g: 'full' | 'micro') => {
    setGranularity(g);
    if (g === 'full') {
      setWalkthroughState(null);
    } else if (g === 'micro') {
      const result = algorithm.lastResult;
      if (result) {
        // Stay at the end of the current generation (x.6.2) — matches the full-mode view
        setWalkthroughState({ operation: OPS_PER_GENERATION - 1, boundary: 2, result: withPipeline(result), browsePairIndex: 0 });
      }
    }
  }, [algorithm]);

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
  const boardColRef = useRef<HTMLDivElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);
  const [boardColCenter, setBoardColCenter] = useState<number | null>(null);

  useEffect(() => {
    const col = boardColRef.current;
    const bar = stickyRef.current;
    if (!col || !bar) return;
    const measure = () => {
      const colRect = col.getBoundingClientRect();
      const barRect = bar.getBoundingClientRect();
      setBoardColCenter(colRect.left + colRect.width / 2 - barRect.left);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(col);
    ro.observe(bar);
    return () => ro.disconnect();
  }, []);

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
  const [viewedOrigin, setViewedOrigin] = useState<PoolOrigin | null>(null);

  const handleSelectIndividual = useCallback((individual: Individual, origin: PoolOrigin) => {
    setViewedIndividual(individual);
    setViewedOrigin(origin);
  }, []);

  // Clear viewed individual when generation advances
  useEffect(() => {
    setViewedIndividual(null);
    setViewedOrigin(null);
  }, [algorithm.generation]);

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
    setViewedOrigin(null);
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

  // Walkthrough: 7 operations × 3 phases (before/transform/after) = 21 screens per generation.
  // Navigation: advance boundary 0→1→2, then operation+1 boundary 0.
  // After op 6 boundary 2, run next generation and start at op 0 boundary 0.
  const handleWalkThrough = useCallback(() => {
    ensureStarted();
    if (!walkthroughState) {
      // Show current state at end of current generation (x.6.2)
      const result = algorithm.lastResult;
      if (result) {
        setWalkthroughState({ operation: OPS_PER_GENERATION - 1, boundary: 2, result: withPipeline(result), browsePairIndex: 0 });
      }
    } else if (walkthroughState.boundary < 2) {
      setWalkthroughState({ ...walkthroughState, boundary: (walkthroughState.boundary + 1) as 0 | 1 | 2 });
    } else if (walkthroughState.operation < OPS_PER_GENERATION - 1) {
      setWalkthroughState({ ...walkthroughState, operation: walkthroughState.operation + 1, boundary: 0 });
    } else {
      // Op 7 boundary 2 done → run next generation, start at op 0 boundary 0
      const result = algorithm.step();
      if (result) {
        setWalkthroughState({ operation: 0, boundary: 0, result, browsePairIndex: 0 });
      }
    }
  }, [walkthroughState, algorithm, ensureStarted]);

  const handleWalkthroughPairChange = useCallback((index: number) => {
    if (walkthroughState) {
      setWalkthroughState({ ...walkthroughState, browsePairIndex: index });
    }
  }, [walkthroughState]);

  const handleWalkthroughNavigate = useCallback((operation: number, boundary: 0 | 1 | 2) => {
    // Clicking a specific sub-step should switch to micro mode
    if (granularity !== 'micro') {
      setGranularity('micro');
    }
    if (walkthroughState) {
      setWalkthroughState({ ...walkthroughState, operation, boundary, browsePairIndex: 0 });
    } else if (algorithm.lastResult) {
      // Full mode: create walkthrough state from current result
      setWalkthroughState({ operation, boundary, result: withPipeline(algorithm.lastResult), browsePairIndex: 0 });
    }
  }, [walkthroughState, algorithm, granularity]);

  const handlePlay = useCallback((stepCount: number) => {
    ensureStarted();
    setGranularity('full');
    setWalkthroughState(null);
    algorithm.resume(stepCount, /* skipPipeline */ true);
  }, [ensureStarted, algorithm]);

  const handleStep = useCallback(() => {
    ensureStarted();
    setWalkthroughState(null);
    algorithm.step();
  }, [ensureStarted, algorithm]);

  const handleStepN = useCallback((count: number) => {
    ensureStarted();
    setWalkthroughState(null);
    algorithm.stepN(count);
  }, [ensureStarted, algorithm]);

  const handlePause = useCallback(() => {
    algorithm.pause();
  }, [algorithm]);

  const handleBack = useCallback(() => {
    if (walkthroughState) {
      if (granularity === 'micro') {
        // Gen 0 seed connecting point (0.7.1) — going back returns to config
        if (walkthroughState.result.generationNumber === 0 && walkthroughState.operation === OPS_PER_GENERATION - 1 && walkthroughState.boundary === 2) {
          setWalkthroughState(null);
          handleReset();
          return;
        }
        if (walkthroughState.boundary > 0) {
          // Go back within same operation (after→transform, transform→before)
          setWalkthroughState({ ...walkthroughState, boundary: (walkthroughState.boundary - 1) as 0 | 1 | 2 });
          return;
        }
        if (walkthroughState.operation > 0) {
          // Go back to previous operation's "after" (boundary 2)
          setWalkthroughState({ ...walkthroughState, operation: walkthroughState.operation - 1, boundary: 2 });
          return;
        }
        // At op 0 boundary 0: go back a full generation
        const restored = algorithm.goBack();
        if (restored) {
          setWalkthroughState({ operation: OPS_PER_GENERATION - 1, boundary: 2, result: restored.result, browsePairIndex: 0 });
        } else {
          // At generation 0 with no undo history: return to config phase
          setWalkthroughState(null);
          handleReset();
        }
        return;
      }
      // Full mode with walkthrough (user clicked pipeline bar) — clear back to default view
      setWalkthroughState(null);
      return;
    }
    const restoredFull = algorithm.goBack();
    if (!restoredFull) {
      // At generation 0 with no undo history: return to config phase
      handleReset();
    }
  }, [granularity, walkthroughState, algorithm, handleReset]);

  const handleClearWalkthrough = useCallback(() => {
    setWalkthroughState(null);
  }, []);

  const handleClearZoom = useCallback(() => {
    setZoomedPanel(null);
  }, []);

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
  const displayIsBest = displayIndividual != null && algorithm.bestIndividual != null && displayIndividual.id === algorithm.bestIndividual.id;
  const displayIsSolution = displayIndividual != null && displayIndividual.fitness === 28;
  const displayOrigin: PoolOrigin | null = viewedOrigin
    ?? (hasStarted ? { coordinate: { generation: algorithm.generation, operation: OPS_PER_GENERATION - 1, boundary: 2 }, pool: 'finalChildren' as const } : null);

  // Status message matching C# behavior
  const statusMessage = useMemo<{ label: string; value: string; individual?: Individual; origin?: PoolOrigin }>(() => {
    if (viewedIndividual) {
      return { label: viewedOrigin ? poolDisplayName(viewedOrigin) : 'Individual', value: `f:${viewedIndividual.fitness}/28` };
    }
    const finalOrigin: PoolOrigin = { coordinate: { generation: algorithm.generation, operation: OPS_PER_GENERATION - 1, boundary: 2 }, pool: 'finalChildren' as const };
    if (algorithm.solved && algorithm.solutionIndividual) {
      const sol = algorithm.solutionIndividual.solution.join(' ');
      return { label: 'Solution', value: `[${sol}]`, individual: algorithm.solutionIndividual, origin: finalOrigin };
    }
    if (algorithm.lastResult) {
      const best = algorithm.lastResult.bestIndividual;
      const sol = best.solution.join(' ');
      return { label: 'Best specimen', value: `[${sol}]`, individual: best, origin: finalOrigin };
    }
    return { label: 'Best specimen', value: '' };
  }, [viewedIndividual, viewedOrigin, algorithm.solved, algorithm.solutionIndividual, algorithm.lastResult, algorithm.generation]);

  return (
    <div style={styles.app}>
      {/* Sticky top bar: header + help tooltip */}
      <div ref={stickyRef} style={styles.stickyTop}>
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
          walkthroughPhase={walkthroughState ? walkthroughState.operation * SCREENS_PER_OP + walkthroughState.boundary : null}
          browsePairIndex={walkthroughState?.browsePairIndex ?? null}
          zoomedPanel={zoomedPanel}
          breedingCategory={breedingCategory}
          onSetGranularity={handleGranularityChange}
          onClearWalkthrough={handleClearWalkthrough}
          onClearZoom={handleClearZoom}
        />
        <div style={styles.controlsWrapper}>
          <Controls
            sessionPhase={sessionPhase}
            isRunning={algorithm.running}
            onPlay={handlePlay}
            onPause={handlePause}
            onStep={granularity === 'micro' ? handleWalkThrough : handleStep}
            onStepN={handleStepN}
            onBack={handleBack}
            canGoBack={
              walkthroughState
                ? granularity === 'micro'
                  ? !(walkthroughState.result.generationNumber === 0 && walkthroughState.operation === OPS_PER_GENERATION - 1 && walkthroughState.boundary === 2)
                  : true
                : algorithm.canGoBack
            }
            onReset={handleReset}
            onNewSession={handleNewSession}
            speed={algorithm.speed}
            onSpeedChange={algorithm.setSpeed}
            solved={algorithm.solved}
            walkthroughPhase={walkthroughState ? walkthroughState.operation * SCREENS_PER_OP + walkthroughState.boundary : null}
            granularity={granularity}
            onGranularityChange={handleGranularityChange}
          />
          {boardColCenter != null && (() => {
            const coord = walkthroughState
              ? { generation: walkthroughState.result.generationNumber, operation: walkthroughState.operation, boundary: walkthroughState.boundary }
              : hasStarted
                ? { generation: algorithm.generation, operation: OPS_PER_GENERATION - 1, boundary: 2 as const }
                : { generation: 0, operation: OPS_PER_GENERATION - 1, boundary: 2 as const };
            const op = getOp(coord.operation);
            const boundaryLabel = coord.boundary === 0 ? 'BEFORE' : coord.boundary === 1 ? 'TRANSFORM' : 'AFTER';
            const boundaryValue = coord.boundary === 0 ? '0' : coord.boundary === 1 ? 't' : '1';
            return (
              <div style={{ ...styles.coordOverlay, left: boardColCenter }}>
                <div style={styles.coordSegment} data-help={`Generation ${coord.generation} — the current evolutionary cycle`}>
                  <span style={styles.coordDigit}>{coord.generation}</span>
                  <span style={styles.coordLabel}>Generation</span>
                </div>
                <span style={styles.coordDot}>.</span>
                <div style={styles.coordSegment} data-help={`Operation ${coord.operation} — "${op.name}" (${op.category})`}>
                  <span style={styles.coordDigit}>{coord.operation}</span>
                  <span style={styles.coordLabel}>Operation</span>
                </div>
                <span style={styles.coordDot}>.</span>
                <div style={styles.coordSegment} data-help={`${boundaryLabel} — ${coord.boundary === 0 ? 'input state before the operation runs' : coord.boundary === 1 ? 'the operation in progress' : 'output state after the operation completes'}`}>
                  <span style={styles.coordDigit}>{boundaryValue}</span>
                  <span style={styles.coordLabel}>Progress</span>
                </div>
              </div>
            );
          })()}
        </div>
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
          {/* Column 1: Breeding / Walkthrough */}
          <div style={styles.column}>
            <ZoomablePanel id="breeding" zoomedId={zoomedPanel} onZoom={setZoomedPanel} containerRef={mainRef} zoomedMaxWidth={900}>
              {walkthroughState ? (
                <SubPhaseScreen
                  coordinate={{
                    generation: walkthroughState.result.generationNumber,
                    operation: walkthroughState.operation,
                    boundary: walkthroughState.boundary,
                  }}
                  result={walkthroughState.result}
                  onSelectIndividual={handleSelectIndividual}
                  browsePairIndex={walkthroughState.browsePairIndex}
                  onPairChange={handleWalkthroughPairChange}
                  onNavigate={handleWalkthroughNavigate}
                />
              ) : algorithm.lastResult ? (
                <SubPhaseScreen
                  coordinate={{
                    generation: algorithm.lastResult.generationNumber,
                    operation: OPS_PER_GENERATION - 1,
                    boundary: 2,
                  }}
                  result={withPipeline(algorithm.lastResult)}
                  onSelectIndividual={handleSelectIndividual}
                  browsePairIndex={0}
                  onPairChange={() => {}}
                  onNavigate={handleWalkthroughNavigate}
                />
              ) : (
                <div style={{ padding: 16, color: colors.text.tertiary, fontFamily: 'monospace', fontSize: 11 }}>
                  Loading population…
                </div>
              )}
            </ZoomablePanel>
          </div>

          {/* Column 2: Board + Specimen Inspector */}
          <div ref={boardColRef} style={styles.column}>
            <ZoomablePanel id="board" zoomedId={zoomedPanel} onZoom={setZoomedPanel} containerRef={mainRef}>
              <Chessboard
                individual={displayIndividual}
                showAttacks={hasStarted}
                speed={algorithm.running ? Math.max(1, 501 - algorithm.speed) : undefined}
                zoomed={zoomedPanel === 'board'}
              />
              <SpecimenPanel
                individual={displayIndividual}
                breedingData={algorithm.lastResult?.breedingData ?? null}
                generation={algorithm.generation}
                isBest={displayIsBest}
                isSolution={displayIsSolution}
                onSelectIndividual={handleSelectIndividual}
                viewedOrigin={displayOrigin}
              />
            </ZoomablePanel>
          </div>

          {/* Column 3: Config */}
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
                onStatusClick={statusMessage?.individual && statusMessage?.origin ? () => {
                  handleSelectIndividual(statusMessage.individual!, statusMessage.origin!);
                } : undefined}
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
    backgroundColor: colors.bg.base,
    color: colors.text.primary,
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
    backgroundColor: colors.bg.raised,
    borderBottom: `1px solid ${colors.border.subtle}`,
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
    color: colors.text.primary,
    fontFamily: 'monospace',
    letterSpacing: -0.5,
  },
  subtitle: {
    margin: '4px 0 0 0',
    fontSize: 12,
    color: colors.text.tertiary,
    fontFamily: 'monospace',
  },
  controlsWrapper: {
    position: 'relative' as const,
  },
  coordOverlay: {
    position: 'absolute' as const,
    top: '50%',
    transform: 'translate(-50%, -50%)',
    display: 'flex',
    alignItems: 'flex-start',
    gap: 0,
    pointerEvents: 'none' as const,
  },
  coordSegment: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: 1,
    pointerEvents: 'auto' as const,
  },
  coordDigit: {
    fontSize: 28,
    fontFamily: 'monospace',
    fontWeight: 'bold',
    color: colors.text.primary,
    fontVariantNumeric: 'tabular-nums',
    minWidth: 28,
    textAlign: 'center' as const,
    lineHeight: 1,
  },
  coordLabel: {
    fontSize: 8,
    fontFamily: 'monospace',
    color: colors.text.disabled,
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
  },
  coordDot: {
    fontSize: 28,
    fontFamily: 'monospace',
    fontWeight: 'bold',
    color: colors.border.strong,
    lineHeight: 1,
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
    margin: 0,
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
