"use server";

import { CHEMIN_STOCK_PROMO, lienStockPromo } from "@/lib/chemins/stock-promo";
import { revalidatePath } from "next/cache";
import type { AdProItemKind, AdProItemStatus, AdProItemBudgetKind, UserRole } from "@prisma/client";
import { requireUser } from "@/lib/session";
import { userCan, hasGlobalView, anyRoleFilter, type SessionUser } from "@/lib/rbac";
import { canAccessEntity } from "@/lib/entity-access";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/utils";
import { moneyEntityOf } from "@/lib/company";
import { recordAudit } from "@/lib/audit";
import { notifyUser, notifyRoles } from "@/lib/notify";
import { createExpenseOrder } from "@/lib/expense-orders";
import { canEmitOrder, canSubmitItem, canRequestPurchaseOrder, canRemoveItem, budgetKindLocked, ITEM_KINDS, ITEM_KIND_LABELS, PARENT_ENTITE, ITEM_STATUS_LABELS, REFUS_INDIRECT_NON_REPARTI, type AdProParent } from "@/lib/ad-pro-items";
import {
  PIECE_SECRETARIAT, NATURES_PIECE_SECRETARIAT, peutDemanderPiece, titrePiece,
  type NaturePieceSecretariat,
} from "@/lib/ad-pro/pieces-secretariat";
import { buildRef, createWithRetry } from "@/lib/refs";
import { montantDeLaDemande } from "@/lib/ad-pro/montant-demande";
import { fdStr, fdNum, type ActionResult } from "@/lib/actions/types";
import { siegeAuCentreAdPro, REFUS_BC_CENTRE_AD_PRO } from "@/lib/ad-pro/centre";
import { getAppSettings } from "@/lib/settings";
import { validationRequiseBC, motifSousLeSeuil } from "@/lib/bons-de-commande/regle";
import { signalerSiASigner } from "@/lib/bons-de-commande/etat";
import { CHEMIN_BC_A_SIGNER } from "@/lib/bons-de-commande/aiguillage";
import { ROLE_DIRECTION_MARKETING } from "@/lib/workflow/parcours";
import { etatPostesSponsoring } from "@/lib/ad-pro/cloture-sponsoring";
import { rendreAuMagasin, reserverPourEvenement, sousVerrous, type Tx } from "@/lib/promo/stock-ecriture";
import {
  faitDeStock, lireConfirmation, peutConfirmerMateriel, refusArgentSurPosteStock, refusChangementNature, refusReservation,
  REFUS_CONFIRMATION_MATERIEL, type Confirmation,
} from "@/lib/promo/reservations";
import { libelleArticleStock } from "@/lib/promo/stock";
import { familleQuantifiee, type PromoFamille } from "@/lib/promo/catalogue";
import { articleDansMonPerimetre, gestionnairesDuMagasin } from "@/lib/queries/promo-stock";
import { lireRepartition, libelleLigne, type LigneRepartition } from "@/lib/ad-pro/repartition";
import { ecrireRepartition, type PosteReparti } from "@/lib/ad-pro/repartition-ecriture";
import { STATUTS_EDITABLES } from "@/lib/ad-pro/poste-etapes";
import {
  lireVoyageur, ligneVoyageur, changementsVoyageur, porteDesVoyageurs, type SaisieVoyageur, type VoyageurLu,
} from "@/lib/ad-pro/voyageurs";
import { createDossierRecord, ecrireDansLeSujet } from "@/lib/dossiers-core";

/**
 * POSTES D'UNE OPÉRATION AD & PRO — actions serveur, pour les QUATRE opérations du pôle :
 * sponsoring, prises en charge nationales et internationales, événements.
 *
 * **Chaque poste se valide INDÉPENDAMMENT.** C'est le changement de doctrine demandé par le
 * métier : consulting, traiteur, location de salle ne se décident pas ensemble, et la Direction
 * doit pouvoir accorder l'un, refuser l'autre et demander à revoir le budget du troisième —
 * autant de fois qu'il le faut (`AdProItemDecision` garde chaque tour). L'opération garde son
 * circuit d'ensemble ; les postes ont désormais le leur.
 *
 * Le poste dit AUSSI d'où vient son argent (`budgetKind`) : inclus dans l'enveloppe déjà
 * accordée, ou **rallonge** demandée en plus — sans quoi une rallonge assumée passerait pour un
 * dépassement subi.
 *
 * Chaîne complète, du besoin au paiement :
 *   devis (demande administrative) → pièces jointes → validation du poste (Direction) →
 *   choix du budget → demande d'émission du BC → visa Direction → émission par les Finances
 *   (ordre de dépense).
 *
 * Le **matériel promotionnel** reste à part : il POINTE vers un `PromoMaterial` suivant son
 * propre circuit (visa publicitaire, conformité, agence, BAT). On rattache, on ne recopie pas.
 *
 * **Un seul jeu d'actions pour les quatre modules.** Les différences réelles — où lit-on
 * l'enveloppe, quel statut vaut « accordé », quelle permission, quel chemin revalider — sont
 * rassemblées dans `PARENTS` : un seul endroit à compléter.
 */

interface ParentInfo {
  id: string;
  /** Ce qui identifie l'opération sur une pièce comptable. */
  ref: string;
  /** À qui l'argent va par défaut, quand le poste ne précise pas de bénéficiaire. */
  beneficiary: string;
  /** L'opération est-elle ACCORDÉE ? On n'engage pas une dépense avant. */
  decided: boolean;
  /**
   * Un poste ajouté MAINTENANT l'est-il APRÈS la décision sur l'argent ? Jusqu'ici c'était
   * `decided` : accordée, l'opération avait son montant, et tout poste de plus dépassait
   * l'enveloppe. Un sponsoring PRÉ-VALIDÉ (§118.151) est décidé — l'événement aura lieu, ses
   * postes engagent — sans avoir encore d'enveloppe : ajouter des postes y est l'étape même que
   * la Direction a décrite (« on passe aux ajouts de postes »), pas un ajout tardif. Le marquer
   * tardif afficherait un dépassement sur chaque poste que la procédure demande d'ajouter.
   */
  tardif: boolean;
  /**
   * CLÔTURÉE : la validation finale a arrêté ses postes, leurs montants et leurs budgets, et le
   * total accordé de la demande en est la somme (§118.151). Les réécrire en silence ferait
   * diverger ce total de ses postes. `closedByClosure` distingue la clôture (qui se rouvre) d'une
   * demande close par un transfert (qui vit désormais ailleurs).
   */
  clos: boolean;
  closedByClosure?: boolean;
  /** Qui a demandé l'opération — prévenu des décisions prises sur ses postes. */
  requesterId?: string | null;
  /**
   * La société de l'opération — celle que porte toute pièce demandée pour un de ses postes. Sans
   * elle, la demande au secrétariat naissait sans société et n'apparaissait dans AUCUNE vue
   * cloisonnée du bureau (§118.154).
   */
  companyId?: string | null;
}

type AdProModule = "SPONSORING" | "CONGRESS_NATIONAL" | "CONGRESS_INTERNATIONAL" | "EVENTS";

interface ParentSpec {
  module: AdProModule;
  path: string;
  /** Colonne de rattachement du poste — une par opération, jamais de colonne polymorphe. */
  column: "sponsoringId" | "congressNationalId" | "congressInternationalId" | "eventId";
  /** Charge ce dont les actions ont besoin, quel que soit le nom des colonnes. */
  load: (id: string) => Promise<ParentInfo | null>;
}

/*
 * Les statuts d'un SPONSORING qui le disent décidé, tardif ou clos vivent dans
 * `ad-pro/cloture-sponsoring.ts` (`etatPostesSponsoring`), lu AUSSI par l'écran : la page en
 * portait une copie écrite à la main, sans `PRE_VALIDATED`, et cachait donc « Émettre l'ordre »
 * sur chaque poste d'un sponsoring pré-validé pendant que cette action l'aurait accepté (§118.5).
 * `PRE_VALIDATED` y est « décidé » : la tenue est décidée, et c'est précisément là que les postes
 * passent par devis, BC et facture — laissé dehors, aucun poste ne pourrait être payé.
 */
const CONGRESS_DECIDED = ["APPROVED", "COMPLETED"];

const PARENTS: Record<AdProParent, ParentSpec> = {
  SPONSORING: {
    module: "SPONSORING",
    path: "/sponsoring",
    column: "sponsoringId",
    load: async (id) => {
      const r = await prisma.sponsoringRequest.findUnique({
        where: { id },
        select: { id: true, reference: true, institution: true, status: true, requesterId: true, closedAt: true, companyId: true },
      });
      if (!r) return null;
      const etat = etatPostesSponsoring(r.status, r.closedAt);
      return {
        id: r.id, ref: r.reference, beneficiary: r.institution,
        decided: etat.decide, tardif: etat.tardif, clos: etat.clos, closedByClosure: etat.closParLaCloture,
        requesterId: r.requesterId, companyId: r.companyId,
      };
    },
  },
  CONGRESS_NATIONAL: {
    module: "CONGRESS_NATIONAL",
    path: "/congress-national",
    column: "congressNationalId",
    load: async (id) => {
      const r = await prisma.congressNational.findUnique({
        where: { id },
        select: { id: true, name: true, hostInstitution: true, requestStatus: true, requesterId: true, companyId: true },
      });
      // Le congrès n'a pas de référence : son nom est ce qui l'identifie sur une pièce.
      if (!r) return null;
      const decided = CONGRESS_DECIDED.includes(r.requestStatus);
      return { id: r.id, ref: r.name, beneficiary: r.hostInstitution ?? r.name, decided, tardif: decided, clos: false, requesterId: r.requesterId, companyId: r.companyId };
    },
  },
  CONGRESS_INTERNATIONAL: {
    module: "CONGRESS_INTERNATIONAL",
    path: "/congress-international",
    column: "congressInternationalId",
    load: async (id) => {
      const r = await prisma.congressInternational.findUnique({
        where: { id },
        select: { id: true, name: true, requestStatus: true, requesterId: true, companyId: true },
      });
      if (!r) return null;
      const decided = CONGRESS_DECIDED.includes(r.requestStatus);
      return { id: r.id, ref: r.name, beneficiary: r.name, decided, tardif: decided, clos: false, requesterId: r.requesterId, companyId: r.companyId };
    },
  },
  EVENT: {
    module: "EVENTS",
    path: "/events",
    column: "eventId",
    load: async (id) => {
      const r = await prisma.event.findUnique({
        where: { id },
        select: { id: true, name: true, requestStatus: true, requesterId: true, status: true, companyId: true },
      });
      if (!r) return null;
      // Un événement peut être organisé SANS circuit de financement (requestStatus null) : il est
      // alors piloté directement, donc ses postes ne sont pas bloqués par une décision absente.
      const decided = r.requestStatus == null ? r.status !== "DRAFT" && r.status !== "CANCELLED" : CONGRESS_DECIDED.includes(r.requestStatus);
      return { id: r.id, ref: r.name, beneficiary: r.name, decided, tardif: decided, clos: false, requesterId: r.requesterId, companyId: r.companyId };
    },
  },
};

const isParent = (v: string): v is AdProParent =>
  v === "SPONSORING" || v === "CONGRESS_NATIONAL" || v === "CONGRESS_INTERNATIONAL" || v === "EVENT";

interface ParentColumns {
  sponsoringId: string | null;
  congressNationalId: string | null;
  congressInternationalId: string | null;
  eventId: string | null;
}

/** Le parent d'un poste, déduit de la colonne renseignée (la base garantit qu'il y en a une). */
function parentOf(item: ParentColumns): { parent: AdProParent; id: string } | null {
  if (item.sponsoringId) return { parent: "SPONSORING", id: item.sponsoringId };
  if (item.congressNationalId) return { parent: "CONGRESS_NATIONAL", id: item.congressNationalId };
  if (item.congressInternationalId) return { parent: "CONGRESS_INTERNATIONAL", id: item.congressInternationalId };
  if (item.eventId) return { parent: "EVENT", id: item.eventId };
  return null;
}

function revalidate(parent: AdProParent, id: string) {
  const { path } = PARENTS[parent];
  revalidatePath(path);
  revalidatePath(`${path}/${id}`);
}

