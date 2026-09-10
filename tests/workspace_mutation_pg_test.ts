import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { empty } from "../lib/domain";
import { fetchTenant, mutateWorkspace } from "../lib/workspace-mutation.pg";

// Proves the riskiest part of the migration — the optimistic-locked,
// idempotent document mutation flow that app/api/workspace/route.ts's
// POST handler runs on every save — behaves correctly against real
// Postgres semantics (PGlite) before any live route touches it.
const db = new PGlite();
for (const file of readdirSync("drizzle-pg").sort()) {
  if (file.endsWith(".sql")) await db.exec(readFileSync(`drizzle-pg/${file}`, "utf8"));
}
const query = (text: string, params: unknown[]) => db.query(text, params);

const seedTenant = async (id: string, owner: string) => {
  const state = empty("テスト株式会社");
  state.company.verified = true;
  await db.query(
    "INSERT INTO tenants(id,name,owner,data,created) VALUES($1,$2,$3,$4,$5)",
    [id, state.company.name, owner, JSON.stringify(state), new Date().toISOString()],
  );
  await db.query(
    'INSERT INTO members(tenant,"user",email,role) VALUES($1,$2,$3,$4)',
    [id, owner, owner + "@example.com", "owner"],
  );
};

// --- normal flow: fetch, mutate, version advances, data persists ---
await seedTenant("T1", "alice");
let t = await fetchTenant(query, "T1", "alice");
assert.equal(t.version, 0);
assert.equal(t.role, "owner");
const r1 = await mutateWorkspace(query, t, "alice", "alice@example.com", {
  type: "customer",
  name: "顧客 A",
  requestId: "req-1",
  version: t.version,
});
assert.ok(r1.id);
t = await fetchTenant(query, "T1", "alice");
assert.equal(t.version, 1);
assert.equal(JSON.parse(t.data).customers.length, 1);

// --- idempotency: replaying the same requestId is a no-op, not a
// double-apply, even though `t` (fetched after the first mutation) has
// requestId still pointing at the OLD state before it was pushed to
// s.processed... use the same requestId again from the fresh fetch: ---
const r2 = await mutateWorkspace(query, t, "alice", "alice@example.com", {
  type: "customer",
  name: "顧客 A（重複）",
  requestId: "req-1",
  version: t.version,
});
assert.deepEqual(r2, { ok: true, repeated: true });
t = await fetchTenant(query, "T1", "alice");
assert.equal(t.version, 1); // unchanged — no second write happened
assert.equal(JSON.parse(t.data).customers.length, 1); // still just one

// --- optimistic lock: a stale client-sent version must be rejected,
// even though the `t` the server fetched is current ---
await assert.rejects(
  () =>
    mutateWorkspace(query, t, "alice", "alice@example.com", {
      type: "customer",
      name: "顧客 B",
      requestId: "req-2",
      version: 0, // client hasn't refreshed since before the first save
    }),
  /他の操作で更新されました/,
);

// --- role re-check in the guarded UPDATE: even with a matching
// version, if the actor's role changed underneath them the write must
// fail rather than silently applying with a stale role ---
t = await fetchTenant(query, "T1", "alice");
await db.query('UPDATE members SET role = $1 WHERE tenant = $2 AND "user" = $3', [
  "staff",
  "T1",
  "alice",
]);
await assert.rejects(
  () =>
    mutateWorkspace(query, t, "alice", "alice@example.com", {
      // settings requires admin/owner — apply() itself would also
      // reject this for a staff actor, but the point here is the SQL
      // guard: it must fail even before apply()'s own role check
      // would matter, because `t.role` is stale ("owner").
      type: "settings",
      company: { name: "改名テスト" },
      version: t.version,
      requestId: "req-3",
    }),
  /他の操作で更新されました/,
);

// --- read-only tenant: mutation must be refused ---
await seedTenant("T2", "bob");
await db.query("UPDATE tenants SET status = 'read_only' WHERE id = 'T2'");
const readOnly = await fetchTenant(query, "T2", "bob");
await assert.rejects(
  () =>
    mutateWorkspace(query, readOnly, "bob", "bob@example.com", {
      type: "customer",
      name: "顧客 C",
      requestId: "req-4",
    }),
  /閲覧専用のため変更できません/,
);

// --- suspended tenant: fetchTenant itself must refuse ---
await db.query("UPDATE tenants SET status = 'suspended' WHERE id = 'T2'");
await assert.rejects(() => fetchTenant(query, "T2", "bob"), /利用停止中/);

// --- no membership: fetchTenant must refuse (not just return empty) ---
await assert.rejects(() => fetchTenant(query, "T1", "mallory"), /アクセス権がありません/);

console.log(
  "Workspace mutation (Postgres) checks passed: optimistic lock, requestId idempotency, mid-flight role change, read-only, suspended, non-member",
);
await db.close();
