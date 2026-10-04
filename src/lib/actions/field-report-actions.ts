"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { userCan, hasGlobalView } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { companyIdForNew } from "@/lib/company";
import { releaseBlob } from "@/lib/drive-storage";
import { recordAudit } from "@/lib/audit";
import { analyzeFieldReport, aiModelCheap } from "@/lib/ai";
import { aiFeatureEnabled, logAiUsage } from "@/lib/ai-settings";
import type { CurrentUser } from "@/lib/session";
import { fdStr, fdDate, type ActionResult } from "@/lib/actions/types";
import { sousVerrous } from "@/lib/promo/stock-ecriture";
import {
  dejaDansLeRapport, ecrireRemises, formulairePorteDuMateriel, lireMaterielRemis, motifDeRemise, phraseMateriel, RefusRemise,
  refusSuppressionRapport, toucheLeStock, verrousDuRapport,
} from "@/lib/promo/remises-visite";
import { remisesDuRapport } from "@/lib/queries/promo-remises";
import { fenetreRapport } from "@/lib/sfe/tournee";
import { CHEMIN_STOCK_PROMO } from "@/lib/chemins/stock-promo";

/** Un manager / la Direction **gère** tous les rapports ; un délégué les siens. */
function managesReports(user: CurrentUser): boolean {
  return hasGlobalView(user) || user.role === "MEDICAL_PROMOTION_MANAGER" || user.role === "PRODUCT_MANAGER";
}

async function canEdit(user: CurrentUser, reportId: string): Promise<boolean> {
  if (managesReports(user)) return userCan(user, "FIELD_REPORTS", "VIEW");
  const r = await prisma.fieldReport.findUnique({ where: { id: reportId }, select: { delegateId: true } });
  return Boolean(r && r.delegateId === user.id);
}

export async function createFieldReport(): Promise<ActionResult> {
  const user = await requireUser();
  // Rédiger SON PROPRE rapport (brouillon dicté) est ouvert à tout profil ayant accès au
  // module Rapports terrain — le bouton « Parler » est d'ailleurs proposé à tous ceux qui
  // ouvrent la page, et le brouillon appartient à son auteur (delegateId = user.id).
  // Sans quoi la Direction (des opérations) — qui a la VUE globale mais pas l'action CREATE
  // par défaut — se voyait refuser (« Non autorisé ») en cliquant sur « Parler ».
  if (!userCan(user, "FIELD_REPORTS", "VIEW")) return { ok: false, error: "Non autorisé." };
  const created = await prisma.fieldReport.create({ data: { delegateId: user.id, status: "DRAFT", companyId: await companyIdForNew(user.id) }, select: { id: true } });
  revalidatePath("/field-reports");
  return { ok: true, id: created.id };
}

export async function updateFieldReport(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Rapport introuvable." };
  if (!(await canEdit(user, id))) return { ok: false, error: "Non autorisé." };

  const summary = fdStr(formData, "summary");
  const doctorIds = parseIds(formData, "doctorIds");
  await prisma.fieldReport.update({
    where: { id },
    data: {
      visitDate: fdDate(formData, "visitDate") ?? undefined,
      summary,
      transcript: summary, // le compte rendu (synthèse) EST le contenu dicté / saisi
      doctorIds,
      doctorId: doctorIds[0] ?? null,
      doctorName: fdStr(formData, "doctorName"),
      institution: fdStr(formData, "institution"),
      specialty: fdStr(formData, "specialty"),
    },
  });
  revalidatePath(`/field-reports/${id}`);
  return { ok: true };
}

/** Liste d'IDs depuis un champ « a,b,c » (médecins de la visite). */
function parseIds(formData: FormData, key: string): string[] {
  return (fdStr(formData, key) ?? "").split(",").map((s) => s.trim()).filter(Boolean);
}

/** Analyse la transcription en champs structurés (Claude). Ne valide jamais.
 *  Persiste les champs ET les renvoie pour mise à jour immédiate de l'éditeur. */
