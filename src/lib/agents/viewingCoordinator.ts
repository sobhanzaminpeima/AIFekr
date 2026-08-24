import { prisma } from "@/lib/db/prisma";

/**
 * Section 2, item 3 — Viewing Coordinator agent. Per the master spec:
 * booking/rescheduling a single slot may happen automatically (low risk),
 * but a final cancellation or any change touching multiple slots needs
 * human approval — this file only ever proposes/books ONE slot, never
 * touches other rows, and never cancels anything itself. If no free slot
 * can be found, it returns null so the caller warns the human and waits
 * for manual confirmation rather than booking something wrong.
 */

const CONFLICT_WINDOW_MS = 30 * 60 * 1000;
const SLOT_STEP_MS = 30 * 60 * 1000;
const SEARCH_WINDOW_MS = 4 * 60 * 60 * 1000; // scan up to 4 hours forward
const WORKING_HOUR_START = 9;
const WORKING_HOUR_END = 20;

async function hasConflict(workspaceUserId: string, assignedToId: string, time: Date, excludeViewingId?: string): Promise<boolean> {
  const conflict = await prisma.propertyViewing.findFirst({
    where: {
      userId: workspaceUserId,
      assignedToId,
      status: "scheduled",
      ...(excludeViewingId ? { id: { not: excludeViewingId } } : {}),
      scheduledAt: {
        gte: new Date(time.getTime() - CONFLICT_WINDOW_MS),
        lte: new Date(time.getTime() + CONFLICT_WINDOW_MS),
      },
    },
    select: { id: true },
  });
  return !!conflict;
}

export interface SlotSuggestion {
  scheduledAt: Date;
  /** true when the requested time was busy and this is a nearby alternative, not the exact time asked for. */
  wasRescheduled: boolean;
}

/**
 * Finds a bookable slot for the given agent at/near the requested time.
 * Returns null (never a guessed/possibly-wrong time) if nothing opens up
 * within the search window — the caller must then surface that to the
 * human instead of booking blind.
 */
export async function suggestViewingSlot(workspaceUserId: string, assignedToId: string, preferredTime: Date): Promise<SlotSuggestion | null> {
  if (!(await hasConflict(workspaceUserId, assignedToId, preferredTime))) {
    return { scheduledAt: preferredTime, wasRescheduled: false };
  }

  for (let offset = SLOT_STEP_MS; offset <= SEARCH_WINDOW_MS; offset += SLOT_STEP_MS) {
    const candidate = new Date(preferredTime.getTime() + offset);
    if (candidate.getHours() < WORKING_HOUR_START || candidate.getHours() >= WORKING_HOUR_END) continue;
    if (!(await hasConflict(workspaceUserId, assignedToId, candidate))) {
      return { scheduledAt: candidate, wasRescheduled: true };
    }
  }
  return null;
}

export interface FeedbackNeededViewing {
  id: string; scheduledAt: Date;
  property: { id: string; title: string };
  contact: { id: string; name: string } | null;
}

/**
 * Viewings whose scheduled time has already passed but were never marked
 * completed/cancelled and have no feedback logged — the "request/log
 * post-viewing feedback" half of this agent's job. Purely a read — nudging
 * happens in the UI, never an automated message to the customer (that
 * would need the same human-approval gate as everything else here).
 */
export async function listFeedbackNeeded(workspaceUserId: string, assignedToId?: string): Promise<FeedbackNeededViewing[]> {
  return prisma.propertyViewing.findMany({
    where: {
      userId: workspaceUserId,
      status: "scheduled",
      feedback: null,
      scheduledAt: { lt: new Date() },
      ...(assignedToId ? { assignedToId } : {}),
    },
    select: {
      id: true, scheduledAt: true,
      property: { select: { id: true, title: true } },
      contact: { select: { id: true, name: true } },
    },
    orderBy: { scheduledAt: "asc" },
    take: 50,
  });
}
