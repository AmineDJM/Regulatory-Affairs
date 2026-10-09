"use server";

import { revalidatePath } from "next/cache";
import type { EntityType, MissionRole, Prisma } from "@prisma/client";
import { requireUser } from "@/lib/session";
import { canAccessEntity } from "@/lib/entity-access";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { notifyUser, notifyRoles } from "@/lib/notify";
import { rolesWithModule } from "@/lib/rbac";
import { getManagerOf, getManagementChain } from "@/lib/departments";
import { fdStr, fdNum, fdDate, type ActionResult } from "@/lib/actions/types";
import { refusRetraitOrdreMission, refusAnnulationDemandeRh } from "@/lib/annulations/regles";
import { requestHrDocument } from "@/lib/actions/hr-document-actions";
import { createRequest } from "@/lib/actions/admin-request-actions";
import { demanderMateriel } from "@/lib/actions/promo-stock-actions";
import { addAdProItem } from "@/lib/actions/ad-pro-item-actions";
import { MES_MISSIONS, PARENT_TYPES, parentPath, parentMission } from "@/lib/missions-equipe/serveur";
import {
  refusReponse, peutRelancerInvitation, retraitSouple, refusAjoutEtape, etatOrdreMission, peutDemanderOrdre,
  peutRetirerOrdre, marcheInitiale, refusDecisionN1, noteFraisOuverte, jourIso, objetOrdreMission,
  refusMontantFrais, demandeRelancable, SOUS_TYPE_SECRETARIAT, LIBELLE_ETAPE,
  type HrStatut, type GateN1, type ReponseMission,
} from "@/lib/missions-equipe/etat";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LES MISSIONS AD & PRO RELIÉES AU PROFIL (Direction, 10/2026).
 *
 * Assigner = INVITER : la personne confirme ou décline (motif). Une mission confirmée se vit dans
 * « Mon espace › Mes missions » : l'ordre de mission (circuit RH unique, précédé du N+1), et — SEULEMENT
 * si la personne les ajoute — transport et hébergement (demande au secrétariat), matériel promotionnel
 * (demande au magasin), note de frais (demande RH). Chaque demande part dans SON circuit réel, reliée à
 * l'assignation ; rien n'est recopié ici.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const MISSION_ROLES: MissionRole[] = ["ACCOMPAGNANT", "DELEGATE_REFERENCE"];

function revalider(entityType: EntityType, entityId: string): void {
  revalidatePath(parentPath(entityType, entityId));
  revalidatePath(MES_MISSIONS);
  revalidatePath("/missions");
}

const dates = (d: Date | null, f: Date | null) =>
  d ? ` · ${d.toLocaleDateString("fr-FR")}${f && f.getTime() !== d.getTime() ? ` → ${f.toLocaleDateString("fr-FR")}` : ""}` : "";

/**
 * INVITER — créer l'assignation, ou rouvrir celle d'une personne qui avait décliné ou été retirée
 * (une seule ligne par personne et par demande). On ne s'invite pas soi-même : on se confirme.
 */
async function inviter(
  actor: { id: string; name: string },
  entityType: EntityType, entityId: string, userId: string, role: MissionRole,
  opts: { note: string | null; dateDepart: Date | null; dateRetour: Date | null; ville: string | null },
): Promise<ActionResult> {
  const parent = await parentMission(entityType, entityId);
  const dateDepart = opts.dateDepart ?? parent.debut;
  const dateRetour = opts.dateRetour ?? parent.fin;
  const ville = opts.ville ?? parent.ville;
  const soi = userId === actor.id;
  const response: ReponseMission = soi ? "CONFIRMEE" : "INVITEE";
  const existante = await prisma.missionAssignment.findUnique({
    where: { entityType_entityId_userId: { entityType, entityId, userId } },
    select: { id: true, archivedAt: true, response: true },
  });
  if (existante && !existante.archivedAt && existante.response !== "DECLINEE") {
    return { ok: false, error: "Cette personne fait déjà partie de l'équipe." };
  }
  const data = {
    role, note: opts.note, createdById: actor.id, response, respondedAt: soi ? new Date() : null, declineReason: null,
    dateDepart, dateRetour, ville, lastNudgeAt: null, nudgeCount: 0, archivedAt: null, archivedById: null,
  };
  const a = existante
    ? await prisma.missionAssignment.update({ where: { id: existante.id }, data: { ...data, createdAt: new Date() }, select: { id: true } })
    : await prisma.missionAssignment.create({ data: { entityType, entityId, userId, ...data }, select: { id: true } });
  if (!soi) {
    await notifyUser({
      userId, type: "ASSIGNMENT",
      title: role === "DELEGATE_REFERENCE" ? "Invitation — délégué de référence" : "Invitation — accompagnant",
      body: `${parent.label}${ville ? ` · ${ville}` : ""}${dates(dateDepart, dateRetour)} — par ${actor.name}. Confirmez ou déclinez.`,
      link: MES_MISSIONS,
    }).catch(() => undefined);
  }
  await recordAudit({ actorId: actor.id, action: "CREATE", module: "Congrès", entityType: "MISSION_ASSIGNMENT", entityId: a.id, summary: `Invitation (${role}) sur ${parent.label}` });
  return { ok: true, id: a.id };
}

