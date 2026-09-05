import { requireUser } from "@/lib/session";
import { getMyHrDossier } from "@/lib/queries/hr-documents";
import { getMyLeaveRequests } from "@/lib/queries/hr";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, Download } from "lucide-react";
import { HR_DOCUMENT_CATEGORY, HR_REQUEST_TYPE, HR_REQUEST_STATUS, CONTRACT_TYPE, WORKSPACE_TABS } from "@/lib/labels";
import { visibleTabs } from "@/lib/nav-tabs";
import { ModuleTabs } from "@/components/shared/module-tabs";
import { formatDate, formatDateTime, formatMonth, formatCurrency } from "@/lib/utils";
import { NewRequestButton, CancelRequestButton } from "./request-controls";
import { LeaveRequestButton } from "@/components/hr/leave-request-button";
import { leaveFormContext } from "@/lib/hr/leave-form-context";
import { MyLeaves } from "@/components/hr/my-leaves";
import { ExpenseClaimEdit } from "@/components/hr/expense-claim-edit";
import { prisma } from "@/lib/prisma";
import { MODULES } from "@/lib/rbac";
import { MODULE_LABELS } from "@/lib/labels";
import { isDelegatable } from "@/lib/hr/stand-in";
import { MeetingControls } from "@/components/shared/hr-meeting-controls";
import { HrRequestThread } from "@/components/shared/hr-request-thread";

export const dynamic = "force-dynamic";

