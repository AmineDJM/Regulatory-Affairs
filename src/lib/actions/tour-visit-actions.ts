"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { userCan, hasGlobalView } from "@/lib/rbac";
import { canAccessEntity } from "@/lib/entity-access";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { fdStr, fdDate, type ActionResult } from "@/lib/actions/types";
import { fenetreRapport } from "@/lib/sfe/tournee";

/**
 * LE RAPPORT TERRAIN D'UNE VISITE PLANIFIÉE, la visite IMPRÉVUE, et celle que la Direction
 * COMMANDE.
 *
 * ── POURQUOI CE N'EST PAS `logVisit` ────────────────────────────────────────────────────────
 *
 * `logVisit` CRÉE une visite (statut `COMPLETED`) : c'est le geste de « Ma journée », où le KAM
 * saisit une visite qui n'était pas dans un plan. Rapporter une visite PLANIFIÉE est l'inverse —
 * la ligne existe déjà, il faut la METTRE À JOUR. L'appeler à sa place aurait laissé la visite
 * planifiée GRISE pour toujours et créé un doublon à côté : l'emploi du temps aurait affiché
 * « à faire » sur une visite faite, et le dénominateur aurait compté deux fois.
 *
 * ── LES 48 HEURES SONT UNE BORNE DURE, CÔTÉ SERVEUR ─────────────────────────────────────────
 *
 * La règle vit dans le module pur (`fenetreRapport`) et l'écran ne fait que l'afficher. Un
 * verrou qui ne serait qu'à l'écran se contourne en rechargeant la page.
 */

const MODULE = "MEDICAL" as const;
const PATH_JOURNEE = "/medical/ma-journee";
const PATH_TOURNEE = "/medical/plan-de-tournee";

/** Le KAM peut-il écrire sur cette visite ? Lui, ou une supervision qui la couvre. */
async function peutRapporter(
  user: Awaited<ReturnType<typeof requireUser>>,
  visite: { id: string; delegateId: string | null; doctorId: string | null },
): Promise<boolean> {
  if (visite.delegateId === user.id) return true;
  if (hasGlobalView(user)) return true;
  return visite.doctorId ? canAccessEntity(user, "DOCTOR", visite.doctorId, "UPDATE") : false;
}

/**
 * LES PRODUITS ADMIS pour ce KAM — ceux de SA Business Unit, résolus vers le produit canonique.
 *
 * `PromoProduct` porte la gamme (`businessUnitId`) et pointe sur le produit canonique
 * (`productId`) ; c'est ce dernier que `MedicalVisitProduct` lie. Un produit promu SANS produit
 * canonique ne peut pas être rattaché à une visite : on le DIT au lieu de le laisser disparaître
 * du rapport après que le KAM l'a coché (§118.71 — une valeur non résolue ne doit jamais
 * disparaître en silence).
 */
async function produitsDeLaBu(repId: string): Promise<{ admis: Set<string>; sansCanonique: string[] }> {
  const profil = await prisma.salesRepProfile.findUnique({
    where: { repId },
    select: { businessUnitId: true },
  });
  if (!profil?.businessUnitId) return { admis: new Set(), sansCanonique: [] };
  const promus = await prisma.promoProduct.findMany({
    where: { businessUnitId: profil.businessUnitId, isActive: true },
    select: { name: true, productId: true },
  });
  return {
    admis: new Set(promus.map((p) => p.productId).filter((x): x is string => Boolean(x))),
    sansCanonique: promus.filter((p) => !p.productId).map((p) => p.name),
  };
}

/**
 * RAPPORTER UNE VISITE PLANIFIÉE — vocal ou écrit, en un envoi.
 *
 * ── CE QUI EST OBLIGATOIRE, ET POURQUOI CE N'EST PAS UN CAPRICE ─────────────────────────────
 *
 * Le ou les PRODUITS discutés, et le ou les MESSAGES pré-définis de la Direction Marketing. Sans
 * eux, un rapport terrain ne dit ni ce qui a été promu ni ce qui a été dit — donc ni l'effort
 * par produit ni l'efficacité d'un message ne se mesurent, et c'est précisément ce que la
 * Direction demande de savoir.
 *
 * Le CONTENU (écrit ou vocal) est obligatoire aussi : une visite « rapportée » sans un mot est
 * une case cochée, pas un compte rendu — et l'emploi du temps passerait au vert sur du vide.
 */
