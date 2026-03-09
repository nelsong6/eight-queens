import React, { useMemo } from 'react';
import { getOp, OPS_PER_GENERATION } from '../engine/time-coordinate';
import { colors } from '../colors';
import type { ActiveTab } from './TabBar';

type SessionPhase = 'config' | 'running' | 'review';

interface BreadcrumbSegment {
  label: string;
  onClick: (() => void) | null;
  helpText?: string;
}

interface BreadcrumbTrailProps {
  sessionPhase: SessionPhase;
  activeTab: ActiveTab;
  walkthroughPhase: number | null;
  browsePairIndex: number | null;
  zoomedPanel: string | null;
  breedingCategory: string;
  showSpecimen: boolean;
  onTabChange: (tab: ActiveTab) => void;
  onSetGranularity: (g: 'full' | 'micro') => void;
  onClearWalkthrough: () => void;
  onClearZoom: () => void;
  onClearSpecimen: () => void;
}

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
  activeTab,
  walkthroughPhase,
  browsePairIndex,
  zoomedPanel,
  breedingCategory,
  showSpecimen,
  onTabChange,
  onSetGranularity,
  onClearWalkthrough,
  onClearZoom,
  onClearSpecimen,
}) => {
  const segments = useMemo((): BreadcrumbSegment[] => {
    const result: BreadcrumbSegment[] = [];
    const isMicro = activeTab === 'micro';
    const isFull = activeTab === 'full';
    const hasWalkthrough = isMicro && walkthroughPhase !== null;
    const hasZoom = zoomedPanel !== null;

    const phaseLabel =
      sessionPhase === 'config' ? 'Config' :
      sessionPhase === 'review' ? 'Review' : 'Running';
    const phaseHelpText =
      sessionPhase === 'config' ? 'Configure algorithm parameters before starting' :
      sessionPhase === 'review' ? 'Algorithm solved — reviewing solution' :
      'Algorithm is running';

    if (activeTab === 'getting-started') {
      result.push({
        label: phaseLabel,
        onClick: () => onTabChange('full'),
        helpText: phaseHelpText,
      });
      result.push({
        label: 'Getting Started',
        onClick: null,
        helpText: 'Introduction, help bar guide, and quick-start buttons',
      });
      return result;
    }

    if (activeTab === 'help') {
      result.push({
        label: phaseLabel,
        onClick: () => onTabChange('full'),
        helpText: phaseHelpText,
      });
      result.push({
        label: 'Help / Glossary',
        onClick: null,
        helpText: 'Genetic algorithm concepts, pipeline reference, and glossary of terms',
      });
      return result;
    }

    // Layer 1: Session phase (for full/micro tabs)
    const phaseHasDeeper = isMicro || hasZoom;
    result.push({
      label: phaseLabel,
      onClick: phaseHasDeeper ? () => { onSetGranularity('full'); onClearZoom(); } : null,
      helpText: phaseHelpText,
    });

    // Layer 2: Tab name
    if (isFull) {
      result.push({
        label: 'Full Step',
        onClick: hasZoom ? () => { onClearZoom(); } : null,
        helpText: 'Full-step mode: stepping through complete generations',
      });
    }

    if (isMicro) {
      const microHasDeeper = hasWalkthrough || hasZoom;
      result.push({
        label: 'Granular Step',
        onClick: microHasDeeper ? () => { onClearWalkthrough(); onClearZoom(); } : null,
        helpText: 'Granular step mode: stepping through each algorithm phase',
      });

      // Layer 3: Walkthrough phase (walkthroughPhase = operation index)
      if (hasWalkthrough) {
        const operation = walkthroughPhase!;
        const op = getOp(operation);
        const screenIndex = operation + 1;
        const totalScreens = OPS_PER_GENERATION;
        result.push({
          label: `${op.category} — ${op.name}`,
          onClick: hasZoom ? () => { onClearZoom(); } : null,
          helpText: `Step ${screenIndex}/${totalScreens}: ${op.name} [${op.type}]`,
        });

        // Layer 4: Pair indicator (generate chromosomes)
        if (operation === 3 && browsePairIndex !== null) {
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

    // Specimen layer: append when specimen inspector is open in micro mode
    if (showSpecimen && isMicro) {
      // Make the last segment clickable to close the specimen view
      const last = result[result.length - 1];
      if (last && !last.onClick) {
        last.onClick = onClearSpecimen;
      }
      result.push({
        label: 'Specimen',
        onClick: null,
        helpText: 'Inspecting selected specimen',
      });
    }

    return result;
  }, [sessionPhase, activeTab, walkthroughPhase, browsePairIndex, zoomedPanel, breedingCategory,
      showSpecimen, onTabChange, onSetGranularity, onClearWalkthrough, onClearZoom, onClearSpecimen]);

  return (
    <div style={styles.bar} data-help="Navigation breadcrumb — click any segment to return to that level">
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
    backgroundColor: colors.bg.raised,
    borderBottom: `1px solid ${colors.border.subtle}`,
    display: 'flex',
    alignItems: 'center',
    paddingLeft: 24,
    paddingRight: 24,
  },
  separator: {
    fontSize: 10,
    fontFamily: 'monospace',
    color: colors.text.disabled,
    margin: '0 8px',
    userSelect: 'none' as const,
  },
  clickable: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: colors.accent.purple,
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
  },
  current: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: colors.text.primary,
    whiteSpace: 'nowrap' as const,
  },
};
