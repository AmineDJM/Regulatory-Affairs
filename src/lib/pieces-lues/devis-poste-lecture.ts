import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { annuaireDeLecture, proposerLecture } from "@/lib/pieces-lues/service";
import { lectureDevisPromo } from "@/lib/pieces-lues/prerempli-devis-promo";
import { lignesDepuisLaLecture } from "@/lib/ad-pro/devis-poste";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * L'INGESTION D'UN DEVIS DE POSTE PAR LUNA (§118.206).
 *
 * « Luna doit directement, lors de l'ingestion des devis à l'upload, les rendre mangeables et
 * consommables par la plateforme » (Direction, 05/10). Le devis déposé sur un poste est lu — par Luna
 * quand la lecture par l'IA est ouverte et que la pièce peut sortir de l'ERP, par le moteur local
 * sinon (`proposerLecture`, la même lecture que le devis du matériel promotionnel) — et ce qu'on y
 * lit devient des LIGNES STRUCTURÉES : référence ou désignation, unité, quantité, prix unitaire, plus
 * le fournisseur, la TVA, la taxe additionnelle et le total imprimé.
 *
 * ── CE QUE LA LECTURE PROPOSE, ET CE QU'ELLE NE FAIT JAMAIS ─────────────────────────────────
 *
 *   • Ces lignes sont des PROPOSITIONS : aucune n'est validée. C'est la personne qui, devant le papier,
 *     coche celles qu'elle retient — et seules les lignes cochées entrent dans un bon de commande
 *     (§118.152 i : une proposition n'est jamais un prix de la société).
 *   • Un chiffre illisible n'est JAMAIS deviné : la ligne est écrite sans quantité ou sans prix, dit ce
 *     qu'il faut vérifier, et ne se valide pas tant qu'elle n'est pas complétée.
 *   • Une remise lue n'est pas convertie en prix net ; une devise étrangère ne préremplit aucun montant
 *     (les réserves de `preremplirDevisPromo`, qui parlent ici aussi).
 *   • Une lecture qui échoue — format non lu, fichier vide, IA coupée sans repli — ne fait JAMAIS
 *     échouer le dépôt : le devis est déjà au poste, ses lignes se saisiront à la main. L'échec est
 *     DIT (`raison`), il ne se tait pas : « aucune ligne » sans cause se lirait comme un devis sans ligne.
 *
 * Hors d'un fichier « use server » : ces fonctions reçoivent l'auteur en argument, ce ne sont pas des
 * actions d'écran (§118.153).
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

export interface IngestionDevis {
  ok: true;
  nbLignes: number;
  /** D'où viennent les lignes, dit à la personne (texte natif ou OCR, confiance) — notre code, jamais le document. */
  note: string;
  /** Tout ce qui n'a pas été prérempli, et pourquoi — avec le geste qui reste. */
  reserves: string[];
  /** Pourquoi il n'y a pas de lignes quand il n'y en a pas. */
  sansLignes: string | null;
}

/**
 * LIRE UN DEVIS ET ÉCRIRE CE QU'ON EN A LU. `remplacer` : une relecture remplace les lignes existantes (l'appelant
 * a vérifié qu'aucun bon de commande actif n'en porte). Sans lui, un devis qui a déjà ses lignes n'est pas relu.
 */
export async function ingererDevisDuPoste(i: {
  userId: string; legalDocumentId: string; octets: Buffer; nomFichier: string; remplacer?: boolean;
  /** Faux : pièce confidentielle — rien ne sort de l'ERP (la lecture reste LOCALE). Défaut : vrai, un devis se dépose en pièce interne. */
  sortieCloudPermise?: boolean;
}): Promise<IngestionDevis | { ok: false; raison: string }> {
  try {
    const { annuaireVisible, groupe } = await annuaireDeLecture(i.userId);
    // Le devis d'un poste se dépose en pièce INTERNE : sa sortie vers le modèle est permise, comme le devis d'une agence.
    const r = await proposerLecture({
      user: { id: i.userId }, octets: i.octets, nomFichier: i.nomFichier,
      contexte: { cible: "LEGAL_DOCUMENT", sortieCloudPermise: i.sortieCloudPermise !== false, annuaireVisible, groupe },
    });
    if (!r.ok) return { ok: false, raison: r.error };
    const lecture = lectureDevisPromo(r.proposition, annuaireVisible.map((c) => c.id));
    const p = lecture.prerempli;
    const lignes = lignesDepuisLaLecture(p.lignes);
    const donnees = {
      supplierId: p.fournisseurId,
      // RETRANSCRIRE, JAMAIS DEVINER : la TVA n'est écrite que si le devis l'imprime. Sinon `null` — il n'y a plus
      // de « 19 % par défaut » (c'est lui qui avait fait un TTC de 476 000 pour un devis de 400 000 HT sans TVA).
      tvaRate: p.tvaRate != null ? new Prisma.Decimal(p.tvaRate) : null,
      extraTaxLabel: p.extraTaxRate != null ? p.extraTaxLabel : null,
      extraTaxRate: p.extraTaxRate != null ? new Prisma.Decimal(p.extraTaxRate) : null,
      announcedTotal: p.announcedTotal != null ? new Prisma.Decimal(p.announcedTotal) : null,
      quoteDate: p.quoteDate ? new Date(`${p.quoteDate}T00:00:00.000Z`) : null,
      lectureId: lecture.lectureId,
      lectureNote: lecture.noteMethode.slice(0, 600),
    };
    const ecrites = await prisma.$transaction(async (tx) => {
      const existant = await tx.adProDevis.findUnique({ where: { legalDocumentId: i.legalDocumentId }, select: { id: true, _count: { select: { lignes: true } } } });
      if (existant && existant._count.lignes > 0 && !i.remplacer) return null;
      const devis = existant
        ? await tx.adProDevis.update({ where: { id: existant.id }, data: donnees, select: { id: true } })
        : await tx.adProDevis.create({ data: { ...donnees, legalDocumentId: i.legalDocumentId, createdById: i.userId }, select: { id: true } });
      if (existant) await tx.adProDevisLigne.deleteMany({ where: { devisId: devis.id } });
      if (lignes.length > 0) {
        await tx.adProDevisLigne.createMany({
          data: lignes.map((l) => ({
            devisId: devis.id, position: l.position, reference: l.reference, unit: l.unit, lue: l.lue, aVerifier: l.aVerifier,
            quantity: l.quantity != null ? new Prisma.Decimal(l.quantity) : null,
            unitPrice: l.unitPrice != null ? new Prisma.Decimal(l.unitPrice) : null,
          })),
        });
      }
      return lignes.length;
    });
    if (ecrites === null) return { ok: false, raison: "Ce devis a déjà ses lignes : elles ne sont pas relues sans le dire." };
    return { ok: true, nbLignes: ecrites, note: lecture.noteMethode, reserves: p.reserves, sansLignes: lecture.sansLignes };
  } catch (err) {
    console.error("[devis-poste] lecture impossible", err);
    return { ok: false, raison: "La lecture du devis a échoué (erreur technique) : saisissez ses lignes à la main." };
  }
}

/**
 * LA PHRASE QUI ANNONCE CE QUI A ÉTÉ LU — une rédaction, que l'upload et la relecture disent. Elle nomme la
 * suite : les lignes sont des propositions, et seules les lignes COCHÉES entrent dans un bon de commande.
 */
export function phraseDeLecture(i: IngestionDevis): string {
  const sansPoint = (t: string): string => t.replace(/[.\s]+$/, "");
  if (i.nbLignes === 0) {
    return `Devis lu, mais aucune ligne n'a pu en être tirée${i.sansLignes ? ` (${sansPoint(i.sansLignes)})` : ""} : saisissez ses lignes depuis la carte du poste.`;
  }
  const reserves = i.reserves.length > 0 ? ` À vérifier : ${i.reserves.slice(0, 2).join(" ")}` : "";
  return `Devis lu (${sansPoint(i.note)}) : ${i.nbLignes} ligne${i.nbLignes > 1 ? "s" : ""} proposée${i.nbLignes > 1 ? "s" : ""} — `
    + `comparez-les au papier, puis cochez celles que vous validez : seules les lignes cochées entrent dans un bon de commande.${reserves}`;
}
