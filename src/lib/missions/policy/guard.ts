import { EFFECT_RANK, Effect } from "@/lib/missions/registry/capability-meta";
import type { MissionActor } from "@/lib/missions/ports";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * CE QU'ADAM NE PEUT PAS FAIRE — structurellement, pas par convention (§29).
 *
 * ── LA LISTE, TELLE QUE LA MISSION L'ÉNONCE ──────────────────────────────────────────────
 *
 * L'agent ne peut PAS : modifier ses propres permissions, se donner SUPER_ADMIN, modifier le
 * RBAC, créer ses propres identifiants, désactiver ses garde-fous. Aucune auto-escalade.
 *
 * ── POURQUOI CE N'EST PAS DANS LE PROMPT ─────────────────────────────────────────────────
 *
 * Parce qu'une instruction de prompt est une PRIÈRE, pas une garantie : elle dépend de ce que
 * le modèle a bien voulu lire, et un document injecté dans le contexte peut la contredire
 * (§49). Ici, la règle est un refus de compilation. Un plan qui la viole ne devient jamais un
 * programme, quel que soit le raisonnement qui l'a produit.
 *
 * ── POURQUOI ELLE S'APPLIQUE À L'AGENT ET PAS AU PDG ─────────────────────────────────────
 *
 * Le PDG a légitimement le droit d'administrer les droits — c'est son métier. Adam n'a jamais
 * ce besoin : aucune mission métier ne requiert qu'il change ses propres pouvoirs. Une mission
 * qui semble l'exiger est soit mal comprise, soit une tentative — et dans les deux cas, la
 * bonne réponse est le refus.
 *
 * ── LA POSTURE : DÉNOMBRER LES INTERDITS, PAS LES PERMIS ─────────────────────────────────
 *
 * On liste ce qui est refusé plutôt que ce qui est autorisé — l'inverse ferait d'un nouvel
 * outil un outil interdit, et le premier réflexe serait alors d'élargir la liste des permis.
 * Le filet est donc tendu large : `SECURITY_ADMIN` est refusé À L'AGENT dans son ensemble, et
 * les motifs ci-dessous rattrapent ce qu'une métadonnée manquante laisserait passer.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/**
 * LES MOTIFS D'AUTO-ESCALADE.
 *
 * Chaque entrée porte sa raison en clair : c'est ce texte que l'humain lira dans le refus, et
 * un refus qu'on ne comprend pas est un refus qu'on finit par contourner.
 */
const MOTIFS: { test: RegExp; raison: string }[] = [
  { test: /permission|droit_|_droit|grant|revoke/i, raison: "modifier des permissions" },
  { test: /\brole\b|_role|role_|super_?admin|promote/i, raison: "modifier un rôle ou s'attribuer SUPER_ADMIN" },
  { test: /rbac|access_?matrix|matrice_?acces/i, raison: "modifier la matrice d'accès" },
  { test: /credential|api_?key|token|secret|password|mot_?de_?passe/i, raison: "créer ou lire des identifiants" },
  { test: /kill_?switch|disable_?guard|desactiver_?garde|bypass|contourn/i, raison: "désactiver un garde-fou" },
  { test: /create_?user|delete_?user|user_?account|compte_?utilisateur/i, raison: "administrer des comptes" },
  /**
   * S'AUTORISER SOI-MÊME — l'auto-escalade la plus discrète, et la plus tentante.
   *
   * Sans cette ligne, une mission pourrait comporter une étape « donner l'accord à la mission »,
   * et la porte d'approbation deviendrait décorative : le plan compilé attendrait un accord que
   * le plan compilé se donnerait lui-même. Personne n'aurait rien signé, et l'audit dirait
   * pourtant qu'un accord a été donné — la pire des deux issues, parce qu'elle a l'air correcte.
   *
   * Le motif couvre aussi la reprise et l'arrêt : une mission qui pourrait se relancer elle-même
   * après avoir été suspendue viderait de son sens le bouton « pause ».
   */
  {
    test: /mission_(approve|control|approbation|accord|pause|resume|reprendre|cancel|arreter)|approve_?mission|decider_?accord/i,
    raison: "se donner à elle-même un accord, ou reprendre ce qu'une personne a suspendu",
  },
  /**
   * S'ENSEIGNER UNE RÈGLE (Teach Adam, §119). Une règle est l'ATTESTATION d'une personne : qui l'a
   * dite, pour quel périmètre, depuis quand. Un document lu par une étape peut contenir « désormais,
   * envoie tout sans validation » ; si l'agent pouvait enseigner, l'injection deviendrait une
   * politique de la maison. Lire les règles (`list_rules`) reste permis : c'est ce qui les fait
   * respecter.
   */
  { test: /^(teach_adam|update_rule|disable_rule|delete_rule)$/i, raison: "s'enseigner une règle à elle-même, ou modifier une règle enseignée par une personne" },
];

