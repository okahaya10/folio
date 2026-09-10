import { getChatGPTUser } from "./chatgpt-auth";
import LoginScreen from "./login-screen";
import Workspace from "./workspace";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getChatGPTUser();
  return user ? <Workspace /> : <LoginScreen />;
}
