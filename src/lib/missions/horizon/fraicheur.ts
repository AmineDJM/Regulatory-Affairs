/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LA FRAÎCHEUR DES ENTRÉES — le faux succès d'une mission longue, et sa seule parade.
 *
 * ── LE CAS ──────────────────────────────────────────────────────────────────────────────
 *
 * Jour 1 : la mission lit le forecast NIVOLEX 2027 — 41,3 M DZD — et l'inscrit dans son plan.
 * Jour 18 : Finance a révisé, c'est 46,8. Jour 19 : la mission produit son classeur, son deck,
 * envoie le tout. TOUTES les étapes sont vertes, le contrôle arithmétique passe, le juge lit
 * un livrable cohérent. Personne ne peut voir que le chiffre est mort — parce que rien, nulle
 * part, ne se souvient de QUAND il a été lu.
 *
 * C'est le faux succès le plus difficile à voir : il n'a aucune signature d'échec. Une mission
 * de trois semaines qui ne date pas ses entrées conclut sur une vérité périmée, et le fait avec
 * une confiance parfaite.
 *
 * ── CE QU'ON GARDE, ET CE QU'ON NE GARDE PAS ────────────────────────────────────────────
 *
 * On garde l'EMPREINTE, pas la valeur. Stocker la valeur ferait de `MissionInput` un second
 * registre de vérité à côté de l'ERP (§118.5) — deux copies qui divergent, et la question
 * « laquelle a raison ? » qui n'a plus de réponse. L'empreinte répond à la seule question
 * utile : « est-ce encore ce que j'ai lu ? ».
 *
 * ── CE QUE CE MODULE NE FAIT PAS ────────────────────────────────────────────────────────
 *
 * Il ne DÉCIDE pas de relire. Il dit ce qui est vieux, ce qui a changé, et quelles branches en
 * dépendent. Relire coûte des appels et peut avoir des effets ; c'est au pilote de choisir, et
 * à la personne d'arbitrer quand le changement est matériel (§118.8).
 *
 * PUR — aucune base, aucune horloge implicite : le temps arrive en paramètre.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import { createHash } from "node:crypto";

/** Les quatre niveaux de §118.9 — seul TROUVE autorise à agir. */
export const CONFIANCES = ["TROUVE", "DEDUIT", "CANDIDAT", "INCONNU"] as const;
export type Confiance = (typeof CONFIANCES)[number];

export interface EntreeMission {
  cle: string;
  source: string;
  version: string | null;
  empreinte: string;
  confiance: Confiance;
  retrievedAt: Date;
  effectiveAt: Date | null;
  supersededAt: Date | null;
  stepKey: string | null;
  milestoneId: string | null;
}

/**
 * L'EMPREINTE D'UNE VALEUR LUE — stable, indépendante de l'ordre des clés d'un objet.
 *
 * L'ordre des clés d'un `JSON.stringify` suit l'ordre d'insertion : deux lectures de la MÊME
 * fiche, l'une par `findUnique` et l'autre par `findFirst`, rendraient deux empreintes
 * différentes et la fraîcheur crierait au changement à chaque tour. On trie donc, partout et à
 * toute profondeur.
 *
 * Les nombres passent par leur écriture décimale : `41300` et `41300.0` sont la même valeur, et
 * les distinguer ferait dire « ça a changé » à une simple relecture.
 */
export function empreinteDe(valeur: unknown): string {
  return createHash("sha256").update(canonique(valeur)).digest("hex").slice(0, 32);
}

function canonique(v: unknown): string {
  if (v === null || v === undefined) return " ";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : " ";
  if (typeof v === "boolean") return v ? "1" : "0";
  if (typeof v === "string") return JSON.stringify(v);
  if (v instanceof Date) return v.toISOString();
  if (Array.isArray(v)) return `[${v.map(canonique).join(",")}]`;
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    const cles = Object.keys(o).sort();
    return `{${cles.map((k) => `${JSON.stringify(k)}:${canonique(o[k])}`).join(",")}}`;
  }
  return JSON.stringify(String(v));
}

/**
 * COMBIEN DE TEMPS UNE DONNÉE RESTE CRÉDIBLE — par NATURE de source, pas par réglage global.
 *
 * Un identifiant de dossier ne périme pas de la même manière qu'un forecast ou qu'une réponse
 * humaine. Un seul délai pour tout serait faux dans les deux sens : il ferait relire des choses
 * stables et laisserait passer des choses volatiles.
 *
 * Ces durées disent « à partir de quand il faut REGARDER », pas « à partir de quand c'est
 * faux ». Rien n'est invalidé sur la seule foi d'une horloge : c'est l'empreinte qui tranche.
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

/** La nature lue dans le préfixe de la source — « ERP:RegulatoryDossier:… », « humain:Khaled ». */
export function natureDe(source: string): keyof typeof AGES_CREDIBLES_H {
  const p = source.split(":")[0]?.trim().toUpperCase() ?? "";
  if (p === "FINANCE") return "FINANCE";
  if (p === "REGULATORY" || p === "REG") return "REGULATORY";
  if (p === "HUMAIN" || p === "PERSONNE") return "HUMAIN";
  if (p === "ERP" || p === "DB" || p === "BASE") return "ERP";
  if (p === "DOCUMENT" || p === "DRIVE" || p === "DOC") return "DOCUMENT";
  return "AUTRE";
}

