"use server";

import { revalidatePath } from "next/cache";
import {
  EventType, EventScope, EventFormat, EventStatus, ParticipantRole, RegistrationStatus,
} from "@prisma/client";
import type { CongressRequestStatus } from "@prisma/client";
import { requireUser } from "@/lib/session";
import { userCan, anyRoleFilter } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { moneyEntityOf } from "@/lib/company";
import { recordAudit } from "@/lib/audit";
import { notifyRoles, notifyUser } from "@/lib/notify";
import { statutManuelOuRien, estStatutDuCircuit } from "@/lib/events/statut";
import { adProInit, PRODUCT_MANAGER_ROLES } from "@/lib/workflow/origin";
import { fdStr, fdNum, fdDate, type ActionResult } from "@/lib/actions/types";
import { readMultiField } from "@/lib/ad-pro/pickers";

const inEnum = <T extends Record<string, string>>(e: T, v: string | null, fallback: T[keyof T]): T[keyof T] =>
  v && (Object.values(e) as string[]).includes(v) ? (v as T[keyof T]) : fallback;


/**
 * LE STATUT SAISI, ou un REFUS QUI NOMME LE REMÈDE (§118.30, §118.138).
 *
 * « Validé » et « En attente de validation » sont des VERDICTS du circuit de prise en charge :
 * les laisser écrire par le formulaire, c'est ce qui produisait des événements affichés
 * « Validé » qu'aucune étape n'avait validés. Refuser en silence aurait été pire — la personne
 * aurait vu son enregistrement passer sans que le champ change, et aurait recommencé.
 *
 * `null` (aucun statut envoyé) n'est PAS une erreur : c'est « ne touche pas au champ ». Un
 * formulaire qui ne porte pas la case ne doit pas remettre un événement en brouillon.
 */
function statutSaisi(formData: FormData): { ok: true; statut: string | null } | { ok: false; error: string } {
  const brut = fdStr(formData, "status");
  // `=== null` ET PAS `!brut`, et ce n'est pas de la coquetterie : la dérivation de contrats
  // (`actions/contrat.ts`) déduit « champ OBLIGATOIRE » d'une garde `if (!v)` dans le corps, et
  // celle-ci est un SUCCÈS — « aucun statut envoyé, on ne touche pas au champ ». Mesuré sur
  // l'artefact régénéré : avec `!brut`, `status` sortait `obligatoire: true` sur `createEvent`
  // et `updateEvent`, donc `validerEntree` aurait refusé une création d'événement sans statut —
  // une action DÉCRITE et INAPPELABLE, le défaut exact de §118.87c.
  if (brut === null) return { ok: true, statut: null };
  if (estStatutDuCircuit(brut)) {
    return {
      ok: false,
      error:
        "« Validé » et « En attente de validation » sont décidés par le circuit de prise en charge, "
        + "pas saisis à la main : soumettez l'événement au circuit (bloc « Demande de prise en charge ») "
        + "et l'état suivra la décision.",
    };
  }
  const statut = statutManuelOuRien(brut);
  if (!statut) return { ok: false, error: `État d'événement inconnu : « ${brut} ».` };
  return { ok: true, statut };
}

// ─────────────────────────── Événements ───────────────────────────

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * CE QUE LA DIRECTION A RENDU OBLIGATOIRE SUR UN ÉVÉNEMENT (22/09/2026) — §118.142.
 *
 * « Mets la création de la demande quasi tout obligatoire comme sponsoring […] vraiment avec
 * budget obligatoire. » Le formulaire les marque `required`, et ce n'est PAS la garde : un champ
 * de formulaire se forge, et l'écran n'est pas la seule porte (le chemin générique d'Adam poste
 * la même action). C'est ICI que l'obligation est tenue.
 *
 * ELLE NOMME TOUT CE QUI MANQUE EN UNE FOIS. Un refus par aller-retour ferait ressaisir quinze
 * champs une fois par champ manquant (§118.18) — et c'est le formulaire le plus long du pôle.
 *
 * LE BUDGET EST LA PIÈCE MAÎTRESSE, et ce n'est pas une question de complétude : sans lui, le
 * moteur lit un montant de ZÉRO, refuse de franchir une porte de contrôle sur un montant inconnu
 * (à juste titre, §118.132) et la porte du Directeur Général reste ouverte sur un événement de
 * 80 000 DZD. La plainte « le DG n'a pas à valider en dessous du seuil » se ferme ici.
 *
 * LA LISTE EST LA MÊME POUR LA CRÉATION ET LA MODIFICATION : un formulaire qui exige à la
 * création et laisse vider à la modification n'exige rien du tout — il suffit d'enregistrer deux
 * fois. `updateEvent` lit donc la même fonction.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
