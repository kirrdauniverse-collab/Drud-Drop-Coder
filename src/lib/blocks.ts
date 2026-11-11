import type { BlockParamDef, BlockTypeDef, Category, ShapeMove, ShapeStyle } from "./types";
import { SHAPE_MOVE_LABELS } from "./types";

// ===== Előre definiált blokk-könyvtár =====
// Minden blokk: kategória, ikon, motor-"fajta", alap hossz (lépés) és paraméterek.

const num = (key: string, label: string, def: number, min: number, max: number, step = 1, group?: string) =>
  ({ key, label, type: "number" as const, default: def, min, max, step, group });

const slide = (key: string, label: string, def: number, min: number, max: number, step = 1, group?: string) =>
  ({ key, label, type: "slider" as const, default: def, min, max, step, group });

const sel = (key: string, label: string, def: string, options: { value: string; label: string }[], group?: string) =>
  ({ key, label, type: "select" as const, default: def, options, group });

const txt = (key: string, label: string, def: string, group?: string) =>
  ({ key, label, type: "text" as const, default: def, group });

export const SHAPE_STYLE_OPTIONS: { value: ShapeStyle; label: string }[] = [
  { value: "ship", label: "Űrhajó" },
  { value: "meteor", label: "Meteor (kőzet)" },
  { value: "star", label: "Csillag" },
  { value: "cloud", label: "Felhő" },
  { value: "ball", label: "Labda" },
  { value: "cube", label: "Kocka / doboz" },
  { value: "triangle", label: "Háromszög" },
  { value: "diamond", label: "Gyémánt" },
  { value: "heart", label: "Szív" },
  { value: "car", label: "Autó" },
  { value: "fish", label: "Hal" },
  { value: "bird", label: "Madár" },
  { value: "ghost", label: "Szellem" },
  { value: "bomb", label: "Bomba" },
  { value: "coin", label: "Érme" },
  { value: "apple", label: "Alma" },
  { value: "balloon", label: "Lufi" },
  { value: "snowflake", label: "Hópehely" },
  { value: "flower", label: "Virág" },
  { value: "tree", label: "Fa" },
  { value: "house", label: "Ház" },
  { value: "planet", label: "Bolygó" },
  { value: "moon", label: "Hold" },
  { value: "rocket", label: "Rakéta" },
  { value: "ufo", label: "UFO" },
  { value: "mushroom", label: "Gomba" },
  { value: "egg", label: "Tojás" },
  { value: "shield", label: "Pajzs" },
  { value: "key", label: "Kulcs" },
  { value: "potion", label: "Főzet / ital" },
];

const ROLE_OPTIONS = [
  { value: "player", label: "Játékos (irányítható)" },
  { value: "enemy", label: "Ellenség (bajt okoz)" },
  { value: "pickup", label: "Gyűjtendő (+pont)" },
  { value: "deco", label: "Díszelem (átmenni rajta)" },
  { value: "platform", label: "Akadály / platform (rá lehet állni)" },
];

const MOVE_OPTIONS = (Object.keys(SHAPE_MOVE_LABELS) as ShapeMove[]).map((m) => ({ value: m, label: SHAPE_MOVE_LABELS[m] }));

const DIR_OPTIONS = [
  { value: "right", label: "Jobbra →" },
  { value: "left", label: "← Balra" },
];

// Az általános "Alak" blokk paraméterkészlete – a kész alakok is ezt használják
// eltérő alapértékekkel, így mindegyik tovább szabható.
// A paraméterek tartalomhoz illő csoportokba rendeződnek: megjelenés, szerep, mozgás, elhelyezés.
function shapeParams(d: {
  style?: string; role?: string; move?: string; speed?: number;
  x?: number; y?: number; size?: number; color?: string;
  height?: number; value?: number; randomX?: boolean; sticky?: boolean;
  spin?: boolean; opacity?: number; count?: number; direction?: string;
}): BlockParamDef[] {
  return [
    sel("style", "Stílus", d.style ?? "ball", SHAPE_STYLE_OPTIONS, "Megjelenés"),
    slide("size", "Méret", d.size ?? 30, 8, 120, 1, "Megjelenés"),
    { key: "color", label: "Szín", type: "color", default: d.color ?? "#fbbf24", group: "Megjelenés" },
    slide("opacity", "Átlátszóság (%)", d.opacity ?? 100, 10, 100, 5, "Megjelenés"),
    { key: "spin", label: "Pörgés (saját tengelye körül)", type: "toggle", default: d.spin ?? false, group: "Megjelenés" },
    sel("role", "Szerep", d.role ?? "deco", ROLE_OPTIONS, "Szerep a játékban"),
    num("value", "Pontérték (gyűjtendőknél)", d.value ?? 5, 1, 100, 1, "Szerep a játékban"),
    num("height", "Magasság (akadálynál)", d.height ?? 26, 4, 200, 1, "Szerep a játékban"),
    { key: "sticky", label: "Ragadós (a kompozíció végéig marad)", type: "toggle", default: d.sticky ?? true, group: "Szerep a játékban" },
    sel("move", "Mozgás", d.move ?? "static", MOVE_OPTIONS, "Mozgás"),
    num("speed", "Mozgás-sebesség", d.speed ?? 60, 0, 400, 5, "Mozgás"),
    sel("direction", "Haladási irány", d.direction ?? "right", DIR_OPTIONS, "Mozgás"),
    num("x", "X pozíció", d.x ?? 50, 0, 100, 1, "Elhelyezés"),
    num("y", "Y pozíció", d.y ?? 50, -10, 100, 1, "Elhelyezés"),
    { key: "randomX", label: "Véletlen X helyen jelenjen meg", type: "toggle", default: d.randomX ?? false, group: "Elhelyezés" },
    num("count", "Mennyi jelenjen meg belőle", d.count ?? 1, 1, 12, 1, "Elhelyezés"),
  ];
}

