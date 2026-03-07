import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { AlgorithmConfig, StepStatistics, CumulativeStatistics } from '../engine/types';
import { DEFAULT_CONFIG, MAX_FITNESS } from '../engine/types';
import type { Preset } from '../data/presets';
import { colors } from '../colors';

/** Makes a number input respond to mousewheel on hover (no focus required). */
function useWheelInput(
  value: number,
  setValue: (v: number) => void,
  opts: { min: number; max: number; step?: number; enabled: boolean; clearPreset: () => void },
) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !opts.enabled) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const step = opts.step ?? 1;
      const delta = e.deltaY < 0 ? step : -step;
      const next = Math.min(opts.max, Math.max(opts.min, value + delta));
      if (next !== value) {
        opts.clearPreset();
        setValue(next);
      }
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, [value, setValue, opts.min, opts.max, opts.step, opts.enabled, opts.clearPreset]);
  return ref;
}

type SessionPhase = 'config' | 'running' | 'review';

interface Props {
  onConfigChange: (config: AlgorithmConfig) => void;
  sessionPhase: SessionPhase;
  presets: Preset[];
  algorithmConfig: AlgorithmConfig | null;
  stepStatistics: StepStatistics | null;
  cumulativeStats: CumulativeStatistics | null;
  generation: number;
  bestFitness: number;
  avgFitness: number;
  solved: boolean;
  statusMessage?: { label: string; value: string } | null;
  onStatusClick?: () => void;
}

const StatRow: React.FC<{ label: string; value: string; help?: string; onClick?: () => void }> = ({ label, value, help, onClick }) => (
  <div
    style={{ ...styles.statRow, ...(onClick ? { cursor: 'pointer' } : undefined) }}
    data-help={help}
    onClick={onClick}
  >
    <span style={{ ...styles.statLabel, ...(onClick ? { textDecoration: 'underline', textDecorationStyle: 'dotted' as const } : undefined) }}>{label}</span>
    <span style={{ ...styles.statValue, ...(onClick ? { textDecoration: 'underline', textDecorationStyle: 'dotted' as const } : undefined) }}>{value}</span>
  </div>
);

