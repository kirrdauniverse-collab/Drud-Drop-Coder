"use client";

import { useEffect, useRef, useState } from "react";
import { useEditor } from "@/store/editor";
import { getEngine, initEngine } from "@/lib/engine";
import type { EngineEvent } from "@/lib/types";
import { Play, Activity, ScrollText, Heart } from "lucide-react";
import { cn } from "@/lib/utils";

const TONE_COLORS: Record<EngineEvent["tone"], string> = {
  info: "text-zinc-400",
  gfx: "text-cyan-300",
  sfx: "text-emerald-300",
  logic: "text-violet-300",
  data: "text-rose-300",
  warn: "text-red-400 font-semibold",
};

export function Preview() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const playing = useEditor((s) => s.playing);
  const setPlaying = useEditor((s) => s.setPlaying);
  const setPlayStep = useEditor((s) => s.setPlayStep);
  const [events, setEvents] = useState<EngineEvent[]>([]);
  const [vars, setVars] = useState<Record<string, number>>({});
  const [overlay, setOverlay] = useState(false);

  // Motor inicializálása egyszer
  useEffect(() => {
    const engine = initEngine(
      () => useEditor.getState().project,
      {
        onEvent: (e) => setEvents((prev) => [...prev.slice(-59), e]),
        onStep: (s) => setPlayStep(s),
        onGameOver: () => setPlaying(false),
      },
    );
    engine.attachCanvas(canvasRef.current);

    const varsTimer = setInterval(() => {
      const e = getEngine();
      if (e) setVars({ ...e.vars });
      setOverlay(e?.overlayActive() ?? false);
      const ed = useEditor.getState();
      if (ed.playing !== (e?.playing ?? false) && !(e?.paused ?? false)) setPlaying(e?.playing ?? false);
    }, 250);

    return () => {
      clearInterval(varsTimer);
      engine.attachCanvas(null);
      engine.destroy();
    };
  }, [setPlaying, setPlayStep]);

  // Napló görgetése aljára
  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [events]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const engine = getEngine();
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    engine?.handleCanvasClick(x, y);
  };

  // Egér/ujj követés a játékosnak (input.pointer blokkhoz)
  const handleCanvasMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const engine = getEngine();
    if (!engine) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    engine.handleCanvasHover(x, y);
  };

  const handlePlay = () => {
    const engine = getEngine();
    if (!engine) return;
    setEvents([]);
    engine.play();
    setPlaying(true);
  };

  const lives = vars["lives"] ?? 3;
  const score = vars["score"] ?? 0;
  const extraVars = Object.entries(vars).filter(([k]) => !["score", "lives"].includes(k));

  return (
    <div className="h-full flex flex-col md:flex-row bg-zinc-950 min-h-0">
      {/* Vászon */}
      <div className="relative md:w-[46%] lg:w-[42%] shrink-0 flex items-center justify-center p-3 border-b md:border-b-0 md:border-r border-zinc-800/80 bg-zinc-950">
        <div className="relative w-full max-w-[520px]">
          <canvas
            ref={canvasRef}
            width={960}
            height={540}
            onClick={handleCanvasClick}
            onPointerMove={handleCanvasMove}
            className="w-full aspect-video rounded-lg border border-zinc-800 shadow-2xl shadow-black bg-[#09090f] cursor-crosshair touch-none"
          />
          {!playing && !overlay && (
            <button
              onClick={handlePlay}
              className="absolute inset-0 rounded-lg flex flex-col items-center justify-center gap-3 bg-black/45 hover:bg-black/30 transition-colors group"
              aria-label="Lejátszás indítása"
            >
              <span className="size-16 rounded-full bg-amber-500 text-zinc-950 flex items-center justify-center shadow-lg shadow-amber-500/40 group-hover:scale-110 transition-transform">
                <Play className="size-8 ml-1" fill="currentColor" />
              </span>
              <span className="text-sm font-semibold text-zinc-100">Lejátszás (Szóköz)</span>
              <span className="text-[11px] text-zinc-400">a kompozíció életre kel…</span>
            </button>
          )}
        </div>
      </div>

      {/* HUD + eseménynapló */}
      <div className="flex-1 min-w-0 flex flex-col md:grid md:grid-rows-[auto_1fr] gap-2 p-3">
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2.5">
          <div className="flex items-center gap-2 mb-1.5">
            <Activity className="size-3.5 text-amber-400" />
            <span className="text-[11px] font-bold text-zinc-300 tracking-wide">ÉLŐ ÁLLAPOT</span>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
            <span className="text-sm font-mono font-bold text-amber-300">{score} pont</span>
            <span className="flex items-center gap-1">
              {Array.from({ length: Math.max(0, Math.min(10, lives)) }, (_, i) => (
                <Heart key={i} className="size-3.5 text-rose-400" fill="currentColor" />
              ))}
              {lives > 10 && <span className="text-xs text-rose-300">+{lives - 10}</span>}
              {lives <= 0 && <span className="text-xs text-zinc-500">nincs élet</span>}
            </span>
            {extraVars.slice(0, 4).map(([k, v]) => (
              <span key={k} className="text-xs font-mono text-zinc-300">{k}: <span className="text-rose-300">{v}</span></span>
            ))}
          </div>
        </div>

        <div
          ref={logRef}
          className="flex-1 min-h-[120px] overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-900/30 px-3 py-2 space-y-0.5 appmixer-scroll"
          aria-live="polite"
        >
          <div className="flex items-center gap-2 sticky top-0 bg-zinc-900/30 backdrop-blur py-0.5 mb-1">
            <ScrollText className="size-3.5 text-zinc-500" />
            <span className="text-[11px] font-bold text-zinc-400 tracking-wide">ESÉMÉNYNAPLÓ</span>
          </div>
          {events.length === 0 && (
            <p className="text-[11px] text-zinc-600 italic py-2">
              Indítsd el a lejátszást – itt látod lépésről lépésre, mit csinál a motor a blokkjaiddal.
            </p>
          )}
          {events.map((e, i) => (
            <div key={i} className="flex gap-2 text-[11px] leading-relaxed">
              <span className="font-mono text-zinc-600 shrink-0 w-8 text-right">{e.step}.</span>
              <span className={cn("break-words", TONE_COLORS[e.tone])}>{e.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
