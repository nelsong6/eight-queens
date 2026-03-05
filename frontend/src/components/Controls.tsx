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
    <div style={styles.panel}>
      {/* Stepping section */}
      <div style={styles.section}>
        <div style={styles.sectionTitle} data-help="Choose stepping mode and advance generations">Stepping</div>
        <div style={styles.granularityRow}>
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
            Full Step
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
            Micro Step
          </button>
        </div>
        <div style={styles.btnRow} data-help={isWalking ? 'Advance to the next walkthrough phase' : 'Advance by N generations — pick a preset or type a custom number'}>
          <input
            list="step-presets"
            value={stepCount}
            onChange={(e) => setStepCount(e.target.value)}
            disabled={solved || isWalking}
            style={{ ...styles.textInput, opacity: solved || isWalking ? 0.5 : 1 }}
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
              ...styles.btn,
              flex: 1,
              opacity: (!canAct && !isWalking) ? 0.5 : 1,
              backgroundColor: isWalking ? '#4a3a8a' : '#2a2a4a',
              borderColor: isWalking ? '#6c5ce7' : '#3a3a5a',
            }}
          >
            {isWalking ? `Step ${walkthroughPhase! + 1}/4` : 'Step'}
          </button>
        </div>
      </div>

      {/* Playback section */}
      <div style={styles.section}>
        <div style={styles.sectionTitle} data-help="Auto-run generations and control speed">Playback</div>
        <div style={styles.btnRow}>
          {isRunning ? (
            <button onClick={onPause} className="btn" data-help="Pause auto-run" style={{ ...styles.btn, flex: 1 }}>
              Pause
            </button>
          ) : (
            <button
              onClick={onPlay}
              className="btn"
              disabled={!canAct}
              data-help="Continuously run full generations automatically"
              style={{ ...styles.btn, flex: 1, opacity: !canAct ? 0.5 : 1 }}
            >
              Auto-play
            </button>
          )}
        </div>
        <label style={styles.speedLabel} data-help="Controls delay between generations — higher is faster, 'Max' removes all delay">
          <span style={styles.speedText}>Speed: {speed >= 500 ? 'Max' : `${speed}`}</span>
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
      </div>

      {sessionPhase === 'review' && (
        <button onClick={onNewSession} className="btn" data-help="Reset and return to configuration" style={styles.newSessionBtn}>
          New Session
        </button>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  panel: {
    backgroundColor: '#1a1a2e',
    borderRadius: 8,
    padding: 16,
    border: '1px solid #2a2a4a',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  section: {
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 10,
    fontFamily: 'monospace',
    color: '#6c5ce7',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
    borderBottom: '1px solid #2a2a4a',
    paddingBottom: 2,
  },
  btnRow: {
    display: 'flex',
    gap: 4,
    marginBottom: 4,
  },
  btn: {
    padding: '5px 10px',
    fontSize: 11,
    fontFamily: 'monospace',
    backgroundColor: '#2a2a4a',
    color: '#e0e0e0',
    border: '1px solid #3a3a5a',
    borderRadius: 4,
    cursor: 'pointer',
  },
  newSessionBtn: {
    width: '100%',
    padding: '8px 16px',
    fontSize: 13,
    fontFamily: 'monospace',
    fontWeight: 'bold',
    backgroundColor: '#6c5ce7',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    cursor: 'pointer',
  },
  speedLabel: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 3,
    fontSize: 11,
    fontFamily: 'monospace',
    color: '#aaa',
  },
  speedText: {
    fontSize: 10,
  },
  slider: {
    width: '100%',
    accentColor: '#6c5ce7',
  },
  granularityRow: {
    display: 'flex',
    gap: 2,
    marginBottom: 6,
  },
  granularityBtn: {
    flex: 1,
    padding: '4px 6px',
    fontSize: 10,
    fontFamily: 'monospace',
    borderRadius: 3,
    cursor: 'pointer',
    textAlign: 'center' as const,
    transition: 'all 0.15s ease',
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
  textInput: {
    padding: '4px 6px',
    fontSize: 11,
    fontFamily: 'monospace',
    backgroundColor: '#2a2a4a',
    color: '#e0e0e0',
    border: '1px solid #3a3a5a',
    borderRadius: 4,
    width: 50,
    flexShrink: 0,
  },
};
