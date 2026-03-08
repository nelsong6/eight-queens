import React from 'react';
import type { AlgorithmConfig } from '../engine/types';
import { MAX_FITNESS } from '../engine/types';
import { colors } from '../colors';

interface Props {
  generation: number;
  bestFitness: number;
  avgFitness: number;
  solved: boolean;
  algorithmConfig: AlgorithmConfig | null;
  message?: string;
}

export const StatusBar: React.FC<Props> = ({
  generation,
  bestFitness,
  avgFitness,
  solved,
  algorithmConfig,
  message,
}) => {
  return (
    <div style={styles.panel}>
      <div style={styles.row}>
        <Stat label="Current completed generation" value={generation.toLocaleString()} help="Number of evolutionary cycles completed so far" />
        <Stat
          label="Best Fitness"
          value={`${bestFitness}/${MAX_FITNESS}`}
          highlight={bestFitness === MAX_FITNESS}
          help="Highest fitness score in the current population — 28/28 means a valid solution"
        />
        <Stat label="Avg Fitness" value={avgFitness.toFixed(1)} help="Mean fitness across all specimens in the current generation" />
        <Stat
          label="Status"
          value={solved ? 'SOLVED' : generation === 0 ? 'Ready' : 'Running'}
          highlight={solved}
          help="Current state of the algorithm — Ready, Running, or Solved"
        />
      </div>
      {algorithmConfig && (
        <div style={styles.configRow} data-help="Active algorithm parameters for this session">
          Pop: {algorithmConfig.populationSize.toLocaleString()} | Crossover: [
          {algorithmConfig.crossoverRange[0]},{algorithmConfig.crossoverRange[1]}] |
          Mutation: {(algorithmConfig.mutationRate * 100).toFixed(0)}%
        </div>
      )}
      {message && (
        <div style={styles.message}>{message}</div>
      )}
    </div>
  );
};

const Stat: React.FC<{
  label: string;
  value: string;
  highlight?: boolean;
  help?: string;
}> = ({ label, value, highlight, help }) => (
  <div style={styles.stat} data-help={help}>
    <span style={styles.statLabel}>{label}</span>
    <span
      style={{
        ...styles.statValue,
        color: highlight ? colors.accent.green : colors.text.primary,
      }}
    >
      {value}
    </span>
  </div>
);

const styles: Record<string, React.CSSProperties> = {
  panel: {
    backgroundColor: colors.bg.surface,
    borderRadius: 8,
    padding: 10,
    border: `1px solid ${colors.border.subtle}`,
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
  },
  row: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '6px 10px',
  },
  configRow: {
    marginTop: 6,
    fontSize: 9,
    fontFamily: 'monospace',
    color: colors.text.tertiary,
    lineHeight: 1.3,
    wordBreak: 'break-all' as const,
  },
  message: {
    marginTop: 6,
    fontSize: 10,
    fontFamily: 'monospace',
    color: colors.text.secondary,
    lineHeight: 1.3,
  },
  stat: {
    display: 'flex',
    flexDirection: 'column',
    gap: 1,
  },
  statLabel: {
    fontSize: 9,
    fontFamily: 'monospace',
    color: colors.text.tertiary,
    textTransform: 'uppercase',
  },
  statValue: {
    fontSize: 14,
    fontFamily: 'monospace',
    fontWeight: 'bold',
  },
};
