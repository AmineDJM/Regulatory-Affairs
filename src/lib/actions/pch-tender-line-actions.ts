"use server";

import { revalidatePath } from "next/cache";
import type { PchLineStatus } from "@prisma/client";
import { requireUser } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { supprimerReversible } from "@/lib/suppression/coeur";
import { fdStr, fdNum, fdCase, type ActionResult } from "@/lib/actions/types";
import { unitFromBoxPrice } from "@/lib/pch/box-economics";
import { allocationChange, allocationSummary, portfolioName } from "@/lib/pch/bu-allocation";
import { aiConfigured, cleModeleRequise } from "@/lib/ai";
import { interrupteurIaCoupe, REFUS_IA_COUPEE } from "@/lib/ai-settings";
import { phraseIaNonConfiguree } from "@/lib/ia/cle-manquante";
import { persistUploadedDocument } from "@/lib/documents";
import { getRecommendations, normText, queryTokens, allTokensIn, type RecRow } from "@/lib/market/engine";
import { pchReceptionPrice, nomenclatureMatch } from "@/lib/market/pch-lookup";
import { analyzeMolecule, canonicalForm, type MoleculeAnalysis } from "@/lib/market/molecule";
import { canOcr } from "@/lib/regulatory/intelligence/ocr/ocr-engine";
import { marcheDeLaLigne, marcheDuBon, peutAgirSurLeMarche } from "@/lib/pch/porte-marche";
import { demanderLignesAo, ecrireLectureAo, lireDocumentAo, LECTURE_TEXTE_COLLE } from "@/lib/pch/lecture-ao";
import { ligneChangee, phraseDeLExtraction, phraseDocumentIlisible, resumeAuditLecture, type BilanLecture } from "@/lib/pch/extraction";

const MODULE = "PCH" as const;
const int = (fd: FormData, key: string): number | null => { const n = fdNum(fd, key); return n == null ? null : Math.max(0, Math.round(n)); };
/** Le statut d'un lot, lu à coup sûr — `null` sur une valeur qu'on ne reconnaît pas, jamais « À étudier » par défaut. */
function statutDeLigne(v: string): PchLineStatus | null {
  return v === "PENDING" || v === "QUOTED" || v === "SUBMITTED" || v === "WON" || v === "LOST"
    || v === "UNSUCCESSFUL" || v === "CANCELLED"
    ? v
    : null;
}

// ─────────────────────────── Lignes de l'appel d'offres ───────────────────────────
export async function addTenderLine(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, MODULE, "UPDATE")) return { ok: false, error: "Non autorisé." };
  const tenderId = fdStr(formData, "tenderId");
  if (!tenderId || !(await peutAgirSurLeMarche(user, tenderId, "UPDATE"))) return { ok: false, error: "Appel d'offres introuvable." };
  const count = await prisma.pchTenderLine.count({ where: { tenderId } });
  const line = await prisma.pchTenderLine.create({ data: { tenderId, designation: fdStr(formData, "designation") || "Nouveau produit", sortOrder: count } });
  revalidatePath(`/pch/${tenderId}`);
  return { ok: true, id: line.id };
}

