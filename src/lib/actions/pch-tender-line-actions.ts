"use server";

import { revalidatePath } from "next/cache";
import type { PchLineStatus } from "@prisma/client";
import { requireUser } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { fdStr, fdNum, type ActionResult } from "@/lib/actions/types";
import { askClaude, aiConfigured } from "@/lib/ai";
import { getRecommendations, normText, queryTokens, allTokensIn, type RecRow } from "@/lib/market/engine";
import { pchReceptionPrice, nomenclatureMatch } from "@/lib/market/pch-lookup";
import { analyzeMolecule, canonicalForm, type MoleculeAnalysis } from "@/lib/market/molecule";
import { ocrDocument, canOcr } from "@/lib/regulatory/intelligence/ocr/ocr-engine";

const MODULE = "PCH" as const;
const int = (fd: FormData, key: string): number | null => { const n = fdNum(fd, key); return n == null ? null : Math.max(0, Math.round(n)); };
function parseLineStatus(v: string | null): PchLineStatus {
  return v === "PENDING" || v === "QUOTED" || v === "SUBMITTED" || v === "WON" || v === "LOST"
    || v === "UNSUCCESSFUL" || v === "CANCELLED"
    ? v
    : "PENDING";
}

// ─────────────────────────── Lignes de l'appel d'offres ───────────────────────────
export async function addTenderLine(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, MODULE, "UPDATE")) return { ok: false, error: "Non autorisé." };
  const tenderId = fdStr(formData, "tenderId");
  if (!tenderId) return { ok: false, error: "Appel d'offres introuvable." };
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
  if (!id) return { ok: false, error: "Ligne introuvable." };
  await prisma.pchTenderLine.update({
    where: { id },
    data: {
      designation: fdStr(formData, "designation") ?? undefined,
      dci: fdStr(formData, "dci"),
      dosage: fdStr(formData, "dosage"),
      form: fdStr(formData, "form"),
      quantityUnits: int(formData, "quantityUnits") ?? 0,
      unitsPerBox: int(formData, "unitsPerBox"),
      unitLabel: fdStr(formData, "unitLabel"),
      haveProduct: fdStr(formData, "haveProduct") === "on",
      unitPriceDzd: fdNum(formData, "unitPriceDzd"),
      suppliersInfo: fdStr(formData, "suppliersInfo"),
      status: parseLineStatus(fdStr(formData, "status")),
      awardedUnitPriceDzd: fdNum(formData, "awardedUnitPriceDzd"),
      // L'attribution PARTIELLE : la quantité gagnée quand elle diffère de la soumise.
      awardedQuantityUnits: int(formData, "awardedQuantityUnits"),
      submittedQuantityUnits: int(formData, "submittedQuantityUnits"),
      note: fdStr(formData, "note"),
    },
  });
  if (tenderId) revalidatePath(`/pch/${tenderId}`);
  return { ok: true };
}

export async function deleteTenderLine(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, MODULE, "UPDATE")) return { ok: false, error: "Non autorisé." };
  const id = fdStr(formData, "id");
  const tenderId = fdStr(formData, "tenderId");
  if (!id) return { ok: false, error: "Ligne introuvable." };
  await prisma.pchTenderLine.delete({ where: { id } });
  if (tenderId) revalidatePath(`/pch/${tenderId}`);
  return { ok: true };
}

// ─────────────────────── Analyse IA du document (OCR → texte → lignes) ───────────────────────
const ANALYZE_SYSTEM = `Tu extrais les PRODUITS demandés dans un APPEL D'OFFRES pharmaceutique de la PCH
(Pharmacie Centrale des Hôpitaux, Algérie), à partir du texte du document (issu d'un OCR).

Tu renvoies UNIQUEMENT un objet JSON valide (aucun texte autour) : { "lines": [ ... ] }.
Chaque élément de "lines" = un produit demandé, avec ces clés :
- "designation" : libellé du produit tel qu'écrit dans le document (obligatoire).
- "dci" : dénomination commune (molécule) si identifiable, sinon "".
- "dosage" : dosage (ex. "500 mg", "1 g"), sinon "".
- "form" : forme galénique (comprimé, injectable, sirop…), sinon "".
- "quantityUnits" : quantité demandée en UNITÉS (nombre entier). Si le document donne un nombre de
  boîtes et le conditionnement, convertis en unités si évident ; sinon mets la quantité telle quelle.
- "unitsPerBox" : nombre d'unités par boîte (« boîte de N ») si mentionné, sinon 0.
- "unitLabel" : NATURE de l'unité demandée, au singulier et en minuscules — « comprimé », « gélule »,
  « flacon », « ampoule », « seringue », « sachet », « suppositoire », « poche », « tube », « unité ».
  Un appel d'offres ne parle pas toujours de comprimés : c'est ce mot qui donne son sens à la quantité.
  Si le document ne le dit pas, déduis-le de la forme galénique ; en dernier recours mets "unité".

RÈGLES : n'invente aucun produit absent du document. N'invente pas de dosage ni de quantité. Si une
information manque, mets "" (texte) ou 0 (nombre). Extrais TOUS les produits listés.`;

