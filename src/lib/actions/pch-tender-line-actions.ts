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

const MODULE = "PCH" as const;
const int = (fd: FormData, key: string): number | null => { const n = fdNum(fd, key); return n == null ? null : Math.max(0, Math.round(n)); };
function parseLineStatus(v: string | null): PchLineStatus {
  return v === "PENDING" || v === "QUOTED" || v === "SUBMITTED" || v === "WON" || v === "LOST" ? v : "PENDING";
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
      haveProduct: fdStr(formData, "haveProduct") === "on",
      unitPriceDzd: fdNum(formData, "unitPriceDzd"),
      suppliersInfo: fdStr(formData, "suppliersInfo"),
      status: parseLineStatus(fdStr(formData, "status")),
      awardedUnitPriceDzd: fdNum(formData, "awardedUnitPriceDzd"),
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

RÈGLES : n'invente aucun produit absent du document. N'invente pas de dosage ni de quantité. Si une
information manque, mets "" (texte) ou 0 (nombre). Extrais TOUS les produits listés.`;

interface RawLine { designation?: unknown; dci?: unknown; dosage?: unknown; form?: unknown; quantityUnits?: unknown; unitsPerBox?: unknown }

export async function analyzeTenderText(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, MODULE, "UPDATE")) return { ok: false, error: "Non autorisé." };
  if (!aiConfigured()) return { ok: false, error: "IA non configurée : ajoutez la clé ANTHROPIC_API_KEY (Render)." };
  const tenderId = fdStr(formData, "tenderId");
  const text = fdStr(formData, "text");
  if (!tenderId) return { ok: false, error: "Appel d'offres introuvable." };
  if (!text || text.trim().length < 10) return { ok: false, error: "Collez le texte du document (issu de l'OCR)." };

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
    }))
    .filter((l) => l.designation);
  if (!clean.length) return { ok: false, error: "Aucun produit détecté dans le texte." };

  const base = await prisma.pchTenderLine.count({ where: { tenderId } });
  await prisma.pchTenderLine.createMany({ data: clean.map((l, i) => ({ ...l, tenderId, sortOrder: base + i })) });
  await recordAudit({ actorId: user.id, action: "UPDATE", module: "PCH", summary: `Analyse IA appel d'offres — ${clean.length} produit(s) extrait(s)` });
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
  const line = await prisma.pchTenderLine.findUnique({ where: { id } });
  if (!line) return { ok: false, error: "Ligne introuvable." };

  const recs = getRecommendations();
  const q = normText(line.dci || line.designation);
  const qt = queryTokens(q);
  let best: RecRow | undefined = recs.find((rec) => rec.key === q);
  if (!best && qt.length) {
    const cands = recs.filter((rec) => allTokensIn(rec.key, qt) || (rec.key && allTokensIn(q, queryTokens(rec.key))));
    best = cands.sort((a, b) => b.valueDzd - a.valueDzd)[0];
  }
  if (!best) return { ok: false, error: "Aucune correspondance dans l'intelligence marché pour ce produit." };

  await prisma.pchTenderLine.update({
    where: { id },
    data: {
      dci: line.dci || best.dci,
      competitorCount: best.manufacturers + best.importers,
      nomLines: best.nomLines,
      registeredNomenclature: best.nomLines > 0,
      marketEstimateDzd: best.valueDzd ? Math.round(best.valueDzd) : null,
      suppliersInfo: line.suppliersInfo || `${best.manufacturers} fabricant(s) / ${best.importers} importateur(s) · ${best.recommendation}`,
    },
  });
  await recordAudit({ actorId: user.id, action: "UPDATE", module: "PCH", summary: `Enrichissement marché — ${line.designation}` });
  if (tenderId) revalidatePath(`/pch/${tenderId}`);
  return { ok: true };
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
