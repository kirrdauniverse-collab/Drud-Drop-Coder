"use client";

import { create } from "zustand";
import type { Block, Category, CustomAsset, Project, Track } from "@/lib/types";
import { getBlockType, customImageTypeDef, customAudioTypeDef, BLOCK_TYPES } from "@/lib/blocks";
import { demoSpaceProject, demoChillProject, demoPlatformProject, demoGalagaProject, demoBoardProject, demoRpgProject, demoShooterProject, demoFpsProject, demoRaceProject, demoSplitProject, demoWormsProject, demoBuilderProject, demoAdventureProject, demoOnlineProject, emptyProject, uid } from "@/lib/demo";

const LS_KEY = "appmixer.project.v1";

interface HistoryEntry {
  tracks: Track[];
  blocks: Block[];
  assets: CustomAsset[];
  stepCount: number;
}

interface EditorState {
  project: Project;
  selectedBlockId: string | null;
  selectedTrackId: string | null;
  playing: boolean;
  playStep: number;
  dirty: boolean;
  canUndo: boolean;
  canRedo: boolean;
  past: HistoryEntry[];
  future: HistoryEntry[];

  // akciók
  setPlaying: (v: boolean) => void;
  setPlayStep: (s: number) => void;
  selectBlock: (id: string | null) => void;
  selectTrack: (id: string | null) => void;

  addBlock: (typeId: string, trackId: string, start: number) => void;
  moveBlock: (id: string, trackId: string, start: number) => void;
  resizeBlock: (id: string, length: number, commit?: boolean) => void;
  updateParam: (id: string, key: string, value: string | number | boolean, commit?: boolean) => void;
  deleteBlock: (id: string) => void;
  duplicateBlock: (id: string) => void;

  addTrack: (name: string, category: Category) => void;
  removeTrack: (id: string) => void;
  renameTrack: (id: string, name: string) => void;
  toggleMute: (id: string) => void;
  toggleSolo: (id: string) => void;
  setTrackVolume: (id: string, v: number) => void;

  addAssets: (assets: CustomAsset[]) => void;
  removeAsset: (id: string) => void;

  setTempo: (ms: number) => void;
  setLoop: (v: boolean) => void;
  setStepCount: (n: number) => void;
  setMasterVolume: (v: number) => void;
  setProjectName: (name: string) => void;

  loadProject: (p: Project, opts?: { silent?: boolean }) => void;
  newEmpty: () => void;
  loadDemo: (which: "space" | "chill" | "platform" | "galaga" | "board" | "rpg" | "shooter" | "fps" | "race" | "split" | "worms" | "builder" | "adventure" | "online") => void;
  undo: () => void;
  redo: () => void;
  clearHistory: () => void;
  pushHistory: () => void;
  saveLocal: () => void;
}

function snapshot(p: Project): HistoryEntry {
  return {
    tracks: JSON.parse(JSON.stringify(p.tracks)),
    blocks: JSON.parse(JSON.stringify(p.blocks)),
    assets: JSON.parse(JSON.stringify(p.assets)),
    stepCount: p.stepCount,
  };
}

function loadInitialProject(): Project {
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Project;
        if (parsed && Array.isArray(parsed.tracks) && Array.isArray(parsed.blocks)) {
          return parsed;
        }
      }
    } catch {}
  }
  return demoSpaceProject();
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleAutosave(p: Project) {
  if (typeof window === "undefined") return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(p));
    } catch {
      // kvóta túllépés – csendben elnyeljük, az export marad
    }
  }, 900);
}

