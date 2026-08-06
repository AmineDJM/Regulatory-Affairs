import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireModule } from "@/lib/session";
import { getWorkflowDefinitions } from "@/lib/queries/workflow";
import { PageHeader } from "@/components/shared/page-header";
import { WorkflowBuilder } from "./workflow-builder";
import { BackLink } from "@/components/shared/back-link";

export const dynamic = "force-dynamic";

/**
 * Éditeur « no-code » des circuits de validation Ad & Pro — réservé au Super Admin.
 * Chaque catégorie (Sponsoring, Congrès intl/national, Événements) a une définition
 * entièrement modifiable : ajouter/supprimer/réordonner des étapes, choisir les rôles
 * impliqués et leurs pouvoirs, régler les détails (montant/catégorie obligatoires,
 * désignation, émission d'ordre de dépense, confidentialité…).
 */
export default async function AdminWorkflowsPage() {
  const user = await requireModule("ADMIN");
  if (user.role !== "SUPER_ADMIN") notFound();
  const definitions = await getWorkflowDefinitions();

  return (
    <div className="space-y-5">
      <BackLink href="/admin">
        <ArrowLeft className="h-4 w-4" /> Administration
      </BackLink>
      <PageHeader
        title="Circuits de validation (Ad & Pro)"
        description="Configurez chaque circuit comme une app no-code : étapes, rôles impliqués, pouvoirs, détails. Les demandes en cours suivent les étapes portant les mêmes identifiants."
      />
      <WorkflowBuilder definitions={definitions} />
    </div>
  );
}
