import React, { useRef, useEffect } from 'react';
import type { GenerationSummary } from '../engine/types';
import { MAX_FITNESS } from '../engine/types';

interface Props {
  generationSummaries: GenerationSummary[];
}

const CHART_WIDTH = 400;
const CHART_HEIGHT = 200;
const PADDING = { top: 28, right: 14, bottom: 22, left: 32 };

const COLORS = {
  bg: '#0d0d1a',
  grid: 'rgba(100, 120, 255, 0.07)',
  axisText: 'rgba(160, 170, 220, 0.5)',
  bestLine: '#fbbf24',
  bestGlow: 'rgba(251, 191, 36, 0.35)',
  bestFill: 'rgba(251, 191, 36, 0.08)',
  bestDot: 'rgba(251, 191, 36, 0.6)',
  avgLine: '#818cf8',
  avgGlow: 'rgba(129, 140, 248, 0.3)',
  avgFill: 'rgba(129, 140, 248, 0.06)',
  solutionLine: '#34d399',
  solutionGlow: 'rgba(52, 211, 153, 0.15)',
  legendText: 'rgba(180, 190, 230, 0.7)',
};

export const GenerationChart: React.FC<Props> = ({ generationSummaries }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const prevLenRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = CHART_WIDTH * dpr;
    canvas.height = CHART_HEIGHT * dpr;

    const w = CHART_WIDTH;
    const h = CHART_HEIGHT;
    const plotW = w - PADDING.left - PADDING.right;
    const plotH = h - PADDING.top - PADDING.bottom;

    cancelAnimationFrame(animFrameRef.current);

    if (generationSummaries.length === 0) {
      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.fillStyle = COLORS.bg;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(160, 170, 220, 0.3)';
      ctx.font = '11px "Inter", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Waiting for data\u2026', w / 2, h / 2);
      ctx.restore();
      prevLenRef.current = 0;
      return;
    }

    const curLen = generationSummaries.length;
    const prevLen = prevLenRef.current;

    // Dynamic Y range
    const allValues = generationSummaries.flatMap(s => [s.bestFitness, s.avgFitness]);
    const dataMin = Math.min(...allValues);
    const yMin = Math.max(0, Math.floor(dataMin / 4) * 4 - 2);
    const yMax = MAX_FITNESS;
    const yRange = yMax - yMin;

    const toX = (i: number) => PADDING.left + (i / Math.max(curLen - 1, 1)) * plotW;
    const toY = (val: number) => PADDING.top + plotH - ((val - yMin) / yRange) * plotH;

    // Grid step
    const gridStep = yRange <= 12 ? 2 : yRange <= 20 ? 4 : 7;

    // Determine animation range: clipProgress goes from startClip to 1
    let startClip: number;
    if (prevLen <= 1) {
      startClip = 0; // full left-to-right reveal
    } else {
      // start clip near where the previous data ended
      startClip = Math.max(0, (prevLen - 1) / Math.max(curLen - 1, 1) - 0.02);
    }
    const duration = prevLen <= 1 ? 450 : 160;
    const startTime = performance.now();

    const drawFrame = (clipProgress: number) => {
      ctx.save();
      ctx.scale(dpr, dpr);

      // Background
      ctx.fillStyle = COLORS.bg;
      ctx.fillRect(0, 0, w, h);

      // Grid lines (always fully visible)
      ctx.strokeStyle = COLORS.grid;
      ctx.lineWidth = 1;
      for (let y = yMin; y <= yMax; y += gridStep) {
        const py = Math.round(toY(y)) + 0.5;
        ctx.beginPath();
        ctx.moveTo(PADDING.left, py);
        ctx.lineTo(w - PADDING.right, py);
        ctx.stroke();
      }

      // Solution threshold (always fully visible)
      ctx.save();
      ctx.shadowColor = COLORS.solutionGlow;
      ctx.shadowBlur = 4;
      ctx.strokeStyle = COLORS.solutionLine;
      ctx.lineWidth = 1;
      ctx.setLineDash([6, 4]);
      const solY = Math.round(toY(MAX_FITNESS)) + 0.5;
      ctx.beginPath();
      ctx.moveTo(PADDING.left, solY);
      ctx.lineTo(w - PADDING.right, solY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      // Y-axis labels
      ctx.fillStyle = COLORS.axisText;
      ctx.font = '9px "Inter", system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      for (let y = yMin; y <= yMax; y += gridStep) {
        ctx.fillText(String(y), PADDING.left - 6, toY(y));
      }

      // X-axis labels
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText('1', PADDING.left, PADDING.top + plotH + 6);
      ctx.fillText(String(curLen), w - PADDING.right, PADDING.top + plotH + 6);

      // Legend
      const legendX = w - PADDING.right;
      const legendY = 8;
      ctx.font = '9px "Inter", system-ui, sans-serif';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = COLORS.bestLine;
      ctx.fillRect(legendX - 72, legendY - 1, 10, 2);
      ctx.fillStyle = COLORS.legendText;
      ctx.textAlign = 'left';
      ctx.fillText('Best', legendX - 60, legendY);
      ctx.fillStyle = COLORS.avgLine;
      ctx.fillRect(legendX - 30, legendY - 1, 10, 2);
      ctx.fillStyle = COLORS.legendText;
      ctx.fillText('Avg', legendX - 18, legendY);

      // --- Clip region for animated line reveal ---
      const clipRight = PADDING.left + plotW * clipProgress;
      ctx.save();
      ctx.beginPath();
      ctx.rect(PADDING.left, 0, plotW * clipProgress, h);
      ctx.clip();

      // Draw data lines inside clip
      const drawLine = (
        getData: (s: GenerationSummary) => number,
        color: string,
        glowColor: string,
        fillColor: string,
        showDot: boolean,
      ) => {
        const points: [number, number][] = generationSummaries.map((s, i) => [toX(i), toY(getData(s))]);

        // Gradient fill under line
        const grad = ctx.createLinearGradient(0, PADDING.top, 0, PADDING.top + plotH);
        grad.addColorStop(0, fillColor);
        grad.addColorStop(1, 'transparent');
        ctx.beginPath();
        ctx.moveTo(points[0]![0], points[0]![1]);
        for (let i = 1; i < points.length; i++) {
          ctx.lineTo(points[i]![0], points[i]![1]);
        }
        ctx.lineTo(points[points.length - 1]![0], PADDING.top + plotH);
        ctx.lineTo(points[0]![0], PADDING.top + plotH);
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();

        // Glow pass
        ctx.save();
        ctx.shadowColor = glowColor;
        ctx.shadowBlur = 6;
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(points[0]![0], points[0]![1]);
        for (let i = 1; i < points.length; i++) {
          ctx.lineTo(points[i]![0], points[i]![1]);
        }
        ctx.stroke();
        ctx.restore();

        // Crisp line
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(points[0]![0], points[0]![1]);
        for (let i = 1; i < points.length; i++) {
          ctx.lineTo(points[i]![0], points[i]![1]);
        }
        ctx.stroke();

        // Glowing dot at the leading edge (tip of the visible line)
        if (showDot && clipProgress >= 0.98) {
          const last = points[points.length - 1]!;
          ctx.save();
          ctx.shadowColor = glowColor;
          ctx.shadowBlur = 8;
          ctx.beginPath();
          ctx.arc(last[0], last[1], 3, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.fill();
          ctx.restore();
        }
      };

      drawLine(s => s.avgFitness, COLORS.avgLine, COLORS.avgGlow, COLORS.avgFill, false);
      drawLine(s => s.bestFitness, COLORS.bestLine, COLORS.bestGlow, COLORS.bestFill, true);

      ctx.restore(); // pop clip

      // Soft fade edge at the clip boundary (while animating)
      if (clipProgress < 0.99) {
        const fadeW = 12;
        const fadeGrad = ctx.createLinearGradient(clipRight - fadeW, 0, clipRight, 0);
        fadeGrad.addColorStop(0, 'rgba(13,13,26,0)');
        fadeGrad.addColorStop(1, COLORS.bg);
        ctx.fillStyle = fadeGrad;
        ctx.fillRect(clipRight - fadeW, PADDING.top, fadeW, plotH);
      }

      ctx.restore(); // pop dpr scale
    };

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3);
      const clipProgress = startClip + (1 - startClip) * eased;

      drawFrame(clipProgress);

      if (t < 1) {
        animFrameRef.current = requestAnimationFrame(animate);
      }
    };

    animFrameRef.current = requestAnimationFrame(animate);
    prevLenRef.current = curLen;

    return () => cancelAnimationFrame(animFrameRef.current);
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
    backgroundColor: '#0d0d1a',
    borderRadius: 10,
    padding: '14px 16px 12px',
    border: '1px solid rgba(100, 120, 255, 0.1)',
    flex: 1,
    maxWidth: 440,
  },
  title: {
    margin: '0 0 8px 0',
    fontSize: 13,
    fontFamily: '"Inter", system-ui, sans-serif',
    fontWeight: 600,
    color: 'rgba(180, 190, 230, 0.7)',
    textTransform: 'uppercase' as const,
    letterSpacing: 2,
  },
  canvas: {
    width: '100%',
    borderRadius: 4,
    display: 'block',
  },
};
