// See app/api/workspace/route.ts for the dispatch reasoning.
export async function GET(request: Request) {
  const mod = process.env.DATABASE_URL ? await import("./document-pg") : await import("./document-d1");
  return mod.GET(request);
}
