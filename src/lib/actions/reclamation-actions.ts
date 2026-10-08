"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { rolesWithModule, type SessionUser } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { notifyUser, notifyRoles } from "@/lib/notify";
import { buildRef, createWithRetry } from "@/lib/refs";
import { persistUploadedDocument } from "@/lib/documents";
import { getAppSettings } from "@/lib/settings";
import { fdDate, fdStr, type ActionResult } from "@/lib/actions/types";
import { CHEMIN_RECLAMATIONS, lienReclamation } from "@/lib/chemins/reclamations";
import { declareDesReclamations, instruitLesReclamations, lecteurReclamation } from "@/lib/reclamations/acces";
import {
  PREFIXE_REFERENCE_RECLAMATION, TYPE_RECLAMATION, STATUT_RECLAMATION, estStatutReclamation, estTypeReclamation, lecteurDeLaReclamation,
  lireQuantite, peutContribuer, refusTransition, type StatutReclamation,
} from "@/lib/reclamations/regles";

/**
 * RETOURS & RÉCLAMATIONS — actions serveur (Direction, 08/10).
 *
 * Le terrain (le KAM, depuis sa journée) ou les opérations DÉCLARENT ; le RESPONSABLE est prévenu et instruit
 * (OUVERTE → EN_ANALYSE → CLOTUREE avec sa conclusion). Chaque action relit la réclamation et sa règle
 * (`lecteurDeLaReclamation`) : un identifiant deviné ne suffit jamais.
 */

const MODULE_AUDIT = "Retours & réclamations";
const CHEMIN = CHEMIN_RECLAMATIONS;
const lien = lienReclamation;

function revalider(): void {
  revalidatePath(CHEMIN);
  revalidatePath("/medical/ma-journee");
}

async function prochaineReference(): Promise<string> {
  const annee = new Date().getFullYear();
  const existantes = await prisma.reclamation.findMany({
    where: { reference: { startsWith: `${PREFIXE_REFERENCE_RECLAMATION}-${annee}-` } },
    select: { reference: true },
  });
  return buildRef(PREFIXE_REFERENCE_RECLAMATION, annee, existantes.map((r) => r.reference));
}

/** La réclamation, lue pour une personne — `null` quand elle n'existe pas OU qu'elle ne la lit pas (même réponse). */
async function lisible(user: SessionUser, id: string | null) {
  if (!id) return null;
  const r = await prisma.reclamation.findUnique({
    where: { id },
    select: { id: true, reference: true, status: true, type: true, productLabel: true, declaredById: true, ownerId: true, closedById: true },
  });
  if (!r || !lecteurDeLaReclamation(lecteurReclamation(user), r)) return null;
  return r;
}

/** Ceux qui suivent une réclamation : le déclarant, le responsable, ceux qui ont écrit dans l'échange. */
async function suiveurs(r: { id: string; declaredById: string; ownerId: string | null; closedById: string | null }): Promise<string[]> {
  const auteurs = await prisma.comment.findMany({
    where: { entityType: "RECLAMATION", entityId: r.id, authorId: { not: null } },
    select: { authorId: true }, distinct: ["authorId"],
  });
  return [...new Set([r.declaredById, r.ownerId, r.closedById, ...auteurs.map((a) => a.authorId)].filter((x): x is string => Boolean(x)))];
}

/** Le responsable par défaut : le Directeur des opérations (rôle principal ou secondaire), sinon personne. */
async function responsableParDefaut(): Promise<string | null> {
  const u = await prisma.user.findFirst({
    where: { isActive: true, OR: [{ role: "OPERATIONS_DIRECTOR" }, { secondaryRole: "OPERATIONS_DIRECTOR" }] },
    orderBy: { createdAt: "asc" }, select: { id: true },
  });
  return u?.id ?? null;
}

/**
 * DÉCLARER — le type, le produit (catalogue des BU), le lot, la quantité, l'établissement (annuaire) et/ou le site PCH,
 * la date, ce qui s'est passé ; pièces jointes facultatives. Le responsable est prévenu.
 */
