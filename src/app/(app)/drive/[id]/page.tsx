import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Download, PencilLine } from "lucide-react";
import { requireModule } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { resolveDriveAccess, fileKind } from "@/lib/drive";
import { onlyofficeConfigured, onlyofficeEditable } from "@/lib/onlyoffice";
import { getFieldDefs } from "@/lib/custom-fields";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CustomFieldsCard } from "@/components/shared/custom-fields-card";
import { formatDateTime } from "@/lib/utils";
import { FileViewer } from "./file-viewer";
import { SharePanel, type ShareItem } from "./share-panel";
import { UploadButton } from "../upload-button";

function humanSize(n: number): string {
  if (!n) return "—";
  const u = ["o", "Ko", "Mo", "Go"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(i ? 1 : 0)} ${u[i]}`;
}

export default async function DriveFilePage({ params }: { params: { id: string } }) {
  const user = await requireModule("DRIVE");
  const level = await resolveDriveAccess(user, params.id);
  if (level === "NONE") notFound();
  const canEdit = level === "EDIT";

  const node = await prisma.driveNode.findUnique({
    where: { id: params.id },
    include: {
      owner: { select: { name: true } },
      shares: { include: { user: { select: { id: true, name: true } } } },
      versions: { orderBy: { version: "desc" }, take: 20 },
    },
  });
  if (!node) notFound();
  if (node.type === "FOLDER") redirect(`/drive?folder=${node.id}`);

  const [fieldDefs, users] = await Promise.all([
    getFieldDefs("DRIVE_NODE"),
    canEdit
      ? prisma.user.findMany({ where: { isActive: true, id: { not: user.id } }, select: { id: true, name: true }, orderBy: { name: "asc" } })
      : Promise.resolve([] as { id: string; name: string }[]),
  ]);

  const sharedIds = new Set(node.shares.map((s) => s.userId));
  const shareUsers = users.filter((u) => !sharedIds.has(u.id));
  const shareItems: ShareItem[] = node.shares.map((s) => ({ userId: s.userId, name: s.user?.name ?? "—", access: s.access }));
  const kind = fileKind(node.mimeType, node.name);

  return (
    <div className="space-y-5">
      <Link href={node.parentId ? `/drive?folder=${node.parentId}` : "/drive"} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Retour au Drive
      </Link>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold tracking-tight">{node.name}</h1>
          <p className="text-sm text-muted-foreground">{humanSize(node.size)} · {node.mimeType || "fichier"}</p>
        </div>
        <div className="flex items-center gap-2">
          {canEdit && onlyofficeConfigured() && onlyofficeEditable(node.name) && (
            <Link href={`/drive/${node.id}/edit`}>
              <Button><PencilLine className="h-4 w-4" /> Éditer dans Office</Button>
            </Link>
          )}
          {canEdit && <UploadButton nodeId={node.id} label="Nouvelle version" />}
          <a href={`/api/drive/${node.id}/raw?dl=1`}>
            <Button variant="outline"><Download className="h-4 w-4" /> Télécharger</Button>
          </a>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <FileViewer id={node.id} name={node.name} kind={kind} />
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader><CardTitle>Informations</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row label="Propriétaire" value={node.owner?.name ?? "—"} />
              <Row label="Taille" value={humanSize(node.size)} />
              <Row label="Type" value={node.mimeType || "—"} />
              <Row label="Modifié" value={formatDateTime(node.updatedAt)} />
              <Row label="Versions" value={String(node.versions.length)} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Partage</CardTitle></CardHeader>
            <CardContent>
              <SharePanel nodeId={node.id} users={shareUsers} shares={shareItems} canEdit={canEdit} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Historique des versions</CardTitle></CardHeader>
            <CardContent className="space-y-1.5 text-sm">
              {node.versions.map((v, i) => (
                <div key={v.id} className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    v{v.version}
                    {i === 0 && <Badge tone="success" dot={false}>actuelle</Badge>}
                  </span>
                  <span className="text-muted-foreground">{humanSize(v.size)} · {formatDateTime(v.createdAt)}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Champs personnalisés</CardTitle></CardHeader>
            <CardContent>
              <CustomFieldsCard
                entityType="DRIVE_NODE"
                entityId={node.id}
                defs={fieldDefs.map((f) => ({ id: f.id, key: f.key, label: f.label, type: f.type, options: f.options }))}
                values={(node.custom as Record<string, unknown>) ?? {}}
                canEdit={canEdit}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
