import vinext from "vinext";
import { defineConfig } from "vite";

// Sakura VPS build target: plain Node.js (vinext's built-in prod
// server, see node_modules/vinext/dist/server/prod-server.js), no
// Cloudflare Workers/D1/R2 bindings and no OpenAI Sites mock-auth
// middleware. Auth/DB/storage come from lib/*.vps.ts (Auth.js,
// Postgres, local disk) instead. Build with:
//   pnpm exec vinext build --config vite.vps.config.ts
export default defineConfig({
  plugins: [vinext()],
});
