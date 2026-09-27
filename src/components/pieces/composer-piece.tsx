"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FileText, Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";
import {
  emettrePieceCommerciale, previsualiserPieceCommerciale, reglerNumerotationPieces,
  type ApercuPiece, type ResultatEmission,
} from "@/lib/actions/fabrique-actions";

/**
 * COMPOSER UNE PIÈCE — le bouton des Finances (et de Legal) : une facture, un bon de commande ou
 * un devis au format de la société, sur son papier en-tête, en Word et en PDF.
 *
 * ── CE QUE L'ÉCRAN FAIT, ET CE QU'IL NE FAIT PAS ───────────────────────────────────────────
 *
 * Il SAISIT et il MONTRE. Il ne calcule rien : les totaux, la TVA, la somme en lettres et le
 * numéro prévu viennent de l'APERÇU serveur — la même composition que l'émission, jouée à blanc
 * — parce qu'un total calculé dans le navigateur et un total calculé par la fabrique finiraient
 * par diverger d'un centime, et c'est le centime qu'un comptable remarque (§118.5). Le même
 * formulaire (`construireFormData`) nourrit l'aperçu et l'émission : ce qu'on a vu est ce qui
 * est émis.
 *
 * L'émission passe par le registre Legal et le Drive ; le résultat rend les liens vers le Word,
 * le PDF et la fiche — et DIT comment le PDF a été produit (éditeur Office, ou rendu du serveur
 * dont le Word fait foi), parce que « le PDF existe » ne dit pas la même chose selon qui l'a
 * imprimé (§118.121).
 */

export type TypePieceComposable = "FACTURE" | "BON_DE_COMMANDE" | "DEVIS";

const LIBELLE: Record<TypePieceComposable, { nom: string; bouton: string; tiers: string; article: string }> = {
  FACTURE: { nom: "Facture", bouton: "Composer une facture", tiers: "Client", article: "la facture" },
  BON_DE_COMMANDE: { nom: "Bon de commande", bouton: "Composer un bon de commande", tiers: "Fournisseur", article: "le bon de commande" },
  DEVIS: { nom: "Devis", bouton: "Composer un devis", tiers: "Client", article: "le devis" },
};

interface Ligne { id: number; designation: string; details: string; quantite: string; prix: string; remise: string; tva: string; section: boolean }
interface Taxe { id: number; libelle: string; taux: string }

export interface ComposerPieceProps {
  typeInitial: TypePieceComposable;
  typesAutorises: TypePieceComposable[];
  societes: { id: string; label: string }[];
  societeParDefaut: string | null;
  letterheads: { id: string; name: string; companyId: string | null; companyLabel: string | null }[];
  peutReglerNumerotation: boolean;
}

const aujourdhui = (): string => new Date().toISOString().slice(0, 10);
let compteur = 1;
const nouvelleLigne = (section = false): Ligne => ({ id: compteur++, designation: "", details: "", quantite: section ? "" : "1", prix: "", remise: "", tva: "", section });

export function ComposerPieceButton(props: ComposerPieceProps) {
  const [open, setOpen] = React.useState(false);
  const lib = LIBELLE[props.typeInitial];
  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        <FileText className="h-4 w-4" aria-hidden />
        {lib.bouton}
      </Button>
      {open && <ComposerPieceSheet {...props} onClose={() => setOpen(false)} />}
    </>
  );
}