/**
 * LE NOM EST GARDÉ À PART, et ce n'est pas une incohérence — c'est le CONTRAT D'ACTION.
 *
 * `actions/contrat.ts` DÉDUIT « champ obligatoire » d'une garde `if (!v)` lue dans le corps ; il
 * ne sait pas lire une liste rendue par une fonction. En basculant tous les champs dans
 * `champsManquants`, le nom est sorti `obligatoire: false` de l'artefact régénéré — mesuré, pas
 * supposé (§118.137). La carte de confirmation d'Adam ne l'aurait plus demandé, et CHAQUE appel
 * aurait été refusé pour un champ que le contrat déclarait facultatif.
 *
 * Le nom reste donc gardé par une ligne que la dérivation LIT, et il quitte la liste : un champ
 * gardé deux fois donnerait deux messages pour la même absence. La propriété « tout ce qui
 * manque, en une fois » (§118.18) vaut pour les quatorze autres — et le nom est précisément le
 * champ qu'aucun formulaire ne laisse passer, `required` en HTML depuis toujours.
 */
function champsManquants(formData: FormData): string[] {
  const medecins = readMultiField(formData.getAll("doctorIds").map(String), fdStr(formData, "doctor"));
  const produits = readMultiField(formData.getAll("productIds").map(String), fdStr(formData, "products"));
  const budget = fdNum(formData, "estimatedBudget");
  return [
    !fdStr(formData, "type") ? "le type" : null,
    !fdStr(formData, "scope") ? "la portée" : null,
    !fdStr(formData, "format") ? "le format" : null,
    !fdDate(formData, "startDate") ? "la date de début" : null,
    !fdDate(formData, "endDate") ? "la date de fin" : null,
    !fdStr(formData, "location") ? "le lieu / la salle" : null,
    !fdStr(formData, "city") ? "la ville (wilaya)" : null,
    !fdStr(formData, "country") ? "le pays" : null,
    !fdStr(formData, "specialty") ? "la spécialité" : null,
    !medecins ? "le ou les médecins concernés" : null,
    !produits ? "le ou les produits concernés" : null,
    // UN BUDGET DE ZÉRO N'EST PAS UN BUDGET RENSEIGNÉ : c'est exactement la valeur que le moteur
    // lit sur un champ vide, et celle qui laisse la porte du DG ouverte.
    budget == null || budget <= 0 ? "le budget estimé (DZD, supérieur à zéro)" : null,
    !fdStr(formData, "responsibleId") ? "le responsable interne" : null,
    !fdStr(formData, "description") ? "la description" : null,
  ].filter((x): x is string => x !== null);
}