export async function updateTenderLine(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, MODULE, "UPDATE")) return { ok: false, error: "Non autorisé." };
  const id = fdStr(formData, "id");
  const tenderId = fdStr(formData, "tenderId");
  if (!id || !(await peutAgirSurLeMarche(user, await marcheDeLaLigne(id), "UPDATE"))) return { ok: false, error: "Ligne introuvable." };
  // UN STATUT ILLISIBLE N'EST PAS « À ÉTUDIER » (§118.192a) : il rendait un lot gagné à l'étude, sans un mot.
  const statutLu = fdStr(formData, "status");
  const statut = statutLu === null ? undefined : statutDeLigne(statutLu);
  if (statut === null) return { ok: false, error: `Statut de lot inconnu (« ${statutLu} ») : rien n'a été enregistré.` };
  // UNE PERSONNE A-T-ELLE CHANGÉ QUELQUE CHOSE ? (audit 360°, lot D1c — F2) Une ligne qu'une personne a
  // modifiée n'est plus remplacée par la lecture suivante du document (`lib/pch/extraction.ts`). L'écran
  // enregistre à chaque sortie de champ, même sans rien changer : `modifieeLe` ne se pose que sur une VRAIE
  // différence — sinon passer d'un champ à l'autre soustrairait la ligne à toute relecture, et la phrase
  // dirait « modifiée à la main » d'une ligne intacte.
  const avant = await prisma.pchTenderLine.findUnique({
    where: { id },
    select: {
      designation: true, dci: true, dosage: true, form: true, quantityUnits: true, unitsPerBox: true, unitLabel: true,
      haveProduct: true, boxPriceDzd: true, boxCostDzd: true, unitPriceDzd: true, suppliersInfo: true, status: true,
      awardedUnitPriceDzd: true, awardedQuantityUnits: true, submittedQuantityUnits: true, note: true,
    },
  });
  if (!avant) return { ok: false, error: "Ligne introuvable." };
  // CE QUE LE FORMULAIRE NE PORTE PAS NE S'ÉCRIT PAS (§118.152c — vague « restes »). Chaque champ s'écrivait à
  // chaque appel, présent ou non : un formulaire qui ne portait que la quantité remettait le statut à « À
  // étudier », effaçait la DCI, les prix de boîte et la quantité attribuée — c'est ce que faisait la carte d'Adam,
  // qui ne rejoue ni la boîte ni les quantités soumise et attribuée. Chaque clé est testée EN LITTÉRAL (la
  // dérivation des contrats les lit) ; `undefined` laisse la colonne telle quelle, une valeur vide la vide. La
  // case « Nous l'avons » se lit par `fdCase` : « on », « off », ou rien — et rien ne change rien (§118.172).
  const prixBoite = formData.has("boxPriceDzd") ? fdNum(formData, "boxPriceDzd") : undefined;
  const parBoite = formData.has("unitsPerBox") ? int(formData, "unitsPerBox") : undefined;
  const prixUnitaire = formData.has("unitPriceDzd") ? fdNum(formData, "unitPriceDzd") : undefined;
  const data = {
    designation: fdStr(formData, "designation") ?? undefined,
    dci: formData.has("dci") ? fdStr(formData, "dci") : undefined,
    dosage: formData.has("dosage") ? fdStr(formData, "dosage") : undefined,
    form: formData.has("form") ? fdStr(formData, "form") : undefined,
    quantityUnits: formData.has("quantityUnits") ? (int(formData, "quantityUnits") ?? 0) : undefined,
    unitsPerBox: parBoite,
    unitLabel: formData.has("unitLabel") ? fdStr(formData, "unitLabel") : undefined,
    haveProduct: fdCase(formData, "haveProduct"),
    // ── LA BOÎTE EST LA SOURCE, L'UNITÉ SA PROJECTION ───────────────────────────────────
    //
    // Le prix réellement négocié est celui de la BOÎTE : c'est lui qui figure sur l'offre.
    // Le prix unitaire — dont vit toute la chaîne aval, qui compte en unités parce que le
    // marché compte en unités — s'en DÉDUIT ici, au seul endroit où il s'écrit. Le stocker
    // comme source ferait de 1 000 DZD la boîte de 30 un prix à 999,90 au retour. La
    // projection lit le conditionnement EN VIGUEUR : celui du formulaire, sinon celui de la
    // ligne — un formulaire qui ne porte que la boîte ne la divise pas par « rien ».
    //
    // Une ligne chiffrée à l'unité, sans prix de boîte, garde son prix tel quel : les lignes
    // anciennes ne sont pas réécrites.
    boxPriceDzd: prixBoite,
    boxCostDzd: formData.has("boxCostDzd") ? fdNum(formData, "boxCostDzd") : undefined,
    unitPriceDzd: prixBoite != null
      ? unitFromBoxPrice(prixBoite, parBoite !== undefined ? parBoite : avant.unitsPerBox) ?? prixUnitaire
      : prixUnitaire,
    suppliersInfo: formData.has("suppliersInfo") ? fdStr(formData, "suppliersInfo") : undefined,
    status: statut,
    awardedUnitPriceDzd: formData.has("awardedUnitPriceDzd") ? fdNum(formData, "awardedUnitPriceDzd") : undefined,
    // L'attribution PARTIELLE : la quantité gagnée quand elle diffère de la soumise.
    awardedQuantityUnits: formData.has("awardedQuantityUnits") ? int(formData, "awardedQuantityUnits") : undefined,
    submittedQuantityUnits: formData.has("submittedQuantityUnits") ? int(formData, "submittedQuantityUnits") : undefined,
    note: formData.has("note") ? fdStr(formData, "note") : undefined,
  };
  await prisma.pchTenderLine.update({
    where: { id },
    data: { ...data, ...(ligneChangee(avant, data) ? { modifieeLe: new Date() } : {}) },
  });
  if (tenderId) revalidatePath(`/pch/${tenderId}`);
  return { ok: true };
}

