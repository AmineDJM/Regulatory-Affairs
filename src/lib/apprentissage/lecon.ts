/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * APPRENDRE DE SES ÉCHECS SANS APPRENDRE TOUT SEUL (mandat 6 §49) — pur.
 *
 * ── LA CONTRAINTE QUI GOUVERNE CE FICHIER ───────────────────────────────────────────────
 *
 * §118.12 : « Pas d'apprentissage silencieux. Ce qu'Adam a OBSERVÉ n'est pas ce qu'un humain a
 * APPROUVÉ, et seul l'approuvé fait autorité. »
 *
 * Un système qui corrigerait son routage tout seul à partir de ses échecs deviendrait, au bout
 * de quelques semaines, un système que personne ne sait plus expliquer : les décisions
 * viendraient d'un historique que personne n'a relu. Pire, une seule anomalie mal classée
 * suffirait à installer une règle fausse et durable.
 *
 * Ce module produit donc des **propositions**, jamais des changements. Une leçon porte :
 * ce qu'on a vu, combien de fois, la preuve, ce qu'elle propose de changer, et QUI doit
 * l'approuver. Rien ne s'applique sans ce clic.
 *
 * ── LA RÉCURRENCE EST LE SIGNAL, PAS L'ÉCHEC ────────────────────────────────────────────
 *
 * Un échec unique est du bruit : un service qui hoquette, un document mal scanné, une demande
 * ambiguë. Trois fois la même cause sur la même capacité est un DÉFAUT. Le seuil est bas mais
 * il n'est pas à un, et c'est la différence entre une feuille de route et une liste d'incidents.
 *
 * ── CE QU'UNE LEÇON N'A PAS LE DROIT DE PROPOSER ────────────────────────────────────────
 *
 * Élargir un droit. Jamais. Une leçon peut dire « cette capacité est refusée à ce rôle 12 fois
 * par semaine » — c'est une information utile — mais la suite qu'elle propose est de POSER LA
 * QUESTION à un humain, pas d'ouvrir le droit. `policy/guard.ts` l'interdit déjà à la
 * compilation côté mission (§118.6) ; ici c'est la même règle, tenue par le type : aucune
 * `Action` ne peut porter sur une permission.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import type { NatureManque } from "@/lib/registre/manques";

/** Un échec observé, tel que le banc et le moteur le produisent déjà (§43, §44). */
export interface Echec {
  quand: Date;
  /** La demande, en français — c'est elle qui deviendra un eval. */
  demande: string;
  /** La cause telle que le juge l'a classée (§43). */
  cause: string;
  /** La nature du manque telle que le registre l'a classée (§44). */
  nature: NatureManque | null;
  /** La capacité en jeu, quand il y en a une. */
  capacite: string | null;
  /** Le modèle qui a servi — pour distinguer un défaut de routage d'un défaut de capacité. */
  modele: string | null;
  /** Ce qu'un humain a corrigé derrière, quand il l'a fait. La matière la plus précieuse. */
  correctionHumaine?: string | null;
}

/**
 * CE QU'UNE LEÇON PEUT PROPOSER.
 *
 * La liste est FERMÉE, et c'est la garantie : aucune de ces actions ne touche à un droit, à un
 * rôle, ni à un garde-fou. Le pire qu'une leçon approuvée puisse faire est d'ajouter un test.
 */
export const ACTIONS = [
  /** Écrire un eval qui reproduit l'échec. La seule action qui empêche la récidive de passer inaperçue. */
  "ECRIRE_UN_EVAL",
  /** La description d'une capacité induit le planificateur en erreur : la préciser. */
  "PRECISER_UNE_DESCRIPTION",
  /** Le modèle choisi n'était pas au niveau : proposer une escalade sur ce type de tâche. */
  "REVOIR_LE_ROUTAGE",
  /** Le planificateur reproduit une forme fausse : lui donner un exemple, ou une contrainte. */
  "GUIDER_LE_PLANIFICATEUR",
  /** Rien ne sait faire cela : c'est du code à écrire, et ça va sur la feuille de route. */
  "AJOUTER_UNE_PRIMITIVE",
  /** La donnée manque dans l'ERP : c'est une saisie, pas un défaut logiciel. */
  "SAISIR_UNE_DONNEE",
  /** Un droit manque de façon répétée : POSER LA QUESTION à un humain. Jamais l'ouvrir. */
  "POSER_LA_QUESTION_DU_DROIT",
] as const;
export type Action = (typeof ACTIONS)[number];

