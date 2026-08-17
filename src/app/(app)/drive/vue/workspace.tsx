"use client";

import * as React from "react";
import Link from "next/link";
import { X, Download, Pencil, Eye, Maximize2, Minus, Copy, LayoutGrid, ArrowLeft, ExternalLink } from "lucide-react";
import { FileGlyph } from "@/components/drive/file-glyph";
import {
  cascade, clampToBounds, focus, toggleMaximize, tileRects, moveBy, resizeTo, topZ,
  type WinState, type Bounds, type Rect,
} from "@/lib/drive/windows";
import { FileViewer } from "../[id]/file-viewer";

export interface OpenDoc {
  id: string;
  name: string;
  /** Famille de rendu (`pdf`, `image`, `office`…) — décide de la visionneuse. */
  kind: string;
  canEdit: boolean;
  /** L'éditeur en ligne peut-il ouvrir CE fichier (format + serveur configuré) ? */
  editable: boolean;
}

/** En dessous, une fenêtre flottante n'a plus de sens : on empile les documents en pleine largeur. */
const DESKTOP_MIN = 768;

/**
 * DES FENÊTRES, COMME SUR UN POSTE DE TRAVAIL.
 *
 * Comparer deux versions d'une notice, recopier un tableau d'un classeur dans un autre, relire un
 * devis en rédigeant le courrier qui l'accompagne : ce sont des gestes de tous les jours, et ils
 * supposent d'avoir **deux documents sous les yeux en même temps**. Des onglets ne le permettaient
 * pas — ils montrent l'un OU l'autre, et l'on retombe sur des allers-retours de mémoire.
 *
 * Chaque document ouvre donc SA fenêtre : on la déplace par sa barre de titre, on la
 * redimensionne par son coin, on la réduit dans la barre du bas, on l'agrandit, on la ferme.
 * « Mosaïque » les range côte à côte d'un geste — c'est la réponse directe à la comparaison qu'on
 * venait chercher.
 *
 * Deux détails qui font la différence à l'usage :
 *   • **une fenêtre réduite reste MONTÉE**, seulement cachée. Rouvrir un classeur ne relance pas
 *     son chargement et ne perd pas la page où l'on en était ;
 *   • **lecture ou modification** se choisit par fenêtre. On n'ouvre pas l'éditeur pour vérifier
 *     une date, et l'on ne perd pas sa place dans le document d'à côté en le faisant.
 *
 * SUR TÉLÉPHONE, il n'y a pas de bureau : les fenêtres flottantes y seraient ingérables. Les
 * documents s'empilent alors en pleine largeur, dans l'ordre d'ouverture.
 */
