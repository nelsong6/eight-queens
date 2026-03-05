import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from './hooks/use-auth';
import { useAlgorithm } from './hooks/use-algorithm';
import { useApi } from './hooks/use-api';
import { Chessboard } from './components/Chessboard';
import { ConfigPanel } from './components/ConfigPanel';
import { Controls } from './components/Controls';
import { BreedingListboxes } from './components/BreedingListboxes';

import { GenerationChart } from './components/GenerationChart';
import { GoogleSignIn } from './components/GoogleSignIn';
import { RunHistory } from './components/RunHistory';
import { HelpBar } from './components/HelpBar';
import { BreadcrumbTrail } from './components/BreadcrumbTrail';
import { DrillDownTransition } from './components/DrillDownTransition';
import { ZoomablePanel } from './components/ZoomablePanel';
import { SelectionPhase } from './components/walkthrough/SelectionPhase';
import { CrossoverPhase } from './components/walkthrough/CrossoverPhase';
import { MutationPhase } from './components/walkthrough/MutationPhase';
import { ResultsPhase } from './components/walkthrough/ResultsPhase';
import type { AlgorithmConfig, Individual, GenerationResult } from './engine/types';
import { createRandomIndividual } from './engine/individual';

type SessionPhase = 'config' | 'running' | 'review';

interface WalkthroughState {
  phase: number;
  result: GenerationResult;
  browsePairIndex: number;
}

