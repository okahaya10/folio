import { identity, bucket, pgQuery, fail, json, checkOrigin } from "@/lib/server.vps";
import { fetchTenant } from "@/lib/workspace-mutation.pg";
import { must, State } from "@/lib/domain";

export async function GET(req: Request) {
  try {
    const u = await identity(req);
    const t = await fetchTenant(pgQuery, new URL(req.url).searchParams.get("tenant") || "", u.userId);
    const s: State = JSON.parse(t.data);
    if (!s.company.stampKey) return new Response("", { status: 404 });
    const bytes = await bucket().get(s.company.stampKey);
    if (!bytes) return new Response("", { status: 404 });
    return new Response(bytes as BodyInit, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: Request) {
  try {
    checkOrigin(req);
    const u = await identity(req);
    const t = await fetchTenant(pgQuery, new URL(req.url).searchParams.get("tenant") || "", u.userId);
    must(t.status === "active" && ["owner", "admin"].includes(t.role), "管理者のみ角印を変更できます");
    const f = await req.formData();
    const file = f.get("file") as File;
    must(file && file.size < 500000, "500KB以内のPNG画像を選んでください");
    const bytes = new Uint8Array(await file.arrayBuffer());
    must(
      bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71,
      "PNG画像を選んでください",
    );
    const key = `${t.id}/stamp/${crypto.randomUUID()}.png`;
    await bucket().put(key, bytes);
    const s: State = JSON.parse(t.data);
    s.company.stampKey = key;
    const { rows } = await pgQuery(
      "UPDATE tenants SET data = $1, version = version + 1 WHERE id = $2 AND version = $3 RETURNING id",
      [JSON.stringify(s), t.id, t.version],
    );
    if (rows.length !== 1) {
      await bucket().delete(key);
      throw new Error("同時に更新されました。再度お試しください。");
    }
    return json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