/**
 * AFFECTER UN LOT D'APPEL D'OFFRES À UNE OU PLUSIEURS BUSINESS UNITS.
 *
 * ── LE MAILLON QUI MANQUAIT ─────────────────────────────────────────────────────────────────
 *
 * On gagne un lot PCH ; quelqu'un doit le vendre. La force de vente sait déjà attribuer un
 * produit à un délégué — son écran, ses cycles, ses droits. Ce qui manquait était le maillon
 * d'AVANT : rien ne disait quelle gamme portait quel lot, et les produits gagnés n'apparaissaient
 * dans aucun portefeuille. On les répartissait de vive voix.
 *
 * ── POURQUOI PAR LOT, ET PLUSIEURS ──────────────────────────────────────────────────────────
 *
 * `PchTender.businessUnitId` posait UNE BU pour tout le marché ; or un bordereau porte vingt lots
 * de gammes différentes. Et deux BU peuvent légitimement se partager un produit (une gamme ville,
 * une gamme hôpital sur la même molécule).
 *
 * ── CE QUE L'AFFECTATION DÉCLENCHE ──────────────────────────────────────────────────────────
 *
 * Le produit entre au PORTEFEUILLE de la BU (`PromoProduct`) : c'est de là que la force de vente
 * l'attribue à ses KAM, par le circuit existant. On ne construit pas un second mécanisme
 * d'attribution — il produirait deux vérités sur « qui porte ce produit ».
 *
 * On n'invente NI le canal, NI la Direction Marketing, NI les prévisions : ce sont des décisions
 * commerciales qui appartiennent à la BU, pas des valeurs qu'un rattachement peut deviner.
 *
 * RETIRER une BU ne supprime PAS le produit de son portefeuille : il a pu y être ajouté pour
 * d'autres raisons, porter des prévisions et des affectations de KAM. On défait le rattachement
 * au lot, pas le travail de l'équipe commerciale.
 */
export async function setTenderLineBusinessUnits(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, MODULE, "UPDATE")) return { ok: false, error: "Non autorisé." };
  const id = fdStr(formData, "id");
  const tenderId = fdStr(formData, "tenderId");
  if (!id || !(await peutAgirSurLeMarche(user, await marcheDeLaLigne(id), "UPDATE"))) return { ok: false, error: "Ligne introuvable." };

  const line = await prisma.pchTenderLine.findUnique({
    where: { id },
    select: {
      id: true, designation: true, dci: true, dosage: true, form: true, productId: true,
      businessUnits: { select: { businessUnitId: true } },
    },
  });
  if (!line) return { ok: false, error: "Ligne introuvable." };

  const voulu = formData.getAll("businessUnitId").map((v) => String(v)).filter(Boolean);
  const connues = await prisma.businessUnit.findMany({
    where: { id: { in: voulu }, isActive: true },
    select: { id: true, name: true },
  });
  const nomParId = new Map(connues.map((b) => [b.id, b.name]));
  const change = allocationChange(line.businessUnits.map((b) => b.businessUnitId), connues.map((b) => b.id));
  if (change.unchanged) return { ok: true };

  // LA LIGNE D'ABORD (audit 360°, lot D1c — F2) : une lecture du document qui a lu cette ligne SANS
  // affectation la supprimerait — et l'affectation avec elle, en cascade, sans un mot. Toucher la ligne
  // AVANT d'écrire l'affectation fait échouer la suppression conditionnelle de la lecture (elle exige
  // l'état lu) ; si la lecture est passée la première, la ligne n'est plus là, et on le dit.
  const touchee = await prisma.pchTenderLine.updateMany({ where: { id }, data: { modifieeLe: new Date() } });
  if (touchee.count === 0) return { ok: false, error: "Ligne introuvable." };

  if (change.toRemove.length > 0) {
    await prisma.pchTenderLineBusinessUnit.deleteMany({
      where: { tenderLineId: id, businessUnitId: { in: change.toRemove } },
    });
  }
  if (change.toAdd.length > 0) {
    await prisma.pchTenderLineBusinessUnit.createMany({
      data: change.toAdd.map((businessUnitId) => ({ tenderLineId: id, businessUnitId, createdById: user.id })),
      skipDuplicates: true,
    });
    // LE PRODUIT ENTRE AU PORTEFEUILLE de chaque BU qui le prend — best-effort : un portefeuille
    // qui ne se met pas à jour ne doit pas annuler l'affectation, qui est le fait décidé.
    const nom = portfolioName(line);
    for (const businessUnitId of change.toAdd) {
      try {
        const deja = await prisma.promoProduct.findFirst({
          where: {
            businessUnitId,
            ...(line.productId ? { productId: line.productId } : { name: nom }),
          },
          select: { id: true },
        });
        if (!deja) {
          await prisma.promoProduct.create({
            data: { name: nom, businessUnitId, productId: line.productId ?? null, isActive: true },
          });
        }
      } catch (e) {
        console.error("[pch] portefeuille BU non alimenté", e);
      }
    }
  }

  const nomsAjoutes = change.toAdd.map((b) => nomParId.get(b) ?? b);
  const nomsRetires = change.toRemove.map((b) => b);
  await recordAudit({
    actorId: user.id, action: "UPDATE", module: "PCH",
    entityType: "PCH_TENDER", entityId: tenderId || undefined,
    summary: allocationSummary(line.designation, nomsAjoutes, nomsRetires),
  });
  if (tenderId) revalidatePath(`/pch/${tenderId}`);
  revalidatePath("/planning/affectations");
  return { ok: true };
}

