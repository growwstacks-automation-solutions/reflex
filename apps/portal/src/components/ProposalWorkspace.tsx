/* Reflex portal v3 — Two-column proposal workspace + Copy everywhere + regenerate confirm. */
import { useState, useEffect, useRef } from "react";
import type React from "react";
import { Button, RelevanceBadge, TaxonomyChip } from "@/components/ds";
import { QualityChip, Mono, Eyebrow, CopyButton } from "@/components/ui";
import { RXIcons } from "@/components/icons";
import { useAuth } from "@/lib/auth";
import { generateProposal, UnauthorizedError } from "@/lib/api";
import type { ApiScreeningAnswer, GenerateResult } from "@/lib/api";
import type { Job } from "@/lib/types";

/** A short, human label for a raw work-sample URL (filename, or the trimmed host/path). */
function linkLabel(url: string): string {
  try {
    const u = new URL(url);
    const last = u.pathname.split("/").filter(Boolean).pop();
    if (last) return decodeURIComponent(last);
    return u.hostname.replace(/^www\./, "");
  } catch {
    // Not a full URL — fall back to the last path segment of the raw string.
    const last = url.split("/").filter(Boolean).pop();
    return last || url;
  }
}

function assembleProposal({
  cover,
  screening,
  answers,
  pickedImages,
  insertedLooms,
}: {
  cover: string;
  screening: ApiScreeningAnswer[];
  answers: string[];
  pickedImages: string[];
  insertedLooms: string[];
}): string {
  const parts: string[] = [];
  parts.push("COVER LETTER\n" + "─".repeat(40) + "\n" + cover);
  if (screening.length > 0) {
    parts.push("SCREENING QUESTIONS\n" + "─".repeat(40));
    screening.forEach((s, i) => {
      parts.push(`Q: ${s.question}\nA: ${answers[i] ?? ""}`);
    });
  }
  if (pickedImages.length > 0) {
    parts.push("WORK SAMPLES\n" + "─".repeat(40) + "\n" + pickedImages.join("\n"));
  }
  if (insertedLooms.length > 0) {
    parts.push("LOOM WALKTHROUGHS\n" + "─".repeat(40) + "\n" + insertedLooms.join("\n"));
  }
  return parts.join("\n\n");
}

