import assert from "node:assert/strict";
import { hostRole, isPathAllowed } from "../lib/host-routing";

assert.equal(hostRole("admin.example.com"), "admin");
assert.equal(hostRole("ADMIN.example.com"), "admin"); // case-insensitive
assert.equal(hostRole("app.example.com"), "app");
assert.equal(hostRole("example.com"), "app");
assert.equal(hostRole("localhost"), "app");
assert.equal(hostRole("admin"), "admin"); // bare host, e.g. local testing

// Admin host: only /admin* and /api/admin* are reachable.
assert.equal(isPathAllowed("admin", "/admin"), true);
assert.equal(isPathAllowed("admin", "/admin/tenants"), true);
assert.equal(isPathAllowed("admin", "/api/admin/contract"), true);
assert.equal(isPathAllowed("admin", "/"), false);
assert.equal(isPathAllowed("admin", "/api/workspace"), false);

// Client host: everything except /admin* is reachable.
assert.equal(isPathAllowed("app", "/"), true);
assert.equal(isPathAllowed("app", "/api/workspace"), true);
assert.equal(isPathAllowed("app", "/admin"), false);
assert.equal(isPathAllowed("app", "/admin/tenants"), false);
// A path that merely starts with "admin" but isn't the /admin
// boundary (e.g. "/administration") must not be blocked by accident.
assert.equal(isPathAllowed("app", "/administration"), true);

console.log("Host routing checks passed (admin/app host role + path allow-list)");
