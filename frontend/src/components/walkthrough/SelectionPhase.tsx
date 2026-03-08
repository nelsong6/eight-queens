import React from 'react';
import type { GenerationResult } from '../../engine/types';

interface Props {
  result?: GenerationResult | null;
}

export const SelectionPhase: React.FC<Props> = ({ result }) => {
  const hasData = !!result;
  const eligible = result?.stepStatistics.eligibleParentsCount ?? 0;
  const actual = result?.stepStatistics.actualParentsCount ?? 0;
  const avgEligible = result?.stepStatistics.avgFitnessEligibleParents ?? 0;
  const avgActual = result?.stepStatistics.avgFitnessActualParents ?? 0;

  // Build a simple fitness distribution from eligible parents
  const fitnessBuckets = new Array(29).fill(0); // 0-28
  if (result) {
    for (const parent of result.breedingData.eligibleParents) {
      fitnessBuckets[parent.fitness]++;
    }
  }
  const maxBucket = Math.max(...fitnessBuckets, 1);

  const dash = <span style={{ color: '#444' }}>&mdash;</span>;

  return (
    <div style={styles.panel}>
      <div style={styles.title} data-help="The algorithm picks parents from the population using fitness-proportionate selection" data-help-glossary="selection">Phase 1: Selection</div>
      <div style={styles.subtitle} data-help="Specimens with higher fitness get more 'slots' on the wheel and are more likely to be chosen">Fitness-Proportionate (Roulette Wheel) Selection</div>

      <div style={styles.explanation}>
        Each specimen's chance of being selected as a parent is proportional to its fitness.
        Higher fitness = more slots on the roulette wheel = more likely to reproduce.
      </div>

      <div style={styles.statsRow}>
        <div style={styles.stat} data-help="Specimens with fitness above zero that are candidates for selection">
          <span style={styles.statLabel}>Eligible</span>
          <span style={styles.statValue}>{hasData ? eligible.toLocaleString() : dash}</span>
          <span style={styles.statDetail}>{hasData ? `avg fitness ${avgEligible.toFixed(1)}` : '\u00A0'}</span>
        </div>
        <div style={styles.stat} data-help="Parents actually chosen — higher fitness specimens appear more often">
          <span style={styles.statLabel}>Selected</span>
          <span style={styles.statValue}>{hasData ? actual.toLocaleString() : dash}</span>
          <span style={styles.statDetail}>{hasData ? `avg fitness ${avgActual.toFixed(1)}` : '\u00A0'}</span>
        </div>
        <div style={styles.stat} data-help="Difference in avg fitness between selected and eligible — positive means selection favors fitter specimens" data-help-glossary="selection">
          <span style={styles.statLabel}>Selection Pressure</span>
          <span style={styles.statValue}>
            {hasData ? (
              <>{avgActual > avgEligible ? '+' : ''}{(avgActual - avgEligible).toFixed(1)}</>
            ) : dash}
          </span>
          <span style={styles.statDetail}>{hasData ? 'fitness delta' : '\u00A0'}</span>
        </div>
      </div>

      {/* Fitness distribution bar chart */}
      <div style={styles.chartLabel} data-help="How many specimens exist at each fitness level — shows population diversity">Fitness Distribution (eligible parents)</div>
      <div style={styles.chart}>
        {hasData ? fitnessBuckets.map((count, fitness) => {
          if (count === 0 && fitness < 10) return null;
          const height = Math.max(1, (count / maxBucket) * 80);
          return (
            <div key={fitness} style={styles.barCol} title={`Fitness ${fitness}: ${count}`}>
              <div
                style={{
                  ...styles.bar,
                  height,
                  backgroundColor: fitness === 28 ? '#4caf50' : '#6c5ce7',
                }}
              />
              <span style={styles.barLabel}>{fitness}</span>
            </div>
          );
        }) : (
          <div style={styles.chartEmpty}>Click Step to run a generation</div>
        )}
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
    flex: '1 1 300px',
  },
  title: {
    fontSize: 14,
    fontFamily: 'monospace',
    color: '#6c5ce7',
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: '#aaa',
    marginBottom: 12,
  },
  explanation: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: '#999',
    lineHeight: 1.5,
    marginBottom: 16,
    padding: '8px 10px',
    backgroundColor: '#12122a',
    borderRadius: 4,
    border: '1px solid #2a2a4a',
  },
  statsRow: {
    display: 'flex',
    gap: 12,
    marginBottom: 16,
  },
  stat: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    padding: '8px 4px',
    backgroundColor: '#12122a',
    borderRadius: 4,
    border: '1px solid #2a2a4a',
  },
  statLabel: {
    fontSize: 9,
    fontFamily: 'monospace',
    color: '#666',
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
  },
  statValue: {
    fontSize: 18,
    fontFamily: 'monospace',
    color: '#e0e0e0',
    fontWeight: 'bold',
  },
  statDetail: {
    fontSize: 9,
    fontFamily: 'monospace',
    color: '#888',
  },
  chartLabel: {
    fontSize: 9,
    fontFamily: 'monospace',
    color: '#666',
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
    marginBottom: 6,
  },
  chart: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: 1,
    height: 100,
    padding: '0 4px',
    backgroundColor: '#12122a',
    borderRadius: 4,
    border: '1px solid #2a2a4a',
  },
  barCol: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'flex-end',
    minWidth: 0,
  },
  bar: {
    width: '100%',
    minWidth: 2,
    borderRadius: '2px 2px 0 0',
  },
  chartEmpty: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    fontSize: 11,
    fontFamily: 'monospace',
    color: '#444',
  },
  barLabel: {
    fontSize: 7,
    fontFamily: 'monospace',
    color: '#555',
    marginTop: 2,
  },
};
