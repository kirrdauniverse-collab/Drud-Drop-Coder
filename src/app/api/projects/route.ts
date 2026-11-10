import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/projects – felhőprojektek listája
export async function GET() {
  try {
    const projects = await db.savedProject.findMany({
      orderBy: { updatedAt: "desc" },
      select: { id: true, name: true, updatedAt: true },
    });
    return NextResponse.json({ projects });
  } catch {
    return NextResponse.json({ projects: [] }, { status: 200 });
  }
}

// POST /api/projects – aktuális projekt mentése (upsert)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, name, data } = body as { id?: string; name?: string; data?: unknown };
    if (!name || typeof name !== "string" || !data || typeof data !== "object") {
      return NextResponse.json({ error: "Hiányzó vagy érvénytelen mezők" }, { status: 400 });
    }
    // Méretkorlát: a saját tartalmak (data URL-ek) miatt legfeljebb ~8 MB
    const serialized = JSON.stringify(data);
    if (serialized.length > 8 * 1024 * 1024) {
      return NextResponse.json({ error: "A projekt túl nagy a felhőmentéshez (max 8 MB)" }, { status: 413 });
    }
    let project;
    if (id) {
      project = await db.savedProject.upsert({
        where: { id },
        update: { name, data: serialized, updatedAt: new Date() },
        create: { name, data: serialized },
      });
    } else {
      project = await db.savedProject.create({ data: { name, data: serialized } });
    }
    return NextResponse.json({ project: { id: project.id, name: project.name, updatedAt: project.updatedAt } });
  } catch {
    return NextResponse.json({ error: "Szerverhiba a mentés közben" }, { status: 500 });
  }
}
