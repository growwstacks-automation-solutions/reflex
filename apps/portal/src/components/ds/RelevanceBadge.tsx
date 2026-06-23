import type { HTMLAttributes } from "react";

export type RelevanceState = "relevant" | "review" | "irrelevant" | "submitted";

export interface RelevanceBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  state: RelevanceState;
  label?: string;
  dense?: boolean;
}

const RELEVANCE: Record<RelevanceState, { bg: string; on: string; label: string }> = {
  relevant: { bg: "var(--status-good)", on: "var(--status-good-on)", label: "Relevant" },
  review: { bg: "var(--status-warn)", on: "var(--status-warn-on)", label: "Needs review" },
  irrelevant: { bg: "var(--status-bad)", on: "var(--status-bad-on)", label: "Not a fit" },
  submitted: { bg: "var(--status-info)", on: "var(--status-info-on)", label: "Submitted" },
};

function RelGlyph({ state, on }: { state: RelevanceState; on: string }): JSX.Element {
  const c = { width: 12, height: 12, viewBox: "0 0 24 24", fill: "none", "aria-hidden": true } as const;
  if (state === "relevant")
    return (
      <svg {...c}>
        <path d="M20 6L9 17l-5-5" stroke={on} strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  if (state === "review")
    return (
      <svg {...c}>
        <path d="M12 8v5M12 16.5v.5" stroke={on} strokeWidth="3" strokeLinecap="round" />
        <circle cx="12" cy="12" r="9" stroke={on} strokeWidth="2.2" />
      </svg>
    );
  if (state === "irrelevant")
    return (
      <svg {...c}>
        <path d="M6 6l12 12M18 6L6 18" stroke={on} strokeWidth="3.2" strokeLinecap="round" />
      </svg>
    );
  return (
    <svg {...c}>
      <path d="M5 12l4 4 10-10" stroke={on} strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Reflex v4 relevance verdict — SOLID, loud pill (loudest thing after the title). */
export function RelevanceBadge({
  state = "relevant",
  label,
  dense,
  style = {},
  ...rest
}: RelevanceBadgeProps): JSX.Element {
  const m = RELEVANCE[state] || RELEVANCE.relevant;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        fontFamily: "var(--font-ui)",
        fontSize: dense ? 11.5 : 12,
        fontWeight: 700,
        letterSpacing: "0.01em",
        lineHeight: 1,
        color: m.on,
        background: m.bg,
        padding: dense ? "4px 9px" : "5px 11px",
        borderRadius: "var(--radius-pill)",
        whiteSpace: "nowrap",
        ...style,
      }}
      {...rest}
    >
      <RelGlyph state={state} on={m.on} />
      {label || m.label}
    </span>
  );
}
