import { describe, it, expect } from "vitest";
import { cloudProjectSchema, validateProjectData } from "../projectSchema";

// Érvényes minimál projekt (a Project típus kötelező mezőivel)
function validProject() {
  return {
    id: "test1234abcd",
    name: "Teszt projekt",
    tracks: [
      { id: "trk1", name: "Grafika", category: "graphics", volume: 0.8, muted: false, solo: false },
      { id: "trk2", name: "Hang", category: "sound", volume: 0.8, muted: false, solo: false },
    ],
    blocks: [
      { id: "blk1", typeId: "gfx.sprite.ship", trackId: "trk1", start: 0, length: 4, params: { size: 60 } },
    ],
    assets: [],
    stepCount: 32,
    tempoMs: 300,
    loop: false,
    masterVolume: 0.8,
  };
}

describe("cloudProjectSchema", () => {
  it("elfogadja az érvényes projektet", () => {
    expect(validateProjectData(validProject())).toEqual({ ok: true });
  });

  it("extra (jövőbeli) mezőkkel is elfogadja – loose séma", () => {
    const p = { ...validProject(), cloudId: "abc12345-1234", futureField: { nested: true } };
    expect(validateProjectData(p)).toEqual({ ok: true });
  });

  it("elutasítja a hiányzó tracks-et", () => {
    const p = { ...validProject(), tracks: undefined };
    const v = validateProjectData(p);
    expect(v.ok).toBe(false);
  });

  it("elutasítja a sávtartományon kívüli stepCount-ot", () => {
    const p = { ...validProject(), stepCount: 9999 };
    expect(validateProjectData(p).ok).toBe(false);
  });

  it("elutasítja a rossz kategóriájú sávot", () => {
    const p = { ...validProject() };
    p.tracks[0].category = "nem-letezik" as never;
    expect(validateProjectData(p).ok).toBe(false);
  });

  it("elutasítja a szöveg stepCount-ot (típuscsalás)", () => {
    const p = { ...validProject(), stepCount: "32" as unknown as number };
    expect(validateProjectData(p).ok).toBe(false);
  });

  it("elutasítja a paraméterben objektumot (mélységi injekció)", () => {
    const p = { ...validProject() };
    p.blocks[0].params = { evil: { nested: "object" } } as never;
    expect(validateProjectData(p).ok).toBe(false);
  });

  it("elutasítja a túl sok blokkot (erőforrás-védő limit)", () => {
    const p = { ...validProject(), blocks: [] as unknown[] };
    for (let i = 0; i < 4001; i++) {
      p.blocks.push({ id: `b${i}`, typeId: "x", trackId: "trk1", start: 0, length: 1, params: {} });
    }
    expect(validateProjectData(p).ok).toBe(false);
  });

  it("elutasítja a nem-objektumot és a null-t", () => {
    expect(validateProjectData(null).ok).toBe(false);
    expect(validateProjectData("string").ok).toBe(false);
    expect(validateProjectData(42).ok).toBe(false);
  });

  it("emberi olvasatú okot ad hibánál", () => {
    const v = validateProjectData({ ...validProject(), masterVolume: 5 });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toContain("masterVolume");
  });

  it("a séma közvetlen parse-olása is működik", () => {
    expect(cloudProjectSchema.safeParse(validProject()).success).toBe(true);
  });
});
