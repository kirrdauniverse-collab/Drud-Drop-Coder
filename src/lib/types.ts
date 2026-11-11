// ===== AppMixer – alap típusok =====

export type Category = "logic" | "graphics" | "sound" | "input" | "ui" | "data" | "custom";

export interface CategoryMeta {
  id: Category;
  label: string;
  description: string;
  color: string;      // hex szín
  chipClass: string;  // tailwind osztály a blokk-chiphez
  textClass: string;
}

export type ParamType = "number" | "slider" | "text" | "select" | "color" | "toggle";

export interface BlockParamDef {
  key: string;
  label: string;
  type: ParamType;
  min?: number;
  max?: number;
  step?: number;
  options?: { value: string; label: string }[];
  default: string | number | boolean;
  group?: string; // csoport-cím a tulajdonságpanelen (pl. "Megjelenés", "Mozgás")
}

// A motor által kezelt "fajták"
export type BlockKind =
  | "bg"            // háttér beállítás (ragadós)
  | "sprite"        // entitás létrehozása (klasszikus, űr-készlet)
  | "shape"         // szabadon paraméterezhető alak (stílus × szerep × mozgás)
  | "text"          // szöveg entitás
  | "effect"        // részecskék / villanás / időjárás
  | "sfx"           // egyszeri hang
  | "music"         // zenei minta a blokk hosszára
  | "keyboard"      // billentyű-irányítás aktiválása
  | "pointer"       // egér/ujj követése
  | "click"         // kattintás-esemény aktiválása
  | "choice"        // választó gombok (kvíz / menü)
  | "counter"       // változó növelése
  | "check"         // feltételvizsgálat + akció
  | "jump"          // léptető ugrás
  | "clear"         // entitások törlése
  | "finish"        // győzelem / játék vége
  | "spawner"       // rendszeres megjelenítés (adott lépéstenként)
  | "setvar"        // változó beállítása
  | "save"          // változók mentése
  | "load"          // változók betöltése
  | "customImage"   // feltöltött kép
  | "customAudio";  // feltöltött hang

// Az általános "Alak" blokk stílusai (30 db, mindegyik rajzolt)
export const SHAPE_STYLES = [
  "ship", "meteor", "star", "cloud", "ball", "cube", "triangle", "diamond",
  "heart", "car", "fish", "bird", "ghost", "bomb", "coin", "apple",
  "balloon", "snowflake", "flower", "tree", "house", "planet", "moon", "rocket",
  "ufo", "mushroom", "egg", "shield", "key", "potion", "snowman",
] as const;
export type ShapeStyle = (typeof SHAPE_STYLES)[number];

// Mozgás-viselkedések az "Alak" blokkhoz
export const SHAPE_MOVES = [
  "static", "fall", "rise", "drift", "bounce", "patrol", "chase", "orbit", "wave",
] as const;
export type ShapeMove = (typeof SHAPE_MOVES)[number];

export const SHAPE_MOVE_LABELS: Record<ShapeMove, string> = {
  static: "Áll egy helyben",
  fall: "Lefele zuhan",
  rise: "Felfele emelkedik",
  drift: "Oldalra sodródik",
  bounce: "Pattog (nekiütközik a falaknak)",
  patrol: "Oda-vissza jár",
  chase: "Üldözi a játékost",
  orbit: "Kering egy pont körül",
  wave: "Hullámosan lebeg lefelé",
};

export interface BlockTypeDef {
  id: string;          // pl. "gfx.sprite.meteor"
  label: string;
  description: string;
  category: Category;
  icon: string;        // lucide ikon név
  kind: BlockKind;
  defaultLength: number;
  params: BlockParamDef[];
  assetId?: string;    // saját tartalmaknál
}

export interface Block {
  id: string;
  typeId: string;
  trackId: string;
  start: number;   // lépés index
  length: number;  // lépés hossz
  params: Record<string, string | number | boolean>;
}

export interface Track {
  id: string;
  name: string;
  category: Category;
  volume: number;  // 0..1
  muted: boolean;
  solo: boolean;
}

export interface CustomAsset {
  id: string;
  kind: "image" | "audio";
  name: string;
  dataUrl: string;
  createdAt: number;
}

export interface Project {
  id: string;
  name: string;
  cloudId?: string;
  tracks: Track[];
  blocks: Block[];
  assets: CustomAsset[];
  stepCount: number;
  tempoMs: number;      // egy lépés hossza ms-ben
  loop: boolean;
  masterVolume: number; // 0..1
}

export interface TimelinePos {
  trackId: string;
  step: number;
}

export interface EngineEvent {
  step: number;
  label: string;
  tone: "info" | "gfx" | "sfx" | "logic" | "data" | "warn";
}

export const CATEGORY_META: Record<Category, CategoryMeta> = {
  logic: {
    id: "logic",
    label: "Logika",
    description: "Feltételek, ugrások, számlálók – a gondolkodó rutinok",
    color: "#a78bfa",
    chipClass: "bg-violet-500/15 border-violet-500/40 text-violet-200",
    textClass: "text-violet-300",
  },
  graphics: {
    id: "graphics",
    label: "Grafika",
    description: "Hátterek, sprite-ok, szövegek és effektek",
    color: "#22d3ee",
    chipClass: "bg-cyan-500/15 border-cyan-500/40 text-cyan-200",
    textClass: "text-cyan-300",
  },
  sound: {
    id: "sound",
    label: "Hang",
    description: "Hanghatások és szintetizált zenei loopok",
    color: "#34d399",
    chipClass: "bg-emerald-500/15 border-emerald-500/40 text-emerald-200",
    textClass: "text-emerald-300",
  },
  input: {
    id: "input",
    label: "Bemenet",
    description: "Billentyűzet és kattintás események",
    color: "#fbbf24",
    chipClass: "bg-amber-500/15 border-amber-500/40 text-amber-200",
    textClass: "text-amber-300",
  },
  ui: {
    id: "ui",
    label: "App",
    description: "Alkalmazás-elemek: választó gombok, kvízek, menük",
    color: "#a3e635",
    chipClass: "bg-lime-500/15 border-lime-500/40 text-lime-200",
    textClass: "text-lime-300",
  },
  data: {
    id: "data",
    label: "Adat",
    description: "Változók, pontok, életek, mentés",
    color: "#fb7185",
    chipClass: "bg-rose-500/15 border-rose-500/40 text-rose-200",
    textClass: "text-rose-300",
  },
  custom: {
    id: "custom",
    label: "Saját",
    description: "Feltöltött képeid és hangjaid",
    color: "#fb923c",
    chipClass: "bg-orange-500/15 border-orange-500/40 text-orange-200",
    textClass: "text-orange-300",
  },
};
