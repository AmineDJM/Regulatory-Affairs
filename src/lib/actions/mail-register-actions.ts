"use server";

import { revalidatePath } from "next/cache";
import type { EntityType, MailDirection } from "@prisma/client";
import { requireUser } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { canAccessEntity } from "@/lib/entity-access";
import { deleteFileByKey } from "@/lib/storage";
import { createMailEntryFor, updateMailEntryFor, setMailDateFor, type MailFields } from "@/lib/mail-register/write";
import { fdStr, fdDate, type ActionResult } from "@/lib/actions/types";
import { attachFormFiles } from "@/lib/documents";
import { resolveDriveAccess, canViewDrive } from "@/lib/drive";

/**
 * LE CARNET DE COURRIERS — la porte de l'ÉCRAN.
 *
 * L'écriture elle-même vit dans `src/lib/mail-register/write.ts`, partagée avec le registre
 * d'opérations de l'API des agents : deux implémentations auraient divergé, et un contrôle
 * ajouté d'un côté aurait manqué de l'autre. Ici on ne fait que trois choses — lire le
 * formulaire, résoudre la session, rafraîchir les écrans.
 *
 * Les quatre dates racontent le trajet du pli et se remplissent à des moments différents : on
 * POSTE (avec l'heure — deux courriers du même jour ne partent pas dans le même ordre), le pli
 * ARRIVE, puis on récupère l'ACCUSÉ. Aucune n'est obligatoire.
 */

const parseDirection = (v: string | null): MailDirection => (v === "INCOMING" ? "INCOMING" : "OUTGOING");

