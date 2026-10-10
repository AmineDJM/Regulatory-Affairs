import type { ServiceGraphe, NoeudGraphe } from "@/lib/queries/influence";

/**
 * LA CARTE D'UN SERVICE — nœuds = médecins (couleur de leur lettre), traits pleins = hiérarchie / liens confirmés,
 * pointillés violets = liens proposés par Luna, à droite les médecins d'ailleurs qui y sont reliés. Un clic sur un nœud
 * ouvre « Son réseau ». SVG statique, rendu serveur.
 */

const TON: Record<string, { fond: string; texte: string; trait?: string }> = {
  H: { fond: "fill-violet-500/15", texte: "fill-violet-600 dark:fill-violet-300", trait: "stroke-violet-500" },
  A: { fond: "fill-success/15", texte: "fill-success" },
  B: { fond: "fill-primary/15", texte: "fill-primary" },
  C: { fond: "fill-warning/15", texte: "fill-warning" },
  D: { fond: "fill-destructive/10", texte: "fill-destructive" },
};
const NEUTRE: { fond: string; texte: string; trait?: string } = { fond: "fill-muted", texte: "fill-muted-foreground" };

const LARGEUR = 560;

function disposer(g: ServiceGraphe): { pos: Map<string, { x: number; y: number; r: number }>; hauteur: number } {
  const internes = g.noeuds.filter((n) => !n.externe);
  const externes = g.noeuds.filter((n) => n.externe);
  const largeur = externes.length ? LARGEUR - 120 : LARGEUR;
  // Rang du bas : la pharmacie, et les praticiens sans poids mesuré (résidents, assistants…).
  const petits = (n: NoeudGraphe) => n.pharmacien || (n.score < 15 && !n.chef);
  const rangs = [
    internes.filter((n) => n.chef),
    internes.filter((n) => !n.chef && !petits(n)),
    internes.filter((n) => !n.chef && petits(n)),
  ].filter((r) => r.length > 0);
  const pos = new Map<string, { x: number; y: number; r: number }>();
  rangs.forEach((rang, i) => {
    const y = 48 + i * 86;
    const pas = largeur / rang.length;
    rang.forEach((n, j) => pos.set(n.doctorId, { x: Math.round(pas * (j + 0.5)), y, r: n.chef ? 26 : petits(n) ? 16 : 21 }));
  });
  externes.forEach((n, i) => pos.set(n.doctorId, { x: LARGEUR - 56, y: 48 + i * 70, r: 18 }));
  const hauteur = Math.max(48 + (rangs.length - 1) * 86, 48 + (externes.length - 1) * 70) + 56;
  return { pos, hauteur };
}

export function GrapheService({ g, lien }: { g: ServiceGraphe; lien: (doctorId: string) => string }) {
  const { pos, hauteur } = disposer(g);
  return (
    <svg viewBox={`0 0 ${LARGEUR} ${hauteur}`} width="100%" role="img" aria-label={`Carte d'influence — ${g.nom}`} className="block">
      {g.aretes.map((a, i) => {
        const p = pos.get(a.from), q = pos.get(a.to);
        if (!p || !q) return null;
        const propose = a.statut === "PROPOSEE";
        return (
          <line key={i} x1={p.x} y1={p.y} x2={q.x} y2={q.y} strokeWidth={2}
            className={propose ? "stroke-violet-500" : "stroke-border"} strokeDasharray={propose ? "4 3" : undefined} />
        );
      })}
      {g.noeuds.map((n) => {
        const p = pos.get(n.doctorId);
        if (!p) return null;
        const ton = (n.lettre && TON[n.lettre]) || NEUTRE;
        return (
          <a key={n.doctorId} href={lien(n.doctorId)}>
            <title>{`${n.nom}${n.lettre ? ` · ${n.lettre}` : ""}${n.score ? ` · influence ${n.score}` : ""}${n.externe ? ` · ${n.externe}` : ""}`}</title>
            <circle cx={p.x} cy={p.y} r={p.r} className={n.externe ? "fill-card stroke-violet-500" : `${ton.fond} ${n.chef ? (ton.trait ?? "stroke-current") : ""}`}
              strokeDasharray={n.externe ? "3 2" : undefined} strokeWidth={n.chef || n.externe ? 1.5 : 0} />
            <text x={p.x} y={p.y + (n.chef ? -1 : 4)} textAnchor="middle" fontSize={11} fontWeight={700} className={n.externe ? "fill-violet-600 dark:fill-violet-300" : ton.texte}>
              {n.court}{!n.chef && n.lettre ? ` · ${n.lettre}` : ""}
            </text>
            {n.chef && <text x={p.x} y={p.y + 12} textAnchor="middle" fontSize={10} className={ton.texte}>décideur</text>}
            {n.externe && <text x={p.x} y={p.y + p.r + 13} textAnchor="middle" fontSize={10} className="fill-muted-foreground">{n.externe.length > 18 ? n.externe.slice(0, 17) + "…" : n.externe}</text>}
          </a>
        );
      })}
    </svg>
  );
}
