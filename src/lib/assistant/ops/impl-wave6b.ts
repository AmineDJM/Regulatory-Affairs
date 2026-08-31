import { prisma } from "@/lib/prisma";
import {
  createValidationRule, updateValidationRule, toggleValidationRule, deleteValidationRule,
  createValidationRequest, decideValidation, reviewValidationItem, clearValidationItem, remindValidator,
  deleteMyValidationRequest,
} from "@/lib/actions/validation-actions";
import {
  createFieldReport, updateFieldReport, analyzeFieldReportAction, submitFieldReport,
  validateFieldReport, reopenFieldReport, deleteFieldReport, deleteFieldReportAttachment,
} from "@/lib/actions/field-report-actions";
import {
  createSupplyArticle, updateSupplyArticle, toggleSupplyArticle, applyCatalogNormalization,
} from "@/lib/actions/office-supply-actions";
import { normalizeArticle, needsRewrite, describeRewrite } from "@/lib/general-means/catalog-normalize";
import { ROLE_LABELS, SUPPLY_CATEGORY, SUPPLY_UNIT } from "@/lib/labels";
import type { CurrentUser } from "@/lib/session";
import type { OpImpl, OpProposalDraft } from "./types";
import { opStr } from "./types";
import { runFd, runFd2, fieldsOf, resolveOne, isoDate, dzd } from "./helpers";
import { matchLabel, fold } from "./impl-regulatory";

/**
 * OPS VAGUE 6b — VALIDATIONS (règles Super Admin en FUSION, demandes à validateurs directs ou
 * routage par module, décision d'étape avec intérim respecté, revue GRANULAIRE pièce par pièce
 * — retirable —, relance tracée du validateur qui bloque), RAPPORTS TERRAIN (brouillon dicté,
 * FUSION de la fiche, analyse IA persistée, envoi VALIDÉ, réouverture, suppressions avec pièces
 * comptées), CATALOGUE D'ARTICLES (écriture uniforme, doublon refusé par l'action, FUSION,
 * activation, uniformisation MONTRÉE avant d'être appliquée). Par les ACTIONS CANONIQUES.
 */

const PRIORITY6_FR: [string, string][] = [
  ["LOW", "Basse"], ["MEDIUM", "Moyenne"], ["HIGH", "Haute"], ["CRITICAL", "Critique"],
];
const ROLE6_PAIRS: [string, string][] = Object.entries(ROLE_LABELS as Record<string, string>);
const VALIDATION_DECISION_FR: [string, string][] = [
  ["APPROVED", "Approuver"], ["REJECTED", "Refuser"], ["CHANGES_REQUESTED", "Demander une modification"],
];

async function user6ByName(raw: string): Promise<{ id: string; name: string } | { error: string }> {
  const q = raw.trim();
  if (!q) return { error: "Précisez la personne (nom)." };
  const rows = await prisma.user.findMany({
    where: { name: { contains: q, mode: "insensitive" }, isActive: true },
    select: { id: true, name: true }, take: 6,
  });
  if (rows.length === 1) return rows[0];
  if (rows.length === 0) return { error: `Aucun utilisateur actif « ${q} ».` };
  return { error: `Plusieurs personnes correspondent : ${rows.map((u) => u.name).join(", ")} — préciser.` };
}

// ─────────────────────────── VALIDATIONS ───────────────────────────

const resolveValidationRule6 = (raw: string) =>
  resolveOne(raw, "la règle de validation (champ « target » — son nom)",
    (q) => prisma.validationRule.findMany({ where: { name: { contains: q, mode: "insensitive" } }, select: { id: true, name: true }, take: 6 }),
    (r) => r.name);

interface ValRequestHit { id: string; reference: string; title: string }

async function resolveValidationRequest(raw: string): Promise<ValRequestHit | { error: string }> {
  const q = raw.trim();
  if (!q) return { error: "Précisez la demande de validation (champ « target » — référence VAL-… ou objet)." };
  const exact = await prisma.validationRequest.findFirst({
    where: { reference: { equals: q, mode: "insensitive" } },
    select: { id: true, reference: true, title: true },
  });
  if (exact) return exact;
  const rows = await prisma.validationRequest.findMany({
    where: { OR: [{ title: { contains: q, mode: "insensitive" } }, { reference: { contains: q, mode: "insensitive" } }] },
    select: { id: true, reference: true, title: true, status: true },
    orderBy: { createdAt: "desc" }, take: 8,
  });
  const pending = rows.filter((r) => r.status === "PENDING");
  const pick = pending.length === 1 ? pending[0] : rows.length === 1 ? rows[0] : null;
  if (pick) return { id: pick.id, reference: pick.reference, title: pick.title };
  if (rows.length === 0) return { error: `Aucune demande de validation « ${q} ».` };
  return { error: `Plusieurs demandes correspondent : ${rows.map((r) => `${r.reference} — ${r.title}`).join(" ; ")} — donner la référence.` };
}

