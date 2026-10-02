import { lienStockPromo } from "@/lib/chemins/stock-promo";
import { prisma } from "@/lib/prisma";
import { notifyUser } from "@/lib/notify";
import { faitsStockDe, gestionnairesDuMagasin, peutRecevoirDuStock } from "@/lib/queries/promo-stock";
import { chargerFaitsAlertes } from "@/lib/queries/promo-stock-alertes";
import type { PromoFamille } from "@/lib/promo/catalogue";
import {
  alertesDuStock, cleDansLePerimetre, comptagesSeRecouvrent, echeanceDuComptage, libelleFamilleComptage,
  messageDAlertes, peutDemanderAEquipe, peutDemanderComptage, prochaineEcheanceComptage, POUR_LE_MAGASIN,
  type Alerte, type FrequenceComptage,
} from "@/lib/promo/comptages";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE BATTEMENT DU STOCK PROMOTIONNEL, ÉTAPE 5 — comptages récurrents et alertes (§118.168).
 *
 * Ici et non dans le registre des planifications, pour la raison des récurrences de demande d'état
 * de stock (§118.119) : ce sont des EFFETS — une demande adressée à une personne, une notification —
 * écrits en revue de code, que le registre interdit à juste titre (`mutates: false`).
 *
 * ── LES COMPTAGES RÉCURRENTS ──────────────────────────────────────────────────────────────
 *
 * Seul le passage qui REPOUSSE l'échéance gagne le droit de demander (écriture conditionnelle) :
 * deux battements concurrents ne demandent pas deux fois le même comptage. L'autorité de l'AUTEUR
 * est relue à chaque déclenchement — équipe, rôle, accès — et une récurrence dont l'auteur a perdu
 * le droit passe en PAUSE avec son motif, jamais supprimée. On ne rattrape pas, et l'on n'empile
 * pas : une personne qui n'a pas saisi le comptage du mois dernier ne reçoit pas un second
 * comptage des mêmes articles — le premier, en retard, a sa relance.
 *
 * ── LES ALERTES ───────────────────────────────────────────────────────────────────────────
 *
 * Une fois l'heure (verrou en base, valable pour toutes les instances). Une alerte part à l'ENTRÉE
 * dans un état : sa clé est prise AVANT la notification, et se retire quand l'état cesse — la
 * rupture d'hier n'est pas répétée chaque heure, et revient si l'article retombe. Une personne
 * reçoit UNE notification par passage, quel que soit le nombre d'alertes.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const PAR_PASSAGE = 20;
const LIEN = lienStockPromo("comptages");

const jourFr = (d: Date) => d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });

export interface BilanComptagesRecurrents {
  /** Récurrences qui ont produit au moins un comptage. */
  declenchees: number;
  comptagesCrees: number;
  /** Mises en pause : leur auteur n'a plus le droit de demander ce comptage. */
  suspendues: number;
  /** Détenteurs sautés parce qu'un comptage des mêmes articles est déjà ouvert chez eux. */
  dejaOuverts: number;
}

async function nomDe(userId: string | null): Promise<string> {
  if (userId === null) return "le magasin central";
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
  return u?.name ?? "Compte supprimé";
}

/**
 * DÉCLENCHE LES COMPTAGES RÉCURRENTS DUS. `seulement` borne la passe à des récurrences nommées —
 * pour un banc : sans elle, un banc déclencherait les récurrences des AUTRES bancs de la même base,
 * et adresserait des demandes à des personnes qui ne sont pas les siennes (§118.119d).
 * Ne lève jamais pour une récurrence en défaut : le battement enchaîne d'autres travaux.
 */
