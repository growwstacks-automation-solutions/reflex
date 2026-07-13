/* Reflex portal v4 — Job board: KPI strip, filters, true table listing. */

import { useState, useRef, useEffect } from "react";
import type { MouseEvent, ReactNode, CSSProperties } from "react";
import { RXIcons } from "@/components/icons";
import { Button, TaxonomyChip, RelevanceBadge } from "@/components/ds";
import { QualityChip, Avatar } from "@/components/ui";
import { BellButton } from "@/components/bell";
import type { Job, ActionLink } from "@/lib/types";
import type { Rep } from "@/lib/api";

export type TabId = "mine" | "available" | "all";
type SortKey = "posted" | "created" | "budget" | "connects";

/* ── Fixed column widths — every row and the header share these exactly ── */
const COL = {
  created:  "128px",  /* created in our DB (exact date + time) — FIRST column */
  status:   "172px",  /* proposal pipeline status — wide enough for "Proposal generated" */
  budget:   "108px",  /* budget amount */
  connects:  "84px",  /* connects count */
  assignee: "156px",  /* who the job is assigned to */
} as const;

/* Shared template so the header, every row, and the skeleton stay column-aligned.
   Relevance + quality + the posted date live INSIDE the title/desc cell (Upwork-card style).
   Connects only appears in the Submitted view (connects spent) — hidden everywhere else.
   Order: Created · Title · Budget · [Connects] · Assignee · Status (Status last). */
const gridCols = (showConnects: boolean): string =>
  showConnects
    ? `${COL.created} 1fr ${COL.budget} ${COL.connects} ${COL.assignee} ${COL.status}`
    : `${COL.created} 1fr ${COL.budget} ${COL.assignee} ${COL.status}`;

const TABS: { id: TabId; label: string }[] = [
  { id: "all", label: "All" },
  { id: "mine", label: "Assigned to me" },
];

/* ── Proposal pipeline status ──
   Derived from the DB's proposal_status (New Job / Submitted / In Contact), which the
   adapter already folds into job.actionState. Soft fill+text pills so they stay visually
   distinct from the SOLID Monday relevance/quality badges in the next column. */
const PROPOSAL_STATUS: Record<Job["actionState"], { label: string; fill: string; text: string }> = {
  "not-actioned": { label: "Pending",             fill: "var(--surface-2)",     text: "var(--text-secondary)" },
  generated:      { label: "Proposal generated",  fill: "var(--review-fill)",   text: "var(--review-text)" },
  submitted:      { label: "Submitted",           fill: "var(--relevant-fill)", text: "var(--relevant-text)" },
  conversation:   { label: "In contact",          fill: "var(--info-fill)",     text: "var(--info-text)" },
};

function StatusBadge({ state }: { state: Job["actionState"] }): JSX.Element {
  const s = PROPOSAL_STATUS[state] || PROPOSAL_STATUS["not-actioned"];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      fontSize: 11.5, fontWeight: 700, letterSpacing: "0.01em", lineHeight: 1,
      color: s.text, background: s.fill,
      padding: "5px 10px", borderRadius: "var(--radius-pill)", whiteSpace: "nowrap",
    }}>
      {state === "submitted" && <RXIcons.check size={12} />}
      {state === "conversation" && <RXIcons.chat size={12} />}
      {s.label}
    </span>
  );
}

