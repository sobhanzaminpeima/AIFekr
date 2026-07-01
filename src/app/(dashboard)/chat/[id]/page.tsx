import ChatInterface from "@/components/chat/ChatInterface";

export default function ChatConversationPage({ params }: { params: { id: string } }) {
  return <ChatInterface conversationId={params.id} />;
}