export async function declencherComptagesRecurrents(maintenant: Date = new Date(), opts?: { seulement?: readonly string[] }): Promise<BilanComptagesRecurrents> {
  const bilan: BilanComptagesRecurrents = { declenchees: 0, comptagesCrees: 0, suspendues: 0, dejaOuverts: 0 };
  const dues = await prisma.promoStockComptageRecurrence.findMany({
    where: { actif: true, prochaineLe: { lte: maintenant }, ...(opts?.seulement ? { id: { in: [...opts.seulement] } } : {}) },
    orderBy: { prochaineLe: "asc" },
    take: PAR_PASSAGE,
  });
  for (const r of dues) {
    // LE VERROU : seul le passage qui repousse l'échéance demande.
    const suivante = prochaineEcheanceComptage(r.ancreLe, r.frequence as FrequenceComptage, maintenant);
    const prise = await prisma.promoStockComptageRecurrence.updateMany({
      where: { id: r.id, actif: true, prochaineLe: { lte: maintenant } },
      data: { prochaineLe: suivante },
    });
    if (prise.count === 0) continue;

    // L'AUTORITÉ DE L'AUTEUR, RELUE MAINTENANT.
    const auteur = r.auteurId ? await faitsStockDe(r.auteurId) : null;
    let cibles: (string | null)[] = [];
    let motifPause: string | null = null;
    if (!auteur) {
      motifPause = "Son auteur n'existe plus ou n'est plus actif : plus personne n'a l'autorité de demander ce comptage.";
    } else if (r.cible === "MAGASIN") {
      if (peutDemanderComptage(auteur, null)) cibles = [null];
      else motifPause = "Son auteur n'a plus la vue globale du stock : il ne peut plus faire compter le magasin.";
    } else if (r.cible === "PERSONNE") {
      if (!r.holderId || !peutDemanderComptage(auteur, r.holderId)) {
        motifPause = `${await nomDe(r.holderId)} n'est plus dans les équipes de son auteur (ou son auteur ne gère plus le matériel des équipes).`;
      } else {
        const peut = await peutRecevoirDuStock(r.holderId, "saisir son comptage");
        if (peut.ok) cibles = [r.holderId];
        else motifPause = peut.error;
      }
    } else {
      if (!peutDemanderAEquipe(auteur)) {
        motifPause = "Son auteur ne gère plus le matériel d'une équipe : il ne peut plus faire compter « toute son équipe ».";
      } else {
        for (const id of auteur.equipe) {
          if (!peutDemanderComptage(auteur, id)) continue;
          if ((await peutRecevoirDuStock(id, "saisir son comptage")).ok) cibles.push(id);
        }
      }
    }
    if (motifPause) {
      await prisma.promoStockComptageRecurrence.update({
        where: { id: r.id },
        data: { actif: false, pauseLe: maintenant, pauseMotif: motifPause },
      });
      bilan.suspendues += 1;
      if (r.auteurId && auteur) {
        await notifyUser({ userId: r.auteurId, type: "GENERIC", title: "Comptage récurrent suspendu", body: `Votre comptage récurrent est suspendu : ${motifPause}`, link: LIEN });
      }
      continue;
    }

    // ON N'EMPILE PAS : un comptage ouvert des mêmes articles chez cette personne suffit.
    const famille = (r.famille as PromoFamille | null) ?? null;
    const ouverts = await prisma.promoStockComptage.findMany({
      where: { statut: "DEMANDE", OR: [{ holderId: { in: cibles.filter((c): c is string => c !== null) } }, ...(cibles.includes(null) ? [{ holderId: null }] : [])] },
      select: { holderId: true, famille: true },
    });
    const aCreer = cibles.filter((h) => !ouverts.some((o) => comptagesSeRecouvrent({ holderId: o.holderId, famille: (o.famille as PromoFamille | null) ?? null }, { holderId: h, famille })));
    bilan.dejaOuverts += cibles.length - aCreer.length;
    if (!aCreer.length) continue;

    const echeance = echeanceDuComptage(maintenant, r.delaiJours);
    const crees = await prisma.$transaction(aCreer.map((holderId) => prisma.promoStockComptage.create({
      data: { holderId, famille, demandeurId: r.auteurId!, recurrenceId: r.id, echeance, note: r.note },
      select: { id: true, holderId: true },
    })));
    await prisma.promoStockComptageRecurrence.update({
      where: { id: r.id },
      data: { derniereLe: maintenant, nbDeclenchements: { increment: 1 } },
    });
    const demandeur = await nomDe(r.auteurId);
    const quoi = libelleFamilleComptage(famille);
    for (const c of crees) {
      const destinataires = c.holderId ? [c.holderId] : await gestionnairesDuMagasin();
      for (const userId of new Set(destinataires)) {
        await notifyUser({
          userId, type: "GENERIC", title: "Comptage de stock demandé",
          body: `${demandeur} vous demande de compter ${c.holderId === null ? "le magasin central" : "votre stock"} (${quoi}) avant le ${jourFr(echeance)} — comptage régulier${r.note ? ` : « ${r.note} »` : ""}.`,
          link: LIEN,
        });
      }
    }
    bilan.declenchees += 1;
    bilan.comptagesCrees += crees.length;
  }
  return bilan;
}

// ═══════════════════════════════════════════════════════════════════════════════════════════
// LES ALERTES
// ═══════════════════════════════════════════════════════════════════════════════════════════

/** La clé du verrou de passage — une ligne de la même table, jamais une clé d'alerte. */
const PASSAGE = "__passage__";
const INTERVALLE_MS = 60 * 60_000;

/**
 * Prendre le passage de l'heure : la première instance qui y arrive le prend, les autres passent.
 * UNE instruction — créer la ligne, ou la repousser si l'heure est passée — et la ligne rendue dit
 * qui l'a prise : deux instances ne peuvent pas lire « libre » toutes les deux.
 */
