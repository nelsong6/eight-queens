import type { OpDefinition, TimeCoordinate, PoolOrigin, PoolName } from './types';
import type { CategoryKey } from '../components/BreedingListboxes';

/** Total number of atomic operations per generation. */
export const OPS_PER_GENERATION = 7;

/** The ordered list of atomic operations within a single generation. */
export const GENERATION_OPS: OpDefinition[] = [
  { index: 0, name: 'Age individuals',       type: 'transform', category: 'Aging' },
  { index: 1, name: 'Remove elders',        type: 'remove',    category: 'Pruning' },
  { index: 2, name: 'Select breeding pairs', type: 'transform', category: 'Selection' },
  { index: 3, name: 'Mark pairs as mated',   type: 'transform', category: 'Crossover' },
  { index: 4, name: 'Generate chromosomes',  type: 'add',       category: 'Crossover' },
  { index: 5, name: 'Apply mutations',       type: 'transform', category: 'Mutation' },
  { index: 6, name: 'Realize children',      type: 'transform', category: 'Birth' },
];

/** Get the operation definition for a given y-axis index. */
export function getOp(y: number): OpDefinition {
  return GENERATION_OPS[y]!;
}

/** Number of screens per operation (before, transform, after). */
export const SCREENS_PER_OP = 3;

/** Total screens per generation. */
export const SCREENS_PER_GENERATION = OPS_PER_GENERATION * SCREENS_PER_OP;

/** Format a TimeCoordinate as "x.y.t". */
export function formatCoordinate(tc: TimeCoordinate): string {
  const boundaryLabel = tc.boundary === 0 ? '0' : tc.boundary === 1 ? 't' : '1';
  return `${tc.generation}.${tc.operation}.${boundaryLabel}`;
}

/** Human-readable label for a coordinate, e.g. "Selection — Select breeding pairs (before)". */
export function coordinateLabel(tc: TimeCoordinate): string {
  const op = getOp(tc.operation);
  const phaseLabel = tc.boundary === 0 ? 'before' : tc.boundary === 1 ? 'transform' : 'after';
  return `${op.category} — ${op.name} (${phaseLabel})`;
}

/** Human-readable label for a pool name. */
const POOL_DISPLAY_NAMES: Record<PoolName, string> = {
  oldParents: 'Old Parents',
  previousChildren: 'Previous Children',
  eligibleAdults: 'Eligible Adults',
  retiredParents: 'Elders',
  selectedPairs: 'Selected Pairs',
  unselected: 'Unselected',
  matedParents: 'Mated Parents',
  chromosomes: 'Chromosomes',
  finalChildren: 'Children',
};

/** Human-readable display name for a PoolOrigin. */
export function poolDisplayName(origin: PoolOrigin): string {
  const base = POOL_DISPLAY_NAMES[origin.pool];
  return origin.qualifier ? `${base} ${origin.qualifier}` : base;
}

/** Map a BreedingListboxes CategoryKey to the corresponding PoolOrigin. */
export function categoryToOrigin(category: CategoryKey, generation: number): PoolOrigin {
  switch (category) {
    case 'Eligible parents':
      return {
        coordinate: { generation, operation: 2, boundary: 0 },
        pool: 'eligibleAdults',
      };
    case 'Actual parents':
      return {
        coordinate: { generation, operation: 2, boundary: 1 },
        pool: 'selectedPairs',
      };
    case 'Children':
      return {
        coordinate: { generation, operation: 6, boundary: 1 },
        pool: 'finalChildren',
      };
    case 'Mutations':
      return {
        coordinate: { generation, operation: 5, boundary: 1 },
        pool: 'chromosomes',
      };
  }
}

/**
 * Returns which named pools are present at a given coordinate.
 * Used by the walkthrough UI to populate the browsable dropdown.
 */