export const useEditor = create<EditorState>((set, get) => ({
  project: loadInitialProject(),
  selectedBlockId: null,
  selectedTrackId: null,
  playing: false,
  playStep: 0,
  dirty: false,
  canUndo: false,
  canRedo: false,
  past: [],
  future: [],

  setPlaying: (v) => set({ playing: v }),
  setPlayStep: (s) => set({ playStep: s }),
  selectBlock: (id) => set({ selectedBlockId: id, selectedTrackId: null }),
  selectTrack: (id) => set({ selectedTrackId: id, selectedBlockId: null }),

  addBlock: (typeId, trackId, start) => {
    const p = get().project;
    const isCustom = typeId.startsWith("custom:");
    const def = getBlockType(typeId);
    if (!isCustom && !def) return;
    const length = isCustom ? 4 : def!.defaultLength;
    const params: Record<string, string | number | boolean> = {};
    if (isCustom) {
      const asset = p.assets.find((a) => a.id === typeId.slice(7));
      if (!asset) return;
      const cdef = asset.kind === "image" ? customImageTypeDef(asset.name) : customAudioTypeDef(asset.name);
      for (const pd of cdef.params) params[pd.key] = pd.default;
    } else {
      for (const pd of def!.params) params[pd.key] = pd.default;
    }
    const block: Block = { id: uid(), typeId, trackId, start: Math.max(0, Math.min(p.stepCount - 1, start)), length, params };
    const past = [...get().past.slice(-49), snapshot(p)];
    const np: Project = { ...p, blocks: [...p.blocks, block] };
    scheduleAutosave(np);
    set({
      project: np,
      past,
      future: [],
      canUndo: true,
      canRedo: false,
      selectedBlockId: block.id,
      dirty: true,
    });
  },

  moveBlock: (id, trackId, start) => {
    const p = get().project;
    const b = p.blocks.find((x) => x.id === id);
    if (!b) return;
    if (b.trackId === trackId && b.start === start) return;
    // Validáció: csak létező sávra, a rács tartományán belül; a hossz ne lógjon ki a lépésszámból
    if (!p.tracks.some((t) => t.id === trackId)) return;
    const s = Math.max(0, Math.min(p.stepCount - 1, start));
    const past = [...get().past.slice(-49), snapshot(p)];
    const np: Project = {
      ...p,
      blocks: p.blocks.map((x) => (x.id === id ? { ...x, trackId, start: s, length: Math.min(x.length, p.stepCount - s) } : x)),
    };
    scheduleAutosave(np);
    set({ project: np, past, future: [], canUndo: true, canRedo: false, dirty: true });
  },

  resizeBlock: (id, length, commit = true) => {
    const p = get().project;
    const b = p.blocks.find((x) => x.id === id);
    if (!b) return;
    const len = Math.max(1, Math.min(p.stepCount - b.start, length));
    if (len === b.length) return;
    const past = commit ? [...get().past.slice(-49), snapshot(p)] : get().past;
    const np: Project = { ...p, blocks: p.blocks.map((x) => (x.id === id ? { ...x, length: len } : x)) };
    scheduleAutosave(np);
    set({
      project: np,
      past,
      future: commit ? [] : get().future,
      canUndo: true,
      canRedo: commit ? false : get().canRedo,
      dirty: true,
    });
  },

  updateParam: (id, key, value, commit = true) => {
    const p = get().project;
    const past = commit ? [...get().past.slice(-49), snapshot(p)] : get().past;
    const np: Project = {
      ...p,
      blocks: p.blocks.map((x) => (x.id === id ? { ...x, params: { ...x.params, [key]: value } } : x)),
    };
    scheduleAutosave(np);
    set({
      project: np,
      past,
      future: commit ? [] : get().future,
      canUndo: true,
      canRedo: commit ? false : get().canRedo,
      dirty: true,
    });
  },

  deleteBlock: (id) => {
    const p = get().project;
    const past = [...get().past.slice(-49), snapshot(p)];
    const np: Project = { ...p, blocks: p.blocks.filter((x) => x.id !== id) };
    scheduleAutosave(np);
    set({
      project: np,
      past,
      future: [],
      canUndo: true,
      canRedo: false,
      selectedBlockId: get().selectedBlockId === id ? null : get().selectedBlockId,
      dirty: true,
    });
  },

  duplicateBlock: (id) => {
    const p = get().project;
    const b = p.blocks.find((x) => x.id === id);
    if (!b) return;
    let start = b.start + b.length;
    if (start + b.length > p.stepCount) start = Math.max(0, p.stepCount - b.length);
    const copy: Block = { ...b, id: uid(), start, params: { ...b.params } };
    const past = [...get().past.slice(-49), snapshot(p)];
    const np: Project = { ...p, blocks: [...p.blocks, copy] };
    scheduleAutosave(np);
    set({ project: np, past, future: [], canUndo: true, canRedo: false, selectedBlockId: copy.id, dirty: true });
  },

  addTrack: (name, category) => {
    const p = get().project;
    const t: Track = { id: uid(), name, category, volume: 0.8, muted: false, solo: false };
    const past = [...get().past.slice(-49), snapshot(p)];
    const np: Project = { ...p, tracks: [...p.tracks, t] };
    scheduleAutosave(np);
    set({ project: np, past, future: [], canUndo: true, canRedo: false, dirty: true });
  },

  removeTrack: (id) => {
    const p = get().project;
    if (p.tracks.length <= 1) return;
    const past = [...get().past.slice(-49), snapshot(p)];
    const np: Project = {
      ...p,
      tracks: p.tracks.filter((t) => t.id !== id),
      blocks: p.blocks.filter((b) => b.trackId !== id),
    };
    scheduleAutosave(np);
    set({ project: np, past, future: [], canUndo: true, canRedo: false, dirty: true, selectedTrackId: null });
  },

  renameTrack: (id, name) => {
    const p = get().project;
    const np: Project = { ...p, tracks: p.tracks.map((t) => (t.id === id ? { ...t, name } : t)) };
    scheduleAutosave(np);
    set({ project: np, dirty: true });
  },

  toggleMute: (id) => {
    const p = get().project;
    const np: Project = { ...p, tracks: p.tracks.map((t) => (t.id === id ? { ...t, muted: !t.muted } : t)) };
    scheduleAutosave(np);
    set({ project: np, dirty: true });
  },

  toggleSolo: (id) => {
    const p = get().project;
    const np: Project = { ...p, tracks: p.tracks.map((t) => (t.id === id ? { ...t, solo: !t.solo } : t)) };
    scheduleAutosave(np);
    set({ project: np, dirty: true });
  },

  setTrackVolume: (id, v) => {
    const p = get().project;
    const np: Project = { ...p, tracks: p.tracks.map((t) => (t.id === id ? { ...t, volume: Math.max(0, Math.min(1, v)) } : t)) };
    scheduleAutosave(np);
    set({ project: np, dirty: true });
  },

  addAssets: (assets) => {
    const p = get().project;
    const past = [...get().past.slice(-49), snapshot(p)];
    const np: Project = { ...p, assets: [...p.assets, ...assets] };
    scheduleAutosave(np);
    set({ project: np, past, future: [], canUndo: true, canRedo: false, dirty: true });
  },

  removeAsset: (id) => {
    const p = get().project;
    const past = [...get().past.slice(-49), snapshot(p)];
    const np: Project = {
      ...p,
      assets: p.assets.filter((a) => a.id !== id),
      blocks: p.blocks.filter((b) => b.typeId !== `custom:${id}`),
    };
    scheduleAutosave(np);
    set({ project: np, past, future: [], canUndo: true, canRedo: false, dirty: true });
  },

  setTempo: (ms) => {
    const p = get().project;
    const np: Project = { ...p, tempoMs: Math.max(60, Math.min(1200, ms)) };
    scheduleAutosave(np);
    set({ project: np, dirty: true });
  },

  setLoop: (v) => {
    const p = get().project;
    const np: Project = { ...p, loop: v };
    scheduleAutosave(np);
    set({ project: np, dirty: true });
  },

  setStepCount: (n) => {
    const p = get().project;
    const stepCount = Math.max(16, Math.min(128, Math.round(n / 8) * 8));
    const past = [...get().past.slice(-49), snapshot(p)];
    const np: Project = {
      ...p,
      stepCount,
      blocks: p.blocks
        .filter((b) => b.start < stepCount)
        .map((b) => ({ ...b, length: Math.min(b.length, stepCount - b.start) })),
    };
    scheduleAutosave(np);
    set({ project: np, past, future: [], canUndo: true, canRedo: false, dirty: true });
  },

  setMasterVolume: (v) => {
    const p = get().project;
    const np: Project = { ...p, masterVolume: Math.max(0, Math.min(1, v)) };
    scheduleAutosave(np);
    set({ project: np, dirty: true });
  },

  setProjectName: (name) => {
    const p = get().project;
    const np: Project = { ...p, name };
    scheduleAutosave(np);
    set({ project: np, dirty: true });
  },

  loadProject: (p, opts) => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(p));
    } catch {}
    set({
      project: p,
      past: [],
      future: [],
      canUndo: false,
      canRedo: false,
      selectedBlockId: null,
      selectedTrackId: null,
      dirty: opts?.silent ? false : true,
    });
  },

  newEmpty: () => get().loadProject(emptyProject()),

  loadDemo: (which) => get().loadProject(
    which === "space" ? demoSpaceProject()
      : which === "platform" ? demoPlatformProject()
      : which === "galaga" ? demoGalagaProject()
      : which === "board" ? demoBoardProject()
      : which === "rpg" ? demoRpgProject()
      : which === "shooter" ? demoShooterProject()
      : which === "fps" ? demoFpsProject()
      : which === "race" ? demoRaceProject()
      : which === "split" ? demoSplitProject()
      : which === "worms" ? demoWormsProject()
      : which === "builder" ? demoBuilderProject()
      : which === "adventure" ? demoAdventureProject()
      : which === "online" ? demoOnlineProject()
      : demoChillProject(),
  ),

  undo: () => {
    const { past, project } = get();
    if (past.length === 0) return;
    const prev = past[past.length - 1];
    const np: Project = {
      ...project,
      tracks: prev.tracks,
      blocks: prev.blocks,
      assets: prev.assets,
      stepCount: prev.stepCount,
    };
    scheduleAutosave(np);
    set({
      project: np,
      past: past.slice(0, -1),
      future: [snapshot(project), ...get().future].slice(0, 50),
      canUndo: past.length > 1,
      canRedo: true,
      selectedBlockId: null,
    });
  },

  redo: () => {
    const { future, project } = get();
    if (future.length === 0) return;
    const next = future[0];
    const np: Project = {
      ...project,
      tracks: next.tracks,
      blocks: next.blocks,
      assets: next.assets,
      stepCount: next.stepCount,
    };
    scheduleAutosave(np);
    set({
      project: np,
      future: future.slice(1),
      past: [...get().past, snapshot(project)].slice(-50),
      canUndo: true,
      canRedo: future.length > 1,
      selectedBlockId: null,
    });
  },

  clearHistory: () => set({ past: [], future: [], canUndo: false, canRedo: false }),

  // Egy folyamatos gesztus (átméretezés, csúszka) elején hívjuk –
  // így a teljes mozdulat egyetlen visszavonható lépés lesz.
  pushHistory: () => {
    const p = get().project;
    set({
      past: [...get().past.slice(-49), snapshot(p)],
      future: [],
      canUndo: true,
      canRedo: false,
    });
  },

  saveLocal: () => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(get().project));
      set({ dirty: false });
    } catch {}
  },
}));

