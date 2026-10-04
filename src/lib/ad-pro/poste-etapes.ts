import type { AdProItemKind, AdProItemOrderStage, AdProItemStatus } from "@prisma/client";
import type { EtapeBC } from "@/lib/bons-de-commande/regle";
import type { DroitsValidation } from "@/lib/ad-pro/validation-poste";

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

export type CleEtape = "CHIFFRE" | "OPERATIONS" | "MARKETING" | "BC" | "FACTURE" | "PAIEMENT";
export type EtatEtape = "FAIT" | "EN_COURS" | "A_VENIR" | "REFUSE";

export interface Etape {
  cle: CleEtape;
  libelle: string;
  etat: EtatEtape;
}

/**
 * OÙ EN EST LA DEMANDE DE BC CHEZ L'ASSISTANTE (§118.204) — la demande de pièce qu'elle a reçue.
 * `CHEZ_ASSISTANTE` : elle l'établit ; `DEPOSE` : elle l'a déposé, le demandeur le vérifie.
 */
export type EtatDemandeBC = "AUCUNE" | "CHEZ_ASSISTANTE" | "DEPOSE";

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
   * Le BC est passé SOUS le seuil, sans visa d'aucun centre (§118.149). Il porte le même
   * `DIRECTION_OK` qu'un BC visé — et la phrase ne doit pas dire « validé » à sa place.
   */
  orderSansCentre?: boolean;
  /** Le premier temps de la validation (Direction des opérations), §118.204. */
  opsDecidedAt?: string | null;
  /** La demande de pièce « bon de commande » envoyée à l'assistante, §118.204. */
  demandeBC?: EtatDemandeBC;
  /** L'étape du bon de commande du poste au registre Legal (signature des Finances), ou `null`. */
  bc?: EtapeBC | null;
  /** Combien de factures (non annulées) le poste porte. */
  factures?: number;
}

/** Ce que la personne qui regarde peut faire — calculé au serveur, jamais deviné ici. */
export interface RegardPoste {
  /** Décrire, chiffrer, soumettre, répartir, demander le BC, déposer la facture. */
  canEdit: boolean;
  /**
   * Arbitrer un poste « Matériel du stock » (sa décision unique), affecter un montant hors du
   * circuit, revoir une décision. Les postes d'ARGENT, eux, se valident en deux temps (`validation`).
   */
  canAllocate: boolean;
  /** Viser un bon de commande (siège au centre de validation Ad & Pro). */
  canViserBC: boolean;
  /** Annuler un ordre émis non réglé (les Finances, ou qui arbitre). */
  canEmettre: boolean;
  /** Demande clôturée : on n'arbitre plus, on exécute encore (§118.151). */
  fige: boolean;
  /** L'opération est accordée — sans quoi aucun ordre de dépense ne part (`canEmitOrder`). */
  operationDecidee: boolean;
  /** Les deux temps de la validation d'un poste d'argent (§118.204). */
  validation?: DroitsValidation;
  /** La demande a été déposée par la Direction Marketing : son second temps revient à la Direction des opérations. */
  secondTempsParOperations?: boolean;
  /** La personne qui regarde a demandé le BC : c'est elle qui vérifie la pièce déposée. */
  verifieLeBC?: boolean;
}

export type CleGeste =
  | "REPARTIR" | "CHIFFRER" | "SOUMETTRE" | "VALIDER_OPS" | "DECIDER" | "MONTANT" | "BUDGET"
  | "DEMANDER_BC" | "VISER_BC" | "VERIFIER_BC" | "DEMANDER_PAIEMENT";

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
  opsDecidedAt?: string | null;
  /** La demande de BC ouverte chez l'assistante (`DemandeBCDuPoste`), s'il y en a une. */
  demandeBC?: { etat: EtatDemandeBC } | null;
  /** La chaîne d'achat du poste (`PiecesDuPoste`). */
  pieces?: { bc: { etape: EtapeBC | null } | null; factures: readonly unknown[] };
}): FaitsPoste {
  return {
    kind: r.kind, status: r.status, amountEstimated: r.amountEstimated, amountGranted: r.amountGranted,
    budgetCategoryId: r.budgetCategoryId, orderStage: r.orderStage, expenseOrderId: r.expenseOrderId,
    expenseOrderStatus: r.expenseOrder?.status ?? null, lignesStock: r.lignesStock.length, orderSansCentre: r.orderSansCentre,
    opsDecidedAt: r.opsDecidedAt ?? null, demandeBC: r.demandeBC?.etat ?? "AUCUNE",
    bc: r.pieces?.bc ? (r.pieces.bc.etape ?? "HORS_CIRCUIT") : null, factures: r.pieces?.factures.length ?? 0,
  };
}

/** Les statuts où le demandeur reprend la main : décrire, chiffrer, (re)soumettre. */
export const STATUTS_EDITABLES: readonly AdProItemStatus[] = ["DRAFT", "REVISION", "REJECTED"];

const positif = (m: number | null | undefined): boolean => typeof m === "number" && Number.isFinite(m) && m > 0;
const chiffre = (p: FaitsPoste) => positif(p.amountGranted ?? p.amountEstimated);

