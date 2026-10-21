export function parseFeatures(raw: string | null): string[] {
  if (!raw) return [];
  if (raw.trim().startsWith("[")) {
    try { const values: unknown = JSON.parse(raw); return Array.isArray(values) ? values.filter((v): v is string => typeof v === "string") : []; } catch { return []; }
  }
  return raw.split("\n").map(v => v.trim()).filter(Boolean);
}
