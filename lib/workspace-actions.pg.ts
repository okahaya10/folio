import { empty, must, sample, text } from "./domain";
import { hashPassword, verifyPassword } from "./auth-credentials";
import type { QueryFn } from "./workspace-mutation.pg";

// Postgres port of the setup/membership actions in
// app/api/workspace/route.ts that run before tenant() is even called
// (bootstrap, accept, createTenant, contract) plus the two that run
// after it but aren't part of the generic apply() flow (invite,
// removeMember). See lib/workspace-mutation.pg.ts for the generic
// document-mutation flow these complement. DB-agnostic (plain query
// function) so each is testable against PGlite.

async function sha256Hex(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// First-ever caller becomes the platform (operator) admin and gets a
// sample-data tenant to explore the app with. Later callers, once the
// single `platform` row already belongs to someone else, are refused.
export async function bootstrap(query: QueryFn, userId: string, email: string) {
  await query(
    "INSERT INTO platform(id,\"user\") VALUES('owner',$1) ON CONFLICT (id) DO NOTHING",
    [userId],
  );
  const { rows } = await query("SELECT id FROM platform WHERE \"user\" = $1", [userId]);
  must(rows.length > 0, "会社管理者からの招待が必要です");
  const tenantId = "demo-" + userId;
  const s = sample();
  await query(
    `INSERT INTO tenants(id,name,owner,data,created) VALUES($1,$2,$3,$4,$5)
     ON CONFLICT (id) DO NOTHING`,
    [tenantId, s.company.name, userId, JSON.stringify(s), new Date().toISOString()],
  );
  await query(
    `INSERT INTO members(tenant,"user",email,role) VALUES($1,$2,$3,'owner')
     ON CONFLICT (tenant, "user") DO NOTHING`,
    [tenantId, userId, email],
  );
  return { id: tenantId };
}

export async function acceptInvite(
  query: QueryFn,
  userId: string,
  email: string,
  rawToken: string,
) {
  const { rows: memberships } = await query(
    'SELECT COUNT(*) AS n FROM members WHERE "user" = $1',
    [userId],
  );
  must(Number(memberships[0]?.n ?? 0) === 0, "このアカウントはすでに別の会社に所属しています");
  const hashed = await sha256Hex(text(rawToken, 200));
  const { rows: invites } = await query(
    "SELECT * FROM invitations WHERE token = $1 AND lower(email) = $2 AND expires > $3",
    [hashed, email.toLowerCase(), new Date().toISOString()],
  );
  const invite = invites[0];
  must(invite, "招待が無効、期限切れ、またはメールアドレスが一致しません");
  await query(
    `INSERT INTO members(tenant,"user",email,role)
     SELECT tenant, $1, $2, role FROM invitations
     WHERE token = $3 AND expires > $4
     ON CONFLICT (tenant, "user") DO NOTHING`,
    [userId, email, hashed, new Date().toISOString()],
  );
  await query("DELETE FROM invitations WHERE token = $1", [hashed]);
  return { id: invite.tenant };
}

export async function createTenant(query: QueryFn, userId: string, email: string, name: string) {
  const { rows } = await query('SELECT COUNT(*) AS count FROM members WHERE "user" = $1', [
    userId,
  ]);
  must(Number(rows[0]?.count ?? 0) === 0, "会社アカウントは1つまでです");
  const cleanName = text(name);
  must(cleanName, "会社名を入力してください");
  const id = crypto.randomUUID();
  await query(
    "INSERT INTO tenants(id,name,owner,data,created) VALUES($1,$2,$3,$4,$5)",
    [id, cleanName, userId, JSON.stringify(empty(cleanName)), new Date().toISOString()],
  );
  await query("INSERT INTO members(tenant,\"user\",email,role) VALUES($1,$2,$3,'owner')", [
    id,
    userId,
    email,
  ]);
  return { id };
}

async function requirePlatformAdmin(query: QueryFn, userId: string) {
  const { rows } = await query('SELECT id FROM platform WHERE "user" = $1', [userId]);
  must(rows.length > 0, "運営管理者のみ操作できます");
}

// Owner-only: issues a brand-new client account (email+password login)
// and its company in one step, for clients who don't have an account
// yet — unlike acceptInvite/createTenant, which assume the person
// accepting/creating already has one. The returned password is shown
// once in the admin UI for the owner to hand to the client; nothing
// stores it in plain text.
export async function grantAccount(
  query: QueryFn,
  actorUserId: string,
  input: { companyName: string; email: string; password: string; contactName?: string },
) {
  await requirePlatformAdmin(query, actorUserId);
  const email = text(input.email).toLowerCase();
  must(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), "メールアドレスを確認してください");
  const companyName = text(input.companyName);
  must(companyName, "会社名を入力してください");
  must(input.password && input.password.length >= 8, "パスワードは8文字以上にしてください");

  const { rows: existing } = await query("SELECT id FROM users WHERE lower(email) = $1", [email]);
  must(existing.length === 0, "このメールアドレスはすでに使われています");

  const userId = crypto.randomUUID();
  const passwordHash = await hashPassword(input.password);
  const name = text(input.contactName) || companyName;
  await query(
    "INSERT INTO users(id,email,password_hash,name,created) VALUES($1,$2,$3,$4,$5)",
    [userId, email, passwordHash, name, new Date().toISOString()],
  );
  const tenantId = crypto.randomUUID();
  await query(
    "INSERT INTO tenants(id,name,owner,data,created) VALUES($1,$2,$3,$4,$5)",
    [tenantId, companyName, userId, JSON.stringify(empty(companyName)), new Date().toISOString()],
  );
  await query("INSERT INTO members(tenant,\"user\",email,role) VALUES($1,$2,$3,'owner')", [
    tenantId,
    userId,
    email,
  ]);
  return { tenantId, email };
}

