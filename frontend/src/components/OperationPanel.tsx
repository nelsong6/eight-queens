/**
 * OperationPanel — shows all three phases of one pipeline operation simultaneously.
 * Before | Transform | After are displayed side by side; the active boundary is
 * highlighted and the others are dimmed. Clicking a dimmed section activates it.
 */
import React, { useMemo, useState } from 'react';
import type { Individual, GenerationResult, PoolOrigin, PoolName } from '../engine/types';
import { getOp, poolDisplayName, resolvePoolFromPipeline, getPoolsAtCoordinate } from '../engine/time-coordinate';
import { type SortingState, type ColumnFiltersState } from '@tanstack/react-table';
import { IndividualList, TransformView, CATEGORY_COLORS } from './walkthrough/IndividualList';
import { colors } from '../colors';

type PoolFilter = PoolName | 'all';

interface Props {
  operation: number;          // 0–6
  boundary: 0 | 1 | 2;       // currently highlighted phase
  result: GenerationResult;
  onSelectIndividual: (individual: Individual, origin: PoolOrigin) => void;
  /** For op 4 crossover pair browser */
  browsePairIndex: number;
  onPairChange: (index: number) => void;
  /** Called when user clicks an inactive phase to focus it */
  onBoundaryChange: (boundary: 0 | 1 | 2) => void;
}

// ---------------------------------------------------------------------------
// BoundarySection — renders one phase (Before or After) with pool filter + list
// ---------------------------------------------------------------------------

