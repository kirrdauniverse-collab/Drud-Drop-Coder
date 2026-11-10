import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/projects/[id] – egy projekt teljes tartalma
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const project = await db.savedProject.findUnique({ where: { id } });
    if (!project) {
      return NextResponse.json({ error: "Nem található" }, { status: 404 });
    }
    return NextResponse.json({ project: { id: project.id, name: project.name, data: JSON.parse(project.data) } });
  } catch {
    return NextResponse.json({ error: "Szerverhiba" }, { status: 500 });
  }
}

// DELETE /api/projects/[id] – projekt törlése
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    await db.savedProject.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Törlés nem sikerült" }, { status: 500 });
  }
}
