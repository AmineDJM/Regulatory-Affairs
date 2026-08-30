import Link from "next/link";
import { AlertTriangle, Link2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { requireModule } from "@/lib/session";
import { userCan, scopeRegulatory, isRegulatorySupervisor, anyRoleFilter } from "@/lib/rbac";
import { canSetStructural } from "@/lib/regulatory/structural-fields";
import { prisma } from "@/lib/prisma";
import { regProgress, type RegWorkflowState } from "@/lib/regulatory-workflow";
import { regStage } from "@/lib/regulatory/stage";
import { getCompanies } from "@/lib/company";
import { getAppSettings } from "@/lib/settings";
import { PageHeader } from "@/components/shared/page-header";
import { PHARMA_FORM, DOSAGE_UNIT, effectiveTherapeuticSegments } from "@/lib/labels";
import { effectiveStage } from "@/lib/regulatory/manufacturing-stage";
import { RegulatoryTable } from "./regulatory-table";
import { getRegulatoryRows } from "@/lib/queries/regulatory-rows";
import { NewProductButton } from "./new-product";
import { SuppliersManager } from "./suppliers-manager";
import { UpdateReminderButton } from "./update-reminder";
import { canSendUpdateReminder } from "@/lib/regulatory/update-reminder";
import { regulatoryReminderBoard } from "@/lib/queries/regulatory-reminders";

export default async function RegulatoryPage() {
  const user = await requireModule("REGULATORY");
  const canCreate = userCan(user, "REGULATORY", "CREATE");
  // Confier un dossier à quelqu'un, c'est le MODIFIER : même droit que l'édition de la fiche.
  const canAssign = userCan(user, "REGULATORY", "UPDATE");
  // Le cadenas n'appartient qu'au Super Admin — les autres ne voient même pas les dossiers verrouillés.
  const canLock = user.role === "SUPER_ADMIN";
  const { rows, products, suppliers, companies, settings, canSupervise } = await getRegulatoryRows(user);
  // LE VERROU, ET RIEN D'AUTRE, SÉPARE LES DEUX ÉCRANS. On filtrait sur l'étape « pipeline » :
  // or un dossier ABOUTI est classé « done » même verrouillé, et réapparaissait donc ici sous
  // l'onglet « Terminé » alors qu'il est censé vivre dans le pipeline. Le suivi des dossiers ne
  // montre QUE ce qui est ouvert à l'équipe ; tout ce qui est cadenassé est au pipeline.
  const visible = rows.filter((r) => !r.isLocked);

  // Personnes à qui un dossier peut être confié : l'équipe Regulatory + la Direction. Sert au
  // formulaire de création ET au menu déroulant « Chargé du dossier » du tableau.
  // LE RÔLE SECONDAIRE COMPTE. Quelqu'un à qui l'administration a donné « Assistante
  // réglementaire » en SECOND rôle fait le travail réglementaire — et n'apparaissait pourtant
  // pas dans la liste : on filtrait sur le rôle principal seul. `anyRoleFilter` regarde les
  // deux, comme partout ailleurs (notifications, portées).
  const assignableUsers = canCreate || canAssign
    ? await prisma.user.findMany({
        where: { isActive: true, ...anyRoleFilter(["HEAD_OF_REGULATORY", "REGULATORY_ASSISTANT", "DIRECTION"]) },
        select: { id: true, name: true, role: true },
        orderBy: { name: "asc" },
      })
    : [];

  // Liste détaillée des fournisseurs pour le gestionnaire (création / activation).
  const supplierList = canCreate
    ? await prisma.supplier.findMany({
        select: { id: true, name: true, country: true, contactEmail: true, active: true },
        orderBy: { name: "asc" },
      })
    : [];

  // Compté sur les dossiers RÉELLEMENT AFFICHÉS ici — pas sur tout le portefeuille. Le compte
  // incluait les dossiers verrouillés : cet écran annonçait donc « 12 dossiers sans entité » en
  // n'en montrant que quatre, et l'on cherchait les huit autres dans un tableau qui ne les
  // contient pas. Ceux du pipeline se signalent au pipeline.
  const visibleIds = new Set(visible.map((r) => r.id));
  const unassignedCount = products.filter((p) => !p.companyId && visibleIds.has(p.id)).length;
  // CE QUI N'EST PAS ICI, ET OÙ C'EST. Les deux écrans sont bien séparés — le verrou tranche —
  // mais rien ne le DISAIT : on comptait 84 dossiers dans le module et l'on en voyait 15, sans
  // savoir si les autres étaient perdus ou ailleurs. Une ligne suffit, et elle ne s'affiche
  // qu'à ceux qui ont accès au pipeline.
  const lockedCount = rows.length - visible.length;

  // LA RELANCE DE MISE À JOUR — réservée au Super Admin et au Directeur Général. Le tableau des
  // portefeuilles n'est chargé que pour eux : personne d'autre ne doit voir qui porte combien.
  const canRemind = canSendUpdateReminder(user);
  const reminderBoard = canRemind ? await regulatoryReminderBoard(user) : null;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Regulatory"
        description="Suivi des molécules/DCI et de leur avancement réglementaire jusqu'à l'enregistrement."
      >
        <div className="flex flex-wrap items-center gap-2">
          {/* Le catalogue réglementaire fait RÉFÉRENCE pour les autres modules : c'est donc d'ici
              qu'on rapproche leurs produits, pas depuis chacun d'eux. Écran de maintenance —
              atteint depuis Regulatory plutôt que par une entrée de menu de plus. */}
          <Link href="/regulatory/catalogue">
            <Button variant="outline" size="sm">
              <Link2 className="h-4 w-4" /> Catalogue produits
            </Button>
          </Link>
          {reminderBoard && (
            <UpdateReminderButton
              people={reminderBoard.targets.map((t) => ({
                userId: t.userId, name: t.name, total: t.total, stale: t.stale,
                lastRemindedAt: t.lastRemindedAt?.toISOString() ?? null,
              }))}
              unassigned={reminderBoard.unassigned}
            />
          )}
          {canCreate && (
            <>
              <SuppliersManager suppliers={supplierList} />
              <NewProductButton users={assignableUsers} suppliers={suppliers} companies={companies} />
            </>
          )}
        </div>
      </PageHeader>

      {/* Un dossier sans entité est visible de TOUT LE MONDE en vue « toutes les entités ».
          On ne le devine pas à sa place — on le signale, pour qu'un humain le rattache. */}
      {unassignedCount > 0 && (
        <p className="flex items-start gap-2 rounded-xl border border-warning/40 bg-warning/5 p-3 text-sm text-muted-foreground">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <span>
            <strong>{unassignedCount} dossier{unassignedCount > 1 ? "s" : ""} sans entité.</strong>{" "}
            L&apos;entité détermine qui a le droit de voir un dossier : tant qu&apos;elle n&apos;est pas
            renseignée, {unassignedCount > 1 ? "ces dossiers apparaissent" : "ce dossier apparaît"} à
            toute personne en vue « toutes les entités ». Ouvrez {unassignedCount > 1 ? "-les" : "-le"} et
            renseignez l&apos;entité.
          </span>
        </p>
      )}

      {canLock && lockedCount > 0 && (
        <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <Lock className="h-3.5 w-3.5 shrink-0" />
          <span>
            <strong>{lockedCount} dossier{lockedCount > 1 ? "s" : ""} verrouillé{lockedCount > 1 ? "s" : ""}</strong>{" "}
            {lockedCount > 1 ? "ne figurent" : "ne figure"} pas ici : {lockedCount > 1 ? "ils vivent" : "il vit"} au
          </span>
          <Link href="/regulatory/pipeline" className="font-medium text-primary hover:underline">Pipeline</Link>
          <span>jusqu&apos;à l&apos;ouverture du cadenas.</span>
        </p>
      )}

      <RegulatoryTable
        rows={visible}
        canEditPriority={canSupervise}
        canAssign={canAssign}
        canSetStructural={canSetStructural(user)}
        canLock={canLock}
        assignableUsers={assignableUsers}
        companies={companies}
        segments={effectiveTherapeuticSegments(settings.regulatoryTherapeuticSegments)}
      />
    </div>
  );
}
