import { useState, useEffect, useCallback, useRef } from 'react';
import { api, Preset, RunSummary, RunDetail } from '../api/client';
import type { GenerationSummary } from '../engine/types';

interface AuthUser {
  email: string;
  name: string;
  credential: string;
}

export function useApi(user: AuthUser | null) {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const syncBufferRef = useRef<GenerationSummary[]>([]);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load presets on mount
  useEffect(() => {
    api.getPresets().then(setPresets).catch(() => {});
  }, []);

  // Load runs when user signs in
  useEffect(() => {
    if (!user) {
      setRuns([]);
      return;
    }
    setLoading(true);
    api.listRuns()
      .then(setRuns)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  const createRun = useCallback(async (config: Preset['config']): Promise<string | null> => {
    try {
      const run = await api.createRun(config);
      setRuns((prev) => [run, ...prev]);
      return run.id;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create run');
      return null;
    }
  }, []);

  const syncGenerations = useCallback(
    async (runId: string, generations: GenerationSummary[]) => {
      syncBufferRef.current.push(...generations);

      // Flush every 20 generations or after 5 seconds
      const shouldFlush = syncBufferRef.current.length >= 20;

      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);

      const flush = async () => {
        const toSend = syncBufferRef.current;
        if (toSend.length === 0) return;

        syncBufferRef.current = [];
        try {
          await api.appendGenerations(runId, toSend);
        } catch {
          // Re-buffer on failure
          syncBufferRef.current.unshift(...toSend);
        }
      };

      if (shouldFlush) {
        await flush();
      } else {
        syncTimerRef.current = setTimeout(flush, 5000);
      }
    },
    [],
  );

  const loadRun = useCallback(async (runId: string): Promise<RunDetail | null> => {
    try {
      return await api.getRun(runId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load run');
      return null;
    }
  }, []);

  const deleteRun = useCallback(async (runId: string) => {
    try {
      await api.deleteRun(runId);
      setRuns((prev) => prev.filter((r) => r.id !== runId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete run');
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return {
    presets,
    runs,
    loading,
    error,
    createRun,
    syncGenerations,
    loadRun,
    deleteRun,
    clearError,
  };
}
