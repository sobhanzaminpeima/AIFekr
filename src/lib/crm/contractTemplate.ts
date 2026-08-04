/** Replaces {{key}} placeholders in a contract template with real values. Unknown keys are left as-is rather than silently dropped, so a typo in a template is visible instead of producing blank text. */
export function interpolateTemplate(content: string, values: Record<string, string>): string {
  return content.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key: string) => (key in values ? values[key] : match));
}
