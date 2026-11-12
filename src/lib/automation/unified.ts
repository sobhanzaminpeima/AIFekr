/**
 * One Automation Builder, first slice (roadmap E7): the three automation silos
 * (Instagram comment-to-DM campaigns, Instagram DM reply rules, CRM rules)
 * read as one list in a single trigger → condition → action shape. Editing
 * and pausing stay in each silo for now (`manageAt`); this is the shared model
 * the builder will write to later.
 */
export type AutomationKind = "instagram_comment" | "instagram_direct" | "crm";

export interface UnifiedAutomation {
  id: string;
  kind: AutomationKind;
  name: string;
  trigger: { type: string; keywords: string[] };
  condition: Record<string, unknown> | null;
  action: { type: string };
  active: boolean;
  runs: number | null;
  createdAt: string;
  manageAt: string;
}

const words = (v: string | null | undefined) => (v ?? "").split(/[,،\n]/).map((w) => w.trim()).filter(Boolean);
const json = (v: string | null | undefined): Record<string, unknown> | null => {
  if (!v) return null;
  try { const p = JSON.parse(v); return p && typeof p === "object" ? p : null; } catch { return null; }
};

export function fromCommentCampaign(c: { id: string; name: string; keyword: string; postId: string | null; followGateEnabled: boolean; publicReplyMessage: string | null; isActive: boolean; triggerCount: number; createdAt: Date }): UnifiedAutomation {
  return {
    id: c.id, kind: "instagram_comment", name: c.name || c.keyword,
    trigger: { type: "keyword_comment", keywords: words(c.keyword) },
    condition: { ...(c.postId ? { postId: c.postId } : {}), ...(c.followGateEnabled ? { followGate: true } : {}) },
    action: { type: c.publicReplyMessage ? "send_dm_and_reply" : "send_dm" },
    active: c.isActive, runs: c.triggerCount, createdAt: c.createdAt.toISOString(), manageAt: "/social?tab=campaigns",
  };
}

export function fromDirectRule(r: { id: string; name: string; triggerType: string; keywords: string; followGateEnabled: boolean; isActive: boolean; triggerCount: number; createdAt: Date }): UnifiedAutomation {
  return {
    id: r.id, kind: "instagram_direct", name: r.name,
    trigger: { type: r.triggerType === "keyword" ? "keyword_dm" : r.triggerType, keywords: r.triggerType === "keyword" ? words(r.keywords) : [] },
    condition: r.followGateEnabled ? { followGate: true } : null,
    action: { type: r.triggerType === "ai_fallback" ? "ai_reply" : "send_dm" },
    active: r.isActive, runs: r.triggerCount, createdAt: r.createdAt.toISOString(), manageAt: "/social?tab=direct-rules",
  };
}

export function fromCrmRule(r: { id: string; name: string; trigger: string; condition: string | null; action: string; isActive: boolean; createdAt: Date }): UnifiedAutomation {
  return {
    id: r.id, kind: "crm", name: r.name,
    trigger: { type: r.trigger, keywords: [] },
    condition: json(r.condition),
    action: { type: r.action },
    active: r.isActive, runs: null, createdAt: r.createdAt.toISOString(), manageAt: "/crm?tab=automation",
  };
}

export function unifyAutomations(input: { comment: Parameters<typeof fromCommentCampaign>[0][]; direct: Parameters<typeof fromDirectRule>[0][]; crm: Parameters<typeof fromCrmRule>[0][] }): UnifiedAutomation[] {
  return [...input.comment.map(fromCommentCampaign), ...input.direct.map(fromDirectRule), ...input.crm.map(fromCrmRule)]
    .sort((a, b) => Number(b.active) - Number(a.active) || b.createdAt.localeCompare(a.createdAt));
}
