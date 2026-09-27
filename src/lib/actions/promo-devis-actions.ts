"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { notifyUser, notifyRoles } from "@/lib/notify";
import { hasGlobalView, type SessionUser } from "@/lib/rbac";
import { buildRef, createWithRetry } from "@/lib/refs";
import { persistUploadedDocument } from "@/lib/documents";
import { resolveParties } from "@/lib/queries/company-contacts";
import { fdStr, fdNum, fdDate, type ActionResult } from "@/lib/actions/types";
import { manquesDeRetranscription, totauxDeLaSelection, formatDzd } from "@/lib/promo-material/devis";
import { demandeLesDevis, retranscritLesDevis, choisitLesLignes } from "@/lib/promo-material/circuit";
import { devisDuDossier, devisLu } from "@/lib/queries/promo-circuit";
import { validatePromoStep } from "@/lib/actions/promo-circuit-actions";

/**
 * LES DEVIS DU MATÉRIEL PROMOTIONNEL — demande, retranscription, choix des lignes (§118.152).
 *
 * « Le demandeur clique sur « demander le devis » et les devis partent à l'assistante de
 * direction. Elle a un endroit spécial pour les mettre : un tableau à remplir elle-même —
 * référence, unité, prix unitaire et prix total, pour chaque agence ou partenaire, comme si elle
 * retranscrivait le devis sur un tableau interne d'entreprise. Le demandeur valide ensuite soit
 * un devis complet, soit les lignes d'un devis — les lignes de plusieurs devis. »
 *
 * Trois gestes, trois personnes, et chacun vérifie QUI agit :
 *   • demander les devis — le demandeur (ou la Direction), une fois la demande validée ;
 *   • retranscrire — l'assistante de direction (nommée sur le dossier, ou par son rôle : elle
 *     tient le secrétariat), la Direction en suppléance ;
 *   • choisir les lignes — le demandeur, et l'avance du circuit passe par `validatePromoStep`,
 *     l'UNIQUE écrivain des transitions de validation : deux chemins d'avance finiraient par
 *     prévenir des personnes différentes pour la même étape (§118.5).
 */

const PATH = "/promo-material";
const chemin = (id: string) => `${PATH}/${id}`;

type Dossier = {
  id: string; reference: string; title: string; circuitVersion: number; circuitState: string | null;
  requesterId: string | null; assistantId: string | null; description: string | null; companyId: string | null;
};

async function chargerDossier(id: string | null): Promise<Dossier | null> {
  if (!id) return null;
  return prisma.promoMaterial.findUnique({
    where: { id },
    select: { id: true, reference: true, title: true, circuitVersion: true, circuitState: true, requesterId: true, assistantId: true, description: true, companyId: true },
  });
}

/** L'acteur, pour les règles du module pur — la vue globale tranchée ici, où `rbac` est lisible. */
const acteur = (user: SessionUser) => ({ id: user.id, role: user.role, secondaryRole: user.secondaryRole, vueGlobale: hasGlobalView(user.role) });

/** Le demandeur, ou la Direction en suppléance : ceux qui DEMANDENT les devis (`demandeLesDevis`). */
function pilote(user: SessionUser, pm: Dossier): boolean {
  return demandeLesDevis(acteur(user), pm);
}

/**
 * QUI RETRANSCRIT — la règle du module pur (`retranscritLesDevis`) : l'assistante nommée, toute
 * assistante de direction, la Direction ; jamais le demandeur, qui choisira ensuite les lignes.
 */
function retranscrit(user: SessionUser, pm: Dossier): boolean {
  return retranscritLesDevis(acteur(user), pm);
}

function refusVersion(pm: Dossier): string | null {
  return pm.circuitVersion === 2
    ? null
    : "Ce dossier suit l'ancien circuit : les devis s'y déposent comme pièces, sans retranscription. Basculez-le sur le nouveau circuit pour retranscrire.";
}

async function audit(user: SessionUser, id: string, summary: string) {
  await recordAudit({ actorId: user.id, action: "UPDATE", module: "Matériel promotionnel", entityType: "PROMO_MATERIAL", entityId: id, summary });
}

