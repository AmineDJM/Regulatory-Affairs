import crypto from "crypto";
import { MailSendPolicy, OutboundMailStatus, type OutboundMailIntent } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCommunicationPolicy, decideSend, type SendDecision } from "./policy";

/**
 * L'INTENTION D'ENVOI — le SEUL chemin par lequel un message peut quitter l'entreprise.
 *
 * Tout ce qui prépare un courriel (le chat, une mission de fond, une étape de plan, un écran)
 * passe ici. Il n'existe pas de seconde route : c'est ce qui rend la règle « aucun envoi sans
 * approbation » vraie par CONSTRUCTION, et pas par discipline.
 *
 * Trois garanties, et chacune répond à une façon précise de perdre le contrôle :
 *
 *   1. **L'approbation porte sur un CONTENU EXACT.** `contentHash` couvre destinataires, copies,
 *      objet, corps, pièces et identité d'envoi. Modifier un seul de ces champs après validation
 *      invalide l'approbation. Sans cela, on pourrait faire approuver A et envoyer B — la faute
 *      la plus grave possible pour un assistant qui écrit au nom de quelqu'un.
 *
 *   2. **Un seul envoi, jamais deux.** Le passage à `SENDING` est une transition ATOMIQUE
 *      conditionnée par l'état de départ : deux clics, un rejeu réseau ou un webhook répété
 *      perdent la course et ne partent pas une deuxième fois. Un destinataire qui reçoit deux
 *      fois la même relance perd confiance dans l'expéditeur — ici, dans l'entreprise.
 *
 *   3. **La politique est relue à l'INSTANT de l'envoi**, jamais celle mémorisée à la
 *      préparation : basculer en « approbation requise » doit prendre effet immédiatement, y
 *      compris sur les intentions déjà en attente.
 */

export interface OutboundAttachmentRef {
  /** Fichier du Drive interne (référence, jamais des octets stockés dans l'intention). */
  driveNodeId?: string;
  /** Pièce reçue par courriel et déjà ingérée. */
  emailAttachmentId?: string;
  filename: string;
  mimeType?: string | null;
  sizeBytes?: number;
}

export interface OutboundDraftInput {
  connectionId: string;
  userId: string;
  recipients: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  bodyText: string;
  bodyHtml?: string | null;
  threadId?: string | null;
  inReplyTo?: string | null;
  referencesHeader?: string | null;
  attachments?: OutboundAttachmentRef[];
  missionId?: string | null;
  reason?: string | null;
  /** chief | mission | plan | manual — d'où vient l'intention (traçabilité, pas autorité). */
  generatedBy?: string;
}

/** Normalise une adresse pour la comparaison et le hachage (jamais pour l'affichage). */
export const normalizeAddress = (a: string): string => a.trim().toLowerCase();

const cleanList = (list: string[] | undefined): string[] =>
  [...new Set((list ?? []).map(normalizeAddress).filter((a) => a.includes("@")))];

/**
 * L'EMPREINTE DU CONTENU APPROUVÉ.
 *
 * Fonction PURE : elle se teste sans base, et c'est elle qui décide si une approbation tient
 * encore. Tout ce qui change la nature de l'envoi entre dedans — un destinataire ajouté, une
 * pièce retirée, un mot du corps. Ce qui n'y entre PAS : la raison, la mission, l'auteur — ce
 * sont des métadonnées, elles ne changent pas ce que le destinataire reçoit.
 */
export function computeContentHash(input: {
  connectionId: string;
  recipients: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  bodyText: string;
  bodyHtml?: string | null;
  attachments?: OutboundAttachmentRef[];
  threadId?: string | null;
  inReplyTo?: string | null;
}): string {
  const canonical = JSON.stringify({
    identity: input.connectionId,
    to: cleanList(input.recipients).sort(),
    cc: cleanList(input.cc).sort(),
    bcc: cleanList(input.bcc).sort(),
    subject: input.subject.trim(),
    text: input.bodyText.trim(),
    html: (input.bodyHtml ?? "").trim(),
    attachments: (input.attachments ?? [])
      .map((a) => `${a.driveNodeId ?? a.emailAttachmentId ?? ""}:${a.filename}`)
      .sort(),
    thread: input.threadId ?? "",
    inReplyTo: input.inReplyTo ?? "",
  });
  return crypto.createHash("sha256").update(canonical).digest("hex");
}

function pushEvent(events: unknown, entry: Record<string, unknown>): unknown[] {
  const list = Array.isArray(events) ? [...events] : [];
  list.push({ ...entry, at: new Date().toISOString() });
  return list.slice(-50);
}

