// Decides which "site" a request belongs to based on its hostname, so
// the client app (app.example.com) and the owner's admin site
// (admin.example.com) can share one deployment while staying fully
// separated at the routing layer. Kept as plain functions (no request
// object) so the rules can be unit-tested without a running server.
export type HostRole = "admin" | "app";

export function hostRole(hostname: string): HostRole {
  const label = hostname.split(".")[0]?.toLowerCase() ?? "";
  return label === "admin" ? "admin" : "app";
}

const isAdminPath = (pathname: string) =>
  pathname === "/admin" || pathname.startsWith("/admin/");

// Auth.js's own routes (session/csrf/callback/signout/...) and the
// login page itself — the admin host needs these to let the owner
// actually sign in there in the first place. Sessions are cookie-
// scoped per hostname regardless (a browser never sends an
// app.example.com cookie to admin.example.com), so allowing this on
// both hosts doesn't let a client session leak into the admin area or
// vice versa — it only lets each host run its own independent login.
const isAuthPath = (pathname: string) =>
  pathname === "/login" || pathname === "/api/auth" || pathname.startsWith("/api/auth/");

export function isPathAllowed(role: HostRole, pathname: string): boolean {
  if (role === "admin") {
    // The admin host only ever serves the admin area, its own API, and
    // login — never the client app's own pages/API.
    return isAdminPath(pathname) || pathname.startsWith("/api/admin") || isAuthPath(pathname);
  }
  // The client host must never expose the admin area, even if someone
  // guesses the path directly.
  return !isAdminPath(pathname) && !pathname.startsWith("/api/admin");
}
