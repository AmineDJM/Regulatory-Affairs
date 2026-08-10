import Link from "next/link";
import { notFound } from "next/navigation";
import { Wallet, ExternalLink, FileText, Download } from "lucide-react";
import { requireModule } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { userCan } from "@/lib/rbac";
import { getGeneralMeans, resolveGeneralMeansDepartment } from "@/lib/queries/general-means";
import { normalizeYear, DEPT_BUDGET_LABEL, budgetHealth, consumedPercent } from "@/lib/department-budget";
import { currentPeriod } from "@/lib/petty-cash";
import { PageHeader } from "@/components/shared/page-header";
import { KpiCard } from "@/components/shared/kpi-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import { formatCurrency, formatDate } from "@/lib/utils";
import { CashPanel } from "./cash-panel";
import { ExpensePanel } from "./expense-panel";

export const dynamic = "force-dynamic";
export const metadata = { title: "Moyens généraux — AMD Internal OS" };

/**
 * MOYENS GÉNÉRAUX — le module qui rassemble ce qui était éparpillé.
 *
 * Le budget vivait dans un tableau, les achats dans les demandes administratives, et l'argent
 * liquide confié à l'assistante nulle part. « Combien a-t-on dépensé ce mois-ci, et me
 * reste-t-il de quoi payer ? » exigeait d'additionner à la main, en espérant n'avoir rien
 * oublié.
 *
 * Un seul écran répond désormais aux trois questions, dans l'ordre où elles se posent :
 * l'enveloppe de l'année (ai-je le droit ?), la caisse d'avance (ai-je de quoi payer ?), et le
 * détail des dépenses avec leurs pièces (où est passé l'argent ?). Chaque dépense porte sa
 * facture ou son bon de paiement — sans pièce, une ligne n'est qu'une affirmation.
 */
export default async function MoyensGenerauxPage({
  searchParams,
}: { searchParams: { dept?: string; year?: string; period?: string } }) {
  // Module À PART : sa porte est « Moyens généraux », pas « Budgets » — l'assistante de
  // direction n'a pas le second, et c'est elle qui s'en sert tous les jours.
  const user = await requireModule("GENERAL_MEANS");
  const year = normalizeYear(searchParams.year);
  const period = searchParams.period ?? currentPeriod();

  const departmentId = await resolveGeneralMeansDepartment(user, searchParams.dept);
  if (!departmentId) {
    return (
      <div className="space-y-5">
        <PageHeader title="Moyens généraux" description="Le budget, les achats et la caisse d'avance d'un département, au même endroit." />
        <EmptyState
          icon="Building2"
          title="Aucun département rattaché à votre compte"
          description="Les moyens généraux se tiennent par département. Demandez aux ressources humaines de rattacher votre fiche employé."
        />
      </div>
    );
  }

  const view = await getGeneralMeans(user, departmentId, year, period);
  if (!view) notFound();

  // Les candidats à qui remettre une caisse : seule l'administration a besoin de cette liste.
  const people = view.canAllot
    ? await prisma.user.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } })
    : [];

  const health = budgetHealth(view.allocated, view.consumed);
  const tone = health === "OVER_BUDGET" ? "danger" : health === "AT_RISK" ? "warning" : health === "UNSET" ? "default" : "success";

  return (
    <div className="space-y-5">
      <PageHeader
        title={`Moyens généraux — ${view.department.path}`}
        description="Le budget de l'exercice, la caisse d'avance du mois et le détail des dépenses, avec leurs justificatifs. Tout achat porte sa facture ou son bon de paiement."
      >
        {/* Un lien vers un écran qu'on ne peut pas ouvrir est pire qu'une absence de lien. */}
        {userCan(user, "BUDGETS", "VIEW") && (
          <Link href="/budgets/departements" className="inline-flex items-center gap-1.5 rounded-lg border border-input px-3 py-1.5 text-sm font-medium hover:bg-secondary">
            <ExternalLink className="h-4 w-4" /> Budgets par département
          </Link>
        )}
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label={`${DEPT_BUDGET_LABEL.OPERATING} ${year}`} value={formatCurrency(view.allocated)} icon="Wallet" />
        <KpiCard
          label="Consommé" value={formatCurrency(view.consumed)} icon="Receipt" tone={tone}
          hint={view.allocated > 0 ? `${consumedPercent(view.allocated, view.consumed)} % de l'enveloppe` : "aucune enveloppe réglée"}
        />
        <KpiCard label="Restant sur l'enveloppe" value={formatCurrency(view.remaining)} icon="PiggyBank" tone={view.remaining < 0 ? "danger" : "default"} />
        <KpiCard
          label="Reste en caisse" value={view.cash ? formatCurrency(view.cash.balance.remaining) : "—"} icon="HandCoins"
          tone={view.cash?.balance.overspent ? "danger" : view.cash?.balance.lowOnCash ? "warning" : "info"}
          hint={view.cash ? undefined : "aucune caisse ce mois-ci"}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Wallet className="h-4 w-4 text-primary" /> Caisse d&apos;avance</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-xs text-muted-foreground">
            L&apos;argent <strong>en main</strong>, distinct du budget qui dit ce qu&apos;on a le <strong>droit</strong> de
            dépenser. L&apos;administration remet une somme chaque mois ; la personne qui la détient confirme
            l&apos;avoir reçue, puis chaque dépense en est déduite, justificatif scanné à l&apos;appui, jusqu&apos;à
            épuisement — moment où elle demande une rallonge.
          </p>
          <CashPanel view={view} people={people} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Toutes les dépenses {year} ({view.expenses.length})</CardTitle>
        </CardHeader>
        {view.canSpend && (
          <CardContent className="pb-0">
            <p className="mb-2 text-xs text-muted-foreground">
              Un achat réglé <strong>autrement que par la caisse</strong> (virement, carte, facture payée par les
              Finances) s&apos;enregistre ici : montant, scan de la facture ou du bon de paiement — et il est
              <strong> déduit du budget</strong>.
            </p>
            <ExpensePanel departmentId={view.department.id} year={year} remaining={view.remaining} />
          </CardContent>
        )}
        <CardContent className="p-0">
          {view.expenses.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">
              Aucune dépense imputée cette année. Les achats enregistrés ici alimentent la consommation du budget —
              c&apos;est ce qui permet de confronter l&apos;enveloppe à ce qui en a réellement été dépensé.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {view.expenses.map((e) => (
                <li key={e.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-sm">
                  <span className="min-w-0 flex-1">
                    <span className="font-medium">{e.label}</span>
                    {e.notes && <span className="block text-xs text-muted-foreground">{e.notes}</span>}
                    <span className="block text-[0.6875rem] text-muted-foreground">
                      {DEPT_BUDGET_LABEL[e.kind]}{e.createdBy ? ` · ${e.createdBy}` : ""}
                    </span>
                  </span>
                  {e.fromPettyCash && <Badge tone="info" dot={false}>caisse d&apos;avance</Badge>}
                  <span className="text-xs text-muted-foreground">{formatDate(e.date)}</span>
                  <span className="tabular-nums font-semibold">{formatCurrency(e.amount)}</span>
                  <span className="flex items-center gap-1">
                    {e.documents.length === 0 ? (
                      <Badge tone="danger" dot={false}>sans pièce</Badge>
                    ) : e.documents.map((d) => (
                      <a
                        key={d.id}
                        href={`/api/documents/${d.id}?dl=1`}
                        title={d.name}
                        className="inline-flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5 text-[0.6875rem] hover:bg-secondary"
                      >
                        <FileText className="h-3 w-3" /> <Download className="h-3 w-3" />
                      </a>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