interface RawLine { designation?: unknown; dci?: unknown; dosage?: unknown; form?: unknown; quantityUnits?: unknown; unitsPerBox?: unknown; unitLabel?: unknown }

/** Cœur commun : envoie le texte à Claude, crée les lignes extraites. */
async function extractAndSaveLines(tenderId: string, text: string, userId: string, source: string): Promise<ActionResult> {
  const r = await askClaude(`Texte du document d'appel d'offres :\n\n"""${text.slice(0, 24000)}"""\n\nRenvoie le JSON { "lines": [...] }.`, {
    system: ANALYZE_SYSTEM, maxTokens: 3500, temperature: 0.1,
  });
  if (!r.ok || !r.text) return { ok: false, error: r.error ?? "Analyse impossible." };
  const start = r.text.indexOf("{"); const end = r.text.lastIndexOf("}");
  if (start === -1 || end <= start) return { ok: false, error: "Réponse IA non exploitable." };
  let lines: RawLine[] = [];
  try { lines = (JSON.parse(r.text.slice(start, end + 1)) as { lines?: RawLine[] }).lines ?? []; }
  catch { return { ok: false, error: "Réponse IA non exploitable." }; }
  const clean = lines
    .map((l) => ({
      designation: String(l.designation ?? "").trim(),
      dci: String(l.dci ?? "").trim() || null,
      dosage: String(l.dosage ?? "").trim() || null,
      form: String(l.form ?? "").trim() || null,
      quantityUnits: Math.max(0, Math.round(Number(l.quantityUnits) || 0)),
      unitsPerBox: Number(l.unitsPerBox) > 0 ? Math.round(Number(l.unitsPerBox)) : null,
      unitLabel: String(l.unitLabel ?? "").trim().toLowerCase() || null,
    }))
    .filter((l) => l.designation);
  if (!clean.length) return { ok: false, error: "Aucun produit détecté dans le document." };

  const base = await prisma.pchTenderLine.count({ where: { tenderId } });
  await prisma.pchTenderLine.createMany({ data: clean.map((l, i) => ({ ...l, tenderId, sortOrder: base + i })) });

  // ENRICHISSEMENT AUTOMATIQUE de chaque ligne extraite : prix de référence, nomenclature,
  // notre catalogue, ET l'analyse de marché (poids, ville/hôpital, concurrents, local ou
  // importé). Lire le document ne servirait à rien s'il fallait ensuite cliquer sur chaque
  // ligne pour savoir ce que vaut le marché. Aucun échec ici n'annule l'extraction.
  const created = await prisma.pchTenderLine.findMany({
    where: { tenderId, sortOrder: { gte: base } },
    select: { id: true },
    orderBy: { sortOrder: "asc" },
  });
  let enriched = 0;
  for (const c of created) {
    try { if (await enrichLineById(c.id)) enriched++; } catch (e) { console.error("[pch] enrichissement ligne impossible", e); }
  }

  await recordAudit({
    actorId: userId, action: "UPDATE", module: "PCH",
    summary: `Analyse IA appel d'offres (${source}) — ${clean.length} produit(s), ${enriched} enrichi(s) par l'intelligence marché`,
  });
  revalidatePath(`/pch/${tenderId}`);
  return { ok: true };
}

export async function analyzeTenderText(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, MODULE, "UPDATE")) return { ok: false, error: "Non autorisé." };
  if (!aiConfigured()) return { ok: false, error: "IA non configurée : ajoutez la clé ANTHROPIC_API_KEY (Render)." };
  const tenderId = fdStr(formData, "tenderId");
  const text = fdStr(formData, "text");
  if (!tenderId) return { ok: false, error: "Appel d'offres introuvable." };
  if (!text || text.trim().length < 10) return { ok: false, error: "Collez le texte du document (issu de l'OCR)." };
  return extractAndSaveLines(tenderId, text, user.id, "texte collé");
}

