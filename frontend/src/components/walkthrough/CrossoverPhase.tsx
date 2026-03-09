import React from 'react';
import type { Specimen, GenerationResult, PoolOrigin } from '../../engine/types';

interface Props {
  result: GenerationResult;
  pairIndex: number;
  onPairChange: (index: number) => void;
  onSelectSpecimen: (specimen: Specimen, origin: PoolOrigin) => void;
}

export const CrossoverPhase: React.FC<Props> = ({
  result,
  pairIndex,
  onPairChange,
  onSelectSpecimen,
}) => {
  const { breedingData } = result;
  const totalPairs = breedingData.aParents.length;

  if (totalPairs === 0) {
    return (
      <div style={styles.panel}>
        <div style={styles.title}>Phase 2: Crossover</div>
        <div style={styles.explanation}>No breeding pairs this generation.</div>
      </div>
    );
  }

  const idx = Math.min(pairIndex, totalPairs - 1);
  const parentA = breedingData.aParents[idx]!;
  const parentB = breedingData.bParents[idx]!;
  const childA = breedingData.aChildren[idx]!;
  const childB = breedingData.bChildren[idx]!;
  const crossoverPoint = breedingData.crossoverPoints[idx]!;

  return (
    <div style={styles.panel}>
      <div style={styles.title} data-help="Selected parents are paired and their chromosomes are combined to create children" data-help-glossary="crossover">Phase 2: Crossover</div>
      <div style={styles.subtitle} data-help="The chromosome is cut at one random point and the two halves are swapped between parents">Single-Point Crossover</div>

      <div style={styles.explanation}>
        Genes from position {crossoverPoint} onward are swapped between the two parents,
        producing two children with mixed genetic material.
      </div>

      {/* Pair navigation */}
      <div style={styles.pairNav} data-help="Browse through specimen breeding pairs to see how genes were exchanged">
        <button
          onClick={() => onPairChange(Math.max(0, idx - 1))}
          disabled={idx === 0}
          style={{ ...styles.navBtn, opacity: idx === 0 ? 0.3 : 1 }}
          data-help="View the previous breeding pair"
        >
          Prev
        </button>
        <span style={styles.pairLabel}>
          Pair {idx + 1} of {totalPairs.toLocaleString()}
        </span>
        <button
          onClick={() => onPairChange(Math.min(totalPairs - 1, idx + 1))}
          disabled={idx >= totalPairs - 1}
          style={{ ...styles.navBtn, opacity: idx >= totalPairs - 1 ? 0.3 : 1 }}
          data-help="View the next breeding pair"
        >
          Next
        </button>
      </div>

      {/* Parents */}
      <div style={styles.sectionLabel} data-help="The two parent chromosomes before crossover">Parents</div>
      <ChromosomeRow
        label="Parent A"
        specimen={parentA}
        colorLeft={COLORS.parentA}
        colorRight={COLORS.parentA}
        splicePoint={crossoverPoint}
        showSplice={false}
        onView={() => onSelectSpecimen(parentA, { coordinate: { generation: result.generationNumber, operation: 3 }, pool: 'selectedPairs', qualifier: 'A' })}
      />
      <ChromosomeRow
        label="Parent B"
        specimen={parentB}
        colorLeft={COLORS.parentB}
        colorRight={COLORS.parentB}
        splicePoint={crossoverPoint}
        showSplice={false}
        onView={() => onSelectSpecimen(parentB, { coordinate: { generation: result.generationNumber, operation: 3 }, pool: 'selectedPairs', qualifier: 'B' })}
      />

      {/* Splice indicator */}
      <div style={styles.spliceRow} data-help="The position where chromosomes are cut — genes after this point are swapped between parents" data-help-glossary="crossover">
        <div style={styles.spliceLineContainer}>
          {Array.from({ length: 8 }, (_, i) => (
            <div
              key={i}
              style={{
                ...styles.spliceCell,
                borderRight: i === crossoverPoint - 1 ? '2px dashed #ff4444' : 'none',
              }}
            >
              {i < crossoverPoint ? (
                <span style={{ color: '#666', fontSize: 8 }}>keep</span>
              ) : (
                <span style={{ color: '#ff6666', fontSize: 8 }}>swap</span>
              )}
            </div>
          ))}
        </div>
        <div style={styles.spliceLabel}>
          splice at position {crossoverPoint}
        </div>
      </div>

      {/* Children */}
      <div style={styles.sectionLabel} data-help="Resulting children after gene exchange at the crossover point">Children</div>
      <ChromosomeRow
        label="Child A"
        specimen={childA}
        colorLeft={COLORS.parentA}
        colorRight={COLORS.parentB}
        splicePoint={crossoverPoint}
        showSplice={true}
        onView={() => onSelectSpecimen(childA, { coordinate: { generation: result.generationNumber, operation: 3 }, pool: 'chromosomes', qualifier: 'A' })}
      />
      <ChromosomeRow
        label="Child B"
        specimen={childB}
        colorLeft={COLORS.parentB}
        colorRight={COLORS.parentA}
        splicePoint={crossoverPoint}
        showSplice={true}
        onView={() => onSelectSpecimen(childB, { coordinate: { generation: result.generationNumber, operation: 3 }, pool: 'chromosomes', qualifier: 'B' })}
      />
    </div>
  );
};

