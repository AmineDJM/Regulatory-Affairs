import { prisma } from "@/lib/prisma";
import {
  setMeetingLink, updateMeeting, setMeetingLive, startCall, removeMeetingParticipant,
  saveMeetingTranscript, summarizeMeeting, acceptMeetingProposal, dismissMeetingProposal, deleteMeetingMessage,
} from "@/lib/actions/meeting-actions";
import { respondToInvite } from "@/lib/actions/calendar-actions";
import { updateComment, deleteComment } from "@/lib/actions/comment-actions";
import { ENTITY_TYPE_LABELS } from "@/lib/labels";
import type { CurrentUser } from "@/lib/session";
import type { OpImpl, OpProposalDraft } from "./types";
import { opStr } from "./types";
import { runFd, fieldsOf } from "./helpers";
import { fold } from "./impl-regulatory";
import { resolveMeeting } from "./impl-meeting";

/**
 * OPS VAGUE 7b — RÉUNIONS avancées (lien, FUSION de la fiche avec heure d'Alger rejouée,
 * passage en direct, appel depuis une conversation, retrait de participant, transcription
 * collée, compte rendu IA avec tâches proposées acceptées / écartées une à une, message du fil
 * supprimé par extrait), INVITATION D'AGENDA (accepter / refuser / peut-être — chacun pour
 * soi), et COMMENTAIRES transverses (modifier / supprimer par extrait, sur n'importe quel
 * objet commenté). Par les ACTIONS CANONIQUES — la porte « organisateur » reste le juge.
 */

/** UTC → saisie « datetime-local » à l'heure d'Alger (UTC+1, sans heure d'été). */
const utcToAlgiersInput = (d: Date | null): string | null =>
  d ? new Date(d.getTime() + 3600_000).toISOString().slice(0, 16) : null;

// Exportée pour les ops messagerie (impl-wave7c) — même résolution des conversations.
export async function resolveConversation(user: CurrentUser, raw: string): Promise<{ id: string; label: string } | { error: string }> {
  const q = raw.trim();
  if (!q) return { error: "Précisez la conversation (champ « target » — son nom, ou la personne)." };
  const mine = await prisma.conversation.findMany({
    where: { members: { some: { userId: user.id, leftAt: null } }, isArchived: false },
    select: {
      id: true, title: true, type: true,
      members: { where: { leftAt: null }, select: { user: { select: { name: true } } } },
    },
    orderBy: { lastMessageAt: "desc" }, take: 60,
  });
  const label = (c: (typeof mine)[number]) =>
    c.title ?? c.members.map((m) => m.user.name).filter((n) => n !== user.name).join(", ");
  const fq = fold(q);
  const hits = mine.filter((c) => fold(label(c)).includes(fq));
  if (hits.length === 1) return { id: hits[0].id, label: label(hits[0]) };
  if (hits.length === 0) return { error: `Aucune de vos conversations ne correspond à « ${q} ».` };
  return { error: `Plusieurs conversations correspondent : ${hits.slice(0, 5).map(label).join(" ; ")} — préciser.` };
}

