"use server";

import type { ConsultingBilling, ConsultingStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { userCan, hasGlobalView, getAccess, type SessionUser, type Action } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { notifyUser, notifyRoles } from "@/lib/notify";
import { buildRef, createWithRetry } from "@/lib/refs";
import { companyIdForNew } from "@/lib/company";
import { attachFiles } from "@/lib/attach-files";
import { readMultiField, lireMedecinsDemande } from "@/lib/ad-pro/pickers";
import { fdStr, fdNum, type ActionResult } from "@/lib/actions/types";
import { nextConsultingStatus, isContractEditable } from "@/lib/ad-pro/consulting";
import { poserVisaAdPro, blocageCentreAdPro, retirerVisaEnAttente } from "@/lib/ad-pro/visa";
import { toNumber } from "@/lib/utils";
import { recordEvent } from "@/lib/events/ledger";
import { reaiguillerLesBCDe, LOT_ORIGINE } from "@/lib/bons-de-commande/aiguillage";
import {
  MODULE_DU_POLE, CHEMIN_LISTE_POLE, LIBELLE_POLE, estPoleConsulting, poleDe, poleOppose,
  transfertAutorise, refusTransfert, type PoleConsulting,
} from "@/lib/lecteurs/consulting";

const PATH = "/consulting";

/**
 * LE CONTRAT DE CONSULTING — un engagement entre DEUX PARTIES.
 *
 * Ce n'est pas une demande qu'on approuve puis qu'on oublie : c'est une relation qui court dans
 * le temps. D'où les gestes offerts ici — soumettre à validation, activer, prolonger ou clore,
 * annuler — et les tâches attendues du prestataire, qui vivent à part parce que « ce qui reste à
 * livrer » est une question qu'on pose au contrat, et qu'un paragraphe ne sait pas y répondre.
 *
 * QUI PEUT QUOI : le porteur mène son contrat jusqu'à la demande de validation ; seul un
 * VALIDATE sur le module (Direction, ou la personne désignée) l'active ou le refuse. Personne ne
 * valide donc son propre engagement sans en avoir reçu le droit.
 */

function isDirection(user: SessionUser): boolean {
  return hasGlobalView(user.role);
}

/**
 * Le porteur du contrat, ou quelqu'un qui a la vue globale.
 *
 * Être le porteur ne suffit plus quand le contrat a changé de MAISON (§118.150) : le porteur
 * d'un contrat passé aux RH qui n'a pas les RH ne le voit plus à l'écran — la fiche lui répond
 * « introuvable ». Lui laisser ici le droit de le soumettre, de le clore ou d'en cocher les tâches
 * ferait de l'action une porte ouverte à côté de la porte fermée (§118.71). La désignation n'est
 * pas une permission qui survit à son motif (§118.136) : on relit le module du pôle.
 */
function owns(user: SessionUser, c: { requesterId: string | null; createdById: string | null; pole: unknown }): boolean {
  if (isDirection(user)) return true;
  return (c.requesterId === user.id || c.createdById === user.id) && peutSurLeContrat(user, c, "VIEW");
}

async function nextRef(): Promise<string> {
  const year = new Date().getFullYear();
  const refs = await prisma.consultingContract.findMany({
    where: { reference: { startsWith: `CONS-${year}-` } }, select: { reference: true },
  });
  return buildRef("CONS", year, refs.map((r) => r.reference));
}

function revalidate(id?: string) {
  revalidatePath(PATH);
  revalidatePath("/ad-pro");
  // Les deux listes : un contrat peut vivre dans l'une ou l'autre (§118.150), et un transfert
  // les touche toutes les deux.
  revalidatePath(CHEMIN_LISTE_POLE.RH);
  if (id) revalidatePath(`${PATH}/${id}`);
}

/**
 * LE MODULE QUI GARDE CE CONTRAT — lu sur son PÔLE (§118.150), jamais `CONSULTING` en dur : une
 * garde qui relirait le module d'Ad & Pro laisserait la promotion modifier le contrat d'un
 * consultant passé aux RH, et en fermerait la gestion aux RH qui le suivent.
 */
function moduleDe(c: { pole: unknown }) {
  return MODULE_DU_POLE[poleDe(c.pole)];
}

/**
 * LE DROIT SUR CE CONTRAT — celui du module de SON pôle, pour ce geste.
 *
 * NOMMÉ, et non `userCan(user, moduleDe(c), …)` écrit en ligne : la dérivation des contrats
 * d'action ne reconnaît une garde que par son NOM ou par un module LITTÉRAL. Un module calculé
 * faisait sortir cinq actions « gardées par rien » sur la carte de confirmation, alors qu'elles
 * le sont — le défaut que §118.136 et §118.140 ont déjà payé. Le préfixe `peut…` est lu.
 */
function peutSurLeContrat(user: SessionUser, c: { pole: unknown }, action: Action): boolean {
  return userCan(user, moduleDe(c), action);
}

async function audit(user: SessionUser, id: string, action: "CREATE" | "UPDATE" | "VALIDATE" | "DELETE", summary: string) {
  await recordAudit({ actorId: user.id, action, module: "Consulting", entityType: "CONSULTING_CONTRACT", entityId: id, summary });
}

function billingOf(raw: string | null): ConsultingBilling {
  const allowed: ConsultingBilling[] = ["ONE_OFF", "MONTHLY", "QUARTERLY", "YEARLY", "ON_DELIVERY"];
  return allowed.includes(raw as ConsultingBilling) ? (raw as ConsultingBilling) : "ONE_OFF";
}

const dateOf = (raw: string | null): Date | null => {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
};

// ───────────────────────── Création ─────────────────────────

export async function createConsultingContract(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  try {
    const user = await requireUser();
    // LE PÔLE DE NAISSANCE : Ad & Pro par défaut ; les RH créent leurs contrats de consultant
    // depuis RH › Consultants (§118.150). Le droit est celui du module du pôle choisi — un champ
    // forgé ne fait pas créer un contrat RH à qui n'a pas les RH.
    const poleBrut = fdStr(formData, "pole");
    const pole: PoleConsulting = estPoleConsulting(poleBrut) ? poleBrut : "AD_PRO";
    if (!peutSurLeContrat(user, { pole }, "CREATE")) return { ok: false, error: "Création réservée aux personnes habilitées." };

    const title = fdStr(formData, "title");
    const counterparty = fdStr(formData, "counterparty");
    if (!title) return { ok: false, error: "L'intitulé du contrat est obligatoire." };
    // Un contrat sans co-contractant n'est pas un contrat : c'est une note.
    if (!counterparty) return { ok: false, error: "Indiquez le consultant ou le cabinet — un contrat a deux parties." };

    const startDate = dateOf(fdStr(formData, "startDate"));
    const endDate = dateOf(fdStr(formData, "endDate"));
    if (startDate && endDate && endDate < startDate) {
      return { ok: false, error: "La date de fin ne peut pas précéder la date de début." };
    }

    // Les tâches arrivent en une saisie par ligne : c'est ainsi qu'on les dicte, et découper à
    // la main dans un formulaire aurait tout l'air d'une corvée.
    const tasks = (fdStr(formData, "tasks") ?? "")
      .split("\n").map((t) => t.trim()).filter(Boolean).slice(0, 60);

    const companyId = fdStr(formData, "companyId") || (await companyIdForNew(user.id));
    // LE PRATICIEN ET LE PRODUIT CONCERNÉS — lus par le lecteur canonique des six natures.
    // Facultatifs ici (`REFERENTIELS_PAR_NATURE`) : un accompagnement réglementaire n'a pas de
    // praticien, et exiger un choix qui n'existe pas serait un refus à tort (§118.27).
    const couple = {
      medecins: lireMedecinsDemande(formData.getAll("doctorIds").map(String), fdStr(formData, "doctorHorsAnnuaire"), fdStr(formData, "doctor")),
      produits: readMultiField(formData.getAll("productIds").map(String), fdStr(formData, "product")),
    };

    // La référence se recalcule à CHAQUE tentative : c'est ce qui rend le réessai utile quand
    // deux contrats partent en même temps.
    const contract = await createWithRetry(async () =>
      prisma.consultingContract.create({
        data: {
          reference: await nextRef(),
          pole,
          // LA GAMME QUI PORTE LA DEMANDE — c'est SON budget Ad&Pro qui est engagé. Le
          // formulaire l'exigeait depuis que les gammes existent ; ni le modèle ni cette action
          // ne l'avaient, donc le choix imposé au demandeur était JETÉ (§118.140).
          // Côté RH, ni gamme, ni praticien, ni produit : ce sont des faits de PROMOTION, et un
          // contrat RH ne pèse sur aucun budget Ad & Pro.
          businessUnitId: pole === "AD_PRO" ? fdStr(formData, "businessUnitId") || null : null,
          doctor: pole === "AD_PRO" ? couple.medecins : null,
          product: pole === "AD_PRO" ? couple.produits : null,
          title,
          counterparty,
          counterpartyContact: fdStr(formData, "counterpartyContact"),
          companyId: companyId || null,
          scope: fdStr(formData, "scope"),
          startDate, endDate,
          amount: fdNum(formData, "amount") ?? null,
          billing: billingOf(fdStr(formData, "billing")),
          paymentTerms: fdStr(formData, "paymentTerms"),
          notes: fdStr(formData, "notes"),
          status: "DRAFT",
          requesterId: user.id,
          createdById: user.id,
          updatedById: user.id,
          tasks: { create: tasks.map((label, i) => ({ label, position: i })) },
        },
      }),
    );

    // Les pièces déposées à la saisie sont rattachées tout de suite : un contrat sans son
    // exemplaire signé n'est qu'une note.
    const attached = await attachFiles({
      files: formData.getAll("files").filter((f): f is File => f instanceof File),
      entityType: "CONSULTING_CONTRACT", entityId: contract.id, uploadedById: user.id, category: "CONVENTION",
    });

    await audit(user, contract.id, "CREATE", `Contrat de consulting créé — ${contract.reference} (${counterparty})${attached.saved > 0 ? ` (${attached.saved} pièce(s))` : ""}`);

    // LE FAIT MÉTIER, inscrit au registre transverse — et c'est lui qui règle le défaut réel :
    // une tâche « Déposer le contrat de la consultante dans Ad&Pro > Consulting » est restée
    // « à faire » alors que Yacine AVAIT déposé le contrat, et Adam l'a annoncée en retard.
    //
    // On n'inscrit `CONTRACT_SIGNED` que si une PIÈCE a réellement été jointe : un contrat créé
    // sans son exemplaire n'est qu'une intention, et satisfaire une demande de dépôt avec une
    // intention rendrait le rapprochement faux dans l'autre sens.
    if (attached.saved > 0) {
      await recordEvent({
        type: "CONTRACT_SIGNED",
        sourceDomain: "ADPRO_CONSULTING",
        actorId: user.id,
        entityType: "CONSULTING_CONTRACT",
        entityId: contract.id,
        payload: { reference: contract.reference, counterparty, pieces: attached.saved },
      });
    }

    revalidate(contract.id);
    return { ok: true, id: contract.id };
  } catch (err) {
    console.error("[consulting] createConsultingContract failed", err);
    return { ok: false, error: "Le contrat n'a pas pu être créé. Réessayez dans un instant." };
  }
}

// ───────────────────────── Circuit ─────────────────────────

/** Le porteur demande la validation, et désigne à qui. */
export async function requestConsultingValidation(formData: FormData): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const id = fdStr(formData, "id");
    if (!id) return { ok: false, error: "Contrat introuvable." };
    const c = await prisma.consultingContract.findUnique({ where: { id } });
    if (!c) return { ok: false, error: "Contrat introuvable." };
    if (!owns(user, c)) return { ok: false, error: "Seul le porteur du contrat peut le soumettre." };

    const next = nextConsultingStatus(c.status, "SUBMIT");
    if (!next) return { ok: false, error: "Ce contrat n'est plus au stade de la soumission." };

    const validatorId = fdStr(formData, "validatorId");
    await prisma.consultingContract.update({
      where: { id }, data: { status: next as ConsultingStatus, validatorId, updatedById: user.id },
    });

    // ── LA PORTE DU CENTRE DE VALIDATION AD & PRO ────────────────────────────────────────────
    // Un contrat de consulting n'avait AUCUNE porte au-dessus du seuil : mesuré sur sa machine à
    // états, rien n'y consultait `adProDgThreshold`, donc un engagement de 5 M DZD sortait sans
    // que personne en haut l'ait vu. Un centre qui laisserait passer cette nature serait une
    // porte ouverte à côté d'une porte gardée (§118.71).
    //
    // À la SOUMISSION et pas à la création : un brouillon change de montant jusqu'à la dernière
    // minute, et faire arbitrer le centre sur un chiffre provisoire le ferait travailler sur une
    // demande que son auteur n'a pas encore envoyée.
    // Seulement côté Ad & Pro : un contrat RH ne passe pas par le centre de la PROMOTION (§118.150)
    // — le lui faire arbitrer confierait la rémunération d'un consultant de l'équipe à un centre
    // qui ne voit que les dépenses de promotion, et la bloquerait pour toujours côté RH.
    const visa = poleDe(c.pole) === "AD_PRO"
      ? await poserVisaAdPro("CONSULTING_CONTRACT", id, c.amount == null ? null : toNumber(c.amount))
      : null;

    const body = `${c.reference} — ${c.title} (${c.counterparty})`;
    if (visa === "PENDING") {
      // On prévient le CENTRE, pas le validateur : c'est lui qui a la main, et prévenir les deux
      // ferait croire au validateur qu'il peut trancher — il se heurterait au blocage (§118.30).
      await notifyRoles(["GENERAL_MANAGER", "SUPER_ADMIN"], {
        type: "VALIDATION_REQUIRED", title: "Centre Ad & Pro — contrat de consulting au-dessus du seuil",
        body, link: "/centre-ad-pro",
      });
    } else if (validatorId) {
      await notifyUser({ userId: validatorId, type: "VALIDATION_REQUIRED", title: "Contrat de consulting à valider", body, link: `${PATH}/${id}` });
    } else {
      await notifyRoles(["DIRECTION", "SUPER_ADMIN"], { type: "VALIDATION_REQUIRED", title: "Contrat de consulting à valider", body, link: `${PATH}/${id}` });
    }
    await audit(user, id, "UPDATE", `Contrat soumis à validation — ${c.reference}`);
    revalidate(id);
    return { ok: true, id };
  } catch (err) {
    console.error("[consulting] requestConsultingValidation failed", err);
    return { ok: false, error: "La soumission a échoué." };
  }
}

