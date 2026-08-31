import { prisma } from "@/lib/prisma";
import {
  updateEvent, deleteEvent, submitEventForApproval, addRegistration, setRegistrationStatus, deleteRegistration,
} from "@/lib/actions/event-actions";
import {
  sponsoringPreliminary, sponsoringAnalysis, sponsoringFinal, sponsoringAppeal,
  requestThirdPartyInput as sponsoringThirdParty,
} from "@/lib/actions/sponsoring-actions";
import {
  preliminaryDecision, submitProductAnalysis, finalDecision, updateGrantedBudget,
  cancelCongressRequest, requestThirdPartyInput as congressThirdParty,
} from "@/lib/actions/congress-request-actions";
import {
  addCongressBeneficiary, removeCongressBeneficiary, requestBeneficiaryIds,
} from "@/lib/actions/congress-beneficiary-actions";
import {
  addAdProItem, updateAdProItem, deleteAdProItem, emitItemExpenseOrder, linkPromoMaterial,
  submitAdProItem, setAdProItemBudget, requestAdProItemQuote, requestAdProItemOrder, approveAdProItemOrder,
} from "@/lib/actions/ad-pro-item-actions";
import {
  createAdProOtherRequest, decideAdProOtherRequest, closeAdProOtherRequest,
} from "@/lib/actions/ad-pro-other-actions";
import { updateAdProRequest } from "@/lib/actions/ad-pro-edit-actions";
import {
  createConsultingContract, requestConsultingValidation, decideConsultingContract,
  closeConsultingContract, addConsultingTask, toggleConsultingTask, deleteConsultingTask,
} from "@/lib/actions/consulting-actions";
import type { OpImpl, OpProposalDraft } from "./types";
import { opStr } from "./types";
import { runFd, runFd2, fieldsOf, resolveOne, isoDate, dzd } from "./helpers";
import { matchLabel, fold } from "./impl-regulatory";
import { resolveMissionParent, type MissionParent } from "./impl-wave2b";

/**
 * OPS VAGUE 5a — EVENTS (fiche en FUSION intégrale, circuit de prise en charge, inscriptions),
 * AD & PRO (circuit sponsoring complet : préliminaire National Sales → analyse chef de produit
 * → décision Direction → appel ; circuit congrès/événement ; personnes prises en charge ;
 * POSTES de dépense de bout en bout : devis → validation → budget → BC visé → émission ;
 * demandes « autres » ; correction de fiche par liste blanche), CONSULTING (contrat deux
 * parties, validation désignée, tâches attendues). Toujours par les ACTIONS CANONIQUES.
 */

const day = (d: Date | null | undefined): string | null => (d ? d.toISOString().slice(0, 10) : null);
const numStr = (v: unknown): string | null => (v == null ? null : String(Number(v)));

const resolvePerson = (raw: string, label = "la personne") =>
  resolveOne(raw, label,
    (q) => prisma.user.findMany({ where: { name: { contains: q, mode: "insensitive" }, isActive: true }, select: { id: true, name: true }, take: 6 }),
    (u) => u.name);

// ─────────────────────────── EVENTS ───────────────────────────

const resolveEvent = (raw: string) =>
  resolveOne(raw, "l'événement (champ « target » — son nom)",
    (q) => prisma.event.findMany({ where: { name: { contains: q, mode: "insensitive" } }, select: { id: true, name: true, status: true }, orderBy: { createdAt: "desc" }, take: 6 }),
    (e) => e.name);

const EVENT_TYPE_FR: [string, string][] = [
  ["CONGRESS", "Congrès"], ["SEMINAR", "Séminaire"], ["ROUND_TABLE", "Table ronde"],
  ["HOSPITAL_STAFF", "Staff hospitalier"], ["SYMPOSIUM", "Symposium"], ["WEBINAR", "Webinaire"],
  ["TRAINING", "Formation"], ["SCIENTIFIC_DAY", "Journée scientifique"], ["OTHER", "Autre"],
];
const EVENT_SCOPE_FR: [string, string][] = [["NATIONAL", "National"], ["INTERNATIONAL", "International"]];
const EVENT_FORMAT_FR: [string, string][] = [["PRESENTIAL", "Présentiel"], ["WEBINAR", "Webinaire (en ligne)"], ["HYBRID", "Hybride"]];
const EVENT_STATUS_FR: [string, string][] = [
  ["DRAFT", "Brouillon"], ["AWAITING_VALIDATION", "En attente de validation"], ["VALIDATED", "Validé"],
  ["PREPARATION", "En préparation"], ["REGISTRATION_OPEN", "Inscriptions ouvertes"], ["FULL", "Complet"],
  ["COMPLETED", "Terminé"], ["CANCELLED", "Annulé"],
];
const REG_STATUS_FR: [string, string][] = [
  ["REGISTERED", "Inscrit"], ["CONFIRMED", "Confirmé"], ["PENDING", "Liste d'attente"],
  ["REJECTED", "Refusé"], ["PRESENT", "Présent"], ["ABSENT", "Absent"], ["CANCELLED", "Annulé"],
];
const REG_ROLE_FR: [string, string][] = [
  ["DOCTOR", "Médecin"], ["PROFESSOR", "Professeur"], ["HEAD_OF_SERVICE", "Chef de service"],
  ["PHARMACIST", "Pharmacien"], ["OTHER", "Autre"],
];

function enumIn(raw: string, entries: [string, string][]): string | null | { error: string } {
  const q = raw.trim();
  if (!q) return null;
  return matchLabel(q, entries);
}

interface RegistrationHit { id: string; name: string }

async function resolveRegistration(eventId: string, eventName: string, raw: string): Promise<RegistrationHit | { error: string }> {
  const q = fold(raw);
  if (!q) return { error: "Précisez le participant (champ « person » — son nom)." };
  const rows = await prisma.eventRegistration.findMany({
    where: { eventId }, select: { id: true, firstName: true, lastName: true, status: true }, take: 200,
  });
  const label = (r: (typeof rows)[number]) => `${r.firstName} ${r.lastName}`;
  const hits = rows.filter((r) => fold(label(r)).includes(q) || q.includes(fold(r.lastName)));
  if (hits.length === 1) return { id: hits[0].id, name: label(hits[0]) };
  if (hits.length === 0) return { error: `Aucun participant « ${raw} » sur ${eventName}.` };
  return { error: `Plusieurs participants correspondent : ${hits.slice(0, 6).map(label).join(", ")} — préciser.` };
}

