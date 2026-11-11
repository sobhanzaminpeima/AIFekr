/**
 * Global creation library, first slice (roadmap E1): one newest-first index of
 * what the account has made across modules, each item pointing to where it
 * opens. Bodies stay in their own module; this is the shared index.
 */
export type LibraryKind = "image" | "video" | "music" | "voice" | "seo" | "website";

export interface LibraryItem {
  kind: LibraryKind;
  id: string;
  title: string;
  createdAt: string;
  openAt: string;
}

const short = (v: string | null | undefined, max = 120) => (v ?? "").replace(/\s+/g, " ").trim().slice(0, max);

export function libraryIndex(input: {
  images: { id: string; prompt: string; createdAt: Date }[];
  videos: { id: string; prompt: string; createdAt: Date }[];
  music: { id: string; prompt: string; createdAt: Date }[];
  voice: { id: string; text: string; createdAt: Date }[];
  seo: { id: string; tool: string; keyword: string | null; url: string | null; createdAt: Date }[];
  websites: { id: string; businessName: string; createdAt: Date }[];
}, limit = 60): LibraryItem[] {
  const items: LibraryItem[] = [
    ...input.images.map((r) => ({ kind: "image" as const, id: r.id, title: short(r.prompt), createdAt: r.createdAt.toISOString(), openAt: "/image/gallery" })),
    ...input.videos.map((r) => ({ kind: "video" as const, id: r.id, title: short(r.prompt), createdAt: r.createdAt.toISOString(), openAt: "/gallery?type=video" })),
    ...input.music.map((r) => ({ kind: "music" as const, id: r.id, title: short(r.prompt), createdAt: r.createdAt.toISOString(), openAt: "/gallery?type=music" })),
    ...input.voice.map((r) => ({ kind: "voice" as const, id: r.id, title: short(r.text), createdAt: r.createdAt.toISOString(), openAt: "/voice-studio?tab=library" })),
    ...input.seo.map((r) => ({ kind: "seo" as const, id: r.id, title: short(r.keyword || r.url || r.tool), createdAt: r.createdAt.toISOString(), openAt: "/seo?tab=posts" })),
    ...input.websites.map((r) => ({ kind: "website" as const, id: r.id, title: short(r.businessName), createdAt: r.createdAt.toISOString(), openAt: "/website-designer" })),
  ];
  return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
}