/**
 * Qui peut toucher aux postes.
 *
 * `CREATE`/`UPDATE` suffit pour DÉCRIRE les postes (le demandeur détaille son besoin), mais
 * l'affectation des montants et l'émission des ordres de dépense engagent l'argent : Direction.
 */
function canEditItems(user: SessionUser, parent: AdProParent): boolean {
  const m = PARENTS[parent].module;
  return userCan(user, m, "CREATE") || userCan(user, m, "UPDATE") || hasGlobalView(user);
}
function canAllocate(user: SessionUser, parent: AdProParent): boolean {
  return hasGlobalView(user) || userCan(user, PARENTS[parent].module, "VALIDATE");
}

async function audit(user: SessionUser, parent: AdProParent, id: string, action: "CREATE" | "UPDATE" | "DELETE", detail: string) {
  await recordAudit({
    actorId: user.id, module: PARENTS[parent].module, entityType: parent, entityId: id, action, summary: detail,
  }).catch(() => undefined);
}

/**
 * UNE OPÉRATION CLÔTURÉE ARRÊTE SES POSTES — et le refus nomme le geste qui rouvre (§118.151).
 *
 * La clôture a validé chaque poste, l'a rangé dans un budget, et a écrit leur somme comme montant
 * accordé de la demande. Ajouter, retirer, rechiffrer, redécider ou réimputer un poste ensuite
 * ferait diverger ce total de ses postes, en silence. Ce qui continue, en revanche, c'est
 * l'EXÉCUTION de ce qui a été validé : demande et visa du BC, émission, facture — sans quoi la
 * clôture laisserait en plan un poste accordé dont le BC n'était pas encore parti.
 *
 * Le refus nomme la réouverture quand elle existe, et seulement alors : une demande close par un
 * TRANSFERT vit désormais dans un autre module, et lui promettre un « Rouvrir » serait un remède
 * qui n'existe pas (§118.63).
 */
async function refusSiClos(parent: AdProParent, parentId: string): Promise<string | null> {
  const info = await PARENTS[parent].load(parentId);
  if (!info) return "Opération introuvable.";
  return refusPostesClos(info);
}

/** La phrase du refus, pour un appelant qui tient déjà l'opération chargée. */
function refusPostesClos(info: ParentInfo): string | null {
  if (!info.clos) return null;
  return info.closedByClosure
    ? "Cette demande est clôturée : ses postes, leurs montants et leurs budgets sont arrêtés. "
      + "Pour corriger, la Direction Marketing la rouvre depuis sa fiche (« Rouvrir la demande »), puis la clôture à nouveau."
    : "Cette demande est close (transférée vers un autre module) : ses postes ne se modifient plus ici.";
}


/**
 * LE MONTANT DE LA DEMANDE SUIT SES RALLONGES ACCORDÉES (§118.138).
 *
 * Demande de la Direction : « une fois budget supplémentaire accordé, il doit être mis à jour
 * dans la demande, le montant ». Jusqu'ici, `decideAdProItem` écrivait `amountGranted` sur le
 * POSTE et la fiche de l'opération continuait d'afficher l'enveloppe d'origine : la rallonge
 * existait, était accordée, engagée, payée — et le total de la demande ne la portait pas.
 *
 * La BASE est le montant que le circuit a accordé (`WorkflowInstance.amount`), jamais le champ
 * affiché : celui-ci est ce qu'on écrit, et s'en servir comme base le ferait grossir à chaque
 * passage. Base inconnue ⇒ on ne touche à rien (une opération sans circuit de financement n'a
 * pas de montant de demande, et c'est une réponse, pas un trou à combler).
 *
 * Best-effort : une décision de poste ne doit pas échouer parce que la projection n'a pas pu
 * s'écrire. Ce qui compte — la décision et son montant — est déjà en base.
 */
async function reprojeterMontantDemande(parent: AdProParent, parentId: string): Promise<void> {
  try {
    const [instance, postes] = await Promise.all([
      prisma.workflowInstance.findUnique({
        where: { entityType_entityId: { entityType: parent, entityId: parentId } },
        select: { amount: true },
      }),
      prisma.adProItem.findMany({
        where: { [PARENTS[parent].column]: parentId },
        select: { budgetKind: true, status: true, amountGranted: true },
      }),
    ]);
    const total = montantDeLaDemande(
      instance?.amount != null ? toNumber(instance.amount) : null,
      postes.map((p) => ({
        budgetKind: p.budgetKind,
        status: p.status,
        amountGranted: p.amountGranted != null ? toNumber(p.amountGranted) : null,
      })),
    );
    if (total == null) return;
    // Le champ diffère selon l'opération — sponsoring et congrès/événements n'ont pas nommé la
    // même colonne. Une seule écriture, décidée ici, pour qu'elles ne puissent pas diverger.
    if (parent === "SPONSORING") {
      await prisma.sponsoringRequest.update({ where: { id: parentId }, data: { amountGranted: total } });
    } else if (parent === "CONGRESS_NATIONAL") {
      await prisma.congressNational.update({ where: { id: parentId }, data: { finalAmount: total } });
    } else if (parent === "CONGRESS_INTERNATIONAL") {
      await prisma.congressInternational.update({ where: { id: parentId }, data: { finalAmount: total } });
    } else {
      await prisma.event.update({ where: { id: parentId }, data: { finalAmount: total } });
    }
  } catch (err) {
    console.error("[ad-pro] montant de la demande non reprojeté (non bloquant)", err);
  }
}

/**
 * LA DEMANDE DOIT ÊTRE VISIBLE (§118.175) — la porte de LIGNE du parent, celle de sa fiche.
 *
 * Le droit d'écrire dans le MODULE ne suffit pas : un congrès a une portée « ses lignes », et un
 * délégué n'y voit que SES demandes — la liste et la fiche l'appliquent, la porte des pièces aussi
 * (§118.153). Les gestes sur les postes, eux, ne lisaient que le module : un identifiant forgé
 * faisait modifier, soumettre ou retirer les postes du congrès d'un collègue — et, par les gestes
 * de ce lot, y inscrire des voyageurs et ouvrir un sujet de réservation à son nom. Une porte gardée
 * à côté d'une porte ouverte (§118.71). Sponsoring et événements n'ont pas de portée de ligne (qui
 * a le module les voit tous, comme leur liste) : pour eux, rien ne change.
 *
 * La règle est CELLE de la fiche (`canAccessEntity`, VIEW), jamais une recopie : deux lectures de
 * « qui voit ce congrès » finiraient par diverger (§118.5). Elle n'accorde rien : le droit d'agir
 * reste celui de chaque geste (`canEditItems`, `canAllocate`…) ; elle n'ajoute que « on agit sur
 * une demande qu'on voit ».
 */
function demandeVisible(user: SessionUser, parent: AdProParent, parentId: string): Promise<boolean> {
  return canAccessEntity(user, PARENT_ENTITE[parent], parentId, "VIEW");
}

/**
 * Charge un poste avec son parent résolu — le point d'entrée de toutes les actions par `id`. Hors
 * de la portée de la personne, le poste est INTROUVABLE : la même phrase que l'absence, qui ne
 * confirme pas qu'il existe. L'acteur est un paramètre OBLIGATOIRE : un défaut rouvrirait la porte
 * en silence au prochain appelant qui l'oublierait (§118.127b).
 */
async function loadItem(id: string, user: SessionUser) {
  const item = await prisma.adProItem.findUnique({
    where: { id },
    select: {
      id: true, label: true, kind: true, supplier: true, amountGranted: true, amountEstimated: true,
      expenseOrderId: true, promoMaterialId: true, status: true, budgetKind: true,
      budgetCategoryId: true, orderStage: true, adminRequestId: true, orderRequestedById: true,
      sponsoringId: true, congressNationalId: true, congressInternationalId: true, eventId: true,
    },
  });
  if (!item) return null;
  const owner = parentOf(item);
  if (!owner || !(await demandeVisible(user, owner.parent, owner.id))) return null;
  return { item, owner };
}

// ───────────────────────────── Répartir un sponsoring indirect (§118.175) ─────────────────────────────

/** « imprimerie 400 000 DZD, hôtellerie 600 000 DZD » — la phrase de l'audit et du message, une fois. */
function resumeRepartition(lignes: readonly LigneRepartition[]): string {
  return lignes.map((l) => `${ITEM_KIND_LABELS[l.kind].toLowerCase()} ${l.montant.toLocaleString("fr-FR")} DZD`).join(", ");
}

/** Les lignes lues, prêtes à écrire : le libellé de chaque poste se compose ici, une fois. */
function postesRepartis(lignes: readonly LigneRepartition[]): PosteReparti[] {
  return lignes.map((l) => ({ kind: l.kind, label: libelleLigne(ITEM_KIND_LABELS[l.kind], l.precision), montant: l.montant, payeA: l.payeA }));
}

/**
 * RÉPARTIR PAR NATURE le poste « sponsoring indirect » créé avec la demande (§118.175).
 *
 * Tant qu'il n'est ni soumis ni accordé : la Direction ne s'est pas encore prononcée sur sa forme.
 * Une fois soumis, le répartir changerait sous ses yeux ce qu'elle est en train de décider. Et rien
 * ne se répartit quand un bon de commande ou un ordre de dépense est déjà parti : l'argent engagé
 * l'a été sur ce poste-là, tel qu'il était.
 */
export async function repartirPoste(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Poste non précisé." };
  const found = await loadItem(id, user);
  if (!found) return { ok: false, error: "Poste introuvable." };
  const { item, owner } = found;
  if (!canEditItems(user, owner.parent)) return { ok: false, error: "Non autorisé." };
  const clos = await refusSiClos(owner.parent, owner.id);
  if (clos) return { ok: false, error: clos };
  if (item.kind !== "INDIRECT_SUPPORT") return { ok: false, error: "Seul un sponsoring indirect se répartit par nature." };
  if (!STATUTS_EDITABLES.includes(item.status)) {
    return { ok: false, error: "Ce poste est déjà soumis ou accordé : sa forme ne change plus — la Direction s'est prononcée (ou se prononce) sur lui tel qu'il est." };
  }
  if (item.expenseOrderId || item.orderStage !== "NONE") {
    return { ok: false, error: "Un bon de commande ou un ordre de dépense est déjà parti sur ce poste : il ne se répartit plus." };
  }

  const lue = lireRepartition(fdStr(formData, "repartition"));
  if (!lue.ok) return { ok: false, error: lue.error };

  const avant = await prisma.adProItem.findUnique({ where: { id }, select: { label: true, notes: true, budgetKind: true, addedAfterDecision: true } });
  if (!avant) return { ok: false, error: "Poste introuvable." };
  try {
    await prisma.$transaction((tx) => ecrireRepartition(tx, {
      rattachement: { [PARENTS[owner.parent].column]: owner.id }, lignes: postesRepartis(lue.lignes), premierId: id, userId: user.id,
      base: { label: avant.label, notes: avant.notes, budgetKind: avant.budgetKind, addedAfterDecision: avant.addedAfterDecision },
    }));
  } catch (err) {
    console.error("[ad-pro-item] répartition impossible", err);
    return { ok: false, error: "La répartition n'a pas pu être enregistrée : rien n'a changé. Réessayez dans un instant." };
  }
  const estime = item.amountEstimated != null ? toNumber(item.amountEstimated) : null;
  // L'ÉCART SE DIT, il ne se refuse pas : le délégué peut avoir ajusté en répartissant. Le taire
  // laisserait croire que le total n'a pas bougé.
  const ecart = estime != null && Math.round(estime * 100) !== Math.round(lue.total * 100)
    ? ` Le poste d'origine portait ${estime.toLocaleString("fr-FR")} DZD.`
    : "";
  await audit(user, owner.parent, owner.id, "UPDATE",
    `« ${avant.label} » réparti en ${lue.lignes.length} poste(s) — ${resumeRepartition(lue.lignes)} — total ${lue.total.toLocaleString("fr-FR")} DZD.${ecart}`);
  revalidate(owner.parent, owner.id);
  return { ok: true, id, message: `Réparti en ${lue.lignes.length} poste(s) : ${resumeRepartition(lue.lignes)} — total ${lue.total.toLocaleString("fr-FR")} DZD.${ecart}` };
}