function ComposerPieceSheet(props: ComposerPieceProps & { onClose: () => void }) {
  const router = useRouter();
  const [type, setType] = React.useState<TypePieceComposable>(props.typeInitial);
  const [societe, setSociete] = React.useState<string>(props.societeParDefaut ?? props.societes[0]?.id ?? "");
  const [letterheadId, setLetterheadId] = React.useState<string>("");
  const [tiers, setTiers] = React.useState({ nom: "", adresse: "", telephone: "", email: "", rc: "", nif: "", ai: "", nis: "" });
  const [champs, setChamps] = React.useState({
    numeroClient: "", date: aujourdhui(), echeance: "", validiteJours: "30", objet: "", referenceAmont: "", referenceAmontDate: "",
    contactNom: "", contactTelephone: "", livraisonAdresse: "", livraisonDelai: "", modePaiement: "VIREMENT", conditionsPaiement: "",
    tvaDefaut: "19", remiseGlobale: "", notes: "",
  });
  const [lignes, setLignes] = React.useState<Ligne[]>([nouvelleLigne()]);
  const [taxes, setTaxes] = React.useState<Taxe[]>([]);
  const [apercu, setApercu] = React.useState<ApercuPiece | { ok: false; error: string } | null>(null);
  const [resultat, setResultat] = React.useState<ResultatEmission | null>(null);
  const [motif, setMotif] = React.useState<string>("");
  const [motifMessage, setMotifMessage] = React.useState<string | null>(null);
  const [emission, startEmission] = React.useTransition();
  const [chargement, startChargement] = React.useTransition();
  const lib = LIBELLE[type];

  const papiers = React.useMemo(
    () => props.letterheads.filter((l) => !l.companyId || l.companyId === societe),
    [props.letterheads, societe],
  );

  // LE MÊME FORMULAIRE pour l'aperçu et l'émission : ce qu'on a vu est ce qui est émis.
  const construireFormData = React.useCallback((): FormData => {
    const fd = new FormData();
    fd.set("type", type);
    fd.set("societe", societe);
    if (letterheadId) fd.set("letterheadId", letterheadId);
    for (const [k, v] of Object.entries(tiers)) fd.set(`tiers${k[0].toUpperCase()}${k.slice(1)}`, v);
    for (const [k, v] of Object.entries(champs)) fd.set(k, v);
    for (const l of lignes) {
      fd.append("ligneDesignation", l.designation);
      fd.append("ligneDetails", l.details);
      fd.append("ligneQuantite", l.quantite);
      fd.append("lignePrix", l.prix);
      fd.append("ligneRemise", l.remise);
      fd.append("ligneTva", l.tva);
      fd.append("ligneSection", l.section ? "1" : "0");
    }
    for (const t of taxes) { fd.append("taxeLibelle", t.libelle); fd.append("taxeTaux", t.taux); }
    return fd;
  }, [type, societe, letterheadId, tiers, champs, lignes, taxes]);

  // L'APERÇU suit la saisie, avec un demi-seconde de retenue : assez pour ne pas appeler le
  // serveur à chaque touche, assez peu pour que les totaux paraissent vivants.
  const pret = tiers.nom.trim() !== "" && lignes.some((l) => !l.section && l.designation.trim() !== "");
  const empreinte = JSON.stringify({ type, societe, letterheadId, tiers, champs, lignes, taxes });
  React.useEffect(() => {
    if (!pret || resultat) return;
    const fd = construireFormData();
    const t = setTimeout(() => {
      startChargement(async () => {
        const r = await previsualiserPieceCommerciale(undefined, fd);
        setApercu(r);
        if (r.ok && !motif) setMotif(r.motif ?? "");
      });
    }, 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empreinte, pret, resultat]);

  const modifierLigne = (id: number, patch: Partial<Ligne>) => setLignes((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  const deplacer = (id: number, sens: -1 | 1) => setLignes((ls) => {
    const i = ls.findIndex((l) => l.id === id);
    const j = i + sens;
    if (i < 0 || j < 0 || j >= ls.length) return ls;
    const copie = [...ls];
    [copie[i], copie[j]] = [copie[j], copie[i]];
    return copie;
  });

  const emettre = () => {
    const fd = construireFormData();
    startEmission(async () => {
      const r = await emettrePieceCommerciale(undefined, fd);
      setResultat(r);
      if (r.ok) router.refresh();
    });
  };

  const enregistrerMotif = () => {
    const fd = new FormData();
    fd.set("type", type); fd.set("societe", societe); fd.set("motif", motif);
    startChargement(async () => {
      const r = await reglerNumerotationPieces(undefined, fd);
      setMotifMessage(r.ok ? r.message ?? "Enregistré." : r.error ?? "Refusé.");
      if (r.ok) setApercu(await previsualiserPieceCommerciale(undefined, construireFormData()));
    });
  };

  const totaux = apercu && apercu.ok ? apercu.totaux : null;
  const bloquants = apercu && apercu.ok ? apercu.bloquants : apercu && !apercu.ok ? [apercu.error] : [];
  const peutEmettre = !!(apercu && apercu.ok && apercu.peutEmettre) && !emission && !resultat?.ok;

  return (
    <Sheet
      open
      onClose={props.onClose}
      title={lib.bouton}
      description="Au format de la société, sur son papier en-tête, en Word et en PDF — numérotée par son compteur et inscrite au registre."
      width="xl"
      footer={
        resultat?.ok ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm text-muted-foreground">Pièce émise.</span>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => { setResultat(null); setLignes([nouvelleLigne()]); setTiers({ nom: "", adresse: "", telephone: "", email: "", rc: "", nif: "", ai: "", nis: "" }); setApercu(null); }}>
                Composer une autre pièce
              </Button>
              <Button type="button" onClick={props.onClose}>Fermer</Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm text-muted-foreground">
              {apercu && apercu.ok ? `Numéro prévu : ${apercu.numeroProchain}` : pret ? (chargement ? "Calcul…" : "") : "Renseignez le tiers et au moins une ligne."}
            </span>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={props.onClose}>Annuler</Button>
              <Button type="button" onClick={emettre} disabled={!peutEmettre}>{emission ? "Émission…" : `Émettre ${lib.article}`}</Button>
            </div>
          </div>
        )
      }
    >
      <div className="space-y-5 text-sm">
        {/* ── Nature, société, papier ── */}
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <Label htmlFor="cp-type">Nature</Label>
            <Select id="cp-type" value={type} onChange={(e) => { setType(e.target.value as TypePieceComposable); setResultat(null); }}>
              {props.typesAutorises.map((t) => <option key={t} value={t}>{LIBELLE[t].nom}</option>)}
            </Select>
          </div>
          <div>
            <Label htmlFor="cp-societe">Société émettrice</Label>
            <Select id="cp-societe" value={societe} onChange={(e) => { setSociete(e.target.value); setLetterheadId(""); }}>
              {props.societes.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </Select>
          </div>
          <div>
            <Label htmlFor="cp-papier">Papier en-tête</Label>
            <Select id="cp-papier" value={letterheadId} onChange={(e) => setLetterheadId(e.target.value)}>
              <option value="">{apercu && apercu.ok ? (apercu.papierEnTete ? `Celui du profil — ${apercu.papierEnTete.nom}` : "Aucun papier : mise en page neutre") : "Celui du profil de la société"}</option>
              {papiers.map((l) => <option key={l.id} value={l.id}>{l.name}{l.companyLabel ? ` — ${l.companyLabel}` : " — commun au groupe"}</option>)}
            </Select>
          </div>
        </section>

        {/* ── Le tiers ── */}
        <section className="space-y-2">
          <h3 className="font-semibold">{lib.tiers}</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="cp-tiers-nom">Raison sociale *</Label>
              <Input id="cp-tiers-nom" value={tiers.nom} onChange={(e) => setTiers({ ...tiers, nom: e.target.value })} placeholder="Sarl BIOGALENIC" />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="cp-tiers-adresse">Adresse (une ligne par retour)</Label>
              <Textarea id="cp-tiers-adresse" rows={2} value={tiers.adresse} onChange={(e) => setTiers({ ...tiers, adresse: e.target.value })} />
            </div>
            <div><Label htmlFor="cp-tiers-tel">Téléphone / Fax</Label><Input id="cp-tiers-tel" value={tiers.telephone} onChange={(e) => setTiers({ ...tiers, telephone: e.target.value })} /></div>
            <div><Label htmlFor="cp-tiers-email">E-mail</Label><Input id="cp-tiers-email" value={tiers.email} onChange={(e) => setTiers({ ...tiers, email: e.target.value })} /></div>
            <div><Label htmlFor="cp-tiers-rc">RC</Label><Input id="cp-tiers-rc" value={tiers.rc} onChange={(e) => setTiers({ ...tiers, rc: e.target.value })} /></div>
            <div><Label htmlFor="cp-tiers-nif">NIF</Label><Input id="cp-tiers-nif" value={tiers.nif} onChange={(e) => setTiers({ ...tiers, nif: e.target.value })} /></div>
            <div><Label htmlFor="cp-tiers-ai">AI</Label><Input id="cp-tiers-ai" value={tiers.ai} onChange={(e) => setTiers({ ...tiers, ai: e.target.value })} /></div>
            <div><Label htmlFor="cp-tiers-nis">NIS</Label><Input id="cp-tiers-nis" value={tiers.nis} onChange={(e) => setTiers({ ...tiers, nis: e.target.value })} /></div>
            {type === "FACTURE" && (
              <div><Label htmlFor="cp-numero-client">Numéro de client</Label><Input id="cp-numero-client" value={champs.numeroClient} onChange={(e) => setChamps({ ...champs, numeroClient: e.target.value })} placeholder="00003" /></div>
            )}
          </div>
        </section>

        {/* ── Références ── */}
        <section className="space-y-2">
          <h3 className="font-semibold">Références</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div><Label htmlFor="cp-date">Date d'émission</Label><Input id="cp-date" type="date" value={champs.date} onChange={(e) => setChamps({ ...champs, date: e.target.value })} /></div>
            {type === "FACTURE" && <div><Label htmlFor="cp-echeance">Échéance de règlement</Label><Input id="cp-echeance" type="date" value={champs.echeance} onChange={(e) => setChamps({ ...champs, echeance: e.target.value })} /></div>}
            {type === "DEVIS" && <div><Label htmlFor="cp-validite">Validité (jours)</Label><Input id="cp-validite" type="number" min={1} max={365} value={champs.validiteJours} onChange={(e) => setChamps({ ...champs, validiteJours: e.target.value })} /></div>}
            <div className={type === "FACTURE" ? "" : "sm:col-span-2"}>
              <Label htmlFor="cp-objet">{type === "FACTURE" ? "Document Ref" : "Objet"}</Label>
              <Input id="cp-objet" value={champs.objet} onChange={(e) => setChamps({ ...champs, objet: e.target.value })} />
            </div>
            <div><Label htmlFor="cp-ref-amont">{type === "BON_DE_COMMANDE" ? "Devis N° (du fournisseur)" : "Référence amont"}</Label><Input id="cp-ref-amont" value={champs.referenceAmont} onChange={(e) => setChamps({ ...champs, referenceAmont: e.target.value })} placeholder="26/0576" /></div>
            <div><Label htmlFor="cp-ref-amont-date">Date de la pièce amont</Label><Input id="cp-ref-amont-date" type="date" value={champs.referenceAmontDate} onChange={(e) => setChamps({ ...champs, referenceAmontDate: e.target.value })} /></div>
            <div>
              <Label htmlFor="cp-mode">Mode de paiement</Label>
              <Select id="cp-mode" value={champs.modePaiement} onChange={(e) => setChamps({ ...champs, modePaiement: e.target.value })}>
                <option value="VIREMENT">Virement bancaire</option>
                <option value="CHEQUE">Chèque</option>
                <option value="ESPECES">Espèces (droit de timbre)</option>
                <option value="AUTRE">À convenir</option>
                <option value="">Non précisé</option>
              </Select>
            </div>
            <div className="sm:col-span-2"><Label htmlFor="cp-conditions">Conditions de paiement</Label><Input id="cp-conditions" value={champs.conditionsPaiement} onChange={(e) => setChamps({ ...champs, conditionsPaiement: e.target.value })} placeholder="ou virement bancaire · 30 jours date de facture" /></div>
            {type !== "FACTURE" && (
              <>
                <div><Label htmlFor="cp-contact-nom">Contact</Label><Input id="cp-contact-nom" value={champs.contactNom} onChange={(e) => setChamps({ ...champs, contactNom: e.target.value })} placeholder="Mme ABDELAZIZ ASSIA" /></div>
                <div><Label htmlFor="cp-contact-tel">Téléphone du contact</Label><Input id="cp-contact-tel" value={champs.contactTelephone} onChange={(e) => setChamps({ ...champs, contactTelephone: e.target.value })} /></div>
              </>
            )}
            {type === "BON_DE_COMMANDE" && (
              <>
                <div className="sm:col-span-2"><Label htmlFor="cp-livraison">Adresse de livraison (vide = le siège de la société)</Label><Input id="cp-livraison" value={champs.livraisonAdresse} onChange={(e) => setChamps({ ...champs, livraisonAdresse: e.target.value })} /></div>
                <div><Label htmlFor="cp-delai">Délai de livraison</Label><Input id="cp-delai" value={champs.livraisonDelai} onChange={(e) => setChamps({ ...champs, livraisonDelai: e.target.value })} /></div>
              </>
            )}
          </div>
        </section>

        {/* ── Les lignes ── */}
        <section className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold">Lignes</h3>
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => setLignes([...lignes, nouvelleLigne(true)])}>Titre de section</Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setLignes([...lignes, nouvelleLigne()])}><Plus className="h-4 w-4" aria-hidden />Ligne</Button>
            </div>
          </div>
          <div className="space-y-2">
            {lignes.map((l, i) => (
              <div key={l.id} className={`rounded-lg border border-border p-2 ${l.section ? "bg-secondary/40" : "bg-card"}`}>
                <div className="grid grid-cols-12 gap-2">
                  <div className={l.section ? "col-span-10" : "col-span-12 sm:col-span-5"}>
                    <Input aria-label={l.section ? `Titre de section ${i + 1}` : `Désignation ${i + 1}`} value={l.designation} onChange={(e) => modifierLigne(l.id, { designation: e.target.value })} placeholder={l.section ? "Campagne Raltégravir" : "Désignation"} />
                    {!l.section && (
                      <Textarea className="mt-1" rows={1} aria-label={`Détails de la ligne ${i + 1}`} value={l.details} onChange={(e) => modifierLigne(l.id, { details: e.target.value })} placeholder="Détails (une ligne par retour) : Format A4, Impression quadri…" />
                    )}
                  </div>
                  {!l.section && (
                    <>
                      <div className="col-span-4 sm:col-span-2"><Input aria-label="Quantité" inputMode="decimal" value={l.quantite} onChange={(e) => modifierLigne(l.id, { quantite: e.target.value })} placeholder="Qté" /></div>
                      <div className="col-span-4 sm:col-span-2"><Input aria-label="Prix unitaire HT" inputMode="decimal" value={l.prix} onChange={(e) => modifierLigne(l.id, { prix: e.target.value })} placeholder="PU HT (0 = Offert)" /></div>
                      <div className="col-span-2 sm:col-span-1"><Input aria-label="Remise %" inputMode="decimal" value={l.remise} onChange={(e) => modifierLigne(l.id, { remise: e.target.value })} placeholder="Rem. %" /></div>
                      <div className="col-span-2 sm:col-span-1">
                        <Select aria-label="TVA de la ligne" value={l.tva} onChange={(e) => modifierLigne(l.id, { tva: e.target.value })}>
                          <option value="">TVA déf.</option><option value="19">19 %</option><option value="9">9 %</option><option value="0">0 %</option>
                        </Select>
                      </div>
                    </>
                  )}
                  <div className={`${l.section ? "col-span-2" : "col-span-12 sm:col-span-1"} flex items-start justify-end gap-1`}>
                    <button type="button" className="rounded p-1 text-muted-foreground hover:bg-secondary" aria-label="Monter" onClick={() => deplacer(l.id, -1)}><ArrowUp className="h-4 w-4" /></button>
                    <button type="button" className="rounded p-1 text-muted-foreground hover:bg-secondary" aria-label="Descendre" onClick={() => deplacer(l.id, 1)}><ArrowDown className="h-4 w-4" /></button>
                    <button type="button" className="rounded p-1 text-muted-foreground hover:bg-secondary" aria-label="Supprimer la ligne" onClick={() => setLignes(lignes.filter((x) => x.id !== l.id))}><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <Label htmlFor="cp-tva-defaut">TVA par défaut</Label>
              <Select id="cp-tva-defaut" value={champs.tvaDefaut} onChange={(e) => setChamps({ ...champs, tvaDefaut: e.target.value })}>
                <option value="19">19 %</option><option value="9">9 %</option><option value="0">0 % (exonéré)</option>
              </Select>
            </div>
            <div><Label htmlFor="cp-remise-globale">Remise globale (%)</Label><Input id="cp-remise-globale" inputMode="decimal" value={champs.remiseGlobale} onChange={(e) => setChamps({ ...champs, remiseGlobale: e.target.value })} /></div>
          </div>
        </section>

        {/* ── Taxes additionnelles ── */}
        <section className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold">Taxes additionnelles <span className="font-normal text-muted-foreground">(sur le HT, hors base de TVA)</span></h3>
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => setTaxes([...taxes, { id: compteur++, libelle: "Taxe Pub", taux: "2" }])}>Taxe Pub 2 %</Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setTaxes([...taxes, { id: compteur++, libelle: "", taux: "" }])}><Plus className="h-4 w-4" aria-hidden />Taxe</Button>
            </div>
          </div>
          {taxes.map((t) => (
            <div key={t.id} className="grid grid-cols-12 gap-2">
              <div className="col-span-7"><Input aria-label="Libellé de la taxe" value={t.libelle} onChange={(e) => setTaxes(taxes.map((x) => (x.id === t.id ? { ...x, libelle: e.target.value } : x)))} placeholder="Libellé" /></div>
              <div className="col-span-3"><Input aria-label="Taux de la taxe en %" inputMode="decimal" value={t.taux} onChange={(e) => setTaxes(taxes.map((x) => (x.id === t.id ? { ...x, taux: e.target.value } : x)))} placeholder="%" /></div>
              <div className="col-span-2 flex justify-end"><button type="button" className="rounded p-1 text-muted-foreground hover:bg-secondary" aria-label="Retirer la taxe" onClick={() => setTaxes(taxes.filter((x) => x.id !== t.id))}><Trash2 className="h-4 w-4" /></button></div>
            </div>
          ))}
        </section>

        <section>
          <Label htmlFor="cp-notes">Notes (imprimées sous les totaux)</Label>
          <Textarea id="cp-notes" rows={2} value={champs.notes} onChange={(e) => setChamps({ ...champs, notes: e.target.value })} />
        </section>

        {/* ── L'aperçu : ce que la fabrique a calculé, pas le navigateur ── */}
        <section className="rounded-lg border border-border bg-secondary/30 p-3" aria-live="polite">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-semibold">Aperçu</h3>
            {apercu && apercu.ok && (
              <span className="text-xs text-muted-foreground">
                {apercu.societe.nom} · numéro prévu <b>{apercu.numeroProchain}</b> · {apercu.papierEnTete ? `papier « ${apercu.papierEnTete.nom} »` : "sans papier en-tête"} · PDF {apercu.pdfParEditeur ? "par l'éditeur Office" : "rendu du serveur"}
              </span>
            )}
          </div>
          {totaux ? (
            <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4">
              <dt className="text-muted-foreground">Total HT</dt><dd className="text-right tabular-nums">{formatCurrency(totaux.totalHt)}</dd>
              {totaux.taxes.map((x) => (
                <React.Fragment key={x.libelle}>
                  <dt className="text-muted-foreground">{x.libelle} {Math.round(x.taux * 10000) / 100} %</dt><dd className="text-right tabular-nums">{formatCurrency(x.montant)}</dd>
                </React.Fragment>
              ))}
              {totaux.tva.map((x) => (
                <React.Fragment key={x.taux}>
                  <dt className="text-muted-foreground">TVA {Math.round(x.taux * 100)} %</dt><dd className="text-right tabular-nums">{formatCurrency(x.montant)}</dd>
                </React.Fragment>
              ))}
              {totaux.timbre > 0 && <><dt className="text-muted-foreground">Droit de timbre</dt><dd className="text-right tabular-nums">{formatCurrency(totaux.timbre)}</dd></>}
              <dt className="font-semibold">Total TTC</dt><dd className="text-right font-semibold tabular-nums">{formatCurrency(totaux.totalTtc)}</dd>
              <dd className="col-span-2 mt-1 text-xs text-muted-foreground sm:col-span-4">{totaux.enLettres.charAt(0).toUpperCase() + totaux.enLettres.slice(1)}.</dd>
            </dl>
          ) : (
            <p className="mt-1 text-muted-foreground">{pret ? (chargement ? "Calcul en cours…" : "Aucun total : voir ci-dessous.") : "Les totaux apparaissent dès qu'un tiers et une ligne sont saisis."}</p>
          )}
          {bloquants.length > 0 && (
            <ul className="mt-2 list-disc space-y-0.5 pl-5 text-destructive">{bloquants.map((b) => <li key={b}>{b}</li>)}</ul>
          )}
          {apercu && apercu.ok && apercu.avertissements.length > 0 && (
            <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">{apercu.avertissements.map((a) => <li key={a}>{a}</li>)}</ul>
          )}
        </section>

        {/* ── La numérotation, pour ceux qui tiennent la papeterie ── */}
        {props.peutReglerNumerotation && (
          <details className="rounded-lg border border-border p-3">
            <summary className="cursor-pointer font-semibold">Numérotation des {lib.nom.toLowerCase()}s de cette société</summary>
            <p className="mt-1 text-xs text-muted-foreground">
              Jetons : <code>{"{n}"}</code> séquence, <code>{"{n:3}"}</code> sur 3 chiffres, <code>{"{aaaa}"}</code> / <code>{"{aa}"}</code> année, <code>{"{prefixe}"}</code>. Exemples : <code>{"{n:3}/FS/{aa}"}</code> → 001/FS/26 ; <code>{"{n:3}/DG/{aaaa}"}</code> → 012/DG/2026. Vide = <code>{"{prefixe}-{aaaa}-{n:4}"}</code>.
            </p>
            <div className="mt-2 flex gap-2">
              <Input aria-label="Motif de numérotation" value={motif} onChange={(e) => setMotif(e.target.value)} placeholder="{n:3}/FS/{aa}" />
              <Button type="button" variant="outline" onClick={enregistrerMotif} disabled={chargement}>Enregistrer</Button>
            </div>
            {motifMessage && <p className="mt-1 text-xs text-muted-foreground">{motifMessage}</p>}
          </details>
        )}

        {/* ── Le résultat ── */}
        {resultat && (
          <section className={`rounded-lg border p-3 ${resultat.ok ? "border-success/50 bg-success/5" : "border-destructive/50 bg-destructive/5"}`} aria-live="polite">
            <p className="font-medium">{resultat.ok ? resultat.message : resultat.error}</p>
            {resultat.ok && (
              <>
                <div className="mt-2 flex flex-wrap gap-2">
                  {resultat.docxNodeId && <a className="rounded-md border border-border bg-card px-3 py-1.5 hover:bg-secondary" href={`/api/drive/${resultat.docxNodeId}/raw?dl=1`}>Télécharger le Word</a>}
                  {resultat.pdfNodeId && <a className="rounded-md border border-border bg-card px-3 py-1.5 hover:bg-secondary" href={`/api/drive/${resultat.pdfNodeId}/raw`} target="_blank" rel="noreferrer">Ouvrir le PDF</a>}
                  {resultat.pdfNodeId && <a className="rounded-md border border-border bg-card px-3 py-1.5 hover:bg-secondary" href={`/api/drive/${resultat.pdfNodeId}/raw?dl=1`}>Télécharger le PDF</a>}
                  {resultat.legalDocumentId && <a className="rounded-md border border-border bg-card px-3 py-1.5 hover:bg-secondary" href={`/legal/${resultat.legalDocumentId}`}>Fiche au registre</a>}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {resultat.pdfNodeId
                    ? resultat.pdfMethode === "editeur" ? "PDF imprimé par l'éditeur Office du serveur." : "PDF rendu par le serveur : le Word fait foi pour l'impression officielle."
                    : "Aucun PDF n'a pu être produit : le Word fait foi."}
                  {resultat.surPapierEnTete ? " Sur le papier en-tête de la société." : " Sans papier en-tête (mise en page neutre)."}
                </p>
                {resultat.avertissements && resultat.avertissements.length > 0 && (
                  <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">{resultat.avertissements.map((a) => <li key={a}>{a}</li>)}</ul>
                )}
              </>
            )}
          </section>
        )}
      </div>
    </Sheet>
  );
}
