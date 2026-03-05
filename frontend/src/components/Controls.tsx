import React, { useState } from 'react';

type SessionPhase = 'config' | 'running' | 'review';

interface Props {
  sessionPhase: SessionPhase;
  isRunning: boolean;
  onPlay: () => void;
  onPause: () => void;
  onStep: () => void;
  onStepN: (count: number) => void;
  onNewSession: () => void;
  speed: number;
  onSpeedChange: (speed: number) => void;
  solved: boolean;
  walkthroughPhase: number | null;
  granularity: 'full' | 'micro';
  onGranularityChange: (g: 'full' | 'micro') => void;
}

const STEP_PRESETS = [1, 2, 5, 10, 25, 50, 100, 1000];

export const Controls: React.FC<Props> = ({
  sessionPhase,
  isRunning,
  onPlay,
  onPause,
  onStep,
  onStepN,
  onNewSession,
  speed,
  onSpeedChange,
  solved,
  walkthroughPhase,
  granularity,
  onGranularityChange,
}) => {
  const [stepCount, setStepCount] = useState('1');

  const canAct = !isRunning && !solved;
  const isWalking = walkthroughPhase !== null;

  return (
    <div style={styles.bar}>
      {/* Granularity toggle */}
      <div style={styles.group}>
        <button
          onClick={() => onGranularityChange('full')}
          disabled={solved}
          data-help="Run complete generations without showing intermediate phases"
          style={{
            ...styles.granularityBtn,
            ...(granularity === 'full' ? styles.granularityBtnActive : styles.granularityBtnInactive),
            opacity: solved ? 0.5 : 1,
          }}
        >
          Full
        </button>
        <button
          onClick={() => onGranularityChange('micro')}
          disabled={solved}
          data-help="Show each algorithm phase (selection, crossover, mutation) separately"
          style={{
            ...styles.granularityBtn,
            ...(granularity === 'micro' ? styles.granularityBtnActive : styles.granularityBtnInactive),
            opacity: solved ? 0.5 : 1,
          }}
        >
          Micro
        </button>
      </div>

      <div style={styles.divider} />

      {/* Playback */}
      <div style={styles.group}>
        {isRunning ? (
          <button onClick={onPause} className="btn" data-help="Pause auto-run" style={styles.btn}>
            ⏸
          </button>
        ) : (
          <button
            onClick={onPlay}
            className="btn"
            disabled={!canAct}
            data-help="Continuously run full generations automatically"
            style={{ ...styles.btn, opacity: !canAct ? 0.5 : 1 }}
          >
            ▶
          </button>
        )}
      </div>

      <div style={styles.divider} />

      {/* Step controls — split button */}
      <div style={styles.splitGroup} data-help={isWalking ? 'Advance to the next walkthrough phase' : 'Advance by N generations — pick a preset or type a custom number'}>
        <input
          list="step-presets"
          value={stepCount}
          onChange={(e) => setStepCount(e.target.value)}
          disabled={solved || isWalking}
          style={{ ...styles.splitInput, opacity: solved || isWalking ? 0.5 : 1 }}
        />
        <datalist id="step-presets">
          {STEP_PRESETS.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
        <button
          onClick={() => {
            if (isWalking) { onStep(); return; }
            const n = parseInt(stepCount, 10);
            if (n === 1) onStep();
            else if (n > 1) onStepN(n);
          }}
          className="btn"
          disabled={isWalking ? false : (!canAct || !stepCount || !/^\d+$/.test(stepCount) || parseInt(stepCount, 10) < 1)}
          style={{
            ...styles.splitBtn,
            opacity: (!canAct && !isWalking) ? 0.5 : 1,
            backgroundColor: isWalking ? '#4a3a8a' : '#2a2a4a',
          }}
        >
          {isWalking ? `⏭ ${walkthroughPhase! + 1}/4` : '⏭'}
        </button>
      </div>

      {/* Speed slider */}
      <label style={styles.speedLabel} data-help="Controls delay between generations — higher is faster, 'Max' removes all delay">
        <span style={styles.speedText}>{speed >= 500 ? 'Max' : speed}</span>
        <input
          type="range"
          min={1}
          max={500}
          value={speed}
          onChange={(e) => onSpeedChange(Number(e.target.value))}
          disabled={solved}
          style={{ ...styles.slider, opacity: solved ? 0.5 : 1 }}
        />
      </label>

      {sessionPhase === 'review' && (
        <>
          <div style={styles.divider} />
          <button onClick={onNewSession} className="btn" data-help="Reset and return to configuration" style={styles.newSessionBtn}>
            New Session
          </button>
        </>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  bar: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 24px',
    backgroundColor: '#12122a',
    borderBottom: '1px solid #2a2a4a',
  },
  group: {
    display: 'flex',
    alignItems: 'center',
    gap: 3,
  },
  divider: {
    width: 1,
    height: 18,
    backgroundColor: '#2a2a4a',
    flexShrink: 0,
  },
  btn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    padding: '4px 0',
    fontSize: 11,
    fontFamily: 'monospace',
    backgroundColor: '#2a2a4a',
    color: '#e0e0e0',
    border: '1px solid #3a3a5a',
    borderRadius: 4,
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
    lineHeight: 1,
  },
  newSessionBtn: {
    padding: '4px 12px',
    fontSize: 11,
    fontFamily: 'monospace',
    fontWeight: 'bold',
    backgroundColor: '#6c5ce7',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
  },
  speedLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    fontSize: 10,
    fontFamily: 'monospace',
    color: '#aaa',
  },
  speedText: {
    fontSize: 10,
    minWidth: 24,
    textAlign: 'right' as const,
  },
  slider: {
    width: 80,
    accentColor: '#6c5ce7',
  },
  granularityBtn: {
    padding: '3px 8px',
    fontSize: 10,
    fontFamily: 'monospace',
    borderRadius: 3,
    cursor: 'pointer',
    textAlign: 'center' as const,
    transition: 'all 0.15s ease',
    whiteSpace: 'nowrap' as const,
  },
  granularityBtnActive: {
    backgroundColor: '#6c5ce7',
    color: '#fff',
    border: '1px solid #8b7cf0',
    fontWeight: 'bold' as const,
    boxShadow: '0 0 6px rgba(108, 92, 231, 0.4)',
  },
  granularityBtnInactive: {
    backgroundColor: '#1a1a2e',
    color: '#777',
    border: '1px solid #2a2a4a',
  },
  splitGroup: {
    display: 'flex',
    alignItems: 'stretch',
    border: '1px solid #3a3a5a',
    borderRadius: 4,
    overflow: 'hidden',
  },
  splitInput: {
    padding: '3px 6px',
    fontSize: 11,
    fontFamily: 'monospace',
    backgroundColor: '#2a2a4a',
    color: '#e0e0e0',
    border: 'none',
    borderRight: '1px solid #3a3a5a',
    borderRadius: 0,
    width: 44,
    flexShrink: 0,
    outline: 'none',
  },
  splitBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '4px 10px',
    fontSize: 11,
    fontFamily: 'monospace',
    backgroundColor: '#2a2a4a',
    color: '#e0e0e0',
    border: 'none',
    borderRadius: 0,
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
    lineHeight: 1,
  },
};
