import { INK, SERIES } from "@/components/charts/palette";

/**
 * LES GRAPHIQUES DE L'AUDIENCE DU SITE — composants serveur, aucun JS envoyé au navigateur.
 *
 *  • `CourbeAudience` : visiteurs et pages vues par jour (ou par mois), sur UN SEUL axe — les deux
 *    sont des comptes de même nature. Chaque point porte son `<title>` (info-bulle native).
 *  • `BarresPart` : une répartition (sources, navigateurs, pays…) en barres horizontales, le
 *    chiffre et la part écrits à côté — jamais la longueur seule.
 */

export interface PointCourbe { label: string; visiteurs: number; vues: number }

const W = 640;
const H = 200;
const PAD = { top: 14, right: 10, bottom: 26, left: 10 };

export function CourbeAudience({ points, format }: { points: PointCourbe[]; format: (n: number) => string }) {
  if (points.length < 2) return <p className="py-6 text-center text-sm text-muted-foreground">Pas assez de jours pour tracer une courbe.</p>;
  const max = Math.max(1, ...points.map((p) => Math.max(p.vues, p.visiteurs)));
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (i / (points.length - 1)) * innerW;
  const y = (v: number) => PAD.top + innerH - (v / max) * innerH;
  const trace = (k: "vues" | "visiteurs") => points.map((p, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(p[k]).toFixed(1)}`).join(" ");
  const aire = `${trace("visiteurs")} L ${x(points.length - 1).toFixed(1)} ${PAD.top + innerH} L ${x(0).toFixed(1)} ${PAD.top + innerH} Z`;
  const pas = Math.max(1, Math.ceil(points.length / 6));
  const marques = points.length <= 31;
  const [bleu, orange] = [SERIES[0], SERIES[1]];

  return (
    <figure className="space-y-2">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Visiteurs et pages vues sur la période" preserveAspectRatio="none">
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <line key={f} x1={PAD.left} x2={W - PAD.right} y1={y(max * f)} y2={y(max * f)} stroke={INK.grid} strokeWidth={1} vectorEffect="non-scaling-stroke" />
        ))}
        <line x1={PAD.left} x2={W - PAD.right} y1={PAD.top + innerH} y2={PAD.top + innerH} stroke={INK.axis} strokeWidth={1} vectorEffect="non-scaling-stroke" />
        <path d={aire} fill={bleu} opacity={0.1} />
        <path d={trace("vues")} fill="none" stroke={orange} strokeWidth={2} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        <path d={trace("visiteurs")} fill="none" stroke={bleu} strokeWidth={2.5} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        {points.map((p, i) => (
          <g key={p.label}>
            <rect x={x(i) - innerW / points.length / 2} y={PAD.top} width={innerW / points.length} height={innerH} fill="transparent">
              <title>{`${p.label} — ${format(p.visiteurs)} visiteur(s) · ${format(p.vues)} page(s) vue(s)`}</title>
            </rect>
            {marques && <circle cx={x(i)} cy={y(p.visiteurs)} r={2.5} fill={bleu} pointerEvents="none" />}
          </g>
        ))}
        {points.map((p, i) =>
          i % pas === 0 || i === points.length - 1 ? (
            <text key={`t-${p.label}`} x={x(i)} y={H - 8} textAnchor={i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"} fill={INK.muted} className="text-[1.25rem] sm:text-[0.8125rem] lg:text-[0.625rem]">
              {p.label}
            </text>
          ) : null,
        )}
        <text x={PAD.left + 2} y={PAD.top + 10} fill={INK.muted} className="text-[1.25rem] sm:text-[0.8125rem] lg:text-[0.625rem]">{format(max)}</text>
      </svg>
      <figcaption className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4 rounded" style={{ backgroundColor: bleu }} aria-hidden /> Visiteurs</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4 rounded" style={{ backgroundColor: orange }} aria-hidden /> Pages vues</span>
      </figcaption>
    </figure>
  );
}

export interface LignePart { label: string; valeur: number; detail?: string }

/** Barres horizontales : le libellé, le chiffre et la part du total. */
export function BarresPart({ lignes, total, format, vide = "Rien sur la période." }: {
  lignes: LignePart[];
  total: number;
  format: (n: number) => string;
  vide?: string;
}) {
  if (lignes.length === 0 || total <= 0) return <p className="py-4 text-center text-sm text-muted-foreground">{vide}</p>;
  const max = Math.max(1, ...lignes.map((l) => l.valeur));
  return (
    <ul className="space-y-2.5">
      {lignes.map((l) => {
        const part = Math.round((l.valeur / total) * 100);
        return (
          <li key={l.label} className="space-y-1">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate">{l.label}{l.detail && <span className="ml-1.5 text-xs text-muted-foreground">{l.detail}</span>}</span>
              <span className="shrink-0 tabular-nums">
                <span className="font-medium">{format(l.valeur)}</span>
                <span className="ml-2 inline-block w-10 text-right text-xs text-muted-foreground">{part} %</span>
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary" aria-hidden>
              <div className="h-full rounded-full" style={{ width: `${(l.valeur / max) * 100}%`, backgroundColor: SERIES[0] }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
