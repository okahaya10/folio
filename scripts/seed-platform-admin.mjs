// One-off bootstrap for production: creates the very first
// platform-admin (owner) account directly in the database, since the
// admin-grant flow itself requires an existing platform admin to call
// it (see lib/workspace-mutation.pg.ts's requirePlatformAdmin).
//
// Usage: node scripts/seed-platform-admin.mjs <email> <password> <name>
import pg from "pg";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";

const [, , email, password, name] = process.argv;
if (!email || !password || !name) {
  console.error("Usage: node scripts/seed-platform-admin.mjs <email> <password> <name>");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const hash = await bcrypt.hash(password, 12);
const userId = "owner-" + randomUUID();

await pool.query(
  `INSERT INTO users(id, email, password_hash, name, created)
   VALUES ($1, $2, $3, $4, $5)
   ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
   RETURNING id`,
  [userId, email, hash, name, new Date().toISOString()],
);
const { rows } = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
const realUserId = rows[0].id;

await pool.query(
  `INSERT INTO platform(id, "user")
   SELECT $1, $2 WHERE NOT EXISTS (SELECT 1 FROM platform WHERE "user" = $2)`,
  ["platform-" + randomUUID(), realUserId],
);

console.log("Platform admin ready:", email, realUserId);
await pool.end();
