import { redirect } from "next/navigation";
import { vpsSessionUser } from "@/lib/vps-session";
import LoginScreenVps from "../login-screen-vps";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const user = await vpsSessionUser();
  if (user) redirect("/");
  return <LoginScreenVps />;
}
