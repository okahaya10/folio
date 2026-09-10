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

const server = https.createServer(options, (req, res) => {
  const proxyReq = http.request(
    {
      host: "127.0.0.1",
      port: targetPort,
      path: req.url,
      method: req.method,
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
    res.writeHead(502);
    res.end("Proxy error: " + e.message);
  });
  req.pipe(proxyReq);
});

server.listen(httpsPort, "0.0.0.0", () => {
  console.log(`[https-proxy] https://localhost:${httpsPort} -> http://127.0.0.1:${targetPort}`);
});
