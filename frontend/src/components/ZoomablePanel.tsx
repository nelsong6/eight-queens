import React, { useCallback, useEffect, useRef, useState } from 'react';

interface ZoomablePanelProps {
  id: string;
  zoomedId: string | null;
  onZoom: (id: string | null) => void;
  children: React.ReactNode;
  /** Ref to the container element that defines the zoom bounds */
  containerRef?: React.RefObject<HTMLDivElement | null>;
  /** Extra styles merged onto the outer wrapper in normal (non-zoomed) state */
  style?: React.CSSProperties;
}

interface ExpandedRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export const ZoomablePanel: React.FC<ZoomablePanelProps> = ({
  id,
  zoomedId,
  onZoom,
  children,
  containerRef,
  style,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [expandedRect, setExpandedRect] = useState<ExpandedRect | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [hovered, setHovered] = useState(false);

  const isZoomed = zoomedId === id;
  const isHidden = zoomedId !== null && !isZoomed;

  // --- Zoom in: capture rect → go fixed → expand next frame ---
  useEffect(() => {
    if (isZoomed && !rect && panelRef.current) {
      const r = panelRef.current.getBoundingClientRect();
      setRect(r);

      // Calculate expanded bounds from container's content area
      if (containerRef?.current) {
        const c = containerRef.current.getBoundingClientRect();
        const cs = window.getComputedStyle(containerRef.current);
        const pt = parseFloat(cs.paddingTop);
        const pl = parseFloat(cs.paddingLeft);
        const pr = parseFloat(cs.paddingRight);
        setExpandedRect({
          top: c.top + pt,
          left: c.left + pl,
          width: c.width - pl - pr,
          height: window.innerHeight - c.top - pt,
        });
      } else {
        setExpandedRect({
          top: 20,
          left: 20,
          width: window.innerWidth - 40,
          height: window.innerHeight - 40,
        });
      }
    }
    if (!isZoomed && rect) {
      setRect(null);
      setExpandedRect(null);
      setExpanded(false);
    }
  }, [isZoomed]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (rect && !expanded) {
      // Two rAF to ensure the browser has painted the fixed-at-origin frame
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setExpanded(true);
        });
      });
    }
  }, [rect, expanded]);

  const handleZoomIn = useCallback(() => {
    onZoom(id);
  }, [onZoom, id]);

  const handleZoomOut = useCallback(() => {
    onZoom(null);
  }, [onZoom]);

  // --- Styles ---
  const isFixed = isZoomed && rect !== null;
  const er = expandedRect;

  const wrapperStyle: React.CSSProperties = isFixed
    ? {
        position: 'fixed',
        zIndex: 200,
        transition: 'top 350ms cubic-bezier(0.4,0,0.2,1), left 350ms cubic-bezier(0.4,0,0.2,1), width 350ms cubic-bezier(0.4,0,0.2,1), height 350ms cubic-bezier(0.4,0,0.2,1)',
        top: expanded && er ? er.top : rect.top,
        left: expanded && er ? er.left : rect.left,
        width: expanded && er ? er.width : rect.width,
        height: expanded && er ? er.height : rect.height,
        overflow: 'auto',
        borderRadius: 8,
      }
    : {
        opacity: isHidden ? 0 : 1,
        pointerEvents: isHidden ? 'none' as const : 'auto' as const,
        transition: 'opacity 300ms ease',
        position: 'relative' as const,
        display: 'flex',
        flexDirection: 'column' as const,
        ...style,
      };

  return (
    <>
      {/* Placeholder keeps layout stable while panel is fixed */}
      {isFixed && (
        <div
          style={{
            width: rect!.width,
            height: rect!.height,
            flexShrink: 0,
            opacity: 0,
            pointerEvents: 'none',
            ...style,
          }}
        />
      )}

      <div
        ref={panelRef}
        style={wrapperStyle}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {children}

        {/* Expand button (top-right, visible on hover) */}
        {!isZoomed && (
          <button
            onClick={handleZoomIn}
            title="Expand"
            style={{
              ...btnBase,
              opacity: hovered ? 0.7 : 0,
              pointerEvents: hovered ? 'auto' : 'none',
              top: 6,
              right: 6,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 3 21 3 21 9" />
              <polyline points="9 21 3 21 3 15" />
              <line x1="21" y1="3" x2="14" y2="10" />
              <line x1="3" y1="21" x2="10" y2="14" />
            </svg>
          </button>
        )}

        {/* Close button (visible when zoomed) */}
        {isZoomed && (
          <button
            onClick={handleZoomOut}
            title="Close"
            style={{
              ...btnBase,
              opacity: 0.8,
              top: 10,
              right: 10,
              width: 28,
              height: 28,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>
    </>
  );
};

const btnBase: React.CSSProperties = {
  position: 'absolute',
  zIndex: 10,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 24,
  height: 24,
  padding: 0,
  backgroundColor: 'rgba(26, 26, 46, 0.85)',
  color: '#e0e0e0',
  border: '1px solid #3a3a5a',
  borderRadius: 4,
  cursor: 'pointer',
  transition: 'opacity 200ms ease',
};
