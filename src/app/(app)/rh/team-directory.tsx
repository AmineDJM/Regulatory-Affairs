"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CONTRACT_TYPE } from "@/lib/labels";
import { formatCurrency, formatDate, initials } from "@/lib/utils";

export interface DirectoryRow {
  id: string;
  fullName: string;
  position: string | null;
  department: string | null;
  contractType: string | null;
  contractEnd: string | null;
  /** Même règle que le compteur de l'en-tête (`getRhData().contractsExpiring`) : fin de contrat dans les 60 jours. */
  echeanceProche: boolean;
  /** `null` quand la personne ne voit pas les salaires : la valeur n'est même pas envoyée au navigateur. */
  baseSalary: number | null;
  leaveBalanceDays: number;
  hasAccount: boolean;
  isActive: boolean;
  email: string | null;
  phone: string | null;
}

/**
 * Valeur du filtre « Contrat » qui ne garde que les fins de contrat proches — aussi lue dans l'URL (`?contrat=echeance`,
 * écrite en dur dans le lien de `equipe/page.tsx` : une constante d'un module client n'arrive au serveur que comme référence).
 */
const FILTRE_ECHEANCE = "echeance";

const champ = "h-10 rounded-xl border border-border bg-background text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20";

/**
 * L'ÉQUIPE EN UNE TABLE (maquette validée par la Direction, 07/10) — une ligne par salarié : qui (et son poste), où,
 * sous quel contrat (avec l'échéance quand elle approche), son solde de congés, son compte. Une recherche, deux filtres.
 *
 * Le filtrage est LOCAL (aucun aller-retour serveur). Le filtre « Contrat » suit l'URL : le lien « N contrats arrivent à
 * échéance » de l'en-tête y mène. Au téléphone la table RESTE une table : elle défile dans son cadre, le nom collé à gauche.
 */
export function TeamDirectory({ rows, canSeeSalary }: { rows: DirectoryRow[]; canSeeSalary: boolean }) {
  const depuisUrl = useSearchParams().get("contrat") ?? "";
  const [q, setQ] = React.useState("");
  const [dept, setDept] = React.useState("");
  const [contrat, setContrat] = React.useState(depuisUrl);
  const [voirInactifs, setVoirInactifs] = React.useState(false);

  React.useEffect(() => { setContrat(depuisUrl); }, [depuisUrl]);

  const choisirContrat = (v: string) => {
    setContrat(v);
    // L'URL suit le filtre, sans recharger la page : le lien de l'en-tête rejoue toujours son filtre.
    const url = new URL(window.location.href);
    if (v) url.searchParams.set("contrat", v); else url.searchParams.delete("contrat");
    window.history.replaceState(null, "", url);
  };

  const departments = React.useMemo(
    () => [...new Set(rows.map((r) => r.department?.trim()).filter((d): d is string => !!d))].sort((a, b) => a.localeCompare(b)),
    [rows],
  );
  const contractTypes = React.useMemo(
    () => [...new Set(rows.map((r) => r.contractType).filter((c): c is string => !!c))],
    [rows],
  );
  const inactifs = React.useMemo(() => rows.filter((r) => !r.isActive).length, [rows]);

  const filtered = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (contrat === FILTRE_ECHEANCE) {
        if (!r.echeanceProche) return false;
      } else {
        if (!voirInactifs && !r.isActive) return false;
        if (contrat && r.contractType !== contrat) return false;
      }
      if (dept && (r.department ?? "") !== dept) return false;
      if (!needle) return true;
      const hay = `${r.fullName} ${r.position ?? ""} ${r.department ?? ""} ${r.email ?? ""} ${r.phone ?? ""}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [rows, q, dept, contrat, voirInactifs]);

  return (
    <div className="space-y-2">
      <div className="surface overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
          <div className="relative w-full sm:min-w-[15rem] sm:flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search" value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="Rechercher un nom, un poste, un e-mail…"
              className={`${champ} w-full pl-8 pr-3`}
              aria-label="Rechercher un salarié"
            />
          </div>
          {departments.length > 0 && (
            <select value={dept} onChange={(e) => setDept(e.target.value)} className={`${champ} min-w-0 flex-1 px-2.5 sm:flex-none`} aria-label="Département">
              <option value="">Tous les départements</option>
              {departments.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          )}
          <select value={contrat} onChange={(e) => choisirContrat(e.target.value)} className={`${champ} min-w-0 flex-1 px-2.5 sm:flex-none`} aria-label="Contrat">
            <option value="">Tous les contrats</option>
            {contractTypes.map((c) => <option key={c} value={c}>{CONTRACT_TYPE[c] ?? c}</option>)}
            <option value={FILTRE_ECHEANCE}>Échéance &lt; 60 j</option>
          </select>
        </div>

        {filtered.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">Aucun salarié ne correspond.</p>
        ) : (
          <Table className={canSeeSalary ? "min-w-[50rem]" : "min-w-[42rem]"}>
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 z-[1] bg-card">Salarié</TableHead>
                <TableHead>Département</TableHead>
                <TableHead>Contrat</TableHead>
                <TableHead className="text-right">Congés</TableHead>
                {canSeeSalary && <TableHead className="text-right">Salaire de base</TableHead>}
                <TableHead>Compte</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="sticky left-0 z-[1] max-w-[16rem] bg-card">
                    <Link href={`/rh/${e.id}`} className="group flex min-w-0 items-center gap-2.5">
                      <span aria-hidden className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                        {initials(e.fullName || "?")}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-medium group-hover:underline">{e.fullName}</span>
                        {e.position && <span className="block truncate text-xs text-muted-foreground">{e.position}</span>}
                      </span>
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{e.department || "—"}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {e.contractType ? CONTRACT_TYPE[e.contractType] ?? e.contractType : <span className="text-muted-foreground">—</span>}
                    {e.echeanceProche && e.contractEnd && (
                      // Rouge à quinze jours ou moins, orange avant — la règle de l'ancienne carte des échéances.
                      <Badge tone={(new Date(e.contractEnd).getTime() - Date.now()) / 86_400_000 <= 15 ? "danger" : "warning"} dot={false} className="ml-1.5">
                        fin le {formatDate(e.contractEnd, { day: "numeric", month: "short" })}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right tabular-nums">{e.leaveBalanceDays} j</TableCell>
                  {canSeeSalary && (
                    <TableCell className="whitespace-nowrap text-right tabular-nums text-muted-foreground">
                      {e.baseSalary == null ? "—" : formatCurrency(e.baseSalary)}
                    </TableCell>
                  )}
                  <TableCell>
                    {!e.isActive
                      ? <Badge tone="danger" dot={false}>Inactif</Badge>
                      : e.hasAccount
                        ? <Badge tone="success" dot={false}>Actif</Badge>
                        : <Badge tone="neutral" dot={false}>Sans compte</Badge>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {inactifs > 0 && contrat !== FILTRE_ECHEANCE && (
        <button type="button" onClick={() => setVoirInactifs((v) => !v)} className="text-xs text-muted-foreground hover:text-foreground hover:underline">
          {voirInactifs ? "Masquer les anciens salariés" : `Afficher les anciens salariés (${inactifs})`}
        </button>
      )}
    </div>
  );
}
