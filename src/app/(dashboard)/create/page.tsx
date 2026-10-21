import { redirect } from "next/navigation";

/**
 * The Creative Studio was a second composer that duplicated the chat's own.
 * Image/video/music are tabs on the main chat now, so this URL only exists to
 * carry old links and bookmarks over to where the feature actually lives.
 */
export default function CreatePage() {
  redirect("/chat");
}