export async function analyzeFieldReportAction(
  formData: FormData,
): Promise<{ ok: boolean; configured: boolean; error?: string; data?: Record<string, string> }> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, configured: true, error: "Rapport introuvable." };
  if (!(await canEdit(user, id))) return { ok: false, configured: true, error: "Non autorisé." };
  // Transcription depuis le formulaire (la plus à jour) ou, à défaut, la base.
  let transcript = fdStr(formData, "transcript");
  if (!transcript) {
    const report = await prisma.fieldReport.findUnique({ where: { id }, select: { transcript: true } });
    transcript = report?.transcript?.trim() ?? null;
  } else {
    await prisma.fieldReport.update({ where: { id }, data: { transcript } });
  }
  if (!transcript) return { ok: false, configured: true, error: "Aucune transcription à analyser." };
  if (!(await aiFeatureEnabled("field_report"))) {
    return { ok: false, configured: true, error: "L'analyse IA des rapports est désactivée dans le Centre de contrôle IA." };
  }

  const t0 = Date.now();
  const r = await analyzeFieldReport(transcript);
  await logAiUsage({ feature: "field_report", userId: user.id, model: aiModelCheap(), ok: r.ok, latencyMs: Date.now() - t0, errorCode: r.ok ? null : r.error ?? "error" });
  if (!r.ok || !r.data) return { ok: false, configured: r.configured, error: r.error };

  const d = r.data;
  // Tente de rattacher le médecin par son nom (dans le périmètre, sans inventer).
  let doctorId: string | undefined;
  if (d.doctorName) {
    const match = await prisma.medicalDoctor.findFirst({
      where: { name: { contains: d.doctorName.replace(/^(pr\.?|dr\.?|professeur|docteur)\s+/i, "").trim(), mode: "insensitive" } },
      select: { id: true },
    });
    doctorId = match?.id ?? undefined;
  }

  await prisma.fieldReport.update({
    where: { id },
    data: {
      doctorId,
      doctorName: d.doctorName || null,
      institution: d.institution || null,
      specialty: d.specialty || null,
      products: d.products || null,
      interest: d.interest || null,
      objection: d.objection || null,
      medicalQuestion: d.medicalQuestion || null,
      documentRequest: d.documentRequest || null,
      sponsoringRequest: d.sponsoringRequest || null,
      careRequest: d.careRequest || null,
      competitorInfo: d.competitorInfo || null,
      opportunity: d.opportunity || null,
      qualitySignal: d.qualitySignal || null,
      nextAction: d.nextAction || null,
      summary: d.summary || null,
      aiNotes: d.aiNotes || null,
    },
  });
  revalidatePath(`/field-reports/${id}`);
  return {
    ok: true,
    configured: true,
    data: {
      doctorName: d.doctorName ?? "", institution: d.institution ?? "", specialty: d.specialty ?? "",
      products: d.products ?? "", interest: d.interest ?? "", objection: d.objection ?? "",
      medicalQuestion: d.medicalQuestion ?? "", documentRequest: d.documentRequest ?? "",
      sponsoringRequest: d.sponsoringRequest ?? "", careRequest: d.careRequest ?? "",
      competitorInfo: d.competitorInfo ?? "", opportunity: d.opportunity ?? "", qualitySignal: d.qualitySignal ?? "",
      nextAction: d.nextAction ?? "", summary: d.summary ?? "", aiNotes: d.aiNotes ?? "",
    },
  };
}

/**
 * Envoi du compte rendu (délégué) : un seul champ **synthèse** (dicté à la voix ou saisi)
 * + médecin(s), établissement, spécialité, date, pièces jointes. Aucune classification IA.
 */