/**
 * PRÉPARE une intention d'envoi.
 *
 * Préparer n'est JAMAIS soumis à autorisation : Adam doit pouvoir rédiger une relance de
 * lui-même, la nuit, sans réveiller personne. C'est le franchissement de la frontière externe —
 * et lui seul — qui demande le PDG.
 *
 * L'état initial découle de la politique du moment : `AWAITING_APPROVAL` quand une validation
 * est nécessaire, `APPROVED` d'emblée en envoi autonome (il n'y a personne à attendre),
 * `DRAFT` en mode brouillon.
 */
export async function createOutboundIntent(input: OutboundDraftInput): Promise<OutboundMailIntent> {
  const state = await getCommunicationPolicy();
  const recipients = cleanList(input.recipients);
  if (recipients.length === 0) throw new Error("Aucun destinataire valide.");

  const contentHash = computeContentHash({ ...input, recipients });
  const approvalRequired = state.mailSendPolicy === MailSendPolicy.REQUIRE_APPROVAL;
  const status =
    state.mailSendPolicy === MailSendPolicy.DRAFT_ONLY
      ? OutboundMailStatus.DRAFT
      : approvalRequired
        ? OutboundMailStatus.AWAITING_APPROVAL
        : OutboundMailStatus.APPROVED;

  return prisma.outboundMailIntent.create({
    data: {
      connectionId: input.connectionId,
      userId: input.userId,
      recipients,
      cc: cleanList(input.cc),
      bcc: cleanList(input.bcc),
      subject: input.subject.trim(),
      bodyText: input.bodyText,
      bodyHtml: input.bodyHtml ?? null,
      threadId: input.threadId ?? null,
      inReplyTo: input.inReplyTo ?? null,
      referencesHeader: input.referencesHeader ?? null,
      attachments: (input.attachments ?? []) as never,
      missionId: input.missionId ?? null,
      reason: input.reason ?? null,
      generatedBy: input.generatedBy ?? "chief",
      status,
      approvalRequired,
      policyAtCreation: state.mailSendPolicy,
      contentHash,
      // En envoi autonome, l'intention naît approuvée : le hash approuvé est le hash courant.
      approvedHash: status === OutboundMailStatus.APPROVED ? contentHash : null,
      idempotencyKey: crypto.randomUUID(),
      events: pushEvent([], { status, by: "system", note: "préparée" }) as never,
    },
  });
}

/**
 * MODIFIE une intention — et INVALIDE l'approbation si le contenu change.
 *
 * C'est le cœur de la garantie n°1. Un contenu retouché après validation redevient « à
 * approuver » : on ne peut pas faire dire oui à une version et en expédier une autre.
 */
export async function updateOutboundIntent(
  id: string,
  patch: Partial<Pick<OutboundDraftInput, "recipients" | "cc" | "bcc" | "subject" | "bodyText" | "bodyHtml" | "attachments">>,
): Promise<OutboundMailIntent | { error: string }> {
  const cur = await prisma.outboundMailIntent.findUnique({ where: { id } });
  if (!cur) return { error: "Intention d'envoi introuvable." };
  if (cur.status === OutboundMailStatus.SENT) return { error: "Ce message est déjà parti : il ne se modifie plus." };
  if (cur.status === OutboundMailStatus.SENDING) return { error: "Envoi en cours : modification impossible." };

  const next = {
    connectionId: cur.connectionId,
    recipients: patch.recipients ? cleanList(patch.recipients) : cur.recipients,
    cc: patch.cc ? cleanList(patch.cc) : cur.cc,
    bcc: patch.bcc ? cleanList(patch.bcc) : cur.bcc,
    subject: patch.subject ?? cur.subject,
    bodyText: patch.bodyText ?? cur.bodyText,
    bodyHtml: patch.bodyHtml !== undefined ? patch.bodyHtml : cur.bodyHtml,
    attachments: patch.attachments ?? (cur.attachments as unknown as OutboundAttachmentRef[]),
    threadId: cur.threadId,
    inReplyTo: cur.inReplyTo,
  };
  const contentHash = computeContentHash(next);
  const changed = contentHash !== cur.contentHash;
  const state = await getCommunicationPolicy();
  const approvalRequired = state.mailSendPolicy === MailSendPolicy.REQUIRE_APPROVAL;

  return prisma.outboundMailIntent.update({
    where: { id },
    data: {
      recipients: next.recipients,
      cc: next.cc,
      bcc: next.bcc,
      subject: next.subject,
      bodyText: next.bodyText,
      bodyHtml: next.bodyHtml,
      attachments: next.attachments as never,
      contentHash,
      // Le contenu a bougé : l'approbation précédente ne vaut plus rien.
      ...(changed
        ? {
            approvedHash: approvalRequired ? null : contentHash,
            approvedById: approvalRequired ? null : cur.approvedById,
            approvedAt: approvalRequired ? null : cur.approvedAt,
            status: approvalRequired ? OutboundMailStatus.AWAITING_APPROVAL : cur.status,
          }
        : {}),
      events: pushEvent(cur.events, {
        status: "EDITED",
        note: changed ? "contenu modifié — approbation invalidée" : "modification sans effet sur le contenu",
      }) as never,
    },
  });
}

