import { fontBase64 } from "@/lib/pdf-font";
import { identity, bucket, pgQuery, fail } from "@/lib/server.vps";
import { fetchTenant } from "@/lib/workspace-mutation.pg";
import { makePDF } from "@/lib/pdf";
import { State, labels, must } from "@/lib/domain";

// Postgres/local-storage equivalent of document-d1.ts. FileStorage's
// get() returns the bytes directly (Uint8Array | null), unlike
// R2Bucket's get() (an object with its own .arrayBuffer()) — that's
// the one real shape difference from the D1/R2 version.
export async function GET(request: Request) {
  try {
    const u = await identity(request);
    const url = new URL(request.url);
    const t = await fetchTenant(pgQuery, url.searchParams.get("tenant") || "", u.userId);
    const s: State = JSON.parse(t.data);
    const d = s.docs.find((d) => d.id === url.searchParams.get("id"));
    must(d, "書類が見つかりません");
    const key = `${t.id}/pdf/layout-v5-${d.id}-${d.status}.pdf`;
    let cached = await bucket().get(key);
    let bytes: Uint8Array;
    if (cached && d.status !== "draft") bytes = cached;
    else {
      const fontBytes = Uint8Array.from(atob(fontBase64), (c) => c.charCodeAt(0));
      const stamp = d.company.stampKey ? await bucket().get(d.company.stampKey) : null;
      bytes = await makePDF(d, fontBytes, stamp ?? undefined);
      if (d.status !== "draft")
        await bucket().put(key, bytes, { contentType: "application/pdf" });
    }
    return new Response(bytes as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${url.searchParams.get("inline") === "1" ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(labels[d.kind] + "_" + d.number + ".pdf")}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    return fail(e);
  }
}
