import Link from "next/link";
import { StatusBadge } from "@/components/shared/status-badge";
import { GRAVITE_PV, STATUT_PV } from "@/lib/pharmacovigilance/regles";
import type { LigneCasPv } from "@/lib/pharmacovigilance/donnees";
import { formatDate } from "@/lib/utils";

/** Une liste de cas de pharmacovigilance — la boîte de Regulatory et « Mes signalements » du KAM (Direction, 06/10). */
export function ListeCasPv({ cas, base, avecDeclarant }: { cas: LigneCasPv[]; base: string; avecDeclarant: boolean }) {
  return (
    <div className="surface divide-y divide-border">
      {cas.map((c) => (
        <Link key={c.id} href={`${base}/${c.id}`} className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 hover:bg-secondary/40">
          <StatusBadge map={STATUT_PV} value={c.status} />
          <div className="min-w-0 flex-1 basis-48">
            <p className="truncate text-sm font-medium">
              <span className="text-muted-foreground">{c.reference}</span> · {c.productLabel}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {c.institutionName}{avecDeclarant ? ` · ${c.reporterName}` : ""}
            </p>
          </div>
          {c.severity && c.severity !== "NON_GRAVE" && <StatusBadge map={GRAVITE_PV} value={c.severity} dot={false} />}
          <span className="text-xs text-muted-foreground">Survenu le {formatDate(c.occurredOn)}</span>
        </Link>
      ))}
    </div>
  );
}
