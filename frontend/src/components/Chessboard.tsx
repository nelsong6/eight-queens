import React, { useRef, useEffect } from 'react';
import type { Individual } from '../engine/types';
import { BOARD_SIZE, MAX_FITNESS } from '../engine/types';

interface Props {
  individual: Individual | null;
  label?: string;
}

const CELL_SIZE = 48;
const BOARD_PX = CELL_SIZE * BOARD_SIZE;

export const Chessboard: React.FC<Props> = ({ individual, label }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, BOARD_PX, BOARD_PX);

    // Draw checkerboard
    for (let col = 0; col < BOARD_SIZE; col++) {
      for (let row = 0; row < BOARD_SIZE; row++) {
        const isLight = (col + row) % 2 === 0;
        ctx.fillStyle = isLight ? '#e8d5b5' : '#8b6914';
        ctx.fillRect(col * CELL_SIZE, row * CELL_SIZE, CELL_SIZE, CELL_SIZE);
      }
    }

    if (!individual) return;

    // Highlight attacking pairs in red
    for (let i = 0; i < BOARD_SIZE; i++) {
      for (let j = i + 1; j < BOARD_SIZE; j++) {
        const ri = individual.solution[i]!;
        const rj = individual.solution[j]!;
        const attacking =
          ri === rj || Math.abs(i - j) === Math.abs(ri - rj);
        if (attacking) {
          // Tint the attacking queen cells
          ctx.fillStyle = 'rgba(255, 60, 60, 0.3)';
          ctx.fillRect(i * CELL_SIZE, ri * CELL_SIZE, CELL_SIZE, CELL_SIZE);
          ctx.fillRect(j * CELL_SIZE, rj * CELL_SIZE, CELL_SIZE, CELL_SIZE);
        }
      }
    }

    // Draw queens
    for (let col = 0; col < BOARD_SIZE; col++) {
      const row = individual.solution[col]!;
      const cx = col * CELL_SIZE + CELL_SIZE / 2;
      const cy = row * CELL_SIZE + CELL_SIZE / 2;

      // Queen body (circle)
      ctx.beginPath();
      ctx.arc(cx, cy, CELL_SIZE * 0.35, 0, Math.PI * 2);
      ctx.fillStyle = individual.fitness === MAX_FITNESS ? '#4caf50' : '#ffd700';
      ctx.fill();
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Crown points
      const r = CELL_SIZE * 0.3;
      ctx.beginPath();
      ctx.moveTo(cx - r, cy + r * 0.3);
      ctx.lineTo(cx - r * 0.6, cy - r * 0.6);
      ctx.lineTo(cx - r * 0.2, cy);
      ctx.lineTo(cx, cy - r * 0.8);
      ctx.lineTo(cx + r * 0.2, cy);
      ctx.lineTo(cx + r * 0.6, cy - r * 0.6);
      ctx.lineTo(cx + r, cy + r * 0.3);
      ctx.closePath();
      ctx.fillStyle = individual.fitness === MAX_FITNESS ? '#2e7d32' : '#b8860b';
      ctx.fill();
      ctx.stroke();
    }
  }, [individual]);

  return (
    <div style={styles.wrapper}>
      {label && <div style={styles.label}>{label}</div>}
      <canvas
        ref={canvasRef}
        width={BOARD_PX}
        height={BOARD_PX}
        style={styles.canvas}
      />
      {individual && (
        <div style={styles.info}>
          [{individual.solution.join(', ')}] &mdash; Fitness: {individual.fitness}/{MAX_FITNESS}
        </div>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
  },
  label: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#aaa',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  canvas: {
    border: '2px solid #555',
    borderRadius: 4,
    imageRendering: 'pixelated',
  },
  info: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: '#ccc',
  },
};
