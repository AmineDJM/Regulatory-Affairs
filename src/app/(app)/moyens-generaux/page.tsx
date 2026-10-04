import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { userCan } from "@/lib/rbac";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { CatalogueArticles } from "../demandes/supplies-manager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Moyens généraux — AMD Internal OS" };

/**
 * MOYENS GÉNÉRAUX — LE CATALOGUE D'ARTICLES, ET LUI SEUL (décision de la Direction, 04/10 : « ne
 * laisse que le catalogue d'articles, enlève le reste »).
 *
 * L'écran portait la caisse à deux horizons, le détail des dépenses, le choix du service, et des
 * liens vers l'annuaire et les budgets par département. Ils sont retirés de l'ÉCRAN, rien d'autre :
 * aucune donnée n'est effacée, aucune action serveur n'est supprimée — la caisse, ses remises au
 * centre de paiement et ses rallonges existent toujours, et l'annuaire vit dans « Mon espace ».
 *
 * Le catalogue est le MÊME que celui du Bureau du secrétariat (`CatalogueArticles`) : deux
 * catalogues auraient produit deux vocabulaires, donc des consommations incomparables. Qui a le
 * droit de le modifier le tient ici ; qui ne l'a pas le lit — on n'offre pas un geste que l'action
 * refuserait (§118.83).
 */
export default async function MoyensGenerauxPage() {
  const user = await requireUser();

  // Demander un achat est un geste de tout employé, et il vit dans « Mon espace » : qui n'a pas le
  // module le lit ici, avec le chemin, plutôt qu'une page vide.
  if (!userCan(user, "GENERAL_MEANS", "VIEW")) {
    return (
      <div className="space-y-5">
        <PageHeader
          title="Moyens généraux"
          description="Ce module tient le catalogue d'articles. Vos demandes d'achat, elles, se font depuis « Mon espace »."
        />
        <EmptyState
          icon="ShoppingBasket"
          title="Vos demandes d'achat sont dans « Mon espace »"
          description="Demandez ce dont vous avez besoin pour travailler depuis votre espace — le circuit ne change pas : votre responsable valide, et l'achat suit."
        />
      </div>
    );
  }

  const peutModifier = userCan(user, "GENERAL_MEANS", "UPDATE");
  // Sans le droit de modifier, seuls les articles ACTIFS : un article retiré ne se propose plus, et
  // le montrer « inactif » à qui ne peut rien en faire n'apprend rien.
  const articles = await prisma.officeSupplyArticle.findMany({
    where: peutModifier ? {} : { active: true },
    select: { id: true, name: true, category: true, unit: true, reference: true, estimatedPrice: true, supplierHint: true, active: true, notes: true },
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });
  const lignes = articles.map((a) => ({ ...a, estimatedPrice: a.estimatedPrice ? Number(a.estimatedPrice) : null }));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Moyens généraux — Catalogue d'articles"
        description="Le référentiel des fournitures : les articles proposés dans les demandes d'achat."
      />
      <CatalogueArticles articles={lignes} peutModifier={peutModifier} />
    </div>
  );
}
