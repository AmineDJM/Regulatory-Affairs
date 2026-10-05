import { formatCurrency } from "@/lib/utils";
import type { MasseMensuelle } from "@/lib/hr/payroll-mass";

const MOIS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

export interface ColonneMasse {
  companyId: string | null;
  label: string;
  masse: MasseMensuelle;
}

/**
 * LA MASSE SALARIALE, ENTITÉ PAR ENTITÉ ET MOIS PAR MOIS — « pour chaque entité avoir la masse
 * salariale MENSUELLE et ANNUELLE » (Direction, 04/10/2026).
 *
 * Les mois en LIGNES, les entités en colonnes : douze lignes se lisent sur un téléphone, quatorze
 * colonnes non. Chaque case porte le coût employeur (la masse) et, dessous, le net (ce qui part au
 * salarié). La table défile dans son propre conteneur si les entités sont nombreuses.
 */
export function MasseMensuelleTable({ year, colonnes }: { year: number; colonnes: ColonneMasse[] }) {
  return (
    <section className="surface space-y-2 p-4" aria-labelledby="masse-mensuelle-titre">
      <div>
        <h2 id="masse-mensuelle-titre" className="text-sm font-semibold">Masse salariale {year} — par entité, mois par mois</h2>
        <p className="text-xs text-muted-foreground">
          Salaires saisis comme payés : le coût employeur (charges comprises), et dessous le net versé au salarié.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[28rem] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th scope="col" className="py-1.5 pr-3 font-medium">Mois</th>
              {colonnes.map((c) => (
                <th key={c.companyId ?? "sans"} scope="col" className={`py-1.5 pl-3 text-right font-medium ${c.companyId ? "" : "text-warning"}`}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MOIS.map((m, i) => (
              <tr key={m} className="border-b border-border/60">
                <th scope="row" className="py-1.5 pr-3 text-left font-normal">{m}</th>
                {colonnes.map((c) => <Case key={c.companyId ?? "sans"} cost={c.masse.mois[i]!.cost} net={c.masse.mois[i]!.net} />)}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-semibold">
              <th scope="row" className="py-2 pr-3 text-left">Total {year}</th>
              {colonnes.map((c) => <Case key={c.companyId ?? "sans"} cost={c.masse.total.cost} net={c.masse.total.net} />)}
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}

function Case({ cost, net }: { cost: number; net: number }) {
  if (cost === 0 && net === 0) return <td className="py-1.5 pl-3 text-right text-muted-foreground">—</td>;
  return (
    <td className="py-1.5 pl-3 text-right tabular-nums">
      <span className="block">{formatCurrency(cost)}</span>
      <span className="block text-[0.6875rem] font-normal text-muted-foreground">net {formatCurrency(net)}</span>
    </td>
  );
}
