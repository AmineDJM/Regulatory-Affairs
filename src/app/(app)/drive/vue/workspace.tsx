"use client";

import * as React from "react";
import Link from "next/link";
import { X, Download, Pencil, Eye, Maximize2, Minimize2, ArrowLeft } from "lucide-react";
import { Icon } from "@/components/ui/icon";
import { FileViewer } from "../[id]/file-viewer";

export interface OpenDoc {
  id: string;
  name: string;
  icon: string;
  /** Famille de rendu (`pdf`, `image`, `office`…) — décide de la visionneuse. */
  kind: string;
  canEdit: boolean;
  /** L'éditeur en ligne peut-il ouvrir CE fichier (format + serveur configuré) ? */
  editable: boolean;
}

/**
 * PLUSIEURS DOCUMENTS OUVERTS EN MÊME TEMPS — comme sur un poste de travail.
 *
 * Comparer deux versions d'une notice, recopier un tableau d'un classeur dans un autre, relire un
 * devis en rédigeant le courrier qui l'accompagne : ce sont des gestes de tous les jours, et ils
 * supposent d'avoir **deux documents sous les yeux**. Un écran par fichier oblige à faire des
 * allers-retours en mémorisant ce qu'on vient de lire — c'est-à-dire à travailler moins bien.
 *
 * Des ONGLETS, donc, et une bascule **lecture / modification** par onglet : on n'ouvre pas
 * l'éditeur pour vérifier une date. Fermer un onglet ne ferme pas les autres ; fermer le dernier
 * ramène au Drive.
 *
 * Le plein écran est ici la règle plutôt que l'exception : un document lu à travers une colonne
 * de 1400 px dans une fenêtre de 2500 px, c'est un tiers de l'écran perdu pour rien.
 */
export function DocumentWorkspace({ docs, officeEnabled }: { docs: OpenDoc[]; officeEnabled: boolean }) {
  const [open, setOpen] = React.useState<OpenDoc[]>(docs);
  const [activeId, setActiveId] = React.useState<string>(docs[0]?.id ?? "");
  const [editing, setEditing] = React.useState<Set<string>>(new Set());
  const [wide, setWide] = React.useState(true);

  React.useEffect(() => {
    const root = document.documentElement;
    if (wide) root.style.setProperty("--shell-max", "100%");
    else root.style.removeProperty("--shell-max");
    return () => { root.style.removeProperty("--shell-max"); };
  }, [wide]);

  const active = open.find((d) => d.id === activeId) ?? open[0];

  const close = (id: string) => {
    setOpen((list) => {
      const next = list.filter((d) => d.id !== id);
      if (next.length > 0 && id === activeId) {
        // On bascule sur le voisin, comme un navigateur — pas sur le premier de la liste.
        const idx = list.findIndex((d) => d.id === id);
        setActiveId((next[idx] ?? next[idx - 1] ?? next[0]).id);
      }
      return next;
    });
    setEditing((s) => { const n = new Set(s); n.delete(id); return n; });
  };

  const toggleEdit = (id: string) => setEditing((s) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });

  if (open.length === 0) {
    return (
      <div className="surface p-10 text-center">
        <p className="text-sm text-muted-foreground">Tous les documents sont fermés.</p>
        <Link href="/drive" className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
          <ArrowLeft className="h-4 w-4" /> Retour au Drive
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Barre d'onglets — un document par onglet, la croix ne ferme que celui-là. */}
      <div className="flex items-center gap-1 overflow-x-auto border-b border-border pb-px">
        {open.map((d) => {
          const isActive = d.id === active?.id;
          return (
            <div
              key={d.id}
              className={`group flex shrink-0 items-center gap-1.5 rounded-t-lg border border-b-0 px-3 py-1.5 text-sm transition-colors ${
                isActive ? "border-border bg-card font-medium" : "border-transparent text-muted-foreground hover:bg-secondary"
              }`}
            >
              <button type="button" onClick={() => setActiveId(d.id)} className="flex min-w-0 items-center gap-1.5">
                <Icon name={d.icon} className="h-3.5 w-3.5 shrink-0 opacity-70" />
                <span className="max-w-[14rem] truncate">{d.name}</span>
                {editing.has(d.id) && <Pencil className="h-3 w-3 shrink-0 text-primary" />}
              </button>
              <button
                type="button" onClick={() => close(d.id)} aria-label={`Fermer ${d.name}`}
                className="shrink-0 rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:bg-secondary group-hover:opacity-100"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          );
        })}
        <div className="ml-auto flex shrink-0 items-center gap-1 pb-1.5">
          <button
            type="button" onClick={() => setWide((v) => !v)}
            title={wide ? "Revenir à la largeur de lecture" : "Plein écran"}
            className="rounded-lg border border-input p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            {wide ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {active && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/drive/${active.id}`} className="text-sm font-medium hover:underline">{active.name}</Link>
            <div className="ml-auto flex items-center gap-2">
              {active.canEdit && active.editable && officeEnabled && (
                <button
                  type="button" onClick={() => toggleEdit(active.id)}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm font-medium transition-colors ${
                    editing.has(active.id) ? "border-primary/50 text-primary" : "border-input text-muted-foreground hover:bg-secondary"
                  }`}
                >
                  {editing.has(active.id) ? <><Eye className="h-4 w-4" /> Lecture</> : <><Pencil className="h-4 w-4" /> Modifier</>}
                </button>
              )}
              <a
                href={`/api/drive/${active.id}/raw?dl=1`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-input px-2.5 py-1.5 text-sm font-medium text-muted-foreground hover:bg-secondary"
              >
                <Download className="h-4 w-4" /> Télécharger
              </a>
            </div>
          </div>

          {/* Les onglets INACTIFS restent montés, simplement cachés : rebasculer sur un classeur
              ne doit pas relancer son chargement ni perdre la page où l'on en était. */}
          {open.map((d) => (
            <div key={d.id} hidden={d.id !== active.id}>
              {editing.has(d.id) ? (
                <iframe
                  src={`/office-embed/${d.id}`}
                  title={`Édition — ${d.name}`}
                  className="h-[78vh] w-full rounded-lg border border-border bg-white"
                />
              ) : (
                <FileViewer id={d.id} name={d.name} kind={d.kind} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
