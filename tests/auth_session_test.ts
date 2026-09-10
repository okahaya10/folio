import assert from "node:assert/strict";
import { jwtCallback, sessionCallback } from "../lib/auth-credentials";

// NextAuth (JWT strategy) doesn't expose the user id on session.user by
// default — app/api routes need it (it's the id stored in
// members.user/tenants.owner/platform.user). These two callbacks move
// it token -> session on every request; verify that plumbing directly.

// Sign-in: authorize() returned a user, so jwtCallback stores its id.
let token = jwtCallback({ token: {}, user: { id: "u1", email: "a@b.com", name: "A" } });
assert.equal(token.id, "u1");

// Subsequent requests: no `user` (NextAuth only passes it on sign-in),
// so the id already on the token must survive untouched.
token = jwtCallback({ token: { id: "u1" } });
assert.equal(token.id, "u1");

// sessionCallback copies the token's id onto session.user for route
// handlers to read.
const session = sessionCallback({
  session: { user: { email: "a@b.com", name: "A" } },
  token: { id: "u1" },
});
assert.equal(session.user!.id, "u1");

// No session.user (e.g. signed out) must not throw.
assert.deepEqual(sessionCallback({ session: {}, token: { id: "u1" } }), {});

console.log("Auth session callback checks passed (id threads token -> session, survives requests without user, safe with no session.user)");