// ───────────────────────────── Ajouter / modifier / retirer ─────────────────────────────

export async function addAdProItem(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();

  const parentRaw = fdStr(formData, "parent") ?? "";
  if (!isParent(parentRaw)) return { ok: false, error: "Opération inconnue." };
  const parentId = fdStr(formData, "parentId");
  const label = fdStr(formData, "label");
  if (!parentId || !label) return { ok: false, error: "Le libellé du poste est obligatoire." };
  if (!canEditItems(user, parentRaw)) return { ok: false, error: "Non autorisé." };

  const info = await PARENTS[parentRaw].load(parentId);
  // Hors de la portée de la personne, la demande est introuvable — la même phrase que l'absence.
  if (!info || !(await demandeVisible(user, parentRaw, parentId))) return { ok: false, error: "Opération introuvable." };
  const clos = refusPostesClos(info);
  if (clos) return { ok: false, error: clos };

  const kind = (fdStr(formData, "kind") ?? "OTHER") as AdProItemKind;
  if (!(kind in ITEM_KIND_LABELS)) return { ok: false, error: "Nature de poste inconnue." };

  const amountEstimated = fdNum(formData, "amountEstimated");
  if (amountEstimated != null && amountEstimated < 0) return { ok: false, error: "Un montant ne peut pas être négatif." };
  // UN POSTE « MATÉRIEL DU STOCK » NE PORTE PAS DE MONTANT (§118.167) : son matériel sort du
  // magasin, il ne s'achète pas. Un montant saisi y serait additionné au montant de la demande.
  const sansMontant = amountEstimated != null && amountEstimated > 0 ? refusArgentSurPosteStock(kind, "un montant") : null;
  if (sansMontant) return { ok: false, error: sansMontant };
  // « Ce poste est-il DANS le budget accordé, ou EN PLUS ? » — question posée dès l'ajout : sans
  // elle, une rallonge assumée serait lue comme un dépassement subi.
  const budgetKind = (fdStr(formData, "budgetKind") === "ADDITIONAL" ? "ADDITIONAL" : "INCLUDED") as AdProItemBudgetKind;

  // UN SPONSORING INDIRECT NAÎT RÉPARTI PAR NATURE (§118.175) — « 1 000 000 DZD répartis en
  // 400 000 d'imprimerie et 600 000 d'hôtellerie ». Il ne devient pas UN poste « sponsoring
  // indirect » qu'on ne pourrait payer qu'à un seul fournisseur : chaque nature devient un poste,
  // avec sa chaîne, et `repartitionId` les relie. Sans répartition, le refus nomme ce qui manque.
  if (kind === "INDIRECT_SUPPORT") {
    const lue = lireRepartition(fdStr(formData, "repartition"));
    if (!lue.ok) return { ok: false, error: lue.error };
    try {
      const ids = await prisma.$transaction((tx) => ecrireRepartition(tx, {
        rattachement: { [PARENTS[parentRaw].column]: parentId }, lignes: postesRepartis(lue.lignes), premierId: null, userId: user.id,
        base: { label, notes: fdStr(formData, "notes"), budgetKind, addedAfterDecision: info.tardif },
      }));
      await audit(user, parentRaw, parentId, "CREATE",
        `Sponsoring indirect « ${label} » réparti en ${lue.lignes.length} poste(s) — ${resumeRepartition(lue.lignes)} — total ${lue.total.toLocaleString("fr-FR")} DZD${info.tardif ? " — APRÈS la décision définitive" : ""}.`);
      revalidate(parentRaw, parentId);
      return { ok: true, id: ids[0], message: `Sponsoring indirect réparti en ${lue.lignes.length} poste(s) : ${resumeRepartition(lue.lignes)} — total ${lue.total.toLocaleString("fr-FR")} DZD.` };
    } catch (err) {
      console.error("[ad-pro-item] répartition impossible", err);
      return { ok: false, error: "La répartition n'a pas pu être enregistrée : aucun poste n'a été créé. Réessayez dans un instant." };
    }
  }

  try {
    // Un poste ajouté APRÈS la décision est autorisé — c'est le choix retenu — mais il est
    // marqué. C'est ce marqueur qui expliquera un dépassement d'enveloppe à l'écran, au lieu
    // de laisser croire à une erreur de saisie.
    const late = info.tardif;
    const where = { [PARENTS[parentRaw].column]: parentId } as Record<string, string>;
    const last = await prisma.adProItem.findFirst({ where, orderBy: { position: "desc" }, select: { position: true } });

    const created = await prisma.adProItem.create({
      data: {
        ...where,
        kind,
        label,
        notes: fdStr(formData, "notes"),
        supplier: fdStr(formData, "supplier"),
        amountEstimated: kind === "STOCK_MATERIAL" ? null : amountEstimated ?? null,
        budgetKind,
        addedAfterDecision: late,
        position: (last?.position ?? 0) + 1,
        createdById: user.id,
        updatedById: user.id,
      },
      select: { id: true },
    });

    await audit(user, parentRaw, parentId, "CREATE",
      `Poste ajouté — ${ITEM_KIND_LABELS[kind]} « ${label} » (${budgetKind === "ADDITIONAL" ? "budget supplémentaire" : "inclus dans le budget accordé"})${late ? " — APRÈS la décision définitive" : ""}.`);
    revalidate(parentRaw, parentId);
    return { ok: true, id: created.id };
  } catch (err) {
    console.error("[ad-pro-item] création impossible", err);
    return { ok: false, error: "Le poste n'a pas pu être ajouté. Réessayez dans un instant." };
  }
}

export async function updateAdProItem(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();

  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Poste non précisé." };
  const found = await loadItem(id, user);
  if (!found) return { ok: false, error: "Poste introuvable." };
  const { item, owner } = found;
  if (!canEditItems(user, owner.parent)) return { ok: false, error: "Non autorisé." };

  // Le montant affecté engage l'argent : il ne se modifie pas avec les mêmes droits que le libellé.
  const wantsAllocate = formData.get("amountGranted") !== null;
  if (wantsAllocate && !canAllocate(user, owner.parent)) {
    return { ok: false, error: "Seule la Direction affecte les montants." };
  }
  // Une pièce comptable a été émise sur ce montant : le changer en silence ferait diverger
  // l'opération et l'ordre de dépense. On refuse plutôt que de créer un écart invisible.
  if (wantsAllocate && item.expenseOrderId) {
    return { ok: false, error: "Un ordre de dépense a déjà été émis sur ce poste : son montant ne peut plus changer." };
  }

  const amountGranted = wantsAllocate ? fdNum(formData, "amountGranted") : undefined;
  if (amountGranted != null && amountGranted < 0) return { ok: false, error: "Un montant ne peut pas être négatif." };
  const amountEstimated = fdNum(formData, "amountEstimated");
  if (amountEstimated != null && amountEstimated < 0) return { ok: false, error: "Un montant ne peut pas être négatif." };

  const label = fdStr(formData, "label");

  // CLÔTURÉE : ce qui DÉCRIT la dépense (libellé, précisions, fournisseur) se corrige encore — le
  // fournisseur sert au BC qui peut rester à émettre. Ce qui la CHIFFRE ou la QUALIFIE non : la
  // clôture a arrêté ces valeurs, et le total de la demande en est la somme.
  if (wantsAllocate || formData.has("amountEstimated") || fdStr(formData, "kind") || fdStr(formData, "budgetKind")) {
    const clos = await refusSiClos(owner.parent, owner.id);
    if (clos) return { ok: false, error: clos };
  }

  // NATURE et NATURE DE BUDGET — modifiables aussi, mais pas n'importe quand.
  // La nature (stand, prestation…) décrit la dépense : elle se corrige à tout moment.
  // La nature de BUDGET (inclus / rallonge) est ce sur quoi la Direction s'est prononcée :
  // une fois tranchée, la changer réécrirait sa décision.
  const kindRaw = fdStr(formData, "kind");
  const kind = kindRaw && (ITEM_KINDS as readonly string[]).includes(kindRaw) ? (kindRaw as AdProItemKind) : null;
  const budgetKindRaw = fdStr(formData, "budgetKind");
  const budgetKind = budgetKindRaw === "INCLUDED" || budgetKindRaw === "ADDITIONAL" ? budgetKindRaw : null;
  const budgetDecided = budgetKindLocked(item);

  // LA NATURE « MATÉRIEL DU STOCK » ne se gagne ni ne se perd hors d'un brouillon vierge
  // (§118.167) : elle change ce que le poste EST, pas seulement ce qu'il décrit.
  if (kind && kind !== item.kind) {
    const refus = refusChangementNature(item.kind, kind, {
      statut: item.status,
      lignesStock: await prisma.adProStockLine.count({ where: { itemId: id } }),
      argentEngage: item.amountEstimated != null || item.amountGranted != null || item.budgetCategoryId != null
        || item.expenseOrderId != null || item.orderStage !== "NONE" || item.adminRequestId != null || item.promoMaterialId != null,
    });
    if (refus) return { ok: false, error: refus };
  }
  if ((wantsAllocate && amountGranted != null && amountGranted > 0) || (amountEstimated != null && amountEstimated > 0)) {
    const refus = refusArgentSurPosteStock(kind ?? item.kind, "un montant");
    if (refus) return { ok: false, error: refus };
  }

  try {
    await prisma.adProItem.update({
      where: { id },
      data: {
        ...(label ? { label } : {}),
        ...(kind ? { kind } : {}),
        ...(budgetKind && !budgetDecided ? { budgetKind } : {}),
        ...(formData.has("notes") ? { notes: fdStr(formData, "notes") } : {}),
        ...(formData.has("supplier") ? { supplier: fdStr(formData, "supplier") } : {}),
        ...(formData.has("amountEstimated") ? { amountEstimated: amountEstimated ?? null } : {}),
        ...(wantsAllocate ? { amountGranted: amountGranted ?? null } : {}),
        updatedById: user.id,
      },
    });
    await audit(user, owner.parent, owner.id, "UPDATE",
      wantsAllocate
        ? `Poste « ${label ?? item.label} » — montant affecté : ${amountGranted != null ? `${amountGranted.toLocaleString("fr-FR")} DZD` : "retiré"}.`
        : `Poste « ${label ?? item.label} » modifié.`);
    // MÊME PORTE QUE LA DÉCISION : le montant d'une rallonge accordée se corrige aussi ici, et
    // sa nature de budget peut encore changer tant qu'elle n'est pas tranchée. Laisser cette
    // porte-là sans reprojection, c'est la porte ouverte à côté de la porte gardée (§118.71).
    await reprojeterMontantDemande(owner.parent, owner.id);
    revalidate(owner.parent, owner.id);
    return { ok: true, id };
  } catch (err) {
    console.error("[ad-pro-item] mise à jour impossible", err);
    return { ok: false, error: "Le poste n'a pas pu être modifié." };
  }
}

