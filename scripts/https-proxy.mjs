// Local-only HTTPS front for the plain-HTTP vinext prod server, for
// browsers/networks that force HTTPS on localhost regardless of
// browser settings (HSTS cache clear + "always use secure
// connections" off both ruled out, both Chrome and Edge). Self-signed
// — the browser will show a one-time warning to click through.
//
// Usage: node scripts/https-proxy.mjs <httpsPort> <httpTargetPort>
import { readFileSync } from "node:fs";
import https from "node:https";
import http from "node:http";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const [, , httpsPortArg, targetPortArg] = process.argv;
const httpsPort = Number(httpsPortArg) || 4443;
const targetPort = Number(targetPortArg) || 4176;

const options = {
  key: readFileSync(join(root, ".local-certs", "key.pem")),
  cert: readFileSync(join(root, ".local-certs", "cert.pem")),
};

// agent: false — a fresh TCP connection per request, no keep-alive
// pooling. Reusing pooled sockets hit an intermittent race (the
// backend closing an idle socket at the same moment this proxy tried
// to reuse it) that surfaced as ERR_EMPTY_RESPONSE / "Failed to fetch"
// in the browser, and once (below) crashed this whole process because
// the error handler tried to writeHead() after headers were already
// sent. Not a concern for a single-user local dev proxy.
const server = https.createServer(options, (req, res) => {
  const proxyReq = http.request(
    {
      host: "127.0.0.1",
      port: targetPort,
      path: req.url,
      method: req.method,
      agent: false,
      headers: {
        ...req.headers,
        "x-forwarded-proto": "https",
        "x-forwarded-host": req.headers.host,
      },
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers);
      proxyRes.pipe(res);
    },
  );
  proxyReq.on("error", (e) => {
    console.error("[https-proxy] upstream error:", e.message);
    if (!res.headersSent) res.writeHead(502);
    res.end();
  });
  res.on("error", (e) => console.error("[https-proxy] response error:", e.message));
  req.on("error", (e) => console.error("[https-proxy] request error:", e.message));
  req.pipe(proxyReq);
});

server.on("clientError", (e, socket) => {
  console.error("[https-proxy] client error:", e.message);
  if (!socket.destroyed) socket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
});

// Last-resort safety net: log and keep serving rather than let one bad
// request take the whole proxy down (this used to crash on a stale
// keep-alive socket race — see above).
process.on("uncaughtException", (e) => console.error("[https-proxy] uncaught:", e));

server.listen(httpsPort, "0.0.0.0", () => {
  console.log(`[https-proxy] https://localhost:${httpsPort} -> http://127.0.0.1:${targetPort}`);
});