/** `datetime-local` renvoie « 2026-08-17T14:30 » — on garde l'heure, contrairement à `fdDate`. */
function fdDateTime(formData: FormData, key: string): Date | null {
  const raw = fdStr(formData, key);
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function readFields(formData: FormData): MailFields {
  return {
    title: fdStr(formData, "title") ?? "",
    reference: fdStr(formData, "reference"),
    direction: parseDirection(fdStr(formData, "direction")),
    sender: fdStr(formData, "sender"),
    recipient: fdStr(formData, "recipient"),
    sentAt: fdDateTime(formData, "sentAt"),
    receivedAt: fdDate(formData, "receivedAt"),
    acknowledgedAt: fdDate(formData, "acknowledgedAt"),
    carrier: fdStr(formData, "carrier"),
    notes: fdStr(formData, "notes"),
    // Le champ n'est présent que si le formulaire propose des entités. `undefined` laisse le
    // noyau retomber sur l'entité par défaut du créateur — l'ancien comportement.
    ...(formData.has("companyId") ? { companyId: fdStr(formData, "companyId") } : {}),
    partnerId: fdStr(formData, "partnerId"),
    // Même précaution que pour l'entité : les deux menus ne sont rendus que s'il y a quelque chose
    // à choisir. Les lire inconditionnellement effacerait le rattachement d'un pli à chaque
    // enregistrement fait depuis un formulaire qui ne les propose pas.
    ...(formData.has("departmentId") ? { departmentId: fdStr(formData, "departmentId") } : {}),
    ...(formData.has("concernedUserId") ? { concernedUserId: fdStr(formData, "concernedUserId") } : {}),
    // Le dossier de classement, même précaution : présent seulement si le formulaire l'a proposé.
    ...(formData.has("folderId") ? { folderId: fdStr(formData, "folderId") } : {}),
  };
}

export async function createMailEntry(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();

  // LE NŒUD DU DRIVE EST VÉRIFIÉ AVANT D'ÊTRE ÉCRIT. L'identifiant vient d'un champ de
  // formulaire : sans contrôle, le registre pointerait vers un fichier corbeillé, inexistant,
  // ou qu'on n'a pas le droit de lire.
  const driveNodeId = fdStr(formData, "driveNodeId");
  if (driveNodeId) {
    const node = await prisma.driveNode.findUnique({ where: { id: driveNodeId }, select: { isTrashed: true } });
    if (!node || node.isTrashed) return { ok: false, error: "Le dossier / fichier choisi n'existe plus dans le Drive." };
    if (!canViewDrive(await resolveDriveAccess(user, driveNodeId))) {
      return { ok: false, error: "Vous n'avez pas accès à ce dossier / fichier du Drive." };
    }
  }

  const r = await createMailEntryFor(user, {
    ...readFields(formData),
    driveNodeId,
    sourceType: (fdStr(formData, "sourceType") as EntityType | null) ?? null,
    sourceId: fdStr(formData, "sourceId"),
  });
  if (!r.ok || !r.id) return r;

  // Les pièces jointes du formulaire, rattachées au courrier qui vient de naître. Un échec de
  // fichier ne défait PAS l'enregistrement : le pli est au registre, on dit ce qui n'a pas suivi.
  const files = await attachFormFiles(user.id, "MAIL_ENTRY", r.id, formData);
  revalidatePath("/courriers");
  return files.failed.length
    ? { ...r, message: `Courrier enregistré. ${files.attached} pièce(s) jointe(s) ; échec sur : ${files.failed.map((x) => x.name).join(", ")}.` }
    : r;
}

/**
 * MODIFIER UN COURRIER — depuis sa fiche.
 *
 * L'identifiant est LIÉ côté serveur (`editMailEntry.bind(null, id)`), jamais lu dans le
 * formulaire : un champ caché se réécrit dans le navigateur, et l'on modifierait alors le
 * courrier de quelqu'un d'autre.
 */
export async function editMailEntry(
  id: string,
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const r = await updateMailEntryFor(user, id, readFields(formData));
  if (r.ok) { revalidatePath("/courriers"); revalidatePath(`/courriers/${id}`); }
  return r;
}

/**
 * POSER UNE DATE, depuis la ligne du tableau — l'arrivée et l'accusé se constatent des jours
 * après la saisie, et rouvrir un formulaire complet pour cocher une date, personne ne le fait.
 */
export async function setMailDate(input: {
  id: string; field: "receivedAt" | "acknowledgedAt"; value: string | null;
}): Promise<ActionResult> {
  const user = await requireUser();
  const date = input.value ? new Date(input.value) : null;
  if (input.value && Number.isNaN(date!.getTime())) return { ok: false, error: "Date invalide." };

  const r = await setMailDateFor(user, { id: input.id, field: input.field, value: date });
  if (r.ok) { revalidatePath("/courriers"); revalidatePath(`/courriers/${input.id}`); }
  return r;
}

/**
 * « RELIER À… » MULTIPLE (§25) — un pli concerne souvent PLUSIEURS affaires à la fois : le
 * marché, son contrat, le dossier Regulatory du produit. `sourceType`/`sourceId` gardent le
 * rattachement de NAISSANCE (d'où le pli a été créé) ; les liens `MailEntryLink` s'ajoutent et
 * se retirent librement ensuite. Le libellé est photographié au moment du lien : la liste des
 * courriers d'un marché s'affiche sans re-résoudre chaque cible.
 */
const MAIL_LINKABLE: Partial<Record<EntityType, string>> = {
  PCH_TENDER: "Marché PCH",
  PCH_ORDER: "Bon de commande PCH",
  LEGAL_DOCUMENT: "Document légal",
  REGULATORY_PRODUCT: "Dossier Regulatory",
};

/** Le libellé PHOTOGRAPHIÉ de la cible — résolu ici, jamais confié au formulaire. */
async function mailLinkLabel(entityType: EntityType, entityId: string): Promise<string | null> {
  switch (entityType) {
    case "PCH_TENDER": {
      const t = await prisma.pchTender.findUnique({ where: { id: entityId }, select: { reference: true, title: true } });
      return t ? `${t.reference}${t.title ? ` — ${t.title}` : ""}` : null;
    }
    case "PCH_ORDER": {
      const o = await prisma.pchOrder.findUnique({ where: { id: entityId }, select: { reference: true, tender: { select: { reference: true } } } });
      return o ? `BC ${o.reference ?? "s/n"} — ${o.tender.reference}` : null;
    }
    case "LEGAL_DOCUMENT": {
      const d = await prisma.legalDocument.findUnique({ where: { id: entityId }, select: { title: true, reference: true } });
      return d ? `${d.reference ? `${d.reference} — ` : ""}${d.title}` : null;
    }
    case "REGULATORY_PRODUCT": {
      const r = await prisma.regulatoryProduct.findUnique({ where: { id: entityId }, select: { reference: true, dci: true } });
      return r ? `${r.reference} — ${r.dci}` : null;
    }
    default:
      return null;
  }
}

export async function addMailLink(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "MAIL_REGISTER", "UPDATE")) return { ok: false, error: "Non autorisé." };
  const entryId = fdStr(formData, "entryId");
  const entityTypeRaw = fdStr(formData, "entityType");
  const entityId = fdStr(formData, "entityId");
  if (!entryId || !entityTypeRaw || !entityId) return { ok: false, error: "Cible manquante." };
  if (!(entityTypeRaw in MAIL_LINKABLE)) return { ok: false, error: "Ce type d'objet ne se relie pas à un courrier." };
  const entityType = entityTypeRaw as EntityType;

  const entry = await prisma.mailEntry.findUnique({ where: { id: entryId }, select: { id: true, title: true } });
  if (!entry) return { ok: false, error: "Courrier introuvable." };
  // La cible se vérifie avec les DROITS DU LIEUR : relier un pli à un dossier qu'on ne peut
  // pas voir servirait à en deviner l'existence.
  if (!(await canAccessEntity(user, entityType, entityId, "VIEW"))) {
    return { ok: false, error: "Vous n'avez pas accès à cet objet." };
  }
  const label = await mailLinkLabel(entityType, entityId);
  if (!label) return { ok: false, error: "Objet introuvable." };

  await prisma.mailEntryLink.upsert({
    where: { entryId_entityType_entityId: { entryId, entityType, entityId } },
    update: { label },
    create: { entryId, entityType, entityId, label, createdById: user.id },
  });
  await recordAudit({
    actorId: user.id, action: "UPDATE", module: "MAIL_REGISTER", entityType: "MAIL_ENTRY", entityId: entryId,
    summary: `Courrier « ${entry.title} » relié à ${MAIL_LINKABLE[entityType]} « ${label} »`,
  });
  revalidatePath(`/courriers/${entryId}`);
  if (entityType === "PCH_TENDER") revalidatePath(`/pch/${entityId}`);
  return { ok: true };
}

