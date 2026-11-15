import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ jobs: vi.fn(), notes: vi.fn(), projects: vi.fn(), notify: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { videoFactoryJob: { findMany: m.jobs }, notification: { findMany: m.notes }, videoFactoryProject: { findMany: m.projects } } }));
vi.mock("@/lib/notifications/create", () => ({ notify: m.notify }));
import { factoryLink, notifyFinishedFactoryJobs } from "./finished";

beforeEach(() => {
  vi.clearAllMocks();
  m.jobs.mockResolvedValue([{ id: "j1", projectId: "p1", userId: "u1", status: "COMPLETED" }, { id: "j2", projectId: "p2", userId: "u1", status: "FAILED" }]);
  m.projects.mockResolvedValue([{ id: "p1", title: "Launch film" }, { id: "p2", title: "Promo" }]);
  m.notify.mockResolvedValue(undefined);
});

describe("finished Video Factory jobs", () => {
  it("tells the owner once per finished or failed job, with a link back to the project", async () => {
    m.notes.mockResolvedValue([]);
    expect(await notifyFinishedFactoryJobs("u1")).toBe(2);
    expect(m.notify.mock.calls[0]).toEqual(["u1", expect.objectContaining({ type: "video_factory", link: factoryLink("p1", "j1"), title: "ویدیوی شما آماده شد" })]);
    expect(m.notify.mock.calls[1][1].title).toBe("ساخت ویدیو کامل نشد");
    expect(m.jobs.mock.calls[0][0].where.userId).toBe("u1");
  });
  it("never repeats a notification already sent", async () => {
    m.notes.mockResolvedValue([{ link: factoryLink("p1", "j1") }]);
    expect(await notifyFinishedFactoryJobs()).toBe(1);
    expect(m.notify.mock.calls[0][1].link).toBe(factoryLink("p2", "j2"));
  });
  it("does nothing without finished jobs", async () => {
    m.jobs.mockResolvedValue([]);
    expect(await notifyFinishedFactoryJobs("u1")).toBe(0);
    expect(m.notes).not.toHaveBeenCalled();
  });
});
