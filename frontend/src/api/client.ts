const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `HTTP ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

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

export interface RunSummary {
  id: string;
  createdAt: string;
  status: string;
  config: Preset['config'];
  summary: { totalGenerations: number; solved: boolean; solutionIndividual: number[] | null };
}

export interface RunDetail extends RunSummary {
  generations: Array<{
    generationNumber: number;
    bestFitness: number;
    avgFitness: number;
    bestIndividual: number[];
    mutationCount: number;
  }>;
}

export const api = {
  getPresets: () => request<Preset[]>('/api/presets'),

  listRuns: () => request<RunSummary[]>('/api/runs'),

  createRun: (config: Preset['config']) =>
    request<RunDetail>('/api/runs', {
      method: 'POST',
      body: JSON.stringify({ config }),
    }),

  getRun: (id: string) => request<RunDetail>(`/api/runs/${id}`),

  appendGenerations: (
    id: string,
    generations: RunDetail['generations'],
    summary?: Partial<RunDetail['summary']>,
  ) =>
    request<{ generationCount: number; summary: RunDetail['summary'] }>(
      `/api/runs/${id}/generations`,
      { method: 'PATCH', body: JSON.stringify({ generations, summary }) },
    ),

  deleteRun: (id: string) =>
    request<void>(`/api/runs/${id}`, { method: 'DELETE' }),
};