export async function declarerReclamation(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!declareDesReclamations(user)) return { ok: false, error: "Vous n'avez pas le droit de déclarer une réclamation." };

  const type = fdStr(formData, "type");
  if (!estTypeReclamation(type)) return { ok: false, error: "Choisissez le type : retour, réclamation qualité ou rappel de lot." };

  const promoProductId = fdStr(formData, "promoProductId");
  if (!promoProductId) return { ok: false, error: "Choisissez le produit." };
  const produit = await prisma.promoProduct.findFirst({ where: { id: promoProductId, isActive: true }, select: { name: true, productId: true, businessUnitId: true } });
  if (!produit) return { ok: false, error: "Ce produit n'est plus au catalogue : rechargez le formulaire." };

  const institutionId = fdStr(formData, "institutionId");
  let institutionName: string | null = null;
  if (institutionId) {
    const e = await prisma.medicalInstitution.findUnique({ where: { id: institutionId }, select: { name: true } });
    if (!e) return { ok: false, error: "Cet établissement n'existe plus dans l'annuaire : rechargez le formulaire." };
    institutionName = e.name;
  }
  const pchSite = fdStr(formData, "pchSite")?.slice(0, 200) ?? null;
  if (!institutionName && !pchSite) return { ok: false, error: "Indiquez l'établissement ou le site PCH concerné." };

  const quantiteBrute = fdStr(formData, "quantity");
  const quantity = lireQuantite(quantiteBrute);
  if (quantiteBrute && quantity === null) return { ok: false, error: "La quantité doit être un nombre entier de boîtes." };
  const occurredOn = fdDate(formData, "occurredOn");
  if (occurredOn && occurredOn.getTime() > Date.now() + 24 * 3600 * 1000) return { ok: false, error: "La date ne peut pas être dans le futur." };
  const description = fdStr(formData, "description");
  if (!description || description.length < 5) return { ok: false, error: "Décrivez ce qui s'est passé." };

  const ownerId = await responsableParDefaut();
  const cree = await createWithRetry(async () => prisma.reclamation.create({
    data: {
      reference: await prochaineReference(),
      type, status: "OUVERTE",
      promoProductId, productId: produit.productId, productLabel: produit.name, businessUnitId: produit.businessUnitId,
      lot: fdStr(formData, "lot")?.slice(0, 80) ?? null,
      quantity, institutionId: institutionId ?? null, institutionName, pchSite, occurredOn,
      description: description.slice(0, 10000),
      declaredById: user.id, ownerId,
    },
    select: { id: true, reference: true },
  }));

  const fichiers = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  const echecs: string[] = [];
  if (fichiers.length) {
    const maxUploadMb = (await getAppSettings()).maxUploadMb;
    for (const file of fichiers) {
      const r = await persistUploadedDocument(user.id, {
        entityType: "RECLAMATION", entityId: cree.id, category: file.type.startsWith("image/") ? "PHOTO" : "SUPPORTING_DOC",
        confidentiality: "INTERNAL", stepKey: null, file, maxUploadMb,
      });
      if (!r.ok) echecs.push(`${file.name} : ${r.error ?? "échec"}`);
    }
  }

  const titre = `${TYPE_RECLAMATION[type].label} — ${cree.reference}`;
  const corps = `${produit.name}${institutionName ? ` · ${institutionName}` : ""}${pchSite ? ` · ${pchSite}` : ""} (${user.name})`;
  if (ownerId && ownerId !== user.id) {
    await notifyUser({ userId: ownerId, type: "GENERIC", title: titre, body: corps, link: lien(cree.id) }).catch(() => undefined);
  } else if (!ownerId) {
    await notifyRoles(rolesWithModule("RETOURS_RECLAMATIONS", "UPDATE"), { type: "GENERIC", title: titre, body: corps, link: lien(cree.id) }).catch(() => undefined);
  }
  await recordAudit({
    actorId: user.id, action: "CREATE", module: MODULE_AUDIT, entityType: "RECLAMATION", entityId: cree.id,
    summary: `${titre} déclarée — ${produit.name}`,
  });
  revalider();
  return {
    ok: true, id: cree.id,
    message: echecs.length ? `${cree.reference} déclarée, mais ${echecs.length} pièce(s) refusée(s) : ${echecs.join(" ; ")}` : `${cree.reference} déclarée.`,
  };
}

