/**
 * OperationPanel — shows Before and After for one pipeline operation simultaneously.
 * A static transform description box sits between the two data panels.
 * Both sides are shown at equal weight — no active/dim highlighting.
 *
 * Sorting is shared: both sides display rows in the same order.
 * Specimens missing from one side (removed/added) appear as empty placeholder rows.
 */
import React, { useMemo, useState, useRef, useCallback } from 'react';
import type { Specimen, BreedingPair, GenerationResult, GenerationPipeline, PoolOrigin, PoolName, TimeCoordinate } from '../engine/types';
import { getOp, poolDisplayName, getPoolsAtCoordinate, getTransformDescription, getPairsAtCoordinate } from '../engine/time-coordinate';
import { type SortingState } from '@tanstack/react-table';
import { CATEGORY_COLORS } from './walkthrough/SpecimenList';
import { PairList } from './walkthrough/PairList';
import { SyncedSpecimenList, type SyncedListHandle } from './walkthrough/SyncedSpecimenList';
import { colors } from '../colors';

type PoolFilter = PoolName | 'all';

interface Props {
  operation: number;          // 0–5
  result: GenerationResult;
  onSelectSpecimen: (specimen: Specimen, origin: PoolOrigin) => void;
  /** Previous generation's pipeline, for showing pairs at ops 0-1 */
  previousPipeline?: GenerationPipeline;
  onSelectPair?: (pair: BreedingPair) => void;
  selectedPairIndex?: number;
}

interface SyncedRow {
  key: number;
  before: Specimen | null;
  after: Specimen | null;
}

// ---------------------------------------------------------------------------
// Sort comparator — mirrors the column sorting logic from react-table
// ---------------------------------------------------------------------------

function getSortValue(ind: Specimen | null, sortId: string): number | string {
  if (!ind) return sortId === 'id' ? Infinity : -Infinity;
  switch (sortId) {
    case 'id': return ind.id;
    case 'gene0': return ind.solution[0] ?? 0;
    case 'fitness': return ind.fitness;
    case 'age': return ind.age;
    default: return 0;
  }
}

function buildComparator(sorting: SortingState): (a: SyncedRow, b: SyncedRow) => number {
  if (sorting.length === 0) return () => 0;
  const { id: sortId, desc } = sorting[0]!;
  return (a, b) => {
    // Use whichever side has the specimen (prefer before for sort value)
    const aInd = a.before ?? a.after;
    const bInd = b.before ?? b.after;
    const aVal = getSortValue(aInd, sortId);
    const bVal = getSortValue(bInd, sortId);
    let cmp = 0;
    if (aVal < bVal) cmp = -1;
    else if (aVal > bVal) cmp = 1;
    return desc ? -cmp : cmp;
  };
}

// ---------------------------------------------------------------------------
// Dedup helper
// ---------------------------------------------------------------------------

function dedup(poolData: { name: PoolName; specimens: Specimen[] }[]): Specimen[] {
  const seen = new Set<number>();
  const all: Specimen[] = [];
  for (const { specimens } of poolData) {
    for (const ind of specimens) {
      if (!seen.has(ind.id)) { seen.add(ind.id); all.push(ind); }
    }
  }
  return all;
}

// ---------------------------------------------------------------------------
// Before pools — the input state before an operation runs (internal slot 0)
// ---------------------------------------------------------------------------

/** Pool names present before an operation (input state). */
function getBeforePools(operation: number): PoolName[] {
  switch (operation) {
    case 0: return ['oldParents', 'previousChildren'];
    case 1: return ['eligibleAdults', 'retiredParents'];
    case 2: return ['eligibleAdults'];
    case 3: return ['selectedPairs', 'unselected'];
    case 4: return ['chromosomes', 'selectedPairs', 'unselected'];
    case 5: return ['chromosomes', 'selectedPairs', 'unselected'];
    default: return [];
  }
}

/** Resolve a named pool from the before snapshot (internal slot 0). */
function resolveBeforePool(pool: PoolName, pipeline: GenerationPipeline, op: number): Specimen[] {
  const ROLE_FOR_POOL: Record<PoolName, string> = {
    oldParents: 'oldParent',
    previousChildren: 'previousChild',
    retiredParents: 'retiredParent',
    eligibleAdults: 'eligibleAdult',
    selectedPairs: 'selectedPair',
    unselected: 'unselected',
    chromosomes: 'chromosome',
    finalChildren: 'finalChild',
  };
  const role = ROLE_FOR_POOL[pool];
  return pipeline.ops[op]![0].filter(i => i.pipelineRole === role);
}

