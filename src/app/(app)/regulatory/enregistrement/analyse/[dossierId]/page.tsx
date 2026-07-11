import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft, Download, FileText, ShieldCheck, ShieldAlert, ShieldX, Layers, History, Eye,
  CheckCircle2, XCircle, AlertTriangle, Info, ListChecks, Gauge, Bot, GitCompare, MailWarning, FlaskConical,
} from "lucide-react";
import type { RegFindingSeverity } from "@prisma/client";
import { requireModule } from "@/lib/session";
import { getCompanyScope } from "@/lib/company";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { regCan, resolveRegCompanyId } from "@/lib/regulatory/intelligence/access";
import { getDossier, listVersions, listVersionDocuments, listDossierAudit, getAssessment, listFindings, listFacts, listConflicts } from "@/lib/regulatory/intelligence/queries";
import { buildCoverage } from "@/lib/regulatory/intelligence/twin/build-twin";
import { buildVersionDiff } from "@/lib/regulatory/intelligence/diff/compare-versions";
import { aiConfigured } from "@/lib/ai";
import { applicableAgents } from "@/lib/regulatory/intelligence/agents/orchestrator";
import { templateSummaries } from "@/lib/regulatory/intelligence/docgen/templates";
import { listReserveCycles } from "@/lib/regulatory/intelligence/reserves/queries";
import { prisma } from "@/lib/prisma";
import { TwinPanel } from "./twin-panel";
import { AgentsPanel } from "./agents-panel";
import { DocgenPanel } from "./docgen-panel";
import { ReservesPanel } from "./reserves-panel";
import { SimulatorPanel } from "./simulator-panel";
import type { SimPerspective } from "@/lib/regulatory/intelligence/simulator/run";
import {
  PROCEDURE_TYPE_LABELS, DOSSIER_STATUS_LABELS, DOSSIER_STATUS_TONE,
  SECURITY_LABELS, EXTRACTION_LABELS, humanBytes, isBlockedSecurity,
} from "@/lib/regulatory/intelligence/labels";
import type { RegDocSecurityStatus } from "@prisma/client";
import { CtdUpload } from "./ctd-upload";
import { DeleteDossierButton } from "./dossier-actions";
import { FindingControls } from "./finding-actions";
import { SubmissionGate } from "./submission-gate";
import { ApproveNameButton } from "./approve-name";

export const dynamic = "force-dynamic";

const fmtDateTime = (d: Date) =>
  new Date(d).toLocaleString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

function securityIcon(s: RegDocSecurityStatus) {
  if (s === "SAFE") return <ShieldCheck className="h-3.5 w-3.5 text-success" />;
  if (s === "SUSPICIOUS") return <ShieldAlert className="h-3.5 w-3.5 text-amber-600" />;
  return <ShieldX className="h-3.5 w-3.5 text-destructive" />;
}

const INLINE_EXT = new Set(["pdf", "png", "jpg", "jpeg", "gif", "webp", "txt", "csv", "xml"]);

