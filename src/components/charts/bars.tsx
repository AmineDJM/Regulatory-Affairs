import { STATUS } from "./palette";

/**
 * BARRES « budget vs consommé » — la comparaison la plus fréquente du module.
 *
 * Horizontales : les intitulés de catégories sont longs, et une barre horizontale se lit sans
 * incliner la tête. La couleur est un **statut** (maîtrisé / à surveiller / dépassé), pas une
 * identité — elle ne sert donc jamais seule : le pourcentage est écrit à côté.
 *
 * Composant serveur : aucun JS.
 */

export interface BarRow {
  label: string;
  budget: number;
  consumed: number;
}

const toneOf = (pct: number) => (pct >= 100 ? "danger" : pct >= 80 ? "warning" : "good");
const COLOR = { good: STATUS.good, warning: STATUS.warning, danger: STATUS.critical } as const;
const TEXT = { good: "text-success", warning: "text-warning", danger: "text-destructive" } as const;

export function Bars({ rows, format, max: maxProp }: { rows: BarRow[]; format: (n: number) => string; max?: number }) {
  if (rows.length === 0) return null;
  const max = Math.max(1, maxProp ?? Math.max(...rows.map((r) => Math.max(r.budget, r.consumed))));

  return (
    <ul className="space-y-3">
      {rows.map((r) => {
        const pct = r.budget > 0 ? Math.round((r.consumed / r.budget) * 100) : 0;
        const tone = toneOf(pct);
        return (
          <li key={r.label} className="space-y-1">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate font-medium">{r.label}</span>
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                {format(r.consumed)} / {format(r.budget)} · <span className={`font-semibold ${TEXT[tone]}`}>{pct} %</span>
              </span>
            </div>
            {/* Piste = budget alloué ; remplissage = consommé. Coins arrondis 4 px côté valeur. */}
            <div className="relative h-2.5 w-full overflow-hidden rounded bg-secondary" title={`${r.label} — ${format(r.consumed)} consommés sur ${format(r.budget)} (${pct} %)`}>
              <div className="absolute inset-y-0 left-0 rounded bg-foreground/10" style={{ width: `${Math.min(100, (r.budget / max) * 100)}%` }} />
              <div className="absolute inset-y-0 left-0 rounded" style={{ width: `${Math.min(100, (r.consumed / max) * 100)}%`, backgroundColor: COLOR[tone] }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * JAUGE — un seul ratio contre une limite. Ce n'est pas un camembert à deux parts :
 * une jauge se lit d'un coup d'œil et laisse la place au chiffre.
 */
export function Meter({ value, limit, format }: { value: number; limit: number; format: (n: number) => string }) {
  const pct = limit > 0 ? Math.round((value / limit) * 100) : 0;
  const tone = toneOf(pct);
  return (
    <div className="space-y-1.5">
      <div className="relative h-3 w-full overflow-hidden rounded-full bg-secondary">
        <div className="absolute inset-y-0 left-0 rounded-full transition-all" style={{ width: `${Math.min(100, pct)}%`, backgroundColor: COLOR[tone] }} />
      </div>
      <p className="text-xs text-muted-foreground">
        <span className={`font-semibold ${TEXT[tone]}`}>{pct} %</span> du budget consommé — {format(value)} sur {format(limit)}
      </p>
    </div>
  );
}
