import { userCan, type SessionUser, type Module } from "@/lib/rbac";

/**
 * QUI VOIT QUELLE FACETTE D'UNE VUE 360° — une section par module : elle n'apparaît qu'à qui a le droit de VOIR ce
 * module. Léger (il ne lit que les droits) : le menu, les pages et les tests lisent la même règle.
 */
export const SECTIONS_360 = {
  reglementaire: "REGULATORY", marches: "PCH", ventes: "SALES", segmentation: "SEGMENTATION",
  consommation: "CONSUMPTION", finances: "FINANCES", terrain: "MEDICAL", forceDeVente: "SALES_PLANNING", adpro: "SPONSORING",
} as const satisfies Record<string, Module>;
export type Section360 = keyof typeof SECTIONS_360;

export function sections360(user: SessionUser): Record<Section360, boolean> {
  return Object.fromEntries(Object.entries(SECTIONS_360).map(([k, m]) => [k, userCan(user, m, "VIEW")])) as Record<Section360, boolean>;
}
