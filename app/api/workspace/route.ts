// Dispatches to the D1/ChatGPT-auth implementation (OpenAI Sites) or
// the Postgres/Auth.js one (Sakura VPS) based on DATABASE_URL at
// runtime. Both branches are still bundled together (vinext's
// file-based router must import every route up front, same
// architectural constraint as Next.js itself — a build-time constant
// here doesn't let Rollup prove either branch dead, that was tried and
// didn't pan out, see git history), so keeping workspace-d1.ts's
// `cloudflare:workers` reference out of the Sakura VPS bundle is
// scripts/build-vps.mjs's job (temporarily stubs workspace-d1.ts /
// document-d1.ts / stamp-d1.ts during that build only, restored after
// — see that script's comment for the full reasoning).
export async function GET(request: Request) {
  const mod = process.env.DATABASE_URL
    ? await import("./workspace-pg")
    : await import("./workspace-d1");
  return mod.GET(request);
}

export async function POST(request: Request) {
  const mod = process.env.DATABASE_URL
    ? await import("./workspace-pg")
    : await import("./workspace-d1");
  return mod.POST(request);
}
