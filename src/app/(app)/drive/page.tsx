import Link from "next/link";
import { notFound } from "next/navigation";
import { Trash2, ChevronRight, HardDrive } from "lucide-react";
import { requireModule } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { getDriveListing } from "@/lib/queries/drive";
import { fileKind } from "@/lib/drive";
import { onlyofficeConfigured } from "@/lib/onlyoffice";
import { PageHeader } from "@/components/shared/page-header";
import { ModuleTabs } from "@/components/shared/module-tabs";
import { DOCS_TABS } from "@/lib/labels";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { formatDateTime } from "@/lib/utils";
import { UploadButton } from "./upload-button";
import { NewFolderButton } from "./new-folder-button";
import { NewOfficeButton } from "./new-office-button";
import { DriveTable, type DriveRow } from "./drive-table";

const KIND_ICON: Record<string, string> = { pdf: "FileText", image: "Image", video: "Video", audio: "Music", office: "FileSpreadsheet", text: "FileText", other: "File" };

function humanSize(n: number): string {
  if (!n) return "—";
  const u = ["o", "Ko", "Mo", "Go"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(i ? 1 : 0)} ${u[i]}`;
}

export default async function DrivePage({ searchParams }: { searchParams: { folder?: string; trash?: string } }) {
  const user = await requireModule("DRIVE");
  const folderId = searchParams.folder ?? null;
  const trash = searchParams.trash === "1";
  const listing = await getDriveListing(user, folderId, trash);
  if (!listing) notFound();

  // Droit de créer/importer DANS le dossier courant (à la racine : on crée chez soi).
  const canEditHere = listing.level === "EDIT";
  const canCreate = userCan(user, "DRIVE", "CREATE") && canEditHere;
  // Personnes avec qui partager à l'import (choix lecteurs/éditeurs).
  const shareUsers = canCreate
    ? await prisma.user.findMany({ where: { isActive: true, id: { not: user.id } }, select: { id: true, name: true }, orderBy: { name: "asc" } })
    : [];
  // Dossiers de destination pour « Déplacer » (ceux que l'utilisateur peut éditer).
  const moveTargets = trash
    ? []
    : [
        { id: "", name: "Racine (Drive)" },
        ...(await prisma.driveNode.findMany({
          where: {
            type: "FOLDER", isTrashed: false,
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
      icon: isFile ? KIND_ICON[fileKind(n.mimeType, n.name)] : "Folder",
      category: n.category ?? null,
      owner: n.owner?.name ?? "—",
      sizeLabel: humanSize(n.size),
      updatedLabel: formatDateTime(n.updatedAt),
      canEdit: n.canEdit,
      href: isFile ? `/drive/${n.id}` : `/drive?folder=${n.id}`,
    };
  });

  return (
    <div className="space-y-5">
      <PageHeader title="Drive" description="Vos fichiers et dossiers — stockage interne chiffré (AES-256).">
        {!trash && canCreate && (
          <>
            <NewFolderButton parentId={folderId} />
            <NewOfficeButton parentId={folderId} officeEnabled={onlyofficeConfigured()} />
            <UploadButton parentId={folderId} users={shareUsers} />
          </>
        )}
        <Link href={trash ? "/drive" : "/drive?trash=1"}>
          <Button variant="outline"><Trash2 className="h-4 w-4" /> {trash ? "Mes fichiers" : "Corbeille"}</Button>
        </Link>
      </PageHeader>
      <ModuleTabs tabs={DOCS_TABS.map((t) => ({ label: t.label, href: t.href, show: userCan(user, t.module, "VIEW") }))} />

      {/* Breadcrumb */}
      {!trash && (
        <div className="flex flex-wrap items-center gap-1 text-sm">
          <Link href="/drive" className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">
            <HardDrive className="h-4 w-4" /> Drive
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

      {listing.nodes.length === 0 ? (
        <EmptyState icon="FolderOpen" title={trash ? "Corbeille vide" : "Dossier vide"} description={trash ? "Aucun élément supprimé." : "Importez des fichiers ou créez un dossier."} />
      ) : (
        <DriveTable rows={rows} moveTargets={moveTargets} trash={trash} users={canCreate ? shareUsers : undefined} />
      )}
    </div>
  );
}