/** Valider (le contrat devient ACTIF) ou refuser (il est annulé, avec son motif). */
export async function decideConsultingContract(formData: FormData): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const id = fdStr(formData, "id");
    const approve = fdStr(formData, "approve") === "1";
    if (!id) return { ok: false, error: "Contrat introuvable." };
    const c = await prisma.consultingContract.findUnique({ where: { id } });
    if (!c) return { ok: false, error: "Contrat introuvable." };

    // La désignation ne crée pas le droit : elle DÉSIGNE quelqu'un qui l'a déjà. Sans quoi
    // n'importe qui se nommerait validateur de son propre contrat.
    const mayDecide = peutSurLeContrat(user, c, "VALIDATE") && (c.validatorId === null || c.validatorId === user.id || isDirection(user));
    if (!mayDecide) return { ok: false, error: "La décision revient au validateur désigné." };

    // LA PORTE DU CENTRE PASSE AVANT LA DÉCISION. Sans cette ligne, le validateur désigné
    // trancherait un engagement que le centre n'a pas encore arbitré — la porte existerait en
    // base et ne garderait rien (§118.14).
    const blocage = poleDe(c.pole) === "AD_PRO" ? await blocageCentreAdPro("CONSULTING_CONTRACT", id) : null;
    if (blocage) return { ok: false, error: blocage };

    const next = nextConsultingStatus(c.status, approve ? "APPROVE" : "REFUSE");
    if (!next) return { ok: false, error: "Ce contrat n'attend pas de décision." };

    await prisma.consultingContract.update({
      where: { id },
      data: {
        status: next as ConsultingStatus,
        validatedById: user.id,
        validatedAt: new Date(),
        decisionNote: fdStr(formData, "note"),
        cancelledAt: approve ? null : new Date(),
        updatedById: user.id,
      },
    });

    if (c.requesterId) {
      await notifyUser({
        userId: c.requesterId, type: "GENERIC",
        title: approve ? "Contrat de consulting validé" : "Contrat de consulting refusé",
        body: `${c.reference} — ${c.title}`, link: `${PATH}/${id}`,
      });
    }
    await audit(user, id, "VALIDATE", `${approve ? "Contrat validé (actif)" : "Contrat refusé"} — ${c.reference}`);
    revalidate(id);
    return { ok: true, id };
  } catch (err) {
    console.error("[consulting] decideConsultingContract failed", err);
    return { ok: false, error: "La décision n'a pas pu être enregistrée." };
  }
}