export async function deleteAdProItem(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();

  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Poste non précisé." };
  const found = await loadItem(id, user);
  if (!found) return { ok: false, error: "Poste introuvable." };
  const { item, owner } = found;
  if (!canEditItems(user, owner.parent)) return { ok: false, error: "Non autorisé." };
  const clos = await refusSiClos(owner.parent, owner.id);
  if (clos) return { ok: false, error: clos };
  // LE MATÉRIEL DU STOCK (§118.167) : réservé, il est dehors et effacer le poste l'y laisserait ;
  // remis, abîmé ou perdu, le poste est la cause de ces sorties. La MÊME règle que la corbeille
  // (`faitDeStock`) — sinon une demande qu'elle refuse se viderait poste par poste (§118.71).
  const faitStock = (await prisma.adProStockLine.findMany({
    where: { itemId: id }, select: { statut: true, utilisee: true, abimee: true, perdue: true },
  })).map((l) => faitDeStock(l)).find((f) => f != null);
  if (faitStock) return { ok: false, error: `Ce poste ne se retire pas : ${faitStock}.` };

  // UN POSTE PAYÉ NE S'EFFACE PAS EN SILENCE — mais il doit pouvoir être retiré.
  //
  // Le refus pur et simple créait une impasse : un poste émis par erreur (mauvais fournisseur,
  // doublon) restait à l'écran pour toujours. On garde donc la protection pour les éditeurs
  // ordinaires, et on l'ouvre à la DIRECTION — celle qui a signé l'ordre est celle qui peut le
  // défaire. L'ordre de dépense est alors ANNULÉ, pas orphelin : la trace comptable subsiste,
  // marquée annulée, au lieu de pointer vers un poste disparu.
  const order = item.expenseOrderId
    ? await prisma.expenseOrder.findUnique({ where: { id: item.expenseOrderId }, select: { status: true, reference: true } })
    : null;
  const removable = canRemoveItem(
    { expenseOrderId: item.expenseOrderId, expenseOrderStatus: order?.status ?? null },
    { canAllocate: canAllocate(user, owner.parent) },
  );
  if (!removable.ok) return { ok: false, error: removable.reason ?? "Ce poste ne peut pas être retiré." };

  if (item.expenseOrderId) {
    await prisma.expenseOrder.update({ where: { id: item.expenseOrderId }, data: { status: "CANCELLED" } }).catch(() => undefined);
    await audit(user, owner.parent, owner.id, "UPDATE",
      `Ordre de dépense ${order?.reference ?? ""} annulé — le poste « ${item.label} » a été retiré.`);
  }

  try {
    await prisma.adProItem.delete({ where: { id } });
    // Le matériel promotionnel rattaché n'est PAS supprimé : il a sa vie propre et son circuit.
    await audit(user, owner.parent, owner.id, "DELETE",
      `Poste « ${item.label} » retiré${item.promoMaterialId ? " (le matériel promotionnel rattaché est conservé)" : ""}.`);
    // Une rallonge accordée qu'on retire doit QUITTER le montant de la demande : sinon la fiche
    // porterait pour toujours un budget accordé à un poste qui n'existe plus.
    await reprojeterMontantDemande(owner.parent, owner.id);
    revalidate(owner.parent, owner.id);
    return { ok: true };
  } catch (err) {
    console.error("[ad-pro-item] suppression impossible", err);
    return { ok: false, error: "Le poste n'a pas pu être retiré." };
  }
}

// ───────────────────────────── Paiement ─────────────────────────────

/**
 * Émet l'ordre de dépense d'UN poste.
 *
 * Un ordre par poste, parce que les bénéficiaires diffèrent réellement : le stand se paie à
 * l'organisateur, le matériel à l'agence, l'appui à l'association. Un ordre global obligerait
 * les Finances à répartir à la main — et c'est là que les erreurs se glissent.
 */
export async function emitItemExpenseOrder(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();

  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Poste non précisé." };
  const found = await loadItem(id, user);
  if (!found) return { ok: false, error: "Poste introuvable." };
  const { item, owner } = found;
  const refusStock = refusArgentSurPosteStock(item.kind, "un ordre de dépense");
  if (refusStock) return { ok: false, error: refusStock };
  // ÉMISSION = geste des FINANCES (ou d'un profil à vue globale). La Direction, elle, a visé.
  const isFinance = userCan(user, "FINANCES", "UPDATE") || userCan(user, "FINANCES", "VALIDATE");
  if (!isFinance && !canAllocate(user, owner.parent)) return { ok: false, error: "Seules les Finances émettent le bon de commande." };

  const info = await PARENTS[owner.parent].load(owner.id);
  if (!info) return { ok: false, error: "Opération introuvable." };

  // Le circuit : demande du BC → VALIDATION AU CENTRE AD & PRO → émission. Un BC demandé ne part
  // pas sans le visa du centre (§118.148). Un poste SANS bon de commande (orderStage NONE — une
  // aide versée à l'association sur convention, un poste d'avant ce circuit) s'émet directement :
  // il n'y a pas de BC à valider, et son paiement passe de toute façon par le centre de PAIEMENT.
  if (item.orderStage === "REQUESTED") return { ok: false, error: "Le centre de validation Ad & Pro n'a pas encore validé ce bon de commande." };
  if (item.orderStage === "REFUSED") return { ok: false, error: "Le bon de commande de ce poste a été refusé par le centre de validation Ad & Pro." };

  const amount = item.amountGranted != null ? toNumber(item.amountGranted) : null;
  const check = canEmitOrder({ amountGranted: amount, expenseOrderId: item.expenseOrderId, status: item.status }, info.decided);
  if (!check.ok) return { ok: false, error: check.reason ?? "Émission impossible." };

  try {
    const order = await createExpenseOrder({
      label: `${info.ref} — ${ITEM_KIND_LABELS[item.kind]} : ${item.label}`,
      amount: amount as number,
      category: "EVENEMENT",
      // Le bénéficiaire du POSTE ; à défaut, celui de l'opération.
      beneficiary: item.supplier ?? info.beneficiary,
      sourceType: owner.parent === "EVENT" ? "EVENT" : owner.parent,
      sourceId: info.id,
      requestedById: user.id,
      // Le budget CHOISI à la validation suit la dépense jusqu'aux Finances : plus de
      // ré-imputation à la main, plus de dépense qui traîne dans « à imputer ».
      budgetCategoryId: item.budgetCategoryId ?? null,
      notes: `Poste de l'opération ${info.ref}.`,
    });

    // Rattachement APRÈS création : si l'écriture échoue, on a une pièce orpheline visible côté
    // Finances plutôt qu'un poste qui se croit payé sans l'être.
    await prisma.adProItem.update({ where: { id }, data: { expenseOrderId: order.id, orderStage: "ISSUED", updatedById: user.id } });

    await audit(user, owner.parent, owner.id, "UPDATE",
      `Ordre de dépense ${order.reference} émis pour le poste « ${item.label} » — ${(amount as number).toLocaleString("fr-FR")} DZD au profit de ${item.supplier ?? info.beneficiary}.`);
    revalidate(owner.parent, owner.id);
    revalidatePath("/finances/paiements-a-faire");
    return { ok: true, id: order.id };
  } catch (err) {
    console.error("[ad-pro-item] émission de l'ordre impossible", err);
    return { ok: false, error: "L'ordre de dépense n'a pas pu être émis." };
  }
}

// ───────────────────────────── Matériel promotionnel ─────────────────────────────

/**
 * Rattache un matériel promotionnel EXISTANT à un poste.
 *
 * On ne recopie jamais son état ici : le matériel suit son propre circuit et l'opération en lit
 * l'avancement. Deux vérités sur le même objet finiraient toujours par diverger.
 */
export async function linkPromoMaterial(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();

  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Poste non précisé." };
  const found = await loadItem(id, user);
  if (!found) return { ok: false, error: "Poste introuvable." };
  const { item, owner } = found;
  if (!canEditItems(user, owner.parent)) return { ok: false, error: "Non autorisé." };
  // Rattacher un dossier d'ACHAT ferait de ce poste un poste « Matériel promotionnel » (la nature
  // change ci-dessous) — et laisserait ses lignes de stock à une nature qui ne sait plus les rendre.
  const refusStock = refusArgentSurPosteStock(item.kind, "un dossier d'achat de matériel promotionnel");
  if (refusStock) return { ok: false, error: refusStock };

  const promoMaterialId = fdStr(formData, "promoMaterialId");
  if (promoMaterialId) {
    const pm = await prisma.promoMaterial.findUnique({ where: { id: promoMaterialId }, select: { reference: true } });
    if (!pm) return { ok: false, error: "Matériel promotionnel introuvable." };
    await prisma.adProItem.update({ where: { id }, data: { promoMaterialId, kind: "PROMO_MATERIAL", updatedById: user.id } });
    await audit(user, owner.parent, owner.id, "UPDATE", `Poste « ${item.label} » rattaché au matériel ${pm.reference}.`);
  } else {
    await prisma.adProItem.update({ where: { id }, data: { promoMaterialId: null, updatedById: user.id } });
    await audit(user, owner.parent, owner.id, "UPDATE", `Poste « ${item.label} » détaché de son matériel promotionnel.`);
  }

  revalidate(owner.parent, owner.id);
  return { ok: true, id };
}

/** Les matériels promotionnels rattachables — pour le sélecteur, sans exposer tout le module. */
export async function promoMaterialOptions(): Promise<{ id: string; reference: string; title: string; status: string }[]> {
  const user = await requireUser();
  if (!canEditItems(user, "SPONSORING") && !canEditItems(user, "CONGRESS_NATIONAL")) return [];
  const rows = await prisma.promoMaterial.findMany({
    where: { status: { not: "CANCELLED" } },
    orderBy: { createdAt: "desc" },
    take: 60,
    select: { id: true, reference: true, title: true, status: true },
  });
  return rows.map((r) => ({ ...r, status: String(r.status) }));
}

// ───────────────────────── Validation du poste (Direction) ─────────────────────────

/** Trace une décision SANS écraser la précédente : le 3ᵉ tour ne doit pas effacer les deux refus. */
async function recordDecision(itemId: string, decision: AdProItemStatus, note: string | null, amount: number | null, byId: string) {
  await prisma.adProItemDecision.create({
    data: { itemId, decision, note, amount, byId },
  }).catch(() => undefined);
}

/**
 * SOUMET un poste à la Direction. Le demandeur décrit, chiffre, joint ses devis, puis envoie —
 * poste par poste. Un poste en « budget à revoir » se resoumet autant de fois qu'il le faut.
 */
export async function submitAdProItem(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Poste non précisé." };
  const found = await loadItem(id, user);
  if (!found) return { ok: false, error: "Poste introuvable." };
  const { item, owner } = found;
  if (!canEditItems(user, owner.parent)) return { ok: false, error: "Non autorisé." };
  const clos = await refusSiClos(owner.parent, owner.id);
  if (clos) return { ok: false, error: clos };

  const check = canSubmitItem({
    status: item.status,
    amountEstimated: item.amountEstimated != null ? toNumber(item.amountEstimated) : null,
    amountGranted: item.amountGranted != null ? toNumber(item.amountGranted) : null,
    kind: item.kind,
    lignesStock: item.kind === "STOCK_MATERIAL" ? await prisma.adProStockLine.count({ where: { itemId: id } }) : 0,
  });
  if (!check.ok) return { ok: false, error: check.reason ?? "Soumission impossible." };

  const note = fdStr(formData, "note");
  const amount = item.amountGranted ?? item.amountEstimated;
  await prisma.adProItem.update({
    where: { id },
    data: { status: "PENDING", submittedAt: new Date(), decisionNote: null, updatedById: user.id },
  });
  await recordDecision(id, "PENDING", note, amount != null ? toNumber(amount) : null, user.id);

  const info = await PARENTS[owner.parent].load(owner.id);
  // LE SPONSORING : C'EST LA DIRECTION MARKETING QUI VALIDE SES POSTES (§118.151) — « elle peut
  // tout valider et mettre chaque poste dans un budget ». La prévenir en plus de la Direction, et
  // non à sa place : la Direction garde le droit de décider un poste (vue globale), et la retirer
  // de la notification ferait taire un validateur qui existe toujours.
  const valideurs: UserRole[] = owner.parent === "SPONSORING"
    ? [ROLE_DIRECTION_MARKETING, "DIRECTION", "SUPER_ADMIN"]
    : ["DIRECTION", "SUPER_ADMIN"];
  await notifyRoles(valideurs, {
    type: "VALIDATION_REQUIRED",
    title: "Poste à valider",
    body: `${info?.ref ?? "Opération"} — ${ITEM_KIND_LABELS[item.kind]} « ${item.label} »${amount != null ? ` (${toNumber(amount).toLocaleString("fr-FR")} DZD)` : ""}`,
    link: `${PARENTS[owner.parent].path}/${owner.id}`,
  }).catch(() => undefined);
  await audit(user, owner.parent, owner.id, "UPDATE", `Poste « ${item.label} » soumis à la Direction.`);
  revalidate(owner.parent, owner.id);
  return { ok: true, id };
}

/**
 * DÉCISION de la Direction sur UN poste : accorder, refuser, ou demander à revoir le budget.
 * La révision n'est pas une fin : elle rend la main au demandeur, qui corrige et resoumet — le
 * va-et-vient peut se répéter, chaque tour restant dans l'historique.
 */