export async function createEvent(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "EVENTS", "CREATE")) return { ok: false, error: "Non autorisé." };
  const name = fdStr(formData, "name");
  if (!name) return { ok: false, error: "Le nom de l'événement est obligatoire." };
  const manquants = champsManquants(formData);
  if (manquants.length > 0) {
    return { ok: false, error: `Demande incomplète — il manque : ${manquants.join(", ")}.` };
  }
  const saisi = statutSaisi(formData);
  if (!saisi.ok) return saisi;
  const created = await prisma.event.create({
    data: {
      // LA GAMME QUI PORTE LA DEMANDE — c'est SON budget Ad&Pro qui est engagé.
      businessUnitId: fdStr(formData, "businessUnitId") || null,
      name,
      // Entité : la portée en cours, à défaut la société d'appartenance du créateur.
      // L'ENTITÉ QUI PAIERA suit la PERSONNE (sa fiche employé, à défaut son
      // département), pas la portée sélectionnée dans la barre : un délégué de Pharmagène qui
      // consulte Adventum ne doit pas imputer sa demande à Adventum. La Direction corrige en
      // validant, au seul moment où quelqu'un a le dossier entier sous les yeux.
      companyId: await moneyEntityOf(user.id),
      type: inEnum(EventType, fdStr(formData, "type"), "CONGRESS"),
      scope: inEnum(EventScope, fdStr(formData, "scope"), "NATIONAL"),
      format: inEnum(EventFormat, fdStr(formData, "format"), "PRESENTIAL"),
      status: inEnum(EventStatus, saisi.statut, "DRAFT"),
      startDate: fdDate(formData, "startDate"),
      endDate: fdDate(formData, "endDate"),
      location: fdStr(formData, "location"),
      city: fdStr(formData, "city"),
      country: fdStr(formData, "country"),
      specialty: fdStr(formData, "specialty"),
      // MÉDECINS ET PRODUITS : plusieurs de chaque, joints par le MÊME lecteur que le sponsoring
      // (`ad-pro/pickers.ts`). Deux découpes à la main finiraient par diverger sur le séparateur.
      doctor: readMultiField(formData.getAll("doctorIds").map(String), fdStr(formData, "doctor")),
      products: readMultiField(formData.getAll("productIds").map(String), fdStr(formData, "products")),
      description: fdStr(formData, "description"),
      capacity: fdNum(formData, "capacity") ? Math.round(fdNum(formData, "capacity")!) : null,
      estimatedBudget: fdNum(formData, "estimatedBudget"),
      meetingLink: fdStr(formData, "meetingLink"),
      responsibleId: fdStr(formData, "responsibleId"),
      createdById: user.id,
    },
    select: { id: true },
  });
  await recordAudit({ actorId: user.id, action: "CREATE", module: "Events", summary: `Événement « ${name} »` });
  revalidatePath("/events");
  return { ok: true, id: created.id };
}

export async function updateEvent(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "EVENTS", "UPDATE")) return { ok: false, error: "Non autorisé." };
  const id = fdStr(formData, "id");
  const name = fdStr(formData, "name");
  if (!id || !name) return { ok: false, error: "Paramètres manquants." };
  // LA MÊME LISTE QU'À LA CRÉATION : exiger à la création et laisser vider à la modification
  // n'exige rien du tout — il suffirait d'enregistrer une seconde fois.
  const manquants = champsManquants(formData);
  if (manquants.length > 0) {
    return { ok: false, error: `Demande incomplète — il manque : ${manquants.join(", ")}.` };
  }
  const saisi = statutSaisi(formData);
  if (!saisi.ok) return saisi;
  await prisma.event.update({
    where: { id },
    data: {
      businessUnitId: fdStr(formData, "businessUnitId") || undefined,
      name,
      type: inEnum(EventType, fdStr(formData, "type"), "CONGRESS"),
      scope: inEnum(EventScope, fdStr(formData, "scope"), "NATIONAL"),
      format: inEnum(EventFormat, fdStr(formData, "format"), "PRESENTIAL"),
      // `undefined` = ON NE TOUCHE PAS. Écrire « DRAFT » par défaut ramènerait en brouillon un
      // événement validé dès qu'un formulaire ne porte pas la case (§118.16).
      status: saisi.statut ? inEnum(EventStatus, saisi.statut, "DRAFT") : undefined,
      startDate: fdDate(formData, "startDate"),
      endDate: fdDate(formData, "endDate"),
      location: fdStr(formData, "location"),
      city: fdStr(formData, "city"),
      country: fdStr(formData, "country"),
      specialty: fdStr(formData, "specialty"),
      doctor: readMultiField(formData.getAll("doctorIds").map(String), fdStr(formData, "doctor")),
      products: readMultiField(formData.getAll("productIds").map(String), fdStr(formData, "products")),
      description: fdStr(formData, "description"),
      capacity: fdNum(formData, "capacity") ? Math.round(fdNum(formData, "capacity")!) : null,
      estimatedBudget: fdNum(formData, "estimatedBudget"),
      meetingLink: fdStr(formData, "meetingLink"),
      responsibleId: fdStr(formData, "responsibleId"),
    },
  });
  revalidatePath(`/events/${id}`);
  return { ok: true };
}

