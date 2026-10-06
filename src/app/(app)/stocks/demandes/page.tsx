import type { ComponentProps } from "react";
import Link from "next/link";
import { ArrowLeft, ClipboardList } from "lucide-react";
import { requireModule } from "@/lib/session";
import { porteeGlobale } from "@/lib/stocks/portee";
import { chargerProduitsStock } from "@/lib/queries/stock-portee";
import {
  peutPiloterDemandesStocks, chargerCouvertureKams, chargerHopitauxCandidats, chargerDemandesStocks, chargerMesDemandesStocks,
} from "@/lib/queries/demande-stocks";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { formatDate } from "@/lib/utils";
import { NouvelleDemandeStocks } from "./nouvelle-demande";

/**
 * DEMANDES DE STOCKS — DO → KAM (Direction, 06/10).
 *
 * Deux publics sur la même adresse, chacun ne reçoit QUE ses données : qui pilote (la règle de
 * « Demander un état de stock ») voit toutes les demandes et le formulaire ; un KAM voit celles
 * qui lui sont adressées. Rien de l'un n'est chargé pour l'autre.
 */
export default async function DemandesStocksPage() {
  const user = await requireModule("STOCKS");
  const pilote = peutPiloterDemandesStocks(user);

  const [mes, toutes, formulaire] = await Promise.all([
    chargerMesDemandesStocks(user.id),
    pilote ? chargerDemandesStocks() : Promise.resolve([]),
    pilote
      ? Promise.all([chargerHopitauxCandidats(), chargerProduitsStock(user, porteeGlobale()), chargerCouvertureKams()])
      : Promise.resolve(null),
  ]);

  let donneesFormulaire: ComponentProps<typeof NouvelleDemandeStocks> | null = null;
  if (formulaire) {
    const [candidats, catalogue, couv] = formulaire;
    const ids = new Set(catalogue.map((p) => p.id));
    donneesFormulaire = {
      hopitaux: candidats.map((h) => ({ ...h, porteurs: couv.couverture.get(h.id) ?? [] })),
      produits: catalogue.map((p) => ({ id: p.id, label: p.label })),
      produitsParBu: Object.fromEntries(Object.entries(couv.produitsParBu).map(([bu, ps]) => [bu, ps.filter((p) => ids.has(p))])),
      kams: Object.fromEntries(couv.noms),
    };
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Demandes de stocks"
        description="La Direction des opérations choisit les établissements (aucun = tous) et, pour chacun, les produits (aucun = tous ceux que ses KAM portent). Chaque KAM reçoit SES établissements et renseigne le stock de chaque produit, en boîtes."
      >
        <Link href="/stocks" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Stocks
        </Link>
      </PageHeader>

      {mes.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">À renseigner par vous</h2>
          <ul className="divide-y divide-border rounded-lg border border-border">
            {mes.map((d) => (
              <li key={d.id}>
                <Link href={`/stocks/demandes/${d.id}`} className="flex flex-col gap-1.5 px-3 py-2.5 hover:bg-secondary/50 sm:flex-row sm:items-center sm:justify-between">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{d.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {d.auteur ? `${d.auteur} · ` : ""}{formatDate(d.createdAt)}{d.dueDate ? ` · échéance ${formatDate(d.dueDate)}` : ""}
                    </span>
                  </span>
                  <span className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground">{d.remplies}/{d.lignes}</span>
                    {d.envoyeLe
                      ? <Badge tone="success">Envoyé</Badge>
                      : d.status === "OUVERTE" ? <Badge tone="warning">À renseigner</Badge> : <Badge tone="neutral">Clôturée</Badge>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {pilote && donneesFormulaire && <NouvelleDemandeStocks {...donneesFormulaire} />}

      {pilote && (
        <section className="space-y-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            <ClipboardList className="h-4 w-4" /> Demandes lancées ({toutes.length})
          </h2>
          {toutes.length === 0 ? (
            <p className="rounded-lg border border-border bg-secondary/40 px-3 py-2.5 text-sm text-muted-foreground">
              Aucune demande de stocks pour l&apos;instant.
            </p>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {toutes.map((d) => {
                const pct = d.lignes === 0 ? 0 : Math.round((d.remplies / d.lignes) * 100);
                return (
                  <li key={d.id}>
                    <Link href={`/stocks/demandes/${d.id}`} className="grid grid-cols-1 gap-2 px-3 py-2.5 hover:bg-secondary/50 sm:grid-cols-[1fr_14rem] sm:items-center">
                      <span className="min-w-0">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="truncate font-medium">{d.title}</span>
                          {d.status === "CLOTUREE" && <Badge tone="neutral">Clôturée</Badge>}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {d.auteur ? `${d.auteur} · ` : ""}{formatDate(d.createdAt)}{d.dueDate ? ` · échéance ${formatDate(d.dueDate)}` : ""}
                          {" · "}{d.hopitaux} établissement{d.hopitaux > 1 ? "s" : ""} · {d.envoyes}/{d.kams} KAM ont répondu
                        </span>
                      </span>
                      <span className="space-y-1">
                        <Progress value={pct} tone={pct === 100 ? "success" : "primary"} />
                        <span className="block text-right text-xs text-muted-foreground">{d.remplies}/{d.lignes} stocks · {pct} %</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {!pilote && mes.length === 0 && (
        <p className="rounded-lg border border-border bg-secondary/40 px-3 py-2.5 text-sm text-muted-foreground">
          Aucune demande de stocks ne vous a été adressée.
        </p>
      )}
    </div>
  );
}
