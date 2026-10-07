"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowDown, ArrowUp } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { formatJours } from "@/lib/process/mining";
import type { LignePersonne } from "@/lib/queries/process-intelligence";

type Cle = "name" | "received" | "medianResponseDays" | "pending" | "overdueTasks" | "lastSeenAt";

const vu = (iso: string | null) => {
  if (!iso) return "jamais";
  const j = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return j <= 0 ? "aujourd'hui" : j === 1 ? "hier" : `il y a ${j} j`;
};

/** « Personnes » — délai de réponse aux validations, sans juger. Triable par colonne. */
export function Personnes({ lignes }: { lignes: LignePersonne[] }) {
  const [tri, setTri] = React.useState<{ cle: Cle; sens: 1 | -1 }>({ cle: "pending", sens: -1 });
  const triees = [...lignes].sort((a, b) => {
    const va = a[tri.cle] ?? (tri.cle === "name" ? "" : -1);
    const vb = b[tri.cle] ?? (tri.cle === "name" ? "" : -1);
    return (typeof va === "string" ? va.localeCompare(String(vb), "fr") : (va as number) - (vb as number)) * tri.sens;
  });
  const entete = (cle: Cle, label: string, droite = true) => (
    <TableHead className={cn(droite && "text-right", cle === "name" && "sticky left-0 z-10 bg-muted/90")} aria-sort={tri.cle === cle ? (tri.sens === 1 ? "ascending" : "descending") : "none"}>
      <button type="button" onClick={() => setTri((t) => ({ cle, sens: t.cle === cle ? (t.sens === 1 ? -1 : 1) : cle === "name" ? 1 : -1 }))} className="inline-flex items-center gap-1 uppercase hover:text-foreground">
        {label}{tri.cle === cle && (tri.sens === 1 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
      </button>
    </TableHead>
  );
  return (
    <section className="surface overflow-hidden rounded-xl">
      <Table>
        <TableHeader>
          <TableRow>
            {entete("name", "Personne", false)}
            {entete("received", "Validations reçues")}
            {entete("medianResponseDays", "Réponse médiane")}
            {entete("pending", "En attente")}
            {entete("overdueTasks", "Tâches en retard")}
            {entete("lastSeenAt", "Dernière connexion", false)}
          </TableRow>
        </TableHeader>
        <TableBody>
          {triees.map((l) => (
            <TableRow key={l.userId}>
              <TableCell className="sticky left-0 z-10 whitespace-nowrap bg-card">{l.name}{l.department && <span className="text-muted-foreground"> ({l.department})</span>}</TableCell>
              <TableCell className="text-right tabular-nums">{l.received}</TableCell>
              <TableCell className="text-right tabular-nums">{formatJours(l.medianResponseDays)}</TableCell>
              <TableCell className="text-right tabular-nums">{l.pending}</TableCell>
              <TableCell className="text-right tabular-nums">{l.overdueTasks}</TableCell>
              <TableCell className="whitespace-nowrap text-muted-foreground">{vu(l.lastSeenAt)}</TableCell>
            </TableRow>
          ))}
          {triees.length === 0 && <TableRow><TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">Aucune validation ni tâche sur la période.</TableCell></TableRow>}
        </TableBody>
      </Table>
    </section>
  );
}

/** Le choix de la période (?p=), qui garde la vue courante. */
export function SelecteurPeriode({ valeur, options }: { valeur: string; options: { cle: string; label: string }[] }) {
  const router = useRouter();
  const params = useSearchParams();
  return (
    <select
      aria-label="Période" value={valeur}
      onChange={(e) => { const p = new URLSearchParams(params?.toString() ?? ""); p.set("p", e.target.value); router.push(`/process-intelligence?${p.toString()}`); }}
      className="h-10 rounded-lg border border-input bg-background px-3 text-base shadow-sm sm:h-9 sm:text-sm"
    >
      {options.map((o) => <option key={o.cle} value={o.cle}>{o.label}</option>)}
    </select>
  );
}
