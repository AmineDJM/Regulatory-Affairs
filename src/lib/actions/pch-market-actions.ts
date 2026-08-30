"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { toNumber } from "@/lib/utils";
import { controlerCommande } from "@/lib/pch/market-math";
import { fdStr, fdNum, fdDate, fdBool, type ActionResult } from "@/lib/actions/types";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * MARKET 360° — les GESTES de la chaîne AO → contrat → BC → livraison.
 *
 * Trois règles tenues partout ici :
 *
 *   1. LES ÉCRITURES LIÉES SONT TRANSACTIONNELLES. Verrouiller une soumission ET poser la date
 *      de dépôt ET figer les photos de lignes est UN événement ; en perdre la moitié sur une
 *      coupure laisserait un dossier qui ment.
 *   2. LA PIÈCE DÉPOSÉE NE SE MODIFIE PLUS (§63). Une soumission verrouillée refuse toute
 *      retouche — côté serveur, pas en cachant un bouton.
 *   3. LE DÉPASSEMENT CONTRACTUEL AVERTIT ET TRACE, il ne bloque pas : bloquer ferait saisir
 *      hors ERP, et le dépassement disparaîtrait au lieu d'être VISIBLE. Le passage en force
 *      est un geste explicite (`force`) qui s'audite avec son excès.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const nonAutorise: ActionResult = { ok: false, error: "Non autorisé." };
const posInt = (formData: FormData, key: string): number | null => {
  const n = fdNum(formData, key);
  if (n === null) return null;
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n);
};

// ─────────────────────────────── Soumissions versionnées ───────────────────────────────────

/** La checklist de dépôt par défaut — chaque AO peut la modifier, elle sert de point de départ. */
const CHECKLIST_DEFAUT = [
  { key: "administratif", label: "Dossier administratif", done: false },
  { key: "technique", label: "Dossier technique", done: false },
  { key: "amm", label: "Décisions d'enregistrement (AMM)", done: false },
  { key: "gmp", label: "Certificats GMP", done: false },
  { key: "prix", label: "Bordereau des prix", done: false },
  { key: "garantie", label: "Caution / garantie de soumission", done: false },
  { key: "declarations", label: "Déclarations sur l'honneur", done: false },
];

export async function createSubmission(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "PCH", "CREATE")) return nonAutorise;
  const tenderId = fdStr(formData, "tenderId");
  if (!tenderId) return { ok: false, error: "Appel d'offres manquant." };
  const tender = await prisma.pchTender.findUnique({ where: { id: tenderId }, select: { id: true, reference: true } });
  if (!tender) return { ok: false, error: "Appel d'offres introuvable." };

  const last = await prisma.pchSubmission.findFirst({
    where: { tenderId }, orderBy: { version: "desc" }, select: { version: true, checklist: true },
  });
  const created = await prisma.pchSubmission.create({
    data: {
      tenderId,
      version: (last?.version ?? 0) + 1,
      label: fdStr(formData, "label"),
      // La nouvelle version REPART de la checklist de la précédente : on ne refait pas ce qui
      // est déjà réuni parce qu'on a ouvert une V2.
      checklist: (last?.checklist as Prisma.InputJsonValue | undefined) ?? CHECKLIST_DEFAUT,
      createdById: user.id,
    },
  });
  await recordAudit({ actorId: user.id, action: "CREATE", module: "PCH", summary: `Soumission V${(last?.version ?? 0) + 1} — ${tender.reference}` });
  revalidatePath(`/pch/${tenderId}`);
  return { ok: true, id: created.id };
}

/** Garde commune : une version verrouillée ne se modifie plus, quoi qu'on lui demande. */
async function loadEditableSubmission(id: string) {
  const s = await prisma.pchSubmission.findUnique({
    where: { id },
    select: { id: true, tenderId: true, version: true, lockedAt: true, checklist: true, tender: { select: { reference: true } } },
  });
  if (!s) return { error: "Version de soumission introuvable." as const };
  if (s.lockedAt) return { error: "Cette version a été déposée : elle ne se modifie plus." as const };
  return { submission: s };
}