export const EVENT_OPS_IMPL: Record<string, OpImpl> = {
  update_event: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const hit = await resolveEvent(opStr(input, "target") || opStr(input, "name"));
      if ("error" in hit) return hit;
      const e = await prisma.event.findUnique({ where: { id: hit.id } });
      if (!e) return { error: "Événement introuvable." };
      const type = enumIn(opStr(input, "eventType"), EVENT_TYPE_FR);
      if (type && typeof type === "object") return type;
      const scope = enumIn(opStr(input, "scope"), EVENT_SCOPE_FR);
      if (scope && typeof scope === "object") return scope;
      const format = enumIn(opStr(input, "format"), EVENT_FORMAT_FR);
      if (format && typeof format === "object") return format;
      const status = enumIn(opStr(input, "status"), EVENT_STATUS_FR);
      if (status && typeof status === "object") return status;
      // FUSION : l'action REMPLACE la fiche entière (enums absents retombent sur des défauts,
      // textes absents s'effacent) — tout l'existant est relu et rejoué.
      const changes: string[] = [];
      const pick = (key: string, current: string | null, label: string): string | null => {
        const v = opStr(input, key);
        if (v) { changes.push(label); return v; }
        return current;
      };
      const name = pick("newName", e.name, "nom") ?? e.name;
      const location = pick("location", e.location, "lieu");
      const city = pick("city", e.city, "ville");
      const country = pick("country", e.country, "pays");
      const specialty = pick("specialty", e.specialty, "spécialité");
      const products = pick("products", e.products, "produits");
      const description = pick("notes", e.description, "description");
      const startDate = isoDate(opStr(input, "startDate")) ? (changes.push("début"), isoDate(opStr(input, "startDate"))) : day(e.startDate);
      const endDate = isoDate(opStr(input, "endDate")) ? (changes.push("fin"), isoDate(opStr(input, "endDate"))) : day(e.endDate);
      const capacity = opStr(input, "quantity") ? (changes.push("capacité"), opStr(input, "quantity")) : (e.capacity != null ? String(e.capacity) : null);
      const budget = opStr(input, "amount") ? (changes.push("budget estimé"), opStr(input, "amount")) : numStr(e.estimatedBudget);
      if (type && type !== e.type) changes.push("type");
      if (scope && scope !== e.scope) changes.push("portée");
      if (format && format !== e.format) changes.push("format");
      if (status && status !== e.status) changes.push(`statut → ${EVENT_STATUS_FR.find(([c]) => c === status)?.[1] ?? status}`);
      if (changes.length === 0) return { error: "Rien à changer : donnez newName, eventType, scope, format, status, startDate, endDate, location, city, country, specialty, products, quantity (capacité), amount (budget) ou notes." };
      return {
        title: `Modifier l'événement « ${e.name} »`,
        fields: [
          { label: "Événement", value: e.name },
          { label: "Modifications", value: changes.join(" · ") },
          { label: "Le reste", value: "rejoué à l'identique (type, statut, dates, responsable compris)" },
        ],
        args: {
          id: hit.id, name,
          type: (type as string | null) ?? e.type, scope: (scope as string | null) ?? e.scope,
          format: (format as string | null) ?? e.format, status: (status as string | null) ?? e.status,
          startDate, endDate, location, city, country, specialty, products, description,
          capacity, estimatedBudget: budget, meetingLink: e.meetingLink, responsibleId: e.responsibleId,
        },
        successMessage: `Événement « ${name} » mis à jour (${changes.join(", ")}).`,
        link: `/events/${hit.id}`, revalidate: ["/events"],
      };
    },
    execute: (args) => runFd(updateEvent, args, "La modification de l'événement a été refusée.", { revalidate: ["/events"] }),
  },

  delete_event: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const hit = await resolveEvent(opStr(input, "target") || opStr(input, "name"));
      if ("error" in hit) return hit;
      const regs = await prisma.eventRegistration.count({ where: { eventId: hit.id } });
      return {
        title: `SUPPRIMER l'événement « ${hit.name} »`,
        fields: [{ label: "Événement", value: hit.name }, { label: "Inscriptions emportées", value: String(regs) }],
        warnings: ["Suppression DÉFINITIVE de l'événement et de ses inscriptions — aucun retour possible."],
        confirmText: hit.name,
        args: { id: hit.id },
        successMessage: `Événement « ${hit.name} » supprimé.`,
        revalidate: ["/events"],
      };
    },
    execute: (args) => runFd(deleteEvent, args, "La suppression de l'événement a été refusée.", { revalidate: ["/events"] }),
  },

  submit_event_for_approval: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const hit = await resolveEvent(opStr(input, "target") || opStr(input, "name"));
      if ("error" in hit) return hit;
      let pmId: string | null = null; let pmName: string | null = null;
      if (opStr(input, "person")) {
        const pm = await resolvePerson(opStr(input, "person"), "le chef de produit (champ « person »)");
        if ("error" in pm) return pm;
        pmId = pm.id; pmName = pm.name;
      }
      return {
        title: `Soumettre « ${hit.name} » au circuit de prise en charge`,
        fields: fieldsOf([
          ["Événement", hit.name],
          ["Chef de produit désigné", pmName],
        ]),
        warnings: ["Même circuit que les congrès : National Sales (préliminaire) → analyse chef de produit → décision Direction — le routage saute les étapes au niveau du demandeur."],
        args: { id: hit.id, productManagerId: pmId, viaProductManager: pmId ? "1" : null },
        successMessage: `« ${hit.name} » soumis au circuit de prise en charge.`,
        link: `/events/${hit.id}`, revalidate: ["/events"],
      };
    },
    execute: (args) => runFd(submitEventForApproval, args, "La soumission a été refusée.", { revalidate: ["/events"] }),
  },

  add_registration: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const hit = await resolveEvent(opStr(input, "target") || opStr(input, "name"));
      if ("error" in hit) return hit;
      const full = opStr(input, "person").trim();
      if (!full) return { error: "Précisez la personne (champ « person » — prénom et nom)." };
      const parts = full.split(/\s+/);
      const firstName = parts.length > 1 ? parts[0] : full;
      const lastName = parts.length > 1 ? parts.slice(1).join(" ") : full;
      const role = enumIn(opStr(input, "role"), REG_ROLE_FR);
      if (role && typeof role === "object") return role;
      const status = enumIn(opStr(input, "status"), REG_STATUS_FR);
      if (status && typeof status === "object") return status;
      return {
        title: `Inscrire ${full} à « ${hit.name} »`,
        fields: fieldsOf([
          ["Événement", hit.name], ["Participant", full],
          ["Rôle", role ? REG_ROLE_FR.find(([c]) => c === role)?.[1] ?? null : null],
          ["Statut", status ? REG_STATUS_FR.find(([c]) => c === status)?.[1] ?? null : "Confirmé (défaut)"],
          ["Spécialité", opStr(input, "specialty") || null],
          ["Établissement", opStr(input, "institution") || null],
        ]),
        args: {
          eventId: hit.id, firstName, lastName,
          specialty: opStr(input, "specialty") || null, institution: opStr(input, "institution") || null,
          city: opStr(input, "city") || null, email: opStr(input, "email") || null, phone: opStr(input, "phone") || null,
          role: (role as string | null), status: (status as string | null), comment: opStr(input, "notes") || null,
        },
        successMessage: `${full} inscrit·e à « ${hit.name} ».`,
        revalidate: ["/events"],
      };
    },
    execute: (args) => runFd(addRegistration, args, "L'inscription a été refusée.", { revalidate: ["/events"] }),
  },

  set_registration_status: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const hit = await resolveEvent(opStr(input, "target") || opStr(input, "name"));
      if ("error" in hit) return hit;
      const reg = await resolveRegistration(hit.id, hit.name, opStr(input, "person"));
      if ("error" in reg) return reg;
      const status = enumIn(opStr(input, "status"), REG_STATUS_FR);
      if (!status) return { error: "Précisez le statut (champ « status ») : inscrit, confirmé, liste d'attente, refusé, présent, absent, annulé." };
      if (typeof status === "object") return status;
      return {
        title: `${reg.name} → ${REG_STATUS_FR.find(([c]) => c === status)?.[1] ?? status} (${hit.name})`,
        fields: [
          { label: "Participant", value: `${reg.name} — ${hit.name}` },
          { label: "Statut", value: REG_STATUS_FR.find(([c]) => c === status)?.[1] ?? status },
        ],
        args: { id: reg.id, status },
        successMessage: `${reg.name} marqué·e « ${REG_STATUS_FR.find(([c]) => c === status)?.[1] ?? status} ».`,
        revalidate: ["/events"],
      };
    },
    execute: (args) => runFd(setRegistrationStatus, args, "Le changement de statut a été refusé.", { revalidate: ["/events"] }),
  },

  delete_registration: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const hit = await resolveEvent(opStr(input, "target") || opStr(input, "name"));
      if ("error" in hit) return hit;
      const reg = await resolveRegistration(hit.id, hit.name, opStr(input, "person"));
      if ("error" in reg) return reg;
      return {
        title: `Retirer ${reg.name} de « ${hit.name} »`,
        fields: [{ label: "Participant", value: `${reg.name} — ${hit.name}` }],
        warnings: ["L'inscription est supprimée (pas seulement annulée)."],
        args: { id: reg.id },
        successMessage: `${reg.name} retiré·e de « ${hit.name} ».`,
        revalidate: ["/events"],
      };
    },
    execute: (args) => runFd(deleteRegistration, args, "Le retrait de l'inscription a été refusé.", { revalidate: ["/events"] }),
  },
};

// ─────────────────────────── AD & PRO (sponsoring, congrès, postes) ───────────────────────────

interface SponsoringHit { id: string; reference: string; institution: string; status: string }

async function resolveSponsoring(raw: string): Promise<SponsoringHit | { error: string }> {
  const q = raw.trim();
  if (!q) return { error: "Précisez la demande de sponsoring (champ « reference » — SPO-AAAA-NNN ou institution)." };
  const exact = await prisma.sponsoringRequest.findFirst({
    where: { reference: { equals: q, mode: "insensitive" } },
    select: { id: true, reference: true, institution: true, status: true },
  });
  if (exact) return exact;
  const rows = await prisma.sponsoringRequest.findMany({
    where: { OR: [{ reference: { contains: q, mode: "insensitive" } }, { institution: { contains: q, mode: "insensitive" } }] },
    select: { id: true, reference: true, institution: true, status: true },
    orderBy: { createdAt: "desc" }, take: 6,
  });
  if (rows.length === 1) return rows[0];
  if (rows.length === 0) return { error: `Aucune demande de sponsoring « ${q} ».` };
  return { error: `Plusieurs demandes correspondent : ${rows.map((s) => `${s.reference} — ${s.institution}`).join(" ; ")} — donner la référence exacte.` };
}

