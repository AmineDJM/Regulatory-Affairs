import { redirect } from "next/navigation";
import { requireModule } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { ModuleTabs } from "@/components/shared/module-tabs";
import { EmptyState } from "@/components/shared/empty-state";
import { InfoBulle } from "@/components/ui/info-bulle";
import { CHEMIN_STOCKS, ongletsStocks } from "@/lib/chemins/stocks";
import { chargerDirectionsPch, chargerHistoriquePch, chargerProduitsPch, saisitLeStockPch, voitLaChaine } from "@/lib/queries/stock-pch";
import { SaisieStockPch } from "./saisie-stock-pch";

export const dynamic = "force-dynamic";
export const metadata = { title: "Stock PCH central — AMD Internal OS" };

/**
 * LE STOCK PCH (CENTRAL ET DIRECTIONS RÉGIONALES), SAISI À LA MAIN (Direction, 08/10 : « reçus par mail » ; 10/2026 : les
 * stocks Adventum viennent de la PCH et des hôpitaux) — la date du mail, les quantités de nos produits par BU pour la PCH
 * centrale ou une DR (DRA, DRB, DRBE, DRC, DRO, DRTAM), « Coller le tableau » ou « Importer le fichier » (Excel / CSV), le mail
 * joint, et l'historique de chaque produit par lieu. Réservé à la chaîne d'approvisionnement, comme l'onglet PCH des relevés.
 */
export default async function StockPchCentralPage() {
  const user = await requireModule("STOCKS");
  if (!voitLaChaine(user)) redirect(CHEMIN_STOCKS);
  const produits = await chargerProduitsPch(user);
  const [historique, annexes, directions] = await Promise.all([
    chargerHistoriquePch(user, [...new Set(produits.map((p) => p.id))]),
    prisma.stockAnnex.findMany({ where: { kind: "ANNEX" }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    chargerDirectionsPch(),
  ]);

  return (
    <div className="space-y-4">
      <ModuleTabs tabs={ongletsStocks(true)} />
      <PageHeader title="Stock PCH" description="PCH centrale et directions régionales, par date de relevé">
        <InfoBulle>
          Les stocks viennent de deux sources : la PCH (centrale et directions régionales, ici) et les hôpitaux (relevés
          des KAM, onglet Demandes de stocks). Choisissez le lieu, saisissez les quantités à la date du mail — ou collez le
          tableau, ou importez le fichier Excel / CSV : le produit se retrouve par son code PCH ou sa désignation, la
          direction par sa colonne ou son onglet — puis joignez le mail et enregistrez. Ressaisir la même date corrige. Un
          relevé de plus de 30 jours passe en orange.
        </InfoBulle>
      </PageHeader>
      {produits.length === 0 ? (
        <EmptyState icon="Boxes" title="Aucun produit" description="Les produits des Business Units (avec leur dossier) apparaissent ici." />
      ) : (
        <SaisieStockPch
          produits={produits.map((p) => ({ id: p.id, label: p.label, buId: p.buId, buNom: p.buNom, noms: p.noms }))}
          directions={directions}
          annexes={annexes}
          etats={historique.etats}
          releves={historique.releves}
          peutSaisir={saisitLeStockPch(user)}
        />
      )}
    </div>
  );
}