export const SENS_ACTION: Readonly<Record<Action, string>> = {
  ECRIRE_UN_EVAL: "ajouter un cas au banc pour que cet échec précis ne repasse plus inaperçu",
  PRECISER_UNE_DESCRIPTION: "réécrire la description de la capacité : le planificateur ne la trouve pas, ou la prend pour autre chose",
  REVOIR_LE_ROUTAGE: "ce type de tâche demande plus que le modèle qui l'a traité — proposer une escalade",
  GUIDER_LE_PLANIFICATEUR: "donner au planificateur la contrainte ou l'exemple qui lui manque sur cette forme",
  AJOUTER_UNE_PRIMITIVE: "écrire le code qui manque — c'est de la dette technique, pas un réglage",
  SAISIR_UNE_DONNEE: "la donnée n'est pas dans l'ERP : ce n'est pas un défaut logiciel, c'est une saisie",
  POSER_LA_QUESTION_DU_DROIT: "un droit manque souvent : demander à un humain s'il devrait être accordé — JAMAIS l'accorder ici",
};

/** Où va la cause. Une cause absente de cette table ne produit AUCUNE leçon, plutôt qu'une leçon au hasard. */
const DE_LA_CAUSE: Readonly<Record<string, Action>> = {
  PLANIFICATEUR: "GUIDER_LE_PLANIFICATEUR",
  DECOUVERTE: "PRECISER_UNE_DESCRIPTION",
  PRIMITIVE_ABSENTE: "AJOUTER_UNE_PRIMITIVE",
  MODELE: "REVOIR_LE_ROUTAGE",
  DONNEE: "SAISIR_UNE_DONNEE",
  CONTEXTE: "PRECISER_UNE_DESCRIPTION",
  PERMISSION: "POSER_LA_QUESTION_DU_DROIT",
  RENDU: "AJOUTER_UNE_PRIMITIVE",
  // EXECUTION et INDISPONIBLE n'apparaissent pas : un service qui a hoqueté n'enseigne rien.
};

export const SEUIL_RECURRENCE = 3;

export interface Lecon {
  /** La clé de regroupement : c'est elle qui définit « le même échec ». */
  cle: string;
  action: Action;
  /** Ce qu'on propose, en français, avec les nombres. */
  proposition: string;
  /** Combien de fois. En dessous du seuil, la leçon n'est pas PROPOSÉE, elle est OBSERVÉE. */
  occurrences: number;
  /** Les demandes exactes qui ont échoué — la matière de l'eval à écrire. */
  exemples: string[];
  premiere: Date;
  derniere: Date;
  /** VRAI seulement au-delà du seuil : en dessous, on regarde sans conclure. */
  proposable: boolean;
  /**
   * QUI DOIT APPROUVER. Toujours renseigné, toujours un humain. Une leçon sans destinataire
   * serait une leçon qui s'applique toute seule.
   */
  aApprouverPar: "DIRECTION" | "TECHNIQUE";
  /** Ce qu'une correction humaine a appris, quand il y en a eu une — la meilleure preuve. */
  corrections: string[];
}

const cleDe = (e: Echec): string => `${e.cause}|${e.nature ?? "?"}|${e.capacite ?? "-"}`;

/**
 * REGROUPE LES ÉCHECS EN LEÇONS.
 *
 * Le regroupement se fait sur cause + nature + capacité, PAS sur le texte de la demande : deux
 * formulations différentes du même échec sont le même défaut, et les compter séparément les
 * garderait tous deux sous le seuil — c'est-à-dire invisibles, indéfiniment.
 */
