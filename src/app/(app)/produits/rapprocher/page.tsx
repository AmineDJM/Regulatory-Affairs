import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireModule } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { BackLink } from "@/components/shared/back-link";
import { InfoBulle } from "@/components/ui/info-bulle";
import { getCatalogReconciliation } from "@/lib/queries/product-catalog";
import { ReconcileTable } from "./reconcile-table";

export const dynamic = "force-dynamic";
export const metadata = { title: "Rapprocher un produit BD / BU — AMD Internal OS" };

/**
 * RAPPROCHER UN PRODUIT BD / BU — le seul reste de l'ancien « Rattachement au catalogue » (Direction, 08/10).
 *
 * Chaque dossier EST un produit, d'office : il n'y a plus de dossier à rattacher. Restent les produits créés SANS
 * dossier — au Business Development (à l'étude) ou dans une Business Unit : la machine propose le dossier qui leur
 * ressemble et dit pourquoi, une personne tranche (un 500 mg et un 1 g partagent molécule et nom). Rattaché à son
 * dossier, le produit BD / BU reçoit le produit du dossier — et peut alors être rapporté en visite.
 *
 * Déclarer qu'un produit en est un autre est une décision réglementaire : réservé à qui modifie Regulatory.
 */
export default async function RapprocherProduitsPage() {
  const user = await requireModule("PRODUCTS");
  if (!userCan(user, "REGULATORY", "UPDATE")) redirect("/produits");
  const data = await getCatalogReconciliation(user);

  return (
    <div className="space-y-4">
      <BackLink href="/produits">
        <ArrowLeft className="h-4 w-4" /> Produits 360
      </BackLink>
      <div className="min-w-0 space-y-1">
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight sm:text-2xl">
          Rapprocher un produit BD / BU
          <InfoBulle label="Pourquoi rapprocher ?">
            Un produit du Business Development ou d&apos;une Business Unit créé sans dossier réglementaire n&apos;est relié à aucun produit :
            il ne peut pas être rapporté en visite. Rattaché à son dossier, il en reçoit le produit. La proposition explique sa raison ;
            c&apos;est vous qui tranchez — un dosage différent est un produit différent.
          </InfoBulle>
        </h1>
        <p className="text-sm text-muted-foreground">
          {data.orphans.length} à rapprocher · {data.linked.length} déjà rapproché{data.linked.length > 1 ? "s" : ""}
        </p>
      </div>
      <ReconcileTable data={data} canLink />
    </div>
  );
}
