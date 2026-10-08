"use client";

import * as React from "react";
import { AlertTriangle, CheckCircle2, Eye, Loader2, Pencil, Plus, Send, Trash2 } from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { InfoBulle } from "@/components/ui/info-bulle";
import { formatCurrency } from "@/lib/utils";
import { ETIQUETTE_BROUILLON } from "@/lib/bons-de-commande/brouillon";
import { saisieEffective } from "@/lib/references/registre";
import { ChampReference } from "@/components/references/champ-reference";
import type { DevisDePosteVue } from "@/lib/queries/ad-pro-devis-poste";
import {
  apercuBcPoste, modifierApercuBcPoste, annulerApercuBcPoste, validerEtEnvoyerBcPoste, type ApercuBcPoste,
} from "@/lib/actions/ad-pro-item-actions";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * L'APERÇU DU BON DE COMMANDE, À VALIDER PAR LE DEMANDEUR (Direction, 10/2026).
 *
 * « Ne pas générer et envoyer le BC direct aux Finances : il faut d'abord pré-valider le preview du BC par le demandeur,
 * avec modification possible. » Ce panneau montre le PDF tel qu'il sera imprimé (numéro « À attribuer à la validation » : rien
 * n'est numéroté ni envoyé), laisse corriger tout ce que le BC imprime — Référence, Contact, Modalités de paiement, lieu et date de
 * livraison, bloc du fournisseur, lignes, notes — puis, pour le demandeur seulement, « Valider et envoyer aux Finances ».
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

type Run = (key: string, fn: () => Promise<{ ok: boolean; error?: string; message?: string }>, okText: string) => Promise<void>;

interface Ligne { designation: string; unite: string; quantite: string; prix: string; details: string; remise: string; tva: string; section: boolean }

const MODES: { valeur: string; libelle: string }[] = [
  { valeur: "", libelle: "—" }, { valeur: "VIREMENT", libelle: "Virement bancaire" }, { valeur: "CHEQUE", libelle: "Chèque" },
  { valeur: "ESPECES", libelle: "Espèces" }, { valeur: "AUTRE", libelle: "À convenir" },
];

const pct = (v: number | null | undefined): string => (v != null ? String(Math.round(v * 10000) / 100) : "");
const num = (v: number): string => (Number.isFinite(v) ? String(v) : "");

