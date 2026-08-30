import { AlertTriangle } from "lucide-react";
import { ETAPES_MARCHE } from "@/lib/pch/market-math";
import { formatCurrency } from "@/lib/utils";
import type { Market360 } from "@/lib/queries/market-360";

/**
 * L'EN-TÊTE VIVANT DU MARCHÉ — la progression, les chiffres, les trous. Tout serveur : rien
 * ici ne se clique, tout se lit — l'objectif du §7 est qu'un dirigeant comprenne le marché en
 * quinze secondes, pas qu'il ait quinze boutons.
 */

/** La barre Préparation → … → Clôture. `etape = -1` (annulé / suspendu / perdu) : hors chemin,
 *  le badge d'état du header porte le verdict — on ne dessine pas une progression qui ment. */
export function MarketProgress({ etape }: { etape: number }) {
  if (etape < 0) return null;
  return (
    <ol className="flex flex-wrap items-center gap-y-1 text-xs" aria-label="Progression du marché">
      {ETAPES_MARCHE.map((label, i) => (
        <li key={label} className="flex items-center">
          {i > 0 && <span aria-hidden className={`mx-1.5 h-px w-4 sm:w-6 ${i <= etape ? "bg-primary" : "bg-border"}`} />}
          <span
            aria-current={i === etape ? "step" : undefined}
            className={
              i < etape
                ? "text-muted-foreground line-through decoration-transparent"
                : i === etape
                  ? "rounded-full bg-primary/10 px-2 py-0.5 font-semibold text-primary"
                  : "text-muted-foreground/60"
            }
          >
            {label}
          </span>
        </li>
      ))}
    </ol>
  );
}

/** La bande de chiffres : soumis → attribué → contrat courant → commandé → livré → facturé →
 *  encaissé. Une bande, pas huit cartes — les libellés portent le sens, la densité la lecture. */
export function MarketKpis({ finances }: { finances: Market360["finances"] }) {
  const f = finances;
  const kpis: { label: string; value: number | null; tone?: "ok" | "warn" }[] = [
    { label: "Soumis", value: f.soumis },
    { label: "Attribué", value: f.attribue },
    { label: "Contrat (courant)", value: f.contratCourant },
    { label: "Commandé", value: f.commande },
    { label: "Livré", value: f.livre },
    { label: "Facturé", value: f.facture },
    { label: "Encaissé", value: f.encaisse, tone: "ok" },
    { label: "Reste à encaisser", value: f.resteAEncaisser, tone: f.resteAEncaisser > 0 ? "warn" : "ok" },
  ];
  return (
    <div className="surface grid grid-cols-2 gap-x-4 gap-y-3 p-4 sm:grid-cols-4 lg:grid-cols-8">
      {kpis.map((k) => (
        <div key={k.label} className="min-w-0">
          <p className="truncate text-xs text-muted-foreground">{k.label}</p>
          <p className={`truncate text-sm font-semibold tabular-nums ${k.tone === "warn" ? "text-warning" : k.tone === "ok" ? "text-success" : ""}`}>
            {k.value === null ? "—" : formatCurrency(k.value)}
          </p>
        </div>
      ))}
      {f.contratInitial !== null && f.contratCourant !== null && f.contratCourant !== f.contratInitial && (
        <p className="col-span-full text-xs text-muted-foreground">
          Contrat initial {formatCurrency(f.contratInitial)} — la valeur courante intègre les avenants effectifs.
        </p>
      )}
    </div>
  );
}

/** Les TROUS du dossier, en tête et en orange : ce que le dossier devrait porter et ne porte
 *  pas. Une liste vide ne s'affiche pas — pas de carte « tout va bien » décorative. */
export function MarketGaps({ manques }: { manques: string[] }) {
  if (manques.length === 0) return null;
  return (
    <div className="rounded-lg border border-warning/25 bg-warning/10 px-3 py-2">
      <ul className="space-y-1 text-sm">
        {manques.map((m) => (
          <li key={m} className="flex gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
            <span>{m}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
