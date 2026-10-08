import { INK, STATUS } from "./palette";

/**
 * COURBE PROLONGÉE — la consommation cumulée réelle, puis, en pointillé, ce qui est attendu d'ici la fin de la période,
 * face à la ligne du budget. UN SEUL axe : on lit d'un coup d'œil « jusqu'où va-t-on si tout ce qui est attendu tombe ? ».
 *
 * Composant serveur : aucun JS. Chaque point réel porte son `<title>` (info-bulle native).
 */

const W = 640;
const H = 180;
const PAD = { top: 16, right: 12, bottom: 26, left: 8 };

export function Projection({
  labels, reel, projete, budget, format, color = "#2a78d6", projeteColor = STATUS.warning, budgetLabel = "Budget", projeteLabel = "Attendu",
}: {
  labels: string[];
  reel: (number | null)[];
  projete: (number | null)[];
  budget: number;
  format: (n: number) => string;
  color?: string;
  projeteColor?: string;
  budgetLabel?: string;
  projeteLabel?: string;
}) {
  const n = labels.length;
  if (n < 2) {
    return <p className="py-6 text-center text-sm text-muted-foreground">Pas encore assez d&apos;historique pour tracer une courbe.</p>;
  }

  const valeurs = [...reel, ...projete].filter((v): v is number => v !== null);
  const max = Math.max(1, budget, ...valeurs);
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (i / (n - 1)) * innerW;
  const y = (v: number) => PAD.top + innerH - (v / max) * innerH;

  const trace = (serie: (number | null)[]) =>
    serie.flatMap((v, i) => (v === null ? [] : [`${x(i).toFixed(1)} ${y(v).toFixed(1)}`])).map((p, i) => `${i === 0 ? "M" : "L"} ${p}`).join(" ");

  const step = Math.max(1, Math.ceil(n / 6));
  const yBudget = y(budget);
  const dernierProjete = projete.reduce<number | null>((acc, v, i) => (v !== null ? i : acc), null);

  return (
    <figure className="space-y-2 px-4 pb-4">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Consommation cumulée, ${projeteLabel.toLowerCase()} et ${budgetLabel.toLowerCase()}`} preserveAspectRatio="none">
        <line x1={PAD.left} x2={W - PAD.right} y1={PAD.top + innerH} y2={PAD.top + innerH} stroke={INK.axis} strokeWidth={1} />
        {budget > 0 && (
          <>
            <line x1={PAD.left} x2={W - PAD.right} y1={yBudget} y2={yBudget} stroke={STATUS.critical} strokeWidth={1.5} strokeDasharray="2 4" />
            <text x={W - PAD.right} y={Math.max(11, yBudget - 5)} textAnchor="end" fill={STATUS.critical} className="text-[1.25rem] sm:text-[0.8125rem] lg:text-[0.625rem]">
              {budgetLabel.toLowerCase()} {format(budget)}
            </text>
          </>
        )}
        <path d={trace(projete)} fill="none" stroke={projeteColor} strokeWidth={2} strokeDasharray="5 4" strokeLinejoin="round" />
        <path d={trace(reel)} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />

        {reel.map((v, i) => v === null ? null : (
          <g key={`r-${labels[i]}-${i}`}>
            <circle cx={x(i)} cy={y(v)} r={12} fill="transparent"><title>{`${labels[i]} — ${format(v)} consommés (cumul)`}</title></circle>
            <circle cx={x(i)} cy={y(v)} r={3.5} fill={color} stroke="#ffffff" strokeWidth={2} />
          </g>
        ))}
        {dernierProjete !== null && projete[dernierProjete] !== null && (
          <g>
            <circle cx={x(dernierProjete)} cy={y(projete[dernierProjete] as number)} r={12} fill="transparent">
              <title>{`${labels[dernierProjete]} — ${format(projete[dernierProjete] as number)} si tout ce qui est attendu est réglé`}</title>
            </circle>
            <circle cx={x(dernierProjete)} cy={y(projete[dernierProjete] as number)} r={3.5} fill={projeteColor} stroke="#ffffff" strokeWidth={2} />
          </g>
        )}

        {labels.map((l, i) =>
          i % step === 0 || i === n - 1 ? (
            <text key={`t-${l}-${i}`} x={x(i)} y={H - 8} textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"} fill={INK.muted} className="text-[1.25rem] sm:text-[0.8125rem] lg:text-[0.625rem]">
              {l}
            </text>
          ) : null,
        )}
      </svg>
      <figcaption className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded" style={{ backgroundColor: color }} aria-hidden /> Consommé (cumul)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-4 border-t-2 border-dashed" style={{ borderColor: projeteColor }} aria-hidden /> {projeteLabel}
        </span>
      </figcaption>
    </figure>
  );
}