// Feltöltött képek kicsinyítése (a localStorage kvótához)
export async function processImageFile(file: File, maxDim = 320): Promise<CustomAsset | null> {
  const dataUrl = await new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = dataUrl;
  }).catch(() => null);
  if (!img) return null;
  let { width, height } = img;
  const scale = Math.min(1, maxDim / Math.max(width, height));
  width = Math.max(1, Math.round(width * scale));
  height = Math.max(1, Math.round(height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, width, height);
  const out = canvas.toDataURL("image/png");
  return {
    id: uid(),
    kind: "image",
    name: file.name.replace(/\.[^.]+$/, "").slice(0, 28) || "kép",
    dataUrl: out,
    createdAt: Date.now(),
  };
}

export async function processAudioFile(file: File): Promise<CustomAsset | null> {
  const dataUrl = await new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
  return {
    id: uid(),
    kind: "audio",
    name: file.name.replace(/\.[^.]+$/, "").slice(0, 28) || "hang",
    dataUrl,
    createdAt: Date.now(),
  };
}

// Blokktípus feloldása (saját tartalommal együtt)
export function resolveTypeDef(typeId: string, assets: CustomAsset[]) {
  if (typeId.startsWith("custom:")) {
    const asset = assets.find((a) => a.id === typeId.slice(7));
    if (!asset) return undefined;
    return asset.kind === "image" ? customImageTypeDef(asset.name) : customAudioTypeDef(asset.name);
  }
  return BLOCK_TYPES.find((t) => t.id === typeId);
}