/* ── Date cell — clean two-line stack (date over time), sans + tabular figures ── */
function DateCell({ value, align = "flex-end" }: { value: string; align?: "flex-start" | "flex-end" }): JSX.Element {
  const [date, time] = value.split(", ");
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: align, gap: 1, lineHeight: 1.3 }}>
      <span style={{ fontFamily: "var(--font-ui)", fontSize: 12.5, fontWeight: 600, color: "var(--text-secondary)", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{date}</span>
      {time && <span style={{ fontFamily: "var(--font-ui)", fontSize: 11.5, color: "var(--text-tertiary)", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{time}</span>}
    </div>
  );
}

/* ── Segmented control ── */
export function Segmented<T extends string>({
  value, onChange, options,
}: {
  value: T;
  onChange: (id: T) => void;
  options: { id: T; label: string }[];
}): JSX.Element {
  return (
    <div style={{
      display: "inline-flex", padding: 3, gap: 2,
      borderRadius: "var(--radius-button)",
      background: "var(--surface-2)", border: "1px solid var(--border)",
    }}>
      {options.map(o => {
        const active = value === o.id;
        return (
          <button key={o.id} onClick={() => onChange(o.id)} style={{
            padding: "6px 13px", borderRadius: 6, border: "none", cursor: "pointer",
            background: active ? "var(--surface)" : "transparent",
            color: active ? "var(--text-primary)" : "var(--text-secondary)",
            fontSize: 13, fontWeight: active ? 600 : 500, whiteSpace: "nowrap",
            boxShadow: active ? "var(--shadow-sm)" : "none",
            transition: "background 0.12s ease",
          }}>{o.label}</button>
        );
      })}
    </div>
  );
}

/* ── Date-range control ── drives the whole board (rows + KPIs) by the Created date.
   Presets (Today / This week / This month / Last week / Last month) + a custom range. */
function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function prettyDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
function DateRangeControl({ from, to, onChange }: {
  from: string | null; to: string | null; onChange: (from: string | null, to: string | null) => void;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const [cf, setCf] = useState(from || "");
  const [ct, setCt] = useState(to || "");
  const ref = useRef<HTMLDivElement>(null);
  const apply = (f: string | null, t: string | null) => { onChange(f, t); setOpen(false); };

  // Close on click outside (not on hover-out). Only listens while open.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: globalThis.MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const today = new Date();
  const monOf = (d: Date) => { const x = new Date(d); const day = (x.getDay() + 6) % 7; x.setDate(x.getDate() - day); return x; };
  const presets: { label: string; run: () => void }[] = [
    { label: "All time",   run: () => apply(null, null) },
    { label: "Today",      run: () => apply(fmtDate(today), fmtDate(today)) },
    { label: "This week",  run: () => apply(fmtDate(monOf(today)), fmtDate(today)) },
    { label: "This month", run: () => apply(fmtDate(new Date(today.getFullYear(), today.getMonth(), 1)), fmtDate(today)) },
    { label: "Last week",  run: () => { const mon = monOf(today); mon.setDate(mon.getDate() - 7); const sun = new Date(mon); sun.setDate(mon.getDate() + 6); apply(fmtDate(mon), fmtDate(sun)); } },
    { label: "Last month", run: () => apply(fmtDate(new Date(today.getFullYear(), today.getMonth() - 1, 1)), fmtDate(new Date(today.getFullYear(), today.getMonth(), 0))) },
  ];

  const label = from && to ? (from === to ? prettyDate(from) : `${prettyDate(from)} → ${prettyDate(to)}`)
    : from ? `From ${prettyDate(from)}` : to ? `Until ${prettyDate(to)}` : "All time";
  const active = !!(from || to);

  const inputSt: CSSProperties = {
    font: "inherit", fontSize: 12.5, padding: "5px 8px", borderRadius: "var(--radius-button)",
    border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-primary)",
  };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button onClick={() => setOpen(o => !o)} style={{
        display: "inline-flex", alignItems: "center", gap: 7, cursor: "pointer",
        padding: "7px 12px", borderRadius: "var(--radius-button)", font: "inherit",
        border: active ? "1px solid var(--indigo-200)" : "1px solid var(--border)",
        background: active ? "var(--accent-tint)" : "var(--surface)",
        color: active ? "var(--accent-on-tint)" : "var(--text-primary)",
        fontSize: 13, fontWeight: 600, whiteSpace: "nowrap",
      }}>
        <CalendarIcon />
        {label}
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true"><path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 20,
          background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-card)",
          boxShadow: "var(--shadow-md, var(--shadow-sm))", padding: 8, minWidth: 230,
        }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {presets.map(p => (
              <button key={p.label} onClick={p.run} style={{
                textAlign: "left", font: "inherit", fontSize: 12.5, fontWeight: 500,
                padding: "7px 10px", borderRadius: "var(--radius-button)", border: "none",
                background: "transparent", color: "var(--text-primary)", cursor: "pointer",
              }}
                onMouseEnter={e => (e.currentTarget.style.background = "var(--indigo-50)")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              >{p.label}</button>
            ))}
          </div>
          <div style={{ borderTop: "1px solid var(--border)", marginTop: 6, paddingTop: 8 }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-tertiary)", marginBottom: 6 }}>Custom range</div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input type="date" value={cf} max={ct || undefined} onChange={e => setCf(e.target.value)} style={inputSt} />
              <span style={{ color: "var(--text-tertiary)" }}>→</span>
              <input type="date" value={ct} min={cf || undefined} onChange={e => setCt(e.target.value)} style={inputSt} />
            </div>
            <button onClick={() => apply(cf || null, ct || null)} style={{
              marginTop: 8, width: "100%", font: "inherit", fontSize: 12.5, fontWeight: 600,
              padding: "7px 10px", borderRadius: "var(--radius-button)", border: "none",
              background: "var(--accent)", color: "#fff", cursor: "pointer",
            }}>Apply</button>
          </div>
        </div>
      )}
    </div>
  );
}
function CalendarIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

/* ── Filter pill ── */
export function FilterPill({
  active, onClick, children, dot,
}: {
  active: boolean; onClick: () => void; children: ReactNode; dot?: string;
}): JSX.Element {
  return (
    <button onClick={onClick} style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "5px 11px", borderRadius: "var(--radius-pill)", cursor: "pointer",
      border: active ? "1px solid var(--indigo-200)" : "1px solid var(--border)",
      background: active ? "var(--accent-tint)" : "transparent",
      color: active ? "var(--accent-on-tint)" : "var(--text-secondary)",
      fontSize: 12.5, fontWeight: active ? 600 : 400, whiteSpace: "nowrap",
      transition: "all 0.1s ease",
    }}>
      {dot && <span style={{ width: 6, height: 6, borderRadius: 999, background: dot, flex: "none" }} />}
      {children}
    </button>
  );
}

function VDivider(): JSX.Element {
  return <span style={{ width: 1, height: 18, background: "var(--border)", flex: "none", margin: "0 4px" }} />;
}

