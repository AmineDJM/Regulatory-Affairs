import { cn } from "@/lib/utils";
import type { Lettre } from "@/lib/segmentation/regles";

/** La pastille d'une lettre — H violet, A vert, B bleu, C orange, D rouge, NA gris ; « non ciblé » en toutes lettres. */
const TON: Record<Exclude<Lettre, "NC">, string> = {
  H: "bg-violet-500/10 text-violet-600 dark:text-violet-300",
  A: "bg-success/10 text-success",
  B: "bg-primary/10 text-primary",
  C: "bg-warning/10 text-warning",
  D: "bg-destructive/10 text-destructive",
  NA: "bg-muted text-muted-foreground font-semibold",
};

export function LettreBadge({ lettre, className }: { lettre: Lettre; className?: string }) {
  if (lettre === "NC") return <span className={cn("inline-flex items-center whitespace-nowrap rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground", className)}>non ciblé</span>;
  return (
    <span className={cn("inline-flex h-6 min-w-[28px] items-center justify-center rounded-md px-1.5 text-xs font-bold", TON[lettre], className)}>{lettre}</span>
  );
}
