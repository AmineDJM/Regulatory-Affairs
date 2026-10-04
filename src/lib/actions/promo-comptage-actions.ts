"use server";

import { CHEMIN_STOCK_PROMO, lienStockPromo } from "@/lib/chemins/stock-promo";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { notifyUser } from "@/lib/notify";
import { fdStr, type ActionResult } from "@/lib/actions/types";
import { articleDansMonPerimetre, faitsStock, faitsStockDe, gestionnairesDuMagasin, peutRecevoirDuStock } from "@/lib/queries/promo-stock";
import { lireDateJour } from "@/lib/promo/stock";
import type { PromoFamille } from "@/lib/promo/catalogue";
import {
  REFUS_COMPTAGE, comptagesSeRecouvrent, echeanceDuComptage, familleComptable, libelleFamilleComptage, lireDelaiJours,
  lireSaisieComptage, peutAnnulerComptage, peutDeciderRefonte, peutDemanderAEquipe, peutDemanderComptage, peutDemanderDesComptages,
  peutGererRecurrence, peutProposerRefonte, peutSaisirComptage, prochaineEcheanceComptage, resumeEcarts,
  CIBLES_COMPTAGE, FREQUENCES_COMPTAGE, FREQUENCE_COMPTAGE_LABEL, type CibleComptage, type FrequenceComptage,
} from "@/lib/promo/comptages";
import { articlesDuComptage, enregistrerSaisieComptage, corrigerSaisieComptage } from "@/lib/promo/comptages-ecriture";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * COMPTAGES, RÉCURRENCES ET REFONTES DU STOCK PROMOTIONNEL — les gestes (§118.168).
 *
 * Chaque action relit les FAITS de la personne (`faitsStock`) et demande à la règle pure
 * (`promo/comptages.ts`) si le geste lui est ouvert — celle que l'écran lit pour montrer le bouton.
 *
 * Aucun de ces gestes n'est offert à Adam : compter atteste un fait PHYSIQUE (« j'en ai 40 en
 * main »), demander un comptage engage le travail d'une personne, et Adam est en pause. Le registre
 * des actions les classe EXCLUDED avec cette raison (§118.158).
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const PATH = CHEMIN_STOCK_PROMO;
const LIEN = lienStockPromo("comptages");
const LIEN_MOI = lienStockPromo("moi");
const MODULE = "Stock promotionnel";

const jourFr = (d: Date) => d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
const debutDuJour = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

/** 8 h à Alger (UTC+1) : l'heure du déclenchement d'une récurrence de comptage. */
const HEURE_UTC_DECLENCHEMENT = 7;

function reussi(id: string, message: string): ActionResult {
  revalidatePath(PATH);
  return { ok: true, id, message };
}

function lireCible(brut: string | null): CibleComptage | null {
  return CIBLES_COMPTAGE.find((c) => c === brut) ?? null;
}

function lireFamille(brut: string | null): { ok: true; famille: PromoFamille | null } | { ok: false } {
  if (!brut) return { ok: true, famille: null };
  return familleComptable(brut) ? { ok: true, famille: brut } : { ok: false };
}

async function nomDe(userId: string | null): Promise<string> {
  if (userId === null) return "le magasin central";
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
  return u?.name ?? "Compte supprimé";
}

/** Prévenir ceux qui comptent : la personne, ou les gestionnaires du magasin. */
async function prevenirDetenteur(holderId: string | null, title: string, body: string, sauf?: string) {
  const ids = holderId ? [holderId] : await gestionnairesDuMagasin();
  for (const userId of new Set(ids)) {
    if (userId === sauf) continue;
    await notifyUser({ userId, type: "GENERIC", title, body, link: LIEN });
  }
}

/**
 * LES DÉTENTEURS VISÉS par une demande — chacun vérifié par la règle, et par le droit de module :
 * sans le stock, la personne ne pourrait pas saisir son comptage.
 */
