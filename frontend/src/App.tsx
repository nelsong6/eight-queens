import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from './hooks/use-auth';
import { useAlgorithm } from './hooks/use-algorithm';
import { useApi } from './hooks/use-api';
import { Chessboard } from './components/Chessboard';
import { ConfigPanel } from './components/ConfigPanel';
import { Controls } from './components/Controls';
import { StatusBar } from './components/StatusBar';
import { BreedingListboxes } from './components/BreedingListboxes';
import { SessionStatistics } from './components/SessionStatistics';
import { GenerationChart } from './components/GenerationChart';
import { GoogleSignIn } from './components/GoogleSignIn';
import { RunHistory } from './components/RunHistory';
import type { AlgorithmConfig, Individual } from './engine/types';
import { createRandomIndividual } from './engine/individual';

const App: React.FC = () => {
  const auth = useAuth();
  const algorithm = useAlgorithm();
  const apiHook = useApi(auth.user);

  const lastSyncedGenRef = useRef(0);
  const activeRunIdRef = useRef<string | null>(null);

  // Random individual shown before algorithm starts
  const [initialIndividual] = useState<Individual>(() => createRandomIndividual(0));

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
    async (config: AlgorithmConfig) => {
      lastSyncedGenRef.current = 0;
      activeRunIdRef.current = null;

      if (auth.user) {
        const runId = await apiHook.createRun(config);
        if (runId) {
          activeRunIdRef.current = runId;
        }
      }

      algorithm.start(config);
    },
    [auth.user, apiHook, algorithm],
  );

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
    },
    [apiHook, algorithm],
  );

  const handleReset = useCallback(() => {
    algorithm.reset();
    lastSyncedGenRef.current = 0;
    activeRunIdRef.current = null;
    setViewedIndividual(null);
    setViewedSource('');
  }, [algorithm]);

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
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <h1 style={styles.title}>Eight Queens: Genetic Algorithm</h1>
          <p style={styles.subtitle}>
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

      {/* Error banner */}
      {apiHook.error && (
        <div style={styles.errorBanner}>
          <span>{apiHook.error}</span>
          <button onClick={apiHook.clearError} style={styles.errorDismiss}>
            Dismiss
          </button>
        </div>
      )}

      {/* Main content */}
      <div style={styles.main}>
        {/* Top row: Board | Controls+Status | SessionStats | Config */}
        <div style={styles.topRow}>
          <Chessboard
            individual={displayIndividual}
            label={displayLabel}
            showAttacks={hasStarted}
            speed={algorithm.running ? Math.max(1, 501 - algorithm.speed) : undefined}
          />

          <div style={styles.sidePanel}>
            <Controls
              isRunning={algorithm.running}
              onPlay={algorithm.resume}
              onPause={algorithm.pause}
              onStep={algorithm.step}
              onStepN={algorithm.stepN}
              onRunUntilSolved={algorithm.runUntilSolved}
              onReset={handleReset}
              speed={algorithm.speed}
              onSpeedChange={algorithm.setSpeed}
              hasStarted={hasStarted}
              solved={algorithm.solved}
            />

            <StatusBar
              generation={algorithm.generation}
              bestFitness={algorithm.bestFitness}
              avgFitness={algorithm.avgFitness}
              solved={algorithm.solved}
              algorithmConfig={algorithm.algorithmConfig}
              message={statusMessage}
            />
          </div>

          <ConfigPanel
            onStart={handleStart}
            isRunning={algorithm.running}
            presets={apiHook.presets}
          />

          <SessionStatistics
            algorithmConfig={algorithm.algorithmConfig}
            stepStatistics={algorithm.lastResult?.stepStatistics ?? null}
            cumulativeStats={algorithm.cumulativeStats}
          />
        </div>

        {/* Bottom row: Breeding, Chart, RunHistory */}
        <div style={styles.bottomRow}>
          <BreedingListboxes
            breedingData={algorithm.lastResult?.breedingData ?? null}
            onSelectIndividual={handleSelectIndividual}
          />

          <GenerationChart generationSummaries={algorithm.generationSummaries} />

          <RunHistory
            runs={apiHook.runs}
            onLoadRun={handleLoadRun}
            onDeleteRun={apiHook.deleteRun}
            isAuthenticated={!!auth.user}
            loading={apiHook.loading}
          />
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
    flexWrap: 'wrap' as const,
  },
  sidePanel: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 8,
    width: 200,
    flexShrink: 0,
    alignSelf: 'stretch',
  },
  bottomRow: {
    display: 'flex',
    gap: 12,
    flexWrap: 'wrap' as const,
  },
};