export const ConfigPanel: React.FC<Props> = ({
  onConfigChange,
  sessionPhase,
  presets,
  algorithmConfig,
  stepStatistics,
  cumulativeStats,
  generation,
  bestFitness,
  avgFitness,
  solved,
  statusMessage,
  onStatusClick,
}) => {
  const isConfig = sessionPhase === 'config';
  const [populationSize, setPopulationSize] = useState(100);
  const [crossoverMin, setCrossoverMin] = useState(DEFAULT_CONFIG.crossoverRange[0]);
  const [crossoverMax, setCrossoverMax] = useState(DEFAULT_CONFIG.crossoverRange[1]);
  const [mutationRate, setMutationRate] = useState(DEFAULT_CONFIG.mutationRate);
  const [selectedPresetId, setSelectedPresetId] = useState<string>('quick-demo');

  const clearPreset = useCallback(() => setSelectedPresetId(''), []);

  const popRef = useWheelInput(populationSize, setPopulationSize, { min: 50, max: 50000, step: 50, enabled: isConfig, clearPreset });
  const crossMinRef = useWheelInput(crossoverMin, setCrossoverMin, { min: 1, max: 6, enabled: isConfig, clearPreset });
  const crossMaxRef = useWheelInput(crossoverMax, setCrossoverMax, { min: 1, max: 6, enabled: isConfig, clearPreset });
  const mutationDisplay = isConfig ? Math.round(mutationRate * 100) : Math.round((algorithmConfig?.mutationRate ?? 0) * 100);
  const setMutationFromPercent = useCallback((v: number) => setMutationRate(v / 100), []);
  const mutRef = useWheelInput(mutationDisplay, setMutationFromPercent, { min: 0, max: 100, enabled: isConfig, clearPreset });

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectPreset = (id: string) => {
    setSelectedPresetId(id);
    setDropdownOpen(false);
    const preset = presets.find((p) => p.id === id);
    if (preset) {
      setPopulationSize(preset.config.populationSize);
      setCrossoverMin(preset.config.crossoverRange[0]);
      setCrossoverMax(preset.config.crossoverRange[1]);
      setMutationRate(preset.config.mutationRate);
    }
  };

  useEffect(() => {
    if (!dropdownOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [dropdownOpen]);

  useEffect(() => {
    onConfigChange({
      populationSize,
      crossoverRange: [crossoverMin, crossoverMax],
      mutationRate,
    });
  }, [populationSize, crossoverMin, crossoverMax, mutationRate, onConfigChange]);

  // Display values: use local state in config, frozen algorithmConfig when running
  const displayPop = isConfig ? populationSize : algorithmConfig?.populationSize ?? 0;
  const displayCrossMin = isConfig ? crossoverMin : (algorithmConfig?.crossoverRange[0] ?? 0);
  const displayCrossMax = isConfig ? crossoverMax : (algorithmConfig?.crossoverRange[1] ?? 0);
  const displayMut = isConfig ? mutationRate : (algorithmConfig?.mutationRate ?? 0);

  return (
    <div style={styles.panel}>
      <h3 style={styles.title} data-help="Detailed statistics for the current algorithm run">Session Data</h3>

      {/* Initial Settings */}
      <div style={styles.section}>
        <div style={styles.sectionTitleRow}>
          <div style={{ ...styles.sectionTitle, borderBottom: 'none', marginBottom: 0, paddingBottom: 0 }} data-help={isConfig ? "Set algorithm parameters before starting a run" : "Algorithm parameters set before the run started"}>
            Initial Settings
          </div>
          <div ref={dropdownRef} style={{ position: 'relative' as const }} data-help="Load a predefined configuration">
            <button
              onClick={() => isConfig && setDropdownOpen((o) => !o)}
              disabled={!isConfig}
              style={{ ...styles.presetSelect, opacity: isConfig ? 1 : 0.4 }}
            >
              {presets.find((p) => p.id === selectedPresetId)?.name ?? 'Custom'} &#x25BE;
            </button>
            {dropdownOpen && (
              <div style={styles.dropdownMenu}>
                <div
                  style={styles.dropdownItem}
                  data-help="Manually configured parameters"
                  onClick={() => { setSelectedPresetId(''); setDropdownOpen(false); }}
                >
                  Custom
                </div>
                {presets.map((p) => (
                  <div
                    key={p.id}
                    style={{
                      ...styles.dropdownItem,
                      ...(p.id === selectedPresetId ? styles.dropdownItemActive : {}),
                    }}
                    data-help={p.description}
                    onClick={() => selectPreset(p.id)}
                  >
                    {p.name}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        {/* Population */}
        <div style={styles.statRow} data-help="Number of individuals created each generation. Use mousewheel or arrow keys to adjust.">
          <span style={styles.statLabel}>Population</span>
          <input
            ref={popRef}
            type="number"
            min={50}
            max={50000}
            step={50}
            value={displayPop}
            onChange={(e) => { setSelectedPresetId(''); setPopulationSize(Number(e.target.value)); }}
            disabled={!isConfig}
            style={{ ...styles.inlineInput, ...(isConfig ? {} : styles.lockedInput) }}
          />
        </div>

        {/* Crossover */}
        <div style={styles.statRow} data-help="Gene position range where chromosomes can be split during breeding. Use mousewheel or arrow keys to adjust.">
          <span style={styles.statLabel}>Crossover</span>
          <span style={styles.inlineGroup}>
            [<input
              ref={crossMinRef}
              type="number"
              min={1}
              max={6}
              value={displayCrossMin}
              onChange={(e) => { setSelectedPresetId(''); setCrossoverMin(Number(e.target.value)); }}
              disabled={!isConfig}
              style={{ ...styles.inlineInputSmall, ...(isConfig ? {} : styles.lockedInput) }}
            />, <input
              ref={crossMaxRef}
              type="number"
              min={1}
              max={6}
              value={displayCrossMax}
              onChange={(e) => { setSelectedPresetId(''); setCrossoverMax(Number(e.target.value)); }}
              disabled={!isConfig}
              style={{ ...styles.inlineInputSmall, ...(isConfig ? {} : styles.lockedInput) }}
            />]
          </span>
        </div>

        {/* Mutation */}
        <div style={styles.statRow} data-help="Probability of a random gene change after crossover. Use mousewheel or arrow keys to adjust.">
          <span style={styles.statLabel}>Mutation</span>
          <span style={styles.inlineGroup}>
            <input
              ref={mutRef}
              type="number"
              min={0}
              max={100}
              value={isConfig ? Math.round(mutationRate * 100) : Math.round(displayMut * 100)}
              onChange={(e) => { setSelectedPresetId(''); setMutationRate(Number(e.target.value) / 100); }}
              disabled={!isConfig}
              style={{ ...styles.inlineInputSmall, ...(isConfig ? {} : styles.lockedInput) }}
            />%
          </span>
        </div>

      </div>

      {/* Status */}
      <div style={styles.section}>
        <div style={styles.sectionTitle} data-help="Current progress of the algorithm">Status</div>
        <StatRow label="Generation" value={generation.toLocaleString()} help="Number of evolutionary cycles completed so far" />
        <StatRow
          label="Best Fitness"
          value={`${bestFitness}/${MAX_FITNESS}`}
          help="Highest fitness score in the current population — 28/28 means a valid solution"
        />
        <StatRow label="Avg Fitness" value={avgFitness.toFixed(1)} help="Mean fitness across all individuals in the current generation" />
        <StatRow
          label="State"
          value={solved ? 'SOLVED' : generation === 0 ? 'Ready' : 'Running'}
          help="Current state of the algorithm — Ready, Running, or Solved"
        />
        {statusMessage && (
          <StatRow label={statusMessage.label} value={statusMessage.value || '\u00A0'} onClick={onStatusClick} />
        )}
      </div>

      {/* Totals This Step */}
      <div style={styles.section}>
        <div style={styles.sectionTitle} data-help="Statistics from the most recent generation">Totals This Step</div>
        <StatRow
          label="Eligible Parents"
          value={stepStatistics?.eligibleParentsCount.toLocaleString() ?? '--'}
          help="Individuals with fitness above zero that can be selected for breeding"
        />
        <StatRow
          label="Avg Fitness (Eligible)"
          value={stepStatistics?.avgFitnessEligibleParents.toFixed(2) ?? '--'}
          help="Mean fitness of all individuals eligible for selection"
        />
        <StatRow
          label="Actual Parents"
          value={stepStatistics?.actualParentsCount.toLocaleString() ?? '--'}
          help="Individuals actually chosen by roulette wheel selection to breed"
        />
        <StatRow
          label="Avg Fitness (Actual)"
          value={stepStatistics?.avgFitnessActualParents.toFixed(2) ?? '--'}
          help="Mean fitness of selected parents — should be higher than eligible average if selection pressure works"
        />
        <StatRow
          label="Children"
          value={stepStatistics?.childrenCount.toLocaleString() ?? '--'}
          help="Offspring produced by crossover this generation"
        />
        <StatRow
          label="Avg Fitness (Children)"
          value={stepStatistics?.avgFitnessChildren.toFixed(2) ?? '--'}
          help="Mean fitness of newly created children"
        />
        <StatRow
          label="Mutations"
          value={stepStatistics?.mutationCount.toLocaleString() ?? '--'}
          help="Number of random gene changes applied to children this generation"
        />
      </div>

      {/* Cumulative Totals */}
      <div style={styles.section}>
        <div style={styles.sectionTitle} data-help="Running totals across all generations">Cumulative Totals</div>
        <StatRow
          label="Total Eligible Parents"
          value={cumulativeStats?.totalEligibleParents.toLocaleString() ?? '--'}
          help="Sum of eligible parents across all generations"
        />
        <StatRow
          label="Avg Fitness Increase"
          value={cumulativeStats?.avgFitnessIncrease.toFixed(4) ?? '--'}
          help="Average improvement in best fitness per generation"
        />
        <StatRow
          label="Total Actual Parents"
          value={cumulativeStats?.totalActualParents.toLocaleString() ?? '--'}
          help="Sum of selected parents across all generations"
        />
        <StatRow
          label="Total Children"
          value={cumulativeStats?.totalChildren.toLocaleString() ?? '--'}
          help="Sum of children produced across all generations"
        />
        <StatRow
          label="Total Mutations"
          value={cumulativeStats?.totalMutations.toLocaleString() ?? '--'}
          help="Sum of mutations applied across all generations"
        />
        <StatRow
          label="Iterations"
          value={cumulativeStats?.iterationCount.toLocaleString() ?? '--'}
          help="Total number of breeding iterations performed"
        />
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  panel: {
    backgroundColor: colors.bg.surface,
    borderRadius: 8,
    padding: 16,
    border: `1px solid ${colors.border.subtle}`,
    flex: 1,
    minWidth: 180,
    minHeight: 0,
    overflowY: 'auto' as const,
    boxSizing: 'border-box' as const,
  },
  title: {
    margin: '0 0 12px 0',
    fontSize: 14,
    fontFamily: 'monospace',
    color: colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  presetSelect: {
    padding: '2px 6px',
    fontSize: 9,
    fontFamily: 'monospace',
    backgroundColor: colors.bg.overlay,
    color: colors.text.primary,
    border: `1px solid ${colors.border.strong}`,
    borderRadius: 3,
    cursor: 'pointer',
    flexShrink: 0,
  },
  dropdownMenu: {
    position: 'absolute' as const,
    top: '100%',
    right: 0,
    marginTop: 2,
    backgroundColor: colors.bg.overlay,
    border: `1px solid ${colors.border.strong}`,
    borderRadius: 3,
    zIndex: 10,
    minWidth: 120,
  },
  dropdownItem: {
    padding: '4px 8px',
    fontSize: 9,
    fontFamily: 'monospace',
    color: colors.text.primary,
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
  },
  dropdownItemActive: {
    backgroundColor: colors.border.strong,
  },
  section: {
    marginBottom: 10,
  },
  sectionTitleRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: `1px solid ${colors.border.subtle}`,
    paddingBottom: 2,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 10,
    fontFamily: 'monospace',
    color: colors.accent.purple,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
    borderBottom: `1px solid ${colors.border.subtle}`,
    paddingBottom: 2,
  },
  statRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '2px 0',
    minHeight: 22,
  },
  statLabel: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: colors.text.tertiary,
  },
  statValue: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: colors.text.primary,
    fontWeight: 'bold',
    minWidth: 70,
    textAlign: 'right' as const,
  },
  inlineInput: {
    width: 70,
    padding: '1px 4px',
    fontSize: 11,
    fontFamily: 'monospace',
    fontWeight: 'bold',
    backgroundColor: colors.bg.overlay,
    color: colors.text.primary,
    border: `1px solid ${colors.border.strong}`,
    borderRadius: 3,
    textAlign: 'right' as const,
  },
  inlineInputSmall: {
    width: 32,
    padding: '1px 3px',
    fontSize: 11,
    fontFamily: 'monospace',
    fontWeight: 'bold',
    backgroundColor: colors.bg.overlay,
    color: colors.text.primary,
    border: `1px solid ${colors.border.strong}`,
    borderRadius: 3,
    textAlign: 'right' as const,
  },
  statusMessage: {
    marginTop: 6,
    fontSize: 10,
    fontFamily: 'monospace',
    color: colors.text.secondary,
    lineHeight: 1.3,
    whiteSpace: 'pre-line' as const,
  },
  lockedInput: {
    opacity: 0.7,
    cursor: 'default',
  },
  inlineGroup: {
    fontSize: 11,
    fontFamily: 'monospace',
    fontWeight: 'bold',
    color: colors.text.primary,
    display: 'flex',
    alignItems: 'center',
    gap: 2,
  },
};
