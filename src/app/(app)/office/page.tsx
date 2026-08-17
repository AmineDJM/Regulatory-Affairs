import Link from "next/link";
import { requireModule } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { onlyofficeConfigured } from "@/lib/onlyoffice";
import { resolveDriveAccess, canViewDrive } from "@/lib/drive";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { formatDateTime } from "@/lib/utils";
import { explorerSize, fileTypeLabel } from "@/lib/drive/explorer";
import { OFFICE_APPS, type OfficeAppKey } from "@/lib/office/apps";
import { DriveTable, type DriveRow } from "../drive/drive-table";
import { OfficeLauncher } from "./office-launcher";

export const dynamic = "force-dynamic";

/** Assez pour couvrir « ce sur quoi je travaille en ce moment », sans devenir une seconde liste. */
const RECENT_TAKE = 60;
const RECENT_SHOWN = 15;

/**
 * BUREAUTIQUE — Word, Excel, PowerPoint, sur les documents de l'ERP.
 *
 * Les fichiers restent dans le Drive : mêmes droits, même cloisonnement par entité, même journal
 * d'audit, même chiffrement. L'éditeur lit et écrit les VRAIS formats (`.docx`, `.xlsx`, `.pptx`),
 * ouvrables ensuite dans Microsoft Office sur un poste.
 */
export default async function OfficePage({ searchParams }: { searchParams: { app?: string } }) {
  const user = await requireModule("DRIVE");
  const focus = OFFICE_APPS.find((a) => a.key === searchParams.app)?.key as OfficeAppKey | undefined;

  // Les documents bureautiques récents, filtrés par la MÊME résolution d'accès que le Drive :
  // cet écran est une porte d'entrée, jamais un contournement.
  const candidates = await prisma.driveNode.findMany({
    where: {
      type: "FILE", isTrashed: false,
      OR: [
        { name: { endsWith: ".docx", mode: "insensitive" } },
        { name: { endsWith: ".xlsx", mode: "insensitive" } },
        { name: { endsWith: ".pptx", mode: "insensitive" } },
      ],
    },
    select: { id: true, name: true, size: true, updatedAt: true, owner: { select: { name: true } } },
    orderBy: { updatedAt: "desc" },
    take: RECENT_TAKE,
  });

  // On retient l'ACCÈS résolu, pas seulement la visibilité : c'est lui qui décide si la ligne
  // peut être renommée, partagée ou supprimée depuis ici.
  const visible: { row: (typeof candidates)[number]; canEdit: boolean }[] = [];
  for (const n of candidates) {
    if (visible.length >= RECENT_SHOWN) break;
    const access = await resolveDriveAccess(user, n.id);
    if (canViewDrive(access)) visible.push({ row: n, canEdit: access === "EDIT" });
  }

  const officeEnabled = onlyofficeConfigured();
  const users = visible.some((v) => v.canEdit)
    ? await prisma.user.findMany({ where: { isActive: true, id: { not: user.id } }, select: { id: true, name: true }, orderBy: { name: "asc" } })
    : [];

  // EXACTEMENT la liste du Drive — sélection Ctrl/Maj, ouverture multiple, partage et corbeille
  // groupés. Une seconde liste « spéciale bureautique » finirait par diverger sur un détail, et
  // c'est ce détail qu'on remarque.
  const rows: DriveRow[] = visible.map(({ row: n, canEdit }) => ({
    id: n.id, name: n.name, isFile: true,
    category: null,
    owner: n.owner?.name ?? "—",
    size: n.size,
    sizeLabel: explorerSize(n.size, true),
    typeLabel: fileTypeLabel(n.name, true),
    updatedAt: n.updatedAt.toISOString(),
    updatedLabel: formatDateTime(n.updatedAt),
    canEdit,
    href: officeEnabled && canEdit ? `/drive/${n.id}/edit` : `/drive/vue?ids=${n.id}`,
  }));

  return (
    <div className="space-y-5">
      <PageHeader title="Bureautique" description="Word, Excel et PowerPoint sur vos documents — ils restent dans le Drive, avec ses droits." />

      <OfficeLauncher officeEnabled={officeEnabled} focus={focus} />

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Documents récents</h2>
        {rows.length === 0 ? (
          <EmptyState
            icon="FileText"
            title="Aucun document bureautique"
            description="Créez un document ci-dessus, ou importez un fichier Word, Excel ou PowerPoint dans le Drive."
          />
        ) : (
          <DriveTable rows={rows} moveTargets={[]} trash={false} users={users.length ? users : undefined} spaceId={null} />
        )}
      </section>

      {!officeEnabled && (
        <p className="surface p-3 text-xs text-muted-foreground">
          <strong className="text-foreground">Édition dans le navigateur non activée sur ce serveur.</strong> Les documents
          se créent et se téléchargent normalement ; l&apos;édition en ligne s&apos;ouvrira dès que le serveur d&apos;édition
          sera configuré (Administration).
        </p>
      )}
    </div>
  );
}
