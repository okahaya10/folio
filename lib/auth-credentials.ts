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
