import React from 'react';
import { colors } from '../colors';

export type HelpSectionId = 'problem' | 'algorithm' | 'pipeline' | 'lifecycle' | 'pools' | 'controls' | 'presets';

export const HELP_SECTIONS: Array<{ id: HelpSectionId; label: string; helpText: string }> = [
  { id: 'problem',   label: '8-Queens',     helpText: 'The eight-queens puzzle and fitness scoring' },
  { id: 'algorithm', label: 'Algorithm',    helpText: 'Genetic algorithm concepts: chromosome, population, selection, crossover, mutation' },
  { id: 'pipeline',  label: 'Pipeline Ops', helpText: 'The 7 atomic pipeline operations and the x.y.z coordinate system' },
  { id: 'lifecycle', label: 'Lifecycle',    helpText: 'Individual age lifecycle: chromosome → child → adult → elder' },
  { id: 'pools',     label: 'Pools',        helpText: 'Named population snapshots at each pipeline step' },
  { id: 'controls',  label: 'Controls',     helpText: 'How to use the tabs, playback controls, and specimen inspector' },
  { id: 'presets',   label: 'Presets',      helpText: 'Available configuration presets and their parameters' },
];

const SECTION_TITLES: Record<HelpSectionId, string> = {
  problem:   'The 8-Queens Problem',
  algorithm: 'Genetic Algorithm Overview',
  pipeline:  'Pipeline Operations',
  lifecycle: 'Individual Age Lifecycle',
  pools:     'Pools',
  controls:  'Using the Controls',
  presets:   'Configuration Presets',
};

const Term: React.FC<{ term: string; id?: string; children: React.ReactNode }> = ({ term, id, children }) => (
  <div id={id} style={styles.term}>
    <span style={styles.termKey}>{term}</span>
    <span style={styles.termVal}>{children}</span>
  </div>
);

interface Props {
  section: HelpSectionId;
}

