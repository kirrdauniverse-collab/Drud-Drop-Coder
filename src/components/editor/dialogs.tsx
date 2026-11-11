"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Cloud, Trash2, Download, RefreshCw } from "lucide-react";
import { useEditor } from "@/store/editor";
import { useToast } from "@/hooks/use-toast";
import type { Project } from "@/lib/types";

// ================= SÚGÓ =================
export function HelpDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto bg-zinc-950 border-zinc-800 appmixer-scroll">
        <DialogHeader>
          <DialogTitle className="text-lg font-extrabold text-zinc-50">Hogyan működik az AppMixer?</DialogTitle>
          <DialogDescription className="text-xs text-zinc-400">
            Sokműsoros alkalmazásszerkesztő – építs játékokat úgy, mint egy zeneszerkesztőben.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-5 text-sm text-zinc-300 leading-relaxed">
          <p>
            Gondolj a Music Makerre vagy az eJay-re – de itt nem zenét, hanem <b>működő
            alkalmazást és játékot</b> komponálsz. A sávok helyett <b>folyamatsávok</b> futnak
            párhuzamosan, a hangminták helyett pedig <b>blokkok</b> (rutinok, grafikák, hangok,
            bemenetek) ülnek az időrácson. Amikor a léptetőfej áthalad egy blokkon, az
            &quot;elszól&quot; – épp úgy, mint egy kotta.
          </p>

          <section>
            <h3 className="font-bold text-amber-300 mb-2">Gyors kezdés (5 lépés)</h3>
            <ol className="list-decimal list-inside space-y-1.5 text-[13px]">
              <li>Nyomj <b>▶ Lejátszás</b>t – az előre betöltött demó azonnal futtatható játék!</li>
              <li>A jobbra alsó <b>előnézetben</b> nyilakkal/WASD mozogj, <b>Szóközzel</b> lőj, egérrel is lőhetsz.</li>
              <li>A bal oldali <b>könyvtárból</b> húzz egy új blokkot (pl. Meteor) bármelyik sáv üres cellájába.</li>
              <li>Kattints a blokkra: a jobb oldali <b>tulajdonságpanelen</b> állítsd a paramétereit.</li>
              <li>Nyomj újra ▶ – és máris másképp fut az alkalmazásod.</li>
            </ol>
          </section>

          <section>
            <h3 className="font-bold text-amber-300 mb-2">A könyvtár egy nagy „tömlő”</h3>
            <p className="text-[13px]">
              A bal oldali könyvtár úgy működik, mint az eJay mintadobozai: <b>több tucat sprite, háttér
              és hang</b> vár felhasználásra, előnézeti képpel. <b>Bármelyikből többet is</b> bedobhatsz a
              sávokba – akár ugyanazt többször is, akár egyszerre többfélét. A lerakott blokk
              paramétereinél a <b>Stílus</b> mezővel bármikor átválthatod egy másikra, a háttéreknél pedig
              a <b>Típus</b> mezővel másik színtérre cserélheted.
            </p>
          </section>

          <section>
            <h3 className="font-bold text-amber-300 mb-2">A sávok és blokkok</h3>
            <ul className="space-y-1.5 text-[13px]">
              <li><span className="text-cyan-300 font-semibold">Grafika</span> – <b>19 kész háttér</b> (űr, tengerpart, láva, neon, szivárvány…) és <b>59 sprite</b>, mind külön húzható elemként: állatok (cica, nyuszi, sárkány, polip…), tárgyak (korona, kincsesláda, torta…), űrhajók, platformok. Mindegyik állítható: szín, méret, mozgás, szerep, darabszám. Plusz szövegek és effektek (eső, hó, tűzijáték, villámlás).</li>
              <li><span className="text-emerald-300 font-semibold">Hang</span> – <b>25 szintetizált hanghatás</b> (lézer, csobbanás, doboszló, telefon…) és <b>14 zenei loop</b> (rock, chiptune, szamba, reggae, altatódal…). A ▸ gombbal a könyvtárban azonnal meghallgathatod őket; a blokk hossza a hangzás hossza.</li>
              <li><span className="text-violet-300 font-semibold">Logika</span> – számlálók, feltételek, ugrások, rendszeres megjelenítés, győzelem/játék vége.</li>
              <li><span className="text-amber-300 font-semibold">Bemenet</span> – három irányítási mód: szabad, <b>ugrálás</b> (gravitáció + platformok + fejre-taposás!), csak vízszintes; plusz egérkövetés és kattintás-események.</li>
              <li><span className="text-lime-300 font-semibold">App</span> – választó gombok (kvízekhez, menükhez) és beszédbuborék.</li>
              <li><span className="text-rose-300 font-semibold">Adat</span> – változók, életek, pontok, mentés/betöltés.</li>
              <li><span className="text-orange-300 font-semibold">Saját</span> – a feltöltött képeid és hangjaid, szintén blokkmá alakítva.</li>
            </ul>
          </section>

          <section>
            <h3 className="font-bold text-amber-300 mb-2">Szerkesztési trükkök</h3>
            <ul className="space-y-1.5 text-[13px] list-disc list-inside">
              <li>Blokk mozgatása: <b>húzd</b> más cellába vagy másik sávba.</li>
              <li>Átméretezés: a blokk <b>jobb szélét</b> húzd – pl. a zenei loopok így hosszabbíthatók.</li>
              <li>Sáv-vezérlők <b>a tartalomhoz illőek</b>: hangsávnál <b>M</b> (némítás), <b>S</b> (szóló – csak a hangokra!) és hangerőcsúszka; grafikai sávnál <b>szem ikon</b> (elrejtés); logikai/bemeneti/adat sávnál <b>kapcsoló</b> (be/ki).</li>
              <li>Blokk-beállítások <b>csoportosítva</b>: a hangoknál hangerő, lejátszási sebesség és némítás; a sprite-oknál szín, méret, átlátszóság, pörgés, mozgás, sebesség, irány és darabszám; a háttereknél sötétítés és színátmenet.</li>
              <li>Jobb klikk a blokkon → duplikálás vagy törlés.</li>
              <li>Az <b>Ugrás</b> blokkal a léptetőfej visszazuhanhat korábbi lépésre – így csinálhatsz belső ciklust.</li>
              <li>Az <b>eseménynapló</b> (előnézet mellett) lépésenként mutatja, mit csinált a motor – hibakereséshez arany.</li>
              <li>Minden változás <b>automatikusan mentődik</b> a böngészőben; JSON exporttal viheted máshova, a Felhő gombbal pedig pár kattintással archiválhatod a projektjeidet.</li>
            </ul>
          </section>

          <section>
            <h3 className="font-bold text-amber-300 mb-2">Gyorsbillentyűk</h3>
            <ul className="grid grid-cols-2 gap-1.5 text-[13px]">
              <li><kbd className="kbd">Szóköz</kbd> lejátszás / lővés</li>
              <li><kbd className="kbd">Esc</kbd> megállítás</li>
              <li><kbd className="kbd">Ctrl+Z</kbd> visszavonás</li>
              <li><kbd className="kbd">Ctrl+Y</kbd> újra</li>
              <li><kbd className="kbd">Del</kbd> kiválasztott blokk törlése</li>
              <li><kbd className="kbd">Ctrl+D</kbd> kiválasztott blokk duplikálása</li>
            </ul>
          </section>

          <p className="text-[12px] text-zinc-500">
            Tipp: az eJay-ben is az volt a varázslat, hogy gyorsan kísérleteztél – itt is az a legjobb
            módszer. Dobj be sok mindent, nyomj play-t, nézd a naplót, és finomíts. :)
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ================= FELHŐ =================
interface CloudProject {
  id: string;
  name: string;
  updatedAt: string;
}

