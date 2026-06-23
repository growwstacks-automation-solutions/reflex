/**
 * Auth state — a small React Context (no global-state lib needed for an internal tool).
 * The JWT + user live in localStorage so reps stay signed in across refreshes.
 * Tradeoff: a token in localStorage is readable by page JS — acceptable here since the
 * portal runs only first-party code and never holds any other secret.
 */
import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";
import { login as apiLogin, type ApiUser } from "./api";

const TOKEN_KEY = "reflex_token";
const USER_KEY = "reflex_user";

interface AuthState {
  token: string | null;
  user: ApiUser | null;
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

function readUser(): ApiUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as ApiUser) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }): JSX.Element {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState<ApiUser | null>(readUser);

  const signIn = async (email: string, password: string): Promise<void> => {
    const result = await apiLogin(email, password);
    localStorage.setItem(TOKEN_KEY, result.token);
    localStorage.setItem(USER_KEY, JSON.stringify(result.user));
    setToken(result.token);
    setUser(result.user);
  };

  const signOut = (): void => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ token, user, isAuthenticated: !!token, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
