"use client";

import * as React from "react";
import Link from "next/link";
import { Plane, Plus, Pencil, Trash2, Send, Loader2, ExternalLink, X, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DocumentUpload } from "@/components/documents/document-upload";
import { DocumentPreview } from "@/components/documents/document-preview";
import { ajouterVoyageur, modifierVoyageur, retirerVoyageur, demanderReservation } from "@/lib/actions/ad-pro-item-actions";
import { manquesPourReserver, jourLisible } from "@/lib/ad-pro/voyageurs";

/** Un voyageur tel que l'écran le montre — les dates en AAAA-MM-JJ, prêtes pour un champ « date ». */
export interface VoyageurVue {
  id: string;
  nom: string;
  villeDepart: string | null;
  villeArrivee: string | null;
  dateDepart: string | null;
  dateRetour: string | null;
  notes: string | null;
  /** Le ou les passeports déposés pour lui (pièces du poste dont `stepKey` est son identifiant). */
  passeports: { id: string; name: string; hasFile: boolean }[];
}

type Run = (key: string, fn: () => Promise<{ ok: boolean; error?: string; message?: string }>, okText: string) => Promise<void>;

const jour = (iso: string | null) => (iso ? new Date(`${iso}T00:00:00.000Z`) : null);

/**
 * LES VOYAGEURS D'UN POSTE « BILLETTERIE » (§118.175).
 *
 * « Sélectionner à chaque fois le nom de la personne, la date de départ, de retour, téléverser le
 * passeport — avec de la flexibilité. » Un voyageur s'enregistre avec son nom seul ; ce qui manque
 * pour réserver est NOMMÉ sur sa ligne au lieu de bloquer. La réservation part à l'assistante de
 * direction dans un sujet ; toute modification ultérieure s'y écrit d'elle-même.
 *
 * Les noms proposés à la saisie sont ceux que la demande porte déjà (médecins concernés, personnes
 * prises en charge) : une liste de suggestions, jamais un choix imposé — et jamais un rattachement
 * deviné à une fiche de l'annuaire (§118.85).
 */
