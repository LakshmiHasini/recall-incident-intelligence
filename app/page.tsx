import Workspace from "../components/workspace";
import { getChatGPTUser } from "./chatgpt-auth";
export const dynamic = "force-dynamic";
export default async function Home() { const user = await getChatGPTUser(); const local = process.env.NODE_ENV === "development"; return <Workspace displayName={user?.displayName || (local ? "Local workspace" : "Guest")} guest={!user && !local}/>; }
