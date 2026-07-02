export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { randomUUID } from "crypto";

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  try {
    const projects = await (prisma as any).$queryRaw`
      SELECT p.id, p.name, p.description, p.color, p.icon, p.createdAt,
             CAST(COUNT(c.id) AS INTEGER) as conversationCount
      FROM Project p
      LEFT JOIN Conversation c ON c.projectId = p.id
      WHERE p.userId = ${user.id}
      GROUP BY p.id
      ORDER BY p.createdAt DESC
    `;
    // Convert any BigInt to Number for JSON serialization
    const safe = (projects || []).map((p: any) => ({
      ...p,
      conversationCount: typeof p.conversationCount === "bigint"
        ? Number(p.conversationCount)
        : (p.conversationCount || 0),
    }));
    return NextResponse.json({ projects: safe });
  } catch (e) {
    console.error("projects GET error:", e);
    return NextResponse.json({ projects: [] });
  }
}

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  try {
    const { name, description, color = "#ea580c", icon = "folder" } = await req.json();
    if (!name?.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 });

    const id = randomUUID();
    const now = new Date().toISOString();

    await (prisma as any).$executeRaw`
      INSERT INTO Project (id, userId, name, description, color, icon, createdAt, updatedAt)
      VALUES (${id}, ${user.id}, ${name.trim()}, ${description || null}, ${color}, ${icon}, ${now}, ${now})
    `;

    return NextResponse.json({ project: { id, name: name.trim(), description, color, icon, conversationCount: 0 } });
  } catch (e) {
    console.error("projects POST error:", e);
    return NextResponse.json({ error: "Failed to create project" }, { status: 500 });
  }
}