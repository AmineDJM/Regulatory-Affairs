import * as React from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: string;
  children?: React.ReactNode; // actions on the right
  className?: string;
}

export function PageHeader({ title, description, children, className }: PageHeaderProps) {
  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between", className)}>
      {/* `min-w-0` : sans lui, un titre long (une référence sans espace, un nom de produit) pousse
          la largeur du bloc au-delà de l'écran et fait défiler TOUTE la page latéralement. */}
      <div className="min-w-0 space-y-1">
        {/* Titre plus compact sur téléphone : la hauteur d'écran y est la ressource rare. */}
        <h1 className="break-words text-xl font-semibold tracking-tight text-foreground sm:text-2xl">{title}</h1>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}
