import type React from 'react';
import type { CSSProperties } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  spark?: boolean;
  icon?: React.ReactNode;
  loading?: boolean;
  children?: React.ReactNode;
}

/**
 * Reflex primary action button. One primary per view. AI actions carry a spark icon.
 */
export function Button({
  variant = 'primary',
  size = 'md',
  spark = false,
  icon = null,
  disabled = false,
  loading = false,
  children,
  style = {},
  ...rest
}: ButtonProps) {
  const pads: Record<ButtonSize, string> = {
    sm: '6px 10px',
    md: '9px 14px',
    lg: '12px 18px',
  };
  const fontSize = size === 'sm' ? 13 : 14;

  const variants: Record<ButtonVariant, CSSProperties> = {
    primary: {
      background: 'var(--terracotta-500)',
      color: '#fff',
      border: '1px solid transparent',
    },
    secondary: {
      background: 'var(--surface)',
      color: 'var(--text-primary)',
      border: '1px solid var(--border)',
    },
    ghost: {
      background: 'transparent',
      color: 'var(--text-secondary)',
      border: '1px solid transparent',
    },
  };

  const base = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    fontFamily: 'var(--font-ui)',
    fontWeight: 'var(--fw-medium)',
    fontSize,
    lineHeight: 1,
    padding: pads[size],
    borderRadius: 'var(--radius-button)',
    cursor: disabled || loading ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    transition: 'background 120ms ease, color 120ms ease, transform 80ms ease',
    whiteSpace: 'nowrap',
    ...variants[variant],
    ...style,
  } as CSSProperties;

  return (
    <button
      type="button"
      disabled={disabled || loading}
      style={base}
      onMouseDown={(e) => { if (!disabled && !loading) e.currentTarget.style.transform = 'scale(0.98)'; }}
      onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
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
      <path d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2z"
        fill="currentColor" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"
      style={{ animation: 'reflex-spin 0.7s linear infinite' }}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <style>{`@keyframes reflex-spin{to{transform:rotate(360deg)}}`}</style>
    </svg>
  );
}
