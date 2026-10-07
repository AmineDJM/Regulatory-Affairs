import { redirect } from "next/navigation";

/**
 * L'ANCIEN ÉCRAN « RATTACHEMENT AU CATALOGUE » — retiré (Direction, 08/10 : « on a dit : un seul catalogue de
 * produits ! »). Chaque dossier EST un produit (`products/canonique.ts`, `ensureProduitDuDossier`) : il n'y a plus
 * rien à rattacher. Le catalogue est Produits 360 ; le rapprochement d'un produit BD / BU créé sans dossier y vit
 * (menu ⋯ › « Rapprocher un produit BD / BU »). L'adresse reste, pour les liens et favoris d'avant.
 */
export default function AncienCatalogue() {
  redirect("/produits");
}
