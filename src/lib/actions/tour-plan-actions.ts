"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { userCan, hasGlobalView } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { getManagerOfUser } from "@/lib/departments";
import { fdStr, fdDate, type ActionResult } from "@/lib/actions/types";
import {
  bloquantsDeSoumission, echeanceDeSoumission, escaladeDuPlan, estGranularite,
  estJourOuvrePourTournee, gestesPossibles, limiteResoumission, periodeDe, reviseurDuPlan,
  type Granularite, type StatutPlan,
} from "@/lib/sfe/tournee";
import { lireReglageTournee } from "@/lib/sfe/tournee-reglage";

/**
 * LE PLAN DE TOURNÉE — écriture, soumission, escalade, décision.
 *
 * ── CE QUI EST ICI, ET CE QUI N'Y EST PAS ───────────────────────────────────────────────────
 *
 * Toutes les RÈGLES (période, échéance, qui valide, ce qui bloque une soumission, les 48 h)
 * vivent dans le module PUR `lib/sfe/tournee.ts` — ce fichier ne fait que les appeler, charger
 * ce qu'il faut, et écrire. C'est ce qui permet de tester les règles sans base, et d'exercer
 * les écritures par leur VRAI point d'entrée.
 *
 * ── LES VISITES SONT DES `MedicalVisit` ─────────────────────────────────────────────────────
 *
 * Une visite planifiée est une `MedicalVisit` au statut `PLANNED` rattachée au plan. C'est
 * l'objet canonique de l'ERP : lui donner une table jumelle aurait fait deux dénominateurs pour
 * « visitées / planifiées », et deux dénominateurs divergent toujours (§118.5, §118.51).
 */

const MODULE = "MEDICAL" as const;
const PATH_TOURNEE = "/medical/plan-de-tournee";
const PATH_JOURNEE = "/medical/ma-journee";

/**
 * QUI PEUT ÉCRIRE LE PLAN DE CE KAM : lui-même, le superviseur de sa BU, ou une vue globale.
 *
 * `canEditRep` (lib/sfe) répond déjà à « ai-je la main sur ce KAM ? » et c'est elle qui décide —
 * en écrire une seconde ici donnerait deux réponses à la même question (§118.5). Elle est
 * chargée par import dynamique : `lib/sfe` tire le paramétrage SFE, dont ce fichier n'a pas
 * besoin sur le chemin de refus.
 */
async function peutEcrirePourLeKam(user: Awaited<ReturnType<typeof requireUser>>, repId: string): Promise<boolean> {
  if (repId === user.id) return true;
  const { canEditRep } = await import("@/lib/sfe");
  return canEditRep(user, repId);
}

/**
 * OUVRIR (ou retrouver) LE PLAN d'un KAM pour la période qui contient `date`.
 *
 * Idempotent : rappeler l'action rend le MÊME plan. C'est ce qui permet à l'écran d'ouvrir la
 * planification sans se demander si le plan existe — et ce qui empêche deux plans concurrents
 * pour la même période, que la contrainte d'unicité refuserait de toute façon.
 */
export async function ouvrirPlanTournee(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, MODULE, "CREATE")) return { ok: false, error: "Non autorisé." };
  const repId = fdStr(formData, "repId") || user.id;
  if (!(await peutEcrirePourLeKam(user, repId))) {
    return { ok: false, error: "Ce KAM n'est pas dans votre périmètre — seul lui, le superviseur de sa BU ou la Direction peuvent écrire son plan." };
  }
  // LE RÉGLAGE VIENT DU LECTEUR UNIQUE (`sfe/tournee-reglage`) : la page du plan et le tableau de
  // bord de la Direction lisent le même — trois lectures du même JSON finissaient par lire trois
  // réglages (§118.5).
  const reglage = await lireReglageTournee();
  const granularite = ((): Granularite => {
    const g = fdStr(formData, "granularity");
    return g && estGranularite(g) ? g : reglage.granularite;
  })();
  const dans = fdDate(formData, "date") ?? new Date();
  const { debut, fin } = periodeDe(granularite, dans);

  const existant = await prisma.tourPlan.findUnique({
    where: { repId_periodStart_periodEnd: { repId, periodStart: debut, periodEnd: fin } },
    select: { id: true },
  });
  if (existant) return { ok: true, id: existant.id };

  const cree = await prisma.tourPlan.create({
    data: {
      repId, periodStart: debut, periodEnd: fin, granularity: granularite,
      // L'ÉCHÉANCE EST FIGÉE À LA CRÉATION : recalculée à la lecture, un changement de réglage
      // rendrait « en retard » un plan écrit sous une autre règle (§118.107).
      submissionDueAt: echeanceDeSoumission(debut, reglage.joursAvant),
      createdById: user.id,
    },
    select: { id: true },
  });
  revalidatePath(PATH_TOURNEE);
  return { ok: true, id: cree.id };
}

