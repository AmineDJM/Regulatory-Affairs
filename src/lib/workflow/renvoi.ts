/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * RENVOYER POUR CORRECTION, PUIS RESOUMETTRE — les règles PURES du moteur Ad & Pro
 * (audit 360°, rapport 17 : R02, R03, R15 — CLAUDE.md §118.186).
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────────────────
 *
 * « La plateforme sait refuser, rarement faire corriger. » Une étape ne connaissait que
 * approuver, refuser, sauter, commenter : pour un montant mal tapé ou une pièce manquante, le
 * validateur avait le choix entre laisser passer une demande fausse et la tuer. Le circuit clos
 * refusait ensuite tout geste, et le demandeur ne voyait même pas le motif.
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────────────────
 *
 *   • RENVOYER est un refus ADOUCI : qui peut refuser à une étape peut renvoyer pour correction —
 *     aucun pouvoir neuf à configurer, et aucune étape qui pouvait trancher ne perd ce geste.
 *   • Le motif est OBLIGATOIRE et le demandeur le LIT : c'est ce qu'il doit corriger.
 *   • Le demandeur corrige, puis RESOUMET — autant de fois qu'il faut. La demande revient à
 *     l'étape qui l'a renvoyée : la personne qui a demandé la correction juge la correction.
 *   • SAUF si la correction a fait monter le montant au-dessus d'une porte franchie sous le
 *     seuil : la porte se ROUVRE (R15). Une porte du DG franchie à 600 000 DZD ne doit pas rester
 *     franchie pour une demande devenue 1 200 000.
 *
 * Ce module ne lit RIEN : le moteur lui donne les faits, il rend la décision. Il est testé sans
 * base, et c'est ce qui permet de l'éprouver sur tous les cas limites à la fois.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/** Ce que ces règles savent d'une étape — l'essentiel de `WorkflowStep`. */
export interface EtapeCircuit {
  slug: string;
  title: string;
  position: number;
  legacyStatus: string | null;
}

/**
 * LES TROIS GARDES DU RENVOI — lues par le moteur, éprouvées sans base.
 *
 *   • ouvert là où le REFUS l'est : qui peut trancher contre peut demander une correction, et
 *     aucune étape n'y gagne un pouvoir que sa configuration ne lui donnait pas ;
 *   • le motif est OBLIGATOIRE : un renvoi sans motif est une devinette adressée au demandeur ;
 *   • il faut un DEMANDEUR : sans lui, personne ne corrigerait, et la demande attendrait toujours.
 *
 * Rend la phrase du refus, `null` quand le renvoi peut partir.
 */
export function refusDuRenvoi(f: { pouvoirs: readonly string[]; motif: string | null; demandeurId: string | null }): string | null {
  if (!f.pouvoirs.includes("REJECT")) return "Le renvoi pour correction n'est pas ouvert à cette étape : elle ne peut pas refuser.";
  if (!f.motif) return "Le motif du renvoi est obligatoire : c'est ce que le demandeur devra corriger.";
  if (!f.demandeurId) return "Cette demande n'a pas de demandeur à qui la renvoyer : approuvez-la ou refusez-la.";
  return null;
}

/**
 * QUI RESOUMET : le demandeur, ou la vue globale (Direction, Directeur des opérations, Super
 * Admin) qui garde la main sur toute demande — comme pour la corriger (`canEditAdProRequest`).
 *
 * Personne d'autre, et c'est la moitié de la règle : un validateur qui « resoumettrait » à la
 * place du demandeur ferait revenir à sa propre étape une demande que personne n'a corrigée.
 */
export function peutResoumettre(qui: { id: string; vueGlobale: boolean }, demandeurId: string | null): boolean {
  if (qui.vueGlobale) return true;
  return demandeurId !== null && demandeurId === qui.id;
}

/**
 * OÙ LA DEMANDE REPREND après une correction.
 *
 * L'étape qui l'a renvoyée, par défaut. Mais on parcourt d'abord la ROUTE de la demande jusqu'à
 * cette étape : la première porte qui avait été franchie AUTOMATIQUEMENT par le montant et ne le
 * serait plus avec le montant corrigé rouvre — et c'est là que la demande reprend.
 *
 * Seules les portes franchies PAR LE MONTANT comptent (`franchiesParMontant`, lues dans
 * l'historique) : une étape approuvée par une personne a jugé la demande, la correction lui
 * revient par la notification, pas par un retour en arrière. Une étape HORS ROUTE (le tamis du
 * parcours) n'est jamais une reprise — on ne fait pas traverser à une demande une étape que son
 * parcours ne traverse pas.
 */
