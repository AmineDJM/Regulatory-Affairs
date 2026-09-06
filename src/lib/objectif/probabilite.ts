/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LA PROBABILITÉ D'ATTEINDRE UN OBJECTIF (mandat 6 §47) — pure, et JAMAIS présentée comme une
 * vérité scientifique.
 *
 * ── LE DANGER DE CE MODULE, DIT EN PREMIER ──────────────────────────────────────────────
 *
 * « 78 % » a l'air d'un résultat. Ce n'en est pas un : c'est une AGRÉGATION DE FACTEURS
 * OBSERVÉS, pondérée par des poids que quelqu'un a choisis. Aucun modèle statistique n'a été
 * ajusté, aucun historique de projets comparables n'a été appris. Un système qui présenterait
 * ce nombre comme une prévision tromperait plus efficacement qu'en ne disant rien.
 *
 * D'où trois propriétés tenues par le code, et non par une note de bas de page :
 *
 *   1. la probabilité NE SORT JAMAIS SEULE : elle vient avec ses facteurs, chacun avec son
 *      effet signé, son poids et sa PREUVE ;
 *   2. elle porte ses `limites`, qui disent en toutes lettres ce qu'elle n'est pas ;
 *   3. elle est BORNÉE à [2 %, 98 %] : ni certitude, ni impossibilité. Un objectif à 100 % est
 *      un objectif atteint — et un objectif atteint se constate, il ne s'estime pas.
 *
 * ── POURQUOI DES FACTEURS SIGNÉS PLUTÔT QU'UNE FORMULE ──────────────────────────────────
 *
 * Parce que la question du dirigeant n'est pas « combien ? » mais « pourquoi ? ». « 78 %, le
 * facteur négatif principal est le retard des dossiers X et Y » est actionnable ; « 78 % » ne
 * l'est pas. Le calcul est donc construit pour être DÉCOMPOSABLE : chaque facteur explique
 * exactement sa part, et leur somme fait le résultat.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import { avancement, porteeDuRetard, type Objectif } from "@/lib/objectif/modele";

export interface Facteur {
  /** Le facteur, en français : « 3 jalons en retard », « aucune preuve sur 2 critères atteints ». */
  quoi: string;
  /** Son effet sur la probabilité, en points de pourcentage. Négatif = il fait baisser. */
  effet: number;
  /** Ce qui permet de l'affirmer — un compte, une date, une liste. Jamais une impression. */
  preuve: string;
}

export interface Estimation {
  /** Entre 0,02 et 0,98. Ni certitude, ni impossibilité. */
  probabilite: number;
  /** Le point de départ : la part des critères atteints. */
  base: number;
  facteurs: Facteur[];
  /** Le facteur négatif le plus lourd — c'est la phrase que le dirigeant retiendra. */
  facteurNegatifPrincipal: Facteur | null;
  /** Notre confiance dans l'estimation elle-même : elle chute quand les faits manquent. */
  confiance: number;
  /** Ce que ce nombre N'EST PAS. Toujours non vide. */
  limites: string[];
  /** La phrase à dire, avec le pourquoi. */
  phrase: string;
}

/**
 * LES POIDS, ET POURQUOI CEUX-LÀ.
 *
 * Ils ne sont pas ajustés sur des données : ils traduisent une doctrine, et ils sont exposés
 * pour qu'on puisse la discuter. Le RETARD pèse le plus parce qu'un jalon en retard est le seul
 * fait qui ne se rattrape pas tout seul ; le BLOCAGE juste derrière parce qu'il multiplie le
 * retard ; l'ABSENCE DE PREUVE pèse aussi lourd qu'un vrai retard, parce qu'un critère coché
 * sans preuve n'est pas une avance, c'est un risque déguisé en avance.
 */
export const POIDS = {
  retard: 0.30,
  blocage: 0.20,
  risques: 0.15,
  tempsRestant: 0.15,
  sansPreuve: 0.12,
  inconnus: 0.08,
} as const;

const borner = (x: number, min: number, max: number): number => Math.min(max, Math.max(min, x));
const pc = (x: number): string => `${Math.round(x * 100)} %`;