// Kész "Alak" blokk előre beállított stílussal/szereppel/mozgással
function shapeBlock(
  id: string, label: string, description: string, icon: string,
  defaults: Parameters<typeof shapeParams>[0],
): BlockTypeDef {
  return { id, label, description, category: "graphics", icon, kind: "shape", defaultLength: 4, params: shapeParams(defaults) };
}

// Hang-blokkok közös, tartalomhoz illő paraméterei: hangerő, lejátszási sebesség, némítás
function sfxParams(volume: number): BlockParamDef[] {
  return [
    slide("volume", "Hangerő (%)", volume, 0, 100, 5, "Hang"),
    slide("speed", "Lejátszási sebesség (%)", 100, 25, 200, 5, "Hang"),
    { key: "mute", label: "Némítás (nem szól lejátszáskor)", type: "toggle", default: false, group: "Hang" },
  ];
}

// Zenei loop blokkok: mintázat + hangbeállítások
function musicParams(volume: number, extra: BlockParamDef[] = []): BlockParamDef[] {
  return [
    ...extra,
    slide("volume", "Hangerő (%)", volume, 0, 100, 5, "Hang"),
    slide("speed", "Lejátszási sebesség (%)", 100, 50, 200, 5, "Hang"),
    { key: "mute", label: "Némítás (nem szól lejátszáskor)", type: "toggle", default: false, group: "Hang" },
  ];
}

