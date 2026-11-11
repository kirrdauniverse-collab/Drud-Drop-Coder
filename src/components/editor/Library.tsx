"use client";

import { memo, useEffect, useRef, useState } from "react";
import { BLOCK_TYPES, CATEGORY_ORDER } from "@/lib/blocks";
import { CATEGORY_META, type Category, type CustomAsset, type BlockTypeDef } from "@/lib/types";
import { useEditor, processImageFile, processAudioFile } from "@/store/editor";
import { useDrag } from "@/store/drag";
import { blockIcon } from "./icons";
import { drawSprite } from "@/lib/sprites";
import { drawBgPreset, BG_W, BG_H, THUMB_STARS } from "@/lib/backgrounds";
import { audioEngine } from "@/lib/audio";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, Trash2, Play, Search, Package } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// A meteor-alak determinisztikus "poly"ja az előnézethez
const THUMB_POLY = [1, 0.85, 1.1, 0.9, 1.05, 0.95, 1.1, 0.88];

// ===== Előnézeti rajzolók (ugyanaz a kód rajzolja, mint a játékot) =====

const SpriteThumb = memo(function SpriteThumb({ style, color }: { style: string; color: string }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.save();
    ctx.translate(c.width / 2, c.height / 2);
    drawSprite(ctx, style, {
      size: c.width * 0.58,
      color,
      now: 420,
      id: 3,
      vx: 40,
      poly: THUMB_POLY,
    });
    ctx.restore();
  }, [style, color]);
  return <canvas ref={ref} width={46} height={46} className="rounded-md bg-black/40 ring-1 ring-white/10 shrink-0" />;
});

const BgThumb = memo(function BgThumb({ preset }: { preset: string }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.save();
    ctx.scale(c.width / BG_W, c.height / BG_H);
    drawBgPreset(ctx, preset, 700, THUMB_STARS);
    ctx.restore();
  }, [preset]);
  return <canvas ref={ref} width={116} height={65} className="rounded-md ring-1 ring-white/10 w-full h-auto block" />;
});

// Színválasztó-háttér "előnézete" (átmenetes kis kártya)
function ColorSwatch() {
  return (
    <div
      className="size-10 rounded-md ring-1 ring-white/15"
      style={{ background: "linear-gradient(160deg, #1e1b4b 0%, #0ea5e9 100%)" }}
    />
  );
}

// ===== Könyvtár =====

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
    const added: CustomAsset[] = [];
    const errors: string[] = [];
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
  const match = (t: BlockTypeDef) =>
    !q || t.label.toLowerCase().includes(q) || t.description.toLowerCase().includes(q);
  const visibleIn = (cat: Category) =>
    BLOCK_TYPES.filter((t) => t.category === cat && !t.hidden && match(t));
  const totalVisible = BLOCK_TYPES.filter((t) => !t.hidden && match(t)).length;

  return (
    <div className="h-full flex flex-col bg-zinc-950">
      <div className="p-3 border-b border-zinc-800/80 space-y-2.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-zinc-100">Blokk-könyvtár</span>
          <span className="text-[10px] text-zinc-500 ml-auto tabular-nums">{totalVisible} elem · húzd a rácsba →</span>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-zinc-500" />
          <Input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Keresés: cica, tengerpart, dob…"
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
          const items = visibleIn(cat);
          if (items.length === 0) return null;

          // Alcsoportok a "tömlőn" belül (Sprite-ok, Hátterek, Effektek, …)
          const groups: { name: string; items: BlockTypeDef[] }[] = [];
          for (const t of items) {
            const g = t.group ?? "";
            const last = groups[groups.length - 1];
            if (last && last.name === g) last.items.push(t);
            else groups.push({ name: g, items: [t] });
          }

          return (
            <section key={cat}>
              <header className="flex items-center gap-2 mb-2">
                <span className="size-2.5 rounded-full" style={{ background: meta.color }} />
                <h3 className="text-xs font-bold text-zinc-200 tracking-wide">{meta.label.toUpperCase()}</h3>
                <span className="text-[10px] text-zinc-500">({items.length})</span>
              </header>
              {groups.map((g, gi) => (
                <div key={`${g.name}-${gi}`} className={g.name ? "mb-3" : ""}>
                  {g.name && (
                    <div className="flex items-center gap-1.5 mb-1.5 pl-0.5">
                      <Package className="size-3 text-zinc-600" />
                      <h4 className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">{g.name}</h4>
                      <span className="text-[9px] text-zinc-600">({g.items.length})</span>
                    </div>
                  )}
                  <ItemGrid items={g.items} catColor={meta.color} chipClass={meta.chipClass} begin={begin} />
                </div>
              ))}
            </section>
          );
        })}

        {totalVisible === 0 && (
          <div className="text-center text-xs text-zinc-500 py-8">
            Nincs találat a keresésre.
          </div>
        )}
      </div>
    </div>
  );
}

// ===== Elemrács: a megjelenítés a blokk fajtájához alkalmazkodik =====

