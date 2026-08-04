"use server";

import { requireUser } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { searchProducts, type MarketProduct } from "@/lib/market/products";

export interface MarketProductSearchResult {
  ok: boolean;
  products: MarketProduct[];
  total: number;
  error?: string;
}

/**
 * Recherche de produits IQVIA pour l'explorateur de l'Intelligence marché
 * (Business Development). Read-only ; la clé de données reste côté serveur.
 */
export async function searchMarketProducts(input: { q?: string; cls?: string; lab?: string }): Promise<MarketProductSearchResult> {
  const user = await requireUser();
  if (!userCan(user, "BUSINESS_DEVELOPMENT", "VIEW")) return { ok: false, products: [], total: 0, error: "Non autorisé." };
  const res = searchProducts({ q: input.q, cls: input.cls, lab: input.lab, limit: 60 });
  return { ok: true, products: res.products, total: res.total };
}
