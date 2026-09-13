import assert from "node:assert/strict";
import { hostRole, isPathAllowed } from "../lib/host-routing";

assert.equal(hostRole("admin.example.com"), "admin");
assert.equal(hostRole("ADMIN.example.com"), "admin"); // case-insensitive
assert.equal(hostRole("app.example.com"), "app");
assert.equal(hostRole("example.com"), "app");
assert.equal(hostRole("localhost"), "app");
assert.equal(hostRole("admin"), "admin"); // bare host, e.g. local testing

// Explicit ADMIN_HOST override — needed in production when the admin
// subdomain isn't literally named "admin" (e.g. "app.<domain>" was
// already taken by another app on the same shared VPS).
assert.equal(hostRole("folio-admin.stappo.jp", "folio-admin.stappo.jp"), "admin");
assert.equal(hostRole("FOLIO-ADMIN.stappo.jp", "folio-admin.stappo.jp"), "admin"); // case-insensitive
assert.equal(hostRole("folio-app.stappo.jp", "folio-admin.stappo.jp"), "app");

// Admin host: /admin*, /api/admin*, and Auth.js's own routes (so the
// owner can actually log in there) are reachable; the client app's own
// pages/API are not.
assert.equal(isPathAllowed("admin", "/admin"), true);
assert.equal(isPathAllowed("admin", "/admin/tenants"), true);
assert.equal(isPathAllowed("admin", "/api/admin/contract"), true);
assert.equal(isPathAllowed("admin", "/login"), true);
assert.equal(isPathAllowed("admin", "/api/auth/session"), true);
assert.equal(isPathAllowed("admin", "/api/auth/callback/credentials"), true);
assert.equal(isPathAllowed("admin", "/"), false);
assert.equal(isPathAllowed("admin", "/api/workspace"), false);

// Client host: everything except /admin* and /api/admin* is reachable
// (Auth.js's own routes stay reachable here too — each host's login is
// independent, scoped by the browser's own per-hostname cookie jar).
assert.equal(isPathAllowed("app", "/"), true);
assert.equal(isPathAllowed("app", "/api/workspace"), true);
assert.equal(isPathAllowed("app", "/login"), true);
assert.equal(isPathAllowed("app", "/api/auth/session"), true);
assert.equal(isPathAllowed("app", "/admin"), false);
assert.equal(isPathAllowed("app", "/admin/tenants"), false);
assert.equal(isPathAllowed("app", "/api/admin/contract"), false);
// A path that merely starts with "admin" but isn't the /admin
// boundary (e.g. "/administration") must not be blocked by accident.
assert.equal(isPathAllowed("app", "/administration"), true);

console.log("Host routing checks passed (admin/app host role + path allow-list)");
