import type { Lang } from "@/lib/i18n/server";
import { DEPARTMENTS as TEAM_DEPARTMENTS, type DepartmentKey } from "@/lib/team/identity";
import { moduleKeyForPath } from "@/lib/modules/moduleRoutes";
import { destinations, destinationLabel, findDestination } from "@/lib/navigation/destinations";
import { findModuleGuide } from "@/lib/navigation/moduleGuides";
import { WORKSPACES, DEFAULT_TILES } from "@/lib/navigation/workspaces";
import { text } from "@/lib/marketing/catalog";
import en from "@/lib/i18n/en";

type NavKey = keyof typeof en.nav;

/**
 * The classic sidebar's business departments (components/layout/Sidebar
 * DEPARTMENTS): the same destinations in the same order. sidebarModel.test.ts
 * checks them against the classic source.
 */
export const SIDEBAR_DEPARTMENTS: { key: DepartmentKey; items: [href: string, label: NavKey][] }[] = [
  { key: "sales", items: [["/crm", "crm"], ["/sales", "salesAgent"], ["/voice-agent", "voiceAgent"], ["/industry", "industryPacks"]] },
  { key: "marketing", items: [["/social", "socialMedia"], ["/lead-gen", "leadGen"], ["/seo", "seoWorkspace"], ["/website-designer", "websiteDesigner"]] },
  { key: "finance", items: [["/accounting", "accounting"]] },
  { key: "strategy", items: [["/ceo", "ceoAdvisor"], ["/business-doctor", "businessDoctor"], ["/meeting", "meetingRoom"]] },
];

/** Navigation data the new design's frame needs, localized; module keys let it hide what an admin switched off. */
export function sidebarModel(lang: Lang, nav: typeof en.nav, path: string) {
  const ws = (pair: readonly [string, string]) => pair[lang === "fa" ? 0 : 1];
  const guide = findModuleGuide(path);
  const here = findDestination(path);
  return {
    departments: SIDEBAR_DEPARTMENTS.map((d) => ({
      key: d.key,
      color: TEAM_DEPARTMENTS[d.key].color,
      tint: TEAM_DEPARTMENTS[d.key].tint,
      label: TEAM_DEPARTMENTS[d.key].label(lang),
      items: d.items.map(([href, key]) => ({ href, label: nav[key], moduleKey: moduleKeyForPath(href) })),
    })),
    moduleKeys: Object.fromEntries(["/chat", "/student", "/fitness", "/agents", "/image/gallery", "/video-factory", "/voice-studio", "/play", "/startup/builder", "/seo/intelligence", "/business-doctor", "/home"].map((href) => [href, moduleKeyForPath(href)])),
    destinations: destinations.map((d) => ({ href: d[0] as string, label: destinationLabel(d, lang) })),
    pageLabel: here ? destinationLabel(here, lang) : null,
    guide: guide && guide.path !== "/ceo" ? { purpose: text(lang, guide.purpose), links: guide.links.map((href) => { const d = findDestination(href); return { href, label: d ? destinationLabel(d, lang) : href }; }) } : null,
    workspaces: WORKSPACES.map((w) => ({
      id: w.id, name: ws(w.name), tagline: ws(w.tagline), tiles: w.tiles,
      start: { href: w.start.href, label: ws(w.start.label) },
      groups: w.groups.map((g) => ({ title: ws(g.title), hrefs: g.hrefs })),
    })),
    defaultTiles: DEFAULT_TILES,
  };
}
