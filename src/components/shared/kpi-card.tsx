import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  label: string;
  value: string | number;
  icon?: string;
  hint?: string;
  tone?: "default" | "success" | "warning" | "danger" | "info";
  trend?: { value: string; positive?: boolean };
}

const toneStyles = {
  default: "text-primary bg-primary/10",
  success: "text-success bg-success/10",
  warning: "text-warning bg-warning/10",
  danger: "text-destructive bg-destructive/10",
  info: "text-blue-600 bg-blue-50",
};

export function KpiCard({ label, value, icon, hint, tone = "default", trend }: KpiCardProps) {
  return (
    /* `min-w-0` : dans une grille, une carte prend sinon la largeur de son CONTENU le plus
       large — « 1 300 000 DZD » en 24 px ne se coupe pas, et la carte sortait de l'écran
       (mesuré à 375 px : 381 px de bord droit). Avec la borne, c'est la valeur qui passe à
       la ligne et se resserre sur téléphone. */
    <div className="surface flex min-w-0 flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <span className="min-w-0 text-sm font-medium text-muted-foreground">{label}</span>
        {icon && (
          <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg", toneStyles[tone])}>
            <Icon name={icon} className="h-4 w-4" />
          </span>
        )}
      </div>
      <div className="flex items-end justify-between gap-2">
        <span className="min-w-0 break-words text-xl font-semibold tracking-tight text-foreground tabular-nums sm:text-2xl">{value}</span>
        {trend && (
          <span
            className={cn(
              "text-xs font-medium",
              trend.positive ? "text-success" : "text-destructive",
            )}
          >
            {trend.value}
          </span>
        )}
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
