import React from 'react';

interface Props {
  isRunning: boolean;
  onPlay: () => void;
  onPause: () => void;
  onStep: () => void;
  onReset: () => void;
  speed: number;
  onSpeedChange: (speed: number) => void;
  hasStarted: boolean;
  solved: boolean;
}

export const Controls: React.FC<Props> = ({
  isRunning,
  onPlay,
  onPause,
  onStep,
  onReset,
  speed,
  onSpeedChange,
  hasStarted,
  solved,
}) => {
  return (
    <div style={styles.panel}>
      <div style={styles.buttons}>
        {isRunning ? (
          <button onClick={onPause} style={styles.btn}>
            Pause
          </button>
        ) : (
          <button
            onClick={onPlay}
            disabled={!hasStarted || solved}
            style={{ ...styles.btn, opacity: !hasStarted || solved ? 0.5 : 1 }}
          >
            Play
          </button>
        )}
        <button
          onClick={onStep}
          disabled={isRunning || !hasStarted || solved}
          style={{
            ...styles.btn,
            opacity: isRunning || !hasStarted || solved ? 0.5 : 1,
          }}
        >
          Step
        </button>
        <button onClick={onReset} style={styles.btn}>
          Reset
        </button>
      </div>

      <label style={styles.speedLabel}>
        Speed: {speed <= 1 ? 'Max' : `${speed}ms`}
        <input
          type="range"
          min={1}
          max={500}
          value={speed}
          onChange={(e) => onSpeedChange(Number(e.target.value))}
          style={styles.slider}
        />
      </label>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  panel: {
    backgroundColor: '#1a1a2e',
    borderRadius: 8,
    padding: 12,
    border: '1px solid #2a2a4a',
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    flexWrap: 'wrap',
  },
  buttons: {
    display: 'flex',
    gap: 6,
  },
  btn: {
    padding: '6px 14px',
    fontSize: 12,
    fontFamily: 'monospace',
    backgroundColor: '#2a2a4a',
    color: '#e0e0e0',
    border: '1px solid #3a3a5a',
    borderRadius: 4,
    cursor: 'pointer',
  },
  speedLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 11,
    fontFamily: 'monospace',
    color: '#aaa',
    flex: 1,
  },
  slider: {
    flex: 1,
    minWidth: 80,
    accentColor: '#6c5ce7',
  },
};
