import React from 'react';
import type { RunSummary } from '../api/client';

interface Props {
  runs: RunSummary[];
  onLoadRun: (id: string) => void;
  onDeleteRun: (id: string) => void;
  isAuthenticated: boolean;
  loading: boolean;
}

export const RunHistory: React.FC<Props> = ({
  runs,
  onLoadRun,
  onDeleteRun,
  isAuthenticated,
  loading,
}) => {
  if (!isAuthenticated) return null;

  return (
    <div style={styles.panel}>
      <h3 style={styles.title}>Run History</h3>
      {loading && <div style={styles.loading}>Loading...</div>}
      {!loading && runs.length === 0 && (
        <div style={styles.empty}>No saved runs yet</div>
      )}
      {runs.map((run) => (
        <div key={run.id} style={styles.runRow}>
          <div style={styles.runInfo}>
            <span style={styles.runDate}>
              {new Date(run.createdAt).toLocaleDateString()}
            </span>
            <span style={styles.runStatus}>{run.status}</span>
            <span style={styles.runDetail}>
              Pop: {run.config.populationSize.toLocaleString()} |
              Gen: {run.summary.totalGenerations} |
              {run.summary.solved ? ' Solved' : ' Unsolved'}
            </span>
          </div>
          <div style={styles.runActions}>
            <button
              onClick={() => onLoadRun(run.id)}
              style={styles.actionBtn}
            >
              Load
            </button>
            <button
              onClick={() => onDeleteRun(run.id)}
              style={{ ...styles.actionBtn, color: '#f44336' }}
            >
              Del
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  panel: {
    backgroundColor: '#1a1a2e',
    borderRadius: 8,
    padding: 16,
    border: '1px solid #2a2a4a',
    flex: '1 1 300px',
  },
  title: {
    margin: '0 0 10px 0',
    fontSize: 14,
    fontFamily: 'monospace',
    color: '#aaa',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  loading: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#555',
  },
  empty: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#555',
  },
  runRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '6px 0',
    borderBottom: '1px solid #2a2a4a',
  },
  runInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  runDate: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: '#888',
  },
  runStatus: {
    fontSize: 10,
    fontFamily: 'monospace',
    color: '#6c5ce7',
    textTransform: 'uppercase',
  },
  runDetail: {
    fontSize: 10,
    fontFamily: 'monospace',
    color: '#666',
  },
  runActions: {
    display: 'flex',
    gap: 4,
  },
  actionBtn: {
    padding: '3px 8px',
    fontSize: 10,
    fontFamily: 'monospace',
    backgroundColor: 'transparent',
    color: '#888',
    border: '1px solid #3a3a5a',
    borderRadius: 3,
    cursor: 'pointer',
  },
};
