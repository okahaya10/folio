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

export function isPathAllowed(role: HostRole, pathname: string): boolean {
  if (role === "admin") {
    // The admin host only ever serves the admin area (and its own API).
    return isAdminPath(pathname) || pathname.startsWith("/api/admin");
  }
  // The client host must never expose the admin area, even if someone
  // guesses the path directly.
  return !isAdminPath(pathname);
}
