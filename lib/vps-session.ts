import { headers } from "next/headers";
import { getToken } from "next-auth/jwt";
import { pg } from "./server.vps";

// Server Component session check. Not lib/auth.ts's `auth()` — that
// returned null even for a demonstrably valid session cookie under
// vinext (confirmed via /api/auth/session, handled directly by
// NextAuth's own route rather than going through `auth()`). getToken()
// decodes the JWT straight from the Cookie header instead. Same fix as
// lib/server.vps.ts's identity(), just fed from next/headers() since
// Server Components don't get the raw Request. See git history.
export async function vpsSessionUser() {
  const token = await getToken({ req: { headers: await headers() }, secret: process.env.AUTH_SECRET });
  if (!token?.id || !token.email) return null;
  // See identity()'s comment in lib/server.vps.ts — a token can still
  // decode fine for a user deleted since it was issued (e.g. by
  // deleteTenant orphan cleanup), so confirm the row still exists.
  const { rows } = await pg().query("SELECT 1 FROM users WHERE id = $1", [token.id]);
  if (!rows.length) return null;
  return { id: token.id as string, email: token.email as string, name: (token.name as string) || null };
}