/** Inviter un accompagnant ou un délégué de référence (organisateur de la demande). */
export async function assignMission(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const entityType = fdStr(formData, "entityType") as EntityType | null;
  const entityId = fdStr(formData, "entityId");
  const userId = fdStr(formData, "userId");
  if (!entityType || !PARENT_TYPES.includes(entityType) || !entityId || !userId) return { ok: false, error: "Paramètres manquants." };
  if (!(await canAccessEntity(user, entityType, entityId, "UPDATE"))) return { ok: false, error: "Action non autorisée." };
  const cible = await prisma.user.findFirst({ where: { id: userId, isActive: true }, select: { id: true } });
  if (!cible) return { ok: false, error: "Cette personne n'est plus active." };

  const roleRaw = fdStr(formData, "role") as MissionRole | null;
  const role: MissionRole = roleRaw && MISSION_ROLES.includes(roleRaw) ? roleRaw : "ACCOMPAGNANT";
  const r = await inviter(user, entityType, entityId, userId, role, {
    note: fdStr(formData, "note"), dateDepart: fdDate(formData, "dateDepart"), dateRetour: fdDate(formData, "dateRetour"), ville: fdStr(formData, "ville"),
  });
  revalider(entityType, entityId);
  return r;
}

async function chargerAssignation(id: string | null) {
  if (!id) return null;
  return prisma.missionAssignment.findUnique({ where: { id } });
}

/** « Je confirme » / « Je décline » — la personne invitée ; décliner porte un motif et prévient l'organisateur. */
export async function repondreMission(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const a = await chargerAssignation(fdStr(formData, "id"));
  if (!a) return { ok: false, error: "Mission introuvable." };
  const decision = fdStr(formData, "decision") === "DECLINER" ? "DECLINER" : "CONFIRMER";
  const motif = fdStr(formData, "motif");
  const refus = refusReponse(a, user.id, decision, motif);
  if (refus) return { ok: false, error: refus };

  const response: ReponseMission = decision === "CONFIRMER" ? "CONFIRMEE" : "DECLINEE";
  const pris = await prisma.missionAssignment.updateMany({
    where: { id: a.id, response: a.response, archivedAt: null },
    data: { response, respondedAt: new Date(), declineReason: decision === "DECLINER" ? motif : null },
  });
  if (pris.count === 0) return { ok: false, error: "La mission vient de changer — rechargez la page." };
  const parent = await parentMission(a.entityType, a.entityId);
  if (a.createdById && a.createdById !== user.id) {
    await notifyUser({
      userId: a.createdById, type: "GENERIC",
      title: decision === "CONFIRMER" ? "Mission confirmée" : "Mission déclinée",
      body: decision === "CONFIRMER" ? `${user.name} — ${parent.label}` : `${user.name} — ${parent.label} : « ${motif} ». Remplacez-le depuis la demande.`,
      link: parentPath(a.entityType, a.entityId),
    }).catch(() => undefined);
  }
  await recordAudit({
    actorId: user.id, action: "UPDATE", module: "Congrès", entityType: "MISSION_ASSIGNMENT", entityId: a.id,
    field: "response", oldValue: a.response, newValue: response,
    summary: decision === "CONFIRMER" ? `Mission confirmée — ${parent.label}` : `Mission déclinée — ${parent.label} (${motif})`,
  });
  revalider(a.entityType, a.entityId);
  return { ok: true, message: decision === "CONFIRMER" ? "Mission confirmée." : "Mission déclinée : l'organisateur est prévenu." };
}

/** Relancer une invitation sans réponse (organisateur) — la règle des tâches : quatre heures entre deux. */
export async function relancerMission(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const a = await chargerAssignation(fdStr(formData, "id"));
  if (!a) return { ok: false, error: "Mission introuvable." };
  if (!(await canAccessEntity(user, a.entityType, a.entityId, "UPDATE"))) return { ok: false, error: "Action non autorisée." };
  const v = peutRelancerInvitation(a);
  if (!v.ok) return { ok: false, error: v.raison };
  const rang = a.nudgeCount + 1;
  await prisma.missionAssignment.update({ where: { id: a.id }, data: { lastNudgeAt: new Date(), nudgeCount: rang } });
  const parent = await parentMission(a.entityType, a.entityId);
  await notifyUser({
    userId: a.userId, type: "ASSIGNMENT",
    title: rang <= 1 ? "Relance — invitation à une mission" : `Relance (${rang}ᵉ) — invitation à une mission`,
    body: `${parent.label} — ${user.name} attend votre réponse.`, link: MES_MISSIONS,
    push: { requireInteraction: true },
  }).catch(() => undefined);
  await recordAudit({ actorId: user.id, action: "UPDATE", module: "Congrès", entityType: "MISSION_ASSIGNMENT", entityId: a.id, field: "relance", newValue: String(rang), summary: `Relance ${rang} — ${parent.label}` });
  revalider(a.entityType, a.entityId);
  return { ok: true, message: "Relance envoyée." };
}

