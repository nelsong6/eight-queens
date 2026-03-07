import React, { useRef, useEffect } from 'react';
import type { GenerationSummary } from '../engine/types';
import { MAX_FITNESS } from '../engine/types';
import { colors } from '../colors';

interface Props {
  summariesRef: React.RefObject<GenerationSummary[]>;
  playheadRef: React.RefObject<number>;
  lookaheadRef: React.RefObject<GenerationSummary | null>;
}

const PADDING = { top: 28, right: 14, bottom: 22, left: 32 };

const C = {
  bg: colors.bg.base,
  grid: colors.chart.grid,
  axisText: colors.chart.axis,
  bestLine: colors.chart.bestLine,
  bestGlow: colors.chart.bestGlow,
  bestFill: colors.chart.bestFill,
  avgLine: colors.chart.avgLine,
  avgGlow: colors.chart.avgGlow,
  avgFill: colors.chart.avgFill,
  solutionLine: colors.chart.solutionLine,
  solutionGlow: colors.chart.solutionGlow,
  legendText: colors.chart.legend,
};

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Compute x-position for data point i, given a continuous divisor */
function dataX(index: number, divisor: number, plotW: number): number {
  return PADDING.left + (index / divisor) * plotW;
}

export const GenerationChart: React.FC<Props> = ({ summariesRef, playheadRef, lookaheadRef }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const rafIdRef = useRef<number>(0);
  const sizeRef = useRef({ w: 400, h: 200 });
  const mouseRef = useRef<{ x: number; y: number } | null>(null);
  const revealStartRef = useRef<number>(0); // timestamp when data first appeared (0 = no data yet)
  const yMinAnimRef = useRef<number>(0); // smoothly animated yMin

  // Track container size via ResizeObserver
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) {
        sizeRef.current = { w: Math.round(width), h: Math.round(height) };
        const canvas = canvasRef.current;
        if (canvas) {
          const dpr = window.devicePixelRatio || 1;
          canvas.width = sizeRef.current.w * dpr;
          canvas.height = sizeRef.current.h * dpr;
        }
      }
    });
    ro.observe(wrapper);
    return () => ro.disconnect();
  }, []);

  // Track mouse for tooltip
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    const onLeave = () => { mouseRef.current = null; };
    canvas.addEventListener('mousemove', onMove);
    canvas.addEventListener('mouseleave', onLeave);
    return () => {
      canvas.removeEventListener('mousemove', onMove);
      canvas.removeEventListener('mouseleave', onLeave);
    };
  }, []);

  // Persistent rAF draw loop — reads entirely from refs, no React render dependency
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = sizeRef.current.w * dpr;
    canvas.height = sizeRef.current.h * dpr;

    const drawFrame = () => {
      const summaries = summariesRef.current;
      const playhead = playheadRef.current;
      const w = sizeRef.current.w;
      const h = sizeRef.current.h;
      const PLOT_W = w - PADDING.left - PADDING.right;
      const PLOT_H = h - PADDING.top - PADDING.bottom;

      const curDpr = window.devicePixelRatio || 1;

      // How far to draw based on playhead
      const lookahead = lookaheadRef.current;
      const maxDraw = lookahead ? summaries.length : summaries.length - 1;
      const drawUpTo = Math.min(playhead, maxDraw);
      const fullGens = Math.floor(drawUpTo);
      const frac = drawUpTo - fullGens;
      const visibleCount = Math.min(fullGens + 1, summaries.length);

      // Continuous divisor — x-axis spans 0..xDiv, with generation 0 at
      // the left edge and the latest data at the right edge.
      // +1 ensures data index i maps to dataX(i+1, xDiv, PLOT_W).
      const xDiv = Math.max(drawUpTo + 1, 1);

      ctx.save();
      ctx.setTransform(curDpr, 0, 0, curDpr, 0, 0);

      // Background
      ctx.fillStyle = C.bg;
      ctx.fillRect(0, 0, w, h);

      const hasData = summaries.length > 0 && playhead >= 0;

      // Track reveal animation timing
      if (!hasData) {
        revealStartRef.current = 0;
        yMinAnimRef.current = 0;
      } else if (revealStartRef.current === 0) {
        revealStartRef.current = performance.now();
      }

      // Reveal factor: 0→1 over 400ms with ease-in-out cubic
      let reveal = 1;
      if (revealStartRef.current > 0) {
        const elapsed = performance.now() - revealStartRef.current;
        const t = Math.min(elapsed / 400, 1);
        reveal = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      }

      // Dynamic Y range — computed from visible data only so it stays
      // in sync with the x-axis expansion (no premature vertical shift).
      let yMinTarget = 0;
      const yMax = MAX_FITNESS;
      const hasTip = frac > 0 && fullGens < summaries.length;
      if (visibleCount >= 2 || (visibleCount >= 1 && hasTip)) {
        let dataMin = MAX_FITNESS;
        for (let i = 0; i < visibleCount; i++) {
          const s = summaries[i]!;
          if (s.bestFitness < dataMin) dataMin = s.bestFitness;
          if (s.avgFitness < dataMin) dataMin = s.avgFitness;
        }
        // Also consider the interpolated tip value if we're mid-transition
        if (hasTip) {
          const nextSummary = fullGens + 1 < summaries.length
            ? summaries[fullGens + 1]!
            : lookahead;
          if (nextSummary) {
            const tipBest = lerp(summaries[fullGens]!.bestFitness, nextSummary.bestFitness, frac);
            const tipAvg = lerp(summaries[fullGens]!.avgFitness, nextSummary.avgFitness, frac);
            if (tipBest < dataMin) dataMin = tipBest;
            if (tipAvg < dataMin) dataMin = tipAvg;
          }
        }
        yMinTarget = Math.max(0, Math.floor(dataMin / 4) * 4 - 2);
      }
      // Smoothly animate toward target to avoid jarring snaps from quantization
      const diff = yMinTarget - yMinAnimRef.current;
      if (Math.abs(diff) < 0.05) {
        yMinAnimRef.current = yMinTarget;
      } else {
        yMinAnimRef.current += diff * 0.15;
      }
      const yMin = yMinAnimRef.current;
      const yRange = yMax - yMin;

      const toY = (val: number) => PADDING.top + PLOT_H - ((val - yMin) / yRange) * PLOT_H;
      // Revealed toY: data points rise from baseline during first-data animation
      const toYRevealed = (val: number) => {
        const target = toY(val);
        const baseline = toY(yMin); // bottom of plot
        return baseline + (target - baseline) * reveal;
      };

      // Grid lines — anchored to integer values so labels stay clean during yMin animation
      const gridStep = yRange <= 12 ? 2 : yRange <= 20 ? 4 : 7;
      const gridStart = Math.ceil(yMin / gridStep) * gridStep;
      ctx.strokeStyle = C.grid;
      ctx.lineWidth = 1;
      for (let y = gridStart; y <= yMax; y += gridStep) {
        const py = Math.round(toY(y)) + 0.5;
        ctx.beginPath();
        ctx.moveTo(PADDING.left, py);
        ctx.lineTo(w - PADDING.right, py);
        ctx.stroke();
      }

      // Solution threshold
      ctx.save();
      ctx.shadowColor = C.solutionGlow;
      ctx.shadowBlur = 4;
      ctx.strokeStyle = C.solutionLine;
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
      ctx.fillStyle = C.axisText;
      ctx.font = '9px "Inter", system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      for (let y = gridStart; y <= yMax; y += gridStep) {
        ctx.fillText(String(y), PADDING.left - 6, toY(y));
      }

      // Legend
      const legendX = w - PADDING.right;
      const legendY = 8;
      ctx.font = '9px "Inter", system-ui, sans-serif';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = C.bestLine;
      ctx.fillRect(legendX - 72, legendY - 1, 10, 2);
      ctx.fillStyle = C.legendText;
      ctx.textAlign = 'left';
      ctx.fillText('Best', legendX - 60, legendY);
      ctx.fillStyle = C.avgLine;
      ctx.fillRect(legendX - 30, legendY - 1, 10, 2);
      ctx.fillStyle = C.legendText;
      ctx.fillText('Avg', legendX - 18, legendY);

      // X-axis labels
      const labelFadeZone = 20;
      ctx.font = '9px "Inter", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      const labelY = PADDING.top + PLOT_H + 6;
      const minLabelGap = 28;
      if (hasData) {
        // "0" label at left edge (generation 0 / origin)
        ctx.fillStyle = C.axisText;
        ctx.fillText('0', PADDING.left, labelY);
        let lastLabelX = PADDING.left;

        for (let i = 0; i < summaries.length; i++) {
          let px = dataX(i + 1, xDiv, PLOT_W);
          if (summaries.length === 1 && reveal < 1) {
            px = lerp(PADDING.left, px, reveal);
          }
          if (px < PADDING.left - 8 || px > PADDING.left + PLOT_W + 4) continue;
          if (px - lastLabelX < minLabelGap) continue;
          const distFromLeft = px - PADDING.left;
          const alpha = distFromLeft < labelFadeZone
            ? Math.max(0, (distFromLeft + 8) / (labelFadeZone + 8))
            : 1;
          if (alpha <= 0) continue;
          ctx.globalAlpha = alpha;
          ctx.fillStyle = C.axisText;
          ctx.fillText(String(summaries[i]!.generationNumber), px, labelY);
          ctx.globalAlpha = 1;
          lastLabelX = px;
        }
        // Tip label at right edge — fades in as frac grows
        if (frac > 0.05 && lookahead) {
          const tipX = PADDING.left + PLOT_W;
          if (tipX - lastLabelX >= minLabelGap) {
            ctx.globalAlpha = Math.min((frac - 0.05) * 3, 1);
            ctx.fillStyle = C.axisText;
            ctx.fillText(String(lookahead.generationNumber), tipX, labelY);
            ctx.globalAlpha = 1;
          }
        }
      }

      // Draw data lines (skip if no data)
      if (!hasData) {
        ctx.restore();
        rafIdRef.current = requestAnimationFrame(drawFrame);
        return;
      }

      const drawLine = (
        getValue: (s: GenerationSummary) => number,
        color: string,
        glowColor: string,
        fillColor: string,
        showDot: boolean,
      ) => {
        if (visibleCount < 1) return;

        const pts: [number, number][] = [];

        // Origin point at x=0 (left edge), always anchored at the chart baseline.
        // This keeps the line visually rooted at the bottom-left corner.
        if (summaries.length >= 1) {
          pts.push([PADDING.left, toY(yMin)]);
        }

        for (let i = 0; i < visibleCount; i++) {
          let px = dataX(i + 1, xDiv, PLOT_W);
          // During first reveal, animate data point from origin to final position
          if (summaries.length === 1 && reveal < 1) {
            px = lerp(PADDING.left, px, reveal);
          }
          pts.push([px, toYRevealed(getValue(summaries[i]!))]);
        }

        // Interpolated tip between generations
        if (frac > 0 && fullGens < summaries.length) {
          const fromVal = getValue(summaries[fullGens]!);
          const nextSummary = fullGens + 1 < summaries.length
            ? summaries[fullGens + 1]!
            : lookahead;
          if (nextSummary) {
            const toVal = getValue(nextSummary);
            if (fullGens + 1 < summaries.length) {
              const fromX = dataX(fullGens + 1, xDiv, PLOT_W);
              const toX = dataX(fullGens + 2, xDiv, PLOT_W);
              pts.push([lerp(fromX, toX, frac), toYRevealed(lerp(fromVal, toVal, frac))]);
            } else {
              pts.push([PADDING.left + PLOT_W, toYRevealed(lerp(fromVal, toVal, frac))]);
            }
          }
        }

        if (pts.length === 0) return;

        // Gradient fill under line
        const grad = ctx.createLinearGradient(0, PADDING.top, 0, PADDING.top + PLOT_H);
        grad.addColorStop(0, fillColor);
        grad.addColorStop(1, 'transparent');
        ctx.beginPath();
        ctx.moveTo(pts[0]![0], pts[0]![1]);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i]![0], pts[i]![1]);
        ctx.lineTo(pts[pts.length - 1]![0], PADDING.top + PLOT_H);
        ctx.lineTo(pts[0]![0], PADDING.top + PLOT_H);
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
        ctx.moveTo(pts[0]![0], pts[0]![1]);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i]![0], pts[i]![1]);
        ctx.stroke();
        ctx.restore();

        // Crisp line
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(pts[0]![0], pts[0]![1]);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i]![0], pts[i]![1]);
        ctx.stroke();

        // Glowing dot at tip (always show when single point, otherwise only for best line)
        if (showDot || pts.length === 1) {
          const last = pts[pts.length - 1]!;
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

      drawLine(s => s.avgFitness, C.avgLine, C.avgGlow, C.avgFill, false);
      drawLine(s => s.bestFitness, C.bestLine, C.bestGlow, C.bestFill, true);

      // Hover tooltip
      const mouse = mouseRef.current;
      if (mouse && visibleCount >= 1) {
        const mx = mouse.x;
        const my = mouse.y;
        if (mx >= PADDING.left && mx <= w - PADDING.right && my >= PADDING.top && my <= PADDING.top + PLOT_H) {
          // Find nearest data index by x position (shifted by +1 for origin)
          const ratio = (mx - PADDING.left) / PLOT_W;
          const nearestIdx = Math.round(ratio * xDiv) - 1;
          const idx = Math.max(0, Math.min(nearestIdx, visibleCount - 1));
          const s = summaries[idx]!;
          const px = dataX(idx + 1, xDiv, PLOT_W);
          const bestY = toYRevealed(s.bestFitness);
          const avgY = toYRevealed(s.avgFitness);

          // Vertical crosshair
          ctx.save();
          ctx.strokeStyle = colors.chart.crosshair;
          ctx.lineWidth = 1;
          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          ctx.moveTo(px, PADDING.top);
          ctx.lineTo(px, PADDING.top + PLOT_H);
          ctx.stroke();
          ctx.setLineDash([]);

          // Dots on lines
          ctx.beginPath();
          ctx.arc(px, bestY, 4, 0, Math.PI * 2);
          ctx.fillStyle = C.bestLine;
          ctx.fill();
          ctx.beginPath();
          ctx.arc(px, avgY, 4, 0, Math.PI * 2);
          ctx.fillStyle = C.avgLine;
          ctx.fill();

          // Tooltip box
          ctx.font = '10px "Inter", system-ui, sans-serif';
          const genLabel = `Gen ${s.generationNumber}`;
          const bestLabel = `Best: ${s.bestFitness}`;
          const avgLabel = `Avg: ${s.avgFitness.toFixed(1)}`;
          const textW = Math.max(ctx.measureText(genLabel).width, ctx.measureText(bestLabel).width, ctx.measureText(avgLabel).width);
          const boxW = textW + 16;
          const boxH = 46;
          // Position tooltip to avoid going off-screen
          let tx = px + 10;
          if (tx + boxW > w - PADDING.right) tx = px - boxW - 10;
          let ty = Math.min(bestY, avgY) - boxH - 6;
          if (ty < PADDING.top) ty = Math.max(bestY, avgY) + 10;

          ctx.fillStyle = colors.chart.tooltipBg;
          ctx.beginPath();
          ctx.roundRect(tx, ty, boxW, boxH, 4);
          ctx.fill();
          ctx.strokeStyle = colors.chart.tooltipBorder;
          ctx.lineWidth = 1;
          ctx.stroke();

          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';
          ctx.fillStyle = C.legendText;
          ctx.fillText(genLabel, tx + 8, ty + 4);
          ctx.fillStyle = C.bestLine;
          ctx.fillText(bestLabel, tx + 8, ty + 18);
          ctx.fillStyle = C.avgLine;
          ctx.fillText(avgLabel, tx + 8, ty + 32);

          ctx.restore();
        }
      }

      ctx.restore();
      rafIdRef.current = requestAnimationFrame(drawFrame);
    };

    rafIdRef.current = requestAnimationFrame(drawFrame);
    return () => cancelAnimationFrame(rafIdRef.current);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={styles.panel} data-help="Fitness over generations — gold line is best fitness, blue is average, green dashed line is the solution threshold (28)">
      <h3 style={styles.title} data-help="Tracks how best and average fitness evolve as generations progress">Fitness Over Generations</h3>
      <div ref={wrapperRef} style={styles.canvasWrapper}>
        <canvas
          ref={canvasRef}
          style={styles.canvas}
        />
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  panel: {
    backgroundColor: colors.bg.base,
    borderRadius: 10,
    padding: '14px 16px 12px',
    border: `1px solid ${colors.chart.tooltipBorder}`,
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
    height: '100%',
    width: '100%',
    boxSizing: 'border-box',
  },
  title: {
    margin: '0 0 8px 0',
    fontSize: 14,
    fontFamily: 'monospace',
    color: colors.text.secondary,
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
    flexShrink: 0,
  },
  canvasWrapper: {
    flex: 1,
    minHeight: 150,
    position: 'relative',
  },
  canvas: {
    width: '100%',
    height: '100%',
    borderRadius: 4,
    display: 'block',
  },
};
