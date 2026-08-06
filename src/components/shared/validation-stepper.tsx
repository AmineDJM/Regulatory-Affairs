import { Check, X, Dot } from "lucide-react";
import { cn } from "@/lib/utils";

export type VStepState = "done" | "current" | "todo" | "rejected";

export interface VStep {
  label: string;
  state: VStepState;
  hint?: string;
}

/**
 * Frise verticale de suivi de validation (toujours visible). Montre clairement
 * où en est une demande dans son circuit, même si aucune note n'a encore été
 * saisie. Présentational pur (réutilisé par Sponsoring/Congrès et Événements).
 */
export function ValidationStepper({ steps }: { steps: VStep[] }) {
  return (
    <ol className="space-y-0">
      {steps.map((s, i) => {
        const last = i === steps.length - 1;
        const tone =
          s.state === "done"
            ? "border-success bg-success text-white"
            : s.state === "current"
              ? "border-primary bg-primary/10 text-primary"
              : s.state === "rejected"
                ? "border-destructive bg-destructive text-white"
                : "border-border bg-secondary text-muted-foreground";
        return (
          <li key={i} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-[0.6875rem] font-semibold", tone)}>
                {s.state === "done" ? <Check className="h-3.5 w-3.5" /> : s.state === "rejected" ? <X className="h-3.5 w-3.5" /> : s.state === "current" ? <Dot className="h-5 w-5" /> : i + 1}
              </span>
              {!last && <span className={cn("w-0.5 flex-1", s.state === "done" ? "bg-success/40" : "bg-border")} style={{ minHeight: "1.25rem" }} />}
            </div>
            <div className={cn("pb-4", last && "pb-0")}>
              <p className={cn("text-sm font-medium", s.state === "todo" && "text-muted-foreground", s.state === "current" && "text-primary", s.state === "rejected" && "text-destructive")}>
                {s.label}
              </p>
              {s.hint && <p className="text-xs text-muted-foreground">{s.hint}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
