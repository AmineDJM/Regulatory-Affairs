"use server";

import type { DocumentRequestStatus, EntityType, LegalDocKind } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { hasGlobalView } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { notifyUser } from "@/lib/notify";
import { buildRef, createWithRetry } from "@/lib/refs";
import { fdStr, type ActionResult } from "@/lib/actions/types";
import { nextDocRequestStatus, canSubmit, canDecide, canCancel } from "@/lib/doc-request";
import { companyIdForNew } from "@/lib/company";
import { pieceKindOf, legalKindOfPiece, legalTitleFromPiece, PIECE_KIND_LABEL } from "@/lib/legal/from-piece";

const PATH = "/pieces";

/**
 * DEMANDER UNE PIÈCE À QUELQU'UN — n'importe qui, pas seulement le secrétariat.
 *
 * Les autorisations ne reposent PAS sur le module de l'objet visé : celui à qui l'on demande une
 * facture n'a pas forcément accès au poste de dépense, et c'est normal. Elles reposent sur le
 * fil lui-même — on est le demandeur, ou celui à qui l'on demande. C'est ce qui permet de
 * réclamer une pièce à un collègue sans lui ouvrir tout un module au passage.
 */

async function nextRef(): Promise<string> {
  const year = new Date().getFullYear();
  const refs = await prisma.documentRequest.findMany({
    where: { reference: { startsWith: `PIE-${year}-` } }, select: { reference: true },
  });
  return buildRef("PIE", year, refs.map((r) => r.reference));
}

function revalidate(id?: string, link?: string | null) {
  revalidatePath(PATH);
  if (id) revalidatePath(`${PATH}/${id}`);
  if (link) revalidatePath(link);
}

const dateOf = (raw: string | null): Date | null => {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
};

/** Demander une pièce. L'objet visé sert de contexte ; le lien ramène à son écran. */
export async function requestDocument(formData: FormData): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const entityType = fdStr(formData, "entityType");
    const entityId = fdStr(formData, "entityId");
    const askedToId = fdStr(formData, "askedToId");
    const label = fdStr(formData, "label");

    if (!entityType || !entityId) return { ok: false, error: "Objet non précisé." };
    if (!askedToId) return { ok: false, error: "Indiquez à qui vous demandez la pièce." };
    // Se demander une pièce à soi-même n'attend rien de personne : c'est un dépôt, pas une demande.
    if (askedToId === user.id) return { ok: false, error: "Pour déposer une pièce vous-même, utilisez « Ajouter une pièce »." };
    if (!label) return { ok: false, error: "Dites CE QUE vous demandez — « la facture définitive de l'agence », pas « pièce n° 3 »." };

    const req = await createWithRetry(async () =>
      prisma.documentRequest.create({
        data: {
          reference: await nextRef(),
          entityType: entityType as EntityType,
          entityId,
          link: fdStr(formData, "link"),
          label,
          // LA NATURE DE LA PIÈCE — c'est elle qui décide si l'acceptation la classe dans Legal.
          kind: pieceKindOf(fdStr(formData, "kind")),
          note: fdStr(formData, "note"),
          dueDate: dateOf(fdStr(formData, "dueDate")),
          askedById: user.id,
          askedToId,
          status: "PENDING",
        },
      }),
    );

    await notifyUser({
      userId: askedToId, type: "ASSIGNMENT",
      title: "Une pièce vous est demandée",
      body: `${req.reference} — ${label}`,
      link: `${PATH}/${req.id}`,
    });
    await recordAudit({
      actorId: user.id, action: "CREATE", module: "Demandes de pièce",
      entityType: "DOCUMENT_REQUEST", entityId: req.id, summary: `Pièce demandée — ${req.reference} : ${label}`,
    });
    revalidate(req.id, req.link);
    return { ok: true, id: req.id };
  } catch (err) {
    console.error("[doc-request] requestDocument failed", err);
    return { ok: false, error: "La demande n'a pas pu être créée." };
  }
}