/**
 * PLANIFIER LES VISITES d'un plan — la sélection JOUR × MÉDECIN, envoyée COMPLÈTE.
 *
 * Le formulaire porte des entrées `visite` de la forme `AAAA-MM-JJ|<doctorId>` : l'écran coche
 * un médecin sous un jour, et c'est exactement cette paire qui fait une visite. La sélection
 * REMPLACE la précédente — décocher retire.
 *
 * ── CE QUI EST PRÉSERVÉ, ET POURQUOI ───────────────────────────────────────────────────────
 *
 * Une visite DÉJÀ RAPPORTÉE (statut hors `PLANNED`) n'est jamais supprimée par une
 * replanification : elle a eu lieu, et la retirer effacerait un fait au profit d'une intention.
 * C'est la même règle que les acquis d'un plan de mission (§118.33 / §118.67b) : ce qui a
 * produit un effet ne se rejoue pas et ne s'annule pas d'un trait de plume.
 */
export async function planifierVisites(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, MODULE, "CREATE")) return { ok: false, error: "Non autorisé." };
  const planId = fdStr(formData, "planId");
  if (!planId) return { ok: false, error: "Plan introuvable." };
  const plan = await prisma.tourPlan.findUnique({
    where: { id: planId },
    select: { id: true, repId: true, status: true, periodStart: true, periodEnd: true },
  });
  if (!plan) return { ok: false, error: "Plan introuvable." };
  if (!(await peutEcrirePourLeKam(user, plan.repId))) return { ok: false, error: "Ce plan n'est pas dans votre périmètre." };
  if (!gestesPossibles(plan.status as StatutPlan).modifiable) {
    return {
      ok: false,
      error: "Ce plan n'est plus modifiable : il est soumis, escaladé ou validé. Un plan validé porte la tournée que le KAM a déjà commencée — la changer sous ses pieds est exactement ce qu'un plan doit empêcher.",
    };
  }

  // ── LES PAIRES JOUR × MÉDECIN ─────────────────────────────────────────────────────────────
  const brut = [...new Set(formData.getAll("visite").map(String).filter(Boolean))];
  const paires: { jour: Date; doctorId: string }[] = [];
  const illisibles: string[] = [];
  for (const p of brut) {
    const [j, doctorId] = p.split("|");
    const d = j ? new Date(`${j}T09:00:00`) : null;
    if (!doctorId || !d || Number.isNaN(d.getTime())) { illisibles.push(p); continue; }
    paires.push({ jour: d, doctorId });
  }
  // ON NE DEVINE PAS une paire qu'on ne lit pas : la taire ferait un plan amputé qui a l'air
  // complet (§118.71 — une valeur non résolue ne doit jamais DISPARAÎTRE).
  if (illisibles.length > 0) {
    return { ok: false, error: `${illisibles.length} sélection(s) illisibles (« ${illisibles[0]} ») — rechargez l'écran.` };
  }

  // Les praticiens sont VÉRIFIÉS : un identifiant périmé partirait en violation de clé étrangère.
  const doctorIds = [...new Set(paires.map((p) => p.doctorId))];
  const praticiens = doctorIds.length
    ? await prisma.medicalDoctor.findMany({ where: { id: { in: doctorIds } }, select: { id: true } })
    : [];
  if (praticiens.length !== doctorIds.length) {
    return { ok: false, error: `${doctorIds.length - praticiens.length} praticien(s) sélectionné(s) n'existent plus — rechargez l'écran.` };
  }

  const dansLaPeriode = (d: Date) => d >= plan.periodStart && d <= plan.periodEnd;
  const horsPeriode = paires.filter((p) => !dansLaPeriode(p.jour));
  if (horsPeriode.length > 0) {
    return { ok: false, error: `${horsPeriode.length} visite(s) tombent hors de la période du plan.` };
  }

  const existantes = await prisma.medicalVisit.findMany({
    where: { tourPlanId: plan.id },
    select: { id: true, date: true, doctorId: true, status: true },
  });
  const cle = (d: Date, doctorId: string | null) =>
    `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}|${doctorId ?? ""}`;
  const voulues = new Set(paires.map((p) => cle(p.jour, p.doctorId)));
  const deja = new Map(existantes.map((v) => [cle(v.date, v.doctorId), v]));

  // CE QUI PART : les visites encore `PLANNED` que la nouvelle sélection ne contient plus.
  // Une visite rapportée reste, quoi qu'il arrive.
  const aRetirer = existantes.filter((v) => v.status === "PLANNED" && !voulues.has(cle(v.date, v.doctorId)));
  const aCreer = paires.filter((p) => !deja.has(cle(p.jour, p.doctorId)));

  await prisma.$transaction(async (tx) => {
    if (aRetirer.length > 0) await tx.medicalVisit.deleteMany({ where: { id: { in: aRetirer.map((v) => v.id) } } });
    if (aCreer.length > 0) {
      await tx.medicalVisit.createMany({
        data: aCreer.map((p) => ({
          date: p.jour, doctorId: p.doctorId, delegateId: plan.repId,
          status: "PLANNED" as const, origin: "PLAN" as const,
          tourPlanId: plan.id, createdById: user.id,
        })),
      });
    }
  });

  await recordAudit({
    actorId: user.id, action: "UPDATE", module: "Promotion médicale",
    entityType: "VISIT", entityId: plan.id,
    summary: `Plan de tournée — ${paires.length} visite(s) planifiée(s) (+${aCreer.length} / −${aRetirer.length})`,
  });
  revalidatePath(PATH_TOURNEE);
  revalidatePath(PATH_JOURNEE);
  return { ok: true, id: plan.id };
}

