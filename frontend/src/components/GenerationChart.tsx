import React, { useRef, useEffect } from 'react';
import type { GenerationSummary } from '../engine/types';
import { MAX_FITNESS } from '../engine/types';

interface Props {
  generationSummaries: GenerationSummary[];
}

const CHART_WIDTH = 360;
const CHART_HEIGHT = 180;
const PADDING = { top: 10, right: 10, bottom: 25, left: 35 };

export const GenerationChart: React.FC<Props> = ({ generationSummaries }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = CHART_WIDTH;
    const h = CHART_HEIGHT;
    const plotW = w - PADDING.left - PADDING.right;
    const plotH = h - PADDING.top - PADDING.bottom;

    ctx.clearRect(0, 0, w, h);

    // Background
    ctx.fillStyle = '#12122a';
    ctx.fillRect(0, 0, w, h);

    if (generationSummaries.length === 0) {
      ctx.fillStyle = '#555';
      ctx.font = '11px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('No data yet', w / 2, h / 2);
      return;
    }

    const maxGen = generationSummaries.length;

    // Y axis: 0 to MAX_FITNESS
    const yMax = MAX_FITNESS;

    const toX = (gen: number) => PADDING.left + (gen / maxGen) * plotW;
    const toY = (val: number) => PADDING.top + plotH - (val / yMax) * plotH;

    // Grid lines
    ctx.strokeStyle = '#2a2a4a';
    ctx.lineWidth = 0.5;
    for (let y = 0; y <= yMax; y += 7) {
      const py = toY(y);
      ctx.beginPath();
      ctx.moveTo(PADDING.left, py);
      ctx.lineTo(w - PADDING.right, py);
      ctx.stroke();
    }

    // Best fitness line (gold)
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < generationSummaries.length; i++) {
      const x = toX(i);
      const y = toY(generationSummaries[i]!.bestFitness);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Avg fitness line (purple)
    ctx.strokeStyle = '#6c5ce7';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < generationSummaries.length; i++) {
      const x = toX(i);
      const y = toY(generationSummaries[i]!.avgFitness);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Solution line (green dashed)
    ctx.strokeStyle = '#4caf50';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(PADDING.left, toY(MAX_FITNESS));
    ctx.lineTo(w - PADDING.right, toY(MAX_FITNESS));
    ctx.stroke();
    ctx.setLineDash([]);

    // Axis labels
    ctx.fillStyle = '#888';
    ctx.font = '9px monospace';
    ctx.textAlign = 'right';
    for (let y = 0; y <= yMax; y += 7) {
      ctx.fillText(String(y), PADDING.left - 4, toY(y) + 3);
    }

    ctx.textAlign = 'center';
    ctx.fillText('1', PADDING.left, h - 4);
    ctx.fillText(String(maxGen), w - PADDING.right, h - 4);

    // Legend
    ctx.fillStyle = '#ffd700';
    ctx.fillRect(PADDING.left + 4, PADDING.top + 2, 16, 2);
    ctx.fillStyle = '#aaa';
    ctx.font = '8px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('Best', PADDING.left + 24, PADDING.top + 6);

    ctx.fillStyle = '#6c5ce7';
    ctx.fillRect(PADDING.left + 54, PADDING.top + 2, 16, 2);
    ctx.fillStyle = '#aaa';
    ctx.fillText('Avg', PADDING.left + 74, PADDING.top + 6);
  }, [generationSummaries]);

  return (
    <div style={styles.panel} data-help="Fitness over generations — gold line is best fitness, purple is average, green dashed line is the solution threshold (28)">
      <h3 style={styles.title} data-help="Tracks how best and average fitness evolve as generations progress">Fitness Over Generations</h3>
      <canvas
        ref={canvasRef}
        width={CHART_WIDTH}
        height={CHART_HEIGHT}
        style={styles.canvas}
      />
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  panel: {
    backgroundColor: '#1a1a2e',
    borderRadius: 8,
    padding: 16,
    border: '1px solid #2a2a4a',
    flex: 1,
    maxWidth: 400,
  },
  title: {
    margin: '0 0 10px 0',
    fontSize: 14,
    fontFamily: 'monospace',
    color: '#aaa',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  canvas: {
    width: '100%',
    borderRadius: 4,
  },
};
