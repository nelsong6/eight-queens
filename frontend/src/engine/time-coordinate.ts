import type { OpDefinition, TimeCoordinate, PoolOrigin, PoolName, PipelineRole, GenerationPipeline, PipelineOp, BreedingPair, Specimen, GenerationResult, Age, MutationRecord } from './types';
import type { CategoryKey } from '../components/BreedingListboxes';
import { cloneSpecimen } from './specimen';

/** Total number of atomic operations per generation. */
export const OPS_PER_GENERATION = 6;

/** The ordered list of atomic operations within a single generation. */
export const GENERATION_OPS: OpDefinition[] = [
  { index: 0, name: 'Age specimens',          type: 'transform', category: 'Aging' },
  { index: 1, name: 'Remove elders',        type: 'remove',    category: 'Pruning' },
  { index: 2, name: 'Select breeding pairs', type: 'transform', category: 'Selection' },
  { index: 3, name: 'Generate chromosomes',  type: 'add',       category: 'Crossover' },
  { index: 4, name: 'Apply mutations',       type: 'transform', category: 'Mutation' },
  { index: 5, name: 'Realize children',      type: 'transform', category: 'Birth' },
];

/** Get the operation definition for a given y-axis index. */
export function getOp(y: number): OpDefinition {
  return GENERATION_OPS[y]!;
}

/** Total screens per generation (one per operation). */
export const SCREENS_PER_GENERATION = OPS_PER_GENERATION;


/** Format a TimeCoordinate as "x.y". */
export function formatCoordinate(tc: TimeCoordinate): string {
  return `${tc.generation}.${tc.operation}`;
}

/** Human-readable label for a coordinate, e.g. "Selection — Select breeding pairs". */
export function coordinateLabel(tc: TimeCoordinate): string {
  const op = getOp(tc.operation);
  return `${op.category} — ${op.name}`;
}

/** Human-readable label for a pool name. */
const POOL_DISPLAY_NAMES: Record<PoolName, string> = {
  oldParents: 'Old Parents',
  previousChildren: 'Previous Children',
  eligibleAdults: 'Eligible Adults',
  retiredParents: 'Elders',
  selectedPairs: 'Selected Pairs',
  unselected: 'Unselected',
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
        coordinate: { generation, operation: 2 },
        pool: 'eligibleAdults',
      };
    case 'Actual parents':
      return {
        coordinate: { generation, operation: 2 },
        pool: 'selectedPairs',
      };
    case 'Children':
      return {
        coordinate: { generation, operation: 5 },
        pool: 'finalChildren',
      };
    case 'Mutations':
      return {
        coordinate: { generation, operation: 4 },
        pool: 'chromosomes',
      };
    default:
      throw new Error(`Unknown category: ${category as string}`);
  }
}

// ============================================================================
// Pipeline snapshot accessors
// ============================================================================

/** Maps each PoolName to the PipelineRole that identifies membership in that pool. */
const ROLE_FOR_POOL: Record<PoolName, PipelineRole> = {
  oldParents:       'oldParent',
  previousChildren: 'previousChild',
  retiredParents:   'retiredParent',
  eligibleAdults:   'eligibleAdult',
  selectedPairs:    'selectedPair',
  unselected:       'unselected',
  chromosomes:      'chromosome',
  finalChildren:    'finalChild',
};

/**
 * Get the master-list snapshot at a given operation from the pipeline.
 * Always returns the completed (after) state — internal slot 2.
 */
export function getPipelineState(pipeline: GenerationPipeline, op: number): Specimen[] {
  return pipeline.ops[op]![2];
}

/**
 * Resolve a named pool's specimens from the pipeline at a given coordinate.
 * Filters the master-list snapshot by each specimen's pipelineRole field.
 * Returns empty array if no specimens have that role at this coordinate.
 */
export function resolvePoolFromPipeline(
  pool: PoolName,
  pipeline: GenerationPipeline,
  op: number,
): Specimen[] {
  const role = ROLE_FOR_POOL[pool];
  return getPipelineState(pipeline, op).filter(i => i.pipelineRole === role);
}

/**
 * Get the breeding pairs visible at a given coordinate (completed state).
 * Pairs follow their specimens: when parents are pruned, their pairs are removed.
 *
 * - Op 0: previous generation's completed pairs (from previousPipeline)
 * - Op 1: pairs pruned alongside elder parents → typically empty
 * - Op 2: newly created pairs from roulette wheel selection
 * - Op 3–5: current generation's pairs from transformData
 */