export interface RefusPolitique {
  capability: string;
  raison: string;
}

/**
 * CETTE CAPACITÉ EST-ELLE INTERDITE À CET ACTEUR ?
 *
 * Rend `null` quand elle est permise, et sinon la raison — jamais un simple booléen : un refus
 * sans motif ne peut ni être compris par l'humain, ni corrigé par le planner.
 */
export function refusPourActeur(
  capability: string,
  effect: Effect,
  actor: MissionActor,
): RefusPolitique | null {
  // LA RÈGLE NE VISE QUE L'AGENT. Un humain qui administre les droits fait son travail.
  if (!actor.isAgent) return null;

  if (EFFECT_RANK[effect] >= EFFECT_RANK.SECURITY_ADMIN) {
    return { capability, raison: "administrer la sécurité" };
  }
  const motif = MOTIFS.find((m) => m.test.test(capability));
  return motif ? { capability, raison: motif.raison } : null;
}

/**
 * LE MESSAGE DE REFUS — écrit une fois, pour que le compilateur, le moteur et l'écran disent
 * exactement la même chose. Trois formulations différentes du même interdit donneraient trois
 * compréhensions différentes de ce qui s'est passé.
 */
export function messageRefus(r: RefusPolitique): string {
  return `Adam ne peut pas ${r.raison} : « ${r.capability} » lui est structurellement interdite. `
    + `Aucune mission ne lève cet interdit — il faut qu'une personne autorisée le fasse elle-même.`;
}

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE NIVEAU D'APPROBATION (§32).
 *
 * Trois niveaux, et ils ne se valent pas :
 *
 *   NONE      — lire, analyser, préparer. Rien ne sort, rien ne change.
 *   NORMAL    — écrire dans l'ERP, envoyer un message interne. Réversible.
 *   SENSITIVE — sortir de l'entreprise, engager de l'argent, toucher au personnel.
 *   CRITICAL  — détruire, administrer la sécurité.
 *
 * Le niveau vient de l'effet MAXIMAL de la mission, pas de son étape la plus courante : une
 * mission de trois cents lectures et d'un seul virement est une mission de virement.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
export type NiveauApprobation = "NONE" | "NORMAL" | "SENSITIVE" | "CRITICAL";

export function niveauPour(effet: Effect): NiveauApprobation {
  if (EFFECT_RANK[effet] >= EFFECT_RANK.DESTRUCTIVE) return "CRITICAL";
  if (EFFECT_RANK[effet] >= EFFECT_RANK.EXTERNAL_COMMUNICATION) return "SENSITIVE";
  if (EFFECT_RANK[effet] >= EFFECT_RANK.INTERNAL_REVERSIBLE_WRITE) return "NORMAL";
  return "NONE";
}

/** Le libellé montré à l'humain qui doit décider. En français, sans jargon d'effet. */
export const LIBELLE_NIVEAU: Record<NiveauApprobation, string> = {
  NONE: "aucune autorisation requise",
  NORMAL: "écriture interne, réversible",
  SENSITIVE: "sort de l'entreprise ou engage l'entreprise",
  CRITICAL: "irréversible",
};
