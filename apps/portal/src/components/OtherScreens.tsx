/* Reflex portal v3 — Conversations, Reporting, Assets/Team. Compact, on-system. */

import { useState, useEffect } from "react";
import type React from "react";
import { Button } from "@/components/ds";
import { Card, Avatar, Mono, Eyebrow } from "@/components/ui";
import { RXIcons } from "@/components/icons";
import { PageHeader } from "@/components/Shell";
import { RX_DATA } from "@/lib/mock-data";
import type { Conversation, Message } from "@/lib/types";

const CONVO_STATUS: Record<Conversation["status"], { label: string; fill: string; text: string }> = {
  "needs-reply": { label: "Needs reply", fill: "var(--review-fill)", text: "var(--review-text)" },
  "waiting": { label: "Waiting", fill: "var(--surface-2)", text: "var(--text-secondary)" },
  "quoted": { label: "Quoted", fill: "var(--info-fill)", text: "var(--info-text)" },
};

export function Conversations({
  headerRight,
  selectedId,
}: {
  headerRight?: React.ReactNode;
  selectedId?: string | null;
}): JSX.Element {
  const convos = RX_DATA.conversations;
  const [sel, setSel] = useState(selectedId || convos[0].id);
  useEffect(() => {
    if (selectedId) setSel(selectedId);
  }, [selectedId]);
  const convo = convos.find((c) => c.id === sel) || convos[0];

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <PageHeader title="Conversations" subtitle="Every client thread, with what matters surfaced." right={headerRight} />
      <div style={{ flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "320px 1fr" }}>
        <div style={{ borderRight: "1px solid var(--border)", overflowY: "auto", background: "var(--surface)" }}>
          {convos.map((c) => {
            const st = CONVO_STATUS[c.status];
            const active = c.id === sel;
            return (
              <button
                key={c.id}
                onClick={() => setSel(c.id)}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  cursor: "pointer",
                  padding: "14px 16px",
                  border: "none",
                  borderBottom: "1px solid var(--border)",
                  borderLeft: active ? "2px solid var(--accent)" : "2px solid transparent",
                  background: active ? "var(--accent-tint)" : "transparent",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 6 }}>
                  <Avatar person={c.client} size={26} />
                  <span style={{ fontSize: 13.5, fontWeight: 600, flex: 1 }}>{c.client.name}</span>
                  <span style={{ fontSize: 11, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)" }}>{c.time}</span>
                </div>
                <div style={{ fontSize: 12.5, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 8 }}>{c.snippet}</div>
                <span style={{ display: "inline-block", fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 999, background: st.fill, color: st.text }}>{st.label}</span>
              </button>
            );
          })}
        </div>

        <div style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
          <div style={{ padding: "14px 22px", borderBottom: "1px solid var(--border)" }}>
            <div style={{ fontSize: 15, fontWeight: 600 }}>{convo.client.name}</div>
            <div style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>{convo.job}</div>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "20px 22px" }}>
            <div style={{ display: "flex", gap: 10, padding: "13px 15px", background: "var(--accent-tint)", borderRadius: "var(--radius-card)", marginBottom: 22 }}>
              <span style={{ color: "var(--accent)", flex: "none", marginTop: 1 }}><RXIcons.spark size={15} /></span>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--accent-on-tint)", marginBottom: 4 }}>Where this stands</div>
                <div style={{ fontSize: 13, lineHeight: 1.5, color: "var(--text-primary)" }}>{convo.summary}</div>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {convo.messages.map((m: Message, i) => (
                <div key={i} style={{ display: "flex", justifyContent: m.from === "us" ? "flex-end" : "flex-start" }}>
                  <div style={{ maxWidth: "74%" }}>
                    <div
                      style={{
                        padding: "10px 13px",
                        borderRadius: 12,
                        fontSize: 13.5,
                        lineHeight: 1.5,
                        background: m.from === "us" ? "var(--accent)" : "var(--surface)",
                        color: m.from === "us" ? "#fff" : "var(--text-primary)",
                        border: m.from === "us" ? "none" : "1px solid var(--border)",
                      }}
                    >{m.text}</div>
                    <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 4, fontFamily: "var(--font-mono)", textAlign: m.from === "us" ? "right" : "left" }}>{m.time}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ padding: "14px 22px", borderTop: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10 }}>
            <Button variant="secondary" spark>Suggested reply</Button>
            <input
              placeholder="Write a reply…"
              style={{
                flex: 1,
                padding: "10px 13px",
                borderRadius: "var(--radius-input)",
                border: "1px solid var(--border)",
                background: "var(--canvas)",
                color: "var(--text-primary)",
                fontSize: 13.5,
                outline: "none",
              }}
            />
            <Button icon={<RXIcons.send size={15} />}>Send</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Bars({ data }: { data: number[] }): JSX.Element {
  const max = Math.max(...data);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 120 }}>
      {data.map((v, i) => (
        <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", height: "100%" }}>
          <div style={{ height: `${(v / max) * 100}%`, background: i === data.length - 1 ? "var(--accent)" : "var(--terracotta-100)", borderRadius: "4px 4px 0 0", minHeight: 4 }}></div>
        </div>
      ))}
    </div>
  );
}

const TAX_COLOR: Record<"tool" | "usecase" | "dept" | "industry", string> = {
  tool: "var(--tax-tool-text)",
  usecase: "var(--tax-usecase-text)",
  dept: "var(--tax-dept-text)",
  industry: "var(--tax-industry-text)",
};