export async function submitFieldReport(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Rapport introuvable." };
  if (!(await canEdit(user, id))) return { ok: false, error: "Non autorisé." };

  const summary = fdStr(formData, "summary");
  if (!summary) return { ok: false, error: "Dictez ou saisissez d'abord votre compte rendu." };
  const doctorIds = parseIds(formData, "doctorIds");
  const rapport = await prisma.fieldReport.findUnique({ where: { id }, select: { delegateId: true, visitId: true, visitDate: true } });
  if (!rapport) return { ok: false, error: "Rapport introuvable." };
  const visitDate = fdDate(formData, "visitDate") ?? rapport.visitDate;
  const doctorName = fdStr(formData, "doctorName");

  // ── LE MATÉRIEL REMIS (§118.204) — la QUATRIÈME porte d'une visite faite, par le MÊME module ───
  // Un compte rendu RATTACHÉ à une visite (dicté depuis « Ma journée ») ne porte pas de remises : la
  // visite les porte déjà, et son rapport les corrige dans ses 48 h. Deux portes vers la même ancre
  // diraient deux choses (§118.5) — on nomme celle qui sait.
  const maintenant = new Date();
  const saisi = formulairePorteDuMateriel(formData);
  if (rapport.visitId && saisi.materiel) {
    return { ok: false, error: "Ce compte rendu raconte une visite de votre emploi du temps : le matériel remis se déclare dans le rapport de cette visite (Promotion médicale › Ma journée), dans ses 48 h." };
  }
  // Un support numérique se PRÉSENTE lors d'une visite : un compte rendu sans visite n'en porte pas.
  if (saisi.numerique) {
    return { ok: false, error: "Un support numérique se présente lors d'une visite : déclarez-le dans « Ma journée » (rapport de la visite ou visite imprévue)." };
  }
  const deja = rapport.visitId ? { remis: [], presentes: [] } : await dejaDansLeRapport(id);
  const lu = await lireMaterielRemis(formData, deja, maintenant);
  if (!lu.ok) return { ok: false, error: lu.error };
  const remet = lu.materiel.remises.length > 0;

  // À QUI : une remise se rattache à un médecin de l'ANNUAIRE. Un nom tapé à la main ne désigne
  // personne, et le stock du KAM sortirait vers un praticien que rien ne permet de retrouver. Un seul
  // médecin → la remise porte son nom ; plusieurs → elle reste au compte rendu, sans médecin désigné
  // (choisir le premier serait l'attribuer à quelqu'un à la place du KAM, §118.34).
  // Dans l'ORDRE du compte rendu : une lecture `in` rend l'ordre du disque, et le motif écrit au
  // registre changerait d'un envoi à l'autre pour les mêmes médecins.
  const medecins = doctorIds.length
    ? (await prisma.medicalDoctor.findMany({ where: { id: { in: doctorIds } }, select: { id: true, name: true } }))
        .sort((a, b) => doctorIds.indexOf(a.id) - doctorIds.indexOf(b.id))
    : [];
  if (remet && medecins.length === 0) {
    return {
      ok: false,
      error: doctorName
        ? `Le matériel remis se rattache à un médecin de l'annuaire : « ${doctorName} » n'y est pas — ajoutez-le (Annuaires › Médecins) puis choisissez-le dans la liste.`
        : "Le matériel remis se rattache à un médecin de l'annuaire : choisissez-le dans la liste « Médecin(s) — annuaire ».",
    };
  }
  // QUAND : la règle des trois autres portes. Une visite à venir ne remet rien ; et le matériel
  // d'une visite se déclare dans ses 48 h — seulement si le matériel CHANGE : renvoyer un compte
  // rendu corrigé dans son texte ne doit pas exiger de retirer une remise faite à temps.
  const changeLeStock = await materielChange(id, deja, lu.materiel.remises);
  if (changeLeStock && visitDate.getTime() > maintenant.getTime() + 86_400_000) {
    return { ok: false, error: "Une visite à venir ne remet rien : le matériel se déclare une fois la visite faite." };
  }
  if (changeLeStock && !fenetreRapport(visitDate, maintenant).ouvert) {
    return { ok: false, error: `Le matériel remis se déclare dans les 48 h de la visite (comme dans « Ma journée ») : celle du ${visitDate.toLocaleDateString("fr-FR")} est passée. Rien n'est enregistré — renvoyez le compte rendu sans changer le matériel.` };
  }
  // C'EST LA VOITURE DU KAM QUI SE VIDE — même quand un superviseur envoie le compte rendu à sa place.
  const detenteurId = rapport.delegateId ?? user.id;
  const medecin = medecins.length === 1 ? medecins[0] : null;

  try {
    await sousVerrous(verrousDuRapport(lu.materiel, deja), async (tx, verrouilles) => {
      await tx.fieldReport.update({
        where: { id },
        data: {
          summary,
          transcript: summary,
          visitDate,
          doctorIds,
          doctorId: doctorIds[0] ?? null,
          doctorName,
          institution: fdStr(formData, "institution"),
          specialty: fdStr(formData, "specialty"),
          status: "VALIDATED",
          validatedAt: maintenant,
        },
      });
      if (!rapport.visitId) {
        await ecrireRemises(tx, lu.materiel, verrouilles, {
          ancre: { fieldReportId: id }, doctorId: medecin?.id ?? null, detenteurId, auteurId: user.id, maintenant,
          motif: motifDeRemise(visitDate, medecin?.name ?? (medecins.length > 1 ? medecins.map((m) => m.name).join(", ") : null)),
        });
      }
    });
  } catch (e) {
    if (e instanceof RefusRemise) return { ok: false, error: e.message };
    throw e;
  }
  await recordAudit({ actorId: user.id, action: "VALIDATE", module: "Rapports terrain", summary: `Compte rendu de visite envoyé${phraseMateriel(lu.materiel)}` });
  revalidatePath(`/field-reports/${id}`);
  revalidatePath("/field-reports");
  if (toucheLeStock(lu.materiel, deja)) revalidatePath(CHEMIN_STOCK_PROMO);
  return { ok: true };
}

