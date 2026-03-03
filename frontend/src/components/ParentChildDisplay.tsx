import React from 'react';
import type { GenerationResult } from '../engine/types';
import { BOARD_SIZE, MAX_FITNESS } from '../engine/types';

interface Props {
  lastResult: GenerationResult | null;
}

/**
 * Shows the last breeding event: Parent A + Parent B -> Child A + Child B
 * with their solution arrays and fitness values.
 */
export const ParentChildDisplay: React.FC<Props> = ({ lastResult }) => {
  if (!lastResult?.lastParentA) {
    return (
      <div style={styles.panel}>
        <h3 style={styles.title}>Last Breeding</h3>
        <div style={styles.empty}>Run the algorithm to see breeding pairs</div>
      </div>
    );
  }

  return (
    <div style={styles.panel}>
      <h3 style={styles.title}>Last Breeding</h3>
      <div style={styles.grid}>
        <IndividualRow
          label="Parent A"
          solution={lastResult.lastParentA.solution}
          fitness={lastResult.lastParentA.fitness}
        />
        <IndividualRow
          label="Parent B"
          solution={lastResult.lastParentB!.solution}
          fitness={lastResult.lastParentB!.fitness}
        />
        <div style={styles.arrow}>&#8595; crossover + mutation &#8595;</div>
        <IndividualRow
          label="Child A"
          solution={lastResult.lastChildA!.solution}
          fitness={lastResult.lastChildA!.fitness}
        />
        <IndividualRow
          label="Child B"
          solution={lastResult.lastChildB!.solution}
          fitness={lastResult.lastChildB!.fitness}
        />
      </div>
    </div>
  );
};

const IndividualRow: React.FC<{
  label: string;
  solution: number[];
  fitness: number;
}> = ({ label, solution, fitness }) => (
  <div style={styles.row}>
    <span style={styles.label}>{label}:</span>
    <span style={styles.solution}>
      [{solution.join(', ')}]
    </span>
    <span
      style={{
        ...styles.fitness,
        color: fitness === MAX_FITNESS ? '#4caf50' : '#ffd700',
      }}
    >
      {fitness}/{MAX_FITNESS}
    </span>
    {/* Mini board visualization */}
    <div style={styles.miniBoard}>
      {Array.from({ length: BOARD_SIZE }, (_, col) => (
        <div key={col} style={styles.miniCol}>
          {Array.from({ length: BOARD_SIZE }, (_, row) => (
            <div
              key={row}
              style={{
                ...styles.miniCell,
                backgroundColor:
                  solution[col] === row
                    ? fitness === MAX_FITNESS
                      ? '#4caf50'
                      : '#ffd700'
                    : (col + row) % 2 === 0
                      ? '#f0e4d0'
                      : '#a08060',
              }}
            />
          ))}
        </div>
      ))}
    </div>
  </div>
);

const styles: Record<string, React.CSSProperties> = {
  panel: {
    backgroundColor: '#1a1a2e',
    borderRadius: 8,
    padding: 16,
    border: '1px solid #2a2a4a',
  },
  title: {
    margin: '0 0 10px 0',
    fontSize: 14,
    fontFamily: 'monospace',
    color: '#aaa',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  empty: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#555',
  },
  grid: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  arrow: {
    textAlign: 'center',
    fontSize: 11,
    fontFamily: 'monospace',
    color: '#6c5ce7',
    padding: '4px 0',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 11,
    fontFamily: 'monospace',
  },
  label: {
    color: '#aaa',
    width: 60,
    flexShrink: 0,
  },
  solution: {
    color: '#e0e0e0',
    flex: 1,
  },
  fitness: {
    fontWeight: 'bold',
    width: 40,
    textAlign: 'right',
  },
  miniBoard: {
    display: 'flex',
    gap: 0,
  },
  miniCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: 0,
  },
  miniCell: {
    width: 6,
    height: 6,
  },
};
