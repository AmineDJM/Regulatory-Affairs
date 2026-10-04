"use client";

import * as React from "react";
import Link from "next/link";
import { Loader2, Link2, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";
import { rattacherSalariesAEntite } from "@/lib/actions/payroll-hr-actions";
import { useRafraichir } from "@/components/shared/use-rafraichir";

export interface SalarieSansEntite {
  id: string;
  nom: string;
  poste: string | null;
  /** Coût employeur des salaires payés de l'année. */
  cout: number;
  net: number;
  salaires: number;
}

/**
 * LES SALARIÉS SANS ENTITÉ — « me dire QUI, et en un clic je les rattache » (Direction, 04/10/2026).
 *
 * Un geste par salarié, et un geste pour tous. Le menu ne propose que les entités ouvertes à la
 * personne ; l'action le revérifie. Le rafraîchissement passe par `useRafraichir` (§118.172) :
 * tant que la liste n'est pas à jour, les gestes restent fermés — sinon un second clic partirait
 * sur un salarié déjà rattaché.
 */
export function RattacherSansEntite({
  year, salaries, entites,
}: {
  year: number;
  salaries: SalarieSansEntite[];
  entites: { id: string; label: string }[];
}) {
  const { enCours, rafraichir } = useRafraichir();
  const [busy, setBusy] = React.useState<string | null>(null);
  const [msg, setMsg] = React.useState<{ ok: boolean; texte: string } | null>(null);
  const [cibles, setCibles] = React.useState<Record<string, string>>({});
  const [cibleTous, setCibleTous] = React.useState("");

  const rattacher = async (cle: string, companyId: string, ids: string[]) => {
    setBusy(cle); setMsg(null);
    const fd = new FormData();
    fd.set("companyId", companyId);
    for (const id of ids) fd.append("employeeIds", id);
    const r = await rattacherSalariesAEntite(fd).catch(() => ({ ok: false as const, error: "Le rattachement n'a pas abouti — réessayez.", message: undefined }));
    setBusy(null);
    setMsg({ ok: r.ok, texte: r.ok ? (r.message ?? "Rattaché.") : (r.error ?? "Rattachement refusé.") });
    if (r.ok) rafraichir();
  };

  const total = salaries.reduce((a, s) => a + s.cout, 0);
  const ferme = busy !== null || enCours;

  return (
    <section className="space-y-3 rounded-xl border border-warning/40 bg-warning/5 p-4" aria-labelledby="sans-entite-titre">
      <div>
        <h2 id="sans-entite-titre" className="flex items-center gap-2 text-sm font-semibold">
          <UserX className="h-4 w-4 text-warning" /> Sans entité — à rattacher ({salaries.length})
        </h2>
        <p className="text-xs text-muted-foreground">
          {formatCurrency(total)} de masse {year} (coût employeur) n&apos;appartient à aucune entité : leur paie ne peut pas partir au centre.
          Rattacher écrit l&apos;entité de la FICHE SALARIÉ — toute sa paie la suit.
        </p>
      </div>

      {entites.length === 0 ? (
        <p className="text-xs text-muted-foreground">Aucune entité ne vous est ouverte : le rattachement se fait depuis une entité que vous voyez.</p>
      ) : (
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-muted-foreground">Tout rattacher à…</span>
            <Select value={cibleTous} onChange={(e) => setCibleTous(e.target.value)} className="h-9 w-48 text-sm" aria-label="Entité pour tous les salariés sans entité">
              <option value="">— Choisir —</option>
              {entites.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </Select>
          </label>
          <Button
            type="button" size="sm" disabled={ferme || !cibleTous || salaries.length === 0}
            onClick={() => rattacher("tous", cibleTous, salaries.map((s) => s.id))}
          >
            {busy === "tous" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
            Tout rattacher ({salaries.length})
          </Button>
        </div>
      )}

      <ul className="divide-y divide-border/60 text-sm">
        {salaries.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2" data-salarie={s.nom}>
            <div className="min-w-0">
              <Link href={`/rh/${s.id}`} className="font-medium hover:underline">{s.nom}</Link>
              <p className="text-xs text-muted-foreground">
                {s.poste || "Poste non renseigné"} · {s.salaires > 0
                  ? <>{formatCurrency(s.cout)} ({s.salaires} salaire{s.salaires > 1 ? "s" : ""} payé{s.salaires > 1 ? "s" : ""} en {year}, net {formatCurrency(s.net)})</>
                  : <>aucun salaire payé en {year}</>}
              </p>
            </div>
            {entites.length > 0 && (
              <div className="flex items-center gap-2">
                <Select
                  value={cibles[s.id] ?? ""} onChange={(e) => setCibles((c) => ({ ...c, [s.id]: e.target.value }))}
                  className="h-9 w-40 text-sm" aria-label={`Entité de ${s.nom}`}
                >
                  <option value="">Rattacher à…</option>
                  {entites.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                </Select>
                <Button
                  type="button" size="sm" variant="outline" disabled={ferme || !cibles[s.id]}
                  onClick={() => rattacher(s.id, cibles[s.id]!, [s.id])}
                >
                  {busy === s.id ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Rattacher
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>

      {msg && (
        <p role="status" className={msg.ok ? "rounded-lg bg-success/10 px-3 py-2 text-xs" : "rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive"}>
          {msg.texte}
        </p>
      )}
    </section>
  );
}