export async function deleteTenderLine(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, MODULE, "UPDATE")) return { ok: false, error: "Non autorisé." };
  const id = fdStr(formData, "id");
  if (!id || !(await peutAgirSurLeMarche(user, await marcheDeLaLigne(id), "UPDATE"))) return { ok: false, error: "Ligne introuvable." };
  const ligne = await prisma.pchTenderLine.findUnique({
    where: { id },
    select: { designation: true, tenderId: true, tender: { select: { reference: true } } },
  });
  if (!ligne) return { ok: false, error: "Ligne introuvable." };
  // À LA CORBEILLE, PAR LE CŒUR RÉVERSIBLE (vague « restes »). Un lot partait d'un seul `delete` : sans
  // instantané, sans journal, avec ses affectations à des BU en cascade — et un bon de commande né de lui
  // gardait un `lineId` vers rien. Le cœur (§118.162) instantane la ligne et ses branches, refuse ce qui en
  // découle (bon de commande, ligne de contrat, vente sous marché, répartition Ad & Pro — la règle vit au
  // registre, `PCH_TENDER_LINE.refuse`, une seule copie pour l'écran, le bouton rouge et Adam), et le Super
  // Admin restaure d'un geste.
  const r = await supprimerReversible("PCH_TENDER_LINE", id, user.id,
    `Lot « ${ligne.designation} » retiré de l'appel d'offres ${ligne.tender.reference} (corbeille)`);
  if (!r.ok) return { ok: false, error: r.error ?? "Suppression impossible." };
  // L'historique du MARCHÉ le dit aussi : le journal du cœur désigne la ligne disparue, qu'aucun écran ne relit
  // plus par son identifiant (§118.181).
  await recordAudit({
    actorId: user.id, action: "UPDATE", module: "PCH", entityType: "PCH_TENDER", entityId: ligne.tenderId,
    summary: `Lot « ${ligne.designation} » retiré du marché — à la corbeille, restaurable par le Super Admin`,
  });
  revalidatePath(`/pch/${ligne.tenderId}`);
  return { ok: true };
}

// ─────────────── Lecture du document d'un appel d'offres (son texte → les lignes du marché) ───────────────
//
// La lecture, la demande au modèle et l'écriture vivent dans `lib/pch/lecture-ao.ts` ; les règles (la coupe,
// la lecture de la réponse, « une ligne que personne n'a touchée », les phrases) dans `lib/pch/extraction.ts`.
// Ces deux actions lisent le formulaire, vérifient les portes dans l'ordre de l'état (le marché, puis
// l'interrupteur, puis la clé, puis la saisie — §118.18), gardent le fichier, enrichissent, et DISENT ce qui a
// été fait : la lecture d'avant répondait « ok » sur un tableau doublé, un texte coupé aux deux tiers, un PDF
// natif océrisé et facturé page par page.

/** L'ENRICHISSEMENT des lignes neuves — aucun échec ici n'annule la lecture, qui est écrite. */
async function enrichirLesLignes(ids: readonly string[]): Promise<number> {
  let n = 0;
  for (const id of ids) {
    try { if (await enrichLineById(id)) n++; } catch (e) { console.error("[pch] enrichissement ligne impossible", e); }
  }
  return n;
}

