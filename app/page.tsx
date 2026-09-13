export const dynamic = "force-dynamic";

// Runtime branch (see app/api/workspace/route.ts for the dispatch
// reasoning) between the Sakura VPS (Auth.js) and OpenAI Sites
// (ChatGPT headers) paths.
export default async function Home() {
  const { default: Workspace } = await import("./workspace");
  if (process.env.DATABASE_URL) {
    const { vpsSessionUser } = await import("@/lib/vps-session");
    const user = await vpsSessionUser();
    if (!user) {
      const { default: LoginScreenVps } = await import("./login-screen-vps");
      return <LoginScreenVps redirectTo="/" />;
    }
    return <Workspace authMode="vps" />;
  }
  const { getChatGPTUser } = await import("./chatgpt-auth");
  const user = await getChatGPTUser();
  if (!user) {
    const { default: LoginScreen } = await import("./login-screen");
    return <LoginScreen />;
  }
  return <Workspace />;
}
