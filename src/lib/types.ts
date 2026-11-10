// ===== AppMixer – alap típusok =====

export type Category = "logic" | "graphics" | "sound" | "input" | "data" | "custom";

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
}

// A motor által kezelt "fajták"
export type BlockKind =
  | "bg"            // háttér beállítás (ragadós)
  | "sprite"        // entitás létrehozása
  | "text"          // szöveg entitás
  | "effect"        // részecskék / villanás
  | "sfx"           // egyszeri hang
  | "music"         // zenei minta a blokk hosszára
  | "keyboard"      // billentyű-irányítás aktiválása
  | "click"         // kattintás-esemény aktiválása
  | "counter"       // változó növelése
  | "check"         // feltételvizsgálat + akció
  | "jump"          // léptető ugrás
  | "clear"         // entitások törlése
  | "setvar"        // változó beállítása
  | "save"          // változók mentése
  | "load"          // változók betöltése
  | "customImage"   // feltöltött kép
  | "customAudio";  // feltöltött hang

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
