"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { notifyUser, notifyRoles } from "@/lib/notify";
import {
  initialStep, nextStep, canValidate, tracksOpen, allTracksDone, pendingTracks,
  PROMO_STEP_LABEL, PROMO_TRACK_LABEL, PROMO_TRACKS,
  type PromoState, type PromoTrack,
} from "@/lib/promo-material/circuit";
import { promoManagerOf } from "@/lib/queries/promo-material";
import { fdStr, type ActionResult } from "@/lib/actions/types";

/**
 * LE CIRCUIT COURT DU MATÉRIEL PROMOTIONNEL.
 *
 * Cinq étapes au lieu de seize, puis trois chantiers qui avancent EN PARALLÈLE — bon de commande,
 * demande de paiement, demande de visa publicitaire. Ces trois-là n'ont aucune raison de
 * s'attendre, et c'est en les mettant en file indienne que l'ancien circuit faisait durer un
 * poster deux mois.
 *
 * Toutes les règles (qui valide quoi, ce qui suit quoi, quand les chantiers s'ouvrent) viennent du
 * module pur `promo-material/circuit`. Ces actions vérifient QUI agit, écrivent, et préviennent.
 */

const PATH = "/promo-material";
const path = (id: string) => `${PATH}/${id}`;

/** Les chantiers clos, lus depuis la colonne (liste séparée par des virgules). */
function readTracks(raw: string | null): PromoTrack[] {
  const set = new Set((raw ?? "").split(",").map((s) => s.trim()).filter(Boolean));
  return PROMO_TRACKS.filter((t) => set.has(t));
}

/**
 * Démarre le circuit court sur un dossier.
 *
 * Avec un devis DÉJÀ en main, on saute la demande de devis : c'est le cas le plus fréquent, et le
 * faire passer par une prospection fictive n'ajoutait qu'un clic et un mensonge dans l'historique.
 */
export async function startPromoCircuit(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Dossier introuvable." };

  const item = await prisma.promoMaterial.findUnique({
    where: { id }, select: { id: true, title: true, requesterId: true, circuitState: true },
  });
  if (!item) return { ok: false, error: "Dossier introuvable." };
  if (item.circuitState) return { ok: false, error: "Le circuit est déjà lancé sur ce dossier." };

  const requesterId = item.requesterId ?? user.id;
  const hasQuote = fdStr(formData, "hasQuote") === "1";
  const state = initialStep({ hasQuote });
  const managerId = await promoManagerOf(requesterId);

  await prisma.promoMaterial.update({
    where: { id },
    data: { circuitState: state, managerId, requesterId, updatedById: user.id },
  });
  await recordAudit({
    actorId: user.id, action: "UPDATE", module: "Matériel promotionnel",
    entityType: "PROMO_MATERIAL", entityId: id,
    summary: `Circuit lancé — ${PROMO_STEP_LABEL[state]}${hasQuote ? " (devis déjà en main : demande de devis sautée)" : ""}`,
  });
  revalidatePath(path(id));
  return { ok: true, message: hasQuote ? "Circuit lancé — le devis étant en main, la demande de devis est sautée." : "Circuit lancé." };
}

/**
 * Le devis est arrivé — l'étape « Devis demandé » se ferme, la validation du demandeur s'ouvre.
 *
 * `canValidate` refuse exprès QUOTE_REQUESTED (« il faut d'abord déposer un devis ») : cette
 * transition-là passe donc par ici, et par personne d'autre que le demandeur, l'assistante
 * assignée, la Direction ou le Super Admin. On demande que le devis soit DÉPOSÉ dans les pièces —
 * fermer l'étape sans devis referait exactement le mensonge de l'ancien circuit.
 */
