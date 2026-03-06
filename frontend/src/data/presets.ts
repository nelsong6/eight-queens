export interface Preset {
  id: string;
  name: string;
  description: string;
  config: {
    populationSize: number;
    crossoverRange: [number, number];
    mutationRate: number;
  };
}

export const PRESETS: Preset[] = [
  {
    id: 'quick-demo',
    name: 'Quick Demo',
    description: 'Small population for a fast visual demo',
    config: { populationSize: 100, crossoverRange: [1, 6], mutationRate: 0.25 },
  },
  {
    id: 'standard',
    name: 'Standard',
    description: 'Classic parameters matching the original C# app',
    config: { populationSize: 10000, crossoverRange: [1, 6], mutationRate: 0.25 },
  },
  {
    id: 'high-mutation',
    name: 'High Mutation',
    description: 'Aggressive mutation for faster exploration',
    config: { populationSize: 10000, crossoverRange: [1, 6], mutationRate: 0.50 },
  },
  {
    id: 'small-population',
    name: 'Small Population',
    description: 'Fewer individuals to see how it affects convergence',
    config: { populationSize: 500, crossoverRange: [2, 5], mutationRate: 0.25 },
  },
];
