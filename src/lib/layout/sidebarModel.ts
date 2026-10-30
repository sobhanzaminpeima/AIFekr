import type { Lang } from "@/lib/i18n/server";
import { destinations, destinationLabel } from "@/lib/navigation/destinations";

/** Every destination with its label, for the new design's search window (as the classic command palette lists them). */
export function sidebarModel(lang: Lang) {
  return { destinations: destinations.map((d) => ({ href: d[0] as string, label: destinationLabel(d, lang) })) };
}
