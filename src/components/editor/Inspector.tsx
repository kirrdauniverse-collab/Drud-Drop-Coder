"use client";

import { Fragment, useState } from "react";
import { useEditor, resolveTypeDef } from "@/store/editor";
import { CATEGORY_META, type BlockParamDef } from "@/lib/types";
import { blockIcon } from "./icons";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Copy, Trash2, MousePointerClick, Gauge, Repeat as RepeatIcon, Volume2, Ruler } from "lucide-react";

export function Inspector() {
  const project = useEditor((s) => s.project);
  const selectedBlockId = useEditor((s) => s.selectedBlockId);
  const selectedTrackId = useEditor((s) => s.selectedTrackId);
  const updateParam = useEditor((s) => s.updateParam);
  const resizeBlock = useEditor((s) => s.resizeBlock);
  const moveBlock = useEditor((s) => s.moveBlock);
  const deleteBlock = useEditor((s) => s.deleteBlock);
  const duplicateBlock = useEditor((s) => s.duplicateBlock);
  const pushHistory = useEditor((s) => s.pushHistory);
  const removeTrack = useEditor((s) => s.removeTrack);
  const setProjectName = useEditor((s) => s.setProjectName);
  const setTempo = useEditor((s) => s.setTempo);
  const setStepCount = useEditor((s) => s.setStepCount);
  const setLoop = useEditor((s) => s.setLoop);
  const setMasterVolume = useEditor((s) => s.setMasterVolume);

  const block = selectedBlockId ? project.blocks.find((b) => b.id === selectedBlockId) : undefined;
  const track = selectedTrackId ? project.tracks.find((t) => t.id === selectedTrackId) : undefined;

  return (
    <div className="h-full flex flex-col bg-zinc-950 overflow-y-auto appmixer-scroll">
      <div className="p-3 border-b border-zinc-800/80">
        <span className="text-sm font-semibold text-zinc-100">Tulajdonságok</span>
      </div>

      <div className="p-3 space-y-4">
        {/* ===== Blokk kiválasztva ===== */}
        {block && (() => {
          const def = resolveTypeDef(block.typeId, project.assets);
          if (!def) return <EmptyHint text="A blokk típusa nem található (törölt feltöltés?)" />;
          const meta = CATEGORY_META[def.category];
          const Icon = blockIcon(def.icon);
          return (
            <>
              <header className="flex items-start gap-2.5">
                <span
                  className="size-9 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: `${meta.color}26`, color: meta.color }}
                >
                  <Icon className="size-5" />
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-bold text-zinc-100 truncate">{def.label}</div>
                  <span
                    className="inline-block mt-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded"
                    style={{ background: `${meta.color}22`, color: meta.color }}
                  >
                    {meta.label}
                  </span>
                </div>
              </header>
              <p className="text-[11px] leading-relaxed text-zinc-400 -mt-1">{def.description}</p>

              <div className="grid grid-cols-2 gap-2">
                <div className="grid gap-1">
                  <Label className="text-[10px] text-zinc-400 flex items-center gap-1"><MousePointerClick className="size-3" /> Kezdő lépés</Label>
                  <Input
                    type="number"
                    min={0}
                    max={project.stepCount - 1}
                    value={block.start}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      if (!isNaN(v)) moveBlock(block.id, block.trackId, v);
                    }}
                    className="h-8 bg-zinc-900 border-zinc-800 text-xs"
                  />
                </div>
                <div className="grid gap-1">
                  <Label className="text-[10px] text-zinc-400 flex items-center gap-1"><Ruler className="size-3" /> Hossz (lépés)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={project.stepCount - block.start}
                    value={block.length}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      if (!isNaN(v) && v >= 1) resizeBlock(block.id, v);
                    }}
                    className="h-8 bg-zinc-900 border-zinc-800 text-xs"
                  />
                </div>
              </div>

              <div className="space-y-3.5 pt-1">
                {def.params.length === 0 && (
                  <p className="text-[11px] text-zinc-500 italic">Ennek a blokknak nincs beállítása.</p>
                )}
                {def.params.map((pd, idx) => (
                  <Fragment key={pd.key}>
                    {pd.group && (idx === 0 || def.params[idx - 1].group !== pd.group) && (
                      <div
                        className={`text-[10px] font-bold uppercase tracking-wider text-zinc-500 ${idx === 0 ? "pb-0.5" : "border-t border-zinc-800/70 pt-2.5 mt-1"}`}
                      >
                        {pd.group}
                      </div>
                    )}
                    <ParamControl
                      def={pd}
                      value={block.params[pd.key]}
                      maxStart={project.stepCount - block.start}
                      onChange={(v, commit) => updateParam(block.id, pd.key, v, commit)}
                      onGestureStart={() => pushHistory()}
                    />
                  </Fragment>
                ))}
              </div>

              <div className="flex gap-2 pt-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 flex-1 gap-1.5 bg-zinc-900 border-zinc-700 hover:bg-zinc-800"
                  onClick={() => duplicateBlock(block.id)}
                >
                  <Copy className="size-3.5" /> Duplikálás
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1.5 bg-zinc-900 border-zinc-700 hover:bg-rose-950 hover:border-rose-700 hover:text-rose-300"
                  onClick={() => deleteBlock(block.id)}
                >
                  <Trash2 className="size-3.5" /> Törlés
                </Button>
              </div>
            </>
          );
        })()}

        {/* ===== Sáv kiválasztva ===== */}
        {!block && track && (() => {
          const meta = CATEGORY_META[track.category];
          const count = project.blocks.filter((b) => b.trackId === track.id).length;
          return (
            <>
              <header className="flex items-center gap-2.5">
                <span className="size-3 rounded-full" style={{ background: meta.color }} />
                <div>
                  <div className="text-sm font-bold text-zinc-100">{track.name}</div>
                  <div className="text-[10px] text-zinc-500">{meta.label} · {count} blokk</div>
                </div>
              </header>
              <p className="text-[11px] text-zinc-400">{meta.description}</p>
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3 space-y-2">
                <p className="text-[11px] text-zinc-400">
                  {track.category === "sound" || track.category === "custom" ? (
                    <>Hangsáv: a hangerőcsúszkával hangolhatod, az M gombbal lenémíthatod, az S gombbal szólóztathatod – pontosan úgy, mint egy zeneszerkesztőben. A szóló a többi sáv hangját is elnémítja, de a grafika tovább fut.</>
                  ) : track.category === "graphics" ? (
                    <>Vizuális sáv: a szem ikonnal elrejtheted a blokkjait anélkül, hogy törölnéd őket – így gyorsan kipróbálhatod, milyen nélküle a kompozíció.</>
                  ) : (
                    <>Futtató sáv: a kapcsolóval ki- és bekapcsolhatod a blokkjait. Kikapcsolt állapotban a logika, bemenet vagy adat rutinok nem futnak le.</>
                  )}
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 w-full gap-1.5 bg-zinc-900 border-zinc-700 hover:bg-rose-950 hover:border-rose-700 hover:text-rose-300"
                  onClick={() => removeTrack(track.id)}
                  disabled={project.tracks.length <= 1}
                >
                  <Trash2 className="size-3.5" /> Sáv törlése (a blokkjaival együtt)
                </Button>
              </div>
            </>
          );
        })()}

        {/* ===== Semmi nincs kiválasztva → projekt beállítások ===== */}
        {!block && !track && (
          <>
            <header className="flex items-center gap-2">
              <Gauge className="size-4 text-amber-400" />
              <span className="text-sm font-bold text-zinc-100">Projekt beállításai</span>
            </header>
            <div className="grid gap-1.5">
              <Label className="text-[10px] text-zinc-400">Projekt neve</Label>
              <Input
                value={project.name}
                onChange={(e) => setProjectName(e.target.value)}
                className="h-9 bg-zinc-900 border-zinc-800 text-xs"
              />
            </div>
            <div className="grid gap-2">
              <div className="flex justify-between items-center">
                <Label className="text-[10px] text-zinc-400 flex items-center gap-1">
                  <Gauge className="size-3" /> Lépés-sebesség
                </Label>
                <span className="text-xs font-mono text-amber-300">{project.tempoMs} ms / lépés</span>
              </div>
              <Slider
                value={[project.tempoMs]}
                min={80}
                max={800}
                step={10}
                onValueChange={(v) => setTempo(v[0])}
              />
              <p className="text-[10px] text-zinc-500">Kisebb = gyorsabb ritmus (mint a BPM a zenénél)</p>
            </div>
            <div className="grid gap-2">
              <div className="flex justify-between items-center">
                <Label className="text-[10px] text-zinc-400 flex items-center gap-1">
                  <Ruler className="size-3" /> Lépések száma
                </Label>
                <span className="text-xs font-mono text-amber-300">{project.stepCount}</span>
              </div>
              <Slider
                value={[project.stepCount]}
                min={16}
                max={128}
                step={8}
                onValueChange={(v) => setStepCount(v[0])}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-[10px] text-zinc-400 flex items-center gap-1">
                <RepeatIcon className="size-3" /> Körkörös lejátszás
              </Label>
              <Switch checked={project.loop} onCheckedChange={setLoop} />
            </div>
            <div className="grid gap-2">
              <div className="flex justify-between items-center">
                <Label className="text-[10px] text-zinc-400 flex items-center gap-1">
                  <Volume2 className="size-3" /> Fő hangerő
                </Label>
                <span className="text-xs font-mono text-amber-300">{Math.round(project.masterVolume * 100)}%</span>
              </div>
              <Slider
                value={[project.masterVolume]}
                min={0}
                max={1}
                step={0.05}
                onValueChange={(v) => setMasterVolume(v[0])}
              />
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
              <p className="text-[11px] leading-relaxed text-zinc-400">
                Kattints egy blokkra az idővonalon a paramétereinek szerkesztéséhez, vagy egy sáv
                nevére a sáv beállításaihoz. A blokkokat húzva mozgathatod, a jobb szélét húzva
                átméretezheted.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function EmptyHint({ text }: { text: string }) {
  return <p className="text-xs text-zinc-500 italic">{text}</p>;
}

// ===== Egy paraméter vezérlője =====
function ParamControl({
  def, value, maxStart, onChange, onGestureStart,
}: {
  def: BlockParamDef;
  value: string | number | boolean | undefined;
  maxStart: number;
  onChange: (v: string | number | boolean, commit: boolean) => void;
  onGestureStart: () => void;
}) {
  // Szerkesztés közben lokális piszkozat, egyébként a store-ból jövő érték látszik
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? String(value ?? def.default);

  const label = (
    <Label className="text-[10px] text-zinc-400 flex items-center justify-between">
      <span>{def.label}</span>
      {def.type === "slider" && <span className="font-mono text-amber-300">{String(value ?? def.default)}</span>}
    </Label>
  );

  switch (def.type) {
    case "number":
      return (
        <div className="grid gap-1">
          {label}
          <Input
            type="number"
            min={def.min}
            max={def.key === "target" ? undefined : def.max}
            step={def.step ?? 1}
            value={shown}
            onFocus={() => setDraft(String(value ?? def.default))}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => {
              if (draft !== null) {
                const v = parseFloat(draft);
                if (!isNaN(v)) onChange(Math.max(def.min ?? -Infinity, Math.min(def.max ?? Infinity, v)), true);
              }
              setDraft(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
            className="h-8 bg-zinc-900 border-zinc-800 text-xs"
          />
        </div>
      );
    case "slider":
      return (
        <div className="grid gap-1.5">
          {label}
          <Slider
            value={[Number(value ?? def.default)]}
            min={def.min ?? 0}
            max={def.max ?? 100}
            step={def.step ?? 1}
            onPointerDown={onGestureStart}
            onValueChange={(v) => onChange(v[0], false)}
            onValueCommit={(v) => onChange(v[0], true)}
          />
        </div>
      );
    case "text":
      return (
        <div className="grid gap-1">
          {label}
          <Input
            value={shown}
            onFocus={() => setDraft(String(value ?? def.default))}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => {
              if (draft !== null) onChange(draft, true);
              setDraft(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
            className="h-8 bg-zinc-900 border-zinc-800 text-xs"
            placeholder={def.key === "actionValue" ? "felirat / cél / hang neve" : ""}
          />
          {def.key === "actionValue" && (
            <p className="text-[9px] text-zinc-600">felirat szövege · ugrásnál a cél lépésszám · hangnál: laser / robbanas / erme / pitty / suhintas / riasztas / ugras / bonusz / talalat / gyozelem / jatek_vege / pukkanas / kattanas / mennydorges · életnél/hónál: a hozzáadás (pl. 1 vagy -1, 10)</p>
          )}
        </div>
      );
    case "select":
      return (
        <div className="grid gap-1">
          {label}
          <Select value={String(value ?? def.default)} onValueChange={(v) => onChange(v, true)}>
            <SelectTrigger className="h-8 bg-zinc-900 border-zinc-800 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-zinc-700 text-xs">
              {def.options?.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    case "color":
      return (
        <div className="grid gap-1">
          {label}
          <div className="flex gap-2">
            <input
              type="color"
              value={String(value ?? def.default)}
              onChange={(e) => onChange(e.target.value, false)}
              onBlur={(e) => onChange(e.target.value, true)}
              className="h-8 w-12 rounded border border-zinc-800 bg-zinc-900 cursor-pointer"
            />
            <Input
              value={String(value ?? def.default)}
              onChange={(e) => onChange(e.target.value, false)}
              onBlur={() => onChange(String(value ?? def.default), true)}
              className="h-8 flex-1 font-mono text-xs bg-zinc-900 border-zinc-800"
            />
          </div>
        </div>
      );
    case "toggle":
      return (
        <div className="flex items-center justify-between">
          <Label className="text-[10px] text-zinc-400">{def.label}</Label>
          <Switch
            checked={Boolean(value ?? def.default)}
            onCheckedChange={(v) => onChange(v, true)}
          />
        </div>
      );
  }
  void maxStart;
  return null;
}
