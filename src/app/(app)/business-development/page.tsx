import Link from "next/link";
import { Lightbulb, LineChart } from "lucide-react";
import { requireModule } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { getBdProjects, bdSummary } from "@/lib/queries/bd";
import { createBdProject } from "@/lib/actions/bd-project-actions";
import { PageHeader } from "@/components/shared/page-header";
import { KpiCard } from "@/components/shared/kpi-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { CreateRecordButton } from "@/components/shared/create-record-button";
import { optionsFromMap } from "@/components/shared/form-fields";
import { BD_PROJECT_STATUS } from "@/lib/labels";
import { formatCompact } from "@/lib/utils";
import { BdStrategicTable } from "./bd-strategic-table";

export default async function BusinessDevelopmentPage() {
  const user = await requireModule("BUSINESS_DEVELOPMENT");
  const canCreate = userCan(user, "BUSINESS_DEVELOPMENT", "CREATE");
  const canUpdate = userCan(user, "BUSINESS_DEVELOPMENT", "UPDATE");
  const canDelete = userCan(user, "BUSINESS_DEVELOPMENT", "DELETE");

  const projects = await getBdProjects(user);
  const s = bdSummary(projects);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Business Development"
        description="Tableau stratégique des projets : Projet → Gamme → Produit. Marché, concurrence, investissement et revenus estimés, éditables en place."
      >
        <Link href="/business-development/marche">
          <Button variant="outline"><LineChart className="h-4 w-4" /> Intelligence marché</Button>
        </Link>
        <Link href="/business-development/opportunites">
          <Button variant="outline"><Lightbulb className="h-4 w-4" /> Opportunités (pipeline)</Button>
        </Link>
        {canCreate && (
          <CreateRecordButton
            label="Nouveau projet"
            title="Nouveau projet stratégique"
            description="Un projet regroupe des gammes, chaque gamme des produits (DCI)."
            action={createBdProject}
            redirectBase="/business-development"
            fields={[
              { type: "text", name: "name", label: "Nom du projet", required: true, full: true },
              { type: "select", name: "status", label: "Statut", options: optionsFromMap(BD_PROJECT_STATUS), defaultValue: "IDEA" },
              { type: "textarea", name: "description", label: "Description / objectif" },
              { type: "textarea", name: "comment", label: "Commentaire" },
            ]}
          />
        )}
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Projets" value={s.projects} icon="FolderKanban" />
        <KpiCard label="En cours" value={s.active} icon="Activity" tone="info" />
        <KpiCard label="Validés" value={s.validated} icon="CheckCircle2" tone="success" />
        <KpiCard label="Produits (DCI)" value={s.products} icon="Pill" />
        <KpiCard label="Revenus estimés 3 ans" value={formatCompact(s.revenue3y)} icon="TrendingUp" tone="success" />
        <KpiCard label="Investissement 3 ans" value={formatCompact(s.invest3y)} icon="Banknote" tone="warning" />
      </div>

      {projects.length === 0 ? (
        <EmptyState
          icon="Lightbulb"
          title="Aucun projet pour le moment"
          description={canCreate ? "Créez votre premier projet stratégique, puis ajoutez des gammes et des produits." : "Les projets stratégiques apparaîtront ici."}
        />
      ) : (
        <BdStrategicTable projects={projects} canUpdate={canUpdate} canDelete={canDelete} />
      )}
    </div>
  );
}