/** Les traces qui interdisent l'effacement : pièces, fil, demandes reliées. */
async function tracesDe(id: string) {
  const [documents, commentaires, rh, secretariat, materiel] = await Promise.all([
    prisma.document.count({ where: { entityType: "MISSION_ASSIGNMENT", entityId: id } }),
    prisma.comment.count({ where: { entityType: "MISSION_ASSIGNMENT", entityId: id } }),
    prisma.hrDocumentRequest.count({ where: { missionAssignmentId: id } }),
    prisma.administrativeRequest.count({ where: { linkedEntityType: "MISSION_ASSIGNMENT", linkedEntityId: id } }),
    prisma.promoStockRequest.count({ where: { missionAssignmentId: id } }),
  ]);
  return { documents, commentaires, demandes: rh + secretariat + materiel };
}

/** Retirer sans effacer ce qui a eu lieu : archive si traces, effacement sinon. */
async function retirer(a: { id: string; userId: string; entityType: EntityType; entityId: string }, actor: { id: string; name: string }, motif: string): Promise<"archivee" | "effacee"> {
  const souple = retraitSouple(await tracesDe(a.id));
  if (souple) {
    await prisma.missionAssignment.update({ where: { id: a.id }, data: { archivedAt: new Date(), archivedById: actor.id } });
  } else {
    await prisma.missionAssignment.delete({ where: { id: a.id } });
  }
  const parent = await parentMission(a.entityType, a.entityId);
  if (a.userId !== actor.id) {
    await notifyUser({ userId: a.userId, type: "GENERIC", title: "Mission retirée", body: `${parent.label} — ${motif}`, link: MES_MISSIONS }).catch(() => undefined);
  }
  await recordAudit({ actorId: actor.id, action: souple ? "UPDATE" : "DELETE", module: "Congrès", entityType: "MISSION_ASSIGNMENT", entityId: a.id, summary: `Mission retirée (${souple ? "archivée" : "effacée"}) — ${parent.label}` });
  return souple ? "archivee" : "effacee";
}

/** Retirer une personne de l'équipe (organisateur) — archivée si elle porte des pièces ou des demandes. */
export async function removeMission(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const a = await chargerAssignation(fdStr(formData, "id"));
  if (!a) return { ok: false, error: "Assignation introuvable." };
  if (!(await canAccessEntity(user, a.entityType, a.entityId, "UPDATE"))) return { ok: false, error: "Action non autorisée." };
  const r = await retirer(a, user, `${user.name} vous a retiré de l'équipe.`);
  revalider(a.entityType, a.entityId);
  return { ok: true, message: r === "archivee" ? "Retiré — la mission est archivée avec ses pièces et ses demandes." : "Retiré de l'équipe." };
}

/** Remplacer une personne (typiquement après un refus) : l'ancienne sort, la nouvelle est invitée au même rôle. */
export async function remplacerMission(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const a = await chargerAssignation(fdStr(formData, "id"));
  const userId = fdStr(formData, "userId");
  if (!a) return { ok: false, error: "Assignation introuvable." };
  if (!userId) return { ok: false, error: "Choisissez la personne qui remplace." };
  if (userId === a.userId) return { ok: false, error: "Choisissez une autre personne." };
  if (!(await canAccessEntity(user, a.entityType, a.entityId, "UPDATE"))) return { ok: false, error: "Action non autorisée." };
  const cible = await prisma.user.findFirst({ where: { id: userId, isActive: true }, select: { id: true } });
  if (!cible) return { ok: false, error: "Cette personne n'est plus active." };
  const r = await inviter(user, a.entityType, a.entityId, userId, a.role, { note: a.note, dateDepart: a.dateDepart, dateRetour: a.dateRetour, ville: a.ville });
  if (!r.ok) return r;
  await retirer(a, user, "vous êtes remplacé dans l'équipe.");
  revalider(a.entityType, a.entityId);
  return { ok: true, message: "Remplacement envoyé : la nouvelle personne est invitée." };
}

