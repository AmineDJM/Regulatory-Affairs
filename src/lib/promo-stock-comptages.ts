import { lienStockPromo } from "@/lib/chemins/stock-promo";
import { prisma } from "@/lib/prisma";
import { notifyUser } from "@/lib/notify";
import { faitsStockDe, gestionnairesDuMagasin, peutRecevoirDuStock } from "@/lib/queries/promo-stock";
import { chargerFaitsAlertes } from "@/lib/queries/promo-stock-alertes";
import type { PromoFamille } from "@/lib/promo/catalogue";
import type { FaitsStock } from "@/lib/promo/stock-acces";
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
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * UNE RÉCURRENCE PEUT-ELLE PARTIR ? — UNE SEULE ÉCRITURE, LUE PAR LE BATTEMENT ET PAR LA REPRISE
 * (vague « restes 2 »).
 *
 * La règle était écrite deux fois : ici, où le battement met en PAUSE une récurrence dont l'auteur a perdu
 * le droit, et dans `reprendreRecurrenceComptage`, qui refuse de reprendre une récurrence que le premier
 * battement remettrait en pause. Deux copies ont déjà divergé une fois — la reprise ne relisait pas la
 * personne visée, et faisait repartir une récurrence pour la remettre en pause au battement suivant (§118.198c).
 * Et le battement nommait « le magasin central » comme personne sortie de l'équipe quand une récurrence
 * PERSONNE avait perdu son détenteur — `nomDe(null)` : une phrase fausse, que la reprise ne disait pas.
 *
 * Une décision, deux lectures : `motif` dit POURQUOI (la pause l'écrit, la reprise le montre), `remede`
 * dit QUOI FAIRE à qui gère la récurrence (la reprise l'ajoute). L'auteur se relit TOUJOURS en base
 * (`faitsStockDe`) : relu depuis la session de qui reprend, il aurait pu dire autre chose que ce que le
 * battement lira une minute plus tard. `cibles` : qui recevra le comptage — `null` est le magasin.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
export type DeclenchementRecurrence =
  | { ok: true; auteur: FaitsStock; cibles: (string | null)[] }
  | { ok: false; auteur: FaitsStock | null; motif: string; remede: string };

const REMEDE_DROIT = "Son auteur n'a plus le droit de demander ce comptage : la récurrence reste suspendue — planifiez-en une nouvelle.";

export async function peutDeclencherRecurrence(r: { auteurId: string | null; cible: string; holderId: string | null }): Promise<DeclenchementRecurrence> {
  const auteur = r.auteurId ? await faitsStockDe(r.auteurId) : null;
  if (!auteur) {
    return {
      ok: false, auteur: null,
      motif: "Son auteur n'existe plus ou n'est plus actif : plus personne n'a l'autorité de demander ce comptage.",
      remede: "Planifiez-en une nouvelle à votre nom.",
    };
  }
  if (r.cible === "MAGASIN") {
    if (peutDemanderComptage(auteur, null)) return { ok: true, auteur, cibles: [null] };
    return { ok: false, auteur, motif: "Son auteur ne peut plus faire compter le magasin (vue globale du stock, rôle ou accès changés).", remede: REMEDE_DROIT };
  }
  if (r.cible === "PERSONNE") {
    if (!r.holderId) return { ok: false, auteur, motif: "La personne qui devait compter n'est plus désignée.", remede: "Planifiez une nouvelle récurrence." };
    if (!peutDemanderComptage(auteur, r.holderId)) {
      return { ok: false, auteur, motif: `${await nomDe(r.holderId)} n'est plus dans les équipes de son auteur (ou son auteur ne gère plus le matériel des équipes).`, remede: REMEDE_DROIT };
    }
    const peut = await peutRecevoirDuStock(r.holderId, "saisir son comptage");
    if (!peut.ok) return { ok: false, auteur, motif: peut.error, remede: "La récurrence reste suspendue." };
    return { ok: true, auteur, cibles: [r.holderId] };
  }
  if (!peutDemanderAEquipe(auteur)) {
    return { ok: false, auteur, motif: "Son auteur ne gère plus le matériel d'une équipe : « toute son équipe » ne se fait plus compter en son nom.", remede: REMEDE_DROIT };
  }
  // « TOUTE L'ÉQUIPE » se relit à chaque fois ; un membre qui ne peut pas recevoir de stock ne reçoit rien —
  // il ne pourrait pas saisir. Une équipe dont personne ne peut compter n'est pas une raison de suspendre :
  // elle peut retrouver quelqu'un demain.
  const cibles: string[] = [];
  for (const id of auteur.equipe) {
    if (!peutDemanderComptage(auteur, id)) continue;
    if ((await peutRecevoirDuStock(id, "saisir son comptage")).ok) cibles.push(id);
  }
  return { ok: true, auteur, cibles };
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

    // L'AUTORITÉ DE L'AUTEUR, RELUE MAINTENANT — par la règle que la reprise lit aussi.
    const depart = await peutDeclencherRecurrence(r);
    if (!depart.ok) {
      await prisma.promoStockComptageRecurrence.update({
        where: { id: r.id },
        data: { actif: false, pauseLe: maintenant, pauseMotif: depart.motif },
      });
      bilan.suspendues += 1;
      if (r.auteurId && depart.auteur) {
        await notifyUser({ userId: r.auteurId, type: "GENERIC", title: "Comptage récurrent suspendu", body: `Votre comptage récurrent est suspendu : ${depart.motif}`, link: LIEN });
      }
      continue;
    }
    const cibles = depart.cibles;

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