async function detenteursVises(
  f: Awaited<ReturnType<typeof faitsStock>>,
  cible: CibleComptage,
  holderId: string | null,
): Promise<{ ok: true; vises: (string | null)[]; ecartes: string[] } | { ok: false; error: string }> {
  if (cible === "MAGASIN") {
    if (!peutDemanderComptage(f, null)) return { ok: false, error: REFUS_COMPTAGE.demander };
    return { ok: true, vises: [null], ecartes: [] };
  }
  if (cible === "PERSONNE") {
    if (!holderId) return { ok: false, error: "Choisissez la personne qui doit compter." };
    if (!peutDemanderComptage(f, holderId)) return { ok: false, error: REFUS_COMPTAGE.demander };
    const peut = await peutRecevoirDuStock(holderId, "saisir son comptage");
    if (!peut.ok) return { ok: false, error: peut.error };
    return { ok: true, vises: [holderId], ecartes: [] };
  }
  if (!peutDemanderAEquipe(f)) return { ok: false, error: REFUS_COMPTAGE.demander };
  const vises: string[] = [];
  const ecartes: string[] = [];
  for (const id of f.equipe) {
    if (!peutDemanderComptage(f, id)) continue;
    const peut = await peutRecevoirDuStock(id, "saisir son comptage");
    if (peut.ok) vises.push(id);
    else ecartes.push(id);
  }
  if (!vises.length) return { ok: false, error: "Personne dans votre équipe n'a accès au stock promotionnel : il n'y a personne à qui demander un comptage." };
  return { ok: true, vises, ecartes };
}

// ─────────────────────────────── DEMANDER UN COMPTAGE ───────────────────────────────

/**
 * DEMANDER UN COMPTAGE — à une personne, à toute son équipe, ou au magasin. Un comptage déjà ouvert
 * qui recouvre celui-ci (même détenteur, familles qui se chevauchent) n'est pas doublé : compter
 * deux fois les mêmes articles ferait corriger le premier comptage par le second.
 */
export async function demanderComptage(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const f = await faitsStock(user);
  // La porte d'ENTRÉE, nommée ici pour que la carte de confirmation la dise ; chaque détenteur visé
  // est ensuite revérifié un à un par la même règle (`detenteursVises`).
  if (!peutDemanderDesComptages(f)) return { ok: false, error: REFUS_COMPTAGE.demander };
  const cible = lireCible(fdStr(formData, "cible"));
  if (!cible) return { ok: false, error: "Choisissez à qui demander le comptage." };
  const fam = lireFamille(fdStr(formData, "famille"));
  if (!fam.ok) return { ok: false, error: "Famille inconnue : un comptage porte sur les consommables, les durables, ou tout le matériel." };
  const vises = await detenteursVises(f, cible, fdStr(formData, "holderId"));
  if (!vises.ok) return { ok: false, error: vises.error };

  const maintenant = new Date();
  const brut = fdStr(formData, "echeance");
  const echeance = brut ? lireDateJour(brut) : echeanceDuComptage(maintenant, 7);
  if (!echeance) return { ok: false, error: "Date d'échéance illisible (format attendu : AAAA-MM-JJ)." };
  if (echeance.getTime() < debutDuJour(maintenant).getTime()) return { ok: false, error: "L'échéance est déjà passée : choisissez aujourd'hui ou une date à venir." };
  const note = fdStr(formData, "note");

  const ouverts = await prisma.promoStockComptage.findMany({
    where: { statut: "DEMANDE", holderId: { in: vises.vises.filter((v): v is string => v !== null) } },
    select: { holderId: true, famille: true },
  });
  const ouvertsMagasin = vises.vises.includes(null)
    ? await prisma.promoStockComptage.findMany({ where: { statut: "DEMANDE", holderId: null }, select: { holderId: true, famille: true } })
    : [];
  const dejaOuverts = [...ouverts, ...ouvertsMagasin].map((o) => ({ holderId: o.holderId, famille: o.famille as PromoFamille | null }));
  const aCreer = vises.vises.filter((h) => !dejaOuverts.some((o) => comptagesSeRecouvrent(o, { holderId: h, famille: fam.famille })));
  if (!aCreer.length) {
    return {
      ok: false,
      error: cible === "PERSONNE" || cible === "MAGASIN"
        ? `Un comptage est déjà demandé à ${await nomDe(vises.vises[0] ?? null)} pour ces articles : attendez sa saisie, ou annulez-le avant d'en demander un autre.`
        : "Chaque personne de votre équipe a déjà un comptage ouvert pour ces articles.",
    };
  }

  const crees = await prisma.$transaction(aCreer.map((holderId) => prisma.promoStockComptage.create({
    data: { holderId, famille: fam.famille, demandeurId: user.id, echeance, note },
    select: { id: true, holderId: true },
  })));
  const quoi = libelleFamilleComptage(fam.famille);
  for (const c of crees) {
    await prevenirDetenteur(
      c.holderId,
      "Comptage de stock demandé",
      `${await nomDe(user.id)} vous demande de compter ${c.holderId === null ? "le magasin central" : "votre stock"} (${quoi}) avant le ${jourFr(echeance)}${note ? ` — « ${note} »` : ""}. Comptez ce que vous avez réellement en main : l'écart avec le registre sera corrigé.`,
      user.id,
    );
  }
  await recordAudit({
    actorId: user.id, action: "CREATE", module: MODULE, entityId: crees[0]!.id,
    summary: `Comptage demandé (${quoi}, échéance ${jourFr(echeance)}) — ${crees.length} détenteur(s)`,
  });
  const restants = vises.vises.length - aCreer.length;
  const details = [
    restants > 0 ? `${restants} avai(en)t déjà un comptage ouvert` : null,
    vises.ecartes.length > 0 ? `${vises.ecartes.length} personne(s) de l'équipe n'ont pas accès au stock et n'ont rien reçu` : null,
  ].filter(Boolean);
  return reussi(crees[0]!.id, `${crees.length} comptage(s) demandé(s), à saisir avant le ${jourFr(echeance)}${details.length ? ` (${details.join(" ; ")})` : ""}.`);
}

