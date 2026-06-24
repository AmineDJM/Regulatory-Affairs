import * as React from "react";
import { cn } from "@/lib/utils";
import type { BadgeTone } from "@/lib/labels";

const tones: Record<BadgeTone, string> = {
  neutral: "bg-secondary text-secondary-foreground border-border",
  info: "bg-accent text-accent-foreground border-transparent",
  success: "bg-success/10 text-success border-success/20",
  warning: "bg-warning/10 text-warning border-warning/20",
  danger: "bg-destructive/10 text-destructive border-destructive/20",
  purple: "bg-purple-100 text-purple-700 border-purple-200",
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  dot?: boolean;
}

export function Badge({ className, tone = "neutral", dot, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        tones[tone],
        className,
      )}
      {...props}
    >
      {dot && (
        <span className={cn("h-1.5 w-1.5 rounded-full bg-current opacity-70")} />
      )}
      {children}
    </span>
  );
}