/**
 * SOUMETTRE LE PLAN AU N+1.
 *
 * Le validateur est résolu ICI et FIGÉ : une promotion entre la soumission et la décision ne
 * doit pas changer qui décide (§118.107). Quand personne ne surplombe le KAM, le refus le DIT
 * avec le geste — désigner un superviseur sur la BU — au lieu de laisser un plan sans issue.
 */
export async function soumettrePlanTournee(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, MODULE, "CREATE")) return { ok: false, error: "Non autorisé." };
  const planId = fdStr(formData, "planId");
  if (!planId) return { ok: false, error: "Plan introuvable." };
  const plan = await prisma.tourPlan.findUnique({
    where: { id: planId },
    select: {
      id: true, repId: true, status: true, periodStart: true, periodEnd: true,
      visits: { select: { id: true, date: true } },
    },
  });
  if (!plan) return { ok: false, error: "Plan introuvable." };
  if (!(await peutEcrirePourLeKam(user, plan.repId))) return { ok: false, error: "Ce plan n'est pas dans votre périmètre." };

  const bloquants = bloquantsDeSoumission({
    statut: plan.status as StatutPlan,
    nbVisites: plan.visits.length,
    nbHorsJoursOuvres: plan.visits.filter((v) => !estJourOuvrePourTournee(v.date)).length,
    nbHorsPeriode: plan.visits.filter((v) => v.date < plan.periodStart || v.date > plan.periodEnd).length,
  });
  // TOUS LES BLOQUANTS EN UNE FOIS : un refus par défaut ferait ressaisir un plan de quarante
  // visites autant de fois qu'il a de problèmes (§118.18).
  if (bloquants.length > 0) return { ok: false, error: bloquants.join(" ") };

  const profil = await prisma.salesRepProfile.findUnique({
    where: { repId: plan.repId },
    select: { businessUnit: { select: { supervisorId: true, name: true } } },
  });
  const managerRh = await getManagerOfUser(plan.repId);
  const reviseur = reviseurDuPlan({
    repId: plan.repId,
    superviseurBuId: profil?.businessUnit?.supervisorId ?? null,
    managerRhId: managerRh?.userId ?? null,
  });
  if (!reviseur) {
    return {
      ok: false,
      error: "Aucun validateur : ce KAM n'a ni superviseur sur sa BU ni N+1 à l'organigramme. "
        + "Désignez le superviseur de sa Business Unit (Force de vente › Business Units) — c'est lui qui valide un plan de tournée.",
    };
  }

  await prisma.tourPlan.update({
    where: { id: plan.id },
    data: {
      status: "SUBMITTED", submittedAt: new Date(), reviewerId: reviseur.id,
      // La décision précédente s'effface : ce qui repart en validation n'est plus rejeté.
      rejectionComment: null, resubmitDueAt: null, decidedAt: null, decidedById: null,
      escalatedToId: null, escalatedAt: null,
    },
  });
  await recordAudit({
    actorId: user.id, action: "UPDATE", module: "Promotion médicale",
    entityType: "VISIT", entityId: plan.id,
    summary: `Plan de tournée soumis à validation (${plan.visits.length} visite(s))`,
  });
  revalidatePath(PATH_TOURNEE);
  return { ok: true, id: plan.id };
}

/**
 * LE N+1 DEMANDE UNE VALIDATION À SON PROPRE N+1.
 *
 * La demande le prévoit explicitement. On n'escalade QU'UNE FOIS : un plan déjà chez le N+2 ne
 * remonte pas au N+3 — une chaîne sans fin ferait un plan que personne ne tranche.
 */
