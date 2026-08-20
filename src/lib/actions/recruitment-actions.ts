"use server";

import { revalidatePath } from "next/cache";
import type { ContractType } from "@prisma/client";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { userCan, rolesWithModule } from "@/lib/rbac";
import { recordAudit } from "@/lib/audit";
import { notifyUser, notifyRoles } from "@/lib/notify";
import { buildRef, createWithRetry } from "@/lib/refs";
import { companyIdForNew } from "@/lib/company";
import { getManagementChain } from "@/lib/departments";
import { attachFormFiles } from "@/lib/documents";
import { fdStr, fdNum, fdDate, type ActionResult } from "@/lib/actions/types";
import { recruitmentViewer } from "@/lib/recruitment/access";
import {
  abilities, applyChainDecision, canDecideStep, canSelectCandidate, currentStep,
  needsOnboarding, summarize, validateDraft, CONTRACT_LABEL,
  type ChainStep, type RecruitmentContract,
} from "@/lib/recruitment/request-flow";

/**
 * LE CIRCUIT DE RECRUTEMENT — la porte de l'écran.
 *
 * Les RÈGLES vivent dans `lib/recruitment/request-flow.ts` (module pur, testé) ; ici on ne fait
 * que trois choses : lire le formulaire, résoudre qui parle, écrire. Toute décision — qui peut
 * quoi, ce qui suit quoi — est posée là-bas et RE-DEMANDÉE ici avec les mêmes arguments que
 * l'écran : un bouton visible correspond alors toujours à une action permise, et l'inverse.
 */

// ───────────────────────────── Créer la demande ─────────────────────────────

/**
 * Construit la chaîne de validation : le N+1, puis les N+1 successifs jusqu'au sommet.
 *
 * Elle est FIGÉE ici, à la soumission. Une réorganisation en cours de route changerait sinon les
 * validateurs d'une demande déjà partie, et l'on ne saurait plus qui devait trancher quand elle a
 * été déposée.
 *
 * Le demandeur est écarté de sa propre chaîne : un directeur qui est aussi son propre N+1 dans
 * l'organigramme ne se valide pas lui-même.
 */
async function buildChain(requesterUserId: string): Promise<{ approverId: string; name: string }[]> {
  const emp = await prisma.employee.findUnique({ where: { userId: requesterUserId }, select: { id: true } });
  if (!emp) return [];
  const chain = await getManagementChain(emp.id);
  const out: { approverId: string; name: string }[] = [];
  const seen = new Set<string>([requesterUserId]);
  for (const m of chain) {
    if (!m.userId || seen.has(m.userId)) continue;
    seen.add(m.userId);
    out.push({ approverId: m.userId, name: m.fullName });
  }
  return out;
}

