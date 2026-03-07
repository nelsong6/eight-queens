import React, { useState } from 'react';
import { colors } from '../colors';
import { Chessboard } from './Chessboard';
import type { Individual } from '../engine/types';

interface Props {
  onStartMicro: () => void;
  onStartFull: () => void;
  onOpenGlossary: () => void;
}

// ---------------------------------------------------------------------------
// Solver — computes all 92 solutions once at module load
// ---------------------------------------------------------------------------

function solveQueens(): number[][] {
  const solutions: number[][] = [];
  const board = Array(8).fill(-1);

  function isSafe(col: number, row: number): boolean {
    for (let c = 0; c < col; c++) {
      const r = board[c]!;
      if (r === row || Math.abs(c - col) === Math.abs(r - row)) return false;
    }
    return true;
  }

  function place(col: number) {
    if (col === 8) { solutions.push([...board]); return; }
    for (let row = 0; row < 8; row++) {
      if (isSafe(col, row)) { board[col] = row; place(col + 1); board[col] = -1; }
    }
  }

  place(0);
  return solutions;
}

const ALL_SOLUTIONS = solveQueens(); // 92 solutions

// ---------------------------------------------------------------------------
// Mini board — the real Chessboard component, CSS-scaled down
// ---------------------------------------------------------------------------

