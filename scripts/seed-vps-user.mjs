// One-off helper for local verification: creates a users row with a
// real bcrypt hash so the Auth.js Credentials login can be tested
// end-to-end before any real signup flow exists.
//
// Usage: DATABASE_URL=... node scripts/seed-vps-user.mjs <email> <password> <name>
import pg from "pg";
import bcrypt from "bcryptjs";

const [, , email, password, name] = process.argv;
if (!email || !password || !name) {
  console.error("Usage: node scripts/seed-vps-user.mjs <email> <password> <name>");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const hash = await bcrypt.hash(password, 12);
const id = "seed-" + email.split("@")[0];
await pool.query(
  `INSERT INTO users(id, email, password_hash, name, created)
   VALUES ($1, $2, $3, $4, $5)
   ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
  [id, email, hash, name, new Date().toISOString()],
);
console.log("Seeded user:", id, email);
await pool.end();