function ItemGrid({
  items,
  catColor,
  chipClass,
  begin,
}: {
  items: BlockTypeDef[];
  catColor: string;
  chipClass: string;
  begin: ReturnType<typeof useDrag.getState>["begin"];
}) {
  // Hátterek és sprite-ok: rácsos elrendezés előnézeti képpel
  if (items[0]?.preview?.kind === "bg") {
    return (
      <div className="grid grid-cols-2 gap-1.5">
        {items.map((t) => (
          <div
            key={t.id}
            className="rounded-lg border overflow-hidden cursor-grab active:cursor-grabbing touch-none select-none transition-transform hover:scale-[1.03] hover:-translate-y-0.5"
            style={{ background: `${catColor}14`, borderColor: `${catColor}55` }}
            onPointerDown={(e) => {
              if (e.button !== 0) return;
              begin({ source: "library", typeId: t.id, label: t.label, icon: t.icon, color: catColor, chipClass }, e);
            }}
            title={t.description}
          >
            {t.preview?.kind === "bg" && t.preview.style ? (
              <BgThumb preset={t.preview.style} />
            ) : (
              <div className="h-[65px] flex items-center justify-center" style={{ background: `${catColor}22` }}>
                <ColorSwatch />
              </div>
            )}
            <div className="px-1.5 py-1 text-[10px] font-semibold text-zinc-100 truncate">{t.label}</div>
          </div>
        ))}
      </div>
    );
  }

  if (items[0]?.preview?.kind === "sprite") {
    return (
      <div className="grid grid-cols-2 gap-1.5">
        {items.map((t) => (
          <div
            key={t.id}
            className="flex items-center gap-1.5 rounded-md border px-1.5 py-1 cursor-grab active:cursor-grabbing touch-none select-none transition-colors hover:border-white/30"
            style={{ background: `${catColor}14`, borderColor: `${catColor}55` }}
            onPointerDown={(e) => {
              if (e.button !== 0) return;
              begin({ source: "library", typeId: t.id, label: t.label, icon: t.icon, color: catColor, chipClass }, e);
            }}
            title={t.description}
          >
            {t.preview?.kind === "sprite" && t.preview.style ? (
              <SpriteThumb style={t.preview.style} color={t.preview.color ?? "#fbbf24"} />
            ) : (
              <span className="size-[46px] rounded-md bg-black/40 ring-1 ring-white/10 shrink-0" />
            )}
            <span className="text-[10px] font-semibold text-zinc-100 leading-tight line-clamp-2 min-w-0">{t.label}</span>
          </div>
        ))}
      </div>
    );
  }

  // Hangok: sor lejátsz-gombbal
  if (items[0] && (items[0].kind === "sfx" || items[0].kind === "music")) {
    return (
      <div className="space-y-1">
        {items.map((t) => {
          const Icon = blockIcon(t.icon);
          const preview = () => {
            if (t.kind === "sfx") {
              audioEngine.playSfx(t.id, 0.7);
            } else {
              const params: Record<string, string | number | boolean> = {};
              for (const p of t.params) params[p.key] = p.default;
              audioEngine.playMusic(t.id, params, 8, 240, 0.5);
            }
          };
          return (
            <div
              key={t.id}
              className="group flex items-center gap-2 rounded-md border px-2 py-1.5 cursor-grab active:cursor-grabbing touch-none select-none transition-transform hover:translate-x-0.5"
              style={{ background: `${catColor}14`, borderColor: `${catColor}55` }}
              onPointerDown={(e) => {
                if (e.button !== 0) return;
                begin({ source: "library", typeId: t.id, label: t.label, icon: t.icon, color: catColor, chipClass }, e);
              }}
              title={t.description}
            >
              <button
                className="size-6 rounded flex items-center justify-center shrink-0 hover:brightness-125"
                style={{ background: `${catColor}30`, color: catColor }}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={preview}
                title="Hallgatás (kattints!)"
              >
                <Play className="size-3" />
              </button>
              <span
                className="size-6 rounded flex items-center justify-center shrink-0"
                style={{ background: `${catColor}26`, color: catColor }}
              >
                <Icon className="size-3.5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-zinc-100 truncate">{t.label}</div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // Minden más: hagyományos sor ikonnal és leírással
  return (
    <div className="space-y-1.5">
      {items.map((t) => {
        const Icon = blockIcon(t.icon);
        return (
          <div
            key={t.id}
            className="flex items-center gap-2.5 rounded-md border px-2.5 py-2 cursor-grab active:cursor-grabbing touch-none select-none transition-transform hover:translate-x-0.5"
            style={{
              background: `${catColor}14`,
              borderColor: `${catColor}55`,
            }}
            onPointerDown={(e) => {
              if (e.button !== 0) return;
              begin({ source: "library", typeId: t.id, label: t.label, icon: t.icon, color: catColor, chipClass }, e);
            }}
            title={t.description}
          >
            <span
              className="size-7 rounded flex items-center justify-center shrink-0"
              style={{ background: `${catColor}26`, color: catColor }}
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
  );
}
