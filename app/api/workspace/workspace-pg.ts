import { identity, pg, pgQuery, checkOrigin, fail, json } from "@/lib/server.vps";
import { must, text } from "@/lib/domain";
import { fetchTenant, mutateWorkspace } from "@/lib/workspace-mutation.pg";
import {
  acceptInvite,
  bootstrap,
  changePassword,
  createTenant,
  invite,
  removeMember,
  setContract,
} from "@/lib/workspace-actions.pg";

// Postgres/Auth.js equivalent of workspace-d1.ts. Same request/response
// shape (route.ts dispatches to whichever this pair matches the
// deployment target), built on lib/workspace-mutation.pg.ts and
// lib/workspace-actions.pg.ts — already verified independently against
// PGlite and a real local Postgres (see tests/).
export async function GET(request: Request) {
  try {
    const u = await identity(request);
    const sql = pg();
    const id = new URL(request.url).searchParams.get("tenant");
    const isAdminResult = await sql.query('SELECT id FROM platform WHERE "user" = $1', [
      u.userId,
    ]);
    const isAdmin = isAdminResult.rows.length > 0;
    const { rows: list } = await sql.query(
      `SELECT t.id, t.name, t.status, t.plan, m.role FROM tenants t
       JOIN members m ON m.tenant = t.id
       WHERE m."user" = $1 ORDER BY t.created`,
      [u.userId],
    );
    if (!id)
      return json({ user: { name: u.displayName, email: u.email }, tenants: list, isAdmin });
    const t = await fetchTenant(pgQuery, id, u.userId);
    const { rows: members } = await sql.query(
      'SELECT "user", email, role FROM members WHERE tenant = $1',
      [id],
    );
    return json({
      state: JSON.parse(t.data),
      version: t.version,
      role: t.role,
      status: t.status,
      members,
      tenants: list,
      isAdmin,
      user: { name: u.displayName, email: u.email },
    });
  } catch (e) {
    return fail(e);
  }
}

export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const u = await identity(request);
    const raw = await request.text();
    must(raw.length < 150000, "入力内容が大きすぎます");
    const a = JSON.parse(raw);

    if (a.type === "bootstrap") return json(await bootstrap(pgQuery, u.userId, u.email));
    if (a.type === "accept")
      return json(await acceptInvite(pgQuery, u.userId, u.email, text(a.token, 200)));
    if (a.type === "createTenant")
      return json(await createTenant(pgQuery, u.userId, u.email, a.name));
    if (a.type === "contract") return json(await setContract(pgQuery, u.userId, a.tenant, a.status));
    if (a.type === "changePassword")
      return json(
        await changePassword(
          pgQuery,
          u.userId,
          String(a.currentPassword ?? ""),
          String(a.newPassword ?? ""),
        ),
      );

    const t = await fetchTenant(pgQuery, text(a.tenant), u.userId);
    must(t.status === "active", "閲覧専用のため変更できません");

    if (a.type === "invite") return json(await invite(pgQuery, t.id, t.role, a.email, a.role));
    if (a.type === "removeMember")
      return json(await removeMember(pgQuery, t.id, t.role, a.user));

    const result = await mutateWorkspace(pgQuery, t, u.userId, u.email, a);
    return json(result);
  } catch (e) {
    return fail(e);
  }
}
