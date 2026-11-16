import type { Configuration, Manifest } from "./domain";
import { styleText } from "./visualStyle";

/** One source for provider prompts, copy buttons and Flow prompt exports. */
export function scenePrompt(manifest: Manifest, configuration: Configuration, chapterIndex: number, shot: Manifest["chapters"][number]["shots"][number]) {
  const characters = manifest.characters.map(c => `${c.name}: ${c.description}`).join("; ");
  if (!configuration.sceneGrounding) return `${shot.visualPrompt}\nStyle and continuity: ${styleText(configuration)}\nVisual revision: ${shot.revision || 0}\nCharacter reference: ${characters}`;
  return [
    "Illustrate this exact moment in the narrated story. Depict its action, people, objects and setting; use the narration to resolve any conflicting visual directions. Do not put the narration on screen as text.",
    `Chapter: ${manifest.chapters[chapterIndex].title.slice(0,100)}. Scene: ${shot.title.slice(0,100)}.`,
    `Narration for this scene: ${shot.narration.trim().slice(0,650)}`,
    `Visual style: ${styleText(configuration).slice(0,300)}`,
    `Character continuity: ${characters.slice(0,200)}`,
    `Visual direction: ${shot.visualPrompt.slice(0,450)}`,
    `Visual revision: ${shot.revision || 0}`,
  ].join("\n");
}
