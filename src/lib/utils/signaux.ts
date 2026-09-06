/**
 * LE SIGNAL — le vocabulaire commun de l'intelligence métier (mandat 4 §27). Pur, sans import :
 * Regulatory, Legal et Finance produisent chacun des signaux de cette forme, et la boîte de
 * décision, les outils d'Adam et l'écran les lisent sans connaître le domaine qui les a émis.
 *
 * Un signal DIT son calcul (`calcul`) : le lecteur peut refaire l'arithmétique ou relire la
 * clause. Sans calcul lisible, un signal est une opinion — et Adam n'en a pas.
 */

export type Gravite = "CRITIQUE" | "HAUTE" | "NORMALE" | "BASSE";
export const RANG_GRAVITE: Record<Gravite, number> = { CRITIQUE: 0, HAUTE: 1, NORMALE: 2, BASSE: 3 };
export const LIBELLE_GRAVITE: Record<Gravite, string> = { CRITIQUE: "critique", HAUTE: "haute", NORMALE: "normale", BASSE: "basse" };

export type DomaineSignal = "REGULATORY" | "LEGAL" | "FINANCE";

export interface Signal {
  code: string;
  gravite: Gravite;
  titre: string;
  detail: string;
  /** Le calcul, en clair : « 62 % consommé à 41 % du temps », « fin − préavis 6 mois ». */
  calcul?: string;
  /** ISO `AAAA-MM-JJ` quand le signal a une date. */
  echeance?: string | null;
  montant?: number | null;
  entite?: { type: string; id: string; ref?: string | null } | null;
  href?: string | null;
  /** Ce qu'il y a à FAIRE — une phrase pour Adam ou pour la personne. */
  action?: string | null;
  domaine?: DomaineSignal;
}

/** TRIER des signaux : gravité, puis échéance, puis montant décroissant. */
export function trierSignaux<T extends Signal>(signaux: readonly T[]): T[] {
  return [...signaux].sort((a, b) => RANG_GRAVITE[a.gravite] - RANG_GRAVITE[b.gravite] || (a.echeance ?? "9999").localeCompare(b.echeance ?? "9999") || (b.montant ?? 0) - (a.montant ?? 0));
}

/** Un RÉSUMÉ chiffré : combien par gravité — ce qu'un PDG lit en premier. */
export function resumerSignaux(signaux: readonly Signal[]): { total: number; parGravite: Record<Gravite, number>; phrase: string } {
  const parGravite: Record<Gravite, number> = { CRITIQUE: 0, HAUTE: 0, NORMALE: 0, BASSE: 0 };
  for (const s of signaux) parGravite[s.gravite] += 1;
  const parts = (Object.keys(parGravite) as Gravite[]).filter((g) => parGravite[g] > 0).map((g) => `${parGravite[g]} ${LIBELLE_GRAVITE[g]}${parGravite[g] > 1 && g !== "BASSE" ? "s" : ""}`);
  return { total: signaux.length, parGravite, phrase: signaux.length ? `${signaux.length} ${signaux.length > 1 ? "signaux" : "signal"} (${parts.join(", ")})` : "aucun signal" };
}

/** Une gravité depuis un nombre de jours restants : dépassé → critique, sous 7 → haute, sous 30 → normale, sinon basse. */
export function graviteParJours(jours: number, seuils: { haute?: number; normale?: number } = {}): Gravite {
  if (jours < 0) return "CRITIQUE";
  if (jours <= (seuils.haute ?? 7)) return "HAUTE";
  if (jours <= (seuils.normale ?? 30)) return "NORMALE";
  return "BASSE";
}

export const JOUR_MS = 86_400_000;
export const joursEntre = (de: Date, a: Date): number => Math.floor((a.getTime() - de.getTime()) / JOUR_MS);
export const isoJour = (d: Date): string => d.toISOString().slice(0, 10);
