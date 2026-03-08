/**
 * PipelineBar — universal navigation graphic shown in the sticky header.
 * Extracted and enlarged from SubPhaseScreen's PipelineProgress.
 * Clicking any segment navigates to that operation/boundary.
 */
import React from 'react';
import type { TimeCoordinate } from '../engine/types';
import { GENERATION_OPS, OPS_PER_GENERATION, SCREENS_PER_OP } from '../engine/time-coordinate';
import { CATEGORY_COLORS } from './walkthrough/IndividualList';
import { colors } from '../colors';

const BOUNDARY_LABELS = ['Before', 'Transform', 'After'] as const;

interface Props {
  coordinate: TimeCoordinate;
  onNavigate: (operation: number, boundary: 0 | 1 | 2) => void;
  /** Dims the bar when there is no result data yet */
  hasResult: boolean;
}

export const PipelineBar: React.FC<Props> = ({ coordinate, onNavigate, hasResult }) => {
  const currentStep = coordinate.operation * SCREENS_PER_OP + coordinate.boundary;
  const totalSteps = OPS_PER_GENERATION * SCREENS_PER_OP;
  return (
    <div
      style={{ ...styles.container, opacity: hasResult ? 1 : 0.4 }}
      data-help={`Pipeline position: Step ${currentStep + 1}/${totalSteps} — ${GENERATION_OPS[coordinate.operation]!.category}: ${GENERATION_OPS[coordinate.operation]!.name}`}
    >
      {/* Step counter */}
      <div style={styles.stepCounter}>
        <span style={styles.stepCurrent}>{currentStep + 1}</span>
        <span style={styles.stepSlash}>/</span>
        <span style={styles.stepTotal}>{totalSteps}</span>
      </div>

      {/* Main bar: 21 segments (7 operations × 3 boundaries) */}
      <div style={styles.barWrap}>
        <div key={coordinate.generation} style={styles.bar}>
          {GENERATION_OPS.map((op, opIdx) => {
            const color = CATEGORY_COLORS[op.category] ?? colors.text.disabled;
            const isActiveOp = coordinate.operation === opIdx;
            return (
              <div key={opIdx} style={{ ...styles.opGroup, outline: isActiveOp ? `1px solid ${color}55` : 'none' }}>
                {([0, 1, 2] as const).map((bIdx) => {
                  const stepIdx = opIdx * SCREENS_PER_OP + bIdx;
                  const isCurrent = currentStep === stepIdx;
                  const isPast = currentStep > stepIdx;
                  return (
                    <div
                      key={bIdx}
                      onClick={() => onNavigate(opIdx, bIdx)}
                      data-help={`${op.category}: ${op.name} (${BOUNDARY_LABELS[bIdx]})`}
                      style={{
                        ...styles.segment,
                        flex: 1,
                        backgroundColor: isCurrent ? color : isPast ? color + '55' : colors.bg.raised,
                        borderRight: bIdx < 2 ? `1px solid ${isPast || isCurrent ? color + '33' : colors.bg.base}` : 'none',
                        boxShadow: isCurrent ? `0 0 8px ${color}99` : 'none',
                      }}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* Category labels */}
        <div style={styles.labels}>
          {GENERATION_OPS.map((op, opIdx) => {
            const isActive = coordinate.operation === opIdx;
            const color = CATEGORY_COLORS[op.category] ?? colors.text.disabled;
            return (
              <div
                key={opIdx}
                onClick={() => onNavigate(opIdx, 0)}
                style={{
                  ...styles.label,
                  color: isActive ? color : colors.text.disabled,
                  fontWeight: isActive ? 'bold' : 'normal',
                  cursor: 'pointer',
                }}
              >
                {op.category}
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '6px 24px',
    backgroundColor: colors.bg.raised,
    borderBottom: `1px solid ${colors.border.subtle}`,
    transition: 'opacity 0.2s',
  },
  stepCounter: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 1,
    fontFamily: 'monospace',
    flexShrink: 0,
  },
  stepCurrent: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text.primary,
    minWidth: 20,
    textAlign: 'right' as const,
  },
  stepSlash: {
    fontSize: 11,
    color: colors.text.disabled,
  },
  stepTotal: {
    fontSize: 11,
    color: colors.text.tertiary,
  },
  barWrap: {
    flex: 1,
    minWidth: 0,
  },
  bar: {
    display: 'flex',
    gap: 2,
    height: 14,
    borderRadius: 3,
    overflow: 'hidden',
  },
  opGroup: {
    flex: 1,
    display: 'flex',
    gap: 0,
    height: '100%',
    borderRadius: 2,
    overflow: 'hidden',
    outlineOffset: 1,
  },
  segment: {
    height: '100%',
    transition: 'background-color 0.2s, box-shadow 0.2s',
    cursor: 'pointer',
  },
  labels: {
    display: 'flex',
    marginTop: 3,
    gap: 2,
  },
  label: {
    flex: 1,
    fontSize: 9,
    textAlign: 'center' as const,
    letterSpacing: 0.3,
    textTransform: 'uppercase' as const,
    transition: 'color 0.2s',
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
};
