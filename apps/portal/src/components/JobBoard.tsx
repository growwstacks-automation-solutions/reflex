/* Reflex portal v4 — Job board: KPI strip, filters, true table listing. */

import { useState } from "react";
import type { MouseEvent, ReactNode, CSSProperties } from "react";
import { RXIcons } from "@/components/icons";
import { Button, TaxonomyChip, RelevanceBadge } from "@/components/ds";
import { QualityChip, Ownership } from "@/components/ui";
import { PageHeader } from "@/components/Shell";
import { BellButton } from "@/components/bell";
import type { Job, ActionLink } from "@/lib/types";

export type TabId = "mine" | "available" | "all";
type SortKey = "posted" | "budget" | "connects";

/* ── Fixed column widths — every row and the header share these exactly ── */
const COL = {
  status:  "164px",   /* relevance + quality badges */
  budget:  "110px",   /* budget amount */
  connects: "88px",   /* connects count */
  posted:   "80px",   /* time ago */
  action:  "148px",   /* CTA button */
} as const;

const TABS: { id: TabId; label: string }[] = [
  { id: "mine", label: "Assigned to me" },
  { id: "available", label: "Available" },
  { id: "all", label: "All" },
];

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
  label, sortKey, current, dir, onSort, style, align = "left",
}: {
  label: string; sortKey?: SortKey; current: SortKey; dir: "asc" | "desc";
  onSort: (k: SortKey) => void; style?: CSSProperties; align?: "left" | "right" | "center";
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
  sort, dir, onSort, count,
}: {
  sort: SortKey; dir: "asc" | "desc"; onSort: (k: SortKey) => void; count: number;
}): JSX.Element {
  const shared = { sort, dir, onSort } as const;
  return (
    <div className="rx-table-header" style={{
      display: "grid",
      gridTemplateColumns: `${COL.status} 1fr ${COL.budget} ${COL.connects} ${COL.posted} ${COL.action}`,
      height: 38,
      background: "var(--surface-2)",
      borderBottom: "2px solid var(--border)",
      borderRadius: "12px 12px 0 0",
      position: "sticky", top: 0, zIndex: 2,
    }}>
      {/* Status col — shows job count */}
      <div style={{ padding: "0 12px", display: "flex", alignItems: "center" }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", letterSpacing: "0.04em", textTransform: "uppercase" }}>
          Status
          <span style={{ marginLeft: 6, fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--text-secondary)", fontSize: 11 }}>({count})</span>
        </span>
      </div>
      <ColHeader label="Job title & description" sortKey={undefined} current={sort} {...shared} style={{ paddingLeft: 0 }} />
      <ColHeader label="Budget" sortKey="budget" current={sort} {...shared} align="right" />
      <ColHeader label="Connects" sortKey="connects" current={sort} {...shared} align="right" />
      <ColHeader label="Posted" sortKey="posted" current={sort} {...shared} align="right" />
      <div style={{ padding: "0 12px", display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-tertiary)" }}>Action</span>
      </div>
    </div>
  );
}

/* ── Row action cell ── */
function RowAction({
  job, onGenerate, onAssign, onRegenerate,
}: {
  job: Job; onGenerate: () => void; onAssign: () => void; onRegenerate: () => void;
}): JSX.Element | null {
  const stop = (fn: () => void) => (e: MouseEvent) => { e.stopPropagation(); fn(); };
  if (job.relevance === "irrelevant") {
    return <span style={{ fontSize: 11.5, color: "var(--text-tertiary)", fontStyle: "italic" }}>Auto-filtered</span>;
  }
  if (job.actionState === "submitted") {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 6 }} onClick={e => e.stopPropagation()}>
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 4,
          fontSize: 11.5, fontWeight: 600, color: "var(--relevant-text)",
          background: "var(--relevant-fill)", padding: "4px 9px",
          borderRadius: "var(--radius-pill)", whiteSpace: "nowrap",
        }}>
          <RXIcons.check size={12} /> Submitted
        </span>
        <button onClick={stop(onRegenerate)} title="Regenerate" style={{
          width: 26, height: 26, borderRadius: "var(--radius-button)",
          border: "1px solid var(--border)", background: "var(--surface)",
          color: "var(--text-secondary)", cursor: "pointer",
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}><RXIcons.refresh size={13} /></button>
      </div>
    );
  }
  if (job.actionState === "conversation") {
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        fontSize: 11.5, fontWeight: 600, color: "var(--info-text)",
        background: "var(--info-fill)", padding: "4px 9px",
        borderRadius: "var(--radius-pill)", whiteSpace: "nowrap",
      }}>
        <RXIcons.chat size={12} /> In conversation
      </span>
    );
  }
  if (job.ownership === "mine") {
    return <div onClick={e => e.stopPropagation()}><Button size="sm" spark onClick={onGenerate}>Generate</Button></div>;
  }
  if (job.ownership === "available") {
    return <div onClick={e => e.stopPropagation()}><Button size="sm" variant="secondary" onClick={onAssign}>Assign to me</Button></div>;
  }
  return null;
}

