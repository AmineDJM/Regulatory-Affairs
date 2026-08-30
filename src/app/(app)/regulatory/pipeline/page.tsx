import { notFound } from "next/navigation";
import { requireModule } from "@/lib/session";
import { userCan, holdsRegulatoryLock, seesLockedRegulatory, anyRoleFilter } from "@/lib/rbac";
import { canSetStructural } from "@/lib/regulatory/structural-fields";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { KpiCard } from "@/components/shared/kpi-card";
import { getRegulatoryRows } from "@/lib/queries/regulatory-rows";
import { effectiveTherapeuticSegments } from "@/lib/labels";
import { RegulatoryTable } from "@/app/(app)/regulatory/regulatory-table";
import { NewProductButton } from "@/app/(app)/regulatory/new-product";

export const dynamic = "force-dynamic";

/**
 * LE PIPELINE — ce qu'on ÉTUDIE, pas ce qu'on instruit.
 *
 * Un dossier verrouillé n'est pas un dossier réglementaire en cours : c'est un produit dont on
 * n'a pas encore décidé qu'on le déposerait. Module à part, mais rangé SOUS Regulatory et déplié
 * par sa flèche : ces dossiers en découlent, et c'est là qu'on vient les chercher.
 *
 * L'ouverture — déverrouiller — EST l'acte qui met un dossier au travail, et il se pose ici, là
 * où la décision se prend. Qui peut le poser se règle en Administration : le Super Admin, et ceux
 * à qui il confie le cadenas. Voir `lib/regulatory/pipeline-access.ts`.
 */
export default async function BusinessDevelopmentPipelinePage() {
  // Les dossiers restent des dossiers réglementaires : c'est le droit REGULATORY qui les
  // gouverne, et le verrou qui décide de ce que chacun voit.
  const user = await requireModule("REGULATORY");
  // PAGE FERMÉE À QUI NE VOIT AUCUN DOSSIER VERROUILLÉ. Sans cela, l'écran s'ouvrait pour tout le
  // monde et affichait « Aucun dossier verrouillé » — une page vide qu'on relit trois fois avant
  // de comprendre qu'elle n'est pas pour soi. Le menu ne la propose pas ; l'adresse non plus.
  if (!seesLockedRegulatory(user)) notFound();
  const canAssign = userCan(user, "REGULATORY", "UPDATE");
  const canLock = holdsRegulatoryLock(user);

  const canCreate = userCan(user, "REGULATORY", "CREATE");
  const { rows, companies, canSupervise, settings, suppliers } = await getRegulatoryRows(user);
  // TOUS LES DOSSIERS VERROUILLÉS, sans exception. On filtrait sur l'étape « pipeline », or
  // `regStage` classe un dossier ABOUTI comme « done » même s'il est verrouillé : un dossier
  // verrouillé dont la décision était tombée disparaissait donc de l'écran censé les lister
  // tous. Le verrou est le critère, pas l'étape.
  const pipeline = rows.filter((r) => r.isLocked);

  // Rôle SECONDAIRE compris — voir la même liste sur le suivi des dossiers.
  const assignableUsers = canAssign || canCreate
    ? await prisma.user.findMany({
        where: { isActive: true, ...anyRoleFilter(["HEAD_OF_REGULATORY", "REGULATORY_ASSISTANT", "DIRECTION"]) },
        select: { id: true, name: true, role: true },
        orderBy: { name: "asc" },
      })
    : [];

  return (
    <div className="space-y-5">
      {/* PAS DE LIEN « ← Suivi des dossiers ». Un fil d'Ariane vers un module VOISIN fait croire
          que le pipeline est une sous-page du suivi — c'est exactement la confusion qu'on veut
          lever. Les deux se rejoignent par le menu, comme deux modules qu'ils sont. */}
      <PageHeader
        title="Pipeline réglementaire"
        description="TOUS les dossiers verrouillés, sans exception — les produits à l'étude, pas encore ouverts à l'équipe. Ouvrir le cadenas les fait sortir d'ici et entrer dans « À traiter », sur le suivi des dossiers : c'est le geste, et le seul, qui met un dossier au travail."
      >
        {/* CRÉER DIRECTEMENT ICI. Un produit qu'on étudie n'a rien à faire dans le suivi des
            dossiers en attendant qu'on le verrouille : il naît au pipeline, verrouillé, et n'en
            sort que par le cadenas. Réservé à qui tient ce cadenas. */}
        {canCreate && canLock && (
          <NewProductButton lockOnCreate users={assignableUsers} suppliers={suppliers} companies={companies} />
        )}
      </PageHeader>

      {/* DEUX COMPTEURS, ET ILS PARLENT DU PIPELINE. « Déjà ouverts — à traiter » affichait ici le
          chiffre du SUIVI des dossiers : deux écrans qui montrent les mêmes indicateurs sont deux
          écrans qu'on confond. Le chemin vers le suivi existe déjà, en haut de page. */}
      <div className="grid grid-cols-2 gap-3">
        <KpiCard label="Dossiers verrouillés" value={pipeline.length} icon="Lock" tone={pipeline.length > 0 ? "info" : "default"} />
        {/* Un dossier peut être verrouillé ET abouti : le compter à part évite de croire que
            « à l'étude » et « aboutis » s'excluent. */}
        <KpiCard label="Dont aboutis" value={pipeline.filter((r) => r.stage === "done").length} icon="CheckCircle2" tone="success" />
      </div>

      {pipeline.length === 0 ? (
        <EmptyState
          icon="Lightbulb"
          title="Aucun dossier verrouillé"
          description={canLock
            ? "Créez un dossier ici : il naît verrouillé et y reste tant que vous n'ouvrez pas le cadenas."
            : "Aucun produit n'est à l'étude pour le moment. Vous verrez ici les dossiers verrouillés dès qu'il y en aura."}
        />
      ) : (
        <RegulatoryTable
          rows={pipeline}
          // PAS D'ONGLETS D'ÉTAPE ICI. Ils trient « À traiter » / « Terminé » — deux étapes que le
          // pipeline ne contient jamais, puisque tout y est verrouillé. La table filtrait donc sur
          // une étape absente : 68 dossiers annoncés en haut, et un tableau vide en dessous.
          stageTabs={false}
          canEditPriority={canSupervise}
          canAssign={canAssign}
          canSetStructural={canSetStructural(user)}
          canLock={canLock}
          assignableUsers={assignableUsers}
          companies={companies}
          segments={effectiveTherapeuticSegments(settings.regulatoryTherapeuticSegments)}
        />
      )}
    </div>
  );
}
