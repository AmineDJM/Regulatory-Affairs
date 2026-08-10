"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Users } from "lucide-react";
import { saveOrgPosition } from "@/lib/actions/org-actions";
import type { OrgNode } from "./org-chart-editor";

const BOX_W = 190, BOX_H = 64, COL = 214, ROW = 120, PAD = 40;

/**
 * Carte visuelle de l'organigramme : boîtes reliées par des connecteurs, en **glisser-déposer**.
 * Les nœuds sans position mémorisée sont placés automatiquement (arbre « tidy ») ; dès qu'on
 * déplace une boîte, sa position est **persistée** (Employee.orgX/orgY). Un simple clic sur une
 * boîte ouvre la fiche RH. Le tout se lit/écrit directement sur Ressources humaines.
 */
export function OrgCanvas({ nodes, canEdit = true }: { nodes: OrgNode[]; canEdit?: boolean }) {
  const router = useRouter();
  const ids = React.useMemo(() => new Set(nodes.map((n) => n.id)), [nodes]);
  const childrenOf = React.useMemo(() => {
    const m = new Map<string | null, OrgNode[]>();
    for (const n of nodes) {
      const key = n.managerId && ids.has(n.managerId) ? n.managerId : null;
      const arr = m.get(key) ?? [];
      arr.push(n);
      m.set(key, arr);
    }
    return m;
  }, [nodes, ids]);

  // Placement automatique (arbre équilibré) des nœuds sans position mémorisée.
  const auto = React.useMemo(() => {
    const pos = new Map<string, { x: number; y: number }>();
    let leaf = 0;
    const layout = (node: OrgNode, depth: number): number => {
      const kids = childrenOf.get(node.id) ?? [];
      let x: number;
      if (kids.length === 0) { x = leaf * COL; leaf += 1; }
      else { const xs = kids.map((k) => layout(k, depth + 1)); x = (xs[0] + xs[xs.length - 1]) / 2; }
      pos.set(node.id, { x: x + PAD, y: depth * ROW + PAD });
      return x;
    };
    for (const r of childrenOf.get(null) ?? []) layout(r, 0);
    return pos;
  }, [childrenOf]);

  const [positions, setPositions] = React.useState<Map<string, { x: number; y: number }>>(() => {
    const m = new Map<string, { x: number; y: number }>();
    for (const n of nodes) {
      m.set(n.id, n.orgX != null && n.orgY != null ? { x: n.orgX, y: n.orgY } : (auto.get(n.id) ?? { x: PAD, y: PAD }));
    }
    return m;
  });

  const drag = React.useRef<{ id: string; dx: number; dy: number; moved: boolean } | null>(null);

  // En CONSULTATION, la carte se lit et se parcourt mais ne se réorganise pas : le
  // glisser-déposer persiste des positions partagées par tous — c'est une modification.
  const onDown = (e: React.PointerEvent, id: string) => {
    if (!canEdit) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = positions.get(id)!;
    drag.current = { id, dx: e.clientX - p.x, dy: e.clientY - p.y, moved: false };
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const x = Math.max(0, e.clientX - d.dx);
    const y = Math.max(0, e.clientY - d.dy);
    if (Math.abs(x - (positions.get(d.id)?.x ?? 0)) > 2 || Math.abs(y - (positions.get(d.id)?.y ?? 0)) > 2) d.moved = true;
    setPositions((prev) => new Map(prev).set(d.id, { x, y }));
  };
  const onUp = async (id: string) => {
    const d = drag.current;
    drag.current = null;
    if (!canEdit) { router.push(`/rh/${id}`); return; } // lecture : le clic ouvre la fiche
    if (!d) return;
    if (!d.moved) { router.push(`/rh/${id}`); return; } // clic simple → fiche RH
    const p = positions.get(id)!;
    const fd = new FormData();
    fd.set("id", id); fd.set("x", String(Math.round(p.x))); fd.set("y", String(Math.round(p.y)));
    await saveOrgPosition(fd);
  };

  const pts = [...positions.values()];
  const width = Math.max(640, ...pts.map((p) => p.x + BOX_W + PAD));
  const height = Math.max(420, ...pts.map((p) => p.y + BOX_H + PAD));

  if (nodes.length === 0) {
    return <p className="text-sm text-muted-foreground">Aucun employé actif à afficher.</p>;
  }

  return (
    <div>
      <p className="mb-2 text-xs text-muted-foreground">
        {canEdit
          ? "Glissez les boîtes pour réorganiser la carte (positions mémorisées) · cliquez une boîte pour ouvrir la fiche RH · le rattachement (N+1) se règle dans la vue « Arbre »."
          : "Cliquez une boîte pour ouvrir la fiche RH. La réorganisation de la carte est réservée au Super Admin."}
      </p>
      <div className="overflow-auto rounded-lg border border-border bg-secondary/20" style={{ maxHeight: "72vh" }}>
        <div className="relative" style={{ width, height }}>
          <svg className="pointer-events-none absolute inset-0 text-border" width={width} height={height}>
            {nodes.map((n) => {
              if (!n.managerId || !ids.has(n.managerId)) return null;
              const c = positions.get(n.id)!;
              const pp = positions.get(n.managerId)!;
              const x1 = pp.x + BOX_W / 2, y1 = pp.y + BOX_H, x2 = c.x + BOX_W / 2, y2 = c.y;
              const my = (y1 + y2) / 2;
              return <path key={n.id} d={`M ${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}`} fill="none" stroke="currentColor" strokeWidth={1.5} />;
            })}
          </svg>
          {nodes.map((n) => {
            const p = positions.get(n.id)!;
            const kids = childrenOf.get(n.id)?.length ?? 0;
            return (
              <div
                key={n.id}
                onPointerDown={(e) => onDown(e, n.id)}
                onPointerMove={onMove}
                onPointerUp={() => onUp(n.id)}
                className={`absolute touch-none select-none rounded-lg border border-border bg-card p-2 shadow-sm transition-shadow hover:shadow-md ${canEdit ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"}`}
                style={{ left: p.x, top: p.y, width: BOX_W }}
                title={canEdit ? "Glisser pour déplacer · cliquer pour ouvrir la fiche" : "Ouvrir la fiche RH"}
              >
                <div className="flex items-center gap-1.5">
                  {n.color && <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: n.color }} />}
                  <span className="truncate text-sm font-medium" title={n.fullName}>{n.fullName}</span>
                </div>
                <p className="truncate text-xs text-muted-foreground" title={n.position ?? ""}>{n.position || "Poste non défini"}</p>
                <div className="mt-0.5 flex items-center gap-2 text-[0.6875rem] text-muted-foreground">
                  {n.entity && <span className="truncate">{n.entity}</span>}
                  {kids > 0 && <span className="inline-flex shrink-0 items-center gap-0.5"><Users className="h-3 w-3" />{kids}</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
