import { seoRequestSchema } from "./provider";

export function rankObservation(job: { id: string; input: string; result: string | null; completedAt: Date | null; createdAt: Date }, hostname: string) {
  try {
    const input = seoRequestSchema.parse(JSON.parse(job.input));
    if (input.action !== "rank" || !job.result) return null;
    const rows: unknown = JSON.parse(job.result);
    if (!Array.isArray(rows)) return null;
    const domain = hostname.toLowerCase().replace(/^www\./, "");
    const matches = rows.filter(row => {
      if (!row || row.type !== "organic" || typeof row.domain !== "string") return false;
      const found = row.domain.toLowerCase().replace(/^www\./, "");
      return (found === domain || found.endsWith(`.${domain}`)) && Number.isInteger(row.rank_absolute) && row.rank_absolute > 0;
    });
    return { id: job.id, keyword: input.keyword, locationCode: input.locationCode, languageCode: input.languageCode, device: input.device, position: matches.length ? Math.min(...matches.map(row => row.rank_absolute as number)) : null, checkedAt: (job.completedAt || job.createdAt).toISOString(), depth: 10 };
  } catch { return null; }
}

/** Prevent spreadsheet formulas in user-controlled exported cells. */
export function csvCell(value: string | number | null) {
  let text = value === null ? "" : String(value);
  if (/^[\s]*[=+@-]/.test(text)) text = "'" + text;
  return `"${text.replace(/"/g, '""')}"`;
}
