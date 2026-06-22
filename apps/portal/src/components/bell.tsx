/* Reflex portal v3 — Bell + Important actions dropdown popup (replaces the right rail). */
import { useState, useEffect, useRef } from "react";
import { RXIcons, type RXIconProps } from "@/components/icons";
import { RX_DATA } from "@/lib/mock-data";
import type { ActionLink, ImportantAction } from "@/lib/types";

const TONE: Record<
  ImportantAction["tone"],
  { color: string; fill: string; icon: (p: RXIconProps) => JSX.Element }
> = {
  wait: { color: "var(--review-text)", fill: "var(--review-fill)", icon: RXIcons.clock },
  alert: { color: "var(--irrelevant-text)", fill: "var(--irrelevant-fill)", icon: RXIcons.release },
  info: { color: "var(--info-text)", fill: "var(--info-fill)", icon: RXIcons.inbox },
};

export function BellButton({ onNavigate }: { onNavigate: (link: ActionLink) => void }): JSX.Element {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const items = RX_DATA.importantActions;
  const count = items.length;

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const go = (item: ImportantAction) => {
    setOpen(false);
    onNavigate(item.link);
  };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Important actions"
        style={{
          position: "relative",
          width: 38,
          height: 38,
          borderRadius: "var(--radius-button)",
          border: "1px solid var(--border)",
          background: open ? "var(--surface-2)" : "var(--surface)",
          color: "var(--text-secondary)",
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "background 0.12s ease",
        }}
      >
        <RXIcons.bell size={18} />
        {count > 0 && (
          <span
            style={{
              position: "absolute",
              top: -6,
              right: -6,
              minWidth: 18,
              height: 18,
              padding: "0 4px",
              borderRadius: 999,
              background: "var(--accent)",
              color: "#fff",
              fontSize: 11,
              fontWeight: 600,
              fontFamily: "var(--font-mono)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              border: "2px solid var(--bg-page)",
              boxSizing: "content-box",
            }}
          >
            {count}
          </span>
        )}
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 10px)",
            right: 0,
            width: 360,
            zIndex: 60,
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-card)",
            boxShadow: "var(--shadow-lg)",
            overflow: "hidden",
            animation: "rx-pop 0.13s ease",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "13px 16px",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 600 }}>Important actions</span>
            <span style={{ fontSize: 12, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)" }}>{count}</span>
          </div>

          {count === 0 ? (
            <div style={{ padding: "34px 20px", textAlign: "center" }}>
              <div style={{ fontFamily: "var(--font-accent)", fontSize: 18, marginBottom: 4 }}>You're all caught up.</div>
              <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>Nothing needs you right now.</div>
            </div>
          ) : (
            <div style={{ maxHeight: 420, overflowY: "auto", padding: 6 }}>
              {items.map((item) => {
                const t = TONE[item.tone] || TONE.info;
                return (
                  <button
                    key={item.id}
                    onClick={() => go(item)}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 12,
                      width: "100%",
                      padding: "11px 12px",
                      borderRadius: 8,
                      border: "none",
                      cursor: "pointer",
                      textAlign: "left",
                      background: "transparent",
                      color: "inherit",
                      transition: "background 0.1s ease",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-2)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <span
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: 8,
                        flex: "none",
                        background: t.fill,
                        color: t.color,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <t.icon size={16} />
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: "block", fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.3 }}>{item.title}</span>
                      <span style={{ display: "block", fontSize: 12.5, color: "var(--text-secondary)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.detail}</span>
                    </span>
                    <span style={{ color: "var(--text-tertiary)", flex: "none", marginTop: 2 }}>
                      <RXIcons.chevronRight size={16} />
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
