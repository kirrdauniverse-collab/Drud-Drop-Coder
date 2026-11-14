// ===== Felhőprojekt sémák – kliens és szerver közös, izomorf validáció =====
// A CloudDialog import/exportnál és a /api/projects route-oknál is ez a sémadefiníció
// a mérvadó, így a szerver és a böngésző sose tér el a "mi számít érvényes projektnek".

import { z } from "zod";

// A felhőben tárolt projekt legfeljebb ~8 MB lehet (saját képek/hangok data URL-ei miatt)
export const MAX_CLOUD_BYTES = 8 * 1024 * 1024;

const paramValue = z.union([z.string(), z.number(), z.boolean()]);

// looose (z.looseObject): a jövőbeli változatok extra mezőit ne dobjuk el –
// csak a kötelező szerkezeti mezőket érvényesítjük.
export const cloudTrackSchema = z.looseObject({
  id: z.string().min(1).max(64),
  name: z.string().max(80),
  category: z.enum(["logic", "graphics", "sound", "input", "ui", "data", "custom"]),
  volume: z.number().min(0).max(1),
  muted: z.boolean(),
  solo: z.boolean(),
});

export const cloudBlockSchema = z.looseObject({
  id: z.string().min(1).max(64),
  typeId: z.string().min(1).max(80),
  trackId: z.string().min(1).max(64),
  start: z.number().int().min(0).max(1024),
  length: z.number().int().min(1).max(256),
  params: z.record(z.string().max(64), paramValue),
});

export const cloudAssetSchema = z.looseObject({
  id: z.string().min(1).max(64),
  kind: z.enum(["image", "audio"]),
  name: z.string().max(80),
  dataUrl: z.string().max(6 * 1024 * 1024),
  createdAt: z.number(),
});

export const cloudProjectSchema = z.looseObject({
  id: z.string().max(64),
  name: z.string().max(120),
  tracks: z.array(cloudTrackSchema).min(1).max(64),
  blocks: z.array(cloudBlockSchema).max(4000),
  assets: z.array(cloudAssetSchema).max(200),
  stepCount: z.number().int().min(16).max(128),
  tempoMs: z.number().int().min(60).max(1200),
  loop: z.boolean(),
  masterVolume: z.number().min(0).max(1),
});

export type ProjectValidation = { ok: true } | { ok: false; reason: string };

// Emberi olvasatra bírja a Zod hibát (első érintett mezővel)
export function validateProjectData(data: unknown): ProjectValidation {
  const result = cloudProjectSchema.safeParse(data);
  if (result.success) return { ok: true };
  const issue = result.error.issues[0];
  return {
    ok: false,
    reason: issue
      ? `${issue.path.join(".") || "gyökér"}: ${issue.message}`
      : "ismeretlen szerkezeti hiba",
  };
}
