import { useEffect, useRef, useState } from 'react';
import { colors } from '../colors';

const DEFAULT_TEXT = 'Hover over any control to see what it does.';

export const HelpBar: React.FC = () => {
  const [text, setText] = useState(DEFAULT_TEXT);
  const [held, setHeld] = useState(false);
  const heldRef = useRef(false);
  const lastMouseX = useRef(0);
  const lastMouseY = useRef(0);

  useEffect(() => {
    const handleMouseOver = (e: MouseEvent) => {
      if (heldRef.current) return;
      const target = (e.target as HTMLElement).closest?.('[data-help]');
      setText(target ? (target as HTMLElement).dataset.help! : DEFAULT_TEXT);
    };

    const helpTextFromPoint = (x: number, y: number): string => {
      const el = document.elementFromPoint(x, y);
      const target = (el as HTMLElement | null)?.closest?.('[data-help]');
      return target ? (target as HTMLElement).dataset.help! : DEFAULT_TEXT;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 's' && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey
        && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        heldRef.current = !heldRef.current;
        setHeld(heldRef.current);
        if (!heldRef.current) {
          setText(helpTextFromPoint(lastMouseX.current, lastMouseY.current));
        }
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      lastMouseX.current = e.clientX;
      lastMouseY.current = e.clientY;
    };

    document.addEventListener('mouseover', handleMouseOver);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('mouseover', handleMouseOver);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, []);

  return (
    <div style={styles.bar}>
      {held && <span style={styles.pin}>HELD</span>}
      <span style={styles.text}>{text}</span>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  bar: {
    height: 28,
    backgroundColor: colors.bg.raised,
    borderBottom: `1px solid ${colors.border.subtle}`,
    display: 'flex',
    alignItems: 'center',
    paddingLeft: 24,
    paddingRight: 24,
  },
  pin: {
    fontSize: 9,
    fontFamily: 'monospace',
    color: colors.accent.gold,
    marginRight: 8,
    fontWeight: 700,
    letterSpacing: 1,
  },
  text: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: colors.text.tertiary,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
};
