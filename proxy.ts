import { NextResponse, type NextRequest } from "next/server";
import { hostRole, isPathAllowed } from "./lib/host-routing";

// Splits the app./admin. hosts (see lib/host-routing.ts for the rules
// themselves — kept separate so they're unit-testable without a
// request object).
export function proxy(request: NextRequest) {
  const hostname = request.headers.get("host")?.split(":")[0] ?? "";
  const role = hostRole(hostname);
  if (!isPathAllowed(role, request.nextUrl.pathname)) {
    return new NextResponse(null, { status: 404 });
  }
  return NextResponse.next();
}

export const config = {
  matcher: "/((?!_next|favicon\\.svg|manifest\\.json|fonts).*)",
};