export async function decideAdProItem(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  const decision = fdStr(formData, "decision");
  if (!id || !decision) return { ok: false, error: "Décision incomplète." };
  if (!["APPROVED", "REJECTED", "REVISION"].includes(decision)) return { ok: false, error: "Décision inconnue." };

  const found = await loadItem(id, user);
  if (!found) return { ok: false, error: "Poste introuvable." };
  const { item, owner } = found;
  if (!canAllocate(user, owner.parent)) return { ok: false, error: "Seule la Direction décide d'un poste." };
  const clos = await refusSiClos(owner.parent, owner.id);
  if (clos) return { ok: false, error: clos };
  if (item.status === "APPROVED" && item.orderStage === "ISSUED") {
    return { ok: false, error: "Le bon de commande de ce poste a été émis : sa décision ne peut plus changer." };
  }
  // UN SPONSORING INDIRECT NON RÉPARTI NE S'ACCORDE PAS (§118.175). L'accorder d'un seul tenant
  // ouvrirait UN bon de commande, à UN fournisseur, pour l'imprimerie ET l'hôtellerie — exactement
  // ce que la répartition existe pour empêcher. Le refuser ou le renvoyer en révision reste
  // possible : ces gestes ne paient rien, et la révision est le chemin qui rouvre la répartition.
  if (item.kind === "INDIRECT_SUPPORT" && decision === "APPROVED") return { ok: false, error: REFUS_INDIRECT_NON_REPARTI };

  const note = fdStr(formData, "note");
  // En accordant, la Direction peut arrêter le montant du poste (c'est le geste naturel :
  // « d'accord, mais pour 120 000 »). Sans montant saisi, l'estimation fait foi.
  const granted = fdNum(formData, "amountGranted");
  if (granted != null && granted < 0) return { ok: false, error: "Un montant ne peut pas être négatif." };
  const status = decision as AdProItemStatus;

  // `tx` et non un autre nom : la dérivation des contrats lit `prisma.X` et `tx.X` pour dire ce que
  // l'action écrit (§118.137) — un paramètre nommé autrement faisait disparaître le poste de la
  // carte de confirmation, et `id` ne désignait plus rien pour le chemin générique.
  const ecrireDecision = (tx: Tx | typeof prisma) => tx.adProItem.update({
    where: { id },
    data: {
      status,
      decidedAt: new Date(),
      decidedById: user.id,
      decisionNote: note,
      ...(status === "APPROVED" && item.kind !== "STOCK_MATERIAL"
        ? { amountGranted: granted ?? item.amountGranted ?? item.amountEstimated ?? null }
        : {}),
      updatedById: user.id,
    },
  });
  if (item.kind === "STOCK_MATERIAL") {
    // LE MATÉRIEL DU STOCK SE RÉSERVE À L'ACCORD (§118.167) — dans la MÊME transaction que la
    // décision : un poste « accordé » dont le matériel n'a pas pu être réservé promettrait au
    // demandeur des kakémonos que le magasin n'a pas. Un refus ou une révision rend au magasin ce
    // qu'un accord précédent avait réservé.
    const r = await deciderMaterielStock(id, status, user.id, ecrireDecision);
    if (!r.ok) return { ok: false, error: r.error };
  } else {
    await ecrireDecision(prisma);
  }
  await recordDecision(id, status, note, granted ?? (item.amountGranted != null ? toNumber(item.amountGranted) : null), user.id);
  // LA DEMANDE SUIT : une rallonge accordée (ou retirée) change le montant de l'opération.
  await reprojeterMontantDemande(owner.parent, owner.id);

  const info = await PARENTS[owner.parent].load(owner.id);
  const label = status === "APPROVED" ? "accordé" : status === "REJECTED" ? "refusé" : "à revoir (budget)";
  if (info?.requesterId && info.requesterId !== user.id) {
    await notifyUser({
      userId: info.requesterId,
      type: "GENERIC",
      title: `Poste ${label}`,
      body: `${info.ref} — « ${item.label} »${note ? ` : ${note}` : ""}`,
      link: `${PARENTS[owner.parent].path}/${owner.id}`,
    }).catch(() => undefined);
  }
  await audit(user, owner.parent, owner.id, "UPDATE", `Poste « ${item.label} » ${label}${note ? ` — ${note}` : ""}.`);
  revalidate(owner.parent, owner.id);
  return { ok: true, id };
}

/** Choix du BUDGET qui portera un poste accordé (catégorie d'enveloppe) — « comme d'habitude ». */
export async function setAdProItemBudget(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Poste non précisé." };
  const found = await loadItem(id, user);
  if (!found) return { ok: false, error: "Poste introuvable." };
  const { item, owner } = found;
  if (!canAllocate(user, owner.parent)) return { ok: false, error: "Seule la Direction impute un poste à un budget." };
  const refusStock = refusArgentSurPosteStock(item.kind, "un budget");
  if (refusStock) return { ok: false, error: refusStock };
  const clos = await refusSiClos(owner.parent, owner.id);
  if (clos) return { ok: false, error: clos };
  if (item.status !== "APPROVED") return { ok: false, error: "Le poste doit d'abord être accordé." };

  const budgetCategoryId = fdStr(formData, "budgetCategoryId");
  if (budgetCategoryId) {
    const cat = await prisma.budgetCategoryLine.findUnique({
      where: { id: budgetCategoryId },
      select: { name: true, envelope: { select: { name: true } } },
    });
    if (!cat) return { ok: false, error: "Catégorie budgétaire introuvable." };
    await prisma.adProItem.update({ where: { id }, data: { budgetCategoryId, updatedById: user.id } });
    await audit(user, owner.parent, owner.id, "UPDATE", `Poste « ${item.label} » imputé au budget ${cat.envelope.name} › ${cat.name}.`);
  } else {
    await prisma.adProItem.update({ where: { id }, data: { budgetCategoryId: null, updatedById: user.id } });
    await audit(user, owner.parent, owner.id, "UPDATE", `Poste « ${item.label} » : imputation budgétaire retirée.`);
  }
  revalidate(owner.parent, owner.id);
  return { ok: true, id };
}

// ───────────────────────── Devis et facture : demandes au secrétariat ─────────────────────────

/** Les demandes de pièce OUVERTES d'un poste, lues par le lien CANONIQUE. */
async function piecesOuvertes(itemId: string): Promise<NaturePieceSecretariat[]> {
  const rows = await prisma.administrativeRequest.findMany({
    where: {
      linkedEntityType: "AD_PRO_ITEM", linkedEntityId: itemId, deletedAt: null,
      status: { notIn: ["DONE", "CANCELLED"] },
    },
    select: { type: true },
  });
  const types = new Set(rows.map((r) => String(r.type)));
  return NATURES_PIECE_SECRETARIAT.filter((n) => types.has(String(PIECE_SECRETARIAT[n].type)));
}

/**
 * DEMANDER UNE PIÈCE COMMERCIALE AU BUREAU DU SECRÉTARIAT — un seul écrivain, deux natures.
 *
 * « On peut demander un devis pas que un BC […] après le BC, une facture. » Le devis et la
 * facture sont la MÊME démarche — une demande au secrétariat, avec un message qui porte le
 * contenu et les références — et ce message est ce que le dirigeant a nommé le premier. Le
 * bon de commande, lui, garde son circuit : il ENGAGE, donc il porte un visa (§118.5).
 *
 * Le rattachement se fait par le lien CANONIQUE (`linkedEntityType` / `linkedEntityId`), pas par
 * une colonne dédiée : c'est lui que l'écran des demandes lit déjà pour savoir qu'une dépense
 * vient d'Ad & Pro et ne doit PAS être imputée une seconde fois au budget d'un département.
 * Mesuré : la demande de devis d'un poste ne le posait pas, donc l'assistante pouvait imputer
 * chez elle une dépense que l'enveloppe de l'opération porte déjà — un double comptage sans
 * aucune erreur visible.
 */
export async function demanderPieceSecretariat(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  const brut = fdStr(formData, "nature") ?? "DEVIS";
  const nature = (NATURES_PIECE_SECRETARIAT as string[]).includes(brut)
    ? (brut as NaturePieceSecretariat)
    : null;
  if (!id) return { ok: false, error: "Poste non précisé." };
  if (!nature) return { ok: false, error: `Nature de pièce inconnue : ${brut}. Attendu : ${NATURES_PIECE_SECRETARIAT.join(", ")}.` };
  const found = await loadItem(id, user);
  if (!found) return { ok: false, error: "Poste introuvable." };
  const { item, owner } = found;
  if (!canEditItems(user, owner.parent)) return { ok: false, error: "Non autorisé." };
  const refusStock = refusArgentSurPosteStock(item.kind, "un devis, un bon de commande ou une facture");
  if (refusStock) return { ok: false, error: refusStock };

  const garde = peutDemanderPiece(nature, {
    ouvertes: await piecesOuvertes(id),
    bcDemande: item.orderStage !== "NONE",
  });
  if (!garde.ok) return { ok: false, error: garde.raison };

  const info = await PARENTS[owner.parent].load(owner.id);
  if (!info) return { ok: false, error: "Opération introuvable." };
  const spec = PIECE_SECRETARIAT[nature];
  // LE MESSAGE DE LA PERSONNE EN TÊTE : c'est ce qu'elle a écrit, et ce que l'assistante lit en
  // premier. Les rappels du moteur (prestataire, enveloppe) viennent après, jamais à sa place.
  const note = fdStr(formData, "note");

  try {
    // La série DEM est PARTAGÉE avec le bureau du secrétariat, qui réessayait sous collision ; ce
    // chemin-ci non, et deux demandes à la même seconde faisaient échouer la seconde (§118.175).
    const request = await createWithRetry(async () => prisma.administrativeRequest.create({
      data: {
        reference: await nextAdminRequestRef(),
        type: spec.type,
        title: titrePiece(nature, `${ITEM_KIND_LABELS[item.kind]} : ${item.label}`, info.ref),
        description: [
          note,
          `Poste de l'opération ${info.ref}.`,
          item.supplier ? `Prestataire pressenti : ${item.supplier}.` : null,
          item.amountEstimated != null ? `Enveloppe estimée : ${toNumber(item.amountEstimated).toLocaleString("fr-FR")} DZD.` : null,
        ].filter(Boolean).join("\n"),
        priority: "HIGH",
        requesterId: user.id,
        // La société de l'OPÉRATION, sinon celle où travaille son demandeur (`moneyEntityOf`) : une
        // opération d'avant le rattachement a `companyId` nul, et sa pièce naîtrait invisible du
        // bureau du secrétariat, cloisonné par société (§118.154).
        companyId: info.companyId ?? (await moneyEntityOf(info.requesterId ?? user.id)),
        status: "NEW",
        linkedEntityType: "AD_PRO_ITEM",
        linkedEntityId: item.id,
      },
      select: { id: true, reference: true },
    }));
    // `adminRequestId` reste le RACCOURCI du devis (relation `AdProItemQuoteRequest`, posée
    // avant le lien canonique) : on ne le LIT plus nulle part, mais l'écrire garde le
    // `onDelete: SetNull` utile et évite une migration de colonne pour rien.
    if (nature === "DEVIS") {
      await prisma.adProItem.update({ where: { id }, data: { adminRequestId: request.id, updatedById: user.id } });
    }
    await notifyRoles(["DIRECTION_ASSISTANT", "SUPER_ADMIN"], {
      type: "ASSIGNMENT",
      title: `Demande de ${spec.libelle.toLowerCase()}`,
      body: `${request.reference} — ${item.label} (${info.ref})`,
      link: `/demandes/${request.id}`,
    }).catch(() => undefined);
    await audit(user, owner.parent, owner.id, "UPDATE", `Demande de ${spec.libelle.toLowerCase()} ${request.reference} ouverte pour le poste « ${item.label} ».`);
    revalidate(owner.parent, owner.id);
    revalidatePath("/demandes");
    return { ok: true, id: request.id };
  } catch (err) {
    console.error("[ad-pro-item] demande de pièce impossible", err);
    return { ok: false, error: `La demande de ${spec.libelle.toLowerCase()} n'a pas pu être créée.` };
  }
}

