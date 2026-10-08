import { redirect } from "next/navigation";
import { requireModule } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { ModuleTabs } from "@/components/shared/module-tabs";
import { EmptyState } from "@/components/shared/empty-state";
import { InfoBulle } from "@/components/ui/info-bulle";
import { CHEMIN_STOCKS, ongletsStocks } from "@/lib/chemins/stocks";
import { chargerHistoriquePch, chargerProduitsPch, saisitLeStockPch, voitLaChaine } from "@/lib/queries/stock-pch";
import { SaisieStockPch } from "./saisie-stock-pch";

export const dynamic = "force-dynamic";
export const metadata = { title: "Stock PCH central — AMD Internal OS" };

/**
 * LE STOCK PCH CENTRAL, SAISI À LA MAIN (Direction, 08/10 : « reçus par mail ») — la date du mail, les quantités de nos
 * produits par BU (central ou une annexe / DR), « Coller le tableau » depuis Excel ou le texte du mail, le mail joint,
 * et l'historique de chaque produit. Réservé à la chaîne d'approvisionnement, comme l'onglet PCH des relevés.
 */
export default async function StockPchCentralPage() {
  const user = await requireModule("STOCKS");
  if (!voitLaChaine(user)) redirect(CHEMIN_STOCKS);
  const produits = await chargerProduitsPch(user);
  const [historique, annexes] = await Promise.all([
    chargerHistoriquePch(user, [...new Set(produits.map((p) => p.id))]),
    prisma.stockAnnex.findMany({ where: { kind: "ANNEX" }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <div className="space-y-4">
      <ModuleTabs tabs={ongletsStocks(true)} />
      <PageHeader title="Stock PCH central" description="Saisi depuis le mail de la PCH, par date">
        <InfoBulle>
          Saisissez les quantités à la date du mail (ou collez le tableau reçu), joignez le mail ou le PDF, puis
          enregistrez. Ressaisir la même date corrige. Une annexe / DR se choisit au besoin. Un relevé de plus de 30
          jours passe en orange.
        </InfoBulle>
      </PageHeader>
      {produits.length === 0 ? (
        <EmptyState icon="Boxes" title="Aucun produit" description="Les produits des Business Units (avec leur dossier) apparaissent ici." />
      ) : (
        <SaisieStockPch
          produits={produits.map((p) => ({ id: p.id, label: p.label, buId: p.buId, buNom: p.buNom, noms: p.noms }))}
          annexes={annexes}
          etats={historique.etats}
          releves={historique.releves}
          peutSaisir={saisitLeStockPch(user)}
        />
      )}
    </div>
  );
}