/** Clore un contrat arrivé à son terme, ou rompre un contrat en cours. */
export async function closeConsultingContract(formData: FormData): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const id = fdStr(formData, "id");
    const cancel = fdStr(formData, "cancel") === "1";
    if (!id) return { ok: false, error: "Contrat introuvable." };
    const c = await prisma.consultingContract.findUnique({ where: { id } });
    if (!c) return { ok: false, error: "Contrat introuvable." };
    if (!owns(user, c) && !peutSurLeContrat(user, c, "VALIDATE")) {
      return { ok: false, error: "Seuls le porteur du contrat ou un validateur peuvent le clore." };
    }

    const next = nextConsultingStatus(c.status, cancel ? "CANCEL" : "EXPIRE");
    if (!next) return { ok: false, error: "Ce contrat est déjà clos." };

    await prisma.consultingContract.update({
      where: { id },
      data: {
        status: next as ConsultingStatus,
        cancelledAt: cancel ? new Date() : null,
        decisionNote: fdStr(formData, "note") ?? c.decisionNote,
        updatedById: user.id,
      },
    });
    // ANNULÉ, IL N'A PLUS RIEN À FAIRE ARBITRER (audit 360°, lot C3) : la porte qui attendait le centre
    // Ad & Pro est retirée — sans quoi le centre trancherait une demande morte. Une décision déjà
    // RENDUE reste : c'est de l'histoire.
    const portes = cancel ? await retirerVisaEnAttente("CONSULTING_CONTRACT", id) : 0;
    await audit(user, id, "UPDATE", `${cancel ? "Contrat annulé" : "Contrat arrivé à expiration"} — ${c.reference}${portes ? " (sa demande au centre Ad & Pro est retirée)" : ""}`);
    revalidate(id);
    return { ok: true, id };
  } catch (err) {
    console.error("[consulting] closeConsultingContract failed", err);
    return { ok: false, error: "L'opération a échoué." };
  }
}

