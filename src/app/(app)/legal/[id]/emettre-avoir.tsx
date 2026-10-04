"use client";

import * as React from "react";
import { Loader2, Undo2 } from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label, Textarea } from "@/components/ui/input";
import { useRafraichir } from "@/components/shared/use-rafraichir";
import { emettreAvoir } from "@/lib/actions/fabrique-actions";
import { ajouterLignes, LignesEditables, versEcran, type LigneEcran, type LigneRevisable } from "./lignes-editables";
import { BoutonDecisif } from "@/components/ui/bouton-decisif";

/**
 * ÉMETTRE UN AVOIR, depuis la fiche d'une facture émise (§118.195 — audit 360°, R15).
 *
 * Une facture émise ne se réécrit pas : l'avoir la corrige, en totalité ou en partie, sous son propre numéro. Le
 * panneau part des lignes de la facture — on garde ce qui est crédité (une quantité rendue, un écart de prix sur une
 * ligne ajoutée) —, et le MOTIF est exigé : c'est ce que l'avoir imprime. Le client, la TVA, la remise et les taxes
 * viennent de la facture, et c'est la fabrique qui les reprend ; ce qui reste à créditer est dit en tête, et la
 * fabrique refuse ce qui le dépasse.
 */
export function EmettreAvoirButton(props: { factureId: string; numero: string; reste: string; lignes: LigneRevisable[] }) {
  const [open, setOpen] = React.useState(false);
  const { enCours, rafraichir } = useRafraichir();
  return (
    <>
      <Button type="button" variant="outline" size="sm" disabled={enCours} onClick={() => setOpen(true)}>
        <Undo2 className="h-4 w-4" aria-hidden /> Émettre un avoir
      </Button>
      {open && <EmettreAvoirSheet {...props} onClose={() => setOpen(false)} onDone={() => { setOpen(false); rafraichir(); }} />}
    </>
  );
}

function EmettreAvoirSheet(props: React.ComponentProps<typeof EmettreAvoirButton> & { onClose: () => void; onDone: () => void }) {
  const [lignes, setLignes] = React.useState<LigneEcran[]>(() => props.lignes.map(versEcran));
  const [motif, setMotif] = React.useState("");
  const [erreur, setErreur] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);
  const [envoi, startEnvoi] = React.useTransition();

  function envoyer() {
    const fd = new FormData();
    fd.set("factureId", props.factureId);
    ajouterLignes(fd, lignes);
    fd.set("motif", motif);
    setErreur(null);
    startEnvoi(async () => {
      const r = await emettreAvoir(undefined, fd);
      if (!r.ok) { setErreur(r.error ?? "L'avoir n'a pas été émis."); return; }
      setMessage(r.message ?? "Avoir émis.");
    });
  }

  return (
    <Sheet
      open onClose={message ? props.onDone : props.onClose} width="lg"
      title={`Émettre un avoir sur la facture ${props.numero}`}
      description={`Reste à créditer : ${props.reste}. L'avoir reprend le client, la TVA et les taxes de la facture ; gardez les lignes à créditer, ajustez les quantités ou les prix.`}
    >
      {message ? (
        <div className="space-y-3">
          <p className="rounded-lg border border-success/40 bg-success/10 p-3 text-sm" role="status">{message}</p>
          <div className="flex justify-end"><Button type="button" onClick={props.onDone}>Fermer</Button></div>
        </div>
      ) : (
        <div className="space-y-4">
          <LignesEditables lignes={lignes} onChange={setLignes} />
          <div className="space-y-1">
            <Label htmlFor="avoir-motif">Motif de l&apos;avoir</Label>
            <Textarea id="avoir-motif" rows={2} value={motif} onChange={(e) => setMotif(e.target.value)}
              placeholder="Retour de 20 boîtes endommagées à la livraison." />
            <p className="text-xs text-muted-foreground">Imprimé sur l&apos;avoir, sous la facture d&apos;origine.</p>
          </div>
          {erreur && <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">{erreur}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" disabled={envoi} onClick={props.onClose}>Annuler</Button>
            <BoutonDecisif type="button" disabled={envoi || motif.trim().length === 0} onClick={envoyer}>
              {envoi && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} Émettre l&apos;avoir
            </BoutonDecisif>
          </div>
        </div>
      )}
    </Sheet>
  );
}
