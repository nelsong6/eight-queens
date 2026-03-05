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
    <div style={{ position: 'relative' as const, flex: '1 1 380px', minWidth: 0 }}>
      {/* Normal content: drives height when active, hidden when drill-down is shown */}
      <div
        style={{
          opacity: isActive ? 0 : 1,
          pointerEvents: isActive ? 'none' as const : 'auto' as const,
          transition,
          ...(isActive ? { position: 'absolute' as const, inset: 0 } : {}),
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
          ...(!isActive ? { position: 'absolute' as const, inset: 0 } : {}),
        }}
      >
        {drillDownContent}
      </div>
    </div>
  );
};