/** Get breeding pairs before an operation (input state). */
function getBeforePairs(pipeline: GenerationPipeline, operation: number, previousPipeline?: GenerationPipeline): BreedingPair[] {
  // Ops 0 and 1: show previous generation's completed pairs
  if (operation === 0 || operation === 1) {
    const prevPairs = previousPipeline?.transformData?.[3]?.pairs;
    return prevPairs ?? [];
  }
  // Op 2: empty (previous pairs cleared by pruning)
  if (operation === 2) return [];
  // Ops 3+: show pairs from the previous step in the current generation
  if (operation === 3) return pipeline.transformData?.[2]?.pairs ?? [];
  // Ops 4-5: pairs from op 3
  return pipeline.transformData?.[3]?.pairs ?? [];
}

// ---------------------------------------------------------------------------
// TransformBox — static center panel describing the operation
// ---------------------------------------------------------------------------

const TransformBox: React.FC<{
  operation: number;
}> = ({ operation }) => {
  const op = getOp(operation);
  const opColor = CATEGORY_COLORS[op.category] ?? colors.accent.purple;
  const desc = getTransformDescription(operation);

  const typeBg = op.type === 'remove' ? '#4a1a1a' : op.type === 'add' ? '#1a4a1a' : '#1a1a4a';

  return (
    <div style={transformStyles.wrapper}>
      <div style={{ ...transformStyles.typeBadge, backgroundColor: typeBg }}>
        {op.type}
      </div>
      <div style={{ ...transformStyles.arrow, color: opColor }}>→</div>
      <div style={{ ...transformStyles.title, color: opColor }}>{desc.title}</div>
      <div style={transformStyles.description}>{desc.description}</div>
      <pre style={transformStyles.pseudoCode}>{desc.pseudoCode.join('\n')}</pre>
    </div>
  );
};

// ---------------------------------------------------------------------------
// OperationPanel — composes Before | Transform | After with synced rows
// ---------------------------------------------------------------------------

