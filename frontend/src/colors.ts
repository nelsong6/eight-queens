// Centralized color palette for the Eight Queens app.
// All color values should be referenced from here — no raw hex/rgba in components.

export const colors = {
  // ── Backgrounds (layered from deepest to most elevated) ──
  bg: {
    base: '#0d0d1a',
    raised: '#14142b',
    surface: '#1c1c3a',
    overlay: '#252550',
  },

  // ── Borders ──
  border: {
    subtle: '#2a2a4e',
    strong: '#3a3a5e',
  },

  // ── Text ──
  text: {
    primary: '#e2e2ef',
    secondary: '#a0a0be',
    tertiary: '#6e6e8a',
    disabled: '#4a4a64',
  },

  // ── Accent colors ──
  accent: {
    purple: '#7c6cf0',
    purpleLight: '#9a8df5',
    gold: '#f0c040',
    blue: '#6bb8f0',
    lavender: '#b89af0',
    green: '#40d89c',
    red: '#f06b6b',
    orange: '#e89040',
    teal: '#30c8b0',
  },

  // ── Chessboard ──
  board: {
    light: '#c8b8e8',
    dark: '#5c4a8a',
    attack: 'rgba(240, 80, 80, 0.35)',
    border: '#4a4a64',
  },

  // ── Chart ──
  chart: {
    bestLine: '#f0c040',
    bestGlow: 'rgba(240, 192, 64, 0.35)',
    bestFill: 'rgba(240, 192, 64, 0.08)',
    avgLine: '#6bb8f0',
    avgGlow: 'rgba(107, 184, 240, 0.3)',
    avgFill: 'rgba(107, 184, 240, 0.06)',
    solutionLine: '#40d89c',
    solutionGlow: 'rgba(64, 216, 156, 0.15)',
    grid: 'rgba(124, 108, 240, 0.07)',
    axis: 'rgba(160, 160, 190, 0.5)',
    legend: 'rgba(180, 190, 230, 0.7)',
    tooltipBg: 'rgba(20, 20, 40, 0.92)',
    tooltipBorder: 'rgba(124, 108, 240, 0.2)',
    crosshair: 'rgba(160, 160, 190, 0.25)',
  },

  // ── Semantic: operation categories (walkthrough/micro mode) ──
  category: {
    aging: '#e89040',
    pruning: '#f06b6b',
    selection: '#6bb8f0',
    crossover: '#b89af0',
    mutation: '#40d89c',
    birth: '#30c8b0',
  },

  // ── Semantic: individual age lifecycle ──
  age: {
    chromosome: '#a0a0be',  // age 0
    child: '#6bb8f0',       // age 1
    adult: '#40d89c',       // age 2
    elder: '#e89040',       // age 3
  },

  // ── Semantic: parent indicators ──
  parent: {
    a: '#6bb8f0',
    b: '#b89af0',
  },

  // ── Interactive states ──
  interactive: {
    hover: '#252550',
    selected: '#2e2e5a',
    activeGlow: 'rgba(124, 108, 240, 0.4)',
    rowStripe: '#161630',
  },
} as const;

export type Colors = typeof colors;
