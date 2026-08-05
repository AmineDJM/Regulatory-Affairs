"use client";

import * as React from "react";
import Link from "next/link";
import { Search, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CONTRACT_TYPE } from "@/lib/labels";
import { formatCurrency, formatDate } from "@/lib/utils";

export interface DirectoryRow {
  id: string;
  fullName: string;
  position: string | null;
  department: string | null;
  contractType: string | null;
  contractEnd: string | null;
  baseSalary: number;
  leaveBalanceDays: number;
  hasAccount: boolean;
  isActive: boolean;
  email: string | null;
  phone: string | null;
}

/**
 * ANNUAIRE DE L'ÉQUIPE — cherchable.
 *
 * Le module listait tout le monde, sans recherche : au-delà d'une trentaine de personnes,
 * on faisait défiler à l'aveugle. On cherche désormais par **nom, poste, département,
 * e-mail ou téléphone** — un seul champ, parce qu'on ne sait pas toujours d'avance sous
 * quel angle on connaît quelqu'un — avec deux filtres qui répondent aux besoins réels :
 * le département, et « actifs seulement ».
 *
 * Le filtrage est LOCAL (aucun aller-retour serveur) : la liste répond à la frappe.
 */
export function TeamDirectory({ rows, canSeeSalary }: { rows: DirectoryRow[]; canSeeSalary: boolean }) {
  const [q, setQ] = React.useState("");
  const [dept, setDept] = React.useState("");
  const [activeOnly, setActiveOnly] = React.useState(true);

  const departments = React.useMemo(
    () => [...new Set(rows.map((r) => r.department?.trim()).filter((d): d is string => !!d))].sort((a, b) => a.localeCompare(b)),
    [rows],
  );

  const filtered = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (activeOnly && !r.isActive) return false;
      if (dept && (r.department ?? "") !== dept) return false;
      if (!needle) return true;
      const hay = `${r.fullName} ${r.position ?? ""} ${r.department ?? ""} ${r.email ?? ""} ${r.phone ?? ""}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [rows, q, dept, activeOnly]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[15rem] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Nom, poste, département, e-mail, téléphone…"
            className="h-10 w-full rounded-xl border border-border bg-background pl-8 pr-3 text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
            aria-label="Rechercher un collaborateur"
          />
        </div>
        {departments.length > 0 && (
          <select
            value={dept} onChange={(e) => setDept(e.target.value)}
            className="h-10 rounded-xl border border-border bg-background px-2.5 text-sm"
            aria-label="Filtrer par département"
          >
            <option value="">Tous les départements</option>
            {departments.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        )}
        <label className="flex h-10 items-center gap-2 rounded-xl border border-border px-3 text-sm">
          <input type="checkbox" checked={activeOnly} onChange={(e) => setActiveOnly(e.target.checked)} className="h-4 w-4 rounded border-input" />
          Actifs seulement
        </label>
      </div>

      <p className="text-xs text-muted-foreground">
        <Users className="mr-1 inline h-3.5 w-3.5" />
        {filtered.length} personne{filtered.length > 1 ? "s" : ""}
        {filtered.length !== rows.length ? ` sur ${rows.length}` : ""}
      </p>

      {filtered.length === 0 ? (
        <p className="surface p-6 text-center text-sm text-muted-foreground">Aucun collaborateur ne correspond à cette recherche.</p>
      ) : (
        <div className="surface overflow-hidden">
          <Table mobileCards>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Poste</TableHead>
                <TableHead>Département</TableHead>
                <TableHead>Contrat</TableHead>
                {canSeeSalary && <TableHead className="text-right">Salaire base</TableHead>}
                <TableHead className="text-right">Solde congés</TableHead>
                <TableHead>Compte</TableHead>
                <TableHead>Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((e) => (
                <TableRow key={e.id}>
                  <TableCell label="Nom" className="font-medium">
                    <Link href={`/rh/${e.id}`} className="hover:underline">{e.fullName}</Link>
                  </TableCell>
                  <TableCell label="Poste">{e.position || "—"}</TableCell>
                  <TableCell label="Département">{e.department || "—"}</TableCell>
                  <TableCell label="Contrat">
                    {e.contractType ? CONTRACT_TYPE[e.contractType] ?? e.contractType : "—"}
                    {e.contractEnd && <span className="block text-xs text-muted-foreground">→ {formatDate(e.contractEnd)}</span>}
                  </TableCell>
                  {canSeeSalary && <TableCell label="Salaire base" className="text-right">{formatCurrency(e.baseSalary)}</TableCell>}
                  <TableCell label="Solde congés" className="text-right">{e.leaveBalanceDays} j</TableCell>
                  <TableCell label="Compte">{e.hasAccount ? <Badge tone="info" dot={false}>Lié</Badge> : <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell label="Statut">{e.isActive ? <Badge tone="success" dot={false}>Actif</Badge> : <Badge tone="danger" dot={false}>Inactif</Badge>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
