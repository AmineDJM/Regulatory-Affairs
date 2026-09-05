import Link from "next/link";
import { ArrowRight, AlertTriangle, Download } from "lucide-react";
import { requireModule } from "@/lib/session";
import { canManageEnvelopes } from "@/lib/rbac";
import { getEnvelopes, getBudgetOverview, getEnvelopesGrandTotal } from "@/lib/queries/budget";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ModuleTabs } from "@/components/shared/module-tabs";
import { visibleTabs } from "@/lib/nav-tabs";
import { BUDGET_TABS } from "@/lib/labels";
import { Donut } from "@/components/charts/donut";
import { Trend } from "@/components/charts/trend";
import { Bars, Meter } from "@/components/charts/bars";
import { foldTail } from "@/components/charts/palette";
import { formatCurrency } from "@/lib/utils";
import { BudgetContextBar } from "./budget-context-bar";
import { resolveBudgetEnvelope } from "@/lib/budget-scope";

export const dynamic = "force-dynamic";

/**
 * BUDGETS — VUE D'ENSEMBLE. Un seul écran, une seule question : **où en est le budget ?**
 *
 * Tout ce qui « fait » (imputer, saisir, créer une catégorie, régler l'enveloppe) est parti
 * dans les onglets Dépenses et Réglages. Il ne reste ici que de la lecture : un chiffre
 * dominant, une jauge, un camembert, une courbe, des barres. Aucun bouton d'action, aucun
 * formulaire — donc rien à comprendre avant de comprendre son budget.
 */
