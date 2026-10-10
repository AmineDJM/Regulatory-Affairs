/**
 * LA DATE DE BESOIN D'UNE DEMANDE DE MATÉRIEL PROMOTIONNEL (Direction, 10/2026) — « besoin pour le … », saisie par le
 * demandeur, modifiable par lui. Module PUR : la création, la modification et l'écran lisent la même règle.
 *
 * L'ALERTE : la date approche (moins de 15 jours) ou est dépassée, ET le matériel n'est pas livré. Une demande livrée, refusée
 * ou annulée n'alerte jamais — la date a cessé de compter.
 */

/** En dessous de ce nombre de jours, une date de besoin non livrée passe en orange. */
export const SEUIL_BESOIN_JOURS = 15;

const JOUR = 86_400_000;
const debutDuJour = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());

/** Une saisie « AAAA-MM-JJ » (champ date) → la date à midi UTC (aucun décalage de fuseau d'un jour). Vide → `null`. */
export function lireDateBesoin(brut: string | null | undefined, maintenant: Date = new Date()): { ok: true; date: Date | null } | { ok: false; error: string } {
  const t = (brut ?? "").trim();
  if (!t) return { ok: true, date: null };
  const m = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const date = m ? new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12)) : null;
  if (!m || !date || Number.isNaN(date.getTime()) || date.getUTCMonth() !== Number(m[2]) - 1) return { ok: false, error: "Date de besoin illisible (jour, mois, année)." };
  if (debutDuJour(date) < debutDuJour(maintenant)) return { ok: false, error: "La date de besoin est déjà passée." };
  if (date.getUTCFullYear() > maintenant.getUTCFullYear() + 3) return { ok: false, error: "La date de besoin est trop lointaine." };
  return { ok: true, date };
}

export interface EtatBesoin {
  /** Jours restants (négatif = dépassée). */
  jours: number;
  /** Orange : moins de 15 jours (ou dépassée) et pas livré. */
  alerte: boolean;
  /** « dans 6 j », « demain », « aujourd'hui », « dépassée de 3 j ». */
  echeance: string;
}

/** Où en est la date de besoin — `null` sans date. */
export function etatDuBesoin(neededBy: Date | string | null | undefined, livre: boolean, maintenant: Date = new Date()): EtatBesoin | null {
  if (!neededBy) return null;
  const d = typeof neededBy === "string" ? new Date(neededBy) : neededBy;
  if (Number.isNaN(d.getTime())) return null;
  const jours = Math.round((debutDuJour(d) - debutDuJour(maintenant)) / JOUR);
  const echeance = jours < 0 ? `dépassée de ${-jours} j` : jours === 0 ? "aujourd'hui" : jours === 1 ? "demain" : `dans ${jours} j`;
  return { jours, alerte: !livre && jours < SEUIL_BESOIN_JOURS, echeance };
}

/**
 * LE MATÉRIEL EST-IL LIVRÉ ? Au circuit par devis : dossier terminé, ou chaque ligne facturée reçue (ou renoncée) — et au
 * moins une. À l'ancien parcours : le matériel final déposé, facturé ou réglé. Refusé / annulé : il n'y a plus rien à livrer.
 */
export function materielLivre(p: { circuitState: string | null; status: string; etatsLignes: readonly string[] }): boolean {
  if (p.status === "CANCELLED" || p.circuitState === "REFUSED" || p.circuitState === "COMPLETED") return true;
  if (p.circuitState) return p.etatsLignes.length > 0 && p.etatsLignes.every((e) => e !== "EN_ATTENTE" && e !== "PARTIELLE");
  return p.status === "FINAL_MATERIAL" || p.status === "INVOICED" || p.status === "SETTLED";
}