export async function createRecruitmentRequest(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "RECRUITMENT", "CREATE")) {
    return { ok: false, error: "Seul un responsable de département peut demander un recrutement." };
  }

  const contractType = fdStr(formData, "contractType") ?? "";
  const draft = {
    position: fdStr(formData, "position") ?? "",
    headcount: Math.floor(fdNum(formData, "headcount") ?? 1),
    contractType,
    salaryMin: fdNum(formData, "salaryMin"),
    salaryMax: fdNum(formData, "salaryMax"),
    startDate: fdDate(formData, "startDate"),
    endDate: fdDate(formData, "endDate"),
  };
  const invalid = validateDraft(draft);
  if (invalid) return { ok: false, error: invalid };

  // LA CHAÎNE EST CALCULÉE AVANT D'ÉCRIRE. Sans elle, la demande naîtrait sans validateur : elle
  // ne serait ni refusée ni approuvée, simplement invisible de tout le monde.
  const chain = await buildChain(user.id);
  if (chain.length === 0) {
    return {
      ok: false,
      error: "Aucun responsable hiérarchique n'est renseigné au-dessus de vous : la demande ne "
        + "pourrait être validée par personne. Faites compléter l'organigramme par les RH.",
    };
  }

  const departmentId = fdStr(formData, "departmentId");
  const year = new Date().getFullYear();
  const created = await createWithRetry(async () => {
    const refs = await prisma.recruitmentRequest.findMany({
      where: { reference: { startsWith: `REC-${year}-` } }, select: { reference: true },
    });
    return prisma.recruitmentRequest.create({
      data: {
        reference: buildRef("REC", year, refs.map((r) => r.reference)),
        companyId: await companyIdForNew(user.id),
        departmentId,
        requesterId: user.id,
        position: draft.position.trim(),
        headcount: draft.headcount,
        contractType: contractType as ContractType,
        salaryMin: draft.salaryMin, salaryMax: draft.salaryMax,
        startDate: draft.startDate, endDate: draft.endDate,
        missions: fdStr(formData, "missions"),
        skills: fdStr(formData, "skills"),
        justification: fdStr(formData, "justification"),
        approvals: { create: chain.map((c, i) => ({ order: i + 1, approverId: c.approverId })) },
      },
      select: { id: true, reference: true },
    });
  });

  // La fiche de poste, s'il y en a une. Un échec de fichier ne défait PAS la demande : elle est
  // enregistrée, on dit ce qui n'a pas suivi.
  const files = await attachFormFiles(user.id, "RECRUITMENT_REQUEST", created.id, formData);

  await notifyUser({
    userId: chain[0].approverId,
    type: "GENERIC",
    title: "Demande de recrutement à valider",
    body: `${created.reference} — ${draft.position} · ${summarize({ ...draft, contractType })}`,
    link: `/recrutement/${created.id}`,
  });
  await recordAudit({
    actorId: user.id, action: "CREATE", module: "Recrutement",
    entityType: "RECRUITMENT_REQUEST", entityId: created.id,
    summary: `Demande ${created.reference} — ${draft.position} (${chain.length} marche(s) de validation)`,
  });

  revalidatePath("/recrutement");
  return files.failed.length
    ? { ok: true, id: created.id, message: `Demande enregistrée ; échec sur : ${files.failed.map((f) => f.name).join(", ")}.` }
    : { ok: true, id: created.id };
}

// ───────────────────────────── La chaîne hiérarchique ─────────────────────────────

export async function decideRecruitmentStep(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  const decision = fdStr(formData, "decision") === "REJECTED" ? "REJECTED" : "APPROVED";
  const reason = fdStr(formData, "reason");
  if (!id) return { ok: false, error: "Demande introuvable." };

  const viewer = await recruitmentViewer(user, id);
  if (!viewer) return { ok: false, error: "Cette demande n'est pas dans votre périmètre." };

  const req = await prisma.recruitmentRequest.findUnique({
    where: { id },
    select: {
      reference: true, position: true, stage: true, requesterId: true,
      approvals: { select: { order: true, approverId: true, status: true, approver: { select: { name: true } } } },
    },
  });
  if (!req) return { ok: false, error: "Demande introuvable." };

  const steps: ChainStep[] = req.approvals.map((a) => ({
    order: a.order, approverId: a.approverId, approverName: a.approver?.name ?? "", status: a.status,
  }));
  const allowed = canDecideStep(req.stage, steps, { userId: user.id, isTop: viewer.isTop });
  if (!allowed.ok) return { ok: false, error: allowed.reason ?? "Non autorisé." };

  // Le PDG tranche depuis SA marche s'il en a une, sinon depuis la dernière : c'est ce qui
  // marque les marches d'en dessous comme non consultées plutôt qu'approuvées en son nom.
  const own = steps.find((s) => s.approverId === user.id && s.status === "PENDING");
  const target = own ?? (viewer.isTop ? steps[steps.length - 1] : currentStep(steps));
  if (!target) return { ok: false, error: "Plus aucune marche en attente." };

  const { steps: nextSteps, outcome } = applyChainDecision(steps, target.order, decision);
  await prisma.$transaction([
    ...nextSteps
      .filter((s, i) => s.status !== steps[i].status)
      .map((s) => prisma.recruitmentApproval.update({
        where: { requestId_order: { requestId: id, order: s.order } },
        data: {
          status: s.status,
          decidedAt: new Date(),
          ...(s.order === target.order ? { reason } : {}),
        },
      })),
    prisma.recruitmentRequest.update({
      where: { id },
      data: { stage: outcome.stage, ...(outcome.stage === "REJECTED" ? { closingNote: reason, closedAt: new Date() } : {}) },
    }),
  ]);

  // On prévient CELUI QUI ATTEND : la marche suivante, ou les RH quand la chaîne est franchie,
  // ou le demandeur quand c'est un refus. Une notification à tout le monde n'aiderait personne.
  if (decision === "REJECTED") {
    await notifyUser({
      userId: req.requesterId, type: "GENERIC",
      title: "Demande de recrutement refusée",
      body: `${req.reference} — ${req.position}${reason ? ` · ${reason}` : ""}`,
      link: `/recrutement/${id}`,
    });
  } else if (outcome.complete) {
    await notifyRoles(rolesWithModule("RH", "UPDATE"), {
      type: "GENERIC",
      title: "Nouvelle demande de recrutement à instruire",
      body: `${req.reference} — ${req.position}`,
      link: `/recrutement/${id}`,
    });
  } else {
    const next = currentStep(nextSteps);
    if (next) {
      await notifyUser({
        userId: next.approverId, type: "GENERIC",
        title: "Demande de recrutement à valider",
        body: `${req.reference} — ${req.position}`,
        link: `/recrutement/${id}`,
      });
    }
  }

  await recordAudit({
    actorId: user.id, action: "UPDATE", module: "Recrutement",
    entityType: "RECRUITMENT_REQUEST", entityId: id,
    field: `Validation — marche ${target.order}`,
    oldValue: "PENDING", newValue: decision,
    summary: `${req.reference} — ${decision === "APPROVED" ? "validée" : "refusée"} par ${user.name}${reason ? ` · ${reason}` : ""}`,
  });
  revalidatePath("/recrutement");
  revalidatePath(`/recrutement/${id}`);
  return { ok: true, message: decision === "APPROVED" ? "Validée." : "Refusée." };
}

