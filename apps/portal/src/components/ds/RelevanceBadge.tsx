import type React from 'react';

export type RelevanceState = 'relevant' | 'review' | 'irrelevant' | 'submitted';

export interface RelevanceBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  state: RelevanceState;
  label?: string;
}

const MAP: Record<RelevanceState, { text: string; fill: string; label: string }> = {
  relevant:   { text: 'var(--relevant-text)',   fill: 'var(--relevant-fill)',   label: 'Relevant' },
  review:     { text: 'var(--review-text)',     fill: 'var(--review-fill)',     label: 'Review' },
  irrelevant: { text: 'var(--irrelevant-text)', fill: 'var(--irrelevant-fill)', label: 'Irrelevant' },
  submitted:  { text: 'var(--info-text)',       fill: 'var(--info-fill)',       label: 'Submitted' },
};

function Glyph({ state }: { state: RelevanceState }) {
  const common = { width: 12, height: 12, viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': true } as const;
  if (state === 'relevant') return (
    <svg {...common}><path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>
  );
  if (state === 'review') return (
    <svg {...common}><path d="M12 8v5M12 16.5v.5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" /></svg>
  );
  if (state === 'irrelevant') return (
    <svg {...common}><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg>
  );
  return (
    <svg {...common}><path d="M5 12l4 4 10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>
  );
}

export function RelevanceBadge({ state = 'relevant', label, style = {}, ...rest }: RelevanceBadgeProps) {
  const m = MAP[state] || MAP.relevant;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        fontFamily: 'var(--font-ui)',
        fontSize: 12,
        fontWeight: 'var(--fw-semibold)',
        lineHeight: 1,
        color: m.text,
        background: m.fill,
        padding: '5px 10px',
        borderRadius: 'var(--radius-pill)',
        whiteSpace: 'nowrap',
        ...style,
      }}
      {...rest}
    >
      <Glyph state={state} />
      {label || m.label}
    </span>
  );
}
