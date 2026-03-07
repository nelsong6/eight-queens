import React from 'react';
import { colors } from '../colors';

export type ActiveTab = 'getting-started' | 'full' | 'micro' | 'help';

type SessionPhase = 'config' | 'running' | 'review';

interface Props {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  sessionPhase: SessionPhase;
  hasSecondaryColumn?: boolean;
}

interface TabDef {
  id: ActiveTab;
  label: string;
  helpText: string;
  disabled?: boolean;
}

export const TabBar: React.FC<Props> = ({ activeTab, onTabChange, sessionPhase, hasSecondaryColumn = false }) => {
  const tabs: TabDef[] = [
    {
      id: 'getting-started',
      label: 'Getting Started',
      helpText: 'Introduction, help bar guide, and quick-start buttons',
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
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const isDisabled = !!tab.disabled;
        return (
          <button
            key={tab.id}
            className="tab-nav"
            onClick={() => !isDisabled && onTabChange(tab.id)}
            disabled={isDisabled}
            data-help={tab.helpText}
            style={{
              ...styles.tab,
              ...(isActive ? styles.tabActive : styles.tabInactive),
              ...(isActive ? { backgroundColor: hasSecondaryColumn ? colors.bg.raised : colors.bg.base } : {}),
              opacity: isDisabled ? 0.35 : 1,
              cursor: isDisabled ? 'not-allowed' : 'pointer',
            }}
          >
            {tab.label}
          </button>
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
  tab: {
    padding: '10px 16px',
    fontSize: 12,
    fontFamily: 'monospace',
    backgroundColor: 'transparent',
    WebkitAppearance: 'none' as const,
    appearance: 'none' as const,
    outline: 'none',
    border: 'none',
    borderTop: '1px solid transparent',
    borderLeft: '1px solid transparent',
    borderBottom: '1px solid transparent',
    borderRight: 'none',
    whiteSpace: 'nowrap' as const,
    transition: 'color 0.12s, background-color 0.12s, border-color 0.12s',
    letterSpacing: 0.3,
    textAlign: 'left' as const,
  },
  tabActive: {
    color: colors.text.primary,
    fontWeight: 'bold' as const,
    borderLeftColor: colors.border.subtle,
    borderBottomColor: colors.border.subtle,
    position: 'relative' as const,
    right: -1,
    zIndex: 1,
  },
  tabInactive: {
    color: colors.text.tertiary,
  },
};
