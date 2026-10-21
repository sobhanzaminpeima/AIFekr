"use client";

import ReactMarkdown from "react-markdown";

export default function StudyAnswer({ children }: { children: string }) {
  return <div className="text-sm leading-7 break-words space-y-3 [&_h1]:text-lg [&_h2]:text-base [&_h3]:text-base [&_h1]:font-bold [&_h2]:font-bold [&_h3]:font-bold [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:ps-5 [&_ol]:ps-5 [&_blockquote]:border-s-2 [&_blockquote]:ps-3 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:p-3 [&_a]:text-orange-500"><ReactMarkdown>{children}</ReactMarkdown></div>;
}
