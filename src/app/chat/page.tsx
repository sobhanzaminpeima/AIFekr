import type { Metadata } from "next";
import { chatPolicy } from "@/lib/ai-chat/policy";
import ChatStudio from "@/components/ai-chat/ChatStudio";
import ChatInterface from "@/components/chat/ChatInterface";
import { renderPlatformShell } from "@/components/layout/PlatformShell";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "AIFekr AI Chat",
  description:
    "Independent AI chat powered by AI models. Ask questions, write, learn and explore ideas.",
};
export default async function Page() {
  const policy = await chatPolicy();
  if (!policy.enabled) return renderPlatformShell(<ChatInterface />);
  return <ChatStudio />;
}
