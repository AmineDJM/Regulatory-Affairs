"use client";

import * as React from "react";
import Link from "next/link";
import { Plane, Plus, Send, Loader2, ExternalLink, CheckCircle2, MoreHorizontal, Upload, FileCheck2 } from "lucide-react";
import type { AdProTrajet, AdProTransport } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { DocumentUpload } from "@/components/documents/document-upload";
import { DocumentPreview } from "@/components/documents/document-preview";
import {
  ajouterVoyageur, modifierVoyageur, retirerVoyageur, demanderReservation,
  ajouterDevisVoyageur, validerDevisVoyageur, demanderBCBilletterie,
} from "@/lib/actions/ad-pro-item-actions";
import {
  manquesPourReserver, jourLisible, prochainGesteVoyageur, depassementDevisRetenus,
  TRANSPORTS, TRANSPORT_LIBELLE, TRAJET_LIBELLE,
} from "@/lib/ad-pro/voyageurs";

/** Un devis ou une pro forma déposé pour un voyageur (§118.205) — une pièce du poste, au registre Legal. */
export interface DevisVoyageurVue {
  /** L'identifiant de la pièce au registre (ce que `validerDevisVoyageur` reçoit). */
  id: string;
  titre: string;
  reference: string | null;
  montant: number | null;
  /** La proposition retenue par le demandeur — au plus une par voyageur. */
  retenu: boolean;
  annule: boolean;
  fichier: { id: string; name: string; hasFile: boolean } | null;
}

/** Un voyageur tel que l'écran le montre — les dates en AAAA-MM-JJ, prêtes pour un champ « date ». */
export interface VoyageurVue {
  id: string;
  nom: string;
  villeDepart: string | null;
  villeArrivee: string | null;
  dateDepart: string | null;
  dateRetour: string | null;
  notes: string | null;
  trajet: AdProTrajet;
  transport: AdProTransport | null;
  /** Le ou les passeports déposés pour lui (pièces du poste dont `stepKey` est son identifiant). */
  passeports: { id: string; name: string; hasFile: boolean }[];
  devis: DevisVoyageurVue[];
}

type Run = (key: string, fn: () => Promise<{ ok: boolean; error?: string; message?: string }>, okText: string) => Promise<void>;

const jour = (iso: string | null) => (iso ? new Date(`${iso}T00:00:00.000Z`) : null);
const dzd = (n: number) => `${n.toLocaleString("fr-FR")} DZD`;

/**
 * LES VOYAGEURS D'UN POSTE « BILLETTERIE » (§118.175, §118.205).
 *
 * « Ultra simple » (Direction, 04/10) : par voyageur, UNE ligne compacte — nom, trajet, dates, mode,
 * passeport — et UN seul bouton visible, celui de ce qui manque (passeport, puis devis de l'agence, puis
 * « valider ce devis » ; `prochainGesteVoyageur`). Le reste (modifier, autre devis, changer de devis,
 * remplacer le passeport, retirer) vit dans le menu « ⋯ ». Le BC du poste se demande d'ici dès qu'un devis
 * est retenu ; il suit ensuite la chaîne du poste jusqu'à la facture.
 *
 * Les noms proposés à la saisie sont ceux que la demande porte déjà — des suggestions, jamais un
 * rattachement deviné à une fiche de l'annuaire (§118.85).
 */