/** La référence d'une demande au secrétariat — la même série que les demandes de devis des postes. */
async function prochaineReferenceDemande(): Promise<string> {
  const year = new Date().getFullYear();
  const rows = await prisma.administrativeRequest.findMany({ where: { reference: { startsWith: `DEM-${year}-` } }, select: { reference: true } });
  return buildRef("DEM", year, rows.map((r) => r.reference));
}

// ───────────────────────── 1. Le demandeur demande les devis ─────────────────────────

/**
 * DEMANDER LES DEVIS AU SECRÉTARIAT — une demande administrative, liée au dossier.
 *
 * Le LIEN CANONIQUE (`linkedEntityType` / `linkedEntityId`) est posé : c'est lui que l'écran du
 * secrétariat lit pour savoir que la dépense vient d'Ad & Pro et ne doit pas être imputée une
 * seconde fois à un département (§118.146). L'assistante nommée est prévenue ; à défaut, toutes
 * les assistantes de direction — personne ne doit apprendre qu'on attendait d'elle un devis.
 *
 * La transition est CONDITIONNELLE (`updateMany` sur l'état lu) : deux clics simultanés ne font
 * pas deux demandes au secrétariat.
 */
export async function demanderDevisPromo(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const pm = await chargerDossier(fdStr(formData, "promoMaterialId"));
  if (!pm) return { ok: false, error: "Dossier introuvable." };
  const v = refusVersion(pm);
  if (v) return { ok: false, error: v };
  if (!pilote(user, pm)) return { ok: false, error: "Seul le demandeur (ou la Direction) demande les devis de ce dossier." };
  if (pm.circuitState === "REVIEW_REQUEST") return { ok: false, error: "La demande n'est pas encore validée : les devis se demandent une fois la demande acceptée." };
  if (pm.circuitState !== "QUOTE_TO_REQUEST") return { ok: false, error: "Les devis de ce dossier sont déjà demandés." };
  const note = fdStr(formData, "note");

  // LA DEMANDE AU SECRÉTARIAT D'ABORD, LA BASCULE ENSUITE. Dans l'ordre inverse, une création qui
  // échoue (collision de référence épuisée, base indisponible) laissait le dossier sur « devis
  // demandés » sans aucune demande ni personne prévenue : une étape que personne ne peut faire
  // avancer, sans une ligne d'échec (§118.107). Ici, un double clic perd la course à la bascule
  // et sa demande en trop est retirée — elle n'a été vue de personne.
  const demande = await createWithRetry(async () => prisma.administrativeRequest.create({
    data: {
      reference: await prochaineReferenceDemande(),
      type: "QUOTE",
      title: `Devis — matériel promotionnel ${pm.reference} : ${pm.title}`,
      description: [
        note,
        `Dossier ${pm.reference}. Recevez les devis des agences, puis retranscrivez-les ligne à ligne sur la fiche du dossier (référence, unité, quantité, prix unitaire), avec le scan de chaque devis.`,
        pm.description ? `Brief : ${pm.description}` : null,
      ].filter(Boolean).join("\n"),
      priority: "HIGH",
      status: "NEW",
      requesterId: pm.requesterId ?? user.id,
      assignedToId: pm.assistantId,
      companyId: pm.companyId,
      linkedEntityType: "PROMO_MATERIAL",
      linkedEntityId: pm.id,
    },
    select: { id: true, reference: true },
  }));
  const bascule = await prisma.promoMaterial.updateMany({
    where: { id: pm.id, circuitState: "QUOTE_TO_REQUEST" },
    data: { circuitState: "QUOTE_REQUESTED", quotesRequestedAt: new Date(), quotesRequestedById: user.id, adminRequestId: demande.id, updatedById: user.id },
  });
  if (bascule.count === 0) {
    await prisma.administrativeRequest.delete({ where: { id: demande.id } }).catch(() => {});
    return { ok: false, error: "Les devis de ce dossier viennent d'être demandés." };
  }

  const avis = { type: "ASSIGNMENT" as const, title: "Matériel promotionnel — devis à demander et à retranscrire", body: `${pm.reference} — ${pm.title}`, link: chemin(pm.id) };
  if (pm.assistantId) await notifyUser({ userId: pm.assistantId, ...avis });
  else await notifyRoles(["DIRECTION_ASSISTANT"], avis);
  await audit(user, pm.id, `Devis demandés au secrétariat (${demande.reference})${note ? ` — ${note.slice(0, 200)}` : ""}`);
  revalidatePath(chemin(pm.id));
  revalidatePath("/demandes");
  return { ok: true, id: demande.id, message: `Devis demandés au secrétariat (${demande.reference}).` };
}

