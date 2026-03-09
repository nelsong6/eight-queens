import React, { useMemo } from 'react';
import type { Specimen, BreedingPair, GenerationBreedingData, PoolOrigin, MutationRecord } from '../engine/types';
import { formatId } from '../engine/specimen';
import { colors } from '../colors';

interface Props {
  pair: BreedingPair | null;
  breedingData: GenerationBreedingData | null;
  generation: number;
  onSelectSpecimen: (specimen: Specimen, origin: PoolOrigin) => void;
  onSelectPair: (pair: BreedingPair) => void;
  viewedSpecimen: Specimen | null;
}

interface ReconstructedPair {
  index: number;
  parentA: Specimen;
  parentB: Specimen;
  crossoverPoint: number;
  childA: Specimen;
  childB: Specimen;
  partner: Specimen;
  side: 'A' | 'B';
}

export const MatedPairPanel: React.FC<Props> = ({
  pair,
  breedingData,
  generation,
  onSelectSpecimen,
  onSelectPair,
  viewedSpecimen,
}) => {
  // Find mutation records for children of the viewed pair
  const childAMutation = useMemo<MutationRecord | null>(() => {
    if (!pair?.childA || !breedingData) return null;
    return breedingData.mutationRecords.find(r => r.specimen.id === pair.childA!.id) ?? null;
  }, [pair, breedingData]);

  const childBMutation = useMemo<MutationRecord | null>(() => {
    if (!pair?.childB || !breedingData) return null;
    return breedingData.mutationRecords.find(r => r.specimen.id === pair.childB!.id) ?? null;
  }, [pair, breedingData]);

  // Fitness delta
  const fitnessDelta = useMemo(() => {
    if (!pair?.childA || !pair?.childB) return null;
    const avgChild = (pair.childA.fitness + pair.childB.fitness) / 2;
    const avgParent = (pair.parentA.fitness + pair.parentB.fitness) / 2;
    return avgChild - avgParent;
  }, [pair]);

  // Scrollable list: pairs involving the viewed specimen
  const specimenPairs = useMemo<ReconstructedPair[]>(() => {
    if (!viewedSpecimen || !breedingData) return [];
    const result: ReconstructedPair[] = [];
    for (let i = 0; i < breedingData.aParents.length; i++) {
      const pA = breedingData.aParents[i]!;
      const pB = breedingData.bParents[i]!;
      if (pA.id === viewedSpecimen.id) {
        result.push({
          index: i,
          parentA: pA,
          parentB: pB,
          crossoverPoint: breedingData.crossoverPoints[i]!,
          childA: breedingData.aChildren[i]!,
          childB: breedingData.bChildren[i]!,
          partner: pB,
          side: 'A',
        });
      } else if (pB.id === viewedSpecimen.id) {
        result.push({
          index: i,
          parentA: pA,
          parentB: pB,
          crossoverPoint: breedingData.crossoverPoints[i]!,
          childA: breedingData.aChildren[i]!,
          childB: breedingData.bChildren[i]!,
          partner: pA,
          side: 'B',
        });
      }
    }
    return result;
  }, [viewedSpecimen, breedingData]);

  const na = <span style={styles.na}>-</span>;

  const makeParentOrigin = (qualifier: 'A' | 'B'): PoolOrigin => ({
    coordinate: { generation, operation: 2 },
    pool: 'selectedPairs',
    qualifier,
  });

  const makeChildOrigin = (): PoolOrigin => ({
    coordinate: { generation, operation: 5 },
    pool: 'finalChildren',
  });

  return (
    <div style={styles.panel} data-help="Mated pair inspector — click any pair row to see details about the breeding event, parents, crossover, and offspring">
      <h3 style={styles.title}>Mated Pair</h3>

      {/* ── Detail section ── */}
      <Field label="Pair" help="Index of this breeding pair within the generation">
        {pair ? <span style={styles.id}>#{pair.index + 1}</span> : na}
      </Field>
      <Field label="Parent A" help="The A-side parent — contributes genes before the crossover point to Child A">
        {pair ? (
          <ClickableSpecimen
            ind={pair.parentA}
            color={colors.parent.a}
            onClick={() => onSelectSpecimen(pair.parentA, makeParentOrigin('A'))}
          />
        ) : na}
      </Field>
      <Field label="Parent B" help="The B-side parent — contributes genes before the crossover point to Child B">
        {pair ? (
          <ClickableSpecimen
            ind={pair.parentB}
            color={colors.parent.b}
            onClick={() => onSelectSpecimen(pair.parentB, makeParentOrigin('B'))}
          />
        ) : na}
      </Field>
      <Field label="Crossover" help="The gene position where the parents' chromosomes were spliced">
        {pair?.crossoverPoint !== undefined ? <span style={styles.val}>{pair.crossoverPoint}</span> : na}
      </Field>
      <Field label="Child A" help="Offspring A — genes before crossover from Parent A, after from Parent B">
        {pair?.childA ? (
          <ClickableSpecimen
            ind={pair.childA}
            color={colors.accent.green}
            onClick={() => onSelectSpecimen(pair.childA!, makeChildOrigin())}
          />
        ) : na}
      </Field>
      <Field label="Child B" help="Offspring B — genes before crossover from Parent B, after from Parent A">
        {pair?.childB ? (
          <ClickableSpecimen
            ind={pair.childB}
            color={colors.accent.green}
            onClick={() => onSelectSpecimen(pair.childB!, makeChildOrigin())}
          />
        ) : na}
      </Field>
      <Field label="Child A mut." help="Whether Child A was mutated after crossover">
        {pair?.childA ? (
          childAMutation ? (
            <span style={styles.mutation}>
              <span style={{ color: colors.accent.green }}>☑</span> gene {childAMutation.geneIndex}: {childAMutation.oldValue} → {childAMutation.newValue}
            </span>
          ) : (
            <span style={styles.checkbox}>☐</span>
          )
        ) : na}
      </Field>
      <Field label="Child B mut." help="Whether Child B was mutated after crossover">
        {pair?.childB ? (
          childBMutation ? (
            <span style={styles.mutation}>
              <span style={{ color: colors.accent.green }}>☑</span> gene {childBMutation.geneIndex}: {childBMutation.oldValue} → {childBMutation.newValue}
            </span>
          ) : (
            <span style={styles.checkbox}>☐</span>
          )
        ) : na}
      </Field>
      <Field label="Fitness delta" help="Average child fitness minus average parent fitness — positive means offspring improved">
        {fitnessDelta !== null ? (
          <span style={{
            color: fitnessDelta > 0 ? colors.accent.green : fitnessDelta < 0 ? colors.accent.red : colors.text.secondary,
            fontWeight: 'bold',
          }}>
            {fitnessDelta > 0 ? '+' : ''}{fitnessDelta.toFixed(1)}
          </span>
        ) : na}
      </Field>

      {/* ── Scrollable pair list for viewed specimen ── */}
      <div style={styles.listSection}>
        <div style={styles.listHeader}>
          {viewedSpecimen
            ? <>Pairs for #{formatId(viewedSpecimen)} <span style={styles.listCount}>({specimenPairs.length})</span></>
            : 'Select a specimen to see its mating pairs'}
        </div>
        {specimenPairs.length > 0 && (
          <div style={styles.listScroll}>
            {specimenPairs.map((sp) => {
              const isActive = pair?.index === sp.index;
              return (
                <div
                  key={sp.index}
                  style={{
                    ...styles.listRow,
                    backgroundColor: isActive ? colors.interactive.selected : 'transparent',
                  }}
                  onClick={() => onSelectPair({
                    index: sp.index,
                    parentA: sp.parentA,
                    parentB: sp.parentB,
                    crossoverPoint: sp.crossoverPoint,
                    childA: sp.childA,
                    childB: sp.childB,
                  })}
                >
                  <span style={styles.listIdx}>#{sp.index + 1}</span>
                  <span style={styles.listPartnerLabel}>w/</span>
                  <ClickableSpecimen
                    ind={sp.partner}
                    color={sp.side === 'A' ? colors.parent.b : colors.parent.a}
                    onClick={() => onSelectSpecimen(sp.partner, makeParentOrigin(sp.side === 'A' ? 'B' : 'A'))}
                  />
                  <span style={styles.listCrossover}>@{sp.crossoverPoint}</span>
                  <span style={styles.listChildren}>
                    → f:{sp.childA.fitness},{sp.childB.fitness}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

// ── Shared sub-components ──

const Field: React.FC<{
  label: string;
  help?: string;
  children: React.ReactNode;
}> = ({ label, help, children }) => (
  <div style={styles.field} data-help={help}>
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
    onClick={(e) => { e.stopPropagation(); onClick(); }}
    title={`#${formatId(ind)} [${ind.solution.join(',')}] f:${ind.fitness}`}
  >
    <span style={{ color }}>#{formatId(ind)}</span>
    <span style={styles.chipFit}>f:{ind.fitness}</span>
  </span>
);

// ── Styles ──

const styles: Record<string, React.CSSProperties> = {
  panel: {
    backgroundColor: colors.bg.surface,
    borderRadius: 8,
    padding: 16,
    border: `1px solid ${colors.border.subtle}`,
    fontFamily: 'monospace',
    fontSize: 11,
    marginTop: 12,
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
  val: {
    color: colors.text.secondary,
  },
  mutation: {
    color: colors.accent.red,
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
  // ── Scrollable pair list ──
  listSection: {
    marginTop: 12,
    borderTop: `1px solid ${colors.border.subtle}`,
    paddingTop: 8,
  },
  listHeader: {
    fontSize: 10,
    color: colors.text.tertiary,
    marginBottom: 4,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  listCount: {
    color: colors.text.disabled,
  },
  listScroll: {
    maxHeight: 160,
    overflowY: 'auto' as const,
    overflowX: 'hidden' as const,
  },
  listRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '3px 4px',
    borderRadius: 3,
    cursor: 'pointer',
  },
  listIdx: {
    color: colors.text.tertiary,
    fontSize: 10,
    minWidth: 24,
    flexShrink: 0,
  },
  listPartnerLabel: {
    color: colors.text.disabled,
    fontSize: 9,
    flexShrink: 0,
  },
  listCrossover: {
    color: colors.accent.teal,
    fontSize: 9,
    flexShrink: 0,
  },
  listChildren: {
    color: colors.accent.gold,
    fontSize: 9,
    flexShrink: 0,
    marginLeft: 'auto',
  },
};
