import type { Block, Project, Track } from "./types";

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

function track(id: string, name: string, category: Track["category"], volume = 0.8): Track {
  return { id, name, category, volume, muted: false, solo: false };
}

function block(
  typeId: string,
  trackId: string,
  start: number,
  params: Record<string, string | number | boolean> = {},
  length?: number,
): Block {
  return { id: uid(), typeId, trackId, start, length: length ?? 4, params };
}

// ===== Demó 1: Űr-támadás – teljesen játszható mini játék =====
export function demoSpaceProject(): Project {
  const tracks: Track[] = [
    track("t-gfx", "Grafika · Fő", "graphics"),
    track("t-sprite", "Grafika · Sprite-ok", "graphics"),
    track("t-music", "Zene", "sound", 0.75),
    track("t-sfx", "Hangok", "sound", 0.8),
    track("t-logic", "Logika", "logic"),
    track("t-input", "Bemenet", "input"),
    track("t-data", "Adat", "data"),
  ];

  const blocks: Block[] = [
    // Fő grafika
    block("gfx.bg.preset", "t-gfx", 0, { preset: "space" }, 8),
    block("gfx.text", "t-gfx", 0, { text: "ŰR-TÁMADÁS", x: 50, y: 14, size: 40, color: "#fbbf24", sticky: false }, 6),
    block("gfx.effect.fireworks", "t-gfx", 28, { count: 3 }, 4),
    // Sprite-ok
    block("gfx.sprite.ship", "t-sprite", 0, { x: 50, y: 82, size: 36, color: "#fbbf24" }, 4),
    block("gfx.sprite.meteor", "t-sprite", 4, { x: 20, vy: 60, size: 24, spin: true }, 2),
    block("gfx.sprite.meteor", "t-sprite", 7, { x: 70, vy: 80, size: 30, spin: true }, 2),
    block("gfx.sprite.star", "t-sprite", 6, { x: 30, y: 35, size: 20, value: 5 }, 2),
    block("gfx.sprite.meteor", "t-sprite", 12, { x: 50, vy: 70, size: 26, spin: true }, 2),
    block("gfx.sprite.meteor", "t-sprite", 13, { x: 85, vy: 55, size: 20, spin: true }, 2),
    block("gfx.sprite.star", "t-sprite", 14, { x: 65, y: 30, size: 20, value: 5 }, 2),
    block("gfx.sprite.meteor", "t-sprite", 18, { x: 10, vy: 75, size: 28, spin: true }, 2),
    block("gfx.sprite.meteor", "t-sprite", 19, { x: 40, vy: 90, size: 32, spin: true }, 2),
    block("gfx.sprite.star", "t-sprite", 22, { x: 80, y: 40, size: 20, value: 5 }, 2),
    block("gfx.sprite.meteor", "t-sprite", 24, { x: 60, vy: 65, size: 24, spin: true }, 2),
    block("gfx.sprite.meteor", "t-sprite", 26, { x: 30, vy: 85, size: 26, spin: true }, 2),
    block("gfx.sprite.meteor", "t-sprite", 28, { x: 90, vy: 70, size: 22, spin: true }, 2),
    // Zene
    block("music.beat", "t-music", 0, { pattern: "techno", volume: 70 }, 8),
    block("music.bass", "t-music", 8, { pattern: "dark", volume: 65 }, 8),
    block("music.beat", "t-music", 8, { pattern: "techno", volume: 70 }, 8),
    block("music.arpeggio", "t-music", 16, { scale: "minor", volume: 55 }, 8),
    block("music.beat", "t-music", 16, { pattern: "house", volume: 70 }, 8),
    block("music.pad", "t-music", 24, { chord: "minor", volume: 50 }, 8),
    block("music.beat", "t-music", 24, { pattern: "techno", volume: 70 }, 8),
    // Hangok
    block("sfx.swoosh", "t-sfx", 0, { volume: 60 }, 2),
    block("sfx.alarm", "t-sfx", 16, { volume: 50 }, 4),
    // Logika
    block("logic.counter", "t-logic", 31, { variable: "kor", delta: 1 }, 1),
    block("logic.check", "t-logic", 31, { variable: "score", op: ">=", value: 60, action: "text", actionValue: "GYŐZTEL! 🏆", x: 50, y: 45 }, 1),
    block("logic.random", "t-logic", 15, { chance: 40, action: "text", actionValue: "Bónusz!", x: 50, y: 60 }, 1),
    // Bemenet
    block("input.keyboard", "t-input", 0, { speed: 240 }, 32),
    block("input.click", "t-input", 0, { mode: "shoot" }, 32),
    // Adat
    block("data.setvar", "t-data", 0, { variable: "score", value: 0 }, 1),
    block("data.lives", "t-data", 0, { value: 3 }, 1),
  ];

  return {
    id: uid(),
    name: "Űr-támadás (demó)",
    tracks,
    blocks,
    assets: [],
    stepCount: 32,
    tempoMs: 300,
    loop: true,
    masterVolume: 0.8,
  };
}

