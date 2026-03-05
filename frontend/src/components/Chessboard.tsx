import React, { useRef, useEffect, useState, useMemo } from 'react';
import type { Individual } from '../engine/types';
import { BOARD_SIZE, MAX_FITNESS } from '../engine/types';

interface Props {
  individual: Individual | null;
  label?: string;
  showAttacks?: boolean;
  /** Algorithm interval in ms — drives animation tier logic. Undefined = manual step. */
  speed?: number;
  /** When true, the board scales up to fill its container */
  zoomed?: boolean;
}

// ---------------------------------------------------------------------------
// Sprite loader - loads original queen.png from C# project
// ---------------------------------------------------------------------------

let queenImage: HTMLImageElement | null = null;
let queenLoadPromise: Promise<HTMLImageElement> | null = null;

function loadQueenSprite(): Promise<HTMLImageElement> {
  if (queenImage) return Promise.resolve(queenImage);
  if (queenLoadPromise) return queenLoadPromise;

  queenLoadPromise = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      queenImage = img;
      resolve(img);
    };
    img.onerror = reject;
    img.src = '/sprites/queen.png';
  });
  return queenLoadPromise;
}

// ---------------------------------------------------------------------------
// Board colors (marble-inspired from legacy chessboard.png)
// ---------------------------------------------------------------------------

const LIGHT_SQUARE = '#f0e4d0';  // warm cream
const DARK_SQUARE = '#a08060';   // warm brown
const ATTACK_TINT = 'rgba(255, 50, 50, 0.35)';

// ---------------------------------------------------------------------------
// Animation tier thresholds (ms)
// ---------------------------------------------------------------------------

const TIER_ANIMATED_MIN = 300;   // above this: full 300ms animation
const TIER_THROTTLE_MAX = 100;   // below this: throttle visual updates
const THROTTLE_INTERVAL = 150;   // ms between visual updates in throttled tier

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const CELL_SIZE = 48;
const BOARD_PX = CELL_SIZE * BOARD_SIZE;
const PAD = CELL_SIZE * 0.08;
const SPRITE_SIZE = CELL_SIZE - PAD * 2;