export function ApercuBonDeCommande({ itemId, devis, peutEditer, peutValider, busy, run, onClose }: {
  itemId: string;
  devis: DevisDePosteVue;
  /** Corriger, régénérer l'aperçu, le retirer. */
  peutEditer: boolean;
  /** Valider et envoyer aux Finances : le demandeur de la demande, ou le Super Admin. */
  peutValider: boolean;
  busy: string | null;
  run: Run;
  onClose: () => void;
}) {
  const b = devis.brouillon!;
  const [lignes, setLignes] = React.useState<Ligne[]>(() => b.lignesBc.map((l) => ({
    designation: l.designation, unite: l.unite ?? "", quantite: l.section ? "" : num(l.quantite), prix: l.section ? "" : num(l.prixUnitaire),
    details: (l.details ?? []).join("\n"), remise: pct(l.remise), tva: pct(l.tva), section: Boolean(l.section),
  })));
  const [objet, setObjet] = React.useState(b.objet ?? "");
  const [notes, setNotes] = React.useState(b.notes ?? "");
  const [contactNom, setContactNom] = React.useState(b.contact?.nom ?? "");
  const [contactTel, setContactTel] = React.useState(b.contact?.telephone ?? "");
  const [mode, setMode] = React.useState<string>(b.modePaiement ?? "");
  const [conditions, setConditions] = React.useState(b.conditionsPaiement ?? "");
  const [lieu, setLieu] = React.useState(b.livraison?.adresse ?? "");
  const [dateLivraison, setDateLivraison] = React.useState(b.livraison?.date ?? "");
  const [delai, setDelai] = React.useState(b.livraison?.delai ?? "");
  const [fNom, setFNom] = React.useState(b.tiers?.nom ?? "");
  const [fAdresse, setFAdresse] = React.useState(b.tiers?.adresse ?? "");
  const [fTel, setFTel] = React.useState(b.tiers?.telephone ?? "");
  const [fEmail, setFEmail] = React.useState(b.tiers?.email ?? "");
  const [fRc, setFRc] = React.useState(b.tiers?.rc ?? "");
  const [fNif, setFNif] = React.useState(b.tiers?.nif ?? "");
  // LA RÉFÉRENCE DU BC (registre commun NNN/DG/AAAA) : préremplie avec le prochain numéro, modifiable, vérifiée en direct.
  const [numeroChoisi, setNumeroChoisi] = React.useState(b.numeroChoisi ?? "");
  const [numeroSuggere, setNumeroSuggere] = React.useState("");
  const [numeroRefuse, setNumeroRefuse] = React.useState(false);

  const [apercu, setApercu] = React.useState<ApercuBcPoste | null>(null);
  const [url, setUrl] = React.useState<string | null>(null);
  const [charge, startCharge] = React.useTransition();
  const [enregistre, startEnregistre] = React.useTransition();
  const [erreur, setErreur] = React.useState<string | null>(null);
  const [edition, setEdition] = React.useState(false);
  const occupe = charge || enregistre || (busy !== null && busy.endsWith(`:${devis.pieceId}`));

  const formulaire = (): FormData => {
    const fd = new FormData();
    fd.set("id", itemId);
    fd.set("pieceId", devis.pieceId);
    for (const l of lignes) {
      fd.append("ligneDesignation", l.designation); fd.append("ligneUnite", l.unite); fd.append("ligneQuantite", l.quantite); fd.append("lignePrix", l.prix);
      fd.append("ligneDetails", l.details); fd.append("ligneRemise", l.remise); fd.append("ligneTva", l.tva); fd.append("ligneSection", l.section ? "1" : "0");
    }
    fd.set("objet", objet); fd.set("notes", notes);
    fd.set("contactNom", contactNom); fd.set("contactTelephone", contactTel);
    fd.set("modePaiement", mode); fd.set("conditionsPaiement", conditions);
    fd.set("livraisonAdresse", lieu); fd.set("livraisonDate", dateLivraison); fd.set("livraisonDelai", delai);
    fd.set("fournisseurNom", fNom); fd.set("fournisseurAdresse", fAdresse); fd.set("fournisseurTelephone", fTel);
    fd.set("fournisseurEmail", fEmail); fd.set("fournisseurRc", fRc); fd.set("fournisseurNif", fNif);
    // Le numéro PROPOSÉ ne se fige pas dans le brouillon : seul un numéro modifié y est gardé.
    fd.set("numeroChoisi", saisieEffective(numeroChoisi, numeroSuggere) ?? "");
    return fd;
  };
  const simple = (): FormData => { const fd = new FormData(); fd.set("id", itemId); fd.set("pieceId", devis.pieceId); return fd; };

  const montrer = React.useCallback(() => {
    setErreur(null);
    startCharge(async () => {
      const r = await apercuBcPoste(simple());
      setApercu(r);
      setUrl((ancien) => {
        if (ancien) URL.revokeObjectURL(ancien);
        if (!r.ok || !r.pdfBase64) return null;
        const octets = Uint8Array.from(atob(r.pdfBase64), (c) => c.charCodeAt(0));
        return URL.createObjectURL(new Blob([octets], { type: "application/pdf" }));
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId, devis.pieceId]);

  React.useEffect(() => { montrer(); }, [montrer]);
  React.useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  const enregistrer = () => {
    setErreur(null);
    startEnregistre(async () => {
      const r = await modifierApercuBcPoste(formulaire());
      if (!r.ok) { setErreur(r.error ?? "L'enregistrement n'a pas abouti."); return; }
      setEdition(false);
      montrer();
    });
  };

  const modifierLigne = (i: number, patch: Partial<Ligne>) => setLignes((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const champ = "w-full rounded border border-border bg-background px-1.5 py-2 text-xs outline-none focus:border-primary/60 sm:py-1";
  const totaux = apercu && apercu.ok ? apercu.totaux : null;
  const bloquants = apercu && apercu.ok ? apercu.bloquants : [];

  return (
    <Sheet
      open onClose={onClose} width="xl"
      title={`Bon de commande — ${devis.reference ?? devis.titre}`}
      description={`${ETIQUETTE_BROUILLON}. Aucun numéro n'est attribué et rien n'est envoyé aux Finances tant que vous n'avez pas validé.`}
    >
      <div className="space-y-4 text-sm">
        <div className="space-y-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-medium">
            <Eye className="h-4 w-4 shrink-0" aria-hidden />
            <span>{ETIQUETTE_BROUILLON}</span>
            <span className="font-normal text-muted-foreground">
              · N° {devis.bc ? devis.bc.reference : "à attribuer à la validation"}
              {apercu && apercu.ok && !apercu.referenceExistante && <> (prochain : {apercu.numeroPrevu})</>}
            </span>
            <InfoBulle label="Pourquoi pas de numéro ?" align="left">
              Le numéro NNN/DG/AAAA suit l&apos;ordre de validation : il n&apos;est attribué qu&apos;au moment d&apos;envoyer le BC aux Finances,
              pour que la série reste continue, sans trou, même si un brouillon est corrigé ou abandonné.
            </InfoBulle>
          </p>
          {apercu && apercu.ok && !apercu.referenceExistante && peutValider && apercu.surRegistre && (
            <ChampReference
              id="bc-numero" label="Référence du BC" name="numeroChoisi" nameSuggeree="numeroSuggere" cle={apercu.societeId}
              valeurInitiale={b.numeroChoisi}
              charger={async () => ({ ok: true, actif: true, societeId: apercu.societeId, prochaine: apercu.numeroPrevu })}
              onChange={(e) => { setNumeroChoisi(e.valeur); setNumeroSuggere(e.suggeree ?? ""); setNumeroRefuse(e.erreur !== null); }}
            />
          )}
        </div>
        {b.perime && (
          <p className="flex gap-1 text-warning"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> Les lignes validées du devis ont changé depuis vos corrections : retirez cet aperçu et générez-le de nouveau.</p>
        )}

        {charge && !apercu ? (
          <p className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Préparation de l&apos;aperçu…</p>
        ) : apercu && !apercu.ok ? (
          <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-destructive" role="alert">{apercu.error}</p>
        ) : url ? (
          <object data={url} type="application/pdf" aria-label="Aperçu du bon de commande" className="h-[65vh] w-full rounded-md border border-border bg-card">
            <a href={url} target="_blank" rel="noreferrer" className="text-primary hover:underline">Ouvrir l&apos;aperçu PDF</a>
          </object>
        ) : null}

        {bloquants.length > 0 && (
          <ul className="space-y-0.5 text-destructive">{bloquants.map((x) => <li key={x} className="flex gap-1"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {x}</li>)}</ul>
        )}
        {apercu && apercu.ok && apercu.avertissements.length > 0 && (
          <ul className="space-y-0.5 text-muted-foreground">{apercu.avertissements.map((x) => <li key={x}>{x}</li>)}</ul>
        )}
        {totaux && (
          <p className="tabular-nums text-muted-foreground">
            Total HT {formatCurrency(totaux.totalHt)}{totaux.totalTaxes > 0 ? ` · taxes ${formatCurrency(totaux.totalTaxes)}` : ""} · TVA {formatCurrency(totaux.totalTva)} ·{" "}
            <span className="font-semibold text-foreground">TTC {formatCurrency(totaux.totalTtc)}</span>
          </p>
        )}

        {edition && peutEditer && (
          <div className="space-y-3 rounded-lg border border-border p-3">
            <p className="font-medium">Corriger ce que le bon de commande imprime</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1 sm:col-span-2"><Label htmlFor="ab-objet">Référence</Label><Input id="ab-objet" value={objet} onChange={(e) => setObjet(e.target.value)} placeholder="Traiteur — SPO-2026-006" /></div>
              <div className="space-y-1"><Label htmlFor="ab-cnom">Contact</Label><Input id="ab-cnom" value={contactNom} onChange={(e) => setContactNom(e.target.value)} /></div>
              <div className="space-y-1"><Label htmlFor="ab-ctel">Téléphone du contact</Label><Input id="ab-ctel" type="tel" inputMode="tel" value={contactTel} onChange={(e) => setContactTel(e.target.value)} /></div>
              <div className="space-y-1">
                <Label htmlFor="ab-mode">Modalités de paiement</Label>
                <select id="ab-mode" value={mode} onChange={(e) => setMode(e.target.value)} className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm">
                  {MODES.map((m) => <option key={m.valeur} value={m.valeur}>{m.libelle}</option>)}
                </select>
              </div>
              <div className="space-y-1"><Label htmlFor="ab-cond">Précision sur le paiement</Label><Input id="ab-cond" value={conditions} onChange={(e) => setConditions(e.target.value)} placeholder="30 jours fin de mois" /></div>
              <div className="space-y-1 sm:col-span-2"><Label htmlFor="ab-lieu">Lieu de livraison</Label><Input id="ab-lieu" value={lieu} onChange={(e) => setLieu(e.target.value)} placeholder="Park Mall Center" /></div>
              <div className="space-y-1"><Label htmlFor="ab-date">Date de livraison</Label><Input id="ab-date" type="date" value={dateLivraison} onChange={(e) => setDateLivraison(e.target.value)} /></div>
              <div className="space-y-1"><Label htmlFor="ab-delai">Délai de livraison</Label><Input id="ab-delai" value={delai} onChange={(e) => setDelai(e.target.value)} /></div>
            </div>

            <p className="pt-1 font-medium">Fournisseur (bloc « A : »)</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1 sm:col-span-2"><Label htmlFor="ab-fnom">Société</Label><Input id="ab-fnom" value={fNom} onChange={(e) => setFNom(e.target.value)} placeholder={apercu && apercu.ok ? apercu.tiers.nom : undefined} /></div>
              <div className="space-y-1 sm:col-span-2"><Label htmlFor="ab-fadr">Adresse</Label><Input id="ab-fadr" value={fAdresse} onChange={(e) => setFAdresse(e.target.value)} placeholder={apercu && apercu.ok ? apercu.tiers.adresse ?? undefined : undefined} /></div>
              <div className="space-y-1"><Label htmlFor="ab-ftel">Téléphone</Label><Input id="ab-ftel" type="tel" inputMode="tel" value={fTel} onChange={(e) => setFTel(e.target.value)} /></div>
              <div className="space-y-1"><Label htmlFor="ab-femail">E-mail</Label><Input id="ab-femail" type="email" value={fEmail} onChange={(e) => setFEmail(e.target.value)} /></div>
              <div className="space-y-1"><Label htmlFor="ab-frc">RC</Label><Input id="ab-frc" value={fRc} onChange={(e) => setFRc(e.target.value)} /></div>
              <div className="space-y-1"><Label htmlFor="ab-fnif">NIF</Label><Input id="ab-fnif" value={fNif} onChange={(e) => setFNif(e.target.value)} /></div>
            </div>

            <p className="pt-1 font-medium">Lignes</p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[34rem] text-left text-xs">
                <thead className="text-[0.6875rem] text-muted-foreground"><tr><th>Désignation</th><th className="w-20">Unité</th><th className="w-20">Qté</th><th className="w-28">PU HT</th><th className="w-8" /></tr></thead>
                <tbody>
                  {lignes.map((l, i) => (
                    <tr key={i} className="align-top">
                      <td className="pr-1" data-label="Désignation"><input className={champ} value={l.designation} onChange={(e) => modifierLigne(i, { designation: e.target.value })} aria-label={`Désignation de la ligne ${i + 1}`} /></td>
                      <td className="pr-1" data-label="Unité">{l.section ? null : <input className={champ} value={l.unite} onChange={(e) => modifierLigne(i, { unite: e.target.value })} aria-label={`Unité de la ligne ${i + 1}`} />}</td>
                      <td className="pr-1" data-label="Qté">{l.section ? null : <input className={champ} inputMode="decimal" value={l.quantite} onChange={(e) => modifierLigne(i, { quantite: e.target.value })} aria-label={`Quantité de la ligne ${i + 1}`} />}</td>
                      <td className="pr-1" data-label="PU HT">{l.section ? null : <input className={champ} inputMode="decimal" value={l.prix} onChange={(e) => modifierLigne(i, { prix: e.target.value })} aria-label={`Prix unitaire HT de la ligne ${i + 1}`} />}</td>
                      <td><button type="button" onClick={() => setLignes((ls) => ls.filter((_, j) => j !== i))} aria-label={`Retirer la ligne ${i + 1}`} className="p-1.5 text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button type="button" onClick={() => setLignes((ls) => [...ls, { designation: "", unite: "", quantite: "1", prix: "0", details: "", remise: "", tva: "", section: false }])} className="inline-flex min-h-9 items-center gap-1 text-primary hover:underline sm:min-h-0">
              <Plus className="h-3.5 w-3.5" /> Ajouter une ligne
            </button>
            <div className="space-y-1"><Label htmlFor="ab-notes">Notes</Label><Textarea id="ab-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
            <p className="text-xs text-muted-foreground">Un champ laissé vide reprend ce que le devis donne. Les totaux et la somme en lettres sont recalculés par la plateforme.</p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={enregistrer} disabled={occupe}>{enregistre ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Pencil className="h-3.5 w-3.5" />} Enregistrer et actualiser l&apos;aperçu</Button>
              <Button size="sm" variant="ghost" onClick={() => setEdition(false)} disabled={occupe}>Annuler</Button>
            </div>
          </div>
        )}

        {erreur && <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-destructive" role="alert">{erreur}</p>}

        <div className="flex flex-wrap items-center gap-2">
          {peutValider ? (
            <Button
              size="sm" disabled={occupe || edition || b.perime || bloquants.length > 0 || numeroRefuse}
              title={edition ? "Enregistrez vos corrections d'abord." : numeroRefuse ? "Cette référence est refusée : corrigez-la." : undefined}
              onClick={() => {
                const fd = simple();
                if (apercu && apercu.ok && apercu.surRegistre && !apercu.referenceExistante) {
                  fd.set("numeroChoisi", numeroChoisi);
                  fd.set("numeroSuggere", numeroSuggere);
                }
                void run(`valbc:${devis.pieceId}:${itemId}`, async () => {
                  const r = await validerEtEnvoyerBcPoste(fd);
                  if (r.ok) onClose();
                  return r;
                }, "Bon de commande validé et envoyé.");
              }}
            >
              {busy === `valbc:${devis.pieceId}:${itemId}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Valider et envoyer aux Finances
            </Button>
          ) : (
            <p className="flex items-center gap-1 text-muted-foreground"><CheckCircle2 className="h-3.5 w-3.5" /> Le demandeur de la demande valide cet aperçu.</p>
          )}
          {peutEditer && !edition && (
            <button type="button" onClick={() => setEdition(true)} disabled={occupe} className="inline-flex min-h-9 items-center gap-1 text-primary hover:underline disabled:opacity-50 sm:min-h-0">
              <Pencil className="h-3.5 w-3.5" /> Modifier
            </button>
          )}
          {peutEditer && (
            <button
              type="button" disabled={occupe}
              onClick={() => { void run(`annbc:${devis.pieceId}:${itemId}`, async () => { const r = await annulerApercuBcPoste(simple()); if (r.ok) onClose(); return r; }, "Aperçu retiré."); }}
              className="inline-flex min-h-9 items-center gap-1 text-destructive hover:underline disabled:opacity-50 sm:min-h-0"
            >
              <Trash2 className="h-3.5 w-3.5" /> Retirer l&apos;aperçu
            </button>
          )}
          <button type="button" onClick={montrer} disabled={occupe} className="inline-flex min-h-9 items-center gap-1 text-primary hover:underline disabled:opacity-50 sm:min-h-0">
            <Eye className="h-3.5 w-3.5" /> Actualiser l&apos;aperçu
          </button>
        </div>
      </div>
    </Sheet>
  );
}
