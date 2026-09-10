import { apply, must, type State } from "./domain";

// Postgres port of the core mutation flow in app/api/workspace/route.ts
// (the generic apply()-based branch: fetch tenant -> check requestId
// idempotency -> check optimistic-lock version -> apply() -> guarded
// UPDATE). Kept DB-agnostic (a plain query function) so it can be
// tested against PGlite before being wired into a real route with the
// `postgres` client.
export type QueryFn = (text: string, params: unknown[]) => Promise<{ rows: any[] }>;

export type TenantRow = {
  id: string;
  name: string;
  owner: string;
  data: string;
  version: number;
  status: string;
  plan: string;
  created: string;
  role: string;
};

export async function fetchTenant(
  query: QueryFn,
  tenantId: string,
  userId: string,
): Promise<TenantRow> {
  const { rows } = await query(
    `SELECT t.*, m.role FROM tenants t
     JOIN members m ON m.tenant = t.id
     WHERE t.id = $1 AND m."user" = $2`,
    [tenantId, userId],
  );
  const r = rows[0];
  if (!r) throw new Error("この会社へのアクセス権がありません");
  if (["suspended", "closed"].includes(r.status))
    throw new Error("この会社は利用停止中です。運営者にお問い合わせください。");
  return r as TenantRow;
}

export async function mutateWorkspace(
  query: QueryFn,
  t: TenantRow,
  userId: string,
  email: string,
  action: any,
): Promise<any> {
  must(t.status === "active", "閲覧専用のため変更できません");
  const s: State = JSON.parse(t.data);
  must(
    typeof action.requestId === "string" && action.requestId.length <= 100,
    "リクエストIDが必要です",
  );
  if (s.processed.includes(action.requestId)) return { ok: true, repeated: true };
  must(
    action.version === t.version,
    "他の操作で更新されました。再読み込み後にやり直してください",
  );
  const result = apply(s, action, email, t.role);
  s.processed.push(action.requestId);
  const data = JSON.stringify(s);
  must(
    new TextEncoder().encode(data).length < 900000,
    "保存上限に近づきました。運営者にお問い合わせください",
  );
  const { rows } = await query(
    `UPDATE tenants SET data = $1, name = $2, version = version + 1
     WHERE id = $3 AND version = $4 AND status = 'active'
     AND EXISTS (
       SELECT 1 FROM members WHERE tenant = $3 AND "user" = $5 AND role = $6
     )
     RETURNING id`,
    [data, s.company.name, t.id, t.version, userId, t.role],
  );
  must(rows.length === 1, "他の操作で更新されました。再読み込み後にやり直してください");
  return result;
}
