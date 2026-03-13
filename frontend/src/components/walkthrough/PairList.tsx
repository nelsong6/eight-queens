/**
 * PairList — virtualized list of BreedingPairs.
 * Each row shows pair index, parent A, parent B, and optionally crossover/children info.
 * Distinct rendering from SpecimenList — designed for the pair set.
 */
import React, { useRef } from 'react';
import type { BreedingPair, Specimen, PoolOrigin, TimeCoordinate } from '../../engine/types';
import { useVirtualizer } from '@tanstack/react-virtual';
import { formatId } from '../../engine/specimen';
import { colors } from '../../colors';
import { AGE_COLORS } from './SpecimenList';

const PAIR_ROW_HEIGHT = 28;

interface Props {
  pairs: BreedingPair[];
  coordinate: TimeCoordinate;
  onSelectSpecimen: (specimen: Specimen, origin: PoolOrigin) => void;
  selectedId?: number;
  onSelectPair?: (pair: BreedingPair) => void;
  selectedPairIndex?: number;
}

const GenomeInline: React.FC<{
  specimen: Specimen;
  side: 'A' | 'B';
  crossoverPoint?: number;
  onClick: () => void;
  isSelected: boolean;
}> = ({ specimen, side, crossoverPoint, onClick, isSelected }) => {
  const sideColor = side === 'A' ? colors.accent.blue : colors.accent.lavender;

  return (
    <span
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      style={{
        ...pairStyles.parent,
        backgroundColor: isSelected ? colors.interactive.selected : 'transparent',
        borderColor: sideColor,
      }}
      data-help={`Parent ${side}: click to inspect`}
    >
      <span style={{ ...pairStyles.parentSide, color: sideColor }}>{side}</span>
      <span style={pairStyles.parentId}>{formatId(specimen)}</span>
      {specimen.solution.map((gene, gi) => (
        <span
          key={gi}
          style={{
            ...pairStyles.gene,
            opacity: crossoverPoint !== undefined && (
              (side === 'A' && gi >= crossoverPoint) || (side === 'B' && gi < crossoverPoint)
            ) ? 0.35 : 1,
          }}
        >{gene}</span>
      ))}
      <span style={pairStyles.fitness}>{specimen.fitness}</span>
      <span style={{ ...pairStyles.age, color: AGE_COLORS[specimen.age] }}>{specimen.age}</span>
    </span>
  );
};

