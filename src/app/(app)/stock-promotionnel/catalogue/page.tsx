import { requireModule } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { ModuleTabs } from "@/components/shared/module-tabs";
import { visibleTabs } from "@/lib/nav-tabs";
import { STOCK_PROMO_TABS } from "@/lib/labels";
import type { PromoFamille } from "@/lib/promo/catalogue";
import { CatalogueEcran, type ArticleCatalogueVue } from "./catalogue-ecran";

export const dynamic = "force-dynamic";

/**
 * LE CATALOGUE DU MATÉRIEL PROMOTIONNEL (§118.164, §118.173) — les SUPPORTS, triés en trois
 * familles, sous les références fixes CAT-0001… que citent les demandes, les stocks, les BC et les
 * factures. « Ce sont les supports déjà créés qui sont le catalogue » : la migration du §118.173 y
 * a posé la liste des natures de support ; on en ajoute ensuite depuis cet écran.
 *
 * « Le super administrateur a un catalogue de matériel promotionnel. Il peut l'ouvrir en édition
 * ou en lecture à qui il veut dans la société. » Le module `PROMO_CATALOG` est au seul Super Admin
 * par défaut ; il l'ouvre personne par personne dans Administration › Accès. Les droits viennent
 * de la même lecture que les actions (`userCan`) : un bouton que l'action refuse n'est pas un
 * bouton.
 */
export default async function PromoCataloguePage() {
  const user = await requireModule("PROMO_CATALOG");
  const sa = user.role === "SUPER_ADMIN";
  const [lignes, usages, tabs] = await Promise.all([
    prisma.promoCatalogueArticle.findMany({
      orderBy: [{ actif: "desc" }, { reference: "asc" }],
      select: { id: true, reference: true, nom: true, famille: true, description: true, exigeProduit: true, actif: true },
    }),
    prisma.promoStockItem.groupBy({ by: ["catalogueId"], _count: { _all: true } }),
    visibleTabs(user, STOCK_PROMO_TABS),
  ]);
  const compte = new Map(usages.map((u) => [u.catalogueId, u._count._all]));
  const articles: ArticleCatalogueVue[] = lignes.map((l) => ({
    id: l.id, reference: l.reference, nom: l.nom, famille: l.famille as PromoFamille,
    description: l.description, exigeProduit: l.exigeProduit, actif: l.actif,
    articlesDeStock: compte.get(l.id) ?? 0,
  }));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Catalogue promotionnel"
        description="Les supports qu'on peut commander, rangés en trois familles, sous une référence qui ne change plus. Le stock les spécialise par produit et par société."
      />
      <ModuleTabs tabs={tabs} />
      <CatalogueEcran
        articles={articles}
        droits={{
          creer: sa || userCan(user, "PROMO_CATALOG", "CREATE"),
          modifier: sa || userCan(user, "PROMO_CATALOG", "UPDATE"),
          supprimer: sa,
        }}
      />
    </div>
  );
}
