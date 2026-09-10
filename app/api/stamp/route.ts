// See app/api/workspace/route.ts for the dispatch reasoning.
export async function GET(request: Request) {
  const mod = process.env.DATABASE_URL ? await import("./stamp-pg") : await import("./stamp-d1");
  return mod.GET(request);
}

export async function POST(request: Request) {
  const mod = process.env.DATABASE_URL ? await import("./stamp-pg") : await import("./stamp-d1");
  return mod.POST(request);
}
