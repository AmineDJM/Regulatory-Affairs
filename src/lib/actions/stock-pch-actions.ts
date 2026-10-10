"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { enLecture } from "@/lib/vue-lecture";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { persistUploadedDocument } from "@/lib/documents";
import { getAppSettings } from "@/lib/settings";
import { ecrireEtatDuJour } from "@/lib/stocks/etat-jour";
import * as XLSX from "xlsx";
import { cleReleve, lireLieu, lireNombre, type LieuReleve, type LigneCollee } from "@/lib/stocks/pch-central";
import { lireReleveFichier } from "@/lib/stocks/pch-releve-fichier";
import { chargerDirectionsPch, chargerProduitsPch, rapprocherLignesReleve, saisitLeStockPch } from "@/lib/queries/stock-pch";
import { fdDate, fdStr, type ActionResult } from "@/lib/actions/types";

/**
 * LE STOCK PCH CENTRAL, SAISI À LA MAIN (Direction, 08/10 : « reçus par mail »).
 *
 * Un relevé = la DATE du mail + les quantités de nos produits, chacune pour son LIEU (la PCH centrale, une direction
 * régionale — DRA, DRB, DRBE, DRC, DRO, DRTAM — ou une annexe héritée) + le mail ou le PDF joint. Direction, 10/2026 : les
 * stocks d'Adventum viennent de la PCH (central + DR) et des hôpitaux (relevés des KAM) ; nous n'avons pas de stock propre.
 * Les quantités s'écrivent par le MÊME écrivain que le formulaire des relevés (`ecrireEtatDuJour`) : un état par
 * produit, par lieu et par jour — ressaisir le même jour corrige.
 */
export async function enregistrerStockPch(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!saisitLeStockPch(user)) return { ok: false, error: "La saisie du stock PCH appartient à la chaîne d'approvisionnement." };

  const date = fdDate(formData, "date");
  if (!date) return { ok: false, error: "Indiquez la date du mail de la PCH." };
  if (date.getTime() > Date.now() + 24 * 3600 * 1000) return { ok: false, error: "La date du mail ne peut pas être dans le futur." };


  // LES LIEUX : par ligne (« "" » = PCH centrale, « dr:DRA », « annex:<id> »). À défaut, l'ancien champ `annexId` (une annexe pour tout le relevé).
  const ids = formData.getAll("productId").map((v) => String(v));
  const quantites = formData.getAll("quantity").map((v) => String(v));
  const lieuxBruts = formData.getAll("lieu").map((v) => String(v));
  const annexDefaut = fdStr(formData, "annexId");
  if (ids.length !== quantites.length || (lieuxBruts.length > 0 && lieuxBruts.length !== ids.length)) return { ok: false, error: "Saisie incomplète : rechargez la page." };

  const directions = new Set((await chargerDirectionsPch()).map((d) => d.code));
  const annexes = new Map((await prisma.stockAnnex.findMany({ where: { kind: "ANNEX" }, select: { id: true } })).map((a) => [a.id, true]));
  const lieuDe = (i: number): LieuReleve | string => {
    const brut = lieuxBruts.length ? lieuxBruts[i] : annexDefaut ? `annex:${annexDefaut}` : "";
    const l = lireLieu(brut);
    if (!l) return "Lieu de stock illisible : rechargez la page.";
    if (l.type === "DR" && !directions.has(l.code)) return `Direction régionale inconnue : ${l.code}.`;
    if (l.type === "ANNEX" && !annexes.has(l.annexId)) return "Annexe PCH introuvable : rechargez la page.";
    return l;
  };

  // NOS PRODUITS SEULEMENT — le catalogue des BU, relu ici : un identifiant forgé ne crée pas de stock.
  const nos = new Set((await chargerProduitsPch(user)).map((p) => p.id));
  const lignes: { productId: string; quantity: number; lieu: LieuReleve }[] = [];
  const vus = new Set<string>();
  for (let i = 0; i < ids.length; i++) {
    const brut = quantites[i]?.trim() ?? "";
    if (!brut) continue;
    const q = lireNombre(brut);
    if (q === null) return { ok: false, error: `Quantité illisible : « ${brut} » (un nombre entier de boîtes).` };
    if (!nos.has(ids[i])) return { ok: false, error: "Un produit n'est pas au catalogue des BU : rechargez la page." };
    const lieu = lieuDe(i);
    if (typeof lieu === "string") return { ok: false, error: lieu };
    const cleLigne = `${ids[i]}|${lieu.type}|${lieu.type === "DR" ? lieu.code : lieu.type === "ANNEX" ? lieu.annexId : ""}`;
    if (vus.has(cleLigne)) continue;
    vus.add(cleLigne);
    lignes.push({ productId: ids[i], quantity: q, lieu });
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
      scope: l.lieu.type === "CENTRAL" ? "PCH" : "ANNEX",
      annexId: l.lieu.type === "ANNEX" ? l.lieu.annexId : null,
      drCode: l.lieu.type === "DR" ? l.lieu.code : null,
      productId: l.productId, date,
      quantity: l.quantity, companyId: societe.get(l.productId) ?? null, createdById: user.id,
    });
    if (r.cree) crees += 1;
  }
  const nbLieux = new Set(lignes.map((l) => (l.lieu.type === "DR" ? l.lieu.code : l.lieu.type === "ANNEX" ? l.lieu.annexId : "PCH"))).size;

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
    summary: `Stock PCH du ${cle} — ${lignes.length} quantité(s), ${nbLieux} lieu(x)${fichiers.length ? `, ${fichiers.length} pièce(s)` : ""}`,
  });
  revalidatePath("/stocks");
  revalidatePath("/stocks/pch-central");
  revalidatePath("/stocks/chaine");
  const fait = `${lignes.length} quantité${lignes.length > 1 ? "s" : ""} enregistrée${lignes.length > 1 ? "s" : ""}`;
  return { ok: true, message: echecs.length ? `${fait}, mais ${echecs.length} pièce(s) refusée(s) : ${echecs.join(" ; ")}` : `${fait}.` };
}