/* ── A single table row ── */
export function JobRow({
  job, onOpen, onGenerate, onAssign, onRegenerate,
}: {
  job: Job;
  onOpen: (job: Job) => void;
  onGenerate: (job: Job) => void;
  onAssign: (job: Job) => void;
  onRegenerate: (job: Job) => void;
}): JSX.Element {
  const [hover, setHover] = useState(false);
  const isIrrelevant = job.relevance === "irrelevant";

  const cellBase: CSSProperties = {
    display: "flex", alignItems: "center",
    padding: "14px 12px",
    borderRight: "1px solid var(--border)",
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
        gridTemplateColumns: `${COL.status} 1fr ${COL.budget} ${COL.connects} ${COL.posted} ${COL.action}`,
        borderBottom: "1px solid var(--border)",
        cursor: "pointer",
        background: hover ? "var(--indigo-50)" : "var(--surface)",
        transition: "background 0.1s ease",
        opacity: isIrrelevant ? 0.5 : 1,
        minHeight: 72,
      }}
    >
      {/* ── Col 1: Status badges ── */}
      <div style={{ ...cellBase, flexDirection: "column", alignItems: "flex-start", justifyContent: "center", gap: 5 }}>
        <RelevanceBadge state={job.relevance} dense />
        <QualityChip quality={job.quality} dense />
      </div>

      {/* ── Col 2: Title + snippet + meta ── */}
      <div style={{ ...cellBase, borderRight: "none", flexDirection: "column", alignItems: "flex-start", justifyContent: "center", gap: 4, padding: "12px 16px 12px 12px", minWidth: 0 }}>
        {/* Title line */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", minWidth: 0 }}>
          <span style={{
            fontSize: 14, fontWeight: 700, color: "var(--text-primary)",
            letterSpacing: "-0.01em", lineHeight: 1.3,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            flex: 1, minWidth: 0,
          }}>{job.title}</span>
          {job.url && (
            <a
              href={job.url} target="_blank" rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              title="Open on Upwork"
              style={{
                flexShrink: 0, display: "inline-flex", alignItems: "center",
                color: "var(--text-tertiary)", opacity: 0.7,
                transition: "opacity 0.1s",
              }}
            >
              <ExternalIcon />
            </a>
          )}
        </div>

        {/* Description snippet — 2-line clamp */}
        {job.desc && (
          <p style={{
            margin: 0, fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.5,
            display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
            overflow: "hidden", width: "100%",
          }}>{job.desc.replace(/\s+/g, " ").trim()}</p>
        )}

        {/* AI reason */}
        {job.reason && (
          <div style={{ display: "flex", alignItems: "flex-start", gap: 5, width: "100%" }}>
            <RXIcons.spark size={11} style={{ flexShrink: 0, marginTop: 2, color: "var(--accent)", opacity: 0.75 }} />
            <span style={{
              fontSize: 11.5, color: "var(--text-tertiary)", lineHeight: 1.4, fontStyle: "italic",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0,
            }}>{job.reason}</span>
          </div>
        )}

        {/* Taxonomy chips + ownership + location/payment in one compact row */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 2 }}>
          {job.chips.map((c, i) => <TaxonomyChip key={i} level={c.level} isNew={c.isNew}>{c.label}</TaxonomyChip>)}
          <Ownership job={job} />
          {job.client.location && job.client.location !== "—" && (
            <MetaTag icon={<PinIcon />} text={job.client.location} />
          )}
          {job.client.payment && job.client.payment !== "—" && (
            <PaymentTag verified={job.client.payment === "Verified"} />
          )}
          {/* Mobile-only: budget + posted inline since those columns are hidden */}
          {job.budget && <span className="rx-mobile-only" style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>{job.budget}</span>}
          <span className="rx-mobile-only" style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--text-tertiary)" }}>{job.postedAgo}</span>
        </div>
      </div>

      {/* ── Col 3: Budget ── */}
      <div className="rx-col-budget" style={{ ...cellBase, justifyContent: "flex-end" }}>
        <span style={{
          fontSize: 13, fontWeight: 700, color: "var(--text-primary)",
          fontFamily: "var(--font-mono)", textAlign: "right", whiteSpace: "nowrap",
        }}>{job.budget || "—"}</span>
      </div>

      {/* ── Col 4: Connects ── */}
      <div className="rx-col-connects" style={{ ...cellBase, justifyContent: "flex-end" }}>
        <span style={{
          fontSize: 13, fontWeight: 600, color: job.connects > 0 ? "var(--text-primary)" : "var(--text-tertiary)",
          fontFamily: "var(--font-mono)", textAlign: "right",
        }}>
          {job.connects > 0 ? job.connects : "—"}
        </span>
      </div>

      {/* ── Col 5: Posted ── */}
      <div className="rx-col-posted" style={{ ...cellBase, justifyContent: "flex-end" }}>
        <span style={{
          fontSize: 12, color: "var(--text-tertiary)", whiteSpace: "nowrap", textAlign: "right",
          fontFamily: "var(--font-mono)",
        }}>{job.postedAgo}</span>
      </div>

      {/* ── Col 6: Action ── */}
      <div className="rx-row-action" style={{ ...cellBase, borderRight: "none", justifyContent: "flex-end" }}>
        <RowAction
          job={job}
          onGenerate={() => onGenerate(job)}
          onAssign={() => onAssign(job)}
          onRegenerate={() => onRegenerate(job)}
        />
      </div>
    </div>
  );
}