// ───────────────────────── Tâches attendues ─────────────────────────

export async function addConsultingTask(formData: FormData): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const contractId = fdStr(formData, "contractId");
    const label = fdStr(formData, "label");
    if (!contractId || !label) return { ok: false, error: "Décrivez la tâche attendue." };
    const c = await prisma.consultingContract.findUnique({ where: { id: contractId } });
    if (!c) return { ok: false, error: "Contrat introuvable." };
    if (!owns(user, c) && !peutSurLeContrat(user, c, "UPDATE")) return { ok: false, error: "Modification non autorisée." };

    const count = await prisma.consultingTask.count({ where: { contractId } });
    await prisma.consultingTask.create({
      data: { contractId, label, dueDate: dateOf(fdStr(formData, "dueDate")), position: count },
    });
    await audit(user, contractId, "UPDATE", `Tâche ajoutée au contrat ${c.reference}`);
    revalidate(contractId);
    return { ok: true, id: contractId };
  } catch (err) {
    console.error("[consulting] addConsultingTask failed", err);
    return { ok: false, error: "La tâche n'a pas pu être ajoutée." };
  }
}

/** Cocher / décocher une tâche livrée. */
export async function toggleConsultingTask(formData: FormData): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const taskId = fdStr(formData, "taskId");
    if (!taskId) return { ok: false, error: "Tâche introuvable." };
    const task = await prisma.consultingTask.findUnique({ where: { id: taskId }, include: { contract: true } });
    if (!task) return { ok: false, error: "Tâche introuvable." };
    if (!owns(user, task.contract) && !peutSurLeContrat(user, task.contract, "UPDATE")) return { ok: false, error: "Modification non autorisée." };

    await prisma.consultingTask.update({ where: { id: taskId }, data: { doneAt: task.doneAt ? null : new Date() } });
    revalidate(task.contractId);
    return { ok: true, id: task.contractId };
  } catch (err) {
    console.error("[consulting] toggleConsultingTask failed", err);
    return { ok: false, error: "L'opération a échoué." };
  }
}