/** Référence d'une demande administrative — même forme que le module (DEM-année-n). */
async function nextAdminRequestRef(): Promise<string> {
  const year = new Date().getFullYear();
  const rows = await prisma.administrativeRequest.findMany({
    where: { reference: { startsWith: `DEM-${year}-` } },
    select: { reference: true },
  });
  return buildRef("DEM", year, rows.map((r) => r.reference));
}

// ───────────────────────── Bon de commande : demande → centre Ad & Pro → Finances ─────────────────────────

/** DEMANDE d'émission du bon de commande d'un poste accordé (première marche du circuit). */
export async function requestAdProItemOrder(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Poste non précisé." };
  const found = await loadItem(id, user);
  if (!found) return { ok: false, error: "Poste introuvable." };
  const { item, owner } = found;
  if (!canEditItems(user, owner.parent)) return { ok: false, error: "Non autorisé." };
  const refusStock = refusArgentSurPosteStock(item.kind, "un bon de commande");
  if (refusStock) return { ok: false, error: refusStock };

  const check = canRequestPurchaseOrder({
    status: item.status,
    amountGranted: item.amountGranted != null ? toNumber(item.amountGranted) : null,
    budgetCategoryId: item.budgetCategoryId,
    orderStage: item.orderStage,
  });
  if (!check.ok) return { ok: false, error: check.reason ?? "Demande impossible." };

  const note = fdStr(formData, "note");
  // LE SEUIL DES BONS DE COMMANDE (§118.149) — « tout BC SUPÉRIEUR à un montant configuré dans
  // les centres de validations devra passer par la validation d'un des centres ». En deçà, aucun
  // centre n'a à le viser : la demande passe directement aux Finances. `orderDirectionAt` reste
  // NUL — c'est ce qui distingue, sur la fiche, « validé par le centre » de « sous le seuil » :
  // afficher le premier sur un BC qu'aucun centre n'a vu serait une attestation inventée.
  const montantAccorde = toNumber(item.amountGranted!);
  const seuilBC = (await getAppSettings()).bcValidationThreshold;
  const sousLeSeuil = !validationRequiseBC(montantAccorde, seuilBC);
  await prisma.adProItem.update({
    where: { id },
    data: sousLeSeuil
      ? {
          orderStage: "DIRECTION_OK", orderRequestedAt: new Date(), orderRequestedById: user.id, orderNote: note,
          orderDecisionNote: motifSousLeSeuil(seuilBC), orderDirectionAt: null, orderDirectionById: null, updatedById: user.id,
        }
      : { orderStage: "REQUESTED", orderRequestedAt: new Date(), orderRequestedById: user.id, orderNote: note, updatedById: user.id },
  });
  const info = await PARENTS[owner.parent].load(owner.id);
  const cible = `${info?.ref ?? ""} — « ${item.label} » (${montantAccorde.toLocaleString("fr-FR")} DZD)`;
  if (sousLeSeuil) {
    // Les Finances émettent — exactement ce que le visa du centre aurait déclenché.
    await notifyRoles(["FINANCE_BUDGET_MANAGER", "SUPER_ADMIN"], {
      type: "VALIDATION_REQUIRED",
      title: "Bon de commande sous le seuil — à émettre",
      body: cible,
      link: `${PARENTS[owner.parent].path}/${owner.id}`,
    }).catch(() => undefined);
  } else {
    // TOUT BC NÉ D'AD & PRO AU-DESSUS DU SEUIL PASSE PAR LE CENTRE DE VALIDATION AD & PRO
    // (§118.148) : ses sièges sont prévenus, et le lien mène au CENTRE, où la ligne attend.
    await notifyRoles(["GENERAL_MANAGER", "SUPER_ADMIN"], {
      type: "VALIDATION_REQUIRED",
      title: "Bon de commande à valider",
      body: cible,
      link: "/centre-ad-pro",
    }).catch(() => undefined);
  }
  // L'ASSISTANTE DE DIRECTION ÉTABLIT LE BON DE COMMANDE — « demander l'établissement d'un BC
  // qui arrivera à l'assistante de direction pour chaque poste ». Elle n'était prévenue de rien :
  // la demande partait au visa, et l'assistante apprenait après coup qu'il fallait rédiger la
  // pièce. On AJOUTE un destinataire, on ne retire aucune garde — le visa du centre reste ce qui
  // engage, et c'est un geste distinct de l'établissement du document.
  await notifyRoles(["DIRECTION_ASSISTANT"], {
    type: "ASSIGNMENT",
    title: "Bon de commande à établir",
    body: cible,
    link: `${PARENTS[owner.parent].path}/${owner.id}`,
  }).catch(() => undefined);
  await audit(user, owner.parent, owner.id, "UPDATE", sousLeSeuil
    ? `Émission du bon de commande demandée pour le poste « ${item.label} » — ${motifSousLeSeuil(seuilBC)}`
    : `Émission du bon de commande demandée pour le poste « ${item.label} ».`);
  revalidate(owner.parent, owner.id);
  if (!sousLeSeuil) revalidatePath("/centre-ad-pro");
  return {
    ok: true, id,
    message: sousLeSeuil
      ? `${motifSousLeSeuil(seuilBC)} L'assistante de direction est prévenue pour l'établir.`
      : "Demande d'émission envoyée au centre de validation Ad & Pro.",
  };
}

/**
 * VISA DU CENTRE DE VALIDATION AD & PRO sur la demande d'émission — puis les Finances émettent.
 * Deux marches, parce que ce sont deux responsabilités : le centre engage, les Finances paient.
 *
 * ── POURQUOI LE CENTRE, ET PLUS « LA DIRECTION » ─────────────────────────────────────────
 *
 * « Concernant les BC, ils doivent tous passer soit par le centre de validation Ad&Pro si la
 * demande est depuis Ad&Pro, soit par le centre de validation normal » (Direction, 09/2026). Le
 * visa était donné par quiconque avait la vue globale ou VALIDATE sur le module — la Direction
 * des opérations, la Direction Marketing : aucun centre ne voyait passer ces BC. Il revient aux
 * SIÈGES du centre (`siegeAuCentreAdPro`), et le centre les LIT (`queries/ad-pro-centre.ts`) :
 * décider depuis la fiche ou depuis le centre appelle la MÊME action, avec la même garde.
 *
 * La note de la Direction a son PROPRE champ. Elle vivait dans `orderNote`, où le demandeur
 * avait écrit le contenu du bon de commande et ses références : chaque visa l'EFFAÇAIT, et
 * personne ne s'en apercevait — mesuré, la colonne avait trois écrivains et aucun lecteur.
 * L'assistante devait donc redemander à la main ce que le circuit avait déjà transporté.
 */
export async function approveAdProItemOrder(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  const decision = fdStr(formData, "decision") ?? "APPROVE";
  if (!id) return { ok: false, error: "Poste non précisé." };
  const found = await loadItem(id, user);
  if (!found) return { ok: false, error: "Poste introuvable." };
  const { item, owner } = found;
  if (!siegeAuCentreAdPro(user)) return { ok: false, error: REFUS_BC_CENTRE_AD_PRO };
  if (item.orderStage !== "REQUESTED") return { ok: false, error: "Aucune demande d'émission en attente sur ce poste." };

  const note = fdStr(formData, "note");
  const info = await PARENTS[owner.parent].load(owner.id);
  const lien = `${PARENTS[owner.parent].path}/${owner.id}`;
  const cible = `${info?.ref ?? ""} — « ${item.label} » (${toNumber(item.amountGranted!).toLocaleString("fr-FR")} DZD)`;
  if (decision === "REFUSE") {
    // UN REFUS SANS MOTIF EST UNE IMPASSE pour le demandeur — la règle du centre, ici aussi.
    // `=== null` et non `!note` : la dérivation des contrats lit `if (!v)` comme « champ
    // OBLIGATOIRE » pour toute l'action, et le motif n'est exigé que pour un REFUS — l'approbation
    // sans note deviendrait inappelable par le chemin générique (§118.87c, §118.138).
    if (note === null) return { ok: false, error: "Indiquez le motif du refus : sans lui, le demandeur ne sait pas quoi corriger." };
    await prisma.adProItem.update({ where: { id }, data: { orderStage: "REFUSED", orderDecisionNote: note, updatedById: user.id } });
    await audit(user, owner.parent, owner.id, "UPDATE", `Bon de commande REFUSÉ par le centre de validation Ad & Pro pour « ${item.label} » — ${note}.`);
    if (item.orderRequestedById) {
      await notifyUser({
        userId: item.orderRequestedById, type: "VALIDATION_REQUIRED",
        title: "Bon de commande refusé par le centre Ad & Pro", body: `${cible} — ${note}`, link: lien,
      }).catch(() => undefined);
    }
    revalidate(owner.parent, owner.id);
    revalidatePath("/centre-ad-pro");
    return { ok: true, id };
  }

  await prisma.adProItem.update({
    where: { id },
    data: { orderStage: "DIRECTION_OK", orderDirectionAt: new Date(), orderDirectionById: user.id, orderDecisionNote: note, updatedById: user.id },
  });
  await notifyRoles(["FINANCE_BUDGET_MANAGER", "SUPER_ADMIN"], {
    type: "VALIDATION_REQUIRED",
    title: "Bon de commande validé — à émettre",
    body: cible,
    link: lien,
  }).catch(() => undefined);
  if (item.orderRequestedById) {
    await notifyUser({
      userId: item.orderRequestedById, type: "GENERIC",
      title: "Bon de commande validé par le centre Ad & Pro", body: `${cible} — transmis aux Finances.`, link: lien,
    }).catch(() => undefined);
  }
  await audit(user, owner.parent, owner.id, "UPDATE", `Bon de commande validé par le centre de validation Ad & Pro pour « ${item.label} » — transmis aux Finances.`);
  // LA PIÈCE EXISTE PEUT-ÊTRE DÉJÀ (§118.149) : l'assistante l'a établie pendant que le centre
  // tranchait. Le visa du poste EST sa porte (`PorteBC.source = "POSTE"`) — elle passe donc
  // maintenant à la signature des Finances, qui doivent le savoir. Une pièce qui n'existe pas
  // encore les préviendra elle-même en naissant (l'aiguillage lit alors un poste validé).
  const piecesDuPoste = await prisma.documentRequest.findMany({
    where: { entityType: "AD_PRO_ITEM", entityId: id, legalDocumentId: { not: null } },
    select: { legalDocumentId: true },
  }).catch(() => []);
  for (const p of piecesDuPoste) {
    if (p.legalDocumentId) await signalerSiASigner(p.legalDocumentId).catch(() => false);
  }
  revalidate(owner.parent, owner.id);
  revalidatePath("/centre-ad-pro");
  if (piecesDuPoste.length > 0) revalidatePath(CHEMIN_BC_A_SIGNER);
  return { ok: true, id };
}

// ─────────────────────── Le matériel du stock d'un événement (§118.167) ───────────────────────

/** Un poste « Matériel du stock » se compose tant qu'il n'est ni soumis ni accordé. */
const POSTE_STOCK_EDITABLE = new Set<AdProItemStatus>(["DRAFT", "REVISION", "REJECTED"]);

/** Le libellé lisible d'un article du stock (« Fiche posologique — Nivolex »). */
async function libellesArticles(ids: readonly string[]): Promise<Map<string, { libelle: string; famille: PromoFamille }>> {
  if (ids.length === 0) return new Map();
  const items = await prisma.promoStockItem.findMany({
    where: { id: { in: [...ids] } },
    select: {
      id: true,
      catalogue: { select: { nom: true, famille: true } },
      produits: { select: { product: { select: { canonicalName: true } } } },
    },
  });
  return new Map(items.map((it) => [it.id, {
    libelle: libelleArticleStock(it.catalogue.nom, it.produits.map((p) => p.product.canonicalName)),
    famille: it.catalogue.famille as PromoFamille,
  }]));
}

