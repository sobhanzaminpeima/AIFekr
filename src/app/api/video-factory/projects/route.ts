import { NextRequest, NextResponse } from "next/server";
import { boundedJson, factoryRoute } from "@/lib/video-factory/http";
import { createProject, listProjects } from "@/lib/video-factory/service";
export const dynamic = "force-dynamic";
export function GET(req: NextRequest) {
  const page = Math.max(0, Math.min(10000, Number(req.nextUrl.searchParams.get("page")) || 0));
  return factoryRoute(req, false, async id => NextResponse.json({ projects: await listProjects(id, Math.floor(page)) }));
}
export function POST(req: NextRequest) { return factoryRoute(req, false, async id => NextResponse.json({ project: await createProject(id, await boundedJson(req)) }, { status: 201 })); }