export async function updateSubmission(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "PCH", "UPDATE")) return nonAutorise;
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Identifiant manquant." };
  const loaded = await loadEditableSubmission(id);
  if ("error" in loaded) return { ok: false, error: loaded.error };

  const statusRaw = fdStr(formData, "status");
  const status = statusRaw && ["DRAFT", "REVIEW", "FINAL"].includes(statusRaw) ? statusRaw : undefined;
  await prisma.pchSubmission.update({
    where: { id },
    data: { label: fdStr(formData, "label") ?? undefined, notes: fdStr(formData, "notes"), status },
  });
  revalidatePath(`/pch/${loaded.submission.tenderId}`);
  return { ok: true };
}

/** Coche / décoche un élément de la checklist — horodaté et signé, comme un registre. */
export async function toggleChecklistItem(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "PCH", "UPDATE")) return nonAutorise;
  const id = fdStr(formData, "id");
  const key = fdStr(formData, "itemKey");
  if (!id || !key) return { ok: false, error: "Élément manquant." };
  const loaded = await loadEditableSubmission(id);
  if ("error" in loaded) return { ok: false, error: loaded.error };

  const items = Array.isArray(loaded.submission.checklist) ? (loaded.submission.checklist as Array<Record<string, unknown>>) : [];
  const next = items.map((it) =>
    it.key === key
      ? { ...it, done: !it.done, doneById: !it.done ? user.id : null, doneAt: !it.done ? new Date().toISOString() : null }
      : it,
  );
  await prisma.pchSubmission.update({ where: { id }, data: { checklist: next as Prisma.InputJsonValue } });
  revalidatePath(`/pch/${loaded.submission.tenderId}`);
  return { ok: true };
}

/** Ajoute une exigence propre à CET appel d'offres (au-delà de la checklist type). */
export async function addChecklistItem(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "PCH", "UPDATE")) return nonAutorise;
  const id = fdStr(formData, "id");
  const label = fdStr(formData, "label");
  if (!id || !label) return { ok: false, error: "Libellé manquant." };
  const loaded = await loadEditableSubmission(id);
  if ("error" in loaded) return { ok: false, error: loaded.error };

  const items = Array.isArray(loaded.submission.checklist) ? (loaded.submission.checklist as Array<Record<string, unknown>>) : [];
  const key = `x-${Date.now().toString(36)}`;
  await prisma.pchSubmission.update({
    where: { id },
    data: { checklist: [...items, { key, label, done: false }] as Prisma.InputJsonValue },
  });
  revalidatePath(`/pch/${loaded.submission.tenderId}`);
  return { ok: true };
}

/**
 * LE DÉPÔT OFFICIEL — le geste qui fige tout, en une transaction :
 *   • la version passe SUBMITTED et se VERROUILLE (plus aucune modification servie) ;
 *   • le marché reçoit sa date de soumission (le jalon que la frise déduisait faute de donnée) ;
 *   • chaque ligne rattachée à un produit reçoit sa PHOTO de dépôt (`submissionSnapshot`) —
 *     si la fiche produit change dans deux ans, l'AO continue de montrer ce qui a été déposé.
 */
export async function submitSubmission(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "PCH", "UPDATE")) return nonAutorise;
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Identifiant manquant." };
  const loaded = await loadEditableSubmission(id);
  if ("error" in loaded) return { ok: false, error: loaded.error };
  const { submission } = loaded;

  const lines = await prisma.pchTenderLine.findMany({
    where: { tenderId: submission.tenderId },
    select: {
      id: true, designation: true, dci: true, dosage: true, form: true, unitsPerBox: true,
      unitLabel: true, quantityUnits: true, submittedQuantityUnits: true, unitPriceDzd: true,
      product: {
        select: {
          code: true, canonicalName: true, dci: true, dosage: true, dosageUnit: true, form: true,
          packaging: true,
          regulatoryProfiles: { select: { reference: true, status: true }, take: 1 },
        },
      },
    },
  });

  const quand = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.pchSubmission.update({
      where: { id },
      data: { status: "SUBMITTED", submittedAt: quand, lockedAt: quand },
    });
    await tx.pchTender.update({
      where: { id: submission.tenderId },
      data: { submittedAt: quand, updatedById: user.id },
    });
    for (const l of lines) {
      const reg = l.product?.regulatoryProfiles[0] ?? null;
      await tx.pchTenderLine.update({
        where: { id: l.id },
        data: {
          submissionSnapshot: {
            figeLe: quand.toISOString(),
            versionSoumission: submission.version,
            designationAo: l.designation,
            dci: l.dci, dosage: l.dosage, forme: l.form,
            unitesParBoite: l.unitsPerBox, uniteDemandee: l.unitLabel,
            quantiteSoumise: l.submittedQuantityUnits ?? l.quantityUnits,
            prixUnitaireDzd: l.unitPriceDzd === null ? null : toNumber(l.unitPriceDzd),
            produit: l.product
              ? {
                  code: l.product.code, nom: l.product.canonicalName, dci: l.product.dci,
                  dosage: l.product.dosage, uniteDosage: l.product.dosageUnit,
                  forme: l.product.form, conditionnement: l.product.packaging,
                  regulatory: reg ? { reference: reg.reference, statut: reg.status } : null,
                }
              : null,
          } as Prisma.InputJsonValue,
        },
      });
    }
  });

  await recordAudit({
    actorId: user.id, action: "UPDATE", module: "PCH",
    summary: `Soumission V${submission.version} DÉPOSÉE — ${submission.tender.reference} (${lines.length} ligne·s figée·s)`,
  });
  revalidatePath(`/pch/${submission.tenderId}`);
  revalidatePath("/pch");
  return { ok: true, message: `Version V${submission.version} déposée et verrouillée.` };
}

