import React, { useMemo, useState } from 'react';
import type { Individual, GenerationBreedingData } from '../engine/types';

interface Props {
  individual: Individual | null;
  breedingData: GenerationBreedingData | null;
  generation: number;
  onSelectIndividual: (individual: Individual, source: string) => void;
}

interface MatingEntry {
  partner: Individual;
  childA: Individual;
  childB: Individual;
  side: 'A' | 'B';
}

export const SpecimenPanel: React.FC<Props> = ({
  individual,
  breedingData,
  generation,
  onSelectIndividual,
}) => {
  const [matingIndex, setMatingIndex] = useState(0);

  const info = useMemo(() => {
    if (!individual || !breedingData) return null;

    const isChild = breedingData.allChildren.some(c => c.id === individual.id);

    let parentA: Individual | null = null;
    let parentB: Individual | null = null;
    let crossoverPoint: number | null = null;
    let sibling: Individual | null = null;

    if (isChild) {
      const pairIndex = Math.floor(individual.id / 2);
      parentA = breedingData.aParents[pairIndex] ?? null;
      parentB = breedingData.bParents[pairIndex] ?? null;
      crossoverPoint = breedingData.crossoverPoints[pairIndex] ?? null;
      const isChildA = individual.id % 2 === 0;
      sibling = isChildA
        ? breedingData.bChildren[pairIndex] ?? null
        : breedingData.aChildren[pairIndex] ?? null;
    }

    const isActualParent = breedingData.actualParents.some(p => p.id === individual.id);
    const isEligibleParent = breedingData.eligibleParents.some(p => p.id === individual.id);

    const matings: MatingEntry[] = [];
    if (isActualParent) {
      for (let i = 0; i < breedingData.aParents.length; i++) {
        const pA = breedingData.aParents[i]!;
        const pB = breedingData.bParents[i]!;
        const cA = breedingData.aChildren[i]!;
        const cB = breedingData.bChildren[i]!;
        if (pA.id === individual.id) {
          matings.push({ partner: pB, childA: cA, childB: cB, side: 'A' });
        } else if (pB.id === individual.id) {
          matings.push({ partner: pA, childA: cA, childB: cB, side: 'B' });
        }
      }
    }

    const mutationRecord = breedingData.mutationRecords.find(
      r => r.individual.id === individual.id,
    ) ?? null;

    const uniquePartnerCount = new Set(matings.map(m => m.partner.id)).size;

    return {
      isChild,
      parentA,
      parentB,
      crossoverPoint,
      sibling,
      isActualParent,
      isEligibleParent,
      matings,
      uniquePartnerCount,
      mutationRecord,
    };
  }, [individual, breedingData]);

  // Reset mating index when individual changes
  const prevIdRef = React.useRef<number | null>(null);
  if (individual?.id !== prevIdRef.current) {
    prevIdRef.current = individual?.id ?? null;
    if (matingIndex !== 0) setMatingIndex(0);
  }

  const selectedMating = info?.matings[matingIndex] ?? null;

  const na = <span style={styles.na}>-</span>;

  return (
    <div style={styles.panel} data-help="Specimen inspector - click any individual in the population lists to see its details, lineage, and breeding history">
      {/* Row 1: Identity */}
      <div style={styles.row}>
        <Field label="Specimen" width={80} help="Unique ID of this individual within the population">
          {individual ? <span style={styles.id}>#{individual.id}</span> : na}
        </Field>
        <Field label="Fitness" width={60} help="Number of non-attacking queen pairs (max 28 = solved)">
          {individual ? <span style={styles.fitness}>{individual.fitness}/28</span> : na}
        </Field>
        <Field label="Born" width={50} help="The generation in which this individual was first created">
          {individual
            ? <span style={styles.val}>Gen {individual.bornGeneration ?? 0}</span>
            : na}
        </Field>
        <Field label="Lives in" width={60} help="The generation snapshot currently being viewed">
          {individual ? <span style={styles.val}>Gen {generation}</span> : na}
        </Field>
        <Field label="Role" width={100} help="This individual's role in the current generation: Child (offspring of breeding), Parent (selected to breed), or Eligible parent (qualified but not selected)">
          {info ? (
            <span style={styles.val}>
              {info.isChild
                ? 'Child'
                : info.isActualParent
                  ? 'Parent'
                  : info.isEligibleParent
                    ? 'Eligible parent'
                    : '-'}
            </span>
          ) : na}
        </Field>
      </div>

      {/* Row 2: Mutation */}
      <div style={styles.row}>
        <Field label="Mutated" width={120} help="Whether a random gene was changed after crossover, and which gene was affected">
          {info?.mutationRecord ? (
            <span style={styles.mutation}>
              gene {info.mutationRecord.geneIndex}: {info.mutationRecord.oldValue} -&gt; {info.mutationRecord.newValue}
            </span>
          ) : (
            <span style={styles.val}>{individual ? 'No' : '-'}</span>
          )}
        </Field>
      </div>

      {/* Row 3: Parentage */}
      <div style={styles.row}>
        <Field label="Parent A" width={160} help="First parent used in the crossover that produced this child - click to inspect">
          {info?.parentA ? (
            <ClickableIndividual ind={info.parentA} color="#6bc5f7" onClick={() => onSelectIndividual(info.parentA!, 'Parent A')} />
          ) : na}
        </Field>
        <Field label="Parent B" width={160} help="Second parent used in the crossover that produced this child - click to inspect">
          {info?.parentB ? (
            <ClickableIndividual ind={info.parentB} color="#c49df7" onClick={() => onSelectIndividual(info.parentB!, 'Parent B')} />
          ) : na}
        </Field>
        <Field label="Crossover" width={50} help="The gene position where the parents' chromosomes were spliced to produce children">
          {info?.crossoverPoint !== null && info?.crossoverPoint !== undefined
            ? <span style={styles.val}>pos {info.crossoverPoint}</span>
            : na}
        </Field>
      </div>

      {/* Row 4: Sibling */}
      <div style={styles.row}>
        <Field label="Sibling" width={160} help="The other child produced from the same crossover - click to inspect">
          {info?.sibling ? (
            <ClickableIndividual ind={info.sibling} color="#8a8" onClick={() => onSelectIndividual(info.sibling!, 'Sibling')} />
          ) : na}
        </Field>
      </div>

      {/* Row 5: Breeding */}
      <div style={styles.row}>
        <Field label="Matings" width={80} help="How many times this individual was selected as a parent this generation, and with how many unique partners">
          {info?.matings.length
            ? <span style={styles.val}>{info.matings.length}x ({info.uniquePartnerCount} partner{info.uniquePartnerCount !== 1 ? 's' : ''})</span>
            : na}
        </Field>
        <Field label="Mating" width={120} help="Browse through each mating event for this parent">
          {info && info.matings.length > 0 ? (
            <select
              style={styles.select}
              value={matingIndex}
              onChange={(e) => setMatingIndex(Number(e.target.value))}
            >
              {info.matings.map((m, i) => (
                <option key={i} value={i}>
                  #{i + 1} w/ #{m.partner.id} (f:{m.partner.fitness})
                </option>
              ))}
            </select>
          ) : na}
        </Field>
        <Field label="Children" width={200} help="The two offspring produced by the selected mating event - select to inspect">
          {selectedMating ? (
            <select
              style={styles.select}
              value=""
              onChange={(e) => {
                const child = e.target.value === 'a' ? selectedMating.childA : selectedMating.childB;
                onSelectIndividual(child, 'Child');
                e.target.value = '';
              }}
            >
              <option value="" disabled>#{selectedMating.childA.id} (f:{selectedMating.childA.fitness}), #{selectedMating.childB.id} (f:{selectedMating.childB.fitness})</option>
              <option value="a">#{selectedMating.childA.id} (f:{selectedMating.childA.fitness})</option>
              <option value="b">#{selectedMating.childB.id} (f:{selectedMating.childB.fitness})</option>
            </select>
          ) : na}
        </Field>
      </div>
    </div>
  );
};

const Field: React.FC<{
  label: string;
  width: number;
  help?: string;
  children: React.ReactNode;
}> = ({ label, width, help, children }) => (
  <div style={{ ...styles.field, minWidth: width }} data-help={help}>
    <span style={styles.fieldLabel}>{label}</span>
    <span style={styles.fieldValue}>{children}</span>
  </div>
);

const ClickableIndividual: React.FC<{
  ind: Individual;
  color: string;
  onClick: () => void;
}> = ({ ind, color, onClick }) => (
  <span
    style={{ ...styles.clickable, borderColor: color }}
    onClick={onClick}
    title={`#${ind.id} [${ind.solution.join(',')}] f:${ind.fitness}`}
  >
    <span style={{ color }}>#{ind.id}</span>
    <span style={styles.chipFit}>f:{ind.fitness}</span>
  </span>
);

const styles: Record<string, React.CSSProperties> = {
  panel: {
    backgroundColor: '#1a1a2e',
    borderRadius: 0,
    padding: '6px 10px',
    borderTop: '1px solid #2a2a4a',
    fontFamily: 'monospace',
    fontSize: 11,
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  row: {
    display: 'flex',
    gap: 12,
    alignItems: 'center',
    minHeight: 20,
  },
  field: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    whiteSpace: 'nowrap',
  },
  fieldLabel: {
    fontSize: 9,
    color: '#666',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.3,
    flexShrink: 0,
  },
  fieldValue: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
  },
  na: {
    color: '#444',
    fontSize: 11,
  },
  id: {
    color: '#ffd700',
    fontWeight: 'bold',
  },
  fitness: {
    color: '#ffd700',
  },
  val: {
    color: '#ccc',
  },
  mutation: {
    color: '#ff6b6b',
  },
  clickable: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 3,
    padding: '1px 5px',
    border: '1px solid',
    borderRadius: 3,
    cursor: 'pointer',
    backgroundColor: '#12122a',
    fontSize: 11,
  },
  chipFit: {
    color: '#ffd700',
    fontSize: 10,
  },
  chipRow: {
    display: 'inline-flex',
    gap: 4,
    alignItems: 'center',
  },
  select: {
    padding: '1px 4px',
    fontSize: 10,
    fontFamily: 'monospace',
    backgroundColor: '#12122a',
    color: '#ccc',
    border: '1px solid #3a3a5a',
    borderRadius: 3,
    cursor: 'pointer',
    maxWidth: 160,
  },
};