export async function rapporterVisite(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, MODULE, "CREATE")) return { ok: false, error: "Non autorisé." };
  const visitId = fdStr(formData, "visitId");
  if (!visitId) return { ok: false, error: "Visite introuvable." };
  const visite = await prisma.medicalVisit.findUnique({
    where: { id: visitId },
    select: { id: true, date: true, status: true, delegateId: true, doctorId: true, tourPlanId: true },
  });
  if (!visite) return { ok: false, error: "Visite introuvable." };
  if (!(await peutRapporter(user, visite))) return { ok: false, error: "Cette visite n'est pas la vôtre." };

  // ── LE VERROU DE 48 H ─────────────────────────────────────────────────────────────────────
  // Le refus dit COMBIEN il restait, pas seulement « trop tard » : sans le délai, la personne
  // découvre la borne au moment où elle ne peut plus rien (§118.30).
  const f = fenetreRapport(visite.date, new Date());
  if (!f.ouvert) {
    return {
      ok: false,
      error: `Le rapport d'une visite se fait dans les 48 h : la fenêtre de celle du ${visite.date.toLocaleDateString("fr-FR")} s'est fermée le ${f.limite.toLocaleDateString("fr-FR")} à ${f.limite.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}. `
        + "Elle reste visible comme non rapportée — signalez-la à votre superviseur, qui peut la régulariser.",
    };
  }

  const rapport = fdStr(formData, "report");
  const transcription = fdStr(formData, "transcript");
  const contenu = rapport ?? transcription;
  if (!contenu) {
    return { ok: false, error: "Dictez ou écrivez le compte rendu : une visite rapportée sans un mot est une case cochée, pas un compte rendu." };
  }

  // ── LES PRODUITS — ceux de SA BU, et rien d'autre ─────────────────────────────────────────
  const productIds = [...new Set(formData.getAll("productId").map(String).filter(Boolean))];
  if (productIds.length === 0) {
    return { ok: false, error: "Choisissez le ou les produits discutés avec le médecin — sans eux, l'effort par produit ne se mesure pas." };
  }
  const { admis, sansCanonique } = await produitsDeLaBu(visite.delegateId ?? user.id);
  const horsBu = productIds.filter((id) => !admis.has(id));
  if (horsBu.length > 0) {
    return {
      ok: false,
      error: `${horsBu.length} produit(s) ne sont pas dans la gamme de ce KAM — un rapport ne porte que les produits de sa Business Unit.`
        + (sansCanonique.length > 0
          ? ` À noter : ${sansCanonique.length} produit(s) promu(s) de sa gamme (${sansCanonique.slice(0, 3).join(", ")}) n'ont pas de produit canonique rattaché et ne peuvent donc pas figurer dans un rapport — à corriger dans Force de vente › Business Units.`
          : ""),
    };
  }
  const produits = await prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true, canonicalName: true } });

  // ── LES MESSAGES PRÉ-DÉFINIS ──────────────────────────────────────────────────────────────
  const messageIds = [...new Set(formData.getAll("messageId").map(String).filter(Boolean))];
  if (messageIds.length === 0) {
    return { ok: false, error: "Choisissez le ou les messages de la Direction Marketing que vous avez portés — c'est ce qui rend leur efficacité mesurable." };
  }
  const messages = await prisma.promoMessage.findMany({
    where: { id: { in: messageIds }, isActive: true },
    select: { id: true },
  });
  if (messages.length !== messageIds.length) {
    return { ok: false, error: `${messageIds.length - messages.length} message(s) sélectionné(s) ne sont plus actifs — rechargez l'écran.` };
  }

  await prisma.$transaction(async (tx) => {
    await tx.medicalVisit.update({
      where: { id: visite.id },
      data: {
        status: "COMPLETED",
        report: contenu,
        doctorFeedback: fdStr(formData, "doctorFeedback"),
        followUpActions: fdStr(formData, "followUpActions"),
        // Le texte hérité reste renseigné pour les écrans qui le lisent encore ; la VÉRITÉ
        // exploitable est dans les liens.
        presentedProducts: produits.map((p) => p.canonicalName).join(", ") || null,
        updatedById: user.id,
      },
    });
    // Les liens sont REMPLACÉS : corriger un rapport dans sa fenêtre doit pouvoir retirer un
    // produit coché par erreur.
    await tx.medicalVisitProduct.deleteMany({ where: { visitId: visite.id } });
    await tx.medicalVisitProduct.createMany({
      data: productIds.map((productId) => ({ visitId: visite.id, productId })),
      skipDuplicates: true,
    });
    await tx.medicalVisitMessage.deleteMany({ where: { visitId: visite.id } });
    await tx.medicalVisitMessage.createMany({
      data: messageIds.map((messageId) => ({ visitId: visite.id, messageId })),
      skipDuplicates: true,
    });
    if (visite.doctorId) {
      // La fiche du praticien porte sa dernière visite : sans cette mise à jour, la tournée du
      // lendemain le reproposerait en tête.
      await tx.medicalDoctor.update({ where: { id: visite.doctorId }, data: { lastVisit: visite.date } });
    }
    // UN RAPPORT VOCAL est un `FieldReport` — l'objet du module Rapports terrain, avec sa
    // transcription et sa propre validation. On le RATTACHE à la visite (`visitId`) : sans le
    // lien, l'emploi du temps ne pourrait pas passer au vert sur un rapport dicté (§118.5 : on
    // ajoute le lien, on ne fond pas les deux objets).
    if (transcription) {
      await tx.fieldReport.create({
        data: {
          delegateId: visite.delegateId ?? user.id,
          visitId: visite.id,
          visitDate: visite.date,
          doctorId: visite.doctorId,
          transcript: transcription,
          status: "DRAFT",
        },
      });
    }
  });

  await recordAudit({
    actorId: user.id, action: "UPDATE", module: "Promotion médicale",
    entityType: "VISIT", entityId: visite.id,
    summary: `Rapport terrain — ${produits.length} produit(s), ${messageIds.length} message(s)${transcription ? " (vocal)" : ""}`,
  });
  revalidatePath(PATH_JOURNEE);
  revalidatePath(PATH_TOURNEE);
  return { ok: true, id: visite.id };
}