const BoundarySection: React.FC<{
  operation: number;
  boundary: 0 | 2;
  result: GenerationResult;
  isActive: boolean;
  onSelectIndividual: (individual: Individual, origin: PoolOrigin) => void;
  browsePairIndex: number;
  onPairChange: (index: number) => void;
  onActivate: () => void;
}> = ({ operation, boundary, result, isActive, onSelectIndividual, browsePairIndex, onPairChange, onActivate }) => {
  const [poolFilter, setPoolFilter] = useState<PoolFilter>('all');
  const [sorting, setSorting] = useState<SortingState>([{ id: 'fitness', desc: true }]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  const op = getOp(operation);
  const opColor = CATEGORY_COLORS[op.category] ?? colors.accent.purple;

  const coordinate = useMemo(() => ({ generation: result.generationNumber, operation, boundary }), [result.generationNumber, operation, boundary]);

  const pools = useMemo(() => getPoolsAtCoordinate({ generation: result.generationNumber, operation, boundary }), [result.generationNumber, operation, boundary]);

  // Reset filter if pools change (e.g. operation switched)
  const poolKey = pools.join(',');
  const [prevPoolKey, setPrevPoolKey] = useState(poolKey);
  if (poolKey !== prevPoolKey) {
    setPrevPoolKey(poolKey);
    setPoolFilter(pools.length > 1 ? 'all' : (pools[0] ?? 'all'));
    setColumnFilters([]);
  }

  const poolData = useMemo(() => pools.map(poolName => ({
    name: poolName,
    individuals: resolvePoolFromPipeline(poolName, result.pipeline, operation, boundary),
  })), [pools, result.pipeline, operation, boundary]);

  const allIndividuals = useMemo(() => {
    const seen = new Set<number>();
    const all: Individual[] = [];
    for (const { individuals } of poolData) {
      for (const ind of individuals) {
        if (!seen.has(ind.id)) { seen.add(ind.id); all.push(ind); }
      }
    }
    return all;
  }, [poolData]);

  const displayedIndividuals = useMemo(() => {
    if (poolFilter === 'all') return allIndividuals;
    const pool = poolData.find(p => p.name === poolFilter);
    return pool ? pool.individuals : allIndividuals;
  }, [poolFilter, allIndividuals, poolData]);

  const handleClick = (ind: Individual) => {
    let pool: PoolName = pools[0] ?? 'eligibleAdults';
    if (poolFilter !== 'all') pool = poolFilter;
    onSelectIndividual(ind, { coordinate, pool });
  };

  const isCrossoverAdd = operation === 4 && boundary === 2;
  const totalPairs = result.breedingData.aParents.length;

  const label = boundary === 0 ? 'Before' : 'After';

  return (
    <div
      style={{
        ...sectionStyles.wrapper,
        opacity: isActive ? 1 : 0.5,
        border: isActive ? `2px solid ${opColor}55` : `1px solid ${colors.border.subtle}`,
        backgroundColor: isActive ? colors.bg.surface : colors.bg.raised,
        cursor: isActive ? 'default' : 'pointer',
        boxShadow: isActive ? `0 0 12px ${opColor}22` : 'none',
      }}
      onClick={!isActive ? onActivate : undefined}
    >
      {/* Section header */}
      <div style={sectionStyles.header}>
        <span style={{ ...sectionStyles.boundaryLabel, color: isActive ? opColor : colors.text.disabled }}>
          {label}
        </span>
        <span style={sectionStyles.poolCount}>{allIndividuals.length}</span>
      </div>

      {/* Pool filter */}
      {pools.length > 1 && (
        <div style={sectionStyles.filterRow}>
          <select
            data-help="Filter by pool"
            value={poolFilter}
            onChange={e => { setPoolFilter(e.target.value as PoolFilter); setColumnFilters([]); }}
            style={sectionStyles.filterSelect}
            onClick={e => e.stopPropagation()}
          >
            <option value="all">All ({allIndividuals.length})</option>
            {poolData.map(({ name, individuals }) => (
              <option key={name} value={name}>
                {poolDisplayName({ coordinate, pool: name })} ({individuals.length})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Crossover pair browser (op 4 after) */}
      {isCrossoverAdd && totalPairs > 0 && isActive && (
        <div style={sectionStyles.pairNav} onClick={e => e.stopPropagation()}>
          <button onClick={() => onPairChange(Math.max(0, browsePairIndex - 1))} disabled={browsePairIndex === 0} style={{ ...sectionStyles.navBtn, opacity: browsePairIndex === 0 ? 0.3 : 1 }}>Prev</button>
          <span style={sectionStyles.pairLabel}>Pair {browsePairIndex + 1}/{totalPairs.toLocaleString()}</span>
          <button onClick={() => onPairChange(Math.min(totalPairs - 1, browsePairIndex + 1))} disabled={browsePairIndex >= totalPairs - 1} style={{ ...sectionStyles.navBtn, opacity: browsePairIndex >= totalPairs - 1 ? 0.3 : 1 }}>Next</button>
        </div>
      )}

      {/* Individual list — pointer-events disabled when inactive so clicks fall through to onActivate */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', pointerEvents: isActive ? 'auto' : 'none' }}>
        {displayedIndividuals.length > 0 ? (
          <IndividualList
            individuals={displayedIndividuals}
            onClickItem={handleClick}
            sorting={sorting}
            onSortingChange={setSorting}
            columnFilters={columnFilters}
            onColumnFiltersChange={setColumnFilters}
            flex
          />
        ) : (
          <div style={sectionStyles.emptyPool}>
            {pools.length === 0 ? 'No data at this step' : 'Empty'}
          </div>
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// TransformSection — renders the operation's mechanism diagram (boundary 1)
// ---------------------------------------------------------------------------

const TransformSection: React.FC<{
  operation: number;
  result: GenerationResult;
  isActive: boolean;
  onActivate: () => void;
}> = ({ operation, result, isActive, onActivate }) => {
  const op = getOp(operation);
  const opColor = CATEGORY_COLORS[op.category] ?? colors.accent.purple;
  const coordinate = { generation: result.generationNumber, operation, boundary: 1 as const };

  return (
    <div
      style={{
        ...sectionStyles.wrapper,
        opacity: isActive ? 1 : 0.5,
        border: isActive ? `2px solid ${opColor}55` : `1px solid ${colors.border.subtle}`,
        backgroundColor: isActive ? colors.bg.surface : colors.bg.raised,
        cursor: isActive ? 'default' : 'pointer',
        boxShadow: isActive ? `0 0 12px ${opColor}22` : 'none',
      }}
      onClick={!isActive ? onActivate : undefined}
    >
      <div style={sectionStyles.header}>
        <span style={{ ...sectionStyles.boundaryLabel, color: isActive ? opColor : colors.text.disabled }}>
          Transform
        </span>
      </div>
      <TransformView coordinate={coordinate} result={result} />
    </div>
  );
};

// ---------------------------------------------------------------------------
// OperationPanel — composes the three sections
// ---------------------------------------------------------------------------

export const OperationPanel: React.FC<Props> = ({
  operation,
  boundary,
  result,
  onSelectIndividual,
  browsePairIndex,
  onPairChange,
  onBoundaryChange,
}) => {
  const op = getOp(operation);
  const opColor = CATEGORY_COLORS[op.category] ?? colors.accent.purple;

  return (
    <div style={styles.container}>
      {/* Operation header */}
      <div style={styles.opHeader}>
        <span style={{ ...styles.opName, color: opColor }}>{op.category}</span>
        <span style={styles.opFullName}>{op.name}</span>
        <span style={{ ...styles.opType, backgroundColor: op.type === 'remove' ? '#4a1a1a' : op.type === 'add' ? '#1a4a1a' : '#1a1a4a' }}>
          {op.type}
        </span>
      </div>

      {/* Three sections side by side */}
      <div style={styles.sections}>
        <BoundarySection
          operation={operation}
          boundary={0}
          result={result}
          isActive={boundary === 0}
          onSelectIndividual={onSelectIndividual}
          browsePairIndex={browsePairIndex}
          onPairChange={onPairChange}
          onActivate={() => onBoundaryChange(0)}
        />
        <TransformSection
          operation={operation}
          result={result}
          isActive={boundary === 1}
          onActivate={() => onBoundaryChange(1)}
        />
        <BoundarySection
          operation={operation}
          boundary={2}
          result={result}
          isActive={boundary === 2}
          onSelectIndividual={onSelectIndividual}
          browsePairIndex={browsePairIndex}
          onPairChange={onPairChange}
          onActivate={() => onBoundaryChange(2)}
        />
      </div>
    </div>
  );
};

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
    transition: 'opacity 0.15s, border-color 0.15s, box-shadow 0.15s',
    overflow: 'hidden',
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
    transition: 'color 0.15s',
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
  pairNav: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 8,
    flexShrink: 0,
  },
  navBtn: {
    padding: '2px 6px',
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
  emptyPool: {
    color: colors.text.disabled,
    fontSize: 10,
    fontStyle: 'italic' as const,
    padding: '8px 4px',
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
    gap: 10,
    flex: 1,
    minHeight: 0,
  },
};