export async function removeMailLink(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "MAIL_REGISTER", "UPDATE")) return { ok: false, error: "Non autorisé." };
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Identifiant manquant." };
  const link = await prisma.mailEntryLink.findUnique({
    where: { id }, select: { id: true, entryId: true, entityType: true, entityId: true, label: true, entry: { select: { title: true } } },
  });
  if (!link) return { ok: false, error: "Lien introuvable." };

  await prisma.mailEntryLink.delete({ where: { id } });
  await recordAudit({
    actorId: user.id, action: "UPDATE", module: "MAIL_REGISTER", entityType: "MAIL_ENTRY", entityId: link.entryId,
    summary: `Lien retiré du courrier « ${link.entry.title} » : ${link.label ?? link.entityId}`,
  });
  revalidatePath(`/courriers/${link.entryId}`);
  if (link.entityType === "PCH_TENDER") revalidatePath(`/pch/${link.entityId}`);
  return { ok: true };
}

export async function deleteMailEntry(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "MAIL_REGISTER", "DELETE")) return { ok: false, error: "Non autorisé." };
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Courrier introuvable." };
  if (!(await canAccessEntity(user, "MAIL_ENTRY", id, "DELETE"))) {
    return { ok: false, error: "Ce courrier n'est pas dans votre périmètre." };
  }
  const entry = await prisma.mailEntry.findUnique({ where: { id }, select: { title: true } });
  if (!entry) return { ok: false, error: "Courrier introuvable." };

  // Les pièces jointes rattachées ne seraient plus atteignables par aucun écran : on les
  // détache avec le courrier, et on DIT combien il y en avait. Le fichier lui-même n'est pas
  // perdu — tout téléversement est répliqué dans le Drive de celui qui l'a importé — mais le
  // journal doit garder trace de ce qui a disparu de la fiche.
  const attached = await prisma.document.findMany({
    where: { entityType: "MAIL_ENTRY", entityId: id }, select: { id: true, fileKey: true },
  });
  await prisma.document.deleteMany({ where: { entityType: "MAIL_ENTRY", entityId: id } });
  // Les octets se libèrent avec la fiche, sans quoi le stockage garderait à vie des pièces que
  // plus aucun écran ne montre.
  for (const d of attached) if (d.fileKey) await deleteFileByKey(d.fileKey);
  await prisma.mailEntry.delete({ where: { id } });
  await recordAudit({
    actorId: user.id, action: "DELETE", module: "Courriers",
    entityType: "MAIL_ENTRY", entityId: id,
    summary: `Courrier « ${entry.title} » supprimé${attached.length > 0 ? ` — ${attached.length} pièce(s) jointe(s)` : ""}`,
  });
  revalidatePath("/courriers");
  return { ok: true };
}

