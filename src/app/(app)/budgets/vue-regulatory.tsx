import Link from "next/link";
import { AlertTriangle, ArrowRight, Download } from "lucide-react";
import type { CurrentUser } from "@/lib/session";
import type { BudgetEnvelopeOption, BudgetOverview } from "@/lib/queries/budget";
import { vueBvParDossier } from "@/lib/queries/budget-regulatory";
import { prochainsBv, resumePrevision, avancementPeriode, courbeProjection, libelleMois, type ProchainBv } from "@/lib/budget-regulatory/synthese";
import { PageHeader } from "@/components/shared/page-header";
import { ModuleTabs, type ModuleTab } from "@/components/shared/module-tabs";
import { Tuile } from "@/components/shared/tuile";
import { InfoBulle } from "@/components/ui/info-bulle";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Bars } from "@/components/charts/bars";
import { Projection } from "@/components/charts/projection";
import { formatCurrency } from "@/lib/utils";
import { BudgetContextBar } from "./budget-context-bar";

/**
 * BUDGET REGULATORY — LA VUE D'ENSEMBLE ALLÉGÉE (Direction, 09/10). Quatre chiffres, une alerte au plus, une courbe, les
 * catégories, les prochains BV. Ce que l'écran répétait (« Il vous reste », la jauge, le camembert de répartition, le
 * bloc des enveloppes) est parti : le chiffre est dit une fois, les explications sont derrière ⓘ.
 *
 * C'est la même enveloppe et les mêmes requêtes que `VueEnsembleBudget` — seule la présentation du pôle Regulatory change.
 */

const ETAT: Record<ProchainBv["etat"], { libelle: string; tone: "neutral" | "warning" }> = {
  A_DEMANDER: { libelle: "à demander · Regulatory", tone: "neutral" },
  DEMANDE: { libelle: "demandé · chez les Finances", tone: "warning" },
};