/** Upload direct du document d'AO : OCR Mistral → texte → extraction IA des produits. */
export async function analyzeTenderDocument(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, MODULE, "UPDATE")) return { ok: false, error: "Non autorisé." };
  if (!aiConfigured()) return { ok: false, error: "IA non configurée : ajoutez la clé ANTHROPIC_API_KEY (Render)." };
  const tenderId = fdStr(formData, "tenderId");
  const file = formData.get("file");
  if (!tenderId) return { ok: false, error: "Appel d'offres introuvable." };
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choisissez le document de l'appel d'offres." };
  const ext = (file.name.split(".").pop() ?? "").toLowerCase();
  if (!canOcr(ext)) return { ok: false, error: `Format .${ext} non pris en charge pour l'OCR (PDF ou image).` };

  let text = "";
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const ocr = await ocrDocument({ ext, buffer, langs: ["fra", "eng"], maxPages: 40 });
    text = ocr.pages.map((p) => p.text).join("\n").trim();
  } catch (err) {
    console.error("[pch] OCR failed", err);
    return { ok: false, error: "OCR du document impossible." };
  }
  if (text.length < 10) return { ok: false, error: "Le document ne contient pas de texte exploitable (OCR vide)." };
  return extractAndSaveLines(tenderId, text, user.id, "OCR document");
}

// ─────────────────── Ventes : bon de commande (vente réelle) depuis une ligne gagnée ───────────────────
export async function createOrderFromLine(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, MODULE, "UPDATE")) return { ok: false, error: "Non autorisé." };
  const lineId = fdStr(formData, "lineId");
  const tenderId = fdStr(formData, "tenderId");
  if (!lineId || !tenderId) return { ok: false, error: "Ligne introuvable." };
  const line = await prisma.pchTenderLine.findUnique({ where: { id: lineId } });
  if (!line) return { ok: false, error: "Ligne introuvable." };
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
  const line = await prisma.pchTenderLine.findUnique({ where: { id }, select: { designation: true } });
  if (!line) return { ok: false, error: "Ligne introuvable." };

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
  if (!tenderId) return { ok: false, error: "Appel d'offres introuvable." };
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
      ourProduct: ours?.label ?? line.ourProduct,
      registeredOurs: ours ? true : line.registeredOurs,
      suppliersInfo: line.suppliersInfo || (best ? `${best.manufacturers} fabricant(s) / ${best.importers} importateur(s)${nom.origins ? ` · nomenclature : ${nom.origins}` : ""}` : nom.origins ? `Nomenclature : ${nom.origins}` : null),
      // Paysage concurrentiel — l'analyse par molécule prime sur l'agrégat DCI historique.
      marketEstimateDzd: market?.total.valueDzd ? Math.round(market.total.valueDzd) : (best?.valueDzd ? Math.round(best.valueDzd) : line.marketEstimateDzd),
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
async function matchOurProduct(dci: string, dosage: string | null): Promise<{ id: string; label: string } | null> {
  const qt = queryTokens(normText([dci, dosage].filter(Boolean).join(" ")));
  if (!qt.length) return null;
  const products = await prisma.regulatoryProduct.findMany({ where: { isLocked: false }, select: { id: true, dci: true, brandName: true, dosage: true, dosageUnit: true, reference: true }, take: 2000 });
  const hit = products.find((p) => {
    const hay = normText(`${p.dci} ${p.brandName ?? ""} ${p.dosage ?? ""} ${p.dosageUnit ?? ""}`);
    return allTokensIn(hay, qt);
  });
  return hit ? { id: hit.id, label: `${hit.brandName || hit.dci} · ${hit.reference}` } : null;
}

// ─────────────────────── Logistique : dates d'arrivée d'un bon de commande ───────────────────────
export async function setOrderArrival(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, MODULE, "UPDATE")) return { ok: false, error: "Non autorisé." };
  const id = fdStr(formData, "id");
  const tenderId = fdStr(formData, "tenderId");
  if (!id) return { ok: false, error: "Bon de commande introuvable." };
  const parseDate = (k: string) => { const v = fdStr(formData, k); return v ? new Date(v) : null; };
  await prisma.pchOrder.update({
    where: { id },
    data: { expectedArrival: parseDate("expectedArrival"), arrivedDate: parseDate("arrivedDate") },
  });
  await recordAudit({ actorId: user.id, action: "UPDATE", module: "PCH", summary: "Suivi logistique bon de commande (arrivée)" });
  if (tenderId) revalidatePath(`/pch/${tenderId}`);
  return { ok: true };
}
