import { identity, pgQuery, checkOrigin, fail, json } from "@/lib/server.vps";
import { must, text } from "@/lib/domain";
import {
  deleteTenant,
  grantAccount,
  listTenantsForAdmin,
  renameTenant,
  resetTenantPassword,
  setContract,
} from "@/lib/workspace-actions.pg";

// Owner-only API (see lib/host-routing.ts — only reachable from the
// admin host regardless of DATABASE_URL/D1, since this route only
// exists in this app's Postgres/VPS half in the first place).
export async function GET(request: Request) {
  try {
    const u = await identity(request);
    const tenants = await listTenantsForAdmin(pgQuery, u.userId);
    return json({ tenants });
  } catch (e) {
    return fail(e);
  }
}

export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const u = await identity(request);
    const raw = await request.text();
    must(raw.length < 5000, "入力内容が大きすぎます");
    const a = JSON.parse(raw);

    if (a.type === "grantAccount") {
      return json(
        await grantAccount(pgQuery, u.userId, {
          companyName: text(a.companyName),
          email: text(a.email),
          password: String(a.password ?? ""),
          contactName: text(a.contactName),
        }),
      );
    }
    if (a.type === "contract") {
      return json(await setContract(pgQuery, u.userId, text(a.tenant), text(a.status)));
    }
    if (a.type === "rename") {
      return json(await renameTenant(pgQuery, u.userId, text(a.tenant), text(a.name)));
    }
    if (a.type === "delete") {
      return json(await deleteTenant(pgQuery, u.userId, text(a.tenant)));
    }
    if (a.type === "resetPassword") {
      return json(
        await resetTenantPassword(pgQuery, u.userId, text(a.tenant), String(a.password ?? "")),
      );
    }
    throw new Error("操作を確認してください");
  } catch (e) {
    return fail(e);
  }
}
