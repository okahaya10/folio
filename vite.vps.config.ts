import vinext from "vinext";
import { defineConfig } from "vite";

// Sakura VPS build target: plain Node.js (vinext's built-in prod
// server, see node_modules/vinext/dist/server/prod-server.js), no
// Cloudflare Workers/D1/R2 bindings and no OpenAI Sites mock-auth
// middleware. Auth/DB/storage come from lib/*.vps.ts (Auth.js,
// Postgres via `pg`, local disk) instead.
//
// Build with `pnpm build:vps` (scripts/build-vps.mjs), not this CLI
// command directly — that script temporarily stubs out the D1-only
// route modules so their `cloudflare:workers` reference doesn't get
// bundled in (vinext's file-based router imports every route up front
// regardless of this config; see that script's comment).
export default defineConfig({
  plugins: [vinext()],
});