async function prendreLePassage(maintenant: Date): Promise<boolean> {
  const limite = new Date(maintenant.getTime() - INTERVALLE_MS);
  const pris = await prisma.$queryRaw<{ cle: string }[]>`
    INSERT INTO "PromoStockAlerte" ("cle", "envoyeLe") VALUES (${PASSAGE}, ${maintenant})
    ON CONFLICT ("cle") DO UPDATE SET "envoyeLe" = EXCLUDED."envoyeLe"
    WHERE "PromoStockAlerte"."envoyeLe" <= ${limite}
    RETURNING "cle"`;
  return pris.length === 1;
}

/** Prendre la clé d'une alerte : `true` si CETTE passe l'a posée — c'est elle, et elle seule, qui notifie. */
async function prendreLaCle(cle: string, maintenant: Date): Promise<boolean> {
  const pris = await prisma.$queryRaw<{ cle: string }[]>`
    INSERT INTO "PromoStockAlerte" ("cle", "envoyeLe") VALUES (${cle}, ${maintenant})
    ON CONFLICT ("cle") DO NOTHING
    RETURNING "cle"`;
  return pris.length === 1;
}

export interface BilanAlertes {
  /** Le passage n'avait pas lieu d'être (moins d'une heure depuis le précédent). */
  saute: boolean;
  /** Alertes en vigueur dans le périmètre. */
  enVigueur: number;
  /** Alertes NOUVELLES, envoyées à ce passage. */
  envoyees: number;
  /** Notifications émises (une par personne). */
  notifications: number;
  /** Clés retirées parce que l'état a cessé — l'alerte repartira s'il revient. */
  rearmees: number;
}

/**
 * ALERTER. `seulement` borne la passe à des articles et des comptages — un banc n'alerte pas sur le
 * stock des autres bancs, et ne retire pas leurs clés ; `forcer` saute le verrou de l'heure.
 */
export async function alerterStock(
  maintenant: Date = new Date(),
  opts?: { seulement?: { itemIds: readonly string[]; comptageIds: readonly string[] }; forcer?: boolean },
): Promise<BilanAlertes> {
  if (!opts?.forcer && !(await prendreLePassage(maintenant))) return { saute: true, enVigueur: 0, envoyees: 0, notifications: 0, rearmees: 0 };
  const seulement = opts?.seulement;
  const entree = await chargerFaitsAlertes({ itemIds: seulement?.itemIds ?? null, comptageIds: seulement?.comptageIds ?? null, maintenant });
  const alertes = alertesDuStock(entree, maintenant);
  const actives = new Set(alertes.map((a) => a.cle));
  const perimetre = seulement ? { itemIds: new Set(seulement.itemIds), comptageIds: new Set(seulement.comptageIds) } : null;

  // RÉ-ARMER : une clé dont l'état a cessé se retire — dans le périmètre seulement.
  const existantes = await prisma.promoStockAlerte.findMany({ where: { cle: { not: PASSAGE } }, select: { cle: true } });
  const dejaEnvoyees = new Set(existantes.map((e) => e.cle));
  const aRetirer = existantes.map((e) => e.cle).filter((cle) => !actives.has(cle) && (!perimetre || cleDansLePerimetre(cle, perimetre)));
  if (aRetirer.length) await prisma.promoStockAlerte.deleteMany({ where: { cle: { in: aRetirer } } });

  // LES NOUVELLES : la clé est prise AVANT de notifier — deux passes concurrentes n'alertent pas deux fois.
  const nouvelles: Alerte[] = [];
  for (const a of alertes) {
    if (dejaEnvoyees.has(a.cle)) continue;
    if (await prendreLaCle(a.cle, maintenant)) nouvelles.push(a);
  }

  // UNE NOTIFICATION PAR PERSONNE.
  const magasin = nouvelles.some((a) => a.pour.includes(POUR_LE_MAGASIN)) ? await gestionnairesDuMagasin() : [];
  const parPersonne = new Map<string, Alerte[]>();
  for (const a of nouvelles) {
    const qui = new Set(a.pour.flatMap((p) => (p === POUR_LE_MAGASIN ? magasin : [p])));
    for (const userId of qui) parPersonne.set(userId, [...(parPersonne.get(userId) ?? []), a]);
  }
  let notifications = 0;
  for (const [userId, liste] of parPersonne) {
    const m = messageDAlertes(liste);
    if (!m) continue;
    await notifyUser({ userId, type: "GENERIC", title: m.titre, body: m.corps, link: m.lien });
    notifications += 1;
  }
  return { saute: false, enVigueur: alertes.length, envoyees: nouvelles.length, notifications, rearmees: aRetirer.length };
}