/**
 * LIRE UN RELEVÉ DE STOCK PCH REÇU EN FICHIER (Excel / CSV) — sans rien écrire : rend les lignes lues, chacune avec le produit
 * reconnu (code PCH, présentation, nom du catalogue) et le lieu lu (colonne ANNEXE / DR, colonne par lieu, ou onglet). La personne
 * vérifie à l'écran, applique, puis « Enregistrer le relevé » écrit — le même chemin que « Coller le tableau ».
 */
export async function lireReleveStockPch(formData: FormData): Promise<{ ok: boolean; error?: string; lignes?: LigneCollee[]; feuilles?: number }> {
  const user = await enLecture(requireUser); // une LECTURE du fichier (rien n'est écrit) : la personne visualisée, comme pour toute lecture d'écran
  if (!saisitLeStockPch(user)) return { ok: false, error: "La saisie du stock PCH appartient à la chaîne d'approvisionnement." };
  const fichier = formData.get("file");
  if (!(fichier instanceof File) || fichier.size === 0) return { ok: false, error: "Choisissez le fichier Excel ou CSV du relevé." };
  const maxUploadMb = (await getAppSettings()).maxUploadMb;
  if (fichier.size > maxUploadMb * 1024 * 1024) return { ok: false, error: `Fichier trop lourd (${maxUploadMb} Mo au plus).` };
  if (!/\.(xlsx|xls|xlsm|csv|tsv|txt)$/i.test(fichier.name)) return { ok: false, error: "Format non lu : déposez un fichier .xlsx, .xls ou .csv." };

  let feuilles: { nom: string; lignes: unknown[][] }[];
  try {
    const wb = XLSX.read(Buffer.from(await fichier.arrayBuffer()), { type: "buffer", cellDates: false });
    feuilles = wb.SheetNames.map((nom) => ({
      nom, lignes: XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[nom], { header: 1, raw: true, defval: null, blankrows: false }),
    }));
  } catch {
    return { ok: false, error: "Ce fichier n'a pas pu être lu : vérifiez qu'il s'agit d'un classeur Excel ou d'un CSV." };
  }
  const lues = lireReleveFichier(feuilles);
  if (lues.length === 0) {
    return { ok: false, error: "Aucune ligne reconnue : il faut une colonne « code produit » ou « désignation » et une colonne « stock » (ou une colonne par lieu : PCH, DRA, DRB…)." };
  }
  const lignes = await rapprocherLignesReleve(await chargerProduitsPch(user), lues.slice(0, 2000));
  return { ok: true, lignes, feuilles: feuilles.length };
}