// ─────────────────────────────── SAISIR UN COMPTAGE ───────────────────────────────

/**
 * SAISIR UN COMPTAGE — l'attestation de celui qui détient le matériel. Chaque article que le
 * registre lui attribue doit avoir sa ligne (« 0 » compris) ; un article trouvé s'ajoute. Chaque
 * écart devient une correction au registre qui porte ce comptage.
 */
export async function saisirComptage(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const f = await faitsStock(user);
  const comptageId = fdStr(formData, "comptageId");
  if (!comptageId) return { ok: false, error: "Comptage non précisé." };
  const c = await prisma.promoStockComptage.findUnique({
    where: { id: comptageId },
    select: { id: true, holderId: true, famille: true, demandeurId: true, statut: true, createdAt: true },
  });
  if (!c) return { ok: false, error: "Comptage introuvable." };
  if (!peutSaisirComptage(f, c.holderId)) return { ok: false, error: REFUS_COMPTAGE.saisir };
  if (c.statut !== "DEMANDE") return { ok: false, error: c.statut === "SAISI" ? "Ce comptage est déjà saisi." : "Ce comptage a été annulé." };

  const { attendus, ajoutables, libelles } = await articlesDuComptage(user.id, c.holderId, c.famille as PromoFamille | null);
  const ids = formData.getAll("itemId").map(String);
  const comptes = formData.getAll("compte").map(String);
  if (ids.length !== comptes.length) return { ok: false, error: "Saisie incomplète : chaque article doit avoir sa quantité. Rechargez la page." };
  const lecture = lireSaisieComptage(
    ids.map((itemId, i) => ({ itemId, compte: comptes[i] ?? "" })),
    new Set(attendus), new Set(ajoutables), (id) => libelles.get(id) ?? "Article",
  );
  if (!lecture.ok) return { ok: false, error: `Comptage à revoir : ${lecture.faute}` };

  const maintenant = new Date();
  const note = fdStr(formData, "note");
  const demandeur = await nomDe(c.demandeurId);
  const motif = `Comptage du ${jourFr(maintenant)} demandé par ${demandeur}${note ? ` — ${note}` : ""}`;
  const r = await enregistrerSaisieComptage({
    comptageId, holderId: c.holderId, lignes: lecture.lignes, libelles, auteurId: user.id, motif, maintenant,
  });
  if (!r.ok) return { ok: false, error: r.refus };

  const resume = resumeEcarts(r.lignes);
  if (c.demandeurId !== user.id) {
    await notifyUser({
      userId: c.demandeurId, type: "GENERIC", title: "Comptage saisi",
      body: `${await nomDe(user.id)} a compté ${c.holderId === null ? "le magasin central" : "son stock"} (${libelleFamilleComptage(c.famille as PromoFamille | null)}). ${resume}`,
      link: LIEN,
    });
  }
  await recordAudit({ actorId: user.id, action: "UPDATE", module: MODULE, entityId: comptageId, summary: `Comptage saisi — ${resume}` });
  return reussi(comptageId, resume);
}

