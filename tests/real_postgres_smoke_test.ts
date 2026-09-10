import assert from "node:assert/strict";
import { Pool } from "pg";
import { empty } from "../lib/domain";
import { bootstrap, createTenant } from "../lib/workspace-actions.pg";
import { fetchTenant, mutateWorkspace } from "../lib/workspace-mutation.pg";

// Opt-in smoke test against a REAL PostgreSQL server (not PGlite) —
// the same lib/workspace-actions.pg.ts and lib/workspace-mutation.pg.ts
// already covered thoroughly against PGlite, re-run here as a sanity
// check that the query strings behave identically against the real
// engine we'll actually deploy against. Skipped when DATABASE_URL
// isn't set (e.g. CI without a local Postgres).
const url = process.env.DATABASE_URL;
if (!url) {
  console.log("Skipping real Postgres smoke test (DATABASE_URL not set)");
  process.exit(0);
}

const pool = new Pool({ connectionString: url });
const query = (text: string, params: unknown[]) => pool.query(text, params);

// Clean slate for this test's own rows (safe to run repeatedly).
await pool.query(`DELETE FROM members WHERE "user" LIKE 'smoke-%'`);
await pool.query(`DELETE FROM tenants WHERE id LIKE 'demo-smoke-%' OR owner LIKE 'smoke-%'`);
await pool.query(`DELETE FROM platform WHERE "user" LIKE 'smoke-%'`);

const owner = "smoke-owner-" + Date.now();
const boot = await bootstrap(query, owner, owner + "@example.com");
assert.equal(boot.id, "demo-" + owner);

const client = "smoke-client-" + Date.now();
const tenant = await createTenant(query, client, client + "@example.com", "実機確認株式会社");
assert.ok(tenant.id);

let t = await fetchTenant(query, tenant.id, client);
assert.equal(t.version, 0);
const result = await mutateWorkspace(query, t, client, client + "@example.com", {
  type: "customer",
  name: "実機確認 顧客A",
  requestId: "smoke-req-1",
  version: t.version,
});
assert.ok(result.id);

t = await fetchTenant(query, tenant.id, client);
assert.equal(t.version, 1);
const state = JSON.parse(t.data as string);
assert.equal(state.customers[0].name, "実機確認 顧客A");

// Clean up after ourselves.
await pool.query(`DELETE FROM members WHERE "user" LIKE 'smoke-%'`);
await pool.query(`DELETE FROM tenants WHERE id LIKE 'demo-smoke-%' OR owner LIKE 'smoke-%'`);
await pool.query(`DELETE FROM platform WHERE "user" LIKE 'smoke-%'`);

console.log("Real PostgreSQL smoke test passed (bootstrap, createTenant, mutateWorkspace round trip)");
await pool.end();