export async function deleteEvent(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "EVENTS", "DELETE")) return { ok: false, error: "Non autorisé." };
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Identifiant manquant." };
  await prisma.event.delete({ where: { id } });
  revalidatePath("/events");
  return { ok: true };
}

// ──────────────── Demande de prise en charge (circuit de financement) ────────────────

/**
 * Soumet un événement existant au **circuit de prise en charge**, identique à celui
 * des congrès : la demande (souvent d'un délégué) part vers le **National Sales**
 * (approbation préliminaire + désignation du référent Direction Marketing) → analyse du chef de
 * produit → **Direction** (décision définitive + budget accordé) → **information
 * médicale** (PRIM). Les étapes suivantes sont gérées par `congress-request-actions`
 * avec `type=EVENT` (mêmes composants UI).
 */
export async function submitEventForApproval(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "EVENTS", "CREATE")) return { ok: false, error: "Non autorisé." };
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Identifiant manquant." };
  const ev = await prisma.event.findUnique({ where: { id }, select: { id: true, name: true, requestStatus: true, requesterId: true } });
  if (!ev) return { ok: false, error: "Événement introuvable." };
  if (ev.requestStatus) return { ok: false, error: "Une demande de prise en charge est déjà en cours pour cet événement." };

  // Routage intelligent : on saute les étapes d'approbation au niveau/en dessous du créateur.
  const pmId = fdStr(formData, "productManagerId");
  if (pmId) {
    const okPm = await prisma.user.count({ where: { id: pmId, isActive: true, ...anyRoleFilter(PRODUCT_MANAGER_ROLES) } });
    if (!okPm) return { ok: false, error: "Le référent Direction Marketing sélectionné est introuvable." };
  }
  // La Direction, elle, CHOISIT : trancher tout de suite, ou demander d'abord l'avis d'un chef
  // de produit. `adProInit` ignore ce drapeau pour les autres rangs — le choix ne se vole pas.
  const init = adProInit(user, pmId);
  const now = new Date();

  await prisma.event.update({
    where: { id },
    data: {
      requestStatus: init.status as CongressRequestStatus,
      requesterId: ev.requesterId ?? user.id,
      status: "AWAITING_VALIDATION",
      ...(init.productManagerId ? { productManagerId: init.productManagerId } : {}),
      ...(init.preliminaryBySelf ? { preliminaryById: user.id, preliminaryAt: now } : {}),
    },
  });
  await recordAudit({ actorId: user.id, action: "CREATE", module: "Events", entityType: "EVENT", entityId: id, summary: `Demande de prise en charge — ${ev.name}` });
  const link = `/events/${id}`;
  if (init.stage === "ANALYSIS" && init.productManagerId) {
    await notifyUser({ userId: init.productManagerId, type: "ASSIGNMENT", title: "Événement à analyser", body: ev.name, link });
  } else if (init.stage === "FINAL") {
    await notifyRoles(["DIRECTION", "SUPER_ADMIN"], { type: "VALIDATION_REQUIRED", title: "Événement — validation définitive", body: ev.name, link });
  } else {
    await notifyRoles(["NATIONAL_SALES", "SUPER_ADMIN"], { type: "VALIDATION_REQUIRED", title: "Événement — à attribuer (National Sales)", body: ev.name, link });
  }
  revalidatePath(`/events/${id}`);
  revalidatePath("/events");
  return { ok: true };
}

// ─────────────────────────── Inscriptions ───────────────────────────

/** Comptage des places occupées (hors annulés/refusés). */
async function takenSeats(eventId: string): Promise<number> {
  return prisma.eventRegistration.count({
    where: { eventId, status: { in: ["REGISTERED", "CONFIRMED", "PRESENT", "PENDING"] } },
  });
}