export async function analyzeTenderText(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, MODULE, "UPDATE")) return { ok: false, error: "Non autorisé." };
  const tenderId = fdStr(formData, "tenderId");
  if (!tenderId || !(await peutAgirSurLeMarche(user, tenderId, "UPDATE"))) return { ok: false, error: "Appel d'offres introuvable." };
  // L'interrupteur AVANT la clé (§118.196) : coupé, la réponse vraie est « coupé », même sans clé.
  if (await interrupteurIaCoupe()) return { ok: false, error: REFUS_IA_COUPEE };
  // Le nom de la clé se lit dans le registre (§118.128) : un refus qui nomme la mauvaise clé fait
  // poser une variable qui ne change rien.
  if (!aiConfigured()) return { ok: false, error: phraseIaNonConfiguree(cleModeleRequise(), "l'analyse automatique d'un appel d'offres") };
  const text = fdStr(formData, "text");
  if (!text || text.length < 10) return { ok: false, error: "Collez le texte de l'appel d'offres." };
  const complementaire = fdCase(formData, "complementaire") === true;

  const demande = await demanderLignesAo(text);
  if (!demande.ok) return { ok: false, error: demande.error };
  const ecrit = await ecrireLectureAo({
    tenderId, auteurId: user.id, source: "texte", nomFichier: null, complementaire, lecture: LECTURE_TEXTE_COLLE, demande,
  });
  if (!ecrit.ok) return { ok: false, error: ecrit.error };

  const bilan: BilanLecture = { ...ecrit.bilan, fichier: null, enrichies: await enrichirLesLignes(ecrit.creees) };
  await recordAudit({
    actorId: user.id, action: "UPDATE", module: "PCH",
    entityType: "PCH_TENDER", entityId: tenderId,
    summary: resumeAuditLecture(bilan),
  });
  revalidatePath(`/pch/${tenderId}`);
  return { ok: true, message: phraseDeLExtraction(bilan) };
}

/** Le document de l'AO téléversé : son TEXTE d'abord, l'OCR seulement pour un scan — puis l'extraction des produits. */
export async function analyzeTenderDocument(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, MODULE, "UPDATE")) return { ok: false, error: "Non autorisé." };
  const tenderId = fdStr(formData, "tenderId");
  if (!tenderId || !(await peutAgirSurLeMarche(user, tenderId, "UPDATE"))) return { ok: false, error: "Appel d'offres introuvable." };
  if (await interrupteurIaCoupe()) return { ok: false, error: REFUS_IA_COUPEE };
  if (!aiConfigured()) return { ok: false, error: phraseIaNonConfiguree(cleModeleRequise(), "l'analyse automatique d'un appel d'offres") };
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choisissez le document de l'appel d'offres." };
  const ext = (file.name.split(".").pop() ?? "").toLowerCase();
  if (!canOcr(ext)) return { ok: false, error: `Format .${ext} non pris en charge : un PDF ou une image (PNG, JPEG, TIFF, WebP).` };
  const complementaire = fdCase(formData, "complementaire") === true;
  const forcerOcr = fdCase(formData, "forcerOcr") === true;

  const buffer = Buffer.from(await file.arrayBuffer());
  const lecture = await lireDocumentAo(ext, buffer, { forcerOcr });
  if (lecture.texte.length < 10) return { ok: false, error: phraseDocumentIlisible(lecture) };
  const demande = await demanderLignesAo(lecture.texte);
  if (!demande.ok) return { ok: false, error: demande.error };
  const ecrit = await ecrireLectureAo({
    tenderId, auteurId: user.id, source: "document", nomFichier: file.name, complementaire, lecture, demande,
  });
  if (!ecrit.ok) return { ok: false, error: ecrit.error };

  // LE FICHIER LU EST GARDÉ sur le marché — seulement avec le droit d'y téléverser : lire le document n'en
  // donne pas le droit de le déposer, et refuser la lecture pour autant priverait la personne d'un geste
  // qu'elle a le droit de faire. La phrase dit ce qui s'est passé.
  let fichier: BilanLecture["fichier"] = "SANS_DROIT";
  if (userCan(user, MODULE, "UPLOAD")) {
    const garde = await persistUploadedDocument(user.id, {
      entityType: "PCH_TENDER", entityId: tenderId, category: "SUPPORTING_DOC", confidentiality: "INTERNAL",
      stepKey: null, file, buffer,
    });
    if (garde.ok && garde.documentId) {
      await prisma.pchTenderExtraction.updateMany({ where: { id: ecrit.extractionId, documentId: null }, data: { documentId: garde.documentId } });
      fichier = "GARDE";
    } else {
      fichier = { echec: garde.error ?? "enregistrement impossible." };
    }
  }

  const bilan: BilanLecture = { ...ecrit.bilan, fichier, enrichies: await enrichirLesLignes(ecrit.creees) };
  await recordAudit({
    actorId: user.id, action: "UPDATE", module: "PCH",
    entityType: "PCH_TENDER", entityId: tenderId,
    summary: resumeAuditLecture(bilan),
  });
  revalidatePath(`/pch/${tenderId}`);
  return { ok: true, message: phraseDeLExtraction(bilan) };
}

