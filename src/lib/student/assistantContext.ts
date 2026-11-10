/**
 * How the student assistants combine a student's request with their course
 * materials. Production 2026-11-09: a one-line question to the homework
 * assistant came back as a summary of the student's own uploaded marketing
 * brief, and was charged: the material sat in front of the question and the
 * instruction said "explain the assignment brief", so the model answered the
 * material. The request is the task; the materials are optional background.
 */
export function studyRequestMessage(task: string, reference: string, request: string) {
  return `${task}

The student's request at the end of this message is the task. The reference material is optional background: use it only where it is relevant to that request. If it is about something else, ignore it completely, answer the request directly, and do not describe or summarise the material.

${reference}

Student's request (this is what you must answer; respect its format and length):
${request.trim()}`;
}

/** Words that say nothing about a topic ("explain in two sentences"). */
const GENERIC = new Set([
  "چیست", "چیه", "چرا", "چطور", "چگونه", "کدام", "است", "هست", "هستند", "این", "آن", "برای", "درباره", "دربارهٔ", "لطفا", "توضیح", "جمله", "بده", "بدهید", "بگو", "بنویس", "کن", "کنید", "یعنی", "مثال",
  "what", "why", "how", "which", "the", "and", "for", "with", "about", "please", "explain", "describe", "write", "give", "sentence", "sentences", "this", "that", "was", "wie", "und", "der", "die", "das", "nedir", "neden", "nasıl", "için", "bir",
]);

function topicWords(text: string) {
  const normal = text.toLowerCase().replace(/[يى]/g, "ی").replace(/ك/g, "ک").replace(/‌/g, "");
  return new Set((normal.match(/[\p{L}\p{N}]{3,}/gu) ?? []).filter((w) => !GENERIC.has(w)));
}
/** Same word, allowing a suffix: "بازاریابی" also matches "بازاریابیها". */
const sameWord = (a: string, b: string) => a === b || (Math.min(a.length, b.length) >= 4 && (a.startsWith(b) || b.startsWith(a)));
const shared = (words: Set<string>, other: Set<string>) => [...words].filter((w) => [...other].some((o) => sameWord(w, o))).length;

/**
 * True only for the failure above: the answer shares no topic word with the
 * request but does repeat the materials. Deliberately conservative, since a
 * false alarm costs the student a retry: without materials, or when any topic
 * word of the request appears in the answer, it never fires.
 */
export function answeredMaterialsInstead(request: string, answer: string, materials: string[]) {
  const asked = topicWords(request);
  if (!asked.size || !materials.length) return false;
  const said = topicWords(answer);
  if (shared(asked, said) > 0) return false;
  const fromMaterials = new Set([...topicWords(materials.join("\n"))].filter((w) => !asked.has(w)));
  return shared(said, fromMaterials) >= 2;
}
