"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, Check, Loader2, Pencil, Plus, Stethoscope, Trash2, X } from "lucide-react";
import { SANS_SPECIALITE, type AnnuaireSpecialite } from "@/lib/annuaires/par-specialite";
import { createSpecialty, updateSpecialty, deleteSpecialty } from "@/lib/actions/medical-actions";
import { BoutonDecisif } from "@/components/ui/bouton-decisif";
import { cn } from "@/lib/utils";
import { useRafraichir } from "@/components/shared/use-rafraichir";

/**
 * UN ANNUAIRE PAR SPÉCIALITÉ + la vue « Archivés » — et, pour qui gère le référentiel, la GESTION des spécialités
 * sur place : ajouter, renommer, supprimer (Direction, 06/10). Les mêmes actions que Annuaires › Spécialités et le
 * Marketing cockpit (`createSpecialty`, `updateSpecialty`, `deleteSpecialty`, gardées par `peutGererSpecialites`) :
 * un geste offert ici est un geste que l'action accepte, et un refus (spécialité visée par une Business Unit…) se dit.
 *
 * L'état de la vue vit dans l'adresse (`?specialite=`, `?archives=1`) : une vue se partage et se retrouve.
 */
export function BarreSpecialites({
  basePath, annuaire, specialites, sansSpecialite, ouverte, archives, archivesCount, avecSpecialites, gerer,
}: {
  basePath: string;
  annuaire: string | null;
  specialites: AnnuaireSpecialite[];
  sansSpecialite: number;
  ouverte: string | null;
  archives: boolean;
  archivesCount: number;
  /** Médecins seulement : les pharmaciens n'ont pas d'annuaire par spécialité. */
  avecSpecialites: boolean;
  /** Les gestes sur le référentiel des spécialités ; absent : lecture seule. */
  gerer?: { creer: boolean; modifier: boolean; supprimer: boolean };
}) {
  const router = useRouter();
  const { rafraichir } = useRafraichir();
  const [enCours, setEnCours] = React.useState<string | null>(null);
  const [erreur, setErreur] = React.useState<string | null>(null);
  const [ajout, setAjout] = React.useState<string | null>(null);
  const [edition, setEdition] = React.useState<{ id: string; nom: string } | null>(null);

  const lien = (p: { specialite?: string | null; archives?: boolean }) => {
    const q = new URLSearchParams();
    if (annuaire) q.set("annuaire", annuaire);
    if (p.specialite) q.set("specialite", p.specialite);
    if (p.archives) q.set("archives", "1");
    const s = q.toString();
    return s ? `${basePath}?${s}` : basePath;
  };
  const pastille = (actif: boolean) =>
    cn(
      "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm transition-colors",
      actif ? "border-primary bg-primary/5 font-medium text-primary" : "border-border hover:bg-secondary",
    );

  const agir = async (cle: string, faire: () => Promise<{ ok: boolean; error?: string }>, apres?: () => void) => {
    setEnCours(cle); setErreur(null);
    try {
      const r = await faire();
      if (!r.ok) { setErreur(r.error ?? "Action refusée."); return; }
      apres?.();
      rafraichir();
    } finally {
      setEnCours(null);
    }
  };
  const fd = (o: Record<string, string>) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) f.set(k, v); return f; };

  return (
    <section className="surface space-y-3 p-3 sm:p-4" aria-label="Spécialités et archives">
      {avecSpecialites && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Stethoscope className="h-4 w-4 text-primary" /> Par spécialité
            </h2>
            {gerer?.creer && ajout === null && (
              <button type="button" onClick={() => { setErreur(null); setAjout(""); }} className="ml-auto inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs font-medium hover:bg-secondary">
                <Plus className="h-3.5 w-3.5" /> Nouvelle spécialité
              </button>
            )}
          </div>

          {ajout !== null && (
            <form
              className="flex flex-wrap items-center gap-2"
              onSubmit={(e) => { e.preventDefault(); void agir("ajout", () => createSpecialty(fd({ name: ajout })), () => setAjout(null)); }}
            >
              <input
                autoFocus value={ajout} onChange={(e) => setAjout(e.target.value)} placeholder="Nom de la spécialité (ex. Néphrologie)"
                className="min-w-0 flex-1 rounded-lg border border-input bg-background px-2.5 py-1.5 text-sm focus-ring sm:max-w-xs" aria-label="Nom de la nouvelle spécialité"
              />
              <button type="submit" disabled={!ajout.trim() || enCours === "ajout"} className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50">
                {enCours === "ajout" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Ajouter
              </button>
              <button type="button" onClick={() => setAjout(null)} className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-muted-foreground hover:bg-secondary">
                <X className="h-3.5 w-3.5" /> Annuler
              </button>
            </form>
          )}

          <div className="flex flex-wrap gap-2">
            <Link href={lien({ archives })} className={pastille(!ouverte)}>Toutes les spécialités</Link>
            {specialites.map((s) => edition?.id === s.id ? (
              <form
                key={s.id} className="inline-flex items-center gap-1"
                onSubmit={(e) => { e.preventDefault(); void agir(`maj:${s.id}`, () => updateSpecialty(fd({ id: s.id, name: edition.nom })), () => setEdition(null)); }}
              >
                <input
                  autoFocus value={edition.nom} onChange={(e) => setEdition({ id: s.id, nom: e.target.value })}
                  className="w-44 rounded-lg border border-input bg-background px-2 py-1 text-sm focus-ring" aria-label={`Nouveau nom de ${s.name}`}
                />
                <button type="submit" disabled={!edition.nom.trim() || enCours === `maj:${s.id}`} className="rounded p-1 text-success hover:bg-success/10 disabled:opacity-50" title="Enregistrer">
                  {enCours === `maj:${s.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                </button>
                <button type="button" onClick={() => setEdition(null)} className="rounded p-1 text-muted-foreground hover:bg-secondary" title="Annuler"><X className="h-3.5 w-3.5" /></button>
              </form>
            ) : (
              <span key={s.id} className={cn("group", pastille(ouverte === s.id), "gap-1")}>
                <Link href={lien({ specialite: s.id, archives })} className="inline-flex min-w-0 items-center gap-1.5" data-specialite={s.id}>
                  <span className="truncate">{s.name}</span>
                  <span className="text-xs text-muted-foreground">({s.count})</span>
                </Link>
                {gerer?.modifier && (
                  <button type="button" onClick={() => { setErreur(null); setEdition({ id: s.id, nom: s.name }); }} className="rounded p-0.5 text-muted-foreground hover:text-foreground" title={`Renommer ${s.name}`} aria-label={`Renommer ${s.name}`}>
                    <Pencil className="h-3 w-3" />
                  </button>
                )}
                {gerer?.supprimer && (
                  <BoutonDecisif
                    brut type="button" disabled={enCours !== null}
                    confirmation={`Supprimer la spécialité « ${s.name} » ? ${s.count > 0 ? `Ses ${s.count} médecin(s) gardent leur spécialité écrite.` : ""}`}
                    onClick={() => void agir(`sup:${s.id}`, () => deleteSpecialty(fd({ id: s.id })), () => { if (ouverte === s.id) router.push(lien({ archives })); })}
                    className="rounded p-0.5 text-muted-foreground hover:text-destructive" aria-label={`Supprimer ${s.name}`}
                  >
                    {enCours === `sup:${s.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                  </BoutonDecisif>
                )}
              </span>
            ))}
            {sansSpecialite > 0 && (
              <Link href={lien({ specialite: SANS_SPECIALITE, archives })} className={pastille(ouverte === SANS_SPECIALITE)}>
                Sans spécialité <span className="text-xs text-muted-foreground">({sansSpecialite})</span>
              </Link>
            )}
          </div>
          {erreur && <p className="text-xs text-destructive" role="alert">{erreur}</p>}
        </>
      )}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Link href={lien({ specialite: ouverte })} className={pastille(!archives)}>Actifs</Link>
        <Link href={lien({ specialite: ouverte, archives: true })} className={pastille(archives)} data-vue="archives">
          <Archive className="h-3.5 w-3.5" /> Archivés <span className="text-xs text-muted-foreground">({archivesCount})</span>
        </Link>
        {archives && (
          <span className="text-xs text-muted-foreground">
            Fiches archivées : elles ne figurent ni dans la feuille, ni dans l&apos;export, ni dans la recherche. Sélectionnez-les pour les restaurer.
          </span>
        )}
      </div>
    </section>
  );
}
