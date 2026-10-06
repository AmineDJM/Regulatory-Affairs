"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Select, Label } from "@/components/ui/input";
import { useRafraichir } from "@/components/shared/use-rafraichir";
import { classerProduits } from "@/lib/actions/segmentation-actions";

/** Le CLASSEMENT des produits (≤ 3). Le changer ferme l'ancien classement et en ouvre un nouveau — l'historique reste. */
export function ClassementProduits({ strategieId, actuels, produits }: { strategieId: string; actuels: string[]; produits: { id: string; nom: string; dci: string }[] }) {
  const { enCours, rafraichir } = useRafraichir();
  const [choix, setChoix] = React.useState<string[]>([0, 1, 2].map((i) => actuels[i] ?? ""));
  const [erreur, setErreur] = React.useState<string | null>(null);
  const ids = choix.filter(Boolean);
  const change = ids.join() !== actuels.join();
  return (
    <form
      className="surface space-y-3 p-4"
      onSubmit={async (e) => { e.preventDefault(); setErreur(null); const r = await classerProduits(strategieId, ids); if (!r.ok) setErreur(r.error); else rafraichir(); }}
    >
      <h2 className="text-sm font-semibold">Produits classés</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i}>
            <Label>Produit #{i + 1}</Label>
            <Select value={choix[i]} onChange={(e) => setChoix(choix.map((c, j) => (j === i ? e.target.value : c)))}>
              <option value="">—</option>
              {produits.filter((p) => p.id === choix[i] || !choix.includes(p.id)).map((p) => <option key={p.id} value={p.id}>{p.nom}</option>)}
            </Select>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">Un produit ajouté ici a besoin de ses seuils dans la prochaine version des règles.</p>
      {erreur && <p className="text-sm text-destructive">{erreur}</p>}
      {change && <Button size="sm" type="submit" disabled={enCours || ids.length === 0}>Enregistrer le classement</Button>}
    </form>
  );
}