/** Dates et ville de la mission — l'organisateur, ou la personne elle-même. */
export async function modifierMission(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const a = await chargerAssignation(fdStr(formData, "id"));
  if (!a || a.archivedAt) return { ok: false, error: "Mission introuvable." };
  if (a.userId !== user.id && !(await canAccessEntity(user, a.entityType, a.entityId, "UPDATE"))) return { ok: false, error: "Action non autorisée." };
  const dateDepart = fdDate(formData, "dateDepart");
  const dateRetour = fdDate(formData, "dateRetour");
  if (dateDepart && dateRetour && dateRetour < dateDepart) return { ok: false, error: "Le retour précède le départ." };
  await prisma.missionAssignment.update({ where: { id: a.id }, data: { dateDepart, dateRetour, ville: fdStr(formData, "ville") } });
  await recordAudit({ actorId: user.id, action: "UPDATE", module: "Congrès", entityType: "MISSION_ASSIGNMENT", entityId: a.id, summary: "Dates / ville de la mission modifiées" });
  revalider(a.entityType, a.entityId);
  return { ok: true, message: "Mission mise à jour." };
}

/** « ⋯ › Ajouter » — une étape facultative que la personne choisit de demander. */
export async function ajouterEtapeMission(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const a = await chargerAssignation(fdStr(formData, "id"));
  if (!a) return { ok: false, error: "Mission introuvable." };
  if (a.userId !== user.id) return { ok: false, error: "Seule la personne en mission ajoute ses étapes." };
  const etape = fdStr(formData, "etape");
  const refus = refusAjoutEtape(a, etape);
  if (refus) return { ok: false, error: refus };
  if (!a.etapes.includes(etape!)) {
    await prisma.missionAssignment.update({ where: { id: a.id }, data: { etapes: { push: etape! } } });
  }
  revalidatePath(MES_MISSIONS);
  return { ok: true };
}

/** Retirer une étape ajoutée par erreur — tant qu'aucune demande n'y est partie. */
export async function retirerEtapeMission(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const a = await chargerAssignation(fdStr(formData, "id"));
  if (!a) return { ok: false, error: "Mission introuvable." };
  if (a.userId !== user.id) return { ok: false, error: "Seule la personne en mission retire ses étapes." };
  const etape = fdStr(formData, "etape");
  await prisma.missionAssignment.update({ where: { id: a.id }, data: { etapes: a.etapes.filter((e) => e !== etape) } });
  revalidatePath(MES_MISSIONS);
  return { ok: true };
}

// ─────────────────────────────── L'ordre de mission (N+1 → RH) ───────────────────────────────

async function dernierOrdre(assignmentId: string) {
  return prisma.hrDocumentRequest.findFirst({
    where: { missionAssignmentId: assignmentId, type: "MISSION_ORDER" },
    orderBy: { createdAt: "desc" },
    select: { id: true, status: true, managerGate: true, managerUserId: true },
  });
}

/**
 * « Demander l'ordre de mission » — UNE demande RH (MISSION_ORDER), pré-remplie depuis la mission,
 * qui monte d'abord au N+1 (organigramme) puis aux RH, où le générateur existant produit le PDF.
 */
export async function requestMissionOrder(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const a = await chargerAssignation(fdStr(formData, "id"));
  if (!a || a.archivedAt) return { ok: false, error: "Assignation introuvable." };
  if (a.userId !== user.id) return { ok: false, error: "Seule la personne assignée peut demander un ordre de mission." };
  if (a.response !== "CONFIRMEE") return { ok: false, error: "Confirmez d'abord la mission." };
  const precedent = await dernierOrdre(a.id);
  const etat = etatOrdreMission(precedent ? { status: precedent.status as HrStatut, managerGate: (precedent.managerGate ?? null) as GateN1 | null } : null, a.orderStatus);
  if (!peutDemanderOrdre(etat)) return { ok: false, error: etat === "EMIS" ? "L'ordre de mission est déjà émis." : "Un ordre de mission est déjà en cours." };

  const employee = await prisma.employee.findUnique({ where: { userId: user.id }, select: { id: true, fullName: true } });
  if (!employee) return { ok: false, error: "Aucun dossier RH n'est lié à votre compte : les RH ne peuvent pas établir l'ordre. Contactez-les." };
  const manager = await getManagerOf(employee.id).catch(() => null);
  const marche = marcheInitiale(manager?.userId ?? null, user.id);

  const parent = await parentMission(a.entityType, a.entityId);
  const depart = a.dateDepart ?? parent.debut;
  const retour = a.dateRetour ?? parent.fin;
  const ville = a.ville ?? parent.ville;
  const omPrefill = {
    libelle: parent.label,
    objet: objetOrdreMission(a.role, parent.label),
    destination: ville ?? "",
    datesDepart: depart ? [jourIso(depart)] : [],
    datesRetour: retour ? [jourIso(retour)] : [],
  } satisfies Prisma.InputJsonObject;

  const created = await prisma.hrDocumentRequest.create({
    data: {
      employeeId: employee.id, type: "MISSION_ORDER", status: "PENDING",
      details: `Mission — ${parent.label}${ville ? ` · ${ville}` : ""}${dates(depart, retour)}`,
      missionAssignmentId: a.id, managerGate: marche.gate, managerUserId: marche.gate ? manager?.userId ?? null : null,
      omPrefill,
    },
    select: { id: true },
  });
  await prisma.missionAssignment.update({ where: { id: a.id }, data: { orderStatus: "REQUESTED", requestedAt: new Date() } });

  if (marche.gate === "PENDING" && manager?.userId) {
    await notifyUser({ userId: manager.userId, type: "GENERIC", title: "Ordre de mission à valider (votre équipe)", body: `${employee.fullName} — ${parent.label}${dates(depart, retour)}`, link: `${MES_MISSIONS}#a-valider` }).catch(() => undefined);
  } else {
    await notifyRoles(rolesWithModule("HR_REQUESTS", "UPDATE"), { type: "GENERIC", title: "Ordre de mission à établir", body: `${employee.fullName} — ${parent.label}`, link: `/rh/demandes?demande=${created.id}` }).catch(() => undefined);
  }
  await recordAudit({ actorId: user.id, action: "CREATE", module: "RH", entityType: "MISSION_ASSIGNMENT", entityId: a.id, summary: `Ordre de mission demandé — ${parent.label}${marche.gate ? " (N+1 puis RH)" : " (directement aux RH)"}` });
  revalider(a.entityType, a.entityId);
  revalidatePath("/mon-dossier");
  revalidatePath("/rh/demandes");
  return { ok: true, id: created.id, message: marche.message };
}

