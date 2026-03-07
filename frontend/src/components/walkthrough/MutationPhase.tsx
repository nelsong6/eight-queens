import React from 'react';
import type { GenerationResult } from '../../engine/types';
import { formatId } from '../../engine/individual';

interface Props {
  result: GenerationResult;
}

export const MutationPhase: React.FC<Props> = ({ result }) => {
  const { breedingData, stepStatistics } = result;
  const mutationCount = stepStatistics.mutationCount;
  const childrenCount = stepStatistics.childrenCount;
  const mutations = breedingData.mutations;

  // Show up to 5 example mutations
  const examples = mutations.slice(0, 5);

  return (
    <div style={styles.panel}>
      <div style={styles.title} data-help="Random gene changes are applied to children to maintain genetic diversity">Phase 3: Mutation</div>
      <div style={styles.subtitle} data-help="One random gene is changed to a random value, helping the population escape local optima">Random Gene Mutation</div>

      <div style={styles.explanation}>
        After crossover, each child has a chance of mutation: one random gene is changed
        to a random value. This introduces variation that helps the population escape
        local optima and explore new solutions.
      </div>

      <div style={styles.statsRow}>
        <div style={styles.stat} data-help="Total offspring produced by crossover this generation">
          <span style={styles.statLabel}>Children</span>
          <span style={styles.statValue}>{childrenCount.toLocaleString()}</span>
        </div>
        <div style={styles.stat} data-help="Number of children that received a random gene change">
          <span style={styles.statLabel}>Mutated</span>
          <span style={styles.statValue}>{mutationCount.toLocaleString()}</span>
        </div>
        <div style={styles.stat} data-help="Actual mutation rate — may differ from configured rate due to randomness">
          <span style={styles.statLabel}>Rate</span>
          <span style={styles.statValue}>
            {childrenCount > 0
              ? ((mutationCount / childrenCount) * 100).toFixed(1)
              : '0'}%
          </span>
        </div>
      </div>

      {mutationCount === 0 ? (
        <div style={styles.noMutations}>
          No mutations occurred this generation. At low mutation rates, this is normal
          for smaller populations.
        </div>
      ) : (
        <>
          <div style={styles.examplesLabel} data-help="Sample of children whose genes were randomly altered during mutation">
            Example mutated children {mutations.length > 5 ? `(showing 5 of ${mutations.length})` : ''}
          </div>
          <div style={styles.examplesList}>
            {examples.map((ind, i) => (
              <div key={i} style={styles.exampleRow}>
                <span style={styles.exampleId}>[{formatId(ind)}]</span>
                <span style={styles.exampleSolution}>
                  {ind.solution.map((gene, gi) => (
                    <span key={gi} style={styles.exampleGene}>{gene}</span>
                  ))}
                </span>
                <span style={styles.exampleFitness}>f:{ind.fitness}</span>
              </div>
            ))}
          </div>
        </>
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
  noMutations: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: '#888',
    textAlign: 'center' as const,
    padding: '16px 12px',
    backgroundColor: '#12122a',
    borderRadius: 4,
    border: '1px solid #2a2a4a',
  },
  examplesLabel: {
    fontSize: 9,
    fontFamily: 'monospace',
    color: '#666',
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
    marginBottom: 6,
  },
  examplesList: {
    backgroundColor: '#12122a',
    borderRadius: 4,
    border: '1px solid #2a2a4a',
    padding: 4,
  },
  exampleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '3px 6px',
    fontSize: 11,
    fontFamily: 'monospace',
  },
  exampleId: {
    color: '#888',
    width: 36,
    flexShrink: 0,
  },
  exampleSolution: {
    display: 'flex',
    gap: 4,
    flex: 1,
  },
  exampleGene: {
    color: '#4caf50',
    fontWeight: 'bold',
  },
  exampleFitness: {
    color: '#ffd700',
    flexShrink: 0,
  },
};
