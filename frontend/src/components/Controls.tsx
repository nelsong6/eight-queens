import React, { useState } from 'react';
import { colors } from '../colors';

type SessionPhase = 'config' | 'running' | 'review';

interface Props {
  sessionPhase: SessionPhase;
  isRunning: boolean;
  onPlay: (stepCount: number) => void;
  onPause: () => void;
  onStep: () => void;
  onStepN: (count: number) => void;
  onMicroStepN?: (count: number) => void;
  onBack: () => void;
  canGoBack: boolean;
  onReset: () => void;
  onNewSession: () => void;
  speed: number;
  onSpeedChange: (speed: number) => void;
  solved: boolean;
  walkthroughPhase: number | null;
  isMicro: boolean;
  barStyle?: React.CSSProperties;
}

const STEP_PRESETS = [1, 2, 5, 10, 25, 50, 100, 1000];

export const Controls: React.FC<Props> = ({
  sessionPhase,
  isRunning,
  onPlay,
  onPause,
  onStep,
  onStepN,
  onMicroStepN,
  onBack,
  canGoBack,
  onReset,
  onNewSession,
  speed,
  onSpeedChange,
  solved,
  walkthroughPhase,
  isMicro,
  barStyle,
}) => {
  const [stepCount, setStepCount] = useState('1');

  const canAct = !isRunning && !solved;
  const isWalking = walkthroughPhase !== null;

  return (
    <div style={{ ...styles.bar, ...barStyle }}>
      {/* Playback */}
      <div style={styles.group}>
        <button onClick={onReset} className="btn" data-help="Clear all progress and return to configuration" style={styles.btn} title="Rewind">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="12,4 2,12 12,20" />
            <polygon points="22,4 12,12 22,20" />
          </svg>
        </button>
        <button
          onClick={onBack}
          className="btn"
          disabled={isRunning || !canGoBack}
          data-help="Go back one step (undo last generation or micro phase)"
          style={{ ...styles.btn, opacity: (isRunning || !canGoBack) ? 0.5 : 1 }}
          title="Back"
        >
          <span style={{ display: 'inline-block', transform: 'scaleX(-1)' }}>⏭</span>
        </button>
        {isRunning ? (
          <button onClick={onPause} className="btn" data-help="Pause auto-run" style={styles.btn}>
            ⏸
          </button>
        ) : (
          <button
            onClick={() => onPlay(parseInt(stepCount, 10) || 1)}
            className="btn"
            disabled={!canAct}
            data-help={isMicro ? "Auto-step through pipeline phases" : "Continuously run full generations automatically"}
            style={{ ...styles.btn, opacity: !canAct ? 0.5 : 1 }}
          >
            ▶
          </button>
        )}
      </div>

      <div style={styles.divider} />

      {/* Step controls — split button */}
      <div style={styles.splitGroup} data-help={isMicro ? 'Advance by N pipeline steps — pick a preset or type a custom number' : 'Advance by N generations — pick a preset or type a custom number'}>
        <input
          list="step-presets"
          value={stepCount}
          onChange={(e) => setStepCount(e.target.value)}
          disabled={solved}
          style={{ ...styles.splitInput, opacity: solved ? 0.5 : 1 }}
        />
        <datalist id="step-presets">
          {STEP_PRESETS.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
        <button
          onClick={() => {
            if (isMicro) {
              const n = parseInt(stepCount, 10);
              if (n === 1 || !onMicroStepN) onStep();
              else if (n > 1) onMicroStepN(n);
              return;
            }
            const n = parseInt(stepCount, 10);
            if (n === 1) onStep();
            else if (n > 1) onStepN(n);
          }}
          className="btn"
          disabled={isMicro ? (!canAct && !isWalking) : (!canAct || !stepCount || !/^\d+$/.test(stepCount) || parseInt(stepCount, 10) < 1)}
          style={{
            ...styles.splitBtn,
            opacity: (!canAct && !isWalking) ? 0.5 : 1,
            backgroundColor: colors.bg.overlay,
          }}
        >
          ⏭
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
    padding: '14px 24px',
    backgroundColor: colors.bg.raised,
    borderBottom: `1px solid ${colors.border.subtle}`,
  },
  group: {
    display: 'flex',
    alignItems: 'center',
    gap: 3,
  },
  divider: {
    width: 1,
    height: 18,
    backgroundColor: colors.border.subtle,
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
    backgroundColor: colors.bg.overlay,
    color: colors.text.primary,
    border: `1px solid ${colors.border.strong}`,
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
    backgroundColor: colors.accent.purple,
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
    color: colors.text.secondary,
  },
  speedText: {
    fontSize: 10,
    minWidth: 24,
    textAlign: 'right' as const,
  },
  slider: {
    width: 80,
    accentColor: colors.accent.purple,
  },
  splitGroup: {
    display: 'flex',
    alignItems: 'stretch',
    border: `1px solid ${colors.border.strong}`,
    borderRadius: 4,
    overflow: 'hidden',
  },
  splitInput: {
    padding: '3px 6px',
    fontSize: 11,
    fontFamily: 'monospace',
    backgroundColor: colors.bg.overlay,
    color: colors.text.primary,
    border: 'none',
    borderRight: `1px solid ${colors.border.strong}`,
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
    backgroundColor: colors.bg.overlay,
    color: colors.text.primary,
    border: 'none',
    borderRadius: 0,
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
    lineHeight: 1,
  },
};
