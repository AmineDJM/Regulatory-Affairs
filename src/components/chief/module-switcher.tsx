"use client";

import * as React from "react";
import Link from "next/link";
import { Grid2x2, X, Search } from "lucide-react";
import type { Destination } from "@/platform/contract";

/**
 * LA PORTE DE SORTIE D'ADAM.
 *
 * POURQUOI ELLE EXISTE. Le groupe de routes `(chief)` retire délibérément les neuf éléments de
 * chrome de l'ERP — menu latéral, barre supérieure, barre d'onglets, palette, bandeaux. C'est ce
 * qui fait qu'entrer chez Adam ressemble à entrer dans son bureau, et non à ouvrir un onglet de
 * plus. Mais un bureau sans porte n'est pas un bureau : il n'y avait plus AUCUN bouton pour
 * revenir dans un module, et l'on en sortait par le bouton « précédent » du navigateur.
 *
 * CE QU'ELLE N'EST PAS. Pas un menu latéral qui revient par la fenêtre. Elle est repliée
 * derrière une icône, elle s'ouvre sur un geste, elle se referme dès qu'on a choisi. Le reste
 * du temps, elle occupe 44 px dans un coin.
 *
 * LES DESTINATIONS VIENNENT DU SERVEUR, filtrées par les droits, les masquages d'administration
 * et les gardes (`lib/nav-access`, servi par le contrat de plateforme). Adam n'invente pas la
 * liste et n'en cache aucune par du CSS : une porte affichée est une porte qui s'ouvre.
 */
export function ModuleSwitcher({ destinations }: { destinations: readonly Destination[] }) {
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const panel = React.useRef<HTMLDivElement>(null);
  const searchRef = React.useRef<HTMLInputElement>(null);

  // Échap referme, et un clic hors du panneau aussi — les deux réflexes d'une couche flottante.
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    const onDown = (e: MouseEvent) => {
      if (panel.current && !panel.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("mousedown", onDown); };
  }, [open]);

  // Le champ prend le focus À L'OUVERTURE : on cherche un module en le tapant, sans viser.
  React.useEffect(() => { if (open) searchRef.current?.focus(); }, [open]);

  // « regulatory » doit trouver « Regulatory », et « reserves » doit trouver « Réserves » :
  // on replie les accents des DEUX côtés de la comparaison.
  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const needle = norm(q.trim());
  const matching = needle ? destinations.filter((d) => norm(d.label).includes(needle)) : destinations;

  // LE RANGEMENT DE L'ERP EST REPRIS TEL QUEL — pôle d'entreprise quand il y en a un, groupe de
  // menu sinon. En inventer un second obligerait à apprendre deux classements pour les mêmes
  // modules ; l'ordre d'arrivée est celui de la navigation, donc celui du menu.
  const sections = React.useMemo(() => {
    const out: { title: string; items: Destination[] }[] = [];
    for (const d of matching) {
      const title = POLE_LABELS[d.pole ?? ""] ?? d.group;
      const last = out.find((s) => s.title === title);
      if (last) last.items.push(d);
      else out.push({ title, items: [d] });
    }
    return out;
  }, [matching]);

  return (
    <div className="relative" ref={panel}>
      <button
        type="button"
        onClick={() => { setOpen((v) => !v); setQ(""); }}
        className="chief-icon-btn"
        aria-label="Aller dans un module"
        aria-expanded={open}
        title="Aller dans un module"
      >
        {open ? <X className="h-[18px] w-[18px]" aria-hidden /> : <Grid2x2 className="h-[18px] w-[18px]" aria-hidden />}
      </button>

      {open && (
        <div
          className="chief-panel-enter absolute right-0 top-[calc(100%+6px)] z-50 max-h-[70vh] w-[min(22rem,calc(100vw-1.5rem))] overflow-y-auto p-2"
          style={{
            backgroundColor: "hsl(var(--chief-surface-elevated))",
            border: "1px solid hsl(var(--chief-border))",
            borderRadius: "var(--chief-radius-card)",
            boxShadow: "var(--chief-shadow-lg)",
          }}
          role="dialog"
          aria-label="Modules accessibles"
        >
          <div
            className="mb-1.5 flex items-center gap-2 rounded-[12px] px-2.5"
            style={{ backgroundColor: "hsl(var(--chief-surface-sunken))" }}
          >
            <Search className="h-4 w-4 shrink-0" style={{ color: "hsl(var(--chief-text-tertiary))" }} aria-hidden />
            <input
              ref={searchRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Aller à…"
              aria-label="Filtrer les modules"
              className="h-9 w-full bg-transparent text-[14px] outline-none"
              style={{ color: "hsl(var(--chief-text))" }}
            />
          </div>

          {sections.length === 0 && (
            <p className="px-2.5 py-3 text-[13px]" style={{ color: "hsl(var(--chief-text-tertiary))" }}>
              Aucun module ne porte ce nom.
            </p>
          )}

          {sections.map((s) => (
            <div key={s.title} className="mb-1 last:mb-0">
              <p
                className="px-2.5 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[0.04em]"
                style={{ color: "hsl(var(--chief-text-tertiary))" }}
              >
                {s.title}
              </p>
              {s.items.map((d) => (
                <Link
                  key={`${d.module}-${d.href}`}
                  href={d.href}
                  onClick={() => setOpen(false)}
                  className="block truncate rounded-[10px] px-2.5 py-2 text-[14px] transition-colors hover:bg-[hsl(var(--chief-surface-sunken))]"
                  style={{ color: "hsl(var(--chief-text))" }}
                >
                  {d.label}
                </Link>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Les pôles portent un code (`SALES_MARKETING`) ; leur libellé vit dans le menu de l'ERP, que
 * cette couche ne peut pas importer. Six lignes, et une valeur inconnue retombe sur le groupe —
 * un intitulé sans traduction ne fait donc pas disparaître ses modules.
 */
const POLE_LABELS: Record<string, string> = {
  REGULATORY: "Regulatory",
  ADMINISTRATION: "Administration",
  SALES_MARKETING: "Ventes & Marketing",
  BUSINESS_DEV: "Business Development",
  SUPPLY_CHAIN: "Supply Chain",
};
