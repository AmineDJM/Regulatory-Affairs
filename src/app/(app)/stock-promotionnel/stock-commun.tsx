"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import type { BadgeTone } from "@/lib/labels";
import { cn, formatDate } from "@/lib/utils";
import { FAMILLE_LABEL, type PromoFamille } from "@/lib/promo/catalogue";
import { ETAT_VALIDITE_LABEL, MAGASIN, STOCK_LEVEL_LABEL, stockLevel, type EtatValidite } from "@/lib/promo/stock";
import type { FaitsStock } from "@/lib/promo/stock-acces";
import type { ArticleVue, PageStock, SoldeVue } from "@/lib/queries/promo-stock";

/**
 * Ce que les quatre vues du stock partagent : la lecture d'un solde, d'un lot, d'une date, et le
 * nom d'un détenteur. Une seule lecture, sinon deux vues finiraient par compter différemment le
 * même article (§118.51 — un tableau de bord ment par son dénominateur).
 */

export const nombre = (n: number): string => n.toLocaleString("fr-FR", { maximumFractionDigits: 3 });

/**
 * Une fin de validité est stockée à minuit UTC du jour dit : on la lit en UTC, sinon un fuseau à
 * l'ouest de Greenwich l'afficherait la veille — et « valable jusqu'au 30 » deviendrait « 29 ».
 */
export const jour = (iso: string | null): string =>
  iso ? formatDate(iso, { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }) : "—";

/** Un horodatage, au jour — l'heure dépendrait du fuseau du serveur qui rend la page. */
export const date = (iso: string | null): string => formatDate(iso, { day: "2-digit", month: "short", year: "numeric" });

/** Depuis combien de jours, compté contre l'heure du SERVEUR (`page.maintenant`) — jamais l'horloge du poste. */
export function depuis(iso: string, maintenant: string): string {
  const j = Math.floor((new Date(maintenant).getTime() - new Date(iso).getTime()) / 86_400_000);
  if (j <= 0) return "aujourd'hui";
  if (j === 1) return "depuis hier";
  return `depuis ${j} jours`;
}

export function soldeDe(a: ArticleVue, detenteurId: string | null): SoldeVue | undefined {
  return a.soldes.find((s) => s.detenteurId === detenteurId);
}

export function quantiteDe(a: ArticleVue, detenteurId: string | null): number {
  return soldeDe(a, detenteurId)?.quantite ?? 0;
}

/**
 * CE QUI PEUT PARTIR (dotation, transfert, retour) — hors lots périmés, exactement comme la règle
 * d'allocation (`allouer`, `inclurePerimes: false`). Afficher le solde brut à côté d'un bouton
 * « Doter » ferait proposer des unités que l'action refusera.
 */
export function distribuable(a: ArticleVue, detenteurId: string | null): number {
  const s = soldeDe(a, detenteurId);
  if (!s) return 0;
  const etat = new Map(a.lots.map((l) => [l.id, l.etat]));
  return Math.round(s.parLot.reduce((t, p) => t + (p.quantite > 0 && etat.get(p.lotId) !== "PERIME" ? p.quantite : 0), 0) * 1000) / 1000;
}

/** Les unités encore en main dans un lot PÉRIMÉ — elles se déclarent détruites, elles ne se remettent pas. */
export function enLotPerime(a: ArticleVue, detenteurId: string | null): number {
  const s = soldeDe(a, detenteurId);
  if (!s) return 0;
  const etat = new Map(a.lots.map((l) => [l.id, l.etat]));
  return Math.round(s.parLot.reduce((t, p) => t + (p.quantite > 0 && etat.get(p.lotId) === "PERIME" ? p.quantite : 0), 0) * 1000) / 1000;
}

export function nomDe(page: PageStock, id: string | null): string {
  if (id === null) return page.personnes[MAGASIN] ?? "Magasin central";
  return page.personnes[id] ?? "Compte supprimé";
}

/** Les faits reçus du serveur, l'équipe redevenue un ensemble — pour appeler les prédicats purs. */
export function faitsDe(page: PageStock): FaitsStock {
  return { ...page.faits, equipe: new Set(page.faits.equipe) };
}

export const TON_VALIDITE: Record<EtatValidite, BadgeTone> = {
  SANS_DATE: "neutral",
  VALIDE: "success",
  BIENTOT: "warning",
  PERIME: "danger",
};

