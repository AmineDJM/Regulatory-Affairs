/**
 * RÉPARTITION — « où va l'argent » : une barre par part, proportionnelle à la plus grosse, avec son total.
 * Pas de budget ni de seuil ici (contrairement à `Bars`) : une barre de statut ferait croire à un dépassement.
 *
 * Composant serveur : aucun JS.
 */
export function Repartition({ rows, format }: { rows: { label: string; total: number }[]; format: (n: number) => string }) {
  if (rows.length === 0) return null;
  const max = Math.max(1, ...rows.map((r) => r.total));
  const somme = rows.reduce((a, r) => a + r.total, 0);
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => {
        const part = somme > 0 ? Math.round((r.total / somme) * 100) : 0;
        return (
          <li key={r.label} className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)_auto] items-center gap-3 text-sm sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)_auto]">
            <span className="truncate" title={r.label}>{r.label}</span>
            <span className="h-2.5 overflow-hidden rounded-full bg-secondary" title={`${r.label} — ${format(r.total)} (${part} %)`}>
              <span className="block h-full rounded-full bg-primary" style={{ width: `${Math.max(2, (r.total / max) * 100)}%` }} />
            </span>
            <span className="text-right text-xs tabular-nums text-muted-foreground">{format(r.total)}</span>
          </li>
        );
      })}
    </ul>
  );
}
