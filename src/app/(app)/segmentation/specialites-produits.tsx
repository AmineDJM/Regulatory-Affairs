"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { useRafraichir } from "@/components/shared/use-rafraichir";
import { ciblerSpecialitesProduit } from "@/lib/actions/segmentation-actions";

/**
 * QUELLES SPÉCIALITÉS CHAQUE PRODUIT VISE dans la BU (une BU multi-spécialités ne veut pas dire que tous ses produits
 * les visent toutes). Rien de coché = toutes celles de la BU. Une BU mono-spécialité n'a rien à régler : l'écran le dit.
 */
export function SpecialitesProduits({ strategieId, produits, specialitesBu, cibles }: {
  strategieId: string;
  produits: { productId: string; rang: number; nom: string }[];
  specialitesBu: { id: string; nom: string; principale: boolean }[];
  cibles: Record<string, string[]>;
}) {
  if (specialitesBu.length === 0) {
    return <p className="surface p-4 text-sm text-muted-foreground">La BU ne déclare aucune spécialité (Force de vente › Business Units) : tous ses produits visent tous les praticiens du panel.</p>;
  }
  if (specialitesBu.length === 1) {
    return <p className="surface p-4 text-sm text-muted-foreground">BU mono-spécialité ({specialitesBu[0].nom}) : chaque produit la vise, rien à régler.</p>;
  }
  return (
    <section className="surface space-y-3 p-4">
      <h2 className="text-sm font-semibold">Spécialités visées par produit</h2>
      {produits.map((p) => <LigneProduit key={p.productId} strategieId={strategieId} produit={p} specialitesBu={specialitesBu} initiales={cibles[p.productId] ?? []} />)}
      <p className="text-xs text-muted-foreground">Rien de coché : le produit vise toutes les spécialités de la BU. Un praticien d&apos;une spécialité non visée est « non ciblé » pour ce produit, et le pourquoi le dit.</p>
    </section>
  );
}

function LigneProduit({ strategieId, produit, specialitesBu, initiales }: { strategieId: string; produit: { productId: string; rang: number; nom: string }; specialitesBu: { id: string; nom: string; principale: boolean }[]; initiales: string[] }) {
  const { enCours, rafraichir } = useRafraichir();
  const [choix, setChoix] = React.useState<string[]>(initiales);
  const [erreur, setErreur] = React.useState<string | null>(null);
  const change = [...choix].sort().join() !== [...initiales].sort().join();
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <span className="w-40 font-medium">#{produit.rang} {produit.nom}</span>
      {specialitesBu.map((s) => (
        <label key={s.id} className="flex items-center gap-1">
          <input type="checkbox" checked={choix.includes(s.id)} onChange={(e) => setChoix(e.target.checked ? [...choix, s.id] : choix.filter((x) => x !== s.id))} />
          {s.nom}{s.principale ? " (principale)" : ""}
        </label>
      ))}
      {change && <Button size="sm" disabled={enCours} onClick={async () => { setErreur(null); const r = await ciblerSpecialitesProduit(strategieId, produit.productId, choix); if (!r.ok) setErreur(r.error); else rafraichir(); }}>Enregistrer</Button>}
      {erreur && <span className="text-xs text-destructive">{erreur}</span>}
    </div>
  );
}
