"use client";

import { CHEMIN_STOCK_PROMO, MENU_STOCK_PROMO } from "@/lib/chemins/stock-promo";
import * as React from "react";
import Link from "next/link";
import { Package } from "lucide-react";
import type { StockPourVisite } from "@/lib/queries/promo-remises";
import { cn } from "@/lib/utils";

/** Ce qu'une visite a déjà remis et présenté — le point de départ d'une correction. */
export interface RemisesInitiales {
  materiel: { itemId: string; libelle: string; quantite: number }[];
  numeriques: { itemId: string; libelle: string }[];
}

const nombre = (n: number) => n.toLocaleString("fr-FR", { maximumFractionDigits: 3 });

/**
 * LE BLOC « MATÉRIEL REMIS » (§118.166) — le même dans les trois façons de noter une visite : le
 * rapport d'une visite planifiée, la visite imprévue, et la saisie rapide. L'écrire trois fois
 * ferait diverger les saisies au premier champ ajouté (§118.5).
 *
 * Il ne propose que ce que le délégué a EN MAIN : remettre un article qu'on n'a pas est refusé, et
 * la Direction l'a voulu ainsi (« au-delà du stock enregistré : bloquer »). Le chiffre affiché est
 * une indication ; c'est l'action, sous le verrou de l'article, qui tranche — et qui le DIT.
 *
 * Les articles qui portent un produit coché viennent en premier : la fiche posologique du produit
 * qu'on vient de présenter est celle qu'on cherche, pas celle d'un autre.
 */
export function BlocMaterielRemis({
  stock, produitsCoches, initial, compact = false,
}: {
  stock: StockPourVisite;
  produitsCoches: ReadonlySet<string>;
  initial?: RemisesInitiales | undefined;
  /** Dans la saisie rapide : replié par défaut, pour garder « trois champs, rien de plus ». */
  compact?: boolean;
}) {
  const dejaRemis = React.useMemo(() => new Map((initial?.materiel ?? []).map((m) => [m.itemId, m])), [initial]);
  const dejaPresentes = React.useMemo(() => new Set((initial?.numeriques ?? []).map((n) => n.itemId)), [initial]);

  // CE QUI SE PROPOSE : ce qui est en main, plus ce que la visite a déjà remis (une correction doit
  // pouvoir revenir sur un article qu'on n'a plus — on l'a justement tout donné).
  const lignes = React.useMemo(() => {
    const parId = new Map(stock.articles.map((a) => [a.itemId, a]));
    const tous = [
      ...stock.articles,
      ...[...dejaRemis.values()]
        .filter((m) => !parId.has(m.itemId))
        .map((m) => ({ itemId: m.itemId, reference: "", libelle: m.libelle, unite: "", famille: "CONSOMMABLE" as const, produitIds: [] as string[], distribuable: 0, perime: 0 })),
    ];
    const pertinent = (a: { produitIds: string[] }) => a.produitIds.some((id) => produitsCoches.has(id));
    return [...tous].sort((a, b) => Number(pertinent(b)) - Number(pertinent(a)) || a.libelle.localeCompare(b.libelle, "fr"));
  }, [stock.articles, dejaRemis, produitsCoches]);

  const supports = React.useMemo(() => {
    const parId = new Map(stock.numeriques.map((n) => [n.itemId, n]));
    const tous = [
      ...stock.numeriques,
      ...(initial?.numeriques ?? []).filter((n) => !parId.has(n.itemId)).map((n) => ({ itemId: n.itemId, reference: "", libelle: n.libelle, produitIds: [] as string[], lien: null, valableJusquau: null })),
    ];
    const pertinent = (a: { produitIds: string[] }) => a.produitIds.some((id) => produitsCoches.has(id));
    return [...tous].sort((a, b) => Number(pertinent(b)) - Number(pertinent(a)) || a.libelle.localeCompare(b.libelle, "fr"));
  }, [stock.numeriques, initial, produitsCoches]);

  const vide = lignes.length === 0 && supports.length === 0;
  const contenu = vide ? (
    <p className="rounded-lg border border-dashed border-border p-2.5 text-xs text-muted-foreground">
      Vous n&apos;avez aucun matériel en main. Une dotation se demande depuis{" "}
      <Link href={CHEMIN_STOCK_PROMO} className="text-primary hover:underline">{MENU_STOCK_PROMO}</Link>.
    </p>
  ) : (
    <div className="space-y-2">
      {lignes.length > 0 && (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {lignes.map((a) => {
            const deja = dejaRemis.get(a.itemId)?.quantite ?? 0;
            const pertinent = a.produitIds.some((id) => produitsCoches.has(id));
            return (
              <li key={a.itemId} className="flex items-center gap-2 px-2.5 py-2 sm:py-1.5">
                <div className="min-w-0 flex-1">
                  <p className={cn("truncate text-sm", pertinent && "font-medium")}>{a.libelle}</p>
                  <p className="text-xs text-muted-foreground">
                    {nombre(a.distribuable)} en main{a.unite ? ` (${a.unite})` : ""}
                    {deja > 0 && <> · {nombre(deja)} déjà remis lors de cette visite</>}
                    {a.perime > 0 && <> · <span className="text-warning">{nombre(a.perime)} périmé(s), ne se remettent pas</span></>}
                  </p>
                </div>
                <input type="hidden" name="materielItemId" value={a.itemId} />
                <label className="sr-only" htmlFor={`remis-${a.itemId}`}>Quantité remise — {a.libelle}</label>
                <input
                  id={`remis-${a.itemId}`} name="materielQuantite" type="number" inputMode="decimal" min={0} step="any"
                  defaultValue={deja > 0 ? String(deja) : ""} placeholder="0"
                  // Au pouce : un champ de 44 px, et 16 px de texte pour qu'iOS ne zoome pas sur la saisie.
                  className="h-11 w-24 shrink-0 rounded-md border border-input bg-background px-2 text-right text-base tabular-nums sm:h-9 sm:w-20 sm:text-sm"
                />
              </li>
            );
          })}
        </ul>
      )}
      {supports.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Supports numériques présentés (sans quantité : ils se montrent, ils ne se donnent pas)</p>
          <div className="flex flex-wrap gap-2">
            {supports.map((s) => (
              <label key={s.itemId} className="inline-flex min-h-10 max-w-full items-center gap-2 rounded-lg border border-input px-3 py-2 text-sm [overflow-wrap:anywhere] sm:min-h-0 sm:gap-1.5 sm:px-2 sm:py-1">
                <input type="checkbox" name="numeriqueItemId" value={s.itemId} defaultChecked={dejaPresentes.has(s.itemId)} className="h-5 w-5 shrink-0 rounded border-input sm:h-4 sm:w-4" />
                {s.libelle}
              </label>
            ))}
          </div>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Ce qui est remis sort de votre stock. Au-delà de ce que vous avez en main, rien n&apos;est enregistré — ni la visite, ni la remise.
      </p>
    </div>
  );

  if (compact) {
    return (
      <details className="rounded-lg border border-border px-3 py-2" open={dejaRemis.size > 0 || dejaPresentes.size > 0}>
        <summary className="flex min-h-10 cursor-pointer items-center gap-1.5 text-sm font-medium sm:min-h-0">
          <Package className="h-4 w-4" aria-hidden /> Matériel remis <span className="font-normal text-muted-foreground">(facultatif)</span>
        </summary>
        <div className="pt-2">{contenu}</div>
      </details>
    );
  }
  return (
    <div className="space-y-1.5">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Package className="h-3.5 w-3.5" aria-hidden /> Matériel remis
      </p>
      {contenu}
    </div>
  );
}
