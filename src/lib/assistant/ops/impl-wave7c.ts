import { prisma } from "@/lib/prisma";
import {
  createGroup, createChannel, editMessage, deleteMessage, toggleReaction, togglePinMessage,
  bookmarkMessage, togglePinConversation, toggleMute, setNotifyLevel, updateConversation,
  addMembers, removeMember, setMemberRole, leaveConversation, archiveConversation,
  joinChannel, setMessagingStatus,
} from "@/lib/actions/messaging-actions";
import { sendRegulatoryUpdateReminder } from "@/lib/actions/regulatory-reminder-actions";
import { CHAT_STATUS_LABEL, type ChatStatus } from "@/lib/messaging";
import type { OpImpl, OpProposalDraft } from "./types";
import { opStr } from "./types";
import { runFd, fieldsOf } from "./helpers";
import { fold } from "./impl-regulatory";
import { resolveConversation } from "./impl-wave7b";

/**
 * OPS VAGUE 7c — MESSAGERIE complète : groupes et canaux, messages (édition du SIEN, modération,
 * réactions, épingles, signets — désignés par extrait), réglages par conversation (épingler,
 * couper, niveau de notification POUR SOI), gestion (fiche en FUSION, membres, rôles, quitter,
 * archiver, rejoindre un canal), statut de présence façon Teams — et la RELANCE Regulatory de
 * mise à jour des dossiers (Super Admin / DG, chiffres recalculés côté serveur). Par les
 * ACTIONS CANONIQUES.
 */

async function membersList(raw: string): Promise<{ ids: string[]; shown: string[] } | { error: string }> {
  const names = raw.split(/[;,]/).map((s) => s.trim()).filter(Boolean);
  if (names.length === 0) return { error: "Listez les personnes (champ « people » — noms, virgules)." };
  const ids: string[] = []; const shown: string[] = [];
  for (const n of names) {
    const rows = await prisma.user.findMany({
      where: { name: { contains: n, mode: "insensitive" }, isActive: true },
      select: { id: true, name: true }, take: 6,
    });
    if (rows.length === 0) return { error: `Aucun utilisateur actif « ${n} ».` };
    if (rows.length > 1) return { error: `Plusieurs personnes correspondent à « ${n} » : ${rows.map((u) => u.name).join(", ")} — préciser.` };
    if (!ids.includes(rows[0].id)) { ids.push(rows[0].id); shown.push(rows[0].name); }
  }
  return { ids, shown };
}

/** Un message d'une conversation, désigné par un extrait (« dernier » accepté). */
async function resolveConvMessage(conversationId: string, excerptRaw: string, opts?: { mine?: string }): Promise<{ id: string; excerpt: string } | { error: string }> {
  const rows = await prisma.message.findMany({
    where: { conversationId, deletedAt: null, kind: { not: "SYSTEM" }, ...(opts?.mine ? { senderId: opts.mine } : {}) },
    select: { id: true, body: true, sender: { select: { name: true } } },
    orderBy: { createdAt: "desc" }, take: 12,
  });
  if (rows.length === 0) return { error: opts?.mine ? "Vous n'avez aucun message dans cette conversation." : "Cette conversation n'a aucun message." };
  const excerpt = (m: (typeof rows)[number]) => `« ${m.body.slice(0, 50)}${m.body.length > 50 ? "…" : ""} » (${m.sender?.name ?? "—"})`;
  const q = fold(excerptRaw);
  if (!q || /^dernier/.test(q)) return { id: rows[0].id, excerpt: excerpt(rows[0]) };
  const hits = rows.filter((m) => fold(m.body).includes(q));
  if (hits.length === 1) return { id: hits[0].id, excerpt: excerpt(hits[0]) };
  if (hits.length === 0) return { error: `Aucun message contenant « ${excerptRaw} » — récents : ${rows.slice(0, 5).map(excerpt).join(" ; ")}.` };
  return { error: `Plusieurs messages correspondent : ${hits.map(excerpt).join(" ; ")} — préciser l'extrait.` };
}

