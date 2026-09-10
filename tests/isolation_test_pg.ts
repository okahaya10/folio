import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

// PostgreSQL equivalent of tests/isolation_test.py, run against the
// Sakura VPS schema (drizzle-pg/) with a real (WASM) Postgres engine.
// Same checks: tenant isolation, optimistic locking, read-only status,
// and membership revocation.
const db = new PGlite();
await db.exec(readFileSync("drizzle-pg/0000_dry_veda.sql", "utf8"));

for (const [id, user] of [
  ["A", "alice"],
  ["B", "bob"],
] as const) {
  await db.query(
    "INSERT INTO tenants(id,name,owner,data,created) VALUES($1,$2,$3,$4,$5)",
    [id, id, user, "{}", "now"],
  );
  await db.query(
    "INSERT INTO members(tenant,\"user\",email,role) VALUES($1,$2,$3,$4)",
    [id, user, user + "@example.com", "owner"],
  );
}

const q =
  'SELECT t.*, m.role FROM tenants t JOIN members m ON m.tenant = t.id WHERE t.id = $1 AND m."user" = $2';
assert.equal((await db.query(q, ["B", "alice"])).rows.length, 0);
assert.equal((await db.query(q, ["A", "alice"])).rows.length, 1);

const update =
  "UPDATE tenants SET data = $1, version = version + 1 " +
  "WHERE id = $2 AND version = $3 AND status = 'active' " +
  'AND EXISTS (SELECT 1 FROM members WHERE tenant = $2 AND "user" = $4 AND role = $5)';
assert.equal(
  (await db.query(update, ['{"ok":1}', "A", 0, "alice", "owner"])).affectedRows,
  1,
);
assert.equal(
  (await db.query(update, ['{"ok":2}', "A", 0, "alice", "owner"])).affectedRows,
  0,
);
assert.equal(
  (await db.query(update, ['{"bad":1}', "B", 0, "alice", "owner"])).affectedRows,
  0,
);

await db.query("UPDATE tenants SET status = 'read_only' WHERE id = 'A'");
assert.equal(
  (await db.query(update, ["{}", "A", 1, "alice", "owner"])).affectedRows,
  0,
);

await db.query('DELETE FROM members WHERE tenant = $1 AND "user" = $2', [
  "B",
  "bob",
]);
assert.equal((await db.query(q, ["B", "bob"])).rows.length, 0);

console.log(
  "PostgreSQL tenant isolation, optimistic locking, read-only and membership revocation checks passed",
);
await db.close();