// ─────────────────────────────── Résultats & attribution ───────────────────────────────────

const RESULTATS = ["WON", "LOST", "UNSUCCESSFUL", "CANCELLED", "SUBMITTED", "QUOTED", "PENDING"] as const;

/**
 * LE RÉSULTAT D'UN LOT — statut + quantité + prix d'attribution, en un geste, audité avec
 * l'avant/après : « résultat modifié » est une action sensible (§62).
 */
export async function setLineResult(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "PCH", "UPDATE")) return nonAutorise;
  const lineId = fdStr(formData, "lineId");
  const statusRaw = fdStr(formData, "status");
  if (!lineId || !statusRaw || !RESULTATS.includes(statusRaw as (typeof RESULTATS)[number])) {
    return { ok: false, error: "Résultat invalide." };
  }
  const line = await prisma.pchTenderLine.findUnique({
    where: { id: lineId },
    select: { id: true, tenderId: true, designation: true, status: true, awardedQuantityUnits: true, awardedUnitPriceDzd: true, quantityUnits: true, submittedQuantityUnits: true },
  });
  if (!line) return { ok: false, error: "Ligne introuvable." };

  const awardedQty = posInt(formData, "awardedQuantityUnits");
  const awardedPrice = fdNum(formData, "awardedUnitPriceDzd");
  if (awardedPrice !== null && awardedPrice < 0) return { ok: false, error: "Le prix d'attribution ne peut pas être négatif." };
  const soumis = line.submittedQuantityUnits ?? line.quantityUnits;
  if (statusRaw === "WON" && awardedQty !== null && awardedQty > soumis) {
    return { ok: false, error: `Quantité attribuée (${awardedQty}) supérieure à la quantité soumise (${soumis}) — corriger d'abord la soumission si l'organisme a réellement attribué davantage.` };
  }

  await prisma.pchTenderLine.update({
    where: { id: lineId },
    data: {
      status: statusRaw as never,
      awardedQuantityUnits: statusRaw === "WON" ? awardedQty : null,
      awardedUnitPriceDzd: statusRaw === "WON" ? awardedPrice : null,
    },
  });
  await recordAudit({
    actorId: user.id, action: "UPDATE", module: "PCH",
    summary: `Résultat du lot « ${line.designation} » : ${line.status} → ${statusRaw}${awardedQty !== null ? ` (${awardedQty} u.)` : ""}${awardedPrice !== null ? ` à ${awardedPrice} DZD` : ""}`,
  });
  revalidatePath(`/pch/${line.tenderId}`);
  return { ok: true };
}

// ─────────────────────────────── Contrat & avenants ─────────────────────────────────────────

/**
 * LE CONTRAT NAÎT DE L'ATTRIBUTION — un seul objet, deux vues (§16).
 *
 * La pièce créée est un `LegalDocument` : Legal la retrouve dans son module avec sa revue, ses
 * lecteurs, ses échéances ; PCH la voit dans le marché. La transaction crée le document ET ses
 * lignes contractuelles depuis les lots GAGNÉS — quantité attribuée, prix d'attribution.
 */
