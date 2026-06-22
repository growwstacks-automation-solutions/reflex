/* Reflex portal v3 — Two-column proposal workspace + Copy everywhere + regenerate confirm. */
import { useState, useEffect, useRef } from "react";
import type React from "react";
import { Button, RelevanceBadge, TaxonomyChip } from "@/components/ds";
import { QualityChip, Mono, Eyebrow, CopyButton } from "@/components/ui";
import { RXIcons } from "@/components/icons";
import { RX_DATA } from "@/lib/mock-data";
import type { Job } from "@/lib/types";

export type WorkspaceStatus = "idle" | "generating" | "done";

function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel = "Cancel",
  tone = "primary",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onCancel]);
  if (!open) return null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div onClick={onCancel} style={{ position: "absolute", inset: 0, background: "rgba(20,18,15,0.4)", animation: "rx-fade 0.13s ease" }}></div>
      <div style={{
        position: "relative", width: 400, maxWidth: "90vw", padding: "22px",
        background: "var(--bg-card)", border: "1px solid var(--border)",
        borderRadius: "var(--radius-card)", boxShadow: "var(--shadow-lg)",
        animation: "rx-rise 0.16s ease",
      }}>
        <h3 style={{ margin: "0 0 8px", fontSize: 17, fontWeight: 600 }}>{title}</h3>
        <p style={{ margin: "0 0 20px", fontSize: 13.5, lineHeight: 1.55, color: "var(--text-secondary)" }}>{body}</p>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <Button variant="secondary" onClick={onCancel}>{cancelLabel}</Button>
          <Button variant="primary" onClick={onConfirm} icon={<RXIcons.refresh size={15} />}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  );
}

function EditableText({ value, onChange, minRows = 3 }: { value: string; onChange: (v: string) => void; minRows?: number }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const resize = () => { const el = ref.current; if (el) { el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; } };
  useEffect(() => { resize(); }, [value]);
  return (
    <textarea ref={ref} value={value} rows={minRows}
      onChange={e => { onChange(e.target.value); resize(); }}
      style={{
        width: "100%", resize: "none", border: "1px solid transparent", borderRadius: 8,
        padding: "10px 12px", margin: "-10px -12px", background: "transparent",
        color: "var(--text-primary)", fontSize: 13.5, lineHeight: 1.6, outline: "none",
        fontFamily: "var(--font-ui)", display: "block", boxSizing: "content-box", maxWidth: "100%",
        transition: "background 0.12s ease, border-color 0.12s ease",
      }}
      onFocus={e => { e.target.style.background = "var(--canvas)"; e.target.style.borderColor = "var(--border)"; }}
      onBlur={e => { e.target.style.background = "transparent"; e.target.style.borderColor = "transparent"; }}
    />
  );
}

function CostTag({ children }: { children: React.ReactNode }) {
  return <span style={{ fontSize: 11.5, fontFamily: "var(--font-mono)", color: "var(--text-tertiary)" }}>{children}</span>;
}

function MiniRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
      <span style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>{label}</span>
      <span style={{ fontSize: 12.5, fontWeight: 500, textAlign: "right" }}>{value}</span>
    </div>
  );
}

function JobContextCard({ job }: { job: Job }) {
  const c = job.client;
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: 0, background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-card)", boxShadow: "var(--shadow-sm)" }}>
      <div style={{ padding: "16px 18px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <RelevanceBadge state={job.relevance} />
          <QualityChip quality={job.quality} dense />
          <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 600, letterSpacing: "0.03em", textTransform: "uppercase", color: "var(--text-tertiary)" }}>The job</span>
        </div>
        <h2 style={{ margin: "0 0 12px", fontSize: 16.5, fontWeight: 600, lineHeight: 1.35, letterSpacing: "-0.01em" }}>{job.title}</h2>
        <div style={{ display: "flex", gap: 9, padding: "10px 12px", background: "var(--accent-tint)", borderRadius: 8 }}>
          <span style={{ color: "var(--accent)", flex: "none", marginTop: 1 }}><RXIcons.spark size={14} /></span>
          <div style={{ fontSize: 12.5, color: "var(--text-primary)", lineHeight: 1.45 }}>{job.reason}</div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
          {job.chips.map((ch, i) => <TaxonomyChip key={i} level={ch.level} isNew={ch.isNew}>{ch.label}</TaxonomyChip>)}
        </div>
        <Eyebrow style={{ marginBottom: 6 }}>Job description</Eyebrow>
        <p style={{ margin: "0 0 18px", fontSize: 13.5, lineHeight: 1.6, color: "var(--text-secondary)" }}>{job.desc}</p>
        <Eyebrow style={{ marginBottom: 6 }}>Client snapshot</Eyebrow>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 18px" }}>
          <MiniRow label="Spend" value={<Mono>{c.spend}</Mono>} />
          <MiniRow label="Hire rate" value={<Mono>{c.hireRate}</Mono>} />
          <MiniRow label="Location" value={c.location} />
          <MiniRow label="Payment" value={c.payment} />
        </div>
      </div>
    </div>
  );
}

