import React, { useMemo, useRef, useState } from 'react';
import type { Individual, Age, GenerationResult, PoolOrigin, PoolName, TimeCoordinate } from '../../engine/types';
import { getOp, poolDisplayName, getTransformDescription, getPipelineState, resolvePoolFromPipeline, GENERATION_OPS, OPS_PER_GENERATION, SCREENS_PER_OP } from '../../engine/time-coordinate';
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

const AGE_COLORS: Record<Age, string> = { 0: colors.age.chromosome, 1: colors.age.child, 2: colors.age.adult, 3: colors.age.elder };

// Grid cell widths matching BreedingListboxes
const COL_ID = '48px';
const COL_GENE = '28px';
const COL_FIT = '30px';
const COL_AGE = '30px';
const ITEM_HEIGHT = 28;

const CELL: React.CSSProperties = {
  borderRight: `1px solid ${colors.border.subtle}`,
  padding: '0 3px',
};

const GRID_COLS = `${COL_ID} repeat(8, ${COL_GENE}) ${COL_FIT} ${COL_AGE}`;

interface Props {
  coordinate: TimeCoordinate;
  result: GenerationResult;
  onSelectIndividual: (individual: Individual, origin: PoolOrigin) => void;
  /** For crossover pair browsing (op 4) */
  browsePairIndex: number;
  onPairChange: (index: number) => void;
  /** Navigate to a specific operation/boundary within the current generation */
  onNavigate?: (operation: number, boundary: 0 | 1 | 2) => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  Aging: colors.category.aging,
  Pruning: colors.category.pruning,
  Selection: colors.category.selection,
  Crossover: colors.category.crossover,
  Mutation: colors.category.mutation,
  Birth: colors.category.birth,
};

const BOUNDARY_LABELS = ['Before', 'Transform', 'After'] as const;

