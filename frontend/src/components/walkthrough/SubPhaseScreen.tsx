import React, { useMemo, useState } from 'react';
import type { Individual, Age, GenerationResult, PoolOrigin, PoolName, TimeCoordinate } from '../../engine/types';
import { getOp, getPoolsAtCoordinate, poolDisplayName, getTransformDescription, GENERATION_OPS, OPS_PER_GENERATION, SCREENS_PER_OP } from '../../engine/time-coordinate';

const AGE_COLORS: Record<Age, string> = { 0: '#888', 1: '#3498db', 2: '#2ecc71', 3: '#e67e22' };

// Grid cell widths matching BreedingListboxes
const COL_ID = '36px';
const COL_GENE = '22px';
const COL_FIT = '24px';
const COL_AGE = '24px';
const ITEM_HEIGHT = 22;
const MAX_VISIBLE = 200;

const CELL: React.CSSProperties = {
  borderRight: '1px solid #232346',
  padding: '0 3px',
};

const GRID_COLS = `${COL_ID} repeat(8, ${COL_GENE}) ${COL_FIT} ${COL_AGE}`;

type ViewMode = string; // pool name, or 'all' | 'age' | 'fitness' | 'removed' | 'survived'

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

/** Determine if a pool is being removed (red) or added (green) at a coordinate. */
function getPoolRole(pool: PoolName, tc: TimeCoordinate): 'remove' | 'add' | null {
  const { operation: y, boundary: z } = tc;

  // Retired parents are marked for removal at op 1 transform/after, not at before (they haven't been removed yet)
  if (pool === 'retiredParents' && (y > 1 || (y === 1 && z > 0))) return 'remove';
  // Chromosomes are newly generated
  if (pool === 'chromosomes' && y === 4 && z === 1) return 'add';

  return null;
}

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