const App: React.FC = () => {
  const auth = useAuth();
  const algorithm = useAlgorithm();
  const apiHook = useApi(auth.user);

  const lastSyncedGenRef = useRef(0);
  const activeRunIdRef = useRef<string | null>(null);

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

  // Key to force remount of child components on reset
  const [resetKey, setResetKey] = useState(0);

  // Random individual shown before algorithm starts
  const [initialIndividual, setInitialIndividual] = useState<Individual>(() => createRandomIndividual(0));

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
      lastSyncedGenRef.current = 0;
      activeRunIdRef.current = null;

      algorithm.start(config);
      setSessionPhase('running');
      setWalkthroughState(null);

      // Create API run in background (non-blocking)
      if (auth.user) {
        apiHook.createRun(config).then((runId) => {
          if (runId) {
            activeRunIdRef.current = runId;
          }
        });
      }
    },
    [auth.user, apiHook, algorithm],
  );

  /** Auto-start the algorithm if still in config phase. */
  const ensureStarted = useCallback(() => {
    if (sessionPhase === 'config') {
      handleStart(pendingConfigRef.current);
    }
  }, [sessionPhase, handleStart]);

  // Sync generations to API periodically
  useEffect(() => {
    if (!auth.user || !activeRunIdRef.current) return;
    if (algorithm.generationSummaries.length <= lastSyncedGenRef.current) return;

    const newGens = algorithm.generationSummaries.slice(lastSyncedGenRef.current);
    if (newGens.length > 0) {
      const summary = algorithm.solved
        ? {
            totalGenerations: algorithm.generation,
            solved: true,
            solutionIndividual: algorithm.solutionIndividual?.solution ?? null,
          }
        : { totalGenerations: algorithm.generation };

      apiHook.syncGenerations(activeRunIdRef.current, newGens, summary);
      lastSyncedGenRef.current = algorithm.generationSummaries.length;
    }
  }, [auth.user, algorithm.generationSummaries, algorithm.solved, algorithm.generation, algorithm.solutionIndividual, apiHook]);

  const handleLoadRun = useCallback(
    async (runId: string) => {
      const run = await apiHook.loadRun(runId);
      if (!run) return;
      algorithm.reset();
      algorithm.start(run.config);
      setSessionPhase('running');
      setWalkthroughState(null);
    },
    [apiHook, algorithm],
  );

  const handleReset = useCallback(() => {
    algorithm.reset();
    lastSyncedGenRef.current = 0;
    activeRunIdRef.current = null;
    setViewedIndividual(null);
    setViewedSource('');
    setSessionPhase('config');
    setWalkthroughState(null);
    setGranularity('full');
    setZoomedPanel(null);
    setInitialIndividual(createRandomIndividual(0));
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

  const handlePlay = useCallback(() => {
    ensureStarted();
    setGranularity('full');
    setWalkthroughState(null);
    algorithm.resume();
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
  const displayLabel = viewedIndividual
    ? `Viewing: ${viewedSource}`
    : algorithm.solved
      ? 'Solution Found!'
      : hasStarted
        ? 'Best Individual'
        : 'Random Placement';

  // Status message matching C# behavior
  const statusMessage = useMemo(() => {
    if (viewedIndividual) {
      return `Individual from '${viewedSource}' has fitness ${viewedIndividual.fitness}/28.`;
    }
    if (algorithm.solved && algorithm.solutionIndividual) {
      const sol = algorithm.solutionIndividual.solution.join(' ');
      return `Solution found! [${sol}] with fitness 28/28.`;
    }
    if (algorithm.lastResult) {
      const best = algorithm.lastResult.bestIndividual;
      const sol = best.solution.join(' ');
      return `Generation ${algorithm.generation} produced this best specimen [${sol}] with fitness ${best.fitness}/28.`;
    }
    return 'Algorithm has not started.';
  }, [viewedIndividual, viewedSource, algorithm.solved, algorithm.solutionIndividual, algorithm.lastResult, algorithm.generation]);

  return (
    <div style={styles.app}>
      {/* Sticky top bar: header + help tooltip */}
      <div style={styles.stickyTop}>
        <header style={styles.header}>
          <div style={styles.headerLeft}>
            <div style={styles.titleRow}>
              <h1 style={styles.title} data-help="Place 8 queens on a chessboard so none attack each other — solved by evolving random placements">Eight Queens: Genetic Algorithm</h1>
              <button onClick={handleReset} className="btn" data-help="Clear all progress and return to configuration" style={styles.resetBtn} title="Reset">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="23 4 23 10 17 10" />
                  <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                </svg>
              </button>
            </div>
            <p style={styles.subtitle} data-help="Uses selection, crossover, and mutation to breed better solutions each generation">
              Evolving solutions to the classic 8-queens puzzle
            </p>
          </div>
          <div style={styles.headerRight}>
            <GoogleSignIn
              user={auth.user}
              onSignIn={auth.signIn}
              onSignOut={auth.signOut}
              renderGoogleButton={auth.renderGoogleButton}
            />
          </div>
        </header>
        <HelpBar />
        <BreadcrumbTrail
          sessionPhase={sessionPhase}
          granularity={granularity}
          walkthroughPhase={walkthroughState?.phase ?? null}
          browsePairIndex={walkthroughState?.browsePairIndex ?? null}
          zoomedPanel={zoomedPanel}
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
          onNewSession={handleNewSession}
          speed={algorithm.speed}
          onSpeedChange={algorithm.setSpeed}
          solved={algorithm.solved}
          walkthroughPhase={walkthroughState?.phase ?? null}
          granularity={granularity}
          onGranularityChange={handleGranularityChange}
        />
      </div>

      {/* Error banner */}
      {apiHook.error && (
        <div style={styles.errorBanner}>
          <span>{apiHook.error}</span>
          <button onClick={apiHook.clearError} style={styles.errorDismiss}>
            Dismiss
          </button>
        </div>
      )}

      {/* Backdrop overlay when a panel is zoomed */}
      {zoomedPanel && (
        <div
          style={styles.backdrop}
          onClick={() => setZoomedPanel(null)}
        />
      )}

      {/* Main content */}
      <div ref={mainRef} style={styles.main}>
        {/* Top row: Board | Session Data */}
        <div style={styles.topRow}>
          <ZoomablePanel id="board" zoomedId={zoomedPanel} onZoom={setZoomedPanel} containerRef={mainRef}>
            <Chessboard
              individual={displayIndividual}
              label={displayLabel}
              showAttacks={hasStarted}
              speed={algorithm.running ? Math.max(1, 501 - algorithm.speed) : undefined}
              zoomed={zoomedPanel === 'board'}
            />
          </ZoomablePanel>

          <div style={styles.wing}>
            <ZoomablePanel id="config" zoomedId={zoomedPanel} onZoom={setZoomedPanel} containerRef={mainRef}>
              <ConfigPanel
                key={`config-${resetKey}`}
                onConfigChange={handleConfigChange}
                sessionPhase={sessionPhase}
                presets={apiHook.presets}
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
        </div>

        {/* Bottom row: Breeding/Walkthrough, Chart, RunHistory */}
        <div style={styles.bottomRow}>
          <ZoomablePanel id="breeding" zoomedId={zoomedPanel} onZoom={setZoomedPanel} containerRef={mainRef} style={{ flex: '0 1 auto', minWidth: 0 }}>
            <DrillDownTransition
              isActive={granularity === 'micro' && walkthroughState !== null}
              normalContent={
                <BreedingListboxes
                  breedingData={granularity === 'micro' ? null : (algorithm.lastResult?.breedingData ?? null)}
                  generation={algorithm.generation}
                  onSelectIndividual={handleSelectIndividual}
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

          <ZoomablePanel id="chart" zoomedId={zoomedPanel} onZoom={setZoomedPanel} containerRef={mainRef} style={{ flex: '0 1 auto', maxWidth: 400 }}>
            <GenerationChart generationSummaries={algorithm.generationSummaries} />
          </ZoomablePanel>

          <ZoomablePanel id="history" zoomedId={zoomedPanel} onZoom={setZoomedPanel} containerRef={mainRef} style={{ flex: '1 1 300px', minWidth: 0 }}>
            <RunHistory
              runs={apiHook.runs}
              onLoadRun={handleLoadRun}
              onDeleteRun={apiHook.deleteRun}
              isAuthenticated={!!auth.user}
              loading={apiHook.loading}
            />
          </ZoomablePanel>
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
    minHeight: '100vh',
    backgroundColor: '#0d0d1a',
    color: '#e0e0e0',
    fontFamily: "'Segoe UI', 'Roboto', monospace",
    padding: 0,
    margin: 0,
  },
  stickyTop: {
    position: 'sticky' as const,
    top: 0,
    zIndex: 100,
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
  resetBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
    backgroundColor: '#2a2a4a',
    color: '#e0e0e0',
    border: '1px solid #3a3a5a',
    borderRadius: 4,
    cursor: 'pointer',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
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
  errorBanner: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 24px',
    backgroundColor: '#3e1a1a',
    color: '#f44336',
    fontFamily: 'monospace',
    fontSize: 13,
    borderBottom: '1px solid #5a2020',
  },
  errorDismiss: {
    padding: '2px 10px',
    backgroundColor: 'transparent',
    color: '#f44336',
    border: '1px solid #f44336',
    borderRadius: 3,
    cursor: 'pointer',
    fontFamily: 'monospace',
    fontSize: 11,
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
    gap: 16,
    padding: '20px 24px',
    maxWidth: 1800,
    margin: '0 auto',
  },
  topRow: {
    display: 'flex',
    gap: 12,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  wing: {
    flex: '0 1 480px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 8,
    alignItems: 'stretch',
    minWidth: 0,
  },
  sidePanel: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 8,
    flexShrink: 0,
  },
  bottomRow: {
    display: 'flex',
    gap: 12,
    flexWrap: 'wrap' as const,
  },
};
