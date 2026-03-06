import React, { useMemo } from 'react';

type SessionPhase = 'config' | 'running' | 'review';

interface BreadcrumbSegment {
  label: string;
  onClick: (() => void) | null;
  helpText?: string;
}

interface BreadcrumbTrailProps {
  sessionPhase: SessionPhase;
  granularity: 'full' | 'micro';
  walkthroughPhase: number | null;
  browsePairIndex: number | null;
  zoomedPanel: string | null;
  breedingCategory: string;
  onSetGranularity: (g: 'full' | 'micro') => void;
  onClearWalkthrough: () => void;
  onClearZoom: () => void;
}

const PHASE_NAMES = ['Selection', 'Crossover', 'Mutation', 'Results'];

const PANEL_LABELS: Record<string, string> = {
  status: 'Status',
  board: 'Chessboard',
  config: 'Session Data',
  breeding: 'Breeding Results',
  chart: 'Fitness Over Generations',
  history: 'Run History',
};

export const BreadcrumbTrail: React.FC<BreadcrumbTrailProps> = ({
  sessionPhase,
  granularity,
  walkthroughPhase,
  browsePairIndex,
  zoomedPanel,
  breedingCategory,
  onSetGranularity,
  onClearWalkthrough,
  onClearZoom,
}) => {
  const segments = useMemo((): BreadcrumbSegment[] => {
    const result: BreadcrumbSegment[] = [];
    const isMicro = sessionPhase === 'running' && granularity === 'micro';
    const hasWalkthrough = isMicro && walkthroughPhase !== null;
    const hasZoom = zoomedPanel !== null;

    // Determine if this segment has deeper levels (makes it clickable)
    const hasDeeper = isMicro || hasZoom;

    // Layer 1: Session phase (always present)
    const phaseLabel =
      sessionPhase === 'config' ? 'Config' :
      sessionPhase === 'review' ? 'Review' : 'Running';

    result.push({
      label: phaseLabel,
      onClick: hasDeeper ? () => { onSetGranularity('full'); onClearZoom(); } : null,
      helpText: sessionPhase === 'config'
        ? 'Configure algorithm parameters before starting'
        : sessionPhase === 'review'
          ? 'Algorithm solved — reviewing solution'
          : 'Algorithm is running',
    });

    // Layer 2: Granularity (only when running + micro)
    if (isMicro) {
      const microHasDeeper = hasWalkthrough || hasZoom;
      result.push({
        label: 'Micro',
        onClick: microHasDeeper ? () => { onClearWalkthrough(); onClearZoom(); } : null,
        helpText: 'Micro-step mode: stepping through individual algorithm phases',
      });

      // Layer 3: Walkthrough phase
      if (hasWalkthrough) {
        const phaseName = PHASE_NAMES[walkthroughPhase!] ?? 'Unknown';
        result.push({
          label: phaseName,
          onClick: hasZoom ? () => { onClearZoom(); } : null,
          helpText: `Walkthrough step ${walkthroughPhase! + 1}/4: ${phaseName}`,
        });

        // Layer 4: Pair indicator (crossover only)
        if (walkthroughPhase === 1 && browsePairIndex !== null) {
          result.push({
            label: `Pair #${browsePairIndex + 1}`,
            onClick: null,
            helpText: `Viewing breeding pair ${browsePairIndex + 1}`,
          });
        }
      }
    }

    // Layer 5: Zoomed panel
    if (zoomedPanel) {
      const label = PANEL_LABELS[zoomedPanel] ?? zoomedPanel;
      result.push({
        label,
        onClick: null,
        helpText: `${label} panel expanded`,
      });

      // Layer 6: Breeding category
      if (zoomedPanel === 'breeding') {
        result.push({
          label: breedingCategory,
          onClick: null,
          helpText: `Viewing ${breedingCategory.toLowerCase()}`,
        });
      }
    }

    return result;
  }, [sessionPhase, granularity, walkthroughPhase, browsePairIndex, zoomedPanel, breedingCategory,
      onSetGranularity, onClearWalkthrough, onClearZoom]);

  return (
    <div style={styles.bar} data-help="Navigation breadcrumb — click any segment to return to that level">
      <span style={styles.separator}>&gt;</span>
      {segments.map((seg, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span style={styles.separator}>&gt;</span>}
          {seg.onClick ? (
            <span
              style={styles.clickable}
              onClick={seg.onClick}
              data-help={seg.helpText}
            >
              {seg.label}
            </span>
          ) : (
            <span style={styles.current} data-help={seg.helpText}>
              {seg.label}
            </span>
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  bar: {
    height: 24,
    backgroundColor: '#12122a',
    borderBottom: '1px solid #2a2a4a',
    display: 'flex',
    alignItems: 'center',
    paddingLeft: 24,
    paddingRight: 24,
  },
  separator: {
    fontSize: 10,
    fontFamily: 'monospace',
    color: '#444',
    margin: '0 8px',
    userSelect: 'none' as const,
  },
  clickable: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: '#6c5ce7',
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
  },
  current: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: '#e0e0e0',
    whiteSpace: 'nowrap' as const,
  },
};
