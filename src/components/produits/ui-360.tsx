import Link from "next/link";
import { cn } from "@/lib/utils";
import { ETAPES_CYCLE, LIBELLE_ETAPE, type EtapeCycle } from "@/lib/products/fiche-360";

/**
 * LES PIÈCES D'ÉCRAN DE PRODUITS 360 — sans état, rendues côté serveur : onglets en liens (l'onglet ouvert se partage
 * par l'URL), pastille de signal, courbe de tendance, frise du cycle de vie, carte à en-tête.
 */

export function Onglets({ items, actif, label }: { items: { cle: string; label: string; href: string; n?: number }[]; actif: string; label: string }) {
  return (
    <nav aria-label={label} className="no-scrollbar flex gap-1 overflow-x-auto border-b border-border">
      {items.map((o) => (
        <Link
          key={o.cle}
          href={o.href}
          aria-current={o.cle === actif ? "page" : undefined}
          className={cn(
            "-mb-px whitespace-nowrap border-b-2 px-3.5 py-2.5 text-sm font-medium transition-colors",
            o.cle === actif ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
          {o.n !== undefined && <span className="ml-1.5 rounded-full bg-muted px-1.5 text-[11px] text-muted-foreground">{o.n}</span>}
        </Link>
      ))}
    </nav>
  );
}

const TONS = {
  danger: "bg-destructive/10 text-destructive",
  warning: "bg-warning/10 text-warning",
  success: "bg-success/10 text-success",
  info: "bg-primary/10 text-primary",
  neutral: "bg-muted text-muted-foreground",
} as const;
export type Ton = keyof typeof TONS;

export function Pastille({ ton, children }: { ton: Ton; children: React.ReactNode }) {
  return <span className={cn("inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium", TONS[ton])}>{children}</span>;
}

export function Point({ ton }: { ton: Ton }) {
  const fond = { danger: "bg-destructive", warning: "bg-warning", success: "bg-success", info: "bg-primary", neutral: "bg-muted-foreground" }[ton];
  return <i aria-hidden className={cn("inline-block h-2 w-2 shrink-0 rounded-full", fond)} />;
}

/** La tendance sur 12 mois : verte si les 3 derniers mois dépassent les 3 premiers, orange s'ils reculent. */
export function Tendance({ valeurs }: { valeurs: number[] }) {
  const max = Math.max(...valeurs, 0);
  if (max <= 0) return <span className="text-xs text-muted-foreground">—</span>;
  const w = 70; const h = 20;
  const pts = valeurs.map((v, i) => `${Math.round((i / Math.max(1, valeurs.length - 1)) * w)},${Math.round(h - 2 - (v / max) * (h - 4))}`).join(" ");
  const debut = valeurs.slice(0, 3).reduce((s, v) => s + v, 0);
  const fin = valeurs.slice(-3).reduce((s, v) => s + v, 0);
  const couleur = fin > debut * 1.05 ? "hsl(var(--success))" : fin < debut * 0.95 ? "hsl(var(--warning))" : "hsl(var(--muted-foreground))";
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden className="block">
      <polyline points={pts} fill="none" stroke={couleur} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export function FriseCycle({ etape }: { etape: EtapeCycle }) {
  return (
    <ol aria-label="Cycle de vie" className="flex flex-wrap gap-1">
      {ETAPES_CYCLE.map((e) => (
        <li key={e} aria-current={e === etape ? "step" : undefined}
          className={cn("rounded-full px-2 py-0.5 text-[11px]", e === etape ? "bg-success/10 font-semibold text-success" : "bg-muted text-muted-foreground")}>
          {LIBELLE_ETAPE[e]}
        </li>
      ))}
    </ol>
  );
}

export function Carte({ titre, sousTitre, action, children, className }: { titre: string; sousTitre?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("surface min-w-0 overflow-hidden", className)}>
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
        <h2 className="text-[15px] font-semibold">{titre}</h2>
        {(sousTitre || action) && <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">{sousTitre}{action}</div>}
      </header>
      {children}
    </section>
  );
}

export function Vide({ children }: { children: React.ReactNode }) {
  return <p className="px-4 py-4 text-sm text-muted-foreground">{children}</p>;
}