/** L'étape EN ATTENTE où l'utilisateur décide : la sienne (intérim compris côté action), ou — vue globale — celle du tour. */
async function resolvePendingStep(req: ValRequestHit, user: CurrentUser, personRaw: string): Promise<{ stepId: string; validatorName: string } | { error: string }> {
  const steps = await prisma.validationStep.findMany({
    where: { requestId: req.id, status: "PENDING" },
    select: { id: true, order: true, validatorId: true, validator: { select: { name: true } }, request: { select: { mode: true, currentOrder: true } } },
    orderBy: { order: "asc" },
  });
  if (steps.length === 0) return { error: `${req.reference} n'a aucune étape en attente.` };
  if (personRaw.trim()) {
    const hits = steps.filter((s) => fold(s.validator.name).includes(fold(personRaw)));
    if (hits.length === 1) return { stepId: hits[0].id, validatorName: hits[0].validator.name };
    return { error: `Aucune étape en attente pour « ${personRaw} » — validateurs en attente : ${steps.map((s) => s.validator.name).join(", ")}.` };
  }
  const own = steps.find((s) => s.validatorId === user.id);
  if (own) return { stepId: own.id, validatorName: own.validator.name };
  const current = steps.find((s) => s.request.mode === "PARALLEL" || s.order === s.request.currentOrder) ?? steps[0];
  return { stepId: current.id, validatorName: current.validator.name };
}

