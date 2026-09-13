import { Pool } from "pg";
import { getToken } from "next-auth/jwt";
import { FsStorage } from "./storage-fs";
import type { FileStorage } from "./storage";

// Sakura VPS equivalent of lib/server.ts (D1 + R2 + ChatGPT headers).
// Same exported shape — db()/bucket()/identity()/tenant()/checkOrigin()/
// fail()/json() — so app/api/*/route.ts can switch its import with no
// other changes once this is verified end-to-end. Not imported by any
// route yet.
//
// Uses `pg` (node-postgres), not the `postgres` package: `postgres`'s
// package.json "exports" has a "workerd" condition pointing at a
// Cloudflare Workers build that imports `cloudflare:sockets` — vinext
// resolves toward that condition even in this Cloudflare-plugin-free
// build (confirmed the hard way; config-level conditions/alias
// overrides didn't change it), crashing at runtime. `pg` has no such
// alternate build to be misresolved to.
let pool: Pool | null = null;
export function pg() {
  if (!pool) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("保存先に接続できません。しばらくして再度お試しください。");
    pool = new Pool({ connectionString: url });
  }
  return pool;
}

// pg's query() already returns { rows, ... }, matching the QueryFn
// shape lib/workspace-mutation.pg.ts and lib/workspace-actions.pg.ts
// expect (same shape PGlite's db.query() returns, which is what those
// modules' tests run against) — no adapter needed. Verified against a
// real local Postgres, not just PGlite — see
// tests/real_postgres_smoke_test.ts.
export const pgQuery = (text: string, params: unknown[]) => pg().query(text, params);

let storage: FileStorage | null = null;
export function bucket(): FileStorage {
  if (!storage) storage = new FsStorage(process.env.STORAGE_ROOT ?? "./storage");
  return storage;
}

// Reads the session by decoding the JWT straight off the incoming
// Request's Cookie header (getToken() accepts a plain Request or
// {headers}), rather than lib/auth.ts's ambient/wrapped `auth()` —
// both of those returned null here even for a demonstrably valid
// session cookie (confirmed via /api/auth/session, which is handled
// directly by NextAuth's own route rather than going through either
// of those). Root cause not fully pinned down (suspected: vinext's
// route handlers get a plain Request, not a `.cookies`-augmented
// NextRequest, which `auth()` relies on internally) — getToken()
// sidesteps it by reading the header directly. See git history.
export async function identity(request: Request) {
  const token = await getToken({ req: request, secret: process.env.AUTH_SECRET });
  if (!token?.id || !token.email) throw new Error("ログインが必要です");
  // The JWT itself doesn't shrink-wrap to a deleted account — if the
  // owner deletes this user's tenant (and with it their users row, see
  // deleteTenant), a browser that was already signed in keeps a
  // technically-valid-looking token pointing at a user that no longer
  // exists. Without this check that silently sails through as a real
  // but tenant-less session, landing on "create a new company" instead
  // of being sent back to /login.
  const { rows } = await pg().query("SELECT 1 FROM users WHERE id = $1", [token.id]);
  if (!rows.length) throw new Error("ログインが必要です");
  return {
    userId: token.id as string,
    email: token.email as string,
    displayName: (token.name as string) || (token.email as string),
  };
}

export async function tenant(id: string, user: string) {
  const { rows } = await pg().query(
    `SELECT t.*, m.role FROM tenants t
     JOIN members m ON m.tenant = t.id
     WHERE t.id = $1 AND m."user" = $2`,
    [id, user],
  );
  const r = rows[0];
  if (!r) throw new Error("この会社へのアクセス権がありません");
  if (["suspended", "closed"].includes(r.status as string))
    throw new Error("この会社は利用停止中です。運営者にお問い合わせください。");
  return r;
}

export function checkOrigin(r: Request) {
  const o = r.headers.get("origin");
  // Compare host only, not the full origin (scheme included) — behind
  // a reverse proxy that terminates TLS (nginx in production, or the
  // local scripts/https-proxy.mjs used for browser testing), vinext
  // constructs r.url with whatever scheme it thinks it's speaking
  // (plain http, since that's the actual socket), while the browser's
  // real Origin header correctly says https. A scheme mismatch here
  // isn't a cross-site request — the host match is what actually rules
  // that out.
  const expectedHost = r.headers.get("x-forwarded-host") ?? new URL(r.url).host;
  if (o && new URL(o).host !== expectedHost) throw new Error("不正なリクエストです");
  if (r.headers.get("sec-fetch-site") === "cross-site")
    throw new Error("不正なリクエストです");
}

export function fail(e: any) {
  const msg = e instanceof Error ? e.message : "処理に失敗しました";
  const known = !/postgres|ECONNREFUSED|relation|constraint|syntax/i.test(msg);
  return Response.json(
    { error: known ? msg : "処理を完了できませんでした。再度お試しください。" },
    {
      status: msg.includes("ログイン") ? 401 : msg.includes("アクセス権") ? 403 : 400,
      headers: { "Cache-Control": "no-store" },
    },
  );
}

export const json = (v: any) =>
  Response.json(v, { headers: { "Cache-Control": "no-store" } });
