"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { TYPES_PERIODE, moisCourt, type TypePeriode } from "@/lib/ventes-pch/calculs";

function Puce({ actif, onClick, children }: { actif: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={actif}
      className={cn(
        "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors sm:py-1",
        actif ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

/**
 * LES FILTRES DE « VENTES PCH » — les puces de BU (Toutes, puis chaque BU) et la période (type + mois de référence).
 * Tout passe par l'adresse : un lien partagé rouvre exactement la même vue.
 */
export function FiltresVentesPch({ bus, buId, type, refMois, moisDisponibles, sansPeriode = false }: {
  bus: { id: string; nom: string }[];
  buId: string | null;
  type: TypePeriode;
  refMois: string;
  moisDisponibles: string[];
  sansPeriode?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const aller = (maj: Record<string, string | null>) => {
    const p = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(maj)) { if (v) p.set(k, v); else p.delete(k); }
    const q = p.toString();
    router.push(q ? `${pathname}?${q}` : pathname);
  };
  return (
    <div className="flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between">
      <div className="flex flex-wrap gap-1.5">
        <Puce actif={!buId} onClick={() => aller({ bu: null })}>Toutes les BU</Puce>
        {bus.map((b) => <Puce key={b.id} actif={buId === b.id} onClick={() => aller({ bu: b.id })}>{b.nom}</Puce>)}
      </div>
      {!sansPeriode && (
        <div className="flex flex-wrap items-center gap-1.5">
          {TYPES_PERIODE.map((t) => <Puce key={t.value} actif={type === t.value} onClick={() => aller({ p: t.value === "mois" ? null : t.value })}>{t.label}</Puce>)}
          <select
            aria-label="Mois de référence"
            value={refMois}
            onChange={(e) => aller({ m: e.target.value })}
            className="h-9 rounded-md border border-input bg-card px-2 text-xs sm:h-8"
          >
            {moisDisponibles.map((m) => <option key={m} value={m}>{moisCourt(m)}</option>)}
          </select>
        </div>
      )}
    </div>
  );
}