export default async function BudgetsPage({ searchParams }: { searchParams: { env?: string; from?: string; to?: string } }) {
  const user = await requireModule("BUDGETS");

  const [envelopes, grandTotal, tabs] = await Promise.all([
    getEnvelopes(user),
    getEnvelopesGrandTotal(user),
    visibleTabs(user, BUDGET_TABS),
  ]);
  const from = searchParams.from ? new Date(searchParams.from) : null;
  const to = searchParams.to ? new Date(searchParams.to) : null;
  const overview = await getBudgetOverview(user, resolveBudgetEnvelope(searchParams.env), from, to);

  if (!overview) {
    return (
      <div className="space-y-5">
        <PageHeader title="Budgets" description="Où en est votre budget, en un coup d'œil." />
        <ModuleTabs tabs={tabs} />
        <EmptyState
          icon="Wallet"
          title="Aucune enveloppe budgétaire"
          description={canManageEnvelopes(user)
            ? "Créez une enveloppe depuis l'onglet Réglages : un budget total pour une période, que vous répartirez ensuite en catégories."
            : "Aucune enveloppe ne vous est ouverte pour le moment."}
        />
      </div>
    );
  }

  const t = overview.totals;
  const topCats = overview.categories.filter((c) => c.parentId === null);
  const gPct = grandTotal.total > 0 ? Math.round((grandTotal.consumed / grandTotal.total) * 100) : 0;

  // Camembert : comment le budget est RÉPARTI (au plus 6 parts — au-delà, l'œil ne compare plus).
  const allocSlices = foldTail(topCats.map((c) => ({ label: c.name, value: c.allocated })));
  // Barres : où en est CHAQUE catégorie (statut, pas identité).
  const barRows = topCats
    .filter((c) => c.allocated > 0 || c.consumed > 0)
    .sort((a, b) => b.consumed - a.consumed)
    .map((c) => ({ label: c.name, budget: c.allocated, consumed: c.consumed }));
  // Camembert de tête : plusieurs enveloppes → comment le budget global se répartit entre elles.
  const envSlices = grandTotal.count > 1
    ? foldTail(grandTotal.items.filter((e) => e.total > 0).map((e) => ({ label: e.name, value: e.total })))
    : [];

  const trendPoints = overview.monthly.map((m) => ({ label: m.label, value: m.cumulative, expected: m.expected }));

  return (
    <div className="space-y-5">
      <PageHeader title="Budgets" description="Où en est votre budget, en un coup d'œil.">
        <a
          href={`/api/budgets/export?env=${overview.envelope.id}&from=${overview.period.from.slice(0, 10)}&to=${overview.period.to.slice(0, 10)}`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-sm font-medium transition-colors hover:bg-secondary"
          title="Exporter en Excel"
        >
          <Download className="h-4 w-4" /> Excel
        </a>
      </PageHeader>
      <ModuleTabs tabs={tabs} />

      {/*
        LA VUE GLOBALE, TOUJOURS EN TÊTE — toutes enveloppes confondues.

        Le sélecteur d'enveloppe est un formidable moyen de ne jamais voir le budget de
        l'entreprise : on lit une enveloppe, on change, on en lit une autre, et personne ne
        fait la somme. Elle est donc ici, avant tout choix, et elle reste affichée même
        lorsqu'il n'y a qu'une seule enveloppe — le jour où une deuxième apparaît, le total
        change tout seul, sans que l'écran change de forme.
      */}
      <section className="surface p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <div>
            <p className="text-sm text-muted-foreground">
              Budget global — {grandTotal.count} enveloppe{grandTotal.count > 1 ? "s" : ""}
            </p>
            <p className="mt-1 text-3xl font-semibold tracking-tight">{formatCurrency(grandTotal.total)}</p>
          </div>
          <p className="text-sm text-muted-foreground">
            Consommé <strong className="text-foreground tabular-nums">{formatCurrency(grandTotal.consumed)}</strong> ({gPct} %) ·
            reste <strong className={`tabular-nums ${grandTotal.remaining < 0 ? "text-destructive" : "text-success"}`}>{formatCurrency(grandTotal.remaining)}</strong>
          </p>
        </div>
        <div className="mt-4">
          <Meter value={grandTotal.consumed} limit={grandTotal.total} format={formatCurrency} />
        </div>
        {grandTotal.items.length > 0 && (
          <ul className="mt-4 divide-y divide-border border-t border-border">
            {grandTotal.items.map((e) => {
              const pct = e.total > 0 ? Math.round((e.consumed / e.total) * 100) : 0;
              return (
                <li key={e.id}>
                  <Link
                    href={`/budgets?env=${e.id}`}
                    className="flex flex-wrap items-center gap-x-4 gap-y-1 px-1 py-2.5 text-sm transition-colors hover:bg-secondary/60"
                  >
                    <span className={`min-w-0 flex-1 truncate font-medium ${e.id === overview.envelope.id ? "text-primary" : ""}`}>
                      {e.name}
                      {!e.isActive && <span className="ml-2 text-xs font-normal text-muted-foreground">(clôturée)</span>}
                    </span>
                    <span className="tabular-nums text-muted-foreground">{formatCurrency(e.consumed)} / {formatCurrency(e.total)}</span>
                    <span className={`w-12 shrink-0 text-right tabular-nums ${e.remaining < 0 ? "text-destructive" : "text-muted-foreground"}`}>{pct} %</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <BudgetContextBar envelopes={envelopes} currentId={overview.envelope.id} from={overview.period.from} to={overview.period.to} />

      {/* LE chiffre : ce qui reste. Puis la jauge, puis les deux montants de contexte. */}
      <section className="surface p-5">
        <p className="text-sm text-muted-foreground">Il vous reste</p>
        <p className={`mt-1 text-4xl font-semibold tracking-tight sm:text-5xl ${t.remaining < 0 ? "text-destructive" : ""}`}>
          {formatCurrency(t.remaining)}
        </p>
        <div className="mt-4 max-w-xl">
          <Meter value={t.consumed} limit={t.total} format={formatCurrency} />
        </div>
        <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-2 border-t border-border pt-3 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">Budget de l&apos;enveloppe</dt>
            <dd className="font-medium tabular-nums">{formatCurrency(t.total)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Consommé</dt>
            <dd className="font-medium tabular-nums">{formatCurrency(t.consumed)}</dd>
          </div>
          {t.committed > 0 && (
            <div>
              <dt className="text-xs text-muted-foreground">Engagé (non encore réglé)</dt>
              <dd className="font-medium tabular-nums">{formatCurrency(t.committed)}</dd>
            </div>
          )}
          {t.unallocated !== 0 && (
            <div>
              <dt className="text-xs text-muted-foreground">Non réparti en catégories</dt>
              <dd className={`font-medium tabular-nums ${t.unallocated < 0 ? "text-destructive" : ""}`}>{formatCurrency(t.unallocated)}</dd>
            </div>
          )}
        </dl>
      </section>

      {/* Une seule alerte, actionnable, plutôt qu'une section de liste dépliée. */}
      {overview.unattributed.total > 0 && (
        <Link
          href={`/budgets/depenses?env=${overview.envelope.id}`}
          className="flex items-center gap-3 rounded-xl border border-warning/40 bg-warning/5 px-4 py-3 text-sm transition hover:bg-warning/10"
        >
          <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
          <span className="flex-1">
            <strong>{formatCurrency(overview.unattributed.total)}</strong> de dépenses ne sont rattachées à aucune catégorie —
            elles faussent la lecture ci-dessus.
          </span>
          <span className="inline-flex shrink-0 items-center gap-1 font-medium text-primary">Les imputer <ArrowRight className="h-3.5 w-3.5" /></span>
        </Link>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="surface space-y-3 p-4">
          <h2 className="text-sm font-semibold">Comment le budget est réparti</h2>
          {allocSlices.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Le budget n&apos;est pas encore réparti en catégories.
            </p>
          ) : (
            <Donut
              slices={allocSlices}
              total={t.total}
              centerLabel="réparti"
              centerValue={formatCurrency(t.allocated)}
              format={formatCurrency}
            />
          )}
        </section>

        <section className="surface space-y-3 p-4">
          <h2 className="text-sm font-semibold">Consommation dans le temps</h2>
          <Trend points={trendPoints} format={formatCurrency} />
        </section>
      </div>

      {barRows.length > 0 && (
        <section className="surface space-y-4 p-4">
          <h2 className="text-sm font-semibold">Où en est chaque catégorie</h2>
          <Bars rows={barRows} format={formatCurrency} />
        </section>
      )}

      {/* Le poids relatif des enveloppes — les chiffres sont déjà en tête, ici c'est la forme. */}
      {envSlices.length > 0 && (
        <section className="surface space-y-3 p-4">
          <h2 className="text-sm font-semibold">Répartition entre les enveloppes</h2>
          <Donut
            slices={envSlices}
            total={grandTotal.total}
            centerLabel="budget cumulé"
            centerValue={formatCurrency(grandTotal.total)}
            format={formatCurrency}
          />
        </section>
      )}
    </div>
  );
}
