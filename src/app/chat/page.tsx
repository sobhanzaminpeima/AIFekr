import type { Metadata } from "next";
import { chatPolicy } from "@/lib/ai-chat/policy";
import ChatStudio from "@/components/ai-chat/ChatStudio";
import ChatInterface from "@/components/chat/ChatInterface";
import { renderPlatformShell } from "@/components/layout/PlatformShell";
import {cookies} from "next/headers";
import {verifyToken} from "@/lib/auth/jwt";
import {prisma} from "@/lib/db/prisma";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "AIFekr AI Chat",
  description:
    "Independent AI chat powered by AI models. Ask questions, write, learn and explore ideas.",
};
export default async function Page() {
  const policy = await chatPolicy();
  if (!policy.enabled) return renderPlatformShell(<ChatInterface />);
  const token=cookies().get("token")?.value,payload=token?verifyToken(token):null;
  if(payload){const user=await prisma.user.findUnique({where:{id:payload.userId},select:{chatOnly:true,isBlocked:true}});if(user&&!user.chatOnly&&!user.isBlocked)return renderPlatformShell(<ChatInterface/>);}
  return <ChatStudio />;
}
