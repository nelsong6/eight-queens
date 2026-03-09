/**
 * PipelineBar — universal navigation graphic shown in the sticky header.
 * Clicking any segment navigates to that operation.
 */
import React from 'react';
import type { TimeCoordinate } from '../engine/types';
import { GENERATION_OPS, OPS_PER_GENERATION } from '../engine/time-coordinate';
import { CATEGORY_COLORS } from './walkthrough/SpecimenList';
import { colors } from '../colors';

interface Props {
  coordinate: TimeCoordinate;
  onNavigate: (operation: number) => void;
  /** Dims the bar when there is no result data yet */
  hasResult: boolean;
}

export const PipelineBar: React.FC<Props> = ({ coordinate, onNavigate, hasResult }) => {
  const currentStep = coordinate.operation;
  const totalSteps = OPS_PER_GENERATION;
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

      {/* Main bar: 6 segments (one per operation) */}
      <div style={styles.barWrap}>
        <div style={styles.bar}>
          {GENERATION_OPS.map((op, opIdx) => {
            const color = CATEGORY_COLORS[op.category] ?? colors.text.disabled;
            const isCurrent = currentStep === opIdx;
            const isPast = currentStep > opIdx;
            return (
              <div
                key={opIdx}
                onClick={() => onNavigate(opIdx)}
                data-help={`${op.category}: ${op.name}`}
                style={{
                  ...styles.segment,
                  flex: 1,
                  backgroundColor: isCurrent ? color : isPast ? color + '55' : colors.bg.raised,
                  boxShadow: isCurrent ? `0 0 8px ${color}99` : 'none',
                }}
              />
            );
          })}
        </div>

        {/* Category labels */}
        <div style={styles.labels}>
          {GENERATION_OPS.map((op, opIdx) => {
            const isActive = coordinate.operation === opIdx;
            const isPastOp = coordinate.operation > opIdx;
            const color = CATEGORY_COLORS[op.category] ?? colors.text.disabled;
            return (
              <div
                key={opIdx}
                onClick={() => onNavigate(opIdx)}
                style={{
                  ...styles.label,
                  color: isActive ? color : isPastOp ? color + '88' : colors.text.tertiary,
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
  segment: {
    height: '100%',
    transition: 'box-shadow 0.2s',
    cursor: 'pointer',
    borderRadius: 2,
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
    transition: 'none',
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
};