/**
 * RETIRER SA DEMANDE D'ORDRE DE MISSION (décision du 04/10) — tant que les RH ne l'ont pas produite :
 * la demande RH liée est annulée. Une demande d'avant le circuit (simple marqueur) revient à « aucun ».
 */
export async function retirerDemandeOrdreMission(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const a = await chargerAssignation(fdStr(formData, "id"));
  if (!a) return { ok: false, error: "Assignation introuvable." };
  if (a.userId !== user.id) return { ok: false, error: "Seule la personne assignée retire sa demande d'ordre de mission." };
  const req = await dernierOrdre(a.id);
  if (req) {
    const etat = etatOrdreMission({ status: req.status as HrStatut, managerGate: (req.managerGate ?? null) as GateN1 | null }, a.orderStatus);
    if (!peutRetirerOrdre(etat)) return { ok: false, error: etat === "EMIS" ? "L'ordre de mission a déjà été émis : il ne se retire plus d'ici." : "Aucun ordre de mission n'est en cours." };
    const refus = refusAnnulationDemandeRh(req.status);
    if (refus) return { ok: false, error: refus };
    const pris = await prisma.hrDocumentRequest.updateMany({ where: { id: req.id, status: { in: ["PENDING", "IN_PROGRESS"] } }, data: { status: "CANCELLED", hrNote: "Retirée par le salarié depuis « Mes missions »." } });
    if (pris.count === 0) return { ok: false, error: "L'ordre de mission vient d'être traité — rechargez la page." };
    if (req.managerGate === "PENDING" && req.managerUserId) {
      await notifyUser({ userId: req.managerUserId, type: "GENERIC", title: "Ordre de mission retiré", body: `${user.name} a retiré sa demande : plus rien à valider.`, link: MES_MISSIONS }).catch(() => undefined);
    }
  } else {
    const refus = refusRetraitOrdreMission(a.orderStatus);
    if (refus) return { ok: false, error: refus };
  }
  await prisma.missionAssignment.updateMany({ where: { id: a.id, orderStatus: "REQUESTED" }, data: { orderStatus: "NONE", requestedAt: null } });
  const parent = await parentMission(a.entityType, a.entityId);
  await recordAudit({
    actorId: user.id, action: "UPDATE", module: "Congrès", entityType: "MISSION_ASSIGNMENT", entityId: a.id,
    field: "orderStatus", oldValue: "REQUESTED", newValue: "NONE",
    summary: `Demande d'ordre de mission retirée — ${parent.label}`,
  });
  revalider(a.entityType, a.entityId);
  revalidatePath("/rh/demandes");
  return { ok: true, message: "Demande d'ordre de mission retirée." };
}

/**
 * LA MARCHE DU N+1 — valider (l'ordre part aux RH) ou refuser (motif ; la personne est prévenue).
 * Le N+1 enregistré, ou toute personne au-dessus dans la chaîne ACTUELLE (mutation, départ).
 */
