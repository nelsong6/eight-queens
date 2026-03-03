import React, { useRef, useEffect } from 'react';
import type { Individual } from '../engine/types';
import { BOARD_SIZE, MAX_FITNESS } from '../engine/types';

interface Props {
  individual: Individual | null;
  label?: string;
}

// ---------------------------------------------------------------------------
// Sprite loader
// ---------------------------------------------------------------------------

const SPRITE_PATHS = {
  queen: '/sprites/queen.svg',
  queenSolved: '/sprites/queen-solved.svg',
} as const;

type SpriteMap = Record<keyof typeof SPRITE_PATHS, HTMLImageElement>;

let spriteCache: SpriteMap | null = null;
let spritePromise: Promise<SpriteMap> | null = null;

function loadSprites(): Promise<SpriteMap> {
  if (spriteCache) return Promise.resolve(spriteCache);
  if (spritePromise) return spritePromise;

  const entries = Object.entries(SPRITE_PATHS) as [keyof typeof SPRITE_PATHS, string][];
  spritePromise = Promise.all(
    entries.map(
      ([key, src]) =>
        new Promise<[keyof typeof SPRITE_PATHS, HTMLImageElement]>((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve([key, img]);
          img.onerror = reject;
          img.src = src;
        }),
    ),
  ).then((pairs) => {
    spriteCache = Object.fromEntries(pairs) as SpriteMap;
    return spriteCache;
  });
  return spritePromise;
}

// ---------------------------------------------------------------------------
// Board colors (marble-inspired from legacy chessboard.png)
// ---------------------------------------------------------------------------

const LIGHT_SQUARE = '#f0e4d0';  // warm cream
const DARK_SQUARE = '#a08060';   // warm brown
const ATTACK_TINT = 'rgba(255, 50, 50, 0.35)';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const CELL_SIZE = 48;
const BOARD_PX = CELL_SIZE * BOARD_SIZE;

export const Chessboard: React.FC<Props> = ({ individual, label }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const spritesRef = useRef<SpriteMap | null>(spriteCache);

  // Load sprites once
  useEffect(() => {
    if (!spritesRef.current) {
      loadSprites().then((sprites) => {
        spritesRef.current = sprites;
        draw();
      });
    }
  }, []);

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, BOARD_PX, BOARD_PX);
    const sprites = spritesRef.current;
    const isSolved = individual?.fitness === MAX_FITNESS;

    // Draw checkerboard
    for (let col = 0; col < BOARD_SIZE; col++) {
      for (let row = 0; row < BOARD_SIZE; row++) {
        const isLight = (col + row) % 2 === 0;
        ctx.fillStyle = isLight ? LIGHT_SQUARE : DARK_SQUARE;
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
          ctx.fillStyle = ATTACK_TINT;
          ctx.fillRect(i * CELL_SIZE, ri * CELL_SIZE, CELL_SIZE, CELL_SIZE);
          ctx.fillRect(j * CELL_SIZE, rj * CELL_SIZE, CELL_SIZE, CELL_SIZE);
        }
      }
    }

    // Draw queens
    const pad = CELL_SIZE * 0.08;
    const spriteSize = CELL_SIZE - pad * 2;

    for (let col = 0; col < BOARD_SIZE; col++) {
      const row = individual.solution[col]!;
      const x = col * CELL_SIZE + pad;
      const y = row * CELL_SIZE + pad;

      if (sprites) {
        const queenSprite = isSolved ? sprites.queenSolved : sprites.queen;
        ctx.drawImage(queenSprite, x, y, spriteSize, spriteSize);
      } else {
        // Fallback: draw circle + crown before sprites load
        const cx = col * CELL_SIZE + CELL_SIZE / 2;
        const cy = row * CELL_SIZE + CELL_SIZE / 2;

        ctx.beginPath();
        ctx.arc(cx, cy, CELL_SIZE * 0.35, 0, Math.PI * 2);
        ctx.fillStyle = isSolved ? '#4caf50' : '#ffd700';
        ctx.fill();
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        ctx.stroke();

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
        ctx.fillStyle = isSolved ? '#2e7d32' : '#b8860b';
        ctx.fill();
        ctx.stroke();
      }
    }
  };

  useEffect(() => {
    draw();
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
  },
  info: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: '#ccc',
  },
};
