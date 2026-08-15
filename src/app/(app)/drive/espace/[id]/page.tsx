import Link from "next/link";
import { notFound } from "next/navigation";
import { Trash2, ChevronRight, FolderOpen } from "lucide-react";
import { requireModule } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getDriveListing, getDriveTabs, getDriveSpacesForUser } from "@/lib/queries/drive";
import { canCreateInSpace } from "@/lib/drive";
import { fileTypeLabel, fileIconName, explorerSize } from "@/lib/drive/explorer";
import { onlyofficeConfigured } from "@/lib/onlyoffice";
import { PageHeader } from "@/components/shared/page-header";
import { ModuleTabs } from "@/components/shared/module-tabs";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { formatDateTime } from "@/lib/utils";
import { UploadButton } from "../../upload-button";
import { NewFolderButton } from "../../new-folder-button";
import { NewOfficeButton } from "../../new-office-button";
import { SpaceSettingsButton } from "../../drive-space-manager";
import { DriveTable, type DriveRow } from "../../drive-table";

export const dynamic = "force-dynamic";


export default async function DriveSpacePage({ params, searchParams }: { params: { id: string }; searchParams: { folder?: string; trash?: string } }) {
  const user = await requireModule("DRIVE");
  const spaceId = params.id;
  const folderId = searchParams.folder ?? null;
  const trash = searchParams.trash === "1";
  const listing = await getDriveListing(user, folderId, trash, spaceId);
  if (!listing || !listing.space) notFound();

  const { space } = listing;
  const base = `/drive/espace/${spaceId}`;
  const canEditHere = listing.level === "EDIT"; // gestionnaire de la catégorie (ou dossier éditable)

  // Personnes (pour partages à l'import) + données d'accès de la catégorie (pour les réglages).
  const [tabs, users, spaceRow] = await Promise.all([
    getDriveTabs(user),
    canEditHere
      ? prisma.user.findMany({ where: { isActive: true, id: { not: user.id } }, select: { id: true, name: true }, orderBy: { name: "asc" } })
      : Promise.resolve([] as { id: string; name: string }[]),
    space.canManage
      ? prisma.driveSpace.findUnique({ where: { id: spaceId }, select: { id: true, name: true, icon: true, accessRoles: true, accessUserIds: true, managerRoles: true, managerUserIds: true } })
      : Promise.resolve(null),
  ]);

  // Dossiers de destination pour « Déplacer » : ceux de CETTE catégorie (invariant préservé).
  const moveTargets = trash || !canEditHere
    ? []
    : [
        { id: "", name: "Racine (catégorie)" },
        ...(await prisma.driveNode.findMany({
          where: { type: "FOLDER", isTrashed: false, spaceId },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
          take: 300,
        })),
      ];

  // Autres catégories où DÉPOSER (glisser-déposer) — celles que l'utilisateur gère, hors la courante.
  const otherSpaces = trash ? [] : await getDriveSpacesForUser(user);
  const dropCategories = (await Promise.all(
    otherSpaces.filter((s) => s.id !== spaceId).map(async (s) => ({ id: s.id, name: s.name, ok: await canCreateInSpace(user, s.id) })),
  )).filter((s) => s.ok).map((s) => ({ id: s.id, name: s.name }));

  const rows: DriveRow[] = listing.nodes.map((n) => {
    const isFile = n.type === "FILE";
    return {
      id: n.id,
      name: n.name,
      isFile,
      icon: fileIconName(n.name, isFile),
      category: n.category ?? null,
      owner: n.owner?.name ?? "—",
      sizeLabel: explorerSize(n.size, isFile),
      typeLabel: fileTypeLabel(n.name, isFile),
      updatedLabel: formatDateTime(n.updatedAt),
      canEdit: n.canEdit,
      href: isFile ? `/drive/${n.id}` : `${base}?folder=${n.id}`,
    };
  });

  return (
    <div className="space-y-5">
      <PageHeader title={space.name} description="Catégorie partagée du Drive — espace commun aux personnes autorisées.">
        {!trash && canEditHere && (
          <>
            {/* `spaceId` sert de repli quand on crée à la RACINE de la catégorie ; dans un
                sous-dossier, `parentId` prime (le nouveau nœud hérite de la catégorie du parent). */}
            <NewFolderButton parentId={folderId} spaceId={spaceId} />
            <NewOfficeButton parentId={folderId} spaceId={spaceId} officeEnabled={onlyofficeConfigured()} />
            <UploadButton parentId={folderId} spaceId={spaceId} users={users} />
          </>
        )}
        {spaceRow && <SpaceSettingsButton space={spaceRow} users={users} canDelete={user.role === "SUPER_ADMIN"} />}
        {space.canManage && (
          <Link href={trash ? base : `${base}?trash=1`}>
            <Button variant="outline"><Trash2 className="h-4 w-4" /> {trash ? "Fichiers" : "Corbeille"}</Button>
          </Link>
        )}
      </PageHeader>
      <ModuleTabs tabs={tabs} />

      {/* Breadcrumb : racine de la catégorie → dossiers */}
      {!trash && (
        <div className="flex flex-wrap items-center gap-1 text-sm">
          <Link href={base} className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">
            <FolderOpen className="h-4 w-4" /> {space.name}
          </Link>
          {listing.breadcrumb.map((c) => (
            <span key={c.id} className="inline-flex items-center gap-1">
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              <Link href={`${base}?folder=${c.id}`} className="text-muted-foreground hover:text-foreground">{c.name}</Link>
            </span>
          ))}
        </div>
      )}
      {trash && <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Corbeille — {space.name}</h2>}

      {listing.nodes.length === 0 ? (
        <EmptyState
          icon="FolderOpen"
          title={trash ? "Corbeille vide" : "Catégorie vide"}
          description={trash ? "Aucun élément supprimé." : canEditHere ? "Importez des fichiers ou créez un dossier dans cette catégorie." : "Aucun fichier n'a encore été déposé ici."}
        />
      ) : (
        <DriveTable rows={rows} moveTargets={moveTargets} trash={trash} users={canEditHere ? users : undefined} spaceId={spaceId} categories={dropCategories} />
      )}
    </div>
  );
}
