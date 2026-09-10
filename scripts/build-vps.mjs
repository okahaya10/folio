// Wraps `vinext build --config vite.vps.config.ts`.
//
// Why this exists: vinext's file-based router must enumerate and
// import every app/api/*/route.ts (and the modules those import) up
// front to build its routing table — same as Next.js itself. That
// means workspace-d1.ts/document-d1.ts/stamp-d1.ts (and lib/server.ts,
// which they import) get bundled into the Sakura VPS build too, even
// though app/api/*/route.ts only ever *reaches* them via a
// `__VPS_BUILD__`-gated dynamic import. lib/server.ts's
// `import {env} from 'cloudflare:workers'` then crashes the plain-Node
// server at startup — confirmed this is unavoidable through Vite
// config (resolve.alias, resolve.conditions, define all had no effect
// on vinext's bundling here; see git history for what was tried).
//
// So: temporarily replace the three D1-only route modules with stubs
// that don't import lib/server.ts, build, then restore the originals
// — guaranteed via try/finally plus process exit/signal handlers, so
// an interrupted build can't leave the working tree stubbed.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const targets = [
  "app/api/workspace/workspace-d1.ts",
  "app/api/document/document-d1.ts",
  "app/api/stamp/stamp-d1.ts",
].map((p) => join(root, p));

const stub = "export async function GET(){return new Response(null,{status:404})}\nexport const POST=GET;\n";

const originals = new Map(targets.map((p) => [p, readFileSync(p, "utf8")]));
let restored = false;
function restore() {
  if (restored) return;
  restored = true;
  for (const [path, content] of originals) writeFileSync(path, content);
}
process.on("exit", restore);
process.on("SIGINT", () => {
  restore();
  process.exit(1);
});
process.on("SIGTERM", () => {
  restore();
  process.exit(1);
});

try {
  for (const path of targets) writeFileSync(path, stub);
  execFileSync(
    process.execPath,
    ["node_modules/vinext/dist/cli.js", "build", "--config", "vite.vps.config.ts"],
    { cwd: root, stdio: "inherit" },
  );
} finally {
  restore();
}
