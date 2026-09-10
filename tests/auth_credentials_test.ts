import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { hashPassword, verifyCredentials } from "../lib/auth-credentials";

// Verifies the email+password login logic (lib/auth-credentials.ts)
// against a real Postgres engine (PGlite) before it's wired into
// Auth.js / any route. Covers: correct login, wrong password, unknown
// email, and case-insensitive email matching.
const db = new PGlite();
for (const file of readdirSync("drizzle-pg").sort()) {
  if (file.endsWith(".sql")) await db.exec(readFileSync(`drizzle-pg/${file}`, "utf8"));
}

const query = (text: string, params: unknown[]) => db.query(text, params);

const hash = await hashPassword("correct horse battery staple");
await db.query(
  "INSERT INTO users(id, email, password_hash, name, created) VALUES($1,$2,$3,$4,$5)",
  ["u1", "Owner@Example.com", hash, "田中 太郎", new Date().toISOString()],
);

const ok = await verifyCredentials(
  query,
  "owner@example.com", // different case, must still match
  "correct horse battery staple",
);
assert.ok(ok);
assert.equal(ok!.id, "u1");
assert.equal(ok!.name, "田中 太郎");

assert.equal(
  await verifyCredentials(query, "owner@example.com", "wrong password"),
  null,
);
assert.equal(
  await verifyCredentials(query, "nobody@example.com", "correct horse battery staple"),
  null,
);
assert.equal(await verifyCredentials(query, "", ""), null);

console.log("Auth credentials checks passed (hash+verify, wrong password, unknown email, case-insensitive email)");
await db.close();
