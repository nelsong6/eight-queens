import React from 'react';
import { colors } from '../colors';

const GLOSSARY_TERMS: Array<{ pattern: string; id: string }> = [
  { pattern: 'attacking queens',  id: 'attacking-queens' },
  { pattern: 'breeding pairs?',   id: 'breeding-pair' },
  { pattern: 'age lifecycle',     id: 'age-lifecycle' },
  { pattern: 'chromosomes?',      id: 'chromosome' },
  { pattern: 'populations?',      id: 'population' },
  { pattern: 'specimens?',        id: 'specimen' },
  { pattern: 'crossover',         id: 'crossover' },
  { pattern: 'mutations?',        id: 'mutation' },
  { pattern: 'generations?',      id: 'generation' },
  { pattern: 'selection',         id: 'selection' },
  { pattern: 'fitness',           id: 'fitness' },
  { pattern: 'epochs?',           id: 'epoch' },
];

const TERM_REGEX = new RegExp(
  '\\b(' + GLOSSARY_TERMS.map(t => t.pattern).join('|') + ')\\b',
  'gi'
);

function findTermId(matched: string): string {
  const lower = matched.toLowerCase();
  for (const { pattern, id } of GLOSSARY_TERMS) {
    if (new RegExp('^' + pattern + '$', 'i').test(lower)) return id;
  }
  return '';
}

const linkStyle: React.CSSProperties = {
  color: colors.accent.purpleLight,
  textDecoration: 'underline',
  textDecorationStyle: 'dotted',
  textUnderlineOffset: '2px',
  cursor: 'pointer',
};

export function linkGlossaryTerms(
  text: string,
  onOpenGlossary: (termId: string) => void
): React.ReactNode {
  TERM_REGEX.lastIndex = 0;

  const parts: React.ReactNode[] = [];
  const linked = new Set<string>();
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = TERM_REGEX.exec(text)) !== null) {
    const termId = findTermId(match[0]);
    if (!termId || linked.has(termId)) continue;
    linked.add(termId);

    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    parts.push(
      <span
        key={match.index}
        style={linkStyle}
        onClick={(e) => { e.stopPropagation(); onOpenGlossary(termId); }}
        role="button"
        tabIndex={-1}
      >
        {match[0]}
      </span>
    );

    lastIndex = match.index + match[0].length;
  }

  if (parts.length === 0) return text;

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}
