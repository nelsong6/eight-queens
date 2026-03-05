import React from 'react';
import type { AlgorithmConfig, StepStatistics, CumulativeStatistics } from '../engine/types';

interface Props {
  algorithmConfig: AlgorithmConfig | null;
  stepStatistics: StepStatistics | null;
  cumulativeStats: CumulativeStatistics | null;
}

const StatRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div style={styles.statRow}>
    <span style={styles.statLabel}>{label}</span>
    <span style={styles.statValue}>{value}</span>
  </div>
);

export const SessionStatistics: React.FC<Props> = ({
  algorithmConfig,
  stepStatistics,
  cumulativeStats,
}) => {
  return (
    <div style={styles.panel}>
      <div style={styles.title}>Session Data</div>

      {/* Initial Settings */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Initial Settings</div>
        <StatRow
          label="Population"
          value={algorithmConfig?.populationSize.toLocaleString() ?? '--'}
        />
        <StatRow
          label="Crossover"
          value={
            algorithmConfig
              ? `[${algorithmConfig.crossoverRange[0]}, ${algorithmConfig.crossoverRange[1]}]`
              : '--'
          }
        />
        <StatRow
          label="Mutation"
          value={
            algorithmConfig
              ? `${(algorithmConfig.mutationRate * 100).toFixed(0)}%`
              : '--'
          }
        />
      </div>

      {/* Totals This Step */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Totals This Step</div>
        <StatRow
          label="Eligible Parents"
          value={stepStatistics?.eligibleParentsCount.toLocaleString() ?? '--'}
        />
        <StatRow
          label="Avg Fitness (Eligible)"
          value={stepStatistics?.avgFitnessEligibleParents.toFixed(2) ?? '--'}
        />
        <StatRow
          label="Actual Parents"
          value={stepStatistics?.actualParentsCount.toLocaleString() ?? '--'}
        />
        <StatRow
          label="Avg Fitness (Actual)"
          value={stepStatistics?.avgFitnessActualParents.toFixed(2) ?? '--'}
        />
        <StatRow
          label="Children"
          value={stepStatistics?.childrenCount.toLocaleString() ?? '--'}
        />
        <StatRow
          label="Avg Fitness (Children)"
          value={stepStatistics?.avgFitnessChildren.toFixed(2) ?? '--'}
        />
        <StatRow
          label="Mutations"
          value={stepStatistics?.mutationCount.toLocaleString() ?? '--'}
        />
      </div>

      {/* Cumulative Totals */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Cumulative Totals</div>
        <StatRow
          label="Total Eligible Parents"
          value={cumulativeStats?.totalEligibleParents.toLocaleString() ?? '--'}
        />
        <StatRow
          label="Avg Fitness Increase"
          value={cumulativeStats?.avgFitnessIncrease.toFixed(4) ?? '--'}
        />
        <StatRow
          label="Total Actual Parents"
          value={cumulativeStats?.totalActualParents.toLocaleString() ?? '--'}
        />
        <StatRow
          label="Total Children"
          value={cumulativeStats?.totalChildren.toLocaleString() ?? '--'}
        />
        <StatRow
          label="Total Mutations"
          value={cumulativeStats?.totalMutations.toLocaleString() ?? '--'}
        />
        <StatRow
          label="Iterations"
          value={cumulativeStats?.iterationCount.toLocaleString() ?? '--'}
        />
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  panel: {
    backgroundColor: '#1a1a2e',
    borderRadius: 8,
    padding: 12,
    border: '1px solid #2a2a4a',
    flex: '1 1 200px',
    minWidth: 180,
  },
  title: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#aaa',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  section: {
    marginBottom: 10,
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
};
