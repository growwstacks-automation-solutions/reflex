/* Reflex portal v3 — Job board: header, KPI strip, filters, compact rows, loading/empty. */

import { useState } from "react";
import type { MouseEvent, ReactNode } from "react";
import { RXIcons } from "@/components/icons";
import { Button, TaxonomyChip, RelevanceBadge } from "@/components/ds";
import { Card, QualityChip, Ownership, Mono } from "@/components/ui";
import { PageHeader } from "@/components/Shell";
import { BellButton } from "@/components/bell";
import { RX_DATA } from "@/lib/mock-data";
import type { Job, ActionLink, Kpi } from "@/lib/types";

export type TabId = "mine" | "available" | "all";

const TABS: { id: TabId; label: string }[] = [
  { id: "mine", label: "Assigned to me" },
  { id: "available", label: "Available" },
  { id: "all", label: "All" },
];

export function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (id: T) => void;
  options: { id: T; label: string }[];
}): JSX.Element {
  return (
    <div style={{
      display: "inline-flex", padding: 3, gap: 2, borderRadius: "var(--radius-button)",
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

export function FilterPill({
  active,
  onClick,
  children,
  dot,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  dot?: string;
}): JSX.Element {
  return (
    <button onClick={onClick} style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "6px 12px", borderRadius: "var(--radius-pill)", cursor: "pointer",
      border: active ? "1px solid var(--terracotta-100)" : "1px solid var(--border)",
      background: active ? "var(--accent-tint)" : "var(--surface)",
      color: active ? "var(--accent-on-tint)" : "var(--text-secondary)",
      fontSize: 13, fontWeight: active ? 600 : 500, whiteSpace: "nowrap",
      transition: "background 0.12s ease, border-color 0.12s ease",
    }}>
      {dot && <span style={{ width: 7, height: 7, borderRadius: 999, background: dot }}></span>}
      {children}
    </button>
  );
}

function Divider(): JSX.Element {
  return <span style={{ width: 1, height: 20, background: "var(--border)", flex: "none" }}></span>;
}

/* The action control on a row, by state. */
function RowAction({
  job,
  onGenerate,
  onAssign,
  onRegenerate,
}: {
  job: Job;
  onGenerate: () => void;
  onAssign: () => void;
  onRegenerate: () => void;
}): JSX.Element | null {
  const stop = (fn?: () => void) => (e: MouseEvent) => { e.stopPropagation(); if (fn) fn(); };
  if (job.relevance === "irrelevant") {
    return <span style={{ fontSize: 12.5, color: "var(--text-tertiary)", fontStyle: "normal" }}>Auto-filtered</span>;
  }
  if (job.actionState === "submitted") {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8 }} onClick={e => e.stopPropagation()}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 500, color: "var(--relevant-text)" }}>
          <RXIcons.check size={15} /> Proposal generated
        </span>
        <button onClick={stop(onRegenerate)} title="Regenerate proposal" style={{
          width: 30, height: 30, borderRadius: "var(--radius-button)", border: "1px solid var(--border)",
          background: "var(--surface)", color: "var(--text-secondary)", cursor: "pointer",
          display: "inline-flex", alignItems: "center", justifyContent: "center",
        }}><RXIcons.refresh size={15} /></button>
      </div>
    );
  }
  if (job.actionState === "conversation") {
    return <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 500, color: "var(--info-text)" }}><RXIcons.chat size={14} /> In conversation</span>;
  }
  if (job.ownership === "mine") {
    return <div onClick={e => e.stopPropagation()}><Button size="sm" spark onClick={onGenerate}>Generate proposal</Button></div>;
  }
  if (job.ownership === "available") {
    return <div onClick={e => e.stopPropagation()}><Button size="sm" variant="secondary" onClick={onAssign}>Assign to me</Button></div>;
  }
  return null;
}

