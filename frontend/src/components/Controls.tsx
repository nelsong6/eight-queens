import React, { useState } from 'react';

interface Props {
  isRunning: boolean;
  onPlay: () => void;
  onPause: () => void;
  onStep: () => void;
  onStepN: (count: number) => void;
  onRunUntilSolved: () => void;
  onReset: () => void;
  speed: number;
  onSpeedChange: (speed: number) => void;
  hasStarted: boolean;
  solved: boolean;
}

const STEP_PRESETS = [1, 2, 5, 10, 25, 50, 100, 1000];

export const Controls: React.FC<Props> = ({
  isRunning,
  onPlay,
  onPause,
  onStep,
  onStepN,
  onRunUntilSolved,
  onReset,
  speed,
  onSpeedChange,
  hasStarted,
  solved,
}) => {
  const [stepPreset, setStepPreset] = useState(1);
  const [customStepCount, setCustomStepCount] = useState('');

  const canStep = hasStarted && !isRunning && !solved;

  return (
    <div style={styles.panel}>
      {/* Transport buttons */}
      <div style={styles.btnRow}>
        {isRunning ? (
          <button onClick={onPause} className="btn" style={styles.btn}>
            Pause
          </button>
        ) : (
          <button
            onClick={onPlay}
            className="btn"
            disabled={!hasStarted || solved}
            style={{ ...styles.btn, opacity: !hasStarted || solved ? 0.5 : 1 }}
          >
            Play
          </button>
        )}
        <button
          onClick={onStep}
          className="btn"
          disabled={!canStep}
          style={{ ...styles.btn, opacity: !canStep ? 0.5 : 1 }}
        >
          Step
        </button>
        <button onClick={onReset} className="btn" style={styles.btn}>
          Reset
        </button>
      </div>

      {/* Speed slider */}
      <label style={styles.speedLabel}>
        <span style={styles.speedText}>Speed: {speed >= 500 ? 'Max' : `${speed}`}</span>
        <input
          type="range"
          min={1}
          max={500}
          value={speed}
          onChange={(e) => onSpeedChange(Number(e.target.value))}
          style={styles.slider}
        />
      </label>

      <div style={styles.divider} />

      {/* Step-by-N preset */}
      <div style={styles.btnRow}>
        <select
          value={stepPreset}
          onChange={(e) => setStepPreset(Number(e.target.value))}
          style={styles.select}
        >
          {STEP_PRESETS.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <button
          onClick={() => onStepN(stepPreset)}
          className="btn"
          disabled={!canStep}
          style={{ ...styles.btn, flex: 1, opacity: !canStep ? 0.5 : 1 }}
        >
          Step {stepPreset}
        </button>
      </div>

      {/* Step-by-N custom */}
      <div style={styles.btnRow}>
        <input
          type="number"
          value={customStepCount}
          onChange={(e) => setCustomStepCount(e.target.value)}
          placeholder="N"
          min={1}
          style={styles.textInput}
        />
        <button
          onClick={() => onStepN(Number(customStepCount) || 1)}
          className="btn"
          disabled={!canStep}
          style={{ ...styles.btn, flex: 1, opacity: !canStep ? 0.5 : 1 }}
        >
          Step N
        </button>
      </div>

      <div style={styles.divider} />

      {/* Run until solved */}
      <button
        onClick={onRunUntilSolved}
        className="btn btn-danger"
        disabled={!canStep}
        style={{
          ...styles.btn,
          backgroundColor: !canStep ? '#2a2a4a' : '#8b2020',
          color: '#fff',
          opacity: !canStep ? 0.5 : 1,
          width: '100%',
        }}
      >
        Run Until Solved
      </button>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  panel: {
    backgroundColor: '#1a1a2e',
    borderRadius: 8,
    padding: 10,
    border: '1px solid #2a2a4a',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  btnRow: {
    display: 'flex',
    gap: 4,
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
  divider: {
    borderTop: '1px solid #2a2a4a',
    margin: '2px 0',
  },
  select: {
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
