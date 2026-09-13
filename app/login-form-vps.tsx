"use client";
import { useState } from "react";
import { ArrowRight } from "lucide-react";

// Plain fetch() to NextAuth's own REST endpoint instead of a Server
// Action (`"use server"` + useActionState) — the server action wired
// up fine server-side (correct RSC payload, correct hidden $ACTION_*
// fields) but never actually fired a request when submitted for real
// in a browser under vinext (no network request, no console error, no
// pending state — confirmed via DevTools). This bypasses whatever
// that incompatibility is; the same /api/auth/callback/credentials
// flow is independently verified working via curl.
export default function LoginFormVps({ redirectTo }: { redirectTo: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setPending(true);
    try {
      const csrfRes = await fetch("/api/auth/csrf");
      const { csrfToken } = (await csrfRes.json()) as { csrfToken: string };
      // redirect: "manual" — the server's redirect target can come back
      // with the wrong protocol behind a reverse proxy/tunnel (a
      // separate, unresolved issue with this framework's protocol
      // detection); letting fetch() auto-follow it throws instead of
      // resolving. We don't need the redirect itself: checking
      // /api/auth/session afterward is a reliable, protocol-agnostic
      // way to confirm whether the credentials were accepted.
      await fetch("/api/auth/callback/credentials", {
        method: "POST",
        redirect: "manual",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ email, password, csrfToken, json: "true" }),
      });
      const sessionRes = await fetch("/api/auth/session");
      const session = (await sessionRes.json().catch(() => null)) as { user?: unknown } | null;
      if (session?.user) {
        window.location.href = redirectTo;
        return;
      }
      setError("メールアドレスまたはパスワードが違います");
    } catch {
      setError("通信に失敗しました。再度お試しください。");
    } finally {
      setPending(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="login-form">
      <input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        type="email"
        required
        autoComplete="email"
        placeholder="メールアドレス"
        className="login-input"
      />
      <input
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        type="password"
        required
        autoComplete="current-password"
        placeholder="パスワード"
        className="login-input"
      />
      {error && <p className="login-error">{error}</p>}
      <button type="submit" className="login-primary" disabled={pending}>
        {pending ? "ログイン中…" : "ログインする"} <ArrowRight size={18} />
      </button>
    </form>
  );
}