// ---------------------------------------------------------------------------
// Chromosome row sub-component
// ---------------------------------------------------------------------------

const COLORS = {
  parentA: '#2a4a8a',
  parentB: '#8a5a2a',
};

const ChromosomeRow: React.FC<{
  label: string;
  specimen: Specimen;
  colorLeft: string;
  colorRight: string;
  splicePoint: number;
  showSplice: boolean;
  onView: () => void;
}> = ({ label, specimen, colorLeft, colorRight, splicePoint, showSplice, onView }) => (
  <div style={styles.chromRow}>
    <div style={styles.chromLabel}>
      <span>{label}</span>
      <button onClick={onView} style={styles.viewBtn} data-help="Show this specimen's queen placement on the chessboard">View</button>
    </div>
    <div style={styles.chromBar}>
      {specimen.solution.map((gene, i) => (
        <div
          key={i}
          style={{
            ...styles.chromCell,
            backgroundColor: i < splicePoint ? colorLeft : colorRight,
            borderRight: showSplice && i === splicePoint - 1
              ? '2px solid #ff4444'
              : '1px solid #1a1a2e',
          }}
        >
          <span style={styles.chromIndex}>{i}</span>
          <span style={styles.chromGene}>{gene}</span>
        </div>
      ))}
    </div>
    <span style={styles.chromFitness}>f:{specimen.fitness}</span>
  </div>
);

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

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
    marginBottom: 12,
    padding: '8px 10px',
    backgroundColor: '#12122a',
    borderRadius: 4,
    border: '1px solid #2a2a4a',
  },
  pairNav: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 12,
  },
  navBtn: {
    padding: '3px 8px',
    fontSize: 10,
    fontFamily: 'monospace',
    backgroundColor: '#2a2a4a',
    color: '#e0e0e0',
    border: '1px solid #3a3a5a',
    borderRadius: 3,
    cursor: 'pointer',
  },
  pairLabel: {
    fontSize: 10,
    fontFamily: 'monospace',
    color: '#888',
  },
  sectionLabel: {
    fontSize: 9,
    fontFamily: 'monospace',
    color: '#666',
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
    marginBottom: 4,
    marginTop: 8,
  },
  chromRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  chromLabel: {
    width: 70,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'flex-start',
    gap: 2,
    fontSize: 10,
    fontFamily: 'monospace',
    color: '#ccc',
    flexShrink: 0,
  },
  viewBtn: {
    padding: '1px 5px',
    fontSize: 8,
    fontFamily: 'monospace',
    backgroundColor: '#2a2a4a',
    color: '#aaa',
    border: '1px solid #3a3a5a',
    borderRadius: 2,
    cursor: 'pointer',
  },
  chromBar: {
    display: 'flex',
    flex: 1,
  },
  chromCell: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    padding: '2px 0',
    minWidth: 0,
  },
  chromIndex: {
    fontSize: 7,
    fontFamily: 'monospace',
    color: '#555',
  },
  chromGene: {
    fontSize: 14,
    fontFamily: 'monospace',
    color: '#fff',
    fontWeight: 'bold',
  },
  chromFitness: {
    fontSize: 10,
    fontFamily: 'monospace',
    color: '#ffd700',
    flexShrink: 0,
    width: 30,
    textAlign: 'right' as const,
  },
  spliceRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    margin: '4px 0 4px 78px',
  },
  spliceLineContainer: {
    display: 'flex',
    flex: 1,
  },
  spliceCell: {
    flex: 1,
    display: 'flex',
    justifyContent: 'center',
    padding: '2px 0',
    minWidth: 0,
  },
  spliceLabel: {
    fontSize: 9,
    fontFamily: 'monospace',
    color: '#ff6666',
    flexShrink: 0,
    width: 30,
  },
};
