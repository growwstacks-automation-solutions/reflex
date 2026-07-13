/* Reflex portal v4 — Job detail peek: half-screen panel, two-column layout. */

import type React from "react";
import { useEffect } from "react";
import { RXIcons } from "@/components/icons";
import { Button, TaxonomyChip, RelevanceBadge } from "@/components/ds";
import { QualityChip, Mono, Eyebrow } from "@/components/ui";
import type { Job } from "@/lib/types";

/* ── Small building blocks ── */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
      color: "var(--text-tertiary)", marginBottom: 10,
    }}>{children}</div>
  );
}

function DataRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "baseline",
      gap: 8, padding: "7px 0", borderBottom: "1px solid var(--border)",
    }}>
      <span style={{ fontSize: 12.5, color: "var(--text-secondary)", whiteSpace: "nowrap" }}>{label}</span>
      <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-primary)", textAlign: "right" }}>{value}</span>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{
      flex: 1, minWidth: 0,
      background: "var(--surface-2)", borderRadius: 8,
      padding: "10px 12px",
    }}>
      <div style={{ fontSize: 10.5, color: "var(--text-tertiary)", fontWeight: 500, marginBottom: 4, letterSpacing: "0.02em" }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--text-primary)", letterSpacing: "-0.02em" }}>{value}</div>
    </div>
  );
}

/* ── Main component ── */

