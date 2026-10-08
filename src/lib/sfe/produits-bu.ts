import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * LES DOSSIERS QU'ON PEUT AJOUTER À UNE BUSINESS UNIT — la clause de la LISTE de l'écran ET celle
 * de l'ACTION (§118.177 : une liste, une clause). L'écran ne proposait que les dossiers non
 * verrouillés ; l'action, elle, acceptait n'importe quel identifiant : un dossier du pipeline,
 * deviné, devenait un produit de BU portant son nom et sa DCI (§118.178).
 */
export const DOSSIERS_PROPOSABLES_BU = { isLocked: false } satisfies Prisma.RegulatoryProductWhereInput;

/**
 * LES PRODUITS QU'UNE VISITE PEUT PORTER — ceux de la Business Unit de celui qui la fait.
 *
 * ── POURQUOI CE MODULE EXISTE ─────────────────────────────────────────────────────────────
 *
 * Trois portes enregistrent une visite FAITE : le rapport d'une visite planifiée, la visite
 * imprévue, et la saisie rapide de « Ma journée » (que l'opération `log_visit` d'Adam appelle
 * telle quelle). Les deux premières n'acceptaient que les produits de la BU du KAM ; la troisième
 * acceptait n'importe quel produit canonique. Une règle tenue à deux portes sur trois est une
 * règle qu'on contourne par la troisième (§118.71) : l'effort par produit d'une BU se serait
 * retrouvé crédité d'un produit qu'elle ne porte pas. La règle vit donc ICI, une fois, et les
 * trois portes la lisent.
 *
 * ── POURQUOI CE N'EST PAS DANS LE FICHIER D'ACTIONS ──────────────────────────────────────────
 *
 * Tout ce qu'exporte un fichier `"use server"` est un point d'entrée public : une fonction qui
 * reçoit un identifiant de personne y deviendrait une lecture de la gamme de n'importe qui
 * (§118.153). Ce module est un module serveur ordinaire.
 */

export interface ProduitsDeLaBu {
  /** La personne est-elle rattachée à une Business Unit ? Sans elle, aucun produit n'est admis. */
  rattache: boolean;
  /** Les produits CANONIQUES admis (identifiants `Product`). */
  admis: Set<string>;
  /**
   * Les produits promus de sa gamme qui n'ont PAS de produit canonique : ils ne peuvent pas
   * figurer dans un rapport, et on le DIT plutôt que de les laisser disparaître en silence
   * après que le KAM les a cochés (§118.71).
   */
  sansCanonique: string[];
}

export async function produitsDeLaBu(repId: string): Promise<ProduitsDeLaBu> {
  const profil = await prisma.salesRepProfile.findUnique({
    where: { repId },
    select: { businessUnitId: true },
  });
  if (!profil?.businessUnitId) return { rattache: false, admis: new Set(), sansCanonique: [] };
  const promus = await prisma.promoProduct.findMany({
    where: { businessUnitId: profil.businessUnitId, isActive: true },
    select: { name: true, productId: true },
  });
  return {
    rattache: true,
    admis: new Set(promus.map((p) => p.productId).filter((x): x is string => Boolean(x))),
    sansCanonique: promus.filter((p) => !p.productId).map((p) => p.name),
  };
}

/**
 * LE REFUS, une seule rédaction pour les trois portes — deux rédactions du même refus finiraient
 * par dire deux choses différentes (§118.5).
 *
 * Il nomme le REMÈDE selon la cause : quelqu'un sans Business Unit n'a pas « choisi le mauvais
 * produit », il n'a aucune gamme — et le geste qui débloque est un rattachement, pas un autre clic
 * dans la liste (§118.30).
 */
export function refusProduitsHorsBu(
  horsBu: number,
  p: ProduitsDeLaBu,
  sujet: "vous" | "ce KAM",
): string {
  if (!p.rattache) {
    return sujet === "vous"
      ? "Vous n'êtes rattaché à aucune Business Unit : une visite ne porte que les produits de sa gamme. "
        + "Le rattachement se fait dans Business Units."
      : "Ce KAM n'est rattaché à aucune Business Unit : une visite ne porte que les produits de sa gamme. "
        + "Le rattachement se fait dans Business Units.";
  }
  const base = sujet === "vous"
    ? `${horsBu} produit(s) hors de votre gamme — une visite ne porte que les produits de votre Business Unit.`
    : `${horsBu} produit(s) ne sont pas dans la gamme de ce KAM — un rapport ne porte que les produits de sa Business Unit.`;
  return base + (p.sansCanonique.length > 0
    ? ` À noter : ${p.sansCanonique.length} produit(s) promu(s) de la gamme (${p.sansCanonique.slice(0, 3).join(", ")}) `
      + "ne sont rattachés à aucun dossier réglementaire et ne peuvent donc pas figurer dans un rapport — "
      + "à rapprocher dans Produits 360 (⋯ › « Rapprocher un produit BD / BU »)."
    : "");
}