// ─────────────────────────────── ANNULER UN COMPTAGE ───────────────────────────────

export async function annulerComptage(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const f = await faitsStock(user);
  const comptageId = fdStr(formData, "comptageId");
  if (!comptageId) return { ok: false, error: "Comptage non précisé." };
  const motif = fdStr(formData, "motif");
  if (!motif) return { ok: false, error: "Dites pourquoi vous annulez ce comptage : la personne qui devait compter en est prévenue." };
  const c = await prisma.promoStockComptage.findUnique({ where: { id: comptageId }, select: { id: true, holderId: true, demandeurId: true, statut: true } });
  if (!c) return { ok: false, error: "Comptage introuvable." };
  if (!peutAnnulerComptage(f, c.demandeurId)) return { ok: false, error: REFUS_COMPTAGE.annuler };
  const pris = await prisma.promoStockComptage.updateMany({
    where: { id: comptageId, statut: "DEMANDE" },
    data: { statut: "ANNULE", annuleLe: new Date(), annuleParId: user.id, annuleMotif: motif },
  });
  if (pris.count === 0) return { ok: false, error: "Ce comptage n'est plus à faire : il vient d'être saisi ou annulé." };
  await prevenirDetenteur(c.holderId, "Comptage annulé", `Le comptage qui vous était demandé est annulé par ${await nomDe(user.id)} : « ${motif} ». Vous n'avez rien à saisir.`, user.id);
  await recordAudit({ actorId: user.id, action: "UPDATE", module: MODULE, entityId: comptageId, summary: `Comptage annulé — ${motif}` });
  return reussi(comptageId, "Comptage annulé ; la personne en est prévenue.");
}

// ─────────────────────────────── CORRIGER UN COMPTAGE SAISI ───────────────────────────────

/**
 * CORRIGER UN COMPTAGE SAISI (audit 360°, lot C4b, R19) — « 40 » tapé pour « 14 ».
 *
 * Seule voie jusqu'ici : annuler, puis redemander un comptage, l'écart faux restant au registre entre
 * les deux. Celui qui a compté corrige ce qu'il a compté — c'est la même attestation que la saisie
 * (`peutSaisirComptage`), jamais le Super Admin à sa place (§118.164b). Le motif est exigé, après les
 * refus d'état (§118.18). L'écriture est la contre-correction de `corrigerSaisieComptage`.
 */
