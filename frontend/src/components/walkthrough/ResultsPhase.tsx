import React from 'react';
import type { GenerationResult } from '../../engine/types';
import { MAX_FITNESS } from '../../engine/types';

interface Props {
  result: GenerationResult;
}

export const ResultsPhase: React.FC<Props> = ({ result }) => {
  const { stepStatistics, bestIndividual, bestFitness, avgFitness, generationNumber } = result;

  return (
    <div style={styles.panel}>
      <div style={styles.title} data-help="Summary of the completed generation — best individual becomes the benchmark">Phase 4: Results</div>
      <div style={styles.subtitle} data-help="All breeding is done — the population has been replaced with the new children">Generation {generationNumber} Complete</div>

      <div style={styles.explanation}>
        The new population has been formed by replacing the parents with their children.
        Below is a summary of this generation's outcome.
      </div>

      <div style={styles.statsRow}>
        <div style={styles.stat} data-help="Highest fitness score achieved this generation — green at 28 means solved">
          <span style={styles.statLabel}>Best Fitness</span>
          <span style={{
            ...styles.statValue,
            color: bestFitness === MAX_FITNESS ? '#4caf50' : '#e0e0e0',
          }}>
            {bestFitness}/{MAX_FITNESS}
          </span>
        </div>
        <div style={styles.stat} data-help="Mean fitness of the entire population this generation">
          <span style={styles.statLabel}>Avg Fitness</span>
          <span style={styles.statValue}>{avgFitness.toFixed(1)}</span>
        </div>
        <div style={styles.stat} data-help="Total random gene changes applied during this generation">
          <span style={styles.statLabel}>Mutations</span>
          <span style={styles.statValue}>{stepStatistics.mutationCount.toLocaleString()}</span>
        </div>
      </div>

      <div style={styles.bestLabel} data-help="The chromosome with the highest fitness this generation">Best individual</div>
      <div style={styles.bestRow} data-help="Each number is the row position of a queen in that column — fitness is the count of non-attacking pairs">
        <span style={styles.bestSolution}>
          {bestIndividual.solution.map((gene, i) => (
            <span key={i} style={styles.gene}>{gene}</span>
          ))}
        </span>
        <span style={styles.bestFitness}>f:{bestIndividual.fitness}</span>
      </div>

      {result.solved && (
        <div style={styles.solvedBanner}>Solution found!</div>
      )}
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
  bestLabel: {
    fontSize: 9,
    fontFamily: 'monospace',
    color: '#666',
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
    marginBottom: 6,
  },
  bestRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '8px 10px',
    backgroundColor: '#12122a',
    borderRadius: 4,
    border: '1px solid #2a2a4a',
  },
  bestSolution: {
    display: 'flex',
    gap: 4,
    flex: 1,
    fontFamily: 'monospace',
  },
  gene: {
    fontSize: 14,
    color: '#4caf50',
    fontWeight: 'bold',
    fontFamily: 'monospace',
  },
  bestFitness: {
    fontSize: 12,
    color: '#ffd700',
    fontFamily: 'monospace',
    flexShrink: 0,
  },
  solvedBanner: {
    marginTop: 16,
    padding: '10px 12px',
    backgroundColor: '#1a3a1a',
    borderRadius: 4,
    border: '1px solid #4caf50',
    color: '#4caf50',
    fontSize: 13,
    fontFamily: 'monospace',
    fontWeight: 'bold',
    textAlign: 'center' as const,
  },
};
