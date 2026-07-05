import { cn } from "@/lib/utils";

/** Pastille d'entité (société) : point coloré + libellé court. Rien si non rattaché. */
export function CompanyBadge({
  company,
  className,
}: {
  company: { name: string; shortName?: string | null; color?: string | null } | null | undefined;
  className?: string;
}) {
  if (!company) return null;
  const color = company.color || "#64748b";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
        className,
      )}
      style={{ borderColor: `${color}55`, color, backgroundColor: `${color}12` }}
      title={company.name}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
      {company.shortName || company.name}
    </span>
  );
}