function GenerateEmpty({ onGenerate }: { onGenerate: () => void }) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "40px 24px" }}>
      <div style={{ width: 52, height: 52, borderRadius: 14, background: "var(--accent-tint)", color: "var(--accent)", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
        <RXIcons.spark size={26} />
      </div>
      <div style={{ fontFamily: "var(--font-accent)", fontSize: 21, marginBottom: 6 }}>Ready to draft your proposal</div>
      <p style={{ margin: "0 0 22px", fontSize: 13.5, color: "var(--text-secondary)", maxWidth: 320, lineHeight: 1.55 }}>
        Reflex writes a cover letter and answers every screening question, all in one consistent thread.
      </p>
      <Button size="lg" spark onClick={onGenerate}>Generate proposal</Button>
    </div>
  );
}

function GeneratingState() {
  const bar = (w: number | string) => <span style={{ display: "block", height: 12, width: w, borderRadius: 4, marginBottom: 10, background: "linear-gradient(90deg, var(--surface-2) 25%, var(--border) 37%, var(--surface-2) 63%)", backgroundSize: "800px 100%", animation: "rx-shimmer 1.4s infinite linear" }}></span>;
  return (
    <div style={{ flex: 1, padding: "24px" }}>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 9, color: "var(--accent)", marginBottom: 22, fontSize: 13.5, fontWeight: 600 }}>
        <span style={{ display: "inline-flex", animation: "rx-spin 1.1s linear infinite" }}><RXIcons.spark size={16} /></span>
        Writing your proposal…
      </div>
      {bar("92%")}{bar("100%")}{bar("84%")}{bar("96%")}{bar("60%")}
      <div style={{ height: 14 }}></div>
      {bar("40%")}{bar("88%")}{bar("72%")}
    </div>
  );
}

