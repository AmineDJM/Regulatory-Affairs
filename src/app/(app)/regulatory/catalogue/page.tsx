import { ArrowLeft } from "lucide-react";
import { requireModule } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { PageHeader } from "@/components/shared/page-header";
import { BackLink } from "@/components/shared/back-link";
import { KpiCard } from "@/components/shared/kpi-card";
import { getCatalogReconciliation } from "@/lib/queries/product-catalog";
import { ReconcileTable } from "./reconcile-table";

export const dynamic = "force-dynamic";
export const metadata = { title: "Catalogue produits — AMD Internal OS" };

/**
 * RAPPROCHEMENT DES CATALOGUES PRODUITS.
 *
 * Trois modules tenaient leur propre liste : le RÉGLEMENTAIRE (les dossiers — la référence, parce
 * que c'est lui qui porte l'AMM), le BUSINESS DEVELOPMENT (produits à l'étude) et le PLANNING
 * PROMOTIONNEL (produits que les délégués promeuvent). Chacun écrivait la même molécule à sa
 * façon, et l'on ne pouvait ni remonter du plan de visite au dossier, ni savoir si un produit à
 * l'étude était déjà enregistré.
 *
 * La fusion se fait PAR RATTACHEMENT, jamais par écrasement : les libellés saisis restent, et un
 * lien facultatif désigne le dossier de référence. Aucun rattachement n'est deviné — le
 * rapprochement propose et explique, une personne tranche. C'est délibéré : un 500 mg et un 1 g
 * partagent molécule, forme et souvent nom commercial ; ce sont deux dossiers, deux AMM, deux prix.
 */
export default async function ProductCatalogPage() {
  const user = await requireModule("REGULATORY");
  // Déclarer que deux produits n'en font qu'un est une décision réglementaire : elle demande le
  // droit d'écriture sur le module qui tient le catalogue de référence.
  const canLink = userCan(user, "REGULATORY", "UPDATE");

  const data = await getCatalogReconciliation(user);
  const confident = data.orphans.filter((o) => o.proposals[0]?.confident).length;

  return (
    <div className="space-y-5">
      <BackLink href="/regulatory">
        <ArrowLeft className="h-4 w-4" /> Suivi des dossiers
      </BackLink>

      <PageHeader
        title="Catalogue produits — rapprochement"
        description="Les produits du Business Development et du planning promotionnel, rattachés au dossier réglementaire qui fait référence. Le rapprochement propose et explique ; c'est vous qui tranchez — un dosage différent est un produit différent."
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Dossiers de référence" value={data.dossiers.length} icon="FileCheck2" />
        <KpiCard label="Déjà rapprochés" value={data.linked.length} icon="Link2" tone="success" />
        <KpiCard label="À rapprocher" value={data.orphans.length} icon="Unlink" tone={data.orphans.length > 0 ? "warning" : "default"} />
        <KpiCard label="Proposition sûre" value={confident} icon="CheckCircle2" tone={confident > 0 ? "info" : "default"} />
      </div>

      <ReconcileTable data={data} canLink={canLink} />
    </div>
  );
}
