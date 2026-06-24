import { Badge } from "@/components/ui/badge";
import type { BadgeTone } from "@/lib/labels";

interface StatusBadgeProps {
  map: Record<string, { label: string; tone: BadgeTone }>;
  value: string | null | undefined;
  dot?: boolean;
}

/** Renders an enum value as a coloured status badge using a label map. */
export function StatusBadge({ map, value, dot = true }: StatusBadgeProps) {
  if (!value) return <span className="text-muted-foreground">—</span>;
  const entry = map[value] ?? { label: value, tone: "neutral" as BadgeTone };
  return (
    <Badge tone={entry.tone} dot={dot}>
      {entry.label}
    </Badge>
  );
}
