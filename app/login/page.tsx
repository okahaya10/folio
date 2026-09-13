import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { vpsSessionUser } from "@/lib/vps-session";
import { hostRole } from "@/lib/host-routing";
import LoginScreenVps from "../login-screen-vps";

export const dynamic = "force-dynamic";

// The admin host never serves "/" (see lib/host-routing.ts) — only
// "/admin" — so where a successful/already-logged-in login lands must
// depend on which host served the request, not a fixed path.
async function loggedInDestination() {
  const hostname = (await headers()).get("host")?.split(":")[0] ?? "";
  return hostRole(hostname, process.env.ADMIN_HOST) === "admin" ? "/admin" : "/";
}

export default async function LoginPage() {
  const user = await vpsSessionUser();
  const destination = await loggedInDestination();
  if (user) redirect(destination);
  return <LoginScreenVps redirectTo={destination} />;
}
