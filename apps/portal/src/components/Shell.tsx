/* Reflex portal v3 — Shell: sidebar + reusable page header. */
import type React from "react";
import { RXIcons } from "@/components/icons";
import type { RXIconProps } from "@/components/icons";
import { Avatar } from "@/components/ui";
import { RX_DATA } from "@/lib/mock-data";

export type Screen = "board" | "convos" | "props" | "report" | "assets" | "workspace";

export const NAV: { id: Screen; label: string; icon: (p: RXIconProps) => JSX.Element; badge?: number }[] = [
  { id: "board", label: "Job board", icon: RXIcons.board },
  { id: "convos", label: "Conversations", icon: RXIcons.chat, badge: 3 },
  { id: "props", label: "Proposals", icon: RXIcons.proposal },
  { id: "report", label: "Reporting", icon: RXIcons.chart },
  { id: "assets", label: "Assets", icon: RXIcons.assets },
];

export function Sidebar({
  screen,
  setScreen,
  dark,
  setDark,
}: {
  screen: Screen;
  setScreen: (id: Screen) => void;
  dark: boolean;
  setDark: React.Dispatch<React.SetStateAction<boolean>>;
}): JSX.Element {
  return (
    <aside
      style={{
        width: 230,
        flex: "none",
        height: "100%",
        borderRight: "1px solid var(--border)",
        background: "var(--surface)",
        display: "flex",
        flexDirection: "column",
        padding: "18px 14px",
      }}
    >
      {/* Brand mark */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 8px 18px" }}>
        <span
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            background: "var(--accent)",
            boxShadow: "var(--shadow-indigo)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            flex: "none",
          }}
        >
          <span style={{ width: 12, height: 12, borderRadius: 3, background: "var(--surface)", transform: "rotate(45deg)" }}></span>
        </span>
        <span style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-0.02em" }}>Reflex</span>
      </div>

      {/* Nav */}
      <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {NAV.map((item) => {
          const active = screen === item.id || (item.id === "props" && screen === "workspace");
          return (
            <button
              key={item.id}
              onClick={() => setScreen(item.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 11,
                width: "100%",
                padding: "9px 11px",
                borderRadius: "var(--radius-button)",
                border: "none",
                cursor: "pointer",
                textAlign: "left",
                background: active ? "var(--indigo-500)" : "transparent",
                color: active ? "#fff" : "var(--text-secondary)",
                fontSize: 14,
                fontWeight: active ? 700 : 500,
                boxShadow: active ? "var(--shadow-indigo)" : "none",
                transition: "background var(--t-fast) var(--ease), color var(--t-fast) var(--ease)",
              }}
              onMouseEnter={(e) => {
                if (!active) e.currentTarget.style.background = "var(--indigo-50)";
              }}
              onMouseLeave={(e) => {
                if (!active) e.currentTarget.style.background = "transparent";
              }}
            >
              <item.icon size={18} />
              <span style={{ flex: 1 }}>{item.label}</span>
              {item.badge ? (
                <span
                  style={{
                    minWidth: 18,
                    height: 18,
                    padding: "0 5px",
                    borderRadius: 999,
                    background: active ? "rgba(255,255,255,0.22)" : "var(--surface-2)",
                    color: active ? "#fff" : "var(--text-tertiary)",
                    fontSize: 11,
                    fontWeight: 700,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {item.badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </nav>

      <div style={{ flex: 1 }}></div>

      {/* Dark mode toggle */}
      <button
        onClick={() => setDark((d) => !d)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 11,
          width: "100%",
          padding: "9px 10px",
          borderRadius: "var(--radius-button)",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
          marginBottom: 8,
          background: "transparent",
          color: "var(--text-secondary)",
          fontSize: 14,
          fontWeight: 500,
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-2)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      >
        {dark ? <RXIcons.sun size={18} /> : <RXIcons.moon size={18} />}
        <span>{dark ? "Light mode" : "Dark mode"}</span>
      </button>

      {/* User */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px",
          borderRadius: "var(--radius-button)",
          border: "1px solid var(--border)",
          background: "var(--canvas)",
        }}
      >
        <Avatar person={RX_DATA.C.neha} size={32} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.2 }}>Neha</div>
          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--text-secondary)" }}>
            <span style={{ width: 6, height: 6, borderRadius: 999, background: "var(--live)" }}></span>
            Active
          </div>
        </div>
      </div>
    </aside>
  );
}

/* Reusable page header — title/subtitle on the left, slot on the right. */
export function PageHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}): JSX.Element {
  return (
    <header
      style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 20,
        padding: "22px 28px 18px",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <div>
        <h1 style={{ margin: 0, fontSize: "var(--fs-h1)", fontWeight: 700, letterSpacing: "-0.025em" }}>{title}</h1>
        {subtitle ? <p style={{ margin: "4px 0 0", fontSize: 13.5, color: "var(--text-secondary)" }}>{subtitle}</p> : null}
      </div>
      {right ? <div style={{ flex: "none" }}>{right}</div> : null}
    </header>
  );
}
