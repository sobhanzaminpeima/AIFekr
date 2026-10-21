/**
 * The lead form's field model. The set of fields is FIXED (name / phone /
 * email / company / message) — the tenant only toggles visibility and
 * required-ness. Keeping it fixed means the public endpoint can validate
 * strictly and every submission maps cleanly onto a CrmContact without a
 * per-form schema.
 */
export const LEAD_FIELD_KEYS = ["name", "phone", "email", "company", "message"] as const;
export type LeadFieldKey = (typeof LEAD_FIELD_KEYS)[number];

export interface LeadFieldConfig {
  show: boolean;
  required: boolean;
}
export type LeadFieldsConfig = Record<LeadFieldKey, LeadFieldConfig>;

export const DEFAULT_FIELDS: LeadFieldsConfig = {
  name: { show: true, required: true },
  phone: { show: true, required: true },
  email: { show: true, required: false },
  company: { show: false, required: false },
  message: { show: true, required: false },
};

export function parseFields(json: string | null | undefined): LeadFieldsConfig {
  let raw: Record<string, unknown> = {};
  try {
    raw = json ? (JSON.parse(json) as Record<string, unknown>) : {};
  } catch {
    raw = {};
  }
  const out = {} as LeadFieldsConfig;
  for (const key of LEAD_FIELD_KEYS) {
    const entry = (raw[key] ?? {}) as Partial<LeadFieldConfig>;
    const fallback = DEFAULT_FIELDS[key];
    out[key] = {
      show: typeof entry.show === "boolean" ? entry.show : fallback.show,
      required: typeof entry.required === "boolean" ? entry.required : fallback.required,
    };
    // "required" only makes sense for a shown field.
    if (!out[key].show) out[key].required = false;
  }
  // name is always needed to make a usable contact.
  out.name.show = true;
  return out;
}

export function serializeFields(cfg: LeadFieldsConfig): string {
  return JSON.stringify(cfg);
}

export const FIELD_LABELS: Record<LeadFieldKey, { fa: string; en: string; de: string }> = {
  name: { fa: "نام", en: "Name", de: "Name" },
  phone: { fa: "شماره تماس", en: "Phone", de: "Telefon" },
  email: { fa: "ایمیل", en: "Email", de: "E-Mail" },
  company: { fa: "شرکت", en: "Company", de: "Unternehmen" },
  message: { fa: "پیام", en: "Message", de: "Nachricht" },
};
