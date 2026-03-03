import { Router } from 'express';
import crypto from 'crypto';

/**
 * Creates the /api routes for managing genetic algorithm runs.
 *
 * Public routes:
 *   GET /api/presets - curated preset configurations
 *
 * Owner-only routes:
 *   GET    /api/runs              - list all runs
 *   POST   /api/runs              - create a new run
 *   GET    /api/runs/:id          - get a run with full data
 *   PATCH  /api/runs/:id/generations - append generation summaries
 *   DELETE /api/runs/:id          - delete a run
 */
export function createRunRoutes({ container, requireAuth, requireOwner }) {
  const router = Router();

  // ── Curated presets (public) ──────────────────────────────────────────
  const PRESETS = [
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

  router.get('/api/presets', (req, res) => {
    res.json(PRESETS);
  });

  // ── Owner-only routes ─────────────────────────────────────────────────
  router.get('/api/runs', requireAuth, requireOwner, async (req, res) => {
    try {
      const userId = req.user.sub;
      const { resources } = await container.items.query({
        query: 'SELECT c.id, c.createdAt, c.status, c.config, c.summary FROM c WHERE c.userId = @userId ORDER BY c.createdAt DESC',
        parameters: [{ name: '@userId', value: userId }],
      }).fetchAll();

      res.json(resources);
    } catch (error) {
      console.error('Error listing runs:', error);
      res.status(500).json({ error: 'Failed to list runs' });
    }
  });

  router.post('/api/runs', requireAuth, requireOwner, async (req, res) => {
    try {
      const userId = req.user.sub;
      const { config } = req.body;

      if (!config || typeof config !== 'object') {
        return res.status(400).json({ error: 'Request body must contain a config object' });
      }

      const run = {
        id: `run_${crypto.randomUUID()}`,
        userId,
        type: 'run',
        createdAt: new Date().toISOString(),
        status: 'running',
        config,
        summary: { totalGenerations: 0, solved: false, solutionIndividual: null },
        generations: [],
      };

      const { resource } = await container.items.create(run);
      res.status(201).json(resource);
    } catch (error) {
      console.error('Error creating run:', error);
      res.status(500).json({ error: 'Failed to create run' });
    }
  });

  router.get('/api/runs/:id', requireAuth, requireOwner, async (req, res) => {
    try {
      const userId = req.user.sub;
      const { resource } = await container.item(req.params.id, userId).read();

      if (!resource) {
        return res.status(404).json({ error: 'Run not found' });
      }

      res.json(resource);
    } catch (error) {
      if (error.code === 404) {
        return res.status(404).json({ error: 'Run not found' });
      }
      console.error('Error fetching run:', error);
      res.status(500).json({ error: 'Failed to fetch run' });
    }
  });

  router.patch('/api/runs/:id/generations', requireAuth, requireOwner, async (req, res) => {
    try {
      const userId = req.user.sub;
      const { generations, summary } = req.body;

      if (!Array.isArray(generations)) {
        return res.status(400).json({ error: 'Request body must contain a generations array' });
      }

      const { resource: current } = await container.item(req.params.id, userId).read();
      if (!current) {
        return res.status(404).json({ error: 'Run not found' });
      }

      current.generations.push(...generations);
      if (summary) {
        current.summary = { ...current.summary, ...summary };
      }

      const { resource } = await container.item(req.params.id, userId).replace(current);
      res.json({ generationCount: resource.generations.length, summary: resource.summary });
    } catch (error) {
      if (error.code === 404) {
        return res.status(404).json({ error: 'Run not found' });
      }
      console.error('Error appending generations:', error);
      res.status(500).json({ error: 'Failed to append generations' });
    }
  });

  router.delete('/api/runs/:id', requireAuth, requireOwner, async (req, res) => {
    try {
      const userId = req.user.sub;
      await container.item(req.params.id, userId).delete();
      res.status(204).end();
    } catch (error) {
      if (error.code === 404) {
        return res.status(404).json({ error: 'Run not found' });
      }
      console.error('Error deleting run:', error);
      res.status(500).json({ error: 'Failed to delete run' });
    }
  });

  return router;
}
