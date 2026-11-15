import { prisma } from "@/lib/db/prisma";
import { notify } from "@/lib/notifications/create";

/**
 * Long-job experience (roadmap E15), outside the factory pipeline: a finished
 * or failed Video Factory job tells its owner once, with a link back to the
 * project, so closing the tab never loses the result. It only reads job rows;
 * the pipeline itself is untouched. The link doubles as the "already told"
 * marker, so running it again never repeats a notification.
 */
const WINDOW_MS = 7 * 864e5;

export const factoryLink = (projectId: string, jobId: string) => `/video-factory?project=${encodeURIComponent(projectId)}&job=${encodeURIComponent(jobId)}`;

export function finishedMessage(status: string, title: string) {
  return status === "COMPLETED"
    ? { title: "ویدیوی شما آماده شد", body: `«${title}» ساخته شد و در کتابخانه و پروژه‌اش در دسترس است.` }
    : { title: "ساخت ویدیو کامل نشد", body: `ساخت «${title}» متوقف شد؛ کردیت مصرف‌نشده طبق قواعد برمی‌گردد. جزئیات در پروژه است.` };
}

export async function notifyFinishedFactoryJobs(userId?: string, now = Date.now()): Promise<number> {
  const jobs = await prisma.videoFactoryJob.findMany({
    where: { status: { in: ["COMPLETED", "FAILED"] }, updatedAt: { gte: new Date(now - WINDOW_MS) }, ...(userId ? { userId } : {}) },
    select: { id: true, projectId: true, userId: true, status: true },
    take: 200,
  });
  if (!jobs.length) return 0;
  const links = jobs.map((j) => factoryLink(j.projectId, j.id));
  const told = new Set((await prisma.notification.findMany({ where: { link: { in: links } }, select: { link: true } })).map((n) => n.link));
  const projects = new Map((await prisma.videoFactoryProject.findMany({ where: { id: { in: [...new Set(jobs.map((j) => j.projectId))] } }, select: { id: true, title: true } })).map((p) => [p.id, p.title]));
  let sent = 0;
  for (const job of jobs) {
    const link = factoryLink(job.projectId, job.id);
    if (told.has(link)) continue;
    const msg = finishedMessage(job.status, projects.get(job.projectId) ?? "Video");
    await notify(job.userId, { type: "video_factory", title: msg.title, body: msg.body, link });
    sent++;
  }
  return sent;
}