export async function corrigerComptage(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const f = await faitsStock(user);
  const comptageId = fdStr(formData, "comptageId");
  if (!comptageId) return { ok: false, error: "Comptage non précisé." };
  const c = await prisma.promoStockComptage.findUnique({
    where: { id: comptageId },
    select: { id: true, holderId: true, famille: true, demandeurId: true, statut: true, saisiLe: true },
  });
  if (!c) return { ok: false, error: "Comptage introuvable." };
  if (!peutSaisirComptage(f, c.holderId)) return { ok: false, error: REFUS_COMPTAGE.saisir };
  if (c.statut !== "SAISI" || !c.saisiLe) {
    return { ok: false, error: c.statut === "DEMANDE" ? "Ce comptage n'est pas encore saisi : saisissez-le, il n'y a rien à corriger." : "Ce comptage a été annulé : il n'y a rien à corriger." };
  }
  const ids = formData.getAll("itemId").map(String);
  const comptes = formData.getAll("compte").map(String);
  if (ids.length === 0 || ids.length !== comptes.length) return { ok: false, error: "Correction incomplète : chaque article corrigé doit avoir sa quantité. Rechargez la page." };
  const vus = new Set<string>();
  const corrections: { itemId: string; compte: number }[] = [];
  for (let i = 0; i < ids.length; i += 1) {
    const brut = (comptes[i] ?? "").replace(/\s/g, "").replace(",", ".");
    const n = brut === "" ? NaN : Number(brut);
    if (!Number.isFinite(n) || n < 0) return { ok: false, error: `Ligne ${i + 1} : la quantité comptée doit être un nombre positif ou nul.` };
    if (vus.has(ids[i])) return { ok: false, error: `Ligne ${i + 1} : cet article figure deux fois dans la correction.` };
    vus.add(ids[i]);
    corrections.push({ itemId: ids[i], compte: Math.round(n * 1000) / 1000 });
  }
  const motif = fdStr(formData, "motif");
  if (motif === null) return { ok: false, error: "Dites pourquoi vous corrigez ce comptage : la personne qui l'a demandé en est prévenue, et l'écart corrigé porte ce motif au registre." };

  const { libelles } = await articlesDuComptage(user.id, c.holderId, c.famille as PromoFamille | null);
  const r = await corrigerSaisieComptage({
    comptageId, holderId: c.holderId, saisiLe: c.saisiLe, corrections, libelles,
    auteurId: user.id, motif, maintenant: new Date(),
  });
  if (!r.ok) return { ok: false, error: r.refus };
  const resume = r.lignes.map((l) => `${l.libelle} : ${l.avant} → ${l.apres}`).join(" ; ");
  if (c.demandeurId !== user.id) {
    await notifyUser({
      userId: c.demandeurId, type: "GENERIC", title: "Comptage corrigé",
      body: `${await nomDe(user.id)} a corrigé ${c.holderId === null ? "le comptage du magasin central" : "son comptage"} : ${resume} — « ${motif} ».`,
      link: LIEN,
    });
  }
  await recordAudit({ actorId: user.id, action: "UPDATE", module: MODULE, entityId: comptageId, summary: `Comptage corrigé — ${resume} — ${motif}` });
  return reussi(comptageId, `Comptage corrigé — ${resume}.`);
}

// ─────────────────────────────── LES RÉCURRENCES ───────────────────────────────

function lireFrequence(brut: string | null): FrequenceComptage | null {
  return FREQUENCES_COMPTAGE.find((x) => x === brut) ?? null;
}

/**
 * PLANIFIER UN COMPTAGE RÉCURRENT. La première échéance se choisit ; les suivantes se calculent
 * DEPUIS elle (un mensuel du 31 tombe le 28 février puis le 31 mars). Rien ne part tout de suite :
 * le battement déclenche chaque occurrence à 8 h, en relisant l'autorité de l'auteur.
 */
