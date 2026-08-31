/**
 * EFFORT × EFFET — les visites d'un côté, les ventes de l'autre, MISES EN REGARD.
 *
 * ── CE QUE CE MODULE AFFIRME, ET CE QU'IL N'AFFIRME PAS ─────────────────────────────────────
 *
 * Il met deux mesures côte à côte : combien de fois un produit a été PRÉSENTÉ (liens de visite)
 * et ce qu'il a RAPPORTÉ sur la même période (ventes). Il n'affirme AUCUNE causalité — une
 * vente hospitalière tombe des mois après la visite qui l'a préparée, un marché public ne doit
 * rien au détaillage, et une rupture de stock efface le meilleur effort du monde.
 *
 * Pourquoi le construire alors ? Parce que les DEUX ANOMALIES qu'il révèle sont vraies quelle
 * que soit la causalité, et qu'aucun des deux tableaux ne les montre seul :
 *
 *   • **De l'effort sans aucune vente** — on détaille un produit qui ne se vend nulle part.
 *     Soit la cible est mauvaise, soit il y a une rupture, soit le prix ne passe pas. Dans les
 *     trois cas, c'est une conversation à avoir MAINTENANT.
 *   • **Des ventes sans aucun effort** — un produit part tout seul. Peut-être qu'il n'a pas
 *     besoin de nous ; peut-être qu'il en mériterait bien plus. C'est un arbitrage
 *     d'affectation, et il ne se voit que là.
 *
 * Le ratio « DZD par visite » n'est donc PAS une note : c'est une échelle de comparaison entre
 * produits d'un même portefeuille, sur une même période. Le présenter comme un rendement
 * ferait prendre une décision d'affectation sur une corrélation — exactement ce qu'on refuse.
 *
 * Module PUR : ni base, ni import lourd. Testé.
 */

export interface EffortSalesInput {
  productId: string;
  name: string;
  /** Visites où ce produit a été présenté sur la période. */
  visits: number;
  /** Chiffre d'affaires du produit sur la MÊME période (DZD). */
  revenue: number;
}

export type EffortVerdict = "EFFORT_SANS_VENTE" | "VENTE_SANS_EFFORT" | "NORMAL" | "SANS_ACTIVITE";

export interface EffortSalesRow extends EffortSalesInput {
  /** DZD par visite — une ÉCHELLE de comparaison, jamais une note. Null si aucune visite. */
  perVisit: number | null;
  /** Part de l'effort total (%) — où va le temps de la force de vente. */
  effortShare: number;
  /** Part du chiffre d'affaires total (%) — d'où vient l'argent. */
  revenueShare: number;
  /** L'anomalie, si elle existe. C'est elle qu'on vient lire. */
  verdict: EffortVerdict;
  /** La phrase affichée — elle dit le FAIT et la question, jamais la conclusion. */
  note: string | null;
}

const share = (part: number, total: number): number => (total > 0 ? Math.round((part / total) * 100) : 0);

/**
 * La mise en regard, produit par produit, triée par effort décroissant (c'est là que part le
 * temps, donc c'est par là qu'on regarde).
 */
export function effortVsSales(rows: readonly EffortSalesInput[]): EffortSalesRow[] {
  const totalVisits = rows.reduce((s, r) => s + r.visits, 0);
  const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);

  return rows
    .map((r): EffortSalesRow => {
      const verdict: EffortVerdict =
        r.visits === 0 && r.revenue === 0 ? "SANS_ACTIVITE"
          : r.visits > 0 && r.revenue === 0 ? "EFFORT_SANS_VENTE"
            : r.visits === 0 && r.revenue > 0 ? "VENTE_SANS_EFFORT"
              : "NORMAL";
      const note =
        verdict === "EFFORT_SANS_VENTE"
          ? `${r.visits} visite${r.visits > 1 ? "s" : ""} sur la période, aucune vente enregistrée — cible, rupture ou prix ?`
          : verdict === "VENTE_SANS_EFFORT"
            ? "Des ventes sans aucune visite enregistrée — produit porté par autre chose, ou effort à saisir."
            : null;
      return {
        ...r,
        perVisit: r.visits > 0 ? Math.round(r.revenue / r.visits) : null,
        effortShare: share(r.visits, totalVisits),
        revenueShare: share(r.revenue, totalRevenue),
        verdict,
        note,
      };
    })
    // Les produits SANS aucune activité ne se lisent pas : ils occuperaient la place des deux
    // anomalies qui, elles, demandent une décision.
    .filter((r) => r.verdict !== "SANS_ACTIVITE")
    .sort((a, b) => b.visits - a.visits || b.revenue - a.revenue || a.name.localeCompare(b.name, "fr"));
}

/** Le résumé en une phrase — ce qu'on retient si l'on ne lit que la première ligne. */
export function effortSummary(rows: readonly EffortSalesRow[]): string {
  if (rows.length === 0) return "Aucune visite ni vente enregistrée sur la période.";
  const sansVente = rows.filter((r) => r.verdict === "EFFORT_SANS_VENTE");
  const sansEffort = rows.filter((r) => r.verdict === "VENTE_SANS_EFFORT");
  const parts: string[] = [`${rows.length} produit${rows.length > 1 ? "s" : ""} en activité`];
  if (sansVente.length) parts.push(`${sansVente.length} détaillé${sansVente.length > 1 ? "s" : ""} sans vente`);
  if (sansEffort.length) parts.push(`${sansEffort.length} vendu${sansEffort.length > 1 ? "s" : ""} sans visite`);
  return parts.join(" · ");
}