export const MEETING7_OPS_IMPL: Record<string, OpImpl> = {
  set_meeting_link: {
    async propose(input, user): Promise<OpProposalDraft | { error: string }> {
      const m = await resolveMeeting(user, opStr(input, "title"), "organizer");
      if ("error" in m) return m;
      const link = opStr(input, "link") || opStr(input, "comment");
      return {
        title: `Lien de la réunion « ${m.title} »`,
        fields: [{ label: "Réunion", value: m.title }, { label: "Lien", value: link || "— (retiré)" }],
        warnings: ["Geste de l'ORGANISATEUR — le lien est normalisé (https:// ajouté au besoin), un lien invalide est effacé."],
        args: { id: m.id, meetLink: link || null },
        successMessage: `Lien de « ${m.title} » mis à jour.`,
        revalidate: ["/meetings"],
      };
    },
    execute: (args) => runFd(setMeetingLink, args, "La mise à jour du lien a été refusée.", { revalidate: ["/meetings"] }),
  },

  update_meeting: {
    async propose(input, user): Promise<OpProposalDraft | { error: string }> {
      const m = await resolveMeeting(user, opStr(input, "title"), "organizer");
      if ("error" in m) return m;
      const cur = await prisma.meeting.findUnique({
        where: { id: m.id },
        select: { title: true, description: true, scheduledAt: true, meetLink: true, inPerson: true },
      });
      if (!cur) return { error: "Réunion introuvable." };
      // FUSION : titre, description, HORAIRE (heure d'Alger) et lien sont REMPLACÉS par
      // l'action — l'existant est relu et rejoué ; visio/présentiel/lieu sont préservés
      // par l'action quand absents.
      const date = opStr(input, "date");
      const time = opStr(input, "time");
      const scheduledAt = date
        ? `${date}T${(time || "09:00").padStart(5, "0")}`
        : utcToAlgiersInput(cur.scheduledAt);
      return {
        title: `Modifier la réunion « ${cur.title} »`,
        fields: fieldsOf([
          ["Réunion", opStr(input, "newName") ? `${cur.title} → ${opStr(input, "newName")}` : cur.title],
          ["Horaire (Alger)", date ? `${date} ${time || "09:00"}` : (scheduledAt ? `${scheduledAt.replace("T", " ")} (rejoué)` : null)],
          ["Le reste", "description et lien rejoués (FUSION) — un horaire changé RÉARME le rappel 30 min avant"],
        ]),
        args: {
          id: m.id, title: opStr(input, "newName") || cur.title,
          description: opStr(input, "description") || cur.description || null,
          scheduledAt, meetLink: opStr(input, "link") || cur.meetLink || null,
        },
        successMessage: `Réunion « ${opStr(input, "newName") || cur.title} » modifiée.`,
        revalidate: ["/meetings"],
      };
    },
    execute: (args) => runFd(updateMeeting, args, "La modification de la réunion a été refusée.", { revalidate: ["/meetings"] }),
  },

  set_meeting_live: {
    async propose(input, user): Promise<OpProposalDraft | { error: string }> {
      const m = await resolveMeeting(user, opStr(input, "title"), "organizer");
      if ("error" in m) return m;
      return {
        title: `Démarrer la réunion « ${m.title} »`,
        fields: [{ label: "Réunion", value: m.title }],
        warnings: ["La réunion passe EN COURS (horodatée) — une réunion terminée ne redémarre pas."],
        args: { id: m.id },
        successMessage: `Réunion « ${m.title} » en cours.`,
        revalidate: ["/meetings"],
      };
    },
    execute: (args) => runFd(setMeetingLive, args, "Le démarrage a été refusé.", { revalidate: ["/meetings"] }),
  },

  start_call: {
    async propose(input, user): Promise<OpProposalDraft | { error: string }> {
      const conv = await resolveConversation(user, opStr(input, "target") || opStr(input, "title"));
      if ("error" in conv) return conv;
      const audioOnly = /audio|sans vid[ée]o/i.test(opStr(input, "mode"));
      return {
        title: `Lancer un appel ${audioOnly ? "audio" : "vidéo"} — ${conv.label}`,
        fields: [{ label: "Conversation", value: conv.label }, { label: "Type", value: audioOnly ? "Audio" : "Vidéo" }],
        warnings: ["Crée la réunion instantanée, poste le lien « Rejoindre » dans le fil et SONNE chez les membres (notification insistante)."],
        args: { conversationId: conv.id, withVideo: audioOnly ? "" : "1" },
        successMessage: `Appel ${audioOnly ? "audio" : "vidéo"} lancé (${conv.label}).`,
        revalidate: ["/messages", "/meetings"],
      };
    },
    async execute(args) {
      const fd = new FormData();
      fd.set("conversationId", args.conversationId ?? "");
      if (args.withVideo) fd.set("withVideo", "1");
      else fd.set("withVideo", "0");
      const r = await startCall(fd);
      if (!r.ok) return { ok: false, error: r.error ?? "Le lancement de l'appel a été refusé." };
      return { ok: true, revalidate: ["/messages", "/meetings"] };
    },
  },

  remove_meeting_participant: {
    async propose(input, user): Promise<OpProposalDraft | { error: string }> {
      const m = await resolveMeeting(user, opStr(input, "title"), "organizer");
      if ("error" in m) return m;
      const raw = opStr(input, "person");
      if (!raw) return { error: "Précisez le participant à retirer (champ « person »)." };
      const parts = await prisma.meetingParticipant.findMany({
        where: { meetingId: m.id },
        select: { userId: true, user: { select: { name: true } } },
      });
      const hits = parts.filter((p) => fold(p.user.name).includes(fold(raw)));
      if (hits.length === 0) return { error: `« ${raw} » n'est pas participant de « ${m.title} » — participants : ${parts.map((p) => p.user.name).join(", ") || "aucun"}.` };
      if (hits.length > 1) return { error: `Plusieurs participants correspondent : ${hits.map((p) => p.user.name).join(", ")} — préciser.` };
      return {
        title: `Retirer ${hits[0].user.name} de « ${m.title} »`,
        fields: [{ label: "Participant", value: `${hits[0].user.name} — ${m.title}` }],
        args: { id: m.id, userId: hits[0].userId },
        successMessage: `${hits[0].user.name} retiré·e de « ${m.title} ».`,
        revalidate: ["/meetings"],
      };
    },
    execute: (args) => runFd(removeMeetingParticipant, args, "Le retrait a été refusé.", { revalidate: ["/meetings"] }),
  },

  save_meeting_transcript: {
    async propose(input, user): Promise<OpProposalDraft | { error: string }> {
      const m = await resolveMeeting(user, opStr(input, "title"), "organizer");
      if ("error" in m) return m;
      const transcript = opStr(input, "transcript") || opStr(input, "comment");
      if (!transcript) return { error: "Collez la transcription (champ « transcript »)." };
      return {
        title: `Enregistrer la transcription — « ${m.title} »`,
        fields: [{ label: "Réunion", value: m.title }, { label: "Transcription", value: `${transcript.slice(0, 120)}${transcript.length > 120 ? "…" : ""} (${transcript.length} caractères)` }],
        args: { id: m.id, transcript },
        successMessage: `Transcription de « ${m.title} » enregistrée — le compte rendu IA peut partir (summarize_meeting).`,
        revalidate: ["/meetings"],
      };
    },
    execute: (args) => runFd(saveMeetingTranscript, args, "L'enregistrement de la transcription a été refusé.", { revalidate: ["/meetings"] }),
  },

  summarize_meeting: {
    async propose(input, user): Promise<OpProposalDraft | { error: string }> {
      const m = await resolveMeeting(user, opStr(input, "title"), "organizer");
      if ("error" in m) return m;
      return {
        title: `Compte rendu IA — « ${m.title} »`,
        fields: [{ label: "Réunion", value: m.title }],
        warnings: ["L'IA résume la transcription STOCKÉE et propose des tâches — les personnes désignées sont rapprochées des participants, jamais inventées ; les propositions précédentes non traitées sont remplacées."],
        args: { id: m.id },
        successMessage: `Compte rendu de « ${m.title} » généré (tâches proposées à trancher).`,
        revalidate: ["/meetings"],
      };
    },
    execute: (args) => runFd(summarizeMeeting, args, "Le compte rendu a été refusé (transcription manquante ?).", { revalidate: ["/meetings"] }),
  },

  accept_meeting_proposal: {
    async propose(input, user): Promise<OpProposalDraft | { error: string }> {
      const m = await resolveMeeting(user, opStr(input, "title"), "organizer");
      if ("error" in m) return m;
      const proposals = await prisma.meetingTaskProposal.findMany({
        where: { meetingId: m.id, status: "PROPOSED" },
        select: { id: true, title: true, assignee: { select: { name: true } } },
        take: 15,
      });
      if (proposals.length === 0) return { error: `« ${m.title} » n'a aucune tâche proposée en attente.` };
      const q = fold(opStr(input, "label"));
      const hits = q ? proposals.filter((p) => fold(p.title).includes(q)) : proposals;
      if (hits.length === 0) return { error: `Aucune proposition « ${opStr(input, "label")} » — en attente : ${proposals.map((p) => p.title).join(" ; ")}.` };
      if (hits.length > 1) return { error: `Plusieurs propositions correspondent : ${hits.map((p) => p.title).join(" ; ")} — préciser (champ « label »).` };
      return {
        title: `Transformer en tâche : « ${hits[0].title} »`,
        fields: fieldsOf([
          ["Réunion", m.title],
          ["Tâche", hits[0].title],
          ["Assignée à", hits[0].assignee?.name ?? "l'organisateur (défaut)"],
        ]),
        args: { proposalId: hits[0].id },
        successMessage: `Tâche « ${hits[0].title} » créée et assignée.`,
        revalidate: ["/meetings", "/mon-espace"],
      };
    },
    execute: (args) => runFd(acceptMeetingProposal, args, "La transformation en tâche a été refusée.", { revalidate: ["/meetings"] }),
  },

  dismiss_meeting_proposal: {
    async propose(input, user): Promise<OpProposalDraft | { error: string }> {
      const m = await resolveMeeting(user, opStr(input, "title"), "organizer");
      if ("error" in m) return m;
      const proposals = await prisma.meetingTaskProposal.findMany({
        where: { meetingId: m.id, status: "PROPOSED" },
        select: { id: true, title: true }, take: 15,
      });
      if (proposals.length === 0) return { error: `« ${m.title} » n'a aucune tâche proposée en attente.` };
      const q = fold(opStr(input, "label"));
      const hits = q ? proposals.filter((p) => fold(p.title).includes(q)) : proposals;
      if (hits.length === 0) return { error: `Aucune proposition « ${opStr(input, "label")} » — en attente : ${proposals.map((p) => p.title).join(" ; ")}.` };
      if (hits.length > 1) return { error: `Plusieurs propositions correspondent : ${hits.map((p) => p.title).join(" ; ")} — préciser.` };
      return {
        title: `Écarter la proposition « ${hits[0].title} »`,
        fields: [{ label: "Proposition", value: `${hits[0].title} (${m.title})` }],
        args: { proposalId: hits[0].id },
        successMessage: `Proposition « ${hits[0].title} » écartée.`,
        revalidate: ["/meetings"],
      };
    },
    execute: (args) => runFd(dismissMeetingProposal, args, "L'écartement a été refusé.", { revalidate: ["/meetings"] }),
  },

  delete_meeting_message: {
    async propose(input, user): Promise<OpProposalDraft | { error: string }> {
      const m = await resolveMeeting(user, opStr(input, "title"), "circle");
      if ("error" in m) return m;
      const msgs = await prisma.meetingMessage.findMany({
        where: { meetingId: m.id },
        select: { id: true, body: true },
        orderBy: { createdAt: "desc" }, take: 10,
      });
      if (msgs.length === 0) return { error: `« ${m.title} » n'a aucun message.` };
      const excerpt = (x: (typeof msgs)[number]) => `« ${x.body.slice(0, 60)}${x.body.length > 60 ? "…" : ""} »`;
      const q = fold(opStr(input, "comment") || opStr(input, "label"));
      const hits = q ? msgs.filter((x) => fold(x.body).includes(q)) : (msgs.length === 1 ? msgs : []);
      if (hits.length === 0) return { error: `Précisez le message (champ « comment » — un extrait) parmi : ${msgs.slice(0, 5).map(excerpt).join(" ; ")}.` };
      if (hits.length > 1) return { error: `Plusieurs messages correspondent : ${hits.map(excerpt).join(" ; ")} — préciser l'extrait.` };
      return {
        title: `Supprimer un message du fil de « ${m.title} »`,
        fields: [{ label: "Message", value: excerpt(hits[0]) }],
        warnings: ["Suppression définitive (pièces jointes comprises, stockage libéré) — auteur ou organisateur."],
        args: { id: hits[0].id },
        successMessage: `Message supprimé du fil de « ${m.title} ».`,
        revalidate: ["/meetings"],
      };
    },
    execute: (args) => runFd(deleteMeetingMessage, args, "La suppression du message a été refusée.", { revalidate: ["/meetings"] }),
  },
};

