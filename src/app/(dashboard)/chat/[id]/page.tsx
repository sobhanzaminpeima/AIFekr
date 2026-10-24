import ChatInterface from "@/components/chat/ChatInterface";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth/jwt";
import { prisma } from "@/lib/db/prisma";
import { redirect } from "next/navigation";

export default async function ChatConversationPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const token = (await cookies()).get("token")?.value;
  const user = token ? verifyToken(token) : null;
  const conversation = user ? await prisma.conversation.findFirst({ where: { id: params.id, userId: user.userId }, select: { tool: true } }) : null;
  if (conversation?.tool?.startsWith("student:")) {
    const courseId = conversation.tool.slice(8);
    redirect(`/student/chat?conversationId=${encodeURIComponent(params.id)}${courseId ? `&courseId=${encodeURIComponent(courseId)}` : ""}`);
  }
  return <ChatInterface conversationId={params.id} />;
}
