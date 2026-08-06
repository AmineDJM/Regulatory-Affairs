import { Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PulseView } from "@/lib/adventum/pulse";

/**
 * Bandeau « Analyse continue » (Adventum Pulse) — état courant + tendance vs l'instantané
 * précédent + mini-courbe. Composant purement présentiel (aucun hook) : utilisable côté serveur
 * (Process Intelligence) comme côté client (cockpit Adventum Brain).
 */

function ago(min: number | null): string {
  if (min === null) return "initialisation…";
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `il y a ${h} h`;
  return `il y a ${Math.round(h / 24)} j`;
}

/** Puce de variation : ↑ (aggravation → rouge), ↓ (amélioration → vert), — (stable). */
function Delta({ v }: { v: number | undefined }) {
  if (v === undefined || v === 0) return <span className="text-muted-foreground">—</span>;
  const worse = v > 0;
  return (
    <span className={cn("tabular-nums font-medium", worse ? "text-destructive" : "text-success")}>
      {worse ? "▲" : "▼"} {worse ? "+" : ""}{v}
    </span>
  );
}

function Metric({ label, value, delta, tone }: { label: string; value: number; delta?: number; tone?: string }) {
  return (
    <div className="min-w-0">
      <p className="flex items-baseline gap-1.5">
        <span className={cn("text-lg font-semibold tabular-nums", tone)}>{value}</span>
        <span className="text-xs"><Delta v={delta} /></span>
      </p>
      <p className="truncate text-[0.6875rem] text-muted-foreground">{label}</p>
    </div>
  );
}

/** Mini-courbe SVG sans dépendance (tolère les séries courtes ou constantes). */
function Sparkline({ data }: { data: number[] }) {
  if (data.length < 2) return null;
  const W = 120, H = 34, min = Math.min(...data), max = Math.max(...data), span = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * W;
    const y = H - 3 - ((v - min) / span) * (H - 6);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-9 w-28 shrink-0" preserveAspectRatio="none" aria-hidden>
      <polyline points={pts.join(" ")} fill="none" stroke="hsl(var(--primary))" strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export function PulseStrip({ pulse }: { pulse: PulseView }) {
  const { current, delta } = pulse;
  return (
    <div className="rounded-xl border border-border bg-card p-3.5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success/60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-success" />
          </span>
          <div>
            <p className="flex items-center gap-1.5 text-sm font-semibold"><Activity className="h-4 w-4 text-primary" /> Analyse continue</p>
            <p className="text-[0.6875rem] text-muted-foreground">
              {pulse.hasData ? `Dernière passe ${ago(pulse.ageMinutes)}` : "Première analyse en cours…"}
              {pulse.points > 1 ? ` · ${pulse.points} relevés` : ""}
            </p>
          </div>
        </div>

        <div className="grid flex-1 grid-cols-3 gap-x-4 gap-y-2 sm:grid-cols-5">
          <Metric label="Risques suivis" value={current.riskTotal} delta={delta?.riskTotal} />
          <Metric label="Critiques" value={current.riskCritical} delta={delta?.riskCritical} tone={current.riskCritical > 0 ? "text-destructive" : undefined} />
          <Metric label="Bloqués >14 j" value={current.stuck} delta={delta?.stuck} />
          <Metric label="Échéances dépassées" value={current.overdue} delta={delta?.overdue} tone={current.overdue > 0 ? "text-destructive" : undefined} />
          <Metric label="Validations en attente" value={current.validationsPending} delta={delta?.validationsPending} />
        </div>

        <Sparkline data={pulse.spark.riskTotal} />
      </div>
    </div>
  );
}
