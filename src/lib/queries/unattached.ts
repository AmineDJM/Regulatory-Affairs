import { prisma } from "@/lib/prisma";

/**
 * CE QUI N'APPARTIENT ENCORE À AUCUNE ENTITÉ.
 *
 * Depuis que la portée est stricte — « je choisis Adventum, je vois Adventum » — un objet sans
 * entité ne s'affiche plus dans aucune vue cloisonnée. Il n'est pas perdu (la vue « toutes les
 * entités » n'applique aucun filtre), mais il est invisible pour un salarié mono-entité, et
 * personne ne cherche ce qu'il ne sait pas manquant.
 *
 * Cet inventaire est donc la contrepartie de la règle stricte : il DIT ce qui reste à rattacher,
 * table par table, avec un chemin pour le faire. Sans lui, la stricte séparation se paierait en
 * travail devenu introuvable.
 */

export interface UnattachedGroup {
  /** Nom lisible du type d'objet. */
  label: string;
  /** Modèle Prisma — sert de clé au rattachement en masse. */
  model: string;
  count: number;
  /** Où aller les corriger, quand un écran le permet. */
  href: string | null;
}

/**
 * Les tables inventoriées : celles qui portent une entité ET dont l'absence se voit à l'usage.
 * Les référentiels (départements, seuils, accès) sont volontairement absents — leur entité est
 * une propriété de structure, pas la trace d'une action.
 */
const TABLES: { label: string; model: string; href: string | null; count: () => Promise<number> }[] = [
  { label: "Dossiers réglementaires", model: "regulatoryProduct", href: "/regulatory", count: () => prisma.regulatoryProduct.count({ where: { companyId: null } }) },
  { label: "Demandes administratives", model: "administrativeRequest", href: "/demandes", count: () => prisma.administrativeRequest.count({ where: { companyId: null } }) },
  { label: "Sponsoring", model: "sponsoringRequest", href: "/sponsoring", count: () => prisma.sponsoringRequest.count({ where: { companyId: null } }) },
  { label: "Prises en charge internationales", model: "congressInternational", href: "/congress-international", count: () => prisma.congressInternational.count({ where: { companyId: null } }) },
  { label: "Prises en charge nationales", model: "congressNational", href: "/congress-national", count: () => prisma.congressNational.count({ where: { companyId: null } }) },
  { label: "Événements", model: "event", href: "/events", count: () => prisma.event.count({ where: { companyId: null } }) },
  { label: "Matériel promotionnel", model: "promoMaterial", href: "/promo-material", count: () => prisma.promoMaterial.count({ where: { companyId: null } }) },
  { label: "Stock promotionnel", model: "promoStockItem", href: "/promo-material/stock", count: () => prisma.promoStockItem.count({ where: { companyId: null } }) },
  { label: "Enveloppes budgétaires", model: "budgetEnvelope", href: "/budgets/reglages", count: () => prisma.budgetEnvelope.count({ where: { companyId: null } }) },
  { label: "Mouvements de trésorerie", model: "financeTransaction", href: "/finances", count: () => prisma.financeTransaction.count({ where: { companyId: null } }) },
  { label: "Ordres de dépense", model: "expenseOrder", href: "/finances/paiements-a-faire", count: () => prisma.expenseOrder.count({ where: { companyId: null } }) },
  { label: "Praticiens (annuaire)", model: "medicalDoctor", href: "/medical/annuaire", count: () => prisma.medicalDoctor.count({ where: { companyId: null } }) },
  { label: "Rapports terrain", model: "fieldReport", href: "/field-reports", count: () => prisma.fieldReport.count({ where: { companyId: null } }) },
  { label: "Information médicale", model: "medicalInfoDeclaration", href: "/information-medicale", count: () => prisma.medicalInfoDeclaration.count({ where: { companyId: null } }) },
  { label: "Marchés PCH", model: "pchTender", href: "/pch", count: () => prisma.pchTender.count({ where: { companyId: null } }) },
  { label: "Commandes logistiques", model: "logisticsOrder", href: "/logistics", count: () => prisma.logisticsOrder.count({ where: { companyId: null } }) },
  { label: "Ventes", model: "sale", href: "/sales", count: () => prisma.sale.count({ where: { companyId: null } }) },
  { label: "Projets", model: "dossier", href: "/dossiers", count: () => prisma.dossier.count({ where: { companyId: null } }) },
  { label: "Demandes de support", model: "supportRequest", href: "/support", count: () => prisma.supportRequest.count({ where: { companyId: null } }) },
  { label: "Formations", model: "training", href: null, count: () => prisma.training.count({ where: { companyId: null } }) },
];

/** L'inventaire, tables vides écartées : on ne montre que ce qu'il reste à faire. */
export async function getUnattachedInventory(): Promise<{ groups: UnattachedGroup[]; total: number }> {
  const counts = await Promise.all(TABLES.map(async (t) => ({ ...t, count: await t.count().catch(() => 0) })));
  const groups = counts
    .filter((c) => c.count > 0)
    .map(({ label, model, count, href }) => ({ label, model, count, href }))
    .sort((a, b) => b.count - a.count);
  return { groups, total: groups.reduce((a, g) => a + g.count, 0) };
}

/** Les modèles rattachables en masse — bornés à cette liste, jamais à une chaîne reçue. */
export const ATTACHABLE_MODELS = TABLES.map((t) => t.model);