/* ── Collapsible category label — click collapses its pills, double-click re-opens ── */
function CatToggle({
  label, open, setOpen,
}: {
  label: string; open: boolean; setOpen: (v: boolean) => void;
}): JSX.Element {
  return (
    <button
      onClick={() => setOpen(!open)}
      title={open ? "Collapse" : "Expand"}
      style={{
        display: "inline-flex", alignItems: "center", gap: 4, cursor: "pointer",
        border: "none", background: "none", padding: "3px 2px",
        fontSize: 10.5, fontWeight: 700, color: "var(--text-tertiary)",
        letterSpacing: "0.07em", textTransform: "uppercase", whiteSpace: "nowrap",
        userSelect: "none",
      }}
    >
      {label}
      <svg width="9" height="9" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="3"
        style={{ transform: open ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform 0.15s ease" }}>
        <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

/* ── Sort arrow icon ── */
function SortArrow({ active, asc }: { active: boolean; asc: boolean }): JSX.Element {
  return (
    <svg width="9" height="9" viewBox="0 0 9 9" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
      {active ? (
        <path d={asc ? "M4.5 7L1.5 3H7.5L4.5 7Z" : "M4.5 2L7.5 6H1.5L4.5 2Z"} fill="currentColor" />
      ) : (
        <>
          <path d="M4.5 2L7 5H2L4.5 2Z" fill="currentColor" opacity={0.3} />
          <path d="M4.5 7L2 4H7L4.5 7Z" fill="currentColor" opacity={0.3} />
        </>
      )}
    </svg>
  );
}

/* ── Column header cell (sortable) ── */
function ColHeader({
  label, sortKey, current, dir, onSort, style, align = "left", countBadge,
}: {
  label: string; sortKey?: SortKey; current: SortKey; dir: "asc" | "desc";
  onSort: (k: SortKey) => void; style?: CSSProperties; align?: "left" | "right" | "center";
  countBadge?: number;
}): JSX.Element {
  const active = sortKey !== undefined && current === sortKey;
  const content = (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase",
      color: active ? "var(--accent)" : "var(--text-tertiary)",
    }}>
      {label}
      {sortKey && <SortArrow active={active} asc={active && dir === "asc"} />}
      {countBadge !== undefined && (
        <span style={{ marginLeft: 2, fontWeight: 700, color: "var(--text-secondary)", fontVariantNumeric: "tabular-nums" }}>({countBadge})</span>
      )}
    </span>
  );
  const base: CSSProperties = {
    padding: "0 12px", display: "flex",
    alignItems: "center",
    justifyContent: align === "right" ? "flex-end" : align === "center" ? "center" : "flex-start",
    ...style,
  };
  if (sortKey) {
    return (
      <button onClick={() => onSort(sortKey)} style={{
        ...base, border: "none", background: "none", cursor: "pointer",
      }}>
        {content}
      </button>
    );
  }
  return <div style={base}>{content}</div>;
}

/* ── The fixed table header row ── */
function TableHeader({
  sort, dir, onSort, count, showConnects,
}: {
  sort: SortKey; dir: "asc" | "desc"; onSort: (k: SortKey) => void; count: number; showConnects: boolean;
}): JSX.Element {
  const shared = { sort, dir, onSort } as const;
  return (
    <div className="rx-table-header" style={{
      display: "grid",
      gridTemplateColumns: gridCols(showConnects),
      height: 40,
      background: "var(--surface-2)",
      borderBottom: "1px solid var(--border)",
      borderRadius: "12px 12px 0 0",
      position: "sticky", top: 0, zIndex: 2,
    }}>
      {/* Column headers — all centered */}
      <ColHeader label="Created" sortKey="created" current={sort} {...shared} align="center"
        countBadge={count} />
      <ColHeader label="Job title & description" sortKey={undefined} current={sort} {...shared} align="center" />
      <ColHeader label="Budget" sortKey="budget" current={sort} {...shared} align="center" />
      {showConnects && <ColHeader label="Connects" sortKey="connects" current={sort} {...shared} align="center" />}
      <div style={{ padding: "0 12px", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-tertiary)" }}>Assignee</span>
      </div>
      {/* Status col — proposal pipeline state (LAST) */}
      <div style={{ padding: "0 12px", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", letterSpacing: "0.06em", textTransform: "uppercase" }}>Status</span>
      </div>
    </div>
  );
}

/* ── Admin rep picker — assign/reassign a job to any rep, inline in the row ── */
function RepPicker({
  job, reps, onAssignToRep,
}: {
  job: Job; reps: Rep[]; onAssignToRep: (job: Job, repId: string) => void | Promise<void>;
}): JSX.Element {
  const [busy, setBusy] = useState(false);
  // Preselect the current owner if we can match them by name (admin board surfaces owner.name).
  const currentOwnerName = job.ownership === "mine" ? null : job.owner?.name || null;
  const currentRep = currentOwnerName ? reps.find(r => r.full_name === currentOwnerName) : undefined;
  const value = currentRep?.id || "";

  return (
    <div onClick={e => e.stopPropagation()} style={{ display: "inline-flex", alignItems: "center" }}>
      <select
        value={value}
        disabled={busy || reps.length === 0}
        onChange={async e => {
          const repId = e.target.value;
          if (!repId || repId === value) return;
          setBusy(true);
          try { await onAssignToRep(job, repId); }
          finally { setBusy(false); }
        }}
        title={value ? `Owned by ${currentOwnerName} — pick a rep to reassign` : "Assign to a rep"}
        style={{
          maxWidth: 138, fontSize: 12, fontWeight: 600,
          padding: "5px 8px", borderRadius: "var(--radius-button)",
          border: "1px solid var(--border)", background: "var(--surface)",
          color: value ? "var(--text-primary)" : "var(--text-secondary)",
          cursor: busy ? "wait" : "pointer",
        }}
      >
        <option value="" disabled>{value ? "Reassign…" : "Assign to…"}</option>
        {reps.map(r => (
          <option key={r.id} value={r.id}>{r.full_name}</option>
        ))}
      </select>
    </div>
  );
}

/* ── Assignee cell — who currently owns the job ──
   Reps see a read-only owner (actions live in the detail peek). Admins get the inline
   rep picker on unassigned/non-terminal jobs so they can (re)assign without opening it. */
function AssigneeCell({
  job, isAdmin, reps, onAssignToRep,
}: {
  job: Job; isAdmin: boolean; reps: Rep[]; onAssignToRep: (job: Job, repId: string) => void | Promise<void>;
}): JSX.Element {
  // Admin: assign/reassign inline while the job has no proposal committed yet.
  if (isAdmin && job.actionState === "not-actioned") {
    return <RepPicker job={job} reps={reps} onAssignToRep={onAssignToRep} />;
  }
  // Owned — show the assignee's exact name from the DB (jobs.picked_by_name / users.full_name).
  if (job.owner) {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 7, minWidth: 0 }}>
        <Avatar person={job.owner} size={24} />
        <span style={{
          fontSize: 13, fontWeight: 600, color: "var(--text-primary)",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>{job.owner.first || job.owner.name}</span>
      </span>
    );
  }
  // Nobody owns it yet.
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--text-tertiary)", fontSize: 12.5, fontWeight: 500 }}>
      <span style={{ width: 7, height: 7, borderRadius: 999, background: "var(--live)", flex: "none" }} />
      Available
    </span>
  );
}

/* ── A single table row ── */
export function JobRow({
  job, onOpen, onGenerate, onAssign, onRegenerate,
  isAdmin = false, reps = [], onAssignToRep, showConnects = false,
}: {
  job: Job;
  onOpen: (job: Job) => void;
  onGenerate: (job: Job) => void;
  onAssign: (job: Job) => void;
  onRegenerate: (job: Job) => void;
  isAdmin?: boolean;
  reps?: Rep[];
  onAssignToRep?: (job: Job, repId: string) => void | Promise<void>;
  showConnects?: boolean;
}): JSX.Element {
  const [hover, setHover] = useState(false);

  // Modern data-table: NO vertical grid lines — only a light row divider + hover lift.
  const cellBase: CSSProperties = {
    display: "flex", alignItems: "center",
    padding: "22px 14px",
  };

  return (
    <div
      role="row"
      className="rx-job-row"
      onClick={() => onOpen(job)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "grid",
        gridTemplateColumns: gridCols(showConnects),
        borderBottom: "1px solid var(--border)",
        cursor: "pointer",
        background: hover ? "var(--indigo-50)" : "var(--surface)",
        boxShadow: hover ? "inset 3px 0 0 var(--accent)" : "inset 3px 0 0 transparent",
        transition: "background 0.14s ease, box-shadow 0.14s ease",
        minHeight: 92,
      }}
    >
      {/* ── Col 1: Created (in our DB) — FIRST ── */}
      <div className="rx-col-created" style={{ ...cellBase, justifyContent: "flex-start" }}>
        <DateCell value={job.createdAgo} align="flex-start" />
      </div>

      {/* ── Col 2: Title + snippet + meta ── */}
      <div style={{ ...cellBase, flexDirection: "column", alignItems: "flex-start", justifyContent: "center", gap: 6, padding: "18px 16px 18px 12px", minWidth: 0 }}>
        {/* Title line */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", minWidth: 0 }}>
          <span style={{
            fontSize: 15, fontWeight: 700, color: "var(--text-primary)",
            letterSpacing: "-0.015em", lineHeight: 1.25,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            flex: 1, minWidth: 0,
          }}>{job.title}</span>
          {job.url && (
            <a
              href={job.url} target="_blank" rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              title="Open on Upwork"
              style={{
                flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center",
                width: 26, height: 26, borderRadius: "var(--radius-button)",
                color: "var(--accent)", background: "var(--accent-tint)",
                border: "1px solid var(--indigo-200)",
                transition: "background 0.12s ease, color 0.12s ease",
              }}
            >
              <ExternalIcon />
            </a>
          )}
        </div>

        {/* Meta line — taxonomy + location + payment (under the title, image-2 style) */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {job.chips.map((c, i) => <TaxonomyChip key={i} level={c.level} isNew={c.isNew}>{c.label}</TaxonomyChip>)}
          {job.client.location && job.client.location !== "—" && (
            <MetaTag icon={<PinIcon />} text={job.client.location} />
          )}
          {job.client.payment && job.client.payment !== "—" && (
            <PaymentTag verified={job.client.payment === "Verified"} />
          )}
          {/* Mobile-only: budget inline since that column is hidden on small screens */}
          {job.budget && <span className="rx-mobile-only" style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>{job.budget}</span>}
        </div>

        {/* Description snippet — 2-line clamp (clearly smaller + lighter than the title) */}
        {job.desc && (
          <p style={{
            margin: "4px 0", fontSize: 12.5, fontWeight: 400, color: "var(--text-tertiary)", lineHeight: 1.6,
            display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
            overflow: "hidden", width: "100%",
          }}>{job.desc.replace(/\s+/g, " ").trim()}</p>
        )}

        {/* Relevance + quality + posted date — bottom row (Upwork-card style, Monday colors) */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 2 }}>
          <RelevanceBadge state={job.relevance} dense />
          <QualityChip quality={job.quality} dense />
          {job.postedAgo && job.postedAgo !== "—" && (
            <MetaTag icon={<ClockIcon />} text={`Posted ${job.postedAgo}`} />
          )}
        </div>
      </div>

      {/* ── Col 4: Budget ── */}
      <div className="rx-col-budget" style={{ ...cellBase, justifyContent: "flex-end" }}>
        <span style={{
          fontFamily: "var(--font-ui)", fontSize: 13.5, fontWeight: 700, color: "var(--text-primary)",
          fontVariantNumeric: "tabular-nums", textAlign: "right", whiteSpace: "nowrap",
        }}>{job.budget || "—"}</span>
      </div>

      {/* ── Col 5: Connects — only in the Submitted view (connects spent) ── */}
      {showConnects && (
        <div className="rx-col-connects" style={{ ...cellBase, justifyContent: "flex-end" }}>
          <span style={{
            fontFamily: "var(--font-ui)", fontSize: 13.5, fontWeight: 600,
            color: job.connects > 0 ? "var(--text-primary)" : "var(--text-tertiary)",
            fontVariantNumeric: "tabular-nums", textAlign: "right",
          }}>
            {job.connects > 0 ? job.connects : "—"}
          </span>
        </div>
      )}

      {/* ── Col 6: Assignee ── */}
      <div className="rx-row-action" style={{ ...cellBase, justifyContent: "flex-start" }}>
        <AssigneeCell
          job={job}
          isAdmin={isAdmin}
          reps={reps}
          onAssignToRep={onAssignToRep || (() => {})}
        />
      </div>

      {/* ── Col 8: Proposal status (LAST) ── */}
      <div style={{ ...cellBase, justifyContent: "flex-start" }}>
        <StatusBadge state={job.actionState} />
      </div>
    </div>
  );
}

/* ── Micro inline tag (location) ── */
function MetaTag({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      fontSize: 11.5, fontWeight: 500, color: "var(--text-secondary)", whiteSpace: "nowrap",
    }}>
      <span style={{ display: "inline-flex", color: "var(--accent)", opacity: 0.85 }}>{icon}</span>
      {text}
    </span>
  );
}