/** Inscription publique (formulaire partageable, sans compte). */
export async function publicRegister(formData: FormData): Promise<ActionResult> {
  const eventId = fdStr(formData, "eventId");
  const firstName = fdStr(formData, "firstName");
  const lastName = fdStr(formData, "lastName");
  if (!eventId || !firstName || !lastName) return { ok: false, error: "Nom et prénom obligatoires." };
  const event = await prisma.event.findUnique({ where: { id: eventId }, select: { status: true, capacity: true } });
  if (!event) return { ok: false, error: "Événement introuvable." };
  if (event.status !== "REGISTRATION_OPEN") return { ok: false, error: "Les inscriptions ne sont pas ouvertes." };

  // Liste d'attente si capacité atteinte.
  let status: RegistrationStatus = "REGISTERED";
  if (event.capacity && (await takenSeats(eventId)) >= event.capacity) status = "PENDING";

  const reg = await prisma.eventRegistration.create({
    data: {
      eventId, firstName, lastName,
      specialty: fdStr(formData, "specialty"), institution: fdStr(formData, "institution"),
      city: fdStr(formData, "city"), email: fdStr(formData, "email"), phone: fdStr(formData, "phone"),
      role: inEnum(ParticipantRole, fdStr(formData, "role"), "DOCTOR"),
      comment: fdStr(formData, "comment"), status, source: "public",
    },
    select: { id: true, qrToken: true },
  });
  revalidatePath(`/events/${eventId}`);
  return { ok: true, id: reg.qrToken };
}

/** Ajout d'un participant en interne (staff). */
export async function addRegistration(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "EVENTS", "UPDATE")) return { ok: false, error: "Non autorisé." };
  const eventId = fdStr(formData, "eventId");
  const firstName = fdStr(formData, "firstName");
  const lastName = fdStr(formData, "lastName");
  if (!eventId || !firstName || !lastName) return { ok: false, error: "Nom et prénom obligatoires." };
  await prisma.eventRegistration.create({
    data: {
      eventId, firstName, lastName,
      specialty: fdStr(formData, "specialty"), institution: fdStr(formData, "institution"),
      city: fdStr(formData, "city"), email: fdStr(formData, "email"), phone: fdStr(formData, "phone"),
      role: inEnum(ParticipantRole, fdStr(formData, "role"), "DOCTOR"),
      comment: fdStr(formData, "comment"),
      status: inEnum(RegistrationStatus, fdStr(formData, "status"), "CONFIRMED"), source: "internal",
    },
  });
  revalidatePath(`/events/${eventId}`);
  return { ok: true };
}

export async function setRegistrationStatus(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "EVENTS", "UPDATE")) return { ok: false, error: "Non autorisé." };
  const id = fdStr(formData, "id");
  const status = fdStr(formData, "status");
  if (!id || !status) return { ok: false, error: "Paramètres manquants." };
  const reg = await prisma.eventRegistration.update({
    where: { id },
    data: {
      status: inEnum(RegistrationStatus, status, "REGISTERED"),
      checkedInAt: status === "PRESENT" ? new Date() : undefined,
    },
    select: { eventId: true },
  });
  revalidatePath(`/events/${reg.eventId}`);
  return { ok: true };
}

/** Check-in par jeton QR : marque « présent ». */
export async function checkInByToken(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "EVENTS", "UPDATE")) return { ok: false, error: "Non autorisé." };
  const token = fdStr(formData, "token");
  if (!token) return { ok: false, error: "Jeton manquant." };
  const reg = await prisma.eventRegistration.findUnique({ where: { qrToken: token }, select: { id: true, eventId: true } });
  if (!reg) return { ok: false, error: "Participant introuvable." };
  await prisma.eventRegistration.update({ where: { id: reg.id }, data: { status: "PRESENT", checkedInAt: new Date() } });
  revalidatePath(`/events/${reg.eventId}`);
  return { ok: true, id: reg.eventId };
}

export async function deleteRegistration(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "EVENTS", "UPDATE")) return { ok: false, error: "Non autorisé." };
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Identifiant manquant." };
  const reg = await prisma.eventRegistration.delete({ where: { id }, select: { eventId: true } });
  revalidatePath(`/events/${reg.eventId}`);
  return { ok: true };
}
