import { prisma } from "@/lib/prisma";

export interface StockMovementDTO {
  id: string;
  product: string;
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

/**
 * Suivi des stocks à la PCH. Niveau courant par produit calculé à partir des
 * mouvements : entrée (+), sortie (−), ajustement (+).
 */
export async function getStockData() {
  const rows = await prisma.stockMovement.findMany({ orderBy: { date: "desc" }, take: 2000 });

  const movements: StockMovementDTO[] = rows.map((m) => ({
    id: m.id, product: m.product, dci: m.dci ?? "", direction: m.direction,
    quantity: m.quantity, date: m.date.toISOString(), location: m.location, notes: m.notes ?? "",
  }));

  const map = new Map<string, StockLevel & { _last: Date }>();
  for (const m of rows) {
    const key = `${m.product.toLowerCase()}|${m.location}`;
    const sign = m.direction === "OUT" ? -1 : 1;
    const cur = map.get(key) ?? { product: m.product, dci: m.dci ?? "", balance: 0, location: m.location, lastDate: m.date.toISOString(), _last: m.date };
    cur.balance += sign * m.quantity;
    if (m.date > cur._last) { cur._last = m.date; cur.lastDate = m.date.toISOString(); }
    if (!cur.dci && m.dci) cur.dci = m.dci;
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
