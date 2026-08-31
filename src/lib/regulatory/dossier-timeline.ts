/**
 * LA FRISE DU DOSSIER — les règles de l'histoire d'un CTD.
 *
 * « Réserves & réponses (ANPP) » était une pile de PDF à plat. On y voyait DES pièces, jamais
 * le CHEMIN : impossible de dire, un an plus tard, si telle réponse portait sur les premières
 * réserves ou sur celles de la version 3. Or un dossier réglementaire est exactement cela —
 * une suite de cycles : on dépose, l'agence répond, on redépose, elle répond encore.
 *
 * ── CE QUI EST TENU ICI ─────────────────────────────────────────────────────────────────────
 *
 *   1. **La frise raconte les ALLERS-RETOURS : elle s'ouvre sur « Réserves ANPP 1 ».** Le CTD
 *      initial, lui, n'est plus un tour de frise — c'est la pièce déposée sur l'étape 1 du
 *      processus officiel (« Réception du CTD complet »). Les cycles se numérotent (Réserves
 *      ANPP 1, 2…) : « version 3 » ne veut rien dire si l'on ignore de quoi elle est la
 *      troisième. Les frises HISTORIQUES ouvertes par un « CTD initial » restent lisibles
 *      telles quelles — on ne réécrit pas une histoire déjà écrite.
 *   2. **On insère APRÈS une étape**, jamais « quelque part ». Le « + » sous une étape dit
 *      exactement où l'on ajoute, et les suivantes se décalent — l'ordre AFFICHÉ est l'ordre
 *      RÉEL, et non une date de création qui raconterait autre chose (on saisit souvent après
 *      coup des réserves reçues la semaine passée).
 *   3. **Un type mal rempli est refusé en nommant la case.** Une version du CTD sans numéro,
 *      une étape « autre » sans libellé : ce sont les deux cas qui produisent une frise qu'on
 *      ne sait plus relire.
 *
 * Module PUR : ni base, ni import lourd. Testé.
 */

import { DOSSIER_STEP_ADDABLE, DOSSIER_STEP_KIND } from "@/lib/labels";

export type DossierStepKind =
  | "CTD_INITIAL" | "ANPP_RESERVES" | "ANPP_RESPONSE" | "CTD_VERSION" | "DECISION" | "OTHER";

/**
 * Les MOTS viennent de `lib/labels.ts` — le vocabulaire partagé de l'application ; les RÈGLES
 * restent ici. Recopier les libellés aurait donné deux vérités : l'écran aurait fini par dire
 * « Réserves ANPP » là où le journal d'audit dirait autre chose, et personne n'aurait vu
 * la dérive avant de relire un dossier deux ans plus tard.
 */
export const ADDABLE_KINDS = DOSSIER_STEP_ADDABLE as DossierStepKind[];
export const KIND_LABELS = DOSSIER_STEP_KIND as Record<DossierStepKind, string>;

/** Le ton de la pastille — le regard doit distinguer « ce qui vient d'eux » de « ce qu'on envoie ». */
export const KIND_TONES: Record<DossierStepKind, "info" | "warning" | "success" | "neutral"> = {
  CTD_INITIAL: "info",
  ANPP_RESERVES: "warning", // ce que l'agence nous oppose
  ANPP_RESPONSE: "info", // ce que nous répondons
  CTD_VERSION: "info",
  DECISION: "success",
  OTHER: "neutral",
};

export interface TimelineStep {
  id: string;
  kind: DossierStepKind;
  label: string;
  version: number | null;
  order: number;
}

/** Le libellé PROPOSÉ quand la personne n'en saisit pas — jamais imposé, seulement pré-rempli. */
export function defaultLabel(kind: DossierStepKind, version?: number | null): string {
  if (kind === "CTD_VERSION") return version ? `CTD version ${version}` : "Nouvelle version du CTD";
  return KIND_LABELS[kind];
}

/**
 * Le libellé du PROCHAIN cycle de réserves : « Réserves ANPP n », où n compte les cycles déjà
 * dans la frise. C'est ce numéro qui permet, un an plus tard, de dire de quelles réserves une
 * réponse est la réponse.
 */
export function nextReservesLabel(steps: readonly { kind: DossierStepKind }[]): string {
  const cycles = steps.filter((s) => s.kind === "ANPP_RESERVES").length;
  return `Réserves ANPP ${cycles + 1}`;
}

/**
 * Ce qui manque pour qu'une étape soit créable. Renvoie le motif EXACT : « formulaire
 * incomplet » n'apprend à personne quelle case remplir.
 */
