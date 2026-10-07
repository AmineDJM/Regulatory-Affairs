import { cn } from "@/lib/utils";
import type { Lettre } from "@/lib/segmentation/regles";
import { pointsSparkline } from "@/lib/marketing-cockpit/calculs";

/**
 * Les petites pièces du cockpit, sans état et sans lecture — utilisables par la page (serveur) comme par le
 * gestionnaire de messages (client). Les couleurs des lettres sont CELLES de la segmentation (`lettre-badge.tsx` :
 * H violet, A vert, B bleu, C orange, D rouge) : une lettre se lit pareil partout.
 */
const TON_LETTRE: Record<"H" | "A" | "B" | "C" | "D", string> = {
  H: "bg-violet-500/10 text-violet-600 dark:text-violet-300",
  A: "bg-success/10 text-success",
  B: "bg-primary/10 text-primary",
  C: "bg-warning/10 text-warning",
  D: "bg-destructive/10 text-destructive",
};

/** Un nombre dans la couleur de sa lettre — « 9 » sur fond violet = 9 portages chez des H. */
export function PastilleCompte({ lettre, n }: { lettre: Lettre; n: number }) {
  const ton = lettre in TON_LETTRE ? TON_LETTRE[lettre as keyof typeof TON_LETTRE] : "bg-muted text-muted-foreground";
  return (
    <span title={`${n} chez des ${lettre}`} className={cn("inline-flex h-[22px] min-w-[24px] items-center justify-center rounded-md px-1.5 text-[11px] font-bold tabular-nums", ton)}>
      {n}
    </span>
  );
}

/** La pente sur six cycles : verte si elle monte (ou tient), orange si elle descend. */
export function Sparkline({ valeurs, label }: { valeurs: readonly number[]; label: string }) {
  if (valeurs.length < 2 || valeurs.every((v) => v === 0)) return <span className="text-muted-foreground">—</span>;
  const monte = valeurs[valeurs.length - 1] >= valeurs[0];
  return (
    <svg width="70" height="20" viewBox="0 0 70 20" role="img" aria-label={label}>
      <polyline points={pointsSparkline(valeurs)} fill="none" stroke={monte ? "hsl(var(--success))" : "hsl(var(--warning))"} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/** Une pastille d'état : « actif », « archivé »… */
export function Pilule({ ton, children }: { ton: "ok" | "muet" | "info" | "violet" | "warning"; children: React.ReactNode }) {
  const c = {
    ok: "bg-success/10 text-success",
    muet: "bg-muted text-muted-foreground",
    info: "bg-primary/10 text-primary",
    violet: "bg-violet-500/10 text-violet-600 dark:text-violet-300",
    warning: "bg-warning/10 text-warning",
  }[ton];
  return <span className={cn("inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium", c)}>{children}</span>;
}
