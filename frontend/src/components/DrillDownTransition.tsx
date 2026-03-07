import React, { useState, useEffect, useRef } from 'react';

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
  // Track layout separately so position swap happens after opacity transition
  const [layoutActive, setLayoutActive] = useState(isActive);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    clearTimeout(timerRef.current);
    // Delay layout swap in both directions so position change happens after opacity fade
    timerRef.current = setTimeout(() => setLayoutActive(isActive), transitionDurationMs);
    return () => clearTimeout(timerRef.current);
  }, [isActive, transitionDurationMs]);

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
          ...(layoutActive ? { position: 'absolute' as const, inset: 0 } : { flex: 1 }),
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
          ...(!layoutActive ? { position: 'absolute' as const, inset: 0 } : { flex: 1 }),
        }}
      >
        {drillDownContent}
      </div>
    </div>
  );
};
