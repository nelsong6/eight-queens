import React, { useEffect, useState } from 'react';
import type { AlgorithmConfig, StepStatistics, CumulativeStatistics } from '../engine/types';
import { DEFAULT_CONFIG, MAX_FITNESS } from '../engine/types';
import type { Preset } from '../api/client';

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
  statusMessage?: string;
}

const StatRow: React.FC<{ label: string; value: string; help?: string }> = ({ label, value, help }) => (
  <div style={styles.statRow} data-help={help}>
    <span style={styles.statLabel}>{label}</span>
    <span style={styles.statValue}>{value}</span>
  </div>
);

export const ConfigPanel: React.FC<Props> = ({
  onConfigChange,
  sessionPhase,
  presets,
  algorithmConfig,
  stepStatistics,
  cumulativeStats,
}) => {
  const isConfig = sessionPhase === 'config';
  const [populationSize, setPopulationSize] = useState(100);
  const [crossoverMin, setCrossoverMin] = useState(DEFAULT_CONFIG.crossoverRange[0]);
  const [crossoverMax, setCrossoverMax] = useState(DEFAULT_CONFIG.crossoverRange[1]);
  const [mutationRate, setMutationRate] = useState(DEFAULT_CONFIG.mutationRate);
  const [selectedPresetId, setSelectedPresetId] = useState<string>('quick-demo');

  const handlePresetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    setSelectedPresetId(id);
    const preset = presets.find((p) => p.id === id);
    if (preset) {
      setPopulationSize(preset.config.populationSize);
      setCrossoverMin(preset.config.crossoverRange[0]);
      setCrossoverMax(preset.config.crossoverRange[1]);
      setMutationRate(preset.config.mutationRate);
    }
  };

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
          <select
            value={selectedPresetId}
            onChange={handlePresetChange}
            disabled={!isConfig}
            data-help="Load a predefined configuration"
            style={{ ...styles.presetSelect, opacity: isConfig ? 1 : 0.4 }}
          >
            <option value="">Custom</option>
            {presets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        {/* Population */}
        <div style={styles.statRow} data-help="Number of individuals created each generation">
          <span style={styles.statLabel}>Population</span>
          {isConfig ? (
            <input
              type="number"
              min={50}
              max={50000}
              step={50}
              value={populationSize}
              onChange={(e) => { setSelectedPresetId(''); setPopulationSize(Number(e.target.value)); }}
              style={styles.inlineInput}
            />
          ) : (
            <span style={styles.statValue}>{displayPop.toLocaleString()}</span>
          )}
        </div>

        {/* Crossover */}
        <div style={styles.statRow} data-help="Gene position range where chromosomes can be split during breeding">
          <span style={styles.statLabel}>Crossover</span>
          {isConfig ? (
            <span style={styles.inlineGroup}>
              [<input
                type="number"
                min={1}
                max={6}
                value={crossoverMin}
                onChange={(e) => { setSelectedPresetId(''); setCrossoverMin(Number(e.target.value)); }}
                style={styles.inlineInputSmall}
              />, <input
                type="number"
                min={1}
                max={6}
                value={crossoverMax}
                onChange={(e) => { setSelectedPresetId(''); setCrossoverMax(Number(e.target.value)); }}
                style={styles.inlineInputSmall}
              />]
            </span>
          ) : (
            <span style={styles.statValue}>[{displayCrossMin}, {displayCrossMax}]</span>
          )}
        </div>

        {/* Mutation */}
        <div style={styles.statRow} data-help="Probability of a random gene change after crossover">
          <span style={styles.statLabel}>Mutation</span>
          {isConfig ? (
            <span style={styles.inlineGroup}>
              <input
                type="number"
                min={0}
                max={100}
                value={Math.round(mutationRate * 100)}
                onChange={(e) => { setSelectedPresetId(''); setMutationRate(Number(e.target.value) / 100); }}
                style={styles.inlineInputSmall}
              />%
            </span>
          ) : (
            <span style={styles.statValue}>{(displayMut * 100).toFixed(0)}%</span>
          )}
        </div>
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
    backgroundColor: '#1a1a2e',
    borderRadius: 8,
    padding: 16,
    border: '1px solid #2a2a4a',
    flex: '1 1 200px',
    minWidth: 180,
  },
  title: {
    margin: '0 0 12px 0',
    fontSize: 14,
    fontFamily: 'monospace',
    color: '#aaa',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  presetSelect: {
    padding: '2px 6px',
    fontSize: 9,
    fontFamily: 'monospace',
    backgroundColor: '#2a2a4a',
    color: '#e0e0e0',
    border: '1px solid #3a3a5a',
    borderRadius: 3,
    cursor: 'pointer',
    flexShrink: 0,
  },
  section: {
    marginBottom: 10,
  },
  sectionTitleRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid #2a2a4a',
    paddingBottom: 2,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 10,
    fontFamily: 'monospace',
    color: '#6c5ce7',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
    borderBottom: '1px solid #2a2a4a',
    paddingBottom: 2,
  },
  statRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '2px 0',
  },
  statLabel: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: '#888',
  },
  statValue: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: '#e0e0e0',
    fontWeight: 'bold',
  },
  inlineInput: {
    width: 70,
    padding: '1px 4px',
    fontSize: 11,
    fontFamily: 'monospace',
    fontWeight: 'bold',
    backgroundColor: '#2a2a4a',
    color: '#e0e0e0',
    border: '1px solid #3a3a5a',
    borderRadius: 3,
    textAlign: 'right' as const,
  },
  inlineInputSmall: {
    width: 32,
    padding: '1px 3px',
    fontSize: 11,
    fontFamily: 'monospace',
    fontWeight: 'bold',
    backgroundColor: '#2a2a4a',
    color: '#e0e0e0',
    border: '1px solid #3a3a5a',
    borderRadius: 3,
    textAlign: 'right' as const,
  },
  inlineGroup: {
    fontSize: 11,
    fontFamily: 'monospace',
    fontWeight: 'bold',
    color: '#e0e0e0',
    display: 'flex',
    alignItems: 'center',
    gap: 2,
  },
};
