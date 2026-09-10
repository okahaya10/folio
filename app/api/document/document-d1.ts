import { fontBase64 } from "@/lib/pdf-font";
import { tenant, identity, bucket, fail } from "@/lib/server";
import { makePDF } from "@/lib/pdf";
import { State, labels, must } from "@/lib/domain";
export async function GET(request: Request) {
  try {
    const u = await identity();
    const url = new URL(request.url);
    const t = await tenant(url.searchParams.get("tenant") || "", u.userId);
    const s: State = JSON.parse(t.data);
    const d = s.docs.find((d) => d.id === url.searchParams.get("id"));
    must(d, "書類が見つかりません");
    const key = `${t.id}/pdf/layout-v5-${d.id}-${d.status}.pdf`;
    const b = bucket();
    let file = await b.get(key);
    let bytes: ArrayBuffer | Uint8Array;
    if (file && d.status !== "draft") bytes = await file.arrayBuffer();
    else {
      const fontBytes = Uint8Array.from(atob(fontBase64), (c) =>
        c.charCodeAt(0),
      );
      const stamp = d.company.stampKey
        ? await b.get(d.company.stampKey)
        : null;
      bytes = await makePDF(
        d,
        fontBytes,
        stamp ? new Uint8Array(await stamp.arrayBuffer()) : undefined,
      );
      if (d.status !== "draft")
        await b.put(key, bytes, {
          httpMetadata: { contentType: "application/pdf" },
        });
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