/**
 * UNE VISITE IMPRÉVUE — « en sortant de l'hôpital il rencontre un médecin ».
 *
 * Elle ne descend d'AUCUN plan (`tourPlanId` nul, `origin: UNPLANNED`) : c'est exactement ce qui
 * l'empêche de gonfler le dénominateur de « visitées / planifiées ». Le message est FACULTATIF
 * ici — la demande le dit, et c'est cohérent : une rencontre de couloir n'a pas d'ordre de
 * mission.
 *
 * Elle est créée DÉJÀ RAPPORTÉE : le geste est « je viens de voir quelqu'un », pas « je prévois
 * de le voir ». La créer en attente ferait une visite grise que personne ne pense à rapporter.
 */
export async function ajouterVisiteImprevue(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, MODULE, "CREATE")) return { ok: false, error: "Non autorisé." };
  const doctorId = fdStr(formData, "doctorId");
  if (!doctorId) return { ok: false, error: "Choisissez le praticien rencontré." };
  const doctor = await prisma.medicalDoctor.findUnique({ where: { id: doctorId }, select: { id: true, name: true, delegateId: true } });
  if (!doctor) return { ok: false, error: "Praticien introuvable." };
  if (doctor.delegateId !== user.id && !(await canAccessEntity(user, "DOCTOR", doctorId, "UPDATE"))) {
    return { ok: false, error: "Ce praticien n'est pas dans votre panel." };
  }

  // JAMAIS DANS LE FUTUR : une visite « faite » demain n'existe pas. Et la fenêtre de 48 h
  // s'applique aussi ici — sans quoi une visite imprévue serait le moyen de contourner le
  // verrou en la datant d'il y a trois semaines.
  const maintenant = new Date();
  const saisie = fdDate(formData, "date");
  const date = saisie && saisie <= maintenant ? saisie : maintenant;
  const f = fenetreRapport(date, maintenant);
  if (!f.ouvert) {
    return {
      ok: false,
      error: `Une visite s'enregistre dans les 48 h : celle du ${date.toLocaleDateString("fr-FR")} est hors délai. `
        + "C'est la même borne que pour une visite planifiée — sans elle, l'ajout d'imprévu serait le moyen de la contourner.",
    };
  }

  const contenu = fdStr(formData, "report") ?? fdStr(formData, "transcript");
  if (!contenu) return { ok: false, error: "Dictez ou écrivez le compte rendu de cette rencontre." };
  const transcription = fdStr(formData, "transcript");

  const productIds = [...new Set(formData.getAll("productId").map(String).filter(Boolean))];
  const { admis } = await produitsDeLaBu(user.id);
  const horsBu = productIds.filter((id) => !admis.has(id));
  if (horsBu.length > 0) return { ok: false, error: `${horsBu.length} produit(s) hors de votre gamme.` };
  const produits = productIds.length
    ? await prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true, canonicalName: true } })
    : [];
  // LE MESSAGE EST FACULTATIF sur une visite imprévue (la demande le dit) — mais s'il est donné,
  // il est VÉRIFIÉ : un identifiant inconnu partirait en violation de clé étrangère.
  const messageIds = [...new Set(formData.getAll("messageId").map(String).filter(Boolean))];
  const messages = messageIds.length
    ? await prisma.promoMessage.findMany({ where: { id: { in: messageIds }, isActive: true }, select: { id: true } })
    : [];
  if (messages.length !== messageIds.length) {
    return { ok: false, error: `${messageIds.length - messages.length} message(s) ne sont plus actifs — rechargez l'écran.` };
  }

  const cree = await prisma.$transaction(async (tx) => {
    const v = await tx.medicalVisit.create({
      data: {
        date, doctorId, delegateId: user.id,
        status: "COMPLETED", origin: "UNPLANNED", tourPlanId: null,
        report: contenu,
        followUpActions: fdStr(formData, "followUpActions"),
        presentedProducts: produits.map((p) => p.canonicalName).join(", ") || null,
        createdById: user.id, updatedById: user.id,
      },
      select: { id: true },
    });
    if (productIds.length) {
      await tx.medicalVisitProduct.createMany({ data: productIds.map((productId) => ({ visitId: v.id, productId })), skipDuplicates: true });
    }
    if (messageIds.length) {
      await tx.medicalVisitMessage.createMany({ data: messageIds.map((messageId) => ({ visitId: v.id, messageId })), skipDuplicates: true });
    }
    await tx.medicalDoctor.update({ where: { id: doctorId }, data: { lastVisit: date } });
    if (transcription) {
      await tx.fieldReport.create({
        data: { delegateId: user.id, visitId: v.id, visitDate: date, doctorId, transcript: transcription, status: "DRAFT" },
      });
    }
    return v.id;
  });

  await recordAudit({
    actorId: user.id, action: "CREATE", module: "Promotion médicale",
    entityType: "VISIT", entityId: cree,
    summary: `Visite IMPRÉVUE — ${doctor.name}${produits.length ? ` (${produits.length} produit(s))` : ""}`,
  });
  revalidatePath(PATH_JOURNEE);
  revalidatePath(PATH_TOURNEE);
  return { ok: true, id: cree };
}

