"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteFieldReport } from "@/lib/actions/field-report-actions";
import { ConfirmationSuppression } from "@/components/shared/super-admin-delete";
import { useRafraichir } from "@/components/shared/use-rafraichir";
import { Button } from "@/components/ui/button";

/**
 * SUPPRIMER UN RAPPORT TERRAIN depuis la liste ou la fiche (§118.212) — par la fenêtre de
 * confirmation commune, et la corbeille.
 *
 * DOUBLE CONFIRMATION, deux étapes que rien ne contourne :
 *   1. l'icône ouvre la fenêtre, qui lit AVANT le clic ce qui part avec le rapport (ses pièces
 *      jointes) et ce qui l'interdit (du matériel remis au stock, une visite dont il est le seul
 *      rapport) — un refus désarme le bouton, jamais un geste offert puis retiré (§118.83) ;
 *   2. « Oui, supprimer » est un bouton décisif : un premier clic l'ARME (« Confirmer : … ? »), seul
 *      le second clic dans les cinq secondes supprime. Aucune fenêtre modale du navigateur.
 *
 * La suppression est RÉVERSIBLE : le rapport et ses pièces vont à la corbeille d'Administration, d'où
 * le Super Admin les restaure intacts. Le serveur revérifie le droit ET relit ce qui part — l'icône
 * n'est qu'une commodité (n'est rendue que si `enabled`).
 *
 * `enCours` ferme le geste pendant que la liste se rafraîchit : une ligne qui vient de partir ne doit
 * pas rester cliquable sur l'état d'avant (§118.172).
 */
export function SupprimerRapport({
  id,
  name,
  enabled,
  versLaListe = false,
  libelle = "Supprimer ce rapport",
  compact = true,
}: {
  id: string;
  /** Le nom lisible, montré dans la fenêtre (« Rapport — Amine Djouamai · 05 oct. »). */
  name: string;
  enabled: boolean;
  /** Fiche : après suppression, retour à la liste (elle n'existe plus). Liste : rester, se rafraîchir. */
  versLaListe?: boolean;
  libelle?: string;
  /** Icône seule (rangée de liste) ou bouton avec texte (en-tête de fiche). */
  compact?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const { enCours, rafraichir } = useRafraichir();
  if (!enabled) return null;

  return (
    <>
      {compact ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={enCours}
          title={libelle}
          aria-label={`${libelle} — ${name}`}
          data-testid="supprimer-rapport"
          className="shrink-0 rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      ) : (
        <Button variant="outline" size="sm" onClick={() => setOpen(true)} disabled={enCours} data-testid="supprimer-rapport" className="text-destructive hover:bg-destructive/10">
          <Trash2 className="h-4 w-4" /> {libelle}
        </Button>
      )}
      <ConfirmationSuppression
        open={open}
        onClose={() => setOpen(false)}
        kind="FIELD_REPORT"
        id={id}
        name={name}
        executer={deleteFieldReport}
        onSupprime={(r) => {
          setOpen(false);
          if (versLaListe) router.push(r.redirect ?? "/field-reports");
          rafraichir();
        }}
      />
    </>
  );
}