export async function planifierComptage(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const f = await faitsStock(user);
  if (!peutDemanderDesComptages(f)) return { ok: false, error: REFUS_COMPTAGE.demander };
  const cible = lireCible(fdStr(formData, "cible"));
  if (!cible) return { ok: false, error: "Choisissez à qui demander le comptage." };
  const fam = lireFamille(fdStr(formData, "famille"));
  if (!fam.ok) return { ok: false, error: "Famille inconnue : un comptage porte sur les consommables, les durables, ou tout le matériel." };
  const frequence = lireFrequence(fdStr(formData, "frequence"));
  if (!frequence) return { ok: false, error: "Choisissez la cadence (chaque semaine, mois, trimestre ou semestre)." };
  const holderId = cible === "PERSONNE" ? fdStr(formData, "holderId") : null;
  const vises = await detenteursVises(f, cible, holderId);
  if (!vises.ok) return { ok: false, error: vises.error };
  const jour = lireDateJour(fdStr(formData, "premiereLe"));
  if (!jour) return { ok: false, error: "Indiquez la date du premier comptage (format attendu : AAAA-MM-JJ)." };
  const maintenant = new Date();
  if (jour.getTime() < debutDuJour(maintenant).getTime()) return { ok: false, error: "La première date est déjà passée : choisissez aujourd'hui ou une date à venir." };
  const brutDelai = fdStr(formData, "delaiJours");
  const delaiJours = brutDelai ? lireDelaiJours(brutDelai) : 7;
  if (delaiJours == null) return { ok: false, error: "Le délai pour compter se dit en jours, de 1 à 60." };
  const note = fdStr(formData, "note");
  const ancreLe = new Date(jour.getTime() + HEURE_UTC_DECLENCHEMENT * 3_600_000);

  const r = await prisma.promoStockComptageRecurrence.create({
    data: { cible, holderId, famille: fam.famille, frequence, ancreLe, prochaineLe: ancreLe, delaiJours, note, auteurId: user.id },
    select: { id: true },
  });
  const qui = cible === "EQUIPE" ? "toute votre équipe" : await nomDe(holderId);
  await recordAudit({
    actorId: user.id, action: "CREATE", module: MODULE, entityId: r.id,
    summary: `Comptage récurrent planifié — ${qui}, ${FREQUENCE_COMPTAGE_LABEL[frequence].toLowerCase()}, ${libelleFamilleComptage(fam.famille)}, dès le ${jourFr(jour)}`,
  });
  return reussi(r.id, `Comptage planifié : ${qui}, ${FREQUENCE_COMPTAGE_LABEL[frequence].toLowerCase()}, à partir du ${jourFr(jour)} (${delaiJours} jour(s) pour compter).`);
}

async function chargerRecurrence(id: string | null) {
  if (!id) return null;
  return prisma.promoStockComptageRecurrence.findUnique({
    where: { id },
    select: { id: true, cible: true, holderId: true, auteurId: true, actif: true, ancreLe: true, frequence: true },
  });
}

export async function suspendreRecurrenceComptage(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const f = await faitsStock(user);
  const r = await chargerRecurrence(fdStr(formData, "recurrenceId"));
  if (!r) return { ok: false, error: "Récurrence introuvable." };
  if (!peutGererRecurrence(f, r.auteurId)) return { ok: false, error: REFUS_COMPTAGE.recurrence };
  const pris = await prisma.promoStockComptageRecurrence.updateMany({
    where: { id: r.id, actif: true },
    data: { actif: false, pauseLe: new Date(), pauseMotif: `Suspendue par ${await nomDe(user.id)}.` },
  });
  if (pris.count === 0) return { ok: false, error: "Cette récurrence est déjà suspendue." };
  await recordAudit({ actorId: user.id, action: "UPDATE", module: MODULE, entityId: r.id, summary: "Comptage récurrent suspendu" });
  return reussi(r.id, "Récurrence suspendue : plus aucun comptage ne partira jusqu'à sa reprise.");
}

/**
 * REPRENDRE une récurrence — sans RATTRAPAGE : la prochaine échéance est la prochaine date à
 * venir, pas celles qui sont passées pendant la pause. Et l'autorité de l'AUTEUR est relue tout
 * de suite : reprendre une récurrence que le premier battement remettrait en pause serait une
 * reprise qui n'en est pas une.
 */
