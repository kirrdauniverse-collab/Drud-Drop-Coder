"use client";

import { useRef, useState } from "react";
import { BLOCK_TYPES, CATEGORY_ORDER } from "@/lib/blocks";
import { CATEGORY_META, type Category } from "@/lib/types";
import { useEditor, processImageFile, processAudioFile } from "@/store/editor";
import { useDrag } from "@/store/drag";
import { blockIcon } from "./icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { audioEngine } from "@/lib/audio";
import { Upload, Trash2, Play, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function Library() {
  const [filter, setFilter] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const assets = useEditor((s) => s.project.assets);
  const addAssets = useEditor((s) => s.addAssets);
  const removeAsset = useEditor((s) => s.removeAsset);
  const begin = useDrag((s) => s.begin);
  const { toast } = useToast();

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    const added = [];
    const errors = [];
    for (const file of Array.from(files)) {
      try {
        if (file.type.startsWith("image/")) {
          const a = await processImageFile(file);
          if (a) added.push(a);
        } else if (file.type.startsWith("audio/")) {
          if (file.size > 2.5 * 1024 * 1024) {
            errors.push(`${file.name}: nagyobb mint 2,5 MB`);
            continue;
          }
          const a = await processAudioFile(file);
          if (a) added.push(a);
        } else {
          errors.push(`${file.name}: nem kép és nem hang`);
        }
      } catch {
        errors.push(`${file.name}: feldolgozási hiba`);
      }
    }
    if (added.length > 0) addAssets(added);
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
    if (added.length > 0) {
      toast({
        title: `Feltöltve: ${added.length} új elem`,
        description: `${added.map((a) => a.name).join(", ")}${errors.length ? ` · Kihagyva: ${errors.join(", ")}` : ""}`,
      });
    } else {
      toast({
        title: "A feltöltés nem sikerült",
        description: errors.join(", ") || "Ismeretlen hiba",
        variant: "destructive",
      });
    }
  };

  const q = filter.trim().toLowerCase();
  const visible = (cat: Category) =>
    BLOCK_TYPES.filter(
      (t) => t.category === cat && (!q || t.label.toLowerCase().includes(q) || t.description.toLowerCase().includes(q)),
    );

  return (
    <div className="h-full flex flex-col bg-zinc-950">
      <div className="p-3 border-b border-zinc-800/80 space-y-2.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-zinc-100">Blokk-könyvtár</span>
          <span className="text-[10px] text-zinc-500 ml-auto">húzd a rácsba →</span>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-zinc-500" />
          <Input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Keresés a blokkok között…"
            className="h-8 pl-8 text-xs bg-zinc-900 border-zinc-800"
          />
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-5 appmixer-scroll">
        {/* Saját tartalmak felül */}
        <section>
          <header className="flex items-center gap-2 mb-2">
            <span className="size-2.5 rounded-full" style={{ background: CATEGORY_META.custom.color }} />
            <h3 className="text-xs font-bold text-zinc-200 tracking-wide">SAJÁT TARTALMAK</h3>
            <span className="text-[10px] text-zinc-500">({assets.length})</span>
          </header>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="w-full rounded-lg border-2 border-dashed border-orange-500/40 bg-orange-500/5 hover:bg-orange-500/10 hover:border-orange-500/70 transition-colors p-3 flex flex-col items-center gap-1.5 text-orange-300 cursor-pointer disabled:opacity-50"
          >
            <Upload className="size-5" />
            <span className="text-xs font-semibold">{uploading ? "Feldolgozás…" : "Kép / hang feltöltése"}</span>
            <span className="text-[10px] text-zinc-500 text-center">PNG, JPG, SVG, MP3, WAV, OGG · max 2,5 MB (hang)</span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*,audio/*"
            multiple
            className="hidden"
            onChange={(e) => void handleFiles(e.target.files)}
          />
          {assets.length > 0 && (
            <div className="mt-2 space-y-1.5">
              {assets.map((a) => (
                <div
                  key={a.id}
                  className="group flex items-center gap-2 rounded-md border border-orange-500/30 bg-orange-500/10 px-2 py-1.5 cursor-grab active:cursor-grabbing touch-none select-none hover:border-orange-500/60"
                  onPointerDown={(e) => {
                    if (e.button !== 0) return;
                    begin(
                      {
                        source: "library",
                        typeId: `custom:${a.id}`,
                        label: a.name,
                        icon: a.kind === "image" ? "ImagePlus" : "FileAudio",
                        color: CATEGORY_META.custom.color,
                        chipClass: CATEGORY_META.custom.chipClass,
                      },
                      e,
                    );
                  }}
                  title={a.kind === "image" ? "Húzd rácsba – lehet dísz, játékos, ellenség, gyűjtendő vagy háttér" : "Húzd rácsba – lejátszódik, amikor a léptető eléri"}
                >
                  {a.kind === "image" ? (
                    <img src={a.dataUrl} alt={a.name} className="size-8 rounded object-cover shrink-0" />
                  ) : (
                    <button
                      className="size-8 rounded bg-orange-500/20 flex items-center justify-center shrink-0 hover:bg-orange-500/40"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={() => audioEngine.playDataUrl(a.dataUrl, 0.8)}
                      title="Előnézet"
                    >
                      <Play className="size-3.5" />
                    </button>
                  )}
                  <span className="text-[11px] font-medium text-orange-200 truncate flex-1">{a.name}</span>
                  <button
                    className="opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-rose-400 transition-opacity"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => removeAsset(a.id)}
                    title="Törlés"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {CATEGORY_ORDER.filter((c) => c !== "custom").map((cat) => {
          const meta = CATEGORY_META[cat];
          const items = visible(cat);
          if (q && items.length === 0) return null;
          return (
            <section key={cat}>
              <header className="flex items-center gap-2 mb-2">
                <span className="size-2.5 rounded-full" style={{ background: meta.color }} />
                <h3 className="text-xs font-bold text-zinc-200 tracking-wide">{meta.label.toUpperCase()}</h3>
                <span className="text-[10px] text-zinc-500">({items.length})</span>
              </header>
              <p className="text-[10px] text-zinc-500 mb-2 -mt-1 ml-4.5">{meta.description}</p>
              <div className="space-y-1.5">
                {items.map((t) => {
                  const Icon = blockIcon(t.icon);
                  return (
                    <div
                      key={t.id}
                      className="flex items-center gap-2.5 rounded-md border px-2.5 py-2 cursor-grab active:cursor-grabbing touch-none select-none transition-transform hover:translate-x-0.5"
                      style={{
                        background: `${meta.color}14`,
                        borderColor: `${meta.color}55`,
                      }}
                      onPointerDown={(e) => {
                        if (e.button !== 0) return;
                        begin(
                          {
                            source: "library",
                            typeId: t.id,
                            label: t.label,
                            icon: t.icon,
                            color: meta.color,
                            chipClass: meta.chipClass,
                          },
                          e,
                        );
                      }}
                      title={t.description}
                    >
                      <span
                        className="size-7 rounded flex items-center justify-center shrink-0"
                        style={{ background: `${meta.color}26`, color: meta.color }}
                      >
                        <Icon className="size-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold text-zinc-100 truncate">{t.label}</div>
                        <div className="text-[10px] text-zinc-500 truncate">{t.description}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
