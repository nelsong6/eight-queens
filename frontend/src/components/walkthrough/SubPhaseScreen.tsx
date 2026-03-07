import React, { useMemo, useRef, useState } from 'react';
import type { Individual, Age, GenerationResult, PoolOrigin, PoolName, TimeCoordinate } from '../../engine/types';
import { getOp, getPoolsAtCoordinate, poolDisplayName, getTransformDescription, GENERATION_OPS, OPS_PER_GENERATION, SCREENS_PER_OP } from '../../engine/time-coordinate';
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

const AGE_COLORS: Record<Age, string> = { 0: '#888', 1: '#3498db', 2: '#2ecc71', 3: '#e67e22' };

// Grid cell widths matching BreedingListboxes
const COL_ID = '36px';
const COL_GENE = '22px';
const COL_FIT = '24px';
const COL_AGE = '24px';
const ITEM_HEIGHT = 22;

const CELL: React.CSSProperties = {
  borderRight: '1px solid #232346',
  padding: '0 3px',
};

const GRID_COLS = `${COL_ID} repeat(8, ${COL_GENE}) ${COL_FIT} ${COL_AGE}`;

interface Props {
  coordinate: TimeCoordinate;
  result: GenerationResult;
  previousResult: GenerationResult | null;
  onSelectIndividual: (individual: Individual, origin: PoolOrigin) => void;
  /** For crossover pair browsing (op 5) */
  browsePairIndex: number;
  onPairChange: (index: number) => void;
  /** Navigate to a specific operation/boundary within the current generation */
  onNavigate?: (operation: number, boundary: 0 | 1 | 2) => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  Aging: '#e67e22',
  Pruning: '#e74c3c',
  Selection: '#3498db',
  Crossover: '#9b59b6',
  Mutation: '#2ecc71',
  Birth: '#1abc9c',
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
      <div style={progressStyles.bar}>
        {GENERATION_OPS.map((op, opIdx) => {
          const color = CATEGORY_COLORS[op.category] ?? '#555';
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
                      backgroundColor: isCurrent ? color : isPast ? color + '55' : '#1a1a35',
                      borderRight: bIdx < 2 ? `1px solid ${isPast || isCurrent ? color + '33' : '#0e0e1a'}` : 'none',
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
                  color: isActive ? (CATEGORY_COLORS[op.category] ?? '#aaa') : '#444',
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
      <div style={compact ? progressStyles.compactSubBar : progressStyles.subBar}>
        {BOUNDARY_LABELS.map((label, idx) => {
          const isCurrent = coordinate.boundary === idx;
          const isPast = coordinate.boundary > idx;
          const activeColor = CATEGORY_COLORS[GENERATION_OPS[coordinate.operation]!.category] ?? '#555';
          return (
            <div
              key={idx}
              onClick={() => onNavigate?.(coordinate.operation, idx as 0 | 1 | 2)}
              style={{
                ...progressStyles.subSegment,
                backgroundColor: isCurrent ? activeColor : isPast ? activeColor + '44' : '#1a1a35',
                borderRight: idx < 2 ? '1px solid #0e0e1a' : 'none',
                boxShadow: isCurrent ? `0 0 4px ${activeColor}88` : 'none',
                cursor: onNavigate ? 'pointer' : undefined,
              }}
            >
              <span style={{
                ...progressStyles.subLabel,
                color: isCurrent ? '#fff' : isPast ? '#888' : '#444',
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

/** Resolve a pool name to actual individuals from the generation result. */
function resolvePool(pool: PoolName, result: GenerationResult, previousResult: GenerationResult | null): Individual[] {
  const bd = result.breedingData;
  switch (pool) {
    case 'oldParents':
      // All adults from previous generation (both mated and unselected, carried over for aging)
      return previousResult ? previousResult.breedingData.eligibleParents : [];
    case 'previousChildren':
      // Children from previous generation (arriving for promotion)
      return previousResult ? previousResult.breedingData.allChildren : [];
    case 'eligibleAdults':
      return bd.eligibleParents;
    case 'retiredParents':
      // Same as oldParents — these are the ones being removed
      return previousResult ? previousResult.breedingData.eligibleParents : [];
    case 'selectedPairs':
      return bd.actualParents;
    case 'unselected': {
      const selectedIds = new Set(bd.actualParents.map(p => p.id));
      return bd.eligibleParents.filter(p => !selectedIds.has(p.id));
    }
    case 'matedParents':
      return bd.actualParents;
    case 'chromosomes':
      return bd.allChildren;
    case 'finalChildren':
      return bd.allChildren;
  }
}

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
  previousResult: GenerationResult | null;
}> = ({ coordinate, result, previousResult }) => {
  const desc = getTransformDescription(coordinate.operation);
  const transition = OP_POOL_TRANSITIONS[coordinate.operation]!;
  const op = getOp(coordinate.operation);

  // Compute counts for before/after pools
  const beforePools = getPoolsAtCoordinate({ ...coordinate, boundary: 0 });
  const afterPools = getPoolsAtCoordinate({ ...coordinate, boundary: 2 });
  const beforeCount = beforePools.reduce((sum, p) => sum + resolvePool(p, result, previousResult).length, 0);
  const afterCount = afterPools.reduce((sum, p) => sum + resolvePool(p, result, previousResult).length, 0);

  const delta = afterCount - beforeCount;
  const deltaLabel = delta > 0 ? `+${delta}` : delta < 0 ? `${delta}` : '0';
  const deltaColor = delta > 0 ? '#2ecc71' : delta < 0 ? '#e74c3c' : '#888';

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
    size: 36,
    enableSorting: true,
    enableColumnFilter: false,
  }),
  ...Array.from({ length: 8 }, (_, i) =>
    columnHelper.accessor(row => row.solution[i], {
      id: `gene${i}`,
      header: () => i === 0 ? '\uD83E\uDDEC' : '',
      size: 22,
      enableSorting: i === 0,
      enableColumnFilter: false,
    })
  ),
  columnHelper.accessor('fitness', {
    header: '\uD83C\uDFC5',
    size: 24,
    enableSorting: true,
    enableColumnFilter: false,
  }),
  columnHelper.accessor('age', {
    header: '\uD83D\uDC23',
    size: 24,
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
    let maxId = 0;
    for (const ind of individuals) if (ind.id > maxId) maxId = ind.id;
    return Math.max(3, String(maxId).length);
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
            borderBottom: idSorted ? '2px solid #888' : '2px solid transparent',
          }}
        >#</span>
        <span
          data-help="Sort by first gene (click to toggle)"
          onClick={gene0Header.getToggleSortingHandler()}
          style={{
            gridColumn: '2',
            ...gridStyles.headerCell,
            cursor: 'pointer',
            borderBottom: gene0Sorted ? '2px solid #888' : '2px solid transparent',
          }}
        >{'\uD83E\uDDEC'}</span>
        <span
          data-help="Sort by fitness (click to toggle)"
          onClick={fitnessHeader.getToggleSortingHandler()}
          style={{
            gridColumn: '10',
            ...gridStyles.headerCell,
            cursor: 'pointer',
            borderBottom: fitnessSorted ? '2px solid #ffd700' : '2px solid transparent',
          }}
        >{'\uD83C\uDFC5'}</span>
        <span
          data-help="Sort by age (click to toggle)"
          onClick={ageHeader.getToggleSortingHandler()}
          style={{
            gridColumn: '11',
            ...gridStyles.headerCell,
            cursor: 'pointer',
            borderBottom: ageSorted ? '2px solid #e67e22' : '2px solid transparent',
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
                  backgroundColor: virtualRow.index % 2 === 1 ? '#16162e' : 'transparent',
                }}
                onClick={() => onClickItem(ind)}
              >
                <span style={gridStyles.id}>{String(ind.id).padStart(idWidth)}</span>
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
  previousResult,
  onSelectIndividual,
  browsePairIndex,
  onPairChange,
  onNavigate,
}) => {
  const op = getOp(coordinate.operation);
  const pools = getPoolsAtCoordinate(coordinate);
  const [poolFilter, setPoolFilter] = useState<PoolFilter>(() => pools.length > 1 ? 'all' : (pools[0] ?? 'all'));
  const [sorting, setSorting] = useState<SortingState>([{ id: 'fitness', desc: true }]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  const poolData = useMemo(() => {
    return pools.map(poolName => ({
      name: poolName,
      individuals: resolvePool(poolName, result, previousResult),
    }));
  }, [pools, result, previousResult]);

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
    const beforePools = getPoolsAtCoordinate({ ...coordinate, boundary: 0 });
    const afterPools = getPoolsAtCoordinate({ ...coordinate, boundary: 2 });

    const collectIds = (poolNames: PoolName[]) => {
      const ids = new Set<number>();
      for (const p of poolNames) {
        for (const ind of resolvePool(p, result, previousResult)) ids.add(ind.id);
      }
      return ids;
    };

    const beforeIds = collectIds(beforePools);
    const afterIds = collectIds(afterPools);

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
  }, [coordinate, result, previousResult]);

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
  const toggleAgeFilter = (age: Age) => {
    setColumnFilters(prev => {
      const existing = prev.find(f => f.id === 'age');
      if (existing && existing.value === age) {
        return prev.filter(f => f.id !== 'age');
      }
      return [...prev.filter(f => f.id !== 'age'), { id: 'age', value: age }];
    });
  };

  const isCrossoverAdd = coordinate.operation === 4 && coordinate.boundary === 2;
  const totalPairs = result.breedingData.aParents.length;
  const showLists = coordinate.boundary !== 1;
  const hasNoData = pools.length === 0 || (displayedIndividuals.length === 0 && poolData.every(p => p.individuals.length === 0));

  return (
    <div style={styles.panel}>
      <style>{'.vl-row:not(.vl-selected):hover { background-color: #24244a !important; }'}</style>
      <h3 style={styles.panelTitle} data-help="Population data at each step of the genetic algorithm pipeline">Population</h3>
      <PipelineProgress coordinate={coordinate} onNavigate={onNavigate} />
      <div style={styles.header}>
        <span style={styles.opCategory}>{op.category}</span>
      </div>

      {coordinate.boundary === 1 && <TransformView coordinate={coordinate} result={result} previousResult={previousResult} />}

      {/* Pool filter chips */}
      {showLists && poolChips.length > 1 && (
        <div style={styles.tabRow}>
          {poolChips.map(chip => (
            <div
              key={chip.value}
              onClick={() => { setPoolFilter(chip.value); setColumnFilters([]); }}
              style={{
                ...styles.tab,
                ...(poolFilter === chip.value ? styles.tabActive : {}),
              }}
            >
              {chip.label}
            </div>
          ))}
        </div>
      )}

      {/* Age filter chips — always render row to prevent layout shift */}
      {showLists && (
        <div style={{ ...styles.tabRow, minHeight: 26 }}>
          {([0, 1, 2, 3] as Age[]).filter(age => ageFacets.has(age)).map(age => (
            <div
              key={age}
              data-help={`Filter to age ${age} individuals`}
              onClick={() => toggleAgeFilter(age)}
              style={{
                ...styles.tab,
                ...(activeAgeFilter === age ? styles.tabActive : {}),
                color: activeAgeFilter === age ? AGE_COLORS[age] : undefined,
                borderColor: activeAgeFilter === age ? AGE_COLORS[age] + '88' : undefined,
              }}
            >
              Age {age} ({ageFacets.get(age)})
            </div>
          ))}
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
    color: '#aaa',
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
  },
  panel: {
    backgroundColor: '#1a1a2e',
    borderRadius: 8,
    padding: 16,
    border: '1px solid #2a2a4a',
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
    color: '#aaa',
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
  },
  opCategory: {
  },
  tabRow: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: 4,
    marginBottom: 10,
  },
  tab: {
    fontSize: 10,
    fontFamily: 'monospace',
    padding: '4px 8px',
    backgroundColor: '#12122a',
    color: '#666',
    border: '1px solid #2a2a4a',
    borderRadius: 4,
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  tabActive: {
    backgroundColor: '#1a1a3e',
    color: '#e0e0e0',
    borderColor: '#4a4a7a',
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
  poolSection: {
    marginBottom: 12,
  },
  emptyPool: {
    color: '#555',
    fontSize: 10,
    fontStyle: 'italic' as const,
    padding: '4px 8px',
  },
  filterCount: {
    color: '#666',
    fontSize: 9,
    padding: '4px 6px',
    textAlign: 'center' as const,
    fontFamily: 'monospace',
  },
  noOp: {
    color: '#555',
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
    fontSize: 10,
    fontFamily: 'monospace',
    backgroundColor: '#1a1a35',
    borderRadius: '4px 4px 0 0',
    border: '1px solid #2a2a4a',
    borderBottom: 'none',
  },
  headerCell: {
    padding: '0 3px',
    textAlign: 'center' as const,
    color: '#555',
    borderBottom: '2px solid transparent',
  },
  scrollContainer: {
    height: 300,
    overflowY: 'auto' as const,
    overflowX: 'hidden' as const,
    backgroundColor: '#12122a',
    borderRadius: '0 0 4px 4px',
    border: '1px solid #2a2a4a',
  },
  row: {
    display: 'grid',
    gridTemplateColumns: GRID_COLS,
    columnGap: 0,
    height: ITEM_HEIGHT,
    lineHeight: `${ITEM_HEIGHT}px`,
    paddingLeft: 6,
    paddingRight: 6,
    fontSize: 11,
    fontFamily: 'monospace',
    color: '#e0e0e0',
    cursor: 'pointer',
  },
  id: { ...CELL, color: '#888', whiteSpace: 'nowrap' as const, textAlign: 'right' as const },
  gene: { ...CELL, color: '#e0e0e0', textAlign: 'center' as const },
  fitness: { ...CELL, color: '#ffd700', whiteSpace: 'nowrap' as const, textAlign: 'right' as const },
  age: { ...CELL, color: '#888', whiteSpace: 'nowrap' as const, textAlign: 'center' as const, fontSize: 10, borderRight: 'none' },
};

const transformStyles: Record<string, React.CSSProperties> = {
  container: {
    padding: '8px 0',
  },
  title: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#e0e0e0',
    marginBottom: 4,
  },
  description: {
    fontSize: 11,
    color: '#aaa',
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
    color: '#666',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  poolBox: {
    padding: '4px 8px',
    borderRadius: 4,
    backgroundColor: '#1a1a3e',
    border: '1px solid #3a3a5a',
    color: '#ccc',
    fontSize: 10,
    textAlign: 'center' as const,
    width: '100%',
    boxSizing: 'border-box' as const,
  },
  countLabel: {
    fontSize: 9,
    color: '#666',
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
    color: '#ccc',
  },
  arrowLine: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  arrowText: {
    fontSize: 9,
    color: '#888',
    textAlign: 'center' as const,
    maxWidth: 120,
  },
  arrowHead: {
    fontSize: 16,
    color: '#6c5ce7',
  },
  deltaLabel: {
    fontSize: 9,
    fontWeight: 'bold',
  },
  detail: {
    fontSize: 10,
    color: '#777',
    lineHeight: '1.5',
    padding: '8px 10px',
    backgroundColor: '#12122a',
    borderRadius: 4,
    border: '1px solid #2a2a4a',
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
    color: '#e0e0e0',
  },
  stepSlash: {
    fontSize: 10,
    color: '#555',
  },
  stepTotal: {
    fontSize: 10,
    color: '#666',
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
