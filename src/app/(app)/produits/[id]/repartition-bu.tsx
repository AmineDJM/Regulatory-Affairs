"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRafraichir } from "@/components/shared/use-rafraichir";
import { enregistrerRepartitionBu } from "@/lib/actions/repartition-couts-actions";

/** La règle d'allocation des coûts partagés d'une BU pour l'année : part de chaque produit, le reste reste non alloué. */
export function RepartitionBu({ businessUnitId, nom, annee, produits, parts }: { businessUnitId: string; nom: string; annee: number; produits: { productId: string; nom: string }[]; parts: Record<string, string> }) {
  const { enCours, rafraichir } = useRafraichir();
  const [valeurs, setValeurs] = React.useState<Record<string, string>>(parts);
  const [erreur, setErreur] = React.useState<string | null>(null);
  const total = Object.values(valeurs).reduce((s, v) => s + (Number(v.replace(",", ".")) || 0), 0);
  const change = produits.some((p) => (valeurs[p.productId] ?? "") !== (parts[p.productId] ?? ""));
  return (
    <div className="space-y-2 border-t border-border pt-3">
      <p className="text-xs font-semibold">Répartition des coûts partagés de la BU {nom} — {annee}</p>
      <div className="flex flex-wrap items-end gap-3">
        {produits.map((p) => (
          <label key={p.productId} className="flex items-center gap-1 text-xs">
            {p.nom}
            <Input inputMode="decimal" value={valeurs[p.productId] ?? ""} onChange={(e) => setValeurs({ ...valeurs, [p.productId]: e.target.value })} className="w-20" /> %
          </label>
        ))}
        <span className={`text-xs ${total > 100 ? "text-destructive" : "text-muted-foreground"}`}>{Math.round(total * 100) / 100} % répartis · {Math.max(0, Math.round((100 - total) * 100) / 100)} % non alloués</span>
        {change && <Button size="sm" disabled={enCours || total > 100} onClick={async () => { setErreur(null); const r = await enregistrerRepartitionBu({ businessUnitId, annee, productIds: produits.map((p) => p.productId), pcts: produits.map((p) => valeurs[p.productId] ?? "") }); if (!r.ok) setErreur(r.error); else rafraichir(); }}>Enregistrer</Button>}
      </div>
      {erreur && <p className="text-xs text-destructive">{erreur}</p>}
    </div>
  );
}
