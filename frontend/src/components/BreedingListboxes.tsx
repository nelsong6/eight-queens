import React, { useState, useCallback } from 'react';
import type { Individual, GenerationBreedingData } from '../engine/types';

interface Props {
  breedingData: GenerationBreedingData | null;
  onSelectIndividual: (individual: Individual, source: string) => void;
}

// ---------------------------------------------------------------------------
// Virtual scroll list for large populations
// ---------------------------------------------------------------------------

const ITEM_HEIGHT = 22;
const VISIBLE_HEIGHT = 200;
const OVERSCAN = 3;

const VirtualList: React.FC<{
  items: Individual[];
  onSelect: (ind: Individual) => void;
  selectedId: number | null;
  emptyText?: string;
}> = ({ items, onSelect, selectedId, emptyText = 'No data' }) => {
  const [scrollTop, setScrollTop] = useState(0);

  if (items.length === 0) {
    return <div style={vlStyles.empty}>{emptyText}</div>;
  }

  const totalHeight = items.length * ITEM_HEIGHT;
  const startIndex = Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - OVERSCAN);
  const endIndex = Math.min(
    items.length,
    Math.ceil((scrollTop + VISIBLE_HEIGHT) / ITEM_HEIGHT) + OVERSCAN,
  );

  return (
    <div
      style={vlStyles.scrollContainer}
      onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
    >
      <div style={{ height: totalHeight, position: 'relative' as const }}>
        {items.slice(startIndex, endIndex).map((ind, i) => {
          const index = startIndex + i;
          const isSelected = ind.id === selectedId;
          return (
            <div
              key={index}
              style={{
                ...vlStyles.item,
                top: index * ITEM_HEIGHT,
                backgroundColor: isSelected ? '#3a3a6a' : 'transparent',
              }}
              onClick={() => onSelect(ind)}
            >
              <span style={vlStyles.id}>[{ind.id}]</span>{' '}
              <span style={vlStyles.solution}>{ind.solution.join(' ')}</span>{' '}
              <span style={vlStyles.fitness}>f:{ind.fitness}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const vlStyles: Record<string, React.CSSProperties> = {
  scrollContainer: {
    height: VISIBLE_HEIGHT,
    overflowY: 'auto',
    backgroundColor: '#12122a',
    borderRadius: 4,
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
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  id: { color: '#888' },
  solution: { color: '#e0e0e0' },
  fitness: { color: '#ffd700', marginLeft: 4 },
  empty: {
    height: VISIBLE_HEIGHT,
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

type CategoryKey = 'Eligible parents' | 'Actual parents' | 'Children' | 'Mutations';

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
  onSelectIndividual,
}) => {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('');

  const handleSelect = useCallback(
    (ind: Individual, source: string) => {
      setSelectedId(ind.id);
      onSelectIndividual(ind, source);
    },
    [onSelectIndividual],
  );

  const categoryData = breedingData && selectedCategory
    ? getCategoryData(breedingData, selectedCategory as CategoryKey)
    : [];

  return (
    <div style={styles.panel}>
      <div style={styles.title}>Breeding Data</div>

      {/* 2x2 grid: Parent A, Parent B, Child A, Child B */}
      <div style={styles.grid}>
        <div style={styles.listCol}>
          <div style={styles.listHeader}>
            Parent A <span style={styles.count}>({breedingData?.aParents.length ?? 0})</span>
          </div>
          <VirtualList
            items={breedingData?.aParents ?? []}
            onSelect={(ind) => handleSelect(ind, 'Parent A')}
            selectedId={selectedId}
          />
        </div>
        <div style={styles.listCol}>
          <div style={styles.listHeader}>
            Parent B <span style={styles.count}>({breedingData?.bParents.length ?? 0})</span>
          </div>
          <VirtualList
            items={breedingData?.bParents ?? []}
            onSelect={(ind) => handleSelect(ind, 'Parent B')}
            selectedId={selectedId}
          />
        </div>
        <div style={styles.listCol}>
          <div style={styles.listHeader}>
            Child A <span style={styles.count}>({breedingData?.aChildren.length ?? 0})</span>
          </div>
          <VirtualList
            items={breedingData?.aChildren ?? []}
            onSelect={(ind) => handleSelect(ind, 'Child A')}
            selectedId={selectedId}
          />
        </div>
        <div style={styles.listCol}>
          <div style={styles.listHeader}>
            Child B <span style={styles.count}>({breedingData?.bChildren.length ?? 0})</span>
          </div>
          <VirtualList
            items={breedingData?.bChildren ?? []}
            onSelect={(ind) => handleSelect(ind, 'Child B')}
            selectedId={selectedId}
          />
        </div>
      </div>

      {/* Iteration data dropdown */}
      <div style={styles.dropdownRow}>
        <label style={styles.dropdownLabel}>Iteration Data:</label>
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          style={styles.select}
        >
          <option value="">-- Select --</option>
          <option value="Eligible parents">Eligible parents</option>
          <option value="Actual parents">Actual parents</option>
          <option value="Children">Children</option>
          <option value="Mutations">Mutations</option>
        </select>
        {selectedCategory && (
          <span style={styles.count}>({categoryData.length})</span>
        )}
      </div>

      {selectedCategory && (
        <VirtualList
          items={categoryData}
          onSelect={(ind) => handleSelect(ind, selectedCategory)}
          selectedId={selectedId}
          emptyText={`No ${selectedCategory.toLowerCase()} this generation`}
        />
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  panel: {
    backgroundColor: '#1a1a2e',
    borderRadius: 8,
    padding: 12,
    border: '1px solid #2a2a4a',
    flex: '1 1 300px',
  },
  title: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#aaa',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 8,
  },
  listCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  listHeader: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: '#ccc',
    fontWeight: 'bold',
  },
  count: {
    color: '#777',
    fontWeight: 'normal',
  },
  dropdownRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  dropdownLabel: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: '#aaa',
  },
  select: {
    padding: '4px 8px',
    fontSize: 11,
    fontFamily: 'monospace',
    backgroundColor: '#2a2a4a',
    color: '#e0e0e0',
    border: '1px solid #3a3a5a',
    borderRadius: 4,
  },
};
