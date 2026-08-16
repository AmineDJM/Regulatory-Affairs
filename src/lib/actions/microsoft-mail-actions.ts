"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { putBlob } from "@/lib/drive-storage";
import { resolveDriveAccess, effectiveSpaceId } from "@/lib/drive";
import { validateDriveUpload } from "@/lib/storage";
import { getAppSettings } from "@/lib/settings";
import { mailAccess } from "@/lib/mail/access";
import { getActiveConnection, disconnect as dropConnection } from "@/lib/mail/connection";
import { MicrosoftGraphMailProvider } from "@/lib/mail/graph/provider";
import { MailError, type MailDraftInput, type MailProvider } from "@/lib/mail/provider";
import { parseAddressList } from "@/lib/mail/reply";

/**
 * LA SEULE PORTE entre les écrans et la messagerie.
 *
 * Chaque action refait les trois mêmes vérifications, dans le même ordre, parce qu'il n'existe
 * aucun chemin qui les contourne : session → droit d'accès au module → connexion de CETTE
 * personne. L'identifiant de boîte n'est **jamais** un paramètre : il vient du jeton, donc de la
 * session. Modifier une URL ne mène nulle part.
 */

export interface MailActionResult { ok: boolean; error?: string; needsReconnect?: boolean }

/** Traduit une panne en message affichable, et signale le cas « il faut se reconnecter ». */
function fail(e: unknown): MailActionResult {
  if (e instanceof MailError) {
    return { ok: false, error: e.message, needsReconnect: e.kind === "unauthorized" };
  }
  // On ne remonte jamais un message brut : il pourrait porter un objet de message ou une adresse.
  console.error("[mail] action en échec", e instanceof Error ? e.name : typeof e);
  return { ok: false, error: "La messagerie n'a pas pu répondre." };
}

/** Session + drapeau/pilote + connexion. Lève une `MailError` parlante si l'un des trois manque. */
async function withProvider<T>(run: (p: MailProvider, ctx: { userId: string; connectionId: string; address: string }) => Promise<T>): Promise<T> {
  const user = await requireUser();
  const access = mailAccess(user as never, process.env as Record<string, string | undefined>);
  if (!access.allowed) throw new MailError("forbidden", "La messagerie Microsoft ne vous est pas ouverte.");

  const conn = await getActiveConnection(user.id);
  if (!conn) throw new MailError("unauthorized", "Aucune boîte Microsoft connectée.");

  const provider = new MicrosoftGraphMailProvider(conn.accessToken, conn.address);
  return run(provider, { userId: user.id, connectionId: conn.id, address: conn.address });
}

/** Le brouillon depuis un formulaire — les destinataires sont analysés par le module pur, testé. */
function draftFromForm(fd: FormData): MailDraftInput {
  return {
    to: parseAddressList(String(fd.get("to") ?? "")),
    cc: parseAddressList(String(fd.get("cc") ?? "")),
    bcc: parseAddressList(String(fd.get("bcc") ?? "")),
    subject: String(fd.get("subject") ?? "").slice(0, 500),
    bodyHtml: String(fd.get("bodyHtml") ?? ""),
    inReplyTo: fd.get("replyToId")
      ? { messageId: String(fd.get("replyToId")), mode: (String(fd.get("replyMode") ?? "reply") as "reply" | "replyAll" | "forward") }
      : null,
  };
}

export async function sendMessage(fd: FormData): Promise<MailActionResult> {
  try {
    const input = draftFromForm(fd);
    if (input.to.length === 0 && (input.cc ?? []).length === 0 && (input.bcc ?? []).length === 0) {
      return { ok: false, error: "Indiquez au moins un destinataire." };
    }
    return await withProvider(async (p, ctx) => {
      await p.send(input);
      await recordAudit({
        actorId: ctx.userId, action: "CREATE", module: "Messagerie",
        // L'objet n'est PAS journalisé : un journal d'audit se relit à plusieurs, un objet de mail
        // peut être confidentiel. On trace le geste et le nombre de destinataires.
        summary: `Message envoyé à ${input.to.length + (input.cc?.length ?? 0) + (input.bcc?.length ?? 0)} destinataire·s`,
      });
      revalidatePath("/messagerie");
      return { ok: true };
    });
  } catch (e) { return fail(e); }
}

export async function saveDraft(fd: FormData): Promise<MailActionResult & { id?: string }> {
  try {
    const input = draftFromForm(fd);
    const existing = String(fd.get("draftId") ?? "");
    return await withProvider(async (p) => {
      if (existing) {
        await p.updateDraft(existing, input);
        return { ok: true, id: existing };
      }
      const { id } = await p.createDraft(input);
      return { ok: true, id };
    });
  } catch (e) { return fail(e); }
}

export async function setMessageRead(messageId: string, read: boolean): Promise<MailActionResult> {
  try {
    return await withProvider(async (p) => {
      await p.setRead(messageId, read);
      revalidatePath("/messagerie");
      return { ok: true };
    });
  } catch (e) { return fail(e); }
}

export async function moveMessage(messageId: string, folderId: string): Promise<MailActionResult & { id?: string }> {
  try {
    return await withProvider(async (p) => {
      const moved = await p.move(messageId, folderId);
      revalidatePath("/messagerie");
      return { ok: true, id: moved.id };
    });
  } catch (e) { return fail(e); }
}