export function Reporting({ headerRight }: { headerRight?: React.ReactNode }): JSX.Element {
  const r = RX_DATA.reporting;
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <PageHeader title="Reporting" subtitle="Team output over the last 14 days." right={headerRight} />
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 28px 40px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 18 }}>
          {r.kpis.map((k, i) => (
            <Card key={i} style={{ background: "var(--bg-raised)", boxShadow: "none" }} pad="14px 16px">
              <div style={{ fontSize: 12.5, color: "var(--text-secondary)", marginBottom: 6 }}>{k.label}</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <span style={{ fontSize: 26, fontWeight: 600, fontFamily: "var(--font-mono)", letterSpacing: "-0.02em" }}>{k.value}</span>
                <span style={{ fontSize: 12.5, fontWeight: 600, fontFamily: "var(--font-mono)", color: k.delta[0] === "+" ? "var(--relevant-text)" : "var(--text-tertiary)" }}>{k.delta}</span>
              </div>
              <div style={{ fontSize: 11.5, color: "var(--text-tertiary)", marginTop: 2 }}>{k.sub}</div>
            </Card>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 16, marginBottom: 16 }}>
          <Card pad="18px">
            <Eyebrow style={{ marginBottom: 16 }}>Jobs received per day</Eyebrow>
            <Bars data={r.received} />
          </Card>
          <Card pad="18px">
            <Eyebrow style={{ marginBottom: 16 }}>Proposals by rep</Eyebrow>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {r.perRep.map((p, i) => {
                const max = Math.max(...r.perRep.map((x) => x.proposals));
                return (
                  <div key={i}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 5 }}>
                      <span style={{ fontWeight: 500 }}>{p.name}</span>
                      <Mono style={{ color: "var(--text-secondary)" }}>{p.proposals} · {p.connects} connects</Mono>
                    </div>
                    <div style={{ height: 8, borderRadius: 999, background: "var(--surface-2)" }}>
                      <div style={{ width: `${(p.proposals / max) * 100}%`, height: "100%", borderRadius: 999, background: "var(--accent)" }}></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        <Card pad="18px" style={{ marginBottom: 16 }}>
          <Eyebrow style={{ marginBottom: 14 }}>What's coming in</Eyebrow>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 22 }}>
            {r.taxonomy.map((col, i) => {
              const max = Math.max(...col.items.map((it) => it[1]));
              return (
                <div key={i}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 10, color: TAX_COLOR[col.level] }}>{col.label}</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {col.items.map((it, j) => (
                      <div key={j}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
                          <span style={{ color: "var(--text-secondary)" }}>{it[0]}</span>
                          <Mono style={{ color: "var(--text-tertiary)" }}>{it[1]}</Mono>
                        </div>
                        <div style={{ height: 5, borderRadius: 999, background: "var(--surface-2)" }}>
                          <div style={{ width: `${(it[1] / max) * 100}%`, height: "100%", borderRadius: 999, background: TAX_COLOR[col.level], opacity: 0.65 }}></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card pad="0" style={{ overflow: "hidden" }}>
          <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)" }}><Eyebrow>Per rep</Eyebrow></div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ color: "var(--text-tertiary)", fontSize: 12 }}>
                {["Rep", "Jobs", "Proposals", "Connects", "Reply rate"].map((h, i) => (
                  <th key={i} style={{ textAlign: i === 0 ? "left" : "right", padding: "10px 18px", fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {r.table.map((row, i) => (
                <tr key={i} style={{ borderTop: "1px solid var(--border)" }}>
                  <td style={{ padding: "11px 18px", fontWeight: 500 }}>{row.name}</td>
                  <td style={{ padding: "11px 18px", textAlign: "right", fontFamily: "var(--font-mono)" }}>{row.jobs}</td>
                  <td style={{ padding: "11px 18px", textAlign: "right", fontFamily: "var(--font-mono)" }}>{row.proposals}</td>
                  <td style={{ padding: "11px 18px", textAlign: "right", fontFamily: "var(--font-mono)" }}>{row.connects}</td>
                  <td style={{ padding: "11px 18px", textAlign: "right", fontFamily: "var(--font-mono)" }}>{row.reply}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}

export function Assets({ headerRight }: { headerRight?: React.ReactNode }): JSX.Element {
  const { images, looms } = RX_DATA.assets;
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <PageHeader title="Assets" subtitle="Reusable proof to drop into proposals." right={headerRight} />
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 28px 40px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <Eyebrow>Screenshots & samples</Eyebrow>
          <Button size="sm" variant="secondary" icon={<RXIcons.upload size={15} />}>Upload</Button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 28 }}>
          {images.map((a) => (
            <Card key={a.id} pad="0" style={{ overflow: "hidden" }}>
              <div style={{ height: 120, background: `repeating-linear-gradient(45deg, ${a.tag}, ${a.tag} 12px, var(--surface) 12px, var(--surface) 24px)`, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-tertiary)" }}>
                <RXIcons.image size={24} />
              </div>
              <div style={{ padding: "11px 13px", fontSize: 13, fontWeight: 500 }}>{a.label}</div>
            </Card>
          ))}
        </div>
        <Eyebrow style={{ marginBottom: 14 }}>Loom library</Eyebrow>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 14 }}>
          {looms.map((l) => (
            <Card key={l.id} style={{ display: "flex", alignItems: "center", gap: 13 }}>
              <span style={{ width: 44, height: 44, borderRadius: 8, background: "var(--surface-2)", color: "var(--text-secondary)", display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none" }}><RXIcons.play size={16} /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 500 }}>{l.title}</div>
                <Mono style={{ color: "var(--text-tertiary)" }}>{l.url} · {l.len}</Mono>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
