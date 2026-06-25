import { requireSupplier } from "@/lib/supplier-auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { EXTERNAL_REGULATORY_STATUS } from "@/lib/labels";
import { formatDate } from "@/lib/utils";
import { SupplierLogoutButton } from "./logout-button";

export default async function SupplierPortalPage() {
  const session = await requireSupplier();

  // SÉCURITÉ : on ne sélectionne QUE les champs externes, et UNIQUEMENT les
  // produits de CE fournisseur marqués visibles. Aucun statut/note interne,
  // aucun document, aucune autre donnée n'est exposée.
  const products = await prisma.regulatoryProduct.findMany({
    where: { supplierId: session.supplierId, portalVisible: true },
    select: {
      id: true, dci: true, brandName: true, dosage: true, pharmaceuticalForm: true,
      externalStatus: true, externalComment: true, externalNextStep: true,
      externalActionExpected: true, externalDeadline: true, externalUpdatedAt: true,
    },
    orderBy: [{ externalUpdatedAt: "desc" }, { dci: "asc" }],
  });

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Adventum Pharma · Portail Fournisseur</p>
          <h1 className="text-xl font-semibold tracking-tight">{session.supplierName}</h1>
          <p className="text-sm text-muted-foreground">Connecté en tant que {session.userName}</p>
        </div>
        <SupplierLogoutButton />
      </header>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Vos produits ({products.length})
        </h2>

        {products.length === 0 ? (
          <EmptyState icon="PackageSearch" title="Aucun produit à afficher" description="Vos dossiers d'enregistrement apparaîtront ici dès qu'ils seront partagés par l'équipe réglementaire d'Adventum." />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {products.map((p) => (
              <Card key={p.id}>
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold">{p.dci}</p>
                      <p className="text-sm text-muted-foreground">
                        {[p.brandName, p.dosage, p.pharmaceuticalForm].filter(Boolean).join(" · ") || "—"}
                      </p>
                    </div>
                    {p.externalStatus
                      ? <StatusBadge map={EXTERNAL_REGULATORY_STATUS} value={p.externalStatus} dot={false} />
                      : <Badge tone="neutral" dot={false}>—</Badge>}
                  </div>

                  <dl className="space-y-2 text-sm">
                    <Row label="Prochaine étape" value={p.externalNextStep} />
                    <Row label="Action attendue de votre part" value={p.externalActionExpected} highlight />
                    <Row label="Échéance" value={p.externalDeadline ? formatDate(p.externalDeadline) : null} />
                    <Row label="Commentaire" value={p.externalComment} />
                  </dl>

                  {p.externalUpdatedAt && (
                    <p className="border-t border-border pt-2 text-xs text-muted-foreground">
                      Dernière mise à jour : {formatDate(p.externalUpdatedAt)}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <p className="text-center text-xs text-muted-foreground">
        Les informations affichées sont fournies à titre indicatif par l'équipe réglementaire d'Adventum Pharma.
      </p>
    </div>
  );
}

function Row({ label, value, highlight }: { label: string; value: string | null | undefined; highlight?: boolean }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={highlight ? "font-medium text-foreground" : "text-foreground/90"}>{value}</dd>
    </div>
  );
}
