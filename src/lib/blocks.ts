import type { BlockParamDef, BlockTypeDef, Category, ShapeMove, ShapeStyle } from "./types";
import { SHAPE_MOVE_LABELS } from "./types";
import { BG_PRESETS } from "./backgrounds";

// ===== Előre definiált blokk-könyvtár =====
// Minden blokk: kategória, ikon, motor-"fajta", alap hossz (lépés) és paraméterek.
// A könyvtár egy nagy "tömlő": minden sprite, háttér és hang SAJÁT, külön húzható
// elemként szerepel benne – ugyanabból többet is le lehet tenni a sávokra.

const num = (key: string, label: string, def: number, min: number, max: number, step = 1, group?: string) =>
  ({ key, label, type: "number" as const, default: def, min, max, step, group });

const slide = (key: string, label: string, def: number, min: number, max: number, step = 1, group?: string) =>
  ({ key, label, type: "slider" as const, default: def, min, max, step, group });

const sel = (key: string, label: string, def: string, options: { value: string; label: string }[], group?: string) =>
  ({ key, label, type: "select" as const, default: def, options, group });

const txt = (key: string, label: string, def: string, group?: string) =>
  ({ key, label, type: "text" as const, default: def, group });

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

// Az általános "Alak" blokk paraméterkészlete – a kész sprite-ok is ezt használják
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

// ===== SPRITE-KATALÓGUS – a bal oldali "tömlő" tartalma =====
// Minden bejegyzés külön húzható blokk, saját rajzzal és értelmes
// alap-beállításokkal (szerep, mozgás, sebesség, méret, szín).
export interface SpriteCatalogEntry {
  id: string;        // blokk azonosító
  style: ShapeStyle; // rajz-stílus
  label: string;
  description: string;
  icon: string;
  defaults: Parameters<typeof shapeParams>[0];
}