export async function deleteMessage(messageId: string): Promise<MailActionResult> {
  try {
    return await withProvider(async (p, ctx) => {
      await p.delete(messageId);
      await recordAudit({
        actorId: ctx.userId, action: "DELETE", module: "Messagerie",
        summary: "Message mis à la corbeille",
      });
      revalidatePath("/messagerie");
      return { ok: true };
    });
  } catch (e) { return fail(e); }
}

export async function disconnectMicrosoftMail(): Promise<MailActionResult> {
  const user = await requireUser();
  await dropConnection(user.id);
  await recordAudit({
    actorId: user.id, action: "DELETE", module: "Messagerie",
    summary: "Boîte Microsoft déconnectée (jetons effacés)",
  });
  revalidatePath("/messagerie");
  return { ok: true };
}

export async function saveMailSignature(html: string): Promise<MailActionResult> {
  const user = await requireUser();
  await prisma.mailConnection.updateMany({ where: { userId: user.id }, data: { signature: html.slice(0, 20_000) } });
  revalidatePath("/messagerie");
  return { ok: true };
}

/**
 * ENREGISTRER UNE PIÈCE JOINTE DANS LE DRIVE — le parcours principal, pas le téléchargement.
 *
 * Un fichier reçu par mail qui atterrit sur un poste sort de l'ERP : il n'a plus de droits, plus
 * d'audit, plus de version. Le geste mis en avant est donc de le faire **entrer** dans le Drive,
 * où il retrouve tout cela — et où sa provenance est conservée (expéditeur, date, identifiant du
 * message), ce qu'un fichier téléchargé perd immédiatement.
 *
 * La copie vers le stockage objet n'a lieu QU'ICI : on ne recopie jamais automatiquement toutes
 * les pièces jointes d'une boîte.
 */
export async function saveAttachmentToDrive(fd: FormData): Promise<MailActionResult & { nodeId?: string }> {
  try {
    const messageId = String(fd.get("messageId") ?? "");
    const attachmentId = String(fd.get("attachmentId") ?? "");
    const parentId = String(fd.get("parentId") ?? "") || null;
    const spaceId = String(fd.get("spaceId") ?? "") || null;
    const entityType = String(fd.get("entityType") ?? "") || null;
    const entityId = String(fd.get("entityId") ?? "") || null;
    if (!messageId || !attachmentId) return { ok: false, error: "Pièce jointe introuvable." };

    return await withProvider(async (p, ctx) => {
      // Droit d'écriture sur la destination — la même règle que partout dans le Drive.
      if (parentId && (await resolveDriveAccess(await requireUser(), parentId)) !== "EDIT") {
        return { ok: false, error: "Dossier de destination non autorisé." };
      }

      const [att, msg] = await Promise.all([p.getAttachment(messageId, attachmentId), p.getMessage(messageId)]);

      const settings = await getAppSettings();
      const invalid = validateDriveUpload(att.name, att.content.length, settings.maxDriveUploadMb);
      if (invalid) return { ok: false, error: invalid };

      const { blobId, size } = await putBlob(att.content);
      const effSpaceId = await effectiveSpaceId(parentId, spaceId);
      const node = await prisma.driveNode.create({
        data: {
          name: att.name, type: "FILE", parentId, spaceId: effSpaceId,
          ownerId: ctx.userId, createdById: ctx.userId,
          mimeType: att.contentType, size, category: "Pièce jointe e-mail",
          versions: { create: { blobId, version: 1, size, mimeType: att.contentType, createdById: ctx.userId } },
        },
        select: { id: true },
      });

      // La PROVENANCE, conservée : un fichier sans origine devient anonyme au bout d'un mois.
      await prisma.mailLink.create({
        data: {
          connectionId: ctx.connectionId, messageId, attachmentId,
          senderAddress: msg.from?.address ?? null,
          sentAt: msg.receivedAt ? new Date(msg.receivedAt) : null,
          subject: msg.subject.slice(0, 500),
          entityType, entityId, driveNodeId: node.id, createdById: ctx.userId,
        },
      });

      await recordAudit({
        actorId: ctx.userId, action: "CREATE", module: "Drive", entityType: "DRIVE_NODE", entityId: node.id,
        summary: `Pièce jointe « ${att.name} » enregistrée depuis un e-mail`,
      });
      revalidatePath("/drive");
      return { ok: true, nodeId: node.id };
    });
  } catch (e) { return fail(e); }
}

/** Associe un message à un objet métier — sans copier quoi que ce soit. */
export async function linkMessageToEntity(fd: FormData): Promise<MailActionResult> {
  try {
    const messageId = String(fd.get("messageId") ?? "");
    const entityType = String(fd.get("entityType") ?? "");
    const entityId = String(fd.get("entityId") ?? "");
    if (!messageId || !entityType || !entityId) return { ok: false, error: "Association incomplète." };

    return await withProvider(async (p, ctx) => {
      const msg = await p.getMessage(messageId);
      await prisma.mailLink.create({
        data: {
          connectionId: ctx.connectionId, messageId,
          senderAddress: msg.from?.address ?? null,
          sentAt: msg.receivedAt ? new Date(msg.receivedAt) : null,
          subject: msg.subject.slice(0, 500),
          entityType, entityId, createdById: ctx.userId,
        },
      });
      await recordAudit({
        actorId: ctx.userId, action: "UPDATE", module: "Messagerie",
        entityType: entityType as never, entityId,
        summary: "E-mail associé à cet objet",
      });
      return { ok: true };
    });
  } catch (e) { return fail(e); }
}