function PaymentTag({ verified }: { verified: boolean }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 3,
      fontSize: 11.5, fontWeight: 500,
      color: verified ? "var(--relevant-text)" : "var(--text-tertiary)",
      whiteSpace: "nowrap",
    }}>
      {verified
        ? <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><path d="M20 6L9 17l-5-5" /></svg>
        : <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
      }
      {verified ? "Payment verified" : "Unverified"}
    </span>
  );
}

/* ── Micro SVG icons ── */
function PinIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
    </svg>
  );
}
function ClockIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
    </svg>
  );
}
function ExternalIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

/* ── Skeleton loading row ── */
function SkeletonRow({ showConnects = false }: { showConnects?: boolean }): JSX.Element {
  const bar = (w: string | number, h = 11) => (
    <span style={{
      display: "inline-block", height: h, width: w, borderRadius: 3, flexShrink: 0,
      background: "linear-gradient(90deg, var(--surface-2) 25%, var(--border) 37%, var(--surface-2) 63%)",
      backgroundSize: "600px 100%", animation: "rx-shimmer 1.4s infinite linear",
    }} />
  );
  return (
    <div className="rx-skeleton-row" style={{
      display: "grid",
      gridTemplateColumns: gridCols(showConnects),
      borderBottom: "1px solid var(--border)", minHeight: 72,
    }}>
      {/* created */}
      <div style={{ padding: "14px 12px", display: "flex", flexDirection: "column", gap: 4, justifyContent: "center" }}>{bar(64, 12)}{bar(40)}</div>
      {/* title */}
      <div style={{ padding: "12px 16px 12px 0", display: "flex", flexDirection: "column", gap: 7, justifyContent: "center" }}>
        {bar("55%", 13)}{bar(120, 18)}{bar("85%")}{bar("40%")}
      </div>
      {/* budget */}
      <div style={{ padding: 14, display: "flex", alignItems: "center", justifyContent: "flex-end" }}>{bar(60)}</div>
      {/* connects */}
      {showConnects && <div style={{ padding: 14, display: "flex", alignItems: "center", justifyContent: "flex-end" }}>{bar(32)}</div>}
      {/* assignee */}
      <div style={{ padding: 14, display: "flex", alignItems: "center", justifyContent: "flex-start" }}>{bar(100, 24)}</div>
      {/* status */}
      <div style={{ padding: "14px 12px", display: "flex", alignItems: "center" }}>{bar(72, 22)}</div>
    </div>
  );
}

