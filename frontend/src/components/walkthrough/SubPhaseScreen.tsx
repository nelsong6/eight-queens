import React, { useMemo, useState } from 'react';
import type { Specimen, Age, GenerationResult, PoolOrigin, PoolName, TimeCoordinate } from '../../engine/types';
import { getOp, poolDisplayName, getPipelineState, resolvePoolFromPipeline, getPoolsAtCoordinate } from '../../engine/time-coordinate';
import { type SortingState, type ColumnFiltersState } from '@tanstack/react-table';
import { SpecimenList } from './SpecimenList';
import { colors } from '../../colors';

interface Props {
  coordinate: TimeCoordinate;
  result: GenerationResult;
  onSelectSpecimen: (specimen: Specimen, origin: PoolOrigin) => void;
  /** For crossover pair browsing (op 4) */
  browsePairIndex: number;
  onPairChange: (index: number) => void;
}

type PoolFilter = PoolName | 'all' | 'removed' | 'survived';

export const SubPhaseScreen: React.FC<Props> = ({
  coordinate,
  result,
  onSelectSpecimen,
  browsePairIndex,
  onPairChange,
}) => {
  const op = getOp(coordinate.operation);
  const pools = getPoolsAtCoordinate(coordinate);
  const [poolFilter, setPoolFilter] = useState<PoolFilter>(() => pools.length > 1 ? 'all' : (pools[0] ?? 'all'));
  const [sorting, setSorting] = useState<SortingState>([{ id: 'fitness', desc: true }]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  const poolData = useMemo(() => {
    return pools.map(poolName => ({
      name: poolName,
      specimens: resolvePoolFromPipeline(poolName, result.pipeline, coordinate.operation, coordinate.boundary),
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

  const allSpecimens = useMemo(() => {
    const seen = new Set<number>();
    const all: Specimen[] = [];
    for (const { specimens } of poolData) {
      for (const ind of specimens) {
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
    const collectIds = (boundary: 0 | 1) => {
      const snap = getPipelineState(result.pipeline, coordinate.operation, boundary);
      return new Set(snap.map(ind => ind.id));
    };

    const beforeIds = collectIds(0);
    const afterIds = collectIds(1);

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

  const displayedSpecimens = useMemo(() => {
    if (poolFilter === 'all') return allSpecimens;
    if (poolFilter === 'removed') return allSpecimens.filter(ind => removedIds.has(ind.id));
    if (poolFilter === 'survived') return allSpecimens.filter(ind => survivedIds.has(ind.id));
    const pool = poolData.find(p => p.name === poolFilter);
    return pool ? pool.specimens : allSpecimens;
  }, [poolFilter, allSpecimens, poolData, removedIds, survivedIds]);

  const ageFacets = useMemo(() => {
    const counts = new Map<Age, number>();
    for (const ind of displayedSpecimens) {
      counts.set(ind.age, (counts.get(ind.age) ?? 0) + 1);
    }
    return counts;
  }, [displayedSpecimens]);

  const handleClick = (ind: Specimen) => {
    let pool: PoolName = pools[0] ?? 'eligibleAdults';
    if (poolFilter !== 'all' && poolFilter !== 'removed' && poolFilter !== 'survived') {
      pool = poolFilter;
    }
    onSelectSpecimen(ind, { coordinate, pool });
  };

  const poolChips = useMemo(() => {
    const chips: { value: PoolFilter; label: string }[] = [];
    if (pools.length > 1) {
      chips.push({ value: 'all', label: `All (${allSpecimens.length})` });
    }
    for (const { name, specimens } of poolData) {
      chips.push({ value: name, label: `${poolDisplayName({ coordinate, pool: name })} (${specimens.length})` });
    }
    if (hasTransformDiff) {
      chips.push({ value: 'removed', label: `Removed (${removedCount})` });
      chips.push({ value: 'survived', label: `Survived (${survivedCount})` });
    }
    return chips;
  }, [pools, poolData, coordinate, allSpecimens, hasTransformDiff, removedCount, survivedCount]);

  const activeAgeFilter = columnFilters.find(f => f.id === 'age')?.value as Age | undefined;

  const isCrossoverAdd = coordinate.operation === 4 && coordinate.boundary === 1;
  const totalPairs = result.breedingData.aParents.length;
  const showLists = true;
  const hasNoData = pools.length === 0 || (displayedSpecimens.length === 0 && poolData.every(p => p.specimens.length === 0));

  return (
    <div style={styles.panel}>
      <style>{`.vl-row:not(.vl-selected):hover { background-color: ${colors.interactive.hover} !important; }`}</style>
      <h3 style={styles.panelTitle} data-help="Population data at each step of the genetic algorithm pipeline">Population</h3>
      <div style={styles.header}>
        <span style={styles.opCategory}>{op.category}</span>
      </div>


      {/* Pool & age filter dropdowns — always reserve space */}
      {showLists && (
        <div style={styles.filterRow}>
          <select
            data-help="Filter by pool"
            value={poolFilter}
            onChange={e => { setPoolFilter(e.target.value as PoolFilter); setColumnFilters([]); }}
            style={{ ...styles.filterSelect, visibility: poolChips.length > 1 ? 'visible' : 'hidden' }}
          >
            {poolChips.map(chip => (
              <option key={chip.value} value={chip.value}>{chip.label}</option>
            ))}
          </select>
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
            style={{ ...styles.filterSelect, visibility: ageFacets.size > 0 ? 'visible' : 'hidden' }}
          >
            <option value="">All ages</option>
            {([0, 1, 2, 3] as Age[]).filter(age => ageFacets.has(age)).map(age => (
              <option key={age} value={age}>Age {age} ({ageFacets.get(age)})</option>
            ))}
          </select>
        </div>
      )}

      {/* Crossover pair browser — always reserve space */}
      <div style={{ ...styles.pairNav, visibility: isCrossoverAdd && totalPairs > 0 ? 'visible' : 'hidden' }}>
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

      {/* Specimen list */}
      {showLists && displayedSpecimens.length > 0 && (
        <div style={styles.poolSection}>
          <SpecimenList
            specimens={displayedSpecimens}
            onClickItem={handleClick}
            sorting={sorting}
            onSortingChange={setSorting}
            columnFilters={columnFilters}
            onColumnFiltersChange={setColumnFilters}
          />
        </div>
      )}

      {showLists && displayedSpecimens.length === 0 && !hasNoData && (
        <div style={styles.emptyPool}>No specimens match the current filter</div>
      )}

      {showLists && hasNoData && (
        <div style={styles.noOp}>No population data at this coordinate.</div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

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
  noOp: {
    color: colors.text.disabled,
    fontSize: 11,
    textAlign: 'center' as const,
    padding: 20,
  },
};
