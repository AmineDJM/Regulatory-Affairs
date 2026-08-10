"use client";

import * as React from "react";
import { ListTree, Network, Building2 } from "lucide-react";
import { OrgChartEditor, type OrgNode } from "./org-chart-editor";
import { OrgCanvas } from "./org-canvas";

/**
 * Bascule entre la vue « Arbre » (rattachement/poste) et la « Carte » (glisser-déposer), avec un
 * filtre PAR ENTITÉ : on regarde l'organigramme du groupe ENTIER ou celui d'une seule société
 * (Adventum, Pharmagène…). En consultation (`canEdit=false`), rien ne se modifie.
 *
 * Le filtre coupe les branches : un responsable d'une autre entité disparaît, donc ses
 * subordonnés de l'entité filtrée remontent en racine — c'est ce qu'on veut voir (« qui est chez
 * nous »), pas un arbre vide parce que le sommet appartient à une autre société.
 */
export function OrgWorkspace({ nodes, canEdit = true }: { nodes: OrgNode[]; canEdit?: boolean }) {
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
      {view === "tree" ? <OrgChartEditor nodes={shown} canEdit={canEdit} /> : <OrgCanvas nodes={shown} canEdit={canEdit} />}
    </div>
  );
}