export async function createContractFromAward(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  // Créer un contrat est un geste LEGAL autant que PCH : il faut les deux portes.
  if (!userCan(user, "PCH", "UPDATE") || !userCan(user, "LEGAL", "CREATE")) return nonAutorise;
  const tenderId = fdStr(formData, "tenderId");
  if (!tenderId) return { ok: false, error: "Appel d'offres manquant." };

  const tender = await prisma.pchTender.findUnique({
    where: { id: tenderId },
    select: {
      id: true, reference: true, title: true, client: true, companyId: true,
      lines: {
        where: { status: "WON" },
        select: { id: true, designation: true, productId: true, quantityUnits: true, submittedQuantityUnits: true, awardedQuantityUnits: true, unitPriceDzd: true, awardedUnitPriceDzd: true },
      },
    },
  });
  if (!tender) return { ok: false, error: "Appel d'offres introuvable." };
  if (tender.lines.length === 0) return { ok: false, error: "Aucun lot gagné : rien à contractualiser." };

  // Le montant proposé = somme des lots gagnés (quantité attribuée × prix d'attribution) ;
  // la personne peut le corriger — c'est le contrat signé qui fait foi, pas notre calcul.
  const montantCalcule = tender.lines.reduce((total, l) => {
    const qte = l.awardedQuantityUnits ?? l.submittedQuantityUnits ?? l.quantityUnits;
    const prix = l.awardedUnitPriceDzd ?? l.unitPriceDzd;
    return total + (prix === null ? 0 : qte * toNumber(prix));
  }, 0);
  const montant = fdNum(formData, "amount") ?? (montantCalcule > 0 ? Math.round(montantCalcule) : null);

  const doc = await prisma.$transaction(async (tx) => {
    const created = await tx.legalDocument.create({
      data: {
        kind: "CONTRACT",
        title: fdStr(formData, "title") ?? `Contrat — ${tender.title ?? tender.reference}`,
        reference: fdStr(formData, "reference"),
        counterparty: fdStr(formData, "counterparty") ?? tender.client,
        startDate: fdDate(formData, "startDate"),
        endDate: fdDate(formData, "endDate"),
        signedAt: fdDate(formData, "signedAt"),
        amount: montant,
        companyId: tender.companyId,
        tenderId: tender.id,
        sourceType: "PCH_TENDER",
        sourceId: tender.id,
        notes: fdStr(formData, "notes"),
        createdById: user.id,
      },
    });
    for (const l of tender.lines) {
      await tx.pchContractLine.create({
        data: {
          documentId: created.id,
          contractId: created.id,
          tenderLineId: l.id,
          productId: l.productId,
          designation: l.designation,
          quantityUnits: l.awardedQuantityUnits ?? l.submittedQuantityUnits ?? l.quantityUnits,
          unitPriceDzd: l.awardedUnitPriceDzd ?? l.unitPriceDzd,
        },
      });
    }
    return created;
  });

  await recordAudit({
    actorId: user.id, action: "CREATE", module: "LEGAL",
    summary: `Contrat créé depuis l'attribution de ${tender.reference} (${tender.lines.length} ligne·s${montant ? `, ${montant} DZD` : ""})`,
  });
  revalidatePath(`/pch/${tenderId}`);
  revalidatePath("/legal");
  return { ok: true, id: doc.id };
}

/** Rattache un contrat Legal EXISTANT à son marché — pour l'historique déjà saisi. */
export async function linkContractToTender(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "PCH", "UPDATE")) return nonAutorise;
  const tenderId = fdStr(formData, "tenderId");
  const contractId = fdStr(formData, "contractId");
  if (!tenderId || !contractId) return { ok: false, error: "Marché ou contrat manquant." };
  const doc = await prisma.legalDocument.findUnique({ where: { id: contractId }, select: { id: true, title: true, tenderId: true } });
  if (!doc) return { ok: false, error: "Contrat introuvable." };
  if (doc.tenderId && doc.tenderId !== tenderId) return { ok: false, error: "Ce contrat est déjà rattaché à un autre marché." };

  await prisma.legalDocument.update({ where: { id: contractId }, data: { tenderId, updatedById: user.id } });
  await recordAudit({ actorId: user.id, action: "UPDATE", module: "PCH", summary: `Contrat « ${doc.title} » rattaché au marché` });
  revalidatePath(`/pch/${tenderId}`);
  return { ok: true };
}