export function BlocVoyageurs({
  itemId, voyageurs, nomsSuggeres, reservation, peutEditer, peutReserver, busy, run,
  montantAccorde, bcPossible, assistantes,
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
  /** Le montant accordé par les deux temps de validation — la somme des devis retenus s'y compare, sans le changer. */
  montantAccorde: number | null;
  /** Le poste en est à demander son BC (accordé, budget choisi) — l'action le revérifie. */
  bcPossible: boolean;
  /** Les assistantes de direction actives : plusieurs ⇒ on choisit qui établit le BC (l'action l'exige). */
  assistantes: { id: string; name: string }[];
}) {
  const [ajout, setAjout] = React.useState(false);
  const [ouvert, setOuvert] = React.useState<{ id: string; quoi: "MENU" | "EDITER" | "PASSEPORT" | "DEVIS" | "CHOIX" } | null>(null);
  const [assistanteId, setAssistanteId] = React.useState("");
  const listeId = `noms-${itemId}`;
  const fermer = () => setOuvert(null);
  const basculer = (id: string, quoi: NonNullable<typeof ouvert>["quoi"]) =>
    setOuvert((o) => (o && o.id === id && o.quoi === quoi ? null : { id, quoi }));

  const retenus = voyageurs.flatMap((v) => v.devis.filter((d) => d.retenu && !d.annule));
  const depasse = depassementDevisRetenus(retenus.map((d) => d.montant), montantAccorde);

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
        <p className="text-muted-foreground">Aucun voyageur. Son nom suffit pour commencer — le reste peut venir plus tard.</p>
      ) : (
        <ul className="divide-y divide-border">
          {voyageurs.map((v) => {
            const passeport = v.passeports.length > 0;
            const vivants = v.devis.filter((d) => !d.annule);
            const retenu = vivants.find((d) => d.retenu) ?? null;
            const geste = prochainGesteVoyageur({ passeport, devis: v.devis.map((d) => ({ montant: d.montant, retenu: d.retenu, annule: d.annule })) }, peutEditer);
            const manque = manquesPourReserver({
              nom: v.nom, villeDepart: v.villeDepart, villeArrivee: v.villeArrivee, dateDepart: jour(v.dateDepart),
              dateRetour: jour(v.dateRetour), passeport, notes: v.notes, trajet: v.trajet, transport: v.transport,
            }).filter((m) => m !== "passeport");
            const mode = ouvert?.id === v.id ? ouvert.quoi : null;
            const dates = v.trajet === "ALLER_SIMPLE"
              ? jourLisible(jour(v.dateDepart))
              : `${jourLisible(jour(v.dateDepart))} → ${jourLisible(jour(v.dateRetour))}`;
            return (
              <li key={v.id} className="space-y-1.5 py-2" data-voyageur={v.nom}>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="font-medium text-foreground">{v.nom}</span>
                  <span className="text-muted-foreground">
                    {TRAJET_LIBELLE[v.trajet]}
                    {v.villeDepart || v.villeArrivee ? ` · ${v.villeDepart ?? "?"} → ${v.villeArrivee ?? "?"}` : ""}
                    {` · ${dates}`}
                    {` · ${v.transport ? TRANSPORT_LIBELLE[v.transport] : "mode à préciser"}`}
                  </span>
                  {passeport
                    ? <span className="inline-flex items-center gap-0.5 text-success"><CheckCircle2 className="h-3 w-3" /> passeport</span>
                    : <span className="text-warning">passeport manquant</span>}
                  {retenu && (
                    <span className="inline-flex items-center gap-0.5 text-success">
                      <FileCheck2 className="h-3 w-3" /> devis retenu{retenu.montant != null ? ` (${dzd(retenu.montant)})` : ""}
                    </span>
                  )}
                  {peutEditer && (
                    <span className="ml-auto inline-flex items-center gap-1">
                      {geste === "PASSEPORT" && (
                        <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => basculer(v.id, "PASSEPORT")}>
                          <Upload className="h-3.5 w-3.5" /> Joindre le passeport
                        </Button>
                      )}
                      {geste === "DEVIS" && (
                        <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => basculer(v.id, "DEVIS")}>
                          <Upload className="h-3.5 w-3.5" /> Joindre le devis de l&apos;agence
                        </Button>
                      )}
                      {geste === "VALIDER" && vivants.length === 1 && (
                        <Button
                          size="sm" disabled={busy !== null}
                          onClick={() => void run(`vdv:${v.id}`, () => validerDevisVoyageur(fdVoyageur(v.id, { devisId: vivants[0]!.id })), "Devis retenu.")}
                        >
                          {busy === `vdv:${v.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />} Valider ce devis
                        </Button>
                      )}
                      {geste === "VALIDER" && vivants.length > 1 && (
                        <Button size="sm" disabled={busy !== null} onClick={() => basculer(v.id, "CHOIX")}>
                          <CheckCircle2 className="h-3.5 w-3.5" /> Choisir le devis ({vivants.length})
                        </Button>
                      )}
                      <button
                        type="button" onClick={() => basculer(v.id, "MENU")} disabled={busy !== null}
                        className="inline-flex items-center rounded px-1.5 py-1 text-muted-foreground hover:bg-secondary"
                        aria-label={`Autres actions pour ${v.nom}`} aria-expanded={mode === "MENU"}
                      >
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  )}
                </div>
                {manque.length > 0 && <p className="text-[0.6875rem] text-muted-foreground">À préciser pour réserver : {manque.join(", ")}.</p>}
                {v.notes && <p className="text-muted-foreground">{v.notes}</p>}

                {mode === "MENU" && peutEditer && (
                  <div className="flex flex-wrap gap-1.5 rounded-lg border border-border bg-secondary/30 p-1.5" role="menu">
                    <MenuItem onClick={() => basculer(v.id, "EDITER")}>Modifier</MenuItem>
                    <MenuItem onClick={() => basculer(v.id, "PASSEPORT")}>{passeport ? "Remplacer le passeport" : "Joindre le passeport"}</MenuItem>
                    <MenuItem onClick={() => basculer(v.id, "DEVIS")}>{vivants.length > 0 ? "Joindre un autre devis" : "Joindre le devis"}</MenuItem>
                    {vivants.length > 1 && <MenuItem onClick={() => basculer(v.id, "CHOIX")}>{retenu ? "Changer de devis" : "Choisir le devis"}</MenuItem>}
                    <MenuItem
                      danger
                      onClick={() => {
                        if (!window.confirm(`Retirer ${v.nom} des voyageurs ?`)) return;
                        void run(`vdel:${v.id}`, () => retirerVoyageur(fdVoyageur(v.id, {}, "id")), "Voyageur retiré.").then(fermer);
                      }}
                    >
                      Retirer
                    </MenuItem>
                  </div>
                )}

                {/* LE PASSEPORT : une pièce du POSTE, désignée par le voyageur (`stepKey`). Remplacer = joindre le
                    nouveau puis retirer l'ancien depuis son aperçu (rien ne s'efface en silence). */}
                {(passeport && (mode === "PASSEPORT" || mode === "MENU")) && (
                  <div className="space-y-0.5">
                    {v.passeports.map((p) => <DocumentPreview key={p.id} id={p.id} name={p.name} hasFile={p.hasFile} canDelete={peutEditer} />)}
                  </div>
                )}
                {mode === "PASSEPORT" && peutEditer && (
                  <div className="rounded-lg border border-border p-2">
                    <p className="mb-1 text-[0.6875rem] text-muted-foreground">
                      Passeport de {v.nom}{passeport ? " — joignez le nouveau, puis retirez l'ancien ci-dessus" : ""}
                    </p>
                    <DocumentUpload entityType="AD_PRO_ITEM" entityId={itemId} categories={["ID_DOCUMENT"]} stepKey={v.id} compact />
                    <button type="button" onClick={fermer} className="mt-1 text-[0.6875rem] text-muted-foreground hover:text-foreground">Fermer</button>
                  </div>
                )}

                {/* LES PROPOSITIONS DE L'AGENCE pour ce voyageur — une ligne chacune, la retenue en tête de lecture. */}
                {v.devis.length > 0 && (mode === "CHOIX" || mode === "MENU" || !retenu) && (
                  <ul className="space-y-1 pl-2">
                    {v.devis.map((d) => (
                      <li key={d.id} className={`flex flex-wrap items-center gap-2 ${d.annule || (retenu && !d.retenu) ? "text-muted-foreground" : ""}`}>
                        {d.fichier
                          ? <DocumentPreview id={d.fichier.id} name={d.reference ?? d.titre} hasFile={d.fichier.hasFile} />
                          : <span>{d.reference ?? d.titre}</span>}
                        {d.montant != null && <span>{dzd(d.montant)}</span>}
                        {d.annule ? <span>annulé</span> : d.retenu ? <span className="text-success">retenu</span> : retenu ? <span>écarté</span> : null}
                        {peutEditer && !d.annule && !d.retenu && (mode === "CHOIX") && (
                          <Button
                            size="sm" variant="outline" disabled={busy !== null}
                            onClick={() => void run(`vdv:${v.id}`, () => validerDevisVoyageur(fdVoyageur(v.id, { devisId: d.id })), "Devis retenu.").then(fermer)}
                          >
                            Retenir celui-ci
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                {mode === "DEVIS" && peutEditer && (
                  <FormulaireDevis
                    nom={v.nom} busy={busy === `vdev:${v.id}`} onCancel={fermer}
                    onSubmit={(fd) => {
                      fd.set("voyageurId", v.id);
                      void run(`vdev:${v.id}`, () => ajouterDevisVoyageur(undefined, fd), "Devis déposé.").then(fermer);
                    }}
                  />
                )}
                {mode === "EDITER" && peutEditer && (
                  <div className="rounded-lg border border-primary/30 bg-primary/5 p-2">
                    <FormulaireVoyageur
                      listeId={nomsSuggeres.length > 0 ? listeId : undefined}
                      defaut={v}
                      busy={busy === `vmod:${v.id}`}
                      libelle="Enregistrer"
                      onSubmit={(fd) => {
                        fd.set("id", v.id);
                        void run(`vmod:${v.id}`, () => modifierVoyageur(undefined, fd), "Voyageur modifié.").then(fermer);
                      }}
                      onCancel={fermer}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {depasse && <p className="rounded-md bg-warning/10 px-2 py-1 text-warning" role="status">{depasse}</p>}

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
                size="sm" variant="outline" disabled={busy !== null}
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
            {bcPossible && retenus.length > 0 && (
              <>
                {assistantes.length > 1 && (
                  <select
                    value={assistanteId} onChange={(e) => setAssistanteId(e.target.value)}
                    aria-label="Assistante qui établira le bon de commande"
                    className="rounded-lg border border-border bg-background px-2 py-1 text-xs"
                  >
                    <option value="">Assistante qui établit le BC…</option>
                    {assistantes.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                )}
                <Button
                  size="sm" disabled={busy !== null || (assistantes.length > 1 && !assistanteId)}
                  onClick={() => {
                    const fd = new FormData();
                    fd.set("id", itemId);
                    if (assistanteId) fd.set("assistantId", assistanteId);
                    void run(`vbc:${itemId}`, () => demanderBCBilletterie(fd), "Bon de commande demandé.");
                  }}
                >
                  {busy === `vbc:${itemId}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Demander le BC ({retenus.length} devis retenu{retenus.length > 1 ? "s" : ""})
                </Button>
              </>
            )}
          </div>
        )
      )}
      {peutEditer && bcPossible && retenus.length === 0 && voyageurs.length > 0 && (
        <p className="text-[0.6875rem] text-muted-foreground">Validez le devis d&apos;au moins un voyageur : le bon de commande s&apos;établit d&apos;après les devis retenus.</p>
      )}
    </div>
  );
}

function fdVoyageur(voyageurId: string, extra: Record<string, string>, cle = "voyageurId"): FormData {
  const fd = new FormData();
  fd.set(cle, voyageurId);
  for (const [k, val] of Object.entries(extra)) fd.set(k, val);
  return fd;
}

function MenuItem({ children, onClick, danger }: { children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button" role="menuitem" onClick={onClick}
      className={`rounded px-2 py-1 text-[0.6875rem] font-medium hover:bg-secondary ${danger ? "text-destructive" : "text-foreground"}`}
    >
      {children}
    </button>
  );
}

const champ = "mt-1 w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-primary/60";

/** LE DEVIS DE L'AGENCE POUR UN VOYAGEUR — le fichier (exigé), son montant, et s'il s'agit d'une pro forma. */
function FormulaireDevis({ nom, busy, onSubmit, onCancel }: { nom: string; busy: boolean; onSubmit: (fd: FormData) => void; onCancel: () => void }) {
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(new FormData(e.currentTarget)); }} className="space-y-2 rounded-lg border border-border p-2">
      <p className="text-[0.6875rem] text-muted-foreground">Devis ou pro forma de l&apos;agence pour {nom}</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label className="text-xs sm:col-span-2">
          Fichier (PDF, Word ou scan)
          <input name="attachment" type="file" required className={champ} />
        </label>
        <label className="text-xs">
          Montant (DZD)
          <input name="montant" type="number" min="0" step="0.01" className={champ} />
        </label>
        <label className="flex items-center gap-2 self-end pb-1.5 text-xs">
          <input name="proforma" type="checkbox" /> C&apos;est une facture pro forma
        </label>
      </div>
      <div className="flex gap-2">
        <Button size="sm" type="submit" disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Déposer
        </Button>
        <Button size="sm" type="button" variant="outline" onClick={onCancel}>Annuler</Button>
      </div>
    </form>
  );
}