export function getPoolsAtCoordinate(tc: TimeCoordinate): PoolName[] {
  const { operation: y, boundary: z } = tc;

  // Transform pages (z=1) show input pools — the visualization handles the rest
  // y=0 Age individuals: children→adults, adults→elders
  if (y === 0 && z === 0) return ['oldParents', 'previousChildren'];
  if (y === 0 && z === 1) return ['oldParents', 'previousChildren'];
  if (y === 0 && z === 2) return ['eligibleAdults', 'retiredParents'];

  // y=1 Remove elders: remove
  if (y === 1 && z === 0) return ['eligibleAdults', 'retiredParents'];
  if (y === 1 && z === 1) return ['eligibleAdults', 'retiredParents'];
  if (y === 1 && z === 2) return ['eligibleAdults'];

  // y=2 Select breeding pairs: transform
  if (y === 2 && z === 0) return ['eligibleAdults'];
  if (y === 2 && z === 1) return ['eligibleAdults'];
  if (y === 2 && z === 2) return ['selectedPairs', 'unselected'];

  // y=3 Mark pairs as mated: transform (unselected persist alongside)
  if (y === 3 && z === 0) return ['selectedPairs', 'unselected'];
  if (y === 3 && z === 1) return ['selectedPairs', 'unselected'];
  if (y === 3 && z === 2) return ['matedParents', 'unselected'];

  // y=4 Generate chromosomes: add (unselected persist alongside)
  if (y === 4 && z === 0) return ['matedParents', 'unselected'];
  if (y === 4 && z === 1) return ['matedParents', 'unselected'];
  if (y === 4 && z === 2) return ['matedParents', 'unselected', 'chromosomes'];

  // y=5 Apply mutations: transform
  if (y === 5 && z === 0) return ['chromosomes', 'matedParents', 'unselected'];
  if (y === 5 && z === 1) return ['chromosomes', 'matedParents', 'unselected'];
  if (y === 5 && z === 2) return ['chromosomes', 'matedParents', 'unselected'];

  // y=6 Realize children: transform
  if (y === 6 && z === 0) return ['chromosomes', 'matedParents', 'unselected'];
  if (y === 6 && z === 1) return ['chromosomes', 'matedParents', 'unselected'];
  if (y === 6 && z === 2) return ['finalChildren', 'matedParents', 'unselected'];

  return [];
}

/** Description of what each operation's transform does, for the transform screen. */
const TRANSFORM_DESCRIPTIONS: Record<number, { title: string; description: string; detail: string }> = {
  0: {
    title: 'Aging Individuals',
    description: 'Increment all individuals\' age by 1.',
    detail: 'Every individual in the population has its age incremented by 1.\n\nAge lifecycle: 0 (chromosome) → 1 (child) → 2 (adult) → 3 (elder → removed).',
  },
  1: {
    title: 'Retiring Old Parents',
    description: 'Retired parents are removed from the population.',
    detail: 'Only the promoted adults (former children) remain as the eligible breeding pool. This prevents individuals from persisting across multiple generations.',
  },
  2: {
    title: 'Selecting Breeding Pairs',
    description: 'Fitness-proportionate roulette wheel selects parents for reproduction.',
    detail: 'A 10,000-slot roulette wheel is filled proportionally to fitness scores. Pairs are drawn by spinning twice. Higher-fitness individuals are more likely to be selected, but any eligible adult can be chosen. Unselected adults persist alongside selected pairs and are naturally removed through aging.',
  },
  3: {
    title: 'Marking Pairs as Mated',
    description: 'Selected pairs are formally assigned as breeding partners.',
    detail: 'Each pair (A, B) is locked in for crossover. The pair ordering determines which parent contributes the left vs. right portion of the child chromosome.',
  },
  4: {
    title: 'Generating Chromosomes',
    description: 'Single-point crossover creates two child chromosomes per pair.',
    detail: 'A random crossover point is chosen within the configured range. Child A gets genes [0..point] from parent A and [point+1..7] from parent B. Child B gets the inverse. Each pair produces exactly two offspring.',
  },
  5: {
    title: 'Applying Mutations',
    description: 'Random gene mutations are applied based on the mutation rate.',
    detail: 'Each child has an independent probability of mutation (configured rate). If selected, one random gene position is replaced with a random value [0-7]. Mutations introduce diversity that can escape local optima.',
  },
  6: {
    title: 'Realizing Children',
    description: 'Raw chromosomes are evaluated and become full individuals.',
    detail: 'Each chromosome is assessed for fitness (counting non-attacking queen pairs). The chromosomes become proper individuals with IDs, fitness scores, and generation metadata — ready for the next generation cycle.',
  },
};

/** Get the transform description for an operation index. */
export function getTransformDescription(operationIndex: number): { title: string; description: string; detail: string } {
  return TRANSFORM_DESCRIPTIONS[operationIndex]!;
}