/**
 * UN AVENANT — une vraie pièce Legal (kind AMENDMENT) qui porte son impact marché.
 * Le montant initial du contrat n'est jamais touché : la valeur courante se CALCULE.
 */
export async function createAmendment(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "LEGAL", "CREATE")) return nonAutorise;
  const contractId = fdStr(formData, "contractId");
  if (!contractId) return { ok: false, error: "Contrat manquant." };
  const contract = await prisma.legalDocument.findUnique({
    where: { id: contractId },
    select: { id: true, title: true, kind: true, companyId: true, tenderId: true, amendments: { select: { id: true } } },
  });
  if (!contract) return { ok: false, error: "Contrat introuvable." };
  if (contract.kind !== "CONTRACT" && contract.kind !== "AGREEMENT") {
    return { ok: false, error: "Un avenant ne peut viser qu'un contrat ou une convention." };
  }

  const numero = contract.amendments.length + 1;
  const created = await prisma.legalDocument.create({
    data: {
      kind: "AMENDMENT",
      title: fdStr(formData, "title") ?? `Avenant n° ${numero} — ${contract.title}`,
      reference: fdStr(formData, "reference"),
      amendsId: contract.id,
      tenderId: contract.tenderId,
      companyId: contract.companyId,
      amountDelta: fdNum(formData, "amountDelta"),
      signedAt: fdDate(formData, "signedAt"),
      effectiveAt: fdDate(formData, "effectiveAt"),
      startDate: fdDate(formData, "effectiveAt"),
      notes: fdStr(formData, "notes"),
      createdById: user.id,
    },
  });
  await recordAudit({
    actorId: user.id, action: "CREATE", module: "LEGAL",
    summary: `Avenant n° ${numero} sur « ${contract.title} »${fdNum(formData, "amountDelta") !== null ? ` (impact ${fdNum(formData, "amountDelta")} DZD)` : ""}`,
  });
  if (contract.tenderId) revalidatePath(`/pch/${contract.tenderId}`);
  revalidatePath("/legal");
  return { ok: true, id: created.id };
}

/** Pose la prise d'effet d'un avenant — le moment où ses deltas ENTRENT dans les calculs. */
export async function setAmendmentEffective(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "LEGAL", "UPDATE")) return nonAutorise;
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Identifiant manquant." };
  const doc = await prisma.legalDocument.findUnique({ where: { id }, select: { id: true, kind: true, title: true, tenderId: true } });
  if (!doc || doc.kind !== "AMENDMENT") return { ok: false, error: "Avenant introuvable." };
  const effectiveAt = fdDate(formData, "effectiveAt") ?? new Date();

  await prisma.legalDocument.update({
    where: { id },
    data: { effectiveAt, signedAt: fdDate(formData, "signedAt") ?? undefined, updatedById: user.id },
  });
  await recordAudit({ actorId: user.id, action: "UPDATE", module: "LEGAL", summary: `Avenant « ${doc.title} » effectif au ${effectiveAt.toISOString().slice(0, 10)}` });
  if (doc.tenderId) revalidatePath(`/pch/${doc.tenderId}`);
  revalidatePath("/legal");
  return { ok: true };
}

/**
 * UNE LIGNE CONTRACTUELLE — sur le contrat de base ou sur un avenant (delta, négatif permis).
 * Le contrat racine est résolu ici, jamais confié au formulaire.
 */