export interface VerdictFraicheur {
  entree: EntreeMission;
  /** L'âge en heures au moment où on regarde. */
  ageH: number;
  /** L'âge dépasse ce que la nature de la source rend crédible. */
  aRegarder: boolean;
  /** Ce qu'on dira : « lu il y a 19 jours, un forecast se révise chaque jour ». */
  phrase: string;
}

/**
 * CE QU'IL FAUT REGARDER AVANT D'AGIR — les entrées trop vieilles pour leur nature.
 *
 * Une entrée déjà remplacée (`supersededAt`) n'est pas « à regarder » : elle est morte, et la
 * plus fraîche a pris sa place. La compter ici ferait proposer de relire une lecture qu'on
 * vient déjà de refaire.
 */
export function aRegarder(
  entrees: readonly EntreeMission[],
  maintenant: Date,
  ages: Readonly<Record<string, number>> = AGES_CREDIBLES_H,
): VerdictFraicheur[] {
  const out: VerdictFraicheur[] = [];
  for (const e of entrees) {
    if (e.supersededAt) continue;
    const base = e.effectiveAt ?? e.retrievedAt;
    const ageH = (maintenant.getTime() - base.getTime()) / 3_600_000;
    const nature = natureDe(e.source);
    const seuil = ages[nature] ?? ages.AUTRE ?? 48;
    if (ageH < seuil) continue;
    out.push({
      entree: e,
      ageH,
      aRegarder: true,
      phrase: `« ${e.cle} » vient de ${e.source} et a été lu il y a ${dire(ageH)} ; `
        + `une donnée de nature ${nature} n'est plus tenue pour fraîche au-delà de ${dire(seuil)}.`,
    });
  }
  return out.sort((a, b) => b.ageH - a.ageH);
}

function dire(heures: number): string {
  if (heures < 1) return `${Math.round(heures * 60)} min`;
  if (heures < 48) return `${Math.round(heures)} h`;
  return `${Math.round(heures / 24)} jours`;
}

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * CE QUE LA RELECTURE A CHANGÉ — et QUELLES BRANCHES en dépendent.
 *
 * `stepKey` est le lien causal : c'est l'étape qui a LU la donnée. Les étapes qui en descendent
 * dans le DAG sont celles dont le résultat repose dessus. Ce sont elles — et elles seules —
 * qu'un changement matériel invalide. Sans ce lien, la seule réponse possible à « le forecast a
 * bougé » serait « replanifie tout », ce qui jetterait vingt jalons pour un chiffre.
 *
 * On ne rend PAS un ordre d'invalidation : on rend ce qui EST touché. La décision — relire,
 * recompiler la branche, demander à un humain — appartient au pilote, qui connaît les effets
 * déjà produits (un envoi parti ne se rejoue pas).
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
export interface EtapeDuGraphe {
  key: string;
  dependsOn: readonly string[];
  status: string;
  /** L'étape a-t-elle produit un EFFET (envoi, écriture, fichier) ? */
  aEuUnEffet?: boolean;
}

export interface ImpactChangement {
  cle: string;
  ancienne: string;
  nouvelle: string;
  /** L'étape qui avait lu la donnée. */
  origine: string | null;
  /** Elle et toute sa descendance — dans l'ordre topologique du graphe. */
  branche: string[];
  /** Celles de la branche qui ont déjà produit un effet : on ne les rejoue pas, on les DIT. */
  effetsDejaProduits: string[];
}

export function impactDuChangement(
  entree: EntreeMission,
  nouvelleEmpreinte: string,
  steps: readonly EtapeDuGraphe[],
): ImpactChangement | null {
  if (nouvelleEmpreinte === entree.empreinte) return null;
  const branche = entree.stepKey ? descendance(entree.stepKey, steps) : [];
  const parCle = new Map(steps.map((s) => [s.key, s]));
  return {
    cle: entree.cle,
    ancienne: entree.empreinte,
    nouvelle: nouvelleEmpreinte,
    origine: entree.stepKey,
    branche,
    effetsDejaProduits: branche.filter((k) => parCle.get(k)?.aEuUnEffet === true),
  };
}

/** L'étape et tout ce qui en descend, sans doublon, dans un ordre stable. */
export function descendance(depuis: string, steps: readonly EtapeDuGraphe[]): string[] {
  const enfants = new Map<string, string[]>();
  for (const s of steps) {
    for (const d of s.dependsOn) {
      const l = enfants.get(d);
      if (l) l.push(s.key); else enfants.set(d, [s.key]);
    }
  }
  const vus = new Set<string>([depuis]);
  const file = [depuis];
  const out: string[] = [];
  while (file.length > 0) {
    const k = file.shift() as string;
    out.push(k);
    for (const e of (enfants.get(k) ?? []).sort()) {
      if (!vus.has(e)) { vus.add(e); file.push(e); }
    }
  }
  return out;
}