function GeneratedBlock({ label, cost, value, onChange, question }: { label?: string; cost: string; value: string; onChange: (v: string) => void; question?: string }) {
  return (
    <div style={{ padding: "16px 18px", borderBottom: "1px solid var(--border)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: question ? 10 : 12 }}>
        {question
          ? <div style={{ fontSize: 13.5, fontWeight: 600, flex: 1, lineHeight: 1.4 }}>{question}</div>
          : <Eyebrow style={{ flex: 1 }}>{label}</Eyebrow>}
        <CostTag>{cost}</CostTag>
        <CopyButton getText={() => value} />
      </div>
      <EditableText value={value} onChange={onChange} minRows={question ? 2 : 6} />
    </div>
  );
}

function WorkSamples() {
  const { images, looms } = RX_DATA.assets;
  const [picked, setPicked] = useState<string[]>(["a1", "a2"]);
  const toggle = (id: string) => setPicked(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  return (
    <div style={{ padding: "16px 18px", borderBottom: "1px solid var(--border)" }}>
      <Eyebrow style={{ marginBottom: 10 }}>Work samples</Eyebrow>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
        {images.slice(0, 4).map(a => {
          const on = picked.includes(a.id);
          return (
            <button key={a.id} onClick={() => toggle(a.id)} style={{
              display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 10px 6px 7px",
              borderRadius: "var(--radius-button)", cursor: "pointer",
              border: on ? "1px solid var(--terracotta-100)" : "1px solid var(--border)",
              background: on ? "var(--accent-tint)" : "var(--surface)",
              color: on ? "var(--accent-on-tint)" : "var(--text-secondary)", fontSize: 12.5, fontWeight: 500,
            }}>
              <span style={{ width: 20, height: 20, borderRadius: 5, background: a.tag, display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--text-tertiary)" }}><RXIcons.image size={12} /></span>
              {a.label}
              {on && <RXIcons.check size={14} />}
            </button>
          );
        })}
      </div>
      <Eyebrow style={{ marginBottom: 10 }}>Loom walkthrough</Eyebrow>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {looms.map(l => (
          <div key={l.id} style={{ display: "flex", alignItems: "center", gap: 11, padding: "9px 11px", border: "1px solid var(--border)", borderRadius: "var(--radius-button)", background: "var(--surface)" }}>
            <span style={{ width: 30, height: 30, borderRadius: 6, background: "var(--surface-2)", color: "var(--text-secondary)", display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none" }}><RXIcons.play size={13} /></span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.title}</div>
              <Mono style={{ color: "var(--text-tertiary)", fontSize: 11.5 }}>{l.url} · {l.len}</Mono>
            </div>
            <Button size="sm" variant="ghost" icon={<RXIcons.plus size={14} />}>Insert</Button>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProposalCard({ job, status, setStatus, onAskRegenerate }: { job: Job; status: WorkspaceStatus; setStatus: (s: WorkspaceStatus) => void; onAskRegenerate: () => void }) {
  const seed = RX_DATA.proposal;
  const [cover, setCover] = useState(seed.cover);
  const [answers, setAnswers] = useState(seed.screening.map((s) => s.a));

  const header = (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 18px", borderBottom: "1px solid var(--border)" }}>
      <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.03em", textTransform: "uppercase", color: "var(--text-tertiary)" }}>Your proposal</span>
      <div style={{ flex: 1 }}></div>
      {status === "done" && (
        <>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 500, color: "var(--relevant-text)" }}>
            <RXIcons.check size={15} /> Proposal generated
          </span>
          <button onClick={onAskRegenerate} title="Regenerate" style={{
            width: 30, height: 30, borderRadius: "var(--radius-button)", border: "1px solid var(--border)",
            background: "var(--surface)", color: "var(--text-secondary)", cursor: "pointer",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
          }}><RXIcons.refresh size={15} /></button>
        </>
      )}
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: 0, background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-card)", boxShadow: "var(--shadow-sm)" }}>
      {header}
      {status === "idle" && <GenerateEmpty onGenerate={() => setStatus("generating")} />}
      {status === "generating" && <GeneratingState />}
      {status === "done" && (
        <div style={{ flex: 1, overflowY: "auto" }}>
          <GeneratedBlock label="Cover letter" cost={seed.coverCost} value={cover} onChange={setCover} />

          <div style={{ padding: "14px 18px 4px" }}>
            <Eyebrow>Screening questions</Eyebrow>
            <div style={{ display: "flex", gap: 7, marginTop: 8, padding: "9px 11px", background: "var(--info-fill)", borderRadius: 8, color: "var(--info-text)" }}>
              <RXIcons.link size={14} style={{ flex: "none", marginTop: 1 }} />
              <span style={{ fontSize: 12, lineHeight: 1.45 }}>Cover letter and all screening answers share one thread, so the tone stays consistent.</span>
            </div>
          </div>
          {seed.screening.map((s, i) => (
            <GeneratedBlock key={i} question={s.q} cost={s.cost} value={answers[i]}
              onChange={(v) => setAnswers(a => a.map((x, j) => j === i ? v : x))} />
          ))}

          <WorkSamples />
        </div>
      )}
    </div>
  );
}

export function ProposalWorkspace({ job, initialStatus, onBack, onMarkSubmitted, regenAtOpen }: { job: Job; initialStatus?: WorkspaceStatus; onBack: () => void; onMarkSubmitted?: (job: Job) => void; regenAtOpen?: boolean }) {
  const [status, setStatus] = useState<WorkspaceStatus>(initialStatus || "idle");
  const [confirm, setConfirm] = useState(false);
  const [submitted, setSubmitted] = useState(job.actionState === "submitted");

  useEffect(() => {
    if (status === "generating") {
      const t = setTimeout(() => setStatus("done"), 1500);
      return () => clearTimeout(t);
    }
  }, [status]);

  useEffect(() => { if (regenAtOpen) setConfirm(true); }, [regenAtOpen]);

  const doRegenerate = () => { setConfirm(false); setStatus("generating"); };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 28px", borderBottom: "1px solid var(--border)" }}>
        <button onClick={onBack} style={{
          display: "inline-flex", alignItems: "center", gap: 7, padding: "7px 12px 7px 9px",
          borderRadius: "var(--radius-button)", border: "1px solid var(--border)", cursor: "pointer",
          background: "var(--surface)", color: "var(--text-secondary)", fontSize: 13, fontWeight: 500,
        }}><RXIcons.arrowLeft size={16} /> Board</button>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 11, color: "var(--text-tertiary)", letterSpacing: "0.03em", textTransform: "uppercase" }}>Proposal workspace</div>
          <div style={{ fontSize: 14.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 620 }}>{job.title}</div>
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "0.86fr 1.14fr", gap: 16, padding: "18px 28px 0" }}>
        <JobContextCard job={job} />
        <ProposalCard job={job} status={status} setStatus={setStatus} onAskRegenerate={() => setConfirm(true)} />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "14px 28px", borderTop: "1px solid var(--border)", marginTop: 16, background: "var(--surface)" }}>
        <span style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.45, maxWidth: 640 }}>
          Reflex doesn't submit for you — copy what you need, or use the extension to auto-fill, then submit on Upwork and mark it here.
        </span>
        <div style={{ flex: 1 }}></div>
        {submitted
          ? <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 600, color: "var(--relevant-text)" }}><RXIcons.check size={16} /> Marked as submitted</span>
          : <Button variant="secondary" icon={<RXIcons.check size={15} />} onClick={() => { setSubmitted(true); onMarkSubmitted && onMarkSubmitted(job); }} disabled={status !== "done"}>Mark as submitted</Button>}
      </div>

      <ConfirmDialog open={confirm}
        title="Regenerate the proposal?"
        body="This replaces the current draft — your edits to the cover letter and screening answers will be lost."
        confirmLabel="Regenerate" onConfirm={doRegenerate} onCancel={() => setConfirm(false)} />
    </div>
  );
}