export async function escaladerPlanTournee(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const planId = fdStr(formData, "planId");
  if (!planId) return { ok: false, error: "Plan introuvable." };
  const plan = await prisma.tourPlan.findUnique({
    where: { id: planId },
    select: { id: true, repId: true, status: true, reviewerId: true },
  });
  if (!plan) return { ok: false, error: "Plan introuvable." };
  // L'ESCALADE EST PERSONNELLE : c'est le réviseur DÉSIGNÉ qui se dessaisit, pas quiconque a le
  // module. Une vue globale passe, parce qu'elle porte déjà la décision.
  if (plan.reviewerId !== user.id && !hasGlobalView(user)) {
    return { ok: false, error: "Seul le validateur désigné peut demander une validation à son N+1." };
  }
  if (!gestesPossibles(plan.status as StatutPlan).escaladable) {
    return { ok: false, error: `Un plan « ${plan.status} » ne s'escalade pas — on ne remonte qu'une fois, et un plan déjà escaladé attend la décision du N+2.` };
  }
  const managerDuReviseur = plan.reviewerId ? await getManagerOfUser(plan.reviewerId) : null;
  const cible = escaladeDuPlan({
    repId: plan.repId,
    reviseurId: plan.reviewerId ?? user.id,
    managerDuReviseurId: managerDuReviseur?.userId ?? null,
  });
  if (!cible) {
    return {
      ok: false,
      error: "Aucun N+2 à qui escalader : votre organigramme ne place personne au-dessus de vous pour ce plan. "
        + "Tranchez-le, ou faites compléter l'organigramme (Ressources humaines › Organigramme).",
    };
  }
  await prisma.tourPlan.update({
    where: { id: plan.id },
    data: { status: "ESCALATED", escalatedToId: cible, escalatedAt: new Date() },
  });
  await recordAudit({
    actorId: user.id, action: "UPDATE", module: "Promotion médicale",
    entityType: "VISIT", entityId: plan.id, summary: "Plan de tournée escaladé au N+2",
  });
  revalidatePath(PATH_TOURNEE);
  return { ok: true, id: plan.id };
}

/**
 * DÉCIDER — valider, ou rejeter AVEC des commentaires de rectification.
 *
 * Un rejet sans motif ne se corrige pas, il se subit : le commentaire est OBLIGATOIRE, et le
 * KAM a 48 h pour resoumettre corrigé (`resubmitDueAt`, écrit ici plutôt que déduit à la lecture
 * — la date du rejet est la seule qui fasse foi).
 */
export async function deciderPlanTournee(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const planId = fdStr(formData, "planId");
  const decision = fdStr(formData, "decision");
  if (!planId) return { ok: false, error: "Plan introuvable." };
  if (decision !== "APPROVE" && decision !== "REJECT") return { ok: false, error: "Décision illisible (attendu : valider ou rejeter)." };
  const plan = await prisma.tourPlan.findUnique({
    where: { id: planId },
    select: { id: true, repId: true, status: true, reviewerId: true, escalatedToId: true },
  });
  if (!plan) return { ok: false, error: "Plan introuvable." };

  // QUI TRANCHE : le réviseur tant que le plan est chez lui, le N+2 dès qu'il est escaladé.
  // Sans cette distinction, le plan attendrait une décision de la personne qui vient de s'en
  // dessaisir — ou les deux pourraient décider, et la dernière écriture gagnerait en silence.
  const decideur = plan.status === "ESCALATED" ? plan.escalatedToId : plan.reviewerId;
  if (decideur !== user.id && !hasGlobalView(user)) {
    return { ok: false, error: "Seule la personne à qui ce plan est soumis peut le trancher." };
  }
  if (!gestesPossibles(plan.status as StatutPlan).decidable) {
    return { ok: false, error: `Un plan « ${plan.status} » ne se décide pas — il n'est pas (ou plus) en attente de validation.` };
  }

  const commentaire = fdStr(formData, "comment");
  if (decision === "REJECT" && !commentaire) {
    return { ok: false, error: "Un rejet sans commentaire de rectification ne se corrige pas — dites ce qui doit changer." };
  }

  const maintenant = new Date();
  await prisma.tourPlan.update({
    where: { id: plan.id },
    data: decision === "APPROVE"
      ? { status: "APPROVED", decidedAt: maintenant, decidedById: user.id, rejectionComment: null, resubmitDueAt: null }
      : { status: "REJECTED", decidedAt: maintenant, decidedById: user.id, rejectionComment: commentaire, resubmitDueAt: limiteResoumission(maintenant) },
  });
  await recordAudit({
    actorId: user.id, action: "UPDATE", module: "Promotion médicale",
    entityType: "VISIT", entityId: plan.id,
    summary: decision === "APPROVE" ? "Plan de tournée VALIDÉ" : "Plan de tournée REJETÉ (48 h pour resoumettre)",
  });
  revalidatePath(PATH_TOURNEE);
  revalidatePath(PATH_JOURNEE);
  return { ok: true, id: plan.id };
}