/**
 * CLASSER UN FICHIER DU DRIVE EN COURRIER — sans copie, comme « Déclarer dans Legal ».
 *
 * Le geste réel : le scan du pli est déjà dans le Drive ; on veut l'inscrire au carnet avec ce
 * que le Drive ne sait pas porter — l'objet, le sens (arrivée / départ), l'expéditeur, le
 * destinataire. Le fichier NE BOUGE PAS : le courrier le référence (`driveNodeId`), il continue
 * de se versionner dans le Drive et le carnet en montre toujours la version courante.
 */
export async function attachDriveNodeToMail(input: {
  driveNodeId: string; title?: string; direction?: string;
  sender?: string; recipient?: string; reference?: string;
}): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "MAIL_REGISTER", "CREATE")) return { ok: false, error: "Non autorisé à alimenter les Courriers." };

  const node = await prisma.driveNode.findUnique({
    where: { id: input.driveNodeId },
    select: { id: true, name: true, type: true, isTrashed: true },
  });
  if (!node || node.isTrashed) return { ok: false, error: "Fichier introuvable dans le Drive." };
  if (node.type !== "FILE") return { ok: false, error: "Seul un fichier peut devenir un courrier." };
  if (!canViewDrive(await resolveDriveAccess(user, node.id))) {
    return { ok: false, error: "Vous n'avez pas accès à ce fichier du Drive." };
  }

  // Déjà au carnet : on ne crée pas un deuxième pli pour le même fichier — c'est exactement le
  // doublon que la référence sans copie sert à éviter.
  const already = await prisma.mailEntry.findFirst({ where: { driveNodeId: node.id }, select: { id: true } });
  if (already) return { ok: false, error: "Ce fichier figure déjà au carnet de courriers.", id: already.id };

  const direction: MailDirection = input.direction === "INCOMING" ? "INCOMING" : "OUTGOING";
  const created = await createMailEntryFor(user, {
    title: (input.title ?? "").trim() || node.name,
    direction,
    sender: input.sender?.trim() || null,
    recipient: input.recipient?.trim() || null,
    reference: input.reference?.trim() || null,
    driveNodeId: node.id,
    // Un pli qui arrive est déjà arrivé ; un pli qui part n'est pas encore parti — les dates de
    // trajet se posent ensuite depuis la ligne du carnet, comme pour toute saisie.
    receivedAt: direction === "INCOMING" ? new Date() : null,
  });
  if (created.ok) revalidatePath("/courriers");
  return created;
}