// ───────────────────────── 2. L'assistante retranscrit ─────────────────────────

/** Une ligne lue du formulaire, ou le motif qui la refuse (avec son rang, pour qu'on la retrouve). */
function lireLignes(formData: FormData): { ok: true; lignes: { reference: string; unit: string | null; quantity: number; unitPrice: number }[] } | { ok: false; error: string } {
  const refs = formData.getAll("ligneReference").map((x) => String(x ?? "").trim());
  const unites = formData.getAll("ligneUnite").map((x) => String(x ?? "").trim());
  const quantites = formData.getAll("ligneQuantite").map((x) => String(x ?? "").trim());
  const prix = formData.getAll("lignePrix").map((x) => String(x ?? "").trim());
  const n = Math.max(refs.length, quantites.length, prix.length);
  const lignes: { reference: string; unit: string | null; quantity: number; unitPrice: number }[] = [];
  const nombre = (s: string) => (s === "" ? NaN : Number(s.replace(/\s/g, "").replace(",", ".")));
  for (let i = 0; i < n; i += 1) {
    const r = refs[i] ?? "";
    const q = quantites[i] ?? "";
    const p = prix[i] ?? "";
    if (!r && !q && !p) continue; // une ligne entièrement vide : une rangée de saisie inutilisée
    const quantity = nombre(q);
    const unitPrice = nombre(p);
    if (!r) return { ok: false, error: `Ligne ${i + 1} : la référence (ou désignation) est obligatoire.` };
    if (!(quantity > 0)) return { ok: false, error: `Ligne ${i + 1} (« ${r} ») : la quantité doit être un nombre supérieur à zéro.` };
    if (!(unitPrice >= 0)) return { ok: false, error: `Ligne ${i + 1} (« ${r} ») : le prix unitaire doit être un nombre positif.` };
    lignes.push({ reference: r, unit: (unites[i] ?? "") || null, quantity, unitPrice });
  }
  return { ok: true, lignes };
}

/**
 * ENREGISTRER UN DEVIS RETRANSCRIT — créer, ou corriger tant que la retranscription est ouverte.
 *
 * Le fournisseur est choisi DANS L'ANNUAIRE (`resolveParties` revérifie le cloisonnement : un
 * identifiant venu d'un champ caché ne se croit pas sur parole). Les lignes sont REMPLACÉES en
 * bloc, dans une transaction : une correction partielle laisserait un devis à moitié ancien.
 * Le scan, s'il est joint, devient une pièce du dossier et le devis la désigne.
 */
