import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft, Download, FileText, ShieldCheck, ShieldAlert, ShieldX, Layers, History, Eye,
} from "lucide-react";
import { requireModule } from "@/lib/session";
import { getCompanyScope } from "@/lib/company";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { regCan, resolveRegCompanyId } from "@/lib/regulatory/intelligence/access";
import { getDossier, listVersions, listVersionDocuments, listDossierAudit } from "@/lib/regulatory/intelligence/queries";
import {
  PROCEDURE_TYPE_LABELS, DOSSIER_STATUS_LABELS, DOSSIER_STATUS_TONE,
  SECURITY_LABELS, EXTRACTION_LABELS, humanBytes, isBlockedSecurity,
} from "@/lib/regulatory/intelligence/labels";
import type { RegDocSecurityStatus } from "@prisma/client";
import { CtdUpload } from "./ctd-upload";
import { DeleteDossierButton } from "./dossier-actions";

export const dynamic = "force-dynamic";

const fmtDateTime = (d: Date) =>
  new Date(d).toLocaleString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

function securityIcon(s: RegDocSecurityStatus) {
  if (s === "SAFE") return <ShieldCheck className="h-3.5 w-3.5 text-success" />;
  if (s === "SUSPICIOUS") return <ShieldAlert className="h-3.5 w-3.5 text-amber-600" />;
  return <ShieldX className="h-3.5 w-3.5 text-destructive" />;
}

const INLINE_EXT = new Set(["pdf", "png", "jpg", "jpeg", "gif", "webp", "txt", "csv", "xml"]);

export default async function DossierDetailPage({ params }: { params: { dossierId: string } }) {
  const user = await requireModule("REGULATORY");
  if (!regCan(user, "regulatory.workspace.view")) notFound();

  const companyId = await resolveRegCompanyId(getCompanyScope());
  if (!companyId) notFound();

  const dossier = await getDossier(companyId, params.dossierId);
  if (!dossier) notFound();

  const versions = await listVersions(dossier.id);
  const latest = versions[0];
  const documents = latest ? await listVersionDocuments(latest.id) : [];
  const audit = await listDossierAudit(dossier.id);

  const canUpload = regCan(user, "regulatory.dossier.upload");
  const canDelete =
    user.role === "SUPER_ADMIN" || regCan(user, "regulatory.admin") ||
    regCan(user, "regulatory.workspace.manage") || dossier.createdById === user.id;
  const canView = regCan(user, "regulatory.document.view");

  return (
    <div className="space-y-5">
      <Link href="/regulatory/enregistrement/analyse" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Retour aux dossiers
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader title={dossier.title} description={`${dossier.reference} · ${PROCEDURE_TYPE_LABELS[dossier.procedureType]}`} />
        <div className="flex items-center gap-2">
          <Badge tone={DOSSIER_STATUS_TONE[dossier.status]} dot>{DOSSIER_STATUS_LABELS[dossier.status]}</Badge>
          {canDelete && <DeleteDossierButton dossierId={dossier.id} />}
        </div>
      </div>

      {/* Téléversement du dossier CTD (ZIP) */}
      {canUpload && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Layers className="h-4 w-4 text-primary" /> {versions.length === 0 ? "Téléverser le dossier CTD (ZIP)" : "Nouvelle version du dossier (ZIP)"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CtdUpload dossierId={dossier.id} />
          </CardContent>
        </Card>
      )}

      {/* Manifeste de la dernière version */}
      {latest && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4 text-primary" /> Manifeste — version {latest.versionNo}
            </CardTitle>
            <div className="flex items-center gap-3 text-xs">
              <span className="text-success">{latest.counts.safe} sain·s</span>
              {latest.counts.suspicious > 0 && <span className="text-amber-600">{latest.counts.suspicious} à vérifier</span>}
              {latest.counts.blocked > 0 && <span className="text-destructive">{latest.counts.blocked} bloqué·s</span>}
              {canView && latest.originalZipBlobId && (
                <Link href={`/api/regulatory/intelligence/version/${latest.id}/original`}
                  className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 font-medium hover:bg-accent">
                  <Download className="h-3.5 w-3.5" /> Archive originale
                </Link>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {latest.originalSha256 && (
              <p className="mb-2 truncate font-mono text-[11px] text-muted-foreground" title={latest.originalSha256}>
                SHA-256 archive : {latest.originalSha256}
              </p>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="py-1.5 pr-3 font-medium">Fichier (chemin d'origine)</th>
                    <th className="py-1.5 pr-3 font-medium">Taille</th>
                    <th className="py-1.5 pr-3 font-medium">Sécurité</th>
                    <th className="py-1.5 pr-3 font-medium">Extraction</th>
                    <th className="py-1.5 font-medium text-right">Aperçu</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map((doc) => {
                    const blocked = isBlockedSecurity(doc.securityStatus);
                    const canPreview = canView && !!doc.blobId && !blocked;
                    const inline = INLINE_EXT.has(doc.ext.toLowerCase());
                    return (
                      <tr key={doc.id} className="border-b border-border/60 align-top">
                        <td className="py-1.5 pr-3">
                          <span className="block truncate font-medium" title={doc.originalPath}>{doc.originalFilename}</span>
                          {doc.originalPath !== doc.originalFilename && (
                            <span className="block truncate text-[11px] text-muted-foreground" title={doc.originalPath}>{doc.originalPath}</span>
                          )}
                        </td>
                        <td className="py-1.5 pr-3 whitespace-nowrap text-muted-foreground">{humanBytes(doc.sizeBytes)}</td>
                        <td className="py-1.5 pr-3">
                          <span className="inline-flex items-center gap-1 whitespace-nowrap text-xs">{securityIcon(doc.securityStatus)} {SECURITY_LABELS[doc.securityStatus]}</span>
                        </td>
                        <td className="py-1.5 pr-3 whitespace-nowrap text-xs text-muted-foreground">{blocked ? "—" : EXTRACTION_LABELS[doc.extractionStatus]}</td>
                        <td className="py-1.5 text-right">
                          {canPreview ? (
                            <Link href={`/api/regulatory/intelligence/document/${doc.id}${inline ? "?inline=1" : ""}`}
                              target="_blank" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                              {inline ? <Eye className="h-3.5 w-3.5" /> : <Download className="h-3.5 w-3.5" />} {inline ? "Voir" : "Télécharger"}
                            </Link>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Historique des versions */}
      {versions.length > 1 && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><History className="h-4 w-4 text-primary" /> Versions</CardTitle></CardHeader>
          <CardContent className="space-y-1.5">
            {versions.map((v) => (
              <div key={v.id} className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                <span className="font-medium">Version {v.versionNo}{v.label ? ` — ${v.label}` : ""}</span>
                <span className="text-xs text-muted-foreground">{v.fileCount} fichier·s · {humanBytes(v.totalBytes)} · {fmtDateTime(v.createdAt)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Journal d'audit */}
      {audit.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><History className="h-4 w-4 text-primary" /> Journal d'audit</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            {audit.map((a) => (
              <div key={a.id} className="flex items-start justify-between gap-3 border-b border-border/50 py-1.5 text-xs last:border-0">
                <span className="text-muted-foreground">{a.detail}</span>
                <span className="shrink-0 whitespace-nowrap text-muted-foreground/70">{fmtDateTime(a.createdAt)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