// Self-service: a logged-in user changes their own password, proving
// they know the current one first.
export async function changePassword(
  query: QueryFn,
  userId: string,
  currentPassword: string,
  newPassword: string,
) {
  must(newPassword && newPassword.length >= 8, "パスワードは8文字以上にしてください");
  const { rows } = await query("SELECT password_hash FROM users WHERE id = $1", [userId]);
  const user = rows[0];
  must(user, "アカウントが見つかりません");
  const ok = await verifyPassword(currentPassword, user.password_hash);
  must(ok, "現在のパスワードが正しくありません");
  const passwordHash = await hashPassword(newPassword);
  await query("UPDATE users SET password_hash = $1 WHERE id = $2", [passwordHash, userId]);
  return { ok: true };
}

// Owner-only: resets a client's password without knowing the old one,
// for when a client forgets it. The new password is returned once for
// the owner to hand to the client, same as grantAccount's issued box.
export async function resetTenantPassword(
  query: QueryFn,
  actorUserId: string,
  tenantId: string,
  newPassword: string,
) {
  await requirePlatformAdmin(query, actorUserId);
  must(newPassword && newPassword.length >= 8, "パスワードは8文字以上にしてください");
  const { rows } = await query("SELECT owner FROM tenants WHERE id = $1", [tenantId]);
  const tenant = rows[0];
  must(tenant, "会社が見つかりません");
  const passwordHash = await hashPassword(newPassword);
  await query("UPDATE users SET password_hash = $1 WHERE id = $2", [passwordHash, tenant.owner]);
  return { ok: true };
}

export async function listTenantsForAdmin(query: QueryFn, actorUserId: string) {
  await requirePlatformAdmin(query, actorUserId);
  const { rows } = await query(
    `SELECT t.id, t.name, t.status, t.plan, t.created, u.email AS owner_email
     FROM tenants t
     LEFT JOIN users u ON u.id = t.owner
     ORDER BY t.created DESC`,
    [],
  );
  return rows;
}

export async function setContract(
  query: QueryFn,
  userId: string,
  tenantId: string,
  status: string,
) {
  await requirePlatformAdmin(query, userId);
  must(["active", "read_only", "suspended"].includes(status), "状態を確認してください");
  await query("UPDATE tenants SET status = $1 WHERE id = $2", [status, tenantId]);
  return { ok: true };
}

export async function renameTenant(
  query: QueryFn,
  actorUserId: string,
  tenantId: string,
  name: string,
) {
  await requirePlatformAdmin(query, actorUserId);
  const cleanName = text(name);
  must(cleanName, "会社名を入力してください");
  await query("UPDATE tenants SET name = $1 WHERE id = $2", [cleanName, tenantId]);
  return { ok: true };
}

// Removes a client's tenant and its memberships/invitations. Leaves the
// owner's user row in place (an owner could belong to another tenant),
// so this only tears down the tenant-scoped rows, not the account itself.
export async function deleteTenant(query: QueryFn, actorUserId: string, tenantId: string) {
  await requirePlatformAdmin(query, actorUserId);
  await query("DELETE FROM invitations WHERE tenant = $1", [tenantId]);
  await query('DELETE FROM members WHERE tenant = $1', [tenantId]);
  await query("DELETE FROM tenants WHERE id = $1", [tenantId]);
  return { ok: true };
}

export async function invite(
  query: QueryFn,
  tenantId: string,
  actorRole: string,
  email: string,
  role: string,
) {
  must(["owner", "admin"].includes(actorRole), "管理者のみ招待できます");
  must(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text(email)), "メールアドレスを確認してください");
  must(["staff", "admin"].includes(role), "役割を確認してください");
  must(actorRole === "owner" || role === "staff", "管理者の招待はオーナーが行ってください");
  const token = crypto.randomUUID() + crypto.randomUUID();
  await query(
    "INSERT INTO invitations(token,tenant,email,role,expires) VALUES($1,$2,$3,$4,$5)",
    [
      await sha256Hex(token),
      tenantId,
      text(email).toLowerCase(),
      role,
      new Date(Date.now() + 7 * 86400000).toISOString(),
    ],
  );
  return { token };
}

export async function removeMember(
  query: QueryFn,
  tenantId: string,
  actorRole: string,
  targetUserId: string,
) {
  must(["owner", "admin"].includes(actorRole), "管理者のみ操作できます");
  const { rows } = await query(
    'SELECT role FROM members WHERE tenant = $1 AND "user" = $2',
    [tenantId, targetUserId],
  );
  const member = rows[0];
  must(
    member && member.role !== "owner" && (actorRole === "owner" || member.role === "staff"),
    "このメンバーは解除できません",
  );
  await query('DELETE FROM members WHERE tenant = $1 AND "user" = $2', [
    tenantId,
    targetUserId,
  ]);
  return { ok: true };
}
