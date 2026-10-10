"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { montantCourt } from "@/lib/products/fiche-360";
import { tonSante, decimal, type NoteSante, type Alerte360 } from "@/lib/products/sante";

/**
 * LE PORTEFEUILLE (Produits 360, liste des commercialisés) — le tableau trié par santé, et « Comparer » : 2 à 4 produits
 * cochés s'ouvrent côte à côte (l'URL porte la sélection, la comparaison est rendue par le serveur). N'importe que des
 * modules PURS (`products/sante.ts`, `products/fiche-360.ts`) : aucune lecture ne part dans le navigateur.
 */

export interface LignePortefeuille {
  id: string;
  nom: string;
  sousTitre: string;
  sante: NoteSante | null;
  couvertureMois: number | null | undefined;
  visites: { cycle: number; evolutionPct: number | null } | null | undefined;
  prescripteursA: number | null | undefined;
  adpro: number | null | undefined;
  alerte: Alerte360 | null;
}

const TON_PILL = {
  success: "bg-success/10 text-success", warning: "bg-warning/10 text-warning", danger: "bg-destructive/10 text-destructive",
  info: "bg-primary/10 text-primary", neutral: "bg-muted text-muted-foreground",
} as const;

function Pill({ ton, children }: { ton: keyof typeof TON_PILL; children: React.ReactNode }) {
  return <span className={cn("inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium tabular-nums", TON_PILL[ton])}>{children}</span>;
}

const ND = () => <span className="text-muted-foreground">n/d</span>;

export function FiltreBu({ bus, actif, base }: { bus: { id: string; nom: string }[]; actif: string | null; base: string }) {
  const router = useRouter();
  return (
    <select
      aria-label="Business Unit" value={actif ?? ""}
      onChange={(e) => router.push(`/produits?${base}${e.target.value ? `${base ? "&" : ""}bu=${encodeURIComponent(e.target.value)}` : ""}`)}
      className="h-9 rounded-md border border-input bg-card px-2 text-sm"
    >
      <option value="">Toutes les BU</option>
      {bus.map((b) => <option key={b.id} value={b.id}>{b.nom}</option>)}
    </select>
  );
}

export function TableauPortefeuille({ lignes, colonnes, selection, base }: {
  lignes: LignePortefeuille[];
  colonnes: { stock: boolean; visites: boolean; prescripteurs: boolean; adpro: boolean };
  selection: string[];
  /** La requête courante sans `comparer` (onglet, recherche, BU). */
  base: string;
}) {
  const router = useRouter();
  const [choix, setChoix] = React.useState<string[]>(selection);
  const basculer = (id: string) => setChoix((c) => (c.includes(id) ? c.filter((x) => x !== id) : c.length >= 4 ? c : [...c, id]));
  const comparer = () => router.push(`/produits?${base}${base ? "&" : ""}comparer=${choix.join(",")}`);
  const nb = 3 + Number(colonnes.stock) + Number(colonnes.visites) + Number(colonnes.prescripteurs) + Number(colonnes.adpro);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-end gap-2 text-sm">
        {choix.length > 0 && <span className="text-xs text-muted-foreground">{choix.length} / 4 sélectionné{choix.length > 1 ? "s" : ""}</span>}
        {choix.length > 0 && <button type="button" onClick={() => setChoix([])} className="rounded-md border border-border px-2.5 py-1 text-xs hover:bg-secondary">Vider</button>}
        <button type="button" onClick={comparer} disabled={choix.length < 2}
          className="rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50">
          Comparer
        </button>
      </div>
      {/* Un tableau reste un tableau au téléphone : la première colonne reste visible, le reste défile. */}
      <div className="surface overflow-hidden">
        <div className="overflow-x-auto [-webkit-overflow-scrolling:touch]">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
              <tr className="border-b border-border">
                <th className="sticky left-0 z-[1] bg-card px-3 py-2 font-medium">Produit</th>
                <th className="whitespace-nowrap px-3 py-2 font-medium">Santé</th>
                {colonnes.stock && <th className="whitespace-nowrap px-3 py-2 text-right font-medium">Couverture stock</th>}
                {colonnes.visites && <th className="whitespace-nowrap px-3 py-2 text-right font-medium">Visites (cycle)</th>}
                {colonnes.prescripteurs && <th className="whitespace-nowrap px-3 py-2 text-right font-medium">Prescripteurs A</th>}
                {colonnes.adpro && <th className="whitespace-nowrap px-3 py-2 text-right font-medium">Ad &amp; Pro 12 m</th>}
                <th className="whitespace-nowrap px-3 py-2 font-medium">Alerte principale</th>
              </tr>
            </thead>
            <tbody>
              {lignes.length === 0 && <tr><td colSpan={nb} className="px-3 py-6 text-center text-muted-foreground">Aucun produit.</td></tr>}
              {lignes.map((p) => {
                const coche = choix.includes(p.id);
                return (
                  <tr key={p.id} className={cn("border-b border-border/60 last:border-0 hover:bg-secondary/40", coche && "bg-primary/5")}>
                    <td className="sticky left-0 z-[1] bg-card px-3 py-2">
                      <span className="flex items-center gap-2">
                        <input type="checkbox" checked={coche} onChange={() => basculer(p.id)} disabled={!coche && choix.length >= 4}
                          aria-label={`Comparer ${p.nom}`} className="h-4 w-4 shrink-0 accent-primary" />
                        <Link href={`/produits/${p.id}`} className="block min-w-[9rem] max-w-[16rem]">
                          <b className="block truncate font-medium text-foreground hover:underline">{p.nom}</b>
                          <small className="block truncate text-xs text-muted-foreground">{p.sousTitre}</small>
                        </Link>
                      </span>
                    </td>
                    <td className="px-3 py-2" title={p.sante?.composantes.map((c) => `${c.libelle} : ${c.note ?? "n/d"}`).join(" · ")}>
                      <Pill ton={tonSante(p.sante?.score ?? null)}>{p.sante?.score ?? "n/d"}</Pill>
                    </td>
                    {colonnes.stock && (
                      <td className={cn("whitespace-nowrap px-3 py-2 text-right tabular-nums", p.couvertureMois != null && p.couvertureMois < 2 ? "text-destructive" : p.couvertureMois != null && p.couvertureMois < 3 ? "text-warning" : "")}>
                        {p.couvertureMois != null ? `${decimal(p.couvertureMois)} m` : <ND />}
                      </td>
                    )}
                    {colonnes.visites && <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{p.visites ? p.visites.cycle : <ND />}</td>}
                    {colonnes.prescripteurs && <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{p.prescripteursA != null ? p.prescripteursA : <ND />}</td>}
                    {colonnes.adpro && <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{p.adpro != null ? montantCourt(p.adpro) : <ND />}</td>}
                    <td className="px-3 py-2">{p.alerte ? <Pill ton={p.alerte.ton}>{p.alerte.label}</Pill> : <span className="text-xs text-muted-foreground">—</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
