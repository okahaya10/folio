import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import {
  acceptInvite,
  bootstrap,
  createTenant,
  deleteTenant,
  grantAccount,
  invite,
  removeMember,
  setContract,
} from "../lib/workspace-actions.pg";

const db = new PGlite();
for (const file of readdirSync("drizzle-pg").sort()) {
  if (file.endsWith(".sql")) await db.exec(readFileSync(`drizzle-pg/${file}`, "utf8"));
}
const query = (text: string, params: unknown[]) => db.query(text, params);

// --- bootstrap: first caller becomes platform admin + gets a demo tenant ---
const boot1 = await bootstrap(query, "owner-1", "owner1@example.com");
assert.equal(boot1.id, "demo-owner-1");
const platformRow = await db.query<any>('SELECT "user" FROM platform WHERE id = $1', ["owner"]);
assert.equal(platformRow.rows[0]!["user"], "owner-1");

// A second, different user calling bootstrap must be refused — the
// single `platform` row is already taken (INSERT ON CONFLICT DO
// NOTHING means their own insert silently no-ops, then the "am I an
// admin" check correctly fails for them).
await assert.rejects(
  () => bootstrap(query, "someone-else", "someone@example.com"),
  /会社管理者からの招待が必要です/,
);

// Calling bootstrap again as the SAME user is idempotent (both inserts
// are ON CONFLICT DO NOTHING) — no error, same tenant id back.
const boot1Again = await bootstrap(query, "owner-1", "owner1@example.com");
assert.equal(boot1Again.id, "demo-owner-1");

// --- createTenant: one company per account ---
// owner-1 already has a membership (from bootstrap's demo tenant), so
// they can't create a second company.
await assert.rejects(
  () => createTenant(query, "owner-1", "owner1@example.com", "二つ目の会社"),
  /会社アカウントは1つまでです/,
);
// A fresh user can create their own.
const client1 = await createTenant(query, "client-1", "client1@example.com", "青葉ハウス");
assert.ok(client1.id);
await assert.rejects(
  () => createTenant(query, "client-2", "client2@example.com", ""),
  /会社名を入力してください/,
);

// --- setContract: only the platform admin can change contract status ---
await assert.rejects(
  () => setContract(query, "client-1", client1.id, "suspended"),
  /運営管理者のみ操作できます/,
);
await setContract(query, "owner-1", client1.id, "read_only");
const statusRow = await db.query<any>("SELECT status FROM tenants WHERE id = $1", [client1.id]);
assert.equal(statusRow.rows[0]!.status, "read_only");
await assert.rejects(
  () => setContract(query, "owner-1", client1.id, "not-a-status"),
  /状態を確認してください/,
);
await setContract(query, "owner-1", client1.id, "active"); // restore for later tests

// --- invite: role rules ---
// Owner can invite an admin.
const inv1 = await invite(query, client1.id, "owner", "staffer@example.com", "admin");
assert.ok(inv1.token);
// An admin actor cannot invite another admin — only the owner can.
await assert.rejects(
  () => invite(query, client1.id, "admin", "other@example.com", "admin"),
  /管理者の招待はオーナーが行ってください/,
);
// An admin actor CAN invite staff.
const inv2 = await invite(query, client1.id, "admin", "staff2@example.com", "staff");
assert.ok(inv2.token);
// Staff cannot invite at all.
await assert.rejects(
  () => invite(query, client1.id, "staff", "x@example.com", "staff"),
  /管理者のみ招待できます/,
);
await assert.rejects(
  () => invite(query, client1.id, "owner", "not-an-email", "staff"),
  /メールアドレスを確認してください/,
);
await assert.rejects(
  () => invite(query, client1.id, "owner", "x@example.com", "owner"),
  /役割を確認してください/,
);

// --- acceptInvite ---
// Need the raw (unhashed) token — invite() only returns the hash's
// input (the token itself, before hashing), which is what a real
// invite link would carry.
const acceptResult = await acceptInvite(query, "new-staffer", "staffer@example.com", inv1.token);
assert.equal(acceptResult.id, client1.id);
const memberRow = await db.query<any>(
  'SELECT role FROM members WHERE tenant = $1 AND "user" = $2',
  [client1.id, "new-staffer"],
);
assert.equal(memberRow.rows[0]!.role, "admin");
// The invitation is single-use: accepting the same token again fails.
await assert.rejects(
  () => acceptInvite(query, "another-user", "staffer@example.com", inv1.token),
  /招待が無効、期限切れ、またはメールアドレスが一致しません/,
);
// Wrong email for a still-valid token is refused.
await assert.rejects(
  () => acceptInvite(query, "yet-another", "nobody@example.com", inv2.token),
  /招待が無効、期限切れ、またはメールアドレスが一致しません/,
);
// Someone who already belongs to a company can't accept a second invite.
await assert.rejects(
  () => acceptInvite(query, "client-1", "client1@example.com", inv2.token),
  /すでに別の会社に所属しています/,
);

// --- removeMember: role rules ---
// Owner can remove the admin that was just added.
await removeMember(query, client1.id, "owner", "new-staffer");
const gone = await db.query(
  'SELECT 1 FROM members WHERE tenant = $1 AND "user" = $2',
  [client1.id, "new-staffer"],
);
assert.equal(gone.rows.length, 0);
// Nobody (not even the owner) can remove the owner.
await assert.rejects(
  () => removeMember(query, client1.id, "owner", "client-1"),
  /このメンバーは解除できません/,
);
// An admin actor can only remove staff, not another admin.
await db.query('INSERT INTO members(tenant,"user",email,role) VALUES($1,$2,$3,$4)', [
  client1.id,
  "admin-2",
  "admin2@example.com",
  "admin",
]);
await assert.rejects(
  () => removeMember(query, client1.id, "admin", "admin-2"),
  /このメンバーは解除できません/,
);

// --- deleteTenant: orphaned owner accounts are cleaned up so the same
// email can be re-registered, but a platform admin is never deleted ---
const granted = await grantAccount(query, "owner-1", {
  companyName: "テスト株式会社",
  email: "delete-me@example.com",
  password: "password123",
});
await deleteTenant(query, "owner-1", granted.tenantId);
const goneUser = await db.query("SELECT 1 FROM users WHERE lower(email) = $1", [
  "delete-me@example.com",
]);
assert.equal(goneUser.rows.length, 0);
// The same email can now be granted a fresh account.
const regranted = await grantAccount(query, "owner-1", {
  companyName: "テスト株式会社2",
  email: "delete-me@example.com",
  password: "password123",
});
assert.ok(regranted.tenantId);
// Deleting a tenant owned by the platform admin (owner-1's own demo
// tenant) must not delete owner-1's users row — they still need to
// sign in to the admin dashboard. bootstrap() doesn't itself insert a
// users row (that's Auth.js/seed-platform-admin.mjs's job), so insert
// one directly to exercise the platform-admin guard.
await db.query(
  "INSERT INTO users(id,email,password_hash,name,created) VALUES($1,$2,$3,$4,$5)",
  ["owner-1", "owner1@example.com", "x", "オーナー", new Date().toISOString()],
);
await deleteTenant(query, "owner-1", "demo-owner-1");
const ownerStillThere = await db.query("SELECT 1 FROM users WHERE id = $1", ["owner-1"]);
assert.equal(ownerStillThere.rows.length, 1);

console.log(
  "Workspace actions (Postgres) checks passed: bootstrap, createTenant, setContract, invite, acceptInvite, removeMember, deleteTenant",
);
await db.close();