export function DocumentWorkspace({ docs, officeEnabled }: { docs: OpenDoc[]; officeEnabled: boolean }) {
  const deskRef = React.useRef<HTMLDivElement>(null);
  const [bounds, setBounds] = React.useState<Bounds>({ w: 1200, h: 720 });
  const [desktop, setDesktop] = React.useState(true);
  const [wins, setWins] = React.useState<WinState[]>([]);
  const [editing, setEditing] = React.useState<Set<string>>(new Set());
  const [closed, setClosed] = React.useState<Set<string>>(new Set());

  // La page prend toute la largeur : un document lu à travers une colonne de 1400 px dans une
  // fenêtre de 2500 px, c'est un tiers de l'écran perdu pour rien.
  React.useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--shell-max", "100%");
    return () => { root.style.removeProperty("--shell-max"); };
  }, []);

  // Le bureau mesuré POUR DE VRAI : les bornes de placement ne sont jamais devinées.
  React.useLayoutEffect(() => {
    const measure = () => {
      const el = deskRef.current;
      if (el) setBounds({ w: el.clientWidth, h: el.clientHeight });
      setDesktop(window.innerWidth >= DESKTOP_MIN);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // Ouverture en cascade, une fois le bureau mesuré — sinon la première fenêtre se placerait
  // d'après une taille inventée, puis sauterait.
  React.useEffect(() => {
    setWins((prev) => {
      if (prev.length > 0) return prev;
      return docs.map((d, i) => ({ id: d.id, rect: cascade(i, bounds), z: i + 1, minimized: false, restore: null }));
    });
  }, [docs, bounds]);

  // Un rétrécissement de la fenêtre du navigateur ne doit pas emporter les documents hors champ.
  React.useEffect(() => {
    setWins((prev) => prev.map((w) => (w.restore ? { ...w, rect: { x: 0, y: 0, w: bounds.w, h: bounds.h } } : { ...w, rect: clampToBounds(w.rect, bounds) })));
  }, [bounds]);

  const live = wins.filter((w) => !closed.has(w.id));
  const byId = React.useMemo(() => new Map(docs.map((d) => [d.id, d])), [docs]);

  const bringToFront = (id: string) => setWins((prev) => focus(prev, id));
  const close = (id: string) => {
    setClosed((s) => new Set(s).add(id));
    setEditing((s) => { const n = new Set(s); n.delete(id); return n; });
  };
  const minimize = (id: string) => setWins((prev) => prev.map((w) => (w.id === id ? { ...w, minimized: true } : w)));
  const maximize = (id: string) => setWins((prev) => prev.map((w) => (w.id === id ? toggleMaximize(w, bounds) : w)));
  const tile = () => setWins((prev) => {
    const open = prev.filter((w) => !closed.has(w.id));
    const rects = tileRects(open.length, bounds);
    let i = 0;
    return prev.map((w) => (closed.has(w.id) ? w : { ...w, minimized: false, restore: null, rect: rects[i++] }));
  });
  const toggleEdit = (id: string) => setEditing((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  /**
   * Glisser et redimensionner à la souris comme au doigt.
   *
   * On capture le pointeur : sans cela, un geste rapide « sort » de la barre de titre et la
   * fenêtre reste plantée en chemin — le défaut classique qui fait dire que « ça ne suit pas ».
   */
  const startDrag = (id: string, e: React.PointerEvent, mode: "move" | "resize") => {
    if (!desktop) return;
    e.preventDefault();
    bringToFront(id);
    const start = { x: e.clientX, y: e.clientY };
    const from = wins.find((w) => w.id === id)?.rect;
    if (!from) return;
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);

    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - start.x;
      const dy = ev.clientY - start.y;
      setWins((prev) => prev.map((w) => {
        if (w.id !== id) return w;
        const rect: Rect = mode === "move"
          ? moveBy(from, dx, dy, bounds)
          : resizeTo(from, from.w + dx, from.h + dy, bounds);
        // Déplacer une fenêtre agrandie la « décroche » : c'est ce que fait tout bureau.
        return { ...w, rect, restore: null };
      }));
    };
    const onUp = () => {
      target.releasePointerCapture(e.pointerId);
      target.removeEventListener("pointermove", onMove);
      target.removeEventListener("pointerup", onUp);
    };
    target.addEventListener("pointermove", onMove);
    target.addEventListener("pointerup", onUp);
  };

  if (live.length === 0) {
    return (
      <div className="surface p-10 text-center">
        <p className="text-sm text-muted-foreground">Tous les documents sont fermés.</p>
        <Link href="/drive" className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
          <ArrowLeft className="h-4 w-4" /> Retour au Drive
        </Link>
      </div>
    );
  }

  /** L'intérieur d'une fenêtre : la barre d'actions du document, puis la visionneuse ou l'éditeur. */
  const Body = ({ doc }: { doc: OpenDoc }) => (
    <>
      <div className="flex shrink-0 items-center gap-1 border-b border-border bg-secondary/30 px-2 py-1">
        {doc.canEdit && doc.editable && officeEnabled && (
          <button
            type="button" onClick={() => toggleEdit(doc.id)}
            className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
              editing.has(doc.id) ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-secondary"
            }`}
          >
            {editing.has(doc.id) ? <><Eye className="h-3.5 w-3.5" /> Lecture</> : <><Pencil className="h-3.5 w-3.5" /> Modifier</>}
          </button>
        )}
        <a
          href={`/api/drive/${doc.id}/raw?dl=1`}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-secondary"
        >
          <Download className="h-3.5 w-3.5" /> Télécharger
        </a>
        <Link
          href={`/drive/${doc.id}`}
          className="ml-auto inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-secondary"
        >
          <ExternalLink className="h-3.5 w-3.5" /> Fiche
        </Link>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {editing.has(doc.id) ? (
          <iframe src={`/office-embed/${doc.id}`} title={`Édition — ${doc.name}`} className="h-full min-h-[24rem] w-full bg-white" />
        ) : (
          <FileViewer id={doc.id} name={doc.name} kind={doc.kind} />
        )}
      </div>
    </>
  );

  // TÉLÉPHONE : pas de bureau, donc pas de fenêtres flottantes — les documents s'empilent.
  if (!desktop) {
    return (
      <div className="space-y-3">
        {live.map((w) => {
          const doc = byId.get(w.id);
          if (!doc) return null;
          return (
            <section key={w.id} className="surface flex flex-col overflow-hidden p-0">
              <header className="flex items-center gap-2 border-b border-border px-2 py-1.5">
                <FileGlyph name={doc.name} isFile />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{doc.name}</span>
                <button type="button" onClick={() => close(w.id)} aria-label={`Fermer ${doc.name}`} className="rounded p-1 text-muted-foreground hover:bg-secondary">
                  <X className="h-4 w-4" />
                </button>
              </header>
              <Body doc={doc} />
            </section>
          );
        })}
      </div>
    );
  }

  const minimized = live.filter((w) => w.minimized);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button" onClick={tile}
          className="inline-flex items-center gap-1.5 rounded-lg border border-input px-2.5 py-1.5 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <LayoutGrid className="h-4 w-4" /> Mosaïque
        </button>
        <span className="text-xs text-muted-foreground">
          {live.length} fenêtre{live.length > 1 ? "s" : ""} — glissez la barre de titre pour déplacer, le coin pour redimensionner.
        </span>
      </div>

      {/* LE BUREAU. Les fenêtres y sont positionnées en absolu ; il porte lui-même la mesure qui
          sert de bornes, pour qu'aucune ne puisse s'échapper de la zone visible. */}
      <div
        ref={deskRef}
        className="relative h-[calc(100dvh-13rem)] min-h-[30rem] overflow-hidden rounded-xl border border-border bg-muted/30"
      >
        {live.map((w) => {
          const doc = byId.get(w.id);
          if (!doc) return null;
          const front = w.z === topZ(live) && !w.minimized;
          return (
            <div
              key={w.id}
              // RÉDUITE = CACHÉE, PAS DÉMONTÉE. Rouvrir un classeur ne doit pas relancer son
              // chargement ni perdre la page où l'on en était.
              className={`absolute flex flex-col overflow-hidden rounded-xl border bg-card shadow-lg transition-shadow ${
                front ? "border-primary/40 shadow-xl" : "border-border"
              } ${w.minimized ? "pointer-events-none invisible" : ""}`}
              style={{ left: w.rect.x, top: w.rect.y, width: w.rect.w, height: w.rect.h, zIndex: w.z }}
              onPointerDown={() => bringToFront(w.id)}
            >
              <header
                onPointerDown={(e) => startDrag(w.id, e, "move")}
                onDoubleClick={() => maximize(w.id)}
                className="flex shrink-0 cursor-grab touch-none select-none items-center gap-2 border-b border-border bg-card px-2 py-1.5 active:cursor-grabbing"
              >
                <FileGlyph name={doc.name} isFile />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{doc.name}</span>
                {editing.has(w.id) && <Pencil className="h-3.5 w-3.5 shrink-0 text-primary" />}
                <div className="flex shrink-0 items-center">
                  <button type="button" onClick={() => minimize(w.id)} aria-label="Réduire" className="rounded p-1 text-muted-foreground hover:bg-secondary">
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" onClick={() => maximize(w.id)} aria-label={w.restore ? "Restaurer" : "Agrandir"} className="rounded p-1 text-muted-foreground hover:bg-secondary">
                    {w.restore ? <Copy className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                  </button>
                  <button type="button" onClick={() => close(w.id)} aria-label={`Fermer ${doc.name}`} className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </header>

              <Body doc={doc} />

              {/* La poignée de redimensionnement. Assez large pour être visée sans précision : une
                  cible de 6 px donne l'impression que la fenêtre « ne se redimensionne pas ». */}
              <div
                onPointerDown={(e) => startDrag(w.id, e, "resize")}
                className="absolute bottom-0 right-0 h-5 w-5 cursor-nwse-resize touch-none"
                aria-hidden
              >
                <span className="absolute bottom-1 right-1 h-2 w-2 border-b-2 border-r-2 border-muted-foreground/50" />
              </div>
            </div>
          );
        })}
      </div>

      {/* La barre du bas : ce qui est réduit n'est pas perdu — un clic le ramène. */}
      {minimized.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {minimized.map((w) => {
            const doc = byId.get(w.id);
            if (!doc) return null;
            return (
              <button
                key={w.id} type="button" onClick={() => bringToFront(w.id)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2 py-1 text-xs font-medium hover:bg-secondary"
              >
                <FileGlyph name={doc.name} isFile />
                <span className="max-w-[12rem] truncate">{doc.name}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
