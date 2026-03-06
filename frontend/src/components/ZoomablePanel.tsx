import React, { useCallback, useEffect, useRef, useState } from 'react';

export interface ExpandedRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface ZoomablePanelProps {
  id: string;
  zoomedId: string | null;
  onZoom: (id: string | null) => void;
  children: React.ReactNode;
  /** Ref to the container element that defines the zoom bounds */
  containerRef?: React.RefObject<HTMLDivElement | null>;
  /** Extra styles merged onto the outer wrapper in normal (non-zoomed) state */
  style?: React.CSSProperties;
  /** When set and panel would normally be hidden, render at this fixed position as a companion */
  companionRect?: ExpandedRect | null;
  /** Adjusts the expanded rect after computation (e.g. to share space with a companion) */
  expandedRectModifier?: (rect: ExpandedRect) => ExpandedRect;
}

export const ZoomablePanel: React.FC<ZoomablePanelProps> = ({
  id,
  zoomedId,
  onZoom,
  children,
  containerRef,
  style,
  companionRect,
  expandedRectModifier,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [expandedRect, setExpandedRect] = useState<ExpandedRect | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [hovered, setHovered] = useState(false);

  const isZoomed = zoomedId === id;
  const isHidden = zoomedId !== null && !isZoomed;
  const isCompanion = isHidden && companionRect != null;
  const shouldAnimate = isZoomed || isCompanion;
  const [collapsing, setCollapsing] = useState(false);

  // --- Zoom / companion in: capture rect → go fixed → expand next frame ---
  useEffect(() => {
    if (shouldAnimate && !rect && panelRef.current) {
      const r = panelRef.current.getBoundingClientRect();
      setRect(r);

      if (isCompanion) {
        // Companion: animate to the provided companion rect
        setExpandedRect(companionRect!);
      } else {
        // Zoomed: calculate expanded bounds from container's content area
        let er: ExpandedRect;
        if (containerRef?.current) {
          const c = containerRef.current.getBoundingClientRect();
          const cs = window.getComputedStyle(containerRef.current);
          const pt = parseFloat(cs.paddingTop);
          const pl = parseFloat(cs.paddingLeft);
          const pr = parseFloat(cs.paddingRight);
          er = {
            top: c.top + pt,
            left: c.left + pl,
            width: c.width - pl - pr,
            height: window.innerHeight - c.top - pt,
          };
        } else {
          er = {
            top: 20,
            left: 20,
            width: window.innerWidth - 40,
            height: window.innerHeight - 40,
          };
        }
        if (expandedRectModifier) {
          er = expandedRectModifier(er);
        }
        setExpandedRect(er);
      }
    }
  }, [shouldAnimate]); // eslint-disable-line react-hooks/exhaustive-deps

  // After collapse animation finishes, clear fixed positioning and notify parent
  useEffect(() => {
    if (collapsing && !expanded) {
      const timer = setTimeout(() => {
        setRect(null);
        setExpandedRect(null);
        setCollapsing(false);
        onZoom(null);
      }, 350); // match transition duration
      return () => clearTimeout(timer);
    }
  }, [collapsing, expanded, onZoom]);

  // If the parent externally clears zoomedId (e.g. reset), clean up internal state immediately
  useEffect(() => {
    if (!shouldAnimate && !collapsing && rect) {
      setRect(null);
      setExpandedRect(null);
      setExpanded(false);
    }
  }, [shouldAnimate, collapsing, rect]);

  useEffect(() => {
    if (rect && !expanded && !collapsing) {
      // Two rAF to ensure the browser has painted the fixed-at-origin frame
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setExpanded(true);
        });
      });
    }
  }, [rect, expanded, collapsing]);

  const handleZoomIn = useCallback(() => {
    onZoom(id);
  }, [onZoom, id]);

  const handleZoomOut = useCallback(() => {
    // Start collapse animation first, then notify parent after it finishes
    setCollapsing(true);
    setExpanded(false);
  }, []);

  // --- Styles ---
  const isFixed = rect !== null;
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
        display: 'flex',
        flexDirection: 'column' as const,
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
        flex: 1,
        minHeight: 0,
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
        {!isZoomed && !isCompanion && (
          <button
            onClick={handleZoomIn}
            title="Expand"
            style={{
              ...btnBase,
              opacity: hovered ? 0.7 : 0,
              pointerEvents: hovered ? 'auto' : 'none',
              top: 14,
              right: 14,
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

        {/* Close button (visible when zoomed or collapsing) */}
        {(isZoomed || collapsing) && (
          <button
            onClick={handleZoomOut}
            title="Close"
            data-help="Collapse this panel back to its original size"
            style={{
              ...btnBase,
              opacity: 0.8,
              top: 14,
              right: 14,
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
