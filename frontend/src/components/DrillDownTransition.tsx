import React from 'react';

interface DrillDownTransitionProps {
  isActive: boolean;
  normalContent: React.ReactNode;
  drillDownContent: React.ReactNode;
  transitionDurationMs?: number;
}

export const DrillDownTransition: React.FC<DrillDownTransitionProps> = ({
  isActive,
  normalContent,
  drillDownContent,
  transitionDurationMs = 250,
}) => {
  const transition = `opacity ${transitionDurationMs}ms ease`;

  return (
    <div style={{ position: 'relative' as const, flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' as const }}>
      {/* Normal content: drives height when active, hidden when drill-down is shown */}
      <div
        style={{
          opacity: isActive ? 0 : 1,
          pointerEvents: isActive ? 'none' as const : 'auto' as const,
          transition,
          display: 'flex',
          flexDirection: 'column' as const,
          minHeight: 0,
          ...(isActive ? { position: 'absolute' as const, inset: 0 } : { flex: 1 }),
        }}
      >
        {normalContent}
      </div>

      {/* Drill-down content: drives height when active */}
      <div
        style={{
          opacity: isActive ? 1 : 0,
          pointerEvents: isActive ? 'auto' as const : 'none' as const,
          transition,
          display: 'flex',
          flexDirection: 'column' as const,
          minHeight: 0,
          ...(!isActive ? { position: 'absolute' as const, inset: 0 } : { flex: 1 }),
        }}
      >
        {drillDownContent}
      </div>
    </div>
  );
};