const SEVERITY_META: Record<RegFindingSeverity, { label: string; cls: string; Icon: typeof XCircle }> = {
  CRITICAL: { label: "Critique", cls: "border-destructive/40 bg-destructive/5 text-destructive", Icon: XCircle },
  MAJOR: { label: "Majeur", cls: "border-amber-500/40 bg-amber-500/5 text-amber-600", Icon: AlertTriangle },
  MINOR: { label: "Mineur", cls: "border-blue-500/30 bg-blue-500/5 text-blue-600", Icon: Info },
  INFO: { label: "Info", cls: "border-border bg-muted/40 text-muted-foreground", Icon: Info },
};

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
  const assessment = latest ? await getAssessment(latest.id) : null;
  const findings = latest ? await listFindings(latest.id) : [];
  const facts = latest ? await listFacts(latest.id) : [];
  const conflicts = latest ? await listConflicts(latest.id) : [];
  const coverage = latest ? buildCoverage(dossier.procedureType, documents) : [];
  const agents = latest ? await applicableAgents(latest.id) : [];
  const diff = versions.length > 1 ? await buildVersionDiff(dossier.id) : null;
  const generatedDocs = latest
    ? (await prisma.regulatoryGeneratedDoc.findMany({
        where: { dossierVersionId: latest.id }, orderBy: { createdAt: "desc" }, take: 20,
        select: { id: true, filename: true, templateVersion: true, factsUsed: true, factsMissing: true, createdAt: true },
      })).map((d) => ({ ...d, createdAt: d.createdAt.toISOString() }))
    : [];
  const docTemplates = templateSummaries();
  const reserveCycles = (await listReserveCycles(dossier.id)).map((c) => ({ ...c, receivedAt: c.receivedAt.toISOString() }));
  const canReserve = regCan(user, "regulatory.reserve.manage");
  const lastSimRow = latest
    ? await prisma.regulatorySimulation.findFirst({ where: { dossierVersionId: latest.id, configured: true }, orderBy: { createdAt: "desc" }, select: { perspectives: true, overall: true, createdAt: true } })
    : null;
  const lastSim = lastSimRow
    ? { perspectives: lastSimRow.perspectives as unknown as SimPerspective[], overall: lastSimRow.overall, createdAt: lastSimRow.createdAt.toISOString() }
    : null;
  const audit = await listDossierAudit(dossier.id);

  const canUpload = regCan(user, "regulatory.dossier.upload");
  const canDelete =
    user.role === "SUPER_ADMIN" || regCan(user, "regulatory.admin") ||
    regCan(user, "regulatory.workspace.manage") || dossier.createdById === user.id;
  const canView = regCan(user, "regulatory.document.view");
  const canEditFinding = regCan(user, "regulatory.finding.edit");
  const canApproveFinding = regCan(user, "regulatory.finding.approve");
  const canApproveDoc = regCan(user, "regulatory.document.approve");
  const canPrepare = regCan(user, "regulatory.submission.prepare");
  const canApproveSubmission = regCan(user, "regulatory.submission.approve");
  const canAnalyse = regCan(user, "regulatory.dossier.analyse");
  const openBlockers = findings.filter((f) => f.blocker && (f.status === "OPEN" || f.status === "ACKNOWLEDGED")).length;

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
            {(() => {
              const extracted = documents.filter((d) => d.extractionStatus === "TEXT_EXTRACTED" || d.extractionStatus === "OCR_COMPLETED").length;
              const ocr = documents.filter((d) => d.extractionStatus === "OCR_REQUIRED").length;
              const pending = documents.filter((d) => d.extractionStatus === "PENDING").length;
              return (
                <p className="mb-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span>Texte extrait : <span className="font-medium text-foreground">{extracted}</span></span>
                  {ocr > 0 && <span>OCR requis (scans) : <span className="font-medium text-amber-600">{ocr}</span></span>}
                  {pending > 0 && <span>En attente d'extraction : <span className="font-medium">{pending}</span></span>}
                </p>
              );
            })()}
            {latest.originalSha256 && (
              <p className="mb-2 truncate font-mono text-[11px] text-muted-foreground" title={latest.originalSha256}>
                SHA-256 archive : {latest.originalSha256}
              </p>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="py-1.5 pr-3 font-medium">Fichier &amp; nom proposé</th>
                    <th className="py-1.5 pr-3 font-medium">Classement CTD</th>
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
                          <span className="block max-w-[22rem] truncate font-medium" title={doc.originalPath}>{doc.originalFilename}</span>
                          {doc.approvedFilename ? (
                            <span className="block max-w-[22rem] truncate text-[11px] text-success" title={doc.approvedFilename}>✓ {doc.approvedFilename}</span>
                          ) : doc.suggestedFilename && !blocked ? (
                            <span className="flex items-center gap-1.5">
                              <span className="min-w-0 max-w-[18rem] truncate text-[11px] text-primary" title={doc.suggestedFilename}>→ {doc.suggestedFilename}</span>
                              {canApproveDoc && <ApproveNameButton documentId={doc.id} />}
                            </span>
                          ) : null}
                        </td>
                        <td className="py-1.5 pr-3">
                          {blocked ? (
                            <span className="text-xs text-muted-foreground">—</span>
                          ) : doc.ctdSection ? (
                            <span className="inline-flex flex-col">
                              <span className="text-xs font-medium">{doc.ctdSection}</span>
                              <span className="max-w-[12rem] truncate text-[11px] text-muted-foreground" title={`${doc.ctdModule ?? ""} — confiance ${Math.round((doc.ctdConfidence ?? 0) * 100)}%`}>
                                {doc.ctdModule} · {Math.round((doc.ctdConfidence ?? 0) * 100)}%
                              </span>
                            </span>
                          ) : doc.ctdModule ? (
                            <span className="text-xs text-muted-foreground">{doc.ctdModule} · à préciser</span>
                          ) : (
                            <span className="text-xs text-amber-600">non classé</span>
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

      {/* Bilan de conformité (moteur déterministe) */}
      {assessment && (
        <Card className={assessment.conforme ? "border-success/40" : "border-destructive/40"}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Gauge className="h-4 w-4 text-primary" /> Bilan de complétude &amp; conformité</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-4">
              <div>
                <p className="text-3xl font-semibold">{assessment.completeness}%</p>
                <p className="text-xs text-muted-foreground">Complétude ({assessment.requiredPresent}/{assessment.requiredTotal} sections obligatoires)</p>
              </div>
              <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium ${assessment.conforme ? "border-success/40 bg-success/10 text-success" : "border-destructive/40 bg-destructive/10 text-destructive"}`}>
                {assessment.conforme ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                {assessment.conforme ? "Aucun bloqueur détecté" : `${assessment.blockers} bloqueur·s — non conforme en l'état`}
              </div>
              <div className="flex gap-2 text-xs">
                {assessment.criticals > 0 && <span className="rounded-md bg-destructive/10 px-2 py-1 text-destructive">{assessment.criticals} critique·s</span>}
                {assessment.majors > 0 && <span className="rounded-md bg-amber-500/10 px-2 py-1 text-amber-600">{assessment.majors} majeur·s</span>}
                {assessment.minors > 0 && <span className="rounded-md bg-blue-500/10 px-2 py-1 text-blue-600">{assessment.minors} mineur·s</span>}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Un score élevé ne vaut pas conformité : tout <strong>bloqueur</strong> (section obligatoire manquante, dossier vide) prime.
              Ce bilan est une <strong>aide</strong> — la décision finale revient au pharmacien directeur technique.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Porte de soumission */}
      {latest && (canPrepare || canApproveSubmission || canAnalyse) && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="h-4 w-4 text-primary" /> Porte de soumission</CardTitle></CardHeader>
          <CardContent>
            <SubmissionGate
              dossierId={dossier.id} status={dossier.status} openBlockers={openBlockers}
              canPrepare={canPrepare} canApprove={canApproveSubmission} canAnalyse={canAnalyse}
            />
          </CardContent>
        </Card>
      )}

      {/* Couverture CTD (jumeau numérique) */}
      {coverage.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><ListChecks className="h-4 w-4 text-primary" /> Couverture CTD attendue</CardTitle></CardHeader>
          <CardContent>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {coverage.map((row) => (
                <div key={`${row.kind}-${row.code}`} className="flex items-center gap-2 rounded-md border border-border/60 px-2.5 py-1.5 text-sm">
                  {row.present ? <CheckCircle2 className="h-4 w-4 shrink-0 text-success" /> : <XCircle className={`h-4 w-4 shrink-0 ${row.kind === "required" ? "text-destructive" : "text-amber-600"}`} />}
                  <span className="font-medium">{row.code}</span>
                  <span className="min-w-0 flex-1 truncate text-muted-foreground" title={row.title}>{row.title}</span>
                  {row.kind === "required" && <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground/70">obligatoire</span>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Agents spécialisés (revue de fond IA — PROJET, sur demande) */}
      {latest && agents.length > 0 && canAnalyse && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Bot className="h-4 w-4 text-primary" /> Agents spécialisés — revue de fond (PROJET)</CardTitle>
          </CardHeader>
          <CardContent>
            <AgentsPanel dossierId={dossier.id} agents={agents} configured={aiConfigured()} />
          </CardContent>
        </Card>
      )}

      {/* Jumeau numérique — faits sourcés + conflits */}
      {latest && (facts.length > 0 || conflicts.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Layers className="h-4 w-4 text-primary" /> Jumeau numérique — faits réglementaires</CardTitle>
            <p className="text-xs text-muted-foreground">Faits extraits (avec preuve sourcée), conflits entre documents, et revue humaine. Valeurs proposées — à confirmer/corriger.</p>
          </CardHeader>
          <CardContent>
            <TwinPanel
              facts={facts.map((f) => ({ ...f, occurrences: f.occurrences }))}
              conflicts={conflicts.map((c) => ({ ...c, values: (c.values as unknown as { value: string; documentId: string; sectionCode: string | null; extract: string; confidence: number }[]) }))}
              canEdit={canEditFinding}
              canApprove={canApproveFinding}
            />
          </CardContent>
        </Card>
      )}

      {/* Constats */}
      {findings.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><AlertTriangle className="h-4 w-4 text-primary" /> Constats ({findings.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {findings.map((f) => {
              const meta = SEVERITY_META[f.severity];
              return (
                <div key={f.id} className={`rounded-lg border px-3 py-2 ${meta.cls}`}>
                  <div className="flex items-start gap-2">
                    <meta.Icon className="mt-0.5 h-4 w-4 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-foreground">{f.title}</span>
                        {f.blocker && <span className="rounded bg-destructive px-1.5 py-0.5 text-[10px] font-semibold text-white">BLOQUEUR</span>}
                        {f.source === "AI" && f.draft && <span className="rounded bg-amber-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">PROJET IA — REVUE REQUISE</span>}
                        {f.source === "HUMAN" && <span className="rounded bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-white">HUMAIN</span>}
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">{f.detail}</p>
                      {f.evidence && <p className="mt-0.5 text-[11px] italic text-muted-foreground/80">Preuve : {f.evidence}</p>}
                      <FindingControls findingId={f.id} status={f.status} blocker={f.blocker} canEdit={canEditFinding} canApprove={canApproveFinding} />
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Génération documentaire — depuis le jumeau numérique approuvé */}
      {latest && canAnalyse && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><FileText className="h-4 w-4 text-primary" /> Génération documentaire</CardTitle>
          </CardHeader>
          <CardContent>
            <DocgenPanel dossierId={dossier.id} templates={docTemplates} docs={generatedDocs} />
          </CardContent>
        </Card>
      )}

      {/* Reviewer Simulator — stress test multi-perspectives (simulation non prédictive) */}
      {latest && canAnalyse && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><FlaskConical className="h-4 w-4 text-primary" /> Simulateur d'examen (multi-perspectives)</CardTitle>
          </CardHeader>
          <CardContent>
            <SimulatorPanel dossierId={dossier.id} last={lastSim} />
          </CardContent>
        </Card>
      )}

      {/* Réserves ANPP — lettre océrisée, points décomposés, réponses */}
      {(canReserve || reserveCycles.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><MailWarning className="h-4 w-4 text-primary" /> Réserves ANPP</CardTitle>
          </CardHeader>
          <CardContent>
            <ReservesPanel dossierId={dossier.id} cycles={reserveCycles} canManage={canReserve} />
          </CardContent>
        </Card>
      )}

      {/* Comparaison V1/V2 — ce qui a changé entre les deux dernières versions */}
      {diff && diff.hasOld && (diff.summary.added + diff.summary.removed + diff.summary.replaced + diff.summary.factsChanged > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><GitCompare className="h-4 w-4 text-primary" /> Comparaison v{diff.oldVersionNo} → v{diff.newVersionNo}</CardTitle>
            <p className="text-xs text-muted-foreground">
              Fichiers remplacés/ajoutés/supprimés (identité par chemin, contenu par SHA-256) et évolution des faits.
              Concentrez la ré-évaluation sur ces changements — la décision reste humaine.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2 text-xs">
              {diff.summary.replaced > 0 && <span className="rounded-md bg-amber-500/10 px-2 py-1 text-amber-600">{diff.summary.replaced} remplacé·s</span>}
              {diff.summary.added > 0 && <span className="rounded-md bg-success/10 px-2 py-1 text-success">{diff.summary.added} ajouté·s</span>}
              {diff.summary.removed > 0 && <span className="rounded-md bg-destructive/10 px-2 py-1 text-destructive">{diff.summary.removed} supprimé·s</span>}
              <span className="rounded-md bg-muted px-2 py-1 text-muted-foreground">{diff.summary.unchanged} inchangé·s</span>
              {diff.summary.factsChanged > 0 && <span className="rounded-md bg-blue-500/10 px-2 py-1 text-blue-600">{diff.summary.factsChanged} fait·s modifié·s</span>}
            </div>

            {diff.files.some((fl) => fl.status !== "unchanged") && (
              <div className="space-y-1">
                {diff.files.filter((fl) => fl.status !== "unchanged").map((fl) => (
                  <div key={`${fl.status}-${fl.path}`} className="flex items-center gap-2 rounded-md border border-border/60 px-2.5 py-1.5 text-xs">
                    <span className={`rounded px-1.5 py-0.5 font-medium ${fl.status === "replaced" ? "bg-amber-500/10 text-amber-600" : fl.status === "added" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
                      {fl.status === "replaced" ? "Remplacé" : fl.status === "added" ? "Ajouté" : "Supprimé"}
                    </span>
                    <span className="min-w-0 flex-1 truncate" title={fl.path}>{fl.filename}</span>
                    {fl.ctdSection && <span className="shrink-0 text-muted-foreground">{fl.ctdSection}</span>}
                  </div>
                ))}
              </div>
            )}

            {diff.facts.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Faits réglementaires</p>
                {diff.facts.map((ft) => (
                  <div key={ft.factKey} className="flex flex-wrap items-center gap-2 rounded-md border border-border/60 px-2.5 py-1.5 text-xs">
                    <span className={`rounded px-1.5 py-0.5 ${ft.status === "changed" ? "bg-blue-500/10 text-blue-600" : ft.status === "added" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
                      {ft.status === "changed" ? "Modifié" : ft.status === "added" ? "Ajouté" : "Supprimé"}
                    </span>
                    <span className="font-medium">{ft.label}</span>
                    {ft.status === "changed" && <span className="text-muted-foreground">{ft.oldValue ?? "—"} → <span className="text-foreground">{ft.newValue ?? "—"}</span></span>}
                    {ft.status === "added" && <span className="text-foreground">{ft.newValue}</span>}
                    {ft.status === "removed" && <span className="text-muted-foreground line-through">{ft.oldValue}</span>}
                  </div>
                ))}
              </div>
            )}
            {canAnalyse && <p className="text-xs text-muted-foreground">Relancez les contrôles pour ré-évaluer la nouvelle version (les décisions humaines sur les constats sont conservées).</p>}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><GitCompare className="h-4 w-4 text-primary" /> Comparaison v{diff.oldVersionNo} → v{diff.newVersionNo}</CardTitle></CardHeader>
          <CardContent><p className="text-sm text-muted-foreground">Aucune différence de fichier ni de fait entre ces deux versions.</p></CardContent>
        </Card>
      ))}

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
