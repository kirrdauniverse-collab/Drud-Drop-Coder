"use client";

import { useEffect, useRef, useState } from "react";
import { useEditor, resolveTypeDef } from "@/store/editor";
import { useDrag } from "@/store/drag";
import { CATEGORY_META, type Category, type Track } from "@/lib/types";
import { blockIcon } from "./icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Plus, Volume2, Eye, EyeOff, Power } from "lucide-react";

const CELL_W = 56;
const ROW_H = 52;
const HEADER_W = 216;

export function Timeline() {
  const project = useEditor((s) => s.project);
  const selectedBlockId = useEditor((s) => s.selectedBlockId);
  const selectedTrackId = useEditor((s) => s.selectedTrackId);
  const playStep = useEditor((s) => s.playStep);
  const selectBlock = useEditor((s) => s.selectBlock);
  const selectTrack = useEditor((s) => s.selectTrack);
  const toggleMute = useEditor((s) => s.toggleMute);
  const toggleSolo = useEditor((s) => s.toggleSolo);
  const setTrackVolume = useEditor((s) => s.setTrackVolume);
  const removeTrack = useEditor((s) => s.removeTrack);
  const renameTrack = useEditor((s) => s.renameTrack);
  const addTrack = useEditor((s) => s.addTrack);
  const deleteBlock = useEditor((s) => s.deleteBlock);
  const duplicateBlock = useEditor((s) => s.duplicateBlock);

  const dragActive = useDrag((s) => s.active);
  const dragOver = useDrag((s) => s.over);
  const registerHitTest = useDrag((s) => s.registerHitTest);

  const scrollRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const playheadRef = useRef<HTMLDivElement>(null);
  const prevStep = useRef(0);

  // Léptetőfej folytonos mozgása (ugrásnál/loopnál ugorjon, ne csússzon vissza)
  useEffect(() => {
    const el = playheadRef.current;
    if (el && playStep < prevStep.current) {
      el.style.transition = "none";
      requestAnimationFrame(() => {
        el.style.transition = `left ${useEditor.getState().project.tempoMs}ms linear`;
      });
    }
    prevStep.current = playStep;
  }, [playStep]);

  // Találat-teszt regisztráció a drag store-ba
  useEffect(() => {
    registerHitTest((x, y) => {
      const grid = gridRef.current;
      if (!grid) return null;
      const rect = grid.getBoundingClientRect();
      if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) return null;
      const relY = y - rect.top;
      const rowIdx = Math.floor(relY / ROW_H);
      const track = project.tracks[rowIdx];
      if (!track) return null;
      const relX = x - rect.left - HEADER_W;
      const step = Math.floor(relX / CELL_W);
      if (step < 0 || step >= project.stepCount) return null;
      return { trackId: track.id, step };
    });
    return () => registerHitTest(null);
  }, [project.tracks, project.stepCount, registerHitTest]);

  const gridW = project.stepCount * CELL_W;
  const anySolo = project.tracks.some((t) => t.solo);

  return (
    <div className="h-full flex flex-col bg-zinc-950">
      {/* Sáv hozzáadása sáv */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-zinc-800/80 bg-zinc-900/60">
        <div className="flex items-center gap-2 text-xs text-zinc-400">
          <span className="font-semibold text-zinc-200">Folyamatsávok</span>
          <span className="hidden sm:inline">({project.tracks.length})</span>
          <span className="hidden md:inline text-zinc-500">· húzz blokkokat a rácsba</span>
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button size="sm" variant="outline" className="h-8 gap-1.5 border-zinc-700 bg-zinc-800/60 hover:bg-zinc-800 text-zinc-200">
              <Plus className="size-3.5" /> Sáv hozzáadása
            </Button>
          </PopoverTrigger>
          <AddTrackPopover onAdd={addTrack} />
        </Popover>
      </div>

      {/* Görgethető rács */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-auto">
        <div className="relative" style={{ width: HEADER_W + gridW }}>
          {/* Lépésjelző (ragadós felül) */}
          <div className="sticky top-0 z-30 flex h-9 bg-zinc-900/95 backdrop-blur border-b border-zinc-800">
            <div className="sticky left-0 z-40 shrink-0 bg-zinc-900/95 border-r border-zinc-800 flex items-center px-3" style={{ width: HEADER_W }}>
              <span className="text-[11px] font-medium text-zinc-500 tracking-wide">SÁV / LÉPÉS</span>
            </div>
            <div className="relative" style={{ width: gridW }}>
              {Array.from({ length: Math.ceil(project.stepCount / 4) }, (_, i) => (
                <span
                  key={i}
                  className="absolute top-0 h-full flex items-end pb-1 text-[10px] font-mono text-zinc-500"
                  style={{ left: i * 4 * CELL_W + 4 }}
                >
                  {i * 4 + 1}
                </span>
              ))}
            </div>
          </div>

          {/* Sávok */}
          <div ref={gridRef}>
            {project.tracks.map((track) => {
            const meta = CATEGORY_META[track.category];
            const effMuted = track.muted || (anySolo && !track.solo && (track.category === "sound" || track.category === "custom"));
            const isDragRow = dragActive && dragOver?.trackId === track.id;
            // A sáv-fejléc vezérlői a tartalomhoz illők: hangnál hangerő/némítás/szóló,
            // grafikánál láthatóság, logikánál pedig be/ki kapcsoló.
            const isAudioTrack = track.category === "sound" || track.category === "custom";
            const isGraphicsTrack = track.category === "graphics";
            return (
              <div key={track.id} className="flex" style={{ height: ROW_H }}>
                {/* Sáv fejléc (ragadós balra) */}
                <div
                  className={`sticky left-0 z-20 shrink-0 border-r border-b border-zinc-800 bg-zinc-900 px-2.5 py-1.5 flex flex-col justify-center gap-1 cursor-pointer ${selectedTrackId === track.id ? "ring-1 ring-inset ring-amber-500/60" : ""}`}
                  style={{ width: HEADER_W }}
                  onClick={() => selectTrack(track.id)}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="size-2.5 shrink-0 rounded-full" style={{ background: meta.color }} />
                    <TrackNameInput track={track} onRename={renameTrack} />
                    {isAudioTrack ? (
                      <>
                        <button
                          title="Némítás – a sáv hangjai elhallgatnak"
                          onClick={(e) => { e.stopPropagation(); toggleMute(track.id); }}
                          className={`w-6 h-6 shrink-0 rounded text-[10px] font-bold transition-colors ${track.muted ? "bg-rose-500 text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"}`}
                        >
                          M
                        </button>
                        <button
                          title="Szóló – csak ez a sáv hangja szól (a grafika tovább fut)"
                          onClick={(e) => { e.stopPropagation(); toggleSolo(track.id); }}
                          className={`w-6 h-6 shrink-0 rounded text-[10px] font-bold transition-colors ${track.solo ? "bg-amber-400 text-zinc-950" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"}`}
                        >
                          S
                        </button>
                      </>
                    ) : isGraphicsTrack ? (
                      <button
                        title={track.muted ? "Visszamutatás – a sáv vizuális elemei látszanak" : "Elrejtés – a sáv vizuális elemei nem látszanak"}
                        onClick={(e) => { e.stopPropagation(); toggleMute(track.id); }}
                        className={`w-6 h-6 shrink-0 rounded flex items-center justify-center transition-colors ${track.muted ? "bg-rose-500 text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"}`}
                      >
                        {track.muted ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                      </button>
                    ) : (
                      <button
                        title={track.muted ? "Bekapcsolás – a sáv blokkjai újra futnak" : "Kikapcsolás – a sáv blokkjai nem futnak le"}
                        onClick={(e) => { e.stopPropagation(); toggleMute(track.id); }}
                        className={`w-6 h-6 shrink-0 rounded flex items-center justify-center transition-colors ${track.muted ? "bg-rose-500 text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"}`}
                      >
                        <Power className={`size-3.5 ${track.muted ? "rotate-180" : ""}`} />
                      </button>
                    )}
                  </div>
                  {isAudioTrack ? (
                    <div className="flex items-center gap-1.5">
                      <Volume2 className="size-3 text-zinc-500 shrink-0" />
                      <Slider
                        value={[track.volume]}
                        min={0}
                        max={1}
                        step={0.05}
                        onValueChange={(v) => setTrackVolume(track.id, v[0])}
                        className="flex-1 h-1"
                      />
                    </div>
                  ) : (
                    <div className="text-[9px] leading-tight text-zinc-600 truncate">
                      {isGraphicsTrack
                        ? (track.muted ? "Elrejtve – lejátszáskor nem látszik" : "Vizuális sáv · szem ikon = elrejtés")
                        : (track.muted ? "Kikapcsolva – a blokkjai nem futnak" : "Futtató sáv · kapcsoló = be/ki")}
                    </div>
                  )}
                </div>

                {/* Rács terület */}
                <div
                  className={`relative border-b border-zinc-800/70 ${isDragRow ? "bg-amber-500/[0.07]" : ""} ${effMuted ? "opacity-45" : ""}`}
                  style={{
                    width: gridW,
                    background: `repeating-linear-gradient(to right, transparent 0, transparent ${CELL_W - 1}px, rgba(63,63,70,0.5) ${CELL_W - 1}px, rgba(63,63,70,0.5) ${CELL_W}px), repeating-linear-gradient(to right, transparent 0, transparent ${CELL_W * 4 - 1}px, rgba(113,113,122,0.55) ${CELL_W * 4 - 1}px, rgba(113,113,122,0.55) ${CELL_W * 4}px)`,
                  }}
                  onClick={(e) => {
                    if (e.target === e.currentTarget) selectTrack(track.id);
                  }}
                >
                  {/* Blokkok */}
                  {project.blocks
                    .filter((b) => b.trackId === track.id)
                    .map((b) => {
                      const def = resolveTypeDef(b.typeId, project.assets);
                      if (!def) return null;
                      const catMeta = CATEGORY_META[def.category];
                      const Icon = blockIcon(def.icon);
                      const selected = selectedBlockId === b.id;
                      return (
                        <BlockChip
                          key={b.id}
                          blockId={b.id}
                          label={def.label}
                          iconName={def.icon}
                          icon={<Icon className="size-3.5 shrink-0" />}
                          chipClass={catMeta.chipClass}
                          start={b.start}
                          length={b.length}
                          selected={selected}
                          onSelect={() => selectBlock(b.id)}
                          onDelete={() => deleteBlock(b.id)}
                          onDuplicate={() => duplicateBlock(b.id)}
                        />
                      );
                    })}

                  {/* Ledobási cél jelölése */}
                  {isDragRow && dragOver && (
                    <div
                      className="absolute top-0.5 bottom-0.5 rounded-md border-2 border-dashed border-amber-400/80 bg-amber-400/15 pointer-events-none"
                      style={{ left: dragOver.step * CELL_W + 2, width: CELL_W - 4 }}
                    />
                  )}
                </div>
              </div>
            );
            })}

            {/* Üres kattintási terület a sávlista alatt */}
            <div
              className="sticky left-0 flex items-center px-3 h-12 text-[11px] text-zinc-600"
              style={{ width: HEADER_W }}
            >
              Tipp: jobb klikk a blokkon → menü
            </div>
          </div>

          {/* Léptetőfej */}
          <div
            ref={playheadRef}
            className="absolute top-9 bottom-0 w-0.5 bg-rose-500 pointer-events-none z-[25]"
            style={{
              left: HEADER_W + playStep * CELL_W + CELL_W / 2 - 1,
              transition: `left ${project.tempoMs}ms linear`,
              boxShadow: "0 0 10px rgba(244,63,94,0.8)",
            }}
          >
            <div className="absolute -top-1 -left-[7px] size-3.5 rotate-45 rounded-[3px] bg-rose-500" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ===== Sávnév szerkeszthető mező =====
function TrackNameInput({ track, onRename }: { track: Track; onRename: (id: string, name: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const startEdit = () => {
    setDraft(track.name);
    setEditing(true);
  };

  if (editing) {
    return (
      <Input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => { onRename(track.id, draft.trim() || track.name); setEditing(false); }}
        onKeyDown={(e) => {
          if (e.key === "Enter") { onRename(track.id, draft.trim() || track.name); setEditing(false); }
          if (e.key === "Escape") setEditing(false);
        }}
        className="h-6 px-1.5 text-xs py-0 bg-zinc-800 border-zinc-700 min-w-0 flex-1"
        onClick={(e) => e.stopPropagation()}
      />
    );
  }
  return (
    <button
      className="min-w-0 flex-1 text-left text-xs font-medium text-zinc-200 truncate hover:text-amber-300 transition-colors"
      onDoubleClick={(e) => { e.stopPropagation(); startEdit(); }}
      title={`${track.name} (dupla kattintás: átnevezés)`}
    >
      {track.name}
    </button>
  );
}

// ===== Blokk chip a rácsban =====
function BlockChip({
  blockId, label, iconName, icon, chipClass, start, length, selected, onSelect, onDelete, onDuplicate,
}: {
  blockId: string;
  label: string;
  iconName: string;
  icon: React.ReactNode;
  chipClass: string;
  start: number;
  length: number;
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
}) {
  const begin = useDrag((s) => s.begin);
  const resizeBlock = useEditor((s) => s.resizeBlock);
  const pushHistory = useEditor((s) => s.pushHistory);
  const [resizing, setResizing] = useState(false);

  const startResize = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setResizing(true);
    pushHistory(); // a gesztus előtti állapot kerül az előzményekbe
    const startX = e.clientX;
    const startLen = length;
    const onMove = (ev: PointerEvent) => {
      const delta = Math.round((ev.clientX - startX) / CELL_W);
      resizeBlock(blockId, startLen + delta, false);
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      setResizing(false);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  return (
    <div
      className={`group absolute top-1 bottom-1 rounded-md border flex items-center gap-1 px-1.5 cursor-grab active:cursor-grabbing select-none touch-none overflow-hidden ${chipClass} ${selected ? "ring-2 ring-amber-400 z-10" : "hover:brightness-125"}`}
      style={{ left: start * CELL_W + 2, width: length * CELL_W - 4 }}
      onPointerDown={(e) => {
        if (resizing) return;
        if ((e.target as HTMLElement).closest("[data-resize]")) return;
        if (e.button !== 0) return;
        onSelect();
        begin({ source: "block", blockId, label, icon: iconName, color: "#888", chipClass }, e);
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        const choice = window.prompt(`${label}\n\nDuplikálás = 1 · Törlés = 2 · Mégse = üres`) ?? "";
        if (choice.trim() === "1") onDuplicate();
        else if (choice.trim() === "2") onDelete();
      }}
      title={`${label} · ${length} lépés · jobbra húzható (átméretezés)`}
    >
      {icon}
      <span className="text-[11px] font-medium truncate">{label}</span>
      <div
        data-resize
        onPointerDown={startResize}
        className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/10"
      >
        <div className="w-0.5 h-4 rounded bg-current" />
      </div>
    </div>
  );
}

// ===== Új sáv felugró ablak =====
function AddTrackPopover({ onAdd }: { onAdd: (name: string, category: Category) => void }) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<Category>("graphics");
  return (
    <PopoverContent className="w-72 bg-zinc-900 border-zinc-700" align="end">
      <div className="grid gap-3">
        <div className="grid gap-1.5">
          <Label className="text-xs text-zinc-300">Sáv neve</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="pl. Ellenség logika"
            className="h-9 bg-zinc-800 border-zinc-700"
          />
        </div>
        <div className="grid gap-1.5">
          <Label className="text-xs text-zinc-300">Kategória</Label>
          <Select value={category} onValueChange={(v) => setCategory(v as Category)}>
            <SelectTrigger className="h-9 bg-zinc-800 border-zinc-700">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-zinc-700">
              {(Object.keys(CATEGORY_META) as Category[])
                .filter((c) => c !== "custom")
                .map((c) => (
                  <SelectItem key={c} value={c}>
                    <span className="inline-flex items-center gap-2">
                      <span className="size-2.5 rounded-full" style={{ background: CATEGORY_META[c].color }} />
                      {CATEGORY_META[c].label}
                    </span>
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          size="sm"
          className="bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold"
          onClick={() => {
            onAdd(name.trim() || CATEGORY_META[category].label + " sáv", category);
            setName("");
          }}
        >
          Sáv hozzáadása
        </Button>
      </div>
    </PopoverContent>
  );
}
