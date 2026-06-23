/* Login — email + password against POST /auth/login. Matches the v4 indigo system. */
import { useState } from "react";
import type { CSSProperties, KeyboardEvent } from "react";
import { Button } from "@/components/ds";
import { useAuth } from "@/lib/auth";

export function LoginScreen(): JSX.Element {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (): Promise<void> => {
    if (busy || !email || !password) {
      if (!email || !password) setError("Enter your email and password.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await signIn(email.trim(), password);
      // success → AuthProvider flips isAuthenticated → App renders the board.
    } catch (e) {
      setError(e instanceof Error ? e.message : "Login failed");
      setBusy(false);
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === "Enter") void submit();
  };

  const label: CSSProperties = {
    display: "block",
    fontSize: 12.5,
    fontWeight: 600,
    color: "var(--text-secondary)",
    marginBottom: 6,
  };
  const input: CSSProperties = {
    width: "100%",
    boxSizing: "border-box",
    padding: "11px 13px",
    fontSize: 14,
    fontFamily: "var(--font-ui)",
    borderRadius: "var(--radius-button)",
    border: "1px solid var(--border)",
    background: "var(--surface)",
    color: "var(--text-primary)",
    outline: "none",
  };

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--canvas)",
      }}
    >
      <div
        style={{
          width: 372,
          maxWidth: "92vw",
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-card)",
          boxShadow: "var(--shadow-md, var(--shadow-sm))",
          padding: "30px 30px 28px",
        }}
      >
        {/* Brand */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 22 }}>
          <span
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              background: "var(--accent)",
              boxShadow: "var(--shadow-indigo)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              flex: "none",
            }}
          >
            <span style={{ width: 12, height: 12, borderRadius: 3, background: "var(--surface)", transform: "rotate(45deg)" }} />
          </span>
          <span style={{ fontSize: 19, fontWeight: 700, letterSpacing: "-0.02em" }}>Reflex</span>
        </div>

        <h1 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em" }}>Sign in</h1>
        <p style={{ margin: "0 0 22px", fontSize: 13.5, color: "var(--text-secondary)" }}>
          Your Reflex board, your jobs.
        </p>

        <div style={{ marginBottom: 14 }}>
          <label style={label} htmlFor="rx-email">Email</label>
          <input
            id="rx-email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="you@growwstacks.com"
            style={input}
          />
        </div>
        <div style={{ marginBottom: 18 }}>
          <label style={label} htmlFor="rx-password">Password</label>
          <input
            id="rx-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="••••••••"
            style={input}
          />
        </div>

        {error && (
          <div
            role="alert"
            style={{
              marginBottom: 16,
              padding: "9px 12px",
              borderRadius: "var(--radius-button)",
              background: "var(--irrelevant-fill, var(--surface-2))",
              color: "var(--irrelevant-text)",
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            {error}
          </div>
        )}

        <Button spark loading={busy} disabled={busy} onClick={() => void submit()} style={{ width: "100%" }}>
          {busy ? "Signing in…" : "Sign in"}
        </Button>
      </div>
    </div>
  );
}