export async function deleteConsultingTask(formData: FormData): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const taskId = fdStr(formData, "taskId");
    if (!taskId) return { ok: false, error: "Tâche introuvable." };
    const task = await prisma.consultingTask.findUnique({ where: { id: taskId }, include: { contract: true } });
    if (!task) return { ok: false, error: "Tâche introuvable." };
    if (!owns(user, task.contract) && !peutSurLeContrat(user, task.contract, "UPDATE")) return { ok: false, error: "Suppression non autorisée." };
    if (!isContractEditable(task.contract.status)) return { ok: false, error: "Un contrat clos ne se modifie plus." };

    await prisma.consultingTask.delete({ where: { id: taskId } });
    revalidate(task.contractId);
    return { ok: true, id: task.contractId };
  } catch (err) {
    console.error("[consulting] deleteConsultingTask failed", err);
    return { ok: false, error: "L'opération a échoué." };
  }
}

// ───────────────────────── Le pôle ─────────────────────────

/**
 * TRANSFÉRER UN CONTRAT D'UN PÔLE À L'AUTRE — Ad & Pro ⇄ Ressources humaines (§118.150).
 *
 * « Transfère le consulting de Consultant médical — Atakor Minds, qui est dans Consulting d'Ad&Pro,
 * à un consulting en RH. » Un GESTE et non une migration : c'est une personne habilitée des deux
 * côtés qui décide qu'un contrat relève des RH, pas un déploiement — et le même geste le ramène.
 *
 * Ce qu'il NE fait PAS, et c'est voulu : il ne détruit rien. La gamme, les praticiens et les
 * produits restent sur la ligne (lus seulement côté Ad & Pro) : un transfert se défait par le geste
 * inverse, et un aller-retour ne doit rien avoir perdu. La référence, les tâches, les pièces, la
 * validation et l'historique suivent — c'est le MÊME contrat.
 *
 * Ce qu'il DÉPLACE, parce que chacun le lisait sur l'ancien pôle (§118.61) :
 *   • la porte du centre Ad & Pro encore EN ATTENTE — un contrat RH ne passe pas par le centre
 *     de la promotion ; la laisser ferait arbitrer par ce centre un contrat qui n'en relève plus.
 *     Une décision déjà PRISE reste : c'est de l'histoire, pas une attente. À l'inverse, un contrat
 *     qui ENTRE dans Ad & Pro en attente de validation passe par la porte, comme à sa soumission ;
 *   • le VALIDATEUR désigné qui n'a pas le droit de valider dans la nouvelle maison — sans quoi la
 *     décision reviendrait à quelqu'un que l'action refusera, et à lui seul : une attente sans
 *     pouvoir. La désignation tombe, le journal garde son nom, et la Direction est prévenue ;
 *   • les BONS DE COMMANDE en attente d'un centre qui en descendent — ils suivent la règle « Ad &
 *     Pro si la demande vient d'Ad & Pro, sinon le centre normal », relue par `aiguillerBC`.
 *
 * QUI : il faut MODIFIER des deux côtés (`transfertAutorise`) — retirer un contrat à ceux qui le
 * suivaient et le confier à d'autres n'est ni un geste de la seule promotion, ni des seules RH.
 */
