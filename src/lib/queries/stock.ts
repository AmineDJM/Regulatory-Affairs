import { prisma } from "@/lib/prisma";
import { regulatoryLockWhere, type SessionUser } from "@/lib/rbac";
import { FINISHED_REG_STATUSES } from "@/lib/regulatory/stage";

export interface ProductOption {
  id: string;
  label: string;
  dci: string;
}

/**
 * Produits du catalogue Regulatory proposés pour un état de stock. **Tous** les produits Regulatory
 * sont proposés (quel que soit leur statut d'enregistrement) : on peut saisir un état de stock pour
 * n'importe quel produit du catalogue — **sauf les dossiers verrouillés**, qu'un sélecteur de
 * produits nommerait aussi sûrement qu'un tableau.
 */
export async function getProductOptions(user: SessionUser | null = null): Promise<ProductOption[]> {
  // SEULS LES PRODUITS DONT LE TRAITEMENT EST TERMINÉ. On ne tient pas de stock d'un produit
  // qui n'est pas enregistré : le proposer fait saisir des relevés sur un produit qui n'existe
  // pas encore commercialement, et ces lignes-là ne se corrigent jamais.
  const products = await prisma.regulatoryProduct.findMany({
    where: { ...regulatoryLockWhere(user), status: { in: [...FINISHED_REG_STATUSES] } },
    select: { id: true, brandName: true, dci: true, reference: true },
    orderBy: [{ brandName: "asc" }, { dci: "asc" }],
  });
  return products.map((p) => {
    const name = p.brandName?.trim() || p.dci;
    return { id: p.id, label: p.brandName?.trim() ? `${name} (${p.dci})` : name, dci: p.dci };
  });
}