/* ── Micro inline tag ── */
function MetaTag({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 3,
      fontSize: 11.5, color: "var(--text-tertiary)", whiteSpace: "nowrap",
    }}>
      <span style={{ display: "inline-flex", opacity: 0.6 }}>{icon}</span>
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
function ExternalIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

/* ── Skeleton loading row ── */
function SkeletonRow(): JSX.Element {
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
      gridTemplateColumns: `${COL.status} 1fr ${COL.budget} ${COL.connects} ${COL.posted} ${COL.action}`,
      borderBottom: "1px solid var(--border)", minHeight: 72,
    }}>
      <div style={{ padding: "14px 12px", display: "flex", flexDirection: "column", gap: 6, justifyContent: "center" }}>
        {bar(70)}{bar(64)}
      </div>
      <div style={{ padding: "12px 16px 12px 0", display: "flex", flexDirection: "column", gap: 7, justifyContent: "center" }}>
        {bar("60%", 13)}{bar("85%")}{bar("40%")}
      </div>
      <div style={{ padding: 14, display: "flex", alignItems: "center", justifyContent: "flex-end" }}>{bar(60)}</div>
      <div style={{ padding: 14, display: "flex", alignItems: "center", justifyContent: "flex-end" }}>{bar(32)}</div>
      <div style={{ padding: 14, display: "flex", alignItems: "center", justifyContent: "flex-end" }}>{bar(44)}</div>
      <div style={{ padding: 14, display: "flex", alignItems: "center", justifyContent: "flex-end" }}>{bar(90, 28)}</div>
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