/** Cible du circuit congrès / événement (JAMAIS un sponsoring — il a ses propres ops). */
async function resolveCongressTarget(kindRaw: string, labelRaw: string): Promise<(MissionParent & { congressType: string }) | { error: string }> {
  const parent = await resolveMissionParent(kindRaw || "congrès ou événement", labelRaw);
  if ("error" in parent) return parent;
  if (parent.entityType === "SPONSORING") return { error: "Un SPONSORING se décide par ses propres ops (decide_sponsoring_…)." };
  const congressType = parent.entityType === "EVENT" ? "EVENT" : parent.entityType === "CONGRESS_NATIONAL" ? "NATIONAL" : "INTL";
  return { ...parent, congressType };
}

const decisionOf = (raw: string): "APPROVE" | "REJECT" | null => {
  const k = fold(raw);
  if (/refus|rejet|reject/.test(k)) return "REJECT";
  if (/approuv|accord|valid|approve|accept/.test(k)) return "APPROVE";
  return null;
};

export const ADPRO5_OPS_IMPL: Record<string, OpImpl> = {
  decide_sponsoring_preliminary: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const req = await resolveSponsoring(opStr(input, "reference") || opStr(input, "label"));
      if ("error" in req) return req;
      const decision = decisionOf(opStr(input, "decision"));
      if (!decision) return { error: "Précisez la décision (champ « decision ») : approuver ou refuser." };
      if (decision === "REJECT" && !opStr(input, "note")) return { error: "Le motif de refus est obligatoire (champ « note »)." };
      let pmId: string | null = null; let pmName: string | null = null;
      if (decision === "APPROVE") {
        const pm = await resolvePerson(opStr(input, "person"), "le chef de produit (champ « person »)");
        if ("error" in pm) return pm;
        pmId = pm.id; pmName = pm.name;
      }
      return {
        title: `${decision === "APPROVE" ? "Valider (préliminaire)" : "REFUSER"} le sponsoring ${req.reference}`,
        fields: fieldsOf([
          ["Demande", `${req.reference} — ${req.institution}`],
          ["Chef de produit désigné", pmName],
          ["Motif / note", opStr(input, "note") || null],
        ]),
        warnings: ["Approbation préliminaire réservée au National Sales — la décision définitive reste à la Direction."],
        args: { id: req.id, decision, productManagerId: pmId, note: opStr(input, "note") || null },
        successMessage: `Sponsoring ${req.reference} ${decision === "APPROVE" ? `validé (préliminaire) — analyse confiée à ${pmName}` : "refusé"}.`,
        link: `/sponsoring/${req.id}`, revalidate: ["/sponsoring"],
      };
    },
    execute: (args) => runFd(sponsoringPreliminary, args, "La décision préliminaire a été refusée.", { revalidate: ["/sponsoring"] }),
  },

  analyze_sponsoring: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const req = await resolveSponsoring(opStr(input, "reference") || opStr(input, "label"));
      if ("error" in req) return req;
      const notes = opStr(input, "note") || opStr(input, "message");
      if (!notes) return { error: "Votre avis est obligatoire (champ « note »)." };
      const isAppeal = req.status === "APPEAL_PENDING";
      const budget = opStr(input, "amount");
      if (!isAppeal && !budget) return { error: "Le budget proposé est obligatoire (champ « amount », DZD) — sauf en appel." };
      return {
        title: `Analyse chef de produit — ${req.reference}${isAppeal ? " (APPEL)" : ""}`,
        fields: fieldsOf([
          ["Demande", `${req.reference} — ${req.institution}`],
          ["Avis", notes],
          ["Budget proposé", !isAppeal && budget ? dzd(Number(budget)) : null],
        ]),
        warnings: isAppeal ? ["En APPEL, l'avis part SANS budget — la Direction tranchera."] : ["L'analyse part à la Direction pour décision définitive."],
        args: { id: req.id, productManagerNotes: notes, productManagerBudget: isAppeal ? null : budget },
        successMessage: `Analyse de ${req.reference} transmise à la Direction.`,
        link: `/sponsoring/${req.id}`, revalidate: ["/sponsoring"],
      };
    },
    execute: (args) => runFd(sponsoringAnalysis, args, "L'analyse a été refusée.", { revalidate: ["/sponsoring"] }),
  },

  decide_sponsoring_final: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const req = await resolveSponsoring(opStr(input, "reference") || opStr(input, "label"));
      if ("error" in req) return req;
      const decision = decisionOf(opStr(input, "decision"));
      if (!decision) return { error: "Précisez la décision (champ « decision ») : accorder ou refuser." };
      const amount = opStr(input, "amount");
      if (decision === "APPROVE" && !amount) return { error: "Le budget final accordé est obligatoire (champ « amount », DZD)." };
      if (decision === "REJECT" && !opStr(input, "note")) return { error: "Le motif de refus est obligatoire (champ « note »)." };
      return {
        title: `${decision === "APPROVE" ? "ACCORDER" : "REFUSER"} définitivement le sponsoring ${req.reference}`,
        fields: fieldsOf([
          ["Demande", `${req.reference} — ${req.institution}`],
          ["Budget accordé", decision === "APPROVE" && amount ? dzd(Number(amount)) : null],
          ["Motif / note", opStr(input, "note") || null],
        ]),
        warnings: decision === "APPROVE"
          ? ["Décision de la DIRECTION — l'accord crée la déclaration d'information médicale AVANT l'ordre de dépense."]
          : ["Décision définitive de la Direction — le demandeur peut faire appel."],
        args: { id: req.id, decision, amountGranted: decision === "APPROVE" ? amount : null, note: opStr(input, "note") || null },
        successMessage: `Sponsoring ${req.reference} ${decision === "APPROVE" ? `accordé (${dzd(Number(amount))})` : "refusé (définitif)"}.`,
        link: `/sponsoring/${req.id}`, revalidate: ["/sponsoring"],
      };
    },
    execute: (args) => runFd(sponsoringFinal, args, "La décision définitive a été refusée.", { revalidate: ["/sponsoring"] }),
  },

  appeal_sponsoring: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const req = await resolveSponsoring(opStr(input, "reference") || opStr(input, "label"));
      if ("error" in req) return req;
      const reason = opStr(input, "note") || opStr(input, "message");
      if (!reason) return { error: "Précisez le motif de l'appel (champ « note »)." };
      return {
        title: `Faire APPEL sur le sponsoring ${req.reference}`,
        fields: [
          { label: "Demande", value: `${req.reference} — ${req.institution}` },
          { label: "Motif de l'appel", value: reason },
        ],
        warnings: ["L'appel rouvre le circuit : nouvel avis du chef de produit (sans budget), puis décision de la Direction."],
        args: { id: req.id, reason },
        successMessage: `Appel enregistré sur ${req.reference} — le chef de produit réexamine.`,
        link: `/sponsoring/${req.id}`, revalidate: ["/sponsoring"],
      };
    },
    execute: (args) => runFd(sponsoringAppeal, args, "L'appel a été refusé.", { revalidate: ["/sponsoring"] }),
  },

  involve_third_party: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const person = await resolvePerson(opStr(input, "person"), "la personne à impliquer (champ « person »)");
      if ("error" in person) return person;
      const kindRaw = opStr(input, "kind");
      if (/sponsor/i.test(kindRaw) || (!kindRaw && opStr(input, "reference").toUpperCase().startsWith("SPO-"))) {
        const req = await resolveSponsoring(opStr(input, "reference") || opStr(input, "target"));
        if ("error" in req) return req;
        return {
          title: `Impliquer ${person.name} — sponsoring ${req.reference}`,
          fields: fieldsOf([
            ["Demande", `${req.reference} — ${req.institution}`],
            ["Personne", person.name], ["Note", opStr(input, "note") || null],
          ]),
          warnings: ["La personne reçoit une demande de validation dans SON espace (sans budget, sans accès au module)."],
          args: { id: req.id, personId: person.id, note: opStr(input, "note") || null, sponsoring: "1" },
          successMessage: `${person.name} impliqué·e sur ${req.reference}.`,
          revalidate: ["/sponsoring"],
        };
      }
      const target = await resolveCongressTarget(kindRaw, opStr(input, "target") || opStr(input, "reference"));
      if ("error" in target) return target;
      return {
        title: `Impliquer ${person.name} — ${target.label}`,
        fields: fieldsOf([
          ["Cible", target.label], ["Personne", person.name], ["Note", opStr(input, "note") || null],
        ]),
        warnings: ["La personne reçoit une demande de validation dans SON espace (sans budget, sans accès au module)."],
        args: { id: target.entityId, type: target.congressType, personId: person.id, note: opStr(input, "note") || null, sponsoring: null },
        successMessage: `${person.name} impliqué·e sur ${target.label}.`,
        revalidate: ["/events"],
      };
    },
    async execute(args) {
      const fd = new FormData();
      fd.set("id", args.id ?? "");
      fd.set("personId", args.personId ?? "");
      if (args.note) fd.set("note", args.note);
      if (args.sponsoring === "1") {
        const r = await sponsoringThirdParty(fd);
        if (!r.ok) return { ok: false, error: r.error ?? "L'implication a été refusée." };
        return { ok: true, revalidate: ["/sponsoring"] };
      }
      fd.set("type", args.type ?? "INTL");
      const r = await congressThirdParty(fd);
      if (!r.ok) return { ok: false, error: r.error ?? "L'implication a été refusée." };
      return { ok: true, revalidate: ["/events"] };
    },
  },

  decide_congress_preliminary: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const target = await resolveCongressTarget(opStr(input, "kind"), opStr(input, "target") || opStr(input, "reference"));
      if ("error" in target) return target;
      const decision = decisionOf(opStr(input, "decision"));
      if (!decision) return { error: "Précisez la décision (champ « decision ») : approuver ou refuser." };
      if (decision === "REJECT" && !opStr(input, "note")) return { error: "Le motif de refus est obligatoire (champ « note »)." };
      let pmId: string | null = null; let pmName: string | null = null;
      if (decision === "APPROVE") {
        const pm = await resolvePerson(opStr(input, "person"), "le chef de produit (champ « person »)");
        if ("error" in pm) return pm;
        pmId = pm.id; pmName = pm.name;
      }
      return {
        title: `${decision === "APPROVE" ? "Valider (préliminaire)" : "REFUSER"} — ${target.label}`,
        fields: fieldsOf([
          ["Demande", target.label], ["Chef de produit désigné", pmName], ["Motif / note", opStr(input, "note") || null],
        ]),
        warnings: ["Approbation préliminaire réservée au National Sales."],
        args: { id: target.entityId, type: target.congressType, decision, productManagerId: pmId, note: opStr(input, "note") || null },
        successMessage: `${target.label} : ${decision === "APPROVE" ? `validé (préliminaire) — analyse confiée à ${pmName}` : "refusé"}.`,
        revalidate: ["/events"],
      };
    },
    execute: (args) => runFd(preliminaryDecision, args, "La décision préliminaire a été refusée.", { revalidate: ["/events"] }),
  },

  analyze_congress: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const target = await resolveCongressTarget(opStr(input, "kind"), opStr(input, "target") || opStr(input, "reference"));
      if ("error" in target) return target;
      const reject = decisionOf(opStr(input, "decision")) === "REJECT";
      const notes = opStr(input, "note") || opStr(input, "message");
      if (reject && !notes) return { error: "Indiquez le motif du refus (champ « note »)." };
      return {
        title: `Analyse chef de produit — ${target.label}${reject ? " (REFUS)" : ""}`,
        fields: fieldsOf([
          ["Demande", target.label],
          ["Avis", notes || null],
          ["Budget proposé", !reject && opStr(input, "amount") ? dzd(Number(opStr(input, "amount"))) : null],
        ]),
        warnings: reject ? [] : ["Le budget proposé est FACULTATIF — la Direction tranchera le montant."],
        args: {
          id: target.entityId, type: target.congressType, decision: reject ? "REJECT" : "APPROVE",
          productManagerNotes: notes || null, productManagerBudget: reject ? null : (opStr(input, "amount") || null),
          note: notes || null,
        },
        successMessage: reject ? `${target.label} refusé par le chef de produit.` : `Analyse de ${target.label} transmise à la Direction.`,
        revalidate: ["/events"],
      };
    },
    execute: (args) => runFd(submitProductAnalysis, args, "L'analyse a été refusée.", { revalidate: ["/events"] }),
  },

  decide_congress_final: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const target = await resolveCongressTarget(opStr(input, "kind"), opStr(input, "target") || opStr(input, "reference"));
      if ("error" in target) return target;
      const decision = decisionOf(opStr(input, "decision"));
      if (!decision) return { error: "Précisez la décision (champ « decision ») : accorder ou refuser." };
      const amount = opStr(input, "amount");
      if (decision === "APPROVE" && !amount) return { error: "Le montant accordé est obligatoire (champ « amount », DZD)." };
      if (decision === "REJECT" && !opStr(input, "note")) return { error: "Le motif de refus est obligatoire (champ « note »)." };
      return {
        title: `${decision === "APPROVE" ? "VALIDER définitivement" : "REFUSER"} — ${target.label}`,
        fields: fieldsOf([
          ["Demande", target.label],
          ["Montant accordé", decision === "APPROVE" && amount ? dzd(Number(amount)) : null],
          ["Motif / note", opStr(input, "note") || null],
        ]),
        warnings: decision === "APPROVE"
          ? ["Décision de la DIRECTION — déclenche l'information médicale (si pharmacien configuré) ou l'ordre de dépense direct."]
          : [],
        args: { id: target.entityId, type: target.congressType, decision, finalAmount: decision === "APPROVE" ? amount : null, note: opStr(input, "note") || null },
        successMessage: `${target.label} : ${decision === "APPROVE" ? `validé (${dzd(Number(amount))})` : "refusé (définitif)"}.`,
        revalidate: ["/events"],
      };
    },
    execute: (args) => runFd(finalDecision, args, "La décision définitive a été refusée.", { revalidate: ["/events"] }),
  },

  update_congress_budget: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const target = await resolveCongressTarget(opStr(input, "kind"), opStr(input, "target") || opStr(input, "reference"));
      if ("error" in target) return target;
      const amount = opStr(input, "amount");
      if (!amount || Number(amount) <= 0) return { error: "Précisez le nouveau montant accordé (champ « amount », DZD)." };
      return {
        title: `Modifier le budget accordé — ${target.label}`,
        fields: [
          { label: "Demande", value: target.label },
          { label: "Nouveau montant", value: dzd(Number(amount)) },
        ],
        warnings: ["Répercuté sur la déclaration d'information médicale (si pas validée) ET l'ordre de dépense (s'il n'est pas réglé) — les Finances sont prévenues."],
        args: { id: target.entityId, type: target.congressType, finalAmount: amount },
        successMessage: `Budget de ${target.label} porté à ${dzd(Number(amount))}.`,
        revalidate: ["/events"],
      };
    },
    execute: (args) => runFd(updateGrantedBudget, args, "La modification du budget a été refusée.", { revalidate: ["/events"] }),
  },

  cancel_congress_request: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const target = await resolveCongressTarget(opStr(input, "kind"), opStr(input, "target") || opStr(input, "reference"));
      if ("error" in target) return target;
      return {
        title: `Annuler la demande — ${target.label}`,
        fields: [{ label: "Demande", value: target.label }],
        warnings: ["Une demande déjà VALIDÉE ne s'annule plus par ce geste (l'action refuse)."],
        args: { id: target.entityId, type: target.congressType },
        successMessage: `Demande ${target.label} annulée.`,
        revalidate: ["/events"],
      };
    },
    execute: (args) => runFd(cancelCongressRequest, args, "L'annulation a été refusée.", { revalidate: ["/events"] }),
  },

  add_congress_beneficiary: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const target = await resolveCongressTarget(opStr(input, "kind") || "congrès", opStr(input, "target") || opStr(input, "reference"));
      if ("error" in target) return target;
      if (target.congressType === "EVENT") return { error: "Les personnes prises en charge se gèrent sur les CONGRÈS (national / international)." };
      const raw = opStr(input, "person");
      if (!raw) return { error: "Précisez la personne (champ « person » — nom de l'annuaire, ou nom libre)." };
      const doctors = await prisma.medicalDoctor.findMany({
        where: { name: { contains: raw, mode: "insensitive" } }, select: { id: true, name: true }, take: 4,
      });
      const doctor = doctors.length === 1 ? doctors[0] : null;
      if (doctors.length > 1) return { error: `Plusieurs praticiens correspondent : ${doctors.map((d) => d.name).join(", ")} — préciser (ou donner un nom libre plus complet).` };
      return {
        title: `Prendre en charge ${doctor?.name ?? raw} — ${target.label}`,
        fields: fieldsOf([
          ["Congrès", target.label],
          ["Personne", doctor ? `${doctor.name} (annuaire)` : `${raw} (nom libre)`],
          ["Rôle", opStr(input, "role") || null],
        ]),
        args: {
          id: target.entityId, kind: target.congressType === "NATIONAL" ? "NATIONAL" : "INTERNATIONAL",
          doctorId: doctor?.id ?? null, name: doctor ? null : raw, role: opStr(input, "role") || null,
        },
        successMessage: `${doctor?.name ?? raw} ajouté·e aux personnes prises en charge (${target.label}).`,
        revalidate: ["/events"],
      };
    },
    execute: (args) => runFd(addCongressBeneficiary, args, "L'ajout a été refusé.", { revalidate: ["/events"] }),
  },

  remove_congress_beneficiary: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const target = await resolveCongressTarget(opStr(input, "kind") || "congrès", opStr(input, "target") || opStr(input, "reference"));
      if ("error" in target) return target;
      if (target.congressType === "EVENT") return { error: "Les personnes prises en charge se gèrent sur les CONGRÈS (national / international)." };
      const raw = fold(opStr(input, "person"));
      if (!raw) return { error: "Précisez la personne (champ « person »)." };
      const c = target.congressType === "NATIONAL"
        ? await prisma.congressNational.findUnique({ where: { id: target.entityId }, select: { beneficiaries: true } })
        : await prisma.congressInternational.findUnique({ where: { id: target.entityId }, select: { beneficiaries: true } });
      const list = Array.isArray(c?.beneficiaries) ? (c.beneficiaries as { id: string; name: string }[]) : [];
      const hits = list.filter((b) => fold(b.name).includes(raw));
      if (hits.length === 0) return { error: `Aucune personne « ${opStr(input, "person")} » prise en charge sur ${target.label}${list.length ? ` — présentes : ${list.map((b) => b.name).join(", ")}` : ""}.` };
      if (hits.length > 1) return { error: `Plusieurs personnes correspondent : ${hits.map((b) => b.name).join(", ")} — préciser.` };
      return {
        title: `Retirer ${hits[0].name} des personnes prises en charge`,
        fields: [{ label: "Personne", value: `${hits[0].name} — ${target.label}` }],
        args: { id: target.entityId, kind: target.congressType === "NATIONAL" ? "NATIONAL" : "INTERNATIONAL", benefId: hits[0].id },
        successMessage: `${hits[0].name} retiré·e de la prise en charge.`,
        revalidate: ["/events"],
      };
    },
    execute: (args) => runFd(removeCongressBeneficiary, args, "Le retrait a été refusé.", { revalidate: ["/events"] }),
  },

  request_beneficiary_ids: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const target = await resolveCongressTarget(opStr(input, "kind") || "congrès", opStr(input, "target") || opStr(input, "reference"));
      if ("error" in target) return target;
      if (target.congressType === "EVENT") return { error: "Les pièces d'identité se demandent sur les CONGRÈS (national / international)." };
      return {
        title: `Demander les pièces d'identité — ${target.label}`,
        fields: [{ label: "Congrès", value: target.label }],
        warnings: ["Le DEMANDEUR du congrès est notifié : il joint les pièces d'identité des personnes prises en charge."],
        args: { id: target.entityId, kind: target.congressType === "NATIONAL" ? "NATIONAL" : "INTERNATIONAL" },
        successMessage: `Pièces d'identité demandées au demandeur (${target.label}).`,
        revalidate: ["/events"],
      };
    },
    execute: (args) => runFd(requestBeneficiaryIds, args, "La demande a été refusée.", { revalidate: ["/events"] }),
  },

  add_item: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const parent = await resolveMissionParent(opStr(input, "kind"), opStr(input, "target") || opStr(input, "reference"));
      if ("error" in parent) return parent;
      const label = opStr(input, "label") || opStr(input, "name");
      if (!label) return { error: "Précisez le libellé du poste (champ « label »)." };
      const additional = /rallonge|suppl[ée]ment|en plus|additional/i.test(opStr(input, "mode"));
      return {
        title: `Ajouter le poste « ${label} » — ${parent.label}`,
        fields: fieldsOf([
          ["Opération", parent.label], ["Poste", label],
          ["Budget", additional ? "RALLONGE (en plus du budget accordé)" : "Inclus dans le budget accordé"],
          ["Estimation", opStr(input, "amount") ? dzd(Number(opStr(input, "amount"))) : null],
          ["Prestataire", opStr(input, "supplier") || null],
        ]),
        args: {
          parent: parent.entityType, parentId: parent.entityId, label,
          amountEstimated: opStr(input, "amount") || null, supplier: opStr(input, "supplier") || null,
          budgetKind: additional ? "ADDITIONAL" : null, notes: opStr(input, "notes") || null,
        },
        successMessage: `Poste « ${label} » ajouté à ${parent.label}.`,
        revalidate: ["/sponsoring"],
      };
    },
    execute: (args) => runFd2(addAdProItem, args, "L'ajout du poste a été refusé.", { revalidate: ["/sponsoring"] }),
  },

  update_item: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const found = await resolveItem(input);
      if ("error" in found) return found;
      const updates = fieldsOf([
        ["Libellé", opStr(input, "newName") || null],
        ["Estimation", opStr(input, "amount") ? dzd(Number(opStr(input, "amount"))) : null],
        ["Montant AFFECTÉ (Direction)", opStr(input, "grantedAmount") ? dzd(Number(opStr(input, "grantedAmount"))) : null],
        ["Prestataire", opStr(input, "supplier") || null],
        ["Notes", opStr(input, "notes") || null],
      ]);
      if (updates.length === 0) return { error: "Rien à changer : donnez newName, amount (estimation), grantedAmount (Direction), supplier ou notes." };
      return {
        title: `Modifier le poste « ${found.label} » (${found.parentLabel})`,
        fields: [{ label: "Poste", value: `${found.label} — ${found.parentLabel}` }, ...updates],
        warnings: opStr(input, "grantedAmount") ? ["Le montant AFFECTÉ engage l'argent : geste de la Direction — refusé si un ordre de dépense est déjà émis."] : [],
        args: {
          id: found.id, label: opStr(input, "newName") || null,
          amountEstimated: opStr(input, "amount") || null,
          amountGranted: opStr(input, "grantedAmount") || null,
          supplier: opStr(input, "supplier") || null, notes: opStr(input, "notes") || null,
        },
        successMessage: `Poste « ${opStr(input, "newName") || found.label} » modifié.`,
        revalidate: ["/sponsoring"],
      };
    },
    async execute(args) {
      const fd = new FormData();
      fd.set("id", args.id ?? "");
      if (args.label) fd.set("label", args.label);
      if (args.amountEstimated) fd.set("amountEstimated", args.amountEstimated);
      if (args.amountGranted) fd.set("amountGranted", args.amountGranted);
      if (args.supplier) fd.set("supplier", args.supplier);
      if (args.notes) fd.set("notes", args.notes);
      const r = await updateAdProItem(undefined, fd);
      if (!r.ok) return { ok: false, error: r.error ?? "La modification du poste a été refusée." };
      return { ok: true, revalidate: ["/sponsoring"] };
    },
  },

  delete_item: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const found = await resolveItem(input);
      if ("error" in found) return found;
      return {
        title: `SUPPRIMER le poste « ${found.label} » (${found.parentLabel})`,
        fields: [{ label: "Poste", value: `${found.label} — ${found.parentLabel}` }],
        warnings: ["Un poste dont l'ordre de dépense est émis n'est retirable que par la DIRECTION — l'ordre est alors ANNULÉ (trace comptable conservée) ; un matériel promo rattaché est conservé."],
        confirmText: found.label,
        args: { id: found.id },
        successMessage: `Poste « ${found.label} » retiré.`,
        revalidate: ["/sponsoring"],
      };
    },
    execute: (args) => runFd2(deleteAdProItem, args, "La suppression du poste a été refusée.", { revalidate: ["/sponsoring"] }),
  },

  submit_item: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const found = await resolveItem(input);
      if ("error" in found) return found;
      return {
        title: `Soumettre le poste « ${found.label} » à la Direction`,
        fields: fieldsOf([["Poste", `${found.label} — ${found.parentLabel}`], ["Note", opStr(input, "note") || null]]),
        warnings: ["La Direction accorde, refuse, ou demande à revoir le budget — chaque tour reste dans l'historique."],
        args: { id: found.id, note: opStr(input, "note") || null },
        successMessage: `Poste « ${found.label} » soumis à la Direction.`,
        revalidate: ["/sponsoring"],
      };
    },
    execute: (args) => runFd2(submitAdProItem, args, "La soumission du poste a été refusée.", { revalidate: ["/sponsoring"] }),
  },

  set_item_budget: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const found = await resolveItem(input);
      if ("error" in found) return found;
      const catRaw = opStr(input, "category");
      const clearing = /^(aucune?|retire)$/i.test(catRaw);
      let categoryId: string | null = null; let categoryLabel = "— (imputation retirée)";
      if (!clearing) {
        if (!catRaw) return { error: "Précisez la (sous-)catégorie budgétaire (champ « category » — « aucune » pour retirer l'imputation)." };
        const cats = await prisma.budgetCategoryLine.findMany({
          where: { name: { contains: catRaw, mode: "insensitive" } },
          select: { id: true, name: true, envelope: { select: { name: true } } }, take: 6,
        });
        if (cats.length === 0) return { error: `Aucune catégorie budgétaire « ${catRaw} ».` };
        if (cats.length > 1) return { error: `Plusieurs catégories correspondent : ${cats.map((c) => `${c.envelope.name} › ${c.name}`).join(" ; ")} — préciser.` };
        categoryId = cats[0].id; categoryLabel = `${cats[0].envelope.name} › ${cats[0].name}`;
      }
      return {
        title: `Imputer « ${found.label} » au budget ${categoryLabel}`,
        fields: [
          { label: "Poste", value: `${found.label} — ${found.parentLabel}` },
          { label: "Budget", value: categoryLabel },
        ],
        warnings: ["Geste de la DIRECTION, sur un poste ACCORDÉ — le budget choisi suit la dépense jusqu'aux Finances."],
        args: { id: found.id, budgetCategoryId: categoryId },
        successMessage: clearing ? `Imputation du poste « ${found.label} » retirée.` : `Poste « ${found.label} » imputé à ${categoryLabel}.`,
        revalidate: ["/sponsoring"],
      };
    },
    execute: (args) => runFd2(setAdProItemBudget, args, "L'imputation a été refusée.", { revalidate: ["/sponsoring"] }),
  },

  request_item_quote: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const found = await resolveItem(input);
      if ("error" in found) return found;
      return {
        title: `Demander le devis du poste « ${found.label} » au secrétariat`,
        fields: fieldsOf([["Poste", `${found.label} — ${found.parentLabel}`], ["Précision", opStr(input, "note") || null]]),
        warnings: ["Ouvre une DEMANDE ADMINISTRATIVE (Bureau du secrétariat) — les devis déposés y seront joints au poste."],
        args: { id: found.id, note: opStr(input, "note") || null },
        successMessage: `Demande de devis ouverte pour « ${found.label} ».`,
        revalidate: ["/sponsoring", "/demandes"],
      };
    },
    execute: (args) => runFd2(requestAdProItemQuote, args, "La demande de devis a été refusée.", { revalidate: ["/sponsoring"] }),
  },

  request_item_order: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const found = await resolveItem(input);
      if ("error" in found) return found;
      return {
        title: `Demander l'émission du bon de commande — « ${found.label} »`,
        fields: fieldsOf([["Poste", `${found.label} — ${found.parentLabel}`], ["Note", opStr(input, "note") || null]]),
        warnings: ["Première marche du circuit : demande → VISA Direction → émission par les Finances. Exige un poste accordé, un montant affecté et une imputation budgétaire."],
        args: { id: found.id, note: opStr(input, "note") || null },
        successMessage: `Émission du bon de commande demandée pour « ${found.label} » — au visa de la Direction.`,
        revalidate: ["/sponsoring"],
      };
    },
    execute: (args) => runFd2(requestAdProItemOrder, args, "La demande d'émission a été refusée.", { revalidate: ["/sponsoring"] }),
  },

  approve_item_order: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const found = await resolveItem(input);
      if ("error" in found) return found;
      const refuse = decisionOf(opStr(input, "decision")) === "REJECT";
      return {
        title: `${refuse ? "REFUSER" : "VISER"} le bon de commande — « ${found.label} »`,
        fields: fieldsOf([["Poste", `${found.label} — ${found.parentLabel}`], ["Note", opStr(input, "note") || null]]),
        warnings: refuse ? [] : ["Visa de la DIRECTION — les Finances émettent ensuite l'ordre de dépense."],
        args: { id: found.id, decision: refuse ? "REFUSE" : "APPROVE", note: opStr(input, "note") || null },
        successMessage: refuse ? `Émission refusée pour « ${found.label} ».` : `Bon de commande visé — transmis aux Finances.`,
        revalidate: ["/sponsoring"],
      };
    },
    execute: (args) => runFd2(approveAdProItemOrder, args, "Le visa a été refusé.", { revalidate: ["/sponsoring"] }),
  },

  emit_item_order: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const found = await resolveItem(input);
      if ("error" in found) return found;
      return {
        title: `ÉMETTRE l'ordre de dépense du poste « ${found.label} »`,
        fields: [{ label: "Poste", value: `${found.label} — ${found.parentLabel}` }],
        warnings: ["Geste des FINANCES, après visa Direction — un ordre PAR poste (les bénéficiaires diffèrent réellement)."],
        args: { id: found.id },
        successMessage: `Ordre de dépense émis pour « ${found.label} ».`,
        revalidate: ["/sponsoring", "/finances/paiements-a-faire"],
      };
    },
    execute: (args) => runFd2(emitItemExpenseOrder, args, "L'émission a été refusée.", { revalidate: ["/sponsoring"] }),
  },

  link_item_promo_material: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const found = await resolveItem(input);
      if ("error" in found) return found;
      const pmRaw = opStr(input, "material");
      const clearing = /^(aucun|retire|d[ée]tache)/i.test(pmRaw);
      let pmId: string | null = null; let pmLabel = "— (détaché)";
      if (!clearing) {
        if (!pmRaw) return { error: "Précisez le matériel promotionnel (champ « material » — MP-… ou titre ; « aucun » pour détacher)." };
        const mats = await prisma.promoMaterial.findMany({
          where: { OR: [{ reference: { contains: pmRaw, mode: "insensitive" } }, { title: { contains: pmRaw, mode: "insensitive" } }], status: { not: "CANCELLED" } },
          select: { id: true, reference: true, title: true }, take: 6,
        });
        if (mats.length === 0) return { error: `Aucun matériel promotionnel « ${pmRaw} ».` };
        if (mats.length > 1) return { error: `Plusieurs matériels correspondent : ${mats.map((m) => `${m.reference} — ${m.title}`).join(" ; ")} — préciser.` };
        pmId = mats[0].id; pmLabel = `${mats[0].reference} — ${mats[0].title}`;
      }
      return {
        title: clearing ? `Détacher « ${found.label} » de son matériel promotionnel` : `Rattacher « ${found.label} » au matériel ${pmLabel}`,
        fields: [
          { label: "Poste", value: `${found.label} — ${found.parentLabel}` },
          { label: "Matériel", value: pmLabel },
        ],
        warnings: clearing ? [] : ["On RATTACHE, on ne recopie pas : le matériel garde son propre circuit (visa, conformité, agence, BAT)."],
        args: { id: found.id, promoMaterialId: pmId },
        successMessage: clearing ? `Poste « ${found.label} » détaché.` : `Poste « ${found.label} » rattaché à ${pmLabel}.`,
        revalidate: ["/sponsoring"],
      };
    },
    execute: (args) => runFd2(linkPromoMaterial, args, "Le rattachement a été refusé.", { revalidate: ["/sponsoring"] }),
  },

  create_other_request: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const title = opStr(input, "label") || opStr(input, "name");
      if (!title) return { error: "Précisez l'objet de la demande (champ « label »)." };
      const description = opStr(input, "notes") || opStr(input, "message");
      if (!description) return { error: "Décrivez la demande (champ « notes ») — c'est sur cette description que la décision se prendra." };
      return {
        title: `Demande Ad & Pro « autre » — ${title}`,
        fields: fieldsOf([
          ["Objet", title], ["Description", description],
          ["Bénéficiaire", opStr(input, "person") || null],
          ["Montant", opStr(input, "amount") ? dzd(Number(opStr(input, "amount"))) : null],
        ]),
        warnings: ["La demande part directement à la DIRECTION (référence automatique)."],
        args: { title, description, beneficiary: opStr(input, "person") || null, amount: opStr(input, "amount") || null },
        successMessage: `Demande « ${title} » créée — à la décision de la Direction.`,
        revalidate: ["/ad-pro"],
      };
    },
    execute: (args) => runFd2(createAdProOtherRequest, args, "La création a été refusée.", { revalidate: ["/ad-pro"] }),
  },

  decide_other_request: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const req = await resolveOther(opStr(input, "reference") || opStr(input, "label"));
      if ("error" in req) return req;
      const decision = decisionOf(opStr(input, "decision"));
      if (!decision) return { error: "Précisez la décision (champ « decision ») : valider ou refuser." };
      return {
        title: `${decision === "APPROVE" ? "Valider" : "REFUSER"} la demande ${req.reference}`,
        fields: fieldsOf([["Demande", `${req.reference} — ${req.title}`], ["Motif / note", opStr(input, "note") || null]]),
        args: { id: req.id, approve: decision === "APPROVE" ? "1" : "0", note: opStr(input, "note") || null },
        successMessage: `Demande ${req.reference} ${decision === "APPROVE" ? "validée" : "refusée"}.`,
        revalidate: ["/ad-pro"],
      };
    },
    execute: (args) => runFd(decideAdProOtherRequest, args, "La décision a été refusée.", { revalidate: ["/ad-pro"] }),
  },

  close_other_request: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const req = await resolveOther(opStr(input, "reference") || opStr(input, "label"));
      if ("error" in req) return req;
      const cancel = /annul/i.test(opStr(input, "decision")) || /annul/i.test(opStr(input, "mode"));
      return {
        title: `${cancel ? "Annuler" : "Marquer terminée"} la demande ${req.reference}`,
        fields: [{ label: "Demande", value: `${req.reference} — ${req.title}` }],
        warnings: cancel ? [] : ["Seule une demande VALIDÉE se marque terminée."],
        args: { id: req.id, cancel: cancel ? "1" : null },
        successMessage: `Demande ${req.reference} ${cancel ? "annulée" : "terminée"}.`,
        revalidate: ["/ad-pro"],
      };
    },
    execute: (args) => runFd(closeAdProOtherRequest, args, "L'opération a été refusée.", { revalidate: ["/ad-pro"] }),
  },

  correct_request: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const parent = await resolveMissionParent(opStr(input, "kind"), opStr(input, "target") || opStr(input, "reference"));
      if ("error" in parent) return parent;
      const kind = parent.entityType === "EVENT" ? "EVENT" : parent.entityType;
      const updates: [string, string][] = [];
      for (const [inputKey, formKey] of CORRECTABLE_FIELDS) {
        const v = opStr(input, inputKey);
        if (v) updates.push([formKey, v]);
      }
      const shown = fieldsOf(CORRECTABLE_FIELDS.map(([inputKey, , label]) => [label, opStr(input, inputKey) || null] as [string, string | null]));
      if (updates.length === 0) return { error: "Rien à corriger : donnez city, specialty, products, notes (description), amount (montant demandé) ou startDate/endDate." };
      return {
        title: `Corriger la fiche — ${parent.label}`,
        fields: [{ label: "Demande", value: parent.label }, ...shown],
        warnings: ["Liste blanche de l'écran : les DÉCISIONS (montant accordé, statut, chef de produit) ne passent JAMAIS par ici ; après décision, seule la Direction corrige."],
        args: { kind, id: parent.entityId, ...Object.fromEntries(updates) },
        successMessage: `Fiche de ${parent.label} corrigée.`,
        revalidate: ["/sponsoring", "/events"],
      };
    },
    async execute(args) {
      const fd = new FormData();
      for (const [k, v] of Object.entries(args)) if (v != null) fd.set(k, v);
      const r = await updateAdProRequest(fd);
      if (!r.ok) return { ok: false, error: r.error ?? "La correction a été refusée." };
      return { ok: true, revalidate: ["/sponsoring", "/events"] };
    },
  },
};

