"use client";

import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/input";

export interface GroupeProduits {
  bu: { id: string; nom: string };
  produits: { id: string; nom: string }[];
}

/**
 * LE PRODUIT DU COCKPIT — un menu par BU : ses produits promus, puis « Tous les produits de la BU ». Le choix part dans
 * l'adresse (`?produit=` ou `?bu=`), avec la vue en cours : on change de produit sans quitter l'onglet.
 */
export function SelecteurProduit({ groupes, valeur, vue }: { groupes: GroupeProduits[]; valeur: string; vue: string | null }) {
  const router = useRouter();
  return (
    <Select
      aria-label="Produit"
      value={valeur}
      className="h-9 w-auto max-w-full sm:h-8"
      onChange={(e) => {
        const v = e.target.value;
        const q = new URLSearchParams();
        if (vue) q.set("vue", vue);
        if (v.startsWith("bu:")) q.set("bu", v.slice(3));
        else q.set("produit", v.slice(2));
        router.push(`/marketing-cockpit?${q.toString()}`);
      }}
    >
      {groupes.map((g) => (
        <optgroup key={g.bu.id} label={`BU ${g.bu.nom}`}>
          {g.produits.map((p) => <option key={p.id} value={`p:${p.id}`}>{p.nom}</option>)}
          <option value={`bu:${g.bu.id}`}>Tous les produits de la BU</option>
        </optgroup>
      ))}
    </Select>
  );
}