export async function deciderOrdreMissionN1(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "requestId");
  if (!id) return { ok: false, error: "Demande introuvable." };
  const req = await prisma.hrDocumentRequest.findUnique({
    where: { id },
    select: { id: true, type: true, status: true, managerGate: true, managerUserId: true, employeeId: true, missionAssignmentId: true, details: true, employee: { select: { fullName: true, userId: true } } },
  });
  if (!req) return { ok: false, error: "Demande introuvable." };
  let estN1 = req.managerUserId === user.id;
  if (!estN1) {
    const chaine = await getManagementChain(req.employeeId).catch(() => []);
    estN1 = chaine.some((m) => m.userId === user.id) && req.employee.userId !== user.id;
  }
  const decision = fdStr(formData, "decision") === "REFUSER" ? "REFUSER" : "VALIDER";
  const motif = fdStr(formData, "motif");
  const refus = refusDecisionN1({ type: req.type, status: req.status as HrStatut, managerGate: (req.managerGate ?? null) as GateN1 | null }, estN1, decision, motif);
  if (refus) return { ok: false, error: refus };

  const pris = await prisma.hrDocumentRequest.updateMany({
    where: { id, managerGate: "PENDING", status: "PENDING" },
    data: decision === "VALIDER"
      ? { managerGate: "APPROVED", managerDecidedAt: new Date(), managerNote: motif }
      : { managerGate: "REJECTED", managerDecidedAt: new Date(), managerNote: motif, status: "REJECTED" },
  });
  if (pris.count === 0) return { ok: false, error: "Cet ordre de mission vient d'être traité — rechargez la page." };
  if (decision === "REFUSER" && req.missionAssignmentId) {
    await prisma.missionAssignment.updateMany({ where: { id: req.missionAssignmentId, orderStatus: "REQUESTED" }, data: { orderStatus: "NONE" } });
  }
  if (req.employee.userId) {
    await notifyUser({
      userId: req.employee.userId, type: "GENERIC",
      title: decision === "VALIDER" ? "Ordre de mission validé par votre N+1" : "Ordre de mission refusé par votre N+1",
      body: decision === "VALIDER" ? "Il part aux RH, qui l'établissent." : `Motif : ${motif}`,
      link: MES_MISSIONS,
    }).catch(() => undefined);
  }
  if (decision === "VALIDER") {
    await notifyRoles(rolesWithModule("HR_REQUESTS", "UPDATE"), { type: "GENERIC", title: "Ordre de mission à établir", body: `${req.employee.fullName} — validé par le N+1`, link: `/rh/demandes?demande=${id}` }).catch(() => undefined);
  }
  await recordAudit({
    actorId: user.id, action: decision === "VALIDER" ? "VALIDATE" : "REFUSE", module: "RH", entityType: "EMPLOYEE", entityId: req.employeeId,
    summary: `Ordre de mission ${decision === "VALIDER" ? "validé" : "refusé"} par le N+1 — ${req.employee.fullName}${motif ? ` (${motif})` : ""}`,
  });
  revalidatePath(MES_MISSIONS);
  revalidatePath("/mon-equipe");
  revalidatePath("/rh/demandes");
  return { ok: true, message: decision === "VALIDER" ? "Validé : l'ordre part aux RH." : "Refusé : la personne est prévenue." };
}

/**
 * Le responsable émet l'ordre de mission À L'ANCIENNE (simple marqueur) — gardé pour l'assistant et les
 * missions d'avant le circuit RH ; l'écran ne le propose plus (l'ordre se produit chez les RH).
 */
export async function issueMissionOrder(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const a = await chargerAssignation(fdStr(formData, "id"));
  if (!a) return { ok: false, error: "Assignation introuvable." };
  if (!(await canAccessEntity(user, a.entityType, a.entityId, "UPDATE"))) return { ok: false, error: "Action non autorisée." };

  await prisma.missionAssignment.update({ where: { id: a.id }, data: { orderStatus: "ISSUED", issuedAt: new Date(), issuedById: user.id } });
  const parent = await parentMission(a.entityType, a.entityId);
  if (a.userId !== user.id) {
    await notifyUser({ userId: a.userId, type: "ASSIGNMENT", title: "Ordre de mission émis", body: parent.label, link: MES_MISSIONS });
  }
  await recordAudit({ actorId: user.id, action: "UPDATE", module: "Congrès", entityType: "MISSION_ASSIGNMENT", entityId: a.id, summary: `Ordre de mission émis — ${parent.label}` });
  revalider(a.entityType, a.entityId);
  return { ok: true };
}

// ─────────────────────────────── Les étapes facultatives, dans leurs circuits ───────────────────────────────

/** Une mission confirmée, la sienne, active — la porte de toutes les étapes. */
async function maMissionConfirmee(id: string | null, userId: string) {
  const a = await chargerAssignation(id);
  if (!a || a.archivedAt) return { erreur: "Mission introuvable." } as const;
  if (a.userId !== userId) return { erreur: "Seule la personne en mission fait ses demandes." } as const;
  if (a.response !== "CONFIRMEE") return { erreur: "Confirmez d'abord la mission." } as const;
  return { a } as const;
}

/**
 * TRANSPORT / HÉBERGEMENT — une demande « Déplacement / Hôtel / Billet » au Bureau du secrétariat, la
 * personne concernée étant celle en mission, reliée à l'assignation (pré-remplie : ville, dates).
 */
