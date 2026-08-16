import Link from "next/link";
import { ChevronRight, FolderOpen } from "lucide-react";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/rbac";
import { getDriveListing } from "@/lib/queries/drive";
import { REG_DRIVE_ROOT } from "@/lib/regulatory-drive-mirror";
import { onlyofficeConfigured } from "@/lib/onlyoffice";
import { formatDateTime } from "@/lib/utils";
import { fileTypeLabel, fileIconName, explorerSize } from "@/lib/drive/explorer";
import { DriveTable, type DriveRow } from "@/app/(app)/drive/drive-table";
import { DriveCanvas } from "@/app/(app)/drive/drive-canvas";
import { UploadButton } from "@/app/(app)/drive/upload-button";
import { NewFolderButton } from "@/app/(app)/drive/new-folder-button";

/**
 * LES FICHIERS D'UN PRODUIT, CONSULTABLES SUR PLACE.
 *
 * Un dossier déposé sur un produit — une arborescence, une archive décompressée — était répliqué
 * dans le Drive et, de là, invisible depuis le produit : pour l'ouvrir il fallait quitter
 * Regulatory, retrouver le dossier dans le Drive, et se souvenir d'où l'on venait. On ramène donc
 * l'explorateur ICI, avec **exactement** le même composant que le Drive : même liste, même tri,
 * même clic droit, même glisser-déposer, mêmes actions par ligne.
 *
 * Ce n'est pas une copie de l'écran : c'est le même. Deux explorateurs qui se ressemblent finissent
 * toujours par diverger sur un détail — et c'est ce détail qu'on remarque.
 *
 * Les droits restent ceux du Drive : `getDriveListing` résout l'accès nœud par nœud. Un dossier
 * produit partagé en lecture s'affiche en lecture ici aussi.
 */
export async function ProductDriveExplorer({
  user, productName, folderId, basePath, canEdit,
}: {
  user: SessionUser;
  /** Nom du dossier produit dans le Drive — « REF — DCI », tel que posé par le miroir. */
  productName: string;
  /** Sous-dossier ouvert (navigation interne), sinon la racine du dossier produit. */
  folderId: string | null;
  /** Chemin de l'écran hôte, pour que la navigation reste DANS le produit (`/regulatory/<id>`). */
  basePath: string;
  canEdit: boolean;
}) {
  // Le dossier produit, tel que le miroir l'a créé. Absent = aucun dépôt encore fait.
  const root = await prisma.driveNode.findFirst({
    where: { type: "FOLDER", name: productName, isTrashed: false, parent: { name: REG_DRIVE_ROOT } },
    select: { id: true },
  });
  if (!root) {
    return (
      <p className="text-sm text-muted-foreground">
        Aucun dossier de fichiers pour ce produit. Le premier document ou dossier déposé le créera.
      </p>
    );
  }

  const openId = folderId ?? root.id;
  const listing = await getDriveListing(user, openId, false);
  if (!listing) {
    return <p className="text-sm text-muted-foreground">Vous n&apos;avez pas accès aux fichiers de ce produit.</p>;
  }

  const canEditHere = canEdit && listing.level === "EDIT";
  const users = canEditHere
    ? await prisma.user.findMany({ where: { isActive: true, id: { not: user.id } }, select: { id: true, name: true }, orderBy: { name: "asc" } })
    : [];

  const rows: DriveRow[] = listing.nodes.map((n) => {
    const isFile = n.type === "FILE";
    return {
      id: n.id, name: n.name, isFile,
      icon: fileIconName(n.name, isFile),
      category: n.category ?? null,
      owner: n.owner?.name ?? "—",
      size: n.size,
      sizeLabel: explorerSize(n.size, isFile),
      typeLabel: fileTypeLabel(n.name, isFile),
      updatedAt: n.updatedAt.toISOString(),
      updatedLabel: formatDateTime(n.updatedAt),
      canEdit: n.canEdit,
      // Un fichier s'ouvre dans le plan de travail (plusieurs documents à la fois) ; un dossier
      // se parcourt SANS quitter le produit.
      href: isFile ? `/drive/vue?ids=${n.id}` : `${basePath}?dossier=${n.id}`,
    };
  });

  // Fil d'Ariane borné au dossier produit : on ne remonte pas au-dessus depuis cet écran.
  const trail: { id: string; name: string }[] = [];
  let seen = false;
  for (const c of listing.breadcrumb) {
    if (c.id === root.id) { seen = true; continue; }
    if (seen) trail.push(c);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-1 text-sm">
          <Link href={basePath} className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">
            <FolderOpen className="h-4 w-4" /> Fichiers du produit
          </Link>
          {trail.map((c) => (
            <span key={c.id} className="inline-flex items-center gap-1">
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              <Link href={`${basePath}?dossier=${c.id}`} className="text-muted-foreground hover:text-foreground">{c.name}</Link>
            </span>
          ))}
        </div>
        {canEditHere && (
          <div className="ml-auto flex items-center gap-2">
            <NewFolderButton parentId={openId} />
            <UploadButton parentId={openId} users={users} label="Importer ici" />
          </div>
        )}
      </div>

      <DriveCanvas parentId={openId} canCreate={canEditHere} officeEnabled={onlyofficeConfigured()}>
        {rows.length === 0 ? (
          <p className="surface p-6 text-center text-sm text-muted-foreground">
            Ce dossier est vide.{canEditHere ? " Importez des fichiers, ou faites un clic droit pour créer un dossier." : ""}
          </p>
        ) : (
          <DriveTable rows={rows} moveTargets={[]} trash={false} users={canEditHere ? users : undefined} spaceId={null} />
        )}
      </DriveCanvas>
    </div>
  );
}