/** Le matériel saisi change-t-il ce que le compte rendu a déjà remis ? (net, par article) */
async function materielChange(fieldReportId: string, deja: { remis: string[] }, voulu: { itemId: string; quantite: number }[]): Promise<boolean> {
  if (deja.remis.length === 0) return voulu.length > 0;
  const avant = await remisesDuRapport(fieldReportId);
  const a = new Map(avant.materiel.map((m) => [m.itemId, m.quantite]));
  const b = new Map(voulu.map((m) => [m.itemId, m.quantite]));
  if (a.size !== b.size) return true;
  for (const [k, v] of b) if (a.get(k) !== v) return true;
  return false;
}

export async function validateFieldReport(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Rapport introuvable." };
  if (!(await canEdit(user, id))) return { ok: false, error: "Non autorisé." };
  await prisma.fieldReport.update({ where: { id }, data: { status: "VALIDATED", validatedAt: new Date() } });
  await recordAudit({ actorId: user.id, action: "VALIDATE", module: "Rapports terrain", summary: "Rapport de visite validé" });
  revalidatePath(`/field-reports/${id}`);
  revalidatePath("/field-reports");
  return { ok: true };
}

export async function reopenFieldReport(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Rapport introuvable." };
  if (!(await canEdit(user, id))) return { ok: false, error: "Non autorisé." };
  await prisma.fieldReport.update({ where: { id }, data: { status: "DRAFT", validatedAt: null } });
  revalidatePath(`/field-reports/${id}`);
  return { ok: true };
}

export async function deleteFieldReport(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Rapport introuvable." };
  if (!(await canEdit(user, id))) return { ok: false, error: "Non autorisé." };
  const refus = await refusSuppressionRapport(id);
  if (refus) return { ok: false, error: refus };
  const atts = await prisma.fieldReportAttachment.findMany({ where: { reportId: id }, select: { blobId: true } });
  const report = await prisma.fieldReport.findUnique({ where: { id }, select: { audioBlobId: true } });
  await prisma.fieldReport.delete({ where: { id } });
  for (const a of atts) await releaseBlob(a.blobId);
  if (report?.audioBlobId) await releaseBlob(report.audioBlobId);
  revalidatePath("/field-reports");
  return { ok: true };
}

export async function deleteFieldReportAttachment(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Pièce jointe introuvable." };
  const att = await prisma.fieldReportAttachment.findUnique({ where: { id }, select: { blobId: true, reportId: true } });
  if (!att) return { ok: false, error: "Pièce jointe introuvable." };
  if (!(await canEdit(user, att.reportId))) return { ok: false, error: "Non autorisé." };
  await prisma.fieldReportAttachment.delete({ where: { id } });
  await releaseBlob(att.blobId);
  revalidatePath(`/field-reports/${att.reportId}`);
  return { ok: true };
}
