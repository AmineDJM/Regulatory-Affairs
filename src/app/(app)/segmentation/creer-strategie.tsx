"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Select, Label } from "@/components/ui/input";
import { creerStrategie } from "@/lib/actions/segmentation-actions";

/** Créer une stratégie : une BU, un nom, et jusqu'à trois produits CANONIQUES classés. Les règles viennent ensuite. */
export function CreerStrategie({ bus, produits }: { bus: { id: string; name: string }[]; produits: { id: string; nom: string; dci: string }[] }) {
  const router = useRouter();
  const [bu, setBu] = React.useState(bus[0]?.id ?? "");
  const [nom, setNom] = React.useState("");
  const [choix, setChoix] = React.useState<string[]>(["", "", ""]);
  const [erreur, setErreur] = React.useState<string | null>(null);
  const [envoi, setEnvoi] = React.useState(false);
  const ids = choix.filter(Boolean);

  async function creer(e: React.FormEvent) {
    e.preventDefault();
    setEnvoi(true); setErreur(null);
    const r = await creerStrategie({ businessUnitId: bu, nom, productIds: ids });
    setEnvoi(false);
    if (!r.ok) setErreur(r.error); else router.push(`/segmentation?s=${r.id}&vue=import`);
  }

  if (bus.length === 0) return <p className="surface p-5 text-sm text-muted-foreground">Créez d&apos;abord une Business Unit (Force de vente › Business Units).</p>;
  return (
    <form onSubmit={creer} className="surface max-w-2xl space-y-3 p-5">
      <p className="text-sm text-muted-foreground">Une stratégie relie une Business Unit à ses produits prioritaires (trois au plus). Le catalogue de la BU peut en compter davantage.</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div><Label>Business Unit</Label><Select value={bu} onChange={(e) => setBu(e.target.value)}>{bus.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</Select></div>
        <div><Label>Nom</Label><Input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="ex. HIV 2026" /></div>
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i}>
          <Label>Produit #{i + 1}{i > 0 ? " (facultatif)" : ""}</Label>
          <Select value={choix[i]} onChange={(e) => setChoix(choix.map((c, j) => (j === i ? e.target.value : c)))}>
            <option value="">—</option>
            {produits.filter((p) => p.id === choix[i] || !choix.includes(p.id)).map((p) => <option key={p.id} value={p.id}>{p.nom}{p.dci && p.dci.toLowerCase() !== p.nom.toLowerCase() ? ` (${p.dci})` : ""}</option>)}
          </Select>
        </div>
      ))}
      {erreur && <p className="text-sm text-destructive">{erreur}</p>}
      <Button type="submit" disabled={envoi || !nom.trim() || ids.length === 0}>Créer la stratégie</Button>
    </form>
  );
}
