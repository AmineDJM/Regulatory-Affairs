"use client";

import * as React from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { useRafraichir } from "@/components/shared/use-rafraichir";
import { reviserPieceCommerciale } from "@/lib/actions/fabrique-actions";
import { ajouterLignes, LignesEditables, versEcran, type LigneEcran, type LigneRevisable } from "./lignes-editables";

export type { LigneRevisable } from "./lignes-editables";

/**
 * RÉVISER UNE PIÈCE ÉMISE, depuis sa fiche (§118.194 — audit 360°, R15) — un devis ou un bon de commande.
 *
 * La révision produit une NOUVELLE VERSION du même fichier (même numéro) et la fiche suit : montant, partie,
 * échéance. Le formulaire part des valeurs de la version AFFICHÉE, et l'envoie (`versionVue`) : si quelqu'un a
 * révisé la pièce entre-temps, la fabrique refuse au lieu de réécrire par-dessus sa correction.
 *
 * Les lignes se saisissent par l'éditeur commun (`lignes-editables.tsx`), le même que celui de l'avoir.
 */

export function ReviserPieceButton(props: {
  legalDocumentId: string;
  type: "DEVIS" | "BON_DE_COMMANDE";
  numero: string;
  version: number;
  lignes: LigneRevisable[];
  objet: string | null;
  notes: string | null;
  validiteJours: number | null;
  livraison: { adresse: string | null; delai: string | null } | null;
  contact: { nom: string | null; telephone: string | null } | null;
  /**
   * L'ACTION QUI RÉVISE — par défaut celle de la fiche Legal (`reviserPieceCommerciale`, droits Legal). Ad & Pro passe
   * la sienne (`modifierBcDuPoste`) : le demandeur du poste modifie SON bon de commande sans droit d'écriture Legal.
   */
  envoyer?: (fd: FormData) => Promise<{ ok: boolean; error?: string; message?: string }>;
  /** Le motif est-il exigé ? Oui sur la fiche Legal ; facultatif depuis le poste (« modifier en illimité »). */
  motifFacultatif?: boolean;
  libelle?: string;
  /** Un bouton discret (lien) plutôt qu'un bouton plein — la case d'un poste est petite. */
  discret?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const { enCours, rafraichir } = useRafraichir();
  return (
    <>
      {props.discret ? (
        <button type="button" disabled={enCours} onClick={() => setOpen(true)} className="inline-flex items-center gap-1 text-primary hover:underline disabled:opacity-50">
          <RefreshCw className="h-3 w-3" aria-hidden /> {props.libelle ?? "Réviser la pièce"}
        </button>
      ) : (
        <Button type="button" variant="outline" size="sm" disabled={enCours} onClick={() => setOpen(true)}>
          <RefreshCw className="h-4 w-4" aria-hidden /> {props.libelle ?? "Réviser la pièce"}
        </Button>
      )}
      {open && <ReviserPieceSheet {...props} onClose={() => setOpen(false)} onDone={() => { setOpen(false); rafraichir(); }} />}
    </>
  );
}

function ReviserPieceSheet(props: React.ComponentProps<typeof ReviserPieceButton> & { onClose: () => void; onDone: () => void }) {
  const [lignes, setLignes] = React.useState<LigneEcran[]>(() => props.lignes.map(versEcran));
  const [objet, setObjet] = React.useState(props.objet ?? "");
  const [notes, setNotes] = React.useState(props.notes ?? "");
  const [validite, setValidite] = React.useState(props.validiteJours != null ? String(props.validiteJours) : "");
  const [livraisonAdresse, setLivraisonAdresse] = React.useState(props.livraison?.adresse ?? "");
  const [livraisonDelai, setLivraisonDelai] = React.useState(props.livraison?.delai ?? "");
  const [contactNom, setContactNom] = React.useState(props.contact?.nom ?? "");
  const [contactTelephone, setContactTelephone] = React.useState(props.contact?.telephone ?? "");
  const [motif, setMotif] = React.useState("");
  const [erreur, setErreur] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);
  const [envoi, startEnvoi] = React.useTransition();
  const estBC = props.type === "BON_DE_COMMANDE";
  const nature = estBC ? "le bon de commande" : "le devis";

  function envoyer() {
    const fd = new FormData();
    fd.set("legalDocumentId", props.legalDocumentId);
    fd.set("versionVue", String(props.version));
    ajouterLignes(fd, lignes);
    fd.set("objet", objet);
    fd.set("notes", notes);
    if (!estBC) fd.set("validiteJours", validite);
    if (estBC) {
      fd.set("livraisonAdresse", livraisonAdresse);
      fd.set("livraisonDelai", livraisonDelai);
      fd.set("contactNom", contactNom);
      fd.set("contactTelephone", contactTelephone);
    }
    fd.set("motif", motif);
    setErreur(null);
    startEnvoi(async () => {
      const r = props.envoyer ? await props.envoyer(fd) : await reviserPieceCommerciale(undefined, fd);
      if (!r.ok) { setErreur(r.error ?? "La révision n'a pas abouti."); return; }
      setMessage(r.message ?? "Pièce révisée.");
    });
  }

  return (
    <Sheet
      open onClose={message ? props.onDone : props.onClose} width="lg"
      title={`Réviser ${nature} ${props.numero}`}
      description={`Version ${props.version} affichée. La révision produit la version ${props.version + 1} du même fichier, sous le même numéro — le Word, le PDF et la fiche restent d'accord.`}
    >
      {message ? (
        <div className="space-y-3">
          <p className="rounded-lg border border-success/40 bg-success/10 p-3 text-sm" role="status">{message}</p>
          <div className="flex justify-end"><Button type="button" onClick={props.onDone}>Fermer</Button></div>
        </div>
      ) : (
        <div className="space-y-4">
          <LignesEditables lignes={lignes} onChange={setLignes} />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="revision-objet">Objet</Label>
              <Input id="revision-objet" value={objet} onChange={(e) => setObjet(e.target.value)} />
            </div>
            {!estBC && (
              <div className="space-y-1">
                <Label htmlFor="revision-validite">Validité (jours)</Label>
                <Input id="revision-validite" inputMode="numeric" value={validite} onChange={(e) => setValidite(e.target.value)} />
              </div>
            )}
            {estBC && (
              <>
                <div className="space-y-1">
                  <Label htmlFor="revision-livraison">Adresse de livraison</Label>
                  <Input id="revision-livraison" value={livraisonAdresse} onChange={(e) => setLivraisonAdresse(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="revision-delai">Délai de livraison</Label>
                  <Input id="revision-delai" value={livraisonDelai} onChange={(e) => setLivraisonDelai(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="revision-contact">Contact</Label>
                  <Input id="revision-contact" value={contactNom} onChange={(e) => setContactNom(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="revision-telephone">Téléphone du contact</Label>
                  <Input id="revision-telephone" type="tel" inputMode="tel" value={contactTelephone} onChange={(e) => setContactTelephone(e.target.value)} />
                </div>
              </>
            )}
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="revision-notes">Notes</Label>
              <Textarea id="revision-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="revision-motif">Ce qui change dans la pièce{props.motifFacultatif ? " (facultatif)" : ""}</Label>
              <Textarea id="revision-motif" rows={2} value={motif} onChange={(e) => setMotif(e.target.value)}
                placeholder="Quantité ramenée à 80 boîtes à la demande du fournisseur." />
              <p className="text-xs text-muted-foreground">C&apos;est ce que retiendra l&apos;historique de la pièce.</p>
            </div>
          </div>

          {erreur && <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">{erreur}</p>}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" disabled={envoi} onClick={props.onClose}>Annuler</Button>
            <Button type="button" disabled={envoi || (!props.motifFacultatif && motif.trim().length === 0)} onClick={envoyer}>
              {envoi && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} Émettre la version {props.version + 1}
            </Button>
          </div>
        </div>
      )}
    </Sheet>
  );
}