export const OperationPanel: React.FC<Props> = ({
  operation,
  result,
  onSelectSpecimen,
  previousPipeline,
  onSelectPair,
  selectedPairIndex,
}) => {
  const op = getOp(operation);
  const opColor = CATEGORY_COLORS[op.category] ?? colors.accent.purple;

  // Shared state (lifted from BoundarySection)
  const [sorting, setSorting] = useState<SortingState>([{ id: 'fitness', desc: true }]);
  const [poolFilter, setPoolFilter] = useState<PoolFilter>('all');

  // Pool data for both sides
  const beforePools = useMemo(() => getBeforePools(operation), [operation]);
  const afterPools = useMemo(() => getPoolsAtCoordinate({ generation: result.generationNumber, operation }), [result.generationNumber, operation]);

  const beforePoolData = useMemo(() => beforePools.map(poolName => ({
    name: poolName,
    specimens: resolveBeforePool(poolName, result.pipeline, operation),
  })), [beforePools, result.pipeline, operation]);

  const afterPoolData = useMemo(() => afterPools.map(poolName => ({
    name: poolName,
    specimens: resolveAfterPool(poolName, result.pipeline, operation),
  })), [afterPools, result.pipeline, operation]);

  // Reset pool filter when operation changes
  const allPoolNames = useMemo(() => {
    const set = new Set<PoolName>();
    for (const p of beforePools) set.add(p);
    for (const p of afterPools) set.add(p);
    return Array.from(set);
  }, [beforePools, afterPools]);

  const poolKey = allPoolNames.join(',');
  const [prevPoolKey, setPrevPoolKey] = useState(poolKey);
  if (poolKey !== prevPoolKey) {
    setPrevPoolKey(poolKey);
    setPoolFilter(allPoolNames.length > 1 ? 'all' : (allPoolNames[0] ?? 'all'));
  }

  // Filtered specimens per side
  const beforeAll = useMemo(() => dedup(beforePoolData), [beforePoolData]);
  const afterAll = useMemo(() => dedup(afterPoolData), [afterPoolData]);

  const beforeFiltered = useMemo(() => {
    if (poolFilter === 'all') return beforeAll;
    const pool = beforePoolData.find(p => p.name === poolFilter);
    return pool ? pool.specimens : [];
  }, [poolFilter, beforeAll, beforePoolData]);

  const afterFiltered = useMemo(() => {
    if (poolFilter === 'all') return afterAll;
    const pool = afterPoolData.find(p => p.name === poolFilter);
    return pool ? pool.specimens : [];
  }, [poolFilter, afterAll, afterPoolData]);

  // Build synced rows: union of both sides, sorted together
  const { beforeItems, afterItems } = useMemo(() => {
    const beforeMap = new Map<number, Specimen>();
    for (const ind of beforeFiltered) beforeMap.set(ind.id, ind);
    const afterMap = new Map<number, Specimen>();
    for (const ind of afterFiltered) afterMap.set(ind.id, ind);

    // Union of all IDs
    const allIds = new Set<number>();
    for (const ind of beforeFiltered) allIds.add(ind.id);
    for (const ind of afterFiltered) allIds.add(ind.id);

    const rows: SyncedRow[] = [];
    for (const id of allIds) {
      rows.push({
        key: id,
        before: beforeMap.get(id) ?? null,
        after: afterMap.get(id) ?? null,
      });
    }

    // Sort using shared sorting state
    const comparator = buildComparator(sorting);
    rows.sort(comparator);

    return {
      beforeItems: rows.map(r => r.before),
      afterItems: rows.map(r => r.after),
    };
  }, [beforeFiltered, afterFiltered, sorting]);

  // Scroll sync
  const beforeListRef = useRef<SyncedListHandle>(null);
  const afterListRef = useRef<SyncedListHandle>(null);
  const scrollingRef = useRef(false);

  const handleBeforeScroll = useCallback((scrollTop: number) => {
    if (scrollingRef.current) return;
    scrollingRef.current = true;
    const el = afterListRef.current?.scrollElement;
    if (el) el.scrollTop = scrollTop;
    scrollingRef.current = false;
  }, []);

  const handleAfterScroll = useCallback((scrollTop: number) => {
    if (scrollingRef.current) return;
    scrollingRef.current = true;
    const el = beforeListRef.current?.scrollElement;
    if (el) el.scrollTop = scrollTop;
    scrollingRef.current = false;
  }, []);

  // Coordinates for click handler
  const coord: TimeCoordinate = useMemo(() => ({ generation: result.generationNumber, operation }), [result.generationNumber, operation]);

  const handleBeforeClick = useCallback((ind: Specimen) => {
    let pool: PoolName = beforePools[0] ?? 'eligibleAdults';
    if (poolFilter !== 'all') pool = poolFilter;
    onSelectSpecimen(ind, { coordinate: coord, pool });
  }, [beforePools, poolFilter, onSelectSpecimen, coord]);

  const handleAfterClick = useCallback((ind: Specimen) => {
    let pool: PoolName = afterPools[0] ?? 'eligibleAdults';
    if (poolFilter !== 'all') pool = poolFilter;
    onSelectSpecimen(ind, { coordinate: coord, pool });
  }, [afterPools, poolFilter, onSelectSpecimen, coord]);

  // Pool filter dropdown chips
  const poolChips = useMemo(() => {
    const chips: { value: PoolFilter; label: string }[] = [];
    if (allPoolNames.length > 1) {
      const totalBefore = beforeAll.length;
      const totalAfter = afterAll.length;
      chips.push({ value: 'all', label: `All (${totalBefore}→${totalAfter})` });
    }
    for (const poolName of allPoolNames) {
      const bPool = beforePoolData.find(p => p.name === poolName);
      const aPool = afterPoolData.find(p => p.name === poolName);
      const bCount = bPool?.specimens.length ?? 0;
      const aCount = aPool?.specimens.length ?? 0;
      chips.push({ value: poolName, label: `${poolDisplayName({ coordinate: coord, pool: poolName })} (${bCount}→${aCount})` });
    }
    return chips;
  }, [allPoolNames, beforeAll, afterAll, beforePoolData, afterPoolData, coord]);

  // Breeding pairs for both sides
  const beforePairsData = useMemo(() =>
    getBeforePairs(result.pipeline, operation, previousPipeline),
    [result.pipeline, operation, previousPipeline],
  );

  const afterPairsData = useMemo(() =>
    getPairsAtCoordinate(result.pipeline, coord, previousPipeline),
    [result.pipeline, coord, previousPipeline],
  );

  return (
    <div style={styles.container}>
      <style>{`.vl-row:not(.vl-selected):hover { background-color: ${colors.interactive.hover} !important; }`}</style>

      {/* Operation header */}
      <div style={styles.opHeader}>
        <span style={{ ...styles.opName, color: opColor }}>{op.category}</span>
        <span style={styles.opFullName}>{op.name}</span>
        <span style={{ ...styles.opType, backgroundColor: op.type === 'remove' ? '#4a1a1a' : op.type === 'add' ? '#1a4a1a' : '#1a1a4a' }}>
          {op.type}
        </span>
      </div>

      {/* Shared pool filter */}
      <div style={{ ...sectionStyles.filterRow, visibility: poolChips.length > 1 ? 'visible' : 'hidden' }}>
        <select
          data-help="Filter by pool"
          value={poolFilter}
          onChange={e => setPoolFilter(e.target.value as PoolFilter)}
          style={sectionStyles.filterSelect}
        >
          {poolChips.map(chip => (
            <option key={chip.value} value={chip.value}>{chip.label}</option>
          ))}
        </select>
      </div>

      {/* Three-panel row: Before | Transform | After */}
      <div style={styles.sections}>
        {/* BEFORE */}
        <div style={sectionStyles.wrapper}>
          <div style={sectionStyles.header}>
            <span style={{ ...sectionStyles.boundaryLabel, color: colors.text.secondary }}>Before</span>
          </div>
          <div style={sectionStyles.subHeader}>
            <span style={sectionStyles.subHeaderLabel}>Specimens</span>
            <span style={sectionStyles.poolCount}>{beforeFiltered.length}</span>
          </div>
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            {beforeItems.length > 0 ? (
              <SyncedSpecimenList
                ref={beforeListRef}
                items={beforeItems}
                onClickItem={handleBeforeClick}
                sorting={sorting}
                onSortingChange={setSorting}
                onScroll={handleBeforeScroll}
                flex
              />
            ) : (
              <div style={sectionStyles.emptyPool}>Empty</div>
            )}
          </div>
          <div style={sectionStyles.subHeader}>
            <span style={sectionStyles.subHeaderLabel}>Pairs</span>
            <span style={sectionStyles.poolCount}>{beforePairsData.length}</span>
          </div>
          <div style={sectionStyles.pairContainer}>
            <PairList
              pairs={beforePairsData}
              coordinate={coord}
              onSelectSpecimen={onSelectSpecimen}
              onSelectPair={onSelectPair}
              selectedPairIndex={selectedPairIndex}
            />
          </div>
        </div>

        <TransformBox operation={operation} />

        {/* AFTER */}
        <div style={sectionStyles.wrapper}>
          <div style={sectionStyles.header}>
            <span style={{ ...sectionStyles.boundaryLabel, color: colors.text.secondary }}>After</span>
          </div>
          <div style={sectionStyles.subHeader}>
            <span style={sectionStyles.subHeaderLabel}>Specimens</span>
            <span style={sectionStyles.poolCount}>{afterFiltered.length}</span>
          </div>
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            {afterItems.length > 0 ? (
              <SyncedSpecimenList
                ref={afterListRef}
                items={afterItems}
                onClickItem={handleAfterClick}
                sorting={sorting}
                onSortingChange={setSorting}
                onScroll={handleAfterScroll}
                flex
              />
            ) : (
              <div style={sectionStyles.emptyPool}>Empty</div>
            )}
          </div>
          <div style={sectionStyles.subHeader}>
            <span style={sectionStyles.subHeaderLabel}>Pairs</span>
            <span style={sectionStyles.poolCount}>{afterPairsData.length}</span>
          </div>
          <div style={sectionStyles.pairContainer}>
            <PairList
              pairs={afterPairsData}
              coordinate={coord}
              onSelectSpecimen={onSelectSpecimen}
              onSelectPair={onSelectPair}
              selectedPairIndex={selectedPairIndex}
            />
          </div>
        </div>
      </div>

    </div>
  );
};

