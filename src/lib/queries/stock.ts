import { prisma } from "@/lib/prisma";

export interface StockMovementDTO {
  id: string;
  product: string;
  productId: string | null;
  dci: string;
  direction: string;
  quantity: number;
  date: string;
  location: string;
  notes: string;
}

export interface StockLevel {
  product: string;
  dci: string;
  balance: number;
  location: string;
  lastDate: string;
}

export interface ProductOption {
  id: string;
  label: string;
  dci: string;
}

/** Produits du catalogue Regulatory, proposés pour rattacher un mouvement de stock. */
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

/**
 * Suivi des stocks à la PCH. Niveau courant par produit calculé à partir des
 * mouvements : entrée (+), sortie (−), ajustement (+). Lorsqu'un mouvement est
 * rattaché à un produit Regulatory, on affiche le libellé courant du catalogue.
 */
export async function getStockData() {
  const rows = await prisma.stockMovement.findMany({
    orderBy: { date: "desc" },
    take: 2000,
    include: { productRef: { select: { brandName: true, dci: true } } },
  });

  const nameOf = (m: (typeof rows)[number]) => m.productRef?.brandName?.trim() || m.productRef?.dci || m.product;
  const dciOf = (m: (typeof rows)[number]) => m.productRef?.dci || m.dci || "";

  const movements: StockMovementDTO[] = rows.map((m) => ({
    id: m.id, product: nameOf(m), productId: m.productId, dci: dciOf(m), direction: m.direction,
    quantity: m.quantity, date: m.date.toISOString(), location: m.location, notes: m.notes ?? "",
  }));

  const map = new Map<string, StockLevel & { _last: Date }>();
  for (const m of rows) {
    const name = nameOf(m);
    const key = `${m.productId ?? name.toLowerCase()}|${m.location}`;
    const sign = m.direction === "OUT" ? -1 : 1;
    const cur = map.get(key) ?? { product: name, dci: dciOf(m), balance: 0, location: m.location, lastDate: m.date.toISOString(), _last: m.date };
    cur.balance += sign * m.quantity;
    if (m.date > cur._last) { cur._last = m.date; cur.lastDate = m.date.toISOString(); }
    if (!cur.dci && dciOf(m)) cur.dci = dciOf(m);
    map.set(key, cur);
  }
  const levels: StockLevel[] = [...map.values()]
    .map(({ _last, ...l }) => l)
    .sort((a, b) => a.product.localeCompare(b.product));

  return {
    movements,
    levels,
    stats: {
      products: levels.length,
      totalUnits: levels.reduce((a, l) => a + Math.max(0, l.balance), 0),
      negative: levels.filter((l) => l.balance < 0).length,
    },
  };
}
