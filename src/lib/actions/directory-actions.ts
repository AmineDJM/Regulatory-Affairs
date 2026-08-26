"use server";

import { revalidatePath } from "next/cache";
import { DirectoryChannel, EndpointConfidence } from "@prisma/client";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { canEditDirectory } from "@/lib/directory/access";
import { normalizeEndpointValue, isChannel, isConfidence } from "@/lib/directory/normalize";
import { fdStr, type ActionResult } from "@/lib/actions/types";

/**
 * TENIR L'ANNUAIRE — les gestes de l'assistante de direction.
 *
 * Ce fichier n'invente aucune vérité : il ajoute des MOYENS DE JOINDRE des gens dont le nom, le
 * poste et le rattachement restent portés par leur fiche ERP. Une entrée d'annuaire se crée donc
 * toujours ACCROCHÉE à quelqu'un (un compte, un salarié, un contact) ou, à défaut, à un nom
 * explicite pour une personne externe.
 *
 * Chaque écriture est AUDITÉE. Changer une adresse professionnelle, c'est changer où part le
 * courrier de l'entreprise : ça se trace comme un geste de sécurité, pas comme une préférence.
 */

const PATH = "/moyens-generaux/annuaire";

/** Le refus, dit une fois — même phrase partout, pour que la règle soit lisible. */
const DENIED = "Vous n'avez pas le droit de modifier l'annuaire de l'entreprise.";

/** Crée (ou retrouve) l'entrée d'annuaire d'une personne, accrochée à sa fiche canonique. */
export async function ensureDirectoryEntry(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!canEditDirectory(user)) return { ok: false, error: DENIED };

  const userId = fdStr(formData, "userId") || null;
  const employeeId = fdStr(formData, "employeeId") || null;
  const contactId = fdStr(formData, "contactId") || null;
  const displayName = (fdStr(formData, "displayName") ?? "").trim();
  if (!displayName) return { ok: false, error: "Le nom affiché est obligatoire." };

  const existing = await prisma.directoryEntry.findFirst({
    where: userId ? { userId } : employeeId ? { employeeId } : contactId ? { contactId } : { displayName },
    select: { id: true },
  });
  if (existing) return { ok: true, id: existing.id };

  const created = await prisma.directoryEntry.create({
    data: {
      userId, employeeId, contactId, displayName,
      aliases: (fdStr(formData, "aliases") ?? "").split(",").map((a) => a.trim().toLowerCase()).filter(Boolean),
      jobTitle: fdStr(formData, "jobTitle") || null,
      location: fdStr(formData, "location") || null,
      companyId: fdStr(formData, "companyId") || null,
      notes: fdStr(formData, "notes") || null,
      createdById: user.id, updatedById: user.id,
    },
    select: { id: true },
  });
  await recordAudit({
    actorId: user.id, action: "CREATE", module: "Annuaire",
    entityId: created.id, summary: `Entrée d'annuaire créée — ${displayName}`,
  });
  revalidatePath(PATH);
  return { ok: true, id: created.id };
}

/** Modifie ce que l'annuaire porte EN PROPRE (alias, notes) — jamais le nom d'un salarié. */
export async function updateDirectoryEntry(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!canEditDirectory(user)) return { ok: false, error: DENIED };
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Entrée introuvable." };

  const aliases = (fdStr(formData, "aliases") ?? "").split(",").map((a) => a.trim().toLowerCase()).filter(Boolean);
  await prisma.directoryEntry.update({
    where: { id },
    data: {
      aliases,
      jobTitle: fdStr(formData, "jobTitle") || null,
      location: fdStr(formData, "location") || null,
      notes: fdStr(formData, "notes") || null,
      updatedById: user.id,
    },
  });
  await recordAudit({
    actorId: user.id, action: "UPDATE", module: "Annuaire", entityId: id,
    summary: `Entrée d'annuaire mise à jour (alias : ${aliases.join(", ") || "aucun"})`,
  });
  revalidatePath(PATH);
  return { ok: true };
}