export const VALIDATION_OPS_IMPL: Record<string, OpImpl> = {
  create_validation_rule: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const name = opStr(input, "name") || opStr(input, "label");
      if (!name) return { error: "Nommez la règle (champ « name »)." };
      const v1 = await user6ByName(opStr(input, "person"));
      if ("error" in v1) return { error: `Validateur 1 : ${v1.error} (champ « person »)` };
      let v2: { id: string; name: string } | null = null;
      if (opStr(input, "person2")) {
        const r = await user6ByName(opStr(input, "person2"));
        if ("error" in r) return r;
        v2 = r;
      }
      const parallel = /parall[eè]le/i.test(opStr(input, "mode"));
      const priorityRaw = opStr(input, "priority");
      const priority = priorityRaw ? matchLabel(priorityRaw, PRIORITY6_FR) : null;
      if (priority && typeof priority === "object") return priority;
      const roleRaw = opStr(input, "role");
      const reqRole = roleRaw ? matchLabel(roleRaw, ROLE6_PAIRS) : null;
      if (reqRole && typeof reqRole === "object") return reqRole;
      return {
        title: `Créer la règle de validation « ${name} »`,
        fields: fieldsOf([
          ["Règle", name],
          ["Validateur 1", v1.name],
          ["Validateur 2", v2?.name ?? null],
          ["Mode", v2 ? (parallel ? "Parallèle" : "Séquentiel") : null],
          ["Module ciblé", opStr(input, "module") || "tous"],
          ["Montant", opStr(input, "amount") ? `≥ ${dzd(Number(opStr(input, "amount")))}` : null],
        ]),
        warnings: ["Réservé au Super Admin — la règle route AUTOMATIQUEMENT les futures demandes qui matchent."],
        args: {
          name, validator1Id: v1.id, validator2Id: v2?.id ?? null,
          mode: parallel ? "PARALLEL" : "SEQUENTIAL",
          module: opStr(input, "module") || null, objectType: null,
          description: opStr(input, "notes") || null,
          minAmount: opStr(input, "amount") || null, maxAmount: opStr(input, "maxAmount") || null,
          department: opStr(input, "department") || null,
          requesterRole: reqRole || null, priority: priority || null, category: opStr(input, "category") || null,
        },
        successMessage: `Règle « ${name} » créée.`,
        revalidate: ["/admin/validations"],
      };
    },
    execute: (args) => runFd2(createValidationRule, args, "La création de la règle a été refusée.", { revalidate: ["/admin/validations"] }),
  },

  update_validation_rule: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const hit = await resolveValidationRule6(opStr(input, "target") || opStr(input, "name"));
      if ("error" in hit) return hit;
      const cur = await prisma.validationRule.findUnique({ where: { id: hit.id } });
      if (!cur) return { error: "Règle introuvable." };
      // FUSION : l'action REMPLACE tous les champs de la règle — l'existant est relu et rejoué.
      let v1 = cur.validator1Id; let v1Shown = "(inchangé)";
      if (opStr(input, "person")) {
        const r = await user6ByName(opStr(input, "person"));
        if ("error" in r) return r;
        v1 = r.id; v1Shown = r.name;
      }
      let v2 = cur.validator2Id; let v2Shown: string | null = null;
      const p2 = opStr(input, "person2");
      if (/^aucun/i.test(p2)) { v2 = null; v2Shown = "— (retiré)"; }
      else if (p2) {
        const r = await user6ByName(p2);
        if ("error" in r) return r;
        v2 = r.id; v2Shown = r.name;
      }
      const modeRaw = opStr(input, "mode");
      const mode = modeRaw ? (/parall[eè]le/i.test(modeRaw) ? "PARALLEL" : "SEQUENTIAL") : cur.mode;
      return {
        title: `Modifier la règle « ${cur.name} »`,
        fields: fieldsOf([
          ["Règle", opStr(input, "newName") ? `${cur.name} → ${opStr(input, "newName")}` : cur.name],
          ["Validateur 1", v1Shown],
          ["Validateur 2", v2Shown],
          ["Le reste", "rejoué à l'identique (FUSION)"],
        ]),
        warnings: ["Réservé au Super Admin."],
        args: {
          id: hit.id, name: opStr(input, "newName") || cur.name,
          validator1Id: v1, validator2Id: v2, mode,
          module: opStr(input, "module") || cur.module || null,
          objectType: cur.objectType ?? null,
          description: opStr(input, "notes") || cur.description || null,
          minAmount: opStr(input, "amount") || (cur.minAmount != null ? String(Number(cur.minAmount)) : null),
          maxAmount: opStr(input, "maxAmount") || (cur.maxAmount != null ? String(Number(cur.maxAmount)) : null),
          department: opStr(input, "department") || cur.department || null,
          requesterRole: cur.requesterRole ?? null,
          priority: cur.priority ?? null,
          category: opStr(input, "category") || cur.category || null,
          active: cur.active ? "1" : null,
        },
        successMessage: `Règle « ${opStr(input, "newName") || cur.name} » modifiée.`,
        revalidate: ["/admin/validations"],
      };
    },
    execute: (args) => runFd(updateValidationRule, args, "La modification de la règle a été refusée.", { revalidate: ["/admin/validations"] }),
  },

  toggle_validation_rule: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const hit = await resolveValidationRule6(opStr(input, "target") || opStr(input, "name"));
      if ("error" in hit) return hit;
      const cur = await prisma.validationRule.findUnique({ where: { id: hit.id }, select: { active: true } });
      return {
        title: `${cur?.active ? "Désactiver" : "Réactiver"} la règle « ${hit.name} »`,
        fields: [{ label: "Règle", value: `${hit.name} — ${cur?.active ? "active → inactive" : "inactive → active"}` }],
        warnings: ["Une règle inactive ne route plus les nouvelles demandes — les demandes déjà créées ne bougent pas."],
        args: { id: hit.id },
        successMessage: `Règle « ${hit.name} » ${cur?.active ? "désactivée" : "réactivée"}.`,
        revalidate: ["/admin/validations"],
      };
    },
    execute: (args) => runFd(toggleValidationRule, args, "Le basculement de la règle a été refusé.", { revalidate: ["/admin/validations"] }),
  },

  delete_validation_rule: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const hit = await resolveValidationRule6(opStr(input, "target") || opStr(input, "name"));
      if ("error" in hit) return hit;
      const used = await prisma.validationRequest.count({ where: { ruleId: hit.id } });
      return {
        title: `Supprimer la règle de validation « ${hit.name} »`,
        fields: [{ label: "Règle", value: hit.name }, { label: "Demandes déjà routées par elle", value: String(used) }],
        warnings: ["Suppression définitive de la règle — les demandes existantes gardent leur circuit, les futures ne seront plus routées par elle."],
        args: { id: hit.id },
        successMessage: `Règle « ${hit.name} » supprimée.`,
        revalidate: ["/admin/validations"],
      };
    },
    execute: (args) => runFd(deleteValidationRule, args, "La suppression de la règle a été refusée.", { revalidate: ["/admin/validations"] }),
  },

  withdraw_request: {
    async propose(input, user): Promise<OpProposalDraft | { error: string }> {
      const q = (opStr(input, "target") || opStr(input, "label") || opStr(input, "name")).trim();
      if (!q) return { error: "Précisez la demande à retirer (sa référence VAL- ou son objet)." };
      // MES demandes, et celles qui ATTENDENT encore : une demande tranchée ne se retire pas —
      // l'accord ou le refus d'un tiers est un fait, pas un brouillon.
      const rows = await prisma.validationRequest.findMany({
        where: {
          requesterId: user.id,
          status: "PENDING",
          OR: [{ reference: { contains: q, mode: "insensitive" } }, { title: { contains: q, mode: "insensitive" } }],
        },
        select: { id: true, reference: true, title: true, steps: { select: { status: true, validator: { select: { name: true } } } } },
        orderBy: { createdAt: "desc" },
        take: 6,
      });
      if (rows.length === 0) return { error: `Aucune de VOS demandes de validation en attente ne correspond à « ${q} ».` };
      if (rows.length > 1) {
        return { error: `Plusieurs correspondent : ${rows.map((r) => `${r.reference} — ${r.title}`).join(" ; ")} — préciser.` };
      }
      const hit = rows[0];
      if (hit.steps.some((e) => e.status !== "PENDING")) {
        return { error: `Un validateur s'est déjà prononcé sur ${hit.reference} : la demande ne peut plus être retirée.` };
      }
      return {
        title: `Retirer la demande de validation ${hit.reference}`,
        fields: fieldsOf([
          ["Demande", `${hit.reference} — ${hit.title}`],
          ["Validateurs", hit.steps.map((e) => e.validator?.name).filter(Boolean).join(", ") || null],
        ]),
        warnings: ["La demande disparaît de la file de ses validateurs. Aucun d'eux ne s'est encore prononcé."],
        args: { id: hit.id },
        successMessage: `Demande ${hit.reference} retirée.`,
        revalidate: ["/validations"],
      };
    },
    execute: (args) => runFd(deleteMyValidationRequest, args, "Le retrait de la demande a été refusé.", { revalidate: ["/validations"] }),
  },

  create_validation_request: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const title = opStr(input, "label") || opStr(input, "name");
      if (!title) return { error: "Indiquez l'objet à valider (champ « label »)." };
      let v1: { id: string; name: string } | null = null;
      let v2: { id: string; name: string } | null = null;
      if (opStr(input, "person")) {
        const r = await user6ByName(opStr(input, "person"));
        if ("error" in r) return r;
        v1 = r;
      }
      if (opStr(input, "person2")) {
        const r = await user6ByName(opStr(input, "person2"));
        if ("error" in r) return r;
        v2 = r;
      }
      const moduleRaw = opStr(input, "module");
      if (!v1 && !moduleRaw) return { error: "Choisissez le(s) validateur(s) (champ « person ») OU le module pour un routage automatique par les règles (champ « module »)." };
      const priorityRaw = opStr(input, "priority");
      const priority = priorityRaw ? matchLabel(priorityRaw, PRIORITY6_FR) : null;
      if (priority && typeof priority === "object") return priority;
      return {
        title: `Demander la validation « ${title} »`,
        fields: fieldsOf([
          ["Objet", title],
          ["Validateurs", v1 ? [v1.name, v2?.name].filter(Boolean).join(", ") : `routage automatique (module « ${moduleRaw} »)`],
          ["Priorité", priority ? PRIORITY6_FR.find(([c]) => c === priority)?.[1] ?? null : null],
          ["Échéance", isoDate(opStr(input, "date"))],
          ["Montant", opStr(input, "amount") ? dzd(Number(opStr(input, "amount"))) : null],
        ]),
        args: {
          title, description: opStr(input, "notes") || opStr(input, "message") || null,
          validator1Id: v1?.id ?? null, validator2Id: v2?.id ?? null,
          module: moduleRaw || null, priority: priority || null,
          deadline: isoDate(opStr(input, "date")), amount: opStr(input, "amount") || null,
          department: opStr(input, "department") || null, category: opStr(input, "category") || null,
        },
        successMessage: `Demande de validation « ${title} » créée.`,
        revalidate: ["/validations", "/mon-travail"],
      };
    },
    execute: (args) => runFd2(createValidationRequest, args, "La demande de validation a été refusée.", { revalidate: ["/validations"] }),
  },

  decide_validation: {
    async propose(input, user): Promise<OpProposalDraft | { error: string }> {
      const req = await resolveValidationRequest(opStr(input, "target"));
      if ("error" in req) return req;
      const m = matchLabel(opStr(input, "decision"), VALIDATION_DECISION_FR);
      if (typeof m === "object") return m;
      const step = await resolvePendingStep(req, user, opStr(input, "person"));
      if ("error" in step) return step;
      return {
        title: `${VALIDATION_DECISION_FR.find(([c]) => c === m)?.[1]} — ${req.reference} (${req.title})`,
        fields: fieldsOf([
          ["Demande", `${req.reference} — ${req.title}`],
          ["Étape", `validateur : ${step.validatorName}`],
          ["Décision", VALIDATION_DECISION_FR.find(([c]) => c === m)?.[1] ?? m],
          ["Commentaire", opStr(input, "note") || null],
        ]),
        warnings: m === "REJECTED"
          ? ["Le REFUS clôt la demande — le demandeur est notifié avec l'objet précis de la décision."]
          : ["Seul le validateur de l'étape (ou son INTÉRIMAIRE de congé, ou le Super Admin) peut décider — en séquentiel, chacun son tour."],
        args: { stepId: step.stepId, decision: m, reason: opStr(input, "note") || null },
        successMessage: `${req.reference} : ${VALIDATION_DECISION_FR.find(([c]) => c === m)?.[1]}.`,
        revalidate: ["/validations", "/mon-travail"],
      };
    },
    execute: (args) => runFd(decideValidation, args, "La décision a été refusée.", { revalidate: ["/validations"] }),
  },

  review_validation_item: {
    async propose(input, user): Promise<OpProposalDraft | { error: string }> {
      const req = await resolveValidationRequest(opStr(input, "target"));
      if ("error" in req) return req;
      const step = await resolvePendingStep(req, user, "");
      if ("error" in step) return step;
      const labelRaw = opStr(input, "label");
      let itemKey = "MESSAGE"; let itemShown = "Le message de la demande";
      if (labelRaw && !/^message$/i.test(labelRaw.trim())) {
        const docs = await prisma.document.findMany({
          where: { entityType: "VALIDATION_REQUEST", entityId: req.id },
          select: { id: true, name: true }, take: 20,
        });
        const hits = docs.filter((d) => fold(d.name).includes(fold(labelRaw)));
        if (hits.length === 0) return { error: `Aucune pièce « ${labelRaw} » sur ${req.reference}${docs.length ? ` — pièces : ${docs.map((d) => d.name).join(" ; ")}` : " (aucune pièce jointe)"}.` };
        if (hits.length > 1) return { error: `Plusieurs pièces correspondent : ${hits.map((d) => d.name).join(" ; ")} — préciser.` };
        itemKey = hits[0].id; itemShown = `Pièce « ${hits[0].name} »`;
      }
      const decRaw = fold(opStr(input, "decision"));
      const clearing = /retire|efface|annule le verdict|non [ée]valu/.test(decRaw);
      let decision: string | null = null;
      if (!clearing) {
        const m = matchLabel(opStr(input, "decision"), VALIDATION_DECISION_FR);
        if (typeof m === "object") return m;
        decision = m;
      }
      return {
        title: clearing
          ? `Retirer le verdict — ${itemShown} (${req.reference})`
          : `${VALIDATION_DECISION_FR.find(([c]) => c === decision)?.[1]} — ${itemShown} (${req.reference})`,
        fields: fieldsOf([
          ["Demande", `${req.reference} — ${req.title}`],
          ["Élément", itemShown],
          ["Verdict", clearing ? "— (retiré, revient à « non évalué »)" : VALIDATION_DECISION_FR.find(([c]) => c === decision)?.[1] ?? null],
          ["Commentaire", opStr(input, "note") || null],
        ]),
        warnings: ["Revue GRANULAIRE, élément par élément — elle ne fait PAS avancer le circuit : la décision globale reste decide_validation."],
        args: { stepId: step.stepId, itemKey, decision, comment: opStr(input, "note") || null, clear: clearing ? "1" : null },
        successMessage: clearing ? `Verdict retiré (${itemShown}).` : `Verdict posé sur ${itemShown.toLowerCase()}.`,
        revalidate: ["/validations"],
      };
    },
    async execute(args) {
      const fd = new FormData();
      fd.set("stepId", args.stepId ?? "");
      fd.set("itemKey", args.itemKey ?? "");
      if (args.clear === "1") {
        const r = await clearValidationItem(fd);
        if (!r.ok) return { ok: false, error: r.error ?? "Le retrait du verdict a été refusé." };
        return { ok: true, revalidate: ["/validations"] };
      }
      fd.set("decision", args.decision ?? "");
      if (args.comment) fd.set("comment", args.comment);
      const r = await reviewValidationItem(fd);
      if (!r.ok) return { ok: false, error: r.error ?? "La revue de l'élément a été refusée." };
      return { ok: true, revalidate: ["/validations"] };
    },
  },

  remind_validator: {
    async propose(input, user): Promise<OpProposalDraft | { error: string }> {
      const req = await resolveValidationRequest(opStr(input, "target"));
      if ("error" in req) return req;
      const step = await resolvePendingStep(req, user, opStr(input, "person"));
      if ("error" in step) return step;
      return {
        title: `Relancer ${step.validatorName} — ${req.reference}`,
        fields: fieldsOf([
          ["Demande", `${req.reference} — ${req.title}`],
          ["Validateur relancé", step.validatorName],
          ["Mot", opStr(input, "note") || null],
        ]),
        warnings: ["Relance TRACÉE (audit) — une pression hiérarchique réservée à la vue globale, pas un bouton de confort."],
        args: { stepId: step.stepId, note: opStr(input, "note") || null },
        successMessage: `${step.validatorName} relancé·e sur ${req.reference}.`,
        revalidate: ["/validations"],
      };
    },
    execute: (args) => runFd(remindValidator, args, "La relance a été refusée.", { revalidate: ["/validations"] }),
  },
};