export async function demanderLogistiqueMission(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const m = await maMissionConfirmee(fdStr(formData, "id"), user.id);
  if ("erreur" in m) return { ok: false, error: m.erreur };
  const a = m.a;
  const etape = fdStr(formData, "etape") === "HEBERGEMENT" ? "HEBERGEMENT" : "TRANSPORT";
  const deja = await prisma.administrativeRequest.findFirst({
    where: { linkedEntityType: "MISSION_ASSIGNMENT", linkedEntityId: a.id, subtype: SOUS_TYPE_SECRETARIAT[etape], deletedAt: null },
    orderBy: { createdAt: "desc" }, select: { status: true },
  });
  if (deja && !demandeRelancable(deja.status)) return { ok: false, error: `Une demande de ${LIBELLE_ETAPE[etape].toLowerCase()} est déjà en cours.` };

  const parent = await parentMission(a.entityType, a.entityId);
  const ville = fdStr(formData, "ville") ?? a.ville ?? parent.ville;
  const fd = new FormData();
  fd.set("type", "TRAVEL");
  fd.set("title", `${LIBELLE_ETAPE[etape]} — ${parent.label}${ville ? ` (${ville})` : ""}`);
  fd.set("description", [fdStr(formData, "details"), `Mission Ad & Pro : ${parent.label}.`].filter(Boolean).join("\n"));
  fd.set("concernedUserId", user.id);
  const depart = fdStr(formData, "dateDepart") ?? jourIso(a.dateDepart ?? parent.debut);
  const retour = fdStr(formData, "dateRetour") ?? jourIso(a.dateRetour ?? parent.fin);
  if (depart) { fd.set("f_dateDepart", depart); fd.set("deadline", depart); }
  if (retour) fd.set("f_dateRetour", retour);
  if (etape === "TRANSPORT") {
    fd.set("f_billet", "oui"); fd.set("f_hotel", "non");
    const villeDepart = fdStr(formData, "villeDepart");
    if (villeDepart) fd.set("f_villeDepart", villeDepart);
    if (ville) fd.set("f_villeArrivee", ville);
  } else {
    fd.set("f_billet", "non"); fd.set("f_hotel", "oui");
    if (ville) fd.set("f_villeArrivee", ville);
    const nuits = fdNum(formData, "nbNuits");
    if (nuits != null) fd.set("f_nbNuits", String(nuits));
    const pref = fdStr(formData, "hotelPref");
    if (pref) fd.set("f_hotelPref", pref);
  }
  const r = await createRequest(undefined, fd);
  if (!r.ok || !r.id) return r;
  await prisma.administrativeRequest.update({
    where: { id: r.id },
    data: { linkedEntityType: "MISSION_ASSIGNMENT", linkedEntityId: a.id, subtype: SOUS_TYPE_SECRETARIAT[etape] },
  });
  if (!a.etapes.includes(etape)) await prisma.missionAssignment.update({ where: { id: a.id }, data: { etapes: { push: etape } } });
  revalider(a.entityType, a.entityId);
  return { ok: true, id: r.id, message: `${LIBELLE_ETAPE[etape]} demandé au secrétariat.` };
}

/** MATÉRIEL PROMOTIONNEL — une demande au magasin (la même que « Demander » du stock), reliée à la mission. */
export async function demanderMaterielMission(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const m = await maMissionConfirmee(fdStr(formData, "id"), user.id);
  if ("erreur" in m) return { ok: false, error: m.erreur };
  const a = m.a;
  const parent = await parentMission(a.entityType, a.entityId);
  const fd = new FormData();
  fd.set("itemId", fdStr(formData, "itemId") ?? "");
  fd.set("quantite", fdStr(formData, "quantite") ?? "");
  fd.set("note", [fdStr(formData, "note"), `Mission : ${parent.label}`].filter(Boolean).join(" — "));
  const r = await demanderMateriel(fd);
  if (!r.ok || !r.id) return r;
  await prisma.promoStockRequest.update({ where: { id: r.id }, data: { missionAssignmentId: a.id } });
  if (!a.etapes.includes("MATERIEL")) await prisma.missionAssignment.update({ where: { id: a.id }, data: { etapes: { push: "MATERIEL" } } });
  revalider(a.entityType, a.entityId);
  return { ok: true, id: r.id, message: "Demande envoyée au magasin." };
}