export async function VueEnsembleRegulatory({ user, base, titre, overview, envelopes, tabs, exportHref }: {
  user: CurrentUser;
  /** Le chemin du module (`/budget-regulatory`). */
  base: string;
  titre: string;
  overview: BudgetOverview;
  envelopes: BudgetEnvelopeOption[];
  tabs: ModuleTab[];
  exportHref: string;
}) {
  const vue = await vueBvParDossier(user, overview);
  const t = overview.totals;
  const maintenant = new Date();

  const prochains = prochainsBv(vue.lignes, vue.depotPrevu);
  const prevision = resumePrevision(vue.lignes);
  const disponible = t.total - t.consumed - t.committed;
  const pctConsomme = t.total > 0 ? Math.round((t.consumed / t.total) * 100) : 0;
  const avancement = avancementPeriode(overview.period.from, overview.period.to, maintenant);

  const courbe = courbeProjection(
    overview.monthly.map((m) => ({ month: m.month, label: m.label, cumulative: m.cumulative })),
    prochains.filter((p) => p.nature === "75" && p.etat === "A_DEMANDER").map((p) => ({ mois: p.mois, montant: p.montant })),
    maintenant,
  );

  const categories = overview.categories
    .filter((c) => c.parentId === null && (c.allocated > 0 || c.consumed > 0))
    .map((c) => ({ label: c.name, budget: c.allocated, consumed: c.consumed }));

  const anneeDebut = overview.period.from.slice(0, 4);
  const anneeFin = overview.period.to.slice(0, 4);
  const exercice = anneeDebut === anneeFin ? anneeDebut : `${anneeDebut}–${anneeFin}`;

  return (
    <div className="space-y-5">
      <PageHeader title={titre} description={`Enveloppe ${exercice}`}>
        <a
          href={exportHref}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-secondary sm:min-h-0 sm:px-2.5"
          title="Exporter en Excel"
        >
          <Download className="h-4 w-4" /> Exporter
        </a>
        <InfoBulle label="À propos du budget Regulatory">
          Regulatory gère le budget des bons de versement (BV) des dossiers d&apos;enregistrement : 25 % en préparation, 75 % avant le dépôt.
          « BV 75 % à venir » = trois fois le BV 25 % connu, pour les dossiers dont le 75 % n&apos;est pas encore demandé.
          Il est daté au mois du dépôt prévu du dossier ; sans date, il reste hors de la courbe.
        </InfoBulle>
      </PageHeader>
      <ModuleTabs tabs={tabs} />

      <BudgetContextBar envelopes={envelopes} currentId={overview.envelope.id} from={overview.period.from} to={overview.period.to} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tuile label={`Budget ${exercice}`} valeur={formatCurrency(t.total)} />
        <Tuile
          label="Consommé" valeur={formatCurrency(t.consumed)}
          contexte={`${pctConsomme} % · à ${avancement} % de l'année`}
          ton={pctConsomme > avancement + 10 ? "alerte" : "defaut"}
        />
        <Tuile
          label="BV 75 % à venir" valeur={formatCurrency(prevision.montant)} ton={prevision.montant > 0 ? "alerte" : "defaut"}
          contexte={prevision.dossiers > 0 ? `${prevision.dossiers} dossier${prevision.dossiers > 1 ? "s" : ""} avant dépôt` : "aucun dossier en attente"}
        />
        <Tuile
          label="Disponible" valeur={formatCurrency(disponible)} ton={disponible < 0 ? "danger" : "ok"}
          contexte={`après BV à venir : ${formatCurrency(disponible - prevision.montant)}`}
          info={
            <InfoBulle label="Comment se calcule le disponible" align="right">
              Budget − consommé − engagé ({formatCurrency(t.committed)} demandés, pas encore réglés). « Après BV à venir » retranche en plus les 75 % attendus.
            </InfoBulle>
          }
        />
      </div>

      {overview.unattributed.total > 0 && (
        <Link
          href={`${base}/depenses?env=${overview.envelope.id}`}
          className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-warning/40 bg-warning/5 px-3 py-2.5 text-sm transition hover:bg-warning/10 sm:px-4"
        >
          <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
          <span className="min-w-0 flex-1 basis-[14rem]">
            <strong className="tabular-nums">{formatCurrency(overview.unattributed.total)}</strong> de dépenses ne sont rangées dans aucune catégorie.
          </span>
          <span className="inline-flex shrink-0 items-center gap-1 font-medium text-primary">Ranger <ArrowRight className="h-3.5 w-3.5" /></span>
        </Link>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <section className="surface min-w-0">
          <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-3">
            <h2 className="text-sm font-semibold">Consommation et BV prévus</h2>
            {courbe.nonDates.nombre > 0 && (
              <span className="text-xs text-muted-foreground">
                + {formatCurrency(courbe.nonDates.montant)} sans date de dépôt (hors courbe)
              </span>
            )}
          </header>
          <Projection
            labels={courbe.labels} reel={courbe.reel} projete={courbe.projete} budget={t.total}
            format={formatCurrency} budgetLabel="Budget" projeteLabel="BV 75 % attendus"
          />
        </section>

        <section className="surface min-w-0">
          <header className="px-4 py-3"><h2 className="text-sm font-semibold">Par catégorie</h2></header>
          <div className="px-4 pb-4">
            {categories.length === 0
              ? <p className="text-sm text-muted-foreground">Le budget n&apos;est pas encore réparti en catégories.</p>
              : <Bars rows={categories} format={formatCurrency} />}
          </div>
        </section>
      </div>

      <section className="surface min-w-0 overflow-hidden">
        <header className="flex items-center justify-between gap-2 px-4 py-3">
          <h2 className="text-sm font-semibold">Prochains BV</h2>
          <Link href={`${base}/bv?env=${overview.envelope.id}`} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
            Tous les dossiers <ArrowRight className="h-3 w-3" />
          </Link>
        </header>
        {prochains.length === 0 ? (
          <p className="px-4 pb-4 text-sm text-muted-foreground">Aucun BV à venir.</p>
        ) : (
          <Table className="min-w-[40rem]">
            <TableHeader className="border-y border-border bg-secondary/40">
              <TableRow>
                <TableHead scope="col" className="px-4">Dossier · produit</TableHead>
                <TableHead scope="col">BV</TableHead>
                <TableHead scope="col" className="text-right">Montant</TableHead>
                <TableHead scope="col">Quand</TableHead>
                <TableHead scope="col">État</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {prochains.map((p) => (
                <TableRow key={`${p.dossierId}-${p.nature}-${p.etat}`}>
                  <TableCell className="whitespace-nowrap px-4">
                    {vue.lienDossiers
                      ? <Link href={`/regulatory/${p.dossierId}`} className="font-medium text-primary hover:underline">{p.reference}</Link>
                      : <span className="font-medium">{p.reference}</span>}
                    <span className="text-muted-foreground"> · {p.produit}</span>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{p.nature} %</TableCell>
                  <TableCell className="whitespace-nowrap text-right tabular-nums">{formatCurrency(p.montant)}</TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{libelleMois(p.mois)}</TableCell>
                  <TableCell className="whitespace-nowrap"><Badge tone={ETAT[p.etat].tone} dot={false}>{ETAT[p.etat].libelle}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </div>
  );
}
