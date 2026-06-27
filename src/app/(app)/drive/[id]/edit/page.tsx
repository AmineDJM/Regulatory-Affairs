import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, AlertCircle } from "lucide-react";
import { requireUser } from "@/lib/session";
import { resolveDriveAccess } from "@/lib/drive";
import { prisma } from "@/lib/prisma";
import {
  onlyofficeConfigured, onlyofficeServerUrl, appBaseUrl, onlyofficeDocType, fileExt, makeEditToken, signJwt,
} from "@/lib/onlyoffice";
import { OfficeEditor } from "./office-editor";

export const dynamic = "force-dynamic";

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-lg space-y-3 py-10">
      <Link href="/drive" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Retour au Drive
      </Link>
      <div className="flex items-start gap-2 rounded-lg border border-border bg-secondary/40 px-4 py-3 text-sm">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /> <div>{children}</div>
      </div>
    </div>
  );
}

export default async function DriveEditPage({ params }: { params: { id: string } }) {
  const user = await requireUser();

  if (!onlyofficeConfigured()) {
    return <Notice>L'éditeur Office n'est pas configuré. Définissez <code>ONLYOFFICE_URL</code> (URL publique du Document Server) et <code>ONLYOFFICE_JWT_SECRET</code> côté serveur.</Notice>;
  }
  const base = appBaseUrl();
  if (!base) {
    return <Notice>L'URL publique de l'application (<code>APP_URL</code>) n'est pas définie : le Document Server doit pouvoir joindre l'application.</Notice>;
  }

  const access = await resolveDriveAccess(user, params.id);
  if (access !== "EDIT") return <Notice>Vous n'avez pas le droit de modifier ce fichier.</Notice>;

  const node = await prisma.driveNode.findUnique({ where: { id: params.id }, select: { name: true, type: true } });
  if (!node || node.type !== "FILE") notFound();

  const docType = onlyofficeDocType(node.name);
  if (!docType) return <Notice>Ce type de fichier n'est pas éditable dans l'éditeur Office.</Notice>;

  const last = await prisma.fileVersion.findFirst({ where: { nodeId: params.id }, orderBy: { version: "desc" }, select: { version: true } });
  const editToken = makeEditToken(params.id, user.id);
  // `key` change à chaque version → invalide le cache du Document Server après sauvegarde.
  const key = `${params.id}_${last?.version ?? 1}`;

  const config: Record<string, unknown> = {
    documentType: docType,
    document: {
      fileType: fileExt(node.name),
      key,
      title: node.name,
      url: `${base}/api/onlyoffice/file?token=${editToken}`,
      permissions: { edit: true, download: true, print: true },
    },
    editorConfig: {
      mode: "edit",
      lang: "fr",
      callbackUrl: `${base}/api/onlyoffice/callback?id=${params.id}&token=${editToken}`,
      user: { id: user.id, name: user.name },
      customization: { autosave: true, forcesave: true },
    },
    width: "100%",
    height: "100%",
  };
  const signed = { ...config, token: signJwt(config, 24 * 3600) };

  return <OfficeEditor apiJs={`${onlyofficeServerUrl()}/web-apps/apps/api/documents/api.js`} config={signed} name={node.name} />;
}