// ─────────────────────────── RAPPORTS TERRAIN ───────────────────────────

interface FieldReportHit { id: string; label: string }

async function resolveFieldReport(user: CurrentUser, raw: string): Promise<FieldReportHit | { error: string }> {
  const q = raw.trim();
  const mine = /^(mon |mes |dernier)/i.test(q) || !q;
  const rows = await prisma.fieldReport.findMany({
    where: mine
      ? { delegateId: user.id }
      : {
          OR: [
            { doctorName: { contains: q, mode: "insensitive" } },
            { summary: { contains: q, mode: "insensitive" } },
            { delegate: { name: { contains: q, mode: "insensitive" } } },
          ],
        },
    select: { id: true, visitDate: true, doctorName: true, status: true, delegate: { select: { name: true } } },
    orderBy: { visitDate: "desc" }, take: 6,
  });
  const label = (r: (typeof rows)[number]) =>
    `${r.visitDate.toISOString().slice(0, 10)} · ${r.doctorName ?? "—"} (${r.delegate?.name ?? "?"}${r.status === "DRAFT" ? ", brouillon" : ""})`;
  if (rows.length === 0) return { error: q ? `Aucun rapport terrain « ${q} ».` : "Vous n'avez aucun rapport terrain." };
  if (mine || rows.length === 1) return { id: rows[0].id, label: label(rows[0]) };
  return { error: `Plusieurs rapports correspondent : ${rows.map(label).join(" ; ")} — préciser (médecin, délégué ou « mon dernier »).` };
}

