"use client";

import * as React from "react";
import { Input, Select } from "@/components/ui/input";
import type { PersonneInvitable } from "@/lib/queries/missions";

/**
 * CHOISIR UNE PERSONNE — les salariés actifs, groupés par département, avec une recherche : une liste de
 * deux cents noms à plat ne se parcourt pas. Le champ `name` porte l'identifiant choisi.
 */
export function ChoixPersonne({ personnes, exclus = [], name, id, required = true }: {
  personnes: PersonneInvitable[];
  exclus?: readonly string[];
  name: string;
  id: string;
  required?: boolean;
}) {
  const [q, setQ] = React.useState("");
  const pli = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const filtre = pli(q.trim());
  const exclusSet = new Set(exclus);
  const visibles = personnes.filter((p) => !exclusSet.has(p.id) && (!filtre || pli(p.name).includes(filtre) || pli(p.groupe).includes(filtre)));
  const groupes = new Map<string, PersonneInvitable[]>();
  for (const p of visibles) (groupes.get(p.groupe) ?? groupes.set(p.groupe, []).get(p.groupe)!).push(p);
  const ordre = [...groupes.keys()].sort((a, b) => a.localeCompare(b, "fr"));

  return (
    <div className="space-y-1.5">
      <Input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un nom, un département…" aria-label="Rechercher une personne" />
      <Select id={id} name={name} required={required} defaultValue="">
        <option value="">{visibles.length === 0 ? "— Personne ne correspond —" : `— Choisir (${visibles.length}) —`}</option>
        {ordre.map((g) => (
          <optgroup key={g} label={g}>
            {groupes.get(g)!.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </optgroup>
        ))}
      </Select>
    </div>
  );
}