function MiniBoard({ solution }: { solution: number[] }) {
  const individual: Individual = { id: 0, localIndex: 0, solution, fitness: 28, age: 2 };
  return <Chessboard individual={individual} showAttacks={false} />;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export const GettingStartedTab: React.FC<Props> = ({ onStartMicro, onStartFull, onOpenGlossary }) => {
  const [idx, setIdx] = useState(() => Math.floor(Math.random() * ALL_SOLUTIONS.length));

  const solution = ALL_SOLUTIONS[idx]!;

  return (
    <div style={styles.container}>
      <div style={styles.inner}>
        <div style={styles.twoCol}>
          <div style={styles.leftCol}>
            <h2 style={styles.pageTitle}>Getting Started</h2>
            <p style={styles.intro}>
              Eight Queens is a genetic algorithm visualizer. Watch evolution solve the classic 8-queens
              puzzle — or step through each pipeline phase to see exactly how it works.
            </p>

            <div style={styles.section}>
              <div style={styles.sectionHeader}>Using the Help Bar</div>
              <div style={styles.sectionBody}>
                <p style={styles.para}>
                  Hover over any labeled element in the app to see a description in the help bar just
                  below the title.
                </p>
                <p style={styles.para}>
                  Press <kbd style={styles.kbd}>s</kbd> to <span style={styles.strong}>pin</span> the
                  help text. While pinned, key terms show a{' '}
                  <span style={styles.glossaryHint}>See in Glossary →</span> link you can click to jump
                  directly to the definition.
                </p>
                <p style={{ ...styles.para, margin: 0 }}>
                  Press <kbd style={styles.kbd}>s</kbd> again to unpin and resume following the mouse.
                </p>
              </div>
            </div>

            <div style={styles.section}>
              <div style={styles.sectionHeader}>Quick Start</div>
              <div style={styles.sectionBody}>
                <p style={styles.para}>Choose how you want to explore the algorithm:</p>
                <div style={styles.buttonRow}>
                  <button style={styles.primaryBtn} onClick={onStartMicro}>
                    Explore with Granular Step →
                  </button>
                  <button style={styles.secondaryBtn} onClick={onStartFull}>
                    Watch a Full Run →
                  </button>
                </div>
                <p style={styles.hint}>
                  <span style={styles.strong}>Granular Step</span> walks through each of the 7 pipeline
                  operations one phase at a time — ideal for learning what the algorithm actually does.
                  <br />
                  <span style={styles.strong}>Full Step</span> runs complete generations and shows the
                  board, config, and fitness chart side by side.
                </p>
              </div>
            </div>

            <div style={styles.section}>
              <div style={styles.sectionHeader}>Reference</div>
              <div style={styles.sectionBody}>
                <p style={{ ...styles.para, margin: 0 }}>
                  Unfamiliar with genetic algorithms or the terminology used in this app?{' '}
                  <button style={styles.linkBtn} onClick={onOpenGlossary}>
                    Browse Help &amp; Glossary →
                  </button>
                </p>
              </div>
            </div>
          </div>

          <div style={styles.rightCol}>
            <div style={styles.boardWidget}>
              <div style={styles.boardLabel}>92 Solutions</div>
              <MiniBoard solution={solution} />
              <div style={styles.boardCaption}>Solution {idx + 1} of {ALL_SOLUTIONS.length}</div>
              <div style={styles.boardNav}>
                <button
                  style={styles.navBtn}
                  onClick={() => setIdx(i => (i - 1 + ALL_SOLUTIONS.length) % ALL_SOLUTIONS.length)}
                >
                  ←
                </button>
                <button
                  style={styles.navBtn}
                  onClick={() => setIdx(i => (i + 1) % ALL_SOLUTIONS.length)}
                >
                  →
                </button>
              </div>
              <p style={styles.boardHint}>
                Place 8 queens so none attack each other. There are exactly 92 ways to do it.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const MINI_BOARD_PX = 384; // 8 cells × 48px

const styles: Record<string, React.CSSProperties> = {
  container: {
    flex: 1,
    overflowY: 'auto',
    padding: '24px',
  },
  inner: {
    maxWidth: 920,
    margin: '0 auto',
    fontFamily: 'monospace',
  },
  twoCol: {
    display: 'flex',
    gap: 32,
    alignItems: 'flex-start',
  },
  leftCol: {
    flex: 1,
    minWidth: 0,
  },
  rightCol: {
    flexShrink: 0,
    width: MINI_BOARD_PX,
  },
  boardWidget: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
    paddingTop: 4,
  },
  boardLabel: {
    fontSize: 13,
    fontFamily: 'monospace',
    fontWeight: 'bold',
    color: colors.text.primary,
    letterSpacing: 0.2,
    alignSelf: 'flex-start',
  },
  boardCaption: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: colors.text.tertiary,
  },
  boardNav: {
    display: 'flex',
    gap: 8,
  },
  navBtn: {
    padding: '4px 14px',
    fontSize: 13,
    fontFamily: 'monospace',
    backgroundColor: colors.bg.raised,
    color: colors.text.secondary,
    border: `1px solid ${colors.border.subtle}`,
    borderRadius: 4,
    cursor: 'pointer',
  },
  boardHint: {
    fontSize: 10,
    fontFamily: 'monospace',
    color: colors.text.tertiary,
    lineHeight: '1.6',
    textAlign: 'center',
    margin: 0,
  },
  pageTitle: {
    margin: '0 0 8px 0',
    fontSize: 20,
    color: colors.text.primary,
    fontFamily: 'monospace',
    fontWeight: 'bold',
    letterSpacing: -0.5,
  },
  intro: {
    fontSize: 13,
    color: colors.text.secondary,
    lineHeight: '1.6',
    margin: '0 0 24px 0',
  },
  section: {
    marginBottom: 16,
    border: `1px solid ${colors.border.subtle}`,
    borderRadius: 6,
    overflow: 'hidden',
  },
  sectionHeader: {
    padding: '10px 14px',
    backgroundColor: colors.bg.raised,
    fontSize: 13,
    fontFamily: 'monospace',
    fontWeight: 'bold',
    color: colors.text.primary,
    letterSpacing: 0.2,
  },
  sectionBody: {
    padding: '12px 16px',
    backgroundColor: colors.bg.surface,
  },
  para: {
    fontSize: 12,
    color: colors.text.secondary,
    lineHeight: '1.7',
    margin: '0 0 10px 0',
  },
  hint: {
    fontSize: 11,
    color: colors.text.tertiary,
    lineHeight: '1.7',
    margin: '12px 0 0 0',
  },
  kbd: {
    display: 'inline-block',
    padding: '1px 6px',
    fontSize: 11,
    fontFamily: 'monospace',
    backgroundColor: colors.bg.overlay,
    border: `1px solid ${colors.border.strong}`,
    borderRadius: 3,
    color: colors.text.primary,
  },
  strong: {
    color: colors.text.primary,
    fontWeight: 'bold',
  },
  glossaryHint: {
    color: colors.accent.purple,
    fontWeight: 'bold',
    fontSize: 11,
  },
  buttonRow: {
    display: 'flex',
    gap: 12,
    margin: '8px 0',
    flexWrap: 'wrap' as const,
  },
  primaryBtn: {
    padding: '10px 20px',
    fontSize: 12,
    fontFamily: 'monospace',
    fontWeight: 'bold',
    backgroundColor: colors.accent.purple,
    color: '#fff',
    border: 'none',
    borderRadius: 5,
    cursor: 'pointer',
    letterSpacing: 0.3,
  },
  secondaryBtn: {
    padding: '10px 20px',
    fontSize: 12,
    fontFamily: 'monospace',
    backgroundColor: colors.bg.raised,
    color: colors.text.secondary,
    border: `1px solid ${colors.border.subtle}`,
    borderRadius: 5,
    cursor: 'pointer',
    letterSpacing: 0.3,
  },
  linkBtn: {
    padding: 0,
    fontSize: 12,
    fontFamily: 'monospace',
    background: 'none',
    border: 'none',
    color: colors.accent.purple,
    cursor: 'pointer',
    textDecoration: 'underline',
    letterSpacing: 0.2,
  },
};