/**
 * Un poste dont l'argent part SANS bon de commande : le versement à l'association d'un
 * sponsoring direct (§118.151). « Si c'est un sponsoring direct, on n'a pas besoin d'émettre un bon
 * de commande : facture pro forma facultative, facture obligatoire » (Direction, 04/10, §118.204).
 */
export const VERSEMENT_SANS_BC: readonly AdProItemKind[] = ["ASSOCIATION_SUPPORT"];

/** Le BC du poste est-il signé — la condition pour déposer la facture d'un poste qui en a un (§118.204) ? */
export const bcSigne = (p: FaitsPoste) => p.bc === "SIGNE";

/**
 * LA FRISE D'UN POSTE D'ARGENT — chiffré → Direction des opérations → Direction Marketing (budget) →
 * bon de commande → facture → paiement. Un poste « Matériel du stock » n'en a pas : il a son bloc.
 */
export function etapesDuPoste(p: FaitsPoste): Etape[] {
  if (p.kind === "STOCK_MATERIAL") return [];
  const accorde = p.status === "APPROVED";
  const opsFait = Boolean(p.opsDecidedAt) || accorde;
  const paye = p.expenseOrderStatus === "PAID";
  const sansBC = VERSEMENT_SANS_BC.includes(p.kind);
  const factures = p.factures ?? 0;
  const etapes: Etape[] = [
    { cle: "CHIFFRE", libelle: "Chiffré", etat: chiffre(p) ? "FAIT" : "EN_COURS" },
    {
      cle: "OPERATIONS", libelle: "Direction des opérations",
      etat: opsFait ? "FAIT"
        : p.status === "REJECTED" ? "REFUSE"
        : p.status === "PENDING" ? "EN_COURS"
        : "A_VENIR",
    },
    {
      cle: "MARKETING", libelle: "Direction Marketing · budget",
      etat: accorde && p.budgetCategoryId ? "FAIT"
        : p.status === "REJECTED" && p.opsDecidedAt ? "REFUSE"
        : (p.status === "PENDING" && p.opsDecidedAt) || accorde ? "EN_COURS"
        : "A_VENIR",
    },
  ];
  // Un versement sans BC qui en a quand même un (poste d'avant cette règle) MONTRE son BC : taire une
  // étape qui a eu lieu ferait mentir la frise.
  if (!sansBC || p.orderStage !== "NONE" || p.bc) {
    etapes.push({
      cle: "BC", libelle: "Bon de commande",
      etat: bcSigne(p) || (p.expenseOrderId && !p.bc) ? "FAIT"
        : p.orderStage === "REFUSED" || p.bc === "REFUSE" ? "REFUSE"
        : p.bc || p.orderStage === "REQUESTED" || p.orderStage === "DIRECTION_OK" ? "EN_COURS"
        : accorde && p.budgetCategoryId ? "EN_COURS" : "A_VENIR",
    });
  }
  const factureOuverte = accorde && p.budgetCategoryId && (sansBC ? true : bcSigne(p));
  etapes.push({
    cle: "FACTURE", libelle: "Facture",
    etat: factures > 0 ? "FAIT" : factureOuverte || p.expenseOrderId ? "EN_COURS" : "A_VENIR",
  });
  etapes.push({
    cle: "PAIEMENT", libelle: "Paiement",
    etat: paye ? "FAIT" : p.expenseOrderId ? "EN_COURS" : "A_VENIR",
  });
  return etapes;
}

/** Ce que la carte dit d'un BC au registre qui n'est pas encore signé. */
const ATTENTE_BC: Partial<Record<EtapeBC, string>> = {
  A_VALIDER: "Bon de commande au centre de validation Ad & Pro.",
  A_REVOIR: "Bon de commande à revoir au centre de validation Ad & Pro.",
  A_SIGNER: "Bon de commande à signer par les Finances.",
  A_CORRIGER: "Bon de commande renvoyé à l'émetteur par les Finances — à corriger.",
  REFUSE: "Bon de commande refusé : demandez-en un autre.",
  SANS_PORTE: "Bon de commande à adresser au centre de validation.",
};

/**
 * LE PROCHAIN GESTE — un seul, celui de la personne qui regarde ; sinon ce qu'on attend.
 *
 * Fonction PURE — testée. Chaque branche rend soit un geste que l'action acceptera, soit une
 * phrase qui nomme QUI on attend : « en attente » sans sujet fait chercher.
 */
