import postgres from "postgres";
import { auth } from "./auth";
import { FsStorage } from "./storage-fs";
import type { FileStorage } from "./storage";

// Sakura VPS equivalent of lib/server.ts (D1 + R2 + ChatGPT headers).
// Same exported shape — db()/bucket()/identity()/tenant()/checkOrigin()/
// fail()/json() — so app/api/*/route.ts can switch its import with no
// other changes once this is verified end-to-end. Not imported by any
// route yet.

let sql: ReturnType<typeof postgres> | null = null;
export function pg() {
  if (!sql) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("保存先に接続できません。しばらくして再度お試しください。");
    sql = postgres(url);
  }
  return sql;
}

let storage: FileStorage | null = null;
export function bucket(): FileStorage {
  if (!storage) storage = new FsStorage(process.env.STORAGE_ROOT ?? "./storage");
  return storage;
}

export async function identity() {
  const session = await auth();
  const user = session?.user;
  if (!user?.id || !user.email) throw new Error("ログインが必要です");
  return {
    userId: user.id as string,
    email: user.email,
    displayName: user.name || user.email,
  };
}

export async function tenant(id: string, user: string) {
  const rows = await pg()`
    SELECT t.*, m.role FROM tenants t
    JOIN members m ON m.tenant = t.id
    WHERE t.id = ${id} AND m."user" = ${user}
  `;
  const r = rows[0];
  if (!r) throw new Error("この会社へのアクセス権がありません");
  if (["suspended", "closed"].includes(r.status as string))
    throw new Error("この会社は利用停止中です。運営者にお問い合わせください。");
  return r;
}

export function checkOrigin(r: Request) {
  const o = r.headers.get("origin");
  if (o && o !== new URL(r.url).origin) throw new Error("不正なリクエストです");
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