export function CloudDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [items, setItems] = useState<CloudProject[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const project = useEditor((s) => s.project);
  const setProject = useEditor((s) => s.loadProject);
  const { toast } = useToast();

  const refresh = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/projects");
      if (res.ok) {
        const data = await res.json();
        setItems(Array.isArray(data.projects) ? data.projects : []);
      }
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/projects");
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) setItems(Array.isArray(data.projects) ? data.projects : []);
        }
      } catch {}
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const save = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: project.cloudId,
          name: project.name,
          data: project,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setProject({ ...project, cloudId: data.project.id }, { silent: true });
        await refresh();
        toast({ title: "Elmentve a felhőbe", description: `„${project.name}” biztonságban van a szerveren.` });
      } else {
        toast({ title: "A mentés nem sikerült", variant: "destructive" });
      }
    } catch {
      toast({ title: "A mentés nem sikerült (nincs kapcsolat a szerverrel)", variant: "destructive" });
    }
    setBusy(false);
  };

  const load = async (id: string) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/projects/${id}`);
      if (res.ok) {
        const data = await res.json();
        const p = data.project?.data as Project | undefined;
        if (p && Array.isArray(p.tracks)) {
          useEditor.getState().setPlaying(false);
          setProject({ ...p, cloudId: id });
          onOpenChange(false);
          toast({ title: "Betöltve", description: `„${p.name}” sikeresen betöltve a felhőből.` });
        }
      }
    } catch {
      toast({ title: "A betöltés nem sikerült", variant: "destructive" });
    }
    setBusy(false);
  };

  const remove = async (id: string) => {
    if (!window.confirm("Biztosan törlöd ezt a felhőprojektet?")) return;
    setBusy(true);
    try {
      await fetch(`/api/projects/${id}`, { method: "DELETE" });
      await refresh();
    } catch {}
    setBusy(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-zinc-950 border-zinc-800">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-extrabold text-zinc-50">
            <Cloud className="size-5 text-amber-400" /> Felhő projektgyűjtemény
          </DialogTitle>
          <DialogDescription className="text-xs text-zinc-400">
            Projektjeid archiválása és visszatöltése a szerverről.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-xs text-zinc-400 leading-relaxed">
            A projektjeid a szerveren is archiválhatod – így a böngészőadatok törlése után is
            visszakapod őket, és más eszközről is betöltheted. A mentés a teljes projektet
            (sávok, blokkok, feltöltött tartalmak) tartalmazza.
          </p>
          <Button
            onClick={save}
            disabled={busy}
            className="w-full bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold gap-2"
          >
            <Download className="size-4" />
            Aktuális projekt mentése ({project.name})
          </Button>

          <div className="rounded-lg border border-zinc-800 bg-zinc-900/40">
            <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800">
              <span className="text-xs font-bold text-zinc-300">Tárolt projektek ({items.length})</span>
              <Button size="icon" variant="ghost" className="size-7 text-zinc-400" onClick={() => void refresh()} title="Frissítés">
                <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
              </Button>
            </div>
            <div className="max-h-64 overflow-y-auto appmixer-scroll">
              {items.length === 0 && !loading && (
                <p className="text-xs text-zinc-500 italic px-3 py-4">Még nincs felhőbe mentett projekt.</p>
              )}
              {items.map((it) => (
                <div key={it.id} className="flex items-center gap-2 px-3 py-2 border-b border-zinc-800/50 last:border-0">
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-zinc-200 truncate">{it.name}</div>
                    <div className="text-[10px] text-zinc-500">
                      {new Date(it.updatedAt).toLocaleString("hu-HU")}
                    </div>
                  </div>
                  <Button size="sm" variant="outline" className="h-7 text-[11px] bg-zinc-800 border-zinc-700 hover:bg-zinc-700" onClick={() => void load(it.id)} disabled={busy}>
                    Betöltés
                  </Button>
                  <Button size="icon" variant="ghost" className="size-7 text-zinc-500 hover:text-rose-400" onClick={() => void remove(it.id)} disabled={busy}>
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
