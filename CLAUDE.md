# eight-queens

Ported from C# genetic algorithm app to web (Vite + React + TypeScript).
Original C# code is in d:\repos\Genetic-algorithm-8queens.

## Architecture

- Genetic algorithm: 10K population, fitness-proportionate roulette selection, single-point crossover
- Max fitness = 28 (C(8,2) non-attacking pairs), solution = fitness 28
- Frontend-only static app, hosted at queens.romaine.life (Azure Static Web App)
- Presets defined in frontend/src/data/presets.ts