export const PairList: React.FC<Props> = ({
  pairs,
  coordinate,
  onSelectSpecimen,
  selectedId,
  onSelectPair,
  selectedPairIndex,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const rowHeight = PAIR_ROW_HEIGHT;

  const virtualizer = useVirtualizer({
    count: pairs.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowHeight,
    overscan: 5,
  });

  const hasChildren = pairs.length > 0 && pairs[0]!.childA !== undefined;

  const handleSelectParent = (specimen: Specimen, qualifier: string) => {
    const pool = 'selectedPairs' as const;
    onSelectSpecimen(specimen, { coordinate, pool, qualifier });
  };

  return (
    <div style={pairStyles.wrapper}>
      <div style={pairStyles.outerScroll}>
        <div style={pairStyles.innerContent}>
          <div style={pairStyles.headerRow}>
            <span style={pairStyles.headerPairIdx}>#</span>
            <span style={pairStyles.headerLabel}>Parent A</span>
            <span style={pairStyles.headerLabel}>Parent B</span>
            {hasChildren && <span style={pairStyles.headerLabel}>Crossover</span>}
          </div>
          <div ref={scrollRef} style={pairStyles.scrollContainer}>
            <div style={{ height: virtualizer.getTotalSize(), position: 'relative' as const }}>
              {virtualizer.getVirtualItems().map(virtualRow => {
                const pair = pairs[virtualRow.index]!;
                return (
                  <div
                    key={pair.index}
                    className={`vl-row${pair.index === selectedPairIndex ? ' vl-selected' : ''}`}
                    style={{
                      ...pairStyles.row,
                      position: 'absolute' as const,
                      top: virtualRow.start,
                      height: rowHeight,
                      backgroundColor: pair.index === selectedPairIndex
                        ? colors.interactive.selected
                        : virtualRow.index % 2 === 1 ? colors.interactive.rowStripe : 'transparent',
                      cursor: onSelectPair ? 'pointer' : 'default',
                    }}
                    onClick={onSelectPair ? () => onSelectPair(pair) : undefined}
                  >
                    <span style={pairStyles.pairIdx}>{pair.index + 1}</span>
                    <GenomeInline
                      specimen={pair.parentA}
                      side="A"
                      crossoverPoint={pair.crossoverPoint}
                      onClick={() => handleSelectParent(pair.parentA, 'A')}
                      isSelected={pair.parentA.id === selectedId}
                    />
                    <span style={pairStyles.pairSep}>×</span>
                    <GenomeInline
                      specimen={pair.parentB}
                      side="B"
                      crossoverPoint={pair.crossoverPoint}
                      onClick={() => handleSelectParent(pair.parentB, 'B')}
                      isSelected={pair.parentB.id === selectedId}
                    />
                    {pair.crossoverPoint !== undefined && (
                      <span style={pairStyles.crossoverBadge}>@{pair.crossoverPoint}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      <div style={pairStyles.countLabel}>{pairs.length.toLocaleString()} pairs</div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const pairStyles: Record<string, React.CSSProperties> = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column' as const,
  },
  outerScroll: {
    overflowX: 'hidden' as const,
    border: `1px solid ${colors.border.subtle}`,
    borderRadius: 4,
    backgroundColor: colors.bg.raised,
  },
  innerContent: {
  },
  headerRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '2px 6px',
    fontSize: 10,
    fontFamily: 'monospace',
    color: colors.text.disabled,
    backgroundColor: colors.bg.raised,
    borderBottom: `1px solid ${colors.border.subtle}`,
  },
  headerPairIdx: {
    width: 22,
    textAlign: 'center' as const,
  },
  headerLabel: {
    flex: 1,
    textAlign: 'center' as const,
  },
  scrollContainer: {
    height: 200,
    overflowY: 'auto' as const,
    overflowX: 'hidden' as const,
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 2,
    paddingLeft: 6,
    paddingRight: 6,
    fontSize: 11,
    fontFamily: 'monospace',
    color: colors.text.primary,
    cursor: 'default',
  },
  pairIdx: {
    width: 22,
    textAlign: 'center' as const,
    color: colors.text.tertiary,
    fontSize: 10,
    flexShrink: 0,
  },
  pairSep: {
    color: colors.text.disabled,
    fontSize: 10,
    flexShrink: 0,
  },
  parent: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 2,
    padding: '1px 4px',
    borderRadius: 3,
    borderLeft: '2px solid',
    cursor: 'pointer',
    flex: '1 1 0',
    minWidth: 0,
    overflow: 'hidden' as const,
  },
  parentSide: {
    fontSize: 9,
    fontWeight: 'bold' as const,
    marginRight: 1,
  },
  parentId: {
    color: colors.text.secondary,
    fontSize: 10,
    marginRight: 2,
    minWidth: 24,
  },
  gene: {
    color: colors.text.primary,
    width: 10,
    textAlign: 'center' as const,
    fontSize: 11,
  },
  fitness: {
    color: colors.accent.gold,
    marginLeft: 1,
    fontSize: 11,
    minWidth: 16,
    textAlign: 'right' as const,
  },
  age: {
    fontSize: 10,
    marginLeft: 2,
    minWidth: 10,
  },
  crossoverBadge: {
    color: colors.accent.teal,
    fontSize: 9,
    padding: '1px 4px',
    backgroundColor: colors.bg.overlay,
    borderRadius: 3,
    flexShrink: 0,
  },
  countLabel: {
    color: colors.text.tertiary,
    fontSize: 9,
    padding: '4px 6px',
    textAlign: 'center' as const,
    fontFamily: 'monospace',
  },
};
