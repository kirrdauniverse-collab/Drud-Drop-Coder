import type { BlockTypeDef, Category } from "./types";

// ===== Előre definiált blokk-könyvtár =====
// Minden blokk: kategória, ikon, motor-"fajta", alap hossz (lépés) és paraméterek.

const num = (key: string, label: string, def: number, min: number, max: number, step = 1) =>
  ({ key, label, type: "number" as const, default: def, min, max, step });

const slide = (key: string, label: string, def: number, min: number, max: number, step = 1) =>
  ({ key, label, type: "slider" as const, default: def, min, max, step });

const sel = (key: string, label: string, def: string, options: { value: string; label: string }[]) =>
  ({ key, label, type: "select" as const, default: def, options });

const txt = (key: string, label: string, def: string) =>
  ({ key, label, type: "text" as const, default: def });

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
    params: [sel("preset", "Típus", "space", [
      { value: "space", label: "Űr (csillagokkal)" },
      { value: "sunset", label: "Naplemente" },
      { value: "ocean", label: "Óceán" },
      { value: "forest", label: "Erdő" },
      { value: "neon", label: "Neon rács (synthwave)" },
      { value: "night", label: "Éjszakai város" },
    ])],
  },
  {
    id: "gfx.bg.color",
    label: "Háttér (szín)",
    description: "Egyszínű vagy finom átmenetű háttér a kiválasztott színnel.",
    category: "graphics",
    icon: "Paintbrush",
    kind: "bg",
    defaultLength: 4,
    params: [{ key: "color", label: "Szín", type: "color", default: "#1e1b4b" }],
  },
  {
    id: "gfx.sprite.ship",
    label: "Űrhajó (játékos)",
    description: "A játékost irányító űrhajó. A Bemenet sávokon lévő blokkokkal irányítható, a lövedékek innen indulnak.",
    category: "graphics",
    icon: "Rocket",
    kind: "sprite",
    defaultLength: 4,
    params: [
      num("x", "X pozíció", 50, 0, 100),
      num("y", "Y pozíció", 80, 0, 100),
      slide("size", "Méret", 34, 12, 80),
      { key: "color", label: "Szín", type: "color", default: "#fbbf24" },
    ],
  },
  {
    id: "gfx.sprite.meteor",
    label: "Meteor (ellenség)",
    description: "Lezuhanó ellenség. Ha játékost ér: életet vesztesz. Ha lövedék találja el: pontot kapsz és eltűnik.",
    category: "graphics",
    icon: "CircleDot",
    kind: "sprite",
    defaultLength: 4,
    params: [
      num("x", "X pozíció", 50, 0, 100),
      num("vy", "Zuhanási sebesség", 55, 5, 300),
      slide("size", "Méret", 26, 10, 70),
      { key: "spin", label: "Pörgés", type: "toggle", default: true },
    ],
  },
  {
    id: "gfx.sprite.star",
    label: "Csillag (gyűjtendő)",
    description: "Összegyűjthető csillag: ha a játékos hozzáér, pontot ad és érmehang szól.",
    category: "graphics",
    icon: "Star",
    kind: "sprite",
    defaultLength: 4,
    params: [
      num("x", "X pozíció", 50, 0, 100),
      num("y", "Y pozíció", 40, 0, 100),
      slide("size", "Méret", 18, 8, 50),
      num("value", "Pontérték", 5, 1, 100),
    ],
  },
  {
    id: "gfx.sprite.cloud",
    label: "Felhő (dísz)",
    description: "Lassan sodródó díszelem – nem ütközik semmivel, csak hangulatot ad.",
    category: "graphics",
    icon: "Cloud",
    kind: "sprite",
    defaultLength: 4,
    params: [
      num("x", "X pozíció", 20, 0, 100),
      num("y", "Y pozíció", 25, 0, 100),
      num("vx", "Vízszintes sebesség", 12, -60, 60),
      slide("size", "Méret", 36, 12, 90),
      { key: "color", label: "Szín", type: "color", default: "#e2e8f0" },
    ],
  },
  {
    id: "gfx.text",
    label: "Szöveg",
    description: "Felirat a képernyőn. Ragadós módban a végéig marad, különben a blokk hosszáig látszik.",
    category: "graphics",
    icon: "Type",
    kind: "text",
    defaultLength: 8,
    params: [
      txt("text", "Szöveg", "Szia!"),
      num("x", "X pozíció", 50, 0, 100),
      num("y", "Y pozíció", 20, 0, 100),
      slide("size", "Betűméret", 28, 10, 72),
      { key: "color", label: "Szín", type: "color", default: "#ffffff" },
      { key: "sticky", label: "Ragadós (végig látszik)", type: "toggle", default: false },
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
      num("x", "X pozíció", 50, 0, 100),
      num("y", "Y pozíció", 50, 0, 100),
      num("count", "Részecskeszám", 26, 6, 90),
      { key: "color", label: "Szín", type: "color", default: "#fb923c" },
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

  // ---------- HANG ----------
  {
    id: "sfx.laser",
    label: "Lövés hang",
    description: "Klasszikus lefelé csúszó lézer-pittyegés.",
    category: "sound",
    icon: "AudioWaveform",
    kind: "sfx",
    defaultLength: 1,
    params: [slide("volume", "Hangerő", 70, 0, 100)],
  },
  {
    id: "sfx.explosion",
    label: "Robbanás hang",
    description: "Mély, morajló robbanászaj.",
    category: "sound",
    icon: "Bomb",
    kind: "sfx",
    defaultLength: 2,
    params: [slide("volume", "Hangerő", 80, 0, 100)],
  },
  {
    id: "sfx.coin",
    label: "Érme hang",
    description: "Két gyors, felfelé ugró coin-hang.",
    category: "sound",
    icon: "Coins",
    kind: "sfx",
    defaultLength: 1,
    params: [slide("volume", "Hangerő", 70, 0, 100)],
  },
  {
    id: "sfx.blip",
    label: "Pitty",
    description: "Rövid, semleges jelzőhang.",
    category: "sound",
    icon: "Bell",
    kind: "sfx",
    defaultLength: 1,
    params: [slide("volume", "Hangerő", 60, 0, 100)],
  },
  {
    id: "sfx.swoosh",
    label: "Suhintás",
    description: "Halk, átfújó suhanás.",
    category: "sound",
    icon: "Wind",
    kind: "sfx",
    defaultLength: 2,
    params: [slide("volume", "Hangerő", 60, 0, 100)],
  },
  {
    id: "sfx.alarm",
    label: "Riasztás",
    description: "Két hangváltású sziréna – figyelemfelhívásra.",
    category: "sound",
    icon: "Siren",
    kind: "sfx",
    defaultLength: 4,
    params: [slide("volume", "Hangerő", 60, 0, 100)],
  },
  {
    id: "music.beat",
    label: "Ütem (dob)",
    description: "Szintetizált dobloop: kick + hihat + snare. A blokk hosszáig szól.",
    category: "sound",
    icon: "Drum",
    kind: "music",
    defaultLength: 8,
    params: [
      sel("pattern", "Ritmus", "techno", [
        { value: "techno", label: "Techno (dörög)" },
        { value: "house", label: "House (laza)" },
        { value: "lounge", label: "Lounge (finom)" },
      ]),
      slide("volume", "Hangerő", 70, 0, 100),
    ],
  },
  {
    id: "music.bass",
    label: "Basszus loop",
    description: "Lüktető basszusvonal – jól passzol az ütemekhez.",
    category: "sound",
    icon: "AudioLines",
    kind: "music",
    defaultLength: 8,
    params: [
      sel("pattern", "Mintázat", "dark", [
        { value: "dark", label: "Sötét" },
        { value: "bouncy", label: "Pattogós" },
        { value: "walk", label: "Sétáló" },
      ]),
      slide("volume", "Hangerő", 65, 0, 100),
    ],
  },
  {
    id: "music.pad",
    label: "Áradó akkord",
    description: "Hosszan elfújt, lágy akkordpárnát ad a hangzás alá.",
    category: "sound",
    icon: "Waves",
    kind: "music",
    defaultLength: 8,
    params: [
      sel("chord", "Akkord", "minor", [
        { value: "minor", label: "Moll (melankolikus)" },
        { value: "major", label: "Dúr (derűs)" },
        { value: "sus", label: "Szuszpendált (lebegős)" },
      ]),
      slide("volume", "Hangerő", 55, 0, 100),
    ],
  },
  {
    id: "music.arpeggio",
    label: "Arpeggio",
    description: "Gyorsan futó hangjegy-sor a skálán – very Music Maker feeling.",
    category: "sound",
    icon: "Music4",
    kind: "music",
    defaultLength: 8,
    params: [
      sel("scale", "Skála", "minor", [
        { value: "minor", label: "Moll" },
        { value: "major", label: "Dúr" },
        { value: "pentatonic", label: "Pentaton" },
      ]),
      slide("volume", "Hangerő", 60, 0, 100),
    ],
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
      ]),
      txt("actionValue", "Felirat / cél / hang", "Új szint!"),
      num("x", "Felirat X pozíció", 50, 0, 100),
      num("y", "Felirat Y pozíció", 50, 0, 100),
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
    description: "Amíg a blokk tart, a nyilak/WASD mozgatják a játékost, a Space-szel lőhetsz.",
    category: "input",
    icon: "Keyboard",
    kind: "keyboard",
    defaultLength: 32,
    params: [num("speed", "Mozgás sebesség", 220, 40, 600)],
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
        { value: "star", label: "Csillag appears a kattintásnál" },
        { value: "meteor", label: "Meteor hullik a kattintásnál" },
      ]),
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
        { value: "bg", label: "Háttérkép" },
      ]),
      num("x", "X pozíció", 50, 0, 100),
      num("y", "Y pozíció", 50, 0, 100),
      num("vx", "Vízszintes sebesség", 0, -200, 200),
      num("vy", "Függőleges sebesség", 0, -200, 200),
      slide("size", "Méret", 40, 8, 120),
      num("value", "Pontérték (gyűjtendő)", 5, 1, 100),
      { key: "sticky", label: "Ragadós", type: "toggle", default: true },
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
    params: [slide("volume", "Hangerő", 80, 0, 100)],
  };
}

// Kategóriánkénti csoportosítás a könyvtár panelhez
export const CATEGORY_ORDER: Category[] = ["graphics", "sound", "logic", "input", "data", "custom"];
