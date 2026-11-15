import { prisma } from "@/lib/db/prisma";
import { manifestSchema, type Configuration, type Manifest, type Policy } from "./domain";
import { buildProductionPlan, fingerprint } from "./production";
export { RERENDER_BASE_SHARE, rerenderPrice } from "./rerenderPrice";

const MEDIA = ["IMAGE", "VIDEO", "TTS", "MUSIC"];
/** The share (0..1) of media that must be generated again, or null when this is a first production. */
export async function rerenderShare(userId: string, projectId: string, manifestJson: string, configuration: Configuration, policy: Policy): Promise<number | null> {
  if (configuration.mediaMode !== "MULTIMEDIA") return null;
  const delivered = await prisma.videoFactoryJob.findFirst({ where: { userId, projectId, status: "DELIVERED" }, select: { id: true } });
  if (!delivered) return null;
  let manifest: Manifest;
  // Parsed exactly as startProject does, so the plan (and its fingerprints) match the production.
  try { const parsed = manifestSchema.safeParse(JSON.parse(manifestJson)); if (!parsed.success) return null; manifest = parsed.data; } catch { return null; }
  const plan = buildProductionPlan(manifest, configuration, policy);
  const tasks = plan.tasks.filter((t) => MEDIA.includes(t.kind));
  if (!tasks.length) return 0;
  const providers = new Map((await prisma.videoFactoryProvider.findMany({ where: { id: { in: [...new Set(tasks.map((t) => t.providerId))] } }, select: { id: true, model: true, version: true } })).map((p) => [p.id, p]));
  let fresh = 0;
  for (const task of tasks) {
    const provider = providers.get(task.providerId);
    if (!provider) { fresh++; continue; }
    // Same effective fingerprint as mediaWorker's reuse lookup.
    const key = fingerprint({ task: task.fingerprint, provider: provider.id, model: provider.model, version: provider.version, dependency: task.kind === "TTS" ? plan.assetIds["clone-bed"] : null });
    const reusable = await prisma.videoFactoryAsset.count({ where: { userId, projectId, status: "READY", metadata: { contains: key }, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] } });
    if (!reusable) fresh++;
  }
  return fresh / tasks.length;
}