export async function markQuoteReceived(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Dossier introuvable." };

  const item = await prisma.promoMaterial.findUnique({
    where: { id },
    select: { id: true, title: true, reference: true, circuitState: true, requesterId: true, assistantId: true },
  });
  if (!item || !item.circuitState) return { ok: false, error: "Le circuit n'est pas lancé sur ce dossier." };
  if (item.circuitState !== "QUOTE_REQUESTED") return { ok: false, error: "Ce dossier n'attend pas de devis." };

  const allowed = user.id === item.requesterId || user.id === item.assistantId
    || user.role === "DIRECTION" || user.role === "SUPER_ADMIN";
  if (!allowed) return { ok: false, error: "Seul le demandeur ou l'assistante peut confirmer la réception du devis." };

  const hasQuoteDoc = await prisma.document.count({
    where: { entityType: "PROMO_MATERIAL", entityId: id },
  });
  if (hasQuoteDoc === 0) {
    return { ok: false, error: "Déposez d'abord le devis dans les documents du dossier — confirmer sans pièce n'avance à rien." };
  }

  await prisma.promoMaterial.update({ where: { id }, data: { circuitState: "REVIEW_REQUESTER", updatedById: user.id } });
  await recordAudit({
    actorId: user.id, action: "UPDATE", module: "Matériel promotionnel",
    entityType: "PROMO_MATERIAL", entityId: id,
    summary: "Devis reçu — au tour du demandeur de le valider",
  });
  if (item.requesterId && item.requesterId !== user.id) {
    await notifyUser({ userId: item.requesterId, type: "VALIDATION_REQUIRED", title: "Devis reçu — à valider", body: `${item.reference} — ${item.title}`, link: path(id) });
  }
  revalidatePath(path(id));
  return { ok: true, message: "Devis enregistré — au tour du demandeur de le valider." };
}

/**
 * Valide l'étape en cours et passe à la suivante.
 *
 * Le contrôle de QUI peut valider vient du module pur : demandeur, N+1, PDG **ou** Super Admin
 * (un seul suffit — exiger les deux, c'est bloquer sur un congé), puis information médicale.
 */
export async function validatePromoStep(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Dossier introuvable." };

  const item = await prisma.promoMaterial.findUnique({
    where: { id },
    select: { id: true, title: true, reference: true, circuitState: true, requesterId: true, managerId: true },
  });
  if (!item || !item.circuitState) return { ok: false, error: "Le circuit n'est pas lancé sur ce dossier." };

  const state = item.circuitState as PromoState;
  if (!canValidate(user, state, { requesterId: item.requesterId, managerId: item.managerId })) {
    return { ok: false, error: `Cette étape ne vous revient pas — elle attend : ${PROMO_STEP_LABEL[state]}.` };
  }

  const next = nextStep(state as never);
  if (!next) return { ok: false, error: "Ce dossier est au bout de son circuit." };

  await prisma.promoMaterial.update({ where: { id }, data: { circuitState: next, updatedById: user.id } });
  await recordAudit({
    actorId: user.id, action: "UPDATE", module: "Matériel promotionnel",
    entityType: "PROMO_MATERIAL", entityId: id,
    summary: `${PROMO_STEP_LABEL[state]} — validé. Étape suivante : ${PROMO_STEP_LABEL[next]}`,
  });

  // On prévient CELUI QUI DOIT AGIR ENSUITE, pas tout le monde.
  if (next === "REVIEW_MANAGER" && item.managerId) {
    await notifyUser({ userId: item.managerId, type: "VALIDATION_REQUIRED", title: "Devis à valider", body: `${item.reference} — ${item.title}`, link: path(id) });
  } else if (next === "REVIEW_EXECUTIVE") {
    await notifyRoles(["DIRECTION", "SUPER_ADMIN"], { type: "VALIDATION_REQUIRED", title: "Devis à valider (direction)", body: `${item.reference} — ${item.title}`, link: path(id) });
  } else if (next === "REVIEW_MEDICAL_INFO") {
    await notifyRoles(["MEDICAL_INFO_PHARMACIST"], { type: "VALIDATION_REQUIRED", title: "Matériel à valider", body: `${item.reference} — ${item.title}`, link: path(id) });
  } else if (next === "IN_EXECUTION" && item.requesterId) {
    // Les TROIS chantiers s'ouvrent d'un coup : c'est le moment où le circuit cesse d'être une file.
    await notifyUser({
      userId: item.requesterId, type: "GENERIC",
      title: "Validations obtenues — vous pouvez lancer",
      body: `${item.reference} — bon de commande, demande de paiement et demande de visa peuvent partir en parallèle.`,
      link: path(id),
    });
  }

  revalidatePath(path(id));
  return { ok: true, message: `Validé. ${next === "IN_EXECUTION" ? "Les trois chantiers sont ouverts." : `Au tour de : ${PROMO_STEP_LABEL[next]}.`}` };
}