export const SPRITE_CATALOG: SpriteCatalogEntry[] = [
  // ---------- űr / klasszikus ----------
  { id: "gfx.sprite.ship", style: "ship", label: "Űrhajó (játékos)", description: "A játékost irányító űrhajó. A Bemenet sávokon lévő blokkokkal irányítható, a lövedékek innen indulnak.", icon: "Rocket", defaults: { style: "ship", role: "player", move: "static", x: 50, y: 82, size: 34, color: "#fbbf24", sticky: true } },
  { id: "gfx.sprite.meteor", style: "meteor", label: "Meteor (ellenség)", description: "Lezuhanó ellenség. Ha játékost ér: életet vesztesz, ha lövedék találja el: pontot kapsz.", icon: "CircleDot", defaults: { style: "meteor", role: "enemy", move: "fall", speed: 55, x: 50, size: 26, color: "#9ca3af", spin: true, sticky: false } },
  { id: "gfx.sprite.star", style: "star", label: "Csillag (gyűjtendő)", description: "Összegyűjthető csillag: ha a játékos hozzáér, pontot ad.", icon: "Star", defaults: { style: "star", role: "pickup", move: "static", x: 50, y: 40, size: 18, value: 5, color: "#fde047", sticky: true } },
  { id: "gfx.sprite.cloud", style: "cloud", label: "Felhő (dísz)", description: "Lassan sodródó díszelem – nem ütközik semmivel, csak hangulatot ad.", icon: "Cloud", defaults: { style: "cloud", role: "deco", move: "drift", speed: 12, x: 20, y: 25, size: 36, color: "#e2e8f0", sticky: true } },
  { id: "gfx.sprite.planet", style: "planet", label: "Bolygó (keringő)", description: "Gyűrűs bolygó, ami körbe-körbe kering – űrjelenetek díszének.", icon: "Orbit", defaults: { style: "planet", role: "deco", move: "orbit", speed: 30, x: 75, y: 25, size: 46, color: "#a78bfa", sticky: true } },
  { id: "gfx.sprite.moon", style: "moon", label: "Hold (lebegő)", description: "Felszálló hold – éjszakai jelenetek díszelemének.", icon: "Moon", defaults: { style: "moon", role: "deco", move: "rise", speed: 14, x: 70, y: 70, size: 34, color: "#e2e8f0", sticky: true } },
  { id: "gfx.sprite.rocket", style: "rocket", label: "Rakéta (felfelé)", description: "Felfelé száguldó rakéta lángcsóvával – ünnepléshez, indításokhoz.", icon: "Rocket", defaults: { style: "rocket", role: "deco", move: "rise", speed: 90, x: 30, y: 100, size: 32, color: "#f472b6", sticky: false } },
  { id: "gfx.sprite.ufo", style: "ufo", label: "UFO (keringő)", description: "Keringő repülő csészealj villogó fényekkel – nosztalgikus arcade akadály.", icon: "Orbit", defaults: { style: "ufo", role: "enemy", move: "orbit", speed: 80, x: 50, y: 25, size: 36, color: "#a3e635", sticky: true } },
  { id: "gfx.sprite.satellite", style: "satellite", label: "Műhold (lebegő)", description: "Napelemes műhold, ami finoman himbálózva lebeg az űrben.", icon: "Orbit", defaults: { style: "satellite", role: "deco", move: "static", x: 75, y: 30, size: 34, color: "#e2e8f0", sticky: true } },

  // ---------- egyszerű alakzatok ----------
  { id: "gfx.sprite.ball", style: "ball", label: "Labda (pattogó)", description: "Pattogó labda – puffogós játékokhoz, gyűjtögetéshez.", icon: "Circle", defaults: { style: "ball", role: "pickup", move: "bounce", speed: 150, x: 50, y: 60, size: 22, value: 5, color: "#f97316", sticky: true } },
  { id: "gfx.sprite.cube", style: "cube", label: "Kocka / doboz", description: "Egyszerű kocka – építőelem, dísz vagy akadály.", icon: "Box", defaults: { style: "cube", role: "deco", move: "static", x: 50, y: 50, size: 30, color: "#fbbf24", sticky: true } },
  { id: "gfx.sprite.platform", style: "cube", label: "Platform / talaj", description: "Tömör akadály, amire a játékos ráléphet (Ugrálás módban). A méret a szélesség.", icon: "Layers", defaults: { style: "cube", role: "platform", move: "static", x: 50, y: 92, size: 60, height: 26, color: "#78716c", sticky: true } },
  { id: "gfx.sprite.triangle", style: "triangle", label: "Háromszög", description: "Egyszerű háromszög – jelző, díszelem vagy tile.", icon: "Triangle", defaults: { style: "triangle", role: "deco", move: "static", x: 50, y: 50, size: 28, color: "#22d3ee", sticky: true } },
  { id: "gfx.sprite.diamond", style: "diamond", label: "Gyémánt", description: "Csillogó gyémánt – gyűjtendő drágakő.", icon: "Diamond", defaults: { style: "diamond", role: "pickup", move: "static", x: 50, y: 40, size: 24, value: 15, color: "#67e8f9", sticky: true } },
  { id: "gfx.sprite.heart", style: "heart", label: "Szív (plusz élet)", description: "Begyűjtve egy plusz életet ad a játékosnak.", icon: "Heart", defaults: { style: "heart", role: "pickup", move: "static", x: 70, y: 40, size: 24, value: 1, color: "#f87171", sticky: true } },
  { id: "gfx.sprite.bolt", style: "bolt", label: "Villámcsapás", description: "Lecsapó villám – gyors vizuális effekt vagy extra „ellenség”.", icon: "Zap", defaults: { style: "bolt", role: "deco", move: "fall", speed: 260, x: 50, size: 26, color: "#fde047", sticky: false } },
  { id: "gfx.sprite.gear", style: "gear", label: "Fogaskerék", description: "Pörgő fogaskerék – gépi hangulathoz, dekorációhoz.", icon: "Cog", defaults: { style: "gear", role: "deco", move: "static", x: 50, y: 50, size: 30, color: "#94a3b8", spin: true, sticky: true } },
  { id: "gfx.sprite.gem", style: "gem", label: "Drágakő", description: "Csiszolt drágakő – sokat érő gyűjtendő.", icon: "Gem", defaults: { style: "gem", role: "pickup", move: "static", x: 50, y: 40, size: 22, value: 25, color: "#a78bfa", sticky: true } },

  // ---------- természet ----------
  { id: "gfx.sprite.tree", style: "tree", label: "Fa (dísz)", description: "Dekoratív fenyőfa a tájhoz – nem mozog, csak feldobja a színteret.", icon: "TreePine", defaults: { style: "tree", role: "deco", move: "static", x: 15, y: 82, size: 60, color: "#16a34a", sticky: true } },
  { id: "gfx.sprite.flower", style: "flower", label: "Virág", description: "Színes virág – kertek, rétek díszelemének, gyűjtögetős játékokhoz.", icon: "Flower", defaults: { style: "flower", role: "pickup", move: "static", x: 40, y: 70, size: 22, value: 3, color: "#f472b6", sticky: true } },
  { id: "gfx.sprite.cactus", style: "cactus", label: "Kaktusz", description: "Cserepes kaktusz – sivatagi és western-jelenetekhez.", icon: "Sprout", defaults: { style: "cactus", role: "deco", move: "static", x: 80, y: 80, size: 44, color: "#16a34a", sticky: true } },
  { id: "gfx.sprite.sun", style: "sun", label: "Nap (sugárzó)", description: "Lassan emelkedő, sugaras nap – nappali jelenetekhez.", icon: "Sun", defaults: { style: "sun", role: "deco", move: "rise", speed: 10, x: 80, y: 30, size: 40, color: "#fbbf24", sticky: true } },
  { id: "gfx.sprite.snowflake", style: "snowflake", label: "Hópehely", description: "Lassan hulló hópehely – téli hangulathoz, gyűjtögetéshez.", icon: "Snowflake", defaults: { style: "snowflake", role: "pickup", move: "fall", speed: 40, x: 50, size: 20, value: 2, color: "#bae6fd", sticky: false } },
  { id: "gfx.sprite.snowman", style: "snowman", label: "Hóember (dísz)", description: "Vidám hóember kalappal – téli jelenetekhez.", icon: "Snowflake", defaults: { style: "snowman", role: "deco", move: "static", x: 25, y: 80, size: 50, color: "#e2e8f0", sticky: true } },
  { id: "gfx.sprite.apple", style: "apple", label: "Alma", description: "Lefelé hulló alma – gyümölcsszedős játékokhoz.", icon: "Apple", defaults: { style: "apple", role: "pickup", move: "fall", speed: 60, x: 50, size: 20, value: 5, color: "#ef4444", sticky: false } },
  { id: "gfx.sprite.egg", style: "egg", label: "Tojás", description: "Tojás – keltetős, gyűjtögetős játékokhoz.", icon: "Egg", defaults: { style: "egg", role: "pickup", move: "static", x: 50, y: 60, size: 20, value: 3, color: "#f5f5f4", sticky: true } },
  { id: "gfx.sprite.mushroom", style: "mushroom", label: "Gomba (bónusz)", description: "Lassan oldalra vándorló gomba – Mario-feeling: begyűjtve plusz pontot ad!", icon: "FlaskConical", defaults: { style: "mushroom", role: "pickup", move: "drift", speed: 40, x: 30, y: 80, size: 24, value: 5, color: "#ef4444", sticky: true } },

  // ---------- állatok ----------
  { id: "gfx.sprite.cat", style: "cat", label: "Cica", description: "Bajszos cica, ami oda-vissza sétálgat – kedves dísz vagy begyűjtendő.", icon: "Cat", defaults: { style: "cat", role: "deco", move: "patrol", speed: 50, x: 30, y: 85, size: 30, color: "#f59e0b", sticky: true } },
  { id: "gfx.sprite.dog", style: "dog", label: "Kutya", description: "Kutyus, aki sétálni visz – dísznek vagy háziállatnak.", icon: "Dog", defaults: { style: "dog", role: "deco", move: "patrol", speed: 60, x: 60, y: 85, size: 30, color: "#a16207", sticky: true } },
  { id: "gfx.sprite.bunny", style: "bunny", label: "Nyuszi", description: "Fülecsapdosó nyuszi – pattogva menekül, el lehet fogni pontért.", icon: "Rabbit", defaults: { style: "bunny", role: "pickup", move: "bounce", speed: 90, x: 50, y: 50, size: 24, value: 5, color: "#e2e8f0", sticky: true } },
  { id: "gfx.sprite.penguin", style: "penguin", label: "Pingvin", description: "Tipegő pingvin – jégen, vízparton, mesékben.", icon: "Bird", defaults: { style: "penguin", role: "deco", move: "patrol", speed: 45, x: 40, y: 88, size: 28, color: "#1e293b", sticky: true } },
  { id: "gfx.sprite.bee", style: "bee", label: "Méhecske", description: "Zümmögő méhecske, aki a játékost üldözi – kis gyors ellenség.", icon: "Bug", defaults: { style: "bee", role: "enemy", move: "chase", speed: 70, x: 50, y: 20, size: 20, color: "#fbbf24", sticky: true } },
  { id: "gfx.sprite.butterfly", style: "butterfly", label: "Lepke", description: "Szárnyaló lepke – hullámosan lebeg, dísznek vagy gyűjtendőnek.", icon: "Feather", defaults: { style: "butterfly", role: "deco", move: "wave", speed: 35, x: 50, y: 30, size: 24, color: "#f472b6", sticky: true } },
  { id: "gfx.sprite.dragon", style: "dragon", label: "Sárkány", description: "Szárny csapó, tüzes sárkány, aki a játékost üldözi – erős ellenség.", icon: "Flame", defaults: { style: "dragon", role: "enemy", move: "chase", speed: 85, x: 50, y: 20, size: 44, color: "#22c55e", sticky: true } },
  { id: "gfx.sprite.robot", style: "robot", label: "Robot", description: "Villogó szemű robot, aki őrjáratozik – sci-fi ellenség.", icon: "Bot", defaults: { style: "robot", role: "enemy", move: "patrol", speed: 55, x: 50, y: 78, size: 34, color: "#60a5fa", sticky: true } },
  { id: "gfx.sprite.spider", style: "spider", label: "Pók", description: "Csápoló pók, ami a játékos után mászik – alsó felé nyomuló ellenség.", icon: "Bug", defaults: { style: "spider", role: "enemy", move: "chase", speed: 60, x: 50, y: 30, size: 26, color: "#3f3f46", sticky: true } },
  { id: "gfx.sprite.frog", style: "frog", label: "Béka", description: "Nagy szemű béka – tóparti jelenetekhez, ugrálós játékokhoz.", icon: "Leaf", defaults: { style: "frog", role: "deco", move: "patrol", speed: 40, x: 50, y: 85, size: 28, color: "#4ade80", sticky: true } },
  { id: "gfx.sprite.turtle", style: "turtle", label: "Teknős", description: "Lassan úszó teknős – béka-tuning: lassú, de kitartó.", icon: "Turtle", defaults: { style: "turtle", role: "deco", move: "drift", speed: 20, x: 20, y: 80, size: 30, color: "#65a30d", sticky: true } },
  { id: "gfx.sprite.whale", style: "whale", label: "Bálna", description: "Vízsugarat fújó bálna – óceáni jelenetek nagy dísze.", icon: "Waves", defaults: { style: "whale", role: "deco", move: "drift", speed: 35, x: 20, y: 65, size: 50, color: "#0ea5e9", sticky: true } },
  { id: "gfx.sprite.octopus", style: "octopus", label: "Polip", description: "Tapogatózó polip – hullámzó mozgással lefelé ereszkedő ellenség.", icon: "Snail", defaults: { style: "octopus", role: "enemy", move: "wave", speed: 45, x: 50, y: 10, size: 32, color: "#c084fc", sticky: false } },
  { id: "gfx.sprite.crab", style: "crab", label: "Rák", description: "Ollós rák, aki a parton járkál – kikerülendő ellenség.", icon: "Shell", defaults: { style: "crab", role: "enemy", move: "patrol", speed: 65, x: 50, y: 85, size: 26, color: "#ef4444", sticky: true } },
  { id: "gfx.sprite.fish", style: "fish", label: "Hal (úszkáló)", description: "Oldalra úszkáló hal – víz alatti jelenetekhez, gyűjtögetéshez.", icon: "Fish", defaults: { style: "fish", role: "deco", move: "drift", speed: 60, x: 0, y: 60, size: 32, color: "#38bdf8", sticky: true } },
  { id: "gfx.sprite.bird", style: "bird", label: "Madár (röpködő)", description: "Hullámosan röpködő madár, amely lassan lefelé ereszkedik – égi akadálynak.", icon: "Bird", defaults: { style: "bird", role: "enemy", move: "wave", speed: 90, x: 50, y: 8, size: 26, color: "#fb7185", sticky: false } },
  { id: "gfx.sprite.ghost", style: "ghost", label: "Szellem (üldöző)", description: "Folyamatosan a játékost kergeti – akciósolásra, labirintusjátékokhoz.", icon: "Ghost", defaults: { style: "ghost", role: "enemy", move: "chase", speed: 90, x: 50, y: 10, size: 30, color: "#e2e8f0", sticky: true } },

  // ---------- tárgyak ----------
  { id: "gfx.sprite.car", style: "car", label: "Autó (sodródó)", description: "Vízszintesen haladó autó – kikerulós játékokhoz közlekedő akadályként.", icon: "Car", defaults: { style: "car", role: "enemy", move: "drift", speed: 140, x: 0, y: 80, size: 40, color: "#ef4444", sticky: false } },
  { id: "gfx.sprite.bomb", style: "bomb", label: "Bomba (zuhanó)", description: "Függőlegesen lezuhanó bomba – ha eltalálja a játékost, életet veszít.", icon: "Bomb", defaults: { style: "bomb", role: "enemy", move: "fall", speed: 120, x: 50, y: -6, size: 26, color: "#52525b", sticky: false } },
  { id: "gfx.sprite.coin", style: "coin", label: "Érme (pattogó)", description: "Pattogó aranyérme, amit begyűjthet a játékos – platformerjátékok kedvence.", icon: "Coins", defaults: { style: "coin", role: "pickup", move: "bounce", speed: 150, x: 50, y: 60, size: 20, value: 10, color: "#fbbf24", sticky: true } },
  { id: "gfx.sprite.balloon", style: "balloon", label: "Lufi (emelkedő)", description: "Felfelé szálló lufi – kapd el, mielőtt elfogy!", icon: "Circle", defaults: { style: "balloon", role: "pickup", move: "rise", speed: 70, x: 50, y: 105, size: 24, value: 5, color: "#f87171", sticky: false } },
  { id: "gfx.sprite.key", style: "key", label: "Kulcs", description: "Összegyűjtendő kulcs – ajtónyitáshoz, kincses ládikához.", icon: "KeyRound", defaults: { style: "key", role: "pickup", move: "static", x: 50, y: 40, size: 24, value: 10, color: "#fde047", sticky: true } },
  { id: "gfx.sprite.potion", style: "potion", label: "Főzet / ital", description: "Varázsfőzet – begyűjtve bónuszt ad.", icon: "FlaskConical", defaults: { style: "potion", role: "pickup", move: "static", x: 60, y: 50, size: 24, value: 8, color: "#a3e635", sticky: true } },
  { id: "gfx.sprite.shield", style: "shield", label: "Pajzs", description: "Védőpajzs – begyűjtve extra pontot ér.", icon: "Shield", defaults: { style: "shield", role: "pickup", move: "static", x: 40, y: 45, size: 26, value: 6, color: "#38bdf8", sticky: true } },
  { id: "gfx.sprite.sword", style: "sword", label: "Kard", description: "Ősi kard – nagy értékű gyűjtendő, fantasy-jelenetekhez.", icon: "Sword", defaults: { style: "sword", role: "pickup", move: "static", x: 70, y: 50, size: 30, value: 20, color: "#e2e8f0", sticky: true } },
  { id: "gfx.sprite.crown", style: "crown", label: "Korona", description: "Királyi korona – ritka, sok pontot érő trófea.", icon: "Crown", defaults: { style: "crown", role: "pickup", move: "static", x: 50, y: 30, size: 26, value: 50, color: "#fbbf24", sticky: true } },
  { id: "gfx.sprite.cake", style: "cake", label: "Torta", description: "Gyertyás torta – szülinapi jelenetekhez, édes gyűjtendő.", icon: "Cake", defaults: { style: "cake", role: "pickup", move: "static", x: 50, y: 70, size: 26, value: 12, color: "#f9a8d4", sticky: true } },
  { id: "gfx.sprite.donut", style: "donut", label: "Fánk", description: "Szórszokkal tűzdelt fánk – cukros gyűjtendő.", icon: "Donut", defaults: { style: "donut", role: "pickup", move: "static", x: 45, y: 60, size: 24, value: 6, color: "#f472b6", sticky: true } },
  { id: "gfx.sprite.gift", style: "gift", label: "Ajándék", description: "Masnis ajándékdoboz – meglepetés-pontokért.", icon: "Gift", defaults: { style: "gift", role: "pickup", move: "static", x: 60, y: 70, size: 26, value: 15, color: "#ef4444", sticky: true } },
  { id: "gfx.sprite.chest", style: "chest", label: "Kincsesláda", description: "Fém pántos kincsesláda – nagy fogás a kalandoroknak!", icon: "Package", defaults: { style: "chest", role: "pickup", move: "static", x: 75, y: 75, size: 30, value: 30, color: "#b45309", sticky: true } },
  { id: "gfx.sprite.door", style: "door", label: "Ajtó", description: "Faajtó kilinccsel – célpont, dísz vagy színjelenet-elem.", icon: "DoorOpen", defaults: { style: "door", role: "deco", move: "static", x: 80, y: 75, size: 40, color: "#92400e", sticky: true } },
  { id: "gfx.sprite.house", style: "house", label: "Ház (dísz)", description: "Kis ház – városi és falusias színterekhez, célpontnak is jó.", icon: "Home", defaults: { style: "house", role: "deco", move: "static", x: 80, y: 78, size: 70, color: "#f97316", sticky: true } },
  { id: "gfx.sprite.flag", style: "flag", label: "Zászló (cél)", description: "Célszalag-zászló – platformer pályák kitűzött céljaként: érjen hozzá a játékos!", icon: "Flag", defaults: { style: "flag", role: "deco", move: "static", x: 88, y: 55, size: 80, color: "#f43f5e", sticky: true } },
  { id: "gfx.sprite.castle", style: "castle", label: "Kastély", description: "Tornyos kastély kapuval – szintek végén, mesékben, kingdoms építéséhez.", icon: "Crown", defaults: { style: "castle", role: "deco", move: "static", x: 86, y: 74, size: 90, color: "#a8a29e", sticky: true } },
];