/** L'ÉCHANGE — le déclarant, le responsable et ceux qui instruisent ; chacun des suiveurs est prévenu, sauf l'auteur. */
export async function commenterReclamation(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const r = await lisible(user, fdStr(formData, "reclamationId"));
  if (!r) return { ok: false, error: "Réclamation introuvable." };
  const body = fdStr(formData, "body");
  if (!body) return { ok: false, error: "Message vide." };
  if (!peutContribuer(lecteurReclamation(user), r)) return { ok: false, error: "Cette réclamation est clôturée." };
  await prisma.comment.create({ data: { entityType: "RECLAMATION", entityId: r.id, body: body.slice(0, 10000), authorId: user.id } });
  for (const uid of (await suiveurs(r)).filter((u) => u !== user.id)) {
    await notifyUser({ userId: uid, type: "GENERIC", title: `${r.reference} — nouveau message`, body: `${user.name} : ${body.slice(0, 80)}`, link: lien(r.id) }).catch(() => undefined);
  }
  revalider();
  return { ok: true };
}

/** LE STATUT — prendre en analyse, clôturer (avec la conclusion), rouvrir. Réservé à qui instruit. */
export async function changerStatutReclamation(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const r = await lisible(user, fdStr(formData, "reclamationId"));
  if (!r) return { ok: false, error: "Réclamation introuvable." };
  if (!instruitLesReclamations(user)) return { ok: false, error: "Seul le responsable des réclamations change le statut." };
  const vers = fdStr(formData, "status");
  if (!estStatutReclamation(vers)) return { ok: false, error: "Statut inconnu." };
  const conclusion = fdStr(formData, "conclusion");
  const refus = refusTransition(r.status as StatutReclamation, vers, conclusion);
  if (refus) return { ok: false, error: refus };
  const maintenant = new Date();
  await prisma.reclamation.update({
    where: { id: r.id },
    data: {
      status: vers,
      ...(vers === "EN_ANALYSE" ? { analysedAt: maintenant } : {}),
      ...(vers === "CLOTUREE" ? { closedAt: maintenant, closedById: user.id, conclusion: conclusion!.slice(0, 10000) } : { closedAt: null, closedById: null }),
    },
  });
  const libelle = STATUT_RECLAMATION[vers].label;
  // LE FIL GARDE LA DÉCISION À SA PLACE : la conclusion se lit dans l'échange, pas seulement dans un champ.
  await prisma.comment.create({
    data: { entityType: "RECLAMATION", entityId: r.id, authorId: user.id, body: `Statut : ${libelle}${vers === "CLOTUREE" && conclusion ? ` — ${conclusion.slice(0, 2000)}` : ""}` },
  });
  for (const uid of (await suiveurs(r)).filter((u) => u !== user.id)) {
    await notifyUser({ userId: uid, type: "GENERIC", title: `${r.reference} — ${libelle}`, body: r.productLabel, link: lien(r.id) }).catch(() => undefined);
  }
  await recordAudit({ actorId: user.id, action: "UPDATE", module: MODULE_AUDIT, entityType: "RECLAMATION", entityId: r.id, field: "status", summary: `${r.reference} — ${libelle}` });
  revalider();
  return { ok: true };
}

/** LE RESPONSABLE ET LE CAS DE PHARMACOVIGILANCE LIÉ — qui instruit. Le nouveau responsable est prévenu. */
export async function qualifierReclamation(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const r = await lisible(user, fdStr(formData, "reclamationId"));
  if (!r) return { ok: false, error: "Réclamation introuvable." };
  if (!instruitLesReclamations(user)) return { ok: false, error: "Seul le responsable des réclamations modifie la fiche." };
  const ownerId = fdStr(formData, "ownerId");
  if (ownerId) {
    const u = await prisma.user.findUnique({ where: { id: ownerId }, select: { isActive: true } });
    if (!u?.isActive) return { ok: false, error: "Cette personne n'est plus active." };
  }
  const pvCaseId = fdStr(formData, "pvCaseId");
  if (pvCaseId && !(await prisma.pharmacovigilanceCase.findUnique({ where: { id: pvCaseId }, select: { id: true } }))) {
    return { ok: false, error: "Ce cas de pharmacovigilance n'existe plus." };
  }
  await prisma.reclamation.update({ where: { id: r.id }, data: { ownerId: ownerId ?? null, pvCaseId: pvCaseId ?? null } });
  if (ownerId && ownerId !== r.ownerId && ownerId !== user.id) {
    await notifyUser({ userId: ownerId, type: "GENERIC", title: `${r.reference} — vous en êtes responsable`, body: r.productLabel, link: lien(r.id) }).catch(() => undefined);
  }
  await recordAudit({ actorId: user.id, action: "UPDATE", module: MODULE_AUDIT, entityType: "RECLAMATION", entityId: r.id, summary: `${r.reference} — responsable / cas PV mis à jour` });
  revalider();
  return { ok: true };
}