export function apprendre(echecs: readonly Echec[], seuil = SEUIL_RECURRENCE): Lecon[] {
  const paquets = new Map<string, Echec[]>();
  for (const e of echecs) {
    if (!(e.cause in DE_LA_CAUSE)) continue;
    const k = cleDe(e);
    paquets.set(k, [...(paquets.get(k) ?? []), e]);
  }

  const lecons: Lecon[] = [];
  for (const [cle, lot] of paquets) {
    const tries = [...lot].sort((a, b) => a.quand.getTime() - b.quand.getTime());
    const action = DE_LA_CAUSE[tries[0]!.cause]!;
    const cap = tries[0]!.capacite;
    const corrections = tries.map((e) => e.correctionHumaine).filter((x): x is string => Boolean(x));

    lecons.push({
      cle, action,
      proposition: `${lot.length} échec(s) de même cause${cap ? ` sur « ${cap} »` : ""} : ${SENS_ACTION[action]}`,
      occurrences: lot.length,
      // Les demandes DISTINCTES : trois fois la même phrase font un eval, pas trois.
      exemples: [...new Set(tries.map((e) => e.demande))].slice(0, 5),
      premiere: tries[0]!.quand,
      derniere: tries[tries.length - 1]!.quand,
      proposable: lot.length >= seuil || corrections.length > 0,
      aApprouverPar: action === "POSER_LA_QUESTION_DU_DROIT" || action === "SAISIR_UNE_DONNEE" ? "DIRECTION" : "TECHNIQUE",
      corrections,
    });
  }

  // Les plus fréquentes d'abord : c'est l'ordre dans lequel on veut les traiter.
  return lecons.sort((a, b) => b.occurrences - a.occurrences || a.cle.localeCompare(b.cle));
}

/**
 * L'EVAL QUE LA LEÇON PROPOSE D'ÉCRIRE.
 *
 * Rendu en texte, pas en code : personne ne colle du code généré dans une suite de tests sans
 * le lire, et prétendre le contraire produirait des tests que personne ne comprend. Ce qu'on
 * rend, c'est la MATIÈRE — la demande exacte, ce qui a échoué, ce qu'on attend maintenant.
 */
export function redigerEval(l: Lecon): { titre: string; demande: string; attendu: string; pourquoi: string } | null {
  if (!l.proposable) return null;
  const demande = l.exemples[0] ?? "";
  const attendu = l.action === "AJOUTER_UNE_PRIMITIVE" || l.action === "SAISIR_UNE_DONNEE"
    // Tant que la primitive n'existe pas, le bon comportement est de NOMMER le manque — et
    // c'est ce que l'eval doit exiger. Un eval qui attendrait la réussite serait rouge pour
    // toujours et finirait ignoré, ce qui est le pire état d'un test.
    ? "la mission NOMME précisément ce qui manque et ne feint aucun succès"
    : "la mission aboutit, avec les preuves, sans intervention humaine";
  return {
    titre: `régression — ${l.cle}`,
    demande,
    attendu,
    pourquoi: `vu ${l.occurrences} fois entre le ${l.premiere.toLocaleDateString("fr-FR")} et le ${l.derniere.toLocaleDateString("fr-FR")}${l.corrections.length ? ` ; corrigé à la main ${l.corrections.length} fois` : ""}`,
  };
}

/** Le résumé pour un humain : ce qui attend son accord, et ce qu'on observe sans conclure. */
export function feuille(lecons: readonly Lecon[]): { aDecider: Lecon[]; sousSurveillance: Lecon[]; resume: string } {
  const aDecider = lecons.filter((l) => l.proposable);
  const sousSurveillance = lecons.filter((l) => !l.proposable);
  return {
    aDecider, sousSurveillance,
    resume: aDecider.length === 0
      ? `Rien à décider : ${sousSurveillance.length} motif(s) observé(s), aucun n'a atteint le seuil de ${SEUIL_RECURRENCE}.`
      : `${aDecider.length} leçon(s) attendent un accord humain, ${sousSurveillance.length} sont observées sans conclure. AUCUNE ne s'applique toute seule.`,
  };
}
