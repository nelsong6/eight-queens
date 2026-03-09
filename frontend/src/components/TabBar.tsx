import React from 'react';
import { colors } from '../colors';

export type ActiveTab = 'getting-started' | 'config' | 'full' | 'micro' | 'help';

type SessionPhase = 'config' | 'running' | 'review';

interface Props {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  sessionPhase: SessionPhase;
}

interface TabDef {
  id: ActiveTab;
  label: string;
  helpText: string;
  disabled?: boolean;
}

export const TabBar: React.FC<Props> = ({ activeTab, onTabChange, sessionPhase }) => {
  const tabs: TabDef[] = [
    {
      id: 'getting-started',
      label: 'Getting Started',
      helpText: 'Introduction, help bar guide, and quick-start buttons',
    },
    {
      id: 'config',
      label: 'Config',
      helpText: 'Algorithm parameters: population size, crossover range, and mutation rate',
    },
    {
      id: 'micro',
      label: 'Granular Step',
      helpText: 'Step through each atomic pipeline phase with full before/transform/after detail',
      disabled: sessionPhase === 'review',
    },
    {
      id: 'full',
      label: 'Full Step',
      helpText: 'Complete generation view: board, config, chart, and pipeline summary side by side',
    },
    {
      id: 'help',
      label: 'Help / Glossary',
      helpText: 'Genetic algorithm concepts, pipeline reference, and glossary of terms',
    },
  ];

  return (
    <div style={styles.bar}>
      {tabs.map((tab, index) => {
        const isActive = activeTab === tab.id;
        const isDisabled = !!tab.disabled;
        return (
          <div
            key={tab.id}
            style={{
              ...styles.wrapper,
              ...(isActive ? styles.wrapperActive : styles.wrapperInactive),
              ...(isActive && index === 0 ? { borderTop: 'none' } : {}),
              opacity: isDisabled ? 0.35 : 1,
            }}
          >
            <button
              className="tab-nav"
              onClick={() => !isDisabled && onTabChange(tab.id)}
              disabled={isDisabled}
              data-help={tab.helpText}
              style={{
                ...styles.tab,
                '--tab-color': isActive ? colors.text.primary : colors.text.tertiary,
                fontWeight: isActive ? 'bold' : 'normal' as const,
                cursor: isDisabled ? 'not-allowed' : 'pointer',
              } as React.CSSProperties}
            >
              {tab.label}
            </button>
          </div>
        );
      })}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles: Record<string, React.CSSProperties> = {
  bar: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'stretch',
    paddingBottom: 16,
    gap: 0,
  },
  // Inactive wrapper uses padding instead of transparent border to reserve
  // the same 1px space — avoids 'transparent' keyword which color-scheme:dark
  // can render as white.
  wrapper: {
    padding: '1px 0 1px 1px',
    position: 'relative' as const,
    marginBottom: -1,
    zIndex: 0,
  },
  wrapperActive: {
    padding: 0,
    borderLeft: `1px solid ${colors.border.subtle}`,
    borderTop: `1px solid ${colors.border.subtle}`,
    borderBottom: `1px solid ${colors.border.subtle}`,
    borderRight: 'none',
    backgroundColor: colors.bg.raised,
    marginRight: -1,
    zIndex: 1,
  },
  wrapperInactive: {},
  tab: {
    padding: '10px 16px',
    fontSize: 12,
    fontFamily: 'monospace',
    backgroundColor: 'transparent',
    WebkitAppearance: 'none' as const,
    appearance: 'none' as const,
    outline: 'none',
    border: 'none',
    width: '100%',
    display: 'block' as const,
    whiteSpace: 'nowrap' as const,
    letterSpacing: 0.3,
    textAlign: 'left' as const,
  },
};