// ─────────────────────────── AGENDA & COMMENTAIRES (mon espace) ───────────────────────────

const INVITE_FR: [string, string][] = [
  ["ACCEPTED", "Accepter"], ["DECLINED", "Refuser"], ["TENTATIVE", "Peut-être"],
];

async function resolveComment(user: CurrentUser, raw: string): Promise<{ id: string; shown: string } | { error: string }> {
  const q = raw.trim();
  if (!q) return { error: "Précisez le commentaire (champ « comment » — un extrait)." };
  const rows = await prisma.comment.findMany({
    where: { body: { contains: q, mode: "insensitive" } },
    select: { id: true, body: true, entityType: true, author: { select: { name: true } } },
    orderBy: { createdAt: "desc" }, take: 6,
  });
  void user;
  const shown = (c: (typeof rows)[number]) =>
    `« ${c.body.slice(0, 50)}${c.body.length > 50 ? "…" : ""} » (${(ENTITY_TYPE_LABELS as Record<string, string>)[c.entityType] ?? c.entityType}, ${c.author?.name ?? "—"})`;
  if (rows.length === 1) return { id: rows[0].id, shown: shown(rows[0]) };
  if (rows.length === 0) return { error: `Aucun commentaire contenant « ${q} ».` };
  return { error: `Plusieurs commentaires correspondent : ${rows.map(shown).join(" ; ")} — préciser l'extrait.` };
}

