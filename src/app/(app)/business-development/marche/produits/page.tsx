import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireModule } from "@/lib/session";
import { searchProducts, productFilterOptions } from "@/lib/market/products";
import { PageHeader } from "@/components/shared/page-header";
import { ProductExplorer } from "./product-explorer";

export const dynamic = "force-dynamic";

export default async function MarketProductsPage() {
  await requireModule("BUSINESS_DEVELOPMENT");
  // Listes de filtres (UNION ville + hôpital) + jeu initial (60 plus fortes valeurs) chargés
  // côté serveur ; les recherches suivantes passent par l'action `searchMarketProducts`.
  const { classes } = productFilterOptions();
  const initial = searchProducts({ limit: 60 });

  return (
    <div className="space-y-5">
      <Link href="/business-development/marche" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Intelligence marché
      </Link>
      <PageHeader
        title="Explorateur produits"
        description="Cherchez par MOLÉCULE, par nom de produit ou par laboratoire — selon la case que vous remplissez. Une recherche par molécule ouvre en plus l'analyse concurrentielle : poids du marché, partage ville / hôpital, part de marché de chaque acteur et production locale ou importée."
      />
      <ProductExplorer classes={classes} initial={initial.products} initialTotal={initial.total} />
    </div>
  );
}