/** Résout des praticiens par une liste de noms (virgules) → ids + libellés. */
async function resolveDoctors(raw: string): Promise<{ ids: string[]; shown: string[] } | { error: string }> {
  const names = raw.split(/[;,]/).map((s) => s.trim()).filter(Boolean);
  const ids: string[] = []; const shown: string[] = [];
  for (const n of names) {
    const rows = await prisma.medicalDoctor.findMany({
      where: { name: { contains: n, mode: "insensitive" } }, select: { id: true, name: true }, take: 4,
    });
    if (rows.length === 0) return { error: `Aucun praticien « ${n} » à l'annuaire.` };
    if (rows.length > 1) return { error: `Plusieurs praticiens correspondent à « ${n} » : ${rows.map((d) => d.name).join(", ")} — préciser.` };
    if (!ids.includes(rows[0].id)) { ids.push(rows[0].id); shown.push(rows[0].name); }
  }
  return { ids, shown };
}

export const FIELD_REPORT_OPS_IMPL: Record<string, OpImpl> = {
  create_field_report: {
    async propose(): Promise<OpProposalDraft | { error: string }> {
      return {
        title: "Ouvrir un brouillon de rapport terrain",
        fields: [{ label: "Rapport", value: "Nouveau brouillon — il vous appartient (à dicter / compléter puis envoyer)" }],
        args: {},
        successMessage: "Brouillon de rapport terrain ouvert.",
        revalidate: ["/field-reports"],
      };
    },
    async execute() {
      const r = await createFieldReport();
      if (!r.ok) return { ok: false, error: r.error ?? "L'ouverture du rapport a été refusée." };
      return { ok: true, revalidate: ["/field-reports"] };
    },
  },

  update_field_report: {
    async propose(input, user): Promise<OpProposalDraft | { error: string }> {
      const hit = await resolveFieldReport(user, opStr(input, "target"));
      if ("error" in hit) return hit;
      const cur = await prisma.fieldReport.findUnique({
        where: { id: hit.id },
        select: { summary: true, visitDate: true, doctorIds: true, doctorName: true, institution: true, specialty: true },
      });
      if (!cur) return { error: "Rapport introuvable." };
      // FUSION : l'action REMPLACE synthèse, date, médecins, établissement, spécialité —
      // l'existant est relu et rejoué ; seuls les champs donnés changent.
      let doctorIds = cur.doctorIds.join(",");
      let doctorName = cur.doctorName;
      let doctorsShown: string | null = null;
      if (opStr(input, "doctor")) {
        const r = await resolveDoctors(opStr(input, "doctor"));
        if ("error" in r) return r;
        doctorIds = r.ids.join(","); doctorName = r.shown[0] ?? null; doctorsShown = r.shown.join(", ");
      }
      return {
        title: `Mettre à jour le rapport terrain (${hit.label})`,
        fields: fieldsOf([
          ["Rapport", hit.label],
          ["Synthèse", opStr(input, "message") || (cur.summary ? "(rejouée)" : null)],
          ["Médecin(s)", doctorsShown],
          ["Le reste", "rejoué à l'identique (FUSION)"],
        ]),
        args: {
          id: hit.id,
          summary: opStr(input, "message") || cur.summary || null,
          visitDate: isoDate(opStr(input, "date")) || cur.visitDate.toISOString().slice(0, 10),
          doctorIds, doctorName,
          institution: opStr(input, "institution") || cur.institution || null,
          specialty: opStr(input, "specialty") || cur.specialty || null,
        },
        successMessage: "Rapport terrain mis à jour.",
        revalidate: ["/field-reports"],
      };
    },
    execute: (args) => runFd(updateFieldReport, args, "La mise à jour du rapport a été refusée.", { revalidate: ["/field-reports"] }),
  },

  analyze_field_report: {
    async propose(input, user): Promise<OpProposalDraft | { error: string }> {
      const hit = await resolveFieldReport(user, opStr(input, "target"));
      if ("error" in hit) return hit;
      return {
        title: `Analyser le rapport terrain par l'IA (${hit.label})`,
        fields: [{ label: "Rapport", value: hit.label }],
        warnings: ["L'IA STRUCTURE la transcription (médecin, produits, objection, opportunité…) et PERSISTE les champs — elle ne valide jamais le rapport."],
        args: { id: hit.id },
        successMessage: "Rapport analysé — champs structurés enregistrés.",
        revalidate: ["/field-reports"],
      };
    },
    async execute(args) {
      const fd = new FormData();
      fd.set("id", args.id ?? "");
      const r = await analyzeFieldReportAction(fd);
      if (!r.ok) return { ok: false, error: r.error ?? "L'analyse du rapport a été refusée." };
      return { ok: true, revalidate: ["/field-reports"] };
    },
  },

  submit_field_report: {
    async propose(input, user): Promise<OpProposalDraft | { error: string }> {
      const hit = await resolveFieldReport(user, opStr(input, "target"));
      if ("error" in hit) return hit;
      const cur = await prisma.fieldReport.findUnique({
        where: { id: hit.id },
        select: { summary: true, visitDate: true, doctorIds: true, doctorName: true, institution: true, specialty: true },
      });
      if (!cur) return { error: "Rapport introuvable." };
      const summary = opStr(input, "message") || cur.summary;
      if (!summary) return { error: "Le compte rendu est vide — dictez ou donnez la synthèse (champ « message ») avant l'envoi." };
      return {
        title: `ENVOYER le compte rendu (${hit.label})`,
        fields: fieldsOf([
          ["Rapport", hit.label],
          ["Synthèse", summary.slice(0, 160)],
        ]),
        warnings: ["L'envoi VALIDE le rapport (horodaté) — le reste de la fiche est rejoué à l'identique (FUSION)."],
        args: {
          id: hit.id, summary,
          visitDate: isoDate(opStr(input, "date")) || cur.visitDate.toISOString().slice(0, 10),
          doctorIds: cur.doctorIds.join(","), doctorName: cur.doctorName,
          institution: cur.institution ?? null, specialty: cur.specialty ?? null,
        },
        successMessage: "Compte rendu envoyé (validé).",
        revalidate: ["/field-reports"],
      };
    },
    execute: (args) => runFd(submitFieldReport, args, "L'envoi du compte rendu a été refusé.", { revalidate: ["/field-reports"] }),
  },

  validate_field_report: {
    async propose(input, user): Promise<OpProposalDraft | { error: string }> {
      const hit = await resolveFieldReport(user, opStr(input, "target"));
      if ("error" in hit) return hit;
      return {
        title: `Valider le rapport terrain (${hit.label})`,
        fields: [{ label: "Rapport", value: hit.label }],
        warnings: ["Geste du délégué auteur ou d'un manager des rapports (revérifié par l'action)."],
        args: { id: hit.id },
        successMessage: "Rapport validé.",
        revalidate: ["/field-reports"],
      };
    },
    execute: (args) => runFd(validateFieldReport, args, "La validation a été refusée.", { revalidate: ["/field-reports"] }),
  },

  reopen_field_report: {
    async propose(input, user): Promise<OpProposalDraft | { error: string }> {
      const hit = await resolveFieldReport(user, opStr(input, "target"));
      if ("error" in hit) return hit;
      return {
        title: `Rouvrir le rapport terrain (${hit.label})`,
        fields: [{ label: "Rapport", value: hit.label }],
        warnings: ["Le rapport repasse BROUILLON (l'horodatage de validation est effacé) — pour corriger puis renvoyer."],
        args: { id: hit.id },
        successMessage: "Rapport rouvert (brouillon).",
        revalidate: ["/field-reports"],
      };
    },
    execute: (args) => runFd(reopenFieldReport, args, "La réouverture a été refusée.", { revalidate: ["/field-reports"] }),
  },

  delete_field_report: {
    async propose(input, user): Promise<OpProposalDraft | { error: string }> {
      const hit = await resolveFieldReport(user, opStr(input, "target"));
      if ("error" in hit) return hit;
      const atts = await prisma.fieldReportAttachment.count({ where: { reportId: hit.id } });
      return {
        title: `SUPPRIMER le rapport terrain (${hit.label})`,
        fields: [{ label: "Rapport", value: hit.label }, { label: "Pièces jointes emportées", value: String(atts) }],
        warnings: ["Suppression DÉFINITIVE du rapport, de son audio et de ses pièces (stockage libéré)."],
        args: { id: hit.id },
        successMessage: "Rapport terrain supprimé.",
        revalidate: ["/field-reports"],
      };
    },
    execute: (args) => runFd(deleteFieldReport, args, "La suppression du rapport a été refusée.", { revalidate: ["/field-reports"] }),
  },

  delete_field_report_attachment: {
    async propose(input, user): Promise<OpProposalDraft | { error: string }> {
      const hit = await resolveFieldReport(user, opStr(input, "target"));
      if ("error" in hit) return hit;
      const q = opStr(input, "label");
      const atts = await prisma.fieldReportAttachment.findMany({
        where: { reportId: hit.id }, select: { id: true, name: true }, take: 20,
      });
      if (atts.length === 0) return { error: "Ce rapport n'a aucune pièce jointe." };
      const hits = q ? atts.filter((a) => fold(a.name).includes(fold(q))) : atts;
      if (hits.length === 0) return { error: `Aucune pièce « ${q} » — pièces : ${atts.map((a) => a.name).join(" ; ")}.` };
      if (hits.length > 1) return { error: `Plusieurs pièces correspondent : ${hits.map((a) => a.name).join(" ; ")} — préciser (champ « label »).` };
      return {
        title: `Supprimer la pièce « ${hits[0].name} » du rapport`,
        fields: [{ label: "Rapport", value: hit.label }, { label: "Pièce", value: hits[0].name }],
        warnings: ["Suppression définitive de la pièce (stockage libéré)."],
        args: { id: hits[0].id },
        successMessage: `Pièce « ${hits[0].name} » supprimée.`,
        revalidate: ["/field-reports"],
      };
    },
    execute: (args) => runFd(deleteFieldReportAttachment, args, "La suppression de la pièce a été refusée.", { revalidate: ["/field-reports"] }),
  },
};

