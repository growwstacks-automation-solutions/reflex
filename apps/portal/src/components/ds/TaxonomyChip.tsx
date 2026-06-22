import type React from 'react';

export type TaxonomyLevel = 'tool' | 'usecase' | 'dept' | 'industry';

export interface TaxonomyChipProps extends React.HTMLAttributes<HTMLSpanElement> {
  level: TaxonomyLevel;
  isNew?: boolean;
  children: React.ReactNode;
}

const MAP: Record<TaxonomyLevel, { text: string; fill: string; label: string }> = {
  tool:     { text: 'var(--tax-tool-text)',     fill: 'var(--tax-tool-fill)',     label: 'Tool' },
  usecase:  { text: 'var(--tax-usecase-text)',  fill: 'var(--tax-usecase-fill)',  label: 'Use case' },
  dept:     { text: 'var(--tax-dept-text)',     fill: 'var(--tax-dept-fill)',     label: 'Department' },
  industry: { text: 'var(--tax-industry-text)', fill: 'var(--tax-industry-fill)', label: 'Industry' },
};

export function TaxonomyChip({ level = 'tool', isNew = false, children, style = {}, ...rest }: TaxonomyChipProps) {
  const m = MAP[level] || MAP.tool;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        fontFamily: 'var(--font-ui)',
        fontSize: 12,
        fontWeight: 'var(--fw-medium)',
        lineHeight: 1,
        color: m.text,
        background: m.fill,
        padding: '4px 8px',
        borderRadius: 'var(--radius-chip)',
        border: isNew ? `1px dashed ${m.text}` : '1px solid transparent',
        whiteSpace: 'nowrap',
        ...style,
      }}
      title={m.label}
      {...rest}
    >
      {isNew && (
        <span style={{ width: 5, height: 5, borderRadius: '50%', background: m.text, flex: 'none' }} />
      )}
      {children}
    </span>
  );
}