const NOTIFY_FR = (raw: string): "ALL" | "MENTIONS" | "NONE" | null => {
  const q = fold(raw);
  if (/tout|all|chaque/.test(q)) return "ALL";
  if (/mention/.test(q)) return "MENTIONS";
  if (/rien|aucun|none|silence/.test(q)) return "NONE";
  return null;
};

/** Geste simple sur une conversation résolue : factory (même squelette partout). */
function convOp(opts: {
  title: (label: string) => string;
  warning?: string;
  action: (fd: FormData) => Promise<{ ok: boolean; error?: string }>;
  extraArgs?: (input: Record<string, unknown>) => Record<string, string | null>;
  success: (label: string) => string;
}): OpImpl {
  return {
    async propose(input, user): Promise<OpProposalDraft | { error: string }> {
      const conv = await resolveConversation(user, opStr(input, "target") || opStr(input, "label"));
      if ("error" in conv) return conv;
      return {
        title: opts.title(conv.label),
        fields: [{ label: "Conversation", value: conv.label }],
        warnings: opts.warning ? [opts.warning] : [],
        args: { conversationId: conv.id, ...(opts.extraArgs ? opts.extraArgs(input) : {}) },
        successMessage: opts.success(conv.label),
        revalidate: ["/messages"],
      };
    },
    execute: (args) => runFd(opts.action, args, "Le geste a été refusé.", { revalidate: ["/messages"] }),
  };
}

