import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileSpreadsheet } from "lucide-react";
import { requireModule } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { aiConfigured } from "@/lib/ai";
import { getMarketResearch, listResearchPresentations } from "@/lib/queries/market-research";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ResearchTable } from "../research-table";
import { PresentationPanel } from "../presentation-panel";

export const dynamic = "force-dynamic";

export default async function MarketResearchDetailPage({ params }: { params: { id: string } }) {
  const user = await requireModule("BUSINESS_DEVELOPMENT");
  const canEdit = userCan(user, "BUSINESS_DEVELOPMENT", "UPDATE");
  const research = await getMarketResearch(params.id);
  if (!research) notFound();
  const presentations = await listResearchPresentations(research.id);

  return (
    <div className="space-y-5">
      <PageHeader title={research.title} description="Analyse concurrentielle : taille de marché, prix moyen, acteurs et parts de marché — éditable en place.">
        <Link href="/business-development/etudes"><Button variant="outline"><ArrowLeft className="h-4 w-4" /> Études</Button></Link>
        <a href={`/api/market-research/${research.id}/export`}><Button variant="outline"><FileSpreadsheet className="h-4 w-4" /> Export Excel</Button></a>
      </PageHeader>

      <Card>
        <CardContent className="p-0">
          <ResearchTable researchId={research.id} rows={research.rows} canEdit={canEdit} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <PresentationPanel researchId={research.id} presentations={presentations} canEdit={canEdit} aiConfigured={aiConfigured()} rowCount={research.rows.length} />
        </CardContent>
      </Card>
    </div>
  );
}
