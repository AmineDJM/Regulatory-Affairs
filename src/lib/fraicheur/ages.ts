/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * COMBIEN DE TEMPS UNE DONNÉE RESTE CRÉDIBLE — module PUR au socle, sans un seul import.
 *
 * ── POURQUOI ICI, ET PAS DANS LE MODULE QUI L'A ÉCRITE ──────────────────────────────────
 *
 * Ces durées sont nées dans `missions/horizon/fraicheur.ts`, pour un faux succès précis : une
 * mission de trois semaines qui conclut sur un forecast révisé depuis (§118.46). Mais la même
 * question se pose UN CRAN PLUS HAUT, dans la conversation : un fait lu dans une copie indexée
 * il y a six mois est présenté « FAIT VÉRIFIÉ » et Adam agit dessus.
 *
 * La conversation (`assistant/`, L1) n'a pas le droit d'importer les missions (`missions/`,
 * façade L2) — `boundary.test.ts` le tient. Deux tables séparées auraient donc divergé, et le
 * jour où l'une dit 24 h et l'autre 72, personne ne saurait laquelle a raison (§118.5). Les
 * durées vivent donc au socle, où les deux peuvent les lire sans se parler ; chacune garde SA
 * façon de nommer la nature d'une source, parce qu'elles ne parlent pas le même vocabulaire.
 *
 * ── CE QUE CES DURÉES DISENT, ET CE QU'ELLES NE DISENT PAS ──────────────────────────────
 *
 * Elles disent « à partir de quand il faut REGARDER », jamais « à partir de quand c'est faux ».
 * Rien n'est invalidé sur la seule foi d'une horloge.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/**
 * Un identifiant de dossier ne périme pas comme un forecast. Un seul délai pour tout serait faux
 * dans les deux sens : il ferait relire des choses stables et laisserait passer des volatiles.
 */
export const AGES_CREDIBLES_H: Readonly<Record<string, number>> = {
  /** Un chiffre financier bouge à chaque clôture, à chaque révision. */
  FINANCE: 24,
  /** Un statut réglementaire change au rythme des dépôts. */
  REGULATORY: 72,
  /** Ce qu'une personne a dit reste ce qu'elle a dit — mais elle peut se reprendre (§118.22). */
  HUMAIN: 168,
  /** Une fiche ERP structurelle (nom, RC, adresse) bouge rarement. */
  ERP: 336,
  /** Un document déposé ne change pas ; c'est sa VERSION qui change. */
  DOCUMENT: 720,
  /** Ce qu'on ne sait pas classer se regarde vite : l'ignorance ne se lit pas comme stabilité. */
  AUTRE: 48,
};

/** Une durée en heures, dite comme on la dit à quelqu'un. */
export function direDuree(heures: number): string {
  if (heures < 1) return `${Math.round(heures * 60)} min`;
  if (heures < 48) return `${Math.round(heures)} h`;
  return `${Math.round(heures / 24)} jours`;
}
