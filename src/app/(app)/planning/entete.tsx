import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { SessionUser } from "@/lib/rbac";
import type { RepScope } from "@/lib/sfe";
import { SALES_PLANNING_TABS } from "@/lib/labels";
import { visibleTabs } from "@/lib/nav-tabs";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/shared/page-header";
import { ModuleTabs } from "@/components/shared/module-tabs";
import { MenuDossier } from "@/components/shared/menu-dossier";
import { jourDuCycle, libelleCycle, moisPrecedent, moisSuivant } from "@/lib/force-de-vente/calculs";
import type { BuVisible } from "@/lib/queries/force-de-vente";

/**
 * L'EN-TÊTE DE LA FORCE DE VENTE — le même sur Pilotage, Territoires et Produits (Direction, 07/10) : « Force de
 * vente », le cycle et son jour ouvré, Exporter, « ⋯ » (les réglages), les BU de la portée, puis les onglets. Le titre
 * ne se répète pas d'un onglet à l'autre : c'est l'onglet qui dit la vue.
 */

/** Les paramètres d'adresse que la page garde d'une vue à l'autre (BU, mois). */
export function lireParametres(sp: { bu?: string; y?: string; m?: string } | undefined, bus: readonly BuVisible[], maintenant = new Date()) {
  const year = Number(sp?.y) || maintenant.getFullYear();
  const m = Number(sp?.m);
  const month = m >= 1 && m <= 12 ? m : maintenant.getMonth() + 1;
  const buId = sp?.bu && bus.some((b) => b.id === sp.bu) ? sp.bu : null;
  return { year, month, buId };
}

/** L'adresse d'une vue avec la BU et le mois courants (le mois en cours ne s'écrit pas). */
export function lienFdv(chemin: string, p: { buId: string | null; year: number; month: number }, extra: Record<string, string> = {}, maintenant = new Date()) {
  const q = new URLSearchParams();
  if (p.buId) q.set("bu", p.buId);
  if (p.year !== maintenant.getFullYear() || p.month !== maintenant.getMonth() + 1) { q.set("y", String(p.year)); q.set("m", String(p.month)); }
  for (const [k, v] of Object.entries(extra)) q.set(k, v);
  const s = q.toString();
  return s ? `${chemin}?${s}` : chemin;
}

const btn = "inline-flex h-9 items-center rounded-[var(--radius)] border border-border bg-card px-3 text-[13px] font-medium hover:bg-secondary sm:h-8";

export async function EnteteFdv({ user, scope, bus, chemin, buId, year, month, exporter = false }: {
  user: SessionUser;
  scope: RepScope;
  bus: BuVisible[];
  /** La vue où l'on est : « /planning », « /planning/territoires », « /planning/produits ». */
  chemin: string;
  buId: string | null;
  year: number;
  month: number;
  /** Le bouton « Exporter » (le tableau des délégués) — sur le pilotage. */
  exporter?: boolean;
}) {
  const { jour, total } = jourDuCycle(year, month, new Date());
  const p = { buId, year, month };
  const prec = moisPrecedent(year, month), suiv = moisSuivant(year, month);
  // La BU et le cycle choisis suivent d'un onglet à l'autre ; l'onglet s'allume sur son chemin (`chemin`).
  const tabs = (await visibleTabs(user, SALES_PLANNING_TABS)).map((t) => ({ ...t, chemin: t.href, href: lienFdv(t.href, p) }));
  const enCours = jour > 0 && jour < total;
  return (
    <div className="space-y-3">
      <PageHeader title="Force de vente">
        {exporter && <a href={lienFdv("/api/planning/export", p, {}, new Date(0))} className={btn}>Exporter</a>}
        {scope.canConfigure && (
          <MenuDossier>
            <span className="px-2.5 pt-1 text-xs font-medium text-muted-foreground">Réglages</span>
            <MenuLien href="/planning/business-units">Business units</MenuLien>
            <MenuLien href="/planning/business-units?etape=secteurs">Secteurs</MenuLien>
            <MenuLien href="/planning/parametres">Paramètres</MenuLien>
          </MenuDossier>
        )}
      </PageHeader>
      <div className="-mt-2 flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
        <Link href={lienFdv(chemin, { ...p, year: prec.y, month: prec.m })} aria-label="Cycle précédent" className="rounded-md p-1.5 hover:bg-secondary"><ChevronLeft className="h-4 w-4" /></Link>
        <span>{libelleCycle(year, month)}{enCours ? ` · jour ${jour} sur ${total}` : ` · ${total} jours ouvrés`}</span>
        <Link href={lienFdv(chemin, { ...p, year: suiv.y, month: suiv.m })} aria-label="Cycle suivant" className="rounded-md p-1.5 hover:bg-secondary"><ChevronRight className="h-4 w-4" /></Link>
      </div>
      {bus.length > 1 && (
        <nav className="no-scrollbar -mx-3 flex gap-1.5 overflow-x-auto px-3 sm:mx-0 sm:flex-wrap sm:px-0" aria-label="Business unit">
          <Chip href={lienFdv(chemin, { ...p, buId: null })} actif={!buId}>Toutes les BU</Chip>
          {bus.map((b) => <Chip key={b.id} href={lienFdv(chemin, { ...p, buId: b.id })} actif={buId === b.id}>{b.nom}</Chip>)}
        </nav>
      )}
      <ModuleTabs tabs={tabs} />
    </div>
  );
}

function Chip({ href, actif, children }: { href: string; actif: boolean; children: React.ReactNode }) {
  return (
    <Link href={href} aria-current={actif ? "page" : undefined}
      className={cn("shrink-0 whitespace-nowrap rounded-full border px-3 py-1 text-[13px]", actif ? "border-primary bg-primary/10 font-medium text-primary" : "border-border text-muted-foreground hover:text-foreground")}>
      {children}
    </Link>
  );
}

function MenuLien({ href, children }: { href: string; children: React.ReactNode }) {
  return <Link href={href} role="menuitem" className="rounded-md px-2.5 py-2 text-sm hover:bg-secondary">{children}</Link>;
}
