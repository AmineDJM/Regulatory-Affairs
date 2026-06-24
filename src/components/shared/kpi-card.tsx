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
    <div className="surface flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        {icon && (
          <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg", toneStyles[tone])}>
            <Icon name={icon} className="h-4 w-4" />
          </span>
        )}
      </div>
      <div className="flex items-end justify-between">
        <span className="text-2xl font-semibold tracking-tight text-foreground">{value}</span>
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