export const HelpGlossary: React.FC<Props> = ({ section }) => (
  <div style={styles.container}>
    <div style={styles.inner}>
      <h3 style={styles.sectionTitle}>{SECTION_TITLES[section]}</h3>

      {section === 'problem' && (
        <>
          <p style={styles.para}>
            Place 8 queens on an 8×8 chessboard so that no two queens share the same row,
            column, or diagonal. There are 92 distinct solutions.
          </p>
          <Term term="Attacking Queens" id="glossary-attacking-queens">
            Two queens attack each other if they share a row, column, or diagonal. The goal is zero attacks (fitness = 28).
          </Term>
          <p style={styles.para}>
            Fitness is measured as the number of non-attacking queen pairs out of a possible
            28 (C(8,2)). A perfect solution has fitness 28.
          </p>
          <p style={styles.para}>
            The chromosome encodes column positions: <code style={styles.code}>[r0, r1, r2, r3, r4, r5, r6, r7]</code> where
            index = column and value = row (0–7). This guarantees one queen per column.
          </p>
        </>
      )}

      {section === 'algorithm' && (
        <>
          <p style={styles.para}>
            A genetic algorithm evolves a population of candidate solutions over many
            generations using selection, crossover, and mutation.
          </p>
          <Term term="Chromosome" id="glossary-chromosome">An array of 8 integers encoding queen positions: index = column, value = row. One chromosome = one candidate solution.</Term>
          <Term term="Population" id="glossary-population">A set of individuals (candidate solutions). Default size: 100 (Quick Demo) or 10,000 (Standard).</Term>
          <Term term="Individual" id="glossary-individual">A single candidate solution — an array of 8 integers representing queen positions.</Term>
          <Term term="Fitness" id="glossary-fitness">Score from 0–28 counting non-attacking queen pairs. Higher = better. Target = 28.</Term>
          <Term term="Selection" id="glossary-selection">Fitness-proportionate roulette wheel: individuals with higher fitness are more likely to breed.</Term>
          <Term term="Crossover" id="glossary-crossover">Two parents exchange genetic material at a random cut point to produce two children.</Term>
          <Term term="Mutation" id="glossary-mutation">A child's random gene is replaced with a random value at a configured probability.</Term>
          <Term term="Generation" id="glossary-generation">One full cycle: age → prune → select → crossover → mutate → birth.</Term>
        </>
      )}

      {section === 'pipeline' && (
        <>
          <p style={styles.para}>
            Each generation runs 7 atomic operations. Your position in the pipeline is tracked
            as a coordinate <code style={styles.code}>x.y.z</code>: generation · operation · phase.
          </p>
          <p style={styles.para}>
            Phase <code style={styles.code}>z</code> is 0 (before), t (transform), or 1 (after).
            This gives 21 addressable steps per generation.
          </p>
          <div style={styles.opTable}>
            {[
              { y: 0, name: 'Age individuals',       cat: 'Aging',     desc: 'All individuals advance one age step: chromosomes become children, children become adults, adults become elders.' },
              { y: 1, name: 'Remove elders',          cat: 'Pruning',   desc: 'Elders (age 3) are removed from the population.' },
              { y: 2, name: 'Select breeding pairs',  cat: 'Selection', desc: 'Roulette wheel selection picks pairs proportional to fitness using a 10,000-slot wheel.' },
              { y: 3, name: 'Mark pairs as mated',    cat: 'Crossover', desc: 'Selected individuals are assigned roles A and B for the upcoming crossover.' },
              { y: 4, name: 'Generate chromosomes',   cat: 'Crossover', desc: 'Single-point crossover at a random position within the configured range produces 2 offspring per pair.' },
              { y: 5, name: 'Apply mutations',        cat: 'Mutation',  desc: 'Each child has a per-individual chance of having one random gene replaced with a random value.' },
              { y: 6, name: 'Realize children',       cat: 'Birth',     desc: 'Fitness is evaluated for each chromosome; they become full individuals (age 1 = child).' },
            ].map(op => (
              <div key={op.y} style={styles.opRow}>
                <span style={styles.opY}>{op.y}</span>
                <span style={{ ...styles.opCat, color: (colors.category as Record<string, string>)[op.cat.toLowerCase()] ?? colors.text.secondary }}>{op.cat}</span>
                <span style={styles.opName}>{op.name}</span>
                <span style={styles.opDesc}>{op.desc}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {section === 'lifecycle' && (
        <>
          <p style={styles.para}>
            Every individual has an age (0–3) that advances each generation.
          </p>
          <Term term="0 — Chromosome" id="glossary-age-lifecycle">Freshly created via crossover; not yet a full individual. Awaiting fitness evaluation.</Term>
          <Term term="1 — Child">Realized individual (fitness evaluated). Born this generation.</Term>
          <Term term="2 — Adult">Survived one generation. Eligible for selection as a breeding parent.</Term>
          <Term term="3 — Elder">Survived two generations. Removed at the start of the next Pruning step.</Term>
        </>
      )}

      {section === 'pools' && (
        <>
          <p style={styles.para}>
            Pools are named snapshots of which individuals exist at each step in the pipeline.
          </p>
          <Term term="Old Parents">All individuals entering the generation (age 1–3 from previous gen).</Term>
          <Term term="Previous Children">Children from the prior generation who aged into this one.</Term>
          <Term term="Eligible Adults" id="glossary-eligible-parents">Adults (age 2) remaining after elders are pruned.</Term>
          <Term term="Elders">Individuals aged 3, about to be removed.</Term>
          <Term term="Selected Pairs" id="glossary-actual-parents">Individuals chosen by the roulette wheel for breeding.</Term>
          <Term term="Unselected">Adults not chosen for breeding; persist through the pipeline aging naturally.</Term>
          <Term term="Mated Parents">Selected individuals assigned breeding roles A or B.</Term>
          <Term term="Chromosomes">Raw offspring from crossover, pre-fitness-evaluation.</Term>
          <Term term="Children">Offspring after fitness evaluation; now full individuals (age 1).</Term>
        </>
      )}

      {section === 'controls' && (
        <>
          <Term term="Full Step tab">Runs complete generations. Shows pipeline summary, board, config, and chart side by side.</Term>
          <Term term="Granular Step tab">Steps through each of the 7 operations, showing Before / Transform / After for each.</Term>
          <Term term="Step (⏭)">Advance one step — full generation in Full mode, one phase in Granular mode.</Term>
          <Term term="Play (▶)">Auto-run full generations continuously at the configured speed.</Term>
          <Term term="Back (⏮)">Undo the last step (up to 50 steps of history).</Term>
          <Term term="Reset (⏮⏮)">Return to configuration phase.</Term>
          <Term term="Speed slider">Controls delay between auto-play generations. Max removes all delay.</Term>
          <Term term="Specimen tab">Click any individual in Granular Step to inspect their genome, parentage, and mutation history.</Term>
          <Term term="Pipeline bar">The coloured progress strip in the header. Click any segment to jump to that operation in Granular Step.</Term>
        </>
      )}

      {section === 'presets' && (
        <>
          <Term term="Quick Demo">100 individuals — fast to solve, good for exploring the UI.</Term>
          <Term term="Standard">10,000 individuals — realistic run, typically solves in tens of generations.</Term>
          <Term term="High Mutation">10,000 individuals, 50% mutation rate — more exploration, slower convergence.</Term>
          <Term term="Small Population">500 individuals, narrower crossover range — moderate speed and diversity.</Term>
        </>
      )}
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles: Record<string, React.CSSProperties> = {
  container: {
    flex: 1,
    overflowY: 'auto',
    padding: '20px 0',
  },
  inner: {
    maxWidth: 800,
    fontFamily: 'monospace',
  },
  sectionTitle: {
    margin: '0 0 16px 0',
    fontSize: 14,
    color: colors.text.primary,
    fontFamily: 'monospace',
    fontWeight: 'bold',
    letterSpacing: -0.3,
    borderBottom: `1px solid ${colors.border.subtle}`,
    paddingBottom: 10,
  },
  para: {
    fontSize: 12,
    color: colors.text.secondary,
    lineHeight: '1.7',
    margin: '0 0 10px 0',
  },
  term: {
    display: 'flex',
    gap: 12,
    padding: '5px 0',
    borderBottom: `1px solid ${colors.border.subtle}`,
    fontSize: 12,
  },
  termKey: {
    color: colors.accent.purple,
    fontWeight: 'bold',
    whiteSpace: 'nowrap' as const,
    minWidth: 160,
    flexShrink: 0,
  },
  termVal: {
    color: colors.text.secondary,
    lineHeight: '1.5',
  },
  code: {
    backgroundColor: colors.bg.overlay,
    color: colors.accent.blue,
    padding: '1px 5px',
    borderRadius: 3,
    fontSize: 11,
    fontFamily: 'monospace',
  },
  opTable: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 4,
    marginTop: 8,
  },
  opRow: {
    display: 'grid',
    gridTemplateColumns: '20px 90px 160px 1fr',
    gap: 10,
    padding: '5px 8px',
    backgroundColor: colors.bg.raised,
    borderRadius: 4,
    fontSize: 11,
    alignItems: 'start',
  },
  opY: {
    color: colors.text.disabled,
    fontWeight: 'bold',
    paddingTop: 1,
  },
  opCat: {
    fontWeight: 'bold',
    textTransform: 'uppercase' as const,
    fontSize: 9,
    letterSpacing: 0.5,
    paddingTop: 2,
  },
  opName: {
    color: colors.text.primary,
  },
  opDesc: {
    color: colors.text.tertiary,
    lineHeight: '1.5',
  },
};
