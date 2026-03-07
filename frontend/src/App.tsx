import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useBufferedAlgorithm } from './hooks/use-buffered-algorithm';
import { Chessboard } from './components/Chessboard';
import { ConfigPanel } from './components/ConfigPanel';
import { Controls } from './components/Controls';
import { GenerationChart } from './components/GenerationChart';
import { HelpBar } from './components/HelpBar';
import { BreadcrumbTrail } from './components/BreadcrumbTrail';
import { ZoomablePanel } from './components/ZoomablePanel';
import { SpecimenPanel } from './components/SpecimenPanel';
import { TabBar } from './components/TabBar';
import type { ActiveTab } from './components/TabBar';
import { PipelineBar } from './components/PipelineBar';
import { OperationPanel } from './components/OperationPanel';
import { HelpGlossary, HELP_SECTIONS, type HelpSectionId } from './components/HelpGlossary';
import { GettingStartedTab } from './components/GettingStartedTab';
import type { AlgorithmConfig, Individual, GenerationResult, PoolOrigin } from './engine/types';
import { poolDisplayName, OPS_PER_GENERATION, SCREENS_PER_OP, getOp, isPipelineEmpty, reconstructPipeline, GENERATION_OPS } from './engine/time-coordinate';
import { SubPhaseScreen } from './components/walkthrough/SubPhaseScreen';
import { CATEGORY_COLORS } from './components/walkthrough/IndividualList';
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

const OP_TAB_LABELS = ['Age', 'Prune', 'Select', 'Mark Pairs', 'Chromosomes', 'Mutate', 'Birth'];

