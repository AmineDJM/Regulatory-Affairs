"use client";

import * as React from "react";
import { Building2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { LienCouverture } from "@/lib/annuaires/services";

/**
 * LE CHOIX DES ÉTABLISSEMENTS D'UN TERRITOIRE — et, pour chacun, tous ses services ou certains
 * (§118.172). Déplacé de l'ancienne section « Secteurs de la BU » (retirée le 04/10/2026) : le
 * territoire d'un KAM se choisit désormais sur SA ligne, avec exactement le même choix.
 *
 * ── LA SÉLECTION EST CONTRÔLÉE ──────────────────────────────────────────────────────────────
 *
 * Elle naît de la couverture enregistrée à l'ouverture du panneau ; c'est ELLE, et non ce que le
 * filtre laisse voir, qui part avec le formulaire. La version d'avant ne montait que les lignes
 * filtrées, et enregistrer après avoir filtré RETIRAIT ce qu'on ne voyait plus (§118.172).
 */

export const inputCls = "h-10 rounded-lg border border-input bg-background px-2 text-sm focus:border-primary focus:outline-none sm:h-9";

/** Un établissement à cocher — avec sa wilaya, son état et ses services (§118.172). */
export interface EtabOpt {
  id: string; name: string; wilaya: string | null; type: string; isActive: boolean;
  services: { id: string; name: string }[];
}

/** Par établissement coché : tous ses services, ou ceux choisis. */
export type ChoixEtab = Map<string, { tous: boolean; services: Set<string> }>;

/** Le choix tel qu'il est enregistré — l'état d'ouverture du panneau. */
export function choixDepuisLiens(liens: LienCouverture[]): ChoixEtab {
  const m: ChoixEtab = new Map();
  for (const l of liens) m.set(l.institutionId, { tous: l.tousLesServices, services: new Set(l.serviceIds) });
  return m;
}

/**
 * LE FORMULAIRE QUE L'ACTION LIT : la liste COMPLÈTE des établissements (décocher retire), et la
 * couverture des établissements restreints — un établissement absent de la couverture les couvre
 * tous. La couverture part TOUJOURS : l'écran dit tout ce qu'il a choisi.
 */
export function remplirFormulaire(fd: FormData, choix: ChoixEtab): void {
  fd.delete("institutionIds");
  for (const id of choix.keys()) fd.append("institutionIds", id);
  const couverture: Record<string, string[]> = {};
  for (const [id, c] of choix) if (!c.tous) couverture[id] = [...c.services];
  fd.set("couverture", JSON.stringify(couverture));
}

/** Les établissements cochés « certains services » sans aucun service : l'action les refuse. */
export function etablissementsSansService(choix: ChoixEtab): string[] {
  return [...choix.entries()].filter(([, c]) => !c.tous && c.services.size === 0).map(([id]) => id);
}

export function ChoixEtablissements({ etablissements, choix, onChange }: {
  etablissements: EtabOpt[];
  choix: ChoixEtab;
  onChange: (m: ChoixEtab) => void;
}) {
  const [filtre, setFiltre] = React.useState("");
  const parId = React.useMemo(() => new Map(etablissements.map((e) => [e.id, e])), [etablissements]);
  const nomEtab = (id: string) => parId.get(id)?.name ?? "(établissement retiré de l'annuaire)";

  const changer = (f: (n: ChoixEtab) => void) => { const n: ChoixEtab = new Map(choix); f(n); onChange(n); };
  const basculerEtab = (id: string, on: boolean) => changer((n) => {
    if (on) n.set(id, choix.get(id) ?? { tous: true, services: new Set() }); else n.delete(id);
  });
  const basculerTous = (id: string, tous: boolean) => changer((n) => {
    const avant = choix.get(id) ?? { tous: true, services: new Set<string>() };
    n.set(id, { tous, services: new Set(avant.services) });
  });
  const basculerService = (id: string, serviceId: string, on: boolean) => changer((n) => {
    const avant = choix.get(id) ?? { tous: false, services: new Set<string>() };
    const services = new Set(avant.services);
    if (on) services.add(serviceId); else services.delete(serviceId);
    n.set(id, { tous: false, services });
  });

  const cle = filtre.trim().toLowerCase();
  const correspond = (e: EtabOpt) => !cle || `${e.name} ${e.wilaya ?? ""}`.toLowerCase().includes(cle);
  // LES DÉSACTIVÉS ne se proposent plus — sauf ceux que le territoire couvre DÉJÀ : les retirer de la
  // liste les retirerait du territoire à l'enregistrement, sans un mot.
  const proposes = etablissements.filter((e) => e.isActive || choix.has(e.id));
  const masques = proposes.filter((e) => !correspond(e)).length;
  const sansService = etablissementsSansService(choix).map(nomEtab);

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Établissements {choix.size > 0 && <span className="normal-case">· {choix.size} coché(s)</span>}
        </p>
        <input
          value={filtre} onChange={(e) => setFiltre(e.target.value)}
          placeholder="Filtrer par nom ou wilaya" className={`${inputCls} w-full sm:w-56`}
          aria-label="Filtrer les établissements"
        />
      </div>
      {/* L'ANNUAIRE VIDE SE DIT, avec le geste qui le remplit — un cadre de cases vide se lit comme
          « il n'y a pas d'hôpitaux », alors que la vérité est « personne n'en a encore saisi ». */}
      {proposes.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
          L&apos;annuaire des établissements est vide : un territoire est une sélection d&apos;hôpitaux, il n&apos;y a
          donc rien à cocher. Ajoutez-les dans <span className="font-medium">Annuaires › Établissements</span>.
        </p>
      ) : (
        <div className="max-h-80 space-y-1 overflow-y-auto rounded-lg border border-border p-2">
          {masques === proposes.length && (
            <p className="px-1 py-2 text-xs text-muted-foreground">Aucun établissement ne correspond à ce filtre.</p>
          )}
          {/* TOUTES LES LIGNES SONT RENDUES, le filtre ne fait que MASQUER. */}
          {proposes.map((e) => {
            const c = choix.get(e.id);
            return (
              <div key={e.id} className={cn("rounded-md px-1 py-1", !correspond(e) && "hidden", c && "bg-primary/5")}>
                <label className="flex min-h-10 items-center gap-2 text-sm sm:min-h-0">
                  <input
                    type="checkbox" checked={Boolean(c)}
                    onChange={(ev) => basculerEtab(e.id, ev.target.checked)}
                    className="h-4 w-4 rounded border-input"
                    aria-label={`Couvrir ${e.name}`}
                  />
                  <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="min-w-0 [overflow-wrap:anywhere] sm:truncate">{e.name}</span>
                  {!e.isActive && <Badge tone="warning" dot={false}>désactivé</Badge>}
                  {e.wilaya && <span className="ml-auto shrink-0 text-xs text-muted-foreground">{e.wilaya}</span>}
                </label>
                {/* LES SERVICES DE CET ÉTABLISSEMENT — tous, ou certains. Un établissement sans service
                    renseigné est couvert en entier : il n'y a rien à choisir. */}
                {c && e.services.length > 0 && (
                  <div className="ml-6 mt-1 space-y-1">
                    <label className="inline-flex min-h-9 items-center gap-1.5 text-xs sm:min-h-0">
                      <input
                        type="checkbox" checked={c.tous}
                        onChange={(ev) => basculerTous(e.id, ev.target.checked)}
                        className="h-3.5 w-3.5 rounded border-input"
                        aria-label={`Tous les services de ${e.name}`}
                      />
                      Tous les services ({e.services.length})
                    </label>
                    {!c.tous && (
                      <div className="flex flex-wrap gap-1.5">
                        {e.services.map((sv) => (
                          <label key={sv.id} className={cn(
                            "inline-flex items-center gap-1 rounded-md border px-2 py-2 text-xs sm:px-1.5 sm:py-0.5",
                            c.services.has(sv.id) ? "border-primary/50 bg-primary/10" : "border-input",
                          )}>
                            <input
                              type="checkbox" checked={c.services.has(sv.id)}
                              onChange={(ev) => basculerService(e.id, sv.id, ev.target.checked)}
                              className="h-3 w-3 rounded border-input"
                              aria-label={`${sv.name} — ${e.name}`}
                            />
                            {sv.name}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {cle && masques > 0 && choix.size > 0 && (
        <p className="text-xs text-muted-foreground">
          Le filtre masque {masques} ligne(s) sans les décocher : la sélection enregistrée reste complète.
        </p>
      )}
      {sansService.length > 0 && (
        <p role="alert" className="rounded-lg bg-warning/10 px-2 py-1.5 text-xs text-warning">
          Aucun service choisi pour {sansService.join(", ")} : cochez au moins un service, ou « Tous les services ».
        </p>
      )}
    </div>
  );
}