/* ── KPI strip ── */
function KpiStrip({ jobs }: { jobs: Job[] }): JSX.Element {
  const count = (pred: (j: Job) => boolean) => jobs.filter(pred).length;
  const kpis = [
    { label: "On board",     value: jobs.length,                                              color: "var(--text-primary)",   fill: "var(--surface)" },
    { label: "Relevant",     value: count(j => j.relevance === "relevant"),                   color: "var(--relevant-text)",  fill: "var(--relevant-fill)" },
    { label: "Needs review", value: count(j => j.relevance === "review"),                     color: "var(--review-text)",    fill: "var(--review-fill)" },
    { label: "Submitted",    value: count(j => j.actionState === "submitted"),                color: "var(--info-text)",      fill: "var(--info-fill)" },
  ];
  return (
    <div className="rx-kpi-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 18 }}>
      {kpis.map((k, i) => (
        <div key={i} style={{
          background: k.fill, border: "1px solid var(--border)",
          borderRadius: "var(--radius-card)", padding: "13px 16px",
          boxShadow: "var(--shadow-sm)",
        }}>
          <div style={{ fontSize: 11.5, color: k.color, fontWeight: 500, marginBottom: 5, letterSpacing: "0.01em", opacity: 0.8 }}>{k.label}</div>
          <div style={{ fontSize: 28, fontWeight: 700, fontFamily: "var(--font-mono)", letterSpacing: "-0.03em", color: k.color, lineHeight: 1 }}>{k.value}</div>
        </div>
      ))}
    </div>
  );
}

/* ── Budget string → number for sorting ── */
function budgetNum(b: string): number {
  const m = b.match(/[\d.]+/);
  return m ? parseFloat(m[0]) : 0;
}

