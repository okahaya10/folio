"use client";
import { useActionState } from "react";
import { ArrowRight } from "lucide-react";
import { loginAction, type LoginState } from "./login-action";

const initialState: LoginState = {};

export default function LoginFormVps() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);
  return (
    <form action={formAction} className="login-form">
      <input
        name="email"
        type="email"
        required
        autoComplete="email"
        placeholder="メールアドレス"
        className="login-input"
      />
      <input
        name="password"
        type="password"
        required
        autoComplete="current-password"
        placeholder="パスワード"
        className="login-input"
      />
      {state.error && <p className="login-error">{state.error}</p>}
      <button type="submit" className="login-primary" disabled={pending}>
        {pending ? "ログイン中…" : "ログインする"} <ArrowRight size={18} />
      </button>
    </form>
  );
}