/**
 * LA DÉCISION D'UN POSTE « MATÉRIEL DU STOCK » — la réservation (ou sa restitution) et la décision
 * s'écrivent ENSEMBLE, sous le verrou de chaque article. Au-delà de ce que le magasin a de
 * distribuable, l'accord est refusé en entier, ligne nommée : rien n'est accordé, rien n'est réservé.
 */
async function deciderMaterielStock(
  itemId: string,
  status: AdProItemStatus,
  auteurId: string,
  ecrireDecision: (client: Tx) => Promise<unknown>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const lignes = await prisma.adProStockLine.findMany({
    where: { itemId },
    select: { id: true, stockItemId: true, quantite: true, statut: true },
  });
  if (lignes.some((l) => l.statut === "CONFIRMEE")) {
    return { ok: false, error: "Le matériel de ce poste a déjà été confirmé après l'événement : sa décision ne peut plus changer." };
  }
  if (status === "APPROVED" && lignes.length === 0) {
    return { ok: false, error: "Ce poste ne liste aucun article du stock : il n'y a rien à accorder." };
  }
  const libelles = await libellesArticles(lignes.map((l) => l.stockItemId));
  const motif = "Réservé pour l'événement (poste « Matériel du stock » accordé)";
  class Refus extends Error {}
  try {
    await sousVerrous(lignes.map((l) => l.stockItemId), async (tx) => {
      // RELIRE SOUS LE VERROU : un autre accord du même poste a pu passer entre-temps.
      const actuelles = await tx.adProStockLine.findMany({ where: { itemId }, select: { id: true, stockItemId: true, quantite: true, statut: true } });
      if (status === "APPROVED") {
        for (const l of actuelles.filter((x) => x.statut === "DEMANDEE")) {
          const q = toNumber(l.quantite);
          const r = await reserverPourEvenement(tx, l.stockItemId, { ligneId: l.id, quantite: q, motif, auteurId, maintenant: new Date() });
          if (!r.ok) throw new Refus(refusReservation(libelles.get(l.stockItemId)?.libelle ?? "Article", q, r.refus));
          await tx.adProStockLine.update({ where: { id: l.id }, data: { statut: "RESERVEE", reserveeLe: new Date(), reserveeParId: auteurId } });
        }
      } else {
        for (const l of actuelles.filter((x) => x.statut === "RESERVEE")) {
          await rendreAuMagasin(tx, l.stockItemId, { ligneId: l.id, quantite: toNumber(l.quantite), motif: `Poste ${status === "REJECTED" ? "refusé" : "à revoir"} : la réservation revient au magasin`, auteurId });
          await tx.adProStockLine.update({ where: { id: l.id }, data: { statut: "DEMANDEE", reserveeLe: null, reserveeParId: null } });
        }
      }
      await ecrireDecision(tx);
    });
  } catch (e) {
    if (e instanceof Refus) return { ok: false, error: e.message };
    throw e;
  }
  revalidatePath(CHEMIN_STOCK_PROMO);
  return { ok: true };
}

/**
 * AJOUTER (OU REQUANTIFIER) UN ARTICLE DU STOCK SUR LE POSTE. Le demandeur pioche dans le MAGASIN
 * de la société de l'opération ; rien ne bouge au magasin avant l'accord. Une quantité à zéro
 * retire l'article. Un support numérique n'a pas de quantité : il ne se réserve pas.
 */
export async function ajouterArticleStockAuPoste(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const itemId = fdStr(formData, "itemId");
  const stockItemId = fdStr(formData, "stockItemId");
  if (!itemId || !stockItemId) return { ok: false, error: "Choisissez l'article du stock." };
  const quantite = fdNum(formData, "quantite");
  if (quantite == null || !Number.isFinite(quantite) || quantite < 0) return { ok: false, error: "Indiquez une quantité (0 pour retirer l'article)." };
  const found = await loadItem(itemId, user);
  if (!found) return { ok: false, error: "Poste introuvable." };
  const { item, owner } = found;
  if (!canEditItems(user, owner.parent)) return { ok: false, error: "Non autorisé." };
  const info = await PARENTS[owner.parent].load(owner.id);
  if (!info) return { ok: false, error: "Opération introuvable." };
  const clos = refusPostesClos(info);
  if (clos) return { ok: false, error: clos };
  if (item.kind !== "STOCK_MATERIAL") return { ok: false, error: "Ce poste n'est pas un poste « Matériel du stock »." };
  if (!POSTE_STOCK_EDITABLE.has(item.status)) {
    return { ok: false, error: item.status === "APPROVED"
      ? "Ce poste est accordé et son matériel réservé : sa liste ne change plus (la Direction peut le remettre « à revoir »)."
      : "Ce poste attend la décision de la Direction : sa liste ne change pas pendant ce temps." };
  }
  const article = await articleDansMonPerimetre(user.id, stockItemId);
  if (!article || !article.isActive) return { ok: false, error: "Article du stock introuvable ou archivé." };
  if (!familleQuantifiee(article.catalogue.famille as PromoFamille)) return { ok: false, error: "Un support numérique se présente, il ne se réserve pas." };
  if (info.companyId && article.companyId && article.companyId !== info.companyId) {
    return { ok: false, error: "Cet article appartient au magasin d'une autre société que celle de l'opération." };
  }
  const libelle = libelleArticleStock(article.catalogue.nom, article.produits.map((p) => p.product.canonicalName));
  if (quantite === 0) {
    await prisma.adProStockLine.deleteMany({ where: { itemId, stockItemId, statut: "DEMANDEE" } });
  } else {
    await prisma.adProStockLine.upsert({
      where: { itemId_stockItemId: { itemId, stockItemId } },
      create: { itemId, stockItemId, quantite, createdById: user.id },
      update: { quantite },
    });
  }
  await audit(user, owner.parent, owner.id, "UPDATE", quantite === 0
    ? `Poste « ${item.label} » : « ${libelle} » retiré du matériel demandé.`
    : `Poste « ${item.label} » : ${quantite.toLocaleString("fr-FR")} « ${libelle} » demandé(s) au magasin.`);
  revalidate(owner.parent, owner.id);
  return { ok: true, id: itemId };
}

/**
 * CONFIRMER LE MATÉRIEL APRÈS L'ÉVÉNEMENT (§118.167). Un consommable : combien ont été remis (le
 * reste revient). Un durable PRÊTÉ : combien sont rendus, abîmés, perdus — la somme doit faire le
 * compte réservé. Tout ce qui ne va pas est dit en une fois ; sinon le reste revient au magasin par
 * la même écriture, dans les lots d'où il était sorti, et la magasinière en est prévenue.
 *
 * Confirmer « 0 remis » avant l'événement est aussi la façon d'annuler une réservation.
 * Qui confirme : le demandeur (il a tenu l'événement), la gestionnaire du magasin (elle reçoit le
 * retour), la Direction qui décide des postes, ou le Super Admin.
 */
export async function confirmerMaterielStock(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const itemId = fdStr(formData, "itemId");
  if (!itemId) return { ok: false, error: "Poste non précisé." };
  const found = await loadItem(itemId, user);
  if (!found) return { ok: false, error: "Poste introuvable." };
  const { item, owner } = found;
  if (item.kind !== "STOCK_MATERIAL") return { ok: false, error: "Ce poste n'est pas un poste « Matériel du stock »." };
  const info = await PARENTS[owner.parent].load(owner.id);
  if (!info) return { ok: false, error: "Opération introuvable." };
  const gestionnaires = await gestionnairesDuMagasin();
  const peut = peutConfirmerMateriel({
    superAdmin: user.role === "SUPER_ADMIN",
    estLeDemandeur: info.requesterId === user.id,
    gereLeMagasin: gestionnaires.includes(user.id),
    decideLesPostes: canAllocate(user, owner.parent),
  });
  if (!peut) return { ok: false, error: REFUS_CONFIRMATION_MATERIEL };

  const lignes = await prisma.adProStockLine.findMany({ where: { itemId, statut: "RESERVEE" }, select: { id: true, stockItemId: true, quantite: true } });
  if (lignes.length === 0) return { ok: false, error: "Aucun matériel réservé n'attend de confirmation sur ce poste." };
  const libelles = await libellesArticles(lignes.map((l) => l.stockItemId));
  const ids = formData.getAll("ligneId").map(String);
  const champ = (nom: string, i: number) => formData.getAll(nom)[i];
  const fautes: string[] = [];
  const decisions = new Map<string, Confirmation>();
  for (const l of lignes) {
    const i = ids.indexOf(l.id);
    const meta = libelles.get(l.stockItemId);
    const libelle = meta?.libelle ?? "Article";
    if (i < 0) { fautes.push(`« ${libelle} » : rien n'est déclaré`); continue; }
    const r = lireConfirmation(meta?.famille ?? "CONSOMMABLE", toNumber(l.quantite), {
      utilisee: champ("utilisee", i), rendue: champ("rendue", i), abimee: champ("abimee", i), perdue: champ("perdue", i),
    }, libelle);
    if (!r.ok) fautes.push(r.faute);
    else decisions.set(l.id, r.confirmation);
  }
  if (fautes.length) return { ok: false, error: `Confirmation à revoir : ${fautes.join(" ; ")}.` };

  const note = fdStr(formData, "note");
  let revenu = 0;
  const fait = await sousVerrous(lignes.map((l) => l.stockItemId), async (tx) => {
    // CONDITIONNEL : deux confirmations simultanées ne font revenir le reste qu'une fois.
    let n = 0;
    for (const l of lignes) {
      const c = decisions.get(l.id)!;
      const maj = await tx.adProStockLine.updateMany({
        where: { id: l.id, statut: "RESERVEE" },
        data: {
          statut: "CONFIRMEE", utilisee: c.utilisee, rendue: c.rendue, abimee: c.abimee, perdue: c.perdue,
          confirmeeLe: new Date(), confirmeeParId: user.id, note,
        },
      });
      if (maj.count === 0) continue;
      n += 1;
      revenu += await rendreAuMagasin(tx, l.stockItemId, { ligneId: l.id, quantite: c.retour, motif: `Retour de l'événement — ${info.ref}`, auteurId: user.id });
    }
    return n;
  });
  if (fait === 0) return { ok: false, error: "Ce matériel a déjà été confirmé entre-temps : rechargez la fiche." };

  if (revenu > 0) {
    for (const g of gestionnaires.filter((g) => g !== user.id)) {
      await notifyUser({
        userId: g, type: "GENERIC", title: "Matériel revenu d'un événement",
        body: `${info.ref} — ${revenu.toLocaleString("fr-FR")} unité(s) reviennent au magasin.`,
        link: lienStockPromo("magasin"),
      }).catch(() => undefined);
    }
  }
  const resume = [...decisions].map(([id, c]) => {
    const l = lignes.find((x) => x.id === id)!;
    const lib = libelles.get(l.stockItemId)?.libelle ?? "Article";
    return c.utilisee != null
      ? `${lib} : ${c.utilisee.toLocaleString("fr-FR")} remis, ${c.retour.toLocaleString("fr-FR")} revenu(s)`
      : `${lib} : ${c.rendue.toLocaleString("fr-FR")} rendu(s), ${(c.abimee ?? 0).toLocaleString("fr-FR")} abîmé(s), ${(c.perdue ?? 0).toLocaleString("fr-FR")} perdu(s)`;
  }).join(" ; ");
  await audit(user, owner.parent, owner.id, "UPDATE", `Matériel du stock confirmé — poste « ${item.label} » : ${resume}${note ? ` (${note})` : ""}.`);
  revalidate(owner.parent, owner.id);
  revalidatePath(CHEMIN_STOCK_PROMO);
  return { ok: true, id: itemId, message: revenu > 0 ? `Matériel confirmé : ${revenu.toLocaleString("fr-FR")} unité(s) reviennent au magasin.` : "Matériel confirmé : rien ne revient au magasin." };
}

// ───────────────────────── Billetterie : voyageurs et réservation (§118.175) ─────────────────────────

/** Le poste « billetterie » d'un voyageur, avec son opération — le point d'entrée des actions par voyageur. */
async function chargerVoyageur(id: string, user: SessionUser) {
  const v = await prisma.adProVoyageur.findUnique({
    where: { id },
    select: { id: true, itemId: true, nom: true, villeDepart: true, villeArrivee: true, dateDepart: true, dateRetour: true, notes: true },
  });
  if (!v) return null;
  const found = await loadItem(v.itemId, user);
  return found ? { voyageur: v, ...found } : null;
}