export const Chessboard: React.FC<Props> = ({ individual, label, showAttacks = true, speed, zoomed = false }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [spriteLoaded, setSpriteLoaded] = useState(!!queenImage);
  const [boardScale, setBoardScale] = useState(1);

  // Scale board to fill wrapper when zoomed
  useEffect(() => {
    if (!zoomed || !wrapperRef.current) {
      setBoardScale(1);
      return;
    }
    const observer = new ResizeObserver(entries => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      // Reserve space for label (~20px) + info (~20px)
      const availH = height - 50;
      const s = Math.min(width / BOARD_PX, availH / BOARD_PX);
      setBoardScale(Math.max(1, s));
    });
    observer.observe(wrapperRef.current);
    return () => observer.disconnect();
  }, [zoomed]);

  // Throttle state: the individual actually being rendered
  const [displayedIndividual, setDisplayedIndividual] = useState(individual);
  const lastRenderTimeRef = useRef(0);
  const pendingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load sprite once
  useEffect(() => {
    if (!queenImage) {
      loadQueenSprite().then(() => setSpriteLoaded(true));
    }
  }, []);

  // Tier logic
  const transitionMs = useMemo(() => {
    if (speed === undefined) return 300; // manual step
    if (speed >= TIER_ANIMATED_MIN) return 300;
    if (speed >= TIER_THROTTLE_MAX) return Math.round(speed * 0.7);
    return 0; // throttled tier: instant snap
  }, [speed]);

  const isThrottled = speed !== undefined && speed < TIER_THROTTLE_MAX;

  // Throttle / pass-through logic for incoming individual
  useEffect(() => {
    if (!isThrottled) {
      // Tiers 1 & 2: render every individual immediately
      setDisplayedIndividual(individual);
      return;
    }

    // Tier 3: throttle visual updates
    const now = Date.now();
    const elapsed = now - lastRenderTimeRef.current;

    if (elapsed >= THROTTLE_INTERVAL) {
      // Enough time passed — render now
      lastRenderTimeRef.current = now;
      setDisplayedIndividual(individual);
    } else {
      // Too soon — schedule a deferred render with the latest value
      if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
      pendingTimerRef.current = setTimeout(() => {
        lastRenderTimeRef.current = Date.now();
        setDisplayedIndividual(individual);
        pendingTimerRef.current = null;
      }, THROTTLE_INTERVAL - elapsed);
    }

    return () => {
      if (pendingTimerRef.current) {
        clearTimeout(pendingTimerRef.current);
        pendingTimerRef.current = null;
      }
    };
  }, [individual, isThrottled]);

  // Draw board squares + attack highlights on canvas (no queens)
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
        ctx.fillStyle = isLight ? LIGHT_SQUARE : DARK_SQUARE;
        ctx.fillRect(col * CELL_SIZE, row * CELL_SIZE, CELL_SIZE, CELL_SIZE);
      }
    }

    if (!displayedIndividual || !showAttacks) return;

    // Highlight attacking pairs in red
    for (let i = 0; i < BOARD_SIZE; i++) {
      for (let j = i + 1; j < BOARD_SIZE; j++) {
        const ri = displayedIndividual.solution[i]!;
        const rj = displayedIndividual.solution[j]!;
        const attacking =
          ri === rj || Math.abs(i - j) === Math.abs(ri - rj);
        if (attacking) {
          ctx.fillStyle = ATTACK_TINT;
          ctx.fillRect(i * CELL_SIZE, ri * CELL_SIZE, CELL_SIZE, CELL_SIZE);
          ctx.fillRect(j * CELL_SIZE, rj * CELL_SIZE, CELL_SIZE, CELL_SIZE);
        }
      }
    }
  }, [displayedIndividual, showAttacks]);

  const isSolved = displayedIndividual?.fitness === MAX_FITNESS;

  return (
    <div ref={wrapperRef} style={{ ...styles.wrapper, ...(zoomed ? { width: '100%', height: '100%' } : {}) }} data-help="8×8 board showing queen placements — red squares indicate attacking pairs">
      {label && <div style={styles.label} data-help="What the board is currently displaying — random placement, best individual, or solution">{label}</div>}
      <div style={{ ...styles.boardContainer, transform: `scale(${boardScale})`, transformOrigin: 'top center' }}>
        <canvas
          ref={canvasRef}
          width={BOARD_PX}
          height={BOARD_PX}
          style={styles.canvas}
        />
        {/* Queen DOM overlay */}
        {spriteLoaded && displayedIndividual && displayedIndividual.solution.map((row, col) => (
          <img
            key={col}
            src="/sprites/queen.png"
            alt=""
            style={{
              position: 'absolute',
              left: col * CELL_SIZE + PAD,
              top: row * CELL_SIZE + PAD,
              width: SPRITE_SIZE,
              height: SPRITE_SIZE,
              transition: transitionMs > 0 ? `top ${transitionMs}ms ease-in-out` : 'none',
              pointerEvents: 'none',
              filter: isSolved
                ? 'brightness(0.85) sepia(1) hue-rotate(80deg) saturate(2.5)'
                : 'none',
            }}
          />
        ))}
      </div>
      {displayedIndividual && (
        <div style={styles.info} data-help="Chromosome (row positions for each column) and fitness score — 28/28 means no queens attack each other">
          [{displayedIndividual.solution.join(', ')}] &mdash; Fitness: {displayedIndividual.fitness}/{MAX_FITNESS}
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
  boardContainer: {
    position: 'relative',
    width: BOARD_PX,
    height: BOARD_PX,
    border: '2px solid #555',
    borderRadius: 4,
    overflow: 'hidden',
  },
  canvas: {
    display: 'block',
  },
  info: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: '#ccc',
  },
};