/** Retirer sa demande — tant que personne n'a tranché. */
export async function cancelRecruitmentRequest(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Demande introuvable." };
  const viewer = await recruitmentViewer(user, id);
  if (!viewer) return { ok: false, error: "Cette demande n'est pas dans votre périmètre." };

  const req = await prisma.recruitmentRequest.findUnique({
    where: { id },
    select: { reference: true, stage: true, approvals: { select: { status: true } } },
  });
  if (!req) return { ok: false, error: "Demande introuvable." };
  const untouched = req.approvals.every((a) => a.status === "PENDING");
  if (!abilities(req.stage, viewer, { chainUntouched: untouched }).cancel) {
    return { ok: false, error: "Un validateur s'est déjà prononcé : la demande ne peut plus être retirée." };
  }

  await prisma.recruitmentRequest.update({
    where: { id }, data: { stage: "CANCELLED", closedAt: new Date(), closingNote: fdStr(formData, "reason") },
  });
  await recordAudit({
    actorId: user.id, action: "UPDATE", module: "Recrutement",
    entityType: "RECRUITMENT_REQUEST", entityId: id,
    summary: `${req.reference} — demande retirée par son auteur`,
  });
  revalidatePath("/recrutement");
  revalidatePath(`/recrutement/${id}`);
  return { ok: true, message: "Demande retirée." };
}

// ───────────────────────────── Les RH : précisions, ouverture, refus ─────────────────────────────

export async function askRecruitmentInfo(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  const question = fdStr(formData, "question");
  if (!id || !question) return { ok: false, error: "Précisez ce que vous demandez." };

  const viewer = await recruitmentViewer(user, id);
  const req = viewer && await prisma.recruitmentRequest.findUnique({
    where: { id }, select: { reference: true, stage: true, requesterId: true, position: true },
  });
  if (!viewer || !req) return { ok: false, error: "Cette demande n'est pas dans votre périmètre." };
  if (!abilities(req.stage, viewer).askInfo) return { ok: false, error: "Non autorisé à cette étape." };

  await prisma.$transaction([
    prisma.recruitmentInfoRequest.create({ data: { requestId: id, askedById: user.id, question } }),
    // La demande RETOURNE au demandeur : tant qu'il n'a pas répondu, elle n'est plus dans la
    // file des RH — sinon ils la rouvriraient chaque jour sans que rien n'ait bougé.
    prisma.recruitmentRequest.update({ where: { id }, data: { stage: "INFO_REQUESTED" } }),
  ]);
  await notifyUser({
    userId: req.requesterId, type: "GENERIC",
    title: "Précisions demandées sur votre demande de recrutement",
    body: `${req.reference} — ${question}`,
    link: `/recrutement/${id}`,
  });
  await recordAudit({
    actorId: user.id, action: "UPDATE", module: "Recrutement",
    entityType: "RECRUITMENT_REQUEST", entityId: id,
    summary: `${req.reference} — précisions demandées : « ${question} »`,
  });
  revalidatePath(`/recrutement/${id}`);
  return { ok: true, message: "Question envoyée au demandeur." };
}

