import React from 'react';
import type { AlgorithmConfig } from '../engine/types';
import { MAX_FITNESS } from '../engine/types';

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
        <Stat label="Generation" value={generation.toLocaleString()} />
        <Stat
          label="Best Fitness"
          value={`${bestFitness}/${MAX_FITNESS}`}
          highlight={bestFitness === MAX_FITNESS}
        />
        <Stat label="Avg Fitness" value={avgFitness.toFixed(1)} />
        <Stat
          label="Status"
          value={solved ? 'SOLVED' : generation === 0 ? 'Ready' : 'Running'}
          highlight={solved}
        />
      </div>
      {algorithmConfig && (
        <div style={styles.configRow}>
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
}> = ({ label, value, highlight }) => (
  <div style={styles.stat}>
    <span style={styles.statLabel}>{label}</span>
    <span
      style={{
        ...styles.statValue,
        color: highlight ? '#4caf50' : '#e0e0e0',
      }}
    >
      {value}
    </span>
  </div>
);

const styles: Record<string, React.CSSProperties> = {
  panel: {
    backgroundColor: '#1a1a2e',
    borderRadius: 8,
    padding: 10,
    border: '1px solid #2a2a4a',
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
    color: '#777',
    lineHeight: 1.3,
    wordBreak: 'break-all' as const,
  },
  message: {
    marginTop: 6,
    fontSize: 10,
    fontFamily: 'monospace',
    color: '#ccc',
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
    color: '#777',
    textTransform: 'uppercase',
  },
  statValue: {
    fontSize: 14,
    fontFamily: 'monospace',
    fontWeight: 'bold',
  },
};
