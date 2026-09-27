import type { EntityType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/utils";
import { recordAudit } from "@/lib/audit";
import { notifyRoles } from "@/lib/notify";
import { createDirectValidation } from "@/lib/validation";
import { centreValidatorFrom } from "@/lib/validations/centre";
import { AD_PRO_ENTITY_TYPE } from "@/lib/ad-pro/unified";
import {
  centreDeLOrigine, etatDepuisPoste, etatDepuisValidation, etatDepuisVisa, gesteAiguillage,
  LIBELLE_CENTRE_BC, CHEMIN_CENTRE_BC,
  type CentreBC, type PorteBC,
} from "./regle";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * L'AIGUILLAGE DES BONS DE COMMANDE — poser la porte, la lire, la déplacer, la retirer.
 *
 * La règle vit dans `regle.ts` (pure, au socle). Ici, on LIT les faits qu'elle attend et on
 * ÉCRIT ce qu'elle décide — rien de plus. Un bon de commande est un `LegalDocument` de nature
 * `PURCHASE_ORDER` : c'est le registre canonique où la fabrique les émet, où les demandes de
 * pièce les classent, où Legal les enregistre (§17 : pas de second registre).
 *
 * ── LES DEUX CENTRES, ET LEURS DEUX FORMES DE PORTE ─────────────────────────────────────────
 *
 *   • AD & PRO → un VISA (`AdProGateVisa` sur `LEGAL_DOCUMENT`), la table unique du centre
 *     Ad & Pro. Sans seuil : TOUT bon de commande né d'Ad & Pro y passe, quel que soit son
 *     montant — c'est la décision de la Direction, et le seuil ne concerne que les DEMANDES.
 *   • VALIDATIONS → une demande de validation (`ValidationRequest`, `objectType` = BC) adressée
 *     au siège du centre (`centreValidatorFrom`), que `/centre-de-validations` liste déjà.
 *
 * Et une troisième, qui n'en est pas une : le BC qui MATÉRIALISE la demande d'un poste Ad & Pro
 * porte déjà sa décision — le visa du poste (voir `PorteBC.source`).
 *
 * ── CE QUI N'EST JAMAIS FAIT ICI ─────────────────────────────────────────────────────────────
 *
 * Aucune permission n'est accordée ni vérifiée : qui peut CRÉER un BC reste la garde de son
 * écrivain (`legalWriteAllowed`), qui peut le VALIDER reste celle du centre. Y glisser une garde
 * en ferait une seconde vérité en retard (§118.119a).
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/** La nature d'objet qui signe une demande de validation de BC — c'est ELLE qu'on relit, pas le titre. */
export const OBJET_BC = "BON_DE_COMMANDE";
/** Le libellé de module affiché au centre de validations. */
export const MODULE_BC = "Bons de commande";

/**
 * LES TYPES D'ENTITÉ QUI FONT D'UN BC UN BC « AD & PRO » — dérivés du registre canonique.
 *
 * Les sept natures, plus le POSTE d'une opération, qui n'est pas une nature mais en fait partie.
 * Une huitième nature ajoutée au registre entre ici sans que personne y pense (§118.73).
 */
export const TYPES_AD_PRO: ReadonlySet<string> = new Set<string>([
  ...Object.values(AD_PRO_ENTITY_TYPE),
  "AD_PRO_ITEM",
]);

// ───────────────────────── L'origine ─────────────────────────

export interface MaillonOrigine { type: string; id: string }
export interface OrigineBC {
  /** Du plus proche au plus lointain : la source directe d'abord. */
  chemin: MaillonOrigine[];
  /** Le poste Ad & Pro traversé, s'il y en a un — c'est lui qui porte alors la décision. */
  posteId: string | null;
}

/** Au-delà, un chemin tourne en rond ou n'a plus rien d'une origine : on s'arrête. */
const SAUTS_MAX = 6;

/**
 * UN PAS VERS L'ORIGINE — chaque type dit où il pointe, et c'est une liste FERMÉE.
 *
 * On ne suit que des liens déclarés au schéma (la demande de pièce vers son objet, l'ordre de
 * dépense vers sa source, le dossier de paiement vers son objet, la demande administrative vers
 * ce qu'elle sert). Deviner un lien par ressemblance de nom rattacherait un BC à la mauvaise
 * fiche, donc au mauvais centre (§118.36).
 */
async function suivant(m: MaillonOrigine): Promise<MaillonOrigine | null> {
  switch (m.type) {
    case "DOCUMENT_REQUEST": {
      const r = await prisma.documentRequest.findUnique({ where: { id: m.id }, select: { entityType: true, entityId: true } }).catch(() => null);
      return r ? { type: r.entityType, id: r.entityId } : null;
    }
    case "EXPENSE_ORDER": {
      const o = await prisma.expenseOrder.findUnique({ where: { id: m.id }, select: { sourceType: true, sourceId: true } }).catch(() => null);
      return o?.sourceType && o.sourceId ? { type: o.sourceType, id: o.sourceId } : null;
    }
    case "PAYMENT_REQUEST": {
      const p = await prisma.paymentRequest.findUnique({ where: { id: m.id }, select: { entityType: true, entityId: true } }).catch(() => null);
      return p?.entityType && p.entityId ? { type: p.entityType, id: p.entityId } : null;
    }
    case "ADMIN_REQUEST": {
      const a = await prisma.administrativeRequest.findUnique({ where: { id: m.id }, select: { linkedEntityType: true, linkedEntityId: true } }).catch(() => null);
      return a?.linkedEntityType && a.linkedEntityId ? { type: a.linkedEntityType, id: a.linkedEntityId } : null;
    }
    case "LEGAL_DOCUMENT": {
      const d = await prisma.legalDocument.findUnique({ where: { id: m.id }, select: { sourceType: true, sourceId: true } }).catch(() => null);
      return d?.sourceType && d.sourceId ? { type: d.sourceType, id: d.sourceId } : null;
    }
    default:
      return null;
  }
}

/**
 * D'OÙ VIENT CE BC ? — sa source directe, et à défaut celle de la pièce dont il DÉCOULE (le devis).
 *
 * Un BC composé par la fabrique ne porte pas de source : c'est son DEVIS, lui, qui a été créé
 * depuis la fiche du sponsoring. « Le bon de commande vers son devis » est précisément le lien
 * que la chaîne d'achat existe pour tenir (`chainFromId`) — on le remonte, borné.
 */
export async function origineDuBC(doc: {
  sourceType: string | null; sourceId: string | null; chainFromId: string | null;
}): Promise<OrigineBC> {
  let depart: MaillonOrigine | null = doc.sourceType && doc.sourceId ? { type: doc.sourceType, id: doc.sourceId } : null;
  let amontId = doc.chainFromId;
  for (let i = 0; !depart && amontId && i < 3; i += 1) {
    const amont = await prisma.legalDocument.findUnique({
      where: { id: amontId }, select: { sourceType: true, sourceId: true, chainFromId: true },
    }).catch(() => null);
    if (!amont) break;
    depart = amont.sourceType && amont.sourceId ? { type: amont.sourceType, id: amont.sourceId } : null;
    amontId = amont.chainFromId;
  }

  const chemin: MaillonOrigine[] = [];
  const vus = new Set<string>();
  let posteId: string | null = null;
  let courant = depart;
  for (let i = 0; courant && i < SAUTS_MAX; i += 1) {
    const cle = `${courant.type}:${courant.id}`;
    if (vus.has(cle)) break;
    vus.add(cle);
    chemin.push(courant);
    if (courant.type === "AD_PRO_ITEM") { posteId = courant.id; break; }
    courant = await suivant(courant);
  }
  return { chemin, posteId };
}

// ───────────────────────── La lecture des portes ─────────────────────────

/**
 * LES PORTES DE PLUSIEURS BC, EN QUATRE LECTURES — jamais une par document.
 *
 * Une liste Legal de cent pièces qui lirait l'origine de chacune ferait cent allers-retours sur
 * un écran qu'on ouvre dix fois par jour (§118.102b). Le seul chemin qui mène à un poste passe
 * par une demande de pièce : on ne suit que celui-là, en lot.
 *
 * Précédence : le visa du POSTE d'abord (c'est la demande qui a été visée), puis la porte la plus
 * RÉCENTE du document lui-même — un BC transféré d'un centre à l'autre, ou rouvert après une
 * demande de modification, garde son historique ; c'est la dernière porte qui dit où il en est.
 */
export async function portesDesBC(docIds: readonly string[]): Promise<Map<string, PorteBC>> {
  const res = new Map<string, PorteBC>();
  const ids = [...new Set(docIds.filter(Boolean))];
  if (ids.length === 0) return res;

  const docs = await prisma.legalDocument.findMany({
    where: { id: { in: ids }, kind: "PURCHASE_ORDER" },
    select: { id: true, sourceType: true, sourceId: true },
  }).catch(() => []);
  if (docs.length === 0) return res;
  const bcIds = docs.map((d) => d.id);

  // 1. Le visa du poste, par la demande de pièce qui a fait naître le BC.
  const parDemande = docs.filter((d) => d.sourceType === "DOCUMENT_REQUEST" && d.sourceId);
  if (parDemande.length > 0) {
    const demandes = await prisma.documentRequest.findMany({
      where: { id: { in: parDemande.map((d) => d.sourceId!) }, entityType: "AD_PRO_ITEM" },
      select: { id: true, entityId: true },
    }).catch(() => []);
    const postes = demandes.length
      ? await prisma.adProItem.findMany({
          where: { id: { in: demandes.map((d) => d.entityId) } },
          select: { id: true, orderStage: true, orderDecisionNote: true },
        }).catch(() => [])
      : [];
    const posteDe = new Map(demandes.map((d) => [d.id, postes.find((p) => p.id === d.entityId) ?? null]));
    for (const d of parDemande) {
      const poste = posteDe.get(d.sourceId!);
      const etat = poste ? etatDepuisPoste(poste.orderStage) : null;
      if (poste && etat) res.set(d.id, { centre: "AD_PRO", etat, source: "POSTE", note: poste.orderDecisionNote });
    }
  }

  // 2. Les portes du document lui-même : visa Ad & Pro et demande de validation, la plus récente.
  const restants = bcIds.filter((id) => !res.has(id));
  if (restants.length === 0) return res;
  const [visas, validations] = await Promise.all([
    prisma.adProGateVisa.findMany({
      where: { entityType: "LEGAL_DOCUMENT", entityId: { in: restants } },
      select: { entityId: true, status: true, note: true, updatedAt: true },
    }).catch(() => []),
    prisma.validationRequest.findMany({
      where: { entityType: "LEGAL_DOCUMENT", entityId: { in: restants }, objectType: OBJET_BC, status: { not: "CANCELLED" } },
      select: {
        entityId: true, status: true, updatedAt: true,
        steps: { where: { reason: { not: null } }, select: { reason: true }, orderBy: { decidedAt: "desc" }, take: 1 },
      },
      orderBy: { updatedAt: "desc" },
    }).catch(() => []),
  ]);

  const candidates = new Map<string, { quand: number; porte: PorteBC }>();
  const garder = (id: string, quand: Date, porte: PorteBC) => {
    const deja = candidates.get(id);
    if (!deja || quand.getTime() > deja.quand) candidates.set(id, { quand: quand.getTime(), porte });
  };
  for (const v of visas) {
    garder(v.entityId, v.updatedAt, { centre: "AD_PRO", etat: etatDepuisVisa(v.status), source: "DOCUMENT", note: v.note });
  }
  for (const v of validations) {
    if (!v.entityId) continue;
    const etat = etatDepuisValidation(v.status);
    if (!etat) continue;
    garder(v.entityId, v.updatedAt, { centre: "VALIDATION", etat, source: "DOCUMENT", note: v.steps[0]?.reason ?? null });
  }
  for (const [id, c] of candidates) res.set(id, c.porte);
  return res;
}

/** La porte d'UN BC — `null` = aucune (BC d'avant la règle, ou pièce d'une autre nature). */
export async function porteDuBC(docId: string): Promise<PorteBC | null> {
  return (await portesDesBC([docId])).get(docId) ?? null;
}

// ───────────────────────── L'écriture ─────────────────────────

type DocBC = {
  id: string; reference: string | null; title: string; counterparty: string | null;
  amount: unknown; createdById: string | null;
};

const montantDe = (d: { amount: unknown }): number | null => (d.amount == null ? null : toNumber(d.amount as never));

const intitule = (d: DocBC): string => {
  const ref = d.reference?.trim();
  const partie = d.counterparty?.trim();
  return [ref ? `Bon de commande ${ref}` : `Bon de commande « ${d.title} »`, partie].filter(Boolean).join(" — ");
};

const montantLisible = (m: number | null) => (m != null && m > 0 ? `${m.toLocaleString("fr-FR")} DZD` : "montant non renseigné");

/** Retire ce qui ATTEND encore — une décision prise, elle, ne s'efface jamais. */
async function retirerEnAttente(docId: string): Promise<number> {
  const [visas, validations] = await Promise.all([
    prisma.adProGateVisa.deleteMany({ where: { entityType: "LEGAL_DOCUMENT", entityId: docId, status: "PENDING" } }).catch(() => ({ count: 0 })),
    prisma.validationRequest.updateMany({
      where: { entityType: "LEGAL_DOCUMENT", entityId: docId, objectType: OBJET_BC, status: "PENDING" },
      data: { status: "CANCELLED", decidedAt: new Date() },
    }).catch(() => ({ count: 0 })),
  ]);
  return visas.count + validations.count;
}

/**
 * RETIRER CE QUI ATTEND, avant de supprimer la pièce — l'arbitrage n'aurait plus d'objet.
 *
 * Distincte de `aiguillerBC`, qui RELIT la pièce : sur une suppression, il n'y a plus rien à
 * relire, et c'est justement le moment où la porte doit disparaître du centre.
 */
export async function retirerPortesEnAttente(docId: string, acteurId: string): Promise<number> {
  const n = await retirerEnAttente(docId);
  if (n > 0) {
    await recordAudit({
      actorId: acteurId, action: "UPDATE", module: "Legal", entityType: "LEGAL_DOCUMENT", entityId: docId,
      summary: "Bon de commande supprimé — sa validation en attente est retirée du centre.",
    }).catch(() => undefined);
  }
  return n;
}

/**
 * POSER LA PORTE dans le centre voulu. Rend `false` quand personne ne siège au centre de
 * validations — cas qui ne devrait pas exister, et qu'on DIT plutôt que de le taire.
 */
async function poser(doc: DocBC, centre: CentreBC, acteurId: string, motif: string | null): Promise<boolean> {
  const montant = montantDe(doc);
  const titre = intitule(doc);

  if (centre === "AD_PRO") {
    await prisma.adProGateVisa.upsert({
      where: { entityType_entityId: { entityType: "LEGAL_DOCUMENT", entityId: doc.id } },
      // Aucun seuil : un BC d'Ad & Pro passe au centre QUEL QUE SOIT son montant.
      create: { entityType: "LEGAL_DOCUMENT", entityId: doc.id, status: "PENDING", threshold: null, amount: montant, note: motif },
      // ROUVRIR : la décision précédente est effacée de la LIGNE, pas de l'histoire — le journal
      // d'audit garde qui avait validé et quand, et la raison de la réouverture est la note.
      update: { status: "PENDING", decidedById: null, decidedAt: null, note: motif, amount: montant },
    });
    await notifyRoles(["GENERAL_MANAGER", "SUPER_ADMIN"], {
      type: "VALIDATION_REQUIRED",
      title: motif ? "Bon de commande à revalider" : "Bon de commande à valider",
      body: `${titre} (${montantLisible(montant)})${motif ? ` — ${motif}` : ""}`,
      link: CHEMIN_CENTRE_BC.AD_PRO,
    }).catch(() => undefined);
    return true;
  }

  const demandeurId = doc.createdById ?? acteurId;
  const sieges = await prisma.user.findMany({
    where: { role: { in: ["GENERAL_MANAGER", "SUPER_ADMIN"] }, isActive: true },
    select: { id: true, role: true, isActive: true },
    orderBy: { createdAt: "asc" },
  });
  // Le demandeur ne se valide pas lui-même tant qu'un autre siège existe ; s'il est le SEUL
  // siège, il valide explicitement — un clic conscient vaut mieux qu'une porte sans validateur.
  const validateur = centreValidatorFrom(sieges.filter((s) => s.id !== demandeurId)) ?? centreValidatorFrom(sieges);
  if (!validateur) return false;
  const r = await createDirectValidation({
    requesterId: demandeurId,
    title: titre,
    description: [
      motif,
      `Montant : ${montantLisible(montant)}.`,
      "Tout bon de commande passe par le centre de validations avant d'engager la société (décision de la Direction, 09/2026).",
    ].filter(Boolean).join("\n"),
    link: `/legal/${doc.id}`,
    module: MODULE_BC,
    objectType: OBJET_BC,
    entityType: "LEGAL_DOCUMENT" as EntityType,
    entityId: doc.id,
    amount: montant,
    validatorIds: [validateur],
    allowSelf: validateur === demandeurId,
  });
  return r.ok;
}

export interface ResultatAiguillage {
  /** La porte après l'aiguillage — `null` si la pièce n'est pas (ou plus) un BC. */
  porte: PorteBC | null;
  /** Ce qui a été fait, pour la phrase de l'appelant — `null` quand rien n'a bougé. */
  geste: "POSEE" | "TRANSFEREE" | "ROUVERTE" | "ACTUALISEE" | "RETIREE" | null;
  /** Vrai quand la porte n'a PAS pu être posée : aucun siège au centre. Se dit, ne se tait pas. */
  sansSiege?: boolean;
  /**
   * Vrai quand l'aiguillage a ÉCHOUÉ (une erreur, pas une décision) : la pièce est écrite, sa porte
   * ne l'est pas. Distinct de « pas un BC » — les deux rendaient `porte: null, geste: null`, et
   * l'appelant ne pouvait pas savoir qu'il devait le DIRE. Mesuré : dix BC émis en parallèle, les
   * derniers sans porte, et la phrase de l'émission muette (§118.148).
   */
  enEchec?: boolean;
}

/**
 * AIGUILLER UN BC — l'unique point d'entrée des écrivains, idempotent.
 *
 * Appelée après chaque écriture qui crée un BC, le modifie, le re-qualifie, le rattache ou
 * l'annule. Elle relit la pièce, calcule l'origine, lit la porte, demande à la règle pure ce
 * qu'il faut faire, et le fait. L'appeler deux fois ne pose jamais deux portes : la seconde
 * lecture trouve la première.
 *
 * Elle NE LÈVE JAMAIS : un échec d'aiguillage ne défait pas l'écriture de la pièce, qui a eu
 * lieu. Il rend `porte: null` ET `enEchec: true` — la phrase de l'appelant le DIT
 * (`reserveSansPorte`), et la fiche du BC montre le geste « Adresser au centre » qui rattrape :
 * une pièce sans porte ne reste pas invisible.
 */
export async function aiguillerBC(
  docId: string,
  opts: { acteurId: string; montantAvant?: number | null; modifie?: boolean },
): Promise<ResultatAiguillage> {
  try {
    const doc = await prisma.legalDocument.findUnique({
      where: { id: docId },
      select: {
        id: true, kind: true, status: true, reference: true, title: true, counterparty: true,
        amount: true, createdById: true, sourceType: true, sourceId: true, chainFromId: true,
      },
    });
    if (!doc) return { porte: null, geste: null };

    // Plus un BC (re-qualifié) ou annulé : ce qui attendait n'a plus d'objet.
    if (doc.kind !== "PURCHASE_ORDER" || doc.status === "CANCELLED") {
      const retires = await retirerEnAttente(doc.id);
      if (retires > 0) {
        await recordAudit({
          actorId: opts.acteurId, action: "UPDATE", module: "Legal", entityType: "LEGAL_DOCUMENT", entityId: doc.id,
          summary: doc.status === "CANCELLED"
            ? "Bon de commande annulé — sa validation en attente est retirée du centre."
            : "La pièce n'est plus un bon de commande — sa validation en attente est retirée du centre.",
        }).catch(() => undefined);
      }
      return { porte: null, geste: retires > 0 ? "RETIREE" : null };
    }

    const origine = await origineDuBC(doc);
    const centreVoulu = centreDeLOrigine(origine.chemin.map((m) => m.type), TYPES_AD_PRO);
    const actuelle = await porteDuBC(doc.id);
    const geste = gesteAiguillage({
      actuelle, centreVoulu,
      montantAvant: opts.montantAvant ?? null,
      montantApres: montantDe(doc),
      modifie: opts.modifie ?? false,
    });

    switch (geste.geste) {
      case "RIEN":
        return { porte: actuelle, geste: null };

      case "ACTUALISER": {
        const montant = montantDe(doc);
        await Promise.all([
          prisma.adProGateVisa.updateMany({ where: { entityType: "LEGAL_DOCUMENT", entityId: doc.id, status: "PENDING" }, data: { amount: montant } }),
          prisma.validationRequest.updateMany({
            where: { entityType: "LEGAL_DOCUMENT", entityId: doc.id, objectType: OBJET_BC, status: "PENDING" },
            data: { amount: montant },
          }),
        ]);
        return { porte: actuelle, geste: "ACTUALISEE" };
      }

      case "TRANSFERER":
      case "POSER":
      case "ROUVRIR": {
        if (geste.geste === "TRANSFERER") await retirerEnAttente(doc.id);
        const motif = geste.geste === "ROUVRIR" ? geste.motif : null;
        const ok = await poser(doc, centreVoulu, opts.acteurId, motif);
        if (!ok) return { porte: null, geste: null, sansSiege: true };
        const verbe = geste.geste === "TRANSFERER" ? "transféré au" : geste.geste === "ROUVRIR" ? "renvoyé au" : "adressé au";
        await recordAudit({
          actorId: opts.acteurId, action: "UPDATE", module: "Legal", entityType: "LEGAL_DOCUMENT", entityId: doc.id,
          summary: `Bon de commande ${verbe} ${LIBELLE_CENTRE_BC[centreVoulu]}${motif ? ` — ${motif}` : ""}`,
        }).catch(() => undefined);
        return {
          porte: { centre: centreVoulu, etat: "EN_ATTENTE", source: "DOCUMENT", note: motif },
          geste: geste.geste === "TRANSFERER" ? "TRANSFEREE" : geste.geste === "ROUVRIR" ? "ROUVERTE" : "POSEE",
        };
      }
    }
  } catch (err) {
    console.error("[bons-de-commande] aiguillage impossible", docId, err);
    return { porte: null, geste: null, enEchec: true };
  }
}