/**
 * LE FORMULAIRE D'UN VOYAGEUR — court : nom, trajet, mode, villes, dates. La date de retour n'apparaît
 * qu'en aller-retour ; en aller simple elle n'est pas envoyée, et l'action la vide. Les précisions ne se
 * saisissent qu'à la modification.
 */
function FormulaireVoyageur({ listeId, defaut, busy, libelle, onSubmit, onCancel }: {
  listeId?: string;
  defaut?: VoyageurVue;
  busy: boolean;
  libelle: string;
  onSubmit: (fd: FormData) => void;
  onCancel: () => void;
}) {
  const [trajet, setTrajet] = React.useState<AdProTrajet>(defaut?.trajet ?? "ALLER_RETOUR");
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(new FormData(e.currentTarget)); }} className="space-y-2">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label className="text-xs sm:col-span-2">
          Nom de la personne
          <input name="nom" required list={listeId} defaultValue={defaut?.nom ?? ""} placeholder="Dr Amel Haddad" className={champ} />
        </label>
        <fieldset className="text-xs">
          <legend>Trajet</legend>
          <div className="mt-1 flex gap-3">
            {(["ALLER_RETOUR", "ALLER_SIMPLE"] as const).map((t) => (
              <label key={t} className="inline-flex items-center gap-1">
                <input type="radio" name="trajet" value={t} checked={trajet === t} onChange={() => setTrajet(t)} /> {TRAJET_LIBELLE[t]}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="text-xs">
          Mode de transport
          <select name="transport" defaultValue={defaut ? (defaut.transport ?? "") : "AVION"} className={champ}>
            {defaut && !defaut.transport && <option value="">À préciser</option>}
            {TRANSPORTS.map((m) => <option key={m} value={m}>{TRANSPORT_LIBELLE[m]}</option>)}
          </select>
        </label>
        <label className="text-xs">
          Départ de
          <input name="villeDepart" defaultValue={defaut?.villeDepart ?? ""} placeholder="Alger" className={champ} />
        </label>
        <label className="text-xs">
          Vers
          <input name="villeArrivee" defaultValue={defaut?.villeArrivee ?? ""} placeholder="Paris" className={champ} />
        </label>
        <label className="text-xs">
          Date de départ
          <input name="dateDepart" type="date" defaultValue={defaut?.dateDepart ?? ""} className={champ} />
        </label>
        {trajet === "ALLER_RETOUR" && (
          <label className="text-xs">
            Date de retour
            <input name="dateRetour" type="date" defaultValue={defaut?.dateRetour ?? ""} className={champ} />
          </label>
        )}
        {defaut && (
          <label className="text-xs sm:col-span-2">
            Précisions
            <input name="notes" defaultValue={defaut.notes ?? ""} placeholder="Classe, horaires souhaités…" className={champ} />
          </label>
        )}
      </div>
      <p className="text-[0.6875rem] text-muted-foreground">Seul le nom est exigé : les dates et le trajet peuvent venir plus tard.</p>
      <div className="flex gap-2">
        <Button size="sm" type="submit" disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} {libelle}
        </Button>
        <Button size="sm" type="button" variant="outline" onClick={onCancel}>Annuler</Button>
      </div>
    </form>
  );
}