export async function reprendreRecurrenceComptage(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const f = await faitsStock(user);
  const r = await chargerRecurrence(fdStr(formData, "recurrenceId"));
  if (!r) return { ok: false, error: "Récurrence introuvable." };
  if (!peutGererRecurrence(f, r.auteurId)) return { ok: false, error: REFUS_COMPTAGE.recurrence };
  if (r.actif) return { ok: false, error: "Cette récurrence est déjà active." };
  const auteur = r.auteurId === user.id ? f : r.auteurId ? await faitsStockDe(r.auteurId) : null;
  if (!auteur) return { ok: false, error: "L'auteur de cette récurrence n'existe plus ou n'est plus actif : planifiez-en une nouvelle à votre nom." };
  // LA PERSONNE VISÉE, AUSSI (vague « restes ») : le battement suspend une récurrence dont le détenteur a
  // disparu ou n'a plus le stock (`declencherComptagesRecurrents`, `peutRecevoirDuStock`) — la reprendre
  // sans le relire la faisait repartir pour la remettre en pause au premier battement. Une PERSONNE sans
  // détenteur ne relève pas de la règle du magasin : elle ne se reprend pas.
  if (r.cible === "PERSONNE" && !r.holderId) return { ok: false, error: "La personne qui devait compter n'est plus désignée : planifiez une nouvelle récurrence." };
  const autorise = r.cible === "EQUIPE" ? peutDemanderAEquipe(auteur) : peutDemanderComptage(auteur, r.cible === "MAGASIN" ? null : r.holderId);
  if (!autorise) return { ok: false, error: "Son auteur n'a plus le droit de demander ce comptage (équipe, rôle ou accès changés) : planifiez-en une nouvelle." };
  if (r.cible === "PERSONNE" && r.holderId) {
    const peut = await peutRecevoirDuStock(r.holderId, "saisir son comptage");
    if (!peut.ok) return { ok: false, error: `${peut.error} La récurrence reste suspendue.` };
  }
  const prochaineLe = prochaineEcheanceComptage(r.ancreLe, r.frequence as FrequenceComptage, new Date());
  // CONDITIONNELLE sur la pause LUE : deux reprises croisées n'écrivent qu'une reprise (et un journal),
  // et une récurrence supprimée entre-temps répond par une phrase, pas par une erreur de base.
  const reprise = await prisma.promoStockComptageRecurrence.updateMany({
    where: { id: r.id, actif: false },
    data: { actif: true, pauseLe: null, pauseMotif: null, prochaineLe },
  });
  if (reprise.count === 0) return { ok: false, error: "Cette récurrence vient d'être reprise ou supprimée — rouvrez la liste." };
  await recordAudit({ actorId: user.id, action: "UPDATE", module: MODULE, entityId: r.id, summary: `Comptage récurrent repris — prochain le ${jourFr(prochaineLe)}` });
  return reussi(r.id, `Récurrence reprise : prochain comptage le ${jourFr(prochaineLe)}.`);
}

export async function supprimerRecurrenceComptage(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const f = await faitsStock(user);
  const r = await chargerRecurrence(fdStr(formData, "recurrenceId"));
  if (!r) return { ok: false, error: "Récurrence introuvable." };
  if (!peutGererRecurrence(f, r.auteurId)) return { ok: false, error: REFUS_COMPTAGE.recurrence };
  // Les comptages qu'elle a déjà produits restent : ce sont des demandes faites, avec leur histoire.
  await prisma.promoStockComptageRecurrence.delete({ where: { id: r.id } });
  await recordAudit({ actorId: user.id, action: "DELETE", module: MODULE, entityId: r.id, summary: "Comptage récurrent supprimé (les comptages déjà demandés restent)" });
  return reussi(r.id, "Récurrence supprimée. Les comptages qu'elle a déjà demandés restent à faire.");
}

// ─────────────────────────────── LES REFONTES ───────────────────────────────

/**
 * PROPOSER LA REFONTE d'un support DURABLE — un banner usé, un visuel dépassé. Une seule
 * proposition OUVERTE par personne et par article : la même idée deux fois ne pèse pas double.
 */
