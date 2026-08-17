import { requireModule } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { BackLink } from "@/components/shared/back-link";
import { EmptyState } from "@/components/shared/empty-state";
import { KpiCard } from "@/components/shared/kpi-card";
import { getRegulatoryRows } from "@/lib/queries/regulatory-rows";
import { effectiveTherapeuticSegments } from "@/lib/labels";
import { RegulatoryTable } from "@/app/(app)/regulatory/regulatory-table";

export const dynamic = "force-dynamic";

/**
 * LE PIPELINE — ce qu'on ÉTUDIE, pas ce qu'on instruit.
 *
 * Un dossier verrouillé n'est pas un dossier réglementaire en cours : c'est un produit dont on
 * n'a pas encore décidé qu'on le déposerait. Module à part, mais rangé SOUS Regulatory et déplié
 * par sa flèche : ces dossiers en découlent, et c'est là qu'on vient les chercher.
 *
 * L'ouverture reste le geste du Super Admin : déverrouiller EST l'acte qui met un dossier au
 * travail, et il se pose ici, là où la décision se prend.
 */
export default async function BusinessDevelopmentPipelinePage() {
  // Les dossiers restent des dossiers réglementaires : c'est le droit REGULATORY qui les
  // gouverne, et le verrou qui décide de ce que chacun voit.
  const user = await requireModule("REGULATORY");
  const canAssign = userCan(user, "REGULATORY", "UPDATE");
  const canLock = user.role === "SUPER_ADMIN";

  const { rows, companies, canSupervise, settings } = await getRegulatoryRows(user);
  // TOUS LES DOSSIERS VERROUILLÉS, sans exception. On filtrait sur l'étape « pipeline », or
  // `regStage` classe un dossier ABOUTI comme « done » même s'il est verrouillé : un dossier
  // verrouillé dont la décision était tombée disparaissait donc de l'écran censé les lister
  // tous. Le verrou est le critère, pas l'étape.
  const pipeline = rows.filter((r) => r.isLocked);

  const assignableUsers = canAssign
    ? await prisma.user.findMany({
        where: { isActive: true, role: { in: ["HEAD_OF_REGULATORY", "REGULATORY_ASSISTANT", "DIRECTION"] } },
        select: { id: true, name: true, role: true },
        orderBy: { name: "asc" },
      })
    : [];

  return (
    <div className="space-y-5">
      <BackLink href="/regulatory"><ArrowLeft className="h-4 w-4" /> Suivi des dossiers</BackLink>
      <PageHeader
        title="Pipeline réglementaire"
        description="TOUS les dossiers verrouillés, sans exception — les produits à l'étude, pas encore ouverts à l'équipe. Ouvrir le cadenas les fait sortir d'ici et entrer dans « À traiter », sur le suivi des dossiers : c'est le geste, et le seul, qui met un dossier au travail."
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <KpiCard label="Dossiers verrouillés" value={pipeline.length} icon="Lock" tone={pipeline.length > 0 ? "info" : "default"} />
        {/* Un dossier peut être verrouillé ET abouti : le compter à part évite de croire que
            « à l'étude » et « aboutis » s'excluent. */}
        <KpiCard label="Dont aboutis" value={pipeline.filter((r) => r.stage === "done").length} icon="CheckCircle2" tone="success" />
        {/* La DESTINATION, cliquable : ce compteur dit où vont les dossiers qu'on ouvre ici. */}
        <Link href="/regulatory" className="block transition-opacity hover:opacity-80">
          <KpiCard label="Déjà ouverts — à traiter" value={rows.filter((r) => r.stage === "todo").length} icon="FileCheck2" />
        </Link>
      </div>

      {pipeline.length === 0 ? (
        <EmptyState
          icon="Lightbulb"
          title="Aucun dossier verrouillé"
          description={canLock
            ? "Un dossier créé puis verrouillé apparaît ici tant qu'il n'est pas ouvert à l'équipe."
            : "Les dossiers verrouillés ne sont visibles que du Super Admin tant qu'ils ne sont pas ouverts."}
        />
      ) : (
        <RegulatoryTable
          rows={pipeline}
          canEditPriority={canSupervise}
          canAssign={canAssign}
          canLock={canLock}
          assignableUsers={assignableUsers}
          companies={companies}
          segments={effectiveTherapeuticSegments(settings.regulatoryTherapeuticSegments)}
        />
      )}
    </div>
  );
}