export function JobDetailPeek({
  job, onClose, onGenerate, onAssign,
}: {
  job: Job | null;
  onClose: () => void;
  onGenerate: (job: Job) => void;
  onAssign: (job: Job) => void;
}): JSX.Element | null {

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!job) return null;

  const cl = job.classification;
  const c  = job.client;

  const panelStyle: React.CSSProperties = {
    position: "absolute", top: 0, right: 0,
    height: "100%",
    width: "min(820px, 58vw)",   /* ~half the screen, capped at 820px */
    background: "var(--surface)",
    borderLeft: "1px solid var(--border)",
    boxShadow: "var(--shadow-panel)",
    display: "flex", flexDirection: "column",
    animation: "rx-slide-in 0.22s cubic-bezier(0.32,0.72,0,1)",
  };

  const colBase: React.CSSProperties = {
    flex: 1, minWidth: 0,
    overflowY: "auto",
    padding: "20px 22px",
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 80 }}>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: "absolute", inset: 0, background: "rgba(10,12,24,0.35)", animation: "rx-fade 0.15s ease" }}
      />

      {/* Panel */}
      <div className="rx-peek-panel" style={panelStyle}>

        {/* ── Top bar ── */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "13px 18px", borderBottom: "1px solid var(--border)",
          background: "var(--surface)", flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <RelevanceBadge state={job.relevance} dense />
            <QualityChip quality={job.quality} dense />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--text-tertiary)" }}>Job detail</span>
            <button
              onClick={onClose}
              aria-label="Close"
              style={{
                width: 28, height: 28, borderRadius: "var(--radius-button)",
                border: "1px solid var(--border)", background: "var(--surface-2)",
                color: "var(--text-secondary)", cursor: "pointer",
                display: "inline-flex", alignItems: "center", justifyContent: "center",
              }}
            >
              <RXIcons.x size={14} />
            </button>
          </div>
        </div>

        {/* ── Two-column body ── */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

          {/* ════ LEFT: Job details + description ════ */}
          <div style={{ ...colBase, borderRight: "1px solid var(--border)" }}>

            {/* Title */}
            <h2 style={{
              margin: "0 0 14px", fontSize: 17, fontWeight: 700,
              lineHeight: 1.35, letterSpacing: "-0.015em", color: "var(--text-primary)",
            }}>{job.title}</h2>

            {/* Why this job */}
            {job.reason && (
              <div style={{
                display: "flex", gap: 9, padding: "10px 13px",
                background: "var(--accent-tint)", borderRadius: "var(--radius-card)",
                marginBottom: 16, borderLeft: "3px solid var(--accent)",
              }}>
                <RXIcons.spark size={14} style={{ color: "var(--accent)", flexShrink: 0, marginTop: 2 }} />
                <div>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--accent-on-tint)", marginBottom: 3, letterSpacing: "0.04em", textTransform: "uppercase" }}>Why this job</div>
                  <div style={{ fontSize: 13, color: "var(--text-primary)", lineHeight: 1.5 }}>{job.reason}</div>
                </div>
              </div>
            )}

            {/* Taxonomy chips */}
            {job.chips.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 16 }}>
                {job.chips.map((ch, i) => <TaxonomyChip key={i} level={ch.level} isNew={ch.isNew}>{ch.label}</TaxonomyChip>)}
              </div>
            )}

            {/* Stat cards: budget · connects · posted */}
            <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
              <StatCard label="Budget"   value={<Mono>{job.budget   || "—"}</Mono>} />
              <StatCard label="Connects" value={<Mono>{job.connects || "—"}</Mono>} />
              <StatCard label="Posted"   value={<Mono>{job.postedAgo}</Mono>} />
            </div>

            {/* Full description */}
            <SectionLabel>Job description</SectionLabel>
            <div style={{
              fontSize: 13.5, lineHeight: 1.7, color: "var(--text-secondary)",
              whiteSpace: "pre-wrap", wordBreak: "break-word",
            }}>{job.desc || "No description available."}</div>
          </div>

          {/* ════ RIGHT: Classification + Client snapshot ════ */}
          <div style={{ ...colBase, maxWidth: 260, flexShrink: 0 }}>

            {/* Client snapshot */}
            <SectionLabel>Client snapshot</SectionLabel>
            <div style={{ marginBottom: 22 }}>
              <DataRow label="Spend"    value={<Mono>{c.spend    || "—"}</Mono>} />
              <DataRow label="Hire rate" value={<Mono>{c.hireRate || "—"}</Mono>} />
              <DataRow label="Location" value={c.location || "—"} />
              <DataRow
                label="Payment"
                value={
                  c.payment === "Verified"
                    ? <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--relevant-text)", fontWeight: 600 }}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg>
                        Verified
                      </span>
                    : <span style={{ color: "var(--text-tertiary)" }}>{c.payment || "—"}</span>
                }
              />
            </div>

            {/* Classification */}
            <SectionLabel>Classification</SectionLabel>
            <div style={{ marginBottom: 22 }}>
              <DataRow label="Tool"       value={cl.tool       || "—"} />
              <DataRow label="Use case"   value={cl.usecase    || "—"} />
              <DataRow label="Department" value={cl.dept       || "—"} />
              <DataRow label="Industry"   value={cl.industry   || "—"} />
            </div>

            {/* Ownership */}
            <SectionLabel>Assignment</SectionLabel>
            <div style={{ marginBottom: 22 }}>
              <DataRow
                label="Status"
                value={
                  job.ownership === "mine"
                    ? <span style={{ color: "var(--accent)", fontWeight: 600 }}>Assigned to you</span>
                    : job.ownership === "available"
                    ? <span style={{ color: "#3FA67E", fontWeight: 600 }}>Available</span>
                    : <span style={{ color: "var(--text-secondary)" }}>Assigned</span>
                }
              />
              <DataRow
                label="Proposal"
                value={
                  job.actionState === "submitted"
                    ? <span style={{ color: "var(--relevant-text)", fontWeight: 600 }}>Submitted</span>
                    : job.actionState === "conversation"
                    ? <span style={{ color: "var(--info-text)", fontWeight: 600 }}>In contact</span>
                    : <span style={{ color: "var(--text-tertiary)" }}>Not submitted</span>
                }
              />
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        {/* "Generate proposal" is hidden for now; "Open on Upwork" takes the primary (filled) style. */}
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "12px 18px", borderTop: "1px solid var(--border)",
          background: "var(--surface)", flexShrink: 0,
        }}>
          <div style={{ flex: 1 }} />
          {job.ownership === "available" && (
            <Button variant="secondary" onClick={() => onAssign(job)}>Assign to me</Button>
          )}
          <Button
            spark
            size="md"
            icon={<RXIcons.external size={14} />}
            disabled={!job.url}
            onClick={() => { if (job.url) window.open(job.url, "_blank", "noopener,noreferrer"); }}
          >
            Open on Upwork
          </Button>
        </div>
      </div>
    </div>
  );
}