export function getPairsAtCoordinate(
  pipeline: GenerationPipeline,
  coordinate: TimeCoordinate,
  previousPipeline?: GenerationPipeline,
): BreedingPair[] {
  const { operation: y } = coordinate;

  // Op 0: previous generation's completed pairs persist (aging doesn't affect pairs)
  if (y === 0) {
    const prevPairs = previousPipeline?.transformData?.[3]?.pairs;
    if (!prevPairs || prevPairs.length === 0) return [];
    return prevPairs;
  }

  // Op 1: pairs pruned alongside their elder parents → filter by surviving specimen IDs
  if (y === 1) {
    const prevPairs = previousPipeline?.transformData?.[3]?.pairs;
    if (!prevPairs || prevPairs.length === 0) return [];
    const survivingIds = new Set(getPipelineState(pipeline, 1).map(s => s.id));
    return prevPairs.filter(p => survivingIds.has(p.parentA.id) && survivingIds.has(p.parentB.id));
  }

  // Op 2: newly created pairs
  if (y === 2) return pipeline.transformData?.[2]?.pairs ?? [];

  // Op 3: pairs with crossover data
  if (y === 3) return pipeline.transformData?.[3]?.pairs ?? [];

  // Ops 4-5: pairs persist from op 3 (children may be mutated/realized)
  if (y >= 4) return pipeline.transformData?.[3]?.pairs ?? [];

  return [];
}

/**
 * Returns which named pools are present at a given coordinate (completed state).
 * Used by the walkthrough UI to populate the browsable dropdown.
 */
export function getPoolsAtCoordinate(tc: TimeCoordinate): PoolName[] {
  const { operation: y } = tc;

  // y=0 Age specimens: children→adults, adults→elders
  if (y === 0) return ['eligibleAdults', 'retiredParents'];

  // y=1 Remove elders: elders removed
  if (y === 1) return ['eligibleAdults'];

  // y=2 Select breeding pairs: selected + unselected
  if (y === 2) return ['selectedPairs', 'unselected'];

  // y=3 Generate chromosomes: add chromosomes (unselected persist alongside)
  if (y === 3) return ['selectedPairs', 'unselected', 'chromosomes'];

  // y=4 Apply mutations: chromosomes may be mutated
  if (y === 4) return ['chromosomes', 'selectedPairs', 'unselected'];

  // y=5 Realize children: chromosomes promoted to children
  if (y === 5) return ['finalChildren', 'selectedPairs', 'unselected'];

  return [];
}

/** Description of what each operation's transform does, for the transform screen. */
const TRANSFORM_DESCRIPTIONS: Record<number, { title: string; description: string; detail: string; pseudoCode: string[] }> = {
  0: {
    title: 'Aging Specimens',
    description: 'Increment all specimens\' age by 1.',
    detail: 'Every specimen in the population has its age incremented by 1.\n\nAge lifecycle: 0 (chromosome) → 1 (child) → 2 (adult) → 3 (elder → removed).',
    pseudoCode: [
      'for each specimen in population:',
      '  specimen.age += 1',
    ],
  },
  1: {
    title: 'Retiring Old Parents',
    description: 'Retired parents are removed from the population.',
    detail: 'Only the promoted adults (former children) remain as the eligible breeding pool. This prevents specimens from persisting across multiple generations.',
    pseudoCode: [
      'for each specimen in population:',
      '  if specimen.age == 3:',
      '    remove(specimen)',
    ],
  },
  2: {
    title: 'Selecting Breeding Pairs',
    description: 'Fitness-proportionate roulette wheel selects parents for reproduction.',
    detail: 'A 10,000-slot array is built where each specimen gets slots proportional to its share of total fitness. For example, if a specimen has fitness 14 and the population\'s total fitness is 1,400, it receives 14/1,400 \u00d7 10,000 = 100 slots. To form a pair, two random slots are picked \u2014 the specimens occupying those slots become parents. Higher fitness \u2192 more slots \u2192 higher chance of selection, but even low-fitness specimens can be chosen.',
    pseudoCode: [
      'total = sum of all fitness scores',
      'for each specimen:',
      '  slots = fitness / total × 10,000',
      '  wheel.fill(specimen, slots)',
      'while pairs < targetCount:',
      '  parentA = wheel[randomIndex]',
      '  parentB = wheel[randomIndex]  // ≠ A',
      '  pairs.add(parentA, parentB)',
    ],
  },
  3: {
    title: 'Generating Chromosomes',
    description: 'Single-point crossover creates two child chromosomes per pair.',
    detail: 'A random crossover point is chosen within the configured range. Child A gets genes [0..point] from parent A and [point+1..7] from parent B. Child B gets the inverse. Each pair produces exactly two offspring.',
    pseudoCode: [
      'for each (parentA, parentB) in pairs:',
      '  point = random(crossMin, crossMax)',
      '  childA = parentA[0..point]',
      '        + parentB[point+1..7]',
      '  childB = parentB[0..point]',
      '        + parentA[point+1..7]',
    ],
  },
  4: {
    title: 'Applying Mutations',
    description: 'Random gene mutations are applied based on the mutation rate.',
    detail: 'Each child has an independent probability of mutation (configured rate). If selected, one random gene position is replaced with a random value [0-7]. Mutations introduce diversity that can escape local optima.',
    pseudoCode: [
      'for each specimen in population:',
      '  if age == 0:',
      '    if random() < mutationRate:',
      '      gene_position = randomIndex(0, 7)',
      '      child[gene_position] = randomValue(0, 7)',
    ],
  },
  5: {
    title: 'Realizing Children',
    description: 'Chromosomes are promoted to children by aging from 0 to 1.',
    detail: 'Each chromosome (age 0) already has its fitness score and ID from crossover. The birth step simply advances their age from 0 (chromosome) to 1 (child), making them full participants in the next generation cycle.',
    pseudoCode: [
      'for each chromosome in chromosomes:',
      '  chromosome.age = 1  // child',
    ],
  },
};