export const WORKSPACE7_OPS_IMPL: Record<string, OpImpl> = {
  respond_to_calendar_invite: {
    async propose(input, user): Promise<OpProposalDraft | { error: string }> {
      const m = matchLabelInvite(opStr(input, "decision") || opStr(input, "status"));
      if (typeof m === "object") return m;
      const q = opStr(input, "label") || opStr(input, "target");
      const invites = await prisma.calendarInvite.findMany({
        where: { userId: user.id, event: q ? { title: { contains: q, mode: "insensitive" } } : { startAt: { gte: new Date(Date.now() - 86_400_000) } } },
        select: { eventId: true, event: { select: { title: true, startAt: true } } },
        orderBy: { event: { startAt: "asc" } }, take: 6,
      });
      if (invites.length === 0) return { error: q ? `Aucune invitation d'agenda « ${q} » à votre nom.` : "Aucune invitation d'agenda à venir à votre nom." };
      if (invites.length > 1) return { error: `Plusieurs invitations : ${invites.map((i) => `${i.event.title} (${i.event.startAt.toISOString().slice(0, 10)})`).join(" ; ")} — préciser (champ « label »).` };
      return {
        title: `${INVITE_FR.find(([c]) => c === m)?.[1]} l'invitation « ${invites[0].event.title} »`,
        fields: [{ label: "Rendez-vous", value: `${invites[0].event.title} — ${invites[0].event.startAt.toISOString().slice(0, 10)}` }, { label: "Réponse", value: INVITE_FR.find(([c]) => c === m)?.[1] ?? m }],
        warnings: ["Chacun ne répond que pour LUI-MÊME — l'organisateur voit la réponse sur l'événement."],
        args: { eventId: invites[0].eventId, status: m },
        successMessage: `Invitation « ${invites[0].event.title} » : ${INVITE_FR.find(([c]) => c === m)?.[1]}.`,
        revalidate: ["/calendar"],
      };
    },
    execute: (args) => runFd(respondToInvite, args, "La réponse à l'invitation a été refusée.", { revalidate: ["/calendar"] }),
  },

  update_comment: {
    async propose(input, user): Promise<OpProposalDraft | { error: string }> {
      const c = await resolveComment(user, opStr(input, "comment") || opStr(input, "label"));
      if ("error" in c) return c;
      const body = opStr(input, "note") || opStr(input, "message");
      if (!body) return { error: "Donnez le NOUVEAU texte du commentaire (champ « note »)." };
      return {
        title: "Modifier un commentaire",
        fields: [{ label: "Commentaire actuel", value: c.shown }, { label: "Nouveau texte", value: body }],
        warnings: ["Réservé à l'auteur, ou à un responsable de l'objet commenté (revérifié par l'action) — la modification est horodatée."],
        args: { id: c.id, body },
        successMessage: "Commentaire modifié.",
        revalidate: [],
      };
    },
    execute: (args) => runFd(updateComment, args, "La modification du commentaire a été refusée.", { revalidate: [] }),
  },

  delete_comment: {
    async propose(input, user): Promise<OpProposalDraft | { error: string }> {
      const c = await resolveComment(user, opStr(input, "comment") || opStr(input, "label"));
      if ("error" in c) return c;
      return {
        title: "Supprimer un commentaire",
        fields: [{ label: "Commentaire", value: c.shown }],
        warnings: ["Suppression définitive — auteur ou responsable de l'objet commenté (revérifié par l'action), tracée à l'audit."],
        args: { id: c.id },
        successMessage: "Commentaire supprimé.",
        revalidate: [],
      };
    },
    execute: (args) => runFd(deleteComment, args, "La suppression du commentaire a été refusée.", { revalidate: [] }),
  },
};

function matchLabelInvite(raw: string): string | { error: string } {
  const q = fold(raw);
  if (/accept|oui|present/.test(q)) return "ACCEPTED";
  if (/refus|declin|non/.test(q)) return "DECLINED";
  if (/peut|tentative|incertain/.test(q)) return "TENTATIVE";
  return { error: "Précisez la réponse (champ « decision ») : accepter, refuser, ou peut-être." };
}
