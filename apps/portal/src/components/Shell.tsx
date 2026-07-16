/* Reflex portal v3 — Shell: sidebar + reusable page header. */
import type React from "react";
import { RXIcons } from "@/components/icons";
import type { RXIconProps } from "@/components/icons";
import { Avatar } from "@/components/ui";
import { useAuth } from "@/lib/auth";

export type Screen = "board" | "extension" | "portfolio" | "convos" | "props" | "report" | "assets" | "workspace";

// The Extension screen's three sections — rendered as sub-items in the sidebar (expand under
// "Extension" when it's the active screen). Shared with ExtensionScreen so the two never drift.
export type ExtTab = "download" | "install" | "guide";
export const EXT_TABS: { id: ExtTab; label: string; icon: (p: RXIconProps) => JSX.Element }[] = [
  { id: "download", label: "Download", icon: RXIcons.download },
  { id: "install", label: "How to install", icon: RXIcons.puzzle },
  { id: "guide", label: "How to use", icon: RXIcons.spark },
];

// `hidden: true` keeps the entry (route still works) but drops it from the sidebar/mobile nav.
export const NAV: { id: Screen; label: string; icon: (p: RXIconProps) => JSX.Element; badge?: number; hidden?: boolean }[] = [
  { id: "board", label: "Job board", icon: RXIcons.board },
  { id: "extension", label: "Extension", icon: RXIcons.puzzle },
  { id: "portfolio", label: "Portfolio", icon: RXIcons.briefcase },
  { id: "convos", label: "Conversations", icon: RXIcons.chat, badge: 3, hidden: true },
  { id: "props", label: "Proposals", icon: RXIcons.proposal, hidden: true },
  { id: "report", label: "Reporting", icon: RXIcons.chart, hidden: true },
  { id: "assets", label: "Assets", icon: RXIcons.assets, hidden: true },
];

export function Sidebar({
  screen,
  setScreen,
  extTab,
  setExtTab,
  dark,
  setDark,
}: {
  screen: Screen;
  setScreen: (id: Screen) => void;
  extTab: ExtTab;
  setExtTab: (id: ExtTab) => void;
  dark: boolean;
  setDark: React.Dispatch<React.SetStateAction<boolean>>;
}): JSX.Element {
  const { user, signOut } = useAuth();
  const person = { name: user?.full_name || "Rep", bg: "var(--accent)", fg: "#fff" };
  return (
    <aside
      className="rx-sidebar"
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
        <span className="rx-brand-name" style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-0.02em" }}>Reflex</span>
      </div>

      {/* Nav */}
      <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {NAV.filter((item) => !item.hidden).map((item) => {
          const active = screen === item.id || (item.id === "props" && screen === "workspace");
          return (
            <div key={item.id}>
            <button
              className="rx-nav-btn"
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
              <span className="rx-nav-label" style={{ flex: 1 }}>{item.label}</span>
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

            {/* Extension sub-nav — expands under the item while the Extension screen is open. */}
            {item.id === "extension" && screen === "extension" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 1, margin: "3px 0 4px" }}>
                {EXT_TABS.map((t) => {
                  const on = extTab === t.id;
                  return (
                    <button
                      key={t.id}
                      className="rx-nav-btn"
                      onClick={() => setExtTab(t.id)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 9,
                        width: "100%",
                        padding: "7px 11px 7px 30px",
                        borderRadius: "var(--radius-button)",
                        border: "none",
                        cursor: "pointer",
                        textAlign: "left",
                        background: on ? "var(--indigo-50)" : "transparent",
                        color: on ? "var(--accent-on-tint)" : "var(--text-secondary)",
                        fontSize: 13,
                        fontWeight: on ? 700 : 500,
                        transition: "background var(--t-fast) var(--ease), color var(--t-fast) var(--ease)",
                      }}
                      onMouseEnter={(e) => {
                        if (!on) e.currentTarget.style.background = "var(--surface-2)";
                      }}
                      onMouseLeave={(e) => {
                        if (!on) e.currentTarget.style.background = "transparent";
                      }}
                    >
                      <t.icon size={15} />
                      <span style={{ flex: 1 }}>{t.label}</span>
                    </button>
                  );
                })}
              </div>
            ) : null}
            </div>
          );
        })}
      </nav>

      <div style={{ flex: 1 }}></div>

      {/* Dark mode toggle */}
      <button
        className="rx-dark-btn"
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
        <span className="rx-dark-label">{dark ? "Light mode" : "Dark mode"}</span>
      </button>

      {/* User + sign out */}
      <div
        className="rx-user-row"
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
        <Avatar person={person} size={32} />
        <div className="rx-user-info" style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {user?.full_name || "—"}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--text-secondary)" }}>
            <span style={{ width: 6, height: 6, borderRadius: 999, background: "var(--live)" }}></span>
            {user?.role === "admin" ? "Admin" : "Rep"}
          </div>
        </div>
        <button
          className="rx-signout-btn"
          onClick={signOut}
          title="Sign out"
          style={{
            width: 30,
            height: 30,
            flex: "none",
            borderRadius: "var(--radius-button)",
            border: "1px solid var(--border)",
            background: "var(--surface)",
            color: "var(--text-secondary)",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        </button>
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
      className="rx-page-header"
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
