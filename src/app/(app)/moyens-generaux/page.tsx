import Link from "next/link";
import { notFound } from "next/navigation";
import { Wallet, ExternalLink, FileText, Download, BookUser } from "lucide-react";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { userCan } from "@/lib/rbac";
import { getGeneralMeans, resolveGeneralMeansDepartment, LIST_LIMIT } from "@/lib/queries/general-means";
import { generalMeansBudgetTargets } from "@/lib/queries/general-means-budget";
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
import { DepartmentSwitcher } from "./department-switcher";
import { SuppliesManager } from "../demandes/supplies-manager";
import { ExpenseRowActions } from "./expense-row-actions";
import { PurchaseSection } from "./purchase-section";

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
 * Un seul écran, une seule notion : LA CAISSE. Elle se lit à deux horizons — la caisse de
 * l'exercice (la dotation de l'année, ce qu'on a le droit de dépenser) et la caisse du mois
 * (l'argent en main aujourd'hui). Ce n'est pas un budget d'un côté et une caisse de l'autre :
 * c'est le même argent, la caisse du mois étant prélevée sur celle de l'exercice. Puis le détail
 * des dépenses avec leurs pièces (où est passé l'argent ?). Chaque dépense porte sa facture ou
 * son bon de paiement — sans pièce, une ligne n'est qu'une affirmation.
 */
export default async function MoyensGenerauxPage({
  searchParams,
}: { searchParams: { dept?: string; year?: string; period?: string } }) {
  // DEUX VISAGES SUR LE MÊME ÉCRAN, et c'est le sujet de cette page.
  //
  // Demander un achat est un geste de TOUT employé : un délégué qui a besoin de cartouches n'a
  // pas à connaître le circuit ni à écrire à l'assistante. La porte du module s'ouvre donc à
  // tous — mais le BUDGET, lui, reste fermé à qui n'a pas le droit de module. Ce n'est pas de
  // la cachotterie : connaître le reste de l'enveloppe transforme une demande en négociation,
  // et le rôle du demandeur est de dire ce dont il a besoin, pas d'arbitrer une caisse qu'il
  // ne tient pas.
  const user = await requireUser();
  const year = normalizeYear(searchParams.year);
  const period = searchParams.period ?? currentPeriod();

  // Le catalogue est proposé à TOUT LE MONDE : c'est lui qui rend la demande possible sans
  // connaître les références internes.
  const articles = await prisma.officeSupplyArticle.findMany({
    where: { active: true },
    select: { id: true, name: true, unit: true, estimatedPrice: true },
    orderBy: { name: "asc" },
  });
  const articleOptions = articles.map((a) => ({
    id: a.id, name: a.name, unit: a.unit, estimatedPrice: a.estimatedPrice ? Number(a.estimatedPrice) : null,
  }));

  // LA VUE DU DEMANDEUR — son catalogue, ses demandes, et rien du budget.
  if (!userCan(user, "GENERAL_MEANS", "VIEW")) {
    return (
      <div className="space-y-5">
        <PageHeader
          title="Moyens généraux"
          description="Demandez ce dont vous avez besoin pour travailler — dans le catalogue de la société, ou décrit en clair. Votre responsable valide, et l'achat suit."
        />
        <PurchaseSection userId={user.id} articles={articleOptions} />
      </div>
    );
  }

  const departmentId = await resolveGeneralMeansDepartment(user, searchParams.dept);
  if (!departmentId) {
    return (
      <div className="space-y-5">
        <PageHeader title="Moyens généraux" description="La caisse d'un département — l'exercice et le mois — et ses achats, au même endroit." />
        <PurchaseSection userId={user.id} articles={articleOptions} />
        <EmptyState
          icon="Building2"
          title="Aucun département rattaché à votre compte"
          description="La caisse et le budget se tiennent par département. Demandez aux ressources humaines de rattacher votre fiche employé — vos demandes d'achat, elles, fonctionnent déjà."
        />
      </div>
    );
  }

  const view = await getGeneralMeans(user, departmentId, year, period);
  if (!view) notFound();

  // CHAQUE DÉPARTEMENT A SES MOYENS GÉNÉRAUX. Celui qui PILOTE le module (les ressources
  // humaines, l'administration) passe donc de l'un à l'autre ; l'utilisatrice quotidienne, elle,
  // reste sur le sien — la liste ne lui est pas proposée, et les budgets des autres ne lui sont
  // pas ouverts.
  const departments = view.canAllot
    ? await prisma.department.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } })
    : [];

  // Les candidats à qui remettre une caisse : seule l'administration a besoin de cette liste.
  const people = view.canAllot
    ? await prisma.user.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } })
    : [];

  // LE CATALOGUE D'ARTICLES — le même que celui du Bureau du secrétariat, vu d'ici. Deux
  // catalogues auraient produit deux vocabulaires, donc des consommations incomparables.
  // La liste courte alimente les menus déroulants des tickets ; la liste détaillée n'est
  // chargée que pour qui peut la tenir.
  const canManageCatalog = userCan(user, "GENERAL_MEANS", "UPDATE");
  const catalog = canManageCatalog
    ? await prisma.officeSupplyArticle.findMany({
        select: { id: true, name: true, category: true, unit: true, reference: true, estimatedPrice: true, supplierHint: true, active: true, notes: true },
        orderBy: [{ active: "desc" }, { name: "asc" }],
      })
    : [];
  const catalogRows = catalog.map((a) => ({ ...a, estimatedPrice: a.estimatedPrice ? Number(a.estimatedPrice) : null }));

  // LES CASES BUDGÉTAIRES OUVERTES ICI. Liste volontairement pauvre : des destinations, sans
  // montants ni consommation — classer une dépense ne suppose pas d'accéder au module Budget.
  const budgetTargets = view.canSpend ? await generalMeansBudgetTargets() : [];

  const health = budgetHealth(view.allocated, view.consumed);
  const tone = health === "OVER_BUDGET" ? "danger" : health === "AT_RISK" ? "warning" : health === "UNSET" ? "default" : "success";

  return (
    <div className="space-y-5">
      <PageHeader
        title={`Moyens généraux — ${view.department.path}`}
        description="La caisse à deux horizons — l'exercice (l'année) et le mois — et le détail des dépenses avec leurs justificatifs. Tout achat porte sa facture ou son bon de paiement."
      >
        {departments.length > 1 && <DepartmentSwitcher departments={departments} current={view.department.id} year={year} />}
        {canManageCatalog && <SuppliesManager articles={catalogRows} />}
        {/* L'ANNUAIRE DE L'ENTREPRISE — l'imprimeur, le transitaire, l'agence de voyage. C'est ce
            service qui traite avec eux : sa porte est ici. */}
        <Link href="/moyens-generaux/annuaire" className="inline-flex items-center gap-1.5 rounded-lg border border-input px-3 py-1.5 text-sm font-medium hover:bg-secondary">
          <BookUser className="h-4 w-4" /> Annuaire de l&apos;entreprise
        </Link>
        {/* Un lien vers un écran qu'on ne peut pas ouvrir est pire qu'une absence de lien. */}
        {userCan(user, "BUDGETS", "VIEW") && (
          <Link href="/budgets/departements" className="inline-flex items-center gap-1.5 rounded-lg border border-input px-3 py-1.5 text-sm font-medium hover:bg-secondary">
            <ExternalLink className="h-4 w-4" /> Budgets par département
          </Link>
        )}
      </PageHeader>

      {/* TROIS INDICATEURS, PAS QUATRE. « Restant sur l'année » affichait allocation − consommé :
          sans caisse annuelle réglée, cela donnait un « restant » NÉGATIF du montant déjà dépensé
          (« −11 680 DZD »), qui ne veut rien dire pour personne. La consommation de l'année est
          déjà là, avec son pourcentage quand une caisse existe ; le seul reste qui se dépense
          vraiment est celui du mois, juste à côté. */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <KpiCard label={`Caisse de l'exercice ${year}`} value={formatCurrency(view.allocated)} icon="Wallet" />
        <KpiCard
          label="Consommé (année)" value={formatCurrency(view.consumed)} icon="Receipt" tone={tone}
          hint={view.allocated > 0 ? `${consumedPercent(view.allocated, view.consumed)} % de la caisse annuelle` : "aucune caisse annuelle réglée"}
        />
        <KpiCard
          label="Reste en caisse ce mois" value={view.cash ? formatCurrency(view.cash.balance.remaining) : "—"} icon="HandCoins"
          tone={view.cash?.balance.overspent ? "danger" : view.cash?.balance.lowOnCash ? "warning" : "info"}
          hint={view.cash ? undefined : "aucune caisse ce mois-ci"}
        />
      </div>

      <PurchaseSection userId={user.id} articles={articleOptions} />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Wallet className="h-4 w-4 text-primary" /> Caisse du mois</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-xs text-muted-foreground">
            La part de la caisse de l&apos;exercice <strong>en main ce mois-ci</strong> — pas un budget à côté,
            le <strong>même argent</strong>. L&apos;administration remet une somme chaque mois ; la personne qui la
            détient confirme l&apos;avoir reçue, puis chaque dépense en est déduite, justificatif scanné à
            l&apos;appui, jusqu&apos;à épuisement — moment où elle demande une rallonge.
          </p>
          <CashPanel view={view} people={people} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Toutes les dépenses {year} ({view.expenseCount})</CardTitle>
          {/* La liste MÊLE les natures ; la caisse affichée plus haut, elle, n'en porte
              qu'une. Sans cette phrase, la somme des lignes ne retomberait pas sur le
              « Consommé » et on croirait à une erreur de calcul. */}
          {view.otherConsumed > 0 && (
            <p className="text-xs text-muted-foreground">
              Dont <strong>{formatCurrency(view.otherConsumed)}</strong> imputés à d&apos;autres budgets
              (métier, formation) — non déduits de la caisse des {DEPT_BUDGET_LABEL.OPERATING.toLowerCase()}.
            </p>
          )}
          {view.truncated && (
            <p className="text-xs text-muted-foreground">
              Les {LIST_LIMIT} plus récentes sont affichées ; les totaux ci-dessus portent sur l&apos;année entière.
            </p>
          )}
        </CardHeader>
        {view.canSpend && (
          <CardContent className="pb-0">
            <p className="mb-2 text-xs text-muted-foreground">
              <strong>Un seul endroit pour enregistrer un achat</strong>, qu&apos;il ait été réglé sur la caisse
              du mois ou autrement (virement, carte, facture payée par les Finances). Le moyen de paiement se
              choisit dans le formulaire, et se corrige après coup sur une dépense déjà saisie.
            </p>
            <ExpensePanel
              departmentId={view.department.id} year={year} remaining={view.remaining}
              articles={articleOptions} budgetTargets={budgetTargets} period={period}
              cash={view.cash ? {
                status: view.cash.status,
                remaining: view.cash.balance.remaining,
                // La caisse n'est proposée qu'à qui peut réellement en sortir de l'argent :
                // offrir l'option à quelqu'un d'autre, c'est un refus après la saisie.
                canSpend: view.isHolder || view.canAmendCash,
              } : null}
            />
          </CardContent>
        )}
        <CardContent className="p-0">
          {view.expenses.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">
              Aucune dépense imputée cette année. Les achats enregistrés ici alimentent la consommation de la caisse —
              c&apos;est ce qui permet de confronter la caisse de l&apos;exercice à ce qui en a réellement été dépensé.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {view.expenses.map((e) => (
                <li key={e.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2.5 text-sm">
                  <span className="min-w-0 flex-1">
                    <span className="font-medium">{e.label}</span>
                    {e.notes && <span className="block text-xs text-muted-foreground">{e.notes}</span>}
                    {/* LE DÉTAIL DU TICKET. Sans lui, on relit « courses — 12 400 DZD » six mois
                        plus tard sans savoir ce qui a été acheté. */}
                    {e.lines.length > 0 && (
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {e.lines.map((l) => `${l.quantity > 1 ? `${l.quantity}× ` : ""}${l.label} (${formatCurrency(l.amount)})`).join(" · ")}
                      </span>
                    )}
                    <span className="block text-[0.6875rem] text-muted-foreground">
                      {DEPT_BUDGET_LABEL[e.kind]}{e.budgetLabel ? ` · ${e.budgetLabel}` : ""}{e.createdBy ? ` · ${e.createdBy}` : ""}
                    </span>
                  </span>
                  {e.fromPettyCash && <Badge tone="info" dot={false}>caisse d&apos;avance</Badge>}
                  {/* « À classer » se dit ICI, là où la dépense se corrige — pas dans le module
                      Budget, que la personne qui achète n'ouvre jamais. */}
                  {budgetTargets.length > 0 && e.toClassify && <Badge tone="warning" dot={false}>à classer</Badge>}
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
                  {/* Corriger ou supprimer se fait ICI, là où l'erreur se voit. Le serveur
                      revérifie le droit : sur une dépense payée en liquide, seule la personne
                      qui détient la caisse (ou la direction) y touche. */}
                  {view.canSpend && (!e.fromPettyCash || view.canAmendCash) && (
                    <ExpenseRowActions
                      expense={{
                        id: e.id, label: e.label, amount: e.amount, kind: e.kind, notes: e.notes,
                        fromPettyCash: e.fromPettyCash, budgetCategoryId: e.budgetCategoryId, lines: e.lines,
                      }}
                      articles={articleOptions}
                      budgetTargets={budgetTargets}
                      cashUsable={Boolean(view.cash && view.cash.status === "RECEIVED" && (view.isHolder || view.canAmendCash))}
                    />
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
