"use client";

import * as React from "react";
import { ListTree, Network } from "lucide-react";
import { OrgChartEditor, type OrgNode } from "./org-chart-editor";
import { OrgCanvas } from "./org-canvas";

/** Bascule entre la vue « Arbre » (édition rattachement/poste) et la « Carte » (glisser-déposer). */
export function OrgWorkspace({ nodes }: { nodes: OrgNode[] }) {
  const [view, setView] = React.useState<"tree" | "canvas">("tree");
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
      <div className="flex flex-wrap gap-2">
        {btn("tree", "Arbre", <ListTree className="h-4 w-4" />)}
        {btn("canvas", "Carte", <Network className="h-4 w-4" />)}
      </div>
      {view === "tree" ? <OrgChartEditor nodes={nodes} /> : <OrgCanvas nodes={nodes} />}
    </div>
  );
}
