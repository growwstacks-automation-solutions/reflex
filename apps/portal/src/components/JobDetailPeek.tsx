/* Reflex portal v3 — Job detail PEEK: compact, dismissible right panel for reading & deciding. */

import type React from "react";
import { useEffect } from "react";
import { RXIcons } from "@/components/icons";
import { Button, TaxonomyChip, RelevanceBadge } from "@/components/ds";
import { QualityChip, Mono, Eyebrow } from "@/components/ui";
import type { Job } from "@/lib/types";

function MetaCell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 500 }}>{children}</div>
    </div>
  );
}

function MiniRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
      <span style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>{label}</span>
      <span style={{ fontSize: 12.5, fontWeight: 500, textAlign: "right" }}>{value}</span>
    </div>
  );
}

export function JobDetailPeek({ job, onClose, onGenerate, onAssign }: { job: Job | null; onClose: () => void; onGenerate: (job: Job) => void; onAssign: (job: Job) => void }): JSX.Element | null {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!job) return null;
  const cl = job.classification;
  const c = job.client;
  const upworkUrl = job.url;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 80 }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(20,18,15,0.32)", animation: "rx-fade 0.15s ease" }}></div>
      <div style={{
        position: "absolute", top: 0, right: 0, height: "100%", width: 460, maxWidth: "92vw",
        background: "var(--bg-card)", borderLeft: "1px solid var(--border)",
        boxShadow: "var(--shadow-panel)", display: "flex", flexDirection: "column",
        animation: "rx-slide-in 0.22s cubic-bezier(0.32,0.72,0,1)",
      }}>
        {/* Top bar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderBottom: "1px solid var(--border)" }}>
          <span style={{ fontSize: 12.5, fontWeight: 600, letterSpacing: "0.03em", textTransform: "uppercase", color: "var(--text-tertiary)" }}>Job detail</span>
          <button onClick={onClose} aria-label="Close" style={{
            width: 30, height: 30, borderRadius: "var(--radius-button)", border: "1px solid var(--border)",
            background: "var(--surface)", color: "var(--text-secondary)", cursor: "pointer",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
          }}><RXIcons.x size={16} /></button>
        </div>

        {/* Scroll body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "18px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <RelevanceBadge state={job.relevance} />
            <QualityChip quality={job.quality} />
          </div>
          <h2 style={{ margin: "0 0 12px", fontSize: 18, fontWeight: 600, lineHeight: 1.3, letterSpacing: "-0.01em" }}>{job.title}</h2>

          {/* Reason for selection — highlighted */}
          <div style={{ display: "flex", gap: 9, padding: "11px 13px", background: "var(--accent-tint)", borderRadius: "var(--radius-card)", marginBottom: 14 }}>
            <span style={{ color: "var(--accent)", flex: "none", marginTop: 1 }}><RXIcons.spark size={15} /></span>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--accent-on-tint)", marginBottom: 3 }}>Why this job</div>
              <div style={{ fontSize: 13, color: "var(--text-primary)", lineHeight: 1.45 }}>{job.reason}</div>
            </div>
          </div>

          {/* Chips */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
            {job.chips.map((ch, i) => <TaxonomyChip key={i} level={ch.level} isNew={ch.isNew}>{ch.label}</TaxonomyChip>)}
          </div>

          {/* Meta strip */}
          <div style={{ display: "flex", gap: 12, padding: "12px 14px", background: "var(--bg-raised)", borderRadius: "var(--radius-card)", marginBottom: 16 }}>
            <MetaCell label="Budget"><Mono>{job.budget}</Mono></MetaCell>
            <MetaCell label="Connects"><Mono>{job.connects}</Mono></MetaCell>
            <MetaCell label="Posted"><Mono>{job.postedAgo}</Mono></MetaCell>
          </div>

          {/* Description */}
          <Eyebrow style={{ marginBottom: 6 }}>Job description</Eyebrow>
          <p style={{ margin: "0 0 18px", fontSize: 13.5, lineHeight: 1.6, color: "var(--text-secondary)" }}>{job.desc}</p>

          {/* Classification + Client snapshot side by side */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <Eyebrow style={{ marginBottom: 6 }}>Classification</Eyebrow>
              <MiniRow label="Tool" value={cl.tool} />
              <MiniRow label="Use case" value={cl.usecase} />
              <MiniRow label="Department" value={cl.dept} />
              <MiniRow label="Industry" value={cl.industry} />
            </div>
            <div>
              <Eyebrow style={{ marginBottom: 6 }}>Client snapshot</Eyebrow>
              <MiniRow label="Spend" value={<Mono>{c.spend}</Mono>} />
              <MiniRow label="Hire rate" value={<Mono>{c.hireRate}</Mono>} />
              <MiniRow label="Location" value={c.location} />
              <MiniRow label="Payment" value={c.payment} />
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 18px", borderTop: "1px solid var(--border)" }}>
          <Button
            variant="ghost"
            size="md"
            icon={<RXIcons.external size={15} />}
            disabled={!upworkUrl}
            onClick={() => { if (upworkUrl) window.open(upworkUrl, "_blank", "noopener,noreferrer"); }}
          >
            Open on Upwork
          </Button>
          <div style={{ flex: 1 }}></div>
          {job.ownership === "available"
            ? <Button variant="secondary" onClick={() => onAssign(job)}>Assign to me</Button>
            : null}
          {job.relevance !== "irrelevant"
            ? <Button spark onClick={() => onGenerate(job)}>Generate proposal</Button>
            : <span style={{ fontSize: 12.5, color: "var(--text-tertiary)" }}>Auto-filtered — not pursued</span>}
        </div>
      </div>
    </div>
  );
}