// ===== Demó 3: Ugrálós kaland – platformer játék (új készlettel) =====
export function demoPlatformProject(): Project {
  const tracks: Track[] = [
    track("p-gfx", "Grafika", "graphics"),
    track("p-sprite", "Sprite-ok", "graphics"),
    track("p-music", "Zene", "sound", 0.7),
    track("p-input", "Bemenet", "input"),
    track("p-logic", "Logika", "logic"),
    track("p-data", "Adat", "data"),
  ];
  const blocks: Block[] = [
    // Grafika
    block("gfx.bg.preset", "p-gfx", 0, { preset: "forest" }, 8),
    block("gfx.text", "p-gfx", 0, { text: "UGRÁLÓS KALAND", x: 50, y: 10, size: 38, color: "#bef264", sticky: true }, 32),
    block("gfx.sprite.tree", "p-gfx", 0, { style: "tree", role: "deco", move: "static", x: 8, y: 80, size: 64, color: "#166534", sticky: true }, 4),
    block("gfx.sprite.tree", "p-gfx", 2, { style: "tree", role: "deco", move: "static", x: 94, y: 80, size: 56, color: "#15803d", sticky: true }, 4),
    // Sprite-ok: talaj + platformok + játékos + érmék + ellenség
    block("gfx.sprite.platform", "p-sprite", 0, { style: "cube", role: "platform", move: "static", x: 50, y: 94, size: 95, height: 30, color: "#7c5a3a", sticky: true }, 4),
    block("gfx.sprite.platform", "p-sprite", 3, { style: "cube", role: "platform", move: "static", x: 28, y: 72, size: 30, height: 18, color: "#8a6844", sticky: true }, 4),
    block("gfx.sprite.platform", "p-sprite", 6, { style: "cube", role: "platform", move: "static", x: 58, y: 56, size: 26, height: 18, color: "#8a6844", sticky: true }, 4),
    block("gfx.sprite.platform", "p-sprite", 9, { style: "cube", role: "platform", move: "static", x: 84, y: 40, size: 24, height: 18, color: "#8a6844", sticky: true }, 4),
    block("gfx.shape", "p-sprite", 12, { style: "ball", role: "player", move: "static", speed: 0, x: 10, y: 82, size: 34, color: "#fbbf24", height: 26, value: 5, randomX: false, sticky: true }, 4),
    block("gfx.sprite.coin", "p-sprite", 15, { style: "coin", role: "pickup", move: "static", speed: 0, x: 28, y: 62, size: 20, value: 10, color: "#fbbf24", sticky: true }, 2),
    block("gfx.sprite.coin", "p-sprite", 17, { style: "coin", role: "pickup", move: "static", speed: 0, x: 58, y: 46, size: 20, value: 10, color: "#fbbf24", sticky: true }, 2),
    block("gfx.sprite.coin", "p-sprite", 19, { style: "coin", role: "pickup", move: "static", speed: 0, x: 84, y: 30, size: 20, value: 10, color: "#fbbf24", sticky: true }, 2),
    block("gfx.sprite.mushroom", "p-sprite", 21, { style: "mushroom", role: "pickup", move: "drift", speed: 35, x: 40, y: 88, size: 24, value: 5, color: "#ef4444", sticky: true }, 4),
    block("gfx.sprite.bomb", "p-sprite", 25, { style: "bomb", role: "enemy", move: "patrol", speed: 60, x: 60, y: 88, size: 24, color: "#52525b", sticky: true, randomX: false }, 4),
    block("gfx.sprite.heart", "p-sprite", 29, { style: "heart", role: "pickup", move: "static", speed: 0, x: 84, y: 32, size: 22, value: 1, color: "#f87171", sticky: true }, 2),
    // Zene
    block("music.chip", "p-music", 0, { tune: "adventure", volume: 50 }, 8),
    block("music.chip", "p-music", 8, { tune: "adventure", volume: 50 }, 8),
    block("music.chip", "p-music", 16, { tune: "happy", volume: 50 }, 8),
    block("music.chip", "p-music", 24, { tune: "happy", volume: 50 }, 8),
    // Bemenet: ugrálás mód!
    block("input.keyboard", "p-input", 0, { mode: "jump", speed: 190, jump: 640 }, 32),
    // Logika: ha minden érmét összegyűjtötted (35+ pont), győzelem!
    block("logic.check", "p-logic", 30, { variable: "score", op: ">=", value: 35, action: "win", actionValue: "Minden érmét megkaptad!", x: 50, y: 50 }, 1),
    block("logic.counter", "p-logic", 31, { variable: "kör", delta: 1 }, 1),
    // Adat
    block("data.setvar", "p-data", 0, { variable: "score", value: 0 }, 1),
    block("data.lives", "p-data", 0, { value: 3 }, 1),
  ];
  return {
    id: uid(),
    name: "Ugrálós kaland (demó)",
    tracks,
    blocks,
    assets: [],
    stepCount: 32,
    tempoMs: 300,
    loop: true,
    masterVolume: 0.8,
  };
}

