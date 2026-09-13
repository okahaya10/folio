import bcrypt from "bcryptjs";

// Minimal DB-agnostic query shape so this logic can be exercised
// against PGlite in tests and against the real `postgres` client (via
// sql.unsafe) in production, without pulling either into this file.
export type QueryFn = (
  text: string,
  params: unknown[],
) => Promise<{ rows: any[] }>;

export type AuthUser = { id: string; email: string; name: string };

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

// NextAuth's JWT session strategy doesn't put the user id on the
// session by default — these two callbacks thread it through
// token -> session. Plain functions (NextAuth's actual shapes are
// wider; only the fields used here) so the id-propagation logic can
// be unit-tested without a running auth() request cycle.
export function jwtCallback(params: {
  token: Record<string, unknown>;
  user?: AuthUser | null;
}) {
  if (params.user) params.token.id = params.user.id;
  return params.token;
}

export function sessionCallback(params: {
  session: { user?: Record<string, unknown> };
  token: Record<string, unknown>;
}) {
  if (params.session.user) params.session.user.id = params.token.id;
  return params.session;
}

export async function verifyCredentials(
  query: QueryFn,
  email: string,
  password: string,
): Promise<AuthUser | null> {
  const normalized = email.trim().toLowerCase();
  if (!normalized || !password) return null;
  const { rows } = await query(
    "SELECT id, email, name, password_hash FROM users WHERE lower(email) = $1",
    [normalized],
  );
  const user = rows[0];
  if (!user) return null;
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return null;
  return { id: user.id, email: user.email, name: user.name };
}
