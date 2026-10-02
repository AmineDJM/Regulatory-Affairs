"use client";

import * as React from "react";
import { Link2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRafraichir } from "@/components/shared/use-rafraichir";
import { rattacherDossierCanonique } from "@/lib/actions/produit-canonique-actions";

/**
 * RATTACHER UN DOSSIER À SON PRODUIT CANONIQUE — un clic, sur un dossier dont l'identité est
 * complète. Le résultat se DIT (« Produit PRD-2026-012 créé », ou ce qui manque) : un bouton qui
 * se contente de disparaître laisserait deviner ce qu'il a fait.
 */
export function RattacherDossierBouton({ dossierId, compact = false }: { dossierId: string; compact?: boolean }) {
  const { enCours, rafraichir } = useRafraichir();
  const [envoi, setEnvoi] = React.useState(false);
  const [retour, setRetour] = React.useState<{ ok: boolean; texte: string } | null>(null);

  async function rattacher() {
    setEnvoi(true); setRetour(null);
    const fd = new FormData();
    fd.set("id", dossierId);
    const r = await rattacherDossierCanonique(fd);
    setEnvoi(false);
    setRetour({ ok: r.ok, texte: r.ok ? r.message ?? "Rattaché." : r.error ?? "Rattachement impossible." });
    if (r.ok) rafraichir();
  }

  const occupe = envoi || enCours;
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Button size="sm" variant="outline" disabled={occupe} onClick={rattacher}>
        {occupe ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
        {compact ? "Rattacher" : "Rattacher au produit"}
      </Button>
      {retour && (
        <span role={retour.ok ? "status" : "alert"} className={retour.ok ? "text-xs text-success" : "text-xs text-destructive"}>
          {retour.texte}
        </span>
      )}
    </span>
  );
}
