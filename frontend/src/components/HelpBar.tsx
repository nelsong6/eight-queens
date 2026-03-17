import { useEffect, useRef, useState } from 'react';
import { colors } from '../colors';
import { linkGlossaryTerms } from './helpbar-glossary-links';

const DEFAULT_TEXT = 'Hover over any control to see what it does.';

interface Props {
  onOpenGlossary?: (termId: string) => void;
}

export const HelpBar: React.FC<Props> = ({ onOpenGlossary }) => {
  const [text, setText] = useState(DEFAULT_TEXT);
  const [held, setHeld] = useState(false);
  const [glossaryTerm, setGlossaryTerm] = useState<string | null>(null);
  const heldRef = useRef(false);
  const lastMouseX = useRef(0);
  const lastMouseY = useRef(0);

  useEffect(() => {
    const glossaryTermFromElement = (el: Element | null): string | null => {
      const target = (el as HTMLElement | null)?.closest?.('[data-help-glossary]');
      return target ? (target as HTMLElement).dataset.helpGlossary! : null;
    };

    const handleMouseOver = (e: MouseEvent) => {
      if (heldRef.current) return;
      const target = (e.target as HTMLElement).closest?.('[data-help]');
      setText(target ? (target as HTMLElement).dataset.help! : DEFAULT_TEXT);
      setGlossaryTerm(glossaryTermFromElement(e.target as Element));
    };

    const fromPoint = (x: number, y: number) => {
      const el = document.elementFromPoint(x, y);
      const helpTarget = (el as HTMLElement | null)?.closest?.('[data-help]');
      return {
        text: helpTarget ? (helpTarget as HTMLElement).dataset.help! : DEFAULT_TEXT,
        term: glossaryTermFromElement(el),
      };
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 's' && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey
        && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        heldRef.current = !heldRef.current;
        setHeld(heldRef.current);
        if (!heldRef.current) {
          const { text: t, term } = fromPoint(lastMouseX.current, lastMouseY.current);
          setText(t);
          setGlossaryTerm(term);
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
      <span style={styles.text}>{onOpenGlossary ? linkGlossaryTerms(text, onOpenGlossary) : text}</span>
      {held && glossaryTerm && onOpenGlossary && (
        <button style={styles.glossaryLink} onClick={() => onOpenGlossary(glossaryTerm)}>
          See in Glossary →
        </button>
      )}
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
    flex: 1,
  },
  glossaryLink: {
    marginLeft: 12,
    padding: '0 8px',
    fontSize: 10,
    fontFamily: 'monospace',
    background: 'none',
    border: `1px solid ${colors.accent.purple}`,
    borderRadius: 3,
    color: colors.accent.purple,
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
    flexShrink: 0,
  },
};