/* ── Empty / error states ── */
function EmptyState({ boardEmpty }: { boardEmpty: boolean }): JSX.Element {
  return (
    <div style={{ padding: "64px 24px", textAlign: "center" }}>
      <div style={{ width: 48, height: 48, borderRadius: 12, background: "var(--surface-2)", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--text-tertiary)", marginBottom: 16 }}>
        <RXIcons.board size={22} />
      </div>
      <div style={{ fontSize: 17, fontWeight: 600, color: "var(--text-primary)", marginBottom: 6 }}>
        {boardEmpty ? "No jobs on your board yet" : "No jobs match these filters"}
      </div>
      <div style={{ fontSize: 13.5, color: "var(--text-secondary)" }}>
        {boardEmpty ? "New jobs appear here as they're assigned to you." : "Clear a filter or switch tabs to see more."}
      </div>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }): JSX.Element {
  return (
    <div style={{ padding: "54px 24px", textAlign: "center" }}>
      <div style={{ width: 48, height: 48, borderRadius: 12, background: "var(--irrelevant-fill,var(--surface-2))", color: "var(--irrelevant-text)", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      </div>
      <div style={{ fontSize: 17, fontWeight: 600, marginBottom: 6 }}>Couldn't load the board</div>
      <div style={{ fontSize: 13.5, color: "var(--text-secondary)", marginBottom: 16 }}>{message}</div>
      {onRetry && <Button variant="secondary" size="sm" onClick={onRetry}>Try again</Button>}
    </div>
  );
}

/* ── KPI strip ── (counts come from the server, scoped to the role/tab, not the page) */
export interface BoardStats { on_board: number; relevant: number; review: number; submitted: number; connect_spent?: number }

type KpiKey = "on_board" | "relevant" | "review" | "submitted";

function KpiStrip({ stats, onSelect, activeKey }: {
  stats: BoardStats;
  onSelect?: (key: KpiKey) => void;
  activeKey?: KpiKey | null;
}): JSX.Element {
  // Clickable filter KPIs.
  const kpis: { key: KpiKey; label: string; value: number; color: string; fill: string }[] = [
    { key: "on_board",  label: "On board",     value: stats.on_board,  color: "var(--text-primary)",   fill: "var(--surface)" },
    { key: "relevant",  label: "Relevant",     value: stats.relevant,  color: "var(--relevant-text)",  fill: "var(--relevant-fill)" },
    { key: "review",    label: "Needs review", value: stats.review,    color: "var(--review-text)",    fill: "var(--review-fill)" },
    { key: "submitted", label: "Submitted",    value: stats.submitted, color: "var(--info-text)",      fill: "var(--info-fill)" },
  ];
  const labelSt = { fontSize: 11, fontWeight: 500 as const, marginBottom: 4, letterSpacing: "0.01em", opacity: 0.8 };
  const valueSt = { fontSize: 24, fontWeight: 700 as const, fontFamily: "var(--font-mono)", letterSpacing: "-0.03em", lineHeight: 1 };
  return (
    <div className="rx-kpi-grid" style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 10, marginBottom: 18 }}>
      {kpis.map((k) => {
        const clickable = !!onSelect;
        const active = activeKey === k.key;
        return (
          <button
            key={k.key}
            onClick={clickable ? () => onSelect!(k.key) : undefined}
            style={{
              textAlign: "left", font: "inherit",
              background: k.fill,
              border: active ? "1px solid var(--accent)" : "1px solid var(--border)",
              borderRadius: "var(--radius-card)", padding: "11px 13px",
              boxShadow: active ? "0 0 0 3px var(--accent-tint)" : "var(--shadow-sm)",
              cursor: clickable ? "pointer" : "default",
              transition: "box-shadow 0.12s ease, border-color 0.12s ease, transform 0.12s ease",
            }}
          >
            <div style={{ ...labelSt, color: k.color }}>{k.label}</div>
            <div style={{ ...valueSt, color: k.color }}>{k.value}</div>
          </button>
        );
      })}
      {/* Connect spent — a metric, not a filter. Scoped to the tab (All → overall, Assigned to me → own). */}
      <div style={{
        background: "var(--accent-tint)", border: "1px solid var(--indigo-200)",
        borderRadius: "var(--radius-card)", padding: "11px 13px", boxShadow: "var(--shadow-sm)",
      }}>
        <div style={{ ...labelSt, color: "var(--accent-on-tint)" }}>Connect spent</div>
        <div style={{ ...valueSt, color: "var(--accent-on-tint)" }}>{stats.connect_spent ?? 0}</div>
      </div>
    </div>
  );
}

/* ── Board query state (lifted to App; filtering/sorting/paging run server-side) ── */
export interface BoardControls {
  tab: TabId;
  relevance: "all" | "relevant" | "review" | "irrelevant";
  // Client-only: the Submitted KPI view. Not sent to the API — App aggregates the rep's own
  // pages and filters to submitted rows (submitted proposals are always the rep's own jobs).
  submittedView: boolean;
  quality: string[];
  // Created-date range (YYYY-MM-DD, inclusive) — drives the whole board + KPI strip. null = all time.
  dateFrom: string | null;
  dateTo: string | null;
  sort: SortKey;
  dir: "asc" | "desc";
  page: number;
}

export const DEFAULT_CONTROLS: BoardControls = {
  tab: "all",
  relevance: "all",
  submittedView: false,
  quality: [],
  dateFrom: null,
  dateTo: null,
  sort: "posted",
  dir: "desc",
  page: 1,
};

/* ── Pager ── */
function Pager({
  page, pageSize, total, onPage,
}: {
  page: number; pageSize: number; total: number; onPage: (p: number) => void;
}): JSX.Element | null {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  const btn = (label: ReactNode, target: number, disabled: boolean, key: string) => (
    <button
      key={key}
      onClick={() => !disabled && onPage(target)}
      disabled={disabled}
      style={{
        minWidth: 30, height: 30, padding: "0 9px", borderRadius: "var(--radius-button)",
        border: "1px solid var(--border)",
        background: disabled ? "var(--surface-2)" : "var(--surface)",
        color: disabled ? "var(--text-tertiary)" : "var(--text-secondary)",
        cursor: disabled ? "default" : "pointer", fontSize: 12.5, fontWeight: 600,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
      }}
    >{label}</button>
  );

  // Compact window of page numbers around the current page.
  const windowed: number[] = [];
  const lo = Math.max(1, page - 2);
  const hi = Math.min(pages, page + 2);
  for (let i = lo; i <= hi; i++) windowed.push(i);

  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      gap: 12, flexWrap: "wrap", marginTop: 14,
    }}>
      <span style={{ fontSize: 12.5, color: "var(--text-tertiary)" }}>
        <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-secondary)", fontWeight: 600 }}>{from}–{to}</span>
        {" of "}
        <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-secondary)", fontWeight: 600 }}>{total}</span>
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
        {btn("‹ Prev", page - 1, page <= 1, "prev")}
        {lo > 1 && (
          <>
            {btn("1", 1, false, "first")}
            {lo > 2 && <span style={{ color: "var(--text-tertiary)", padding: "0 2px" }}>…</span>}
          </>
        )}
        {windowed.map(p => (
          <button
            key={`p${p}`}
            onClick={() => onPage(p)}
            style={{
              minWidth: 30, height: 30, padding: "0 9px", borderRadius: "var(--radius-button)",
              border: p === page ? "1px solid var(--indigo-200)" : "1px solid var(--border)",
              background: p === page ? "var(--accent-tint)" : "var(--surface)",
              color: p === page ? "var(--accent-on-tint)" : "var(--text-secondary)",
              cursor: "pointer", fontSize: 12.5, fontWeight: p === page ? 700 : 600,
              fontFamily: "var(--font-mono)",
            }}
          >{p}</button>
        ))}
        {hi < pages && (
          <>
            {hi < pages - 1 && <span style={{ color: "var(--text-tertiary)", padding: "0 2px" }}>…</span>}
            {btn(String(pages), pages, false, "last")}
          </>
        )}
        {btn("Next ›", page + 1, page >= pages, "next")}
      </div>
    </div>
  );
}