/** Celui à qui l'on demande signale avoir déposé ses pièces. */
export async function submitDocumentRequest(formData: FormData): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const id = fdStr(formData, "id");
    if (!id) return { ok: false, error: "Demande introuvable." };
    const req = await prisma.documentRequest.findUnique({ where: { id } });
    if (!req) return { ok: false, error: "Demande introuvable." };
    if (!canSubmit(req, user.id)) return { ok: false, error: "Seule la personne sollicitée peut déposer." };

    // Signaler « déposé » sans rien avoir joint enverrait le demandeur chercher un fichier
    // inexistant — et le fil repartirait pour un tour inutile.
    const count = await prisma.document.count({ where: { entityType: "DOCUMENT_REQUEST", entityId: id } });
    if (count === 0) return { ok: false, error: "Joignez au moins une pièce avant de signaler le dépôt." };

    const next = nextDocRequestStatus(req.status, "SUBMIT");
    await prisma.documentRequest.update({
      where: { id },
      data: { status: next as DocumentRequestStatus, submittedAt: new Date(), responseNote: fdStr(formData, "note") },
    });
    await notifyUser({
      userId: req.askedById, type: "GENERIC",
      title: "Pièce déposée", body: `${req.reference} — ${req.label}`, link: `${PATH}/${id}`,
    });
    revalidate(id, req.link);
    return { ok: true, id };
  } catch (err) {
    console.error("[doc-request] submitDocumentRequest failed", err);
    return { ok: false, error: "L'opération a échoué." };
  }
}

/**
 * CLASSER LA PIÈCE ACCEPTÉE DANS LEGAL — quand sa nature engage la société.
 *
 * ── CE QUI SE PASSE, ET DANS QUEL ORDRE ─────────────────────────────────────────────────────
 *
 * Une pièce Legal est créée sous la nature déclarée (facture, bon de commande, devis, contrat),
 * et les fichiers déposés DÉMÉNAGENT vers elle. Ils ne sont pas recopiés : un fichier, un seul
 * domicile — deux copies divergent le jour où l'une est remplacée. Le fil de la demande continue
 * de les montrer, en les lisant à leur nouvelle adresse (`/pieces/[id]`).
 *
 * ── LES DROITS, QUI SONT LE VRAI PIÈGE ──────────────────────────────────────────────────────
 *
 * Un document Legal SANS lecteur désigné est visible de TOUT le module. Classer sans y penser
 * exposerait donc, en silence, une facture à des gens qui n'avaient rien à en connaître. La pièce
 * naît RESTREINTE — celui qui a demandé, celui qui a déposé — et Legal offre déjà le geste
 * inverse, explicite : « Ouvrir à tout le module ».
 *
 * BEST-EFFORT : un classement qui échoue ne doit pas annuler l'acceptation. La pièce est bien
 * déposée et acceptée ; ce qui manque est son entrée au registre, et elle se rattrape.
 */
async function classerDansLegal(
  req: { id: string; reference: string; label: string; kind: string; legalDocumentId: string | null; askedById: string; askedToId: string },
  actorId: string,
): Promise<{ id: string; kindLabel: string } | null> {
  const legalKind = legalKindOfPiece(req.kind);
  if (!legalKind) return null;
  // Déjà classée : accepter une seconde fois ne crée pas un second engagement.
  if (req.legalDocumentId) return null;
  try {
    const doc = await prisma.legalDocument.create({
      data: {
        title: legalTitleFromPiece(req.label, req.reference),
        kind: legalKind as LegalDocKind,
        companyId: await companyIdForNew(actorId),
        sourceType: "DOCUMENT_REQUEST",
        sourceId: req.id,
        createdById: actorId,
        updatedById: actorId,
        // Ni référence, ni montant, ni dates, ni contrepartie : on n'INVENTE rien à partir d'un
        // fichier qu'on n'a pas lu. Ce sont des champs qu'un humain remplit en ouvrant la pièce.
        notes: `Enregistrée depuis la demande de pièce ${req.reference}.`,
      },
      select: { id: true },
    });
    // LES LECTEURS SUIVENT — sans quoi classer une facture l'exposerait à tout le module.
    await prisma.legalDocumentReader.createMany({
      data: [...new Set([req.askedById, req.askedToId, actorId])].map((userId) => ({
        documentId: doc.id, userId, grantedById: actorId,
      })),
      skipDuplicates: true,
    });
    // LE FICHIER DÉMÉNAGE, il n'est pas recopié.
    await prisma.document.updateMany({
      where: { entityType: "DOCUMENT_REQUEST", entityId: req.id },
      data: { entityType: "LEGAL_DOCUMENT", entityId: doc.id },
    });
    await prisma.documentRequest.update({ where: { id: req.id }, data: { legalDocumentId: doc.id } });
    await recordAudit({
      actorId, action: "CREATE", module: "Legal", entityType: "LEGAL_DOCUMENT", entityId: doc.id,
      summary: `Pièce ${req.reference} enregistrée dans Legal (${legalKind}) — ${req.label}`,
    });
    return { id: doc.id, kindLabel: PIECE_KIND_LABEL[pieceKindOf(req.kind)].toLowerCase() };
  } catch (e) {
    console.error("[doc-request] classement Legal impossible", e);
    return null;
  }
}