export function JobRow({
  job,
  onOpen,
  onGenerate,
  onAssign,
  onRegenerate,
}: {
  job: Job;
  onOpen: (job: Job) => void;
  onGenerate: (job: Job) => void;
  onAssign: (job: Job) => void;
  onRegenerate: (job: Job) => void;
}): JSX.Element {
  const [hover, setHover] = useState(false);
  return (
    <div onClick={() => onOpen(job)}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        padding: "14px 18px", cursor: "pointer",
        background: hover ? "var(--surface-2)" : "var(--surface)",
        borderBottom: "1px solid var(--border)",
        transition: "background 0.1s ease",
        opacity: job.relevance === "irrelevant" ? 0.62 : 1,
      }}>
      {/* Line 1: relevance · quality · title */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 9 }}>
        <RelevanceBadge state={job.relevance} />
        <QualityChip quality={job.quality} dense />
        <span style={{ fontSize: 14.5, fontWeight: 600, letterSpacing: "-0.01em", color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0 }}>{job.title}</span>
      </div>

      {/* Line 2: taxonomy chips */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
        {job.chips.map((c, i) => <TaxonomyChip key={i} level={c.level} isNew={c.isNew}>{c.label}</TaxonomyChip>)}
      </div>

      {/* Line 3: reason for selection (quiet) */}
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 11, color: "var(--text-tertiary)" }}>
        <RXIcons.spark size={13} style={{ flex: "none", opacity: 0.7 }} />
        <span style={{ fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{job.reason}</span>
      </div>

      {/* Line 4: ownership · meta · action */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 12.5 }}>
        <Ownership job={job} />
        <Mono style={{ color: "var(--text-secondary)" }}>{job.budget}</Mono>
        <Mono style={{ color: "var(--text-secondary)" }}>{job.connects} connects</Mono>
        <Mono style={{ color: "var(--text-tertiary)" }}>{job.postedAgo}</Mono>
        <div style={{ flex: 1 }}></div>
        <RowAction job={job} onGenerate={() => onGenerate(job)} onAssign={() => onAssign(job)} onRegenerate={() => onRegenerate(job)} />
      </div>
    </div>
  );
}

function SkeletonRow(): JSX.Element {
  const bar = (w: number | string) => <span style={{
    display: "inline-block", height: 12, width: w, borderRadius: 4,
    background: "linear-gradient(90deg, var(--surface-2) 25%, var(--border) 37%, var(--surface-2) 63%)",
    backgroundSize: "800px 100%", animation: "rx-shimmer 1.4s infinite linear",
  }}></span>;
  return (
    <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)" }}>
      <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>{bar(70)}{bar(64)}{bar("38%")}</div>
      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>{bar(48)}{bar(60)}{bar(44)}{bar(52)}</div>
      <div style={{ marginBottom: 11 }}>{bar("55%")}</div>
      <div style={{ display: "flex", gap: 14 }}>{bar(90)}{bar(50)}{bar(70)}</div>
    </div>
  );
}

function KpiStrip(): JSX.Element {
  const kpis = RX_DATA.kpis;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 18 }}>
      {kpis.map((k: Kpi, i) => (
        <Card key={i} style={{ background: "var(--bg-raised)", boxShadow: "none" }} pad="14px 16px">
          <div style={{ fontSize: 12.5, color: "var(--text-secondary)", marginBottom: 6 }}>{k.label}</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ fontSize: 26, fontWeight: 600, fontFamily: "var(--font-mono)", letterSpacing: "-0.02em" }}>{k.value}</span>
            {k.delta && <span style={{ fontSize: 12.5, fontWeight: 600, color: k.deltaTone === "good" ? "var(--relevant-text)" : "var(--text-tertiary)", fontFamily: "var(--font-mono)" }}>{k.delta}</span>}
            {k.sub && <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{k.sub}</span>}
          </div>
        </Card>
      ))}
    </div>
  );
}