export function etapeDeReprise<E extends EtapeCircuit>(
  etapesOrdonnees: readonly E[],
  retour: E,
  franchiesParMontant: ReadonlySet<string>,
  resteFranchissable: (etape: E) => boolean,
  ignorees: readonly string[],
): E {
  for (const etape of etapesOrdonnees) {
    if (etape.position >= retour.position) break;
    if (ignorees.includes(etape.slug)) continue;
    if (franchiesParMontant.has(etape.slug) && !resteFranchissable(etape)) return etape;
  }
  return retour;
}

/**
 * LE STATUT « LEGACY » QUE PORTE UNE DEMANDE ARRÊTÉE À CETTE ÉTAPE.
 *
 * Le moteur projette sur l'entité le statut de l'étape où elle arrive, et GARDE le précédent
 * quand l'étape n'en déclare pas (`projectApprove`). Le statut d'une demande posée à l'étape X
 * est donc celui de la dernière étape de sa route, jusqu'à X incluse, qui en déclare un. Sans ce
 * calcul, une demande resoumise sur une étape sans statut propre resterait affichée « À corriger »
 * alors qu'elle attend de nouveau un validateur.
 */
export function statutLegacyALEtape<E extends EtapeCircuit>(
  etapesOrdonnees: readonly E[],
  etape: E,
  ignorees: readonly string[],
  statutDEntree: string,
): string {
  let statut: string | null = null;
  for (const e of etapesOrdonnees) {
    if (e.position > etape.position) break;
    if (ignorees.includes(e.slug) && e.slug !== etape.slug) continue;
    if (e.legacyStatus) statut = e.legacyStatus;
  }
  return statut ?? statutDEntree;
}

/** Une ligne d'historique, telle que la vue la reçoit. */
export interface LigneHistorique {
  action: string;
  stepTitle: string;
  actorName: string | null;
  note: string | null;
  createdAt: Date;
}

/** Le motif que le demandeur doit pouvoir lire. */
export interface MotifVisible {
  nature: "RENVOI" | "REFUS";
  etape: string;
  auteur: string | null;
  motif: string | null;
  le: string;
}

/**
 * LE MOTIF QUE LE DEMANDEUR LIT (R03) — le renvoi qui l'attend, ou le refus qui l'a clos.
 *
 * L'historique est réservé aux spectateurs « privilégiés », et c'était juste pour les AVIS en
 * cours d'arbitrage (une étape confidentielle propose, elle ne décide pas). Un renvoi n'est pas
 * un avis : il est ADRESSÉ au demandeur — le lui cacher, c'est lui demander de corriger sans lui
 * dire quoi. Un refus définitif non plus : c'est une décision, et une décision illisible n'en est
 * pas une. Les avis défavorables intermédiaires, eux, restent où ils étaient.
 *
 * `null` quand la demande n'est ni à corriger ni refusée : un vieux motif de refus ne s'affiche
 * pas au-dessus d'une demande relancée.
 */
export function motifVisible(statutInstance: string, historique: readonly LigneHistorique[]): MotifVisible | null {
  const action = statutInstance === "RETURNED" ? "RETURN" : statutInstance === "REJECTED" ? "REJECT" : null;
  if (!action) return null;
  const ligne = [...historique].reverse().find((e) => e.action === action);
  if (!ligne) return null;
  return {
    nature: action === "RETURN" ? "RENVOI" : "REFUS",
    etape: ligne.stepTitle,
    auteur: ligne.actorName,
    motif: ligne.note,
    le: ligne.createdAt.toISOString(),
  };
}

/** Les gestes d'historique qui comptent comme un AVIS rendu par une personne. */
const AVIS_HUMAINS = new Set(["APPROVE", "OPINION_AGAINST", "SKIP", "RETURN", "REJECT"]);

/**
 * QUI A DÉJÀ DONNÉ UN AVIS — ceux qu'une modification après coup doit prévenir (R15).
 *
 * Une correction faite APRÈS un premier avis ne rouvrait rien et ne prévenait personne : la
 * personne qui avait approuvé 200 000 DZD n'apprenait jamais qu'on en demandait désormais 400 000.
 * Les franchissements AUTOMATIQUES n'en sont pas (personne n'a regardé), le demandeur non plus.
 */
export function auteursDAvis(
  historique: readonly { action: string; actorId: string | null }[],
  sauf: readonly (string | null)[],
): string[] {
  const exclus = new Set(sauf.filter((x): x is string => Boolean(x)));
  const vus = new Set<string>();
  for (const e of historique) {
    if (!AVIS_HUMAINS.has(e.action) || !e.actorId || exclus.has(e.actorId)) continue;
    vus.add(e.actorId);
  }
  return [...vus];
}
