import React, { useMemo, useState } from 'react';
import type { Specimen, GenerationBreedingData, PoolOrigin } from '../engine/types';
import { formatCoordinate } from '../engine/time-coordinate';
import { formatId } from '../engine/specimen';
import { colors } from '../colors';

interface Props {
  specimen: Specimen | null;
  breedingData: GenerationBreedingData | null;
  generation: number;
  isBest: boolean;
  isSolution: boolean;
  onSelectSpecimen: (specimen: Specimen, origin: PoolOrigin) => void;
  viewedOrigin: PoolOrigin | null;
}

interface MatingEntry {
  partner: Specimen;
  childA: Specimen;
  childB: Specimen;
  side: 'A' | 'B';
}

export const SpecimenPanel: React.FC<Props> = ({
  specimen,
  breedingData,
  generation,
  isBest,
  isSolution,
  onSelectSpecimen,
  viewedOrigin,
}) => {
  const [matingIndex, setMatingIndex] = useState(0);

  const info = useMemo(() => {
    if (!specimen || !breedingData) return null;

    const isChild = breedingData.allChildren.some(c => c.id === specimen.id);

    let parentA: Specimen | null = null;
    let parentB: Specimen | null = null;
    let crossoverPoint: number | null = null;
    let sibling: Specimen | null = null;

    if (isChild) {
      let pairIndex = breedingData.aChildren.findIndex(c => c.id === specimen.id);
      let isChildA = true;
      if (pairIndex === -1) {
        pairIndex = breedingData.bChildren.findIndex(c => c.id === specimen.id);
        isChildA = false;
      }
      if (pairIndex >= 0) {
        parentA = breedingData.aParents[pairIndex] ?? null;
        parentB = breedingData.bParents[pairIndex] ?? null;
        crossoverPoint = breedingData.crossoverPoints[pairIndex] ?? null;
        sibling = isChildA
          ? breedingData.bChildren[pairIndex] ?? null
          : breedingData.aChildren[pairIndex] ?? null;
      }
    }

    const isActualParent = breedingData.actualParents.some(p => p.id === specimen.id);
    const isEligibleParent = breedingData.eligibleParents.some(p => p.id === specimen.id);

    const matings: MatingEntry[] = [];
    if (isActualParent) {
      for (let i = 0; i < breedingData.aParents.length; i++) {
        const pA = breedingData.aParents[i]!;
        const pB = breedingData.bParents[i]!;
        const cA = breedingData.aChildren[i]!;
        const cB = breedingData.bChildren[i]!;
        if (pA.id === specimen.id) {
          matings.push({ partner: pB, childA: cA, childB: cB, side: 'A' });
        } else if (pB.id === specimen.id) {
          matings.push({ partner: pA, childA: cA, childB: cB, side: 'B' });
        }
      }
    }

    const mutationRecord = breedingData.mutationRecords.find(
      r => r.specimen.id === specimen.id,
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
  }, [specimen, breedingData]);

  // Reset mating index when specimen changes
  const prevIdRef = React.useRef<number | null>(null);
  if (specimen?.id !== prevIdRef.current) {
    prevIdRef.current = specimen?.id ?? null;
    if (matingIndex !== 0) setMatingIndex(0);
  }

  const selectedMating = info?.matings[matingIndex] ?? null;

  const na = <span style={styles.na}>-</span>;

  return (
    <div style={styles.panel} data-help="Specimen inspector - click any specimen in the population lists to see its details, lineage, and breeding history">
      <h3 style={styles.title}>Specimen</h3>
      <Field label="ID" help="Unique ID of this specimen within the population">
        {specimen ? <span style={styles.id}>#{formatId(specimen)}</span> : na}
      </Field>
      <Field label="Sample collection date" help="The pipeline position where this specimen was clicked — format: x.y (generation.operation)">
        {viewedOrigin ? (
          <span style={styles.val}>
            <span style={styles.coordinate}>{formatCoordinate(viewedOrigin.coordinate)}</span>
          </span>
        ) : na}
      </Field>
      <Field label="Chromosome" help="Row positions for each column — the gene sequence representing queen placements">
        {specimen ? <span style={styles.val}>[{specimen.solution.join(', ')}]</span> : na}
      </Field>
      <Field label="Fitness" help="Number of non-attacking queen pairs (max 28 = solved)">
        {specimen ? <span style={styles.fitness}>{specimen.fitness}/28</span> : na}
      </Field>
      <Field label="Born" help="The time coordinate at which this specimen was created — format: x.y (generation.operation)">
        {specimen
          ? <span style={styles.val}>
              <span style={styles.coordinate}>{formatCoordinate({
                generation: specimen.bornGeneration ?? 0,
                operation: 5,
              })}</span>
            </span>
          : na}
      </Field>
      <Field label="Age" help="This specimen's age value: 0 = chromosome, 1 = child, 2 = adult, 3 = elder" helpGlossary="age-lifecycle">
        {specimen ? (
          <span style={styles.val}>
            {specimen.age}
          </span>
        ) : na}
      </Field>
      <Field label="Best" help="Whether this specimen has the highest fitness in the current generation">
        <span style={styles.checkbox}>{isBest ? '☑' : '☐'}</span>
      </Field>
      <Field label="Solution" help="Whether this specimen has achieved the maximum fitness of 28 (all queens non-attacking)">
        <span style={{ ...styles.checkbox, ...(isSolution ? { color: colors.accent.green } : {}) }}>{isSolution ? '☑' : '☐'}</span>
      </Field>
      <Field label="Mutated" help="Whether a random gene was changed after crossover, and which gene was affected">
        {info?.mutationRecord ? (
          <span style={styles.mutation}>
            <span style={{ color: colors.accent.green }}>☑</span> gene {info.mutationRecord.geneIndex}: {info.mutationRecord.oldValue} -&gt; {info.mutationRecord.newValue}
          </span>
        ) : (
          <span style={styles.checkbox}>{specimen ? '☐' : '-'}</span>
        )}
      </Field>
      <Field label="Parents" help="The two parents used in the crossover that produced this child - click to inspect">
        {info?.parentA || info?.parentB ? (
          <span style={{ display: 'flex', gap: 6 }}>
            {info?.parentA && <ClickableSpecimen ind={info.parentA} color={colors.parent.a} onClick={() => onSelectSpecimen(info.parentA!, { coordinate: { generation, operation: 2 }, pool: 'selectedPairs', qualifier: 'A' })} />}
            {info?.parentB && <ClickableSpecimen ind={info.parentB} color={colors.parent.b} onClick={() => onSelectSpecimen(info.parentB!, { coordinate: { generation, operation: 2 }, pool: 'selectedPairs', qualifier: 'B' })} />}
          </span>
        ) : na}
      </Field>
      <Field label="Crossover" help="The gene position where the parents' chromosomes were spliced to produce children">
        {info?.crossoverPoint !== null && info?.crossoverPoint !== undefined
          ? <span style={styles.val}>{info.crossoverPoint}</span>
          : na}
      </Field>
      <Field label="Sibling" help="The other child produced from the same crossover - click to inspect">
        {info?.sibling ? (
          <ClickableSpecimen ind={info.sibling} color={colors.accent.green} onClick={() => onSelectSpecimen(info.sibling!, { coordinate: { generation, operation: 5 }, pool: 'finalChildren' })} />
        ) : na}
      </Field>
      <Field label="Mating" help="How many times this specimen was selected as a parent — browse each mating event">
        {info && info.matings.length > 0 ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <select
              style={styles.select}
              value={matingIndex}
              onChange={(e) => setMatingIndex(Number(e.target.value))}
            >
              {info.matings.map((m, i) => (
                <option key={i} value={i}>
                  #{i + 1} w/ #{formatId(m.partner)} (f:{m.partner.fitness})
                </option>
              ))}
            </select>
            <span style={{ ...styles.val, fontSize: 10 }}>of {info.matings.length}</span>
          </span>
        ) : na}
      </Field>
      <Field label="Children" help="The two offspring produced by the selected mating event - select to inspect">
        {selectedMating ? (
          <select
            style={styles.select}
            value=""
            onChange={(e) => {
              const child = e.target.value === 'a' ? selectedMating.childA : selectedMating.childB;
              onSelectSpecimen(child, { coordinate: { generation, operation: 5 }, pool: 'finalChildren' });
              e.target.value = '';
            }}
          >
            <option value="" disabled>#{formatId(selectedMating.childA)} (f:{selectedMating.childA.fitness}), #{formatId(selectedMating.childB)} (f:{selectedMating.childB.fitness})</option>
            <option value="a">#{formatId(selectedMating.childA)} (f:{selectedMating.childA.fitness})</option>
            <option value="b">#{formatId(selectedMating.childB)} (f:{selectedMating.childB.fitness})</option>
          </select>
        ) : na}
      </Field>
    </div>
  );
};

const Field: React.FC<{
  label: string;
  help?: string;
  helpGlossary?: string;
  children: React.ReactNode;
}> = ({ label, help, helpGlossary, children }) => (
  <div style={styles.field} data-help={help} data-help-glossary={helpGlossary}>
    <span style={styles.fieldLabel}>{label}</span>
    <span style={styles.fieldValue}>{children}</span>
  </div>
);

const ClickableSpecimen: React.FC<{
  ind: Specimen;
  color: string;
  onClick: () => void;
}> = ({ ind, color, onClick }) => (
  <span
    style={{ ...styles.clickable, borderColor: color }}
    onClick={onClick}
    title={`#${formatId(ind)} [${ind.solution.join(',')}] f:${ind.fitness}`}
  >
    <span style={{ color }}>#{formatId(ind)}</span>
    <span style={styles.chipFit}>f:{ind.fitness}</span>
  </span>
);

const styles: Record<string, React.CSSProperties> = {
  panel: {
    backgroundColor: colors.bg.surface,
    borderRadius: 8,
    padding: 16,
    border: `1px solid ${colors.border.subtle}`,
    fontFamily: 'monospace',
    fontSize: 11,
    marginTop: 12,
    flex: 1,
    minHeight: 0,
  },
  title: {
    margin: '0 0 12px 0',
    fontSize: 14,
    fontFamily: 'monospace',
    color: colors.text.secondary,
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
  },
  field: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '2px 0',
    minHeight: 22,
  },
  fieldLabel: {
    fontSize: 11,
    color: colors.text.tertiary,
    flexShrink: 0,
  },
  fieldValue: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    fontSize: 11,
    fontWeight: 'bold',
    color: colors.text.primary,
  },
  na: {
    color: colors.text.disabled,
    fontSize: 11,
  },
  id: {
    color: colors.accent.gold,
    fontWeight: 'bold',
  },
  fitness: {
    color: colors.accent.gold,
  },
  val: {
    color: colors.text.secondary,
  },
  mutation: {
    color: colors.accent.red,
  },
  coordinate: {
    color: colors.accent.purple,
    fontWeight: 'bold',
    fontSize: 11,
  },
  poolLabel: {
    color: colors.text.tertiary,
    fontSize: 10,
  },
  checkbox: {
    fontSize: 13,
    color: colors.text.tertiary,
    userSelect: 'none' as const,
  },
  clickable: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 3,
    padding: '1px 5px',
    border: '1px solid',
    borderRadius: 3,
    cursor: 'pointer',
    backgroundColor: colors.bg.raised,
    fontSize: 11,
  },
  chipFit: {
    color: colors.accent.gold,
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
    backgroundColor: colors.bg.raised,
    color: colors.text.secondary,
    border: `1px solid ${colors.border.strong}`,
    borderRadius: 3,
    cursor: 'pointer',
    maxWidth: 160,
  },
};