const App: React.FC = () => {
  const algorithm = useBufferedAlgorithm();

  // Session lifecycle
  const [sessionPhase, setSessionPhase] = useState<SessionPhase>('config');

  // Walkthrough state
  const [walkthroughState, setWalkthroughState] = useState<WalkthroughState | null>(null);

  // Tabs
  const [activeTab, setActiveTab] = useState<ActiveTab>('getting-started');
  const [showSpecimen, setShowSpecimen] = useState(false);
  const [helpSection, setHelpSection] = useState<HelpSectionId>('problem');

  // Derived granularity (for existing logic that uses it)
  const granularity: 'full' | 'micro' = activeTab === 'micro' ? 'micro' : 'full';

  // Ensure a result has a populated pipeline before entering micro mode.
  const withPipeline = useCallback((result: GenerationResult): GenerationResult => {
    if (!isPipelineEmpty(result)) return result;
    return { ...result, pipeline: reconstructPipeline(result, algorithm.peekUndoResult()) };
  }, [algorithm]);

  const handleTabChange = useCallback((tab: ActiveTab) => {
    if (tab === 'full') {
      setWalkthroughState(null);
      setShowSpecimen(false);
    } else if (tab === 'micro') {
      if (!walkthroughState && algorithm.lastResult) {
        setWalkthroughState({
          operation: OPS_PER_GENERATION - 1,
          boundary: 2,
          result: withPipeline(algorithm.lastResult),
          browsePairIndex: 0,
        });
      }
      setShowSpecimen(false);
    }
    setActiveTab(tab);
  }, [walkthroughState, algorithm, withPipeline]);

  const handleOpenGlossary = useCallback((termId?: string) => {
    setActiveTab('help');
    if (termId) {
      setTimeout(() => {
        document.getElementById(`glossary-${termId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 50);
    }
  }, []);

  const handleStart = useCallback(
    (config: AlgorithmConfig) => {
      algorithm.start(config);
      setSessionPhase('running');
      setWalkthroughState(null);
    },
    [algorithm],
  );

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

  // Zoom state (used in Full tab)
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

  // Eagerly start the algorithm during config phase so gen-0 data is visible.
  const algorithmStart = algorithm.start;
  const algorithmResize = algorithm.resizePopulation;
  const activeConfigRef = useRef<AlgorithmConfig | null>(null);
  useLayoutEffect(() => {
    if (sessionPhase !== 'config') return;
    const prev = activeConfigRef.current;
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

  // Viewed individual state
  const [viewedIndividual, setViewedIndividual] = useState<Individual | null>(null);
  const [viewedOrigin, setViewedOrigin] = useState<PoolOrigin | null>(null);

  const handleSelectIndividual = useCallback((individual: Individual, origin: PoolOrigin) => {
    setViewedIndividual(individual);
    setViewedOrigin(origin);
    // In Granular Step tab, auto-switch to Specimen local sub-tab
    if (activeTab === 'micro') {
      setShowSpecimen(true);
    }
  }, [activeTab]);

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

  const handleStartMicro = useCallback(() => {
    ensureStarted();
    handleTabChange('micro');
  }, [ensureStarted, handleTabChange]);

  const handleStartFull = useCallback(() => {
    ensureStarted();
    handleTabChange('full');
  }, [ensureStarted, handleTabChange]);

  const handleReset = useCallback(() => {
    algorithm.start(pendingConfigRef.current);
    activeConfigRef.current = { ...pendingConfigRef.current };
    setViewedIndividual(null);
    setViewedOrigin(null);
    setSessionPhase('config');
    setWalkthroughState(null);
    setActiveTab('full');
    setShowSpecimen(false);
    setZoomedPanel(null);
    setInitialIndividual(createRandomIndividual(Math.floor(Math.random() * 50)));
    setResetKey((k) => k + 1);
  }, [algorithm]);

  const handleNewSession = useCallback(() => {
    handleReset();
  }, [handleReset]);

  // Pipeline bar navigation — switches to Micro tab and navigates to the clicked operation
  const handlePipelineNavigate = useCallback((operation: number, boundary: 0 | 1 | 2) => {
    ensureStarted();
    setShowSpecimen(false);
    // Gen 0 floor guard — don't allow navigating before the starting point
    const currentGen = walkthroughState?.result.generationNumber ?? algorithm.lastResult?.generationNumber ?? 0;
    if (currentGen === 0) {
      const currentOp = walkthroughState?.operation ?? OPS_PER_GENERATION - 1;
      const currentBoundary = walkthroughState?.boundary ?? 2;
      if (operation * SCREENS_PER_OP + boundary < currentOp * SCREENS_PER_OP + currentBoundary) return;
    }
    if (activeTab !== 'micro') {
      setActiveTab('micro');
    }
    if (walkthroughState) {
      setWalkthroughState({ ...walkthroughState, operation, boundary, browsePairIndex: 0 });
    } else if (algorithm.lastResult) {
      setWalkthroughState({ operation, boundary, result: withPipeline(algorithm.lastResult), browsePairIndex: 0 });
    }
  }, [activeTab, walkthroughState, algorithm, ensureStarted, withPipeline]);

  // Operation sub-tab click in Granular Step tab
  const handleSelectOperation = useCallback((op: number) => {
    ensureStarted();
    setShowSpecimen(false);
    if (walkthroughState) {
      setWalkthroughState({ ...walkthroughState, operation: op, boundary: 0, browsePairIndex: 0 });
    } else if (algorithm.lastResult) {
      setWalkthroughState({ operation: op, boundary: 0, result: withPipeline(algorithm.lastResult), browsePairIndex: 0 });
    }
  }, [walkthroughState, algorithm, ensureStarted, withPipeline]);

  // Clicking an inactive phase section in OperationPanel jumps boundary directly
  const handleBoundaryChange = useCallback((boundary: 0 | 1 | 2) => {
    if (walkthroughState) {
      // Gen 0 is the chronological floor — don't allow navigating backward past the starting point
      if (walkthroughState.result.generationNumber === 0 && boundary < walkthroughState.boundary) {
        return;
      }
      setWalkthroughState({ ...walkthroughState, boundary });
    }
  }, [walkthroughState]);

  // Walkthrough: advance boundary 0→1→2, then operation+1 boundary 0.
  // After op 6 boundary 2, run next generation starting at op 0 boundary 0.
  const handleWalkThrough = useCallback(() => {
    ensureStarted();
    setShowSpecimen(false);
    if (!walkthroughState) {
      const result = algorithm.lastResult;
      if (result) {
        setWalkthroughState({ operation: OPS_PER_GENERATION - 1, boundary: 2, result: withPipeline(result), browsePairIndex: 0 });
      }
    } else if (walkthroughState.boundary < 2) {
      setWalkthroughState({ ...walkthroughState, boundary: (walkthroughState.boundary + 1) as 0 | 1 | 2 });
    } else if (walkthroughState.operation < OPS_PER_GENERATION - 1) {
      setWalkthroughState({ ...walkthroughState, operation: walkthroughState.operation + 1, boundary: 0 });
    } else {
      const result = algorithm.step();
      if (result) {
        setWalkthroughState({ operation: 0, boundary: 0, result, browsePairIndex: 0 });
      }
    }
  }, [walkthroughState, algorithm, ensureStarted, withPipeline]);

  const handleWalkthroughPairChange = useCallback((index: number) => {
    if (walkthroughState) {
      setWalkthroughState({ ...walkthroughState, browsePairIndex: index });
    }
  }, [walkthroughState]);

  const handlePlay = useCallback((stepCount: number) => {
    ensureStarted();
    if (activeTab === 'micro') {
      setActiveTab('full');
    }
    setWalkthroughState(null);
    setShowSpecimen(false);
    algorithm.resume(stepCount, /* skipPipeline */ true);
  }, [ensureStarted, algorithm, activeTab]);

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
    if (showSpecimen) {
      setShowSpecimen(false);
      return;
    }
    if (walkthroughState) {
      if (granularity === 'micro') {
        // Gen 0 is the chronological floor — back exits to config
        if (walkthroughState.result.generationNumber === 0) {
          setWalkthroughState(null);
          handleReset();
          return;
        }
        if (walkthroughState.boundary > 0) {
          setWalkthroughState({ ...walkthroughState, boundary: (walkthroughState.boundary - 1) as 0 | 1 | 2 });
          return;
        }
        if (walkthroughState.operation > 0) {
          setWalkthroughState({ ...walkthroughState, operation: walkthroughState.operation - 1, boundary: 2 });
          return;
        }
        const restored = algorithm.goBack();
        if (restored) {
          setWalkthroughState({ operation: OPS_PER_GENERATION - 1, boundary: 2, result: restored.result, browsePairIndex: 0 });
        } else {
          setWalkthroughState(null);
          handleReset();
        }
        return;
      }
      // Full mode with walkthrough — clear back to default view
      setWalkthroughState(null);
      return;
    }
    const restoredFull = algorithm.goBack();
    if (!restoredFull) {
      handleReset();
    }
  }, [showSpecimen, granularity, walkthroughState, algorithm, handleReset]);

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

  // Pipeline bar coordinate
  const currentCoordinate = walkthroughState
    ? { generation: walkthroughState.result.generationNumber, operation: walkthroughState.operation, boundary: walkthroughState.boundary }
    : hasStarted
      ? { generation: algorithm.generation, operation: OPS_PER_GENERATION - 1, boundary: 2 as const }
      : { generation: 0, operation: OPS_PER_GENERATION - 1, boundary: 2 as const };

  // Can go back?
  const canGoBackValue = showSpecimen
    ? true
    : walkthroughState
      ? activeTab === 'micro'
        ? walkthroughState.result.generationNumber !== 0
        : true
      : algorithm.canGoBack;

  return (
    <div style={styles.app}>
      {/* Sticky top bar */}
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
        <HelpBar onOpenGlossary={handleOpenGlossary} />
        <PipelineBar
          coordinate={currentCoordinate}
          onNavigate={handlePipelineNavigate}
          hasResult={!!algorithm.lastResult}
        />
        <Controls
            sessionPhase={sessionPhase}
            isRunning={algorithm.running}
            onPlay={handlePlay}
            onPause={handlePause}
            onStep={activeTab === 'micro' ? handleWalkThrough : handleStep}
            onStepN={handleStepN}
            onBack={handleBack}
            canGoBack={canGoBackValue}
            onReset={handleReset}
            onNewSession={handleNewSession}
            speed={algorithm.speed}
            onSpeedChange={algorithm.setSpeed}
            solved={algorithm.solved}
            walkthroughPhase={walkthroughState ? walkthroughState.operation * SCREENS_PER_OP + walkthroughState.boundary : null}
            isMicro={activeTab === 'micro'}
            coordinate={hasStarted ? currentCoordinate : undefined}
          />
        <BreadcrumbTrail
          sessionPhase={sessionPhase}
          activeTab={activeTab}
          walkthroughPhase={walkthroughState ? walkthroughState.operation * SCREENS_PER_OP + walkthroughState.boundary : null}
          browsePairIndex={walkthroughState?.browsePairIndex ?? null}
          zoomedPanel={zoomedPanel}
          breedingCategory=""
          onTabChange={handleTabChange}
          onSetGranularity={(g) => handleTabChange(g)}
          onClearWalkthrough={() => setWalkthroughState(null)}
          onClearZoom={() => setZoomedPanel(null)}
        />
      </div>

      {/* Backdrop overlay when a panel is zoomed */}
      {zoomedPanel && (
        <div
          style={styles.backdrop}
          onClick={() => setZoomedPanel(null)}
        />
      )}

      {/* Main content: sidebar + tab content */}
      <div ref={mainRef} style={styles.main}>
        {/* Left sidebar: vertical navigation tabs */}
        <div style={styles.leftSidebar}>
          <TabBar
            activeTab={activeTab}
            onTabChange={handleTabChange}
            sessionPhase={sessionPhase}
            hasSecondaryColumn={activeTab === 'micro' || activeTab === 'help'}
          />
        </div>

        {/* Secondary tab strip — direct sibling of leftSidebar so they share the same bg.raised block */}
        {(activeTab === 'micro' || activeTab === 'help') && (
          <div style={styles.opTabStrip}>
            {activeTab === 'micro' && (
              <>
                {GENERATION_OPS.map((op, idx) => {
                  const isActive = !showSpecimen && walkthroughState?.operation === idx;
                  const opColor = CATEGORY_COLORS[op.category] ?? colors.accent.purple;
                  return (
                    <button
                      key={idx}
                      className="tab-nav"
                      onClick={() => handleSelectOperation(idx)}
                      data-help={`${op.category}: ${op.name}`}
                      style={{
                        ...styles.opTab,
                        color: isActive ? opColor : colors.text.tertiary,
                        borderTopColor: (isActive && idx > 0) ? colors.border.subtle : 'transparent',
                        borderLeftColor: isActive ? colors.border.subtle : 'transparent',
                        borderBottomColor: isActive ? colors.border.subtle : 'transparent',
                        backgroundColor: isActive ? colors.bg.base : 'transparent',
                        fontWeight: isActive ? 'bold' : 'normal',
                        ...(isActive ? { position: 'relative' as const, right: -1, zIndex: 1 } : {}),
                      }}
                    >
                      {OP_TAB_LABELS[idx]}
                    </button>
                  );
                })}
                <div style={styles.opTabSep} />
                <button
                  className="tab-nav"
                  onClick={() => setShowSpecimen(true)}
                  data-help="Inspect an individual's genome, fitness, parentage, and mutation"
                  style={{
                    ...styles.opTab,
                    color: showSpecimen ? colors.accent.purple : colors.text.tertiary,
                    borderTopColor: showSpecimen ? colors.border.subtle : 'transparent',
                    borderLeftColor: showSpecimen ? colors.border.subtle : 'transparent',
                    borderBottomColor: showSpecimen ? colors.border.subtle : 'transparent',
                    backgroundColor: showSpecimen ? colors.bg.base : 'transparent',
                    fontWeight: showSpecimen ? 'bold' : 'normal',
                    ...(showSpecimen ? { position: 'relative' as const, right: -1, zIndex: 1 } : {}),
                  }}
                >
                  Specimen{viewedIndividual ? ' \u25cf' : ''}
                </button>
              </>
            )}
            {activeTab === 'help' && HELP_SECTIONS.map((sec, idx) => {
              const isActive = helpSection === sec.id;
              return (
                <button
                  key={sec.id}
                  className="tab-nav"
                  onClick={() => setHelpSection(sec.id)}
                  data-help={sec.helpText}
                  style={{
                    ...styles.opTab,
                    color: isActive ? colors.text.primary : colors.text.tertiary,
                    borderTopColor: (isActive && idx > 0) ? colors.border.subtle : 'transparent',
                    borderLeftColor: isActive ? colors.border.subtle : 'transparent',
                    borderBottomColor: isActive ? colors.border.subtle : 'transparent',
                    backgroundColor: isActive ? colors.bg.base : 'transparent',
                    fontWeight: isActive ? 'bold' : 'normal',
                    ...(isActive ? { position: 'relative' as const, right: -1, zIndex: 1 } : {}),
                  }}
                >
                  {sec.label}
                </button>
              );
            })}
          </div>
        )}

        {/* Tab content area */}
        <div style={styles.tabContent}>

        {/* ── Getting Started tab ─────────────────────────────────── */}
        {activeTab === 'getting-started' && (
          <GettingStartedTab
            onStartMicro={handleStartMicro}
            onStartFull={handleStartFull}
            onOpenGlossary={() => handleOpenGlossary()}
          />
        )}

        {/* ── Full Step tab ───────────────────────────────────────── */}
        {activeTab === 'full' && (
          <div style={styles.columns}>
            {/* Column 1: SubPhaseScreen (end of gen) */}
            <div style={styles.column}>
              <ZoomablePanel id="breeding" zoomedId={zoomedPanel} onZoom={setZoomedPanel} containerRef={mainRef} zoomedMaxWidth={900}>
                {walkthroughState ? (
                  <SubPhaseScreen
                    coordinate={{ generation: walkthroughState.result.generationNumber, operation: walkthroughState.operation, boundary: walkthroughState.boundary }}
                    result={walkthroughState.result}
                    onSelectIndividual={handleSelectIndividual}
                    browsePairIndex={walkthroughState.browsePairIndex}
                    onPairChange={handleWalkthroughPairChange}
                  />
                ) : algorithm.lastResult ? (
                  <SubPhaseScreen
                    coordinate={{ generation: algorithm.lastResult.generationNumber, operation: OPS_PER_GENERATION - 1, boundary: 2 }}
                    result={withPipeline(algorithm.lastResult)}
                    onSelectIndividual={handleSelectIndividual}
                    browsePairIndex={0}
                    onPairChange={() => {}}
                  />
                ) : (
                  <div style={{ padding: 16, color: colors.text.tertiary, fontFamily: 'monospace', fontSize: 11 }}>
                    Loading population…
                  </div>
                )}
              </ZoomablePanel>
            </div>

            {/* Column 2: Board + Specimen Inspector */}
            <div style={styles.column}>
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
        )}

        {/* ── Granular Step tab ───────────────────────────────────── */}
        {activeTab === 'micro' && (
          <div style={styles.microContent}>
          {showSpecimen ? (
            <div style={styles.specimenLayout}>
              <div style={styles.specimenToolbar}>
                <button
                  onClick={() => setShowSpecimen(false)}
                  style={styles.backBtn}
                >
                  ← {walkthroughState ? getOp(walkthroughState.operation).name : 'Pipeline'}
                </button>
              </div>
              <div style={styles.specimenContent}>
                <div style={styles.specimenBoard}>
                  <Chessboard
                    individual={displayIndividual}
                    showAttacks={hasStarted}
                    speed={algorithm.running ? Math.max(1, 501 - algorithm.speed) : undefined}
                  />
                </div>
                <div style={styles.specimenDetail}>
                  <SpecimenPanel
                    individual={displayIndividual}
                    breedingData={algorithm.lastResult?.breedingData ?? null}
                    generation={algorithm.generation}
                    isBest={displayIsBest}
                    isSolution={displayIsSolution}
                    onSelectIndividual={handleSelectIndividual}
                    viewedOrigin={displayOrigin}
                  />
                </div>
              </div>
            </div>
          ) : walkthroughState ? (
            <OperationPanel
              operation={walkthroughState.operation}
              boundary={walkthroughState.boundary}
              result={walkthroughState.result}
              onSelectIndividual={handleSelectIndividual}
              browsePairIndex={walkthroughState.browsePairIndex}
              onPairChange={handleWalkthroughPairChange}
              onBoundaryChange={handleBoundaryChange}
            />
          ) : (
            <div style={styles.microEmpty}>
              Start the algorithm to explore the pipeline step by step.
            </div>
          )}
          </div>
        )}

        {/* ── Help / Glossary tab ─────────────────────────────────── */}
        {activeTab === 'help' && <HelpGlossary section={helpSection} />}

        </div>{/* end tabContent */}
      </div>{/* end main */}
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
    padding: '12px 24px',
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
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text.primary,
    fontFamily: 'monospace',
    letterSpacing: -0.5,
  },
  subtitle: {
    margin: '3px 0 0 0',
    fontSize: 11,
    color: colors.text.tertiary,
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
    flexDirection: 'row' as const,
    flex: 1,
    minHeight: 0,
    width: '100%',
  },
  leftSidebar: {
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column' as const,
    backgroundColor: colors.bg.raised,
    borderRight: `1px solid ${colors.border.subtle}`,
  },
  tabContent: {
    display: 'flex',
    flexDirection: 'column' as const,
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    padding: '12px 24px',
    maxWidth: 1800,
    boxSizing: 'border-box' as const,
  },
  // Full tab
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
  // Micro tab
  microLayout: {
    display: 'flex',
    flexDirection: 'row' as const,
    flex: 1,
    minHeight: 0,
  },
  opTabStrip: {
    display: 'flex',
    flexDirection: 'column' as const,
    backgroundColor: colors.bg.raised,
    borderRight: `1px solid ${colors.border.subtle}`,
    flexShrink: 0,
    paddingTop: 0,
    paddingBottom: 8,
  },
  opTabParentLabel: {
    padding: '10px 16px',
    fontSize: 12,
    fontFamily: 'monospace',
    color: colors.accent.purple,
    fontWeight: 'bold' as const,
    borderLeft: `3px solid ${colors.accent.purple}`,
    backgroundColor: colors.bg.surface,
    letterSpacing: 0.3,
    borderBottom: `1px solid ${colors.border.subtle}`,
    marginBottom: 4,
    whiteSpace: 'nowrap' as const,
  },
  opTab: {
    padding: '10px 16px',
    fontSize: 12,
    fontFamily: 'monospace',
    color: colors.text.tertiary,
    background: 'none',
    WebkitAppearance: 'none' as const,
    appearance: 'none' as const,
    outline: 'none',
    border: 'none',
    borderTop: '1px solid transparent',
    borderLeft: '1px solid transparent',
    borderBottom: '1px solid transparent',
    borderRight: 'none',
    whiteSpace: 'nowrap' as const,
    transition: 'color 0.12s, background-color 0.12s, border-color 0.12s',
    cursor: 'pointer',
    letterSpacing: 0.3,
    textAlign: 'left' as const,
  },
  opTabSep: {
    height: 1,
    margin: '4px 6px',
    backgroundColor: colors.border.subtle,
    flexShrink: 0,
  },
  microContent: {
    display: 'flex',
    flexDirection: 'column' as const,
    flex: 1,
    minWidth: 0,
    minHeight: 0,
  },
  // Specimen view within micro tab
  specimenLayout: {
    display: 'flex',
    flexDirection: 'column' as const,
    flex: 1,
    minHeight: 0,
  },
  specimenToolbar: {
    padding: '8px 12px',
    borderBottom: `1px solid ${colors.border.subtle}`,
    backgroundColor: colors.bg.raised,
    flexShrink: 0,
  },
  backBtn: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: colors.accent.purple,
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '2px 6px',
    borderRadius: 3,
  },
  specimenContent: {
    display: 'flex',
    gap: 20,
    flex: 1,
    minHeight: 0,
    padding: '16px 16px',
    overflowY: 'auto' as const,
  },
  specimenBoard: {
    flexShrink: 0,
  },
  specimenDetail: {
    flex: 1,
    minWidth: 0,
    overflow: 'auto',
  },
  microEmpty: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: colors.text.disabled,
    fontFamily: 'monospace',
    fontSize: 13,
  },
};