export async function enregistrerDevisPromo(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const pm = await chargerDossier(fdStr(formData, "promoMaterialId"));
  if (!pm) return { ok: false, error: "Dossier introuvable." };
  const v = refusVersion(pm);
  if (v) return { ok: false, error: v };
  if (!retranscrit(user, pm)) return { ok: false, error: "La retranscription des devis revient à l'assistante de direction." };
  if (pm.circuitState !== "QUOTE_REQUESTED") {
    return { ok: false, error: "Les devis ne se retranscrivent que pendant l'étape « devis demandés » — le demandeur peut demander une correction depuis son choix." };
  }

  const quoteId = fdStr(formData, "quoteId");
  const existant = quoteId
    ? await prisma.promoQuote.findFirst({ where: { id: quoteId, promoMaterialId: pm.id }, select: { id: true, documentId: true, supplierId: true, supplierName: true } })
    : null;
  if (quoteId && !existant) return { ok: false, error: "Ce devis n'appartient pas à ce dossier." };

  const supplierId = fdStr(formData, "supplierId");
  if (!supplierId) return { ok: false, error: "Choisissez le fournisseur dans l'annuaire : c'est lui qui donne son adresse, son RC et son NIF au bon de commande." };
  const parties = await resolveParties(user.id, [supplierId]);
  if (!parties.ok) return { ok: false, error: parties.error };

  const lues = lireLignes(formData);
  if (!lues.ok) return { ok: false, error: lues.error };
  const tvaSaisie = fdNum(formData, "tvaRate");
  const tvaRate = tvaSaisie ?? 19;
  if (!(tvaRate >= 0 && tvaRate <= 100)) return { ok: false, error: "Le taux de TVA s'exprime en pour cent, entre 0 et 100." };
  const extraTaxRate = fdNum(formData, "extraTaxRate");
  if (extraTaxRate != null && !(extraTaxRate > 0 && extraTaxRate <= 100)) return { ok: false, error: "La taxe additionnelle s'exprime en pour cent, entre 0 et 100 (laissez vide s'il n'y en a pas)." };
  const extraTaxLabel = extraTaxRate != null ? (fdStr(formData, "extraTaxLabel") ?? "Taxe additionnelle") : null;
  const announcedTotal = fdNum(formData, "announcedTotal");
  if (announcedTotal != null && !(announcedTotal >= 0)) return { ok: false, error: "Le total annoncé sur le devis doit être un montant positif." };

  // LE SCAN — enregistré AVANT d'écrire le devis : une pièce qui échoue ne laisse pas un devis
  // qui prétend l'avoir.
  let documentId = existant?.documentId ?? null;
  const scan = formData.get("scan");
  if (scan instanceof File && scan.size > 0) {
    const r = await persistUploadedDocument(user.id, {
      entityType: "PROMO_MATERIAL", entityId: pm.id, category: "QUOTE", confidentiality: "INTERNAL",
      stepKey: "devis", file: scan,
    });
    if (!r.ok || !r.documentId) return { ok: false, error: `Scan « ${scan.name} » : ${r.error ?? "téléversement impossible"}` };
    documentId = r.documentId;
  }

  const donnees = {
    supplierId, supplierName: parties.text,
    reference: fdStr(formData, "reference"),
    quoteDate: fdDate(formData, "quoteDate"),
    tvaRate: new Prisma.Decimal(tvaRate),
    extraTaxLabel, extraTaxRate: extraTaxRate != null ? new Prisma.Decimal(extraTaxRate) : null,
    announcedTotal: announcedTotal != null ? new Prisma.Decimal(announcedTotal) : null,
    documentId, note: fdStr(formData, "note"),
  };
  const lignes = lues.lignes.map((l, i) => ({
    position: i, reference: l.reference, unit: l.unit,
    quantity: new Prisma.Decimal(l.quantity), unitPrice: new Prisma.Decimal(l.unitPrice),
  }));
  const devis = await prisma.$transaction(async (tx) => {
    if (existant) {
      await tx.promoQuoteLine.deleteMany({ where: { quoteId: existant.id } });
      return tx.promoQuote.update({ where: { id: existant.id }, data: { ...donnees, lines: { create: lignes } }, select: { id: true } });
    }
    const rang = await tx.promoQuote.count({ where: { promoMaterialId: pm.id } });
    return tx.promoQuote.create({
      data: { ...donnees, promoMaterialId: pm.id, position: rang, createdById: user.id, lines: { create: lignes } },
      select: { id: true },
    });
  });
  await audit(user, pm.id, `Devis ${existant ? "corrigé" : "retranscrit"} — ${parties.text}${donnees.reference ? ` n° ${donnees.reference}` : ""} (${lignes.length} ligne${lignes.length > 1 ? "s" : ""})`);
  revalidatePath(chemin(pm.id));
  return { ok: true, id: devis.id, message: `Devis de ${parties.text} ${existant ? "corrigé" : "enregistré"} (${lignes.length} ligne${lignes.length > 1 ? "s" : ""}).` };
}

/** Retirer un devis retranscrit — pendant la retranscription seulement. Le scan reste au dossier. */
export async function supprimerDevisPromo(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const pm = await chargerDossier(fdStr(formData, "promoMaterialId"));
  if (!pm) return { ok: false, error: "Dossier introuvable." };
  const v = refusVersion(pm);
  if (v) return { ok: false, error: v };
  if (!retranscrit(user, pm)) return { ok: false, error: "La retranscription des devis revient à l'assistante de direction." };
  if (pm.circuitState !== "QUOTE_REQUESTED") return { ok: false, error: "Un devis ne se retire que pendant la retranscription." };
  const quoteId = fdStr(formData, "quoteId");
  const devis = quoteId ? await prisma.promoQuote.findFirst({ where: { id: quoteId, promoMaterialId: pm.id }, select: { id: true, supplierName: true } }) : null;
  if (!devis) return { ok: false, error: "Ce devis n'appartient pas à ce dossier." };
  await prisma.promoQuote.delete({ where: { id: devis.id } });
  await audit(user, pm.id, `Devis retiré — ${devis.supplierName}`);
  revalidatePath(chemin(pm.id));
  return { ok: true, message: `Devis de ${devis.supplierName} retiré (son scan reste dans les pièces du dossier).` };
}