// ─────────────────── Ventes : bon de commande (vente réelle) depuis une ligne gagnée ───────────────────
export async function createOrderFromLine(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, MODULE, "UPDATE")) return { ok: false, error: "Non autorisé." };
  const lineId = fdStr(formData, "lineId");
  const tenderId = fdStr(formData, "tenderId");
  if (!lineId || !tenderId) return { ok: false, error: "Ligne introuvable." };
  const line = await prisma.pchTenderLine.findUnique({ where: { id: lineId } });
  // Le bon naît sur le marché de SA ligne : un `tenderId` de formulaire différent aurait créé, sur un
  // marché permis, un bon portant la ligne d'un autre (§118.184 — S11).
  if (!line || line.tenderId !== tenderId || !(await peutAgirSurLeMarche(user, line.tenderId, "UPDATE"))) return { ok: false, error: "Ligne introuvable." };
  if (line.status !== "WON") return { ok: false, error: "Ligne non attribuée : marquez-la « Gagné » d'abord." };

  const qty = int(formData, "quantity") ?? 0;
  if (qty <= 0) return { ok: false, error: "Indiquez une quantité (fraction vendue)." };
  const unit = line.awardedUnitPriceDzd ?? line.unitPriceDzd;
  const value = unit != null ? Math.round(Number(unit) * qty * 100) / 100 : null;

  await prisma.pchOrder.create({
    data: {
      tenderId, lineId, reference: fdStr(formData, "reference"),
      products: line.designation, quantity: qty, value,
      status: "PENDING",
    },
  });
  await recordAudit({ actorId: user.id, action: "CREATE", module: "PCH", summary: `Bon de commande (vente réelle) — ${line.designation} × ${qty}` });
  revalidatePath(`/pch/${tenderId}`);
  return { ok: true };
}

// ─────────────────── Enrichissement intelligence marché (concurrents / nomenclature / estimation) ───────────────────
export async function enrichTenderLine(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, MODULE, "UPDATE")) return { ok: false, error: "Non autorisé." };
  const id = fdStr(formData, "id");
  const tenderId = fdStr(formData, "tenderId");
  if (!id) return { ok: false, error: "Ligne introuvable." };
  const line = await prisma.pchTenderLine.findUnique({ where: { id }, select: { designation: true, tenderId: true } });
  if (!line || !(await peutAgirSurLeMarche(user, line.tenderId, "UPDATE"))) return { ok: false, error: "Ligne introuvable." };

  const ok = await enrichLineById(id);
  if (!ok) return { ok: false, error: "Aucune correspondance (intelligence marché / réceptions PCH / nomenclature)." };
  await recordAudit({ actorId: user.id, action: "UPDATE", module: "PCH", summary: `Enrichissement marché + prix Réception — ${line.designation}` });
  if (tenderId) revalidatePath(`/pch/${tenderId}`);
  return { ok: true };
}

/** Ré-enrichit TOUTES les lignes d'un appel d'offres d'un seul geste. */
export async function enrichAllTenderLines(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, MODULE, "UPDATE")) return { ok: false, error: "Non autorisé." };
  const tenderId = fdStr(formData, "tenderId");
  if (!tenderId || !(await peutAgirSurLeMarche(user, tenderId, "UPDATE"))) return { ok: false, error: "Appel d'offres introuvable." };
  const lines = await prisma.pchTenderLine.findMany({ where: { tenderId }, select: { id: true }, orderBy: { sortOrder: "asc" } });
  if (lines.length === 0) return { ok: false, error: "Aucune ligne à enrichir." };
  let done = 0;
  for (const l of lines) {
    try { if (await enrichLineById(l.id)) done++; } catch (e) { console.error("[pch] enrichissement ligne impossible", e); }
  }
  await recordAudit({ actorId: user.id, action: "UPDATE", module: "PCH", summary: `Enrichissement marché de ${done}/${lines.length} ligne(s)` });
  revalidatePath(`/pch/${tenderId}`);
  return done > 0 ? { ok: true } : { ok: false, error: "Aucune correspondance trouvée pour ces lignes." };
}

