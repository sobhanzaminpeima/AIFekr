/**
 * Reads the classic CRM page's wording: every tri(lang, fa, en, de?, tr?) call
 * and every { fa, en, de?, tr? } label table. Template parts (${...}) become
 * named {placeholders}. crmCopy.test.ts uses it to keep the copy word for word.
 */
export type Four = readonly [string, string, string, string];

function placeholder(expr: string) {
  if (expr.trim().startsWith("new Date")) return "{time}";
  const head = expr.split("(")[0];
  const ids = head.match(/\w+/g) ?? ["value"];
  return `{${ids[ids.length - 1]}}`;
}

function readString(src: string, i: number): { value: string; end: number } | null {
  const q = src[i];
  if (q !== '"' && q !== "`") return null;
  let j = i + 1;
  let raw = "";
  while (src[j] !== q) {
    if (src[j] === "\\") { raw += src[j] + src[j + 1]; j += 2; continue; }
    if (q === "`" && src[j] === "$" && src[j + 1] === "{") {
      let depth = 1, k = j + 2;
      while (depth) { if (src[k] === "{") depth++; else if (src[k] === "}") depth--; k++; }
      raw += placeholder(src.slice(j + 2, k - 1));
      j = k;
      continue;
    }
    raw += src[j++];
  }
  const value = q === '"' ? JSON.parse('"' + raw + '"') : raw.replace(/\\(.)/g, "$1");
  return { value, end: j + 1 };
}

const four = (v: (string | undefined)[]): Four => [v[0]!, v[1]!, v[2] ?? v[1]!, v[3] ?? v[1]!];
const LABEL = /\{\s*fa:\s*"([^"]*)",\s*en:\s*"([^"]*)"(?:,\s*de:\s*"([^"]*)")?(?:,\s*tr:\s*"([^"]*)")?/;

/** The classic label tables (PROPERTY_TYPE_LABEL, viewing STATUS_LABEL, CURRENCY_OPTIONS...), by table and key. */
export function extractCrmLabels(src: string): Record<string, Record<string, Four>> {
  const out: Record<string, Record<string, Four>> = {};
  for (const m of src.matchAll(/const (\w+)(?::[^=]+)? = ([[{])\r?\n([\s\S]*?)\r?\n\s*[\]}];/g)) {
    const entries: Record<string, Four> = {};
    for (const line of m[3].split(/\r?\n/)) {
      const key = line.match(/^\s*(?:"([^"]+)"|(\w+)):\s*\{/) ?? line.match(/value:\s*"([^"]+)"/);
      const label = line.match(LABEL);
      if (key && label) entries[key[1] ?? key[2]] = four(label.slice(1, 5));
    }
    if (Object.keys(entries).length) out[m[1]] = entries;
  }
  return out;
}

/**
 * Every tri(<lang>, ...) string of a classic page, keyed by its English.
 * `calls` matches another helper's opening, e.g. /\bt\(/g for t(fa, en, de, tr).
 */
export function extractCrmStrings(src: string, calls: RegExp = /\btri\(\s*\w+\s*,/g): Four[] {
  const rows = new Map<string, Four>();
  const add = (v: string[]) => {
    if (!rows.has(v[1])) rows.set(v[1], four(v));
  };
  for (const call of src.matchAll(calls)) {
    let j = call.index! + call[0].length;
    const parts: string[] = [];
    for (;;) {
      while (/\s/.test(src[j])) j++;
      const r = readString(src, j);
      if (!r) { parts.length = 0; break; }
      parts.push(r.value);
      j = r.end;
      while (/\s/.test(src[j])) j++;
      if (src[j] === ",") { j++; continue; }
      if (src[j] !== ")") parts.length = 0;
      break;
    }
    if (parts.length >= 2) add(parts);
  }
  return [...rows.values()];
}

/**
 * The strings of several classic pages, keyed by English; when two pages word
 * the same English differently, the later wording is keyed "<English> · 2"
 * (then "· 3"...), so each page's own wording stays available verbatim.
 */
export function extractKeyedStrings(sources: string[], calls?: RegExp): [string, Four][] {
  const out: [string, Four][] = [];
  for (const row of sources.flatMap((src) => extractCrmStrings(src, calls))) {
    const same = out.filter(([, r]) => r[1] === row[1]);
    if (same.some(([, r]) => r.join("|") === row.join("|"))) continue;
    out.push([same.length ? `${row[1]} · ${same.length + 1}` : row[1], row]);
  }
  return out;
}
