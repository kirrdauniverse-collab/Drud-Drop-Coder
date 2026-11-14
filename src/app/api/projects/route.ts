import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validateProjectData, MAX_CLOUD_BYTES } from "@/lib/projectSchema";
import { generateOwnerToken, hashOwnerToken, ownerTokenFrom, rateLimit, clientIp } from "@/lib/cloud-guard";

export const dynamic = "force-dynamic";

const ID_RE = /^[a-zA-Z0-9_-]{8,64}$/;

// Egységes hibaválasz: { error: { code, message } } – a kliens toastja ezt jeleníti meg
function fail(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

// GET /api/projects – felhőprojektek listája (címek, nem tartalmak)
export async function GET() {
  try {
    const projects = await db.savedProject.findMany({
      orderBy: { updatedAt: "desc" },
      select: { id: true, name: true, updatedAt: true },
    });
    return NextResponse.json({ projects });
  } catch (err) {
    console.error("GET /api/projects hiba:", err);
    return fail(500, "db_error", "A projektlista most nem elérhető");
  }
}

// POST /api/projects – aktuális projekt mentése (upsert)
// Tulajdonosi védelem: ha a projektnek van tárolt tokene, csak ugyanazzal a tokennel
// írható felül. Régi (token nélküli) projekteknél az első új mentés generál egyet.
export async function POST(req: NextRequest) {
  if (!rateLimit(`save:${clientIp(req)}`, 30, 60_000)) {
    return fail(429, "rate_limited", "Túl sok mentés rövid időn belül – próbáld újra egy perc múlva");
  }
  try {
    const body = await req.json();
    const rawName = typeof body?.name === "string" ? body.name.trim() : "";
    const name = (rawName || "Névtelen projekt").slice(0, 80);
    const id = typeof body?.id === "string" && ID_RE.test(body.id) ? body.id : undefined;
    const providedToken = ownerTokenFrom(req, body);

    // Szigorú szerkezeti validáció – a mérgezett/hibás JSON nem kerülhet be
    const validation = validateProjectData(body?.data);
    if (!validation.ok) {
      return fail(400, "invalid_project", `A projekt adatszerkezete érvénytelen (${validation.reason})`);
    }
    const serialized = JSON.stringify(body.data);
    if (serialized.length > MAX_CLOUD_BYTES) {
      return fail(413, "too_large", "A projekt túl nagy a felhőmentéshez (max 8 MB)");
    }

    if (id) {
      const existing = await db.savedProject.findUnique({ where: { id } });
      if (existing) {
        if (existing.ownerTokenHash) {
          if (!providedToken || hashOwnerToken(providedToken) !== existing.ownerTokenHash) {
            return fail(403, "forbidden", "Ehhez a projekthez nincs mentési jogosultságod – töltsd be új néven");
          }
        }
        const ownerToken = providedToken ?? generateOwnerToken();
        await db.savedProject.update({
          where: { id },
          data: { name, data: serialized, ownerTokenHash: hashOwnerToken(ownerToken), updatedAt: new Date() },
        });
        return NextResponse.json({ project: { id, name, updatedAt: new Date() }, ownerToken });
      }
    }

    // Új projekt létrehozása (a kliens id-ja csak érvényes formátum esetén él)
    const ownerToken = providedToken ?? generateOwnerToken();
    const project = await db.savedProject.create({
      data: id ? { id, name, data: serialized, ownerTokenHash: hashOwnerToken(ownerToken) } : { name, data: serialized, ownerTokenHash: hashOwnerToken(ownerToken) },
    });
    return NextResponse.json({
      project: { id: project.id, name: project.name, updatedAt: project.updatedAt },
      ownerToken,
    });
  } catch (err) {
    console.error("POST /api/projects hiba:", err);
    return fail(500, "server_error", "Szerverhiba a mentés közben");
  }
}
