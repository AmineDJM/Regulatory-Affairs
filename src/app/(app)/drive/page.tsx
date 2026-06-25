import Link from "next/link";
import { notFound } from "next/navigation";
import { Trash2, ChevronRight, HardDrive } from "lucide-react";
import { requireModule } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { getDriveListing } from "@/lib/queries/drive";
import { fileKind } from "@/lib/drive";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { EmptyState } from "@/components/shared/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime } from "@/lib/utils";
import { UploadButton } from "./upload-button";
import { NewFolderButton } from "./new-folder-button";
import { NodeActions } from "./node-actions";

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

  const canEdit = listing.level === "EDIT";
  const canCreate = userCan(user, "DRIVE", "CREATE");

  return (
    <div className="space-y-5">
      <PageHeader title="Drive" description="Vos fichiers et dossiers — stockage interne chiffré (AES-256).">
        {!trash && canCreate && (
          <>
            <NewFolderButton parentId={folderId} />
            <UploadButton parentId={folderId} />
          </>
        )}
        <Link href={trash ? "/drive" : "/drive?trash=1"}>
          <Button variant="outline"><Trash2 className="h-4 w-4" /> {trash ? "Mes fichiers" : "Corbeille"}</Button>
        </Link>
      </PageHeader>

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
        <div className="surface overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Propriétaire</TableHead>
                <TableHead className="text-right">Taille</TableHead>
                <TableHead>Modifié</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {listing.nodes.map((n) => {
                const isFile = n.type === "FILE";
                const icon = isFile ? KIND_ICON[fileKind(n.mimeType, n.name)] : "Folder";
                const href = isFile ? `/drive/${n.id}` : `/drive?folder=${n.id}`;
                return (
                  <TableRow key={n.id}>
                    <TableCell>
                      <Link href={href} className="inline-flex items-center gap-2 font-medium hover:underline">
                        <Icon name={icon} className={`h-4 w-4 ${isFile ? "text-muted-foreground" : "text-primary"}`} />
                        <span className="truncate">{n.name}</span>
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{n.owner?.name ?? "—"}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{isFile ? humanSize(n.size) : "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDateTime(n.updatedAt)}</TableCell>
                    <TableCell className="text-right">
                      <NodeActions id={n.id} name={n.name} isFile={isFile} canEdit={canEdit} trash={trash} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
