import StudentTutorChat from "@/components/student/StudentTutorChat";

export default function StudentChatPage({ searchParams }: { searchParams: { courseId?: string } }) {
  return <StudentTutorChat courseId={searchParams.courseId} />;
}
