import Workspace from "../../components/workspace";
import { getChatGPTUser, requireChatGPTUser } from "../chatgpt-auth";
export const dynamic = "force-dynamic";
export default async function WorkspacePage() {
  const local = process.env.NODE_ENV === "development";
  const user = local ? await getChatGPTUser() : await requireChatGPTUser("/workspace");
  return <Workspace displayName={user?.displayName || "Local workspace"}/>;
}