/* ── Main JobBoard component ── */
export function JobBoard({
  tab, setTab, onNavigate, onOpen, onGenerate, onAssign, onRegenerate,
  loading, jobs, error, onRetry,
}: {
  tab: TabId;
  setTab: (id: TabId) => void;
  onNavigate: (link: ActionLink) => void;
  onOpen: (job: Job) => void;
  onGenerate: (job: Job) => void;
  onAssign: (job: Job) => void;
  onRegenerate: (job: Job) => void;
  loading: boolean;
  jobs: Job[];
  error?: string | null;
  onRetry?: () => void;
}): JSX.Element {
  const [rel,     setRel]     = useState<"all" | "relevant" | "review">("all");
  const [quality, setQuality] = useState<string[]>([]);
  const [cats,    setCats]    = useState<string[]>([]);
  const [sort,    setSort]    = useState<SortKey>("posted");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const handleSort = (k: SortKey) => {
    if (k === sort) { setSortDir(d => d === "desc" ? "asc" : "desc"); }
    else            { setSort(k); setSortDir("desc"); }
  };

  const toggle = (arr: string[], set: (v: string[]) => void, v: string) =>
    set(arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]);

  const filtered = jobs.filter(j => {
    if (tab === "mine"      && j.ownership !== "mine")      return false;
    if (tab === "available" && j.ownership !== "available") return false;
    if (rel === "relevant"  && j.relevance !== "relevant")  return false;
    if (rel === "review"    && j.relevance !== "review")    return false;
    if (quality.length && !quality.includes(j.quality))    return false;
    if (cats.length    && !cats.includes(j.cat))           return false;
    return true;
  });

  const visible = [...filtered].sort((a, b) => {
    const flip = sortDir === "asc" ? -1 : 1;
    if (sort === "budget")   return flip * (budgetNum(b.budget) - budgetNum(a.budget));
    if (sort === "connects") return flip * (b.connects - a.connects);
    return sortDir === "asc" ? 1 : 0; // posted: API returns desc; flip for asc
  });

  const QUAL_PILLS = [
    { id: "good",   label: "Good",   dot: "var(--status-good)" },
    { id: "medium", label: "Medium", dot: "var(--status-warn)" },
    { id: "watch",  label: "Watch",  dot: "var(--status-info)" },
    { id: "poor",   label: "Poor",   dot: "var(--status-bad)"  },
  ];
  const CATS = ["GHL", "AI agents", "Voice", "Cloud"];

  const headerRight = (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <Segmented value={tab} onChange={setTab} options={TABS} />
      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, color: "var(--text-tertiary)" }}>
        <span style={{ width: 6, height: 6, borderRadius: 999, background: "var(--live)", display: "inline-block" }} />
        <span style={{ fontFamily: "var(--font-mono)" }}>live</span>
      </span>
      <BellButton onNavigate={onNavigate} />
    </div>
  );

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <PageHeader title="Job board" subtitle="Read the job, decide if it's worth it, act in one click." right={headerRight} />

      <div className="rx-page-content" style={{ flex: 1, overflowY: "auto", padding: "20px 28px 40px" }}>
        <KpiStrip jobs={jobs} />

        {/* ── Filter bar ── */}
        <div className="rx-filter-bar" style={{
          display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap",
          marginBottom: 14, padding: "8px 10px",
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: "var(--radius-card)", boxShadow: "var(--shadow-sm)",
        }}>
          <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--text-tertiary)", letterSpacing: "0.07em", textTransform: "uppercase", marginRight: 2, whiteSpace: "nowrap" }}>Relevance</span>
          <FilterPill active={rel === "all"}      onClick={() => setRel("all")}>All</FilterPill>
          <FilterPill active={rel === "relevant"} onClick={() => setRel("relevant")}>Relevant</FilterPill>
          <FilterPill active={rel === "review"}   onClick={() => setRel("review")}>Needs review</FilterPill>

          <VDivider />

          <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--text-tertiary)", letterSpacing: "0.07em", textTransform: "uppercase", marginRight: 2, whiteSpace: "nowrap" }}>Quality</span>
          {QUAL_PILLS.map(q => (
            <FilterPill key={q.id} active={quality.includes(q.id)} dot={q.dot} onClick={() => toggle(quality, setQuality, q.id)}>{q.label}</FilterPill>
          ))}

          <VDivider />

          <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--text-tertiary)", letterSpacing: "0.07em", textTransform: "uppercase", marginRight: 2, whiteSpace: "nowrap" }}>Category</span>
          {CATS.map(c => (
            <FilterPill key={c} active={cats.includes(c)} onClick={() => toggle(cats, setCats, c)}>{c}</FilterPill>
          ))}

          <div style={{ flex: 1 }} />
          <button title="More filters" style={{
            width: 30, height: 30, borderRadius: "var(--radius-button)",
            border: "1px solid var(--border)", background: "var(--surface-2)",
            color: "var(--text-secondary)", cursor: "pointer",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
          }}><RXIcons.funnel size={13} /></button>
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
              {[0,1,2,3,4].map(i => <SkeletonRow key={i} />)}
            </>
          ) : error ? (
            <ErrorState message={error} onRetry={onRetry} />
          ) : visible.length === 0 ? (
            <EmptyState boardEmpty={jobs.length === 0} />
          ) : (
            <>
              <TableHeader sort={sort} dir={sortDir} onSort={handleSort} count={visible.length} />
              {visible.map(job => (
                <JobRow
                  key={job.id} job={job}
                  onOpen={onOpen} onGenerate={onGenerate}
                  onAssign={onAssign} onRegenerate={onRegenerate}
                />
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
