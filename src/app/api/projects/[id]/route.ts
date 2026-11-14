import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validateProjectData } from "@/lib/projectSchema";
import { hashOwnerToken, rateLimit, clientIp } from "@/lib/cloud-guard";

export const dynamic = "force-dynamic";

function fail(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

// GET /api/projects/[id] – egy projekt teljes tartalma (betöltés, megosztott linkhez)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const project = await db.savedProject.findUnique({ where: { id } });
    if (!project) {
      return fail(404, "not_found", "Nem található projekt ezzel az azonosítóval");
    }
    // Sérült tárolt JSON ne olassa el a klienst: parse-guard + szerkezeti ellenőrzés
    let data: unknown;
    try {
      data = JSON.parse(project.data);
    } catch {
      return fail(422, "corrupt_data", "A tárolt projekt JSON-ja sérült");
    }
    const validation = validateProjectData(data);
    if (!validation.ok) {
      return fail(422, "corrupt_data", `A tárolt projekt szerkezete érvénytelen (${validation.reason})`);
    }
    return NextResponse.json({ project: { id: project.id, name: project.name, data } });
  } catch (err) {
    console.error("GET /api/projects/[id] hiba:", err);
    return fail(500, "server_error", "Szerverhiba a betöltés közben");
  }
}

// DELETE /api/projects/[id] – projekt törlése (csak a tulajdonosi tokennel)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!rateLimit(`delete:${clientIp(req)}`, 30, 60_000)) {
    return fail(429, "rate_limited", "Túl sok kérés – próbáld újra egy perc múlva");
  }
  try {
    const { id } = await params;
    const existing = await db.savedProject.findUnique({ where: { id }, select: { id: true, ownerTokenHash: true } });
    if (!existing) {
      return fail(404, "not_found", "Nem található projekt ezzel az azonosítóval");
    }
    if (existing.ownerTokenHash) {
      const provided = req.headers.get("x-owner-token");
      if (!provided || hashOwnerToken(provided) !== existing.ownerTokenHash) {
        return fail(403, "forbidden", "Ehhez a projekthez nincs törlési jogosultságod");
      }
    }
    await db.savedProject.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/projects/[id] hiba:", err);
    return fail(500, "server_error", "Törlés nem sikerült");
  }
}