// ===== Demó 2: Nyugodt éjszaka – nem játékos, "hangulat-alkalmazás" =====
export function demoChillProject(): Project {
  const tracks: Track[] = [
    track("c-gfx", "Grafika", "graphics"),
    track("c-music", "Zene", "sound", 0.7),
    track("c-logic", "Logika", "logic"),
  ];
  const blocks: Block[] = [
    block("gfx.bg.preset", "c-gfx", 0, { preset: "ocean" }, 8),
    block("gfx.text", "c-gfx", 0, { text: "Nyugodt éjszaka", x: 50, y: 18, size: 34, color: "#e0f2fe", sticky: true }, 32),
    block("gfx.sprite.cloud", "c-gfx", 2, { x: 15, y: 25, vx: 10, size: 40, color: "#cbd5e1" }, 4),
    block("gfx.sprite.cloud", "c-gfx", 6, { x: 70, y: 15, vx: 7, size: 55, color: "#94a3b8" }, 4),
    block("gfx.sprite.star", "c-gfx", 8, { x: 40, y: 55, size: 14, value: 1 }, 2),
    block("gfx.sprite.star", "c-gfx", 14, { x: 62, y: 45, size: 14, value: 1 }, 2),
    block("gfx.sprite.cloud", "c-gfx", 16, { x: 30, y: 65, vx: 12, size: 36, color: "#cbd5e1" }, 4),
    block("gfx.effect.fireworks", "c-gfx", 24, { count: 2 }, 4),
    block("music.pad", "c-music", 0, { chord: "sus", volume: 50 }, 8),
    block("music.arpeggio", "c-music", 8, { scale: "pentatonic", volume: 45 }, 8),
    block("music.pad", "c-music", 16, { chord: "major", volume: 50 }, 8),
    block("music.arpeggio", "c-music", 24, { scale: "pentatonic", volume: 45 }, 8),
    block("logic.counter", "c-logic", 31, { variable: "perceket", delta: 1 }, 1),
  ];
  return {
    id: uid(),
    name: "Nyugodt éjszaka (demó)",
    tracks,
    blocks,
    assets: [],
    stepCount: 32,
    tempoMs: 500,
    loop: true,
    masterVolume: 0.8,
  };
}

export function emptyProject(): Project {
  const tracks: Track[] = [
    track("t-gfx", "Grafika", "graphics"),
    track("t-sound", "Hang", "sound"),
    track("t-logic", "Logika", "logic"),
    track("t-input", "Bemenet", "input"),
    track("t-data", "Adat", "data"),
  ];
  return {
    id: uid(),
    name: "Új projekt",
    tracks,
    blocks: [],
    assets: [],
    stepCount: 32,
    tempoMs: 300,
    loop: true,
    masterVolume: 0.8,
  };
}
