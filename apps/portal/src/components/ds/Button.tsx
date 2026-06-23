import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";
import { useState } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  spark?: boolean;
  icon?: ReactNode;
  loading?: boolean;
  children?: ReactNode;
}

/**
 * Reflex v4 button — the most energetic thing on the screen.
 * Indigo solid + white, shadow + glow, hover lift+darken, active press.
 */
export function Button({
  variant = "primary",
  size = "md",
  spark = false,
  icon = null,
  disabled = false,
  loading = false,
  children,
  style = {},
  ...rest
}: ButtonProps): JSX.Element {
  const [hover, setHover] = useState(false);
  const pads: Record<ButtonSize, string> = { sm: "7px 12px", md: "9px 15px", lg: "12px 20px" };
  const fontSize = size === "sm" ? 13 : size === "lg" ? 15 : 14;

  const variants: Record<ButtonVariant, CSSProperties> = {
    primary: {
      background: hover ? "var(--indigo-600)" : "var(--indigo-500)",
      color: "#fff",
      border: "1px solid transparent",
      boxShadow: hover ? "var(--shadow-indigo)" : "0 2px 6px rgba(79,70,229,0.22)",
    },
    secondary: {
      background: hover ? "var(--terracotta-50)" : "var(--surface)",
      color: hover ? "var(--terracotta-700)" : "var(--text-primary)",
      border: hover ? "1px solid var(--terracotta-100)" : "1px solid var(--border)",
      boxShadow: "var(--shadow-sm)",
    },
    ghost: {
      background: hover ? "var(--surface-2)" : "transparent",
      color: "var(--text-secondary)",
      border: "1px solid transparent",
      boxShadow: "none",
    },
  };

  const base: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    fontFamily: "var(--font-ui)",
    fontWeight: 600,
    fontSize,
    lineHeight: 1,
    padding: pads[size],
    borderRadius: "var(--radius-button)",
    cursor: disabled || loading ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1,
    whiteSpace: "nowrap",
    transform: hover && variant === "primary" && !disabled ? "translateY(-1px)" : "translateY(0)",
    transition:
      "background var(--t-fast) var(--ease), box-shadow var(--t-fast) var(--ease), transform 80ms var(--ease), color var(--t-fast) var(--ease), border-color var(--t-fast) var(--ease)",
    ...variants[variant],
    ...style,
  };

  return (
    <button
      type="button"
      disabled={disabled || loading}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onMouseDown={(e) => {
        if (!disabled && !loading) e.currentTarget.style.transform = "translateY(0) scale(0.98)";
      }}
      onMouseUp={(e) => {
        e.currentTarget.style.transform = "";
      }}
      style={base}
      {...rest}
    >
      {loading && <Spinner />}
      {!loading && spark && <SparkIcon />}
      {!loading && icon}
      {children}
    </button>
  );
}

function SparkIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2z" fill="currentColor" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      style={{ animation: "rx-spin 0.7s linear infinite" }}
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
