"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { getAppSettings } from "@/lib/settings";
import { ROLE_DIRECTION_MARKETING } from "@/lib/personnes/roles-vente";
import { notifyUser, notifyRoles } from "@/lib/notify";
import {
  initialStep, nextStep, canValidate, tracksOpen, allTracksDone, pendingTracks, type ContexteCircuit, type PromoStep,
  PROMO_STEP_LABEL, PROMO_TRACK_LABEL, PROMO_TRACKS,
  type PromoState, type PromoTrack,
} from "@/lib/promo-material/circuit";
import { promoManagerOf } from "@/lib/queries/promo-material";
import { fdStr, type ActionResult } from "@/lib/actions/types";
import { hasGlobalView } from "@/lib/rbac";
import { etatsDesBC } from "@/lib/bons-de-commande/etat";
import { chantierBCClos } from "@/lib/bons-de-commande/regle";
import { chantierPaiementClos, etatDeLOrdre, type PieceDeReglement } from "@/lib/payments/reglement";

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

/**
 * LES RÈGLEMENTS RATTACHÉS À UN DOSSIER — tout ce qui peut porter son paiement (§118.148).
 *
 * Trois chemins mènent à un ordre de dépense, et un dossier peut les avoir empruntés tous :
 *   • l'ordre né du dossier lui-même (ancien parcours : bordereau, règlement final) ;
 *   • la FACTURE enregistrée depuis le dossier — ou qui découle d'un de ses bons de commande —,
 *     envoyée au règlement : son ordre ; ou, sans ordre, la date qu'elle porte si elle a été
 *     ENREGISTRÉE comme déjà réglée (le chemin que le registre des paiements nomme, §PAYMENT_PATHS) ;
 *   • le dossier de paiement ouvert sur le dossier.
 * Un même ordre peut être atteint par deux chemins (le dossier compagnon d'un ordre) : on compte
 * par ORDRE, jamais par chemin, sans quoi un paiement réglé compterait double et un paiement en
 * attente pourrait se cacher derrière son jumeau réglé.
 */
async function reglementsDuDossierPromo(id: string): Promise<PieceDeReglement[]> {
  const [ordresDirects, bcs, demandes] = await Promise.all([
    prisma.expenseOrder.findMany({
      where: { sourceType: "PROMO_MATERIAL", sourceId: id },
      select: { id: true, reference: true, status: true, centralStatus: true },
    }),
    prisma.legalDocument.findMany({
      where: { sourceType: "PROMO_MATERIAL", sourceId: id, kind: "PURCHASE_ORDER" },
      select: { id: true },
    }),
    prisma.paymentRequest.findMany({
      where: { entityType: "PROMO_MATERIAL", entityId: id, status: { notIn: ["CANCELLED", "REJECTED"] } },
      select: { reference: true, expenseOrderId: true },
    }),
  ]);
  const factures = await prisma.legalDocument.findMany({
    where: {
      kind: "INVOICE", status: { not: "CANCELLED" },
      OR: [
        { sourceType: "PROMO_MATERIAL", sourceId: id },
        ...(bcs.length ? [{ chainFromId: { in: bcs.map((b) => b.id) } }] : []),
      ],
    },
    select: { reference: true, title: true, expenseOrderId: true, paidDate: true },
  });

  const ordresIds = [
    ...factures.map((f) => f.expenseOrderId), ...demandes.map((d) => d.expenseOrderId),
  ].filter((x): x is string => Boolean(x));
  const ordresLies = ordresIds.length
    ? await prisma.expenseOrder.findMany({
        where: { id: { in: ordresIds } },
        select: { id: true, reference: true, status: true, centralStatus: true },
      })
    : [];

  const parOrdre = new Map<string, PieceDeReglement>();
  for (const o of [...ordresDirects, ...ordresLies]) {
    parOrdre.set(o.id, { libelle: `ordre ${o.reference}`, etat: etatDeLOrdre(o) });
  }
  const sansOrdre: PieceDeReglement[] = [];
  for (const f of factures) {
    if (f.expenseOrderId) continue; // compté par son ordre
    sansOrdre.push({
      libelle: `facture ${f.reference?.trim() || `« ${f.title} »`}`,
      etat: f.paidDate ? "REGLE" : "NON_ENVOYE",
    });
  }
  for (const d of demandes) {
    if (d.expenseOrderId) continue;
    sansOrdre.push({ libelle: `demande de paiement ${d.reference}`, etat: "NON_ENVOYE" });
  }
  return [...parOrdre.values(), ...sansOrdre];
}

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
 * LE CONTEXTE DES DEUX ÉTAPES CONDITIONNELLES (§118.138) — lu en base, décidé dans le module pur.
 *
 * « Qui demande » et « combien » vivent sur le dossier ; le SEUIL vit dans les réglages, le même
 * que celui des quatre circuits Ad & Pro configurables — cinq copies auraient divergé (§118.5).
 *
 * Le montant est le devis RETENU, à défaut le budget global : c'est le montant qu'on engage, et
 * c'est lui que le seuil vise. Ni l'un ni l'autre ⇒ `null` ⇒ la porte du DG s'ouvre, parce qu'on
 * ne franchit pas une porte de contrôle sur une absence de donnée.
 */
