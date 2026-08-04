import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireModule } from "@/lib/session";
import { classList, labList } from "@/lib/market/competition";
import { searchProducts } from "@/lib/market/products";
import { PageHeader } from "@/components/shared/page-header";
import { ProductExplorer } from "./product-explorer";

export const dynamic = "force-dynamic";

export default async function MarketProductsPage() {
  await requireModule("BUSINESS_DEVELOPMENT");
  // Listes de filtres + jeu initial (60 plus fortes valeurs) chargés côté serveur ;
  // les recherches suivantes passent par l'action `searchMarketProducts`.
  const classes = classList();
  const labs = labList();
  const initial = searchProducts({ limit: 60 });

  return (
    <div className="space-y-5">
      <Link href="/business-development/marche" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Intelligence marché
      </Link>
      <PageHeader
        title="Explorateur produits"
        description="Recherchez et filtrez les produits du marché (IQVIA ville), sélectionnez-en un ou plusieurs et comparez volume, valeur (DZD/USD), prix unitaire moyen et croissance N-1."
      />
      <ProductExplorer classes={classes} labs={labs} initial={initial.products} initialTotal={initial.total} />
    </div>
  );
}
