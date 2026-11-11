"use client";

import { useRef } from "react";
import { useEditor } from "@/store/editor";
import { getEngine } from "@/lib/engine";
import { audioEngine } from "@/lib/audio";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Play, Pause, Square, Repeat, Volume2, Undo2, Redo2, Save, Cloud, HelpCircle, SlidersHorizontal, FileDown, FileUp, FilePlus2, Rocket, Moon, Gauge, Gamepad2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function TopBar({
  onOpenHelp, onOpenCloud,
}: {
  onOpenHelp: () => void;
  onOpenCloud: () => void;
}) {
  const project = useEditor((s) => s.project);
  const playing = useEditor((s) => s.playing);
  const playStep = useEditor((s) => s.playStep);
  const canUndo = useEditor((s) => s.canUndo);
  const canRedo = useEditor((s) => s.canRedo);
  const dirty = useEditor((s) => s.dirty);
  const setPlaying = useEditor((s) => s.setPlaying);
  const setProjectName = useEditor((s) => s.setProjectName);
  const setTempo = useEditor((s) => s.setTempo);
  const setLoop = useEditor((s) => s.setLoop);
  const setMasterVolume = useEditor((s) => s.setMasterVolume);
  const undo = useEditor((s) => s.undo);
  const redo = useEditor((s) => s.redo);
  const newEmpty = useEditor((s) => s.newEmpty);
  const loadDemo = useEditor((s) => s.loadDemo);
  const saveLocal = useEditor((s) => s.saveLocal);
  const importRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handlePlay = () => {
    const engine = getEngine();
    if (!engine) return;
    if (!engine.playing) {
      engine.play();
      setPlaying(true);
    } else {
      engine.pause();
    }
  };

  const handleStop = () => {
    const engine = getEngine();
    engine?.stop();
    setPlaying(false);
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project.name.replace(/[\\/:*?"<>|]/g, "_")}.appmixer.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const text = await file.text();
      const p = JSON.parse(text);
      if (Array.isArray(p?.tracks) && Array.isArray(p?.blocks)) {
        useEditor.getState().loadProject(p);
        toast({ title: "Projekt betöltve", description: `„${p.name ?? "névtelen"}” importálva a fájlból.` });
      } else {
        toast({ title: "Érvénytelen fájl", description: "Ez a fájl nem tűnik AppMixer projektnek.", variant: "destructive" });
      }
    } catch {
      toast({ title: "A fájl beolvasása nem sikerült", variant: "destructive" });
    }
    if (importRef.current) importRef.current.value = "";
  };

  return (
    <header className="shrink-0 border-b border-zinc-800 bg-zinc-900/80 backdrop-blur">
      <div className="flex items-center gap-2 px-3 h-14">
        {/* Logó + név */}
        <div className="flex items-center gap-2.5 shrink-0">
          <span className="size-8 rounded-lg bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/25">
            <SlidersHorizontal className="size-4.5 text-zinc-950" />
          </span>
          <div className="hidden sm:block">
            <div className="text-sm font-extrabold tracking-tight text-zinc-50 leading-none">AppMixer</div>
            <div className="text-[9px] text-zinc-500 leading-none mt-0.5">sokműsoros alkalmazásszerkesztő</div>
          </div>
        </div>

        <div className="w-px h-8 bg-zinc-800 hidden sm:block" />

        {/* Projektnév */}
        <input
          value={project.name}
          onChange={(e) => setProjectName(e.target.value)}
          className="min-w-0 w-36 md:w-52 bg-transparent text-sm font-semibold text-zinc-100 border-b border-transparent hover:border-zinc-700 focus:border-amber-500 outline-none py-1 px-1"
          aria-label="Projekt neve"
        />
        {dirty && <span className="size-1.5 rounded-full bg-amber-400 shrink-0" title="Mentetlen változtatások (automatikus mentés fut)" />}

        {/* Transport */}
        <div className="flex items-center gap-1 mx-auto">
          <Button
            size="icon"
            variant="ghost"
            className="size-9 text-zinc-300 hover:text-white hover:bg-zinc-800"
            onClick={handleStop}
            title="Megállítás (Esc)"
          >
            <Square className="size-4" />
          </Button>
          <Button
            size="icon"
            className="size-11 rounded-full bg-amber-500 hover:bg-amber-400 text-zinc-950 shadow-lg shadow-amber-500/30"
            onClick={handlePlay}
            title={playing ? "Szünet" : "Lejátszás (Szóköz)"}
          >
            {playing ? <Pause className="size-5" /> : <Play className="size-5 ml-0.5" />}
          </Button>
          <div className="font-mono text-xs text-zinc-400 w-20 text-center tabular-nums">
            {String(Math.min(playStep + 1, project.stepCount)).padStart(2, "0")}/{project.stepCount}
          </div>
          <div className="hidden md:flex items-center gap-2 ml-3">
            <Gauge className="size-3.5 text-zinc-500" />
            <Slider
              value={[project.tempoMs]}
              min={80}
              max={800}
              step={10}
              onValueChange={(v) => setTempo(v[0])}
              className="w-24"
            />
            <span className="font-mono text-[10px] text-zinc-500 w-14">{project.tempoMs}ms</span>
          </div>
          <div className="hidden lg:flex items-center gap-2 ml-2">
            <Repeat className={`size-3.5 ${project.loop ? "text-amber-400" : "text-zinc-600"}`} />
            <Switch checked={project.loop} onCheckedChange={setLoop} aria-label="Körkörös lejátszás" />
          </div>
          <div className="hidden xl:flex items-center gap-2 ml-2">
            <Volume2 className="size-3.5 text-zinc-500" />
            <Slider
              value={[project.masterVolume]}
              min={0}
              max={1}
              step={0.05}
              onValueChange={(v) => {
                setMasterVolume(v[0]);
                audioEngine.setMasterVolume(v[0]);
              }}
              className="w-20"
            />
          </div>
        </div>

        {/* Jobb oldal */}
        <div className="flex items-center gap-1 shrink-0">
          <Button size="icon" variant="ghost" className="size-9 text-zinc-300 hover:bg-zinc-800" disabled={!canUndo} onClick={undo} title="Visszavonás (Ctrl+Z)">
            <Undo2 className="size-4" />
          </Button>
          <Button size="icon" variant="ghost" className="size-9 text-zinc-300 hover:bg-zinc-800" disabled={!canRedo} onClick={redo} title="Újra (Ctrl+Y)">
            <Redo2 className="size-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="size-9 text-zinc-300 hover:bg-zinc-800"
            onClick={() => {
              saveLocal();
              toast({ title: "Elmentve", description: "A projekt elmentve a böngésző tárolójába. (Automatikus mentés is fut.)" });
            }}
            title="Mentés a böngészőbe"
          >
            <Save className="size-4" />
          </Button>
          <Button size="icon" variant="ghost" className="size-9 text-zinc-300 hover:bg-zinc-800" onClick={onOpenCloud} title="Felhő projektgyűjtemény">
            <Cloud className="size-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" className="h-9 gap-1.5 border-zinc-700 bg-zinc-800/60 hover:bg-zinc-800 text-zinc-200">
                <FilePlus2 className="size-3.5" />
                <span className="hidden sm:inline">Projekt</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-zinc-900 border-zinc-700">
              <DropdownMenuItem onClick={newEmpty} className="gap-2">
                <FilePlus2 className="size-4" /> Új üres projekt
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => loadDemo("space")} className="gap-2">
                <Rocket className="size-4" /> Demó: Űr-támadás (játék)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => loadDemo("platform")} className="gap-2">
                <Gamepad2 className="size-4" /> Demó: Ugrálós kaland (platformer)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => loadDemo("chill")} className="gap-2">
                <Moon className="size-4" /> Demó: Nyugodt éjszaka
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-zinc-800" />
              <DropdownMenuItem onClick={handleExport} className="gap-2">
                <FileDown className="size-4" /> Exportálás (JSON fájl)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => importRef.current?.click()} className="gap-2">
                <FileUp className="size-4" /> Importálás (JSON fájl)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <input
            ref={importRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => void handleImportFile(e.target.files?.[0])}
          />
          <Button size="icon" variant="ghost" className="size-9 text-zinc-300 hover:bg-zinc-800" onClick={onOpenHelp} title="Súgó">
            <HelpCircle className="size-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