/** Renders a grid table of individuals matching BreedingListboxes style. */
const IndividualList: React.FC<{
  individuals: Individual[];
  onClickItem: (ind: Individual) => void;
  maxVisible?: number;
}> = ({ individuals, onClickItem, maxVisible = MAX_VISIBLE }) => {
  const idWidth = useMemo(() => {
    let maxId = 0;
    for (const ind of individuals) if (ind.id > maxId) maxId = ind.id;
    return Math.max(3, String(maxId).length);
  }, [individuals]);

  if (individuals.length === 0) {
    return <div style={styles.emptyPool}>Empty</div>;
  }
  return (
    <div style={gridStyles.wrapper}>
      <div style={gridStyles.headerRow}>
        <span style={gridStyles.headerCell}>#</span>
        <span style={{ gridColumn: '2', ...gridStyles.headerCell }}>{'\uD83E\uDDEC'}</span>
        <span style={{ gridColumn: '10', ...gridStyles.headerCell }}>{'\uD83C\uDFC5'}</span>
        <span style={{ gridColumn: '11', ...gridStyles.headerCell }}>{'\uD83D\uDC23'}</span>
      </div>
      <div style={gridStyles.scrollContainer}>
        {individuals.slice(0, maxVisible).map((ind, index) => (
          <div
            key={ind.id}
            className="vl-row"
            style={{
              ...gridStyles.row,
              backgroundColor: index % 2 === 1 ? '#16162e' : 'transparent',
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
        ))}
        {individuals.length > maxVisible && (
          <div style={styles.moreItems}>
            ...and {individuals.length - maxVisible} more
          </div>
        )}
      </div>
    </div>
  );
};

/** Groups individuals by age and returns sorted groups. */
function groupByAge(individuals: Individual[]): { age: Age; label: string; individuals: Individual[] }[] {
  const groups: Map<Age, Individual[]> = new Map();
  for (const ind of individuals) {
    const list = groups.get(ind.age);
    if (list) list.push(ind);
    else groups.set(ind.age, [ind]);
  }
  return ([3, 2, 1, 0] as Age[])
    .filter(age => groups.has(age))
    .map(age => ({
      age,
      label: `AGE ${age}`,
      individuals: groups.get(age)!.sort((a, b) => b.fitness - a.fitness),
    }));
}

/** Groups individuals by fitness range (buckets of 4). */
function groupByFitness(individuals: Individual[]): { label: string; individuals: Individual[] }[] {
  const buckets: Map<string, Individual[]> = new Map();
  for (const ind of individuals) {
    const lo = Math.floor(ind.fitness / 4) * 4;
    const hi = Math.min(lo + 3, 28);
    const key = `${lo}-${hi}`;
    const list = buckets.get(key);
    if (list) list.push(ind);
    else buckets.set(key, [ind]);
  }
  return Array.from(buckets.entries())
    .sort((a, b) => {
      const aStart = parseInt(a[0]);
      const bStart = parseInt(b[0]);
      return bStart - aStart;
    })
    .map(([label, inds]) => ({
      label: `FITNESS ${label}`,
      individuals: inds.sort((a, b) => b.fitness - a.fitness),
    }));
}

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
  const [viewMode, setViewMode] = useState<ViewMode>(() => pools[0] ?? 'all');

  const poolData = useMemo(() => {
    return pools.map(poolName => ({
      name: poolName,
      individuals: resolvePool(poolName, result, previousResult),
    }));
  }, [pools, result, previousResult]);

  // Reset view mode when pools change (new coordinate)
  const poolKey = pools.join(',');
  const [prevPoolKey, setPrevPoolKey] = useState(poolKey);
  if (poolKey !== prevPoolKey) {
    setPrevPoolKey(poolKey);
    setViewMode(pools[0] ?? 'all');
  }

  const allIndividuals = useMemo(() => {
    // Deduplicate by id (same individual can appear in multiple pools)
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
    return all.sort((a, b) => b.fitness - a.fitness);
  }, [poolData]);

  // Compute removed/survived by comparing before (boundary 0) vs after (boundary 2) pools
  const { removedIndividuals, survivedIndividuals, hasTransformDiff } = useMemo(() => {
    const beforePools = getPoolsAtCoordinate({ ...coordinate, boundary: 0 });
    const afterPools = getPoolsAtCoordinate({ ...coordinate, boundary: 2 });

    const collectIds = (poolNames: PoolName[]) => {
      const ids = new Set<number>();
      const byId = new Map<number, Individual>();
      for (const p of poolNames) {
        for (const ind of resolvePool(p, result, previousResult)) {
          ids.add(ind.id);
          byId.set(ind.id, ind);
        }
      }
      return { ids, byId };
    };

    const before = collectIds(beforePools);
    const after = collectIds(afterPools);

    const removed: Individual[] = [];
    const survived: Individual[] = [];
    for (const [id, ind] of before.byId) {
      if (after.ids.has(id)) survived.push(ind);
      else removed.push(ind);
    }

    removed.sort((a, b) => b.fitness - a.fitness);
    survived.sort((a, b) => b.fitness - a.fitness);

    return {
      removedIndividuals: removed,
      survivedIndividuals: survived,
      hasTransformDiff: removed.length > 0,
    };
  }, [coordinate, result, previousResult]);

  const viewModeOptions = useMemo(() => {
    const opts: { value: ViewMode; label: string }[] = [];
    // Each pool as its own option
    for (const { name, individuals } of poolData) {
      opts.push({ value: name, label: `${poolDisplayName({ coordinate, pool: name })} (${individuals.length})` });
    }
    // "All" only when multiple pools with individuals
    const populatedPools = poolData.filter(p => p.individuals.length > 0);
    if (populatedPools.length > 1) {
      opts.push({ value: 'all', label: `All (${allIndividuals.length})` });
    }
    // "By Age" only when there are mixed ages
    const ages = new Set(allIndividuals.map(ind => ind.age));
    if (ages.size > 1) {
      opts.push({ value: 'age', label: 'By Age' });
    }
    // "By Fitness" when there's meaningful spread (more than one fitness value)
    const fitnesses = new Set(allIndividuals.map(ind => ind.fitness));
    if (fitnesses.size > 1) {
      opts.push({ value: 'fitness', label: 'By Fitness' });
    }
    // "Removed"/"Survived" only when the transform actually removes individuals
    if (hasTransformDiff) {
      opts.push({ value: 'removed', label: `Removed (${removedIndividuals.length})` });
      opts.push({ value: 'survived', label: `Survived (${survivedIndividuals.length})` });
    }
    return opts;
  }, [poolData, pools, coordinate, allIndividuals, hasTransformDiff, removedIndividuals, survivedIndividuals]);

  const handleClick = (ind: Individual, poolName?: PoolName) => {
    onSelectIndividual(ind, {
      coordinate,
      pool: poolName ?? pools[0] ?? 'eligibleAdults',
    });
  };

  // Special rendering for crossover pair browsing (op 4, after)
  const isCrossoverAdd = coordinate.operation === 4 && coordinate.boundary === 2;
  const totalPairs = result.breedingData.aParents.length;

  const showLists = coordinate.boundary !== 1;

  return (
    <div style={styles.panel}>
      <style>{'.vl-row:not(.vl-selected):hover { background-color: #24244a !important; }'}</style>
      <h3 style={styles.panelTitle} data-help="Population data at each step of the genetic algorithm pipeline">Population</h3>
      <PipelineProgress coordinate={coordinate} onNavigate={onNavigate} />
      {/* Header */}
      <div style={styles.header}>
        <span style={styles.opCategory}>{op.category}</span>
      </div>

      {/* Transform screen */}
      {coordinate.boundary === 1 && <TransformView coordinate={coordinate} result={result} previousResult={previousResult} />}

      {/* View mode tabs (before/after only) */}
      {showLists && (
        <div style={styles.tabRow}>
          {viewModeOptions.map(opt => (
            <div
              key={opt.value}
              onClick={() => setViewMode(opt.value)}
              style={{
                ...styles.tab,
                ...(viewMode === opt.value ? styles.tabActive : {}),
              }}
            >
              {opt.label}
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

      {/* === View: Specific pool === */}
      {showLists && poolData.some(p => p.name === viewMode) && (() => {
        const pool = poolData.find(p => p.name === viewMode)!;
        return (
          <div style={styles.poolSection}>
            {pool.individuals.length === 0 ? (
              <div style={styles.emptyPool}>
                {(pool.name === 'oldParents' || pool.name === 'retiredParents' || pool.name === 'previousChildren') && !previousResult
                  ? 'No previous generation data available'
                  : 'Empty'}
              </div>
            ) : (
              <IndividualList individuals={pool.individuals} onClickItem={ind => handleClick(ind, pool.name)} />
            )}
          </div>
        );
      })()}

      {/* === View: All === */}
      {showLists && viewMode === 'all' && (
        <div style={styles.poolSection}>
          <IndividualList individuals={allIndividuals} onClickItem={ind => handleClick(ind)} />
        </div>
      )}

      {/* === View: By Age === */}
      {showLists && viewMode === 'age' && groupByAge(allIndividuals).map(group => (
        <div key={group.age} style={styles.poolSection}>
          <div style={{ ...styles.poolHeader, color: AGE_COLORS[group.age] }}>
            {group.label}
            <span style={{ ...styles.poolCount, color: AGE_COLORS[group.age] }}>({group.individuals.length})</span>
          </div>
          <IndividualList individuals={group.individuals} onClickItem={ind => handleClick(ind)} />
        </div>
      ))}

      {/* === View: By Fitness === */}
      {showLists && viewMode === 'fitness' && groupByFitness(allIndividuals).map(group => (
        <div key={group.label} style={styles.poolSection}>
          <div style={styles.poolHeader}>
            {group.label}
            <span style={styles.poolCount}>({group.individuals.length})</span>
          </div>
          <IndividualList individuals={group.individuals} onClickItem={ind => handleClick(ind)} />
        </div>
      ))}

      {/* === View: Removed === */}
      {showLists && viewMode === 'removed' && (
        <div style={styles.poolSection}>
          {removedIndividuals.length === 0 ? (
            <div style={styles.emptyPool}>No individuals removed</div>
          ) : (
            <IndividualList individuals={removedIndividuals} onClickItem={ind => handleClick(ind)} />
          )}
        </div>
      )}

      {/* === View: Survived === */}
      {showLists && viewMode === 'survived' && (
        <div style={styles.poolSection}>
          {survivedIndividuals.length === 0 ? (
            <div style={styles.emptyPool}>No individuals survived</div>
          ) : (
            <IndividualList individuals={survivedIndividuals} onClickItem={ind => handleClick(ind)} />
          )}
        </div>
      )}

      {/* No-op message (before/after only) */}
      {showLists && pools.length === 0 && (
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
  coordinate: {
    color: '#6c5ce7',
    fontWeight: 'bold',
  },
  opCategory: {
  },
  typeBadge: {
    padding: '1px 6px',
    borderRadius: 3,
    fontSize: 9,
    fontWeight: 'bold',
    textTransform: 'uppercase' as const,
    backgroundColor: '#2a2a4a',
    color: '#ccc',
  },
  opName: {
    fontSize: 12,
    color: '#e0e0e0',
    marginBottom: 8,
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
  poolHeader: {
    fontSize: 10,
    color: '#aaa',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 4,
    display: 'flex',
    gap: 6,
    alignItems: 'center',
  },
  poolCount: {
    color: '#666',
    fontSize: 9,
  },
  emptyPool: {
    color: '#555',
    fontSize: 10,
    fontStyle: 'italic' as const,
    padding: '4px 8px',
  },
  moreItems: {
    color: '#555',
    fontSize: 9,
    padding: '2px 6px',
    textAlign: 'center' as const,
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
  },
  scrollContainer: {
    maxHeight: 300,
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