export const BLOCK_TYPES: BlockTypeDef[] = [
  // ---------- GRAFIKA ----------
  {
    id: "gfx.bg.preset",
    label: "Háttér (kész)",
    description: "Előre elkészített animált háttér: űr, naplemente, óceán, neon rács… A megjelenése után a kompozíció végéig látszik.",
    category: "graphics",
    icon: "Image",
    kind: "bg",
    defaultLength: 4,
    params: [
      sel("preset", "Típus", "space", [
        { value: "space", label: "Űr (csillagokkal)" },
        { value: "sunset", label: "Naplemente" },
        { value: "ocean", label: "Óceán" },
        { value: "forest", label: "Erdő" },
        { value: "neon", label: "Neon rács (synthwave)" },
        { value: "night", label: "Éjszakai város" },
        { value: "desert", label: "Sivatag (dűnékkel)" },
        { value: "mountains", label: "Havas hegyek" },
        { value: "snow", label: "Téli táj (havazás)" },
        { value: "candy", label: "Cukorborsó világ" },
        { value: "underwater", label: "Víz alatti világ" },
        { value: "road", label: "Országút (futópálya)" },
        { value: "city", label: "Város nappal" },
        { value: "moon", label: "Holdfelszín" },
      ], "Háttér"),
      slide("dim", "Sötétítés (%) – hogy a sprite-ok előre ugorjanak", 0, 0, 80, 5, "Háttér"),
    ],
  },
  {
    id: "gfx.bg.color",
    label: "Háttér (szín)",
    description: "Egyszínű vagy finom átmenetű háttér a kiválasztott színnel.",
    category: "graphics",
    icon: "Paintbrush",
    kind: "bg",
    defaultLength: 4,
    params: [
      { key: "color", label: "Szín (fent)", type: "color", default: "#1e1b4b", group: "Háttér" },
      { key: "gradient", label: "Átmenet fentről lefelé", type: "toggle", default: false, group: "Háttér" },
      { key: "color2", label: "Szín lent (átmenetnél)", type: "color", default: "#0ea5e9", group: "Háttér" },
      slide("dim", "Sötétítés (%)", 0, 0, 80, 5, "Háttér"),
    ],
  },
  shapeBlock("gfx.sprite.ship", "Űrhajó (játékos)", "A játékost irányító űrhajó. A Bemenet sávokon lévő blokkokkal irányítható, a lövedékek innen indulnak. Színe, mérete, sebessége és pörgése is állítható.", "Rocket", { style: "ship", role: "player", move: "static", x: 50, y: 82, size: 34, color: "#fbbf24", sticky: true }),
  shapeBlock("gfx.sprite.meteor", "Meteor (ellenség)", "Lezuhanó ellenség. Ha játékost ér: életet vesztesz. Ha lövedék találja el: pontot kapsz és eltűnik. Zuhanási sebessége, mérete, színe, pörgése és darabszáma állítható.", "CircleDot", { style: "meteor", role: "enemy", move: "fall", speed: 55, x: 50, size: 26, color: "#9ca3af", spin: true, sticky: false }),
  shapeBlock("gfx.sprite.star", "Csillag (gyűjtendő)", "Összegyűjthető csillag: ha a játékos hozzáér, pontot ad és érmehang szól. Pontértéke, mérete, színe állítható.", "Star", { style: "star", role: "pickup", move: "static", x: 50, y: 40, size: 18, value: 5, color: "#fde047", sticky: true }),
  shapeBlock("gfx.sprite.cloud", "Felhő (dísz)", "Lassan sodródó díszelem – nem ütközik semmivel, csak hangulatot ad. Az irány, a sebesség és az átlátszóság is állítható.", "Cloud", { style: "cloud", role: "deco", move: "drift", speed: 12, x: 20, y: 25, size: 36, color: "#e2e8f0", sticky: true }),
  {
    id: "gfx.text",
    label: "Szöveg",
    description: "Felirat a képernyőn. Ragadós módban a végéig marad, különben a blokk hosszáig látszik.",
    category: "graphics",
    icon: "Type",
    kind: "text",
    defaultLength: 8,
    params: [
      txt("text", "Szöveg", "Szia!", "Tartalom"),
      sel("align", "Igazítás", "center", [
        { value: "center", label: "Középre" },
        { value: "left", label: "Balra" },
        { value: "right", label: "Jobbra" },
      ], "Tartalom"),
      num("x", "X pozíció", 50, 0, 100, 1, "Elhelyezés"),
      num("y", "Y pozíció", 20, 0, 100, 1, "Elhelyezés"),
      slide("size", "Betűméret", 28, 10, 72, 1, "Megjelenés"),
      { key: "color", label: "Szín", type: "color", default: "#ffffff", group: "Megjelenés" },
      { key: "fade", label: "Beúszás (fokozatosan jelenik meg)", type: "toggle", default: false, group: "Megjelenés" },
      { key: "sticky", label: "Ragadós (végig látszik)", type: "toggle", default: false, group: "Megjelenés" },
    ],
  },
  {
    id: "gfx.effect.explosion",
    label: "Robbanás effekt",
    description: "Részecskerobbanás a megadott ponton – tisztán vizuális, hang nélkül.",
    category: "graphics",
    icon: "Sparkles",
    kind: "effect",
    defaultLength: 1,
    params: [
      num("x", "X pozíció", 50, 0, 100, 1, "Elhelyezés"),
      num("y", "Y pozíció", 50, 0, 100, 1, "Elhelyezés"),
      num("count", "Részecskeszám", 26, 6, 90, 1, "Robbanás"),
      slide("power", "Erő (részecskék sebessége)", 180, 60, 420, 10, "Robbanás"),
      { key: "color", label: "Szín", type: "color", default: "#fb923c", group: "Robbanás" },
    ],
  },
  {
    id: "gfx.effect.flash",
    label: "Villanás",
    description: "Rövid, teljes képernyős villanás – pl. találatok jelzésére.",
    category: "graphics",
    icon: "Zap",
    kind: "effect",
    defaultLength: 1,
    params: [
      { key: "color", label: "Szín", type: "color", default: "#ffffff" },
      num("strength", "Erősség", 60, 10, 100),
    ],
  },
  {
    id: "gfx.effect.fireworks",
    label: "Tűzijáték",
    description: "Véletlenszerű helyeken felrobbanó színes tűzijáték-sorozat.",
    category: "graphics",
    icon: "PartyPopper",
    kind: "effect",
    defaultLength: 4,
    params: [
      num("count", "Robbanások száma", 3, 1, 8),
    ],
  },
  {
    id: "gfx.effect.rain",
    label: "Eső",
    description: "Beindítja (vagy leállítja) a folyamatos esőzést a képernyőn – hangulathoz, vidám játékokhoz.",
    category: "graphics",
    icon: "CloudRain",
    kind: "effect",
    defaultLength: 4,
    params: [
      sel("mode", "Mód", "on", [
        { value: "on", label: "Eső elindítása" },
        { value: "off", label: "Eső leállítása" },
      ]),
      slide("strength", "Erősség", 60, 10, 100),
    ],
  },
  {
    id: "gfx.effect.snowfall",
    label: "Hóesés",
    description: "Lassan hulló hópelyhek – téli és ünnepi hangulathoz.",
    category: "graphics",
    icon: "CloudSnow",
    kind: "effect",
    defaultLength: 4,
    params: [
      sel("mode", "Mód", "on", [
        { value: "on", label: "Hóesés elindítása" },
        { value: "off", label: "Hóesés leállítása" },
      ]),
      slide("strength", "Erősség", 60, 10, 100),
    ],
  },
  {
    id: "gfx.effect.confetti",
    label: "Konfetti",
    description: "Színes konfettiszemök hullanak alfelül – ünnepléshez, nyereményhez.",
    category: "graphics",
    icon: "BadgeCheck",
    kind: "effect",
    defaultLength: 4,
    params: [
      num("count", "Szemek száma", 120, 20, 400),
    ],
  },
  {
    id: "gfx.effect.lightning",
    label: "Villámlás",
    description: "Villám csap le a képernyőn, villanással és mennydörgéssel.",
    category: "graphics",
    icon: "Zap",
    kind: "effect",
    defaultLength: 2,
    params: [],
  },
  {
    id: "gfx.effect.shake",
    label: "Képernyőrázás",
    description: "A teljes képernyő megrázódik – találatnál, ütközésnél.",
    category: "graphics",
    icon: "Activity",
    kind: "effect",
    defaultLength: 1,
    params: [
      slide("strength", "Erősség", 14, 4, 40),
    ],
  },

  // ---------- ÁLTALÁNOS ALAK + KÉSZ ALAKOK ----------
  {
    id: "gfx.shape",
    label: "Alak (szabadon)",
    description: "A leghatékonyabb blokk: válassz stílust (30 alakzat), szerepet (játékos, ellenség, gyűjtendő, dísz, akadály) és mozgást (zuhanás, pattogás, üldözés, keringés…) – ebből több száz variáció születhet!",
    category: "graphics",
    icon: "Shapes",
    kind: "shape",
    defaultLength: 4,
    params: shapeParams({ style: "ball", role: "deco", move: "static", y: 50, size: 30, color: "#fbbf24" }),
  },
  shapeBlock("gfx.sprite.platform", "Platform / talaj", "Tömör akadály, amire a játékos ráléphet (Ugrálás módban). A méret a szélesség, külön állítható a magasság is.", "Layers", { style: "cube", role: "platform", move: "static", x: 50, y: 92, size: 60, height: 26, color: "#78716c", sticky: true }),
  shapeBlock("gfx.sprite.ghost", "Szellem (üldöző)", "Folyamatosan a játékost kergeti – akciósolásra, labirintusjátékokhoz.", "Ghost", { style: "ghost", role: "enemy", move: "chase", speed: 90, x: 50, y: 10, size: 30, color: "#e2e8f0", sticky: true }),
  shapeBlock("gfx.sprite.bomb", "Bomba (zuhanó)", "Függőlegesen lezuhanó bomba – ha eltalálja a játékost, életet veszít.", "Bomb", { style: "bomb", role: "enemy", move: "fall", speed: 120, x: 50, y: -6, size: 26, color: "#52525b", sticky: false, randomX: false }),
  shapeBlock("gfx.sprite.coin", "Érme (pattogó)", "Pattogó aranyérme, amit begyűjthet a játékos – platformerjátékok kedvence.", "Coins", { style: "coin", role: "pickup", move: "bounce", speed: 150, x: 50, y: 60, size: 20, value: 10, color: "#fbbf24", sticky: true }),
  shapeBlock("gfx.sprite.balloon", "Lufi (emelkedő)", "Felfele szálló lufi – vigyázz, nehogy eltalálja a játékost, vagy gyűjtsd be pontért!", "Circle", { style: "balloon", role: "pickup", move: "rise", speed: 70, x: 50, y: 105, size: 24, value: 5, color: "#f87171", sticky: false }),
  shapeBlock("gfx.sprite.fish", "Hal (úszkáló)", "Oldalra úszkáló hal – víz alatti jelenetekhez, gyűjtögetéshez vagy akadálynak.", "Fish", { style: "fish", role: "deco", move: "drift", speed: 60, x: 0, y: 60, size: 32, color: "#38bdf8", sticky: true }),
  shapeBlock("gfx.sprite.car", "Autó (sodródó)", "Vízszintes utakon haladó autó – kikerulós játékokhoz közlekedő akadályként.", "Car", { style: "car", role: "enemy", move: "drift", speed: 140, x: 0, y: 80, size: 40, color: "#ef4444", sticky: false }),
  shapeBlock("gfx.sprite.bird", "Madár (röpködő)", "Hullámosan röpködő madár, amely lassan lefelé ereszkedik – égi akadálynak.", "Bird", { style: "bird", role: "enemy", move: "wave", speed: 90, x: 50, y: 8, size: 26, color: "#fb7185", sticky: false }),
  shapeBlock("gfx.sprite.mushroom", "Gomba (bónusz)", "Lassan oldalra vándorló gomba – Mario-feeling: begyűjtve plusz életet ad!", "FlaskConical", { style: "mushroom", role: "pickup", move: "drift", speed: 40, x: 30, y: 80, size: 24, value: 5, color: "#ef4444", sticky: true }),
  shapeBlock("gfx.sprite.ufo", "UFO (keringő)", "Keringő repülő csészealj – nosztalgikus arcade akadály.", "Orbit", { style: "ufo", role: "enemy", move: "orbit", speed: 80, x: 50, y: 25, size: 36, color: "#a3e635", sticky: true }),
  shapeBlock("gfx.sprite.tree", "Fa (dísz)", "Dekoratív fa a tájhoz – nem mozog, csak feldobja a színteret.", "TreePine", { style: "tree", role: "deco", move: "static", x: 15, y: 82, size: 60, color: "#16a34a", sticky: true }),
  shapeBlock("gfx.sprite.house", "Ház (dísz)", "Kis ház – városi és falusias színterekhez, célpontnak is jó.", "Home", { style: "house", role: "deco", move: "static", x: 80, y: 78, size: 70, color: "#f97316", sticky: true }),
  shapeBlock("gfx.sprite.heart", "Szív (plusz élet)", "Begyűjtve egy plusz életet ad a játékosnak.", "Heart", { style: "heart", role: "pickup", move: "static", x: 70, y: 40, size: 24, value: 1, color: "#f87171", sticky: true }),
  shapeBlock("gfx.sprite.planet", "Bolygó (keringő)", "Keringő gyűrűs bolygó – űrjelenetek díszének.", "Orbit", { style: "planet", role: "deco", move: "orbit", speed: 30, x: 75, y: 25, size: 46, color: "#a78bfa", sticky: true }),
  shapeBlock("gfx.sprite.snowman", "Hóember (dísz)", "Vidám hóember téli jelenetekhez – két golyóból és kalapból.", "Snowflake", { style: "snowman", role: "deco", move: "static", x: 25, y: 80, size: 50, color: "#e2e8f0", sticky: true }),

  // ---------- HANG ----------
  {
    id: "sfx.laser",
    label: "Lövés hang",
    description: "Klasszikus lefelé csúszó lézer-pittyegés.",
    category: "sound",
    icon: "AudioWaveform",
    kind: "sfx",
    defaultLength: 1,
    params: sfxParams(70),
  },
  {
    id: "sfx.explosion",
    label: "Robbanás hang",
    description: "Mély, morajló robbanászaj.",
    category: "sound",
    icon: "Bomb",
    kind: "sfx",
    defaultLength: 2,
    params: sfxParams(80),
  },
  {
    id: "sfx.coin",
    label: "Érme hang",
    description: "Két gyors, felfelé ugró coin-hang.",
    category: "sound",
    icon: "Coins",
    kind: "sfx",
    defaultLength: 1,
    params: sfxParams(70),
  },
  {
    id: "sfx.blip",
    label: "Pitty",
    description: "Rövid, semleges jelzőhang.",
    category: "sound",
    icon: "Bell",
    kind: "sfx",
    defaultLength: 1,
    params: sfxParams(60),
  },
  {
    id: "sfx.swoosh",
    label: "Suhintás",
    description: "Halk, átfújó suhanás.",
    category: "sound",
    icon: "Wind",
    kind: "sfx",
    defaultLength: 2,
    params: sfxParams(60),
  },
  {
    id: "sfx.alarm",
    label: "Riasztás",
    description: "Két hangváltású sziréna – figyelemfelhívásra.",
    category: "sound",
    icon: "Siren",
    kind: "sfx",
    defaultLength: 4,
    params: sfxParams(60),
  },
  {
    id: "sfx.jump",
    label: "Ugrás hang",
    description: "Felfelé svungoló boing – platformerugráshoz.",
    category: "sound",
    icon: "ChevronsUp",
    kind: "sfx",
    defaultLength: 1,
    params: sfxParams(70),
  },
  {
    id: "sfx.powerup",
    label: "Bónusz fanfár",
    description: "Felfelé száguldó arpeggio – erősödésnél, pluszéletnél.",
    category: "sound",
    icon: "PartyPopper",
    kind: "sfx",
    defaultLength: 2,
    params: sfxParams(75),
  },
  {
    id: "sfx.hurt",
    label: "Találat / sérülés",
    description: "Rövid, mély „Öh!” – amikor a játékost eléri egy ellenség.",
    category: "sound",
    icon: "HeartCrack",
    kind: "sfx",
    defaultLength: 1,
    params: sfxParams(75),
  },
  {
    id: "sfx.win",
    label: "Győzelmi fanfár",
    description: "Négynemős, emelkedő fanfár – célbaérésnél, szintteljesítésnél.",
    category: "sound",
    icon: "Trophy",
    kind: "sfx",
    defaultLength: 4,
    params: sfxParams(80),
  },
  {
    id: "sfx.gameover",
    label: "Játék vége dallam",
    description: "Lefelé hulló, szomorú kis dallam – vesztésnél.",
    category: "sound",
    icon: "TrendingDown",
    kind: "sfx",
    defaultLength: 4,
    params: sfxParams(75),
  },
  {
    id: "sfx.pop",
    label: "Pukkanás",
    description: "Lekerekedett, rövid pukkanás – buboréknak, gombnak, felugrásnak.",
    category: "sound",
    icon: "Circle",
    kind: "sfx",
    defaultLength: 1,
    params: sfxParams(65),
  },
  {
    id: "sfx.click",
    label: "Gomb kattanás",
    description: "Száraz, rövid kattanás – alkalmazásgombokhoz, menükhöz.",
    category: "sound",
    icon: "MousePointerClick",
    kind: "sfx",
    defaultLength: 1,
    params: sfxParams(60),
  },
  {
    id: "sfx.thunder",
    label: "Mennydörgés",
    description: "Mély, dörgő zúgás – villámláshoz, drámai pillanatokhoz.",
    category: "sound",
    icon: "CloudLightning",
    kind: "sfx",
    defaultLength: 3,
    params: sfxParams(80),
  },
  {
    id: "music.beat",
    label: "Ütem (dob)",
    description: "Szintetizált dobloop: kick + hihat + snare. A blokk hosszáig szól.",
    category: "sound",
    icon: "Drum",
    kind: "music",
    defaultLength: 8,
    params: musicParams(70, [
      sel("pattern", "Ritmus", "techno", [
        { value: "techno", label: "Techno (dörög)" },
        { value: "house", label: "House (laza)" },
        { value: "lounge", label: "Lounge (finom)" },
      ], "Minta"),
    ]),
  },
  {
    id: "music.bass",
    label: "Basszus loop",
    description: "Lüktető basszusvonal – jól passzol az ütemekhez.",
    category: "sound",
    icon: "AudioLines",
    kind: "music",
    defaultLength: 8,
    params: musicParams(65, [
      sel("pattern", "Mintázat", "dark", [
        { value: "dark", label: "Sötét" },
        { value: "bouncy", label: "Pattogós" },
        { value: "walk", label: "Sétáló" },
      ], "Minta"),
    ]),
  },
  {
    id: "music.pad",
    label: "Áradó akkord",
    description: "Hosszan elfújt, lágy akkordpárnát ad a hangzás alá.",
    category: "sound",
    icon: "Waves",
    kind: "music",
    defaultLength: 8,
    params: musicParams(55, [
      sel("chord", "Akkord", "minor", [
        { value: "minor", label: "Moll (melankolikus)" },
        { value: "major", label: "Dúr (derűs)" },
        { value: "sus", label: "Szuszpendált (lebegős)" },
      ], "Minta"),
    ]),
  },
  {
    id: "music.arpeggio",
    label: "Arpeggio",
    description: "Gyorsan futó hangjegy-sor a skálán – very Music Maker feeling.",
    category: "sound",
    icon: "Music4",
    kind: "music",
    defaultLength: 8,
    params: musicParams(60, [
      sel("scale", "Skála", "minor", [
        { value: "minor", label: "Moll" },
        { value: "major", label: "Dúr" },
        { value: "pentatonic", label: "Pentaton" },
      ], "Minta"),
    ]),
  },
  {
    id: "music.rock",
    label: "Rock riff",
    description: "Torzított gitár-kiff + kemény dob – akcióscenékhez.",
    category: "sound",
    icon: "Guitar",
    kind: "music",
    defaultLength: 8,
    params: musicParams(65, [
      sel("pattern", "Riff", "power", [
        { value: "power", label: "Power (kemény)" },
        { value: "punk", label: "Punk (gyors)" },
      ], "Minta"),
    ]),
  },
  {
    id: "music.chip",
    label: "Chiptune",
    description: "8 bites, retro konzolos hangzás – klasszikus játék-feeling.",
    category: "sound",
    icon: "Gamepad2",
    kind: "music",
    defaultLength: 8,
    params: musicParams(55, [
      sel("tune", "Dallam", "adventure", [
        { value: "adventure", label: "Kaland" },
        { value: "happy", label: "Vidám" },
      ], "Minta"),
    ]),
  },
  {
    id: "music.waltz",
    label: "Keringő",
    description: "Elegáns 3/4-es oom-pah-pah – báloshoz, mesékhez.",
    category: "sound",
    icon: "Music",
    kind: "music",
    defaultLength: 8,
    params: musicParams(55, [
      sel("chord", "Hangnem", "major", [
        { value: "major", label: "Dúr (derűs)" },
        { value: "minor", label: "Moll (szomorú)" },
      ], "Minta"),
    ]),
  },
  {
    id: "music.hiphop",
    label: "Hip-hop beat",
    description: "Lüktető boom-bap dobolás + mély basszus – urban hangulat.",
    category: "sound",
    icon: "Disc3",
    kind: "music",
    defaultLength: 8,
    params: musicParams(65),
  },
  {
    id: "music.ambient",
    label: "Áramló ambient",
    description: "Finoman lebegő, álmodozó hangfoltok – nyugodt alkalmazásokhoz.",
    category: "sound",
    icon: "Sparkle",
    kind: "music",
    defaultLength: 8,
    params: musicParams(50),
  },

  // ---------- LOGIKA ----------
  {
    id: "logic.counter",
    label: "Számláló",
    description: "Egy változót növel (vagy csökkent) áthaladáskor – pl. körülfordulásszám.",
    category: "logic",
    icon: "Hash",
    kind: "counter",
    defaultLength: 1,
    params: [
      txt("variable", "Változó neve", "kor"),
      num("delta", "Növekmény", 1, -100, 100),
    ],
  },
  {
    id: "logic.check",
    label: "Feltételvizsgálat",
    description: "Ha a változó teljesíti a feltételt, végrehajt egy akciót: ugrás, felirat, hang vagy takarítás.",
    category: "logic",
    icon: "GitBranch",
    kind: "check",
    defaultLength: 1,
    params: [
      txt("variable", "Változó neve", "score"),
      sel("op", "Feltétel", ">=", [
        { value: ">=", label: "nagyobb vagy egyenlő" },
        { value: "<=", label: "kisebb vagy egyenlő" },
        { value: "==", label: "pontosan egyenlő" },
      ]),
      num("value", "Érték", 50, -999999, 999999),
      sel("action", "Akkor történjen", "text", [
        { value: "text", label: "Felirat megjelenítése" },
        { value: "jump", label: "Ugrás egy lépésre" },
        { value: "sound", label: "Hang lejátszása" },
        { value: "clear", label: "Képernyő takarítása" },
        { value: "win", label: "GYŐZELEM! (játék vége)" },
        { value: "lose", label: "Játék vége (vesztettél)" },
        { value: "lives", label: "Élet hozzáadása/levonása" },
        { value: "score", label: "Pont hozzáadása" },
      ]),
      txt("actionValue", "Felirat / cél / hang", "Új szint!"),
      num("x", "Felirat X pozíció", 50, 0, 100),
      num("y", "Felirat Y pozíció", 50, 0, 100),
    ],
  },
  {
    id: "logic.finish",
    label: "Győzelem / Játék vége",
    description: "Bekövetkezéskor megállítja a játékot: Győzelem overlay fanfárral, vagy Játék vége képernyő. Így lesz a kompozícióból lezárult játék.",
    category: "logic",
    icon: "Flag",
    kind: "finish",
    defaultLength: 1,
    params: [
      sel("mode", "Mód", "win", [
        { value: "win", label: "GYŐZELEM!" },
        { value: "lose", label: "Játék vége" },
      ]),
      txt("label", "Felirat", "Gratulálok!"),
    ],
  },
  {
    id: "logic.spawn",
    label: "Rendszeres megjelenítés",
    description: "Amíg a blokk tart, minden N. lépésben automatikusan megjelenik egy alak (pl. sorozatos ellenség vagy érmeeső). Az Alak blokkhoz hasonlóan beállítható.",
    category: "logic",
    icon: "CopyPlus",
    kind: "spawner",
    defaultLength: 8,
    params: [
      num("every", "Minden hányadik lépésben", 2, 1, 16, 1, "Ütemezés"),
      num("count", "Mennyi jelenjen meg egyszerre", 1, 1, 6, 1, "Ütemezés"),
      sel("style", "Stílus", "meteor", SHAPE_STYLE_OPTIONS, "Megjelenés"),
      slide("size", "Méret", 24, 8, 90, 1, "Megjelenés"),
      { key: "color", label: "Szín", type: "color", default: "#9ca3af", group: "Megjelenés" },
      slide("opacity", "Átlátszóság (%)", 100, 10, 100, 5, "Megjelenés"),
      { key: "spin", label: "Pörgés", type: "toggle", default: false, group: "Megjelenés" },
      sel("role", "Szerep", "enemy", [
        { value: "enemy", label: "Ellenség" },
        { value: "pickup", label: "Gyűjtendő (+pont)" },
        { value: "deco", label: "Díszelem" },
      ], "Szerep"),
      num("value", "Pontérték (gyűjtendő)", 5, 1, 100, 1, "Szerep"),
      sel("move", "Mozgás", "fall", MOVE_OPTIONS, "Mozgás"),
      num("speed", "Mozgás-sebesség", 80, 0, 400, 5, "Mozgás"),
      sel("direction", "Haladási irány", "right", DIR_OPTIONS, "Mozgás"),
      { key: "randomX", label: "Véletlen X helyen", type: "toggle", default: true, group: "Elhelyezés" },
    ],
  },
  {
    id: "logic.jump",
    label: "Ugrás",
    description: "A léptetőfej a megadott lépésre ugrik – így csinálhatsz végtelen ciklust vagy visszatérést.",
    category: "logic",
    icon: "Repeat",
    kind: "jump",
    defaultLength: 1,
    params: [num("target", "Cél lépés", 0, 0, 128)],
  },
  {
    id: "logic.random",
    label: "Véletlen esemény",
    description: "Adott eséllyel bekövetkezik: ugrás vagy felirat. Generatív meglepetésekhez.",
    category: "logic",
    icon: "Dices",
    kind: "check",
    defaultLength: 1,
    params: [
      num("chance", "Esély (%)", 50, 1, 100),
      sel("action", "Történjen", "text", [
        { value: "text", label: "Felirat megjelenítése" },
        { value: "jump", label: "Ugrás egy lépésre" },
      ]),
      txt("actionValue", "Felirat / cél", "Szerencsés!"),
      num("x", "Felirat X pozíció", 50, 0, 100),
      num("y", "Felirat Y pozíció", 50, 0, 100),
    ],
  },
  {
    id: "logic.clear",
    label: "Takarítás",
    description: "Törli a képernyő tartalmát: mindent, csak az ellenségeket vagy csak a díszeket.",
    category: "logic",
    icon: "Eraser",
    kind: "clear",
    defaultLength: 1,
    params: [
      sel("mode", "Mit töröljön", "enemies", [
        { value: "all", label: "Mindent (kivéve játékos)" },
        { value: "enemies", label: "Csak ellenségeket" },
        { value: "deco", label: "Csak díszeket és szövegeket" },
      ]),
    ],
  },

  // ---------- BEMENET ----------
  {
    id: "input.keyboard",
    label: "Billentyű-irányítás",
    description: "Amíg a blokk tart, a nyilak/WASD mozgatják a játékost. Három mód: Szabad (minden irány), Ugrálás (gravitáció + platformok, Szóköz=ugrás, ugrálva fejeletörés!) vagy Csak vízszintes.",
    category: "input",
    icon: "Keyboard",
    kind: "keyboard",
    defaultLength: 32,
    params: [
      sel("mode", "Mód", "free", [
        { value: "free", label: "Szabad (minden irány)" },
        { value: "jump", label: "Ugrálás (gravitáció + platformok)" },
        { value: "horizontal", label: "Csak vízszintes" },
      ]),
      num("speed", "Mozgás sebesség", 220, 40, 600),
      num("jump", "Ugróerő", 620, 200, 1000),
    ],
  },
  {
    id: "input.pointer",
    label: "Egér / ujj követése",
    description: "Amíg a blokk tart, a játékos követi az egeret (mobilon az ujjat) – kisgyerekes játékokhoz, mágneses élményhez.",
    category: "input",
    icon: "Hand",
    kind: "pointer",
    defaultLength: 32,
    params: [
      slide("smooth", "Követés lassúsága", 70, 5, 100),
    ],
  },
  {
    id: "input.click",
    label: "Kattintás / koppintás",
    description: "Amíg a blokk tart, a képernyőre kattintva lőhetsz vagy szerezhetsz dolgokat.",
    category: "input",
    icon: "MousePointerClick",
    kind: "click",
    defaultLength: 32,
    params: [
      sel("mode", "Mód", "shoot", [
        { value: "shoot", label: "Lövés a kattintás pontjára" },
        { value: "star", label: "Csillag jelenik meg a kattintásnál" },
        { value: "meteor", label: "Meteor hullik a kattintásnál" },
      ]),
    ],
  },

  // ---------- APP ----------
  {
    id: "ui.choice",
    label: "Választó gombok",
    description: "Kérdést és 2–4 válaszgombot jelenít meg a képernyő alján. Kattintáskor a változó a gomb sorszámát kapja (1, 2, 3…) és opcionálisan ugorhat. Kvízekhez, menükhez, döntési pontokhoz!",
    category: "ui",
    icon: "ListChecks",
    kind: "choice",
    defaultLength: 8,
    params: [
      txt("question", "Kérdés", "Melyik ajtót nyitod ki?"),
      txt("options", "Válaszok (vesszővel)", "Bal ajtó,Jobb ajtó"),
      txt("variable", "Változó neve", "valasztas"),
      num("target", "Ugrás erre a lépésre (0 = nincs)", 0, 0, 128),
    ],
  },
  {
    id: "ui.bubble",
    label: "Beszédbuborék",
    description: "Szereplő melletti felirat-buborék – meséléshez, oktatáshoz, dialogusokhoz.",
    category: "ui",
    icon: "MessageCircle",
    kind: "text",
    defaultLength: 6,
    params: [
      txt("text", "Szöveg", "Szia, jó játék ez!", "Tartalom"),
      num("x", "X pozíció", 50, 0, 100, 1, "Elhelyezés"),
      num("y", "Y pozíció", 30, 0, 100, 1, "Elhelyezés"),
      slide("size", "Betűméret", 20, 10, 48, 1, "Megjelenés"),
      { key: "color", label: "Szín", type: "color", default: "#f5f5f4", group: "Megjelenés" },
      { key: "fade", label: "Beúszás (fokozatosan jelenik meg)", type: "toggle", default: false, group: "Megjelenés" },
      { key: "sticky", label: "Ragadós (végig látszik)", type: "toggle", default: false, group: "Megjelenés" },
    ],
  },

  // ---------- ADAT ----------
  {
    id: "data.setvar",
    label: "Változó beállítása",
    description: "Beállít egy változó értékét (pl. score=0). A HUD-on élőben látod.",
    category: "data",
    icon: "Database",
    kind: "setvar",
    defaultLength: 1,
    params: [
      txt("variable", "Változó neve", "score"),
      num("value", "Érték", 0, -999999, 999999),
    ],
  },
  {
    id: "data.lives",
    label: "Életek",
    description: "Beállítja az életek számát. Ha 0-ra esik, vége a játéknak.",
    category: "data",
    icon: "Heart",
    kind: "setvar",
    defaultLength: 1,
    params: [num("value", "Életek", 3, 0, 20)],
  },
  {
    id: "data.save",
    label: "Mentés",
    description: "Elmenti a jelenlegi változókat a böngészőbe – később betöltheted.",
    category: "data",
    icon: "Save",
    kind: "save",
    defaultLength: 1,
    params: [],
  },
  {
    id: "data.load",
    label: "Betöltés",
    description: "Visszatölti a legutóbb mentett változókat.",
    category: "data",
    icon: "FolderOpen",
    kind: "load",
    defaultLength: 1,
    params: [],
  },
];

