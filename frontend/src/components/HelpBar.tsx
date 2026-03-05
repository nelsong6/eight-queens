import { useEffect, useState } from 'react';

const DEFAULT_TEXT = 'Hover over any control to see what it does.';

export const HelpBar: React.FC = () => {
  const [text, setText] = useState(DEFAULT_TEXT);

  useEffect(() => {
    const handleMouseOver = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest?.('[data-help]');
      setText(target ? (target as HTMLElement).dataset.help! : DEFAULT_TEXT);
    };

    document.addEventListener('mouseover', handleMouseOver);
    return () => document.removeEventListener('mouseover', handleMouseOver);
  }, []);

  return (
    <div style={styles.bar}>
      <span style={styles.text}>{text}</span>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  bar: {
    height: 28,
    backgroundColor: '#12122a',
    borderBottom: '1px solid #2a2a4a',
    display: 'flex',
    alignItems: 'center',
    paddingLeft: 24,
    paddingRight: 24,
  },
  text: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: '#888',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
};
