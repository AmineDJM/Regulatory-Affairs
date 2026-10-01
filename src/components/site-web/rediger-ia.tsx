"use client";

import * as React from "react";
import { ChevronDown, Loader2, Sparkles, Undo2 } from "lucide-react";
import { CONSIGNE_MAX, CONSIGNE_MIN, type DisponibiliteRedaction, type ResultatRedaction } from "@/lib/site-web/redaction";
import { Button } from "@/components/ui/button";
import { Label, Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * « RÉDIGER AVEC L'IA » — le panneau commun à l'article et à l'offre (§118.160).
 *
 * Le panneau ne sait rien du contenu : le formulaire lui donne de quoi APPELER (`rediger`) et de
 * quoi APPLIQUER (`appliquer`). Il ne publie rien et n'enregistre rien — il remplit des champs que
 * la personne relit, et il garde le moyen de revenir en arrière (`annuler`), parce qu'un texte
 * remplacé d'un clic doit pouvoir revenir d'un clic.
 *
 * Indisponible (bascule coupée, fournisseur absent), il le DIT avec la raison au lieu d'offrir un
 * bouton qui refuserait après coup (§118.83).
 */
export function RedigerAvecIA<T>({
  disponibilite, exemple, aSaisie, rediger, appliquer, annuler,
}: {
  disponibilite: DisponibiliteRedaction;
  exemple: string;
  /** Le formulaire porte-t-il déjà du texte ? Alors on propose de l'améliorer plutôt que de repartir de zéro. */
  aSaisie: boolean;
  rediger: (consigne: string, partirDuTexte: boolean) => Promise<ResultatRedaction<T>>;
  appliquer: (champs: T) => void;
  /** Rétablit les champs d'avant la rédaction — `null` tant qu'il n'y a rien à rétablir. */
  annuler: (() => void) | null;
}) {
  const [ouvert, setOuvert] = React.useState(false);
  const [consigne, setConsigne] = React.useState("");
  const [partirDuTexte, setPartirDuTexte] = React.useState(true);
  const [enCours, setEnCours] = React.useState(false);
  const [retour, setRetour] = React.useState<{ ok: boolean; texte: string; avertissements: string[] } | null>(null);
  const idPanneau = React.useId();
  const longueur = consigne.trim().length;
  const consignePrete = longueur >= CONSIGNE_MIN && longueur <= CONSIGNE_MAX;

  const lancer = async () => {
    setEnCours(true); setRetour(null);
    let r: ResultatRedaction<T>;
    try { r = await rediger(consigne, aSaisie && partirDuTexte); } catch {
      r = { ok: false, error: "Le serveur n'a pas répondu. Réessayez dans un instant — rien n'a été modifié." };
    }
    setEnCours(false);
    if (!r.ok) { setRetour({ ok: false, texte: r.error, avertissements: [] }); return; }
    appliquer(r.champs);
    setRetour({
      ok: true,
      texte: "Les champs ont été remplis par l'IA. Relisez et corrigez avant d'enregistrer : rien n'est publié tant que vous ne cliquez pas sur « Publier ».",
      avertissements: r.avertissements,
    });
  };

  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5">
      <button
        type="button" aria-expanded={ouvert} aria-controls={idPanneau} onClick={() => setOuvert((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="h-4 w-4 text-primary" /> Rédiger avec l&apos;IA
        </span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", ouvert && "rotate-180")} />
      </button>
      {ouvert && (
        <div id={idPanneau} className="space-y-3 border-t border-primary/20 px-4 py-3">
          {!disponibilite.disponible ? (
            <p className="text-sm text-muted-foreground">{disponibilite.raison ?? "La rédaction par l'IA est indisponible."}</p>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label htmlFor={`${idPanneau}-consigne`}>Que doit dire ce texte ?</Label>
                <Textarea
                  id={`${idPanneau}-consigne`} rows={3} value={consigne} onChange={(e) => setConsigne(e.target.value)}
                  placeholder={exemple} disabled={enCours} maxLength={CONSIGNE_MAX + 200}
                />
                <p className={cn("text-xs", longueur > CONSIGNE_MAX ? "text-destructive" : "text-muted-foreground")}>
                  Le sujet, l&apos;angle, les points à couvrir. L&apos;IA n&apos;invente ni chiffre ni nom : ce qu&apos;elle ne sait pas, elle ne l&apos;écrit pas.
                </p>
              </div>
              {aSaisie && (
                <label className="flex items-start gap-2 text-sm">
                  <input type="checkbox" checked={partirDuTexte} onChange={(e) => setPartirDuTexte(e.target.checked)} disabled={enCours} className="mt-0.5 h-4 w-4" />
                  <span>Partir du texte déjà saisi — l&apos;IA l&apos;améliore au lieu de repartir de zéro.</span>
                </label>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" onClick={() => void lancer()} disabled={enCours || !consignePrete}>
                  {enCours ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  {enCours ? "Rédaction en cours…" : "Rédiger"}
                </Button>
                {annuler && !enCours && (
                  <Button type="button" variant="outline" onClick={() => { annuler(); setRetour(null); }}>
                    <Undo2 className="h-4 w-4" /> Annuler la rédaction
                  </Button>
                )}
                {enCours && <span className="text-xs text-muted-foreground">Cela prend généralement 15 à 40 secondes.</span>}
              </div>
            </>
          )}
          {retour && (
            <div role={retour.ok ? "status" : "alert"} className={cn("space-y-1 text-sm", retour.ok ? "text-success" : "text-destructive")}>
              <p className="whitespace-pre-line">{retour.texte}</p>
              {retour.avertissements.length > 0 && (
                <ul className="list-disc space-y-0.5 pl-5 text-xs text-warning">
                  {retour.avertissements.map((a) => <li key={a}>{a}</li>)}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
