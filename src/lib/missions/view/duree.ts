/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * « DEPUIS COMBIEN DE TEMPS » — module PUR, zéro import.
 *
 * Une mission longue se lit en durées, pas en horodatages : « en attente depuis 3 jours » dit
 * quelque chose que « 05/09/2026 14:12 » oblige à calculer de tête. Et la durée est ce qui
 * fait AGIR — une attente de deux heures est normale, la même à six jours est un problème.
 *
 * Pur, donc utilisable côté serveur ET côté client (§ frontière client/serveur), et testable
 * sans base : la date « maintenant » est un ARGUMENT, jamais une lecture d'horloge cachée —
 * sans quoi le test devrait dormir pour vérifier quoi que ce soit.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/**
 * Rend « à l'instant », « il y a 12 min », « il y a 3 h », « il y a 5 j », « il y a 2 mois ».
 *
 * Jamais de précision fausse : au-delà de la journée on cesse de compter les heures, parce que
 * « il y a 74 h » demande une division mentale pour dire « avant-hier ».
 */
export function depuis(quand: Date | string, maintenant: Date): string {
  const t = typeof quand === "string" ? new Date(quand) : quand;
  if (Number.isNaN(t.getTime())) return "—";
  const ms = maintenant.getTime() - t.getTime();
  // UNE DATE FUTURE N'EST PAS « IL Y A ». Une échéance, une reprise programmée : on le dit.
  if (ms < 0) return dans(-ms);
  const min = Math.floor(ms / 60_000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const j = Math.floor(h / 24);
  if (j < 31) return `il y a ${j} j`;
  const mois = Math.floor(j / 30);
  return mois < 12 ? `il y a ${mois} mois` : `il y a ${Math.floor(mois / 12)} an(s)`;
}

function dans(ms: number): string {
  const min = Math.floor(ms / 60_000);
  if (min < 1) return "dans un instant";
  if (min < 60) return `dans ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `dans ${h} h`;
  const j = Math.floor(h / 24);
  return j < 31 ? `dans ${j} j` : `dans ${Math.floor(j / 30)} mois`;
}

/**
 * L'ÂGE EN HEURES — le chiffre sur lequel une règle décide, pas une phrase à lire.
 *
 * Séparé de `depuis` À DESSEIN : une garde qui déciderait en relisant « il y a 3 j » ferait
 * dépendre une décision de l'orthographe d'un libellé.
 */
export function ageHeures(quand: Date | string, maintenant: Date): number | null {
  const t = typeof quand === "string" ? new Date(quand) : quand;
  if (Number.isNaN(t.getTime())) return null;
  return Math.max(0, (maintenant.getTime() - t.getTime()) / 3_600_000);
}
