import type { AdProItemKind, AdProItemOrderStage, AdProItemStatus } from "@prisma/client";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * OÙ EN EST UN POSTE, ET QUEL EST LE GESTE SUIVANT (§118.175) — lu en UNE fois, pour l'écran.
 *
 * « Ici c'est trop complexe : plus simple, plus séparé, plus lisible, moins de boutons et de CTA
 * partout » (Direction, 01/10). Un poste affichait jusqu'à neuf commandes à la fois — deux
 * demandes au secrétariat, une pièce, une validation, les pièces jointes, soumettre, émettre,
 * retirer, modifier —, dont plusieurs DÉSACTIVÉES avec leur raison collée à côté (« L'opération
 * n'a pas encore été accordée » sous un poste encore en brouillon). La personne lisait tout pour
 * trouver la seule chose qu'elle pouvait faire.
 *
 * La règle tient ici, PURE (aucun import de valeur) : la frise d'un poste — chiffré → Direction →
 * budget → bon de commande → paiement — et, pour la personne qui regarde, LE geste suivant, ou ce
 * qu'on attend et de qui. L'écran n'invente rien : il affiche ce que cette fonction rend. Les
 * gestes secondaires (modifier, pièces, demandes au secrétariat, historique, retirer) vivent dans
 * un menu : ils ne disparaissent pas, ils cessent de crier.
 *
 * ── L'ORDRE DES QUESTIONS EST LE CYCLE ──────────────────────────────────────────────────────
 *
 * On ne propose pas de choisir un budget avant l'accord, ni de demander un bon de commande sans
 * budget, ni d'émettre un ordre de dépense sur une opération que personne n'a accordée. Chaque
 * « geste » rendu ici est un geste que l'action serveur ACCEPTERA dans cet état : un bouton
 * qu'une action refuse n'est pas un bouton (§118.83). Les gardes restent dans les actions ; ce
 * module ne dit que ce qui a un sens à proposer — un banc rejoue chaque geste rendu par la VRAIE
 * action et exige qu'elle l'accepte.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

export type CleEtape = "CHIFFRE" | "DIRECTION" | "BUDGET" | "BC" | "PAIEMENT";
export type EtatEtape = "FAIT" | "EN_COURS" | "A_VENIR" | "REFUSE";

export interface Etape {
  cle: CleEtape;
  libelle: string;
  etat: EtatEtape;
}

/** Ce qu'un poste porte — les colonnes qui décident de son étape. */
export interface FaitsPoste {
  kind: AdProItemKind;
  status: AdProItemStatus;
  amountEstimated: number | null;
  amountGranted: number | null;
  budgetCategoryId: string | null;
  orderStage: AdProItemOrderStage;
  expenseOrderId: string | null;
  /** Le statut de l'ordre de dépense (« PAID » = réglé). */
  expenseOrderStatus: string | null;
  /** Combien d'articles du magasin un poste « Matériel du stock » liste (§118.167). */
  lignesStock: number;
  /**
   * Le BC est passé aux Finances SOUS le seuil, sans visa d'aucun centre (§118.149). Il porte le
   * même `DIRECTION_OK` qu'un BC visé — et la phrase ne doit pas dire « validé » à sa place.
   */
  orderSansCentre?: boolean;
}

/** Ce que la personne qui regarde peut faire — calculé au serveur, jamais deviné ici. */
export interface RegardPoste {
  /** Décrire, chiffrer, soumettre, répartir, demander le BC. */
  canEdit: boolean;
  /** Décider du poste, choisir son budget (la Direction). */
  canAllocate: boolean;
  /** Viser un bon de commande (siège au centre de validation Ad & Pro). */
  canViserBC: boolean;
  /** Émettre (les Finances, ou la Direction pour un versement sans BC — `emitItemExpenseOrder`). */
  canEmettre: boolean;
  /** Demande clôturée : on n'arbitre plus, on exécute encore (§118.151). */
  fige: boolean;
  /** L'opération est accordée — sans quoi aucun ordre de dépense ne part (`canEmitOrder`). */
  operationDecidee: boolean;
}

export type CleGeste =
  | "REPARTIR" | "CHIFFRER" | "SOUMETTRE" | "DECIDER" | "MONTANT" | "BUDGET"
  | "DEMANDER_BC" | "VISER_BC" | "EMETTRE_BC" | "EMETTRE_DIRECT";

export interface Geste {
  cle: CleGeste;
  libelle: string;
}

export interface ProchainPas {
  /** Le geste que CETTE personne peut faire maintenant — un seul. */
  geste: Geste | null;
  /** Sinon : ce qu'on attend, et de qui. `null` quand le poste est arrivé au bout. */
  attente: string | null;
}

/**
 * LES FAITS D'UN POSTE TELS QUE LE CHARGEUR LES REND — une seule traduction, lue par l'écran ET par
 * le banc qui rejoue chaque geste proposé (§118.5). Recopiée dans le banc, elle aurait pu diverger
 * de celle de l'écran, et le banc aurait vérifié un geste que l'écran ne propose pas (§118.120).
 */
export function faitsDuPoste(r: {
  kind: AdProItemKind;
  status: AdProItemStatus;
  amountEstimated: number | null;
  amountGranted: number | null;
  budgetCategoryId: string | null;
  orderStage: AdProItemOrderStage;
  expenseOrderId: string | null;
  expenseOrder: { status: string } | null;
  lignesStock: readonly unknown[];
  orderSansCentre?: boolean;
}): FaitsPoste {
  return {
    kind: r.kind, status: r.status, amountEstimated: r.amountEstimated, amountGranted: r.amountGranted,
    budgetCategoryId: r.budgetCategoryId, orderStage: r.orderStage, expenseOrderId: r.expenseOrderId,
    expenseOrderStatus: r.expenseOrder?.status ?? null, lignesStock: r.lignesStock.length, orderSansCentre: r.orderSansCentre,
  };
}

/** Les statuts où le demandeur reprend la main : décrire, chiffrer, (re)soumettre. */
export const STATUTS_EDITABLES: readonly AdProItemStatus[] = ["DRAFT", "REVISION", "REJECTED"];

const positif = (m: number | null | undefined): boolean => typeof m === "number" && Number.isFinite(m) && m > 0;
const chiffre = (p: FaitsPoste) => positif(p.amountGranted ?? p.amountEstimated);

/**
 * Un poste dont l'argent part SANS bon de commande : le versement à l'association d'un
 * sponsoring direct (§118.151). Les autres paient un fournisseur, donc passent par un BC.
 */
export const VERSEMENT_SANS_BC: readonly AdProItemKind[] = ["ASSOCIATION_SUPPORT"];

/** La frise d'un poste d'argent. Un poste « Matériel du stock » n'en a pas : il a son propre bloc. */
export function etapesDuPoste(p: FaitsPoste): Etape[] {
  if (p.kind === "STOCK_MATERIAL") return [];
  const accorde = p.status === "APPROVED";
  const paye = p.expenseOrderStatus === "PAID";
  const sansBC = VERSEMENT_SANS_BC.includes(p.kind);
  const etapes: Etape[] = [
    { cle: "CHIFFRE", libelle: "Chiffré", etat: chiffre(p) ? "FAIT" : "EN_COURS" },
    {
      cle: "DIRECTION", libelle: "Direction",
      etat: accorde ? "FAIT"
        : p.status === "REJECTED" ? "REFUSE"
        : p.status === "PENDING" ? "EN_COURS"
        : "A_VENIR",
    },
    { cle: "BUDGET", libelle: "Budget", etat: p.budgetCategoryId ? "FAIT" : accorde ? "EN_COURS" : "A_VENIR" },
  ];
  // Un versement sans BC qui en a quand même un (poste d'avant cette règle, ou BC demandé à la
  // main) MONTRE son BC : taire une étape qui a eu lieu ferait mentir la frise.
  if (!sansBC || p.orderStage !== "NONE") {
    etapes.push({
      cle: "BC", libelle: "Bon de commande",
      etat: p.orderStage === "ISSUED" || p.expenseOrderId ? "FAIT"
        : p.orderStage === "REFUSED" ? "REFUSE"
        : p.orderStage === "REQUESTED" || p.orderStage === "DIRECTION_OK" ? "EN_COURS"
        : accorde && p.budgetCategoryId ? "EN_COURS" : "A_VENIR",
    });
  }
  etapes.push({
    cle: "PAIEMENT", libelle: "Paiement",
    etat: paye ? "FAIT" : p.expenseOrderId ? "EN_COURS" : sansBC && accorde && p.budgetCategoryId ? "EN_COURS" : "A_VENIR",
  });
  return etapes;
}

/**
 * LE PROCHAIN GESTE — un seul, celui de la personne qui regarde ; sinon ce qu'on attend.
 *
 * Fonction PURE — testée. Chaque branche rend soit un geste que l'action acceptera, soit une
 * phrase qui nomme QUI on attend : « en attente » sans sujet fait chercher.
 */
export function prochainPas(p: FaitsPoste, r: RegardPoste): ProchainPas {
  const editer = r.canEdit && !r.fige;
  const arbitrer = r.canAllocate && !r.fige;

  // LE MATÉRIEL DU STOCK (§118.167) suit le même ACCORD que l'argent — soumettre, décider —, mais
  // pas sa suite : il n'a ni budget, ni bon de commande, ni paiement. Une fois accordé, c'est son
  // propre bloc qui le confirme après l'événement.
  if (p.kind === "STOCK_MATERIAL") {
    if (STATUTS_EDITABLES.includes(p.status)) {
      if (!editer) return { geste: null, attente: "Le demandeur liste le matériel du magasin et le soumet à la Direction." };
      return p.lignesStock > 0
        ? { geste: { cle: "SOUMETTRE", libelle: p.status === "DRAFT" ? "Soumettre à la Direction" : "Resoumettre à la Direction" }, attente: null }
        : { geste: null, attente: "Ajoutez au moins un article du magasin pour soumettre ce poste." };
    }
    if (p.status === "PENDING") {
      return arbitrer
        ? { geste: { cle: "DECIDER", libelle: "Décider de ce poste" }, attente: null }
        : { geste: null, attente: "En attente de la décision de la Direction." };
    }
    return { geste: null, attente: null };
  }

  // UN SPONSORING INDIRECT NON RÉPARTI : sa ou ses natures ne sont pas dites (§118.175). Tant
  // qu'il ne l'est pas, il ne se soumet pas (`canSubmitItem`) — le seul geste utile est celui-là.
  if (p.kind === "INDIRECT_SUPPORT" && STATUTS_EDITABLES.includes(p.status)) {
    return editer
      ? { geste: { cle: "REPARTIR", libelle: "Répartir par nature" }, attente: null }
      : { geste: null, attente: "Le demandeur doit répartir ce sponsoring indirect par nature (imprimerie, hôtellerie…)." };
  }

  if (STATUTS_EDITABLES.includes(p.status)) {
    if (!editer) {
      return {
        geste: null,
        attente: p.status === "REVISION" ? "Budget à revoir par le demandeur."
          : p.status === "REJECTED" ? "Refusé par la Direction — le demandeur peut le corriger et le resoumettre."
          : "Brouillon — le demandeur le chiffre et le soumet à la Direction.",
      };
    }
    if (!chiffre(p)) return { geste: { cle: "CHIFFRER", libelle: "Chiffrer le poste" }, attente: null };
    return { geste: { cle: "SOUMETTRE", libelle: p.status === "DRAFT" ? "Soumettre à la Direction" : "Resoumettre à la Direction" }, attente: null };
  }

  if (p.status === "PENDING") {
    return arbitrer
      ? { geste: { cle: "DECIDER", libelle: "Décider de ce poste" }, attente: null }
      : { geste: null, attente: "En attente de la décision de la Direction." };
  }

  // ── ACCORDÉ ────────────────────────────────────────────────────────────────────────────
  if (p.expenseOrderId) {
    return { geste: null, attente: p.expenseOrderStatus === "PAID" ? null : "Ordre de dépense émis — au centre de paiement." };
  }
  if (p.orderStage === "ISSUED") return { geste: null, attente: null };
  if (p.orderStage === "REQUESTED") {
    return r.canViserBC
      ? { geste: { cle: "VISER_BC", libelle: "Valider le bon de commande" }, attente: null }
      : { geste: null, attente: "Bon de commande au centre de validation Ad & Pro." };
  }
  if (p.orderStage === "DIRECTION_OK") {
    return r.canEmettre
      ? { geste: { cle: "EMETTRE_BC", libelle: "Émettre le bon de commande" }, attente: null }
      : { geste: null, attente: p.orderSansCentre ? "BC sous le seuil — en attente des Finances." : "Bon de commande validé — en attente des Finances." };
  }
  if (!positif(p.amountGranted)) {
    return arbitrer
      ? { geste: { cle: "MONTANT", libelle: "Affecter le montant accordé" }, attente: null }
      : { geste: null, attente: "La Direction affecte le montant accordé à ce poste." };
  }
  if (!p.budgetCategoryId) {
    return arbitrer
      ? { geste: { cle: "BUDGET", libelle: "Choisir le budget" }, attente: null }
      : { geste: null, attente: "La Direction choisit le budget qui porte ce poste." };
  }
  if (VERSEMENT_SANS_BC.includes(p.kind)) {
    if (!r.operationDecidee) return { geste: null, attente: "L'ordre de dépense partira quand l'opération sera accordée." };
    return r.canEmettre
      ? { geste: { cle: "EMETTRE_DIRECT", libelle: "Émettre l'ordre de dépense" }, attente: null }
      : { geste: null, attente: "Les Finances émettent l'ordre de dépense." };
  }
  // Bon de commande à demander (ou à redemander après un refus du centre). Cette demande reste un
  // geste d'EXÉCUTION : elle s'offre encore sur une demande clôturée (§118.151).
  return r.canEdit
    ? { geste: { cle: "DEMANDER_BC", libelle: p.orderStage === "REFUSED" ? "Redemander l'émission du BC" : "Demander l'émission du BC" }, attente: null }
    : { geste: null, attente: "Le demandeur demande l'émission du bon de commande." };
}

/**
 * LES POSTES REGROUPÉS PAR RÉPARTITION — dans l'ordre où ils apparaissent. Un poste né d'une
 * répartition rejoint le groupe de ses frères, même si d'autres postes ont été ajoutés entre eux :
 * l'écran montre « Sponsoring indirect — total — n natures » d'un seul tenant.
 */
export function grouperParRepartition<T extends { id: string; repartitionId: string | null }>(
  items: readonly T[],
): { cle: string; repartitionId: string | null; items: T[] }[] {
  const groupes: { cle: string; repartitionId: string | null; items: T[] }[] = [];
  const parRepartition = new Map<string, { cle: string; repartitionId: string | null; items: T[] }>();
  for (const it of items) {
    if (!it.repartitionId) {
      groupes.push({ cle: it.id, repartitionId: null, items: [it] });
      continue;
    }
    const g = parRepartition.get(it.repartitionId);
    if (g) {
      g.items.push(it);
      continue;
    }
    const neuf = { cle: `rep:${it.repartitionId}`, repartitionId: it.repartitionId, items: [it] };
    parRepartition.set(it.repartitionId, neuf);
    groupes.push(neuf);
  }
  return groupes;
}