/** Refuse le dossier — le circuit s'arrête, avec son motif. */
export async function refusePromoStep(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  const reason = (fdStr(formData, "reason") ?? "").trim();
  if (!id) return { ok: false, error: "Dossier introuvable." };
  if (!reason) return { ok: false, error: "Dites pourquoi : un refus sans motif fait recommencer à l'identique." };

  const item = await prisma.promoMaterial.findUnique({
    where: { id },
    select: { id: true, title: true, reference: true, circuitState: true, requesterId: true, managerId: true },
  });
  if (!item || !item.circuitState) return { ok: false, error: "Le circuit n'est pas lancé sur ce dossier." };
  const state = item.circuitState as PromoState;
  if (!canValidate(user, state, { requesterId: item.requesterId, managerId: item.managerId })) {
    return { ok: false, error: "Cette étape ne vous revient pas." };
  }

  await prisma.promoMaterial.update({ where: { id }, data: { circuitState: "REFUSED", updatedById: user.id } });
  await recordAudit({
    actorId: user.id, action: "UPDATE", module: "Matériel promotionnel",
    entityType: "PROMO_MATERIAL", entityId: id,
    summary: `Refusé à l'étape « ${PROMO_STEP_LABEL[state]} » — ${reason.slice(0, 200)}`,
  });
  if (item.requesterId) {
    await notifyUser({ userId: item.requesterId, type: "GENERIC", title: "Matériel promotionnel refusé", body: `${item.reference} — ${reason.slice(0, 200)}`, link: path(id) });
  }
  revalidatePath(path(id));
  return { ok: true, message: "Refus enregistré." };
}

/**
 * Clôt l'un des trois chantiers parallèles.
 *
 * Ils avancent indépendamment — c'est tout l'intérêt. Mais le dossier n'est terminé que lorsque
 * le DERNIER l'est : sans cette règle, on classerait une commande dont le visa n'est jamais arrivé.
 */
export async function completePromoTrack(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  const track = fdStr(formData, "track") ?? "";
  if (!id) return { ok: false, error: "Dossier introuvable." };
  if (!(PROMO_TRACKS as readonly string[]).includes(track)) return { ok: false, error: "Chantier inconnu." };

  const item = await prisma.promoMaterial.findUnique({
    where: { id },
    select: { id: true, title: true, reference: true, circuitState: true, tracksDone: true, requesterId: true },
  });
  if (!item || !item.circuitState) return { ok: false, error: "Le circuit n'est pas lancé sur ce dossier." };
  if (!tracksOpen(item.circuitState as PromoState)) {
    return { ok: false, error: "Les chantiers ne s'ouvrent qu'une fois toutes les validations obtenues." };
  }

  const done = readTracks(item.tracksDone);
  if (done.includes(track as PromoTrack)) return { ok: true, message: "Ce chantier est déjà clos." };
  const nextDone = [...done, track as PromoTrack];
  const finished = allTracksDone(nextDone);

  await prisma.promoMaterial.update({
    where: { id },
    data: {
      tracksDone: nextDone.join(","),
      ...(finished ? { circuitState: "COMPLETED" } : {}),
      updatedById: user.id,
    },
  });
  await recordAudit({
    actorId: user.id, action: "UPDATE", module: "Matériel promotionnel",
    entityType: "PROMO_MATERIAL", entityId: id,
    summary: finished
      ? `${PROMO_TRACK_LABEL[track as PromoTrack]} clos — dossier TERMINÉ`
      : `${PROMO_TRACK_LABEL[track as PromoTrack]} clos — reste : ${pendingTracks(nextDone).map((t) => PROMO_TRACK_LABEL[t]).join(", ")}`,
  });

  revalidatePath(path(id));
  return {
    ok: true,
    message: finished
      ? "Dernier chantier clos — le dossier est terminé."
      : `Clos. Reste : ${pendingTracks(nextDone).map((t) => PROMO_TRACK_LABEL[t]).join(", ")}.`,
  };
}
