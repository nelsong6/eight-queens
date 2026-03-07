/**
 * Shared components extracted from SubPhaseScreen:
 * - IndividualList: virtualized sortable table of individuals
 * - TransformView: operation flow diagram (input→transform→output)
 * - CATEGORY_COLORS, OP_POOL_TRANSITIONS: shared data
 */
import React, { useMemo, useRef } from 'react';
import type { Individual, Age, GenerationResult, TimeCoordinate } from '../../engine/types';
import { getOp, getTransformDescription, getPipelineState } from '../../engine/time-coordinate';
import {
  createColumnHelper,
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getFacetedUniqueValues,
  type SortingState,
  type ColumnFiltersState,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { formatId } from '../../engine/individual';
import { colors } from '../../colors';

export const AGE_COLORS: Record<Age, string> = {
  0: colors.age.chromosome,
  1: colors.age.child,
  2: colors.age.adult,
  3: colors.age.elder,
};

const COL_ID = '48px';
const COL_GENE = '28px';
const COL_FIT = '30px';
const COL_AGE = '30px';
export const ITEM_HEIGHT = 28;

const CELL: React.CSSProperties = {
  borderRight: `1px solid ${colors.border.subtle}`,
  padding: '0 3px',
};

const GRID_COLS = `${COL_ID} repeat(8, ${COL_GENE}) ${COL_FIT} ${COL_AGE}`;

export const CATEGORY_COLORS: Record<string, string> = {
  Aging: colors.category.aging,
  Pruning: colors.category.pruning,
  Selection: colors.category.selection,
  Crossover: colors.category.crossover,
  Mutation: colors.category.mutation,
  Birth: colors.category.birth,
};

/** Describes before→after pool transitions for each operation. */
export const OP_POOL_TRANSITIONS: Record<number, { from: string[]; to: string[]; arrow: string }> = {
  0: { from: ['Old Parents', 'Previous Children'], to: ['Eligible Adults', 'Elders'], arrow: 'All individuals age: children→adults, adults→elders' },
  1: { from: ['Eligible Adults', 'Elders'], to: ['Eligible Adults'], arrow: 'Elders removed from population' },
  2: { from: ['Eligible Adults'], to: ['Selected Pairs', 'Unselected'], arrow: 'Roulette wheel picks breeding pairs' },
  3: { from: ['Selected Pairs', 'Unselected'], to: ['Mated Parents', 'Unselected'], arrow: 'Pairs assigned as breeding partners (A, B)' },
  4: { from: ['Mated Parents', 'Unselected'], to: ['Mated Parents', 'Unselected', 'Chromosomes'], arrow: 'Single-point crossover produces 2 children per pair' },
  5: { from: ['Chromosomes'], to: ['Chromosomes'], arrow: 'Random gene replaced at configured mutation rate' },
  6: { from: ['Chromosomes'], to: ['Children'], arrow: 'Fitness evaluated; chromosomes become individuals' },
};

/** Renders the operation flow diagram (input pools → transform → output pools). */
export const TransformView: React.FC<{
  coordinate: TimeCoordinate;
  result: GenerationResult;
}> = ({ coordinate, result }) => {
  const desc = getTransformDescription(coordinate.operation);
  const transition = OP_POOL_TRANSITIONS[coordinate.operation]!;
  const op = getOp(coordinate.operation);

  const beforeSnap = getPipelineState(result.pipeline, coordinate.operation, 0);
  const afterSnap = getPipelineState(result.pipeline, coordinate.operation, 2);
  const beforeCount = Object.values(beforeSnap).reduce((sum, arr) => sum + (arr?.length ?? 0), 0);
  const afterCount = Object.values(afterSnap).reduce((sum, arr) => sum + (arr?.length ?? 0), 0);

  const delta = afterCount - beforeCount;
  const deltaLabel = delta > 0 ? `+${delta}` : delta < 0 ? `${delta}` : '0';
  const deltaColor = delta > 0 ? colors.accent.green : delta < 0 ? colors.accent.red : colors.text.secondary;

  return (
    <div style={transformStyles.container}>
      <div style={transformStyles.title}>{desc.title}</div>
      <div style={transformStyles.description}>{desc.description}</div>

      <div style={transformStyles.flow}>
        <div style={transformStyles.poolColumn}>
          <div style={transformStyles.columnLabel}>Input</div>
          {transition.from.map(name => (
            <div key={name} style={transformStyles.poolBox}>{name}</div>
          ))}
          <div style={transformStyles.countLabel}>{beforeCount}</div>
        </div>

        <div style={transformStyles.arrowColumn}>
          <div style={{ ...transformStyles.opBadge, backgroundColor: op.type === 'remove' ? '#4a1a1a' : op.type === 'add' ? '#1a4a1a' : '#1a1a4a' }}>
            {op.type}
          </div>
          <div style={transformStyles.arrowLine}>
            <span style={transformStyles.arrowText}>{transition.arrow}</span>
            <span style={transformStyles.arrowHead}>&rarr;</span>
          </div>
          <div style={{ ...transformStyles.deltaLabel, color: deltaColor }}>
            {deltaLabel} individuals
          </div>
        </div>

        <div style={transformStyles.poolColumn}>
          <div style={transformStyles.columnLabel}>Output</div>
          {transition.to.map(name => (
            <div key={name} style={transformStyles.poolBox}>{name}</div>
          ))}
          <div style={transformStyles.countLabel}>{afterCount}</div>
        </div>
      </div>

      <div style={transformStyles.detail}>{desc.detail}</div>
    </div>
  );
};

const columnHelper = createColumnHelper<Individual>();

const columns = [
  columnHelper.accessor('id', {
    header: '#',
    size: 48,
    enableSorting: true,
    enableColumnFilter: false,
  }),
  ...Array.from({ length: 8 }, (_, i) =>
    columnHelper.accessor(row => row.solution[i], {
      id: `gene${i}`,
      header: () => i === 0 ? '\uD83E\uDDEC' : '',
      size: 28,
      enableSorting: i === 0,
      enableColumnFilter: false,
    })
  ),
  columnHelper.accessor('fitness', {
    header: '\uD83C\uDFC5',
    size: 30,
    enableSorting: true,
    enableColumnFilter: false,
  }),
  columnHelper.accessor('age', {
    header: '\uD83D\uDC23',
    size: 30,
    enableSorting: true,
    enableColumnFilter: true,
    filterFn: 'equals',
  }),
];

/** Virtualized, sortable grid of individuals. Set `flex` to fill a flex container. */
export const IndividualList: React.FC<{
  individuals: Individual[];
  onClickItem: (ind: Individual) => void;
  sorting: SortingState;
  onSortingChange: React.Dispatch<React.SetStateAction<SortingState>>;
  columnFilters: ColumnFiltersState;
  onColumnFiltersChange: React.Dispatch<React.SetStateAction<ColumnFiltersState>>;
  /** If true, list fills its flex container instead of a fixed 300px height */
  flex?: boolean;
}> = ({ individuals, onClickItem, sorting, onSortingChange, columnFilters, onColumnFiltersChange, flex = false }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const table = useReactTable({
    data: individuals,
    columns,
    state: { sorting, columnFilters },
    onSortingChange,
    onColumnFiltersChange,
    enableSortingRemoval: false,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  });

  const { rows } = table.getRowModel();

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ITEM_HEIGHT,
    overscan: 5,
  });

  const idWidth = useMemo(() => {
    let maxLen = 3;
    for (const ind of individuals) {
      const len = formatId(ind).length;
      if (len > maxLen) maxLen = len;
    }
    return maxLen;
  }, [individuals]);

  if (individuals.length === 0) {
    return <div style={listStyles.emptyPool}>Empty</div>;
  }

  const idHeader = table.getColumn('id')!;
  const gene0Header = table.getColumn('gene0')!;
  const fitnessHeader = table.getColumn('fitness')!;
  const ageHeader = table.getColumn('age')!;
  const idSorted = idHeader.getIsSorted();
  const gene0Sorted = gene0Header.getIsSorted();
  const fitnessSorted = fitnessHeader.getIsSorted();
  const ageSorted = ageHeader.getIsSorted();

  const scrollContainerStyle: React.CSSProperties = flex
    ? {
        flex: 1,
        minHeight: 0,
        overflowY: 'auto',
        overflowX: 'hidden',
        backgroundColor: colors.bg.raised,
        borderRadius: '0 0 4px 4px',
        border: `1px solid ${colors.border.subtle}`,
      }
    : gridStyles.scrollContainer!;

  return (
    <div style={{ ...gridStyles.wrapper, ...(flex ? { flex: 1, minHeight: 0 } : {}) }}>
      <div style={gridStyles.headerRow}>
        <span
          data-help="Sort by ID (click to toggle)"
          onClick={idHeader.getToggleSortingHandler()}
          style={{ ...gridStyles.headerCell, cursor: 'pointer', borderBottom: idSorted ? `2px solid ${colors.text.secondary}` : '2px solid transparent' }}
        >#</span>
        <span
          data-help="Sort by first gene (click to toggle)"
          onClick={gene0Header.getToggleSortingHandler()}
          style={{ gridColumn: '2', ...gridStyles.headerCell, cursor: 'pointer', borderBottom: gene0Sorted ? `2px solid ${colors.text.secondary}` : '2px solid transparent' }}
        >{'\uD83E\uDDEC'}</span>
        <span
          data-help="Sort by fitness (click to toggle)"
          onClick={fitnessHeader.getToggleSortingHandler()}
          style={{ gridColumn: '10', ...gridStyles.headerCell, cursor: 'pointer', borderBottom: fitnessSorted ? `2px solid ${colors.accent.gold}` : '2px solid transparent' }}
        >{'\uD83C\uDFC5'}</span>
        <span
          data-help="Sort by age (click to toggle)"
          onClick={ageHeader.getToggleSortingHandler()}
          style={{ gridColumn: '11', ...gridStyles.headerCell, cursor: 'pointer', borderBottom: ageSorted ? `2px solid ${colors.accent.orange}` : '2px solid transparent' }}
        >{'\uD83D\uDC23'}</span>
      </div>
      <div ref={scrollRef} style={scrollContainerStyle}>
        <div style={{ height: virtualizer.getTotalSize(), position: 'relative' as const }}>
          {virtualizer.getVirtualItems().map(virtualRow => {
            const row = rows[virtualRow.index]!;
            const ind = row.original;
            return (
              <div
                key={ind.id}
                className="vl-row"
                style={{
                  ...gridStyles.row,
                  position: 'absolute' as const,
                  top: virtualRow.start,
                  width: '100%',
                  backgroundColor: virtualRow.index % 2 === 1 ? colors.interactive.rowStripe : 'transparent',
                }}
                onClick={() => onClickItem(ind)}
              >
                <span style={gridStyles.id}>{formatId(ind).padStart(idWidth)}</span>
                {ind.solution.map((gene, gi) => (
                  <span key={gi} style={gridStyles.gene}>{gene}</span>
                ))}
                <span style={gridStyles.fitness}>{ind.fitness}</span>
                <span style={{ ...gridStyles.age, color: AGE_COLORS[ind.age] }}>{ind.age}</span>
              </div>
            );
          })}
        </div>
      </div>
      {rows.length < individuals.length && (
        <div style={listStyles.filterCount}>{rows.length} of {individuals.length} shown</div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const listStyles: Record<string, React.CSSProperties> = {
  emptyPool: {
    color: colors.text.disabled,
    fontSize: 10,
    fontStyle: 'italic' as const,
    padding: '4px 8px',
  },
  filterCount: {
    color: colors.text.tertiary,
    fontSize: 9,
    padding: '4px 6px',
    textAlign: 'center' as const,
    fontFamily: 'monospace',
  },
};

const gridStyles: Record<string, React.CSSProperties> = {
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
  scrollContainer: {
    height: 300,
    overflowY: 'auto' as const,
    overflowX: 'hidden' as const,
    backgroundColor: colors.bg.raised,
    borderRadius: '0 0 4px 4px',
    border: `1px solid ${colors.border.subtle}`,
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

const transformStyles: Record<string, React.CSSProperties> = {
  container: {
    padding: '8px 0',
  },
  title: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.text.primary,
    marginBottom: 4,
  },
  description: {
    fontSize: 11,
    color: colors.text.secondary,
    marginBottom: 16,
  },
  flow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 16,
  },
  poolColumn: {
    flex: '0 0 auto',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: 4,
    minWidth: 80,
  },
  columnLabel: {
    fontSize: 9,
    color: colors.text.tertiary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  poolBox: {
    padding: '4px 8px',
    borderRadius: 4,
    backgroundColor: colors.bg.surface,
    border: `1px solid ${colors.border.strong}`,
    color: colors.text.secondary,
    fontSize: 10,
    textAlign: 'center' as const,
    width: '100%',
    boxSizing: 'border-box' as const,
  },
  countLabel: {
    fontSize: 9,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  arrowColumn: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minHeight: 60,
    paddingTop: 14,
  },
  opBadge: {
    padding: '2px 8px',
    borderRadius: 3,
    fontSize: 9,
    fontWeight: 'bold',
    textTransform: 'uppercase' as const,
    color: colors.text.secondary,
  },
  arrowLine: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  arrowText: {
    fontSize: 9,
    color: colors.text.secondary,
    textAlign: 'center' as const,
    maxWidth: 120,
  },
  arrowHead: {
    fontSize: 16,
    color: colors.accent.purple,
  },
  deltaLabel: {
    fontSize: 9,
    fontWeight: 'bold',
  },
  detail: {
    fontSize: 10,
    color: colors.text.tertiary,
    lineHeight: '1.5',
    padding: '8px 10px',
    backgroundColor: colors.bg.raised,
    borderRadius: 4,
    border: `1px solid ${colors.border.subtle}`,
    whiteSpace: 'pre-line' as const,
  },
};
