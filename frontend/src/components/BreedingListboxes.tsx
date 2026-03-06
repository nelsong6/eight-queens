import React, { useState, useCallback, useMemo, useRef, useLayoutEffect } from 'react';
import type { Individual, MutationRecord, GenerationBreedingData } from '../engine/types';

interface Props {
  breedingData: GenerationBreedingData | null;
  generation: number;
  onSelectIndividual: (individual: Individual, source: string) => void;
  selectedCategory: CategoryKey;
  onCategoryChange: (category: CategoryKey) => void;
}

// ---------------------------------------------------------------------------
// Virtual scroll list for large populations
// ---------------------------------------------------------------------------

const ITEM_HEIGHT = 22;
const MIN_CONTAINER_HEIGHT = 150;
const DEFAULT_VISIBLE_HEIGHT = 2000; // overestimate to avoid partial first render
const OVERSCAN = 3;

// Grid cell widths in px (monospace 11px ≈ 6.6px per ch)
const COL_ID = '36px';    // individual index
const COL_GENE = '22px';  // single gene digit (with cell padding)
const COL_FIT = '34px';   // fitness "f:XX"
const COL_EXTRA = '24px'; // born gen / partner count
const COL_ARROW = '14px'; // arrow between sections

// Base cell style — gives each span a visible right border like a spreadsheet
// Spread into per-column styles, then set textAlign to control justify
const CELL: React.CSSProperties = {
  borderRight: '1px solid #232346',
  padding: '0 3px',
};

type SortField = 'id' | 'fitness' | 'partners';
type SortDir = 'asc' | 'desc';