/** NOTE DE FRAIS — la demande RH habituelle (mois, montant, justificatif), reliée à la mission, après le retour. */
export async function deposerNoteFraisMission(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const m = await maMissionConfirmee(fdStr(formData, "id"), user.id);
  if ("erreur" in m) return { ok: false, error: m.erreur };
  const a = m.a;
  const parent = await parentMission(a.entityType, a.entityId);
  if (!noteFraisOuverte(a.dateRetour ?? parent.fin, a.dateDepart ?? parent.debut)) {
    return { ok: false, error: "La note de frais se dépose après la mission (à partir du jour du retour)." };
  }
  const fd = new FormData();
  fd.set("type", "EXPENSE_REPORT");
  fd.set("expenseMonth", fdStr(formData, "expenseMonth") ?? "");
  fd.set("expenseAmount", fdStr(formData, "expenseAmount") ?? "");
  fd.set("details", [fdStr(formData, "details"), `Mission : ${parent.label}`].filter(Boolean).join(" — "));
  for (const f of formData.getAll("files")) if (f instanceof File && f.size > 0) fd.append("files", f);
  const r = await requestHrDocument(fd);
  if (!r.ok || !r.id) return r;
  await prisma.hrDocumentRequest.update({ where: { id: r.id }, data: { missionAssignmentId: a.id } });
  if (!a.etapes.includes("NOTE_FRAIS")) await prisma.missionAssignment.update({ where: { id: a.id }, data: { etapes: { push: "NOTE_FRAIS" } } });
  revalider(a.entityType, a.entityId);
  return { ok: true, id: r.id, message: "Note de frais déposée aux RH." };
}

// ─────────────────────────────── La clôture : frais de l'équipe au budget ───────────────────────────────

/**
 * « Frais de l'équipe Adventum » — à la clôture, l'organisateur reporte À LA MAIN le montant exact du
 * transport ou de l'hébergement d'un membre et l'intègre au budget de la demande : un POSTE Ad & Pro
 * (Déplacement / Hôtellerie) est créé par le mécanisme habituel des postes, qui le validera et le
 * rangera dans un budget comme les autres. Rien d'automatique : sans ce geste, rien n'est imputé.
 */
export async function integrerFraisEquipe(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const a = await chargerAssignation(fdStr(formData, "id"));
  if (!a || a.archivedAt) return { ok: false, error: "Mission introuvable." };
  if (!(await canAccessEntity(user, a.entityType, a.entityId, "UPDATE"))) return { ok: false, error: "Action non autorisée." };
  const etape = fdStr(formData, "etape") === "HEBERGEMENT" ? "HEBERGEMENT" : "TRANSPORT";
  if (etape === "TRANSPORT" ? a.transportPosteId : a.hebergementPosteId) return { ok: false, error: "Ces frais sont déjà intégrés au budget de la demande." };
  const montant = fdNum(formData, "montant");
  const refus = refusMontantFrais(montant);
  if (refus) return { ok: false, error: refus };

  const personne = await prisma.user.findUnique({ where: { id: a.userId }, select: { name: true } });
  const demande = await prisma.administrativeRequest.findFirst({
    where: { linkedEntityType: "MISSION_ASSIGNMENT", linkedEntityId: a.id, subtype: SOUS_TYPE_SECRETARIAT[etape], deletedAt: null },
    orderBy: { createdAt: "desc" }, select: { reference: true },
  });
  const fd = new FormData();
  fd.set("parent", a.entityType);
  fd.set("parentId", a.entityId);
  fd.set("kind", etape === "TRANSPORT" ? "TRAVEL" : "ACCOMMODATION");
  fd.set("label", `${LIBELLE_ETAPE[etape]} — ${personne?.name ?? "membre"} (équipe Adventum)`);
  fd.set("amountEstimated", String(montant));
  fd.set("budgetKind", "INCLUDED");
  fd.set("notes", `Frais de l'équipe Adventum, montant exact saisi à la clôture${demande ? ` — demande ${demande.reference}` : ""}.`);
  const r = await addAdProItem(undefined, fd);
  if (!r.ok || !r.id) return r;
  await prisma.missionAssignment.update({ where: { id: a.id }, data: etape === "TRANSPORT" ? { transportPosteId: r.id } : { hebergementPosteId: r.id } });
  await recordAudit({ actorId: user.id, action: "CREATE", module: "Congrès", entityType: "MISSION_ASSIGNMENT", entityId: a.id, summary: `Frais de l'équipe intégrés au budget — ${LIBELLE_ETAPE[etape]} ${personne?.name ?? ""} : ${montant} DZD` });
  revalider(a.entityType, a.entityId);
  return { ok: true, id: r.id, message: "Intégré au budget de la demande (nouveau poste)." };
}

/** Discussion sur l'assignation : la personne assignée et les responsables peuvent échanger. */
export async function addMissionComment(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "assignmentId");
  const body = fdStr(formData, "body");
  if (!id || !body) return { ok: false, error: "Commentaire vide." };
  if (!(await canAccessEntity(user, "MISSION_ASSIGNMENT", id, "VIEW"))) return { ok: false, error: "Action non autorisée." };

  await prisma.comment.create({ data: { entityType: "MISSION_ASSIGNMENT", entityId: id, body, authorId: user.id } });
  const a = await prisma.missionAssignment.findUnique({ where: { id }, select: { entityType: true, entityId: true } });
  if (a) revalider(a.entityType, a.entityId);
  return { ok: true };
}