/**
 * ENRICHISSEMENT D'UNE LIGNE — le cœur, appelé aussi bien à l'unité qu'en lot après l'analyse
 * du document. Quatre apports, tous issus de données réelles :
 *   1. le **prix de référence** verrouillé sur les réceptions PCH (dosage + forme vérifiés) ;
 *   2. la **nomenclature** (qui est enregistré sur ce produit) ;
 *   3. **notre** produit correspondant au catalogue Regulatory ;
 *   4. l'**analyse de marché** par molécule (poids, ville / hôpital, concurrents, part de
 *      chacun, fabriqué localement ou importé) — la même que l'Intelligence marché.
 * Renvoie false si RIEN n'a pu être rapproché (on n'écrit alors pas de demi-vérité).
 */
async function enrichLineById(id: string): Promise<boolean> {
  const line = await prisma.pchTenderLine.findUnique({ where: { id } });
  if (!line) return false;

  const recs = getRecommendations();
  const q = normText(line.dci || line.designation);
  const qt = queryTokens(q);
  let best: RecRow | undefined = recs.find((rec) => rec.key === q);
  if (!best && qt.length) {
    const cands = recs.filter((rec) => allTokensIn(rec.key, qt) || (rec.key && allTokensIn(q, queryTokens(rec.key))));
    best = cands.sort((a, b) => b.valueDzd - a.valueDzd)[0];
  }

  // 1) Verrou PRIX depuis les réceptions PCH 2025 (vérifie dosage + forme).
  const dciForLookup = line.dci || best?.dci || line.designation;
  const price = pchReceptionPrice(dciForLookup, line.dosage, line.form);
  // 2) Nomenclature vérifiée dosage + forme (plus précise que l'agrégat DCI).
  const nom = nomenclatureMatch(dciForLookup, line.dosage, line.form);
  // 3) Auto-détection de NOTRE produit dans le catalogue Regulatory (dci + dosage).
  const ours = await matchOurProduct(dciForLookup, line.dosage);

  // 4) Analyse de marché par MOLÉCULE (la même que l'Intelligence marché) : combien pèse ce
  //    marché, comment il se partage ville / hôpital, qui le détient, et depuis où.
  const market = analyzeMoleculeSafe(dciForLookup, line.dosage, line.form);

  if (!best && !price && !nom.registered && !ours && !market) return false;

  const unitsPerBox = line.unitsPerBox ?? parseBoxSize(price?.cond);
  await prisma.pchTenderLine.update({
    where: { id },
    data: {
      dci: line.dci || best?.dci || null,
      unitsPerBox,
      nomLines: nom.count || best?.nomLines || null,
      registeredNomenclature: nom.registered || (best ? best.nomLines > 0 : line.registeredNomenclature),
      refPriceDzd: price?.unitPriceDzd != null ? Math.round(price.unitPriceDzd * 100) / 100 : line.refPriceDzd,
      refPriceSource: price ? `Réception PCH 2025 — ${price.label}${price.date ? ` (${price.date})` : ""}` : line.refPriceSource,
      haveProduct: ours ? true : line.haveProduct,
      ourProductId: ours?.id ?? line.ourProductId,
      // Une désignation déjà posée (à la main, ou par un enrichissement d'avant) n'est jamais remplacée.
      ...(line.productId == null && ours?.productId ? { productId: ours.productId } : {}),
      ourProduct: ours?.label ?? line.ourProduct,
      registeredOurs: ours ? true : line.registeredOurs,
      suppliersInfo: line.suppliersInfo || (best ? `${best.manufacturers} fabricant(s) / ${best.importers} importateur(s)${nom.origins ? ` · nomenclature : ${nom.origins}` : ""}` : nom.origins ? `Nomenclature : ${nom.origins}` : null),
      // Paysage concurrentiel — l'analyse par molécule prime sur l'agrégat DCI historique.
      marketEstimateDzd: market?.total.valueDzd ? Math.round(market.total.valueDzd * 100) / 100 : (best?.valueDzd ? Math.round(best.valueDzd * 100) / 100 : line.marketEstimateDzd),
      competitorCount: market ? market.total.players : (best ? best.manufacturers + best.importers : line.competitorCount),
      marketOrigin: market ? dominantOrigin(market) : line.marketOrigin,
      marketVillePct: market ? Math.round(market.ville.pct * 100) / 100 : line.marketVillePct,
      marketHopitalPct: market ? Math.round(market.hopital.pct * 100) / 100 : line.marketHopitalPct,
      marketHhi: market ? market.hhi : line.marketHhi,
      competitorsTop: market && market.competitors.length
        ? market.competitors.slice(0, 3).map((c) => `${c.lab} ${c.share.toFixed(0)} %`).join(" · ")
        : line.competitorsTop,
    },
  });
  return true;
}

