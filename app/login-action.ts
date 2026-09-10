"use server";
import { AuthError } from "next-auth";
import { signIn } from "@/lib/auth";

export type LoginState = { error?: string };

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: "/",
    });
  } catch (e) {
    if (e instanceof AuthError) return { error: "メールアドレスまたはパスワードが違います" };
    throw e; // NEXT_REDIRECT on success — must propagate, not be caught here
  }
  return {};
}