export async function answerRecruitmentInfo(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  const infoId = fdStr(formData, "infoId");
  const answer = fdStr(formData, "answer");
  if (!id || !infoId || !answer) return { ok: false, error: "Écrivez votre réponse." };

  const viewer = await recruitmentViewer(user, id);
  const req = viewer && await prisma.recruitmentRequest.findUnique({
    where: { id }, select: { reference: true, stage: true },
  });
  if (!viewer || !req) return { ok: false, error: "Cette demande n'est pas dans votre périmètre." };
  if (!abilities(req.stage, viewer).answerInfo) return { ok: false, error: "Non autorisé à cette étape." };

  const info = await prisma.recruitmentInfoRequest.findFirst({
    where: { id: infoId, requestId: id }, select: { id: true, askedById: true, question: true, answeredAt: true },
  });
  if (!info) return { ok: false, error: "Question introuvable." };

  await prisma.recruitmentInfoRequest.update({
    where: { id: infoId },
    data: { answer, answeredById: user.id, answeredAt: new Date() },
  });
  // Reste-t-il des questions sans réponse ? Tant qu'il y en a, la demande reste chez le
  // demandeur : la renvoyer aux RH à la première réponse leur ferait rouvrir un dossier
  // incomplet.
  const pending = await prisma.recruitmentInfoRequest.count({ where: { requestId: id, answeredAt: null } });
  if (pending === 0) {
    await prisma.recruitmentRequest.update({ where: { id }, data: { stage: "HR_REVIEW" } });
    await notifyUser({
      userId: info.askedById, type: "GENERIC",
      title: "Réponse à vos précisions — demande de recrutement",
      body: `${req.reference} — ${answer}`,
      link: `/recrutement/${id}`,
    });
  }
  await recordAudit({
    actorId: user.id, action: "UPDATE", module: "Recrutement",
    entityType: "RECRUITMENT_REQUEST", entityId: id,
    summary: `${req.reference} — réponse : « ${answer} »`,
  });
  revalidatePath(`/recrutement/${id}`);
  return { ok: true, message: pending === 0 ? "Réponse transmise aux RH." : "Réponse enregistrée." };
}

/** Les RH ouvrent le poste : la recherche de candidats commence. */
export async function openRecruitmentSourcing(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Demande introuvable." };
  const viewer = await recruitmentViewer(user, id);
  const req = viewer && await prisma.recruitmentRequest.findUnique({
    where: { id }, select: { reference: true, position: true, stage: true, requesterId: true },
  });
  if (!viewer || !req) return { ok: false, error: "Cette demande n'est pas dans votre périmètre." };
  if (!abilities(req.stage, viewer).openSourcing) return { ok: false, error: "Non autorisé à cette étape." };

  await prisma.recruitmentRequest.update({ where: { id }, data: { stage: "SOURCING" } });
  await notifyUser({
    userId: req.requesterId, type: "GENERIC",
    title: "Recrutement ouvert",
    body: `${req.reference} — ${req.position} : les RH ont ouvert le poste. Vous présélectionnerez les CV reçus.`,
    link: `/recrutement/${id}`,
  });
  await recordAudit({
    actorId: user.id, action: "UPDATE", module: "Recrutement",
    entityType: "RECRUITMENT_REQUEST", entityId: id,
    summary: `${req.reference} — poste ouvert par les RH`,
  });
  revalidatePath("/recrutement");
  revalidatePath(`/recrutement/${id}`);
  return { ok: true, message: "Poste ouvert — les CV peuvent être déposés." };
}

