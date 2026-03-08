/**
 * SyncedSpecimenList — virtualized grid that renders from a pre-sorted
 * (Specimen | null)[] array. Null entries render as empty placeholder rows.
 * Used by OperationPanel for synchronized before/after display.
 */
import React, { useRef, useCallback, useImperativeHandle, forwardRef } from 'react';
import type { Specimen } from '../../engine/types';
import type { SortingState } from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { formatId } from '../../engine/specimen';
import { GRID_COLS, ITEM_HEIGHT, AGE_COLORS, CELL } from './SpecimenList';
import { colors } from '../../colors';

export interface SyncedListHandle {
  scrollElement: HTMLDivElement | null;
}

interface Props {
  /** Pre-sorted items; null = empty placeholder row */
  items: (Specimen | null)[];
  onClickItem: (ind: Specimen) => void;
  sorting: SortingState;
  onSortingChange: React.Dispatch<React.SetStateAction<SortingState>>;
  onScroll?: (scrollTop: number) => void;
  scrollTopOverride?: number;
  flex?: boolean;
}

export const SyncedSpecimenList = forwardRef<SyncedListHandle, Props>(({
  items,
  onClickItem,
  sorting,
  onSortingChange,
  onScroll,
  flex = false,
}, ref) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    get scrollElement() { return scrollRef.current; },
  }));

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ITEM_HEIGHT,
    overscan: 5,
  });

  const handleScroll = useCallback(() => {
    if (onScroll && scrollRef.current) {
      onScroll(scrollRef.current.scrollTop);
    }
  }, [onScroll]);

  // Sort header helpers
  const getSorted = (colId: string): false | 'asc' | 'desc' => {
    const s = sorting.find(s => s.id === colId);
    return s ? (s.desc ? 'desc' : 'asc') : false;
  };

  const toggleSort = (colId: string) => {
    onSortingChange(prev => {
      const existing = prev.find(s => s.id === colId);
      if (existing) return [{ id: colId, desc: !existing.desc }];
      return [{ id: colId, desc: true }];
    });
  };

  const idWidth = 6;

  const idSorted = getSorted('id');
  const gene0Sorted = getSorted('gene0');
  const fitnessSorted = getSorted('fitness');
  const ageSorted = getSorted('age');

  const scrollContainerStyle: React.CSSProperties = flex
    ? { flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', backgroundColor: colors.bg.raised, borderRadius: '0 0 4px 4px', border: `1px solid ${colors.border.subtle}` }
    : { height: 300, overflowY: 'auto' as const, overflowX: 'hidden' as const, backgroundColor: colors.bg.raised, borderRadius: '0 0 4px 4px', border: `1px solid ${colors.border.subtle}` };

  return (
    <div style={{ ...styles.wrapper, ...(flex ? { flex: 1, minHeight: 0 } : {}) }}>
      {/* Header row */}
      <div style={styles.headerRow}>
        <span onClick={() => toggleSort('id')} style={{ ...styles.headerCell, cursor: 'pointer', borderBottom: idSorted ? `2px solid ${colors.text.secondary}` : '2px solid transparent' }}>#</span>
        <span onClick={() => toggleSort('gene0')} style={{ gridColumn: '2', ...styles.headerCell, cursor: 'pointer', borderBottom: gene0Sorted ? `2px solid ${colors.text.secondary}` : '2px solid transparent' }}>{'\uD83E\uDDEC'}</span>
        <span onClick={() => toggleSort('fitness')} style={{ gridColumn: '10', ...styles.headerCell, cursor: 'pointer', borderBottom: fitnessSorted ? `2px solid ${colors.accent.gold}` : '2px solid transparent' }}>{'\uD83C\uDFC5'}</span>
        <span onClick={() => toggleSort('age')} style={{ gridColumn: '11', ...styles.headerCell, cursor: 'pointer', borderBottom: ageSorted ? `2px solid ${colors.accent.orange}` : '2px solid transparent' }}>{'\uD83D\uDC23'}</span>
      </div>

      {/* Virtual scroll container */}
      <div ref={scrollRef} style={scrollContainerStyle} onScroll={handleScroll}>
        <div style={{ height: virtualizer.getTotalSize(), position: 'relative' as const }}>
          {virtualizer.getVirtualItems().map(virtualRow => {
            const item = items[virtualRow.index] ?? null;
            if (item === null) {
              return (
                <div
                  key={`empty-${virtualRow.index}`}
                  style={{
                    ...styles.row,
                    position: 'absolute' as const,
                    top: virtualRow.start,
                    width: '100%',
                    backgroundColor: virtualRow.index % 2 === 1 ? colors.interactive.rowStripe : 'transparent',
                    opacity: 0.25,
                  }}
                >
                  <span style={{ ...styles.id, color: colors.text.disabled }}>{'—'.padStart(idWidth)}</span>
                  {Array.from({ length: 8 }, (_, gi) => (
                    <span key={gi} style={{ ...styles.gene, color: colors.text.disabled }}>·</span>
                  ))}
                  <span style={{ ...styles.fitness, color: colors.text.disabled }}>—</span>
                  <span style={{ ...styles.age, color: colors.text.disabled }}>—</span>
                </div>
              );
            }
            return (
              <div
                key={item.id}
                className="vl-row"
                style={{
                  ...styles.row,
                  position: 'absolute' as const,
                  top: virtualRow.start,
                  width: '100%',
                  backgroundColor: virtualRow.index % 2 === 1 ? colors.interactive.rowStripe : 'transparent',
                }}
                onClick={() => onClickItem(item)}
              >
                <span style={styles.id}>{formatId(item).padStart(idWidth)}</span>
                {item.solution.map((gene, gi) => (
                  <span key={gi} style={styles.gene}>{gene}</span>
                ))}
                <span style={styles.fitness}>{item.fitness}</span>
                <span style={{ ...styles.age, color: AGE_COLORS[item.age] }}>{item.age}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
});

SyncedSpecimenList.displayName = 'SyncedSpecimenList';

// Styles match SpecimenList's gridStyles
const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column' as const,
  },
  headerRow: {
    display: 'grid',
    gridTemplateColumns: GRID_COLS,
    columnGap: 0,
    padding: '2px 6px',
    fontSize: 13,
    fontFamily: 'monospace',
    backgroundColor: colors.bg.raised,
    borderRadius: '4px 4px 0 0',
    border: `1px solid ${colors.border.subtle}`,
    borderBottom: 'none',
  },
  headerCell: {
    padding: '0 3px',
    textAlign: 'center' as const,
    color: colors.text.disabled,
    borderBottom: '2px solid transparent',
  },
  row: {
    display: 'grid',
    gridTemplateColumns: GRID_COLS,
    columnGap: 0,
    height: ITEM_HEIGHT,
    lineHeight: `${ITEM_HEIGHT}px`,
    paddingLeft: 6,
    paddingRight: 6,
    fontSize: 14,
    fontFamily: 'monospace',
    color: colors.text.primary,
    cursor: 'pointer',
  },
  id: { ...CELL, color: colors.text.secondary, whiteSpace: 'nowrap' as const, textAlign: 'center' as const },
  gene: { ...CELL, color: colors.text.primary, textAlign: 'center' as const },
  fitness: { ...CELL, color: colors.accent.gold, whiteSpace: 'nowrap' as const, textAlign: 'center' as const },
  age: { ...CELL, color: colors.text.secondary, whiteSpace: 'nowrap' as const, textAlign: 'center' as const, fontSize: 13, borderRight: 'none' },
};