export function getBlockType(typeId: string): BlockTypeDef | undefined {
  if (typeId.startsWith("custom:")) return undefined;
  return BLOCK_TYPES.find((t) => t.id === typeId);
}

// Saját tartalomból készített blokktípusok
export function customImageTypeDef(assetName: string): BlockTypeDef {
  return {
    id: "custom.image",
    label: assetName,
    description: "Feltöltött kép – lehet dísz, játékos, ellenség, gyűjtendő vagy háttér.",
    category: "custom",
    icon: "ImagePlus",
    kind: "customImage",
    defaultLength: 4,
    params: [
      sel("mode", "Szerep", "deco", [
        { value: "deco", label: "Díszelem" },
        { value: "player", label: "Játékos" },
        { value: "enemy", label: "Ellenség" },
        { value: "pickup", label: "Gyűjtendő (+pont)" },
        { value: "platform", label: "Akadály / platform" },
        { value: "bg", label: "Háttérkép" },
      ], "Szerep"),
      num("value", "Pontérték (gyűjtendő)", 5, 1, 100, 1, "Szerep"),
      { key: "sticky", label: "Ragadós", type: "toggle", default: true, group: "Szerep" },
      num("x", "X pozíció", 50, 0, 100, 1, "Elhelyezés"),
      num("y", "Y pozíció", 50, 0, 100, 1, "Elhelyezés"),
      num("vx", "Vízszintes sebesség", 0, -200, 200, 5, "Mozgás"),
      num("vy", "Függőleges sebesség", 0, -200, 200, 5, "Mozgás"),
      slide("size", "Méret", 40, 8, 120, 1, "Megjelenés"),
      slide("opacity", "Átlátszóság (%)", 100, 10, 100, 5, "Megjelenés"),
      num("height", "Magasság (akadálynál)", 30, 4, 200, 1, "Megjelenés"),
    ],
  };
}

export function customAudioTypeDef(assetName: string): BlockTypeDef {
  return {
    id: "custom.audio",
    label: assetName,
    description: "Feltöltött hang – lejátszódik, amikor a léptetőfej eléri.",
    category: "custom",
    icon: "FileAudio",
    kind: "customAudio",
    defaultLength: 4,
    params: sfxParams(80),
  };
}

// Kategóriánkénti csoportosítás a könyvtár panelhez
export const CATEGORY_ORDER: Category[] = ["graphics", "sound", "logic", "input", "ui", "data", "custom"];