/**
 * APPROUVE le contenu EXACT présent au moment du clic.
 *
 * On enregistre `approvedHash` — pas un simple booléen. Un booléen resterait vrai après une
 * modification ; une empreinte, elle, cesse de correspondre.
 */
export async function approveOutboundIntent(id: string, approverId: string): Promise<OutboundMailIntent | { error: string }> {
  const cur = await prisma.outboundMailIntent.findUnique({ where: { id } });
  if (!cur) return { error: "Intention d'envoi introuvable." };
  if (cur.status === OutboundMailStatus.SENT) return { error: "Ce message est déjà parti." };
  if (cur.status === OutboundMailStatus.CANCELLED) return { error: "Cette intention a été annulée." };
  if (cur.status === OutboundMailStatus.SENDING) return { error: "Envoi déjà en cours." };

  return prisma.outboundMailIntent.update({
    where: { id },
    data: {
      status: OutboundMailStatus.APPROVED,
      approvedHash: cur.contentHash,
      approvedById: approverId,
      approvedAt: new Date(),
      events: pushEvent(cur.events, { status: "APPROVED", by: approverId }) as never,
    },
  });
}

export async function cancelOutboundIntent(id: string, actorId: string, reason?: string): Promise<{ ok: boolean; error?: string }> {
  const cur = await prisma.outboundMailIntent.findUnique({ where: { id }, select: { status: true, events: true } });
  if (!cur) return { ok: false, error: "Intention d'envoi introuvable." };
  if (cur.status === OutboundMailStatus.SENT) return { ok: false, error: "Ce message est déjà parti : il ne s'annule plus." };
  await prisma.outboundMailIntent.update({
    where: { id },
    data: {
      status: OutboundMailStatus.CANCELLED,
      events: pushEvent(cur.events, { status: "CANCELLED", by: actorId, note: reason ?? null }) as never,
    },
  });
  return { ok: true };
}

/** Ce que doit savoir faire un transport pour qu'une intention parte. Injecté : testable sans réseau. */
export interface MailTransport {
  send(msg: {
    connectionId: string;
    recipients: string[];
    cc: string[];
    bcc: string[];
    subject: string;
    bodyText: string;
    bodyHtml: string | null;
    threadId: string | null;
    inReplyTo: string | null;
    referencesHeader: string | null;
    attachments: OutboundAttachmentRef[];
  }): Promise<{ providerMessageId: string; providerThreadId: string | null }>;
}

export type SendResult =
  | { ok: true; alreadySent?: boolean; providerMessageId: string; providerThreadId: string | null }
  | { ok: false; blocked: true; decision: SendDecision; message: string }
  | { ok: false; blocked?: false; error: string };

/**
 * ENVOIE — la seule fonction du système qui fasse partir un message.
 *
 * L'ordre des contrôles n'est pas indifférent :
 *   1. l'intention existe et n'est pas déjà partie (rejeu, double clic tardif) ;
 *   2. la POLITIQUE COURANTE autorise l'envoi — relue maintenant, jamais celle de la
 *      préparation ; le coupe-circuit prime sur tout ;
 *   3. le contenu est EXACTEMENT celui qui a été approuvé ;
 *   4. la transition vers `SENDING` est gagnée de façon atomique — sinon quelqu'un d'autre est
 *      déjà en train d'envoyer, et on s'arrête là.
 *
 * Un échec du transport laisse l'intention en `FAILED` avec son motif : un message qui ne part
 * pas est le pire cas d'une messagerie, parce que personne ne s'en aperçoit.
 */
