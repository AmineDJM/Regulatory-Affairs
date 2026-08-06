import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft, Download, FileText, ShieldCheck, ShieldAlert, ShieldX, Layers, History, Eye,
  CheckCircle2, XCircle, AlertTriangle, Info, ListChecks, Gauge, Bot, GitCompare, MailWarning, FlaskConical, Factory, MessagesSquare, Library, Coins,
} from "lucide-react";
import type { RegFindingSeverity } from "@prisma/client";
import { requireModule } from "@/lib/session";
import { getCompanyScope } from "@/lib/company";
import { PageHeader } from "@/components/shared/page-header";
import { ReminderButton } from "@/components/reminders/reminder-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { regCan, resolveRegCompanyId } from "@/lib/regulatory/intelligence/access";
import { getDossier, listVersions, listVersionDocuments, listDossierAudit, getAssessment, listFindings, listFacts, listConflicts, reservesByIds, documentNamesByIds } from "@/lib/regulatory/intelligence/queries";
import { findingQuality } from "@/lib/regulatory/intelligence/findings/enrich";
import { buildCoverage, buildRegistrationDocs } from "@/lib/regulatory/intelligence/twin/build-twin";
import { buildVersionDiff } from "@/lib/regulatory/intelligence/diff/compare-versions";
import { aiConfigured } from "@/lib/ai";
import { applicableAgents } from "@/lib/regulatory/intelligence/agents/orchestrator";
import { templateSummaries } from "@/lib/regulatory/intelligence/docgen/templates";
import { listReserveCycles } from "@/lib/regulatory/intelligence/reserves/queries";
import { listSupplierRequests } from "@/lib/regulatory/intelligence/supplier/queries";
import { listLifecycle } from "@/lib/regulatory/intelligence/lifecycle/queries";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/utils";
import { dossierCost } from "@/lib/regulatory/intelligence/cost/ledger";
import { BudgetForm, DeferredReviewButton } from "./cost-panel";
import { TwinPanel } from "./twin-panel";
import { AgentsPanel } from "./agents-panel";
import { DossierChatPanel } from "./chat-panel";
import { ReserveChatPanel } from "./reserve-chat-panel";
import { DocgenPanel } from "./docgen-panel";
import { ReservesPanel } from "./reserves-panel";
import { SimulatorPanel } from "./simulator-panel";
import { SupplierPanel } from "./supplier-panel";
import { LifecyclePanel } from "./lifecycle-panel";
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
  // Réserves ANPP rapprochées et noms des documents visés : chargés EN UNE FOIS chacun
  // (sinon une requête par constat).
  const [reservesById, findingDocNames] = await Promise.all([
    reservesByIds(findings.flatMap((f) => f.similarReserveIds)),
    documentNamesByIds(findings.map((f) => f.documentId)),
  ]);
  const facts = latest ? await listFacts(latest.id) : [];
  const conflicts = latest ? await listConflicts(latest.id) : [];
  const coverage = latest ? buildCoverage(dossier.procedureType, documents) : [];
  const registrationDocs = latest ? buildRegistrationDocs(documents) : [];
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
  const supplierRequests = (await listSupplierRequests(dossier.id)).map((r) => ({
    ...r, deadline: r.deadline?.toISOString() ?? null, sentAt: r.sentAt?.toISOString() ?? null,
    remindedAt: r.remindedAt?.toISOString() ?? null, respondedAt: r.respondedAt?.toISOString() ?? null,
  }));
  const canSupplier = regCan(user, "regulatory.workspace.manage") || regCan(user, "regulatory.dossier.upload");
  const lifecycle = await listLifecycle(dossier.id);
  const lifecycleEvents = lifecycle.events.map((e) => ({ ...e, effectiveDate: e.effectiveDate?.toISOString() ?? null, createdAt: e.createdAt.toISOString() }));
  const obligations = lifecycle.obligations.map((o) => ({ ...o, dueDate: o.dueDate?.toISOString() ?? null }));
  const lastSimRow = latest
    ? await prisma.regulatorySimulation.findFirst({ where: { dossierVersionId: latest.id, configured: true }, orderBy: { createdAt: "desc" }, select: { perspectives: true, overall: true, createdAt: true } })
    : null;
  const lastSim = lastSimRow
    ? { perspectives: lastSimRow.perspectives as unknown as SimPerspective[], overall: lastSimRow.overall, createdAt: lastSimRow.createdAt.toISOString() }
    : null;
  const audit = await listDossierAudit(dossier.id);
  const cost = await dossierCost(dossier.id);
  // Plafond PROPRE au dossier (distinct du plafond global) : le formulaire doit refléter ce
  // qui est réellement stocké, pas la valeur globale héritée.
  const dossierBudget = (await prisma.regulatoryDossier.findUnique({ where: { id: dossier.id }, select: { aiBudgetUsd: true } }))?.aiBudgetUsd;
  // Un lot différé en cours : l'écran doit le DIRE, sinon on relance et on paie deux fois.
  const pendingBatchRow = latest
    ? await prisma.regulatoryAiBatch.findFirst({
        where: { dossierVersionId: latest.id, status: { in: ["submitted", "validating", "in_progress", "finalizing"] } },
        orderBy: { submittedAt: "desc" },
        select: { requestCount: true, submittedAt: true },
      })
    : null;
  const pendingBatch = pendingBatchRow ? { requestCount: pendingBatchRow.requestCount, submittedAt: pendingBatchRow.submittedAt.toISOString() } : null;

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
          <ReminderButton defaultTitle={`Dossier ${dossier.reference} — ${dossier.title}`} link={`/regulatory/enregistrement/analyse/${dossier.id}`} />
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
              <p className="mb-2 truncate font-mono text-[0.6875rem] text-muted-foreground" title={latest.originalSha256}>
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
                            <span className="block max-w-[22rem] truncate text-[0.6875rem] text-success" title={doc.approvedFilename}>✓ {doc.approvedFilename}</span>
                          ) : doc.suggestedFilename && !blocked ? (
                            <span className="flex items-center gap-1.5">
                              <span className="min-w-0 max-w-[18rem] truncate text-[0.6875rem] text-primary" title={doc.suggestedFilename}>→ {doc.suggestedFilename}</span>
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
                              <span className="max-w-[12rem] truncate text-[0.6875rem] text-muted-foreground" title={`${doc.ctdModule ?? ""} — confiance ${Math.round((doc.ctdConfidence ?? 0) * 100)}%`}>
                                {doc.ctdModule} · {Math.round((doc.ctdConfidence ?? 0) * 100)}%
                              </span>
                            </span>
                          ) : doc.ctdModule ? (
                            <span className="text-xs text-muted-foreground">{doc.ctdModule} · à préciser</span>
                          ) : (
                            <span className="text-xs text-amber-600">non classé</span>
                          )}
                          {!blocked && doc.containedSections.filter((s) => s !== doc.ctdSection).length > 0 && (
                            <span className="mt-0.5 block max-w-[13rem] truncate text-[0.6875rem] text-primary"
                              title={`Sections CTD aussi présentes dans ce PDF consolidé : ${doc.containedSections.join(", ")}`}>
                              contient : {doc.containedSections.filter((s) => s !== doc.ctdSection).slice(0, 6).join(", ")}
                            </span>
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
                  {row.kind === "required" && <span className="shrink-0 text-[0.625rem] uppercase tracking-wide text-muted-foreground/70">obligatoire</span>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pièces administratives d'enregistrement — HORS dossier CTD (fournies de notre côté, en ligne
          sur le portail ANPP). Rappel obligatoire ; leur absence ne pénalise JAMAIS la complétude CTD. */}
      {latest && registrationDocs.length > 0 && (
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><FileText className="h-4 w-4 text-primary" /> Documents obligatoires pour l&apos;enregistrement (hors CTD)</CardTitle>
            <p className="text-xs text-muted-foreground">
              Ces pièces sont fournies de <strong>notre côté</strong> (portail ANPP en ligne) et ne font <strong>pas partie du dossier CTD</strong> :
              leur absence ici ne pénalise pas la notation du dossier. Rappel de la checklist à joindre à la soumission.
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
              {registrationDocs.map((row) => (
                <div key={row.code} className="flex items-center gap-2 rounded-md border border-border/60 px-2.5 py-1.5 text-sm">
                  {row.present
                    ? <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
                    : <Info className="h-4 w-4 shrink-0 text-muted-foreground/70" />}
                  <span className="font-medium">{row.code}</span>
                  <span className="min-w-0 flex-1 truncate text-muted-foreground" title={row.label}>{row.label}</span>
                  <span className="shrink-0 text-[0.625rem] uppercase tracking-wide text-muted-foreground/70">
                    {row.present ? "joint" : "à fournir"}
                  </span>
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

      {/* Chatbot du dossier — questions/réponses ancrées, avec sources exactes (fichier · section · page) */}
      {latest && canView && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><MessagesSquare className="h-4 w-4 text-primary" /> Discuter avec ce dossier</CardTitle>
            <p className="text-xs text-muted-foreground">
              Posez vos questions ; chaque réponse s'appuie sur les <strong>documents réellement lus</strong> et cite ses{" "}
              <strong>sources exactes</strong>. L'assistant s'abstient hors de ce que contient le dossier (jamais d'invention).
            </p>
          </CardHeader>
          <CardContent>
            <DossierChatPanel dossierId={dossier.id} configured={aiConfigured()} canView={canView} />
          </CardContent>
        </Card>
      )}

      {/* Jumeau numérique — faits sourcés + conflits */}
      {latest && (facts.length > 0 || conflicts.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Layers className="h-4 w-4 text-primary" /> Jumeau numérique — faits réglementaires</CardTitle>
            <p className="text-xs text-muted-foreground">
              Faits extraits par <strong>règles déterministes</strong> ET <strong>compréhension IA</strong> (marqués « IA »), chacun avec sa{" "}
              <strong>preuve sourcée</strong> vérifiée dans le document. Conflits entre documents détectés. Valeurs proposées — à confirmer/corriger.
            </p>
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
                        {f.blocker && <span className="rounded bg-destructive px-1.5 py-0.5 text-[0.625rem] font-semibold text-white">BLOQUEUR</span>}
                        {f.source === "AI" && f.draft && <span className="rounded bg-amber-500 px-1.5 py-0.5 text-[0.625rem] font-semibold text-white">PROJET IA — REVUE REQUISE</span>}
                        {f.source === "HUMAN" && <span className="rounded bg-primary px-1.5 py-0.5 text-[0.625rem] font-semibold text-white">HUMAIN</span>}
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">{f.detail}</p>
                      {f.evidence && <p className="mt-0.5 text-[0.6875rem] italic text-muted-foreground/80">Preuve : {f.evidence}</p>}
                      <FindingEvidence finding={f} reserves={reservesById} docNames={findingDocNames} />
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

      {/* Lifecycle — chronologie réglementaire + obligations post-enregistrement */}
      {(canAnalyse || lifecycleEvents.length > 0 || obligations.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><History className="h-4 w-4 text-primary" /> Cycle de vie réglementaire</CardTitle>
          </CardHeader>
          <CardContent>
            <LifecyclePanel dossierId={dossier.id} events={lifecycleEvents} obligations={obligations} canManage={canAnalyse} />
          </CardContent>
        </Card>
      )}

      {/* Boucle fournisseur — demande de compléments, brouillon d'e-mail (jamais envoyé auto) */}
      {(canSupplier || supplierRequests.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Factory className="h-4 w-4 text-primary" /> Boucle fournisseur</CardTitle>
          </CardHeader>
          <CardContent>
            <SupplierPanel dossierId={dossier.id} requests={supplierRequests} canManage={canSupplier} />
          </CardContent>
        </Card>
      )}

      {/* Réserves ANPP — lettre océrisée, points décomposés, réponses */}
      {(canReserve || reserveCycles.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><MailWarning className="h-4 w-4 text-primary" /> Réserves ANPP</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ReservesPanel dossierId={dossier.id} cycles={reserveCycles} canManage={canReserve} />
            {reserveCycles.some((c) => c.points.length > 0) && canView && (
              <div className="space-y-1.5">
                <p className="flex items-center gap-2 text-sm font-semibold"><MessagesSquare className="h-4 w-4 text-primary" /> Discuter avec les réserves</p>
                <ReserveChatPanel dossierId={dossier.id} configured={aiConfigured()} />
              </div>
            )}
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

      {/* Coût de l'analyse — ce que le dossier a réellement coûté, et à cause de quoi. */}
      {(cost.calls > 0 || canAnalyse) && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Coins className="h-4 w-4 text-primary" /> Coût de l&apos;analyse IA</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <CostStat label="Dépensé" value={usd(cost.totalUsd)} />
              <CostStat
                label="Plafond"
                value={cost.budget.limitUsd != null ? usd(cost.budget.limitUsd) : "aucun"}
                hint={cost.budget.exhausted ? "atteint — analyses arrêtées" : cost.budget.remainingUsd != null ? `${usd(cost.budget.remainingUsd)} restants` : undefined}
                tone={cost.budget.exhausted ? "danger" : undefined}
              />
              <CostStat label="Appels" value={String(cost.calls)} hint={cost.cachedCalls > 0 ? `dont ${cost.cachedCalls} sans recalcul` : undefined} />
              <CostStat label="Économisé par réemploi" value={usd(cost.savedUsd)} hint="fichiers déjà analysés" tone={cost.savedUsd > 0 ? "success" : undefined} />
            </div>

            {cost.budget.exhausted && (
              <p className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>Plafond atteint : les analyses économiques sont arrêtées sur ce dossier. Relevez le plafond pour les poursuivre.</span>
              </p>
            )}

            {cost.calls > 0 && (
              <div className="grid gap-4 lg:grid-cols-2">
                <CostTable title="Par étape" rows={cost.byStep} labelize={stepLabel} />
                <CostTable title="Par fichier" rows={cost.byDocument.slice(0, 8)} />
              </div>
            )}

            {canAnalyse && (
              <>
                <BudgetForm dossierId={dossier.id} current={dossierBudget != null ? toNumber(dossierBudget) : null} />
                {latest && <DeferredReviewButton dossierId={dossier.id} pending={pendingBatch} />}
              </>
            )}

            {cost.calls === 0 && (
              <p className="text-sm text-muted-foreground">
                Aucun appel facturé sur ce dossier pour le moment.
              </p>
            )}
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

/** Deux décimales suffisent à décider ; le dixième de cent est du bruit. */
function usd(n: number): string {
  return `${n.toFixed(n > 0 && n < 0.01 ? 4 : 2)} $`;
}

/** Les étapes techniques dites en français : « classify » ne veut rien dire pour un pharmacien. */
const STEP_LABELS: Record<string, string> = {
  classify: "Classement CTD",
  review: "Revue de contenu",
  facts: "Extraction des données",
  figures: "Lecture des graphiques et images",
  "reserve-extract": "Lecture des lettres de réserves",
  "reserve-vision": "Lecture des lettres scannées (image)",
  ocr: "Reconnaissance de texte (OCR)",
  docgen: "Génération documentaire",
};
const stepLabel = (key: string): string => STEP_LABELS[key] ?? key;

function CostStat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "danger" | "success" }) {
  const cls = tone === "danger" ? "text-destructive" : tone === "success" ? "text-success" : "";
  return (
    <div className="rounded-lg border border-border px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-0.5 text-base font-semibold tabular-nums ${cls}`}>{value}</p>
      {hint && <p className="text-[0.6875rem] text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Où part le budget. Un total global ne se corrige pas ; une étape ou un fichier, si. */
function CostTable({ title, rows, labelize }: { title: string; rows: { key: string; label: string; calls: number; costUsd: number; cachedCalls: number }[]; labelize?: (k: string) => string }) {
  if (rows.length === 0) return null;
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{title}</p>
      <ul className="mt-1 divide-y divide-border">
        {rows.map((r) => (
          <li key={r.key} className="flex items-center gap-2 py-1.5 text-sm">
            <span className="min-w-0 flex-1 truncate">{labelize ? labelize(r.key) : r.label}</span>
            <span className="shrink-0 text-[0.6875rem] text-muted-foreground">
              {r.calls} appel{r.calls > 1 ? "s" : ""}{r.cachedCalls > 0 ? ` · ${r.cachedCalls} réemployé(s)` : ""}
            </span>
            <span className="shrink-0 tabular-nums">{usd(r.costUsd)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

type FindingRow = Awaited<ReturnType<typeof listFindings>>[number];
type ReserveMap = Awaited<ReturnType<typeof reservesByIds>>;

/**
 * CE QUI REND UN CONSTAT DÉFENDABLE — la partie qu'on présentera à l'agence.
 *
 * Un constat sans pièce n'est qu'une opinion. On affiche donc, quand ils existent : la règle
 * appliquée, la PAGE et l'EXTRAIT exact (on peut ouvrir le document et pointer la ligne), les
 * valeurs qui se contredisent entre documents, la recommandation — et les réserves ANPP
 * déjà reçues sur le même sujet.
 *
 * Quand un élément manque, on le DIT. Découvrir qu'un constat n'était pas étayé se fait ici,
 * pas en séance.
 */
function FindingEvidence({ finding: f, reserves, docNames }: { finding: FindingRow; reserves: ReserveMap; docNames: Map<string, string> }) {
  const quality = findingQuality(f);
  const linked = f.similarReserveIds.map((id) => reserves.get(id)).filter((r): r is NonNullable<typeof r> => Boolean(r));
  const docName = f.documentId ? docNames.get(f.documentId) ?? null : null;
  const hasAny = f.ruleRef || f.page != null || f.excerpt || f.recommendation || f.conflictingValues.length > 0 || linked.length > 0 || f.reserveRisk != null;
  if (!hasAny && quality.missing.length === 0) return null;

  const riskPct = f.reserveRisk != null ? Math.round(f.reserveRisk * 100) : null;

  return (
    <div className="mt-1.5 space-y-1.5 border-l-2 border-border/60 pl-2.5">
      {/* La règle et le degré de certitude. */}
      {(f.ruleRef || f.confidence != null) && (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.6875rem] text-muted-foreground">
          {f.ruleRef && <span className="rounded bg-secondary px-1.5 py-0.5 font-medium text-foreground">{f.ruleRef}</span>}
          {f.confidence != null && <span>confiance {Math.round(f.confidence * 100)} %</span>}
        </p>
      )}

      {/* LA PIÈCE : où regarder, et ce qui y est écrit. */}
      {(docName || f.page != null || f.excerpt) && (
        <div className="text-[0.6875rem]">
          <p className="text-muted-foreground">
            {docName ?? "Document"}{f.page != null ? ` — page ${f.page}` : ""}
          </p>
          {f.excerpt && (
            <p className="mt-0.5 rounded bg-secondary/60 px-2 py-1 font-mono text-[10.5px] leading-relaxed text-foreground">
              « {f.excerpt.length > 400 ? `${f.excerpt.slice(0, 400)}…` : f.excerpt} »
            </p>
          )}
        </div>
      )}

      {/* Ce qui se contredit — la raison d'être du constat quand il porte sur une incohérence. */}
      {f.conflictingValues.length > 0 && (
        <p className="text-[0.6875rem] text-muted-foreground">
          <span className="font-medium text-foreground">Valeurs contradictoires :</span>{" "}
          {f.conflictingValues.slice(0, 6).join("  ≠  ")}
        </p>
      )}

      {/* Quoi faire. */}
      {f.recommendation && (
        <p className="rounded-lg bg-primary/5 px-2 py-1 text-[0.6875rem] text-foreground">
          <span className="font-medium">À faire :</span> {f.recommendation}
        </p>
      )}

      {/* Les précédents ANPP — information, jamais règle de droit. */}
      {(linked.length > 0 || riskPct != null) && (
        <div className="rounded-lg border border-border/70 px-2 py-1.5">
          <p className="flex flex-wrap items-center gap-2 text-[0.6875rem]">
            <Library className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="font-medium text-foreground">Déjà vu à l&apos;ANPP</span>
            {riskPct != null && (
              <span className={riskPct >= 60 ? "text-destructive" : riskPct >= 30 ? "text-warning" : "text-muted-foreground"}>
                probabilité que la réserve revienne : {riskPct} %
              </span>
            )}
          </p>
          {linked.slice(0, 3).map((r) => (
            <div key={r.id} className="mt-1 text-[0.6875rem]">
              <span className={`mr-1.5 rounded px-1 py-0.5 text-[0.625rem] font-semibold ${r.status === "ACCEPTED" ? "bg-success/15 text-success" : r.status === "REITERATED" ? "bg-destructive/15 text-destructive" : "bg-secondary text-muted-foreground"}`}>
                {r.status === "ACCEPTED" ? "réponse acceptée" : r.status === "REITERATED" ? "réitérée" : r.status.toLowerCase()}
              </span>
              <span className="text-muted-foreground">{r.verbatim.slice(0, 180)}{r.verbatim.length > 180 ? "…" : ""}</span>
              {r.status === "ACCEPTED" && r.response && (
                <p className="mt-0.5 rounded bg-success/10 px-2 py-1 text-[10.5px]">
                  <span className="font-medium">Réponse qui avait fonctionné :</span> {r.response.slice(0, 260)}
                </p>
              )}
            </div>
          ))}
          <p className="mt-1 text-[0.625rem] text-muted-foreground/80">
            Précédent, pas règle de droit — la sévérité du constat n&apos;en a pas été modifiée.
          </p>
        </div>
      )}

      {/* L'honnêteté du constat : ce sur quoi il ne repose pas. */}
      {quality.missing.length > 0 && (
        <p className="flex items-start gap-1.5 text-[10.5px] text-muted-foreground/80">
          <AlertTriangle className="mt-px h-3 w-3 shrink-0 text-warning" />
          <span>
            {quality.defensible ? "Constat étayé. " : "Constat à étayer avant de l'opposer : "}
            manque {quality.missing.join(", ")}.
          </span>
        </p>
      )}
    </div>
  );
}
