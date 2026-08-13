import { prisma } from "@/lib/prisma";
import { regulatoryLockWhere, type SessionUser } from "@/lib/rbac";

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
  const products = await prisma.regulatoryProduct.findMany({
    where: regulatoryLockWhere(user),
    select: { id: true, brandName: true, dci: true, reference: true },
    orderBy: [{ brandName: "asc" }, { dci: "asc" }],
  });
  return products.map((p) => {
    const name = p.brandName?.trim() || p.dci;
    return { id: p.id, label: p.brandName?.trim() ? `${name} (${p.dci})` : name, dci: p.dci };
  });
}