/**
 * ESTIME. Le résultat est décomposable : `base + somme(effets) = probabilite` (avant bornage).
 */
export function estimer(o: Objectif, maintenant: Date = new Date()): Estimation {
  const a = avancement(o, maintenant);
  const limites: string[] = [
    "ce n'est PAS une prévision statistique : aucun modèle n'a été ajusté sur des projets comparables",
    "c'est une agrégation de faits observés, pondérée par des poids déclarés dans le code et discutables",
  ];

  // ── LA BASE : la part des critères ATTEINTS ──────────────────────────────────────────
  //
  // Les critères INCONNUS sortent du dénominateur : les compter en échec punirait l'ignorance,
  // les compter en réussite la récompenserait. Ils réduisent la CONFIANCE, pas la probabilité.
  const connus = a.criteresTotal - a.criteresInconnus;
  const base = connus > 0 ? a.criteresAtteints / connus : 0.5;
  if (connus === 0) limites.push("aucun critère dont l'état soit connu : la base est arbitraire (50 %), et la confiance s'effondre en conséquence");

  const facteurs: Facteur[] = [];

  // ── LE RETARD ─────────────────────────────────────────────────────────────────────────
  if (a.jalonsTotal > 0 && a.jalonsEnRetard.length > 0) {
    const part = a.jalonsEnRetard.length / a.jalonsTotal;
    const noms = a.jalonsEnRetard.slice(0, 3).map((j) => j.libelle).join(", ");
    facteurs.push({
      quoi: `${a.jalonsEnRetard.length} jalon(s) en retard sur ${a.jalonsTotal}`,
      effet: -POIDS.retard * part * 100,
      preuve: `${noms}${a.jalonsEnRetard.length > 3 ? "…" : ""}`,
    });
  }

  // ── LE BLOCAGE — un retard qui en empêche d'autres coûte plus que lui-même ────────────
  if (a.jalonsBloques.length > 0 && a.jalonsTotal > 0) {
    const enChaine = new Set<string>();
    for (const j of a.jalonsEnRetard) for (const x of porteeDuRetard(o.jalons, j.id)) enChaine.add(x);
    const part = Math.min(1, (a.jalonsBloques.length + enChaine.size) / (2 * a.jalonsTotal));
    facteurs.push({
      quoi: `${a.jalonsBloques.length} jalon(s) bloqué(s) par un prédécesseur non fait${enChaine.size ? `, ${enChaine.size} en aval d'un retard` : ""}`,
      effet: -POIDS.blocage * part * 100,
      preuve: a.jalonsBloques.slice(0, 3).map((b) => `${b.jalon.libelle} ← ${b.par.map((p) => p.libelle).join(", ")}`).join(" ; "),
    });
  }

  // ── LES RISQUES DÉCLARÉS ──────────────────────────────────────────────────────────────
  if (o.risques.length > 0) {
    const expose = o.risques.reduce((s, r) => s + borner(r.vraisemblance, 0, 1) * borner(r.impact, 0, 1), 0) / o.risques.length;
    const pire = [...o.risques].sort((x, y) => y.vraisemblance * y.impact - x.vraisemblance * x.impact)[0]!;
    facteurs.push({
      quoi: `${o.risques.length} risque(s) déclaré(s), exposition moyenne ${pc(expose)}`,
      effet: -POIDS.risques * expose * 100,
      preuve: `le plus lourd : ${pire.quoi} (${pc(pire.vraisemblance)} × ${pc(pire.impact)})${pire.parade ? ` — parade : ${pire.parade}` : " — AUCUNE parade déclarée"}`,
    });
  }

  // ── LE TEMPS QUI RESTE, RAPPORTÉ À CE QUI RESTE À FAIRE ──────────────────────────────
  if (a.joursRestants !== null) {
    const reste = a.jalonsTotal > 0 ? (a.jalonsTotal - a.jalonsFaits) / a.jalonsTotal : 1 - base;
    if (a.joursRestants <= 0) {
      facteurs.push({ quoi: "l'échéance est passée", effet: -POIDS.tempsRestant * 100, preuve: `échéance dépassée de ${-a.joursRestants} jour(s)` });
    } else {
      // Une tension : beaucoup à faire, peu de temps. Bornée pour rester un facteur, pas un verdict.
      const tension = borner(reste - a.joursRestants / 365, 0, 1);
      if (tension > 0.05) {
        facteurs.push({
          quoi: `il reste ${pc(reste)} du chemin pour ${a.joursRestants} jour(s)`,
          effet: -POIDS.tempsRestant * tension * 100,
          preuve: `${a.jalonsTotal - a.jalonsFaits} jalon(s) restant(s), échéance dans ${a.joursRestants} jour(s)`,
        });
      }
    }
  } else {
    limites.push("aucune échéance déclarée : le facteur temps ne peut pas être évalué");
  }

  // ── LES RÉUSSITES SANS PREUVE ─────────────────────────────────────────────────────────
  if (a.sansPreuve.length > 0 && a.criteresTotal > 0) {
    const part = a.sansPreuve.length / a.criteresTotal;
    facteurs.push({
      quoi: `${a.sansPreuve.length} critère(s) déclaré(s) atteints SANS preuve`,
      effet: -POIDS.sansPreuve * part * 100,
      preuve: a.sansPreuve.map((c) => c.enonce).slice(0, 3).join(" ; "),
    });
  }

  // ── CE QU'ON IGNORE ───────────────────────────────────────────────────────────────────
  if (a.criteresInconnus > 0 && a.criteresTotal > 0) {
    const part = a.criteresInconnus / a.criteresTotal;
    facteurs.push({
      quoi: `${a.criteresInconnus} critère(s) dont l'état est INCONNU`,
      // L'ignorance n'est pas un mauvais signe en soi : elle pousse vers le milieu, pas vers le bas.
      effet: -POIDS.inconnus * part * (base - 0.5) * 100 * 2,
      preuve: o.criteres.filter((c) => c.etat === "INCONNU").map((c) => c.enonce).slice(0, 3).join(" ; "),
    });
  }

  const somme = facteurs.reduce((s, f) => s + f.effet, 0) / 100;
  const probabilite = borner(base + somme, 0.02, 0.98);

  const negatifs = facteurs.filter((f) => f.effet < 0).sort((x, y) => x.effet - y.effet);
  const principal = negatifs[0] ?? null;

  // LA CONFIANCE DANS L'ESTIMATION — elle chute avec l'ignorance et le manque de jalons.
  const confiance = borner(
    0.85
    - (a.criteresTotal > 0 ? 0.5 * (a.criteresInconnus / a.criteresTotal) : 0.5)
    - (a.jalonsTotal === 0 ? 0.2 : 0)
    - (a.sansPreuve.length > 0 ? 0.1 : 0),
    0.1, 0.9,
  );
  // L'AVERTISSEMENT PORTE SUR LA BASE DE FAITS, pas seulement sur le nombre. Un tiers de critères
  // inconnus rend l'estimation faible même quand l'arithmétique de la confiance reste au-dessus
  // du seuil : c'est la PART D'IGNORANCE qui doit déclencher la mise en garde, pas un réglage.
  const partIgnoree = a.criteresTotal > 0 ? a.criteresInconnus / a.criteresTotal : 1;
  if (confiance < 0.5 || partIgnoree >= 1 / 3) {
    limites.push(`la confiance dans cette estimation est FAIBLE : ${a.criteresInconnus} critère(s) sur ${a.criteresTotal} sont d'état inconnu — elle ne vaut pas mieux qu'un ordre d'idée`);
  }

  const phrase = principal
    ? `${pc(probabilite)} — le facteur négatif principal est : ${principal.quoi} (${principal.preuve}).`
    : `${pc(probabilite)} — aucun facteur négatif identifié ; l'estimation repose sur ${a.criteresAtteints}/${connus} critère(s) atteints.`;

  return { probabilite, base, facteurs, facteurNegatifPrincipal: principal, confiance, limites, phrase };
}
