import { prisma } from "@/lib/prisma";

export interface ProductOption {
  id: string;
  label: string;
  dci: string;
}

/**
 * Produits du catalogue Regulatory proposés pour un état de stock. On ne garde que les produits
 * dont la **décision d'enregistrement est obtenue** (`status = DECISION_OBTAINED`) : un stock ne se
 * suit que pour un produit réellement enregistré, pas pour un dossier encore en cours d'instruction.
 */
export async function getProductOptions(): Promise<ProductOption[]> {
  const products = await prisma.regulatoryProduct.findMany({
    where: { status: "DECISION_OBTAINED" },
    select: { id: true, brandName: true, dci: true, reference: true },
    orderBy: [{ brandName: "asc" }, { dci: "asc" }],
  });
  return products.map((p) => {
    const name = p.brandName?.trim() || p.dci;
    return { id: p.id, label: p.brandName?.trim() ? `${name} (${p.dci})` : name, dci: p.dci };
  });
}
