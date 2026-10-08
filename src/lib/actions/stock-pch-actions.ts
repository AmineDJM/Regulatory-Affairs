"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { persistUploadedDocument } from "@/lib/documents";
import { getAppSettings } from "@/lib/settings";
import { ecrireEtatDuJour } from "@/lib/stocks/etat-jour";
import { cleReleve, lireNombre } from "@/lib/stocks/pch-central";
import { chargerProduitsPch, saisitLeStockPch } from "@/lib/queries/stock-pch";
import { fdDate, fdStr, type ActionResult } from "@/lib/actions/types";

/**
 * LE STOCK PCH CENTRAL, SAISI À LA MAIN (Direction, 08/10 : « reçus par mail »).
 *
 * Un relevé = la DATE du mail + les quantités de nos produits (central, ou une annexe / DR) + le mail ou le PDF joint.
 * Les quantités s'écrivent par le MÊME écrivain que le formulaire des relevés (`ecrireEtatDuJour`) : un état par
 * produit, par lieu et par jour — ressaisir le même jour corrige.
 */
export async function enregistrerStockPch(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!saisitLeStockPch(user)) return { ok: false, error: "La saisie du stock PCH appartient à la chaîne d'approvisionnement." };

  const date = fdDate(formData, "date");
  if (!date) return { ok: false, error: "Indiquez la date du mail de la PCH." };
  if (date.getTime() > Date.now() + 24 * 3600 * 1000) return { ok: false, error: "La date du mail ne peut pas être dans le futur." };

  // UNE ANNEXE / DR (facultatif) : un lieu de stock de type annexe, jamais un nom libre.
  const annexId = fdStr(formData, "annexId");
  if (annexId) {
    const lieu = await prisma.stockAnnex.findUnique({ where: { id: annexId }, select: { kind: true } });
    if (!lieu || lieu.kind !== "ANNEX") return { ok: false, error: "Annexe PCH introuvable : rechargez la page." };
  }

  const ids = formData.getAll("productId").map((v) => String(v));
  const quantites = formData.getAll("quantity").map((v) => String(v));
  if (ids.length !== quantites.length) return { ok: false, error: "Saisie incomplète : rechargez la page." };

  // NOS PRODUITS SEULEMENT — le catalogue des BU, relu ici : un identifiant forgé ne crée pas de stock.
  const nos = new Set((await chargerProduitsPch(user)).map((p) => p.id));
  const lignes: { productId: string; quantity: number }[] = [];
  const vus = new Set<string>();
  for (let i = 0; i < ids.length; i++) {
    const brut = quantites[i]?.trim() ?? "";
    if (!brut) continue;
    const q = lireNombre(brut);
    if (q === null) return { ok: false, error: `Quantité illisible : « ${brut} » (un nombre entier de boîtes).` };
    if (!nos.has(ids[i])) return { ok: false, error: "Un produit n'est pas au catalogue des BU : rechargez la page." };
    if (vus.has(ids[i])) continue;
    vus.add(ids[i]);
    lignes.push({ productId: ids[i], quantity: q });
  }
  const fichiers = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (lignes.length === 0 && fichiers.length === 0) return { ok: false, error: "Saisissez au moins une quantité, ou joignez le mail." };

  const produits = lignes.length
    ? await prisma.regulatoryProduct.findMany({ where: { id: { in: lignes.map((l) => l.productId) } }, select: { id: true, companyId: true } })
    : [];
  const societe = new Map(produits.map((p) => [p.id, p.companyId]));
  let crees = 0;
  for (const l of lignes) {
    const r = await ecrireEtatDuJour({
      scope: annexId ? "ANNEX" : "PCH", annexId: annexId ?? null, productId: l.productId, date,
      quantity: l.quantity, companyId: societe.get(l.productId) ?? null, createdById: user.id,
    });
    if (r.cree) crees += 1;
  }

  // LE MAIL / LE PDF DE LA PCH — joint au relevé (sa date). Un fichier refusé ne défait pas la saisie : il est dit.
  const cle = cleReleve(date);
  const echecs: string[] = [];
  if (fichiers.length) {
    const maxUploadMb = (await getAppSettings()).maxUploadMb;
    for (const file of fichiers) {
      const r = await persistUploadedDocument(user.id, {
        entityType: "STOCK_PCH_RELEVE", entityId: cle, category: "SUPPORTING_DOC", confidentiality: "INTERNAL", stepKey: null, file, maxUploadMb,
      });
      if (!r.ok) echecs.push(`${file.name} : ${r.error ?? "échec"}`);
    }
  }

  await recordAudit({
    actorId: user.id, action: crees === lignes.length ? "CREATE" : "UPDATE", module: "Stocks",
    summary: `Stock PCH ${annexId ? "(annexe) " : ""}du ${cle} — ${lignes.length} produit(s)${fichiers.length ? `, ${fichiers.length} pièce(s)` : ""}`,
  });
  revalidatePath("/stocks");
  revalidatePath("/stocks/pch-central");
  revalidatePath("/stocks/chaine");
  const fait = `${lignes.length} quantité${lignes.length > 1 ? "s" : ""} enregistrée${lignes.length > 1 ? "s" : ""}`;
  return { ok: true, message: echecs.length ? `${fait}, mais ${echecs.length} pièce(s) refusée(s) : ${echecs.join(" ; ")}` : `${fait}.` };
}
