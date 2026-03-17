import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useBufferedAlgorithm } from './hooks/use-buffered-algorithm';
import { Chessboard } from './components/Chessboard';
import { ConfigPanel, InitialSettings } from './components/ConfigPanel';
import type { InitialSettingsProps } from './components/ConfigPanel';
import { Controls } from './components/Controls';
import { GenerationChart } from './components/GenerationChart';
import { HelpBar } from './components/HelpBar';
import { BreadcrumbTrail } from './components/BreadcrumbTrail';
import { ZoomablePanel } from './components/ZoomablePanel';
import { SpecimenPanel } from './components/SpecimenPanel';
import { MatedPairPanel } from './components/MatedPairPanel';
import { TabBar } from './components/TabBar';
import type { ActiveTab } from './components/TabBar';
import { PipelineBar } from './components/PipelineBar';
import { OperationPanel } from './components/OperationPanel';
import { HelpGlossary, HELP_SECTIONS, type HelpSectionId } from './components/HelpGlossary';
import { GettingStartedTab } from './components/GettingStartedTab';
import type { AlgorithmConfig, Specimen, GenerationResult, PoolOrigin, TimeCoordinate, BreedingPair } from './engine/types';
import { poolDisplayName, OPS_PER_GENERATION, SCREENS_PER_GENERATION, getOp, isPipelineEmpty, reconstructPipeline, GENERATION_OPS } from './engine/time-coordinate';
import { SubPhaseScreen } from './components/walkthrough/SubPhaseScreen';
import { CATEGORY_COLORS } from './components/walkthrough/SpecimenList';
import { createRandomSpecimen } from './engine/specimen';
import { PRESETS } from './data/presets';
import { colors } from './colors';