function downloadTxt(text: string, filename: string) {
  const blob = new Blob([text], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export type WorkspaceStatus = "idle" | "generating" | "done" | "error";

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
    <div style={{
      display: "flex", flexDirection: "column", minHeight: 0,
      background: "var(--bg-card)", border: "1px solid var(--border)",
      borderRadius: "var(--radius-card)", boxShadow: "var(--shadow-sm)",
      overflow: "hidden",
    }}>

      {/* ── Fixed header: label + badges + title + reason ── */}
      <div style={{ flexShrink: 0, padding: "16px 18px", borderBottom: "1px solid var(--border)" }}>
        {/* Top: label right-aligned, badges left */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <RelevanceBadge state={job.relevance} dense />
          <QualityChip quality={job.quality} dense />
          <span style={{ marginLeft: "auto", fontSize: 10.5, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--text-tertiary)" }}>The job</span>
        </div>

        {/* Title */}
        <h2 style={{ margin: "0 0 12px", fontSize: 15.5, fontWeight: 700, lineHeight: 1.35, letterSpacing: "-0.015em", color: "var(--text-primary)" }}>
          {job.title}
        </h2>

        {/* Why this job */}
        {job.reason && (
          <div style={{ display: "flex", gap: 8, padding: "9px 12px", background: "var(--accent-tint)", borderRadius: 8, borderLeft: "3px solid var(--accent)" }}>
            <RXIcons.spark size={13} style={{ color: "var(--accent)", flexShrink: 0, marginTop: 2 }} />
            <div style={{ fontSize: 12.5, color: "var(--text-primary)", lineHeight: 1.5 }}>{job.reason}</div>
          </div>
        )}
      </div>

      {/* ── Fixed meta strip: budget · connects · posted ── */}
      <div style={{
        flexShrink: 0, display: "flex", gap: 0,
        borderBottom: "1px solid var(--border)",
      }}>
        {[
          { label: "Budget",   value: job.budget   || "—" },
          { label: "Connects", value: String(job.connects || "—") },
          { label: "Posted",   value: job.postedAgo },
        ].map((m, i, arr) => (
          <div key={m.label} style={{
            flex: 1, padding: "10px 14px",
            borderRight: i < arr.length - 1 ? "1px solid var(--border)" : "none",
          }}>
            <div style={{ fontSize: 10.5, color: "var(--text-tertiary)", fontWeight: 500, marginBottom: 3, letterSpacing: "0.02em" }}>{m.label}</div>
            <Mono style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text-primary)" }}>{m.value}</Mono>
          </div>
        ))}
      </div>

      {/* ── Scrollable body: description + client snapshot ── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px", display: "flex", flexDirection: "column", gap: 18 }}>

        {/* Taxonomy chips */}
        {job.chips.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {job.chips.map((ch, i) => <TaxonomyChip key={i} level={ch.level} isNew={ch.isNew}>{ch.label}</TaxonomyChip>)}
          </div>
        )}

        {/* Job description */}
        <div>
          <Eyebrow style={{ marginBottom: 8 }}>Job description</Eyebrow>
          <p style={{
            margin: 0, fontSize: 13, lineHeight: 1.7,
            color: "var(--text-secondary)", whiteSpace: "pre-wrap", wordBreak: "break-word",
          }}>{job.desc || "No description available."}</p>
        </div>

        {/* Client snapshot */}
        <div>
          <Eyebrow style={{ marginBottom: 8 }}>Client snapshot</Eyebrow>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <MiniRow label="Spend"     value={<Mono>{c.spend    || "—"}</Mono>} />
            <MiniRow label="Hire rate" value={<Mono>{c.hireRate || "—"}</Mono>} />
            <MiniRow label="Location"  value={c.location || "—"} />
            <MiniRow
              label="Payment"
              value={
                c.payment === "Verified"
                  ? <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--relevant-text)", fontWeight: 600, fontSize: 12.5 }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg>
                      Verified
                    </span>
                  : c.payment || "—"
              }
            />
          </div>
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

function GeneratedBlock({ label, value, onChange, question }: { label?: string; value: string; onChange: (v: string) => void; question?: string }) {
  return (
    <div style={{ padding: "16px 18px", borderBottom: "1px solid var(--border)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: question ? 10 : 12 }}>
        {question
          ? <div style={{ fontSize: 13.5, fontWeight: 600, flex: 1, lineHeight: 1.4 }}>{question}</div>
          : <Eyebrow style={{ flex: 1 }}>{label}</Eyebrow>}
        <CopyButton getText={() => value} />
      </div>
      <EditableText value={value} onChange={onChange} minRows={question ? 2 : 6} />
    </div>
  );
}

function WorkSamples({
  images,
  looms,
  pickedImages,
  toggleImage,
  insertedLooms,
  toggleLoom,
}: {
  images: string[]; // image_links from the job row
  looms: string[]; // looms from the job row
  pickedImages: string[];
  toggleImage: (url: string) => void;
  insertedLooms: string[];
  toggleLoom: (url: string) => void;
}) {
  // Nothing attached to this job — don't show an empty Work Samples block.
  if (images.length === 0 && looms.length === 0) return null;
  return (
    <div style={{ padding: "16px 18px", borderBottom: "1px solid var(--border)" }}>
      <Eyebrow style={{ marginBottom: 10 }}>Work samples</Eyebrow>
      {images.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: looms.length > 0 ? 16 : 0 }}>
          {images.map((url, i) => {
            const on = pickedImages.includes(url);
            return (
              <button key={i} onClick={() => toggleImage(url)} title={url} style={{
                display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 10px 6px 7px",
                borderRadius: "var(--radius-button)", cursor: "pointer", maxWidth: "100%",
                border: on ? "1px solid var(--terracotta-100)" : "1px solid var(--border)",
                background: on ? "var(--accent-tint)" : "var(--surface)",
                color: on ? "var(--accent-on-tint)" : "var(--text-secondary)", fontSize: 12.5, fontWeight: 500,
              }}>
                <span style={{ width: 20, height: 20, borderRadius: 5, background: "var(--surface-2)", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--text-tertiary)", flex: "none" }}><RXIcons.image size={12} /></span>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 180 }}>{linkLabel(url)}</span>
                {on && <RXIcons.check size={14} />}
              </button>
            );
          })}
        </div>
      )}
      {looms.length > 0 && (
        <>
          <Eyebrow style={{ marginBottom: 10, marginTop: images.length > 0 ? 16 : 0 }}>Loom walkthrough</Eyebrow>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {looms.map((url, i) => {
              const inserted = insertedLooms.includes(url);
              return (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: 11, padding: "9px 11px",
                  border: inserted ? "1px solid var(--terracotta-100)" : "1px solid var(--border)",
                  borderRadius: "var(--radius-button)",
                  background: inserted ? "var(--accent-tint)" : "var(--surface)",
                }}>
                  <span style={{ width: 30, height: 30, borderRadius: 6, background: "var(--surface-2)", color: inserted ? "var(--accent)" : "var(--text-secondary)", display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none" }}><RXIcons.play size={13} /></span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{linkLabel(url)}</div>
                    <Mono style={{ color: "var(--text-tertiary)", fontSize: 11.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>{url}</Mono>
                  </div>
                  <button onClick={() => toggleLoom(url)} style={{
                    display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 10px", flex: "none",
                    borderRadius: "var(--radius-button)", cursor: "pointer", fontSize: 12.5, fontWeight: 500,
                    border: inserted ? "1px solid var(--terracotta-100)" : "1px solid var(--border)",
                    background: inserted ? "var(--accent)" : "var(--surface)",
                    color: inserted ? "#fff" : "var(--text-secondary)",
                  }}>
                    {inserted ? <RXIcons.check size={13} /> : <RXIcons.plus size={13} />}
                    {inserted ? "Inserted" : "Insert"}
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function formatInr(n: number): string {
  return `₹${n.toFixed(2)}`;
}

function ProposalCard({ job, status, setStatus, generation, error, onAskRegenerate }: {
  job: Job;
  status: WorkspaceStatus;
  setStatus: (s: WorkspaceStatus) => void;
  generation: GenerateResult | null;
  error: string | null;
  onAskRegenerate: () => void;
}) {
  // Editable draft, seeded from the last generation. Re-seeds whenever a new result lands.
  const [cover, setCover] = useState("");
  const [answers, setAnswers] = useState<string[]>([]);
  const [pickedImages, setPickedImages] = useState<string[]>([]);
  const [insertedLooms, setInsertedLooms] = useState<string[]>([]);

  const screening: ApiScreeningAnswer[] = generation?.screening_answers ?? [];
  const images: string[] = generation?.image_links ?? [];
  const looms: string[] = generation?.looms ?? [];

  // When a fresh generation arrives, load it into the editable fields.
  useEffect(() => {
    if (!generation) return;
    setCover(generation.cover_letter);
    setAnswers(generation.screening_answers.map((s) => s.answer));
    setPickedImages([]);
    setInsertedLooms([]);
  }, [generation]);

  const toggleImage = (url: string) => setPickedImages(p => p.includes(url) ? p.filter(x => x !== url) : [...p, url]);
  const toggleLoom = (url: string) => setInsertedLooms(p => p.includes(url) ? p.filter(x => x !== url) : [...p, url]);

  const getFullText = () => assembleProposal({ cover, screening, answers, pickedImages, insertedLooms });

  const handleDownloadTxt = () => {
    const safe = (job.title || "proposal").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    downloadTxt(getFullText(), `${safe}.txt`);
  };

  const handlePrint = () => {
    const html = getFullText()
      .split("\n")
      .map(line => `<p style="margin:0 0 4px;white-space:pre-wrap;">${line.replace(/&/g,"&amp;").replace(/</g,"&lt;")}</p>`)
      .join("");
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<!doctype html><html><head><title>${job.title || "Proposal"}</title><style>body{font:13px/1.6 system-ui,sans-serif;padding:32px;max-width:720px;margin:auto}p{margin:0 0 4px}</style></head><body>${html}</body></html>`);
    win.document.close();
    win.focus();
    win.print();
  };

  const header = (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 18px", borderBottom: "1px solid var(--border)" }}>
      <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.03em", textTransform: "uppercase", color: "var(--text-tertiary)" }}>Your proposal</span>
      <div style={{ flex: 1 }}></div>
      {status === "done" && generation && (
        <>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 500, color: "var(--relevant-text)" }}>
            <RXIcons.check size={15} /> Proposal generated
          </span>
          <CostTag>{formatInr(generation.cost_inr)}</CostTag>
          <button onClick={onAskRegenerate} title="Regenerate" style={{
            width: 30, height: 30, borderRadius: "var(--radius-button)", border: "1px solid var(--border)",
            background: "var(--surface)", color: "var(--text-secondary)", cursor: "pointer",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
          }}><RXIcons.refresh size={15} /></button>
        </>
      )}
    </div>
  );

  const exportBar = status === "done" && generation && (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 18px", borderBottom: "1px solid var(--border)", background: "var(--surface)" }}>
      <span style={{ fontSize: 11.5, color: "var(--text-tertiary)", fontWeight: 500, flex: 1 }}>Full proposal</span>
      <CopyButton getText={getFullText} label="Copy all" size="sm" />
      <button onClick={handleDownloadTxt} title="Download as .txt" style={{
        display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 10px",
        borderRadius: "var(--radius-button)", border: "1px solid var(--border)",
        background: "var(--surface)", color: "var(--text-secondary)", cursor: "pointer",
        fontSize: 12.5, fontWeight: 500,
      }}>
        <RXIcons.upload size={13} style={{ transform: "rotate(180deg)" }} /> .txt
      </button>
      <button onClick={handlePrint} title="Print / Save as PDF" style={{
        display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 10px",
        borderRadius: "var(--radius-button)", border: "1px solid var(--border)",
        background: "var(--surface)", color: "var(--text-secondary)", cursor: "pointer",
        fontSize: 12.5, fontWeight: 500,
      }}>
        <RXIcons.proposal size={13} /> PDF
      </button>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: 0, background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-card)", boxShadow: "var(--shadow-sm)" }}>
      {header}
      {exportBar}
      {(status === "idle" || (status === "done" && !generation)) && <GenerateEmpty onGenerate={() => setStatus("generating")} />}
      {status === "generating" && <GeneratingState />}
      {status === "error" && <GenerateError message={error} onRetry={() => setStatus("generating")} />}
      {status === "done" && generation && (
        <div style={{ flex: 1, overflowY: "auto" }}>
          <GeneratedBlock label="Cover letter" value={cover} onChange={setCover} />

          {screening.length > 0 && (
            <>
              <div style={{ padding: "14px 18px 4px" }}>
                <Eyebrow>Screening questions</Eyebrow>
                <div style={{ display: "flex", gap: 7, marginTop: 8, padding: "9px 11px", background: "var(--info-fill)", borderRadius: 8, color: "var(--info-text)" }}>
                  <RXIcons.link size={14} style={{ flex: "none", marginTop: 1 }} />
                  <span style={{ fontSize: 12, lineHeight: 1.45 }}>Cover letter and all screening answers share one thread, so the tone stays consistent.</span>
                </div>
              </div>
              {screening.map((s, i) => (
                <GeneratedBlock key={i} question={s.question} value={answers[i] ?? ""}
                  onChange={(v) => setAnswers(a => a.map((x, j) => j === i ? v : x))} />
              ))}
            </>
          )}

          <WorkSamples
            images={images}
            looms={looms}
            pickedImages={pickedImages}
            toggleImage={toggleImage}
            insertedLooms={insertedLooms}
            toggleLoom={toggleLoom}
          />
        </div>
      )}
    </div>
  );
}

function GenerateError({ message, onRetry }: { message: string | null; onRetry: () => void }) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "40px 24px" }}>
      <div style={{ width: 52, height: 52, borderRadius: 14, background: "var(--alert-fill, #FCEBEB)", color: "var(--alert-text, #A32D2D)", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
        <RXIcons.refresh size={24} />
      </div>
      <div style={{ fontFamily: "var(--font-accent)", fontSize: 19, marginBottom: 6 }}>Couldn't generate the proposal</div>
      <p style={{ margin: "0 0 22px", fontSize: 13, color: "var(--text-secondary)", maxWidth: 360, lineHeight: 1.55 }}>
        {message || "Something went wrong reaching the generator. Please try again."}
      </p>
      <Button variant="secondary" icon={<RXIcons.refresh size={15} />} onClick={onRetry}>Try again</Button>
    </div>
  );
}

export function ProposalWorkspace({ job, initialStatus, onBack, onMarkSubmitted, regenAtOpen }: { job: Job; initialStatus?: WorkspaceStatus; onBack: () => void; onMarkSubmitted?: (job: Job) => void; regenAtOpen?: boolean }) {
  const auth = useAuth();
  const [status, setStatus] = useState<WorkspaceStatus>(initialStatus || "idle");
  const [generation, setGeneration] = useState<GenerateResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [submitted, setSubmitted] = useState(job.actionState === "submitted");

  // Whenever status flips to "generating", call the real /generate API for this job.
  useEffect(() => {
    if (status !== "generating") return;
    let cancelled = false;
    setError(null);

    if (!auth.token) {
      setError("You're signed out — please sign in again.");
      setStatus("error");
      return;
    }

    generateProposal(auth.token, job.id)
      .then((result) => {
        if (cancelled) return;
        setGeneration(result);
        setStatus("done");
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof UnauthorizedError) {
          auth.signOut();
          return;
        }
        setError(err instanceof Error ? err.message : "Generation failed.");
        setStatus("error");
      });

    return () => { cancelled = true; };
  }, [status, auth, job.id]);

  useEffect(() => { if (regenAtOpen) setConfirm(true); }, [regenAtOpen]);

  const doRegenerate = () => { setConfirm(false); setStatus("generating"); };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div className="rx-workspace-topbar" style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 28px", borderBottom: "1px solid var(--border)" }}>
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

      <div className="rx-workspace-grid" style={{ flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "0.86fr 1.14fr", gap: 16, padding: "18px 28px 0", overflowY: "auto" }}>
        <div className="rx-job-context-card"><JobContextCard job={job} /></div>
        <ProposalCard job={job} status={status} setStatus={setStatus} generation={generation} error={error} onAskRegenerate={() => setConfirm(true)} />
      </div>

      <div className="rx-workspace-footer" style={{ display: "flex", alignItems: "center", gap: 16, padding: "14px 28px", borderTop: "1px solid var(--border)", marginTop: 16, background: "var(--surface)" }}>
        <span style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.45, maxWidth: 640 }}>
          Reflex doesn't submit for you — copy what you need, or use the extension to auto-fill, then submit on Upwork and mark it here.
        </span>
        <div style={{ flex: 1 }}></div>
        {submitted
          ? <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 600, color: "var(--relevant-text)" }}><RXIcons.check size={16} /> Marked as submitted</span>
          : <Button variant="secondary" icon={<RXIcons.check size={15} />} onClick={() => { setSubmitted(true); onMarkSubmitted && onMarkSubmitted(job); }} disabled={status !== "done" || !generation}>Mark as submitted</Button>}
      </div>

      <ConfirmDialog open={confirm}
        title="Regenerate the proposal?"
        body="This replaces the current draft — your edits to the cover letter and screening answers will be lost."
        confirmLabel="Regenerate" onConfirm={doRegenerate} onCancel={() => setConfirm(false)} />
    </div>
  );
}