/**
 * LA DIRECTION COMMANDE UNE VISITE — « demain va voir Achour ».
 *
 * Elle arrive chez le KAM comme une visite à FAIRE (`PLANNED`), hors plan (`tourPlanId` nul,
 * `origin: DIRECTION`). Trois conséquences voulues :
 *  · elle apparaît dans son emploi du temps, grise, comme n'importe quelle visite prévue ;
 *  · elle ne gonfle pas le dénominateur du PLAN qu'il a fait valider — ce n'est pas lui qui l'a
 *    prévue, et l'y compter ferait baisser son taux pour une décision d'un autre ;
 *  · elle se DISTINGUE d'un imprévu du terrain : sans `origin`, « le KAM improvise beaucoup » et
 *    « la Direction envoie beaucoup de monde en urgence » se liraient pareil.
 *
 * Elle peut être datée DEMAIN — c'est tout l'objet du geste — et le verrou des 48 h ne s'y
 * applique donc pas à la création : il s'appliquera à son RAPPORT, par `rapporterVisite`.
 */
export async function commanderVisite(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const repId = fdStr(formData, "repId");
  const doctorId = fdStr(formData, "doctorId");
  if (!repId || !doctorId) return { ok: false, error: "Précisez le KAM et le praticien à voir." };

  // COMMANDER UNE VISITE À QUELQU'UN D'AUTRE EST UN ACTE DE SUPERVISION : `canEditRep` répond
  // déjà à « ai-je la main sur ce KAM ? ». Se la commander à soi-même n'a pas de sens — c'est
  // une visite planifiée ordinaire, ou un imprévu.
  if (repId === user.id) {
    return { ok: false, error: "Une visite qu'on se commande à soi-même est une visite planifiée : passez par votre plan de tournée, ou par « visite imprévue »." };
  }
  const { canEditRep } = await import("@/lib/sfe");
  if (!(await canEditRep(user, repId))) {
    return { ok: false, error: "Ce KAM n'est pas dans votre périmètre de supervision." };
  }
  const [kam, doctor] = await Promise.all([
    prisma.user.findUnique({ where: { id: repId }, select: { id: true, name: true, isActive: true } }),
    prisma.medicalDoctor.findUnique({ where: { id: doctorId }, select: { id: true, name: true } }),
  ]);
  if (!kam?.isActive) return { ok: false, error: "Ce compte KAM n'est pas actif." };
  if (!doctor) return { ok: false, error: "Praticien introuvable." };

  const date = fdDate(formData, "date");
  if (!date) return { ok: false, error: "Précisez le jour de la visite (« demain »)." };

  const cree = await prisma.medicalVisit.create({
    data: {
      date, doctorId, delegateId: repId,
      status: "PLANNED", origin: "DIRECTION", tourPlanId: null,
      objective: fdStr(formData, "objective"),
      createdById: user.id,
    },
    select: { id: true },
  });
  await recordAudit({
    actorId: user.id, action: "CREATE", module: "Promotion médicale",
    entityType: "VISIT", entityId: cree.id,
    summary: `Visite COMMANDÉE par la Direction — ${doctor.name} pour ${kam.name} le ${date.toLocaleDateString("fr-FR")}`,
  });
  revalidatePath(PATH_JOURNEE);
  revalidatePath(PATH_TOURNEE);
  return { ok: true, id: cree.id };
}