export function BadgeValidite({ etat, fin }: { etat: EtatValidite; fin: string | null }) {
  if (etat === "SANS_DATE") return null;
  return (
    <Badge tone={TON_VALIDITE[etat]} title={`Valable jusqu'au ${jour(fin)}`}>
      {etat === "VALIDE" ? `jusqu'au ${jour(fin)}` : `${ETAT_VALIDITE_LABEL[etat]} · ${jour(fin)}`}
    </Badge>
  );
}

const TON_NIVEAU = { OUT: "danger", LOW: "warning", OK: "success" } as const;

export function BadgeNiveau({ quantite, seuil }: { quantite: number; seuil: number | null }) {
  const niveau = stockLevel(quantite, seuil);
  return <Badge tone={TON_NIVEAU[niveau]} dot>{STOCK_LEVEL_LABEL[niveau]}</Badge>;
}

export function BadgeFamille({ famille }: { famille: PromoFamille }) {
  return <Badge tone={famille === "DURABLE" ? "purple" : famille === "NUMERIQUE" ? "info" : "neutral"}>{FAMILLE_LABEL[famille]}</Badge>;
}

/** Le titre d'un article : son libellé, sa référence de catalogue en petit. */
export function TitreArticle({ a, className }: { a: ArticleVue; className?: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      <p className="break-words font-medium text-foreground">{a.libelle}</p>
      <p className="text-xs text-muted-foreground [overflow-wrap:anywhere]">
        {a.catalogue.reference}
        {a.societe ? ` · ${a.societe}` : ""}
        {a.location ? ` · ${a.location}` : ""}
      </p>
    </div>
  );
}

/** Les lots d'un détenteur, au plus tôt périmé d'abord — ce que la règle d'allocation fera partir en premier. */
export function LotsDuDetenteur({ a, detenteurId }: { a: ArticleVue; detenteurId: string | null }) {
  const s = soldeDe(a, detenteurId);
  if (!s || s.parLot.length === 0) return null;
  const lots = new Map(a.lots.map((l) => [l.id, l]));
  const lignes = s.parLot
    .filter((p) => p.quantite !== 0)
    .map((p) => ({ p, lot: lots.get(p.lotId) }))
    .sort((x, y) => (x.lot?.valableJusquau ?? "9999").localeCompare(y.lot?.valableJusquau ?? "9999") || (x.lot?.numero ?? 0) - (y.lot?.numero ?? 0));
  if (lignes.length <= 1 && lignes.every((l) => l.lot?.etat === "SANS_DATE")) return null;
  return (
    <ul className="mt-1 flex flex-wrap gap-1.5">
      {lignes.map(({ p, lot }) => (
        <li key={p.lotId} className="inline-flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5 text-xs text-muted-foreground">
          <span>Lot {lot?.numero ?? "?"} · {nombre(p.quantite)}</span>
          {lot && <BadgeValidite etat={lot.etat} fin={lot.valableJusquau} />}
        </li>
      ))}
    </ul>
  );
}

export function Section({
  titre, aide, compte, actions, children,
}: { titre: string; aide?: string; compte?: number; actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="surface space-y-3 p-3 sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="flex flex-wrap items-center gap-2 text-base font-semibold text-foreground">
            {titre}
            {compte !== undefined && compte > 0 && <Badge tone="info">{compte}</Badge>}
          </h2>
          {aide && <p className="text-xs text-muted-foreground">{aide}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </section>
  );
}

/** Un chiffre clé — le même dessin dans les vues du magasin, générale et du tableau de bord. */
export function Chiffre({ label, valeur, ton = "neutre", aide }: { label: string; valeur: string; ton?: "neutre" | "alerte" | "danger" | "info"; aide?: string }) {
  return (
    <div className="surface min-w-0 p-3" title={aide}>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={cn(
        "mt-1 break-words text-lg font-semibold tabular-nums sm:text-xl",
        ton === "alerte" && "text-warning", ton === "danger" && "text-destructive", ton === "info" && "text-blue-600",
      )}>{valeur}</p>
    </div>
  );
}

export function Vide({ children }: { children: React.ReactNode }) {
  return <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-sm text-muted-foreground">{children}</p>;
}
