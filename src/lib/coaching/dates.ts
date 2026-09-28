/**
 * LES DATES D'UNE TOURNÉE EN DOUBLE (§118.157) — module PUR.
 *
 * Le jour de la tournée est une DATE, pas un instant (`@db.Date`) : Prisma la rend à minuit UTC.
 * L'afficher dans le fuseau du navigateur ou du serveur la décalerait d'un jour à l'ouest de
 * Greenwich — on la lit donc toujours en UTC, et « aujourd'hui » se lit à Alger, là où la
 * tournée a lieu.
 */

const JOUR = /^(\d{4})-(\d{2})-(\d{2})$/;

/** « 2026-09-12 » → la date de ce jour à minuit UTC ; `null` si la chaîne n'est pas un vrai jour. */
export function lireJour(s: string | null | undefined): Date | null {
  const m = JOUR.exec((s ?? "").trim());
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  // « 2026-02-31 » deviendrait le 3 mars : on refuse plutôt que de glisser au mois suivant.
  return d.getUTCFullYear() === Number(m[1]) && d.getUTCMonth() === Number(m[2]) - 1 && d.getUTCDate() === Number(m[3]) ? d : null;
}

/** Aujourd'hui à Alger, « AAAA-MM-JJ ». */
export function jourAlger(maintenant: Date = new Date()): string {
  return maintenant.toLocaleDateString("en-CA", { timeZone: "Africa/Algiers" });
}

/** Une date de tournée (minuit UTC) → « AAAA-MM-JJ ». */
export function jourDe(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** « 12/09/2026 » — lu en UTC, pour ne jamais décaler le jour. */
export function formaterJour(d: Date): string {
  return d.toLocaleDateString("fr-FR", { timeZone: "UTC" });
}