// ---------------------------------------------------------------------------
// Internal helper: resolve a named pool from the after snapshot (slot 2)
// ---------------------------------------------------------------------------

function resolveAfterPool(pool: PoolName, pipeline: GenerationPipeline, op: number): Specimen[] {
  const ROLE_FOR_POOL: Record<PoolName, string> = {
    oldParents: 'oldParent',
    previousChildren: 'previousChild',
    retiredParents: 'retiredParent',
    eligibleAdults: 'eligibleAdult',
    selectedPairs: 'selectedPair',
    unselected: 'unselected',
    chromosomes: 'chromosome',
    finalChildren: 'finalChild',
  };
  const role = ROLE_FOR_POOL[pool];
  return pipeline.ops[op]![2].filter(i => i.pipelineRole === role);
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const sectionStyles: Record<string, React.CSSProperties> = {
  wrapper: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    borderRadius: 8,
    padding: 12,
    minWidth: 0,
    minHeight: 0,
    border: `1px solid ${colors.border.subtle}`,
    backgroundColor: colors.bg.surface,
    overflow: 'auto',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    flexShrink: 0,
  },
  boundaryLabel: {
    fontSize: 11,
    fontFamily: 'monospace',
    fontWeight: 'bold' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
  },
  poolCount: {
    fontSize: 10,
    fontFamily: 'monospace',
    color: colors.text.disabled,
  },
  filterRow: {
    display: 'flex',
    gap: 6,
    marginBottom: 8,
    flexShrink: 0,
  },
  filterSelect: {
    fontSize: 10,
    fontFamily: 'monospace',
    padding: '3px 5px',
    backgroundColor: colors.bg.overlay,
    color: colors.text.primary,
    border: `1px solid ${colors.border.subtle}`,
    borderRadius: 3,
    cursor: 'pointer',
    outline: 'none',
    maxWidth: '100%',
  },
  emptyPool: {
    color: colors.text.disabled,
    fontSize: 10,
    fontStyle: 'italic' as const,
    padding: '8px 4px',
  },
  subHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 4,
    flexShrink: 0,
  },
  subHeaderLabel: {
    fontSize: 9,
    fontFamily: 'monospace',
    fontWeight: 'bold' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
    color: colors.text.tertiary,
  },
  pairContainer: {
    flexShrink: 0,
  },
};

