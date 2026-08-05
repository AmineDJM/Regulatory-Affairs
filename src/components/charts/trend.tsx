import { INK } from "./palette";

/**
 * COURBE — l'évolution dans le temps, et surtout : **est-on en avance ou en retard ?**
 *
 * Deux tracés seulement, sur UN SEUL axe (jamais deux échelles — c'est l'erreur classique
 * qui fait dire n'importe quoi à un graphique) :
 *  • la consommation réelle CUMULÉE (aire pleine, teinte principale) ;
 *  • le rythme théorique — le budget dépensé régulièrement sur la période (trait pointillé,
 *    gris). Au-dessus du pointillé = on dépense trop vite.
 *
 * Composant serveur : aucun JS. Chaque point porte son `<title>` (info-bulle native) et un
 * repère cliquable au doigt plus large que le point lui-même.
 */

export interface TrendPoint {
  label: string;
  value: number;
  /** Référence (rythme théorique) au même instant. */
  expected: number;
}

const W = 640;
const H = 180;
const PAD = { top: 12, right: 12, bottom: 26, left: 8 };

export function Trend({
  points, format, color = "#2a78d6", referenceLabel = "Rythme théorique",
}: {
  points: TrendPoint[];
  format: (n: number) => string;
  color?: string;
  referenceLabel?: string;
}) {
  if (points.length < 2) {
    return <p className="py-6 text-center text-sm text-muted-foreground">Pas encore assez d&apos;historique pour tracer une courbe.</p>;
  }

  const max = Math.max(1, ...points.map((p) => Math.max(p.value, p.expected)));
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (i / (points.length - 1)) * innerW;
  const y = (v: number) => PAD.top + innerH - (v / max) * innerH;

  const line = points.map((p, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`).join(" ");
  const area = `${line} L ${x(points.length - 1).toFixed(1)} ${PAD.top + innerH} L ${x(0).toFixed(1)} ${PAD.top + innerH} Z`;
  const ref = points.map((p, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(p.expected).toFixed(1)}`).join(" ");

  // On n'étiquette pas tous les points : au plus 6 repères d'axe, sinon c'est illisible.
  const step = Math.max(1, Math.ceil(points.length / 6));

  return (
    <figure className="space-y-2">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Consommation cumulée comparée au rythme théorique" preserveAspectRatio="none">
        {/* Grille discrète : 3 traits, rien de plus. */}
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1={PAD.left} x2={W - PAD.right} y1={y(max * f)} y2={y(max * f)} stroke={INK.grid} strokeWidth={1} />
        ))}
        <line x1={PAD.left} x2={W - PAD.right} y1={PAD.top + innerH} y2={PAD.top + innerH} stroke={INK.axis} strokeWidth={1} />

        <path d={area} fill={color} opacity={0.12} />
        <path d={ref} fill="none" stroke={INK.muted} strokeWidth={2} strokeDasharray="5 4" />
        <path d={line} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

        {points.map((p, i) => (
          <g key={p.label}>
            {/* Cible de survol volontairement plus large que le point. */}
            <circle cx={x(i)} cy={y(p.value)} r={12} fill="transparent">
              <title>{`${p.label} — ${format(p.value)} consommés · ${referenceLabel.toLowerCase()} ${format(p.expected)}`}</title>
            </circle>
            <circle cx={x(i)} cy={y(p.value)} r={4} fill={color} stroke="#ffffff" strokeWidth={2} />
          </g>
        ))}

        {points.map((p, i) =>
          i % step === 0 || i === points.length - 1 ? (
            <text key={`t-${p.label}`} x={x(i)} y={H - 8} textAnchor={i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"} fill={INK.muted} className="text-[10px]">
              {p.label}
            </text>
          ) : null,
        )}
      </svg>
      <figcaption className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded" style={{ backgroundColor: color }} aria-hidden /> Consommé (cumulé)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded border-t-2 border-dashed" style={{ borderColor: INK.muted }} aria-hidden /> {referenceLabel}
        </span>
      </figcaption>
    </figure>
  );
}