export async function sendOutboundIntent(id: string, transport: MailTransport): Promise<SendResult> {
  const cur = await prisma.outboundMailIntent.findUnique({ where: { id } });
  if (!cur) return { ok: false, error: "Intention d'envoi introuvable." };
  if (cur.status === OutboundMailStatus.SENT) {
    // Rejeu : on rend le résultat du PREMIER envoi, sans en déclencher un second.
    return {
      ok: true,
      alreadySent: true,
      providerMessageId: cur.providerMessageId ?? "",
      providerThreadId: cur.providerThreadId,
    };
  }
  if (cur.status === OutboundMailStatus.CANCELLED) return { ok: false, error: "Cette intention a été annulée." };
  if (cur.status === OutboundMailStatus.SENDING) return { ok: false, error: "Un envoi est déjà en cours pour ce message." };

  const state = await getCommunicationPolicy();
  // « APPROUVÉ » VEUT DIRE : UN HUMAIN A DIT OUI À CE CONTENU-LÀ.
  //
  // Les deux moitiés comptent. L'empreinte prouve que le contenu n'a pas bougé depuis l'accord ;
  // `approvedById` prouve qu'il y a bien eu un accord. Sans cette seconde moitié, une intention
  // née en ENVOI AUTONOME (approuvée d'office par la politique, sans personne derrière) resterait
  // « approuvée » après un retour à l'approbation obligatoire — et partirait. Le PDG qui remet le
  // garde-fou verrait alors s'envoyer des messages qu'il n'a jamais lus : exactement ce que la
  // bascule était censée empêcher. En envoi autonome, rien ne change : `decideSend` autorise sur
  // la politique elle-même, sans consulter ce drapeau.
  const approved =
    Boolean(cur.approvedHash) && cur.approvedHash === cur.contentHash && Boolean(cur.approvedById);
  const decision = decideSend(state, approved);
  if (!decision.allowed) {
    // On REMET l'intention en attente d'approbation quand c'est la règle qui bloque : l'état
    // affiché doit dire la vérité (« prêt, attend votre accord »), pas rester « approuvé ».
    if (decision.reason === "approval-required" && cur.status !== OutboundMailStatus.AWAITING_APPROVAL) {
      await prisma.outboundMailIntent.update({
        where: { id },
        data: {
          status: OutboundMailStatus.AWAITING_APPROVAL,
          approvedHash: null,
          events: pushEvent(cur.events, { status: "AWAITING_APPROVAL", note: "politique : approbation requise" }) as never,
        },
      });
    }
    return { ok: false, blocked: true, decision, message: decision.message };
  }

  // Verrou d'unicité : seul le premier appelant fait passer APPROVED → SENDING. Un second clic,
  // un rejeu de webhook ou une reprise de tâche perdent la course et n'envoient rien.
  const claimed = await prisma.outboundMailIntent.updateMany({
    where: { id, status: { in: [OutboundMailStatus.APPROVED, OutboundMailStatus.AWAITING_APPROVAL] } },
    data: { status: OutboundMailStatus.SENDING, sendingStartedAt: new Date(), attempts: { increment: 1 } },
  });
  if (claimed.count !== 1) return { ok: false, error: "Un envoi est déjà en cours pour ce message." };

  try {
    const res = await transport.send({
      connectionId: cur.connectionId,
      recipients: cur.recipients,
      cc: cur.cc,
      bcc: cur.bcc,
      subject: cur.subject,
      bodyText: cur.bodyText,
      bodyHtml: cur.bodyHtml,
      threadId: cur.threadId,
      inReplyTo: cur.inReplyTo,
      referencesHeader: cur.referencesHeader,
      attachments: cur.attachments as unknown as OutboundAttachmentRef[],
    });
    await prisma.outboundMailIntent.update({
      where: { id },
      data: {
        status: OutboundMailStatus.SENT,
        sentAt: new Date(),
        providerMessageId: res.providerMessageId,
        providerThreadId: res.providerThreadId,
        failureReason: null,
        events: pushEvent(cur.events, { status: "SENT", note: decision.reason }) as never,
      },
    });
    return { ok: true, providerMessageId: res.providerMessageId, providerThreadId: res.providerThreadId };
  } catch (err) {
    const reason = err instanceof Error ? err.message : "Envoi impossible.";
    await prisma.outboundMailIntent.update({
      where: { id },
      data: {
        status: OutboundMailStatus.FAILED,
        failureReason: reason.slice(0, 300),
        events: pushEvent(cur.events, { status: "FAILED", note: reason.slice(0, 120) }) as never,
      },
    });
    return { ok: false, error: reason };
  }
}

/** Les intentions qui attendent le PDG — ce que l'écran et le point du matin doivent montrer. */
export async function pendingApprovals(userId: string, limit = 20) {
  return prisma.outboundMailIntent.findMany({
    where: { userId, status: { in: [OutboundMailStatus.AWAITING_APPROVAL, OutboundMailStatus.DRAFT] } },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true, subject: true, recipients: true, cc: true, reason: true, missionId: true,
      status: true, createdAt: true, generatedBy: true,
    },
  });
}
