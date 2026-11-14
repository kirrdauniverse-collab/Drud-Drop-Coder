"use client";

import { create } from "zustand";
import { useEditor } from "./editor";
import type { TimelinePos } from "@/lib/types";

// ===== Fogd-és-viddi állapot (könyvtár → idővonal, blokk mozgatás) =====

interface DragInfo {
  source: "library" | "block";
  typeId?: string;
  blockId?: string;
  label: string;
  icon: string;
  color: string;
  chipClass: string;
}

interface DragState extends DragInfo {
  active: boolean;
  x: number;
  y: number;
  over: TimelinePos | null;
  hitTest: ((x: number, y: number) => TimelinePos | null) | null;
  begin: (info: DragInfo, e: React.PointerEvent) => void;
  move: (x: number, y: number) => void;
  registerHitTest: (fn: ((x: number, y: number) => TimelinePos | null) | null) => void;
}

export const useDrag = create<DragState>((set, get) => ({
  active: false,
  source: "library",
  label: "",
  icon: "Box",
  color: "#888",
  chipClass: "",
  x: 0,
  y: 0,
  over: null,
  hitTest: null,

  registerHitTest: (fn) => set({ hitTest: fn }),

  begin: (info, e) => {
    set({ ...info, active: true, x: e.clientX, y: e.clientY, over: null });
    const startX = e.clientX;
    const startY = e.clientY;
    let started = false;

    const onMove = (ev: PointerEvent) => {
      if (!started) {
        if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < 5) return;
        started = true;
      }
      get().move(ev.clientX, ev.clientY);
    };

    const onUp = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      if (!started) {
        set({ active: false, over: null });
        return;
      }
      const st = get();
      const pos = st.hitTest?.(ev.clientX, ev.clientY) ?? null;
      // Drop-validáció: csak létező sáv és lépés-tartomány fogad blokkot
      if (pos && useEditor.getState().project.tracks.some((t) => t.id === pos.trackId)) {
        const ed = useEditor.getState();
        if (st.source === "library" && st.typeId) {
          ed.addBlock(st.typeId, pos.trackId, pos.step);
        } else if (st.source === "block" && st.blockId) {
          ed.moveBlock(st.blockId, pos.trackId, pos.step);
        }
      }
      set({ active: false, over: null });
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  },

  move: (x, y) => {
    const st = get();
    const over = st.active ? st.hitTest?.(x, y) ?? null : null;
    set({ x, y, over });
  },
}));
