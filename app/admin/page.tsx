import { redirect } from "next/navigation";
import { vpsSessionUser } from "@/lib/vps-session";
import AdminDashboard from "../admin-dashboard";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  const user = await vpsSessionUser();
  if (!user) redirect("/login");
  return <AdminDashboard />;
}