export const MESSAGING7_OPS_IMPL: Record<string, OpImpl> = {
  create_group: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const title = opStr(input, "name") || opStr(input, "label");
      if (!title) return { error: "Nommez le groupe (champ « name »)." };
      const members = await membersList(opStr(input, "people"));
      if ("error" in members) return members;
      return {
        title: `Créer le groupe « ${title} »`,
        fields: [{ label: "Groupe", value: title }, { label: "Membres", value: members.shown.join(", ") }],
        args: { title, members: members.ids.join(",") },
        successMessage: `Groupe « ${title} » créé (${members.shown.length} membre(s)).`,
        revalidate: ["/messages"],
      };
    },
    execute: (args) => runFd(createGroup, args, "La création du groupe a été refusée.", { revalidate: ["/messages"] }),
  },

  create_channel: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const title = opStr(input, "name") || opStr(input, "label");
      if (!title) return { error: "Nommez le canal (champ « name »)." };
      const peopleRaw = opStr(input, "people");
      const members = peopleRaw ? await membersList(peopleRaw) : { ids: [], shown: [] as string[] };
      if ("error" in members) return members;
      return {
        title: `Créer le canal « ${title} »`,
        fields: fieldsOf([
          ["Canal", title],
          ["Sujet", opStr(input, "notes") || null],
          ["Membres", members.shown.length ? members.shown.join(", ") : "vous seul (les autres peuvent rejoindre)"],
        ]),
        args: { title, description: opStr(input, "notes") || null, members: members.ids.join(",") || null },
        successMessage: `Canal « ${title} » créé.`,
        revalidate: ["/messages"],
      };
    },
    execute: (args) => runFd(createChannel, args, "La création du canal a été refusée.", { revalidate: ["/messages"] }),
  },

  edit_message: {
    async propose(input, user): Promise<OpProposalDraft | { error: string }> {
      const conv = await resolveConversation(user, opStr(input, "target"));
      if ("error" in conv) return conv;
      const msg = await resolveConvMessage(conv.id, opStr(input, "comment") || opStr(input, "label"), { mine: user.id });
      if ("error" in msg) return msg;
      const body = opStr(input, "note") || opStr(input, "message");
      if (!body) return { error: "Donnez le NOUVEAU texte (champ « note »)." };
      return {
        title: `Modifier MON message (${conv.label})`,
        fields: [{ label: "Message actuel", value: msg.excerpt }, { label: "Nouveau texte", value: body }],
        warnings: ["On ne modifie que SES messages — la modification est horodatée."],
        args: { id: msg.id, body },
        successMessage: "Message modifié.",
        revalidate: ["/messages"],
      };
    },
    execute: (args) => runFd(editMessage, args, "La modification du message a été refusée.", { revalidate: ["/messages"] }),
  },

  delete_message: {
    async propose(input, user): Promise<OpProposalDraft | { error: string }> {
      const conv = await resolveConversation(user, opStr(input, "target"));
      if ("error" in conv) return conv;
      const msg = await resolveConvMessage(conv.id, opStr(input, "comment") || opStr(input, "label"));
      if ("error" in msg) return msg;
      return {
        title: `Supprimer un message (${conv.label})`,
        fields: [{ label: "Message", value: msg.excerpt }],
        warnings: ["Suppression douce (le message disparaît, l'épingle tombe) — expéditeur, propriétaire / admin de la conversation, ou vue globale."],
        args: { id: msg.id },
        successMessage: "Message supprimé.",
        revalidate: ["/messages"],
      };
    },
    execute: (args) => runFd(deleteMessage, args, "La suppression du message a été refusée.", { revalidate: ["/messages"] }),
  },

  toggle_reaction: {
    async propose(input, user): Promise<OpProposalDraft | { error: string }> {
      const conv = await resolveConversation(user, opStr(input, "target"));
      if ("error" in conv) return conv;
      const msg = await resolveConvMessage(conv.id, opStr(input, "comment") || opStr(input, "label"));
      if ("error" in msg) return msg;
      const emoji = opStr(input, "emoji") || "👍";
      return {
        title: `Réagir ${emoji} (${conv.label})`,
        fields: [{ label: "Message", value: msg.excerpt }, { label: "Réaction", value: emoji }],
        warnings: ["Bascule : la même réaction déjà posée est RETIRÉE."],
        args: { messageId: msg.id, emoji },
        successMessage: `Réaction ${emoji} basculée.`,
        revalidate: ["/messages"],
      };
    },
    execute: (args) => runFd(toggleReaction, args, "La réaction a été refusée.", { revalidate: ["/messages"] }),
  },

  toggle_pin_message: {
    async propose(input, user): Promise<OpProposalDraft | { error: string }> {
      const conv = await resolveConversation(user, opStr(input, "target"));
      if ("error" in conv) return conv;
      const msg = await resolveConvMessage(conv.id, opStr(input, "comment") || opStr(input, "label"));
      if ("error" in msg) return msg;
      return {
        title: `Épingler / désépingler un message (${conv.label})`,
        fields: [{ label: "Message", value: msg.excerpt }],
        warnings: ["Épingle VISIBLE DE TOUS dans la conversation (bascule)."],
        args: { messageId: msg.id },
        successMessage: "Épingle basculée.",
        revalidate: ["/messages"],
      };
    },
    execute: (args) => runFd(togglePinMessage, args, "L'épinglage a été refusé.", { revalidate: ["/messages"] }),
  },

  bookmark_message: {
    async propose(input, user): Promise<OpProposalDraft | { error: string }> {
      const conv = await resolveConversation(user, opStr(input, "target"));
      if ("error" in conv) return conv;
      const msg = await resolveConvMessage(conv.id, opStr(input, "comment") || opStr(input, "label"));
      if ("error" in msg) return msg;
      return {
        title: `Signet sur un message (${conv.label})`,
        fields: [{ label: "Message", value: msg.excerpt }],
        warnings: ["Signet PERSONNEL (visible de vous seul) — bascule."],
        args: { messageId: msg.id },
        successMessage: "Signet basculé.",
        revalidate: ["/messages"],
      };
    },
    execute: (args) => runFd(bookmarkMessage, args, "Le signet a été refusé.", { revalidate: ["/messages"] }),
  },

  toggle_pin_conversation: convOp({
    title: (l) => `Épingler / désépingler « ${l} » en tête de MA liste`,
    warning: "Épingle PERSONNELLE (votre liste seulement) — bascule.",
    action: togglePinConversation,
    success: (l) => `Épingle de « ${l} » basculée.`,
  }),

  toggle_mute: convOp({
    title: (l) => `Couper / rétablir les notifications de « ${l} »`,
    warning: "Sourdine PERSONNELLE — bascule ; les messages arrivent toujours, sans notifier.",
    action: toggleMute,
    success: (l) => `Sourdine de « ${l} » basculée.`,
  }),

  set_notify_level: {
    async propose(input, user): Promise<OpProposalDraft | { error: string }> {
      const conv = await resolveConversation(user, opStr(input, "target"));
      if ("error" in conv) return conv;
      const level = NOTIFY_FR(opStr(input, "mode") || opStr(input, "status"));
      if (!level) return { error: "Précisez le niveau (champ « mode ») : tout, mentions seulement, ou rien." };
      const shown = level === "ALL" ? "Tout" : level === "MENTIONS" ? "Mentions seulement" : "Rien";
      return {
        title: `Notifications de « ${conv.label} » : ${shown}`,
        fields: [{ label: "Conversation", value: conv.label }, { label: "Niveau (pour vous)", value: shown }],
        args: { conversationId: conv.id, level },
        successMessage: `Notifications de « ${conv.label} » : ${shown}.`,
        revalidate: ["/messages"],
      };
    },
    execute: (args) => runFd(setNotifyLevel, args, "Le niveau de notification a été refusé.", { revalidate: ["/messages"] }),
  },

  update_conversation: {
    async propose(input, user): Promise<OpProposalDraft | { error: string }> {
      const conv = await resolveConversation(user, opStr(input, "target"));
      if ("error" in conv) return conv;
      const cur = await prisma.conversation.findUnique({
        where: { id: conv.id }, select: { type: true, title: true, description: true, icon: true, color: true },
      });
      if (!cur || cur.type === "DIRECT") return { error: "Un message direct ne se renomme pas — seuls les groupes et canaux ont une fiche." };
      // FUSION : description, icône et couleur sont REMPLACÉES par l'action — rejouées.
      return {
        title: `Modifier la fiche de « ${conv.label} »`,
        fields: fieldsOf([
          ["Conversation", opStr(input, "newName") ? `${conv.label} → ${opStr(input, "newName")}` : conv.label],
          ["Sujet", opStr(input, "notes") || (cur.description ? "(rejoué)" : null)],
          ["Le reste", "icône et couleur rejouées (FUSION) — le renommage poste un message système"],
        ]),
        args: {
          conversationId: conv.id,
          title: opStr(input, "newName") || null,
          description: opStr(input, "notes") || cur.description || null,
          icon: cur.icon ?? null, color: cur.color ?? null,
        },
        successMessage: `Fiche de « ${opStr(input, "newName") || conv.label} » modifiée.`,
        revalidate: ["/messages"],
      };
    },
    execute: (args) => runFd(updateConversation, args, "La modification de la fiche a été refusée.", { revalidate: ["/messages"] }),
  },

  add_members: {
    async propose(input, user): Promise<OpProposalDraft | { error: string }> {
      const conv = await resolveConversation(user, opStr(input, "target"));
      if ("error" in conv) return conv;
      const members = await membersList(opStr(input, "people") || opStr(input, "person"));
      if ("error" in members) return members;
      return {
        title: `Ajouter ${members.shown.join(", ")} à « ${conv.label} »`,
        fields: [{ label: "Conversation", value: conv.label }, { label: "Ajoutés", value: members.shown.join(", ") }],
        warnings: ["Propriétaire / admin seulement — un ancien membre revient avec son historique, un message système l'annonce."],
        args: { conversationId: conv.id, members: members.ids.join(",") },
        successMessage: `${members.shown.length} membre(s) ajouté(s) à « ${conv.label} ».`,
        revalidate: ["/messages"],
      };
    },
    execute: (args) => runFd(addMembers, args, "L'ajout de membres a été refusé.", { revalidate: ["/messages"] }),
  },

  remove_member: {
    async propose(input, user): Promise<OpProposalDraft | { error: string }> {
      const conv = await resolveConversation(user, opStr(input, "target"));
      if ("error" in conv) return conv;
      const members = await membersList(opStr(input, "person"));
      if ("error" in members) return members;
      if (members.ids.length !== 1) return { error: "Un seul membre à la fois (champ « person »)." };
      return {
        title: `Retirer ${members.shown[0]} de « ${conv.label} »`,
        fields: [{ label: "Conversation", value: conv.label }, { label: "Retiré", value: members.shown[0] }],
        warnings: ["Propriétaire / admin seulement — pour partir soi-même : leave_conversation. Un message système l'annonce."],
        args: { conversationId: conv.id, userId: members.ids[0] },
        successMessage: `${members.shown[0]} retiré·e de « ${conv.label} ».`,
        revalidate: ["/messages"],
      };
    },
    execute: (args) => runFd(removeMember, args, "Le retrait du membre a été refusé.", { revalidate: ["/messages"] }),
  },

  set_member_role: {
    async propose(input, user): Promise<OpProposalDraft | { error: string }> {
      const conv = await resolveConversation(user, opStr(input, "target"));
      if ("error" in conv) return conv;
      const members = await membersList(opStr(input, "person"));
      if ("error" in members) return members;
      if (members.ids.length !== 1) return { error: "Une seule personne à la fois (champ « person »)." };
      const role = /admin/i.test(opStr(input, "role") || opStr(input, "mode")) ? "ADMIN" : "MEMBER";
      return {
        title: `${members.shown[0]} → ${role === "ADMIN" ? "Admin" : "Membre"} de « ${conv.label} »`,
        fields: [{ label: "Conversation", value: conv.label }, { label: "Rôle", value: `${members.shown[0]} : ${role === "ADMIN" ? "Admin" : "Membre"}` }],
        warnings: ["Seul le PROPRIÉTAIRE gère les rôles — le propriétaire lui-même n'est pas modifiable."],
        args: { conversationId: conv.id, userId: members.ids[0], role },
        successMessage: `${members.shown[0]} : ${role === "ADMIN" ? "Admin" : "Membre"}.`,
        revalidate: ["/messages"],
      };
    },
    execute: (args) => runFd(setMemberRole, args, "Le changement de rôle a été refusé.", { revalidate: ["/messages"] }),
  },

  leave_conversation: convOp({
    title: (l) => `Quitter « ${l} »`,
    warning: "Un message système l'annonce — un message DIRECT ne se quitte pas (l'action refuse).",
    action: leaveConversation,
    success: (l) => `Vous avez quitté « ${l} ».`,
  }),

  archive_conversation: {
    async propose(input, user): Promise<OpProposalDraft | { error: string }> {
      const conv = await resolveConversation(user, opStr(input, "target"));
      if ("error" in conv) return conv;
      const unarchive = /d[ée]sarchiv|r[ée]active|restaure/i.test(opStr(input, "mode"));
      return {
        title: `${unarchive ? "Désarchiver" : "Archiver"} « ${conv.label} »`,
        fields: [{ label: "Conversation", value: conv.label }],
        warnings: ["Propriétaire / admin seulement — archivée, la conversation sort des listes actives POUR TOUS (rien n'est supprimé)."],
        args: { conversationId: conv.id, archived: unarchive ? null : "1" },
        successMessage: `« ${conv.label} » ${unarchive ? "désarchivée" : "archivée"}.`,
        revalidate: ["/messages"],
      };
    },
    execute: (args) => runFd(archiveConversation, args, "L'archivage a été refusé.", { revalidate: ["/messages"] }),
  },

  join_channel: {
    async propose(input, user): Promise<OpProposalDraft | { error: string }> {
      const q = (opStr(input, "target") || opStr(input, "name")).trim();
      if (!q) return { error: "Précisez le canal (champ « target » — son nom)." };
      const rows = await prisma.conversation.findMany({
        where: { type: "CHANNEL", isArchived: false, title: { contains: q, mode: "insensitive" } },
        select: { id: true, title: true, members: { where: { userId: user.id, leftAt: null }, select: { id: true } } },
        take: 6,
      });
      if (rows.length === 0) return { error: `Aucun canal « ${q} ».` };
      if (rows.length > 1) return { error: `Plusieurs canaux correspondent : ${rows.map((c) => c.title).join(", ")} — préciser.` };
      if (rows[0].members.length > 0) return { error: `Vous êtes déjà membre du canal « ${rows[0].title} ».` };
      return {
        title: `Rejoindre le canal « ${rows[0].title} »`,
        fields: [{ label: "Canal", value: rows[0].title ?? q }],
        warnings: ["Un message système annonce l'arrivée — un ancien membre revient avec son historique."],
        args: { conversationId: rows[0].id },
        successMessage: `Vous avez rejoint « ${rows[0].title} ».`,
        revalidate: ["/messages"],
      };
    },
    execute: (args) => runFd(joinChannel, args, "L'entrée dans le canal a été refusée.", { revalidate: ["/messages"] }),
  },

  set_messaging_status: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const raw = fold(opStr(input, "status") || opStr(input, "mode"));
      const auto = /auto|efface|retire|aucun/.test(raw);
      let status: ChatStatus | null = null;
      if (!auto) {
        status = /ne pas deranger|dnd/.test(raw) ? "DND"
          : /occup/.test(raw) ? "BUSY"
          : /retour bientot|brb|reviens/.test(raw) ? "BRB"
          : /absent|away/.test(raw) ? "AWAY"
          : /hors ligne|offline|invisible/.test(raw) ? "OFFLINE"
          : /disponible|libre|available/.test(raw) ? "AVAILABLE" : null;
        if (!status) return { error: "Précisez le statut (champ « status ») : disponible, occupé, ne pas déranger, de retour bientôt, absent, hors ligne — ou « automatique » pour l'effacer." };
      }
      return {
        title: `Mon statut : ${status ? CHAT_STATUS_LABEL[status] : "automatique (présence réelle)"}`,
        fields: fieldsOf([
          ["Statut", status ? CHAT_STATUS_LABEL[status] : "Automatique (par la présence)"],
          ["Message personnel", opStr(input, "note") || null],
        ]),
        args: { status: status ?? null, message: opStr(input, "note") || null },
        successMessage: `Statut de messagerie : ${status ? CHAT_STATUS_LABEL[status] : "automatique"}.`,
        revalidate: ["/messages"],
      };
    },
    async execute(args) {
      const fd = new FormData();
      if (args.status) fd.set("status", args.status);
      if (args.message) fd.set("message", args.message);
      await setMessagingStatus(fd);
      return { ok: true, revalidate: ["/messages"] };
    },
  },
};