/** Champs corrigeables (entrée op → champ formulaire → libellé) — liste blanche côté action. */
const CORRECTABLE_FIELDS: [string, string, string][] = [
  ["city", "city", "Ville"], ["specialty", "specialty", "Spécialité"],
  ["products", "products", "Produits"], ["notes", "description", "Description"],
  ["amount", "amountRequested", "Montant demandé"],
  ["startDate", "startDate", "Début"], ["endDate", "endDate", "Fin"],
];

interface ItemHit { id: string; label: string; parentLabel: string }

async function resolveItem(input: Record<string, unknown>): Promise<ItemHit | { error: string }> {
  const parent = await resolveMissionParent(opStr(input, "kind"), opStr(input, "target") || opStr(input, "reference"));
  if ("error" in parent) return parent;
  const column = parent.entityType === "SPONSORING" ? "sponsoringId"
    : parent.entityType === "CONGRESS_NATIONAL" ? "congressNationalId"
    : parent.entityType === "CONGRESS_INTERNATIONAL" ? "congressInternationalId" : "eventId";
  const rows = await prisma.adProItem.findMany({
    where: { [column]: parent.entityId }, select: { id: true, label: true }, orderBy: { position: "asc" }, take: 30,
  });
  if (rows.length === 0) return { error: `${parent.label} n'a aucun poste de dépense.` };
  const q = fold(opStr(input, "label") || opStr(input, "name"));
  if (!q) {
    if (rows.length === 1) return { id: rows[0].id, label: rows[0].label, parentLabel: parent.label };
    return { error: `Précisez le poste (champ « label ») parmi : ${rows.map((r) => r.label).join(" ; ")}.` };
  }
  const hits = rows.filter((r) => fold(r.label).includes(q));
  if (hits.length === 1) return { id: hits[0].id, label: hits[0].label, parentLabel: parent.label };
  if (hits.length === 0) return { error: `Aucun poste « ${opStr(input, "label")} » sur ${parent.label} — postes : ${rows.map((r) => r.label).join(" ; ")}.` };
  return { error: `Plusieurs postes correspondent : ${hits.map((r) => r.label).join(" ; ")} — préciser.` };
}

