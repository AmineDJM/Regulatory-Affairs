import Link from "next/link";
import { ArrowRight, CalendarCheck, Users } from "lucide-react";
import { requireModule } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { loadMyFieldDay } from "@/lib/queries/my-field-day";
import { PageHeader } from "@/components/shared/page-header";
import { ModuleTabs } from "@/components/shared/module-tabs";
import { visibleTabs } from "@/lib/nav-tabs";
import { MEDICAL_TABS } from "@/lib/labels";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import { DayClient } from "./day-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Ma journée — AMD Internal OS" };

/**
 * « MA JOURNÉE » — le seul écran dont un délégué a besoin.
 *
 * ── POURQUOI CET ÉCRAN EXISTE ───────────────────────────────────────────────────────────────
 *
 * Le pilotage de la force de vente était complet d'un bout : la Direction prévoit, on affecte
 * les produits, le cockpit compare planifié et réalisé. Mais l'écran de SAISIE du terrain avait
 * été retiré, et un cockpit sans réalisé pilote à l'aveugle — le « réalisé » venait de visites
 * que plus rien ne permettait d'enregistrer simplement.
 *
 * On ne rétablit donc pas l'ancien module : on écrit l'écran qui manquait vraiment. Il répond à
 * UNE question — « qui je vais voir, et comment je le note ? » — et il tient sur un téléphone.
 * Tout le reste (le panel entier, l'annuaire, les rapports) vit ailleurs et reste accessible.
 *
 * ── LA LIGNE DE CHIFFRES ────────────────────────────────────────────────────────────────────
 *
 * Quatre nombres, jamais plus : fait / attendu, la part du panel touchée, et le rythme à tenir
 * sur les jours ouvrés qui restent (semaine algérienne). Un cinquième ne serait plus lu. Ils ne
 * notent personne — ils disent à un homme où il en est de son propre mois.
 */
export default async function MaJourneePage() {
  const user = await requireModule("MEDICAL");
  const day = await loadMyFieldDay(user.id);
  const p = day.progress;
  const canLog = userCan(user, "MEDICAL", "CREATE");

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader
        title={`Bonjour ${user.name.split(" ")[0]}`}
        description="Qui voir aujourd'hui, et la visite à noter en trois gestes."
      />
      <ModuleTabs tabs={await visibleTabs(user, MEDICAL_TABS)} />

      {/* LA LIGNE DE CHIFFRES — grande, lisible d'un coup d'œil, en haut. */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <p className="text-2xl font-semibold tabular-nums">
              {p.done} <span className="text-base font-normal text-muted-foreground">/ {p.target} visites ce mois</span>
            </p>
            <span className={`text-sm font-medium ${p.donePct >= 90 ? "text-success" : p.donePct >= 60 ? "text-warning" : "text-destructive"}`}>
              {p.donePct} %
            </span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-secondary">
            <div className={`h-full rounded-full ${p.donePct >= 90 ? "bg-success" : "bg-primary"} transition-all`} style={{ width: `${Math.min(100, p.donePct)}%` }} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Panel couvert à <strong className="text-foreground">{p.coveragePct} %</strong> ({p.covered}/{p.panelSize} praticiens)
            {p.perDay > 0
              ? <> · <strong className="text-foreground">{p.perDay} visite{p.perDay > 1 ? "s" : ""} par jour</strong> sur les {p.workdaysLeft} jours ouvrés restants</>
              : p.target > 0 ? " · objectif du mois atteint" : ""}
          </p>
        </CardContent>
      </Card>

      {/* CE QUI MANQUE SE DIT — une page vide laisse croire à une panne, et l'on n'y revient pas. */}
      {day.panelVide && (
        <div className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2.5 text-sm">
          <strong>Aucun praticien ne vous est rattaché.</strong> Votre tournée ne peut pas se construire —
          demandez à votre superviseur de vous affecter votre panel depuis l&apos;annuaire médical.
        </div>
      )}
      {!day.panelVide && day.sansAffectation && (
        <div className="rounded-lg border border-border bg-secondary/40 px-3 py-2.5 text-sm text-muted-foreground">
          Aucun produit ne vous est affecté pour ce cycle : vos visites s&apos;enregistrent, mais sans
          les produits présentés. Votre superviseur les affecte depuis Prévisions &amp; Force de vente.
        </div>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            <CalendarCheck className="h-4 w-4" /> À voir en priorité
          </h2>
          <Link href="/medical/annuaire" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
            Mon panel <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        {canLog ? (
          <DayClient tournee={day.tournee} panel={day.panel} produits={day.produits} />
        ) : (
          <p className="text-sm text-muted-foreground">Vous n&apos;avez pas le droit de saisir des visites.</p>
        )}
      </section>

      {/* LA PREUVE QUE LA SAISIE EST ARRIVÉE QUELQUE PART. Sans retour visible, on doute d'avoir
          enregistré, on ressaisit, et le compteur ment. */}
      {day.recentes.length > 0 && (
        <section className="space-y-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            <Users className="h-4 w-4" /> Mes dernières visites
          </h2>
          <ul className="divide-y divide-border rounded-lg border border-border">
            {day.recentes.map((v) => (
              <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                <span className="min-w-0">
                  <span className="font-medium">{v.doctorName}</span>
                  {v.produits.length > 0 && (
                    <span className="block truncate text-xs text-muted-foreground">{v.produits.join(" · ")}</span>
                  )}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">{formatDate(v.date.toISOString())}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
