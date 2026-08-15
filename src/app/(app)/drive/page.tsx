import Link from "next/link";
import { notFound } from "next/navigation";
import { Trash2, ChevronRight, House } from "lucide-react";
import { requireModule } from "@/lib/session";
import { userCan, canCreateDriveSpace } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { getDriveListing, getDriveTabs, getDriveSpacesForUser } from "@/lib/queries/drive";
import { canCreateInSpace } from "@/lib/drive";
import { getAppSettings } from "@/lib/settings";
import { onlyofficeConfigured } from "@/lib/onlyoffice";
import { PageHeader } from "@/components/shared/page-header";
import { ModuleTabs } from "@/components/shared/module-tabs";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { formatDateTime } from "@/lib/utils";
import { UploadButton } from "./upload-button";
import { NewFolderButton } from "./new-folder-button";
import { NewOfficeButton } from "./new-office-button";
import { CreateSpaceButton } from "./drive-space-manager";
import { DriveTable, type DriveRow } from "./drive-table";
import { ExplorerNav } from "./explorer-nav";
import { QuickAccessList, type QuickRow } from "./quick-access-list";
import { parseView, VIEW_TITLE, fileTypeLabel, fileIconName, explorerSize } from "@/lib/drive/explorer";
import { getRecentFiles, getDownloadedFiles } from "@/lib/queries/drive-quick-access";


export default async function DrivePage({ searchParams }: { searchParams: { folder?: string; trash?: string; view?: string } }) {
  const user = await requireModule("DRIVE");
  const folderId = searchParams.folder ?? null;
  const trash = searchParams.trash === "1";
  const view = parseView(searchParams.view, trash);

  // ACCÈS RAPIDE — deux listes transverses, qui ne parcourent pas l'arborescence. Elles passent
  // par le même filtre de visibilité : un raccourci ne doit jamais montrer plus que la navigation.
  if (view === "recent" || view === "downloads") {
    const [files, navSpaces] = await Promise.all([
      view === "recent" ? getRecentFiles(user) : getDownloadedFiles(user),
      getDriveSpacesForUser(user),
    ]);
    const quick: QuickRow[] = files.map((f) => ({
      id: f.id, name: f.name, isFile: true, size: f.size, updatedAt: f.updatedAt,
      folderName: f.folderName, href: `/drive/${f.id}`,
    }));
    return (
      <div className="space-y-5">
        <PageHeader title={`Drive — ${VIEW_TITLE[view]}`} description={
          view === "recent"
            ? "Les fichiers modifiés le plus récemment, tous emplacements confondus."
            : "Les fichiers que vous avez téléchargés, du plus récent au plus ancien."
        } />
        <ModuleTabs tabs={await getDriveTabs(user)} />
        <div className="flex flex-col gap-4 lg:flex-row">
          <ExplorerNav active={view} spaces={navSpaces.map((s) => ({ id: s.id, name: s.name, icon: s.icon }))} />
          <div className="min-w-0 flex-1">
            <QuickAccessList
              rows={quick}
              emptyTitle={view === "recent" ? "Aucun fichier récent" : "Aucun téléchargement"}
              emptyHint={view === "recent"
                ? "Les fichiers que vous ou vos collègues modifiez apparaîtront ici."
                : "Les fichiers que vous téléchargez depuis le Drive s'ajouteront à cette liste."}
            />
          </div>
        </div>
      </div>
    );
  }

  const listing = await getDriveListing(user, folderId, trash);
  if (!listing) notFound();

  // Droit de créer/importer DANS le dossier courant (à la racine : on crée chez soi).
  const canEditHere = listing.level === "EDIT";
  const canCreate = userCan(user, "DRIVE", "CREATE") && canEditHere;
  const [settings, tabs, spaces] = await Promise.all([getAppSettings(), getDriveTabs(user), getDriveSpacesForUser(user)]);
  const canCreateSpace = canCreateDriveSpace(user, settings.driveSpaceCreatorRoles);
  // Catégories où l'on peut DÉPOSER (glisser-déposer) : celles que l'utilisateur gère.
  const dropCategories = trash
    ? []
    : (await Promise.all(spaces.map(async (s) => ({ id: s.id, name: s.name, ok: await canCreateInSpace(user, s.id) }))))
        .filter((s) => s.ok)
        .map((s) => ({ id: s.id, name: s.name }));
  // Personnes avec qui partager à l'import / ouvrir une catégorie (hors soi-même).
  const users = (canCreate || canCreateSpace)
    ? await prisma.user.findMany({ where: { isActive: true, id: { not: user.id } }, select: { id: true, name: true }, orderBy: { name: "asc" } })
    : [];
  // Dossiers de destination pour « Déplacer » (Drive PERSONNEL uniquement : spaceId null).
  const moveTargets = trash
    ? []
    : [
        { id: "", name: "Racine (Drive)" },
        ...(await prisma.driveNode.findMany({
          where: {
            type: "FOLDER", isTrashed: false, spaceId: null,
            ...(user.role === "SUPER_ADMIN"
              ? {}
              : { OR: [{ ownerId: user.id }, { shares: { some: { userId: user.id, access: "EDIT" } } }] }),
          },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
          take: 300,
        })),
      ];

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
      href: isFile ? `/drive/${n.id}` : `/drive?folder=${n.id}`,
    };
  });

  return (
    <div className="space-y-5">
      <PageHeader title="Drive" description="Vos fichiers et dossiers — stockage interne chiffré (AES-256). Glissez-déposez pour ranger.">
        {!trash && canCreate && (
          <>
            <NewFolderButton parentId={folderId} />
            <NewOfficeButton parentId={folderId} officeEnabled={onlyofficeConfigured()} />
            <UploadButton parentId={folderId} users={users} />
          </>
        )}
        {!trash && canCreateSpace && <CreateSpaceButton users={users} />}
        <Link href={trash ? "/drive" : "/drive?trash=1"}>
          <Button variant="outline"><Trash2 className="h-4 w-4" /> {trash ? "Mes fichiers" : "Corbeille"}</Button>
        </Link>
      </PageHeader>
      <ModuleTabs tabs={tabs} />

      {/* Breadcrumb */}
      {!trash && (
        <div className="flex flex-wrap items-center gap-1 text-sm">
          <Link href="/drive" className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">
            <House className="h-4 w-4" /> Drive
          </Link>
          {listing.breadcrumb.map((c) => (
            <span key={c.id} className="inline-flex items-center gap-1">
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              <Link href={`/drive?folder=${c.id}`} className="text-muted-foreground hover:text-foreground">{c.name}</Link>
            </span>
          ))}
        </div>
      )}
      {trash && <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Corbeille</h2>}

      <div className="flex flex-col gap-4 lg:flex-row">
        <ExplorerNav
          active={trash ? "trash" : "root"}
          spaces={spaces.map((s) => ({ id: s.id, name: s.name, icon: s.icon }))}
        />
        <div className="min-w-0 flex-1">
          {listing.nodes.length === 0 ? (
            <EmptyState icon="FolderOpen" title={trash ? "Corbeille vide" : "Dossier vide"} description={trash ? "Aucun élément supprimé." : "Importez des fichiers ou créez un dossier."} />
          ) : (
            <DriveTable rows={rows} moveTargets={moveTargets} trash={trash} users={canCreate ? users : undefined} spaceId={null} categories={dropCategories} />
          )}
        </div>
      </div>
    </div>
  );
}
