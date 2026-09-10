import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { Pool } from "pg";
import { jwtCallback, sessionCallback, verifyCredentials } from "./auth-credentials";

// Sakura VPS auth. Not wired into any route yet — this is scaffolding,
// exercised only by tests/auth-credentials.test.ts until the app is
// actually switched over from ChatGPT-header auth (app/chatgpt-auth.ts).
//
// Uses `pg`, not the `postgres` package — see lib/server.vps.ts's
// comment on `pg()` for why (postgres's "workerd" export condition
// gets misresolved by vinext even without the Cloudflare plugin).
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: "メールアドレス", type: "email" },
        password: { label: "パスワード", type: "password" },
      },
      authorize: async (credentials) => {
        const email = String(credentials?.email ?? "");
        const password = String(credentials?.password ?? "");
        const user = await verifyCredentials(
          (text, params) => pool.query(text, params),
          email,
          password,
        );
        return user;
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  callbacks: {
    jwt: jwtCallback as any,
    session: sessionCallback as any,
  },
});
