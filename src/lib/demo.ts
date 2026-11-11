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

// =====================================================================
// Demó 1: ŰR-TÁMADÁS – javított űrhajós lövöldözős
// (a hajó ORRÁVAL felfelé néz és orrás lő; a meteorok tényleg lezuhannak;
//  a bónusz csillagok hullanak; főmenü + top-10 pontlista van)
// =====================================================================
export function demoSpaceProject(): Project {
  const tracks: Track[] = [
    track("t-gfx", "Grafika · Fő", "graphics"),
    track("t-sprite", "Grafika · Sprite-ok", "graphics"),
    track("t-music", "Zene", "sound", 0.75),
    track("t-sfx", "Hangok", "sound", 0.8),
    track("t-logic", "Logika", "logic"),
    track("t-input", "Bemenet", "input"),
    track("t-data", "Adat", "data"),
    track("t-ui", "Menü", "ui"),
  ];

  const blocks: Block[] = [
    // Főmenü (0. lépés: a léptető megáll, míg választasz)
    block("ui.menu", "t-ui", 0, {
      title: "ŰR-TÁMADÁS",
      subtitle: "Irányítsd a hajót, lődd a meteorokat, kapd el a hulló csillagokat!",
      options: "Indítás,Pontlista",
      targets: "6,2",
      variable: "menu",
    }, 2),
    // Pontlista a menüből (csak mutatás)
    block("data.highscore", "t-ui", 2, { mode: "show", board: "ur-tamadas", title: "ŰR-TÁMADÁS – TOP 10", target: 0 }, 2),
    // Pontlista mentő blokk – a játék végén automatikusan ez fut le (a tömbben előrébb áll)
    block("data.highscore", "t-data", 30, { mode: "save", board: "ur-tamadas", title: "ŰR-TÁMADÁS – TOP 10", name: "Pilóta", target: 0 }, 2),

    // Játék indítása a 6. lépésnél
    block("logic.clear", "t-logic", 6, { mode: "all" }, 1),
    block("gfx.bg.preset", "t-gfx", 6, { preset: "space" }, 8),
    block("gfx.text", "t-gfx", 7, { text: "ŰR-TÁMADÁS", x: 50, y: 14, size: 40, color: "#fbbf24", sticky: false, fade: true }, 3),
    block("gfx.effect.fireworks", "t-gfx", 28, { count: 3 }, 4),
    // Sprite-ok
    block("gfx.sprite.ship", "t-sprite", 6, { x: 50, y: 82, size: 36, color: "#fbbf24" }, 4),
    // Folyamatos meteor-eső: minden 3. lépésben új zuhanó szikla
    block("logic.spawn", "t-logic", 7, { every: 3, count: 1, style: "meteor", role: "enemy", move: "fall", speed: 75, size: 26, color: "#9ca3af", randomX: true, spin: true }, 25),
    // Kézzel rakott meteorok a sűrűbb pillanatokhoz
    block("gfx.sprite.meteor", "t-sprite", 12, { x: 50, speed: 90, size: 30, spin: true }, 2),
    block("gfx.sprite.meteor", "t-sprite", 18, { x: 15, speed: 100, size: 32, spin: true }, 2),
    block("gfx.sprite.meteor", "t-sprite", 19, { x: 80, speed: 95, size: 28, spin: true }, 2),
    // Bónusz csillagok: most már HULLANAK, el lehet kapni őket
    block("gfx.sprite.star", "t-sprite", 8, { x: 25, y: -8, move: "fall", speed: 45, size: 20, value: 5, sticky: false }, 2),
    block("gfx.sprite.star", "t-sprite", 13, { x: 65, y: -8, move: "fall", speed: 50, size: 20, value: 5, sticky: false }, 2),
    block("gfx.sprite.star", "t-sprite", 17, { x: 45, y: -8, move: "fall", speed: 42, size: 20, value: 5, sticky: false }, 2),
    block("gfx.sprite.star", "t-sprite", 22, { x: 80, y: -8, move: "fall", speed: 55, size: 20, value: 5, sticky: false }, 2),
    block("gfx.sprite.star", "t-sprite", 26, { x: 35, y: -8, move: "fall", speed: 48, size: 20, value: 5, sticky: false }, 2),
    // Zene
    block("music.beat", "t-music", 6, { pattern: "techno", volume: 70 }, 8),
    block("music.bass", "t-music", 14, { pattern: "dark", volume: 65 }, 8),
    block("music.beat", "t-music", 14, { pattern: "techno", volume: 70 }, 8),
    block("music.arpeggio", "t-music", 22, { scale: "minor", volume: 55 }, 8),
    block("music.beat", "t-music", 22, { pattern: "house", volume: 70 }, 8),
    // Hangok
    block("sfx.swoosh", "t-sfx", 6, { volume: 60 }, 2),
    block("sfx.alarm", "t-sfx", 20, { volume: 50 }, 2),
    // Logika
    block("logic.check", "t-logic", 28, { variable: "score", op: ">=", value: 60, action: "text", actionValue: "GYŐZTEL!", x: 50, y: 45 }, 1),
    block("logic.counter", "t-logic", 31, { variable: "kör", delta: 1 }, 1),
    // Bemenet
    block("input.keyboard", "t-input", 6, { speed: 260 }, 26),
    block("input.click", "t-input", 6, { mode: "shoot" }, 26),
    // Adat
    block("data.setvar", "t-data", 6, { variable: "score", value: 0 }, 1),
    block("data.lives", "t-data", 6, { value: 3 }, 1),
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

// =====================================================================
// Demó 2: BUNKYÓ KALAND – Super Mario-szerű platformer
// (főmenü, pontlista, ugrálós irányítás, fejről taposás, hulló érmék,
//  gombás ellenségek, zászlós cél és kastély a pálya végén)
// =====================================================================
export function demoPlatformProject(): Project {
  const tracks: Track[] = [
    track("p-gfx", "Grafika", "graphics"),
    track("p-sprite", "Sprite-ok", "graphics"),
    track("p-music", "Zene", "sound", 0.7),
    track("p-input", "Bemenet", "input"),
    track("p-logic", "Logika", "logic"),
    track("p-data", "Adat", "data"),
    track("p-ui", "Menü", "ui"),
  ];

  const blocks: Block[] = [
    // Főmenü
    block("ui.menu", "p-ui", 0, {
      title: "BUNKYÓ KALAND",
      subtitle: "Ugrálj, gyűjtsd az érméket, taposd a gombákat – érd el a zászlót!",
      options: "Indítás,Pontlista",
      targets: "6,2",
      variable: "menu",
    }, 2),
    block("data.highscore", "p-ui", 2, { mode: "show", board: "bunkyo", title: "BUNKYÓ KALAND – TOP 10", target: 0 }, 2),
    block("data.highscore", "p-data", 30, { mode: "save", board: "bunkyo", title: "BUNKYÓ KALAND – TOP 10", name: "Ugráló", target: 0 }, 2),

    // Pálya a 6. lépésnél
    block("logic.clear", "p-logic", 6, { mode: "all" }, 1),
    block("gfx.bg.preset", "p-gfx", 6, { preset: "forest" }, 8),
    block("gfx.sprite.tree", "p-gfx", 7, { style: "tree", role: "deco", move: "static", x: 8, y: 78, size: 64, color: "#166534", sticky: true }, 4),
    block("gfx.sprite.tree", "p-gfx", 8, { style: "tree", role: "deco", move: "static", x: 94, y: 80, size: 56, color: "#15803d", sticky: true }, 4),
    block("gfx.sprite.cloud", "p-gfx", 10, { x: 30, y: 18, speed: 10, size: 44, color: "#e2e8f0", sticky: true }, 4),
    // Talaj és platformok (a takarítás UTÁN, hogy ne törölje őket)
    block("gfx.sprite.platform", "p-sprite", 7, { style: "cube", role: "platform", move: "static", x: 50, y: 94, size: 95, height: 30, color: "#7c5a3a", sticky: true }, 4),
    block("gfx.sprite.platform", "p-sprite", 9, { style: "cube", role: "platform", move: "static", x: 28, y: 72, size: 30, height: 18, color: "#8a6844", sticky: true }, 4),
    block("gfx.sprite.platform", "p-sprite", 12, { style: "cube", role: "platform", move: "static", x: 52, y: 56, size: 26, height: 18, color: "#8a6844", sticky: true }, 4),
    block("gfx.sprite.platform", "p-sprite", 15, { style: "cube", role: "platform", move: "static", x: 78, y: 40, size: 24, height: 18, color: "#8a6844", sticky: true }, 4),
    block("gfx.sprite.platform", "p-sprite", 18, { style: "cube", role: "platform", move: "static", x: 84, y: 68, size: 20, height: 18, color: "#8a6844", sticky: true }, 4),
    // Játékos: nyuszi!
    block("gfx.sprite.bunny", "p-sprite", 7, { style: "bunny", role: "player", move: "static", speed: 0, x: 10, y: 84, size: 32, color: "#f5f5f4", sticky: true, randomX: false }, 4),
    // Érmék a platformokon
    block("gfx.sprite.coin", "p-sprite", 10, { style: "coin", role: "pickup", move: "static", speed: 0, x: 28, y: 64, size: 20, value: 10, color: "#fbbf24", sticky: true }, 2),
    block("gfx.sprite.coin", "p-sprite", 13, { style: "coin", role: "pickup", move: "static", speed: 0, x: 52, y: 48, size: 20, value: 10, color: "#fbbf24", sticky: true }, 2),
    block("gfx.sprite.coin", "p-sprite", 16, { style: "coin", role: "pickup", move: "static", speed: 0, x: 78, y: 32, size: 20, value: 10, color: "#fbbf24", sticky: true }, 2),
    // Hulló érme-eső: kapd el őket ugrálva!
    block("logic.spawn", "p-logic", 11, { every: 4, count: 1, style: "coin", role: "pickup", move: "fall", speed: 55, size: 18, value: 5, color: "#fbbf24", randomX: true, spin: true }, 21),
    // Gombás ellenségek – fejről taposhatók!
    block("gfx.sprite.mushroom", "p-sprite", 14, { style: "mushroom", role: "enemy", move: "patrol", speed: 55, x: 55, y: 86, size: 26, color: "#ef4444", sticky: true, randomX: false }, 4),
    block("gfx.sprite.crab", "p-sprite", 20, { style: "crab", role: "enemy", move: "patrol", speed: 70, x: 30, y: 86, size: 26, color: "#ef4444", sticky: true, randomX: false }, 4),
    // Szív + cél: zászló és kastély
    block("gfx.sprite.heart", "p-sprite", 17, { style: "heart", role: "pickup", move: "static", speed: 0, x: 78, y: 28, size: 22, value: 1, color: "#f87171", sticky: true }, 2),
    block("gfx.sprite.flag", "p-sprite", 22, { style: "flag", role: "deco", move: "static", x: 90, y: 58, size: 84, color: "#f43f5e", sticky: true }, 4),
    block("gfx.sprite.castle", "p-sprite", 23, { style: "castle", role: "deco", move: "static", x: 88, y: 78, size: 88, color: "#a8a29e", sticky: true }, 4),
    // Zene
    block("music.chip", "p-music", 6, { tune: "adventure", volume: 50 }, 8),
    block("music.chip", "p-music", 14, { tune: "adventure", volume: 50 }, 8),
    block("music.chip", "p-music", 22, { tune: "happy", volume: 50 }, 8),
    // Bemenet: ugrálás mód!
    block("input.keyboard", "p-input", 6, { mode: "jump", speed: 200, jump: 660 }, 26),
    // Logika: ha eleget gyűjtöttél, győzelem!
    block("logic.check", "p-logic", 26, { variable: "score", op: ">=", value: 45, action: "win", actionValue: "Elérted a zászlót – győztél!", x: 50, y: 50 }, 1),
    block("logic.counter", "p-logic", 31, { variable: "pálya", delta: 1 }, 1),
    // Adat
    block("data.setvar", "p-data", 6, { variable: "score", value: 0 }, 1),
    block("data.lives", "p-data", 6, { value: 3 }, 1),
  ];

  return {
    id: uid(),
    name: "Bunkyó kaland (demó)",
    tracks,
    blocks,
    assets: [],
    stepCount: 32,
    tempoMs: 300,
    loop: true,
    masterVolume: 0.8,
  };
}

// =====================================================================
// Demó 3: GALAXI ŐRSÉG – Galaga-szerű hullámos lövöldözős
// (klasszikus vízszintes irányítás, UFO-k keringenek, meteor-hullámok)
// =====================================================================
export function demoGalagaProject(): Project {
  const tracks: Track[] = [
    track("g-gfx", "Grafika", "graphics"),
    track("g-sprite", "Sprite-ok", "graphics"),
    track("g-music", "Zene", "sound", 0.7),
    track("g-sfx", "Hangok", "sound", 0.8),
    track("g-logic", "Logika", "logic"),
    track("g-input", "Bemenet", "input"),
    track("g-data", "Adat", "data"),
    track("g-ui", "Menü", "ui"),
  ];

  const blocks: Block[] = [
    block("ui.menu", "g-ui", 0, {
      title: "GALAXI ŐRSÉG",
      subtitle: "Galaga-stílus: hajtsd vissza a betolakodó rajt!",
      options: "Indítás,Pontlista",
      targets: "6,2",
      variable: "menu",
    }, 2),
    block("data.highscore", "g-ui", 2, { mode: "show", board: "galaxi", title: "GALAXI ŐRSÉG – TOP 10", target: 0 }, 2),
    block("data.highscore", "g-data", 30, { mode: "save", board: "galaxi", title: "GALAXI ŐRSÉG – TOP 10", name: "Pilóta", target: 0 }, 2),

    block("logic.clear", "g-logic", 6, { mode: "all" }, 1),
    block("gfx.bg.preset", "g-gfx", 6, { preset: "space", dim: 12 }, 8),
    block("gfx.text", "g-gfx", 7, { text: "1. HULLÁM", x: 50, y: 22, size: 30, color: "#67e8f9", sticky: false, fade: true }, 2),
    block("gfx.text", "g-gfx", 16, { text: "2. HULLÁM", x: 50, y: 22, size: 30, color: "#67e8f9", sticky: false, fade: true }, 2),
    block("gfx.effect.shake", "g-gfx", 16, { strength: 10 }, 1),
    // Játékos és irányítás (csak vízszintes – mint a Galagában)
    block("gfx.sprite.ship", "g-sprite", 6, { x: 50, y: 86, size: 34, color: "#67e8f9" }, 4),
    // Meteor-hullámok
    block("logic.spawn", "g-logic", 7, { every: 3, count: 1, style: "meteor", role: "enemy", move: "fall", speed: 85, size: 24, color: "#9ca3af", randomX: true, spin: true }, 9),
    block("logic.spawn", "g-logic", 16, { every: 2, count: 1, style: "meteor", role: "enemy", move: "fall", speed: 105, size: 26, color: "#9ca3af", randomX: true, spin: true }, 15),
    // Keringő UFO-k
    block("gfx.sprite.ufo", "g-sprite", 9, { style: "ufo", role: "enemy", move: "orbit", speed: 110, x: 25, y: 22, size: 34, color: "#a3e635", sticky: true }, 4),
    block("gfx.sprite.ufo", "g-sprite", 13, { style: "ufo", role: "enemy", move: "orbit", speed: 110, x: 75, y: 22, size: 34, color: "#a3e635", sticky: true }, 4),
    block("gfx.sprite.ufo", "g-sprite", 19, { style: "ufo", role: "enemy", move: "orbit", speed: 130, x: 50, y: 18, size: 36, color: "#a3e635", sticky: true }, 4),
    // Bónuszok
    block("gfx.sprite.star", "g-sprite", 11, { x: 40, y: -8, move: "fall", speed: 55, size: 20, value: 5, sticky: false }, 2),
    block("gfx.sprite.star", "g-sprite", 21, { x: 60, y: -8, move: "fall", speed: 60, size: 20, value: 5, sticky: false }, 2),
    block("gfx.sprite.gem", "g-sprite", 24, { x: 50, y: 30, size: 22, value: 25, color: "#67e8f9", sticky: true }, 2),
    // Zene és hangok
    block("music.beat", "g-music", 6, { pattern: "techno", volume: 65 }, 8),
    block("music.arpeggio", "g-music", 14, { scale: "minor", volume: 55 }, 8),
    block("music.rock", "g-music", 22, { pattern: "power", volume: 55 }, 8),
    block("sfx.alarm", "g-sfx", 6, { volume: 55 }, 2),
    block("sfx.alarm", "g-sfx", 16, { volume: 55 }, 2),
    block("sfx.swoosh", "g-sfx", 22, { volume: 60 }, 2),
    // Győzelem
    block("logic.check", "g-logic", 28, { variable: "score", op: ">=", value: 110, action: "win", actionValue: "A flotta visszaverve!", x: 50, y: 45 }, 1),
    block("gfx.effect.fireworks", "g-gfx", 28, { count: 4 }, 4),
    block("logic.counter", "g-logic", 31, { variable: "hullám", delta: 1 }, 1),
    // Bemenet + adat
    block("input.keyboard", "g-input", 6, { mode: "horizontal", speed: 300 }, 26),
    block("input.click", "g-input", 6, { mode: "shoot" }, 26),
    block("data.setvar", "g-data", 6, { variable: "score", value: 0 }, 1),
    block("data.lives", "g-data", 6, { value: 3 }, 1),
  ];

  return {
    id: uid(),
    name: "Galaxi őrség (demó)",
    tracks,
    blocks,
    assets: [],
    stepCount: 32,
    tempoMs: 280,
    loop: true,
    masterVolume: 0.8,
  };
}

// =====================================================================
// Demó 4: AMŐBA PÁRBAJ – nagy pályás ötös sor, gép vagy barát ellen
// =====================================================================
export function demoBoardProject(): Project {
  const tracks: Track[] = [
    track("b-gfx", "Grafika", "graphics"),
    track("b-music", "Zene", "sound", 0.6),
    track("b-logic", "Logika", "logic"),
    track("b-data", "Adat", "data"),
    track("b-ui", "Menü és játék", "ui"),
  ];

  const blocks: Block[] = [
    block("ui.menu", "b-ui", 0, {
      title: "AMŐBA PÁRBAJ",
      subtitle: "Ötös sor a nagy pályán – okos gép vagy barát ellen",
      options: "Gép ellen,Barát ellen,Pontlista",
      targets: "6,8,2",
      variable: "menu",
    }, 2),
    block("data.highscore", "b-ui", 2, { mode: "show", board: "amoba", title: "AMŐBA PÁRBAJ – TOP 10", target: 0 }, 2),
    // Ez a mentő blokk áll előrébb a tömbben – játék végén ez fut le automatikusan
    block("data.highscore", "b-data", 12, { mode: "save", board: "amoba", title: "AMŐBA PÁRBAJ – TOP 10", name: "Stratégus", target: 0 }, 2),

    // Gép ellen (6. lépés)
    block("gfx.bg.preset", "b-gfx", 6, { preset: "checker", dim: 0 }, 8),
    block("music.ambient", "b-music", 6, { volume: 45 }, 32),
    block("ui.board", "b-ui", 7, { mode: "amoba", size: 12, opponent: "ai", variable: "tabla", target: 12 }, 4),
    // Barát ellen (8. lépés)
    block("gfx.bg.preset", "b-gfx", 8, { preset: "checker", dim: 0 }, 8),
    block("music.ambient", "b-music", 8, { volume: 45 }, 32),
    block("ui.board", "b-ui", 9, { mode: "amoba", size: 12, opponent: "human", variable: "tabla", target: 12 }, 4),
    // Parti után: pontlista mentése, majd vissza a menübe
    block("logic.counter", "b-logic", 14, { variable: "parti", delta: 1 }, 1),
  ];

  return {
    id: uid(),
    name: "Amőba párbaj (demó)",
    tracks,
    blocks,
    assets: [],
    stepCount: 16,
    tempoMs: 400,
    loop: false,
    masterVolume: 0.8,
  };
}

// =====================================================================
// Demó 5: A SÁRKÁNY KARDJA – ágazatos kaland-RPG
// (történet, útválasztás, gyűjtögetés, sárkány-boss, varázskvíz)
// =====================================================================
export function demoRpgProject(): Project {
  const tracks: Track[] = [
    track("r-gfx", "Grafika", "graphics"),
    track("r-sprite", "Sprite-ok", "graphics"),
    track("r-music", "Zene", "sound", 0.7),
    track("r-sfx", "Hangok", "sound", 0.75),
    track("r-logic", "Logika", "logic"),
    track("r-input", "Bemenet", "input"),
    track("r-data", "Adat", "data"),
    track("r-ui", "Menü és történet", "ui"),
  ];

  const blocks: Block[] = [
    block("ui.menu", "r-ui", 0, {
      title: "A SÁRKÁNY KARDJA",
      subtitle: "Kaland a Ködös Erdőben – döntéseid formálják a végkifejletet",
      options: "Új kaland,Pontlista",
      targets: "6,2",
      variable: "menu",
    }, 2),
    block("data.highscore", "r-ui", 2, { mode: "show", board: "sarkany", title: "A SÁRKÁNY KARDJA – TOP 10", target: 0 }, 2),
    block("data.highscore", "r-data", 29, { mode: "save", board: "sarkany", title: "A SÁRKÁNY KARDJA – TOP 10", name: "Hős", target: 0 }, 2),

    // --- Bevezetés ---
    block("logic.clear", "r-logic", 6, { mode: "all" }, 1),
    block("gfx.bg.preset", "r-gfx", 6, { preset: "forest", dim: 18 }, 8),
    block("gfx.text", "r-gfx", 7, { text: "A falu véne küld: hozd vissza a Sárkánykardot!", x: 50, y: 16, size: 22, color: "#fef3c7", sticky: false, fade: true }, 3),
    // A cicahős – végig vele járod a kalandot
    block("gfx.sprite.cat", "r-sprite", 7, { style: "cat", role: "player", move: "static", speed: 0, x: 15, y: 80, size: 32, color: "#f59e0b", sticky: true, randomX: false }, 4),
    block("music.pad", "r-music", 6, { chord: "minor", volume: 50 }, 8),
    block("data.setvar", "r-data", 6, { variable: "score", value: 0 }, 1),
    block("data.lives", "r-data", 6, { value: 3 }, 1),

    // --- Útválasztás: erdő vagy hegy ---
    block("ui.choice", "r-ui", 8, { question: "Melyik úton indulsz?", options: "Erdő (kulcsot rejt),Hegy (gyémántot rejt)", variable: "ut", target: 10 }, 2),
    block("logic.check", "r-logic", 10, { variable: "ut", op: "==", value: 1, action: "jump", actionValue: "12" }, 1),
    block("logic.jump", "r-logic", 11, { target: 16 }, 1),

    // --- Erdő út (12-15) ---
    block("gfx.sprite.tree", "r-sprite", 12, { style: "tree", role: "deco", move: "static", x: 20, y: 70, size: 66, color: "#166534", sticky: true }, 4),
    block("gfx.sprite.key", "r-sprite", 12, { style: "key", role: "pickup", move: "static", x: 30, y: 40, size: 26, value: 10, color: "#fde047", sticky: true }, 2),
    block("gfx.sprite.bee", "r-sprite", 13, { style: "bee", role: "enemy", move: "chase", speed: 75, x: 60, y: 20, size: 22, color: "#fbbf24", sticky: true }, 4),
    block("gfx.text", "r-gfx", 14, { text: "Megvan az Erdő Kulcsa!", x: 50, y: 60, size: 26, color: "#a3e635", sticky: false }, 2),
    block("music.arpeggio", "r-music", 12, { scale: "pentatonic", volume: 45 }, 4),
    block("logic.jump", "r-logic", 15, { target: 20 }, 1),

    // --- Hegy út (16-19) ---
    block("gfx.bg.preset", "r-gfx", 16, { preset: "mountains", dim: 10 }, 8),
    block("gfx.sprite.gem", "r-sprite", 17, { style: "gem", role: "pickup", move: "static", x: 35, y: 45, size: 24, value: 25, color: "#67e8f9", sticky: true }, 2),
    block("gfx.sprite.spider", "r-sprite", 18, { style: "spider", role: "enemy", move: "chase", speed: 70, x: 65, y: 25, size: 26, color: "#3f3f46", sticky: true }, 4),
    block("gfx.text", "r-gfx", 19, { text: "A hegylelő gyémántja a tiéd!", x: 50, y: 60, size: 26, color: "#a3e635", sticky: false }, 2),
    block("music.waltz", "r-music", 16, { chord: "minor", volume: 45 }, 4),

    // --- A sárkány barlangja (20-25) ---
    block("gfx.bg.preset", "r-gfx", 20, { preset: "lava", dim: 8 }, 8),
    block("gfx.text", "r-gfx", 20, { text: "A SÁRKÁNY BARLANGJA", x: 50, y: 12, size: 30, color: "#fb923c", sticky: false, fade: true }, 2),
    block("gfx.sprite.dragon", "r-sprite", 21, { style: "dragon", role: "enemy", move: "chase", speed: 78, x: 50, y: 15, size: 46, color: "#22c55e", sticky: true }, 4),
    block("gfx.sprite.sword", "r-sprite", 22, { style: "sword", role: "pickup", move: "static", x: 12, y: 80, size: 32, value: 20, color: "#e2e8f0", sticky: true }, 2),
    block("gfx.sprite.heart", "r-sprite", 23, { style: "heart", role: "pickup", move: "static", x: 88, y: 80, size: 24, value: 1, color: "#f87171", sticky: true }, 2),
    block("music.rock", "r-music", 20, { pattern: "power", volume: 55 }, 10),
    block("input.keyboard", "r-input", 20, { mode: "free", speed: 250 }, 12),
    block("input.click", "r-input", 20, { mode: "shoot" }, 12),

    // --- Végső varázskvíz: a szó, ami töri a sárkányt ---
    block("ui.choice", "r-ui", 24, { question: "Melyik szó töri meg a sárkány varázsát?", options: "TŰZ,JÉG,FÉNY", variable: "varazs", target: 26 }, 2),
    block("logic.jump", "r-logic", 25, { target: 31 }, 1),
    block("logic.check", "r-logic", 26, { variable: "varazs", op: "==", value: 3, action: "win", actionValue: "A FÉNY szava kővé változtatta a sárkányt – győztél!", x: 50, y: 40 }, 1),
    block("logic.check", "r-logic", 27, { variable: "varazs", op: "==", value: 1, action: "lose", actionValue: "A tűz csak még dühösebbé tette…", x: 50, y: 40 }, 1),
    block("logic.check", "r-logic", 28, { variable: "varazs", op: "==", value: 2, action: "lose", actionValue: "A jég elpárolgott a lángok közt…", x: 50, y: 40 }, 1),
    block("gfx.effect.fireworks", "r-gfx", 26, { count: 5 }, 4),
    block("logic.counter", "r-logic", 31, { variable: "kaland", delta: 1 }, 1),
  ];

  return {
    id: uid(),
    name: "A Sárkány kardja (demó)",
    tracks,
    blocks,
    assets: [],
    stepCount: 32,
    tempoMs: 450,
    loop: true,
    masterVolume: 0.8,
  };
}

// =====================================================================
// Demó 6: CÉLBALÖVŐDE – FPS-stílusú célba lövögetős
// (álló ágyú, keringő UFO-k, felszálló lufik – ne engedd fel őket!)
// =====================================================================
export function demoShooterProject(): Project {
  const tracks: Track[] = [
    track("s-gfx", "Grafika", "graphics"),
    track("s-sprite", "Sprite-ok", "graphics"),
    track("s-music", "Zene", "sound", 0.65),
    track("s-sfx", "Hangok", "sound", 0.8),
    track("s-logic", "Logika", "logic"),
    track("s-input", "Bemenet", "input"),
    track("s-data", "Adat", "data"),
    track("s-ui", "Menü", "ui"),
  ];

  const blocks: Block[] = [
    block("ui.menu", "s-ui", 0, {
      title: "CÉLBALÖVŐDE",
      subtitle: "FPS-stílus: kattints az UFO-kra, ne engedd fel a lufikat!",
      options: "Indítás,Pontlista",
      targets: "6,2",
      variable: "menu",
    }, 2),
    block("data.highscore", "s-ui", 2, { mode: "show", board: "lovolde", title: "CÉLBALÖVŐDE – TOP 10", target: 0 }, 2),
    block("data.highscore", "s-data", 29, { mode: "save", board: "lovolde", title: "CÉLBALÖVŐDE – TOP 10", name: "Lövész", target: 0 }, 2),

    block("logic.clear", "s-logic", 6, { mode: "all" }, 1),
    block("gfx.bg.preset", "s-gfx", 6, { preset: "neon", dim: 10 }, 8),
    block("gfx.text", "s-gfx", 7, { text: "LÖVŐPÁLYA", x: 50, y: 12, size: 30, color: "#f472b6", sticky: false, fade: true }, 2),
    // Ágyú (játékos) – a kattintás pontjára lő
    block("gfx.shape", "s-sprite", 6, { style: "satellite", role: "player", move: "static", speed: 0, x: 50, y: 88, size: 38, color: "#f0abfc", sticky: true, randomX: false }, 4),
    // Keringő UFO-célpontok
    block("logic.spawn", "s-logic", 7, { every: 2, count: 1, style: "ufo", role: "enemy", move: "orbit", speed: 100, size: 28, color: "#a3e635", randomX: true, spin: false }, 11),
    block("logic.spawn", "s-logic", 18, { every: 2, count: 1, style: "ufo", role: "enemy", move: "orbit", speed: 130, size: 26, color: "#a3e635", randomX: true, spin: false }, 13),
    // Felszálló lufik: ha felérnek, életet vesztesz – lődd le őket!
    block("logic.spawn", "s-logic", 8, { every: 4, count: 1, style: "balloon", role: "enemy", move: "rise", speed: 60, size: 24, color: "#f87171", randomX: true, spin: false }, 22),
    // Zene és hangok
    block("music.disco", "s-music", 6, { volume: 60 }, 8),
    block("music.disco", "s-music", 14, { volume: 60 }, 8),
    block("music.disco", "s-music", 22, { volume: 60 }, 8),
    block("sfx.chime", "s-sfx", 6, { volume: 55 }, 2),
    block("sfx.drumroll", "s-sfx", 26, { volume: 60 }, 2),
    // Győzelem
    block("logic.check", "s-logic", 28, { variable: "score", op: ">=", value: 90, action: "win", actionValue: "Mesterlövész vagy!", x: 50, y: 45 }, 1),
    block("gfx.effect.fireworks", "s-gfx", 28, { count: 4 }, 4),
    block("logic.counter", "s-logic", 31, { variable: "kör", delta: 1 }, 1),
    // Bemenet + adat
    block("input.click", "s-input", 6, { mode: "shoot" }, 26),
    block("data.setvar", "s-data", 6, { variable: "score", value: 0 }, 1),
    block("data.lives", "s-data", 6, { value: 3 }, 1),
  ];

  return {
    id: uid(),
    name: "Célbalövölde (demó)",
    tracks,
    blocks,
    assets: [],
    stepCount: 32,
    tempoMs: 320,
    loop: true,
    masterVolume: 0.8,
  };
}

// =====================================================================
// Demó: Nyugodt éjszaka – nem játékos, „hangulat-alkalmazás”
// =====================================================================
export function demoChillProject(): Project {
  const tracks: Track[] = [
    track("c-gfx", "Grafika", "graphics"),
    track("c-music", "Zene", "sound", 0.7),
    track("c-logic", "Logika", "logic"),
  ];

  const blocks: Block[] = [
    block("gfx.bg.preset", "c-gfx", 0, { preset: "ocean" }, 8),
    block("gfx.text", "c-gfx", 0, { text: "Nyugodt éjszaka", x: 50, y: 18, size: 34, color: "#e0f2fe", sticky: true }, 32),
    block("gfx.sprite.cloud", "c-gfx", 2, { x: 15, y: 25, speed: 10, size: 40, color: "#cbd5e1" }, 4),
    block("gfx.sprite.cloud", "c-gfx", 6, { x: 70, y: 15, speed: 7, size: 55, color: "#94a3b8" }, 4),
    block("gfx.sprite.star", "c-gfx", 8, { x: 40, y: 55, size: 14, value: 1 }, 2),
    block("gfx.sprite.star", "c-gfx", 14, { x: 62, y: 45, size: 14, value: 1 }, 2),
    block("gfx.sprite.cloud", "c-gfx", 16, { x: 30, y: 65, speed: 12, size: 36, color: "#cbd5e1" }, 4),
    block("gfx.effect.fireworks", "c-gfx", 24, { count: 2 }, 4),
    block("music.pad", "c-music", 0, { chord: "sus", volume: 50 }, 8),
    block("music.arpeggio", "c-music", 8, { scale: "pentatonic", volume: 45 }, 8),
    block("music.pad", "c-music", 16, { chord: "major", volume: 50 }, 8),
    block("music.arpeggio", "c-music", 24, { scale: "pentatonic", volume: 45 }, 8),
    block("logic.counter", "c-logic", 31, { variable: "percek", delta: 1 }, 1),
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