export async function transfererConsulting(formData: FormData): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const id = fdStr(formData, "id");
    if (!id) return { ok: false, error: "Contrat introuvable." };
    const c = await prisma.consultingContract.findUnique({ where: { id } });
    if (!c) return { ok: false, error: "Contrat introuvable." };

    const depart = poleDe(c.pole);
    // Sans destination, l'autre pôle : il n'y en a que deux. Une destination ILLISIBLE est
    // refusée, jamais devinée — transférer « quelque part » serait pire que ne rien faire.
    const versBrut = fdStr(formData, "vers");
    if (versBrut !== null && !estPoleConsulting(versBrut)) {
      return { ok: false, error: `Pôle inconnu : « ${versBrut} ». Les deux pôles sont Ad & Pro (AD_PRO) et Ressources humaines (RH).` };
    }
    const vers: PoleConsulting = versBrut !== null && estPoleConsulting(versBrut) ? versBrut : poleOppose(depart);
    if (vers === depart) return { ok: false, error: `Ce contrat relève déjà de ${LIBELLE_POLE[vers]}.` };

    if (!transfertAutorise({
      modifieDepart: peutSurLeContrat(user, { pole: depart }, "UPDATE"),
      modifieArrivee: peutSurLeContrat(user, { pole: vers }, "UPDATE"),
    })) {
      return { ok: false, error: refusTransfert(depart, vers) };
    }

    const moduleArrivee = MODULE_DU_POLE[vers];
    const enAttente = c.status === "AWAITING_VALIDATION";

    // LE VALIDATEUR DÉSIGNÉ, RELU DANS SA NOUVELLE MAISON. La désignation ne crée pas le droit :
    // si la personne n'a pas VALIDATE sur le module d'arrivée, `decideConsultingContract` la
    // refusera — et, la désignation tenant, refusera aussi tout autre validateur de ce module.
    let validateurRetire: string | null = null;
    if (enAttente && c.validatorId) {
      const v = await prisma.user.findUnique({
        where: { id: c.validatorId }, select: { id: true, name: true, role: true, isActive: true },
      });
      const garde = v?.isActive
        ? userCan({ role: v.role, access: await getAccess(v.id, v.role) } as SessionUser, moduleArrivee, "VALIDATE")
        : false;
      if (!garde) validateurRetire = v?.name ?? "le validateur désigné";
    }

    await prisma.consultingContract.update({
      where: { id },
      data: { pole: vers, updatedById: user.id, ...(validateurRetire ? { validatorId: null } : {}) },
    });

    // LA PORTE DU CENTRE AD & PRO — retirée si elle ATTENDAIT, posée si le contrat entre en attente.
    let porte: "RETIREE" | "POSEE" | null = null;
    if (depart === "AD_PRO") {
      if ((await retirerVisaEnAttente("CONSULTING_CONTRACT", id)) > 0) porte = "RETIREE";
    } else if (enAttente) {
      const etat = await poserVisaAdPro("CONSULTING_CONTRACT", id, c.amount == null ? null : toNumber(c.amount));
      if (etat === "PENDING") porte = "POSEE";
    }

    // LES BONS DE COMMANDE qui attendent un centre et descendent de ce contrat.
    const bc = await reaiguillerLesBCDe({ type: "CONSULTING_CONTRACT", id }, user.id);

    const precisions = [
      porte === "RETIREE" ? "sa validation en attente est retirée du centre Ad & Pro" : null,
      porte === "POSEE" ? "il passe par le centre de validation Ad & Pro (au-dessus du seuil)" : null,
      validateurRetire ? `la désignation de ${validateurRetire} comme validateur tombe (pas de droit de validation en ${LIBELLE_POLE[vers]})` : null,
      bc.transferes > 0 ? `${bc.transferes} bon(s) de commande en attente change(nt) de centre` : null,
      // Une lecture BORNÉE qui se tairait se lirait comme exhaustive (§118.60) : le drapeau était
      // calculé par l'aiguillage et lu par personne — un état qu'aucun code ne lit (§118.45).
      bc.tronque
        ? `les files de validation comptent plus de ${LOT_ORIGINE} bons de commande en attente : seuls les plus anciens ont été relus, les autres rejoindront le bon centre à leur prochaine modification`
        : null,
    ].filter((x): x is string => x !== null);
    await recordAudit({
      actorId: user.id, action: "UPDATE", module: "Consulting", entityType: "CONSULTING_CONTRACT", entityId: id,
      field: "pole", oldValue: depart, newValue: vers,
      summary: `Contrat ${c.reference} transféré de ${LIBELLE_POLE[depart]} vers ${LIBELLE_POLE[vers]}`
        + (precisions.length ? ` — ${precisions.join(" ; ")}.` : "."),
    });

    const body = `${c.reference} — ${c.title} (${c.counterparty})`;
    // LE PORTEUR EST PRÉVENU — sans quoi son contrat disparaît de sa liste sans explication. Le
    // lien n'est donné que s'il mène quelque part : un porteur sans le module d'arrivée ne voit
    // plus la fiche, et un lien vers « introuvable » dit moins que pas de lien du tout.
    const porteurId = c.requesterId ?? c.createdById;
    if (porteurId && porteurId !== user.id) {
      const p = await prisma.user.findUnique({ where: { id: porteurId }, select: { id: true, role: true, isActive: true } });
      if (p?.isActive) {
        const voit = userCan({ role: p.role, access: await getAccess(p.id, p.role) } as SessionUser, moduleArrivee, "VIEW");
        await notifyUser({
          userId: p.id, type: "GENERIC",
          title: `Contrat de consulting transféré vers ${LIBELLE_POLE[vers]}`,
          body: voit ? body : `${body} — il est désormais suivi par ${LIBELLE_POLE[vers]}.`,
          ...(voit ? { link: `${PATH}/${id}` } : {}),
        });
      }
    }
    if (porte === "POSEE") {
      await notifyRoles(["GENERAL_MANAGER", "SUPER_ADMIN"], {
        type: "VALIDATION_REQUIRED", title: "Centre Ad & Pro — contrat de consulting au-dessus du seuil",
        body, link: "/centre-ad-pro",
      });
    } else if (validateurRetire) {
      // La désignation tombée, c'est la Direction qui tranche : on la prévient, comme à une
      // soumission sans désignation.
      await notifyRoles(["DIRECTION", "SUPER_ADMIN"], {
        type: "VALIDATION_REQUIRED", title: "Contrat de consulting à valider", body, link: `${PATH}/${id}`,
      });
    }

    revalidate(id);
    revalidatePath("/centre-ad-pro");
    return {
      ok: true, id,
      message: `Contrat ${c.reference} transféré vers ${LIBELLE_POLE[vers]}`
        + (precisions.length ? ` — ${precisions.join(" ; ")}.` : "."),
    };
  } catch (err) {
    console.error("[consulting] transfererConsulting failed", err);
    return { ok: false, error: "Le transfert a échoué." };
  }
}
