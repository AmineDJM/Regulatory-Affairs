import type { AdProItemKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { CurrentUser } from "@/lib/session";
import { emettreDocumentDrive, reviserDocumentDrive } from "@/platform/in-process/artifact/factory";
import { devisDesPostes, type DevisDePosteVue } from "@/lib/queries/ad-pro-devis-poste";
import { rattacherPieceAuPoste } from "@/lib/ad-pro/pieces-poste";
import { lignesDuBon, refusDepassement, type LigneDevisPoste } from "@/lib/ad-pro/devis-poste";
import { formatDzd } from "@/lib/promo-material/devis";
import { ITEM_KIND_LABELS } from "@/lib/ad-pro-items";
import { enSerie } from "@/lib/refs";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * GÉNÉRER LES BONS DE COMMANDE D'UN POSTE D'APRÈS LES LIGNES VALIDÉES DE SES DEVIS (§118.206).
 *
 * « Il se peut qu'il y ait eu plusieurs devis, et différentes références dans chaque devis qui soient
 * validées : alors ça peut demander de générer UN BC PAR DEVIS (incluant UNIQUEMENT les références
 * validées). S'il oublie une référence, il peut juste la cocher dans le devis et RÉGÉNÉRER le BC. »
 *
 * Ce n'est PAS un second générateur (§118.5) : la composition, la numérotation, le Word et le PDF, la
 * révision (même numéro, version suivante, historique) sont ceux de la FABRIQUE de pièces commerciales,
 * la même que le matériel promotionnel et les Finances. Ce module ne fait que traduire — lignes validées
 * d'un devis → demande de la fabrique — et tenir le LIEN entre les lignes et le BC qui les porte
 * (`AdProDevisLigne.bcId`), pour que « régénérer » sache ce qui a changé.
 *
 * ── CE QUE LE BC PORTE, ET D'OÙ IL TIENT SA PORTE ───────────────────────────────────────────
 *
 *   • UNIQUEMENT les lignes validées POUR CE POSTE, de CE devis : une ligne non cochée n'est jamais
 *     commandée, une ligne validée pour un autre poste non plus.
 *   • Il découle de son devis (`chainFromId`), est rattaché au poste (`AdProItemPiece`) et naît avec le
 *     poste pour SOURCE : sa porte est le visa du POSTE (`portesDesBC`, source « POSTE ») — le centre
 *     Ad & Pro vise la demande, au-dessus du seuil, une fois ; la pièce n'a pas une seconde porte.
 *   • Il est composé sous DÉLÉGATION de la demande (le demandeur n'engage pas la société à titre
 *     personnel), au nom de la société DE LA DEMANDE — jamais de celle de qui clique.
 *
 * Hors d'un fichier « use server » : l'auteur est un argument, ce n'est pas une action d'écran
 * (§118.153). L'appelant a vérifié QUI peut générer, et l'état du poste ; ce module relit les devis dans
 * l'appelant (sous la file du poste) et refuse ce qui ne se compose pas.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

export interface PosteAGenerer {
  item: { id: string; label: string; kind: AdProItemKind; supplier: string | null; amountGranted: number | null };
  /** La référence de l'opération (« SPO-2026-014 ») ou le nom du congrès. */
  ref: string;
  /** La société DE LA DEMANDE — celle qui commande. */
  societe: string;
}

export interface BCGenere {
  pieceId: string;
  devisPieceId: string;
  reference: string;
  version: number;
  totalTtc: number;
  /** Vrai quand le BC existait et vient d'être RÉVISÉ (même numéro, version suivante). */
  regenere: boolean;
  /** La réserve qui accompagne un BC pas encore validé (« attend le centre… »). */
  reserve: string | null;
}

export interface BilanGeneration {
  bcs: BCGenere[];
  echecs: string[];
}

/** Le fournisseur tel que le BC l'imprime : la fiche de l'annuaire quand le devis la désigne, sinon le nom seul. */
export async function tiersDuDevis(d: Pick<DevisDePosteVue, "fournisseurId" | "fournisseur">, itemSupplier: string | null) {
  if (d.fournisseurId) {
    const f = await prisma.companyContact.findUnique({
      where: { id: d.fournisseurId },
      select: { name: true, address: true, city: true, wilaya: true, rc: true, nif: true, rib: true, phone: true, email: true },
    });
    if (f) {
      const adresse = [f.address, [f.city, f.wilaya].filter(Boolean).join(", ")].filter((x) => x && x.trim()).join("\n") || null;
      return { ok: true as const, tiers: { nom: f.name, adresse, rc: f.rc, nif: f.nif, rib: f.rib, telephone: f.phone, email: f.email }, annuaire: true };
    }
  }
  const nom = d.fournisseur?.trim() || itemSupplier?.trim() || "";
  if (!nom) {
    return { ok: false as const, error: "Le fournisseur de ce devis n'est pas nommé : renseignez-le sur le devis (il donne son nom, son adresse, son RC et son NIF au bon de commande)." };
  }
  return { ok: true as const, tiers: { nom }, annuaire: false };
}

/** Les lignes de la vue, dans la forme que lit le module pur : seule la validation POUR CE POSTE compte pour composer le BC. */
function lignesPures(d: DevisDePosteVue, itemId: string): LigneDevisPoste[] {
  return d.lignes.map((l) => ({
    id: l.id, position: l.position, reference: l.reference, unit: l.unit, quantity: l.quantity, unitPrice: l.unitPrice,
    lue: l.lue, aVerifier: l.aVerifier, validatedItemId: l.validee ? itemId : null, bcId: null,
  }));
}

/** Les lignes du BC d'un devis POUR UN POSTE — la lecture que la carte, la génération et le contrôle du montant partagent. */
export function lignesDuBCDuDevis(d: DevisDePosteVue, itemId: string) {
  return lignesDuBon(d.entete, lignesPures(d, itemId), itemId);
}

/** Le montant TTC que les lignes validées de TOUS les devis du poste totalisent — pour le plafond du montant accordé. */
export function totalValideDuPoste(devis: readonly DevisDePosteVue[]): number {
  return devis.filter((d) => !d.annule).reduce((s, d) => s + Math.round(d.totalValideTtc * 100), 0) / 100;
}

/** Le refus de dépassement, lu par l'action ET par la carte. */
export function refusMontantDuPoste(devis: readonly DevisDePosteVue[], accorde: number | null): string | null {
  return refusDepassement(totalValideDuPoste(devis), accorde);
}

/**
 * ÉCRIRE LE LIEN LIGNES ↔ BC. Les lignes validées pour ce poste dans ce devis sont couvertes par ce BC ; celles que
 * ce BC portait et qui ne sont plus validées pour ce poste ne le sont plus. Deux écritures conditionnelles : une ligne
 * revalidée ou retirée entre-temps par un autre geste n'est jamais recouverte (§118.187).
 */
async function lierLesLignes(devisPieceId: string, itemId: string, bcId: string): Promise<void> {
  await prisma.adProDevisLigne.updateMany({
    where: { devis: { legalDocumentId: devisPieceId }, validatedItemId: itemId, OR: [{ bcId: null }, { bcId: { not: bcId } }] },
    data: { bcId },
  });
  await prisma.adProDevisLigne.updateMany({
    where: { devis: { legalDocumentId: devisPieceId }, bcId, OR: [{ validatedItemId: null }, { validatedItemId: { not: itemId } }] },
    data: { bcId: null },
  });
}

/**
 * GÉNÈRE (ou RÉVISE) le bon de commande de chaque devis demandé. Chaque devis passe par SA file (un geste à la fois
 * sur ses lignes) et est RELU dans la file : ce que la carte avait vu a pu changer — une ligne décochée, un BC annulé
 * entre-temps. Un devis dont l'état n'est plus ni « à générer » ni « à régénérer » n'est PAS touché et ne fait pas
 * d'erreur : il est écarté, et le bilan ne le compte pas. Chaque devis est isolé : l'échec de l'un est dit sans empêcher
 * les autres.
 */
export async function genererLesBCsDuPoste(user: CurrentUser, poste: PosteAGenerer, pieceIds: readonly string[]): Promise<BilanGeneration> {
  const bilan: BilanGeneration = { bcs: [], echecs: [] };
  const objet = `${ITEM_KIND_LABELS[poste.item.kind]} : ${poste.item.label} — ${poste.ref}`;
  for (const pieceId of pieceIds) {
    await enSerie(`ad-pro-devis:${pieceId}`, async () => {
      const d = ((await devisDesPostes([poste.item.id])).get(poste.item.id) ?? []).find((x) => x.pieceId === pieceId && !x.annule);
      if (!d) { bilan.echecs.push("un devis n'est plus rattaché à ce poste"); return; }
      const nom = d.reference?.trim() || d.titre;
      const lignes = lignesDuBCDuDevis(d, poste.item.id);
      if (d.etat !== "A_GENERER" && d.etat !== "A_REGENERER") {
        if (d.refus) bilan.echecs.push(`${nom} : ${d.refus}`);
        return;
      }
      if (lignes.length === 0) { bilan.echecs.push(`${nom} : aucune ligne validée`); return; }
      const delegation = `${poste.ref} — poste « ${poste.item.label} » validé et son bon de commande demandé, composé d'après les lignes validées du devis « ${nom} »`;
      if (d.etat === "A_REGENERER" && d.bc) {
        const r = await reviserDocumentDrive(user, {
          legalDocumentId: d.bc.id,
          modifications: { lignes },
          motif: `Lignes validées du devis modifiées (${d.nbAjoutees} ajoutée${d.nbAjoutees > 1 ? "s" : ""}, ${d.nbRetirees} retirée${d.nbRetirees > 1 ? "s" : ""}).`,
        }, { delegation });
        if (!r.ok) { bilan.echecs.push(`${nom} : ${r.motif}`); return; }
        await lierLesLignes(d.pieceId, poste.item.id, d.bc.id);
        bilan.bcs.push({ pieceId: d.bc.id, devisPieceId: d.pieceId, reference: r.reference, version: r.version, totalTtc: r.totaux.totalTtc, regenere: true, reserve: r.reserveBonDeCommande ?? null });
        return;
      }
      const t = await tiersDuDevis(d, poste.item.supplier);
      if (!t.ok) { bilan.echecs.push(`${nom} : ${t.error}`); return; }
      const taxes = d.entete.extraTaxRate ? [{ libelle: d.entete.extraTaxLabel ?? "Taxe additionnelle", taux: d.entete.extraTaxRate / 100 }] : null;
      const r = await emettreDocumentDrive(user, {
        type: "BON_DE_COMMANDE",
        societe: poste.societe,
        tiers: t.tiers,
        lignes,
        tvaDefaut: d.entete.tvaRate / 100,
        taxes,
        referenceAmont: d.reference,
        referenceAmontDate: d.entete.quoteDate,
        objet,
        chainFromId: d.pieceId,
        dossier: `Ad & Pro/${poste.ref}`,
      }, { source: { type: "AD_PRO_ITEM", id: poste.item.id }, delegation });
      if (!r.ok) { bilan.echecs.push(`${nom} : ${r.motif}`); return; }
      await rattacherPieceAuPoste({ itemId: poste.item.id, legalDocumentId: r.legalDocumentId, nature: "BON_DE_COMMANDE", acteurId: user.id });
      await lierLesLignes(d.pieceId, poste.item.id, r.legalDocumentId);
      bilan.bcs.push({
        pieceId: r.legalDocumentId, devisPieceId: d.pieceId, reference: r.reference, version: r.version, totalTtc: r.totaux.totalTtc, regenere: false,
        reserve: r.reserveBonDeCommande ?? null,
      });
    });
  }
  return bilan;
}

/** La phrase du bilan — une rédaction pour l'action (et pour Adam le jour où il l'ouvrira). */
export function phraseBilanGeneration(b: BilanGeneration): string {
  const faits = b.bcs.map((x) => `${x.reference}${x.regenere ? ` (révisé, version ${x.version})` : ""} — ${formatDzd(x.totalTtc)} TTC`);
  const reserves = [...new Set(b.bcs.map((x) => x.reserve).filter((x): x is string => Boolean(x)))];
  return `${b.bcs.length} bon${b.bcs.length > 1 ? "s" : ""} de commande ${b.bcs.every((x) => x.regenere) ? "mis à jour" : "généré" + (b.bcs.length > 1 ? "s" : "")} : ${faits.join(" ; ")}.`
    + (b.echecs.length ? ` Non générés : ${b.echecs.join(" ; ")}.` : "")
    + (reserves.length ? ` ${reserves.join(" ")}` : "");
}
