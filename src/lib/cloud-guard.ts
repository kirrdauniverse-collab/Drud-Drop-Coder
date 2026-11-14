// ===== Szerver-oldali védelem a /api/projects route-okhoz =====
// Csak Node-futásban importálandó (node:crypto) – a böngésző nem látja.

import { createHash, randomBytes } from "node:crypto";

// --- Névtelen tulajdonosi token ---
// Nincs felhasználó-nyilvántartás: minden mentés kap egy véletlen tokent, amiből
// csak a SHA-256 hash tárolódik. Mentés felülíráshoz és törléshez ez kell –
// így a "bárki törölhet bármit" probléma megoldott, regisztráció nélkül.
export function generateOwnerToken(): string {
  return randomBytes(24).toString("base64url");
}

export function hashOwnerToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// Token a fejlécből vagy a törzsből (a kliens mindkettőt támogatja)
export function ownerTokenFrom(req: Request, body?: unknown): string | undefined {
  const header = req.headers.get("x-owner-token");
  if (header && header.length <= 200) return header;
  const b = body as { ownerToken?: unknown } | undefined;
  if (typeof b?.ownerToken === "string" && b.ownerToken.length <= 200) return b.ownerToken;
  return undefined;
}

// --- Egyszerű IP-alapú korlátozó (csúszóablak, memóriában) ---
// Egy példányos szerverre elég; ha több replika lesz, Redis-re kell cserélni.
const buckets = new Map<string, number[]>();
const MAX_BUCKETS = 5000;

export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  let hits = buckets.get(key);
  if (!hits) {
    if (buckets.size >= MAX_BUCKETS) buckets.clear(); // öntisztítás extrém terhelésnél
    hits = [];
    buckets.set(key, hits);
  }
  while (hits.length > 0 && now - hits[0] > windowMs) hits.shift();
  if (hits.length >= max) return false;
  hits.push(now);
  return true;
}

export function clientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "helyi"
  );
}
