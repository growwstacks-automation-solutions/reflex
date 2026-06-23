// Auth: bcrypt password check + JWT issue/verify. Workers-safe (jose + bcryptjs).
// Secrets come from bound `env` only — never hardcoded.
import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import bcrypt from "bcryptjs";
import { neon } from "@neondatabase/serverless";
import { json } from "./http";
import type { Env } from "./index";

const TOKEN_TTL = "7d";

function secretKey(env: Env): Uint8Array {
  return new TextEncoder().encode(env.JWT_SECRET);
}

export interface AuthClaims extends JWTPayload {
  sub: string;
  email: string;
  role: string;
}

async function signToken(
  claims: { sub: string; email: string; role: string },
  env: Env,
): Promise<string> {
  return new SignJWT({ email: claims.email, role: claims.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.sub)
    .setIssuedAt()
    .setExpirationTime(TOKEN_TTL)
    .sign(secretKey(env));
}

/** Extract + verify the Bearer token. Returns claims, or null for missing/invalid/expired. */
export async function authUser(req: Request, env: Env): Promise<AuthClaims | null> {
  const header = req.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  try {
    const { payload } = await jwtVerify(match[1], secretKey(env));
    if (typeof payload.sub !== "string") return null;
    return payload as AuthClaims;
  } catch {
    return null;
  }
}

interface LoginBody {
  email?: string;
  password?: string;
}

interface UserRow {
  id: string;
  email: string;
  full_name: string;
  role: string;
  active: boolean;
  password_hash: string;
}

export async function login(req: Request, env: Env): Promise<Response> {
  if (!env.JWT_SECRET) return json({ error: "Server misconfigured: JWT_SECRET is not set." }, 500);
  if (!env.DATABASE_URL) return json({ error: "Server misconfigured: DATABASE_URL is not set." }, 500);

  let body: LoginBody;
  try {
    body = (await req.json()) as LoginBody;
  } catch {
    return json({ error: 'Body must be JSON: { "email": "...", "password": "..." }.' }, 400);
  }
  const email = (body.email ?? "").toString().trim().toLowerCase();
  const password = (body.password ?? "").toString();
  if (!email || !password) return json({ error: "email and password are required." }, 400);

  const sql = neon(env.DATABASE_URL);
  const rows = (await sql`
    select id, email, full_name, role, active, password_hash
    from users where email = ${email} limit 1
  `) as UserRow[];
  const user = rows[0];

  // Indistinguishable response for unknown email vs wrong password — don't reveal which.
  if (!user) return json({ error: "Invalid credentials" }, 401);
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return json({ error: "Invalid credentials" }, 401);
  if (!user.active) return json({ error: "Account disabled" }, 403);

  const token = await signToken({ sub: user.id, email: user.email, role: user.role }, env);
  return json({
    token,
    user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role },
  });
}
