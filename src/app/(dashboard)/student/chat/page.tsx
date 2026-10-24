import StudentTutorChat from "@/components/student/StudentTutorChat";

export default async function StudentChatPage(
  props: { searchParams: Promise<{ courseId?: string; conversationId?: string }> }
) {
  const searchParams = await props.searchParams;
  return <StudentTutorChat courseId={searchParams.courseId} conversationId={searchParams.conversationId} />;
}