/** La ligne d'un voyageur telle qu'il est en base — ce que `changementsVoyageur` compare. */
const voyageurLu = (v: { nom: string; villeDepart: string | null; villeArrivee: string | null; dateDepart: Date | null; dateRetour: Date | null; notes: string | null }): VoyageurLu => ({
  nom: v.nom, villeDepart: v.villeDepart, villeArrivee: v.villeArrivee, dateDepart: v.dateDepart, dateRetour: v.dateRetour, notes: v.notes,
});

/**
 * UN CHANGEMENT APRÈS LA DEMANDE DE RÉSERVATION SE DIT DANS LE SUJET — « on modifie les dates
 * plus tard ». Sans cette ligne, l'assistante réserverait sur les dates d'avant, et la flexibilité
 * demandée se paierait en billets à changer. Rend la phrase à ajouter au message de l'action.
 */
async function signalerAuSujet(item: { id: string }, auteurId: string, corps: string): Promise<string> {
  const poste = await prisma.adProItem.findUnique({ where: { id: item.id }, select: { reservationDossierId: true, label: true } });
  if (!poste?.reservationDossierId) return "";
  const ecrit = await ecrireDansLeSujet({ dossierId: poste.reservationDossierId, authorId: auteurId, body: `${poste.label} — ${corps}` });
  return ecrit ? " L'assistante est prévenue dans le sujet de réservation." : " Le sujet de réservation n'existe plus : redemandez la réservation pour le rouvrir.";
}

/**
 * AJOUTER UN VOYAGEUR à un poste « billetterie ». Un NOM suffit : on prend en charge un médecin
 * avant de savoir quand il part. Ce n'est pas un arbitrage, c'est une précision d'exécution —
 * donc offert aussi sur une demande clôturée, comme le bon de commande.
 */
export async function ajouterVoyageur(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const itemId = fdStr(formData, "itemId");
  if (!itemId) return { ok: false, error: "Poste non précisé." };
  const found = await loadItem(itemId, user);
  if (!found) return { ok: false, error: "Poste introuvable." };
  const { item, owner } = found;
  if (!canEditItems(user, owner.parent)) return { ok: false, error: "Non autorisé." };
  if (!porteDesVoyageurs(item.kind)) return { ok: false, error: "Seul un poste « billetterie » porte des voyageurs." };

  const lu = lireVoyageur({
    nom: fdStr(formData, "nom"), villeDepart: fdStr(formData, "villeDepart"), villeArrivee: fdStr(formData, "villeArrivee"),
    dateDepart: fdStr(formData, "dateDepart"), dateRetour: fdStr(formData, "dateRetour"), notes: fdStr(formData, "notes"),
  });
  if (!lu.ok) return { ok: false, error: lu.error };
  const last = await prisma.adProVoyageur.findFirst({ where: { itemId }, orderBy: { position: "desc" }, select: { position: true } });
  const cree = await prisma.adProVoyageur.create({
    data: { itemId, ...lu.voyageur, position: (last?.position ?? 0) + 1, createdById: user.id, updatedById: user.id },
    select: { id: true },
  });
  const sujet = await signalerAuSujet(item, user.id, `voyageur ajouté :\n${ligneVoyageur({ ...lu.voyageur, passeport: false })}`);
  await audit(user, owner.parent, owner.id, "UPDATE", `Voyageur « ${lu.voyageur.nom} » ajouté au poste « ${item.label} ».`);
  revalidate(owner.parent, owner.id);
  return { ok: true, id: cree.id, message: `Voyageur ajouté.${sujet}` };
}

/**
 * MODIFIER UN VOYAGEUR — seules les clés PRÉSENTES s'écrivent (§118.152c) : corriger une date ne
 * doit pas effacer le trajet qu'un formulaire partiel n'a pas renvoyé.
 */
export async function modifierVoyageur(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Voyageur non précisé." };
  const found = await chargerVoyageur(id, user);
  if (!found) return { ok: false, error: "Voyageur introuvable." };
  const { voyageur: v, item, owner } = found;
  if (!canEditItems(user, owner.parent)) return { ok: false, error: "Non autorisé." };

  const jour = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
  const saisie: SaisieVoyageur = {
    nom: formData.has("nom") ? fdStr(formData, "nom") : v.nom,
    villeDepart: formData.has("villeDepart") ? fdStr(formData, "villeDepart") : v.villeDepart,
    villeArrivee: formData.has("villeArrivee") ? fdStr(formData, "villeArrivee") : v.villeArrivee,
    dateDepart: formData.has("dateDepart") ? fdStr(formData, "dateDepart") : jour(v.dateDepart),
    dateRetour: formData.has("dateRetour") ? fdStr(formData, "dateRetour") : jour(v.dateRetour),
    notes: formData.has("notes") ? fdStr(formData, "notes") : v.notes,
  };
  const lu = lireVoyageur(saisie);
  if (!lu.ok) return { ok: false, error: lu.error };
  const changements = changementsVoyageur(voyageurLu(v), lu.voyageur);
  if (changements.length === 0) return { ok: true, id, message: "Rien n'a changé." };

  await prisma.adProVoyageur.update({ where: { id }, data: { ...lu.voyageur, updatedById: user.id } });
  const sujet = await signalerAuSujet(item, user.id, `voyageur modifié — ${v.nom} : ${changements.join(" ; ")}`);
  await audit(user, owner.parent, owner.id, "UPDATE", `Voyageur « ${v.nom} » du poste « ${item.label} » modifié — ${changements.join(" ; ")}.`);
  revalidate(owner.parent, owner.id);
  return { ok: true, id, message: `Voyageur modifié.${sujet}` };
}

/**
 * RETIRER UN VOYAGEUR. Son passeport, s'il a été déposé, RESTE parmi les pièces du poste : une
 * pièce jointe ne s'efface pas en silence avec la ligne qui la désignait — elle se retire depuis
 * son aperçu, comme toute pièce.
 */
export async function retirerVoyageur(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Voyageur non précisé." };
  const found = await chargerVoyageur(id, user);
  if (!found) return { ok: false, error: "Voyageur introuvable." };
  const { voyageur: v, item, owner } = found;
  if (!canEditItems(user, owner.parent)) return { ok: false, error: "Non autorisé." };
  await prisma.adProVoyageur.delete({ where: { id } });
  const sujet = await signalerAuSujet(item, user.id, `voyageur retiré : ${v.nom}.`);
  await audit(user, owner.parent, owner.id, "UPDATE", `Voyageur « ${v.nom} » retiré du poste « ${item.label} ».`);
  revalidate(owner.parent, owner.id);
  return { ok: true, message: `Voyageur retiré.${sujet}` };
}

/**
 * DEMANDER LA RÉSERVATION des billets d'un poste — « les demandes de réservation vont à
 * l'assistante de direction et ouvrent un sujet ».
 *
 * Le sujet est le lieu de l'échange (« l'Ibis est complet, je prends le Sofitel ? ») : il naît lié
 * à la DEMANDE, donc il remonte en bas de sa fiche, à l'endroit où le demandeur le suit. Une
 * seconde demande sur le même poste écrit dans le MÊME sujet, avec la liste à jour : deux sujets
 * pour les mêmes billets se contrediraient.
 *
 * Pas de garde sur l'accord du poste : pour obtenir un devis, l'agence a besoin des noms et des
 * dates. Mais la phrase DIT où en est le poste — réserver un billet que la Direction n'a pas
 * accordé engagerait la société sur une dépense que personne n'a décidée. Un poste REFUSÉ, lui,
 * ne se réserve pas.
 */
export async function demanderReservation(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Poste non précisé." };
  const found = await loadItem(id, user);
  if (!found) return { ok: false, error: "Poste introuvable." };
  const { item, owner } = found;
  if (!canEditItems(user, owner.parent)) return { ok: false, error: "Non autorisé." };
  if (!porteDesVoyageurs(item.kind)) return { ok: false, error: "Seul un poste « billetterie » se réserve." };
  if (item.status === "REJECTED") return { ok: false, error: "Ce poste a été refusé par la Direction : on ne réserve pas de billets pour lui." };

  const voyageurs = await prisma.adProVoyageur.findMany({ where: { itemId: id }, orderBy: [{ position: "asc" }, { createdAt: "asc" }] });
  if (voyageurs.length === 0) return { ok: false, error: "Ajoutez au moins un voyageur (son nom suffit) avant de demander la réservation." };
  const passeports = new Set((await prisma.document.findMany({
    where: { entityType: "AD_PRO_ITEM", entityId: id, stepKey: { in: voyageurs.map((v) => v.id) } },
    select: { stepKey: true },
  })).map((d) => d.stepKey));
  const lignes = voyageurs.map((v) => ligneVoyageur({ ...voyageurLu(v), passeport: passeports.has(v.id) }));

  const info = await PARENTS[owner.parent].load(owner.id);
  if (!info) return { ok: false, error: "Opération introuvable." };
  const etat = item.status === "APPROVED"
    ? "Poste ACCORDÉ par la Direction — vous pouvez réserver."
    : `Poste pas encore accordé (${ITEM_STATUS_LABELS[item.status].label.toLowerCase()}) — préparez le devis ; ne réservez qu'après l'accord.`;
  const corps = [
    `Demande ${info.ref} — poste « ${item.label} ».`,
    etat,
    `Voyageurs (${voyageurs.length}) :`,
    ...lignes,
    `Fiche : ${PARENTS[owner.parent].path}/${owner.id}`,
  ].join("\n");

  const poste = await prisma.adProItem.findUnique({ where: { id }, select: { reservationDossierId: true } });
  if (poste?.reservationDossierId && await ecrireDansLeSujet({ dossierId: poste.reservationDossierId, authorId: user.id, body: `Demande de réservation mise à jour.\n${corps}` })) {
    await audit(user, owner.parent, owner.id, "UPDATE", `Réservation du poste « ${item.label} » redemandée (${voyageurs.length} voyageur(s)).`);
    revalidate(owner.parent, owner.id);
    return { ok: true, id: poste.reservationDossierId, message: "Demande de réservation mise à jour dans le sujet ouvert — l'assistante de direction est prévenue." };
  }

  // L'ASSISTANTE DE DIRECTION : une seule active ⇒ elle en est responsable ; plusieurs ⇒ toutes
  // participantes, sans responsable désignée — en choisir une serait choisir à la place d'un
  // humain (§118.34). Aucune ⇒ la demande n'a personne à qui partir, et on le dit.
  const assistantes = await prisma.user.findMany({
    where: { isActive: true, ...anyRoleFilter(["DIRECTION_ASSISTANT"]) },
    select: { id: true }, orderBy: { createdAt: "asc" },
  });
  if (assistantes.length === 0) {
    return { ok: false, error: "Aucune assistante de direction active : la demande de réservation n'a personne à qui partir (Administration › Comptes)." };
  }
  const seule = assistantes.length === 1 ? assistantes[0]!.id : null;
  const sujet = await createDossierRecord({
    title: `Réservation billets — ${info.ref} · ${item.label}`,
    description: corps,
    category: "Billets",
    priority: "HIGH",
    assignedToId: seule,
    participantIds: [...(seule ? [] : assistantes.map((a) => a.id)), ...(info.requesterId ? [info.requesterId] : [])],
    sourceType: PARENT_ENTITE[owner.parent],
    sourceId: owner.id,
    companyId: info.companyId ?? null,
  }, user.id);
  await prisma.adProItem.update({ where: { id }, data: { reservationDossierId: sujet.id, updatedById: user.id } });
  await audit(user, owner.parent, owner.id, "UPDATE", `Réservation du poste « ${item.label} » demandée — sujet ${sujet.reference} (${voyageurs.length} voyageur(s)).`);
  revalidate(owner.parent, owner.id);
  revalidatePath("/dossiers");
  return { ok: true, id: sujet.id, message: `Demande de réservation envoyée — sujet ${sujet.reference} ouvert pour l'assistante de direction.` };
}