// ─────────────────────────── RELANCE REGULATORY (Super Admin / DG) ───────────────────────────

export const REGREMINDER_OPS_IMPL: Record<string, OpImpl> = {
  send_update_reminder: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const personRaw = opStr(input, "person");
      let recipientId: string | null = null; let shown = "TOUS les porteurs de dossiers à traiter";
      if (personRaw && !/^tous|^tout le monde/i.test(personRaw)) {
        const rows = await prisma.user.findMany({
          where: { name: { contains: personRaw, mode: "insensitive" }, isActive: true },
          select: { id: true, name: true }, take: 6,
        });
        if (rows.length === 0) return { error: `Aucun utilisateur actif « ${personRaw} ».` };
        if (rows.length > 1) return { error: `Plusieurs personnes correspondent : ${rows.map((u) => u.name).join(", ")} — préciser.` };
        recipientId = rows[0].id; shown = rows[0].name;
      }
      return {
        title: `Relance de mise à jour Regulatory → ${shown}`,
        fields: fieldsOf([
          ["Destinataire", shown],
          ["Mot", opStr(input, "note") || null],
        ]),
        warnings: ["Réservée au Super Admin et au Directeur Général — les CHIFFRES (portefeuille, part en sommeil) sont recalculés côté serveur, jamais envoyés par l'écran ; l'historique retient le portefeuille au moment de la relance."],
        args: { recipientId, note: opStr(input, "note") || null },
        successMessage: `Relance Regulatory envoyée (${shown}).`,
        revalidate: ["/regulatory"],
      };
    },
    execute: (args) => runFd(sendRegulatoryUpdateReminder, args, "La relance a été refusée.", { revalidate: ["/regulatory"] }),
  },
};