export function validateStep(input: { kind: DossierStepKind; label: string; version?: number | null }): string | null {
  if (input.kind === "CTD_INITIAL") {
    return "Le CTD initial ne s'ajoute pas à la frise : il se dépose sur l'étape 1 du processus (« Réception du CTD complet »).";
  }
  if (!ADDABLE_KINDS.includes(input.kind)) return "Type d'étape inconnu.";
  if (!input.label.trim()) return "Donnez un nom à cette étape — c'est lui qu'on relira dans un an.";
  if (input.kind === "CTD_VERSION") {
    if (input.version == null) return "Indiquez le numéro de version du CTD (2, 3, …).";
    if (!Number.isInteger(input.version) || input.version < 1) return "Le numéro de version doit être un entier positif.";
  }
  return null;
}

/**
 * LE RANG D'UNE INSERTION « juste après cette étape », et le décalage qu'elle impose.
 *
 * Renvoie le rang de la nouvelle étape et la liste de celles à décaler. Sans `afterId`, on
 * ajoute à la FIN — le cas courant : le dossier avance, on note ce qui vient d'arriver.
 */
export function planInsertion(
  steps: readonly TimelineStep[],
  afterId: string | null,
): { order: number; shift: { id: string; order: number }[] } {
  const tries = [...steps].sort((a, b) => a.order - b.order);
  if (!afterId) {
    const last = tries.length ? tries[tries.length - 1].order : -1;
    return { order: last + 1, shift: [] };
  }
  const idx = tries.findIndex((s) => s.id === afterId);
  if (idx < 0) {
    // Étape de référence disparue (supprimée dans un autre onglet) : on ajoute à la fin plutôt
    // que d'échouer — perdre la place exacte est moins grave que perdre la saisie.
    const last = tries.length ? tries[tries.length - 1].order : -1;
    return { order: last + 1, shift: [] };
  }
  const order = tries[idx].order + 1;
  const shift = tries.slice(idx + 1).map((s) => ({ id: s.id, order: s.order + 1 }));
  return { order, shift };
}

/**
 * Une étape est-elle supprimable ? Le CTD initial, non — c'est l'origine. Une étape qui PORTE
 * des pièces non plus : ce sont de vrais fichiers, et les effacer en cascade depuis un bouton
 * « supprimer l'étape » ferait disparaître des documents que personne ne cherchait à jeter.
 */
export function canRemove(
  step: { kind: DossierStepKind },
  attachmentCount: number,
): { ok: boolean; reason?: string } {
  if (step.kind === "CTD_INITIAL") {
    // Les frises HISTORIQUES se sont ouvertes sur lui : on ne réécrit pas leur origine.
    return { ok: false, reason: "Le CTD initial est l'origine historique de cette frise : il ne se supprime pas." };
  }
  if (attachmentCount > 0) {
    return {
      ok: false,
      reason: `Cette étape porte ${attachmentCount} pièce${attachmentCount > 1 ? "s" : ""} : retirez-les d'abord — supprimer l'étape ne doit pas effacer des documents en silence.`,
    };
  }
  return { ok: true };
}

/** La frise, dans l'ordre — l'unique tri qui fasse foi côté écran comme côté serveur. */
export function orderSteps<T extends { order: number }>(steps: readonly T[]): T[] {
  return [...steps].sort((a, b) => a.order - b.order);
}

/**
 * Le résumé d'une étape, tel qu'il part au journal d'audit. Il doit se lire SEUL, des mois plus
 * tard, sans avoir à rouvrir le dossier : type, nom, et le numéro de version s'il y en a un.
 */
export function describeStep(step: { kind: DossierStepKind; label: string; version?: number | null }): string {
  const type = KIND_LABELS[step.kind] ?? step.kind;
  const v = step.kind === "CTD_VERSION" && step.version ? ` v${step.version}` : "";
  return `${type}${v} — ${step.label}`;
}

/**
 * L'état d'avancement en une ligne : combien de cycles, et où l'on en est. Un dossier qui en
 * est à sa troisième réponse ne se raconte pas comme un dossier déposé la semaine dernière.
 */
export function summarize(steps: readonly TimelineStep[]): string {
  if (steps.length === 0) return "Frise vide — commencez par les premières réserves (Réserves ANPP 1).";
  const cycles = steps.filter((s) => s.kind === "ANPP_RESERVES").length;
  const versions = steps.filter((s) => s.kind === "CTD_VERSION").length;
  const parts = [`${steps.length} étape${steps.length > 1 ? "s" : ""}`];
  if (cycles > 0) parts.push(`${cycles} cycle${cycles > 1 ? "s" : ""} de réserves`);
  if (versions > 0) parts.push(`${versions} version${versions > 1 ? "s" : ""} redéposée${versions > 1 ? "s" : ""}`);
  return parts.join(" · ");
}
