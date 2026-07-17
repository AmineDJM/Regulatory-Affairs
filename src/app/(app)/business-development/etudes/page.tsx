import Link from "next/link";
import { FlaskConical, ArrowLeft } from "lucide-react";
import { requireModule } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { listMarketResearch } from "@/lib/queries/market-research";
import { createMarketResearch } from "@/lib/actions/market-research-actions";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CreateRecordButton } from "@/components/shared/create-record-button";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function MarketResearchListPage() {
  const user = await requireModule("BUSINESS_DEVELOPMENT");
  const canCreate = userCan(user, "BUSINESS_DEVELOPMENT", "CREATE");
  const studies = await listMarketResearch();

  return (
    <div className="space-y-5">
      <PageHeader title="Études de marché" description="Analyse concurrentielle par molécule : taille de marché, prix moyen, acteurs et parts de marché.">
        <Link href="/business-development"><Button variant="outline"><ArrowLeft className="h-4 w-4" /> Business Development</Button></Link>
        {canCreate && (
          <CreateRecordButton
            label="New market research"
            title="Nouvelle étude de marché"
            description="Sélectionnez une ou plusieurs molécules (une par ligne). Une ligne de tableau sera créée par molécule ; tout reste éditable ensuite."
            action={createMarketResearch}
            redirectBase="/business-development/etudes"
            fields={[
              { type: "text", name: "title", label: "Titre de l'étude", required: true, full: true },
              { type: "textarea", name: "molecules", label: "Molécules / produits (une par ligne)", full: true, placeholder: "Paracétamol\nOméprazole\nAtorvastatine" },
              { type: "textarea", name: "notes", label: "Notes / périmètre", full: true },
            ]}
          />
        )}
      </PageHeader>

      {studies.length === 0 ? (
        <EmptyState icon="FlaskConical" title="Aucune étude de marché" description={canCreate ? "Cliquez sur « New market research » pour démarrer une analyse." : "Les études apparaîtront ici."} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {studies.map((s) => (
            <Link key={s.id} href={`/business-development/etudes/${s.id}`}>
              <Card className="h-full transition-colors hover:border-primary/40">
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <FlaskConical className="h-5 w-5 shrink-0 text-primary" />
                    <Badge tone={s.status === "FINAL" ? "success" : "neutral"} dot={false}>{s.status === "FINAL" ? "Finalisée" : "Brouillon"}</Badge>
                  </div>
                  <p className="font-semibold leading-tight">{s.title}</p>
                  <p className="text-xs text-muted-foreground">{s.rowCount} molécule{s.rowCount > 1 ? "s" : ""} · maj {formatDate(s.updatedAt)}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