export function BlocVoyageurs({
  itemId, voyageurs, nomsSuggeres, reservation, peutEditer, peutReserver, busy, run,
}: {
  itemId: string;
  voyageurs: VoyageurVue[];
  nomsSuggeres: string[];
  reservation: { id: string; reference: string } | null;
  peutEditer: boolean;
  /** Le poste n'est pas refusé — l'action le revérifie. */
  peutReserver: boolean;
  /** Une action en cours, ou l'écran qui se met à jour : les formulaires ne s'ouvrent pas sur un état périmé (§118.172). */
  busy: string | null;
  run: Run;
}) {
  const [ajout, setAjout] = React.useState(false);
  const [edition, setEdition] = React.useState<string | null>(null);
  const [passeportPour, setPasseportPour] = React.useState<string | null>(null);
  const listeId = `noms-${itemId}`;

  return (
    <div className="space-y-2 rounded-lg border border-border bg-background p-2.5 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <Plane className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="font-medium text-foreground">Voyageurs ({voyageurs.length})</span>
        {reservation && (
          <Link href={`/dossiers/${reservation.id}`} className="inline-flex items-center gap-1 text-primary hover:underline">
            Réservation : sujet {reservation.reference} <ExternalLink className="h-3 w-3" />
          </Link>
        )}
      </div>

      {nomsSuggeres.length > 0 && (
        <datalist id={listeId}>
          {nomsSuggeres.map((n) => <option key={n} value={n} />)}
        </datalist>
      )}

      {voyageurs.length === 0 ? (
        <p className="text-muted-foreground">
          Aucun voyageur. Son nom suffit pour commencer — les dates, le trajet et le passeport peuvent venir plus tard.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {voyageurs.map((v) => {
            const manque = manquesPourReserver({
              nom: v.nom, villeDepart: v.villeDepart, villeArrivee: v.villeArrivee,
              dateDepart: jour(v.dateDepart), dateRetour: jour(v.dateRetour), passeport: v.passeports.length > 0, notes: v.notes,
            });
            return (
              <li key={v.id} className="space-y-1.5 py-2">
                <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
                  <span className="font-medium text-foreground">{v.nom}</span>
                  <span className="text-muted-foreground">
                    {v.villeDepart || v.villeArrivee ? `${v.villeDepart ?? "?"} → ${v.villeArrivee ?? "?"}` : "trajet à confirmer"}
                    {" · "}aller {jourLisible(jour(v.dateDepart))}, retour {jourLisible(jour(v.dateRetour))}
                  </span>
                  {manque.length === 0
                    ? <span className="inline-flex items-center gap-1 text-success"><CheckCircle2 className="h-3 w-3" /> prêt à réserver</span>
                    : <span className="text-warning">manque : {manque.join(", ")}</span>}
                  {peutEditer && (
                    <span className="ml-auto inline-flex gap-1">
                      <button
                        type="button" onClick={() => setEdition(edition === v.id ? null : v.id)} disabled={busy !== null && edition !== v.id}
                        className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-muted-foreground hover:bg-secondary"
                        aria-label={`Modifier le voyageur ${v.nom}`}
                      >
                        {edition === v.id ? <X className="h-3 w-3" /> : <Pencil className="h-3 w-3" />}
                      </button>
                      <button
                        type="button" disabled={busy !== null}
                        onClick={() => {
                          if (!window.confirm(`Retirer ${v.nom} des voyageurs ?`)) return;
                          const fd = new FormData();
                          fd.set("id", v.id);
                          void run(`vdel:${v.id}`, () => retirerVoyageur(fd), "Voyageur retiré.");
                        }}
                        className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        aria-label={`Retirer le voyageur ${v.nom}`}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </span>
                  )}
                </div>
                {v.notes && <p className="text-muted-foreground">{v.notes}</p>}
                {v.passeports.length > 0 && (
                  <div className="space-y-0.5">
                    {v.passeports.map((p) => <DocumentPreview key={p.id} id={p.id} name={p.name} hasFile={p.hasFile} />)}
                  </div>
                )}
                {/* LE PASSEPORT : une pièce du POSTE, désignée par le voyageur (`stepKey`). Le même
                    téléverseur, les mêmes droits et la même corbeille que toute pièce du poste. */}
                {peutEditer && (
                  passeportPour === v.id ? (
                    <div className="rounded-lg border border-border p-2">
                      <p className="mb-1 text-[0.6875rem] text-muted-foreground">Passeport (ou pièce d&apos;identité) de {v.nom}</p>
                      <DocumentUpload entityType="AD_PRO_ITEM" entityId={itemId} categories={["ID_DOCUMENT"]} stepKey={v.id} compact />
                      <button type="button" onClick={() => setPasseportPour(null)} className="mt-1 text-[0.6875rem] text-muted-foreground hover:text-foreground">Fermer</button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => setPasseportPour(v.id)} className="text-[0.6875rem] font-medium text-primary hover:underline">
                      {v.passeports.length > 0 ? "Joindre un autre fichier" : "Joindre le passeport"}
                    </button>
                  )
                )}
                {edition === v.id && peutEditer && (
                  <div className="rounded-lg border border-primary/30 bg-primary/5 p-2">
                    <FormulaireVoyageur
                      listeId={nomsSuggeres.length > 0 ? listeId : undefined}
                      defaut={v}
                      busy={busy === `vmod:${v.id}`}
                      libelle="Enregistrer"
                      onSubmit={(fd) => {
                        fd.set("id", v.id);
                        void run(`vmod:${v.id}`, () => modifierVoyageur(undefined, fd), "Voyageur modifié.").then(() => setEdition(null));
                      }}
                      onCancel={() => setEdition(null)}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {peutEditer && (
        ajout ? (
          <div className="rounded-lg border border-border p-2">
            <FormulaireVoyageur
              listeId={nomsSuggeres.length > 0 ? listeId : undefined}
              busy={busy === `vadd:${itemId}`}
              libelle="Ajouter le voyageur"
              onSubmit={(fd) => {
                fd.set("itemId", itemId);
                void run(`vadd:${itemId}`, () => ajouterVoyageur(undefined, fd), "Voyageur ajouté.").then(() => setAjout(false));
              }}
              onCancel={() => setAjout(false)}
            />
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setAjout(true)} disabled={busy !== null}>
              <Plus className="h-4 w-4" /> Ajouter un voyageur
            </Button>
            {voyageurs.length > 0 && peutReserver && (
              <Button
                size="sm" disabled={busy !== null}
                onClick={() => {
                  const fd = new FormData();
                  fd.set("id", itemId);
                  void run(`resa:${itemId}`, () => demanderReservation(fd), "Demande de réservation envoyée.");
                }}
              >
                {busy === `resa:${itemId}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {reservation ? "Mettre à jour la réservation" : "Demander la réservation"}
              </Button>
            )}
          </div>
        )
      )}
      {peutEditer && voyageurs.length > 0 && (
        <p className="text-[0.6875rem] text-muted-foreground">
          La demande part à l&apos;assistante de direction dans un sujet. Changer une date ensuite l&apos;y écrit d&apos;elle-même.
        </p>
      )}
    </div>
  );
}

function FormulaireVoyageur({ listeId, defaut, busy, libelle, onSubmit, onCancel }: {
  listeId?: string;
  defaut?: VoyageurVue;
  busy: boolean;
  libelle: string;
  onSubmit: (fd: FormData) => void;
  onCancel: () => void;
}) {
  const champ = "mt-1 w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-primary/60";
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(new FormData(e.currentTarget)); }} className="space-y-2">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label className="text-xs sm:col-span-2">
          Nom de la personne
          <input name="nom" required list={listeId} defaultValue={defaut?.nom ?? ""} placeholder="Dr Amel Haddad" className={champ} />
        </label>
        <label className="text-xs">
          Ville de départ
          <input name="villeDepart" defaultValue={defaut?.villeDepart ?? ""} placeholder="Alger" className={champ} />
        </label>
        <label className="text-xs">
          Destination
          <input name="villeArrivee" defaultValue={defaut?.villeArrivee ?? ""} placeholder="Paris" className={champ} />
        </label>
        <label className="text-xs">
          Date de départ (facultative)
          <input name="dateDepart" type="date" defaultValue={defaut?.dateDepart ?? ""} className={champ} />
        </label>
        <label className="text-xs">
          Date de retour (facultative)
          <input name="dateRetour" type="date" defaultValue={defaut?.dateRetour ?? ""} className={champ} />
        </label>
        <label className="text-xs sm:col-span-2">
          Précisions
          <input name="notes" defaultValue={defaut?.notes ?? ""} placeholder="Classe, horaires souhaités, contraintes…" className={champ} />
        </label>
      </div>
      <div className="flex gap-2">
        <Button size="sm" type="submit" disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} {libelle}
        </Button>
        <Button size="sm" type="button" variant="outline" onClick={onCancel}>Annuler</Button>
      </div>
    </form>
  );
}
