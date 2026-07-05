import { prisma } from "@/lib/prisma";

export interface ProductOption {
  id: string;
  label: string;
  dci: string;
}

/** Produits du catalogue Regulatory, proposés pour rattacher un état de stock. */
export async function getProductOptions(): Promise<ProductOption[]> {
  const products = await prisma.regulatoryProduct.findMany({
    select: { id: true, brandName: true, dci: true, reference: true },
    orderBy: [{ brandName: "asc" }, { dci: "asc" }],
  });
  return products.map((p) => {
    const name = p.brandName?.trim() || p.dci;
    return { id: p.id, label: p.brandName?.trim() ? `${name} (${p.dci})` : name, dci: p.dci };
  });
}