async function contexteCircuit(item: {
  requesterId: string | null;
  chosenAmount: unknown;
  amount: unknown;
}): Promise<ContexteCircuit> {
  const [demandeur, reglages] = await Promise.all([
    item.requesterId
      ? prisma.user.findUnique({ where: { id: item.requesterId }, select: { role: true, secondaryRole: true } }).catch(() => null)
      : Promise.resolve(null),
    getAppSettings().catch(() => null),
  ]);
  const montant = item.chosenAmount != null ? Number(item.chosenAmount)
    : item.amount != null ? Number(item.amount)
    : null;
  return {
    demandeurEstDirectionMarketing:
      demandeur?.role === ROLE_DIRECTION_MARKETING || demandeur?.secondaryRole === ROLE_DIRECTION_MARKETING,
    montant: montant != null && Number.isFinite(montant) ? montant : null,
    seuilDg: reglages?.adProDgThreshold ?? null,
  };
}

/**
 * Valide l'étape en cours et passe à la suivante.
 *
 * Le contrôle de QUI peut valider vient du module pur : demandeur, Direction Marketing,
 * Directeur Général au-delà du seuil, PDG **ou** Super Admin (un seul suffit — exiger les deux,
 * c'est bloquer sur un congé), puis information médicale.
 */
export async function validatePromoStep(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Dossier introuvable." };

  const item = await prisma.promoMaterial.findUnique({
    where: { id },
    select: { id: true, title: true, reference: true, circuitState: true, requesterId: true, managerId: true, chosenAmount: true, amount: true },
  });
  if (!item || !item.circuitState) return { ok: false, error: "Le circuit n'est pas lancé sur ce dossier." };

  const state = item.circuitState as PromoState;
  if (!canValidate(user, state, { requesterId: item.requesterId, managerId: item.managerId, secondaryRole: user.secondaryRole })) {
    return { ok: false, error: `Cette étape ne vous revient pas — elle attend : ${PROMO_STEP_LABEL[state]}.` };
  }

  const next = nextStep(state as PromoStep, await contexteCircuit(item));
  if (!next) return { ok: false, error: "Ce dossier est au bout de son circuit." };

  await prisma.promoMaterial.update({ where: { id }, data: { circuitState: next, updatedById: user.id } });
  await recordAudit({
    actorId: user.id, action: "UPDATE", module: "Matériel promotionnel",
    entityType: "PROMO_MATERIAL", entityId: id,
    summary: `${PROMO_STEP_LABEL[state]} — validé. Étape suivante : ${PROMO_STEP_LABEL[next]}`,
  });

  // On prévient CELUI QUI DOIT AGIR ENSUITE, pas tout le monde.
  if (next === "REVIEW_MANAGER") {
    // UN RÔLE, PLUS UNE PERSONNE : c'est la Direction Marketing qui valide (décision de la
    // Direction, 09/2026). Notifier le `managerId` figé à la création préviendrait quelqu'un qui
    // n'a plus rien à faire ici, et laisserait la vraie validatrice sans signal.
    await notifyRoles([ROLE_DIRECTION_MARKETING], { type: "VALIDATION_REQUIRED", title: "Devis à valider (Direction Marketing)", body: `${item.reference} — ${item.title}`, link: path(id) });
  } else if (next === "REVIEW_DG") {
    await notifyRoles(["GENERAL_MANAGER"], { type: "VALIDATION_REQUIRED", title: "Devis à valider (Directeur Général)", body: `${item.reference} — ${item.title}`, link: path(id) });
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
  if (!canValidate(user, state, { requesterId: item.requesterId, managerId: item.managerId, secondaryRole: user.secondaryRole })) {
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
  // QUI PILOTE LES CHANTIERS — la même règle que l'écran (`canDrive` de la fiche) : le demandeur,
  // l'assistante de direction, la Direction. Cette action ne vérifiait QUE la session : n'importe
  // quel compte pouvait clore le chantier « paiement » d'un dossier qui n'était pas le sien, et
  // l'op d'Adam annonçait « revérifié par l'action » sur une vérification qui n'existait pas.
  const pilote = item.requesterId === user.id || user.role === "DIRECTION_ASSISTANT" || hasGlobalView(user.role);
  if (!pilote) return { ok: false, error: "Seuls le demandeur, l'assistante de direction et la Direction pilotent les chantiers de ce dossier." };
  if (!tracksOpen(item.circuitState as PromoState)) {
    return { ok: false, error: "Les chantiers ne s'ouvrent qu'une fois toutes les validations obtenues." };
  }

  const done = readTracks(item.tracksDone);
  if (done.includes(track as PromoTrack)) return { ok: true, message: "Ce chantier est déjà clos." };

  // LE CHANTIER « BON DE COMMANDE » EXIGE UN BC VALIDÉ PAR SON CENTRE (§118.148). Il se refermait
  // d'un clic, sans pièce, sans qu'aucun centre ait rien vu — la règle de la Direction dit que tout
  // BC né d'Ad & Pro passe par le centre de validation Ad & Pro.
  if (track === "PURCHASE_ORDER") {
    const bcs = await prisma.legalDocument.findMany({
      where: { sourceType: "PROMO_MATERIAL", sourceId: id, kind: "PURCHASE_ORDER", status: { not: "CANCELLED" } },
      select: { id: true, reference: true },
    });
    // L'ÉTAPE de chaque BC (§118.149) : validé ne suffit plus, il faut aussi la signature des
    // Finances — un BC validé mais pas signé ne part pas chez le fournisseur.
    const etats = await etatsDesBC(bcs.map((b) => b.id));
    const verdict = chantierBCClos(bcs.map((b) => {
      const e = etats.get(b.id);
      return { reference: b.reference, porte: e?.porte ?? null, ...(e ? { etape: e.etape } : {}) };
    }));
    if (!verdict.ok) return { ok: false, error: verdict.raison };
  }
  // LE CHANTIER « PAIEMENT » EXIGE UN PAIEMENT RÉGLÉ (§118.148). Il se refermait d'un clic, sans
  // ordre de dépense : le dossier se disait payé alors qu'aucun centre de paiement n'avait rien vu
  // — et la Direction a dit que TOUS les paiements y passent.
  if (track === "PAYMENT") {
    const verdict = chantierPaiementClos(await reglementsDuDossierPromo(id));
    if (!verdict.ok) return { ok: false, error: verdict.raison };
  }
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