/* ── Main JobBoard component (controlled: query state lives in App) ── */
export function JobBoard({
  controls, setControls, stats, total, pageSize,
  onNavigate, onOpen, onGenerate, onAssign, onRegenerate,
  loading, jobs, error, onRetry,
  isAdmin = false, reps = [], onAssignToRep,
}: {
  controls: BoardControls;
  setControls: (next: BoardControls) => void;
  stats: BoardStats;
  total: number;
  pageSize: number;
  onNavigate: (link: ActionLink) => void;
  onOpen: (job: Job) => void;
  onGenerate: (job: Job) => void;
  onAssign: (job: Job) => void;
  onRegenerate: (job: Job) => void;
  loading: boolean;
  jobs: Job[];
  error?: string | null;
  onRetry?: () => void;
  isAdmin?: boolean;
  reps?: Rep[];
  onAssignToRep?: (job: Job, repId: string) => void | Promise<void>;
}): JSX.Element {
  // Collapsible filter categories — single click collapses, double click re-opens.
  const [relOpen, setRelOpen] = useState(true);
  const [qualOpen, setQualOpen] = useState(true);

  // Any change to a filter/sort/tab resets to page 1; page changes keep the rest.
  const patch = (p: Partial<BoardControls>, resetPage = true) =>
    setControls({ ...controls, ...p, ...(resetPage ? { page: 1 } : {}) });

  const setTab = (tab: TabId) => patch({ tab });
  // Any relevance/quality change also leaves the Submitted view (they're mutually exclusive).
  const setRel = (relevance: BoardControls["relevance"]) => patch({ relevance, submittedView: false });
  const toggleQuality = (v: string) =>
    patch({ quality: controls.quality.includes(v) ? controls.quality.filter(x => x !== v) : [...controls.quality, v], submittedView: false });

  const handleSort = (k: SortKey) => {
    if (k === controls.sort) patch({ dir: controls.dir === "desc" ? "asc" : "desc" });
    else                     patch({ sort: k, dir: "desc" });
  };

  // Relevance = single-select (mirrors the DB job_verdict / extension tags); Quality = multi-select.
  const REL_PILLS = [
    { id: "relevant",   label: "Relevant",     dot: "var(--mon-green)"  },
    { id: "review",     label: "Needs review", dot: "var(--mon-orange)" },
    { id: "irrelevant", label: "Irrelevant",   dot: "var(--mon-red)"    },
  ];
  const QUAL_PILLS = [
    { id: "good",   label: "Good",   dot: "var(--mon-green)"  },
    { id: "medium", label: "Medium", dot: "var(--mon-orange)" },
    { id: "poor",   label: "Poor",   dot: "var(--mon-red)"    },
  ];

  const allActive = controls.relevance === "all" && !controls.submittedView && controls.quality.length === 0;
  const resetFilters = () => patch({ relevance: "all", submittedView: false, quality: [] });

  // KPI cards act as quick filters. Relevance ones filter server-side; Submitted is a client-side
  // aggregate over the rep's own pages (App does the fetching), so it spans every page.
  let kpiActive: KpiKey | null = null;
  if (controls.submittedView) kpiActive = "submitted";
  else if (allActive) kpiActive = "on_board";
  else if (controls.relevance === "relevant") kpiActive = "relevant";
  else if (controls.relevance === "review") kpiActive = "review";
  const onKpi = (key: KpiKey) => {
    // KPIs are mutually exclusive — picking any other one drops the Submitted view (setRel/reset clear it).
    if (key === "submitted") patch({ submittedView: !controls.submittedView });
    else if (key === "on_board") resetFilters();
    else if (key === "relevant") setRel("relevant");
    else if (key === "review") setRel("review");
  };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {/* Slim header bar (replaces the tall page header) */}
      <div style={{
        display: "flex", alignItems: "center",
        padding: "8px 28px", borderBottom: "1px solid var(--border)",
        background: "var(--surface)", flexShrink: 0,
      }}>
        <DateRangeControl from={controls.dateFrom} to={controls.dateTo} onChange={(f, t) => patch({ dateFrom: f, dateTo: t })} />
      </div>

      <div className="rx-page-content" style={{ flex: 1, overflowY: "auto", padding: "20px 28px 40px" }}>
        <KpiStrip stats={stats} onSelect={onKpi} activeKey={kpiActive} />

        {/* ── Filter bar ── */}
        <div className="rx-filter-bar" style={{
          display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap",
          marginBottom: 14, padding: "8px 10px",
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: "var(--radius-card)", boxShadow: "var(--shadow-sm)",
        }}>
          {/* Master reset — relevance = all + no quality filter */}
          <FilterPill active={allActive} onClick={resetFilters}>All</FilterPill>

          {/* Relevance category (collapsible) */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginLeft: 14 }}>
            <CatToggle label="Relevance" open={relOpen} setOpen={setRelOpen} />
            {relOpen && REL_PILLS.map(r => (
              <FilterPill key={r.id} active={controls.relevance === r.id} dot={r.dot} onClick={() => setRel(r.id as BoardControls["relevance"])}>{r.label}</FilterPill>
            ))}
          </div>

          <span style={{ width: 22, flex: "none" }} />

          {/* Quality category (collapsible) */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <CatToggle label="Quality" open={qualOpen} setOpen={setQualOpen} />
            {qualOpen && QUAL_PILLS.map(q => (
              <FilterPill key={q.id} active={controls.quality.includes(q.id)} dot={q.dot} onClick={() => toggleQuality(q.id)}>{q.label}</FilterPill>
            ))}
          </div>

          <div style={{ flex: 1 }} />
          {/* Scope tabs (moved here from the top header) */}
          <Segmented value={controls.tab} onChange={setTab} options={TABS} />
        </div>

        {/* ── Table ── */}
        <div style={{
          border: "1px solid var(--border)", borderRadius: "var(--radius-card)",
          overflow: "hidden", boxShadow: "var(--shadow-sm)", background: "var(--surface)",
        }}>
          {loading ? (
            <>
              {/* skeleton header */}
              <div style={{ height: 38, background: "var(--surface-2)", borderBottom: "2px solid var(--border)", borderRadius: "12px 12px 0 0" }} />
              {[0,1,2,3,4].map(i => <SkeletonRow key={i} showConnects={controls.submittedView} />)}
            </>
          ) : error ? (
            <ErrorState message={error} onRetry={onRetry} />
          ) : jobs.length === 0 ? (
            <EmptyState boardEmpty={total === 0} />
          ) : (
            <>
              <TableHeader sort={controls.sort} dir={controls.dir} onSort={handleSort} count={total} showConnects={controls.submittedView} />
              {jobs.map(job => (
                <JobRow
                  key={job.id} job={job}
                  onOpen={onOpen} onGenerate={onGenerate}
                  onAssign={onAssign} onRegenerate={onRegenerate}
                  isAdmin={isAdmin} reps={reps} onAssignToRep={onAssignToRep}
                  showConnects={controls.submittedView}
                />
              ))}
            </>
          )}
        </div>

        {/* ── Pager ── (hidden in the Submitted view, which is a single aggregated list) */}
        {!loading && !error && !controls.submittedView && (
          <Pager page={controls.page} pageSize={pageSize} total={total} onPage={(p) => patch({ page: p }, false)} />
        )}
      </div>
    </div>
  );
}