export async function addContractLine(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "LEGAL", "UPDATE")) return nonAutorise;
  const documentId = fdStr(formData, "documentId");
  const designation = fdStr(formData, "designation");
  const qty = fdNum(formData, "quantityUnits");
  if (!documentId || !designation || qty === null || !Number.isFinite(qty)) {
    return { ok: false, error: "Désignation ou quantité manquante." };
  }
  const doc = await prisma.legalDocument.findUnique({
    where: { id: documentId },
    select: { id: true, kind: true, amendsId: true, tenderId: true, title: true },
  });
  if (!doc) return { ok: false, error: "Pièce introuvable." };
  const contractId = doc.kind === "AMENDMENT" ? doc.amendsId : doc.id;
  if (!contractId) return { ok: false, error: "Cet avenant n'est rattaché à aucun contrat." };
  const quantityUnits = Math.round(qty);
  // Une quantité NÉGATIVE n'a de sens que sur un avenant (réduction) — sur le contrat de
  // base, c'est une erreur de saisie.
  if (quantityUnits < 0 && doc.kind !== "AMENDMENT") {
    return { ok: false, error: "Une quantité négative ne se pose que sur un avenant de réduction." };
  }

  await prisma.pchContractLine.create({
    data: {
      documentId: doc.id,
      contractId,
      tenderLineId: fdStr(formData, "tenderLineId"),
      productId: fdStr(formData, "productId"),
      designation,
      quantityUnits,
      unitPriceDzd: fdNum(formData, "unitPriceDzd"),
    },
  });
  await recordAudit({
    actorId: user.id, action: "UPDATE", module: "LEGAL",
    summary: `Ligne contractuelle ${quantityUnits >= 0 ? "+" : ""}${quantityUnits} u. « ${designation} » sur « ${doc.title} »`,
  });
  if (doc.tenderId) revalidatePath(`/pch/${doc.tenderId}`);
  return { ok: true };
}

export async function deleteContractLine(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "LEGAL", "UPDATE")) return nonAutorise;
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Identifiant manquant." };
  const line = await prisma.pchContractLine.findUnique({
    where: { id },
    select: { id: true, designation: true, quantityUnits: true, document: { select: { tenderId: true, title: true } } },
  });
  if (!line) return { ok: false, error: "Ligne introuvable." };
  await prisma.pchContractLine.delete({ where: { id } });
  await recordAudit({
    actorId: user.id, action: "DELETE", module: "LEGAL",
    summary: `Ligne contractuelle retirée : « ${line.designation} » (${line.quantityUnits} u.) de « ${line.document.title} »`,
  });
  if (line.document.tenderId) revalidatePath(`/pch/${line.document.tenderId}`);
  return { ok: true };
}

// ─────────────────────────────── Lignes de bon de commande ─────────────────────────────────

/**
 * Position commandée d'un produit dans le périmètre d'un contrat : contractuel (lignes
 * effectives, deltas compris) et déjà commandé (lignes de BC non annulés). Le regroupement se
 * fait par produit — un avenant qui AJOUTE des unités est une ligne séparée du même produit.
 */
async function positionContractuelle(contractId: string, produitCle: { productId: string | null; designation: string }) {
  const maintenant = new Date();
  const [contrat, lignesDoc] = await Promise.all([
    prisma.legalDocument.findUnique({ where: { id: contractId }, select: { id: true, status: true } }),
    prisma.pchContractLine.findMany({
      where: { contractId },
      select: {
        id: true, productId: true, designation: true, quantityUnits: true,
        document: { select: { kind: true, status: true, effectiveAt: true } },
      },
    }),
  ]);
  if (!contrat) return null;

  const cle = (productId: string | null, designation: string) => productId ?? `libelle:${designation.trim().toLowerCase()}`;
  const cible = cle(produitCle.productId, produitCle.designation);
  let contractuel = 0;
  const lignesDuProduit: string[] = [];
  for (const l of lignesDoc) {
    if (cle(l.productId, l.designation) !== cible) continue;
    const effective = l.document.status !== "CANCELLED"
      && (l.document.kind !== "AMENDMENT" || (l.document.effectiveAt !== null && l.document.effectiveAt <= maintenant));
    if (!effective) continue;
    contractuel += l.quantityUnits;
    lignesDuProduit.push(l.id);
  }
  contractuel = Math.max(0, contractuel);

  const dejaCommandeAgg = await prisma.pchOrderLine.aggregate({
    where: { contractLineId: { in: lignesDuProduit }, order: { status: { not: "CANCELLED" } } },
    _sum: { quantityUnits: true },
  });
  return { contractuel, dejaCommande: dejaCommandeAgg._sum.quantityUnits ?? 0 };
}

/**
 * UNE LIGNE DE BON DE COMMANDE, contrôlée contre le restant contractuel.
 *
 * Dépassement ⇒ refus AVEC le chiffre exact, sauf `force` explicite — qui passe, mais s'audite
 * avec son excès. Les quantités d'un marché public se disputent devant un organisme : le rôle
 * de l'ERP est de rendre l'écart VISIBLE, pas de le rendre insaisissable.
 */