/**
 * AJOUTE une coordonnée — adresse, téléphone, WhatsApp.
 *
 * La provenance est saisie explicitement : une adresse qu'on tape et qu'on confirme n'est pas de
 * même nature qu'une adresse aperçue quelque part, et c'est cette différence qui décide plus tard
 * où le courrier part. Marquer PRINCIPALE dégrade automatiquement l'ancienne : deux adresses
 * principales sur le même canal, c'est une ambiguïté qu'on ne veut pas fabriquer.
 */
export async function addDirectoryEndpoint(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!canEditDirectory(user)) return { ok: false, error: DENIED };

  const entryId = fdStr(formData, "entryId");
  const rawChannel = (fdStr(formData, "channel") ?? "EMAIL").toUpperCase();
  const rawValue = fdStr(formData, "value") ?? "";
  if (!entryId) return { ok: false, error: "Entrée d'annuaire introuvable." };
  if (!isChannel(rawChannel)) return { ok: false, error: "Canal inconnu." };

  const value = normalizeEndpointValue(rawChannel, rawValue);
  if (!value) return { ok: false, error: rawChannel === "EMAIL" ? "Adresse e-mail invalide." : "Numéro invalide." };

  const rawConfidence = (fdStr(formData, "confidence") ?? EndpointConfidence.VERIFIED_INTERNAL).toUpperCase();
  const confidence = isConfidence(rawConfidence) ? rawConfidence : EndpointConfidence.VERIFIED_INTERNAL;
  const isPrimary = fdStr(formData, "isPrimary") === "on" || fdStr(formData, "isPrimary") === "true";

  await prisma.$transaction(async (tx) => {
    if (isPrimary) {
      await tx.directoryEndpoint.updateMany({
        where: { entryId, channel: rawChannel as DirectoryChannel, isPrimary: true },
        data: { isPrimary: false },
      });
    }
    await tx.directoryEndpoint.upsert({
      where: { entryId_channel_value: { entryId, channel: rawChannel as DirectoryChannel, value } },
      create: {
        entryId, channel: rawChannel as DirectoryChannel, value,
        label: fdStr(formData, "label") || null,
        confidence, isPrimary, isActive: true,
        source: "saisie manuelle",
        ...(confidence === EndpointConfidence.VERIFIED_INTERNAL ? { verifiedById: user.id, verifiedAt: new Date() } : {}),
      },
      update: {
        label: fdStr(formData, "label") || null,
        confidence, isPrimary, isActive: true,
        ...(confidence === EndpointConfidence.VERIFIED_INTERNAL ? { verifiedById: user.id, verifiedAt: new Date() } : {}),
      },
    });
  });

  await recordAudit({
    actorId: user.id, action: "UPDATE", module: "Annuaire", entityId: entryId,
    summary: `Coordonnée ${rawChannel.toLowerCase()} enregistrée — ${value}${isPrimary ? " (principale)" : ""} [${confidence}]`,
  });
  revalidatePath(PATH);
  return { ok: true };
}

/**
 * DÉSACTIVE une coordonnée devenue obsolète — on ne la SUPPRIME pas.
 *
 * Une adresse retirée reste utile : elle explique un vieux message et évite qu'on la ressaisisse
 * par erreur. Elle cesse simplement d'être proposée à l'envoi.
 */
export async function deactivateDirectoryEndpoint(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!canEditDirectory(user)) return { ok: false, error: DENIED };
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Coordonnée introuvable." };

  const ep = await prisma.directoryEndpoint.findUnique({ where: { id }, select: { entryId: true, value: true } });
  if (!ep) return { ok: false, error: "Coordonnée introuvable." };

  await prisma.directoryEndpoint.update({ where: { id }, data: { isActive: false, isPrimary: false } });
  await recordAudit({
    actorId: user.id, action: "UPDATE", module: "Annuaire", entityId: ep.entryId,
    summary: `Coordonnée désactivée — ${ep.value}`,
  });
  revalidatePath(PATH);
  return { ok: true };
}