const transformStyles: Record<string, React.CSSProperties> = {
  wrapper: {
    width: 240,
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: '12px 8px',
    backgroundColor: colors.bg.raised,
    border: `1px solid ${colors.border.subtle}`,
    borderRadius: 8,
  },
  typeBadge: {
    padding: '2px 8px',
    borderRadius: 3,
    fontSize: 9,
    fontWeight: 'bold' as const,
    textTransform: 'uppercase' as const,
    color: colors.text.secondary,
    letterSpacing: 0.5,
  },
  arrow: {
    fontSize: 20,
    fontFamily: 'monospace',
    lineHeight: 1,
  },
  title: {
    fontSize: 10,
    fontFamily: 'monospace',
    fontWeight: 'bold' as const,
    textAlign: 'center' as const,
    lineHeight: 1.3,
  },
  description: {
    fontSize: 9,
    fontFamily: 'monospace',
    color: colors.text.tertiary,
    textAlign: 'center' as const,
    lineHeight: 1.4,
  },
  pseudoCode: {
    margin: 0,
    padding: '6px 8px',
    fontSize: 9,
    fontFamily: 'monospace',
    color: colors.text.secondary,
    backgroundColor: colors.bg.overlay,
    borderRadius: 4,
    lineHeight: 1.5,
    textAlign: 'left' as const,
    whiteSpace: 'pre' as const,
    alignSelf: 'stretch',
  },
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    flex: 1,
    minHeight: 0,
    padding: '8px 12px 12px',
  },
  opHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
    flexShrink: 0,
  },
  opName: {
    fontSize: 14,
    fontFamily: 'monospace',
    fontWeight: 'bold' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
  },
  opFullName: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: colors.text.secondary,
  },
  opType: {
    padding: '2px 7px',
    borderRadius: 3,
    fontSize: 9,
    fontWeight: 'bold' as const,
    textTransform: 'uppercase' as const,
    color: colors.text.secondary,
    marginLeft: 'auto',
  },
  sections: {
    display: 'flex',
    flexDirection: 'row' as const,
    alignItems: 'stretch',
    gap: 10,
    flex: 1,
    minHeight: 0,
  },
};
