"use client";

import { useRouter } from "next/navigation";
import { Building2 } from "lucide-react";

/**
 * PASSER D'UN DÉPARTEMENT À L'AUTRE — pour qui PILOTE le module.
 *
 * Les moyens généraux ne sont pas un budget unique : chaque département a les siens. Les
 * ressources humaines, qui tiennent le module, doivent donc pouvoir les regarder l'un après
 * l'autre. L'utilisatrice quotidienne ne voit pas ce sélecteur : elle travaille sur le sien.
 */
export function DepartmentSwitcher({
  departments, current, year,
}: { departments: { id: string; name: string }[]; current: string; year: number }) {
  const router = useRouter();
  return (
    <label className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <Building2 className="h-3.5 w-3.5" />
      <select
        value={current}
        onChange={(e) => router.push(`/moyens-generaux?dept=${e.target.value}&year=${year}`)}
        aria-label="Département"
        className="h-9 rounded-lg border border-input bg-background px-2 text-sm text-foreground"
      >
        {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
      </select>
    </label>
  );
}
