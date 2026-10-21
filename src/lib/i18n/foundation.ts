/** Foundation copy is ready for all three locales. Legacy pages migrate separately. */
export type UiLocale = "fa" | "en" | "de";

export const foundationCopy = {
  fa: {
    loading: "در حال بارگذاری…",
    light: "روشن", dark: "تیره", switchToLight: "تغییر به تم روشن", switchToDark: "تغییر به تم تیره",
    language: "تغییر زبان", switchToEnglish: "تغییر زبان به انگلیسی", switchToPersian: "تغییر زبان به فارسی",
  },
  en: {
    loading: "Loading…",
    light: "Light", dark: "Dark", switchToLight: "Switch to light theme", switchToDark: "Switch to dark theme",
    language: "Change language", switchToEnglish: "Switch to English", switchToPersian: "Switch to Persian",
  },
  de: {
    loading: "Wird geladen…",
    light: "Hell", dark: "Dunkel", switchToLight: "Zum hellen Design wechseln", switchToDark: "Zum dunklen Design wechseln",
    language: "Sprache ändern", switchToEnglish: "Zu Englisch wechseln", switchToPersian: "Zu Persisch wechseln",
  },
} satisfies Record<UiLocale, Record<string, string>>;
