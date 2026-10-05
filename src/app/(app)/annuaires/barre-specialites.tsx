import Link from "next/link";
import { Archive, Stethoscope } from "lucide-react";
import { SANS_SPECIALITE, type AnnuaireSpecialite } from "@/lib/annuaires/par-specialite";
import { cn } from "@/lib/utils";

/**
 * UN ANNUAIRE PAR SPÉCIALITÉ + la vue « Archivés » — sous la barre des annuaires nommés.
 *
 * Composant SERVEUR, des liens seulement : l'état vit dans l'adresse (`?specialite=`, `?archives=1`),
 * si bien qu'une vue se partage et se retrouve au rechargement. Les autres paramètres (l'annuaire
 * nommé ouvert) sont conservés d'une pastille à l'autre.
 */
export function BarreSpecialites({
  basePath, annuaire, specialites, sansSpecialite, ouverte, archives, archivesCount, avecSpecialites,
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
}) {
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

  return (
    <section className="surface space-y-3 p-3 sm:p-4" aria-label="Spécialités et archives">
      {avecSpecialites && (
        <>
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Stethoscope className="h-4 w-4 text-primary" /> Par spécialité
          </h2>
          <div className="flex flex-wrap gap-2">
            <Link href={lien({ archives })} className={pastille(!ouverte)}>Toutes les spécialités</Link>
            {specialites.map((s) => (
              <Link key={s.id} href={lien({ specialite: s.id, archives })} className={pastille(ouverte === s.id)} data-specialite={s.id}>
                <span className="truncate">{s.name}</span>
                <span className="text-xs text-muted-foreground">({s.count})</span>
              </Link>
            ))}
            {sansSpecialite > 0 && (
              <Link href={lien({ specialite: SANS_SPECIALITE, archives })} className={pastille(ouverte === SANS_SPECIALITE)}>
                Sans spécialité <span className="text-xs text-muted-foreground">({sansSpecialite})</span>
              </Link>
            )}
          </div>
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