/** Les RH ferment la demande — refus motivé, ou clôture après recrutement. */
export async function closeRecruitmentRequest(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  const note = fdStr(formData, "note");
  const reject = fdStr(formData, "decision") === "REJECTED";
  if (!id) return { ok: false, error: "Demande introuvable." };
  const viewer = await recruitmentViewer(user, id);
  const req = viewer && await prisma.recruitmentRequest.findUnique({
    where: { id }, select: { reference: true, stage: true, requesterId: true },
  });
  if (!viewer || !req) return { ok: false, error: "Cette demande n'est pas dans votre périmètre." };

  const can = abilities(req.stage, viewer);
  if (reject ? !can.hrReject : !(viewer.isHr || viewer.isTop)) {
    return { ok: false, error: "Non autorisé à cette étape." };
  }
  if (!reject && req.stage !== "SOURCING" && req.stage !== "ONBOARDING") {
    return { ok: false, error: "Une demande ne se clôt qu'une fois le poste ouvert." };
  }

  await prisma.recruitmentRequest.update({
    where: { id },
    data: { stage: reject ? "REJECTED" : "CLOSED", closingNote: note, closedAt: new Date() },
  });
  await notifyUser({
    userId: req.requesterId, type: "GENERIC",
    title: reject ? "Demande de recrutement refusée par les RH" : "Recrutement clôturé",
    body: `${req.reference}${note ? ` — ${note}` : ""}`,
    link: `/recrutement/${id}`,
  });
  await recordAudit({
    actorId: user.id, action: "UPDATE", module: "Recrutement",
    entityType: "RECRUITMENT_REQUEST", entityId: id,
    summary: `${req.reference} — ${reject ? "refusée par les RH" : "clôturée"}${note ? ` · ${note}` : ""}`,
  });
  revalidatePath("/recrutement");
  revalidatePath(`/recrutement/${id}`);
  return { ok: true, message: reject ? "Demande refusée." : "Demande clôturée." };
}

// ───────────────────────────── Les candidats ─────────────────────────────

export async function addRecruitmentCandidate(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "requestId");
  const fullName = fdStr(formData, "fullName");
  if (!id || !fullName) return { ok: false, error: "Le nom du candidat est obligatoire." };

  const viewer = await recruitmentViewer(user, id);
  const req = viewer && await prisma.recruitmentRequest.findUnique({
    where: { id }, select: { reference: true, stage: true, requesterId: true },
  });
  if (!viewer || !req) return { ok: false, error: "Cette demande n'est pas dans votre périmètre." };
  if (!abilities(req.stage, viewer).addCandidate) {
    return { ok: false, error: "Les CV se déposent une fois le poste ouvert par les RH." };
  }

  const candidate = await prisma.recruitmentCandidate.create({
    data: {
      requestId: id, fullName,
      email: fdStr(formData, "email"), phone: fdStr(formData, "phone"),
      source: fdStr(formData, "source"), notes: fdStr(formData, "notes"),
      addedById: user.id,
    },
    select: { id: true },
  });
  const files = await attachFormFiles(user.id, "RECRUITMENT_CANDIDATE", candidate.id, formData);

  await notifyUser({
    userId: req.requesterId, type: "GENERIC",
    title: "CV reçu à présélectionner",
    body: `${req.reference} — ${fullName}`,
    link: `/recrutement/${id}`,
  });
  await recordAudit({
    actorId: user.id, action: "CREATE", module: "Recrutement",
    entityType: "RECRUITMENT_CANDIDATE", entityId: candidate.id,
    summary: `${req.reference} — CV reçu : ${fullName}`,
  });
  revalidatePath(`/recrutement/${id}`);
  return files.failed.length
    ? { ok: true, id: candidate.id, message: `Candidat ajouté ; échec sur : ${files.failed.map((f) => f.name).join(", ")}.` }
    : { ok: true, id: candidate.id };
}

/**
 * Faire avancer (ou écarter) un candidat.
 *
 * Une seule action pour tout le pipeline, parce que c'est une seule question — « où en est cette
 * personne ? » — et que chaque mouvement se gouverne par la MÊME table de droits. Quatre actions
 * séparées auraient fini par diverger sur qui a le droit de quoi.
 */
