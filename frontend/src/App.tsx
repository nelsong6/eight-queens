import React, { useCallback, useEffect, useRef } from 'react';
import { useAuth } from './hooks/use-auth';
import { useAlgorithm } from './hooks/use-algorithm';
import { useApi } from './hooks/use-api';
import { Chessboard } from './components/Chessboard';
import { ConfigPanel } from './components/ConfigPanel';
import { Controls } from './components/Controls';
import { StatusBar } from './components/StatusBar';
import { ParentChildDisplay } from './components/ParentChildDisplay';
import { GenerationChart } from './components/GenerationChart';
import { GoogleSignIn } from './components/GoogleSignIn';
import { RunHistory } from './components/RunHistory';
import type { AlgorithmConfig } from './engine/types';

const App: React.FC = () => {
  const auth = useAuth();
  const algorithm = useAlgorithm();
  const apiHook = useApi(auth.user);

  const lastSyncedGenRef = useRef(0);
  const activeRunIdRef = useRef<string | null>(null);

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
  }, [algorithm]);

  const hasStarted = algorithm.generation > 0 || algorithm.bestIndividual !== null;

  // Show solution or best individual on the main board
  const displayIndividual = algorithm.solutionIndividual ?? algorithm.bestIndividual;

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

      {/* Main content: two columns */}
      <div style={styles.main}>
        {/* Left column: Board, Controls, StatusBar, Parent/Child */}
        <div style={styles.leftColumn}>
          <Chessboard
            individual={displayIndividual}
            label={algorithm.solved ? 'Solution Found!' : 'Best Individual'}
          />

          <Controls
            isRunning={algorithm.running}
            onPlay={algorithm.resume}
            onPause={algorithm.pause}
            onStep={algorithm.step}
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
          />

          <ParentChildDisplay lastResult={algorithm.lastResult} />
        </div>

        {/* Right column: Config, Chart, RunHistory */}
        <div style={styles.rightColumn}>
          <ConfigPanel
            onStart={handleStart}
            isRunning={algorithm.running}
            isAuthenticated={!!auth.user}
            presets={apiHook.presets}
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
    gap: 20,
    padding: '20px 24px',
    maxWidth: 1200,
    margin: '0 auto',
    flexWrap: 'wrap' as const,
  },
  leftColumn: {
    flex: '1 1 420px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 12,
    minWidth: 320,
  },
  rightColumn: {
    flex: '0 1 380px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 12,
    minWidth: 300,
  },
};