// A "Stílus" legördülő a katalógusból épül fel (a platform a kocka stílust használja)
export const SHAPE_STYLE_OPTIONS: { value: ShapeStyle; label: string }[] = (() => {
  const seen = new Set<string>();
  const out: { value: ShapeStyle; label: string }[] = [];
  for (const e of SPRITE_CATALOG) {
    if (seen.has(e.style)) continue;
    seen.add(e.style);
    out.push({ value: e.style, label: e.label.replace(/ \(.*\)$/, "") });
  }
  // A katalógusban nem szereplő, de rajzolható extra stílusok
  for (const extra of ["ghost", "fish", "bird"] as ShapeStyle[]) {
    if (!seen.has(extra)) out.push({ value: extra, label: extra });
  }
  return out;
})();

// Kész sprite-blokk előre beállított stílussal/szereppel/mozgással + könyvtár-előnézettel
function spriteBlock(e: SpriteCatalogEntry): BlockTypeDef {
  return {
    id: e.id,
    label: e.label,
    description: e.description,
    category: "graphics",
    icon: e.icon,
    kind: "shape",
    defaultLength: 4,
    params: shapeParams(e.defaults),
    group: "Sprite-ok",
    preview: { kind: "sprite", style: e.style, color: e.defaults.color ?? "#fbbf24" },
  };
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

// Háttér-blokk generálása: minden kész háttér külön blokk, de átkapcsolható
function bgBlock(preset: string, label: string, description: string, icon: string): BlockTypeDef {
  return {
    id: `gfx.bg.${preset}`,
    label: `Háttér: ${label}`,
    description,
    category: "graphics",
    icon,
    kind: "bg",
    defaultLength: 4,
    group: "Hátterek",
    preview: { kind: "bg", style: preset },
    params: [
      sel("preset", "Típus (átváltható)", preset, BG_PRESETS.map((p) => ({ value: p.value, label: p.label })), "Háttér"),
      slide("dim", "Sötétítés (%) – hogy a sprite-ok előre ugorjanak", 0, 0, 80, 5, "Háttér"),
    ],
  };
}

export const BLOCK_TYPES: BlockTypeDef[] = [
  // ---------- GRAFIKA: HÁTTEREK (20 kész háttér, külön-külön húzható) ----------
  bgBlock("space", "Űr", "Csillagos mélyűr – klasszikus űrhajós játékokhoz. Megjelenése után a kompozíció végéig látszik.", "Sparkles"),
  bgBlock("night", "Éjszakai város", "Éjjel ablakai világító felhőkarcolók – noir és neon hangulat.", "Moon"),
  bgBlock("sunset", "Naplemente", "Narancs-lila égbolt a lemenő nappal – romantikus vagy western jelenetekhez.", "Sunset"),
  bgBlock("sky", "Napos ég", "Kék ég sodródó felhőkkel és zöld réttel – vidám, napközbeni játékokhoz.", "CloudSun"),
  bgBlock("ocean", "Óceán", "Hullámzó tenger – vizes kalandokhoz, hajós játékokhoz.", "Waves"),
  bgBlock("underwater", "Víz alatti világ", "Kék mélység hínárral és fénysugarakkal – merülős jelenetekhez.", "Fish"),
  bgBlock("beach", "Tengerpart", "Ég, tenger, homok és egy napernyő – nyaralós hangulathoz.", "Umbrella"),
  bgBlock("forest", "Erdő", "Sűrű fenyves – kalandos túrákhoz, mesékhez.", "TreePine"),
  bgBlock("desert", "Sivatag", "Dűnés homoksivatag a tűző nappal – western játékokhoz.", "Sun"),
  bgBlock("mountains", "Havas hegyek", "Hófödte csúcsok – téli mászós kalandokhoz.", "MountainSnow"),
  bgBlock("snow", "Téli táj", "Szürke ég és friss hó – havas jelenetekhez (havazás effekt is van!).", "CloudSnow"),
  bgBlock("neon", "Neon rács", "Synthwave nap és mozgó neonrács – retro arcade hangulat.", "AudioWaveform"),
  bgBlock("city", "Város nappal", "Napsütötes háztömbök – utcai játékokhoz.", "Building2"),
  bgBlock("road", "Országút", "Futó sávokkal haladó út – autós játékokhoz, futásolsóhoz.", "Car"),
  bgBlock("moon", "Holdfelszín", "Szürke kráteres táj – holdraszállós jelenetekhez.", "CircleDot"),
  bgBlock("candy", "Cukorborsó világ", "Pasztell színű cukorvilág – gyerekes, édes játékokhoz.", "Candy"),
  bgBlock("rainbow", "Szivárványos ég", "Szivárvány felhőkkel – mesés, boldog jelenetekhez.", "Rainbow"),
  bgBlock("lava", "Lávafolyam", "Izzó lávarepedésekkel tűzveszélyes táj – vulkánjátékokhoz.", "Flame"),
  bgBlock("checker", "Sakktábla", "Klasszikus sakktábla minta – puzzle és logikai játékokhoz.", "LayoutGrid"),
  {
    id: "gfx.bg.color",
    label: "Háttér (saját színnel)",
    description: "Egyszínű vagy finom átmenetű háttér a kiválasztott színnel.",
    category: "graphics",
    icon: "Paintbrush",
    kind: "bg",
    defaultLength: 4,
    group: "Hátterek",
    params: [
      { key: "color", label: "Szín (fent)", type: "color", default: "#1e1b4b", group: "Háttér" },
      { key: "gradient", label: "Átmenet fentről lefelé", type: "toggle", default: false, group: "Háttér" },
      { key: "color2", label: "Szín lent (átmenetnél)", type: "color", default: "#0ea5e9", group: "Háttér" },
      slide("dim", "Sötétítés (%)", 0, 0, 80, 5, "Háttér"),
    ],
  },
  // Régi "Háttér (kész)" blokk – a mentett projektek miatt megmarad, de a könyvtárban már
  // az egyes hátterek külön szerepelnek
  {
    id: "gfx.bg.preset",
    label: "Háttér (kész)",
    description: "Előre elkészített animált háttér.",
    category: "graphics",
    icon: "Image",
    kind: "bg",
    defaultLength: 4,
    hidden: true,
    params: [
      sel("preset", "Típus", "space", BG_PRESETS.map((p) => ({ value: p.value, label: p.label })), "Háttér"),
      slide("dim", "Sötétítés (%) – hogy a sprite-ok előre ugorjanak", 0, 0, 80, 5, "Háttér"),
    ],
  },

  // ---------- GRAFIKA: SPRITE-OK (a katalógusból, ~59 darab) ----------
  ...SPRITE_CATALOG.map(spriteBlock),

  // Szabadon paraméterezhető alak – maradjon ez is, haladóknak
  {
    id: "gfx.shape",
    label: "Alak (szabadon)",
    description: "Válassz stílust (59 sprite), szerepet (játékos, ellenség, gyűjtendő, dísz, akadály) és mozgást (zuhanás, pattogás, üldözés, keringés…) – több száz variáció!",
    category: "graphics",
    icon: "Shapes",
    kind: "shape",
    defaultLength: 4,
    group: "Sprite-ok",
    params: shapeParams({ style: "ball", role: "deco", move: "static", y: 50, size: 30, color: "#fbbf24" }),
  },

  // ---------- GRAFIKA: SZÖVEG ----------
  {
    id: "gfx.text",
    label: "Szöveg",
    description: "Felirat a képernyőn. Ragadós módban a végéig marad, különben a blokk hosszáig látszik.",
    category: "graphics",
    icon: "Type",
    kind: "text",
    defaultLength: 8,
    group: "Szövegek",
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

  // ---------- GRAFIKA: EFFEKTEK ----------
  {
    id: "gfx.effect.explosion",
    label: "Robbanás effekt",
    description: "Részecskerobbanás a megadott ponton – tisztán vizuális, hang nélkül.",
    category: "graphics",
    icon: "Sparkles",
    kind: "effect",
    defaultLength: 1,
    group: "Effektek",
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
    group: "Effektek",
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
    group: "Effektek",
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
    group: "Effektek",
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
    group: "Effektek",
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
    description: "Színes konfettiszemek hullnak alfelül – ünnepléshez, nyereményhez.",
    category: "graphics",
    icon: "BadgeCheck",
    kind: "effect",
    defaultLength: 4,
    group: "Effektek",
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
    group: "Effektek",
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
    group: "Effektek",
    params: [
      slide("strength", "Erősség", 14, 4, 40),
    ],
  },

  // ---------- HANG: HANGHATÁSOK (25 db) ----------
  {
    id: "sfx.laser",
    label: "Lövés hang",
    description: "Klasszikus lefelé csúszó lézer-pittyegés.",
    category: "sound", icon: "AudioWaveform", kind: "sfx", defaultLength: 1, group: "Hanghatások",
    params: sfxParams(70),
  },
  {
    id: "sfx.explosion",
    label: "Robbanás hang",
    description: "Mély, morajló robbanászaj.",
    category: "sound", icon: "Bomb", kind: "sfx", defaultLength: 2, group: "Hanghatások",
    params: sfxParams(80),
  },
  {
    id: "sfx.coin",
    label: "Érme hang",
    description: "Két gyors, felfelé ugró coin-hang.",
    category: "sound", icon: "Coins", kind: "sfx", defaultLength: 1, group: "Hanghatások",
    params: sfxParams(70),
  },
  {
    id: "sfx.blip",
    label: "Pitty",
    description: "Rövid, semleges jelzőhang.",
    category: "sound", icon: "Bell", kind: "sfx", defaultLength: 1, group: "Hanghatások",
    params: sfxParams(60),
  },
  {
    id: "sfx.swoosh",
    label: "Suhintás",
    description: "Halk, átfújó suhanás.",
    category: "sound", icon: "Wind", kind: "sfx", defaultLength: 2, group: "Hanghatások",
    params: sfxParams(60),
  },
  {
    id: "sfx.alarm",
    label: "Riasztás",
    description: "Két hangváltású sziréna – figyelemfelhívásra.",
    category: "sound", icon: "Siren", kind: "sfx", defaultLength: 4, group: "Hanghatások",
    params: sfxParams(60),
  },
  {
    id: "sfx.jump",
    label: "Ugrás hang",
    description: "Felfelé svungoló boing – platformerugráshoz.",
    category: "sound", icon: "ChevronsUp", kind: "sfx", defaultLength: 1, group: "Hanghatások",
    params: sfxParams(70),
  },
  {
    id: "sfx.powerup",
    label: "Bónusz fanfár",
    description: "Felfelé száguldó arpeggio – erősödésnél, pluszéletnél.",
    category: "sound", icon: "PartyPopper", kind: "sfx", defaultLength: 2, group: "Hanghatások",
    params: sfxParams(75),
  },
  {
    id: "sfx.hurt",
    label: "Találat / sérülés",
    description: "Rövid, mély „Öh!” – amikor a játékost eléri egy ellenség.",
    category: "sound", icon: "HeartCrack", kind: "sfx", defaultLength: 1, group: "Hanghatások",
    params: sfxParams(75),
  },
  {
    id: "sfx.win",
    label: "Győzelmi fanfár",
    description: "Négyneműs, emelkedő fanfár – célbaérésnél, szintteljesítésnél.",
    category: "sound", icon: "Trophy", kind: "sfx", defaultLength: 4, group: "Hanghatások",
    params: sfxParams(80),
  },
  {
    id: "sfx.gameover",
    label: "Játék vége dallam",
    description: "Lefelé hulló, szomorú kis dallam – vesztésnél.",
    category: "sound", icon: "TrendingDown", kind: "sfx", defaultLength: 4, group: "Hanghatások",
    params: sfxParams(75),
  },
  {
    id: "sfx.pop",
    label: "Pukkanás",
    description: "Lekerekedett, rövid pukkanás – buboréknak, gombnak, felugrásnak.",
    category: "sound", icon: "Circle", kind: "sfx", defaultLength: 1, group: "Hanghatások",
    params: sfxParams(65),
  },
  {
    id: "sfx.click",
    label: "Gomb kattanás",
    description: "Száraz, rövid kattanás – alkalmazásgombokhoz, menükhöz.",
    category: "sound", icon: "MousePointerClick", kind: "sfx", defaultLength: 1, group: "Hanghatások",
    params: sfxParams(60),
  },
  {
    id: "sfx.thunder",
    label: "Mennydörgés",
    description: "Mély, dörgő zúgás – villámláshoz, drámai pillanatokhoz.",
    category: "sound", icon: "CloudLightning", kind: "sfx", defaultLength: 3, group: "Hanghatások",
    params: sfxParams(80),
  },
  {
    id: "sfx.boing",
    label: "Rugózás (boing)",
    description: "Felpattanó rugóhang – ugráláshoz, trambulinhoz, képregényes jelenetekhez.",
    category: "sound", icon: "ChevronsUp", kind: "sfx", defaultLength: 1, group: "Hanghatások",
    params: sfxParams(70),
  },
  {
    id: "sfx.chime",
    label: "Harangjáték",
    description: "Csillogó, hármas harangjáték – értesítésekhez, sikerélményhez.",
    category: "sound", icon: "BellRing", kind: "sfx", defaultLength: 3, group: "Hanghatások",
    params: sfxParams(60),
  },
  {
    id: "sfx.splash",
    label: "Csobbanás",
    description: "Vízcsobbanás cseppekkel – ugrásokhoz vízbe, esőhöz.",
    category: "sound", icon: "Droplets", kind: "sfx", defaultLength: 2, group: "Hanghatások",
    params: sfxParams(70),
  },
  {
    id: "sfx.drumroll",
    label: "Dobszóló",
    description: "Felgyorsuló dobszóló – feszült várakozáshoz, nyereményhirdetéshez.",
    category: "sound", icon: "Drum", kind: "sfx", defaultLength: 4, group: "Hanghatások",
    params: sfxParams(70),
  },
  {
    id: "sfx.phone",
    label: "Telefoncsengés",
    description: "Klasszikus kéttónusú csengés – hívásjelzés alkalmazásokhoz.",
    category: "sound", icon: "Phone", kind: "sfx", defaultLength: 4, group: "Hanghatások",
    params: sfxParams(65),
  },
  {
    id: "sfx.magic",
    label: "Varázscsengés",
    description: "Felfelé szökő csillagpor-arpeggio – varázsláshoz, átváltozáshoz.",
    category: "sound", icon: "Wand2", kind: "sfx", defaultLength: 2, group: "Hanghatások",
    params: sfxParams(65),
  },
  {
    id: "sfx.bubble",
    label: "Buborék",
    description: "Pukkanó vízbuborék – víz alatti jelenetekhez, szódáshoz.",
    category: "sound", icon: "Circle", kind: "sfx", defaultLength: 1, group: "Hanghatások",
    params: sfxParams(60),
  },
  {
    id: "sfx.whistle",
    label: "Síp",
    description: "Rövid sípolás – kezdéshez, bíráskodáshoz, figyelemfelhíváshoz.",
    category: "sound", icon: "Megaphone", kind: "sfx", defaultLength: 1, group: "Hanghatások",
    params: sfxParams(70),
  },
  {
    id: "sfx.buzzer",
    label: "Mély berregő",
    description: "Rossz válasz berregése – kvízekhez, hibajelzéshez.",
    category: "sound", icon: "AlarmClock", kind: "sfx", defaultLength: 2, group: "Hanghatások",
    params: sfxParams(70),
  },
  {
    id: "sfx.ding",
    label: "Fém kongás",
    description: "Tiszta, hosszan zengő fémkongás – váltásnál, érkezésnél.",
    category: "sound", icon: "Bell", kind: "sfx", defaultLength: 3, group: "Hanghatások",
    params: sfxParams(60),
  },
  {
    id: "sfx.typewriter",
    label: "Gépírogatás",
    description: "Gyors gépelő kattogás – szöveges jelenetekhez, retro irodához.",
    category: "sound", icon: "Type", kind: "sfx", defaultLength: 3, group: "Hanghatások",
    params: sfxParams(60),
  },
  {
    id: "sfx.engine",
    label: "Motorzúgás",
    description: "Felbőgő motor – autókhoz, startvonalhoz, gépekhez.",
    category: "sound", icon: "Gauge", kind: "sfx", defaultLength: 3, group: "Hanghatások",
    params: sfxParams(70),
  },

  // ---------- HANG: ZENEI LOOPOK (14 db) ----------
  {
    id: "music.beat",
    label: "Ütem (dob)",
    description: "Szintetizált dobloop: kick + hihat + snare. A blokk hosszáig szól.",
    category: "sound", icon: "Drum", kind: "music", defaultLength: 8, group: "Zenei loopok",
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
    category: "sound", icon: "AudioLines", kind: "music", defaultLength: 8, group: "Zenei loopok",
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
    category: "sound", icon: "Waves", kind: "music", defaultLength: 8, group: "Zenei loopok",
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
    category: "sound", icon: "Music4", kind: "music", defaultLength: 8, group: "Zenei loopok",
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
    description: "Torzított gitár-riff + kemény dob – akciójelenetekhez.",
    category: "sound", icon: "Guitar", kind: "music", defaultLength: 8, group: "Zenei loopok",
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
    category: "sound", icon: "Gamepad2", kind: "music", defaultLength: 8, group: "Zenei loopok",
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
    category: "sound", icon: "Music", kind: "music", defaultLength: 8, group: "Zenei loopok",
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
    category: "sound", icon: "Disc3", kind: "music", defaultLength: 8, group: "Zenei loopok",
    params: musicParams(65),
  },
  {
    id: "music.ambient",
    label: "Áramló ambient",
    description: "Finoman lebegő, álmodozó hangfoltok – nyugodt alkalmazásokhoz.",
    category: "sound", icon: "Sparkle", kind: "music", defaultLength: 8, group: "Zenei loopok",
    params: musicParams(50),
  },
  {
    id: "music.samba",
    label: "Szamba",
    description: "Lendületes brazil ritmus sok pergővel – karnevárhoz, ünnepléshez.",
    category: "sound", icon: "Music2", kind: "music", defaultLength: 8, group: "Zenei loopok",
    params: musicParams(62),
  },
  {
    id: "music.disco",
    label: "Disco",
    description: "Négyzetes ütemű, csillogó disco – táncteremhez, retróhoz.",
    category: "sound", icon: "Disc", kind: "music", defaultLength: 8, group: "Zenei loopok",
    params: musicParams(62),
  },
  {
    id: "music.polka",
    label: "Pólka",
    description: "Vidám oompah-ritmus – népisebb hangulathoz, mulatságokhoz.",
    category: "sound", icon: "Music", kind: "music", defaultLength: 8, group: "Zenei loopok",
    params: musicParams(58),
  },
  {
    id: "music.reggae",
    label: "Reggae",
    description: "Laza off-beat akkordok és lüktető basszus – napos lazuláshoz.",
    category: "sound", icon: "Disc3", kind: "music", defaultLength: 8, group: "Zenei loopok",
    params: musicParams(60),
  },
  {
    id: "music.lullaby",
    label: "Altatódal",
    description: "Lassú, lágy dallam zenedobozzal – álmodozó jelenetekhez, gyerekeknek.",
    category: "sound", icon: "MoonStar", kind: "music", defaultLength: 8, group: "Zenei loopok",
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
  {
    id: "ui.menu",
    label: "Főmenü (kezdőképernyő)",
    description: "Teljes képernyős főmenü: cím, alcím és gombok. A léptetőfej MEGÁLL, míg a játékos választ – minden gomb beadhat egy lépés-ugrást (pl. Játék → 8. lépés, Pontlista → 2. lépés). Így lesz a kompozícióból igazi játék menüvel!",
    category: "ui",
    icon: "ListChecks",
    kind: "menu",
    defaultLength: 2,
    group: "Menük és listák",
    params: [
      txt("title", "Cím", "A JÁTÉKOM", "Menü"),
      txt("subtitle", "Alcím / szlogen", "Készült az AppMixerrel", "Menü"),
      txt("options", "Gombok (vesszővel elválasztva)", "Játék,Pontlista", "Menü"),
      txt("targets", "Ugrás lépésre gordonként (vesszővel)", "8,2", "Menü"),
      txt("variable", "Változó neve (a gomb sorszámát kapja)", "menu", "Menü"),
    ],
  },
  {
    id: "ui.board",
    label: "Táblás játék (amőba / 3-soros)",
    description: "Kattintásos táblajáték teljes képernyőn: amőba (nagy pályán 5-ös sor) vagy klasszikus 3-soros (3×3). Játszhatod barát vagy okos gép ellen – a léptető a parti végéig megáll. Győzelem +100, döntetlen +25 pont, aztán „Tovább” gombbal mehetsz tovább (ugrással is).",
    category: "ui",
    icon: "LayoutGrid",
    kind: "board",
    defaultLength: 4,
    group: "Menük és listák",
    params: [
      sel("mode", "Játék", "amoba", [
        { value: "amoba", label: "Amőba (5-ös sor, nagy pálya)" },
        { value: "3soros", label: "3-soros / tic-tac-toe (3×3)" },
      ], "Tábla"),
      num("size", "Pálya mérete (amőbánál)", 12, 5, 15, 1, "Tábla"),
      sel("opponent", "Ellenfél", "ai", [
        { value: "ai", label: "Gép (okos – nyer, blokkol, középre törekszik)" },
        { value: "human", label: "Barát (felváltva kattintotok)" },
      ], "Tábla"),
      txt("variable", "Eredmény változó (1=győztél, 2=ellenfél, 3=döntetlen)", "tabla", "Tábla"),
      num("target", "„Tovább” gomb: ugorjon erre a lépésre (-1 = nincs)", -1, -1, 128, 1, "Tábla"),
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
  {
    id: "data.highscore",
    label: "Pontlista / toplista",
    description: "Top-10 pontlista, ami megmarad a böngészőben. Mentés módban az aktuális pontszámot is berakja; a játék végén (ha van ilyen blokk a projektben) AUTOMATIKUSAN menti és mutatja. Kattintásra bezáródik, és ugorhat pl. vissza a főmenübe.",
    category: "data",
    icon: "Trophy",
    kind: "highscore",
    defaultLength: 2,
    params: [
      sel("mode", "Mód", "save", [
        { value: "save", label: "Mentés + mutatás" },
        { value: "show", label: "Csak mutatás" },
        { value: "reset", label: "Lista törlése" },
      ], "Toplista"),
      txt("board", "Tábla neve (játékonként külön lista)", "jatekom", "Toplista"),
      txt("title", "Lista címe", "TOP 10", "Toplista"),
      txt("name", "Név (mentéskor)", "Játékos", "Toplista"),
      num("target", "Bezáráskor ugorjon erre a lépésre (-1 = nincs)", -1, -1, 128, 1, "Toplista"),
    ],
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