const VirtualList: React.FC<{
  items: Individual[];
  onSelect: (ind: Individual) => void;
  selectedId: number | null;
  emptyText?: string;
  partnerCounts?: Map<number, number>;
  showBornGen?: boolean;
}> = ({ items, onSelect, selectedId, emptyText = 'No data', partnerCounts, showBornGen }) => {
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const [resizeTick, setResizeTick] = useState(0);
  const [sortField, setSortField] = useState<SortField | null>('id');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const toggleSort = useCallback((field: SortField) => {
    setSortField((prev) => {
      if (prev === field) {
        setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
        return field;
      }
      setSortDir('asc');
      return field;
    });
  }, []);

  useLayoutEffect(() => {
    if (!containerRef.current) return;
    setResizeTick((t) => t + 1); // sync measure before paint
    const ro = new ResizeObserver(() => {
      setResizeTick((t) => t + 1);
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  void resizeTick; // trigger re-render on resize
  const visibleHeight = containerRef.current?.clientHeight || DEFAULT_VISIBLE_HEIGHT;

  const { idWidth, fitWidth } = useMemo(() => {
    let maxId = 0, maxFit = 0;
    for (const ind of items) {
      if (ind.id > maxId) maxId = ind.id;
      if (ind.fitness > maxFit) maxFit = ind.fitness;
    }
    return { idWidth: Math.max(3, String(maxId).length), fitWidth: String(maxFit).length };
  }, [items]);

  const sortedItems = useMemo(() => {
    if (!sortField) return items;
    const mul = sortDir === 'asc' ? 1 : -1;
    if (sortField === 'partners' && partnerCounts) {
      return [...items].sort((a, b) => ((partnerCounts.get(a.id) ?? 0) - (partnerCounts.get(b.id) ?? 0)) * mul);
    }
    return [...items].sort((a, b) => (a[sortField as 'id' | 'fitness'] - b[sortField as 'id' | 'fitness']) * mul);
  }, [items, sortField, sortDir, partnerCounts]);

  if (items.length === 0) {
    return <div style={vlStyles.empty}>{emptyText}</div>;
  }

  const arrow = (field: SortField) =>
    sortField === field
      ? (sortDir === 'asc' ? '\u25B2' : '\u25BC')
      : '';

  const extraCols = (showBornGen && partnerCounts)
    ? ` ${COL_EXTRA} ${COL_EXTRA}`
    : (showBornGen || partnerCounts)
      ? ` ${COL_EXTRA}`
      : '';
  const gridCols = `${COL_ID} repeat(8, ${COL_GENE}) ${COL_FIT}${extraCols}`;

  const totalHeight = sortedItems.length * ITEM_HEIGHT;
  const startIndex = Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - OVERSCAN);
  const endIndex = Math.min(
    sortedItems.length,
    Math.ceil((scrollTop + visibleHeight) / ITEM_HEIGHT) + OVERSCAN,
  );

  return (
    <div style={vlStyles.wrapper}>
      <div style={{ ...vlStyles.sortBar, gridTemplateColumns: gridCols }}>
        <span
          style={{ ...vlStyles.sortBtn, padding: '0 3px', textAlign: 'right' as const, color: sortField === 'id' ? '#ffd700' : '#555' }}
          onClick={() => toggleSort('id')}
          title="Sort by index"
          data-help="Individual index — each row is one individual. Click to sort"
        >
          #
        </span>
        <span
          style={{ gridColumn: '2', padding: '0 3px', textAlign: 'center' as const, color: '#555' }}
          data-help="Each row is one individual — an 8-gene sequence representing queen positions on the board"
        >
          {'\uD83E\uDDEC'}
        </span>
        <span
          style={{ ...vlStyles.sortBtn, gridColumn: '10', padding: '0 3px', textAlign: 'right' as const, color: sortField === 'fitness' ? '#ffd700' : '#555' }}
          onClick={() => toggleSort('fitness')}
          title="Sort by fitness"
          data-help="Fitness score (0–28) — number of non-attacking queen pairs. Click to sort"
        >
          {arrow('fitness')}{'\uD83C\uDFC5'}
        </span>
        {showBornGen && (
          <span
            style={{ gridColumn: '11', padding: '0 3px', textAlign: 'center' as const, color: '#555' }}
            title="Generation this individual was born in"
            data-help="Birth generation — which generation created this individual (not sortable)"
          >
            {'\uD83D\uDC23'}
          </span>
        )}
        {partnerCounts && (
          <span
            style={{ ...vlStyles.sortBtn, gridColumn: showBornGen ? '12' : '11', padding: '0 3px', textAlign: 'right' as const, color: sortField === 'partners' ? '#ffd700' : '#555' }}
            onClick={() => toggleSort('partners')}
            title="Sort by number of partners"
            data-help="Number of times this individual was selected as a breeding partner. Click to sort"
          >
            {arrow('partners')}P
          </span>
        )}
      </div>
      <div
        ref={containerRef}
        style={vlStyles.scrollContainer}
        onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
      >
        <div style={{ height: totalHeight, position: 'relative' as const }}>
          {sortedItems.slice(startIndex, endIndex).map((ind, i) => {
            const index = startIndex + i;
            const isSelected = ind.id === selectedId;
            const stripe = index % 2 === 1;
            return (
              <div
                key={index}
                style={{
                  ...vlStyles.item,
                  gridTemplateColumns: gridCols,
                  top: index * ITEM_HEIGHT,
                  backgroundColor: isSelected ? '#3a3a6a' : stripe ? '#16162e' : 'transparent',
                }}
                onClick={() => onSelect(ind)}
              >
                <span style={vlStyles.id}>{String(ind.id).padStart(idWidth)}</span>
                {ind.solution.map((gene, gi) => (
                  <span key={gi} style={vlStyles.gene}>{gene}</span>
                ))}
                <span style={vlStyles.fitness}>f:{String(ind.fitness).padStart(fitWidth)}</span>
                {showBornGen && (
                  <span style={vlStyles.bornGen}>{ind.bornGeneration ?? 0}</span>
                )}
                {partnerCounts && (
                  <span style={vlStyles.partnerCount}>{partnerCounts.get(ind.id) ?? 0}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Virtual scroll list for mutations — shows what changed
// ---------------------------------------------------------------------------

const MutationList: React.FC<{
  records: MutationRecord[];
  onSelect: (ind: Individual) => void;
  selectedId: number | null;
  selectedSide?: 'before' | 'after' | null;
  onSelectSide?: (side: 'before' | 'after') => void;
}> = ({ records, onSelect, selectedId, selectedSide, onSelectSide }) => {
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const [resizeTick, setResizeTick] = useState(0);
  const [sortField, setSortField] = useState<SortField | null>('id');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const toggleSort = useCallback((field: SortField) => {
    setSortField((prev) => {
      if (prev === field) {
        setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
        return field;
      }
      setSortDir('asc');
      return field;
    });
  }, []);

  useLayoutEffect(() => {
    if (!containerRef.current) return;
    setResizeTick((t) => t + 1); // sync measure before paint
    const ro = new ResizeObserver(() => {
      setResizeTick((t) => t + 1);
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  void resizeTick;
  const visibleHeight = containerRef.current?.clientHeight || DEFAULT_VISIBLE_HEIGHT;

  const { idWidth, fitWidth } = useMemo(() => {
    let maxId = 0, maxFit = 0;
    for (const rec of records) {
      if (rec.individual.id > maxId) maxId = rec.individual.id;
      if (rec.individual.fitness > maxFit) maxFit = rec.individual.fitness;
    }
    return { idWidth: Math.max(3, String(maxId).length), fitWidth: String(maxFit).length };
  }, [records]);

  const sortedRecords = useMemo(() => {
    if (!sortField || sortField === 'partners') return records;
    const mul = sortDir === 'asc' ? 1 : -1;
    return [...records].sort((a, b) =>
      (a.individual[sortField] - b.individual[sortField]) * mul,
    );
  }, [records, sortField, sortDir]);

  if (records.length === 0) {
    return <div style={vlStyles.empty}>No mutations this generation</div>;
  }

  const totalHeight = sortedRecords.length * ITEM_HEIGHT;
  const startIndex = Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - OVERSCAN);
  const endIndex = Math.min(
    sortedRecords.length,
    Math.ceil((scrollTop + visibleHeight) / ITEM_HEIGHT) + OVERSCAN,
  );

  // Grid: [id] before_genes f:XX → after_genes f:XX
  const gridCols = `${COL_ID} repeat(8, ${COL_GENE}) ${COL_FIT} ${COL_ARROW} repeat(8, ${COL_GENE}) ${COL_FIT}`;

  return (
    <div style={vlStyles.wrapper}>
      <div style={{ ...mutStyles.sortBar, gridTemplateColumns: gridCols }}>
        <span
          style={{ ...vlStyles.sortBtn, padding: '0 3px', textAlign: 'right' as const, color: sortField === 'id' ? '#ffd700' : '#555' }}
          onClick={() => toggleSort('id')}
          title="Sort by index"
          data-help="Individual index — each row is one individual. Click to sort"
        >
          #
        </span>
        <span
          style={{ gridColumn: '2', padding: '0 3px', textAlign: 'center' as const, color: '#555' }}
          data-help="Each row is one individual — an 8-gene sequence representing queen positions on the board"
        >
          {'\uD83E\uDDEC'}
        </span>
        <span style={{ gridColumn: '10', padding: '0 3px', textAlign: 'right' as const, color: '#666' }}>
          before
        </span>
        <span />
        <span style={{ gridColumn: '20', textAlign: 'right' as const, color: '#666' }}>
          after
        </span>
      </div>
      <div
        ref={containerRef}
        style={vlStyles.scrollContainer}
        onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
      >
        <div style={{ height: totalHeight, position: 'relative' as const }}>
          {sortedRecords.slice(startIndex, endIndex).map((rec, i) => {
            const index = startIndex + i;
            const ind = rec.individual;
            const isSelected = ind.id === selectedId;
            const stripe = index % 2 === 1;
            const fitDelta = ind.fitness - rec.preMutationFitness;
            const isBeforeSelected = isSelected && selectedSide === 'before';
            const isAfterSelected = isSelected && selectedSide === 'after';
            const beforeInd: Individual = {
              id: ind.id,
              solution: rec.preMutationSolution,
              fitness: rec.preMutationFitness,
            };
            return (
              <div
                key={index}
                style={{
                  ...mutStyles.item,
                  gridTemplateColumns: gridCols,
                  top: index * ITEM_HEIGHT,
                  backgroundColor: stripe ? '#16162e' : 'transparent',
                }}
              >
                <span style={vlStyles.id}>{String(ind.id).padStart(idWidth)}</span>
                {/* Before genome — clickable */}
                <span
                  style={{
                    ...mutStyles.halfClickable,
                    backgroundColor: isBeforeSelected ? '#3a3a6a' : 'transparent',
                    gridColumn: '2 / 11',
                    display: 'grid',
                    gridTemplateColumns: 'subgrid',
                  }}
                  onClick={() => { onSelect(beforeInd); onSelectSide?.('before'); }}
                >
                  {rec.preMutationSolution.map((gene, gi) => (
                    <span
                      key={`b${gi}`}
                      style={gi === rec.geneIndex ? mutStyles.oldGene : mutStyles.dimGene}
                    >
                      {gene}
                    </span>
                  ))}
                  <span style={mutStyles.dimFitness}>f:{String(rec.preMutationFitness).padStart(fitWidth)}</span>
                </span>
                {/* Arrow */}
                <span style={mutStyles.arrow}>{'\u2192'}</span>
                {/* After genome — clickable */}
                <span
                  style={{
                    ...mutStyles.halfClickable,
                    backgroundColor: isAfterSelected ? '#3a3a6a' : 'transparent',
                    gridColumn: '12 / 21',
                    display: 'grid',
                    gridTemplateColumns: 'subgrid',
                  }}
                  onClick={() => { onSelect(ind); onSelectSide?.('after'); }}
                >
                  {ind.solution.map((gene, gi) => (
                    <span
                      key={`a${gi}`}
                      style={gi === rec.geneIndex ? mutStyles.mutatedGene : vlStyles.gene}
                    >
                      {gene}
                    </span>
                  ))}
                  <span style={{
                    ...vlStyles.fitness,
                    color: fitDelta > 0 ? '#4caf50' : fitDelta < 0 ? '#ff6b6b' : '#ffd700',
                  }}>
                    f:{String(ind.fitness).padStart(fitWidth)}
                  </span>
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Virtual scroll list for children — shows parent genomes inline
// ---------------------------------------------------------------------------

interface ChildRecord {
  child: Individual;
  parentA: Individual;
  parentB: Individual;
  crossoverPoint: number;
}

const ChildrenList: React.FC<{
  records: ChildRecord[];
  onSelect: (ind: Individual, source: string) => void;
  selectedId: number | null;
}> = ({ records, onSelect, selectedId }) => {
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const [resizeTick, setResizeTick] = useState(0);
  const [sortField, setSortField] = useState<SortField | null>('id');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const toggleSort = useCallback((field: SortField) => {
    setSortField((prev) => {
      if (prev === field) {
        setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
        return field;
      }
      setSortDir('asc');
      return field;
    });
  }, []);

  useLayoutEffect(() => {
    if (!containerRef.current) return;
    setResizeTick((t) => t + 1); // sync measure before paint
    const ro = new ResizeObserver(() => {
      setResizeTick((t) => t + 1);
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  void resizeTick;
  const visibleHeight = containerRef.current?.clientHeight || DEFAULT_VISIBLE_HEIGHT;

  const { idWidth, fitWidth } = useMemo(() => {
    let maxId = 0, maxFit = 0;
    for (const rec of records) {
      if (rec.child.id > maxId) maxId = rec.child.id;
      if (rec.child.fitness > maxFit) maxFit = rec.child.fitness;
    }
    return { idWidth: Math.max(3, String(maxId).length), fitWidth: String(maxFit).length };
  }, [records]);

  const parentIdWidth = useMemo(() => {
    let maxId = 0;
    for (const rec of records) {
      if (rec.parentA.id > maxId) maxId = rec.parentA.id;
      if (rec.parentB.id > maxId) maxId = rec.parentB.id;
    }
    return String(maxId).length;
  }, [records]);

  const sortedRecords = useMemo(() => {
    if (!sortField || sortField === 'partners') return records;
    const mul = sortDir === 'asc' ? 1 : -1;
    return [...records].sort((a, b) =>
      (a.child[sortField] - b.child[sortField]) * mul,
    );
  }, [records, sortField, sortDir]);

  if (records.length === 0) {
    return <div style={vlStyles.empty}>No children this generation</div>;
  }

  const totalHeight = sortedRecords.length * ITEM_HEIGHT;
  const startIndex = Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - OVERSCAN);
  const endIndex = Math.min(
    sortedRecords.length,
    Math.ceil((scrollTop + visibleHeight) / ITEM_HEIGHT) + OVERSCAN,
  );

  // Grid: [childId] child_genes f:XX bornGen ← pA_genes [pAid] pB_genes [pBid]
  const gridCols = `${COL_ID} repeat(8, ${COL_GENE}) ${COL_FIT} ${COL_EXTRA} ${COL_ARROW} repeat(8, ${COL_GENE}) ${COL_FIT} repeat(8, ${COL_GENE}) ${COL_FIT}`;

  return (
    <div style={vlStyles.wrapper}>
      <div style={{ ...mutStyles.sortBar, gridTemplateColumns: gridCols }}>
        <span
          style={{ ...vlStyles.sortBtn, padding: '0 3px', textAlign: 'right' as const, color: sortField === 'id' ? '#ffd700' : '#555' }}
          onClick={() => toggleSort('id')}
          title="Sort by index"
          data-help="Individual index — each row is one individual. Click to sort"
        >
          #
        </span>
        <span
          style={{ gridColumn: '2', padding: '0 3px', textAlign: 'center' as const, color: '#555' }}
          data-help="Each row is one individual — an 8-gene sequence representing queen positions on the board"
        >
          {'\uD83E\uDDEC'}
        </span>
        <span
          style={{ ...vlStyles.sortBtn, gridColumn: '10', padding: '0 3px', textAlign: 'right' as const, color: sortField === 'fitness' ? '#ffd700' : '#555' }}
          onClick={() => toggleSort('fitness')}
          title="Sort by fitness"
          data-help="Fitness score (0–28) — number of non-attacking queen pairs. Click to sort"
        >
          {'\uD83C\uDFC5'}
        </span>
        <span
          style={{ gridColumn: '11', padding: '0 3px', textAlign: 'center' as const, color: '#555' }}
          title="Generation this individual was born in"
          data-help="Birth generation — which generation created this individual"
        >
          {'\uD83D\uDC23'}
        </span>
        <span style={{ gridColumn: '13 / 22', textAlign: 'center' as const, color: '#666' }}>parent A</span>
        <span style={{ gridColumn: '22 / 31', textAlign: 'center' as const, color: '#666' }}>parent B</span>
      </div>
      <div
        ref={containerRef}
        style={vlStyles.scrollContainer}
        onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
      >
        <div style={{ height: totalHeight, position: 'relative' as const }}>
          {sortedRecords.slice(startIndex, endIndex).map((rec, i) => {
            const index = startIndex + i;
            const { child, parentA, parentB, crossoverPoint } = rec;
            const isSelected = child.id === selectedId;
            const stripe = index % 2 === 1;
            const isChildA = child.id % 2 === 0;
            return (
              <div
                key={index}
                style={{
                  ...mutStyles.item,
                  gridTemplateColumns: gridCols,
                  top: index * ITEM_HEIGHT,
                  backgroundColor: stripe ? '#16162e' : 'transparent',
                }}
              >
                <span style={vlStyles.id}>{String(child.id).padStart(idWidth)}</span>
                {/* Child genome — color genes by source parent */}
                <span
                  style={{
                    ...mutStyles.halfClickable,
                    backgroundColor: isSelected ? '#3a3a6a' : 'transparent',
                    gridColumn: '2 / 11',
                    display: 'grid',
                    gridTemplateColumns: 'subgrid',
                  }}
                  onClick={() => onSelect(child, 'Children')}
                >
                  {child.solution.map((gene, gi) => {
                    const fromA = isChildA ? gi < crossoverPoint : gi >= crossoverPoint;
                    return (
                      <span
                        key={gi}
                        style={{ ...CELL, textAlign: 'center' as const, color: fromA ? '#6bc5f7' : '#c49df7' }}
                      >
                        {gene}
                      </span>
                    );
                  })}
                  <span style={vlStyles.fitness}>f:{String(child.fitness).padStart(fitWidth)}</span>
                </span>
                {/* Born generation */}
                <span style={vlStyles.bornGen}>{child.bornGeneration ?? 0}</span>
                {/* Arrow */}
                <span style={mutStyles.arrow}>{'\u2190'}</span>
                {/* Parent A genome — clickable */}
                <span
                  style={{
                    ...mutStyles.halfClickable,
                    backgroundColor: selectedId === parentA.id ? '#3a3a6a' : 'transparent',
                    gridColumn: '13 / 22',
                    display: 'grid',
                    gridTemplateColumns: 'subgrid',
                  }}
                  onClick={() => onSelect(parentA, 'Parent A')}
                  title={`Parent A #${parentA.id}`}
                >
                  {parentA.solution.map((gene, gi) => (
                    <span key={gi} style={{ ...CELL, textAlign: 'center' as const, color: '#6bc5f7' }}>{gene}</span>
                  ))}
                  <span style={{ ...childStyles.parentFit }}>{String(parentA.id).padStart(parentIdWidth)}</span>
                </span>
                {/* Parent B genome — clickable */}
                <span
                  style={{
                    ...mutStyles.halfClickable,
                    backgroundColor: selectedId === parentB.id ? '#3a3a6a' : 'transparent',
                    gridColumn: '22 / 31',
                    display: 'grid',
                    gridTemplateColumns: 'subgrid',
                  }}
                  onClick={() => onSelect(parentB, 'Parent B')}
                  title={`Parent B #${parentB.id}`}
                >
                  {parentB.solution.map((gene, gi) => (
                    <span key={gi} style={{ ...CELL, textAlign: 'center' as const, color: '#c49df7' }}>{gene}</span>
                  ))}
                  <span style={{ ...childStyles.parentFit }}>{String(parentB.id).padStart(parentIdWidth)}</span>
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Actual parents — master/detail: left = parents, right = partners of selected
// ---------------------------------------------------------------------------

interface PartnerEntry {
  partner: Individual;
  pairIndex: number;
  side: 'A' | 'B'; // which side this parent was on
}

const ActualParentsList: React.FC<{
  breedingData: GenerationBreedingData;
  onSelect: (ind: Individual, source: string) => void;
  selectedId: number | null;
}> = ({ breedingData, onSelect, selectedId }) => {
  const [selectedParentId, setSelectedParentId] = useState<number | null>(null);

  // Build partner map: parentId -> list of partners
  const partnerMap = useMemo(() => {
    const map = new Map<number, PartnerEntry[]>();
    const { aParents, bParents } = breedingData;
    for (let i = 0; i < aParents.length; i++) {
      const pA = aParents[i]!;
      const pB = bParents[i]!;
      // For parent A, the partner is B
      if (!map.has(pA.id)) map.set(pA.id, []);
      map.get(pA.id)!.push({ partner: pB, pairIndex: i, side: 'A' });
      // For parent B, the partner is A
      if (!map.has(pB.id)) map.set(pB.id, []);
      map.get(pB.id)!.push({ partner: pA, pairIndex: i, side: 'B' });
    }
    return map;
  }, [breedingData]);

  const partnerCounts = useMemo(() => {
    const counts = new Map<number, number>();
    for (const [id, entries] of partnerMap) {
      counts.set(id, entries.length);
    }
    return counts;
  }, [partnerMap]);

  const partners = useMemo(() => {
    if (selectedParentId === null) return [];
    return partnerMap.get(selectedParentId) ?? [];
  }, [partnerMap, selectedParentId]);

  const partnerIndividuals = useMemo(() => partners.map((p) => p.partner), [partners]);

  const partnerPartnerCounts = useMemo(() => {
    const counts = new Map<number, number>();
    for (const p of partners) {
      counts.set(p.partner.id, partnerMap.get(p.partner.id)?.length ?? 0);
    }
    return counts;
  }, [partners, partnerMap]);

  const handleSelectParent = useCallback(
    (ind: Individual) => {
      setSelectedParentId(ind.id);
      onSelect(ind, 'Actual parents');
    },
    [onSelect],
  );

  const selectedParent = useMemo(() => {
    if (selectedParentId === null) return null;
    return breedingData.actualParents.find((p) => p.id === selectedParentId) ?? null;
  }, [breedingData.actualParents, selectedParentId]);

  return (
    <div style={actualParentStyles.container}>
      <div style={actualParentStyles.primary}>
        <div style={actualParentStyles.subHeader}>
          Individual parents <span style={styles.count}>({breedingData.actualParents.length})</span>
        </div>
        <VirtualList
          items={breedingData.actualParents}
          onSelect={handleSelectParent}
          selectedId={selectedParentId}
          partnerCounts={partnerCounts}
          showBornGen
        />
      </div>
      <div style={actualParentStyles.secondary}>
        <div style={actualParentStyles.subHeader}>
          {selectedParent
            ? <>Mates of #{selectedParent.id} <span style={styles.count}>({partners.length} matings)</span></>
            : 'Select a parent'}
        </div>
        <VirtualList
          items={partnerIndividuals}
          onSelect={(ind) => onSelect(ind, 'Partner')}
          selectedId={selectedId !== selectedParentId ? selectedId : null}
          emptyText={selectedParentId !== null ? 'No partners found' : 'Select a parent to see partners'}
          partnerCounts={partnerPartnerCounts}
          showBornGen
        />
      </div>
    </div>
  );
};

const actualParentStyles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    gap: 8,
    flex: 1,
    minHeight: 0,
  },
  primary: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 4,
    minHeight: 0,
    flexShrink: 0,
  },
  secondary: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 4,
    minHeight: 0,
    flexShrink: 1,
    flexGrow: 1,
    minWidth: 0,
  },
  subHeader: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: '#ccc',
    fontWeight: 'bold',
  },
};

const childStyles: Record<string, React.CSSProperties> = {
  parentFit: {
    color: '#666',
    whiteSpace: 'nowrap' as const,
    textAlign: 'right' as const,
    fontSize: 10,
  },
};

const mutStyles: Record<string, React.CSSProperties> = {
  sortBar: {
    columnGap: 0,
    padding: '2px 6px',
    fontSize: 10,
    fontFamily: 'monospace',
    backgroundColor: '#1a1a35',
    borderRadius: '4px 4px 0 0',
    border: '1px solid #2a2a4a',
    borderBottom: 'none',
    display: 'grid',
  },
  item: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: ITEM_HEIGHT,
    lineHeight: `${ITEM_HEIGHT}px`,
    paddingLeft: 6,
    paddingRight: 6,
    fontSize: 11,
    fontFamily: 'monospace',
    color: '#e0e0e0',
    cursor: 'pointer',
    display: 'grid',
    gap: 0,
    columnGap: 0,
  },
  dimGene: {
    ...CELL,
    color: '#777',
    textAlign: 'center' as const,
  },
  oldGene: {
    ...CELL,
    color: '#ff6b6b',
    textAlign: 'center' as const,
  },
  mutatedGene: {
    ...CELL,
    color: '#ff6b6b',
    fontWeight: 'bold',
    textAlign: 'center' as const,
  },
  dimFitness: {
    ...CELL,
    color: '#666',
    whiteSpace: 'nowrap' as const,
    textAlign: 'right' as const,
  },
  arrow: {
    color: '#555',
    textAlign: 'center' as const,
  },
  halfClickable: {
    cursor: 'pointer',
    borderRadius: 2,
  },
};

const vlStyles: Record<string, React.CSSProperties> = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column' as const,
    flexGrow: 1,
    minHeight: 0,
  },
  sortBar: {
    display: 'grid',
    gridTemplateColumns: `${COL_ID} repeat(8, ${COL_GENE}) ${COL_FIT}`,
    columnGap: 0,
    padding: '2px 6px',
    fontSize: 10,
    fontFamily: 'monospace',
    backgroundColor: '#1a1a35',
    borderRadius: '4px 4px 0 0',
    border: '1px solid #2a2a4a',
    borderBottom: 'none',
  },
  sortBtn: {
    cursor: 'pointer',
    userSelect: 'none' as const,
  },
  scrollContainer: {
    minHeight: MIN_CONTAINER_HEIGHT,
    flexGrow: 1,
    overflowY: 'auto' as const,
    backgroundColor: '#12122a',
    borderRadius: '0 0 4px 4px',
    border: '1px solid #2a2a4a',
  },
  item: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: ITEM_HEIGHT,
    lineHeight: `${ITEM_HEIGHT}px`,
    paddingLeft: 6,
    paddingRight: 6,
    fontSize: 11,
    fontFamily: 'monospace',
    color: '#e0e0e0',
    cursor: 'pointer',
    display: 'grid',
    gridTemplateColumns: `${COL_ID} repeat(8, ${COL_GENE}) ${COL_FIT}`,
    gap: 0,
    columnGap: 0,
  },
  id: { ...CELL, color: '#888', whiteSpace: 'nowrap' as const, textAlign: 'right' as const },
  gene: { ...CELL, color: '#e0e0e0', textAlign: 'center' as const },
  fitness: { ...CELL, color: '#ffd700', whiteSpace: 'nowrap' as const, textAlign: 'right' as const },
  bornGen: { ...CELL, color: '#888', whiteSpace: 'nowrap' as const, textAlign: 'center' as const, fontSize: 10 },
  partnerCount: { ...CELL, color: '#8888cc', whiteSpace: 'nowrap' as const, textAlign: 'right' as const, fontSize: 10, borderRight: 'none' },
  empty: {
    minHeight: MIN_CONTAINER_HEIGHT,
    flexGrow: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 11,
    fontFamily: 'monospace',
    color: '#555',
    backgroundColor: '#12122a',
    borderRadius: 4,
    border: '1px solid #2a2a4a',
  },
};

// ---------------------------------------------------------------------------
// Iteration data dropdown categories
// ---------------------------------------------------------------------------

export type CategoryKey = 'Eligible parents' | 'Actual parents' | 'Children' | 'Mutations';

const CATEGORY_HELP: Record<CategoryKey, string> = {
  'Eligible parents': 'All individuals from the previous generation whose fitness qualified them for the selection pool',
  'Actual parents': 'The specific individuals chosen by roulette-wheel selection to breed this generation',
  'Children': 'All offspring produced by crossover — each pair of parents creates two children by swapping gene segments',
  'Mutations': 'Children that had a random gene changed after crossover — introduces variety to escape local optima',
};

function getCategoryData(
  breedingData: GenerationBreedingData,
  category: CategoryKey,
): Individual[] {
  switch (category) {
    case 'Eligible parents': return breedingData.eligibleParents;
    case 'Actual parents': return breedingData.actualParents;
    case 'Children': return breedingData.allChildren;
    case 'Mutations': return breedingData.mutations;
  }
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export const BreedingListboxes: React.FC<Props> = ({
  breedingData,
  generation,
  onSelectIndividual,
  selectedCategory,
  onCategoryChange,
}) => {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [mutationSide, setMutationSide] = useState<'before' | 'after' | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!dropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [dropdownOpen]);

  const handleSelect = useCallback(
    (ind: Individual, source: string) => {
      setSelectedId(ind.id);
      if (source !== 'Mutations') setMutationSide(null);
      onSelectIndividual(ind, source);
    },
    [onSelectIndividual],
  );

  const categoryData = breedingData
    ? getCategoryData(breedingData, selectedCategory)
    : [];

  const childRecords = useMemo(() => {
    if (!breedingData || selectedCategory !== 'Children') return [];
    const { aParents, bParents, crossoverPoints } = breedingData;
    const out: ChildRecord[] = [];
    for (const child of breedingData.allChildren) {
      const pairIndex = Math.floor(child.id / 2);
      const pA = aParents[pairIndex];
      const pB = bParents[pairIndex];
      const cp = crossoverPoints[pairIndex];
      if (pA && pB && cp !== undefined) {
        out.push({ child, parentA: pA, parentB: pB, crossoverPoint: cp });
      }
    }
    return out;
  }, [breedingData, selectedCategory]);

  return (
    <div style={styles.panel}>
      <h3 style={styles.title} data-help="Raw breeding data showing parents and children from each generation">Population</h3>
      <div style={styles.sectionTitleRow}>
        <div style={{ ...styles.sectionTitle, borderBottom: 'none', marginBottom: 0, paddingBottom: 0 }}
          data-help={CATEGORY_HELP[selectedCategory]}
        >
          View
        </div>
        <div ref={dropdownRef} style={{ position: 'relative' as const }} data-help="Switch between population views">
          <button
            onClick={() => generation > 0 && setDropdownOpen((o) => !o)}
            disabled={generation === 0}
            style={{ ...styles.presetSelect, opacity: generation > 0 ? 1 : 0.4 }}
          >
            {selectedCategory} &#x25BE;
          </button>
          {dropdownOpen && (
            <div style={styles.dropdownMenu}>
              {(['Eligible parents', 'Actual parents', 'Children', 'Mutations'] as CategoryKey[]).map((cat) => (
                <div
                  key={cat}
                  style={{
                    ...styles.dropdownItem,
                    ...(cat === selectedCategory ? styles.dropdownItemActive : {}),
                  }}
                  data-help={CATEGORY_HELP[cat]}
                  onClick={() => { onCategoryChange(cat); setDropdownOpen(false); }}
                >
                  {cat}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedCategory === 'Mutations' ? (
        <MutationList
          records={breedingData?.mutationRecords ?? []}
          onSelect={(ind) => handleSelect(ind, 'Mutations')}
          selectedId={selectedId}
          selectedSide={mutationSide}
          onSelectSide={setMutationSide}
        />
      ) : selectedCategory === 'Children' ? (
        <ChildrenList
          records={childRecords}
          onSelect={handleSelect}
          selectedId={selectedId}
        />
      ) : selectedCategory === 'Actual parents' && breedingData ? (
        <ActualParentsList
          breedingData={breedingData}
          onSelect={handleSelect}
          selectedId={selectedId}
        />
      ) : (
        <VirtualList
          items={categoryData}
          onSelect={(ind) => handleSelect(ind, selectedCategory)}
          selectedId={selectedId}
          emptyText={selectedCategory === 'Eligible parents' ? 'Loading population…' : `No ${selectedCategory.toLowerCase()} this generation`}
          showBornGen={selectedCategory === 'Eligible parents'}
        />
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  panel: {
    backgroundColor: '#1a1a2e',
    borderRadius: 8,
    padding: 16,
    border: '1px solid #2a2a4a',
    flex: 1,
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column' as const,
    width: '100%',
  },
  title: {
    margin: '0 0 12px 0',
    fontSize: 14,
    fontFamily: 'monospace',
    color: '#aaa',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  sectionTitleRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid #2a2a4a',
    paddingBottom: 2,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 10,
    fontFamily: 'monospace',
    color: '#6c5ce7',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  presetSelect: {
    padding: '2px 6px',
    fontSize: 9,
    fontFamily: 'monospace',
    backgroundColor: '#2a2a4a',
    color: '#e0e0e0',
    border: '1px solid #3a3a5a',
    borderRadius: 3,
    cursor: 'pointer',
    flexShrink: 0,
  },
  dropdownMenu: {
    position: 'absolute' as const,
    top: '100%',
    right: 0,
    marginTop: 2,
    backgroundColor: '#2a2a4a',
    border: '1px solid #3a3a5a',
    borderRadius: 3,
    zIndex: 10,
    minWidth: 120,
  },
  dropdownItem: {
    padding: '4px 8px',
    fontSize: 9,
    fontFamily: 'monospace',
    color: '#e0e0e0',
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
  },
  dropdownItemActive: {
    backgroundColor: '#3a3a5a',
  },
};
