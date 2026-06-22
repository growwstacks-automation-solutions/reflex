import { useEffect, useState } from "react";

/**
 * Phase 0 placeholder — proves the foundation is wired:
 * tokens, the three font families, and light/dark theming.
 * The real portal screens (board, workspace, conversations,
 * reporting, assets) replace this in later phases.
 */
export default function App() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
  }, [dark]);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 20,
        padding: 40,
        background: "var(--canvas)",
        color: "var(--text-primary)",
      }}
    >
      {/* Brand mark (matches ShellV3's sidebar logo) */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: "var(--accent)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            flex: "none",
          }}
        >
          <span
            style={{
              width: 15,
              height: 15,
              borderRadius: 4,
              background: "var(--surface)",
              transform: "rotate(45deg)",
            }}
          />
        </span>
        <span style={{ fontSize: 24, fontWeight: 600, letterSpacing: "-0.02em" }}>
          Reflex
        </span>
      </div>

      {/* Fraunces is reserved for empty states — a scaffold page qualifies. */}
      <h1
        style={{
          margin: 0,
          fontFamily: "var(--font-accent)",
          fontSize: "var(--fs-display)",
          fontWeight: 500,
          letterSpacing: "-0.01em",
          textAlign: "center",
        }}
      >
        Portal scaffold is live.
      </h1>

      <p
        style={{
          margin: 0,
          maxWidth: 440,
          textAlign: "center",
          color: "var(--text-secondary)",
          fontSize: "var(--fs-body)",
          lineHeight: "var(--lh-body)",
        }}
      >
        Phase 0 — design tokens, fonts, and dark mode are wired. The board, proposal
        workspace, conversations, reporting, and assets screens land in the next phases.
      </p>

      <code
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "var(--fs-mono)",
          color: "var(--text-tertiary)",
        }}
      >
        apps/portal · npm run dev
      </code>

      <button
        onClick={() => setDark((d) => !d)}
        style={{
          marginTop: 8,
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 14px",
          borderRadius: "var(--radius-button)",
          border: "1px solid var(--border)",
          background: "var(--surface)",
          color: "var(--text-primary)",
          fontSize: "var(--fs-meta)",
          fontWeight: 500,
          cursor: "pointer",
        }}
      >
        {dark ? "Switch to light" : "Switch to dark"}
      </button>
    </div>
  );
}