export async function addOrderLine(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "PCH", "UPDATE")) return nonAutorise;
  const orderId = fdStr(formData, "orderId");
  const designation = fdStr(formData, "designation");
  const qty = posInt(formData, "quantityUnits");
  if (!orderId || !designation || qty === null || qty <= 0) {
    return { ok: false, error: "Désignation ou quantité manquante." };
  }
  const order = await prisma.pchOrder.findUnique({
    where: { id: orderId },
    select: { id: true, tenderId: true, contractId: true, reference: true },
  });
  if (!order) return { ok: false, error: "Bon de commande introuvable." };

  const contractLineId = fdStr(formData, "contractLineId");
  const force = fdBool(formData, "force");
  let exces = 0;
  let tenderLineId = fdStr(formData, "tenderLineId");

  if (contractLineId && order.contractId) {
    const cl = await prisma.pchContractLine.findUnique({
      where: { id: contractLineId },
      select: { id: true, contractId: true, productId: true, designation: true, tenderLineId: true },
    });
    if (!cl) return { ok: false, error: "Ligne contractuelle introuvable." };
    if (cl.contractId !== order.contractId) {
      return { ok: false, error: "Cette ligne appartient à un autre contrat que celui du bon." };
    }
    // La ligne contractuelle CONNAÎT sa ligne d'AO : on la recopie pour que le fil
    // produit → AO → contrat → BC se remonte par n'importe quel bout.
    tenderLineId = tenderLineId ?? cl.tenderLineId;
    const position = await positionContractuelle(cl.contractId, cl);
    if (position) {
      const controle = controlerCommande(position.contractuel, position.dejaCommande, qty);
      if (!controle.ok && !force) {
        return { ok: false, error: `${controle.message} Confirmer pour passer outre.`, message: "DEPASSEMENT" };
      }
      exces = controle.excesUnites;
    }
  }

  await prisma.pchOrderLine.create({
    data: {
      orderId,
      contractLineId,
      tenderLineId,
      designation,
      quantityUnits: qty,
      unitPriceDzd: fdNum(formData, "unitPriceDzd"),
    },
  });
  await recordAudit({
    actorId: user.id, action: "UPDATE", module: "PCH",
    summary: `Ligne BC ${order.reference ?? ""} : ${qty} u. « ${designation} »${exces > 0 ? ` — DÉPASSEMENT contractuel forcé (excès ${exces} u.)` : ""}`,
  });
  revalidatePath(`/pch/${order.tenderId}`);
  return exces > 0
    ? { ok: true, message: `Ligne ajoutée MALGRÉ un dépassement de ${exces} unités — tracé dans l'audit.` }
    : { ok: true };
}

export async function deleteOrderLine(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "PCH", "UPDATE")) return nonAutorise;
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Identifiant manquant." };
  const line = await prisma.pchOrderLine.findUnique({
    where: { id },
    select: { id: true, designation: true, order: { select: { tenderId: true } } },
  });
  if (!line) return { ok: false, error: "Ligne introuvable." };
  await prisma.pchOrderLine.delete({ where: { id } });
  revalidatePath(`/pch/${line.order.tenderId}`);
  return { ok: true };
}

// ─────────────────────────────── Livraisons ────────────────────────────────────────────────

/**
 * UNE LIVRAISON — BL, dates, réserves, et ses lignes (champ `qty_<orderLineId>`).
 *
 * Le mouvement de STOCK n'est créé QUE sur demande explicite (case cochée) et QUE pour les
 * lignes dont le produit se résout SANS ambiguïté vers un produit Regulatory : écrire dans le
 * stock sur une devinette fausserait la seule source de vérité des quantités (§21).
 */