/** Get the transform description for an operation index. */
export function getTransformDescription(operationIndex: number): { title: string; description: string; detail: string; pseudoCode: string[] } {
  return TRANSFORM_DESCRIPTIONS[operationIndex]!;
}

// ============================================================================
// Lazy pipeline reconstruction
// ============================================================================

/**
 * Returns true when a GenerationResult has an empty (stub) pipeline —
 * i.e. it was produced with skipPipeline=true during full-mode autoplay.
 */
export function isPipelineEmpty(result: GenerationResult): boolean {
  return result.pipeline.ops[2]![2].length === 0;
}

/**
 * Reconstruct a full GenerationPipeline from breedingData, which is always
 * computed regardless of skipPipeline. Called lazily when an undo entry with
 * an empty pipeline needs to be navigated in micro mode.
 *
 * Ops 2–5: fully reconstructed from result.breedingData.
 * Ops 0–1: require previousResult for pre-aging pool data; left empty if unavailable.
 */
export function reconstructPipeline(
  result: GenerationResult,
  previousResult: GenerationResult | null,
): GenerationPipeline {
  const { breedingData } = result;

  // Build mutation info map (child id → record)
  const mutationMap = new Map<number, MutationRecord>();
  for (const rec of breedingData.mutationRecords) {
    mutationMap.set(rec.specimen.id, rec);
  }

  // Build partner ID map from breeding pairs
  const partnerIdMap = new Map<number, Set<number>>();
  for (let i = 0; i < breedingData.aParents.length; i++) {
    const a = breedingData.aParents[i]!;
    const b = breedingData.bParents[i]!;
    if (!partnerIdMap.has(a.id)) partnerIdMap.set(a.id, new Set());
    if (!partnerIdMap.has(b.id)) partnerIdMap.set(b.id, new Set());
    partnerIdMap.get(a.id)!.add(b.id);
    partnerIdMap.get(b.id)!.add(a.id);
  }

  // Helper: tag a cloned specimen with a role (and optional extra fields)
  const tag = (spec: Specimen, role: PipelineRole, extra?: Partial<Specimen>): Specimen => ({
    ...cloneSpecimen(spec), pipelineRole: role, ...extra,
  });

  // Transform slot (z=1) is a deep-clone of before, matching step() behavior.
  const makeOp = (before: Specimen[], after: Specimen[]): PipelineOp =>
    [before, before.map(cloneSpecimen), after];

  // Build pre-mutation chromosomes: undo mutation if it occurred, tag with parentage
  const targetCount = breedingData.allChildren.length;
  const preMutationChromosomes: Specimen[] = [];
  let count = 0;
  for (let i = 0; i < breedingData.aChildren.length && count < targetCount; i++) {
    const aChild = breedingData.aChildren[i]!;
    const aRec = mutationMap.get(aChild.id);
    preMutationChromosomes.push(tag(
      aRec ? { ...aChild, solution: [...aRec.preMutationSolution], fitness: aRec.preMutationFitness } : aChild,
      'chromosome',
      { parentAId: breedingData.aParents[i]?.id, parentBId: breedingData.bParents[i]?.id, crossoverPoint: breedingData.crossoverPoints[i] },
    ));
    count++;

    if (count < targetCount && i < breedingData.bChildren.length) {
      const bChild = breedingData.bChildren[i]!;
      const bRec = mutationMap.get(bChild.id);
      preMutationChromosomes.push(tag(
        bRec ? { ...bChild, solution: [...bRec.preMutationSolution], fitness: bRec.preMutationFitness } : bChild,
        'chromosome',
        { parentAId: breedingData.aParents[i]?.id, parentBId: breedingData.bParents[i]?.id, crossoverPoint: breedingData.crossoverPoints[i] },
      ));
      count++;
    }
  }

  // Post-mutation chromosomes: tag with parentage and mutation info
  const postMutChromosomes = breedingData.allChildren.map(child => {
    const rec = mutationMap.get(child.id);
    return tag(child, 'chromosome', {
      mutated: rec ? true : undefined,
      preMutationSolution: rec ? [...rec.preMutationSolution] : undefined,
    });
  });

  // Derived pools tagged with roles
  const eligibleAdults = breedingData.eligibleParents.map(p => tag(p, 'eligibleAdult'));
  const selectedIds = new Set(breedingData.actualParents.map(p => p.id));
  const unselected = eligibleAdults.filter(p => !selectedIds.has(p.id)).map(p => tag(p, 'unselected'));
  const selectedPairs = breedingData.actualParents.map(p => tag(p, 'selectedPair', {
    partnerIds: [...(partnerIdMap.get(p.id) ?? new Set())],
  }));
  const finalChildren = breedingData.allChildren.map(child => {
    const rec = mutationMap.get(child.id);
    return tag(child, 'finalChild', {
      mutated: rec ? true : undefined,
      preMutationSolution: rec ? [...rec.preMutationSolution] : undefined,
    });
  });

  // Ops 0–1: pre-aging pools, require previousResult
  let op0: PipelineOp = [[], [], []];
  let op1: PipelineOp = [[], [], []];
  if (previousResult) {
    const oldParents = previousResult.breedingData.eligibleParents.map(p => tag(p, 'oldParent'));
    const prevChildren = previousResult.breedingData.allChildren.map(c => tag(c, 'previousChild'));
    const retiredParents = previousResult.breedingData.eligibleParents.map(p =>
      tag(p, 'retiredParent', { age: 3 as Age })
    );
    op0 = makeOp(
      [...oldParents, ...prevChildren],
      [...retiredParents, ...eligibleAdults],
    );
    op1 = makeOp(
      [...retiredParents, ...eligibleAdults],
      eligibleAdults,
    );
  }

  // Build breeding pairs for transform data (ops 2-3)
  const buildReconstructedPairs = (
    role: PipelineRole,
    withPartners: boolean,
    withCrossover: boolean,
  ): BreedingPair[] => {
    const pairs: BreedingPair[] = [];
    for (let i = 0; i < breedingData.aParents.length; i++) {
      const pA = tag(breedingData.aParents[i]!, role,
        withPartners ? { partnerIds: [...(partnerIdMap.get(breedingData.aParents[i]!.id) ?? new Set())] } : undefined);
      const pB = tag(breedingData.bParents[i]!, role,
        withPartners ? { partnerIds: [...(partnerIdMap.get(breedingData.bParents[i]!.id) ?? new Set())] } : undefined);
      const pair: BreedingPair = { index: i, parentA: pA, parentB: pB };
      if (withCrossover) {
        pair.crossoverPoint = breedingData.crossoverPoints[i];
        pair.childA = preMutationChromosomes[i * 2];
        pair.childB = preMutationChromosomes[i * 2 + 1];
      }
      pairs.push(pair);
    }
    return pairs;
  };

  return {
    ops: [
      op0,
      op1,
      makeOp(eligibleAdults, [...selectedPairs, ...unselected]),
      makeOp([...selectedPairs, ...unselected], [...selectedPairs, ...unselected, ...preMutationChromosomes]),
      makeOp([...selectedPairs, ...unselected, ...preMutationChromosomes], [...selectedPairs, ...unselected, ...postMutChromosomes]),
      makeOp([...selectedPairs, ...unselected, ...postMutChromosomes], [...selectedPairs, ...unselected, ...finalChildren]),
    ],
    transformData: {
      2: { pairs: buildReconstructedPairs('selectedPair', true, false) },
      3: { pairs: buildReconstructedPairs('selectedPair', true, true) },
    },
  };
}
