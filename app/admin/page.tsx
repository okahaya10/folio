export const dynamic = "force-dynamic";

// Placeholder for the owner's admin site (admin.<domain>). The real
// tenant-management UI (currently the "admin" view inside
// app/workspace.tsx, gated by isAdmin) moves here once Auth.js and the
// Postgres tenant tables are wired in — see proxy.ts for the routing
// split that already keeps this reachable only from the admin host.
export default function AdminHome() {
  return (
    <main style={{ padding: 32, fontFamily: "sans-serif" }}>
      <h1>Folio 運営管理</h1>
      <p>準備中です。</p>
    </main>
  );
}