/**
 * LA RETRANSCRIPTION EST TERMINÉE — au demandeur de choisir.
 *
 * Refusée tant qu'un devis manque de fournisseur, de scan ou de lignes, ou que ses lignes ne
 * tombent pas sur le total imprimé : tout ce qui manque est dit en UNE fois (§118.18). La demande
 * au secrétariat passe « terminée » — c'est ce que l'assistante devait faire.
 */
export async function terminerRetranscriptionPromo(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const pm = await chargerDossier(fdStr(formData, "promoMaterialId"));
  if (!pm) return { ok: false, error: "Dossier introuvable." };
  const v = refusVersion(pm);
  if (v) return { ok: false, error: v };
  if (!retranscrit(user, pm)) return { ok: false, error: "La retranscription des devis revient à l'assistante de direction." };
  if (pm.circuitState !== "QUOTE_REQUESTED") return { ok: false, error: "Ce dossier n'attend pas de retranscription." };

  const devis = (await devisDuDossier(pm.id)).map(devisLu);
  const manques = manquesDeRetranscription(devis);
  if (manques.length > 0) return { ok: false, error: `Retranscription incomplète : ${manques.join(" ; ")}.` };

  const bascule = await prisma.promoMaterial.updateMany({
    where: { id: pm.id, circuitState: "QUOTE_REQUESTED" },
    data: { circuitState: "REVIEW_REQUESTER", updatedById: user.id },
  });
  if (bascule.count === 0) return { ok: false, error: "Ce dossier vient de changer d'étape." };
  const demande = await prisma.promoMaterial.findUnique({ where: { id: pm.id }, select: { adminRequestId: true } });
  if (demande?.adminRequestId) {
    await prisma.administrativeRequest.update({ where: { id: demande.adminRequestId }, data: { status: "DONE" } }).catch(() => undefined);
  }
  if (pm.requesterId && pm.requesterId !== user.id) {
    await notifyUser({ userId: pm.requesterId, type: "VALIDATION_REQUIRED", title: "Devis retranscrits — à vous de choisir", body: `${pm.reference} — ${devis.length} devis, ${devis.reduce((s, d) => s + d.lines.length, 0)} lignes`, link: chemin(pm.id) });
  }
  await audit(user, pm.id, `Retranscription terminée — ${devis.length} devis (${devis.map((d) => d.supplierName).join(", ")})`);
  revalidatePath(chemin(pm.id));
  revalidatePath("/demandes");
  return { ok: true, message: `Retranscription terminée — ${devis.length} devis sont au choix du demandeur.` };
}

// ───────────────────────── 3. Le demandeur choisit ─────────────────────────

/**
 * CHOISIR LES LIGNES — un devis entier, ou des lignes de plusieurs devis.
 *
 * La sélection est REMPLACÉE en bloc (les lignes cochées, et elles seules) : c'est l'écran entier
 * que la personne a sous les yeux qui fait foi, pas une suite de clics. Avec `valider`, le choix
 * part en validation : l'avance passe par `validatePromoStep`, l'unique écrivain des transitions,
 * qui fige le montant retenu et prévient la Direction Marketing (ou le DG au-delà du seuil).
 */
