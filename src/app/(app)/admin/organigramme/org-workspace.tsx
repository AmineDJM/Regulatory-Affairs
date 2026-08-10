"use client";

import * as React from "react";
import { ListTree, Network, Building2 } from "lucide-react";
import { OrgChartEditor, type OrgNode } from "./org-chart-editor";
import { OrgCanvas } from "./org-canvas";

/**
 * Bascule entre la vue « Arbre » (rattachement/poste) et la « Carte » (glisser-déposer).
 *
 * La portée principale vient du SÉLECTEUR D'ENTITÉ en haut de l'écran (le serveur ne charge que
 * les personnes de la société active). Le filtre local ci-dessous ne sert donc que lorsqu'on
 * travaille sur le GROUPE ENTIER, pour isoler une société sans changer de contexte — c'est
 * pourquoi il disparaît dès qu'une seule entité est présente.
 *
 * Le filtre coupe les branches : un responsable d'une autre entité disparaît, donc ses
 * subordonnés de l'entité filtrée remontent en racine — c'est ce qu'on veut voir (« qui est chez
 * nous »), pas un arbre vide parce que le sommet appartient à une autre société.
 */
export function OrgWorkspace({ nodes, canEdit = true, scopeLabel }: { nodes: OrgNode[]; canEdit?: boolean; scopeLabel?: string }) {
  const [view, setView] = React.useState<"tree" | "canvas">("tree");
  const [entity, setEntity] = React.useState<string>("");

  const entities = React.useMemo(
    () => [...new Set(nodes.map((n) => n.entity).filter((e): e is string => Boolean(e)))].sort((a, b) => a.localeCompare(b, "fr")),
    [nodes],
  );
  const shown = React.useMemo(() => (entity ? nodes.filter((n) => n.entity === entity) : nodes), [nodes, entity]);

  const btn = (key: "tree" | "canvas", label: string, icon: React.ReactNode) => (
    <button
      type="button"
      onClick={() => setView(key)}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${view === key ? "border-primary bg-primary/10 text-primary" : "border-input hover:bg-secondary"}`}
    >
      {icon} {label}
    </button>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {btn("tree", "Arbre", <ListTree className="h-4 w-4" />)}
        {btn("canvas", "Carte", <Network className="h-4 w-4" />)}
        {entities.length > 1 && (
          <label className="ml-auto inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <Building2 className="h-3.5 w-3.5" />
            <select
              value={entity}
              onChange={(e) => setEntity(e.target.value)}
              aria-label="Filtrer par entité"
              className="h-8 rounded-lg border border-input bg-background px-2 text-xs text-foreground"
            >
              <option value="">Toutes les entités ({nodes.length})</option>
              {entities.map((e) => (
                <option key={e} value={e}>{e} ({nodes.filter((n) => n.entity === e).length})</option>
              ))}
            </select>
          </label>
        )}
      </div>
      {view === "tree"
        ? <OrgChartEditor nodes={shown} canEdit={canEdit} />
        : <OrgCanvas nodes={shown} canEdit={canEdit} scopeLabel={entity || scopeLabel} />}
    </div>
  );
}
