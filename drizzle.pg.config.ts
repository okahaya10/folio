import { defineConfig } from "drizzle-kit";

// Generates the PostgreSQL migration for the Sakura VPS version.
// Run with: pnpm exec drizzle-kit generate --config drizzle.pg.config.ts
export default defineConfig({
  out: "./drizzle-pg",
  schema: "./db/schema.pg.ts",
  dialect: "postgresql",
});