export default async function MonDossierPage() {
  const user = await requireUser();
  const dossier = await getMyHrDossier(user.id);
  // MÊME demande, MÊME liste que « Mon espace » : un congé n'existe qu'une fois.
  const myLeaves = await getMyLeaveRequests(user.id);
  // Qui peut me remplacer, et sur quoi. Les collègues actifs (moi excepté — on ne se remplace
  // pas soi-même) et les modules réellement délégables, jamais les espaces personnels.
  // La fiche de demande de congé, pré-remplie depuis la fiche employé (même contexte que
  // « Mon espace » : un seul formulaire, un seul jeu d'informations).
  const leaveForm = await leaveFormContext(user.id);
  const [colleagues, delegatable] = await Promise.all([
    prisma.user.findMany({
      where: { isActive: true, id: { not: user.id } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    Promise.resolve(MODULES.filter(isDelegatable).map((m) => ({ value: m, label: MODULE_LABELS[m] }))),
  ]);
  // MÊMES onglets que tout l'espace personnel : le dossier RH en est un, plus un module à
  // part. Deux barres d'onglets différentes selon l'écran donnaient l'impression de changer
  // d'endroit alors qu'on reste chez soi.
  const dossierTabs = await visibleTabs(user, WORKSPACE_TABS);

  if (!dossier) {
    return (
      <div className="space-y-5">
        <PageHeader title="Mon dossier RH" description="Vos documents RH et vos demandes (attestations, congés, missions, frais)." />
        <ModuleTabs tabs={dossierTabs} />
        <EmptyState icon="FileText" title="Aucun dossier RH lié à votre compte" description="Votre compte n'est pas encore rattaché à une fiche employé. Contactez les Ressources humaines." />
      </div>
    );
  }

  const e = dossier.employee;
  return (
    <div className="space-y-5">
      <PageHeader title="Mon dossier RH" description="Retrouvez vos documents RH et suivez vos demandes (attestations, congé, ordre de mission, note de frais…).">
        <LeaveRequestButton identity={leaveForm?.identity} colleagues={colleagues} />
        <NewRequestButton />
      </PageHeader>
      <ModuleTabs tabs={dossierTabs} />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Mes informations</CardTitle></CardHeader>
          <CardContent className="space-y-2.5 text-sm">
            <Info label="Nom" value={e.fullName} />
            <Info label="Poste" value={e.position} />
            <Info label="Département" value={e.department} />
            <Info label="Contrat" value={e.contractType ? CONTRACT_TYPE[e.contractType] : null} />
            <Info label="Date d'embauche" value={e.hireDate ? formatDate(e.hireDate) : null} />
            <Info label="N° CNAS" value={e.cnasNumber} />
            {(e.baseSalary != null || e.netToPay != null) && (
              <>
                <p className="pt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ma rémunération</p>
                <Info label="Salaire de base" value={e.baseSalary != null ? formatCurrency(e.baseSalary) : null} />
                <Info label="Ret. SS 9 %" value={e.retSS9 != null ? formatCurrency(e.retSS9) : null} />
                <Info label="Ret. IRG" value={e.retIrg != null ? formatCurrency(e.retIrg) : null} />
                <Info label="Remb. frais" value={e.expenseRefund != null ? formatCurrency(e.expenseRefund) : null} />
                <Info label="Net à payer" value={e.netToPay != null ? formatCurrency(e.netToPay) : null} />
              </>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Mes documents RH ({dossier.documents.length})</CardTitle></CardHeader>
          <CardContent className="p-0">
            {dossier.documents.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">Aucun document pour l'instant. Les RH y déposeront vos contrats, bulletins et attestations.</p>
            ) : (
              // UN TABLEAU, ET LA NATURE EN PREMIÈRE COLONNE.
              //
              // La liste mettait le NOM DE FICHIER en avant et reléguait la nature dans une ligne
              // grise, collée à la période et à la date. Or on ne cherche jamais « bulletin_07.pdf » :
              // on cherche SON CONTRAT, ou SA fiche de paie de juillet. Avec vingt lignes, un nom de
              // fichier ne se trie pas, ne se compare pas, et deux dépôts nommés pareil sont
              // indiscernables. La nature, la période et la date sont les trois colonnes qu'on lit.
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nature</TableHead>
                      <TableHead>Document</TableHead>
                      <TableHead>Période</TableHead>
                      <TableHead>Déposé le</TableHead>
                      <TableHead className="text-right">Fichier</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dossier.documents.map((d) => (
                      <TableRow key={d.id}>
                        <TableCell className="whitespace-nowrap font-medium">
                          {HR_DOCUMENT_CATEGORY[d.category] ?? d.category}
                        </TableCell>
                        <TableCell className="max-w-[260px]">
                          <span className="flex items-center gap-2">
                            <FileText className="h-4 w-4 shrink-0 text-primary" />
                            <span className="truncate" title={d.name}>{d.name}</span>
                          </span>
                        </TableCell>
                        {/* La période n'a de sens que sur ce qui en porte une (une fiche de paie,
                            un relevé) : ailleurs on écrit « — » plutôt qu'une colonne vide, qui se
                            lit comme une donnée manquante. */}
                        <TableCell className="whitespace-nowrap text-muted-foreground">{d.period || "—"}</TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground">{formatDate(d.createdAt)}</TableCell>
                        <TableCell className="text-right">
                          <a href={`/api/rh/document/${d.id}?dl=1`} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-secondary">
                            <Download className="h-4 w-4" /> Télécharger
                          </a>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Mes congés et absences</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 p-4 pt-0">
          <p className="text-xs text-muted-foreground">
            La même demande que dans « Mon espace ». Elle suit le circuit
            <strong> responsable (N+1) → ressources humaines → direction générale</strong> ;
            votre solde n&apos;est débité qu&apos;une fois le circuit terminé.
          </p>
          <MyLeaves leaves={myLeaves} people={colleagues} modules={delegatable} moduleLabels={MODULE_LABELS} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Mes demandes RH</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {dossier.requests.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">Aucune demande. Cliquez sur « Nouvelle demande » pour une attestation (travail, CNAS, émoluments), un titre de congé, un ordre de mission ou une note de frais.</p>
          ) : (
            <ul className="divide-y divide-border">
              {dossier.requests.map((r) => (
                <li key={r.id} className="space-y-2 px-4 py-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{HR_REQUEST_TYPE[r.type]}</span>
                        <StatusBadge map={HR_REQUEST_STATUS} value={r.status} />
                      </div>
                      {r.details && <p className="text-xs text-muted-foreground">{r.details}</p>}
                      {r.hrNote && <p className="text-xs text-muted-foreground">RH : {r.hrNote}</p>}
                      {(r.periodStart || r.periodEnd) && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Période : <span className="font-medium text-foreground">{r.periodStart ? formatDate(r.periodStart) : "?"}{r.periodEnd ? ` → ${formatDate(r.periodEnd)}` : ""}</span>
                          {r.periodDays ? ` · ${r.periodDays} j` : ""}
                          {r.type === "ANNUAL_LEAVE" && r.balanceApplied ? <span className="text-success"> · solde débité</span> : null}
                        </p>
                      )}
                      {r.type === "EXPENSE_REPORT" && (
                        <div className="mt-1 space-y-0.5 text-xs">
                          <p className="text-muted-foreground">
                            {/* LE MONTANT EN PREMIER : c'est la question qu'on se pose en
                                relisant sa note, et c'est celle sur laquelle on se trompe. */}
                            {r.expenseAmount != null && (
                              <>Montant : <span className="font-semibold tabular-nums text-foreground">{formatCurrency(r.expenseAmount)}</span> · </>
                            )}
                            Mois concerné : <span className="font-medium text-foreground">{formatMonth(r.expenseMonth)}</span>
                            {r.approvedMonth && <> · Validée pour <span className="font-medium text-success">{formatMonth(r.approvedMonth)}</span></>}
                          </p>
                          {r.originalsAckAt ? (
                            <p className="text-success">Originaux réceptionnés par le secrétariat{r.originalsAckByName ? ` (${r.originalsAckByName})` : ""} le {formatDate(r.originalsAckAt)}.</p>
                          ) : (
                            <p className="font-medium text-amber-700">⚠ Déposez les documents originaux au bureau du secrétariat — accusé de réception en attente.</p>
                          )}
                          {/* LES QUINZE MINUTES POUR SE RELIRE. Sans cette porte, celui qui
                              repère son erreur annule et redépose : deux demandes dans
                              l'historique, dont une morte, et des RH qui devinent laquelle
                              fait foi. C'est la MÊME note qui change. */}
                          <ExpenseClaimEdit
                            id={r.id}
                            state={{ editableUntil: r.editableUntil, editUnlockedAt: r.editUnlockedAt, status: r.status }}
                            month={r.expenseMonth}
                            amount={r.expenseAmount}
                            details={r.details}
                          />
                        </div>
                      )}
                      <p className="text-[0.6875rem] text-muted-foreground">Demandée le {formatDateTime(r.createdAt)}</p>
                    </div>
                    {r.fulfilmentDocId && (
                      <a href={`/api/rh/document/${r.fulfilmentDocId}?dl=1`} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-secondary">
                        <Download className="h-4 w-4" /> Document
                      </a>
                    )}
                    {r.status === "PENDING" && <CancelRequestButton id={r.id} />}
                  </div>
                  {r.type === "HR_INTERVIEW" && r.status !== "REJECTED" && (
                    <MeetingControls
                      requestId={r.id}
                      meetingAt={r.meetingAt}
                      proposedByMe={r.meetingProposedById === user.id}
                      confirmed={Boolean(r.meetingConfirmedAt)}
                      canPropose={Boolean(r.meetingAt)}
                      otherParty="les RH"
                    />
                  )}
                  <HrRequestThread requestId={r.id} documents={r.documents} comments={r.comments} canManage={false} currentUserId={user.id} path="/mon-dossier" />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string | null | undefined }) {
  return <div><p className="text-xs text-muted-foreground">{label}</p><p className="font-medium">{value || "—"}</p></div>;
}