const resolveOther = (raw: string) =>
  resolveOne(raw, "la demande « autre » (champ « reference » — AUT-… ou objet)",
    (q) => prisma.adProOtherRequest.findMany({
      where: { OR: [{ reference: { contains: q, mode: "insensitive" } }, { title: { contains: q, mode: "insensitive" } }] },
      select: { id: true, reference: true, title: true }, orderBy: { createdAt: "desc" }, take: 6,
    }),
    (r) => `${r.reference} — ${r.title}`);

// ─────────────────────────── CONSULTING ───────────────────────────

const resolveContract = (raw: string) =>
  resolveOne(raw, "le contrat de consulting (champ « reference » — CONS-…, intitulé ou consultant)",
    (q) => prisma.consultingContract.findMany({
      where: { OR: [{ reference: { contains: q, mode: "insensitive" } }, { title: { contains: q, mode: "insensitive" } }, { counterparty: { contains: q, mode: "insensitive" } }] },
      select: { id: true, reference: true, title: true, counterparty: true, status: true },
      orderBy: { createdAt: "desc" }, take: 6,
    }),
    (c) => `${c.reference} — ${c.title} (${c.counterparty})`);

async function resolveContractTask(contractId: string, contractLabel: string, raw: string) {
  const rows = await prisma.consultingTask.findMany({
    where: { contractId }, select: { id: true, label: true, doneAt: true }, orderBy: { position: "asc" }, take: 30,
  });
  if (rows.length === 0) return { error: `Le contrat ${contractLabel} n'a aucune tâche attendue.` } as const;
  const q = fold(raw);
  if (!q) {
    if (rows.length === 1) return rows[0];
    return { error: `Précisez la tâche (champ « label ») parmi : ${rows.map((t) => t.label).join(" ; ")}.` } as const;
  }
  const hits = rows.filter((t) => fold(t.label).includes(q));
  if (hits.length === 1) return hits[0];
  if (hits.length === 0) return { error: `Aucune tâche « ${raw} » sur ${contractLabel} — tâches : ${rows.map((t) => t.label).join(" ; ")}.` } as const;
  return { error: `Plusieurs tâches correspondent : ${hits.map((t) => t.label).join(" ; ")} — préciser.` } as const;
}