export function JobBoard({
  tab,
  setTab,
  onNavigate,
  onOpen,
  onGenerate,
  onAssign,
  onRegenerate,
  loading,
}: {
  tab: TabId;
  setTab: (id: TabId) => void;
  onNavigate: (link: ActionLink) => void;
  onOpen: (job: Job) => void;
  onGenerate: (job: Job) => void;
  onAssign: (job: Job) => void;
  onRegenerate: (job: Job) => void;
  loading: boolean;
}): JSX.Element {
  const [rel, setRel] = useState<"all" | "relevant" | "review">("all");  // all | relevant | review
  const [quality, setQuality] = useState<string[]>([]);                  // multi: good/medium/poor
  const [cats, setCats] = useState<string[]>([]);                        // multi: GHL / AI agents / Voice / Cloud

  const toggle = (arr: string[], set: (v: string[]) => void, v: string) => set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  const jobs = RX_DATA.jobs.filter(j => {
    if (tab === "mine" && j.ownership !== "mine") return false;
    if (tab === "available" && j.ownership !== "available") return false;
    if (rel === "relevant" && j.relevance !== "relevant") return false;
    if (rel === "review" && j.relevance !== "review") return false;
    if (quality.length && !quality.includes(j.quality)) return false;
    if (cats.length && !cats.includes(j.cat)) return false;
    return true;
  });

  const QUAL_PILLS = [
    { id: "good", label: "Good", dot: "var(--relevant-text)" },
    { id: "medium", label: "Medium", dot: "var(--review-text)" },
    { id: "poor", label: "Poor", dot: "var(--irrelevant-text)" },
  ];
  const CATS = ["GHL", "AI agents", "Voice", "Cloud"];

  const headerRight = (
    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
      <Segmented value={tab} onChange={setTab} options={TABS} />
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--text-tertiary)" }}>
        <RXIcons.sync size={14} /> <span style={{ fontFamily: "var(--font-mono)" }}>synced 2 min ago</span>
      </span>
      <BellButton onNavigate={onNavigate} />
    </div>
  );

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <PageHeader title="Job board" subtitle="Read the job, decide if it's worth it, act in one click." right={headerRight} />

      <div style={{ flex: 1, overflowY: "auto", padding: "20px 28px 40px" }}>
        <KpiStrip />

        {/* Filters */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
          <FilterPill active={rel === "all"} onClick={() => setRel("all")}>All</FilterPill>
          <FilterPill active={rel === "relevant"} onClick={() => setRel("relevant")}>Relevant</FilterPill>
          <FilterPill active={rel === "review"} onClick={() => setRel("review")}>Needs review</FilterPill>
          <Divider />
          <span style={{ fontSize: 12.5, color: "var(--text-tertiary)", marginRight: 2 }}>Quality</span>
          {QUAL_PILLS.map(q => (
            <FilterPill key={q.id} active={quality.includes(q.id)} dot={q.dot} onClick={() => toggle(quality, setQuality, q.id)}>{q.label}</FilterPill>
          ))}
          <Divider />
          {CATS.map(c => (
            <FilterPill key={c} active={cats.includes(c)} onClick={() => toggle(cats, setCats, c)}>{c}</FilterPill>
          ))}
          <div style={{ flex: 1 }}></div>
          <button title="More filters" style={{
            width: 34, height: 34, borderRadius: "var(--radius-button)", border: "1px solid var(--border)",
            background: "var(--surface)", color: "var(--text-secondary)", cursor: "pointer",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
          }}><RXIcons.funnel size={15} /></button>
        </div>

        {/* List */}
        <Card pad="0" style={{ overflow: "hidden" }}>
          {loading ? (
            <>{[0, 1, 2, 3].map(i => <SkeletonRow key={i} />)}</>
          ) : jobs.length === 0 ? (
            <div style={{ padding: "60px 20px", textAlign: "center" }}>
              <div style={{ width: 46, height: 46, borderRadius: 12, background: "var(--surface-2)", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--text-tertiary)", marginBottom: 14 }}>
                <RXIcons.board size={22} />
              </div>
              <div style={{ fontFamily: "var(--font-accent)", fontSize: 19, marginBottom: 5 }}>No jobs match these filters</div>
              <div style={{ fontSize: 13.5, color: "var(--text-secondary)" }}>Clear a filter or switch tabs to see more.</div>
            </div>
          ) : (
            jobs.map(job => (
              <JobRow key={job.id} job={job} onOpen={onOpen} onGenerate={onGenerate} onAssign={onAssign} onRegenerate={onRegenerate} />
            ))
          )}
          {!loading && jobs.length > 0 && <div style={{ borderBottom: "none" }}></div>}
        </Card>
      </div>
    </div>
  );
}