export function prochainPas(p: FaitsPoste, r: RegardPoste): ProchainPas {
  const editer = r.canEdit && !r.fige;
  const arbitrer = r.canAllocate && !r.fige;
  const droits = r.validation ?? { operations: false, marketing: false };
  const qui2 = r.secondTempsParOperations ? "la Direction des opérations" : "la Direction Marketing";

  // LE MATÉRIEL DU STOCK (§118.167) suit un ACCORD unique — soumettre, décider —, mais pas la suite
  // de l'argent : ni budget, ni bon de commande, ni paiement. Une fois accordé, son bloc le confirme.
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
        attente: p.status === "REVISION" ? "À revoir par le demandeur."
          : p.status === "REJECTED" ? "Refusé — le demandeur peut le corriger et le resoumettre."
          : "Brouillon — le demandeur le chiffre et le soumet pour validation.",
      };
    }
    if (!chiffre(p)) return { geste: { cle: "CHIFFRER", libelle: "Chiffrer le poste" }, attente: null };
    return { geste: { cle: "SOUMETTRE", libelle: p.status === "DRAFT" ? "Soumettre pour validation" : "Resoumettre pour validation" }, attente: null };
  }

  // ── LA VALIDATION EN DEUX TEMPS (§118.204) ─────────────────────────────────────────────
  if (p.status === "PENDING") {
    if (!p.opsDecidedAt) {
      return droits.operations && !r.fige
        ? { geste: { cle: "VALIDER_OPS", libelle: "Valider (Direction des opérations)" }, attente: null }
        : { geste: null, attente: "En attente de la validation de la Direction des opérations." };
    }
    return droits.marketing && !r.fige
      ? { geste: { cle: "DECIDER", libelle: "Valider et choisir le budget" }, attente: null }
      : { geste: null, attente: `Validé par la Direction des opérations — en attente de ${qui2} (montant et budget).` };
  }

  // ── ACCORDÉ ────────────────────────────────────────────────────────────────────────────
  if (p.expenseOrderId) {
    return { geste: null, attente: p.expenseOrderStatus === "PAID" ? null : "Paiement demandé — au centre de paiement." };
  }
  if (p.orderStage === "ISSUED") return { geste: null, attente: null };
  // Un poste accordé d'AVANT la validation en deux temps peut n'avoir ni montant ni budget.
  if (!positif(p.amountGranted)) {
    return droits.marketing && !r.fige
      ? { geste: { cle: "MONTANT", libelle: "Affecter le montant accordé" }, attente: null }
      : { geste: null, attente: `${capitale(qui2)} affecte le montant accordé à ce poste.` };
  }
  if (!p.budgetCategoryId) {
    return droits.marketing && !r.fige
      ? { geste: { cle: "BUDGET", libelle: "Choisir le budget" }, attente: null }
      : { geste: null, attente: `${capitale(qui2)} choisit le budget qui porte ce poste.` };
  }
  const payer: ProchainPas = r.canEdit
    ? { geste: { cle: "DEMANDER_PAIEMENT", libelle: "Déposer la facture et demander le paiement" }, attente: null }
    : { geste: null, attente: "Le demandeur dépose la facture pour demander le paiement." };

  // SPONSORING DIRECT : pas de bon de commande. Pro forma facultative, facture obligatoire.
  if (VERSEMENT_SANS_BC.includes(p.kind) && p.orderStage === "NONE" && !p.bc) {
    if (!r.operationDecidee) return { geste: null, attente: "La facture se déposera quand l'opération sera accordée." };
    return payer;
  }

  // ── LE BON DE COMMANDE : demande → (centre) → assistante → vérification → signature Finances ──
  if (p.bc === "SIGNE") return payer;
  if (p.bc) return { geste: null, attente: ATTENTE_BC[p.bc] ?? "Bon de commande en cours au registre." };
  // DEMANDÉ : l'assistante l'établit pendant que, au-dessus du seuil, le centre le vise en parallèle.
  if (p.orderStage === "REQUESTED" || p.orderStage === "DIRECTION_OK") {
    if (p.orderStage === "REQUESTED" && r.canViserBC) return { geste: { cle: "VISER_BC", libelle: "Valider le bon de commande" }, attente: null };
    if (p.demandeBC === "DEPOSE") {
      return r.verifieLeBC
        ? { geste: { cle: "VERIFIER_BC", libelle: "Vérifier le bon de commande déposé" }, attente: null }
        : { geste: null, attente: "Bon de commande déposé par l'assistante — le demandeur le vérifie." };
    }
    // UNE DEMANDE D'AVANT LA RÈGLE (§118.204) : demandée au secrétariat, elle ne reviendrait jamais sur
    // le poste. L'action accepte de l'envoyer à l'assistante ; la carte doit le proposer.
    if (p.demandeBC === "AUCUNE") {
      return r.canEdit
        ? { geste: { cle: "DEMANDER_BC", libelle: "Envoyer la demande de BC à l'assistante" }, attente: null }
        : { geste: null, attente: "Le demandeur envoie la demande de bon de commande à l'assistante de direction." };
    }
    return {
      geste: null,
      attente: p.orderStage === "REQUESTED"
        ? "L'assistante de direction établit le bon de commande — le centre de validation Ad & Pro le vise en parallèle."
        : "L'assistante de direction établit le bon de commande.",
    };
  }
  // Bon de commande à demander (ou à redemander après un refus du centre). Cette demande reste un
  // geste d'EXÉCUTION : elle s'offre encore sur une demande clôturée (§118.151).
  return r.canEdit
    ? { geste: { cle: "DEMANDER_BC", libelle: p.orderStage === "REFUSED" ? "Redemander l'émission du BC" : "Demander l'émission du BC" }, attente: null }
    : { geste: null, attente: "Le demandeur demande l'émission du bon de commande." };
}

const capitale = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

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