/** Progress bar showing current position within the 24-step pipeline. Each micro step is a clickable segment. */
export const PipelineProgress: React.FC<{ coordinate: TimeCoordinate; onNavigate?: (operation: number, boundary: 0 | 1 | 2) => void; compact?: boolean }> = ({ coordinate, onNavigate, compact }) => {
  const currentStep = coordinate.operation * SCREENS_PER_OP + coordinate.boundary;
  const totalSteps = OPS_PER_GENERATION * SCREENS_PER_OP;

  return (
    <div style={compact ? progressStyles.compactContainer : progressStyles.container} data-help={`Step ${currentStep + 1} of ${totalSteps}: ${GENERATION_OPS[coordinate.operation]!.category} — ${GENERATION_OPS[coordinate.operation]!.name}`}>
      {/* Step counter */}
      {!compact && (
        <div style={progressStyles.stepCounter}>
          <span style={progressStyles.stepCurrent}>{currentStep + 1}</span>
          <span style={progressStyles.stepSlash}>/</span>
          <span style={progressStyles.stepTotal}>{totalSteps}</span>
        </div>
      )}
      {/* Main pipeline bar — 24 segments (3 per operation), grouped by category */}
      <div key={coordinate.generation} style={progressStyles.bar}>
        {GENERATION_OPS.map((op, opIdx) => {
          const color = CATEGORY_COLORS[op.category] ?? colors.text.disabled;
          return (
            <div key={opIdx} style={progressStyles.opGroup}>
              {([0, 1, 2] as const).map((bIdx) => {
                const stepIdx = opIdx * SCREENS_PER_OP + bIdx;
                const isCurrent = currentStep === stepIdx;
                const isPast = currentStep > stepIdx;
                return (
                  <div
                    key={bIdx}
                    onClick={() => onNavigate?.(opIdx, bIdx)}
                    data-help={`${op.category}: ${op.name} (${BOUNDARY_LABELS[bIdx]})`}
                    style={{
                      ...progressStyles.segment,
                      flex: 1,
                      backgroundColor: isCurrent ? color : isPast ? color + '55' : colors.bg.raised,
                      borderRight: bIdx < 2 ? `1px solid ${isPast || isCurrent ? color + '33' : colors.bg.base}` : 'none',
                      boxShadow: isCurrent ? `0 0 6px ${color}88` : 'none',
                      cursor: onNavigate ? 'pointer' : undefined,
                    }}
                  />
                );
              })}
            </div>
          );
        })}
      </div>
      {/* Category labels below the bar */}
      {!compact && (
        <div style={progressStyles.labels}>
          {GENERATION_OPS.map((op, opIdx) => {
            const isActive = coordinate.operation === opIdx;
            return (
              <div
                key={opIdx}
                onClick={() => onNavigate?.(opIdx, 0)}
                style={{
                  ...progressStyles.label,
                  color: isActive ? (CATEGORY_COLORS[op.category] ?? colors.text.secondary) : colors.text.disabled,
                  fontWeight: isActive ? 'bold' : 'normal',
                  cursor: onNavigate ? 'pointer' : undefined,
                }}
              >
                {op.category}
              </div>
            );
          })}
        </div>
      )}

      {/* Sub-bar: 3 boundary phases for the current operation */}
      <div key={`${coordinate.generation}.${coordinate.operation}`} style={compact ? progressStyles.compactSubBar : progressStyles.subBar}>
        {BOUNDARY_LABELS.map((label, idx) => {
          const isCurrent = coordinate.boundary === idx;
          const isPast = coordinate.boundary > idx;
          const activeColor = CATEGORY_COLORS[GENERATION_OPS[coordinate.operation]!.category] ?? colors.text.disabled;
          return (
            <div
              key={idx}
              onClick={() => onNavigate?.(coordinate.operation, idx as 0 | 1 | 2)}
              style={{
                ...progressStyles.subSegment,
                backgroundColor: isCurrent ? activeColor : isPast ? activeColor + '44' : colors.bg.raised,
                borderRight: idx < 2 ? `1px solid ${colors.bg.base}` : 'none',
                boxShadow: isCurrent ? `0 0 4px ${activeColor}88` : 'none',
                cursor: onNavigate ? 'pointer' : undefined,
              }}
            >
              <span style={{
                ...progressStyles.subLabel,
                color: isCurrent ? '#fff' : isPast ? colors.text.secondary : colors.text.disabled,
              }}>
                {label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};


/** Describes before→after pool transitions for each operation. */
const OP_POOL_TRANSITIONS: Record<number, { from: string[]; to: string[]; arrow: string }> = {
  0: { from: ['Old Parents', 'Previous Children'], to: ['Eligible Adults', 'Elders'], arrow: 'All individuals age: children→adults, adults→elders' },
  1: { from: ['Eligible Adults', 'Elders'], to: ['Eligible Adults'], arrow: 'Elders removed from population' },
  2: { from: ['Eligible Adults'], to: ['Selected Pairs', 'Unselected'], arrow: 'Roulette wheel picks breeding pairs' },
  3: { from: ['Selected Pairs', 'Unselected'], to: ['Mated Parents', 'Unselected'], arrow: 'Pairs assigned as breeding partners (A, B)' },
  4: { from: ['Mated Parents', 'Unselected'], to: ['Mated Parents', 'Unselected', 'Chromosomes'], arrow: 'Single-point crossover produces 2 children per pair' },
  5: { from: ['Chromosomes'], to: ['Chromosomes'], arrow: 'Random gene replaced at configured mutation rate' },
  6: { from: ['Chromosomes'], to: ['Children'], arrow: 'Fitness evaluated; chromosomes become individuals' },
};

/** Renders the transform visualization for a given operation. */
const TransformView: React.FC<{
  coordinate: TimeCoordinate;
  result: GenerationResult;
}> = ({ coordinate, result }) => {
  const desc = getTransformDescription(coordinate.operation);
  const transition = OP_POOL_TRANSITIONS[coordinate.operation]!;
  const op = getOp(coordinate.operation);

  // Compute counts for before/after pools using the pipeline
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

      {/* Flow diagram: before pools → operation → after pools */}
      <div style={transformStyles.flow}>
        {/* Before pools */}
        <div style={transformStyles.poolColumn}>
          <div style={transformStyles.columnLabel}>Input</div>
          {transition.from.map(name => (
            <div key={name} style={transformStyles.poolBox}>{name}</div>
          ))}
          <div style={transformStyles.countLabel}>{beforeCount}</div>
        </div>

        {/* Arrow with operation */}
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

        {/* After pools */}
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

/** Renders a virtualized, sortable grid table of individuals using TanStack Table. */
const IndividualList: React.FC<{
  individuals: Individual[];
  onClickItem: (ind: Individual) => void;
  sorting: SortingState;
  onSortingChange: React.Dispatch<React.SetStateAction<SortingState>>;
  columnFilters: ColumnFiltersState;
  onColumnFiltersChange: React.Dispatch<React.SetStateAction<ColumnFiltersState>>;
}> = ({ individuals, onClickItem, sorting, onSortingChange, columnFilters, onColumnFiltersChange }) => {
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
    return <div style={styles.emptyPool}>Empty</div>;
  }

  const idHeader = table.getColumn('id')!;
  const gene0Header = table.getColumn('gene0')!;
  const fitnessHeader = table.getColumn('fitness')!;
  const ageHeader = table.getColumn('age')!;
  const idSorted = idHeader.getIsSorted();
  const gene0Sorted = gene0Header.getIsSorted();
  const fitnessSorted = fitnessHeader.getIsSorted();
  const ageSorted = ageHeader.getIsSorted();

  return (
    <div style={gridStyles.wrapper}>
      <div style={gridStyles.headerRow}>
        <span
          data-help="Sort by ID (click to toggle)"
          onClick={idHeader.getToggleSortingHandler()}
          style={{
            ...gridStyles.headerCell,
            cursor: 'pointer',
            borderBottom: idSorted ? `2px solid ${colors.text.secondary}` : '2px solid transparent',
          }}
        >#</span>
        <span
          data-help="Sort by first gene (click to toggle)"
          onClick={gene0Header.getToggleSortingHandler()}
          style={{
            gridColumn: '2',
            ...gridStyles.headerCell,
            cursor: 'pointer',
            borderBottom: gene0Sorted ? `2px solid ${colors.text.secondary}` : '2px solid transparent',
          }}
        >{'\uD83E\uDDEC'}</span>
        <span
          data-help="Sort by fitness (click to toggle)"
          onClick={fitnessHeader.getToggleSortingHandler()}
          style={{
            gridColumn: '10',
            ...gridStyles.headerCell,
            cursor: 'pointer',
            borderBottom: fitnessSorted ? `2px solid ${colors.accent.gold}` : '2px solid transparent',
          }}
        >{'\uD83C\uDFC5'}</span>
        <span
          data-help="Sort by age (click to toggle)"
          onClick={ageHeader.getToggleSortingHandler()}
          style={{
            gridColumn: '11',
            ...gridStyles.headerCell,
            cursor: 'pointer',
            borderBottom: ageSorted ? `2px solid ${colors.accent.orange}` : '2px solid transparent',
          }}
        >{'\uD83D\uDC23'}</span>
      </div>
      <div ref={scrollRef} style={gridStyles.scrollContainer}>
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
        <div style={styles.filterCount}>{rows.length} of {individuals.length} shown</div>
      )}
    </div>
  );
};

type PoolFilter = PoolName | 'all' | 'removed' | 'survived';

export const SubPhaseScreen: React.FC<Props> = ({
  coordinate,
  result,
  onSelectIndividual,
  browsePairIndex,
  onPairChange,
  onNavigate,
}) => {
  const op = getOp(coordinate.operation);
  const pools = Object.keys(
    getPipelineState(result.pipeline, coordinate.operation, coordinate.boundary)
  ) as PoolName[];
  const [poolFilter, setPoolFilter] = useState<PoolFilter>(() => pools.length > 1 ? 'all' : (pools[0] ?? 'all'));
  const [sorting, setSorting] = useState<SortingState>([{ id: 'fitness', desc: true }]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  const poolData = useMemo(() => {
    return pools.map(poolName => ({
      name: poolName,
      individuals: resolvePoolFromPipeline(poolName, result.pipeline, coordinate.operation, coordinate.boundary),
    }));
  }, [pools, result, coordinate]);

  // Reset filters when pools change (new coordinate)
  const poolKey = pools.join(',');
  const [prevPoolKey, setPrevPoolKey] = useState(poolKey);
  if (poolKey !== prevPoolKey) {
    setPrevPoolKey(poolKey);
    setPoolFilter(pools.length > 1 ? 'all' : (pools[0] ?? 'all'));
    setColumnFilters([]);
  }

  const allIndividuals = useMemo(() => {
    const seen = new Set<number>();
    const all: Individual[] = [];
    for (const { individuals } of poolData) {
      for (const ind of individuals) {
        if (!seen.has(ind.id)) {
          seen.add(ind.id);
          all.push(ind);
        }
      }
    }
    return all;
  }, [poolData]);

  // Compute removed/survived by comparing before vs after pools
  const { removedIds, survivedIds, hasTransformDiff, removedCount, survivedCount } = useMemo(() => {
    const collectIds = (boundary: 0 | 1 | 2) => {
      const snap = getPipelineState(result.pipeline, coordinate.operation, boundary);
      const ids = new Set<number>();
      for (const arr of Object.values(snap)) {
        for (const ind of (arr ?? [])) ids.add(ind.id);
      }
      return ids;
    };

    const beforeIds = collectIds(0);
    const afterIds = collectIds(2);

    const removed = new Set<number>();
    const survived = new Set<number>();
    for (const id of beforeIds) {
      if (afterIds.has(id)) survived.add(id);
      else removed.add(id);
    }

    return {
      removedIds: removed,
      survivedIds: survived,
      hasTransformDiff: removed.size > 0,
      removedCount: removed.size,
      survivedCount: survived.size,
    };
  }, [coordinate, result]);

  // Resolve the displayed individuals based on pool filter
  const displayedIndividuals = useMemo(() => {
    if (poolFilter === 'all') return allIndividuals;
    if (poolFilter === 'removed') return allIndividuals.filter(ind => removedIds.has(ind.id));
    if (poolFilter === 'survived') return allIndividuals.filter(ind => survivedIds.has(ind.id));
    const pool = poolData.find(p => p.name === poolFilter);
    return pool ? pool.individuals : allIndividuals;
  }, [poolFilter, allIndividuals, poolData, removedIds, survivedIds]);

  // Compute age facets from displayed individuals for filter chips
  const ageFacets = useMemo(() => {
    const counts = new Map<Age, number>();
    for (const ind of displayedIndividuals) {
      counts.set(ind.age, (counts.get(ind.age) ?? 0) + 1);
    }
    return counts;
  }, [displayedIndividuals]);

  const handleClick = (ind: Individual) => {
    // Determine the best pool for the origin
    let pool: PoolName = pools[0] ?? 'eligibleAdults';
    if (poolFilter !== 'all' && poolFilter !== 'removed' && poolFilter !== 'survived') {
      pool = poolFilter;
    }
    onSelectIndividual(ind, { coordinate, pool });
  };

  // Pool filter chip options
  const poolChips = useMemo(() => {
    const chips: { value: PoolFilter; label: string }[] = [];
    if (pools.length > 1) {
      chips.push({ value: 'all', label: `All (${allIndividuals.length})` });
    }
    for (const { name, individuals } of poolData) {
      chips.push({ value: name, label: `${poolDisplayName({ coordinate, pool: name })} (${individuals.length})` });
    }
    if (hasTransformDiff) {
      chips.push({ value: 'removed', label: `Removed (${removedCount})` });
      chips.push({ value: 'survived', label: `Survived (${survivedCount})` });
    }
    return chips;
  }, [pools, poolData, coordinate, allIndividuals, hasTransformDiff, removedCount, survivedCount]);

  // Age filter: toggle an age value in columnFilters
  const activeAgeFilter = columnFilters.find(f => f.id === 'age')?.value as Age | undefined;

  const isCrossoverAdd = coordinate.operation === 4 && coordinate.boundary === 2;
  const totalPairs = result.breedingData.aParents.length;
  const showLists = coordinate.boundary !== 1;
  const hasNoData = pools.length === 0 || (displayedIndividuals.length === 0 && poolData.every(p => p.individuals.length === 0));

  return (
    <div style={styles.panel}>
      <style>{`.vl-row:not(.vl-selected):hover { background-color: ${colors.interactive.hover} !important; }`}</style>
      <h3 style={styles.panelTitle} data-help="Population data at each step of the genetic algorithm pipeline">Population</h3>
      <PipelineProgress coordinate={coordinate} onNavigate={onNavigate} />
      <div style={styles.header}>
        <span style={styles.opCategory}>{op.category}</span>
      </div>

      {coordinate.boundary === 1 && <TransformView coordinate={coordinate} result={result} />}

      {/* Pool & age filter dropdowns */}
      {showLists && (
        <div style={styles.filterRow}>
          {poolChips.length > 1 && (
            <select
              data-help="Filter by pool"
              value={poolFilter}
              onChange={e => { setPoolFilter(e.target.value as PoolFilter); setColumnFilters([]); }}
              style={styles.filterSelect}
            >
              {poolChips.map(chip => (
                <option key={chip.value} value={chip.value}>{chip.label}</option>
              ))}
            </select>
          )}
          {ageFacets.size > 0 && (
            <select
              data-help="Filter by age"
              value={activeAgeFilter ?? ''}
              onChange={e => {
                const val = e.target.value;
                if (val === '') {
                  setColumnFilters(prev => prev.filter(f => f.id !== 'age'));
                } else {
                  setColumnFilters(prev => [...prev.filter(f => f.id !== 'age'), { id: 'age', value: Number(val) }]);
                }
              }}
              style={styles.filterSelect}
            >
              <option value="">All ages</option>
              {([0, 1, 2, 3] as Age[]).filter(age => ageFacets.has(age)).map(age => (
                <option key={age} value={age}>Age {age} ({ageFacets.get(age)})</option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* Crossover pair browser */}
      {isCrossoverAdd && totalPairs > 0 && (
        <div style={styles.pairNav}>
          <button
            onClick={() => onPairChange(Math.max(0, browsePairIndex - 1))}
            disabled={browsePairIndex === 0}
            style={{ ...styles.navBtn, opacity: browsePairIndex === 0 ? 0.3 : 1 }}
          >
            Prev
          </button>
          <span style={styles.pairLabel}>
            Pair {browsePairIndex + 1} of {totalPairs.toLocaleString()}
          </span>
          <button
            onClick={() => onPairChange(Math.min(totalPairs - 1, browsePairIndex + 1))}
            disabled={browsePairIndex >= totalPairs - 1}
            style={{ ...styles.navBtn, opacity: browsePairIndex >= totalPairs - 1 ? 0.3 : 1 }}
          >
            Next
          </button>
        </div>
      )}

      {/* Individual list */}
      {showLists && displayedIndividuals.length > 0 && (
        <div style={styles.poolSection}>
          <IndividualList
            individuals={displayedIndividuals}
            onClickItem={handleClick}
            sorting={sorting}
            onSortingChange={setSorting}
            columnFilters={columnFilters}
            onColumnFiltersChange={setColumnFilters}
          />
        </div>
      )}

      {showLists && displayedIndividuals.length === 0 && !hasNoData && (
        <div style={styles.emptyPool}>No individuals match the current filter</div>
      )}

      {showLists && hasNoData && (
        <div style={styles.noOp}>No population data at this coordinate.</div>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  panelTitle: {
    margin: '0 0 12px 0',
    fontSize: 14,
    fontFamily: 'monospace',
    color: colors.text.secondary,
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
  },
  panel: {
    backgroundColor: colors.bg.surface,
    borderRadius: 8,
    padding: 16,
    border: `1px solid ${colors.border.subtle}`,
    flex: '1 1 300px',
    fontFamily: 'monospace',
    fontSize: 11,
    overflow: 'auto',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
    fontSize: 14,
    fontFamily: 'monospace',
    color: colors.text.secondary,
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
  },
  opCategory: {
  },
  filterRow: {
    display: 'flex',
    gap: 8,
    marginBottom: 10,
  },
  filterSelect: {
    fontSize: 10,
    fontFamily: 'monospace',
    padding: '4px 6px',
    backgroundColor: colors.bg.raised,
    color: colors.text.primary,
    border: `1px solid ${colors.border.subtle}`,
    borderRadius: 4,
    cursor: 'pointer',
    outline: 'none',
    flex: '0 1 auto',
    minWidth: 0,
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
    backgroundColor: colors.bg.overlay,
    color: colors.text.primary,
    border: `1px solid ${colors.border.strong}`,
    borderRadius: 3,
    cursor: 'pointer',
  },
  pairLabel: {
    fontSize: 10,
    fontFamily: 'monospace',
    color: colors.text.secondary,
  },
  poolSection: {
    marginBottom: 12,
  },
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
  noOp: {
    color: colors.text.disabled,
    fontSize: 11,
    textAlign: 'center' as const,
    padding: 20,
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

const progressStyles: Record<string, React.CSSProperties> = {
  container: {
    marginBottom: 12,
  },
  compactContainer: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 2,
    minWidth: 160,
  },
  stepCounter: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'flex-end',
    gap: 1,
    marginBottom: 4,
    fontFamily: 'monospace',
  },
  stepCurrent: {
    fontSize: 13,
    fontWeight: 'bold',
    color: colors.text.primary,
  },
  stepSlash: {
    fontSize: 10,
    color: colors.text.disabled,
  },
  stepTotal: {
    fontSize: 10,
    color: colors.text.tertiary,
  },
  bar: {
    display: 'flex',
    gap: 2,
    height: 8,
    borderRadius: 3,
    overflow: 'hidden',
  },
  opGroup: {
    flex: 1,
    display: 'flex',
    gap: 0,
    height: '100%',
    borderRadius: 2,
    overflow: 'hidden',
  },
  segment: {
    height: '100%',
    transition: 'background-color 0.2s, box-shadow 0.2s',
  },
  labels: {
    display: 'flex',
    marginTop: 3,
    gap: 2,
  },
  label: {
    flex: 1,
    fontSize: 7,
    textAlign: 'center' as const,
    letterSpacing: 0.3,
    textTransform: 'uppercase' as const,
    transition: 'color 0.2s',
  },
  subBar: {
    display: 'flex',
    height: 18,
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: 6,
  },
  compactSubBar: {
    display: 'flex',
    height: 14,
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 4,
  },
  subSegment: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background-color 0.2s, box-shadow 0.2s',
  },
  subLabel: {
    fontSize: 8,
    fontFamily: 'monospace',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    transition: 'color 0.2s',
  },
};