export async function createDelivery(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "PCH", "UPDATE")) return nonAutorise;
  const orderId = fdStr(formData, "orderId");
  if (!orderId) return { ok: false, error: "Bon de commande manquant." };
  const order = await prisma.pchOrder.findUnique({
    where: { id: orderId },
    select: {
      id: true, tenderId: true, reference: true,
      orderLines: {
        select: {
          id: true, designation: true, quantityUnits: true,
          contractLine: { select: { productId: true } },
          tenderLine: { select: { productId: true } },
        },
      },
    },
  });
  if (!order) return { ok: false, error: "Bon de commande introuvable." };

  const deliveredAt = fdDate(formData, "deliveredAt");
  const lignes: { orderLineId: string; designation: string; qty: number; productId: string | null }[] = [];
  for (const ol of order.orderLines) {
    const qty = posInt(formData, `qty_${ol.id}`);
    if (qty === null || qty <= 0) continue;
    lignes.push({
      orderLineId: ol.id, designation: ol.designation, qty,
      productId: ol.contractLine?.productId ?? ol.tenderLine?.productId ?? null,
    });
  }
  if (lignes.length === 0) return { ok: false, error: "Aucune quantité livrée saisie." };

  const versStock = fdBool(formData, "createStockMovements");
  let mouvements = 0;
  let sansProduit = 0;

  await prisma.$transaction(async (tx) => {
    const delivery = await tx.pchDelivery.create({
      data: {
        orderId,
        reference: fdStr(formData, "reference"),
        expectedAt: fdDate(formData, "expectedAt"),
        deliveredAt,
        location: fdStr(formData, "location"),
        reserves: fdStr(formData, "reserves"),
        notes: fdStr(formData, "notes"),
        createdById: user.id,
      },
    });
    for (const l of lignes) {
      await tx.pchDeliveryLine.create({
        data: {
          deliveryId: delivery.id,
          orderLineId: l.orderLineId,
          designation: l.designation,
          quantityUnits: l.qty,
          batchNumber: fdStr(formData, `batch_${l.orderLineId}`),
          expiryDate: fdDate(formData, `expiry_${l.orderLineId}`),
        },
      });
      if (versStock && deliveredAt) {
        // Résolution SANS ambiguïté : produit canonique → profil Regulatory unique.
        const reg = l.productId
          ? await tx.regulatoryProduct.findMany({ where: { productId: l.productId }, select: { id: true }, take: 2 })
          : [];
        if (reg.length === 1) {
          await tx.stockMovement.create({
            data: {
              product: l.designation,
              productId: reg[0].id,
              direction: "OUT",
              quantity: l.qty,
              date: deliveredAt,
              location: "PCH",
              notes: `Livraison marché${order.reference ? ` — BC ${order.reference}` : ""}`,
              deliveryId: delivery.id,
              createdById: user.id,
            },
          });
          mouvements += 1;
        } else {
          sansProduit += 1;
        }
      }
    }
  });

  await recordAudit({
    actorId: user.id, action: "CREATE", module: "PCH",
    summary: `Livraison${fdStr(formData, "reference") ? ` BL ${fdStr(formData, "reference")}` : ""} — ${lignes.length} ligne·s${mouvements ? `, ${mouvements} mouvement·s de stock` : ""}`,
  });
  revalidatePath(`/pch/${order.tenderId}`);
  const avertissement = versStock && sansProduit > 0
    ? ` ${sansProduit} ligne·s sans produit résolu : aucun mouvement de stock créé pour elles.`
    : "";
  return { ok: true, message: `Livraison enregistrée.${avertissement}` };
}

export async function deleteDelivery(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "PCH", "DELETE")) return nonAutorise;
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Identifiant manquant." };
  const d = await prisma.pchDelivery.findUnique({
    where: { id },
    select: { id: true, reference: true, order: { select: { tenderId: true } }, stockMovements: { select: { id: true } } },
  });
  if (!d) return { ok: false, error: "Livraison introuvable." };
  // Les mouvements de stock liés survivent (SetNull) — les supprimer en cascade réécrirait
  // l'histoire du stock depuis un autre module. On le DIT au lieu de le faire en silence.
  await prisma.pchDelivery.delete({ where: { id } });
  await recordAudit({ actorId: user.id, action: "DELETE", module: "PCH", summary: `Livraison supprimée${d.reference ? ` (BL ${d.reference})` : ""}` });
  revalidatePath(`/pch/${d.order.tenderId}`);
  return {
    ok: true,
    message: d.stockMovements.length > 0
      ? `Livraison supprimée. ${d.stockMovements.length} mouvement·s de stock conservé·s — à corriger dans Stocks si besoin.`
      : undefined,
  };
}