// ─────────────────────────── CATALOGUE D'ARTICLES (bureau / moyens généraux) ───────────────────────────

const resolveSupplyArticle = (raw: string) =>
  resolveOne(raw, "l'article du catalogue (champ « name »)",
    (q) => prisma.officeSupplyArticle.findMany({ where: { name: { contains: q, mode: "insensitive" } }, select: { id: true, name: true }, take: 6 }),
    (a) => a.name);

export const SUPPLY_OPS_IMPL: Record<string, OpImpl> = {
  create_supply_article: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const name = opStr(input, "name") || opStr(input, "label");
      if (!name) return { error: "Nommez l'article (champ « name »)." };
      return {
        title: `Ajouter « ${name} » au catalogue d'articles`,
        fields: fieldsOf([
          ["Article", name],
          ["Catégorie", opStr(input, "category") || null],
          ["Unité", opStr(input, "unit") || null],
          ["Prix estimé", opStr(input, "amount") ? dzd(Number(opStr(input, "amount"))) : null],
          ["Fournisseur indicatif", opStr(input, "supplier") || null],
        ]),
        warnings: ["L'écriture est UNIFORMISÉE à l'entrée et le DOUBLON refusé (même clé sans casse ni accents) — un seul catalogue pour les demandes ET les tickets de caisse."],
        args: {
          name, category: opStr(input, "category") || null, unit: opStr(input, "unit") || null,
          reference: opStr(input, "reference") || null, estimatedPrice: opStr(input, "amount") || null,
          supplierHint: opStr(input, "supplier") || null, notes: opStr(input, "notes") || null,
        },
        successMessage: `Article « ${name} » ajouté au catalogue.`,
        revalidate: ["/demandes", "/moyens-generaux"],
      };
    },
    execute: (args) => runFd(createSupplyArticle, args, "L'ajout de l'article a été refusé.", { revalidate: ["/demandes", "/moyens-generaux"] }),
  },

  update_supply_article: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const hit = await resolveSupplyArticle(opStr(input, "name") || opStr(input, "label"));
      if ("error" in hit) return hit;
      const cur = await prisma.officeSupplyArticle.findUnique({
        where: { id: hit.id },
        select: { category: true, unit: true, reference: true, estimatedPrice: true, supplierHint: true, notes: true },
      });
      const newName = opStr(input, "newName") || hit.name;
      // FUSION : l'action REMPLACE toute la fiche (prix estimé compris — absent, il serait
      // EFFACÉ) — l'existant est relu et rejoué.
      return {
        title: `Modifier l'article « ${hit.name} »`,
        fields: fieldsOf([
          ["Article", newName !== hit.name ? `${hit.name} → ${newName}` : hit.name],
          ["Prix estimé", opStr(input, "amount") ? dzd(Number(opStr(input, "amount"))) : (cur?.estimatedPrice != null ? `${dzd(Number(cur.estimatedPrice))} (rejoué)` : null)],
          ["Le reste", "rejoué à l'identique (FUSION) — renommer sur un libellé déjà pris est refusé par l'action"],
        ]),
        args: {
          id: hit.id, name: newName,
          category: opStr(input, "category") || cur?.category || null,
          unit: opStr(input, "unit") || cur?.unit || null,
          reference: opStr(input, "reference") || cur?.reference || null,
          estimatedPrice: opStr(input, "amount") || (cur?.estimatedPrice != null ? String(Number(cur.estimatedPrice)) : null),
          supplierHint: opStr(input, "supplier") || cur?.supplierHint || null,
          notes: opStr(input, "notes") || cur?.notes || null,
        },
        successMessage: `Article « ${newName} » modifié.`,
        revalidate: ["/demandes", "/moyens-generaux"],
      };
    },
    execute: (args) => runFd(updateSupplyArticle, args, "La modification de l'article a été refusée.", { revalidate: ["/demandes", "/moyens-generaux"] }),
  },

  toggle_supply_article: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const hit = await resolveSupplyArticle(opStr(input, "name") || opStr(input, "label"));
      if ("error" in hit) return hit;
      const cur = await prisma.officeSupplyArticle.findUnique({ where: { id: hit.id }, select: { active: true } });
      return {
        title: `${cur?.active ? "Désactiver" : "Réactiver"} l'article « ${hit.name} »`,
        fields: [{ label: "Article", value: `${hit.name} — ${cur?.active ? "actif → retiré du menu" : "désactivé → de retour au menu"}` }],
        warnings: ["Un article désactivé n'apparaît plus dans les menus — l'historique de consommation reste."],
        args: { id: hit.id },
        successMessage: `Article « ${hit.name} » ${cur?.active ? "désactivé" : "réactivé"}.`,
        revalidate: ["/demandes", "/moyens-generaux"],
      };
    },
    execute: (args) => runFd(toggleSupplyArticle, args, "Le basculement de l'article a été refusé.", { revalidate: ["/demandes", "/moyens-generaux"] }),
  },

  normalize_supply_catalog: {
    async propose(): Promise<OpProposalDraft | { error: string }> {
      // La PRÉVISUALISATION (lecture seule) EST la proposition : on montre d'abord, on applique
      // ensuite — même calcul que l'écran, par le normalisateur PUR partagé (pas la server
      // action de preview, qui exige la session de requête Next).
      const rows = await prisma.officeSupplyArticle.findMany({
        select: { id: true, name: true, category: true, unit: true, reference: true, supplierHint: true },
        orderBy: { name: "asc" },
      });
      const labels = { category: SUPPLY_CATEGORY, unit: SUPPLY_UNIT };
      const rewrites: { name: string; changes: string[] }[] = [];
      for (const r of rows) {
        const after = normalizeArticle(r, labels);
        if (needsRewrite(r, after)) rewrites.push({ name: r.name, changes: describeRewrite(r, after) });
      }
      if (rewrites.length === 0) {
        return {
          title: "Uniformiser le catalogue — rien à réécrire",
          fields: [{ label: "Catalogue", value: `${rows.length} article(s) — déjà uniforme` }],
          args: {},
          successMessage: "Le catalogue est déjà uniforme.",
          revalidate: ["/demandes", "/moyens-generaux"],
        };
      }
      const shown = rewrites.slice(0, 8).map((r) => `${r.name} : ${r.changes.join(", ")}`);
      return {
        title: `Uniformiser le catalogue — ${rewrites.length} article(s) seront réécrits (sur ${rows.length})`,
        fields: [
          { label: "Réécritures", value: shown.join(" ; ") + (rewrites.length > 8 ? ` … et ${rewrites.length - 8} autre(s)` : "") },
        ],
        warnings: ["Les libellés reconnus par les équipes vont CHANGER — les doublons révélés ne sont PAS fusionnés (arbitrage humain), ils sont listés."],
        args: {},
        successMessage: "Catalogue uniformisé.",
        revalidate: ["/demandes", "/moyens-generaux"],
      };
    },
    async execute() {
      const r = await applyCatalogNormalization();
      if (!r.ok) return { ok: false, error: r.error ?? "L'uniformisation a été refusée." };
      return { ok: true, revalidate: ["/demandes", "/moyens-generaux"] };
    },
  },
};