export async function moveRecruitmentCandidate(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const candidateId = fdStr(formData, "candidateId");
  const move = fdStr(formData, "move"); // SHORTLIST | UNSHORTLIST | SELECT | INTERVIEW | HIRE | DECLINE
  if (!candidateId || !move) return { ok: false, error: "Action inconnue." };

  const candidate = await prisma.recruitmentCandidate.findUnique({
    where: { id: candidateId },
    select: { id: true, requestId: true, fullName: true, status: true },
  });
  if (!candidate) return { ok: false, error: "Candidat introuvable." };

  const viewer = await recruitmentViewer(user, candidate.requestId);
  const req = viewer && await prisma.recruitmentRequest.findUnique({
    where: { id: candidate.requestId },
    select: { reference: true, stage: true, requesterId: true, contractType: true },
  });
  if (!viewer || !req) return { ok: false, error: "Cette demande n'est pas dans votre périmètre." };
  const can = abilities(req.stage, viewer);

  const now = new Date();
  let data: Record<string, unknown>;
  switch (move) {
    case "SHORTLIST":
      if (!can.shortlist) return { ok: false, error: "La présélection appartient au demandeur." };
      data = { status: "SHORTLISTED", shortlistedById: user.id, shortlistedAt: now };
      break;
    case "UNSHORTLIST":
      if (!can.shortlist) return { ok: false, error: "La présélection appartient au demandeur." };
      if (candidate.status !== "SHORTLISTED") return { ok: false, error: "Ce candidat n'est pas présélectionné." };
      data = { status: "RECEIVED", shortlistedById: null, shortlistedAt: null };
      break;
    case "SELECT":
      if (!can.select) return { ok: false, error: "Le choix final appartient à la direction générale." };
      // Présélectionné ou non : la présélection est un avis, pas un tri éliminatoire.
      if (!canSelectCandidate(candidate.status)) return { ok: false, error: "Ce candidat n'est plus en lice." };
      data = { status: "SELECTED", selectedById: user.id, selectedAt: now };
      break;
    case "INTERVIEW": {
      if (!can.interview) return { ok: false, error: "Non autorisé à cette étape." };
      const at = fdDate(formData, "interviewAt");
      data = { status: "INTERVIEWED", interviewAt: at ?? now, interviewNote: fdStr(formData, "interviewNote") };
      break;
    }
    case "HIRE":
      if (!can.hire) return { ok: false, error: "Le recrutement se prononce par la direction générale." };
      data = { status: "HIRED", decidedAt: now };
      break;
    case "DECLINE":
      if (!can.shortlist && !can.select && !can.interview) return { ok: false, error: "Non autorisé." };
      data = { status: "DECLINED", decidedAt: now };
      break;
    default:
      return { ok: false, error: "Action inconnue." };
  }

  await prisma.recruitmentCandidate.update({ where: { id: candidateId }, data });

  // Recruter quelqu'un fait basculer la DEMANDE en intégration : c'est le geste qui déclenche
  // la fiche employé (ou, pour un consulting, la simple prise en compte d'un externe).
  if (move === "HIRE") {
    await prisma.recruitmentRequest.update({ where: { id: candidate.requestId }, data: { stage: "ONBOARDING" } });
    await notifyRoles(rolesWithModule("RH", "UPDATE"), {
      type: "GENERIC",
      title: needsOnboarding(req.contractType as RecruitmentContract) ? "Intégration à préparer" : "Consultant externe retenu",
      body: `${req.reference} — ${candidate.fullName}`,
      link: `/recrutement/${candidate.requestId}`,
    });
  }
  if (move === "SELECT") {
    await notifyUser({
      userId: req.requesterId, type: "GENERIC",
      title: "Candidat retenu par la direction",
      body: `${req.reference} — ${candidate.fullName}`,
      link: `/recrutement/${candidate.requestId}`,
    });
  }

  await recordAudit({
    actorId: user.id, action: "UPDATE", module: "Recrutement",
    entityType: "RECRUITMENT_CANDIDATE", entityId: candidateId,
    field: "Statut", oldValue: candidate.status, newValue: String(data.status),
    summary: `${req.reference} — ${candidate.fullName} : ${String(data.status)}`,
  });
  revalidatePath(`/recrutement/${candidate.requestId}`);
  return { ok: true };
}

// ───────────────────────────── L'intégration ─────────────────────────────

