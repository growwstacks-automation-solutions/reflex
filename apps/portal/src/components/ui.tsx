/* Reflex portal v3 — shared UI atoms (ported from ui.jsx, 1:1). */
import { useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { RXIcons } from "./icons";
import type { Job, Person } from "@/lib/types";

/* ---- Job quality chip: good · medium · poor (color is signal) ---- */
export type Quality = "good" | "medium" | "poor";

export const QUALITY: Record<Quality, { label: string; bg: string; on: string }> = {
  good: { label: "Good fit", bg: "var(--status-good)", on: "var(--status-good-on)" },
  medium: { label: "Medium fit", bg: "var(--status-warn)", on: "var(--status-warn-on)" },
  poor: { label: "Poor fit", bg: "var(--status-bad)", on: "var(--status-bad-on)" },
};

export function QualityChip({ quality, dense }: { quality: Quality; dense?: boolean }) {
  const q = QUALITY[quality] || QUALITY.medium;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        background: q.bg,
        color: q.on,
        fontSize: dense ? 11.5 : 12,
        fontWeight: 700,
        letterSpacing: "0.01em",
        padding: dense ? "4px 9px" : "4px 10px",
        borderRadius: "var(--radius-pill)",
        whiteSpace: "nowrap",
        lineHeight: 1.2,
      }}
    >
      {q.label}
    </span>
  );
}

/* ---- Avatar from initials ---- */
export function Avatar({ person, size = 28 }: { person: Person; size?: number }) {
  const initials =
    (person.first ? person.first[0] : person.name[0]) +
    (person.name.split(" ")[1] ? person.name.split(" ")[1][0] : "");
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: 999,
        flex: "none",
        background: person.bg,
        color: person.fg,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.4,
        fontWeight: 600,
        letterSpacing: "-0.01em",
      }}
    >
      {initials.toUpperCase()}
    </span>
  );
}

/* ---- Ownership dot + label ---- */
export const OWN: Record<Job["ownership"], { color: string; label: string }> = {
  mine: { color: "var(--accent)", label: "Assigned to you" },
  other: { color: "var(--text-tertiary)", label: "Assigned" },
  available: { color: "#3FA67E", label: "Available" },
};

export function Ownership({ job }: { job: Job }) {
  if (job.ownership === "other" && job.owner) {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--text-secondary)" }}>
        <Avatar person={job.owner} size={18} />
        <span>{job.owner.first}</span>
      </span>
    );
  }
  const o = OWN[job.ownership] || OWN.available;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--text-secondary)" }}>
      <span style={{ width: 7, height: 7, borderRadius: 999, background: o.color }}></span>
      {o.label}
    </span>
  );
}

/* ---- Mono meta token ---- */
export function Mono({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <span style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, ...style }}>{children}</span>;
}

/* ---- Copy button with copied flash (first-class on generated text) ---- */
export function CopyButton({
  getText,
  label = "Copy",
  size = "sm",
}: {
  getText: string | (() => string);
  label?: string;
  size?: "sm" | "md";
}) {
  const [copied, setCopied] = useState(false);
  const onClick = () => {
    const text = typeof getText === "function" ? getText() : getText;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text);
    } catch {
      /* clipboard unavailable — non-fatal */
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };
  const pad = size === "sm" ? "5px 10px" : "7px 13px";
  return (
    <button
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: pad,
        borderRadius: "var(--radius-button)",
        border: copied ? "1px solid var(--relevant-text)" : "1px solid var(--border)",
        background: copied ? "var(--relevant-fill)" : "var(--surface)",
        color: copied ? "var(--relevant-text)" : "var(--text-primary)",
        fontSize: 12.5,
        fontWeight: 500,
        cursor: "pointer",
        transition: "background 0.12s ease, color 0.12s ease, border-color 0.12s ease",
      }}
    >
      {copied ? <RXIcons.check size={14} /> : <RXIcons.copy size={14} />}
      {copied ? "Copied" : label}
    </button>
  );
}

/* ---- Section label ---- */
export function Eyebrow({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        color: "var(--text-tertiary)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/* ---- Card ---- */
export function Card({
  children,
  style,
  pad = "var(--pad-card)",
}: {
  children: ReactNode;
  style?: CSSProperties;
  pad?: CSSProperties["padding"];
}) {
  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-card)",
        boxShadow: "var(--shadow-sm)",
        padding: pad,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
