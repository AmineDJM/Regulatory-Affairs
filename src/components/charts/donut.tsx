import { INK } from "./palette";

/**
 * CAMEMBERT (anneau) — répartition d'un tout en parts.
 *
 * Règles tenues ici :
 *  • au plus 6 tranches (la queue est repliée par `foldTail` avant l'appel) — au-delà, l'œil
 *    ne compare plus rien ;
 *  • un **écart de 2 px** entre tranches : deux couleurs voisines ne se touchent jamais ;
 *  • la couleur ne porte JAMAIS seule l'information — chaque part est reprise dans une
 *    légende chiffrée (qui vaut vue tabulaire) et décrite dans son `<title>` ;
 *  • le centre porte le total : c'est le chiffre que l'on vient chercher.
 *
 * Composant serveur (aucun état) : pas de JS envoyé au navigateur.
 */

export interface DonutSlice {
  label: string;
  value: number;
  color: string;
}

function arc(cx: number, cy: number, r: number, from: number, to: number): string {
  const p = (a: number) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  const [x1, y1] = p(from);
  const [x2, y2] = p(to);
  const large = to - from > Math.PI ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
}

export function Donut({
  slices, total, centerLabel, centerValue, format, size = 168,
}: {
  slices: DonutSlice[];
  /** Total de référence (peut dépasser la somme des parts : le reste s'affiche en creux). */
  total: number;
  centerLabel: string;
  centerValue: string;
  format: (n: number) => string;
  size?: number;
}) {
  const sum = slices.reduce((s, x) => s + x.value, 0);
  const base = Math.max(total, sum);
  if (base <= 0) return <p className="py-6 text-center text-sm text-muted-foreground">Aucun montant à répartir.</p>;

  const r = size / 2 - 12;
  const c = size / 2;
  const stroke = 22;
  // Écart de 2 px entre tranches, exprimé en radians au rayon de l'anneau.
  const gap = 2 / r;

  let angle = -Math.PI / 2; // on démarre à midi
  const paths = slices.map((s) => {
    const sweep = (s.value / base) * Math.PI * 2;
    const from = angle + gap / 2;
    const to = angle + sweep - gap / 2;
    angle += sweep;
    return { ...s, from, to, visible: to > from };
  });

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:gap-6">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${centerLabel} : ${centerValue}`} className="shrink-0">
        {/* Piste de fond : ce qui reste non réparti se lit en creux. */}
        <circle cx={c} cy={c} r={r} fill="none" stroke={INK.grid} strokeWidth={stroke} />
        {paths.map((p) =>
          p.visible ? (
            <path key={p.label} d={arc(c, c, r, p.from, p.to)} fill="none" stroke={p.color} strokeWidth={stroke} strokeLinecap="butt">
              <title>{`${p.label} — ${format(p.value)} (${Math.round((p.value / base) * 100)} %)`}</title>
            </path>
          ) : null,
        )}
        <text x={c} y={c - 4} textAnchor="middle" className="fill-foreground text-[15px] font-semibold">{centerValue}</text>
        <text x={c} y={c + 14} textAnchor="middle" fill={INK.muted} className="text-[10px]">{centerLabel}</text>
      </svg>

      {/* Légende CHIFFRÉE — l'information ne repose jamais sur la couleur seule. */}
      <ul className="min-w-0 flex-1 space-y-1.5">
        {slices.map((s) => (
          <li key={s.label} className="flex items-center gap-2 text-sm">
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: s.color }} aria-hidden />
            <span className="min-w-0 flex-1 truncate">{s.label}</span>
            <span className="shrink-0 tabular-nums text-muted-foreground">{format(s.value)}</span>
            <span className="w-10 shrink-0 text-right tabular-nums font-medium">{Math.round((s.value / base) * 100)} %</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