/**
 * CRÉER LA FICHE EMPLOYÉ à partir de la candidature retenue.
 *
 * Elle est PRÉ-REMPLIE depuis la demande (département, entité, contrat, dates, rémunération) et
 * depuis le candidat (nom, courriel, téléphone) : ressaisir ce qui est déjà écrit, c'est
 * introduire des écarts entre le poste demandé et le poste créé.
 *
 * ⚠️ PAS POUR UN CONSULTING. Un consultant est un intervenant EXTERNE : lui créer une fiche
 * employé le ferait entrer dans la masse salariale, dans les congés et dans l'organigramme —
 * trois endroits où il n'a rien à faire, et trois faux chiffres. La demande se clôt alors sans
 * fiche, et c'est la bonne fin.
 */
export async function onboardRecruitment(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Demande introuvable." };

  const viewer = await recruitmentViewer(user, id);
  const req = viewer && await prisma.recruitmentRequest.findUnique({
    where: { id },
    select: {
      reference: true, stage: true, position: true, contractType: true, companyId: true,
      departmentId: true, startDate: true, endDate: true, salaryMin: true,
      department: { select: { name: true } },
      candidates: { where: { status: "HIRED" }, select: { id: true, fullName: true, email: true, phone: true, employeeId: true } },
    },
  });
  if (!viewer || !req) return { ok: false, error: "Cette demande n'est pas dans votre périmètre." };

  const hired = req.candidates[0];
  if (!abilities(req.stage, viewer, { hasHire: Boolean(hired) }).onboard) {
    return { ok: false, error: "L'intégration se prépare une fois un candidat recruté." };
  }
  if (!hired) return { ok: false, error: "Aucun candidat recruté sur cette demande." };
  if (hired.employeeId) return { ok: false, error: "La fiche employé existe déjà." };

  const contract = req.contractType as RecruitmentContract;
  if (!needsOnboarding(contract)) {
    // Un consultant externe : on clôt, sans inventer un salarié.
    await prisma.recruitmentRequest.update({
      where: { id },
      data: {
        stage: "CLOSED", closedAt: new Date(),
        closingNote: `${hired.fullName} — consultant externe (pas de fiche employé).`,
      },
    });
    await recordAudit({
      actorId: user.id, action: "UPDATE", module: "Recrutement",
      entityType: "RECRUITMENT_REQUEST", entityId: id,
      summary: `${req.reference} — ${hired.fullName} retenu comme consultant EXTERNE : aucune fiche employé, hors effectif et hors paie`,
    });
    revalidatePath("/recrutement");
    revalidatePath(`/recrutement/${id}`);
    return { ok: true, message: "Consultant externe enregistré — aucune fiche employé créée." };
  }

  const employee = await prisma.employee.create({
    data: {
      fullName: hired.fullName,
      position: req.position,
      companyId: req.companyId,
      departmentId: req.departmentId,
      department: req.department?.name ?? null,
      email: hired.email, phone: hired.phone,
      contractType: req.contractType,
      contractStart: req.startDate, contractEnd: req.endDate,
      hireDate: req.startDate,
      // La borne BASSE de la fourchette, pas la haute : c'est l'hypothèse prudente, et le
      // salaire réel se fixe au contrat — que les RH saisiront sur la fiche.
      baseSalary: req.salaryMin ?? 0,
      isActive: true,
      notes: `Recruté via la demande ${req.reference}.`,
    },
    select: { id: true },
  });

  await prisma.$transaction([
    prisma.recruitmentCandidate.update({ where: { id: hired.id }, data: { employeeId: employee.id } }),
    prisma.recruitmentRequest.update({
      where: { id },
      data: { stage: "CLOSED", closedAt: new Date(), closingNote: `${hired.fullName} recruté — fiche employé créée.` },
    }),
  ]);
  await recordAudit({
    actorId: user.id, action: "CREATE", module: "Recrutement",
    entityType: "EMPLOYEE", entityId: employee.id,
    summary: `${req.reference} — fiche employé créée pour ${hired.fullName} (${CONTRACT_LABEL[contract]}, ${req.position})`,
  });
  revalidatePath("/recrutement");
  revalidatePath(`/recrutement/${id}`);
  revalidatePath("/rh");
  return {
    ok: true, id: employee.id,
    message: "Fiche employé créée. Complétez-la (salaire réel, état civil, compte applicatif) depuis les RH.",
  };
}
