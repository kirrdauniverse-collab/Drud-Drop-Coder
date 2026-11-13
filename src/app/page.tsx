"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { TopBar } from "@/components/editor/TopBar";
import { Library } from "@/components/editor/Library";
import { Timeline } from "@/components/editor/Timeline";
import { Inspector } from "@/components/editor/Inspector";
import { Preview } from "@/components/editor/Preview";
import { HelpDialog, CloudDialog } from "@/components/editor/dialogs";
import { createElement } from "react";
import { blockIcon } from "@/components/editor/icons";
import { useEditor } from "@/store/editor";
import { useDrag } from "@/store/drag";
import { getEngine } from "@/lib/engine";
import { cn } from "@/lib/utils";
import { LayoutGrid, Library as LibraryIcon, Settings2, MonitorPlay } from "lucide-react";

const emptySubscribe = () => () => {};

function useMounted() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}

function useFirstVisit() {
  return useSyncExternalStore(
    emptySubscribe,
    () => {
      try {
        return !localStorage.getItem("appmixer.seen");
      } catch {
        return false;
      }
    },
    () => false,
  );
}

type MobilePanel = "timeline" | "library" | "inspector" | "preview";

export default function Home() {
  const mounted = useMounted();
  const firstVisit = useFirstVisit();
  const [userHelpOpen, setUserHelpOpen] = useState(false);
  const [helpDismissed, setHelpDismissed] = useState(false);
  const [cloudOpen, setCloudOpen] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>("timeline");

  // Első látogatáskor magától felugrik a súgó (nem kell effect)
  const helpOpen = userHelpOpen || (firstVisit && !helpDismissed);
  const setHelpOpen = useCallback((v: boolean) => {
    if (v) {
      setUserHelpOpen(true);
    } else {
      setUserHelpOpen(false);
      setHelpDismissed(true);
      try { localStorage.setItem("appmixer.seen", "1"); } catch {}
    }
  }, []);

  // Globális gyorsbillentyűk
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      // Ha gombra/menüpontra fókuszálunk, a Szóköz az adott elemet aktiválja
      // (így nem indít el lejátszást vagy nem aktiválódik menüelem véletlenül).
      // Az Escape és a többi gyorsbillentyű ilyenkor is működik.
      const el = e.target as HTMLElement | null;
      const closestSafe = (sel: string) => {
        try { return el && typeof el.closest === "function" ? el.closest(sel) : null; } catch { return null; }
      };
      if (e.key === " " && el && (tag === "BUTTON" || closestSafe("[role='menuitem']") || closestSafe("[role='menu']"))) {
        return;
      }
      const ed = useEditor.getState();

      if (e.key === "Escape") {
        getEngine()?.stop();
        useEditor.getState().setPlaying(false);
        return;
      }
      if (e.key === " ") {
        // Ha nem fut a lejátszás: indítás. Ha fut: a motor lövésre használja.
        if (!ed.playing) {
          e.preventDefault();
          const eng = getEngine();
          if (eng && !eng.playing) {
            eng.play();
            ed.setPlaying(true);
          }
        }
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) ed.redo();
        else ed.undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        ed.redo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d") {
        e.preventDefault();
        if (ed.selectedBlockId) ed.duplicateBlock(ed.selectedBlockId);
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (ed.selectedBlockId) {
          e.preventDefault();
          ed.deleteBlock(ed.selectedBlockId);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!mounted) {
    return (
      <div className="h-screen flex items-center justify-center bg-zinc-950">
        <div className="flex flex-col items-center gap-3">
          <span className="size-12 rounded-xl bg-gradient-to-br from-amber-400 to-orange-600 animate-pulse" />
          <span className="text-sm text-zinc-500">AppMixer betöltése…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-zinc-950 text-zinc-100 overflow-hidden">
      <TopBar onOpenHelp={() => setHelpOpen(true)} onOpenCloud={() => setCloudOpen(true)} />

      <main className="flex-1 min-h-0 flex">
        {/* Könyvtár (bal) */}
        <aside
          className={cn(
            "border-r border-zinc-800/80 w-full lg:w-72 shrink-0",
            mobilePanel === "library" ? "flex" : "hidden",
            "lg:flex",
          )}
        >
          <div className="w-full lg:w-72">
            <Library />
          </div>
        </aside>

        {/* Idővonal + előnézet (közép) */}
        <section
          className={cn(
            "flex-1 min-w-0 min-h-0 flex-col",
            mobilePanel === "timeline" || mobilePanel === "preview" ? "flex" : "hidden",
            "lg:flex",
          )}
        >
          <div className={cn("flex-1 min-h-0", mobilePanel === "preview" && "hidden lg:block")}>
            <Timeline />
          </div>
          <div
            className={cn(
              "shrink-0 border-t border-zinc-800/80 h-72 md:h-64 xl:h-72",
              mobilePanel === "timeline" && "hidden lg:block",
            )}
          >
            <Preview />
          </div>
        </section>

        {/* Tulajdonságok (jobb) */}
        <aside
          className={cn(
            "border-l border-zinc-800/80 w-full xl:w-80 shrink-0",
            mobilePanel === "inspector" ? "flex" : "hidden",
            "xl:flex",
          )}
        >
          <div className="w-full xl:w-80">
            <Inspector />
          </div>
        </aside>
      </main>

      {/* Mobiltabok */}
      <nav className="lg:hidden shrink-0 border-t border-zinc-800 bg-zinc-900/90 backdrop-blur flex" aria-label="Panelváltás">
        {(
          [
            { id: "timeline", label: "Sávok", icon: LayoutGrid },
            { id: "library", label: "Könyvtár", icon: LibraryIcon },
            { id: "preview", label: "Előnézet", icon: MonitorPlay },
            { id: "inspector", label: "Beállítások", icon: Settings2 },
          ] as { id: MobilePanel; label: string; icon: typeof LayoutGrid }[]
        ).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setMobilePanel(id)}
            className={cn(
              "flex-1 h-14 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors",
              mobilePanel === id ? "text-amber-400" : "text-zinc-500 hover:text-zinc-300",
            )}
            aria-current={mobilePanel === id}
          >
            <Icon className="size-5" />
            {label}
          </button>
        ))}
      </nav>

      <HelpDialog open={helpOpen} onOpenChange={setHelpOpen} />
      <CloudDialog open={cloudOpen} onOpenChange={setCloudOpen} />
      <DragGhost />
    </div>
  );
}

// A húzott elem "szelleme", ami az egérrel mozog
function DragGhost() {
  const active = useDrag((s) => s.active);
  const x = useDrag((s) => s.x);
  const y = useDrag((s) => s.y);
  const label = useDrag((s) => s.label);
  const icon = useDrag((s) => s.icon);
  const chipClass = useDrag((s) => s.chipClass);

  if (!active) return null;
  return (
    <div
      className="fixed z-[100] pointer-events-none flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-semibold shadow-2xl shadow-black/60 opacity-90 scale-105"
      style={{ left: x - 40, top: y - 16, background: "#18181b" }}
    >
      <span className={cn("rounded px-1.5 py-1 border flex items-center gap-1", chipClass)}>
        {createElement(blockIcon(icon), { className: "size-3.5" })}
        {label}
      </span>
    </div>
  );
}