export const CONSULTING_OPS_IMPL: Record<string, OpImpl> = {
  create_contract: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const title = opStr(input, "label") || opStr(input, "name");
      if (!title) return { error: "Précisez l'intitulé du contrat (champ « label »)." };
      const counterparty = opStr(input, "counterparty") || opStr(input, "person");
      if (!counterparty) return { error: "Indiquez le consultant ou le cabinet (champ « counterparty ») — un contrat a deux parties." };
      const tasks = opStr(input, "tasks").split(/[;,\n]/).map((t) => t.trim()).filter(Boolean);
      return {
        title: `Contrat de consulting — ${title} (${counterparty})`,
        fields: fieldsOf([
          ["Intitulé", title], ["Consultant / cabinet", counterparty],
          ["Périmètre", opStr(input, "notes") || null],
          ["Début", isoDate(opStr(input, "startDate"))], ["Fin", isoDate(opStr(input, "endDate"))],
          ["Montant", opStr(input, "amount") ? dzd(Number(opStr(input, "amount"))) : null],
          ["Tâches attendues", tasks.length ? tasks.join(" · ") : null],
        ]),
        warnings: ["Le contrat naît en BROUILLON (référence CONS- automatique) — il se soumet ensuite à validation."],
        args: {
          title, counterparty, scope: opStr(input, "notes") || null,
          startDate: isoDate(opStr(input, "startDate")), endDate: isoDate(opStr(input, "endDate")),
          amount: opStr(input, "amount") || null, paymentTerms: opStr(input, "paymentTerms") || null,
          tasks: tasks.join("\n") || null,
        },
        successMessage: `Contrat « ${title} » créé (brouillon).`,
        link: "/consulting", revalidate: ["/consulting"],
      };
    },
    execute: (args) => runFd2(createConsultingContract, args, "La création du contrat a été refusée.", { revalidate: ["/consulting"] }),
  },

  submit_contract: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const c = await resolveContract(opStr(input, "reference") || opStr(input, "label"));
      if ("error" in c) return c;
      let validatorId: string | null = null; let validatorName: string | null = null;
      if (opStr(input, "person")) {
        const v = await resolvePerson(opStr(input, "person"), "le validateur (champ « person »)");
        if ("error" in v) return v;
        validatorId = v.id; validatorName = v.name;
      }
      return {
        title: `Soumettre le contrat ${c.reference} à validation`,
        fields: fieldsOf([
          ["Contrat", `${c.reference} — ${c.title} (${c.counterparty})`],
          ["Validateur désigné", validatorName ?? "Direction (défaut)"],
        ]),
        warnings: ["La désignation ne crée pas le droit : le validateur doit déjà avoir VALIDATE sur Consulting."],
        args: { id: c.id, validatorId },
        successMessage: `Contrat ${c.reference} soumis${validatorName ? ` à ${validatorName}` : " à la Direction"}.`,
        revalidate: ["/consulting"],
      };
    },
    execute: (args) => runFd(requestConsultingValidation, args, "La soumission a été refusée.", { revalidate: ["/consulting"] }),
  },

  decide_contract: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const c = await resolveContract(opStr(input, "reference") || opStr(input, "label"));
      if ("error" in c) return c;
      const decision = decisionOf(opStr(input, "decision"));
      if (!decision) return { error: "Précisez la décision (champ « decision ») : valider ou refuser." };
      return {
        title: `${decision === "APPROVE" ? "VALIDER (activer)" : "REFUSER"} le contrat ${c.reference}`,
        fields: fieldsOf([["Contrat", `${c.reference} — ${c.title} (${c.counterparty})`], ["Note", opStr(input, "note") || null]]),
        warnings: decision === "APPROVE" ? ["Le contrat devient ACTIF."] : ["Le contrat est annulé, avec son motif."],
        args: { id: c.id, approve: decision === "APPROVE" ? "1" : "0", note: opStr(input, "note") || null },
        successMessage: `Contrat ${c.reference} ${decision === "APPROVE" ? "validé (actif)" : "refusé"}.`,
        revalidate: ["/consulting"],
      };
    },
    execute: (args) => runFd(decideConsultingContract, args, "La décision a été refusée.", { revalidate: ["/consulting"] }),
  },

  close_contract: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const c = await resolveContract(opStr(input, "reference") || opStr(input, "label"));
      if ("error" in c) return c;
      const cancel = /annul|romp|r[ée]sili/i.test(opStr(input, "decision")) || /annul|romp|r[ée]sili/i.test(opStr(input, "mode"));
      return {
        title: `${cancel ? "ROMPRE" : "Clore (expiration)"} le contrat ${c.reference}`,
        fields: fieldsOf([["Contrat", `${c.reference} — ${c.title} (${c.counterparty})`], ["Note", opStr(input, "note") || null]]),
        warnings: [cancel ? "Rupture en cours de contrat — tracée avec sa note." : "Clôture d'un contrat arrivé à son terme."],
        args: { id: c.id, cancel: cancel ? "1" : null, note: opStr(input, "note") || null },
        successMessage: `Contrat ${c.reference} ${cancel ? "rompu" : "clos"}.`,
        revalidate: ["/consulting"],
      };
    },
    execute: (args) => runFd(closeConsultingContract, args, "La clôture a été refusée.", { revalidate: ["/consulting"] }),
  },

  add_contract_task: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const c = await resolveContract(opStr(input, "reference"));
      if ("error" in c) return c;
      const label = opStr(input, "label") || opStr(input, "name");
      if (!label) return { error: "Décrivez la tâche attendue (champ « label »)." };
      return {
        title: `Ajouter la tâche « ${label} » au contrat ${c.reference}`,
        fields: fieldsOf([
          ["Contrat", `${c.reference} — ${c.title}`], ["Tâche", label],
          ["Échéance", isoDate(opStr(input, "dueDate"))],
        ]),
        args: { contractId: c.id, label, dueDate: isoDate(opStr(input, "dueDate")) },
        successMessage: `Tâche « ${label} » ajoutée au contrat ${c.reference}.`,
        revalidate: ["/consulting"],
      };
    },
    execute: (args) => runFd(addConsultingTask, args, "L'ajout de la tâche a été refusé.", { revalidate: ["/consulting"] }),
  },

  toggle_contract_task: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const c = await resolveContract(opStr(input, "reference"));
      if ("error" in c) return c;
      const task = await resolveContractTask(c.id, c.reference, opStr(input, "label") || opStr(input, "name"));
      if ("error" in task) return task;
      return {
        title: `${task.doneAt ? "Décocher" : "Marquer livrée"} — « ${task.label} » (${c.reference})`,
        fields: [{ label: "Tâche", value: `${task.label} — ${c.reference}` }, { label: "État", value: task.doneAt ? "Repassée à faire" : "Livrée" }],
        args: { taskId: task.id },
        successMessage: `Tâche « ${task.label} » ${task.doneAt ? "repassée à faire" : "marquée livrée"}.`,
        revalidate: ["/consulting"],
      };
    },
    execute: (args) => runFd(toggleConsultingTask, args, "L'opération a été refusée.", { revalidate: ["/consulting"] }),
  },

  delete_contract_task: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const c = await resolveContract(opStr(input, "reference"));
      if ("error" in c) return c;
      const task = await resolveContractTask(c.id, c.reference, opStr(input, "label") || opStr(input, "name"));
      if ("error" in task) return task;
      return {
        title: `Supprimer la tâche « ${task.label} » (${c.reference})`,
        fields: [{ label: "Tâche", value: `${task.label} — ${c.reference}` }],
        warnings: ["Un contrat clos ne se modifie plus (l'action refuse)."],
        args: { taskId: task.id },
        successMessage: `Tâche « ${task.label} » supprimée.`,
        revalidate: ["/consulting"],
      };
    },
    execute: (args) => runFd(deleteConsultingTask, args, "La suppression de la tâche a été refusée.", { revalidate: ["/consulting"] }),
  },
};