// Map URL path to tab id. Unknown paths fall back to 'getting-started'.
const tabFromPath = (path: string): ActiveTab => {
  const slug = path.replace(/^\//, '').toLowerCase();
  const valid: ActiveTab[] = ['getting-started', 'config', 'full', 'micro', 'help'];
  return (valid as string[]).includes(slug) ? slug as ActiveTab : 'getting-started';
};

const pathFromTab = (tab: ActiveTab): string => (tab === 'getting-started' ? '/' : `/${tab}`);

type SessionPhase = 'config' | 'running' | 'review';

interface WalkthroughState {
  operation: number;       // y-axis: 0–5
  result: GenerationResult;
  previousResult: GenerationResult | null;  // previous gen's result, for pair display at ops 0-1
  browsePairIndex: number;
}

const OP_TAB_LABELS = ['Age', 'Prune', 'Select', 'Chromosomes', 'Mutate', 'Birth'];

const CoordinatePanel: React.FC<{ coordinate: TimeCoordinate }> = ({ coordinate }) => {
  const op = getOp(coordinate.operation);
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-start', gap: 0, padding: '10px 24px 8px', flexShrink: 0, borderBottom: `1px solid ${colors.border.subtle}`, backgroundColor: colors.bg.raised }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }} data-help={`Generation ${coordinate.generation} — the current evolutionary cycle`}>
        <span style={{ fontSize: 28, fontFamily: 'monospace', fontWeight: 'bold', color: colors.text.primary, fontVariantNumeric: 'tabular-nums', minWidth: 28, textAlign: 'center', lineHeight: 1 }}>{coordinate.generation}</span>
        <span style={{ fontSize: 8, fontFamily: 'monospace', color: colors.text.disabled, textTransform: 'uppercase', letterSpacing: 1 }}>Generation</span>
      </div>
      <span style={{ fontSize: 28, fontFamily: 'monospace', fontWeight: 'bold', color: colors.border.strong, lineHeight: 1 }}>.</span>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }} data-help={`Operation ${coordinate.operation} — "${op.name}" (${op.category})`}>
        <span style={{ fontSize: 28, fontFamily: 'monospace', fontWeight: 'bold', color: colors.text.primary, fontVariantNumeric: 'tabular-nums', minWidth: 28, textAlign: 'center', lineHeight: 1 }}>{coordinate.operation}</span>
        <span style={{ fontSize: 8, fontFamily: 'monospace', color: colors.text.disabled, textTransform: 'uppercase', letterSpacing: 1 }}>Operation</span>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const algorithm = useBufferedAlgorithm();

  // Session lifecycle
  const [sessionPhase, setSessionPhase] = useState<SessionPhase>('config');

  // Walkthrough state
  const [walkthroughState, setWalkthroughState] = useState<WalkthroughState | null>(null);

  // Micro auto-play
  const [microPlaying, setMicroPlaying] = useState(false);
  const microIntervalRef = useRef<number | null>(null);

  // Pending auto-play: triggers play on next render after tab switch
  const pendingAutoPlayRef = useRef(false);

  // Tabs
  const [activeTab, setActiveTab] = useState<ActiveTab>(() => tabFromPath(window.location.pathname));
  const [showSpecimen, setShowSpecimen] = useState(false);
  const [helpSection, setHelpSection] = useState<HelpSectionId>('problem');

  // Push URL when tab changes
  const navigateTab = useCallback((tab: ActiveTab) => {
    setActiveTab(tab);
    const target = pathFromTab(tab);
    if (window.location.pathname !== target) {
      window.history.pushState(null, '', target);
    }
  }, []);

  // Handle browser back/forward buttons
  useEffect(() => {
    const onPopState = () => setActiveTab(tabFromPath(window.location.pathname));
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Derived granularity (for existing logic that uses it)
  const granularity: 'full' | 'micro' = activeTab === 'micro' ? 'micro' : 'full';

  // Ensure a result has a populated pipeline before entering micro mode.
  const withPipeline = useCallback((result: GenerationResult): GenerationResult => {
    if (!isPipelineEmpty(result)) return result;
    return { ...result, pipeline: reconstructPipeline(result, algorithm.peekUndoResult()) };
  }, [algorithm]);

  const handleStart = useCallback(
    (config: AlgorithmConfig) => {
      algorithm.start(config);
      setSessionPhase('running');
      setWalkthroughState(null);
    },
    [algorithm],
  );

  const handleTabChange = useCallback((tab: ActiveTab) => {
    if (tab === 'full') {
      setWalkthroughState(null);
      setShowSpecimen(false);
    } else if (tab === 'micro') {
      if (!walkthroughState && algorithm.lastResult) {
        setWalkthroughState({
          operation: OPS_PER_GENERATION - 1,
          result: withPipeline(algorithm.lastResult),
          previousResult: algorithm.peekUndoResult(),
          browsePairIndex: 0,
        });
      }
      setShowSpecimen(false);
    }
    navigateTab(tab);
  }, [walkthroughState, algorithm, withPipeline, navigateTab]);

  const handleOpenGlossary = useCallback((termId?: string) => {
    navigateTab('help');
    if (termId) {
      setTimeout(() => {
        document.getElementById(`glossary-${termId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 50);
    }
  }, [navigateTab]);

  // Lifted config input state (shared between Config tab and ConfigPanel)
  const [populationSize, setPopulationSize] = useState(100);
  const [crossoverMin, setCrossoverMin] = useState(1);
  const [crossoverMax, setCrossoverMax] = useState(6);
  const [mutationRate, setMutationRate] = useState(0.25);
  const [selectedPresetId, setSelectedPresetId] = useState<string>('quick-demo');

  const selectPreset = useCallback((id: string) => {
    setSelectedPresetId(id);
    const preset = PRESETS.find((p) => p.id === id);
    if (preset) {
      setPopulationSize(preset.config.populationSize);
      setCrossoverMin(preset.config.crossoverRange[0]);
      setCrossoverMax(preset.config.crossoverRange[1]);
      setMutationRate(preset.config.mutationRate);
    }
  }, []);

  const pendingConfig = useMemo<AlgorithmConfig>(() => ({
    populationSize,
    crossoverRange: [crossoverMin, crossoverMax],
    mutationRate,
  }), [populationSize, crossoverMin, crossoverMax, mutationRate]);
  const pendingConfigRef = useRef(pendingConfig);
  pendingConfigRef.current = pendingConfig;

  const initialSettingsProps: InitialSettingsProps = useMemo(() => ({
    sessionPhase,
    presets: PRESETS,
    algorithmConfig: algorithm.algorithmConfig ?? pendingConfig,
    populationSize,
    setPopulationSize,
    crossoverMin,
    setCrossoverMin,
    crossoverMax,
    setCrossoverMax,
    mutationRate,
    setMutationRate,
    selectedPresetId,
    setSelectedPresetId,
    selectPreset,
  }), [sessionPhase, algorithm.algorithmConfig, pendingConfig, populationSize, crossoverMin, crossoverMax, mutationRate, selectedPresetId, selectPreset]);

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

  // Random specimen shown before algorithm starts
  const [initialSpecimen, setInitialSpecimen] = useState<Specimen>(() => createRandomSpecimen(Math.floor(Math.random() * 50)));

  // Viewed specimen state
  const [viewedSpecimen, setViewedSpecimen] = useState<Specimen | null>(null);
  const [viewedOrigin, setViewedOrigin] = useState<PoolOrigin | null>(null);
  const [viewedPair, setViewedPair] = useState<BreedingPair | null>(null);

  const handleSelectSpecimen = useCallback((spec: Specimen, origin: PoolOrigin) => {
    setViewedSpecimen(spec);
    setViewedOrigin(origin);
    // In Granular Step tab, auto-switch to Specimen local sub-tab
    if (activeTab === 'micro') {
      setShowSpecimen(true);
    }
  }, [activeTab]);

  const handleSelectPair = useCallback((pair: BreedingPair) => {
    setViewedPair(pair);
  }, []);

  // Clear viewed specimen and pair when generation advances
  useEffect(() => {
    setViewedSpecimen(null);
    setViewedOrigin(null);
    setViewedPair(null);
  }, [algorithm.generation]);

  /** Auto-start the algorithm if still in config phase. */
  const ensureStarted = useCallback(() => {
    if (sessionPhase === 'config') {
      handleStart(pendingConfigRef.current);
    }
  }, [sessionPhase, handleStart]);

  const handleStartMicro = useCallback(() => {
    ensureStarted();
    const lastResult = algorithm.lastResult;
    if (lastResult) {
      const prevResult = withPipeline(lastResult);
      const result = algorithm.step();
      if (result) {
        setWalkthroughState({ operation: 0, result, previousResult: prevResult, browsePairIndex: 0 });
      }
    }
    setShowSpecimen(false);
    navigateTab('micro');
  }, [ensureStarted, algorithm, withPipeline, navigateTab]);

  const handleStartFull = useCallback(() => {
    ensureStarted();
    handleTabChange('full');
    pendingAutoPlayRef.current = true;
  }, [ensureStarted, handleTabChange]);

  const handleReset = useCallback((tab: ActiveTab = 'config') => {
    algorithm.start(pendingConfigRef.current);
    activeConfigRef.current = { ...pendingConfigRef.current };
    setViewedSpecimen(null);
    setViewedOrigin(null);
    setViewedPair(null);
    setSessionPhase('config');
    setWalkthroughState(null);
    navigateTab(tab);
    setShowSpecimen(false);
    setZoomedPanel(null);
    setInitialSpecimen(createRandomSpecimen(Math.floor(Math.random() * 50)));
    setResetKey((k) => k + 1);
  }, [algorithm, navigateTab]);

  const handleNewSession = useCallback(() => {
    handleReset();
  }, [handleReset]);

  // Pipeline bar navigation — switches to Micro tab and navigates to the clicked operation
  const handlePipelineNavigate = useCallback((operation: number) => {
    const wasConfig = sessionPhase === 'config';
    // Clicking the current position during config is a no-op
    if (wasConfig && operation === OPS_PER_GENERATION - 1) return;
    ensureStarted();
    setShowSpecimen(false);
    if (wasConfig) {
      // Auto-start from config: step to gen 1 and navigate there
      const result = algorithm.step();
      if (result) {
        if (activeTab !== 'micro') navigateTab('micro');
        setWalkthroughState({ operation, result, previousResult: algorithm.peekUndoResult(), browsePairIndex: 0 });
      }
      return;
    }
    // Gen 0 floor guard — don't allow navigating before the starting point
    const currentGen = walkthroughState?.result.generationNumber ?? algorithm.lastResult?.generationNumber ?? 0;
    if (currentGen === 0) {
      const currentOp = walkthroughState?.operation ?? OPS_PER_GENERATION - 1;
      if (operation < currentOp) return;
    }
    if (activeTab !== 'micro') {
      navigateTab('micro');
    }
    setWalkthroughState(prev => {
      if (prev) return { ...prev, operation, browsePairIndex: 0 };
      if (algorithm.lastResult) return { operation, result: withPipeline(algorithm.lastResult), previousResult: algorithm.peekUndoResult(), browsePairIndex: 0 };
      return prev;
    });
  }, [activeTab, walkthroughState, algorithm, ensureStarted, withPipeline, sessionPhase, navigateTab]);

  // Operation sub-tab click in Granular Step tab
  const handleSelectOperation = useCallback((op: number) => {
    const wasConfig = sessionPhase === 'config';
    ensureStarted();
    setShowSpecimen(false);
    if (wasConfig) {
      // Auto-start from config: step to gen 1 and navigate there
      const result = algorithm.step();
      if (result) {
        setWalkthroughState({ operation: op, result, previousResult: algorithm.peekUndoResult(), browsePairIndex: 0 });
      }
      return;
    }
    // Gen 0 floor guard — don't allow navigating before the starting point
    const currentGen = walkthroughState?.result.generationNumber ?? algorithm.lastResult?.generationNumber ?? 0;
    if (currentGen === 0) {
      const currentOp = walkthroughState?.operation ?? OPS_PER_GENERATION - 1;
      if (op < currentOp) return;
    }
    setWalkthroughState(prev => {
      if (prev) return { ...prev, operation: op, browsePairIndex: 0 };
      if (algorithm.lastResult) return { operation: op, result: withPipeline(algorithm.lastResult), previousResult: algorithm.peekUndoResult(), browsePairIndex: 0 };
      return prev;
    });
  }, [walkthroughState, algorithm, ensureStarted, withPipeline, sessionPhase]);


  // Walkthrough: advance to next operation. After last op, run next generation starting at op 0.
  const handleWalkThrough = useCallback(() => {
    ensureStarted();
    setShowSpecimen(false);
    if (!walkthroughState) {
      const result = algorithm.lastResult;
      if (result) {
        setWalkthroughState({ operation: OPS_PER_GENERATION - 1, result: withPipeline(result), previousResult: algorithm.peekUndoResult(), browsePairIndex: 0 });
      }
    } else if (walkthroughState.operation < OPS_PER_GENERATION - 1) {
      setWalkthroughState(prev => prev ? { ...prev, operation: prev.operation + 1 } : prev);
    } else {
      const prevResult = walkthroughState.result;
      const result = algorithm.step();
      if (result) {
        setWalkthroughState({ operation: 0, result, previousResult: prevResult, browsePairIndex: 0 });
      }
    }
  }, [walkthroughState, algorithm, ensureStarted, withPipeline]);

  // Micro jump: advance multiple micro steps at once, landing directly at the target operation.
  const handleMicroJump = useCallback((stepsToJump: number) => {
    ensureStarted();
    setShowSpecimen(false);
    if (!walkthroughState) {
      // Not yet walking — initialize at gen-0 end (same as handleWalkThrough first call)
      const result = algorithm.lastResult;
      if (result) {
        setWalkthroughState({ operation: OPS_PER_GENERATION - 1, result: withPipeline(result), previousResult: algorithm.peekUndoResult(), browsePairIndex: 0 });
      }
      return;
    }
    let remaining = walkthroughState.operation + stepsToJump;
    let result = walkthroughState.result;
    let prevResult = walkthroughState.previousResult;

    // Advance full generations as needed
    while (remaining >= SCREENS_PER_GENERATION) {
      remaining -= SCREENS_PER_GENERATION;
      prevResult = result;
      const stepped = algorithm.step();
      if (!stepped) return; // solved or error
      result = stepped;
    }

    // Use withPipeline if we crossed a generation boundary (result changed)
    const finalResult = result === walkthroughState.result ? result : withPipeline(result);
    setWalkthroughState({ operation: remaining, result: finalResult, previousResult: prevResult, browsePairIndex: 0 });
  }, [walkthroughState, algorithm, ensureStarted, withPipeline]);


  const handlePlay = useCallback((stepCount: number) => {
    ensureStarted();
    if (activeTab === 'micro') {
      setMicroPlaying(true);
      return;
    }
    setWalkthroughState(null);
    setShowSpecimen(false);
    algorithm.resume(stepCount, /* skipPipeline */ true);
  }, [ensureStarted, algorithm, activeTab]);

  // Auto-play after "Watch a Full Run" triggers tab switch
  useEffect(() => {
    if (pendingAutoPlayRef.current && activeTab === 'full') {
      pendingAutoPlayRef.current = false;
      handlePlay(1);
    }
  }, [activeTab, handlePlay]);

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
    if (microPlaying) {
      setMicroPlaying(false);
      return;
    }
    algorithm.pause();
  }, [algorithm, microPlaying]);

  // Spacebar toggles play/pause
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== ' ') return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      e.preventDefault();

      if (algorithm.running || microPlaying) {
        handlePause();
      } else if (!algorithm.solved) {
        handlePlay(1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [algorithm.running, algorithm.solved, microPlaying, handlePlay, handlePause]);

  // Keep a ref to handleWalkThrough so the interval always calls the latest version
  const walkThroughRef = useRef(handleWalkThrough);
  walkThroughRef.current = handleWalkThrough;

  // Micro auto-play: drive handleWalkThrough on an interval controlled by speed
  useEffect(() => {
    if (microIntervalRef.current != null) {
      clearInterval(microIntervalRef.current);
      microIntervalRef.current = null;
    }
    if (!microPlaying || algorithm.solved) {
      if (algorithm.solved) setMicroPlaying(false);
      return;
    }
    const delay = Math.max(1, 501 - algorithm.speed);
    microIntervalRef.current = window.setInterval(() => {
      walkThroughRef.current();
    }, delay);
    return () => {
      if (microIntervalRef.current != null) {
        clearInterval(microIntervalRef.current);
        microIntervalRef.current = null;
      }
    };
  }, [microPlaying, algorithm.speed, algorithm.solved]);

  // Stop micro auto-play when leaving micro tab
  useEffect(() => {
    if (activeTab !== 'micro') setMicroPlaying(false);
  }, [activeTab]);

  const handleBack = useCallback(() => {
    if (showSpecimen) {
      setShowSpecimen(false);
      return;
    }
    if (walkthroughState) {
      if (granularity === 'micro') {
        // Gen 0 is the chronological floor — back exits to getting-started
        if (walkthroughState.result.generationNumber === 0) {
          setWalkthroughState(null);
          handleReset('getting-started');
          return;
        }
        if (walkthroughState.operation > 0) {
          setWalkthroughState(prev => prev ? { ...prev, operation: prev.operation - 1 } : prev);
          return;
        }
        const restored = algorithm.goBack();
        if (restored) {
          setWalkthroughState({ operation: OPS_PER_GENERATION - 1, result: restored.result, previousResult: restored.previousResult, browsePairIndex: 0 });
        } else {
          setWalkthroughState(null);
          handleReset('getting-started');
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

  const hasStarted = algorithm.generation > 0 || algorithm.bestSpecimen !== null;

  // Display logic: viewed specimen takes priority, fall back to initial random
  const displaySpecimen = viewedSpecimen ?? algorithm.solutionSpecimen ?? algorithm.bestSpecimen ?? initialSpecimen;
  const displayIsBest = displaySpecimen != null && algorithm.bestSpecimen != null && displaySpecimen.id === algorithm.bestSpecimen.id;
  const displayIsSolution = displaySpecimen != null && displaySpecimen.fitness === 28;
  const displayOrigin: PoolOrigin | null = viewedOrigin
    ?? (hasStarted ? { coordinate: { generation: algorithm.generation, operation: OPS_PER_GENERATION - 1 }, pool: 'finalChildren' as const } : null);

  // Status message matching C# behavior
  const statusMessage = useMemo<{ label: string; value: string; specimen?: Specimen; origin?: PoolOrigin }>(() => {
    if (viewedSpecimen) {
      return { label: viewedOrigin ? poolDisplayName(viewedOrigin) : 'Specimen', value: `f:${viewedSpecimen.fitness}/28` };
    }
    const finalOrigin: PoolOrigin = { coordinate: { generation: algorithm.generation, operation: OPS_PER_GENERATION - 1 }, pool: 'finalChildren' as const };
    if (algorithm.solved && algorithm.solutionSpecimen) {
      const sol = algorithm.solutionSpecimen.solution.join(' ');
      return { label: 'Solution', value: `[${sol}]`, specimen: algorithm.solutionSpecimen, origin: finalOrigin };
    }
    if (algorithm.lastResult) {
      const best = algorithm.lastResult.bestSpecimen;
      const sol = best.solution.join(' ');
      return { label: 'Best specimen', value: `[${sol}]`, specimen: best, origin: finalOrigin };
    }
    return { label: 'Best specimen', value: '' };
  }, [viewedSpecimen, viewedOrigin, algorithm.solved, algorithm.solutionSpecimen, algorithm.lastResult, algorithm.generation]);

  // Pipeline bar coordinate
  const currentCoordinate: TimeCoordinate = walkthroughState
    ? { generation: walkthroughState.result.generationNumber, operation: walkthroughState.operation }
    : hasStarted
      ? { generation: algorithm.generation, operation: OPS_PER_GENERATION - 1 }
      : { generation: 0, operation: OPS_PER_GENERATION - 1 };

  // Can go back? In micro mode always allow back when walkthroughState exists —
  // handleBack handles gen 0 by resetting to getting-started.
  const canGoBackValue = showSpecimen
    ? true
    : walkthroughState
      ? true
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
        {hasStarted && <CoordinatePanel coordinate={currentCoordinate} />}
        <PipelineBar
          coordinate={currentCoordinate}
          onNavigate={handlePipelineNavigate}
          hasResult={!!algorithm.lastResult}
        />
        <BreadcrumbTrail
          sessionPhase={sessionPhase}
          activeTab={activeTab}
          walkthroughPhase={walkthroughState ? walkthroughState.operation : null}
          browsePairIndex={walkthroughState?.browsePairIndex ?? null}
          zoomedPanel={zoomedPanel}
          breedingCategory=""
          showSpecimen={showSpecimen}
          onTabChange={handleTabChange}
          onSetGranularity={(g) => handleTabChange(g)}
          onClearWalkthrough={() => setWalkthroughState(null)}
          onClearZoom={() => setZoomedPanel(null)}
          onClearSpecimen={() => setShowSpecimen(false)}
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
                  const isAtGenZero = (walkthroughState?.result.generationNumber ?? 0) === 0;
                  const currentOpIndex = walkthroughState?.operation ?? OPS_PER_GENERATION - 1;
                  const isBackwardAtFloor = isAtGenZero && idx < currentOpIndex;
                  return (
                    <div
                      key={idx}
                      style={{
                        ...styles.opTabWrapper,
                        ...(isActive ? styles.opTabWrapperActive : {}),
                        opacity: isBackwardAtFloor ? 0.25 : 1,
                      }}
                    >
                      <button
                        className="tab-nav"
                        onClick={() => handleSelectOperation(idx)}
                        disabled={isBackwardAtFloor}
                        data-help={isBackwardAtFloor ? "The algorithm is at its earliest step, so you can't traverse backwards." : `${op.category}: ${op.name}`}
                        style={{
                          ...styles.opTab,
                          '--tab-color': isActive ? opColor : colors.text.tertiary,
                          fontWeight: isActive ? 'bold' : 'normal',
                          cursor: isBackwardAtFloor ? 'not-allowed' : 'pointer',
                        } as React.CSSProperties}
                      >
                        {OP_TAB_LABELS[idx]}
                      </button>
                    </div>
                  );
                })}
                <div style={styles.opTabSep} />
                <div style={{ ...styles.opTabWrapper, ...(showSpecimen ? styles.opTabWrapperActive : {}) }}>
                  <button
                    className="tab-nav"
                    onClick={() => setShowSpecimen(true)}
                    data-help="Inspect a specimen's genome, fitness, parentage, and mutation"
                    style={{
                      ...styles.opTab,
                      '--tab-color': showSpecimen ? colors.accent.purple : colors.text.tertiary,
                      fontWeight: showSpecimen ? 'bold' : 'normal',
                    } as React.CSSProperties}
                  >
                    Specimen{viewedSpecimen ? ' \u25cf' : ''}
                  </button>
                </div>
              </>
            )}
            {activeTab === 'help' && HELP_SECTIONS.map((sec, index) => {
              const isActive = helpSection === sec.id;
              return (
                <div key={sec.id} style={{ ...styles.opTabWrapper, ...(isActive ? styles.opTabWrapperActive : {}), ...(isActive && index === 0 ? { borderTop: 'none' } : {}) }}>
                  <button
                    className="tab-nav"
                    onClick={() => setHelpSection(sec.id)}
                    data-help={sec.helpText}
                    style={{
                      ...styles.opTab,
                      '--tab-color': isActive ? colors.text.primary : colors.text.tertiary,
                      fontWeight: isActive ? 'bold' : 'normal',
                    } as React.CSSProperties}
                  >
                    {sec.label}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Phase tab strip — Before / Transform / After */}
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

        {/* ── Config tab ─────────────────────────────────────────── */}
        {activeTab === 'config' && (
          <div style={styles.configTab}>
            <div style={styles.configTabColumn}>
              <div style={styles.configTabPanel}>
                <h3 style={styles.configTabTitle} data-help="Set algorithm parameters before starting a run">Config</h3>
                <InitialSettings {...initialSettingsProps} />
              </div>
              {sessionPhase === 'config' && (
                <div style={styles.configStartButtons}>
                  <button style={styles.configStartBtn} onClick={handleStartMicro}>
                    Start Granular →
                  </button>
                  <button style={styles.configStartBtnSecondary} onClick={handleStartFull}>
                    Start Full →
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Full Step tab ───────────────────────────────────────── */}
        {activeTab === 'full' && (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          <div style={styles.controlsRow}>
            <Controls
              sessionPhase={sessionPhase}
              isRunning={algorithm.running}
              onPlay={handlePlay}
              onPause={handlePause}
              onStep={handleStep}
              onStepN={handleStepN}
              onBack={handleBack}
              canGoBack={canGoBackValue}
              onReset={handleReset}
              onNewSession={handleNewSession}
              speed={algorithm.speed}
              onSpeedChange={algorithm.setSpeed}
              solved={algorithm.solved}
              walkthroughPhase={null}
              isMicro={false}
              barStyle={styles.embeddedControls}
            />
          </div>
          <div style={styles.columns}>
            {/* Column 1: SubPhaseScreen (end of gen) */}
            <div style={{ ...styles.column, flex: '1.3 1 0' }}>
              <ZoomablePanel id="breeding" zoomedId={zoomedPanel} onZoom={setZoomedPanel} containerRef={mainRef} zoomedMaxWidth={900}>
                {walkthroughState ? (
                  <SubPhaseScreen
                    coordinate={{ generation: walkthroughState.result.generationNumber, operation: walkthroughState.operation }}
                    result={walkthroughState.result}
                    onSelectSpecimen={handleSelectSpecimen}
                    selectedId={viewedSpecimen?.id}
                    previousPipeline={walkthroughState.previousResult?.pipeline}
                    onSelectPair={handleSelectPair}
                    selectedPairIndex={viewedPair?.index}
                  />
                ) : algorithm.lastResult ? (
                  <SubPhaseScreen
                    coordinate={{ generation: algorithm.lastResult.generationNumber, operation: OPS_PER_GENERATION - 1 }}
                    result={withPipeline(algorithm.lastResult)}
                    onSelectSpecimen={handleSelectSpecimen}
                    selectedId={viewedSpecimen?.id}
                    onSelectPair={handleSelectPair}
                    selectedPairIndex={viewedPair?.index}
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
                  specimen={displaySpecimen}
                  showAttacks={hasStarted}
                  speed={algorithm.running ? Math.max(1, 501 - algorithm.speed) : undefined}
                  zoomed={zoomedPanel === 'board'}
                />
                <SpecimenPanel
                  specimen={displaySpecimen}
                  breedingData={algorithm.lastResult?.breedingData ?? null}
                  generation={algorithm.generation}
                  isBest={displayIsBest}
                  isSolution={displayIsSolution}
                  onSelectSpecimen={handleSelectSpecimen}
                  viewedOrigin={displayOrigin}
                />
              </ZoomablePanel>
            </div>

            {/* Column 3: Config */}
            <div style={{ ...styles.column, flex: '0.7 1 0' }}>
              <div style={styles.initialSettingsBox}>
                <InitialSettings {...initialSettingsProps} />
              </div>
              <ZoomablePanel id="config" zoomedId={zoomedPanel} onZoom={setZoomedPanel} containerRef={mainRef}>
                <ConfigPanel
                  key={`config-${resetKey}`}
                  stepStatistics={algorithm.lastResult?.stepStatistics ?? null}
                  cumulativeStats={algorithm.cumulativeStats}
                  generation={algorithm.generation}
                  bestFitness={algorithm.bestFitness}
                  avgFitness={algorithm.avgFitness}
                  solved={algorithm.solved}
                  statusMessage={statusMessage}
                  onStatusClick={statusMessage?.specimen && statusMessage?.origin ? () => {
                    handleSelectSpecimen(statusMessage.specimen!, statusMessage.origin!);
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
        )}

        {/* ── Granular Step tab ───────────────────────────────────── */}
        {activeTab === 'micro' && (
          <div style={styles.microContent}>
          <div style={styles.controlsRow}>
            <Controls
              sessionPhase={sessionPhase}
              isRunning={microPlaying}
              onPlay={handlePlay}
              onPause={handlePause}
              onStep={handleWalkThrough}
              onStepN={handleStepN}
              onMicroStepN={handleMicroJump}
              onBack={handleBack}
              canGoBack={canGoBackValue}
              onReset={handleReset}
              onNewSession={handleNewSession}
              speed={algorithm.speed}
              onSpeedChange={algorithm.setSpeed}
              solved={algorithm.solved}
              walkthroughPhase={walkthroughState ? walkthroughState.operation : null}
              isMicro={true}
              barStyle={styles.embeddedControls}
            />
          </div>
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
                    specimen={displaySpecimen}
                    showAttacks={hasStarted}
                    speed={algorithm.running ? Math.max(1, 501 - algorithm.speed) : undefined}
                    zoomed
                  />
                </div>
                <div style={styles.specimenDetailCol}>
                  <SpecimenPanel
                    specimen={displaySpecimen}
                    breedingData={algorithm.lastResult?.breedingData ?? null}
                    generation={algorithm.generation}
                    isBest={displayIsBest}
                    isSolution={displayIsSolution}
                    onSelectSpecimen={handleSelectSpecimen}
                    viewedOrigin={displayOrigin}
                  />
                </div>
                <div style={styles.specimenDetailCol}>
                  <MatedPairPanel
                    pair={viewedPair}
                    breedingData={algorithm.lastResult?.breedingData ?? null}
                    generation={algorithm.generation}
                    onSelectSpecimen={handleSelectSpecimen}
                    onSelectPair={handleSelectPair}
                    viewedSpecimen={viewedSpecimen}
                  />
                </div>
              </div>
            </div>
          ) : walkthroughState ? (
            <OperationPanel
              operation={walkthroughState.operation}
              result={walkthroughState.result}
              onSelectSpecimen={handleSelectSpecimen}
              previousPipeline={walkthroughState.previousResult?.pipeline}
              onSelectPair={handleSelectPair}
              selectedPairIndex={viewedPair?.index}
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
    paddingTop: 12,
    paddingBottom: 12,
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
    padding: '12px 24px',
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
  opTabWrapper: {
    // Padding (not border) reserves the 1px space for inactive tabs.
    // Do NOT use bg-colored borders here — they render as visible grey
    // lines because the border color won't perfectly match the painted bg.
    padding: '1px 0 1px 1px',
    position: 'relative' as const,
    marginBottom: -1,
    zIndex: 0,
  },
  opTabWrapperActive: {
    padding: 0,
    borderLeft: `1px solid ${colors.border.subtle}`,
    borderTop: `1px solid ${colors.border.subtle}`,
    borderBottom: `1px solid ${colors.border.subtle}`,
    borderRight: 'none',
    backgroundColor: colors.bg.raised,
    marginRight: -1,
    zIndex: 1,
  },
  opTab: {
    padding: '10px 16px',
    fontSize: 12,
    fontFamily: 'monospace',
    background: 'none',
    WebkitAppearance: 'none' as const,
    appearance: 'none' as const,
    outline: 'none',
    border: 'none',
    width: '100%',
    display: 'block' as const,
    whiteSpace: 'nowrap' as const,
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
  controlsRow: {
    display: 'flex',
    justifyContent: 'center',
    flexShrink: 0,
    borderBottom: `1px solid ${colors.border.subtle}`,
  },
  embeddedControls: {
    backgroundColor: 'transparent',
    borderBottom: 'none',
    padding: '10px 16px',
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
    overflow: 'hidden' as const,
  },
  specimenBoard: {
    flexShrink: 0,
    alignSelf: 'stretch',
    aspectRatio: '1',
  },
  specimenDetailCol: {
    flex: 1,
    minWidth: 0,
    overflowY: 'auto' as const,
  },
  initialSettingsBox: {
    backgroundColor: colors.bg.surface,
    borderRadius: 8,
    padding: 16,
    border: `1px solid ${colors.border.subtle}`,
    boxSizing: 'border-box' as const,
  },
  configTab: {
    display: 'flex',
    justifyContent: 'center',
    paddingTop: 24,
    flex: 1,
  },
  configTabColumn: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignSelf: 'flex-start',
    minWidth: 260,
    maxWidth: 360,
  },
  configTabPanel: {
    backgroundColor: colors.bg.surface,
    borderRadius: 8,
    padding: 16,
    border: `1px solid ${colors.border.subtle}`,
  },
  configTabTitle: {
    margin: '0 0 12px 0',
    fontSize: 14,
    fontFamily: 'monospace',
    color: colors.text.secondary,
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
  },
  configStartButtons: {
    display: 'flex',
    gap: 8,
    marginTop: 8,
  },
  configStartBtn: {
    flex: 1,
    padding: '7px 0',
    fontSize: 11,
    fontFamily: 'monospace',
    fontWeight: 'bold',
    backgroundColor: colors.accent.purple,
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    cursor: 'pointer',
    letterSpacing: 0.3,
  },
  configStartBtnSecondary: {
    flex: 1,
    padding: '7px 0',
    fontSize: 11,
    fontFamily: 'monospace',
    backgroundColor: colors.bg.raised,
    color: colors.text.secondary,
    border: `1px solid ${colors.border.subtle}`,
    borderRadius: 4,
    cursor: 'pointer',
    letterSpacing: 0.3,
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