export async function choisirLignesPromo(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const pm = await chargerDossier(fdStr(formData, "promoMaterialId"));
  if (!pm) return { ok: false, error: "Dossier introuvable." };
  const v = refusVersion(pm);
  if (v) return { ok: false, error: v };
  if (!choisitLesLignes(acteur(user), pm)) return { ok: false, error: "Le choix des lignes revient au demandeur." };
  if (pm.circuitState !== "REVIEW_REQUESTER") return { ok: false, error: "Ce dossier n'attend pas le choix du demandeur." };

  const voulues = new Set(formData.getAll("lineIds").map((x) => String(x)).filter(Boolean));
  const lignes = await prisma.promoQuoteLine.findMany({ where: { quote: { promoMaterialId: pm.id } }, select: { id: true } });
  const connues = new Set(lignes.map((l) => l.id));
  const etrangeres = [...voulues].filter((id) => !connues.has(id));
  if (etrangeres.length > 0) return { ok: false, error: `${etrangeres.length} ligne(s) choisie(s) n'appartiennent pas aux devis de ce dossier.` };

  await prisma.$transaction([
    prisma.promoQuoteLine.updateMany({ where: { quote: { promoMaterialId: pm.id }, id: { notIn: [...voulues] } }, data: { selected: false } }),
    prisma.promoQuoteLine.updateMany({ where: { quote: { promoMaterialId: pm.id }, id: { in: [...voulues] } }, data: { selected: true } }),
  ]);
  const totaux = totauxDeLaSelection((await devisDuDossier(pm.id)).map(devisLu));
  await audit(user, pm.id, `Choix des lignes : ${totaux.lignes} ligne(s) sur ${totaux.devis} devis — ${formatDzd(totaux.ttc)} TTC`);

  if (formData.get("valider") !== "1") {
    revalidatePath(chemin(pm.id));
    return { ok: true, message: `Choix enregistré : ${totaux.lignes} ligne(s), ${formatDzd(totaux.ttc)} TTC. Validez-le quand il est complet.` };
  }
  if (totaux.lignes === 0) return { ok: false, error: "Retenez au moins une ligne avant de valider votre choix." };
  const f = new FormData();
  f.set("id", pm.id);
  return validatePromoStep(f);
}

/**
 * DEMANDER UNE CORRECTION DE LA RETRANSCRIPTION — le dossier revient à l'assistante, avec le motif.
 *
 * Un prix mal recopié se voit au moment du choix : le demandeur le signale au lieu de retenir
 * une ligne fausse. Sa sélection est effacée — les lignes vont changer, et un choix fait sur les
 * anciennes serait appliqué à des lignes qu'il n'a jamais vues.
 */
export async function demanderCorrectionDevisPromo(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const pm = await chargerDossier(fdStr(formData, "promoMaterialId"));
  if (!pm) return { ok: false, error: "Dossier introuvable." };
  const v = refusVersion(pm);
  if (v) return { ok: false, error: v };
  if (!choisitLesLignes(acteur(user), pm)) return { ok: false, error: "La demande de correction revient au demandeur." };
  if (pm.circuitState !== "REVIEW_REQUESTER") return { ok: false, error: "Ce dossier n'attend pas le choix du demandeur." };
  const motif = fdStr(formData, "motif");
  if (!motif) return { ok: false, error: "Dites ce qui est à corriger : l'assistante reprendrait sinon à l'identique." };

  const bascule = await prisma.promoMaterial.updateMany({
    where: { id: pm.id, circuitState: "REVIEW_REQUESTER" },
    data: { circuitState: "QUOTE_REQUESTED", updatedById: user.id },
  });
  if (bascule.count === 0) return { ok: false, error: "Ce dossier vient de changer d'étape." };
  await prisma.promoQuoteLine.updateMany({ where: { quote: { promoMaterialId: pm.id } }, data: { selected: false } });
  await prisma.comment.create({ data: { entityType: "PROMO_MATERIAL", entityId: pm.id, body: `Correction de la retranscription demandée : ${motif}`, authorId: user.id } });
  const avis = { type: "ASSIGNMENT" as const, title: "Matériel promotionnel — retranscription à corriger", body: `${pm.reference} — ${motif.slice(0, 200)}`, link: chemin(pm.id) };
  if (pm.assistantId) await notifyUser({ userId: pm.assistantId, ...avis });
  else await notifyRoles(["DIRECTION_ASSISTANT"], avis);
  await audit(user, pm.id, `Correction de la retranscription demandée — ${motif.slice(0, 200)}`);
  revalidatePath(chemin(pm.id));
  return { ok: true, message: "Correction demandée — le dossier revient à l'assistante de direction." };
}