export async function proposerRefonte(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const f = await faitsStock(user);
  const itemId = fdStr(formData, "itemId");
  if (!itemId) return { ok: false, error: "Choisissez l'article." };
  const it = await articleDansMonPerimetre(user.id, itemId);
  if (!it) return { ok: false, error: "Article introuvable." };
  if (!peutProposerRefonte(f, it.catalogue.famille)) return { ok: false, error: REFUS_COMPTAGE.refonte };
  if (!it.isActive) return { ok: false, error: "Cet article est archivé : sa refonte n'a plus d'objet." };
  const motif = fdStr(formData, "motif");
  if (!motif) return { ok: false, error: "Dites ce qui ne va pas (usé, abîmé, visuel dépassé, mentions à jour…) : c'est ce que la Direction Marketing lira." };
  const DEJA = "Vous avez déjà proposé une refonte de cet article : elle attend la décision de la Direction Marketing.";
  const deja = await prisma.promoStockRefonte.findFirst({ where: { itemId, auteurId: user.id, statut: "OUVERTE" }, select: { id: true } });
  if (deja) return { ok: false, error: DEJA };
  // La lecture ci-dessus donne la phrase ; c'est l'index PARTIEL (une OUVERTE par personne et par
  // article) qui tient la règle : deux envois simultanés liraient tous deux « rien d'ouvert ».
  let r: { id: string };
  try {
    r = await prisma.promoStockRefonte.create({ data: { itemId, auteurId: user.id, motif }, select: { id: true } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { ok: false, error: DEJA };
    throw e;
  }
  for (const userId of await gestionnairesDuMagasin()) {
    if (userId === user.id) continue;
    await notifyUser({
      userId, type: "GENERIC", title: "Refonte proposée",
      body: `${await nomDe(user.id)} propose de refaire « ${it.name} » : « ${motif} ».`,
      link: lienStockPromo("tableau"),
    });
  }
  await recordAudit({ actorId: user.id, action: "CREATE", module: MODULE, entityId: r.id, summary: `Refonte proposée — ${it.name} : ${motif}` });
  return reussi(r.id, "Proposition envoyée à la Direction Marketing.");
}

/**
 * RETENIR ou ÉCARTER une refonte. Écarter exige un mot : la personne qui l'a proposée doit savoir
 * pourquoi. Retenir ne commande rien — c'est la décision ; la commande passe par le circuit d'achat.
 */
export async function deciderRefonte(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const f = await faitsStock(user);
  if (!peutDeciderRefonte(f)) return { ok: false, error: REFUS_COMPTAGE.decider };
  const refonteId = fdStr(formData, "refonteId");
  if (!refonteId) return { ok: false, error: "Proposition non précisée." };
  const decision = fdStr(formData, "decision");
  if (decision !== "RETENUE" && decision !== "ECARTEE") return { ok: false, error: "Choisissez : retenir ou écarter." };
  const note = fdStr(formData, "note");
  // `=== null` et non `!note` : la dérivation des contrats lit un `if (!v)` comme « champ
  // obligatoire » (§118.138) — or la note n'est exigée que pour ÉCARTER, pas pour retenir.
  if (decision === "ECARTEE" && note === null) return { ok: false, error: "Dites pourquoi vous l'écartez : la personne qui l'a proposée en est prévenue." };
  const r = await prisma.promoStockRefonte.findUnique({
    where: { id: refonteId },
    select: { id: true, auteurId: true, itemId: true, item: { select: { name: true } } },
  });
  // L'article dans SON périmètre d'entité — celui que l'écran lui montre : la gestionnaire d'une
  // société ne tranche pas, par un identifiant, la refonte d'un support d'une autre. Même phrase
  // que l'absence : un refus qui confirmerait l'existence en dirait déjà trop.
  if (!r || !(await articleDansMonPerimetre(user.id, r.itemId))) return { ok: false, error: "Proposition introuvable." };
  const pris = await prisma.promoStockRefonte.updateMany({
    where: { id: refonteId, statut: "OUVERTE" },
    data: { statut: decision, decideParId: user.id, decideLe: new Date(), noteDecision: note },
  });
  if (pris.count === 0) return { ok: false, error: "Cette proposition est déjà tranchée." };
  if (r.auteurId !== user.id) {
    await notifyUser({
      userId: r.auteurId, type: "GENERIC",
      title: decision === "RETENUE" ? "Refonte retenue" : "Refonte écartée",
      body: decision === "RETENUE"
        ? `Votre proposition de refaire « ${r.item.name} » est retenue par ${await nomDe(user.id)}${note ? ` : « ${note} »` : ""}. La commande suivra le circuit d'achat du matériel promotionnel.`
        : `Votre proposition de refaire « ${r.item.name} » est écartée par ${await nomDe(user.id)} : « ${note} ».`,
      link: LIEN_MOI,
    });
  }
  await recordAudit({ actorId: user.id, action: "UPDATE", module: MODULE, entityId: refonteId, summary: `Refonte ${decision === "RETENUE" ? "retenue" : "écartée"} — ${r.item.name}${note ? ` : ${note}` : ""}` });
  return reussi(refonteId, decision === "RETENUE" ? "Refonte retenue ; son auteur en est prévenu." : "Refonte écartée ; son auteur en est prévenu.");
}