/** Celui qui a demandé accepte la pièce, ou la refuse — et la demande repart alors. */
export async function decideDocumentRequest(formData: FormData): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const id = fdStr(formData, "id");
    const accept = fdStr(formData, "accept") === "1";
    if (!id) return { ok: false, error: "Demande introuvable." };
    const req = await prisma.documentRequest.findUnique({ where: { id } });
    if (!req) return { ok: false, error: "Demande introuvable." };
    if (!canDecide(req, user.id)) return { ok: false, error: "Seule la personne qui a demandé peut trancher." };

    const next = nextDocRequestStatus(req.status, accept ? "ACCEPT" : "DECLINE");
    if (!next) return { ok: false, error: "Cette demande n'attend pas de décision." };

    await prisma.documentRequest.update({
      where: { id },
      data: {
        status: next as DocumentRequestStatus,
        responseNote: fdStr(formData, "note") ?? req.responseNote,
        closedAt: accept ? new Date() : null,
        closedById: accept ? user.id : null,
      },
    });
    // ── LA PIÈCE ACCEPTÉE REJOINT LE REGISTRE DES ENGAGEMENTS ─────────────────────────────
    //
    // À l'ACCEPTATION, et non au dépôt : le registre ne doit contenir que des pièces que
    // quelqu'un a regardées. Une facture déposée puis refusée — mauvais montant, mauvaise
    // société — y resterait comme un engagement de la société.
    const classement = accept ? await classerDansLegal(req, user.id) : null;

    await notifyUser({
      userId: req.askedToId, type: "GENERIC",
      title: accept ? "Pièce acceptée" : "Pièce refusée — à redéposer",
      body: `${req.reference} — ${req.label}`, link: `${PATH}/${id}`,
    });
    await recordAudit({
      actorId: user.id, action: accept ? "VALIDATE" : "UPDATE", module: "Demandes de pièce",
      entityType: "DOCUMENT_REQUEST", entityId: id,
      summary: `${accept ? "Pièce acceptée" : "Pièce refusée"} — ${req.reference}`,
    });
    revalidate(id, req.link);
    if (classement) revalidatePath("/legal");
    return {
      ok: true, id,
      message: classement ? `Pièce acceptée et enregistrée dans Legal (${classement.kindLabel}).` : undefined,
    };
  } catch (err) {
    console.error("[doc-request] decideDocumentRequest failed", err);
    return { ok: false, error: "La décision n'a pas pu être enregistrée." };
  }
}

export async function cancelDocumentRequest(formData: FormData): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const id = fdStr(formData, "id");
    if (!id) return { ok: false, error: "Demande introuvable." };
    const req = await prisma.documentRequest.findUnique({ where: { id } });
    if (!req) return { ok: false, error: "Demande introuvable." };
    if (!canCancel(req, user.id) && !hasGlobalView(user.role)) return { ok: false, error: "Annulation réservée à la personne qui a demandé." };

    await prisma.documentRequest.update({
      where: { id }, data: { status: "CANCELLED", closedAt: new Date(), closedById: user.id },
    });
    await notifyUser({
      userId: req.askedToId, type: "GENERIC",
      title: "Demande de pièce annulée", body: `${req.reference} — ${req.label}`, link: `${PATH}/${id}`,
    });
    revalidate(id, req.link);
    return { ok: true, id };
  } catch (err) {
    console.error("[doc-request] cancelDocumentRequest failed", err);
    return { ok: false, error: "L'opération a échoué." };
  }
}

/**
 * Les personnes à qui l'on peut demander une pièce — chargées À L'OUVERTURE du panneau.
 *
 * La liste ne descend pas avec la page : un écran de poste de dépense n'a aucune raison de
 * transporter l'annuaire complet à chaque affichage, pour un panneau que la plupart des visites
 * n'ouvriront pas.
 */
export async function askablePeople(): Promise<{ id: string; name: string }[]> {
  const user = await requireUser();
  return prisma.user.findMany({
    where: { isActive: true, id: { not: user.id } },
    select: { id: true, name: true }, orderBy: { name: "asc" },
  });
}
