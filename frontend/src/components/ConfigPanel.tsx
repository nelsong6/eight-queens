import React, { useState } from 'react';
import type { AlgorithmConfig } from '../engine/types';
import { DEFAULT_CONFIG } from '../engine/types';
import type { Preset } from '../api/client';

interface Props {
  onStart: (config: AlgorithmConfig) => void;
  isRunning: boolean;
  isAuthenticated: boolean;
  presets: Preset[];
}

export const ConfigPanel: React.FC<Props> = ({
  onStart,
  isRunning,
  isAuthenticated,
  presets,
}) => {
  const [populationSize, setPopulationSize] = useState(DEFAULT_CONFIG.populationSize);
  const [crossoverMin, setCrossoverMin] = useState(DEFAULT_CONFIG.crossoverRange[0]);
  const [crossoverMax, setCrossoverMax] = useState(DEFAULT_CONFIG.crossoverRange[1]);
  const [mutationRate, setMutationRate] = useState(DEFAULT_CONFIG.mutationRate);

  const handlePreset = (preset: Preset) => {
    setPopulationSize(preset.config.populationSize);
    setCrossoverMin(preset.config.crossoverRange[0]);
    setCrossoverMax(preset.config.crossoverRange[1]);
    setMutationRate(preset.config.mutationRate);
  };

  const handleStart = () => {
    onStart({
      populationSize,
      crossoverRange: [crossoverMin, crossoverMax],
      mutationRate,
    });
  };

  return (
    <div style={styles.panel}>
      <h3 style={styles.title}>Configuration</h3>

      {/* Presets */}
      <div style={styles.presetRow}>
        {presets.map((p) => (
          <button
            key={p.id}
            onClick={() => handlePreset(p)}
            style={styles.presetBtn}
            title={p.description}
            disabled={isRunning}
          >
            {p.name}
          </button>
        ))}
      </div>

      {/* Full controls */}
      {isAuthenticated && (
        <div style={styles.sliders}>
          <label style={styles.sliderLabel}>
            Population: {populationSize.toLocaleString()}
            <input
              type="range"
              min={50}
              max={50000}
              step={50}
              value={populationSize}
              onChange={(e) => setPopulationSize(Number(e.target.value))}
              disabled={isRunning}
              style={styles.slider}
            />
          </label>

          <label style={styles.sliderLabel}>
            Crossover Range: [{crossoverMin}, {crossoverMax}]
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="range"
                min={1}
                max={6}
                value={crossoverMin}
                onChange={(e) => setCrossoverMin(Number(e.target.value))}
                disabled={isRunning}
                style={styles.slider}
              />
              <input
                type="range"
                min={1}
                max={6}
                value={crossoverMax}
                onChange={(e) => setCrossoverMax(Number(e.target.value))}
                disabled={isRunning}
                style={styles.slider}
              />
            </div>
          </label>

          <label style={styles.sliderLabel}>
            Mutation Rate: {(mutationRate * 100).toFixed(0)}%
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(mutationRate * 100)}
              onChange={(e) => setMutationRate(Number(e.target.value) / 100)}
              disabled={isRunning}
              style={styles.slider}
            />
          </label>
        </div>
      )}

      <button
        onClick={handleStart}
        disabled={isRunning}
        style={{
          ...styles.startBtn,
          opacity: isRunning ? 0.5 : 1,
        }}
      >
        Start
      </button>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  panel: {
    backgroundColor: '#1a1a2e',
    borderRadius: 8,
    padding: 16,
    border: '1px solid #2a2a4a',
  },
  title: {
    margin: '0 0 12px 0',
    fontSize: 14,
    fontFamily: 'monospace',
    color: '#aaa',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  presetRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  presetBtn: {
    padding: '6px 12px',
    fontSize: 12,
    fontFamily: 'monospace',
    backgroundColor: '#2a2a4a',
    color: '#e0e0e0',
    border: '1px solid #3a3a5a',
    borderRadius: 4,
    cursor: 'pointer',
  },
  sliders: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    marginBottom: 12,
  },
  sliderLabel: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    fontSize: 11,
    fontFamily: 'monospace',
    color: '#ccc',
  },
  slider: {
    width: '100%',
    accentColor: '#6c5ce7',
  },
  startBtn: {
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
};