/** L'analyse de marché ne doit jamais faire échouer un enrichissement : elle est un bonus. */
function analyzeMoleculeSafe(dci: string, dosage: string | null, form: string | null) {
  try {
    const molecule = (dci ?? "").trim();
    if (molecule.length < 3) return null;
    return analyzeMolecule({ molecule, dosage: dosage || null, form: canonicalForm(form) === "AUTRE" ? null : canonicalForm(form) });
  } catch (e) {
    console.error("[pch] analyse molécule impossible", e);
    return null;
  }
}

/**
 * Origine dominante du marché : ce que font les acteurs qui pèsent, pas le simple décompte.
 * Un marché à 80 % détenu par des importateurs est un marché « importé », même s'il compte
 * dix petits fabricants locaux.
 */
function dominantOrigin(market: MoleculeAnalysis): string | null {
  let local = 0, imported = 0;
  for (const c of market.competitors) {
    if (c.origin === "LOCAL") local += c.share;
    else if (c.origin === "IMPORT") imported += c.share;
    else if (c.origin === "MIXTE") { local += c.share / 2; imported += c.share / 2; }
  }
  if (local === 0 && imported === 0) return null;
  const total = local + imported;
  if (local / total >= 0.7) return "LOCAL";
  if (imported / total >= 0.7) return "IMPORT";
  return "MIXTE";
}

/** Extrait un nombre d'unités par boîte depuis un conditionnement (« B/30 », « Boîte de 20 », « 30 cp »). */
function parseBoxSize(cond: string | null | undefined): number | null {
  if (!cond) return null;
  const m = cond.match(/(?:b\s*\/|bo[iî]te\s*(?:de)?\s*|x\s*)(\d{1,4})/i) || cond.match(/\b(\d{1,4})\b/);
  const n = m ? parseInt(m[1], 10) : NaN;
  return Number.isFinite(n) && n > 0 && n < 100000 ? n : null;
}

/** Rapproche le produit de NOTRE catalogue Regulatory (dci + dosage), renvoie {id,label} si trouvé.
 *  Les dossiers VERROUILLÉS sont exclus : l'analyse d'un appel d'offres est lue par toute
 *  l'équipe, et y voir « notre produit » révélerait le portefeuille confidentiel. */
async function matchOurProduct(dci: string, dosage: string | null): Promise<{ id: string; label: string; productId: string | null } | null> {
  const qt = queryTokens(normText([dci, dosage].filter(Boolean).join(" ")));
  if (!qt.length) return null;
  const products = await prisma.regulatoryProduct.findMany({ where: { isLocked: false }, select: { id: true, dci: true, brandName: true, dosage: true, dosageUnit: true, reference: true, productId: true }, take: 2000 });
  const hits = products.filter((p) => {
    const hay = normText(`${p.dci} ${p.brandName ?? ""} ${p.dosage ?? ""} ${p.dosageUnit ?? ""}`);
    return allTokensIn(hay, qt);
  });
  const hit = hits[0];
  if (!hit) return null;
  // LE PRODUIT CANONIQUE, ET SEULEMENT À COUP SÛR (audit 360°, I17 ; §118.178) : le lot n'en recevait
  // jamais, donc la réserve « un produit, un AO » ne s'affichait jamais. On le pose quand TOUS les
  // dossiers reconnus désignent le MÊME produit canonique — deux produits possibles n'en désignent
  // aucun (§118.34) : choisir le premier rattacherait le lot au mauvais médicament, en silence.
  const canoniques = new Set(hits.map((h) => h.productId));
  const productId = canoniques.size === 1 ? hit.productId : null;
  return { id: hit.id, label: `${hit.brandName || hit.dci} · ${hit.reference}`, productId };
}

// ─────────────────────── Logistique : dates d'arrivée d'un bon de commande ───────────────────────
export async function setOrderArrival(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, MODULE, "UPDATE")) return { ok: false, error: "Non autorisé." };
  const id = fdStr(formData, "id");
  const tenderId = fdStr(formData, "tenderId");
  if (!id || !(await peutAgirSurLeMarche(user, await marcheDuBon(id), "UPDATE"))) return { ok: false, error: "Bon de commande introuvable." };
  const parseDate = (k: string) => { const v = fdStr(formData, k); return v ? new Date(v) : null; };
  await prisma.pchOrder.update({
    where: { id },
    data: { expectedArrival: parseDate("expectedArrival"), arrivedDate: parseDate("arrivedDate") },
  });
  await recordAudit({ actorId: user.id, action: "UPDATE", module: "PCH", summary: "Suivi logistique bon de commande (arrivée)" });
  if (tenderId) revalidatePath(`/pch/${tenderId}`);
  return { ok: true };
}
