"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, FileText, Loader2, PackageCheck, Pencil, Send, Stethoscope, Trash2, Undo2, Upload, Wand2, X } from "lucide-react";
import {
  genererBonsDeCommandePromo, modifierBonDeCommandePromo, annulerBonDeCommandePromo, marquerBonDeCommandeEnvoye,
  deposerFacturePromo, lireFacturePromo, demanderPaiementFacturePromo, adresserInfoMedicaleFacturePromo,
  receptionnerLigneFacturePromo, annulerReceptionLigneFacturePromo, annulerFacturePromo,
} from "@/lib/actions/promo-execution-actions";
import { formatDzd } from "@/lib/promo-material/devis";
import { designationAvecAction, type PromoAction } from "@/lib/promo-material/actions-fournisseur";
import { ETAT_RECEPTION_LABEL, totauxFacture, type EtatReception, type FamillePromo } from "@/lib/promo-material/achats";
import { familleAValidite, familleQuantifiee } from "@/lib/promo/catalogue";
import { lienFichierEmis } from "@/lib/legal/fichiers-emis";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label, Textarea } from "@/components/ui/input";
import type { ActionResult } from "@/lib/actions/types";
import type { OptionCatalogue } from "@/lib/queries/promo-achats";
import { BoutonDecisif } from "@/components/ui/bouton-decisif";

/**
 * L'EXÉCUTION D'UN DOSSIER DU CIRCUIT 2 — du devis retenu au stock (§118.152, §118.165).
 *
 * Une ligne par devis dont une ligne est retenue, et sur chaque ligne la chaîne ENTIÈRE, dans
 * l'ordre où elle se fait : le bon de commande (généré par la plateforme, validé par un centre
 * au-dessus du seuil, signé par les Finances, envoyé), ses factures DÉTAILLÉES (pré-remplies depuis
 * le BC, écarts mis en évidence, fichier obligatoire), la RÉCEPTION cochée ligne à ligne par le
 * demandeur (ce qui entre au stock), le paiement (après réception — ou malgré une ligne non livrée,
 * avec un renoncement confirmé), et la demande de visa — ou de déclaration au ministère — qui part
 * avec chaque paiement. Un geste n'apparaît que lorsqu'il est possible : un bouton qu'une action
 * refuse fait chercher la panne au lieu de dire ce qu'on attend.
 *
 * Les règles vivent dans les actions et le module pur (`promo-material/achats.ts`) ; l'écran calcule
 * ses totaux par la MÊME arithmétique, et ne fait que montrer ce que les règles permettent.
 */

export type NatureAffichee =
  | { type: "PRESTATION" }
  | { type: "STOCK"; famille: FamillePromo; libelle: string }
  | { type: "A_CHOISIR"; obligatoire: boolean };

export interface LigneFactureAffichee {
  id: string;
  designation: string;
  action: PromoAction | null;
  unite: string | null;
  quantite: number;
  prixUnitaire: number;
  quantiteRecue: number | null;
  renonce: boolean;
  etat: EtatReception;
  nature: NatureAffichee;
  /** Où la ligne est entrée : « Lot 3 — Fiche posologique — Nivolex ». */
  entree: string | null;
}

export interface FactureAffichee {
  id: string;
  reference: string | null;
  montant: number | null;
  date: string | null;
  etatReglement: string;
  reglee: boolean;
  paiementDemande: boolean;
  demandeInfoMedicale: { reference: string; nature: string } | null;
  /** Le fichier déposé (table `Document`) — ouvert par `/api/documents/<id>`. */
  fichierId: string | null;
  /** Le détail ligne à ligne — nul pour une facture d'avant (§118.165). */
  detail: {
    tvaRate: number; extraTaxLabel: string | null; extraTaxRate: number | null; totalImprime: number | null;
    lignes: LigneFactureAffichee[];
  } | null;
}

export interface LigneBCAffichee {
  quoteLineId: string;
  designation: string;
  action: PromoAction | null;
  unite: string | null;
  quantite: number;
  prixUnitaire: number;
  reste: number;
}

export interface ExecutionAffichee {
  quoteId: string;
  fournisseur: string;
  reference: string | null;
  lignes: number;
  ttc: number;
  bc: { id: string; reference: string | null; montant: number | null; etape: string; libelleEtape: string; pdf: boolean; docx: boolean } | null;
  envoyeLe: string | null;
  factures: FactureAffichee[];
  /** Les lignes du BC et ce qui reste à facturer — ce que la facture pré-remplit. */
  lignesBC: LigneBCAffichee[];
  /** Les taxes du devis (donc du BC) — reprises par la facture, corrigeables. */
  taxes: { tvaRate: number; extraTaxLabel: string | null; extraTaxRate: number | null };
}

interface Props {
  id: string;
  executions: ExecutionAffichee[];
  /** Le demandeur, l'assistante de direction, la Direction — tranché au serveur. */
  canPilot: boolean;
  /** Le demandeur (le Super Admin en suppléance) coche la réception — tranché au serveur. */
  canReceive: boolean;
  /** Le dossier est en exécution (toutes les validations obtenues). */
  ouvert: boolean;
  /** Le catalogue et les produits, pour une ligne « en plus » qui choisit son article à la réception. */
  optionsReception: { catalogue: OptionCatalogue[]; produits: { id: string; nom: string }[] } | null;
}

function useRun() {
  const router = useRouter();
  const [saving, setSaving] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [msg, setMsg] = React.useState<string | null>(null);
  const run = async (fn: () => Promise<ActionResult>, after?: () => void) => {
    setSaving(true); setErr(null); setMsg(null);
    const r = await fn();
    setSaving(false);
    if (r.ok) { setMsg(r.message ?? null); after?.(); router.refresh(); } else setErr(r.error ?? "Action impossible.");
  };
  return { saving, err, msg, run };
}

const Erreur = ({ msg }: { msg: string | null }) =>
  msg ? <div className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> <span>{msg}</span></div> : null;
const Info = ({ msg }: { msg: string | null }) =>
  msg ? <div className="flex items-start gap-2 rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> <span>{msg}</span></div> : null;

const lien = "inline-flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1 text-xs hover:bg-secondary";
const nombre = (n: number) => n.toLocaleString("fr-FR", { maximumFractionDigits: 3 });
const lire = (s: string): number => (s.trim() === "" ? 0 : Number(s.replace(/\s/g, "").replace(",", ".")));
const TON_ETAT: Record<EtatReception, "neutral" | "success" | "warning" | "danger"> = {
  EN_ATTENTE: "warning", RECUE: "success", PARTIELLE: "warning", NON_LIVREE: "danger", RELIQUAT_RENONCE: "neutral",
};

/** Choix de la formalité qui accompagne un paiement — visa publicitaire ou déclaration au ministère. */
function ChoixFormalite({ name }: { name: string }) {
  return (
    <select name={name} required defaultValue="" className="h-9 rounded-md border border-input bg-background px-2 text-sm" aria-label="Formalité à l'information médicale">
      <option value="" disabled>Formalité…</option>
      <option value="AD_VISA">Demande de visa publicitaire</option>
      <option value="MIP">Déclaration au ministère</option>
    </select>
  );
}

// ───────────────────────── Le dépôt d'une facture détaillée ─────────────────────────

function DepotFacture({ id, e, onDone, onCancel }: { id: string; e: ExecutionAffichee; onDone: () => void; onCancel: () => void }) {
  const { saving, err, run } = useRun();
  const aFacturer = e.lignesBC.filter((l) => l.reste > 0);
  const [saisies, setSaisies] = React.useState(() => aFacturer.map((l) => ({ quoteLineId: l.quoteLineId, quantite: String(l.reste), prix: String(l.prixUnitaire), lue: null as number | null, verifiee: false })));
  // LA LECTURE PAR LUNA (lot D2-F) : elle PROPOSE ; chaque ligne reportée se coche « vérifiée » après
  // comparaison au papier, et le dépôt refuse tant que ce n'est pas fait.
  const fichierRef = React.useRef<HTMLInputElement>(null);
  const [lecture, setLecture] = React.useState<Awaited<ReturnType<typeof lireFacturePromo>>["lecture"] | null>(null);
  const [lectureMsg, setLectureMsg] = React.useState<string | null>(null);
  const [lit, setLit] = React.useState(false);
  const [reference, setReference] = React.useState("");
  const [montant, setMontant] = React.useState("");
  const lireAvecLuna = async () => {
    const f = fichierRef.current?.files?.[0];
    if (!f) { setLectureMsg("Choisissez d'abord le fichier de la facture."); return; }
    setLit(true); setLectureMsg(null);
    const fd = new FormData(); fd.set("promoMaterialId", id); fd.set("quoteId", e.quoteId); fd.set("file", f);
    const r = await lireFacturePromo(fd).catch(() => ({ ok: false as const, error: "La lecture n'a pas abouti — saisissez depuis le papier." }));
    setLit(false);
    if (!r.ok || !r.lecture) { setLectureMsg(r.ok ? "Aucune lecture rendue." : (r.error ?? "La lecture n'a pas abouti.")); return; }
    const lu = r.lecture;
    setLecture(lu); setLectureMsg(r.message ?? null);
    if (lu.prerempli.reference) setReference(lu.prerempli.reference);
    if (lu.prerempli.totalImprime != null) setMontant(String(lu.prerempli.totalImprime));
    setSaisies((ss) => ss.map((s) => {
      const l = lu.prerempli.lignes.find((x) => x.quoteLineId === s.quoteLineId);
      return l ? { ...s, quantite: l.quantite != null ? String(l.quantite) : s.quantite, prix: l.prixUnitaire != null ? String(l.prixUnitaire) : s.prix, lue: l.rang, verifiee: false }
        : { ...s, quantite: "0", lue: null, verifiee: false };
    }));
  };
  const [tva, setTva] = React.useState(String(e.taxes.tvaRate));
  const [taxe, setTaxe] = React.useState(e.taxes.extraTaxRate != null ? String(e.taxes.extraTaxRate) : "");
  const maj = (i: number, k: "quantite" | "prix" | "verifiee", v: string | boolean) => setSaisies((ss) => ss.map((s, j) => (j === i ? { ...s, [k]: v } : s)));
  const totaux = totauxFacture(
    { tvaRate: lire(tva) || 0, extraTaxRate: taxe.trim() ? lire(taxe) : null },
    saisies.map((s) => ({ quantite: lire(s.quantite) || 0, prixUnitaire: lire(s.prix) || 0 })).filter((s) => s.quantite > 0),
  );

  if (aFacturer.length === 0) {
    return (
      <div className="rounded-lg border border-border p-3 text-sm text-muted-foreground">
        Tout ce bon de commande est déjà facturé. <Button type="button" size="sm" variant="ghost" onClick={onCancel}>Fermer</Button>
      </div>
    );
  }
  return (
    <form
      className="space-y-3 rounded-lg border border-border p-3"
      action={(f: FormData) => { f.set("promoMaterialId", id); f.set("quoteId", e.quoteId); run(() => deposerFacturePromo(f), onDone); }}
    >
      <p className="text-xs text-muted-foreground">
        Les lignes du bon de commande, pré-remplies avec ce qui reste à facturer : corrigez la quantité et le prix pour coller à la facture
        (une ligne absente de cette facture : mettez 0). Les écarts avec le BC sont signalés ; on ne facture pas plus que commandé.
      </p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <div><Label htmlFor={`fa-ref-${e.quoteId}`}>N° de facture *</Label><Input id={`fa-ref-${e.quoteId}`} name="reference" required value={reference} onChange={(ev) => setReference(ev.target.value)} /></div>
        <div><Label htmlFor={`fa-date-${e.quoteId}`}>Date</Label><Input id={`fa-date-${e.quoteId}`} name="invoiceDate" type="date" /></div>
        <div><Label htmlFor={`fa-file-${e.quoteId}`}>Fichier de la facture *</Label><Input ref={fichierRef} id={`fa-file-${e.quoteId}`} name="file" type="file" required accept=".pdf,.png,.jpg,.jpeg,.doc,.docx" onChange={() => { setLecture(null); setSaisies((ss) => ss.map((x) => ({ ...x, lue: null, verifiee: false }))); }} /></div>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Button type="button" size="sm" variant="outline" onClick={lireAvecLuna} disabled={lit || saving}>{lit ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Lire avec Luna</Button>
        <span className="text-muted-foreground">Luna lit la facture et préremplit les lignes du BC ; vous vérifiez chacune contre le papier.</span>
      </div>
      {lectureMsg && <p className="text-xs">{lectureMsg}</p>}
      {lecture && (
        <div className="space-y-1 rounded-md border border-border bg-muted/40 p-2 text-xs">
          <input type="hidden" name="lectureId" value={lecture.lectureId} />
          <p className="text-muted-foreground">{lecture.noteMethode}</p>
          {lecture.prerempli.desaccordTotal && <p className="text-amber-700 dark:text-amber-400">{lecture.prerempli.desaccordTotal}</p>}
          {lecture.prerempli.lignes.filter((l) => !l.quoteLineId).map((l) => <p key={l.rang} className="text-amber-700 dark:text-amber-400">{l.phrase ?? `« ${l.designation} » : non reportée.`}</p>)}
          <label className="flex items-center gap-2"><input type="checkbox" name="totalVerifie" value="on" /> Total vérifié contre le papier</label>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[620px] text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th className="py-1 pr-2 font-medium">Ligne du BC</th>
              <th className="py-1 pr-2 text-right font-medium">Reste au BC</th>
              <th className="py-1 pr-2 font-medium">Quantité facturée</th>
              <th className="py-1 pr-2 font-medium">Prix unitaire HT</th>
              <th className="py-1 text-right font-medium">Total HT</th>
            </tr>
          </thead>
          <tbody>
            {aFacturer.map((l, i) => {
              const s = saisies[i];
              const q = lire(s.quantite); const p = lire(s.prix);
              const ecartQ = Number.isFinite(q) && Math.abs(q - l.reste) > 0.0005;
              const ecartP = Number.isFinite(p) && Math.abs(p - l.prixUnitaire) > 0.005;
              const trop = Number.isFinite(q) && q > l.reste + 0.0005;
              return (
                <tr key={l.quoteLineId} className="border-t border-border align-top">
                  <td className="py-1 pr-2">
                    <input type="hidden" name="ligneQuoteLineId" value={l.quoteLineId} />
                    <input type="hidden" name="ligneDesignation" value={l.designation} />
                    <input type="hidden" name="ligneLue" value={s.lue ?? ""} />
                    <input type="hidden" name="ligneVerifiee" value={s.verifiee ? "1" : "0"} />
                    {designationAvecAction(l.designation, l.action)}
                    {s.lue !== null && (
                      <label className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                        <input type="checkbox" checked={s.verifiee} onChange={(ev) => maj(i, "verifiee", ev.target.checked)} /> lue par Luna — vérifiée
                      </label>
                    )}
                  </td>
                  <td className="py-1 pr-2 text-right tabular-nums text-muted-foreground">{nombre(l.reste)}{l.unite ? ` ${l.unite}` : ""}</td>
                  <td className="py-1 pr-2">
                    <Input name="ligneQuantite" value={s.quantite} onChange={(ev) => maj(i, "quantite", ev.target.value)} inputMode="decimal" aria-label={`Quantité facturée — ${l.designation}`}
                      className={`w-28 ${trop ? "border-destructive" : ecartQ ? "border-amber-500" : ""}`} />
                    {trop && <span className="block text-xs text-destructive">plus que le reste au BC</span>}
                    {!trop && ecartQ && <span className="block text-xs text-amber-700 dark:text-amber-400">≠ reste au BC</span>}
                  </td>
                  <td className="py-1 pr-2">
                    <Input name="lignePrix" value={s.prix} onChange={(ev) => maj(i, "prix", ev.target.value)} inputMode="decimal" aria-label={`Prix unitaire — ${l.designation}`}
                      className={`w-32 ${ecartP ? "border-amber-500" : ""}`} />
                    {ecartP && <span className="block text-xs text-amber-700 dark:text-amber-400">BC : {formatDzd(l.prixUnitaire)}</span>}
                  </td>
                  <td className="py-1 text-right tabular-nums">{Number.isFinite(q * p) ? formatDzd(Math.round(q * p * 100) / 100) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
        <div><Label htmlFor={`fa-tva-${e.quoteId}`}>TVA (%)</Label><Input id={`fa-tva-${e.quoteId}`} name="tvaRate" value={tva} onChange={(ev) => setTva(ev.target.value)} inputMode="decimal" /></div>
        <div><Label htmlFor={`fa-taxe-${e.quoteId}`}>{e.taxes.extraTaxLabel ?? "Taxe additionnelle"} (%)</Label><Input id={`fa-taxe-${e.quoteId}`} name="extraTaxRate" value={taxe} onChange={(ev) => setTaxe(ev.target.value)} inputMode="decimal" placeholder="vide = aucune" /></div>
        {e.taxes.extraTaxLabel && <input type="hidden" name="extraTaxLabel" value={e.taxes.extraTaxLabel} />}
        <div className="sm:col-span-2">
          <Label htmlFor={`fa-mt-${e.quoteId}`}>Total TTC imprimé sur la facture *</Label>
          <Input id={`fa-mt-${e.quoteId}`} name="amount" inputMode="decimal" required placeholder={formatDzd(totaux.ttc)} value={montant} onChange={(ev) => setMontant(ev.target.value)} />
        </div>
      </div>
      <p className="text-sm">
        Calculé : HT <strong className="tabular-nums">{formatDzd(totaux.ht)}</strong> · TVA {formatDzd(totaux.tva)}
        {totaux.taxe ? ` · ${e.taxes.extraTaxLabel ?? "Taxe"} ${formatDzd(totaux.taxe)}` : ""} · <strong className="tabular-nums">{formatDzd(totaux.ttc)} TTC</strong>
        <span className="text-muted-foreground"> — le total imprimé doit tomber dessus à un dinar près.</span>
      </p>
      <Erreur msg={err} />
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Enregistrer la facture</Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel} disabled={saving}>Annuler</Button>
      </div>
    </form>
  );
}

// ───────────────────────── La réception d'une ligne ─────────────────────────

function ReceptionLigne({ id, l, options, run, saving }: {
  id: string; l: LigneFactureAffichee;
  options: Props["optionsReception"];
  run: (fn: () => Promise<ActionResult>, after?: () => void) => Promise<void>;
  saving: boolean;
}) {
  const [ouvert, setOuvert] = React.useState(false);
  const [catalogueId, setCatalogueId] = React.useState("");
  const choisi = options?.catalogue.find((c) => c.id === catalogueId) ?? null;
  const famille: FamillePromo | null = l.nature.type === "STOCK" ? l.nature.famille : choisi?.famille ?? null;
  const prestation = l.nature.type === "PRESTATION" || (l.nature.type === "A_CHOISIR" && !catalogueId);
  const numerique = famille != null && !familleQuantifiee(famille);

  if (!ouvert) {
    return (
      <Button type="button" size="sm" variant="outline" disabled={saving} onClick={() => setOuvert(true)}>
        <PackageCheck className="h-4 w-4" /> {l.nature.type === "PRESTATION" ? "Faite" : "Réceptionner"}
      </Button>
    );
  }
  return (
    <form
      className="mt-2 space-y-2 rounded-md border border-border bg-background p-2"
      action={(f: FormData) => { f.set("promoMaterialId", id); f.set("ligneId", l.id); run(() => receptionnerLigneFacturePromo(f), () => setOuvert(false)); }}
    >
      {l.nature.type === "A_CHOISIR" && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div>
            <Label htmlFor={`rc-cat-${l.id}`}>{l.nature.obligatoire ? "Article du catalogue qui reçoit *" : "Article du catalogue (vide = prestation)"}</Label>
            <select id={`rc-cat-${l.id}`} name="catalogueId" value={catalogueId} onChange={(ev) => setCatalogueId(ev.target.value)} required={l.nature.obligatoire}
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
              <option value="">{l.nature.obligatoire ? "Choisir…" : "Aucun — c'est une prestation"}</option>
              {(options?.catalogue ?? []).map((c) => <option key={c.id} value={c.id}>{c.reference} — {c.nom}</option>)}
            </select>
          </div>
          {catalogueId && (
            <div>
              <Label htmlFor={`rc-prod-${l.id}`}>Produit(s){choisi?.exigeProduit ? " *" : ""}</Label>
              <select id={`rc-prod-${l.id}`} name="produitIds" multiple className="h-20 w-full rounded-md border border-input bg-background px-2 text-sm">
                {(options?.produits ?? []).map((p) => <option key={p.id} value={p.id}>{p.nom}</option>)}
              </select>
            </div>
          )}
        </div>
      )}
      <div className="flex flex-wrap items-end gap-2">
        {!numerique && (
          <div>
            <Label htmlFor={`rc-q-${l.id}`}>{prestation ? "Quantité faite" : "Quantité reçue"}</Label>
            <Input id={`rc-q-${l.id}`} name="quantiteRecue" defaultValue={String(l.quantite)} inputMode="decimal" className="w-28" />
          </div>
        )}
        {!prestation && famille != null && familleAValidite(famille) && (
          <div><Label htmlFor={`rc-v-${l.id}`}>Fin de validité</Label><Input id={`rc-v-${l.id}`} name="valableJusquau" type="date" /></div>
        )}
        {numerique && (
          <>
            <div><Label htmlFor={`rc-l-${l.id}`}>Lien du support</Label><Input id={`rc-l-${l.id}`} name="lien" placeholder="https://…" /></div>
            <div><Label htmlFor={`rc-v-${l.id}`}>Valable jusqu&apos;au</Label><Input id={`rc-v-${l.id}`} name="valableJusquau" type="date" /></div>
          </>
        )}
        <Button type="submit" size="sm" disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Confirmer</Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOuvert(false)} disabled={saving}><X className="h-4 w-4" /></Button>
      </div>
      <p className="text-xs text-muted-foreground">
        {prestation
          ? "Une prestation : elle est cochée « faite », rien n'entre au stock."
          : numerique
            ? "Un support numérique : son lien et sa validité vont au stock, sans quantité."
            : `Ce qui est reçu entre au magasin central${l.nature.type === "STOCK" ? ` (${l.nature.libelle})` : ""}, en un lot au coût de la facture. Rien n'est arrivé ? Ne cochez rien : au paiement, vous pourrez y renoncer.`}
      </p>
    </form>
  );
}

// ───────────────────────── Une facture ─────────────────────────

function Facture({ id, f, agir, canReceive, options }: {
  id: string; f: FactureAffichee; agir: boolean; canReceive: boolean; options: Props["optionsReception"];
}) {
  const { saving, err, msg, run } = useRun();
  const [annulation, setAnnulation] = React.useState(false);
  const detail = f.detail;
  const enAttente = detail ? detail.lignes.filter((l) => l.etat === "EN_ATTENTE" || l.etat === "PARTIELLE") : [];
  const recues = detail ? detail.lignes.filter((l) => l.quantiteRecue != null).length : 0;
  const receptionOuverte = canReceive && !f.paiementDemande;

  const demanderPaiement = (fd: FormData) => {
    fd.set("promoMaterialId", id); fd.set("invoiceId", f.id);
    if (enAttente.length > 0) {
      // LA CONFIRMATION QUE LA DIRECTION A DEMANDÉE (§118.165) : renoncer est définitif.
      const ok = confirm(
        `${enAttente.length} ligne(s) ne sont pas reçues en entier : ${enAttente.map((l) => `« ${l.designation} »`).join(", ")}.\n\n`
        + "Êtes-vous sûr de demander le paiement quand même ? On ne paiera que ce qui a été reçu, et un paiement pour ces lignes ne pourra pas être fait ultérieurement.",
      );
      if (!ok) return;
      fd.set("confirmeRenoncement", "1");
    }
    run(() => demanderPaiementFacturePromo(fd));
  };

  return (
    <div className="space-y-2 rounded-md bg-muted/40 px-3 py-2 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium">Facture {f.reference ?? "sans numéro"}{f.montant != null ? ` — ${formatDzd(f.montant)} TTC` : ""}</p>
          <p className="text-xs text-muted-foreground">
            {f.date ? `du ${new Date(f.date).toLocaleDateString("fr-FR")} · ` : ""}{f.etatReglement}
            {f.demandeInfoMedicale ? ` · ${f.demandeInfoMedicale.nature} ${f.demandeInfoMedicale.reference}` : ""}
            {detail && enAttente.length > 0 && !f.paiementDemande ? ` · ${enAttente.length} ligne(s) à réceptionner` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {f.fichierId && <a className={lien} href={`/api/documents/${f.fichierId}`} target="_blank" rel="noreferrer"><FileText className="h-3.5 w-3.5" /> Fichier</a>}
          {agir && !f.paiementDemande && recues === 0 && !annulation && (
            <Button size="sm" variant="ghost" disabled={saving} onClick={() => setAnnulation(true)}><Trash2 className="h-4 w-4" /> Annuler la facture</Button>
          )}
        </div>
      </div>

      {detail && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-xs">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="py-1 pr-2 font-medium">Ligne</th>
                <th className="py-1 pr-2 text-right font-medium">Facturé</th>
                <th className="py-1 pr-2 text-right font-medium">PU HT</th>
                <th className="py-1 pr-2 font-medium">Réception</th>
              </tr>
            </thead>
            <tbody>
              {detail.lignes.map((l) => (
                <tr key={l.id} className="border-t border-border align-top">
                  <td className="py-1 pr-2">
                    {designationAvecAction(l.designation, l.action)}
                    {l.entree && <span className="block text-muted-foreground">Entré au magasin : {l.entree}</span>}
                  </td>
                  <td className="py-1 pr-2 text-right tabular-nums">{nombre(l.quantite)}{l.unite ? ` ${l.unite}` : ""}</td>
                  <td className="py-1 pr-2 text-right tabular-nums">{formatDzd(l.prixUnitaire)}</td>
                  <td className="py-1 pr-2">
                    <Badge tone={TON_ETAT[l.etat]}>{l.nature.type === "PRESTATION" && l.etat === "RECUE" ? "Faite" : ETAT_RECEPTION_LABEL[l.etat]}</Badge>
                    {l.quantiteRecue != null && l.etat !== "RECUE" && <span className="ml-1 tabular-nums text-muted-foreground">{nombre(l.quantiteRecue)} reçue(s)</span>}
                    {receptionOuverte && l.etat === "EN_ATTENTE" && <div className="mt-1"><ReceptionLigne id={id} l={l} options={options} run={run} saving={saving} /></div>}
                    {receptionOuverte && l.quantiteRecue != null && (
                      <Button size="sm" variant="ghost" className="mt-1" disabled={saving}
                        onClick={() => {
                          // UN MOTIF, pas une simple confirmation (audit 360°, R17) : le journal doit dire si
                          // c'était une erreur de saisie ou une marchandise renvoyée. Abandonner la boîte ne fait rien.
                          const motif = window.prompt(`Pourquoi annuler la réception de « ${l.designation} » ?${l.entree ? " Son entrée au magasin sera contre-passée." : ""} (obligatoire)`);
                          if (motif === null || !motif.trim()) return;
                          const fd = new FormData(); fd.set("promoMaterialId", id); fd.set("ligneId", l.id); fd.set("motif", motif.trim());
                          run(() => annulerReceptionLigneFacturePromo(fd));
                        }}>
                        <Undo2 className="h-3.5 w-3.5" /> Annuler la réception
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-1 text-muted-foreground">
            TVA {detail.tvaRate} %{detail.extraTaxRate ? ` · ${detail.extraTaxLabel ?? "Taxe"} ${detail.extraTaxRate} %` : ""}
            {detail.lignes.some((l) => l.action === null) ? " · lignes d'avant le vocabulaire des actions : la réception dit si elles entrent au stock" : ""}
          </p>
        </div>
      )}

      {annulation && (
        <form className="space-y-2 rounded-md border border-destructive/30 p-2" action={(fd: FormData) => { fd.set("promoMaterialId", id); fd.set("invoiceId", f.id); run(() => annulerFacturePromo(fd), () => setAnnulation(false)); }}>
          <Label htmlFor={`fa-ann-${f.id}`}>Pourquoi annuler cette facture ?</Label>
          <Textarea id={`fa-ann-${f.id}`} name="motif" required className="min-h-[50px]" placeholder="Doublon, facture erronée, rien n'a été livré… Elle reste au registre (annulée), avec ce motif." />
          <div className="flex gap-2">
            <BoutonDecisif type="submit" size="sm" variant="destructive" disabled={saving}>Annuler la facture</BoutonDecisif>
            <Button type="button" size="sm" variant="ghost" onClick={() => setAnnulation(false)} disabled={saving}>Garder</Button>
          </div>
        </form>
      )}

      {agir && !f.paiementDemande && (
        <form className="flex flex-wrap items-center gap-2" action={demanderPaiement}>
          <ChoixFormalite name="formalite" />
          {enAttente.length > 0 && <Input name="motifRenoncement" required aria-label="Motif du renoncement" placeholder="Motif (obligatoire) — ligne non livrée" className="w-64" />}
          <BoutonDecisif type="submit" size="sm" variant={enAttente.length > 0 ? "outline" : "primary"} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {enAttente.length > 0 ? " Demander le paiement malgré tout" : " Demander le paiement"}
          </BoutonDecisif>
          {enAttente.length > 0 && (
            <span className="w-full text-xs text-amber-700 dark:text-amber-400">
              Le paiement attend que tout soit reçu. Le demander maintenant, c&apos;est renoncer à payer ce qui manque — définitivement.
            </span>
          )}
        </form>
      )}
      {agir && f.paiementDemande && !f.demandeInfoMedicale && (
        <form className="flex flex-wrap items-center gap-2" action={(fd: FormData) => { fd.set("promoMaterialId", id); fd.set("invoiceId", f.id); run(() => adresserInfoMedicaleFacturePromo(fd)); }}>
          <ChoixFormalite name="formalite" />
          <Button type="submit" size="sm" variant="outline" disabled={saving}><Stethoscope className="h-4 w-4" /> Adresser à l&apos;information médicale</Button>
        </form>
      )}
      <Erreur msg={err} />
      <Info msg={msg} />
    </div>
  );
}

// ───────────────────────── Une ligne d'exécution (un devis retenu) ─────────────────────────

function LigneExecution({ id, e, canPilot, canReceive, ouvert, options }: {
  id: string; e: ExecutionAffichee; canPilot: boolean; canReceive: boolean; ouvert: boolean; options: Props["optionsReception"];
}) {
  const { saving, err, msg, run } = useRun();
  const [mode, setMode] = React.useState<"modifier" | "supprimer" | "facture" | null>(null);
  const bc = e.bc;
  const signe = bc?.etape === "SIGNE";
  const fige = e.factures.length > 0;
  const agir = canPilot && ouvert;
  const resteAFacturer = e.lignesBC.some((l) => l.reste > 0);
  const form = (extra: Record<string, string>) => { const f = new FormData(); f.set("promoMaterialId", id); f.set("quoteId", e.quoteId); for (const [k, v] of Object.entries(extra)) f.set(k, v); return f; };

  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium">{e.fournisseur}</p>
          <p className="text-xs text-muted-foreground">
            {e.reference ? `Devis n° ${e.reference} · ` : ""}{e.lignes} ligne{e.lignes > 1 ? "s" : ""} retenue{e.lignes > 1 ? "s" : ""} · {formatDzd(e.ttc)} TTC
          </p>
        </div>
        {bc
          ? <Badge tone={signe ? "success" : bc.etape === "A_REVOIR" ? "danger" : "info"}>{bc.reference ? `BC ${bc.reference} — ` : "BC — "}{bc.libelleEtape}</Badge>
          : <Badge tone="warning">Bon de commande à générer</Badge>}
      </div>

      {bc && (
        <div className="flex flex-wrap items-center gap-2">
          {bc.pdf && <a className={lien} href={lienFichierEmis(bc.id, "pdf")} target="_blank" rel="noreferrer"><FileText className="h-3.5 w-3.5" /> PDF</a>}
          {bc.docx && <a className={lien} href={lienFichierEmis(bc.id, "docx", true)}><FileText className="h-3.5 w-3.5" /> Word</a>}
          <a className={lien} href={lienFichierEmis(bc.id, "xlsx", true)} aria-label="Générer ce bon de commande sur Excel"><FileText className="h-3.5 w-3.5" /> Excel</a>
          {bc.montant != null && <span className="text-xs text-muted-foreground">{formatDzd(bc.montant)} TTC</span>}
          {e.envoyeLe
            ? <Badge tone="success">Envoyé le {new Date(e.envoyeLe).toLocaleDateString("fr-FR")}</Badge>
            : signe
              ? (agir && <Button size="sm" variant="outline" disabled={saving} onClick={() => run(() => marquerBonDeCommandeEnvoye(form({})))}><Send className="h-4 w-4" /> Marquer envoyé au fournisseur</Button>)
              : <span className="text-xs text-muted-foreground">Il part chez le fournisseur une fois signé par les Finances.</span>}
          {agir && !fige && mode === null && (
            <>
              <Button size="sm" variant="ghost" disabled={saving} onClick={() => setMode("modifier")}><Pencil className="h-4 w-4" /> Modifier</Button>
              <Button size="sm" variant="ghost" disabled={saving} onClick={() => setMode("supprimer")}><Trash2 className="h-4 w-4" /> Supprimer</Button>
            </>
          )}
        </div>
      )}

      {mode === "modifier" && bc && (
        <form className="space-y-2 rounded-lg border border-border p-3" action={(f: FormData) => { f.set("promoMaterialId", id); f.set("quoteId", e.quoteId); run(() => modifierBonDeCommandePromo(f), () => setMode(null)); }}>
          <p className="text-xs text-muted-foreground">Renseignez ce qui change : un champ laissé vide garde sa valeur. Les lignes ne se modifient pas — elles sont ce qui a été validé. Une modification retire la signature des Finances : la pièce est à signer de nouveau.</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div><Label htmlFor={`bc-adr-${e.quoteId}`}>Adresse de livraison</Label><Input id={`bc-adr-${e.quoteId}`} name="livraisonAdresse" /></div>
            <div><Label htmlFor={`bc-del-${e.quoteId}`}>Délai de livraison</Label><Input id={`bc-del-${e.quoteId}`} name="livraisonDelai" placeholder="15 jours" /></div>
            <div><Label htmlFor={`bc-cn-${e.quoteId}`}>Interlocuteur</Label><Input id={`bc-cn-${e.quoteId}`} name="contactNom" /></div>
            <div><Label htmlFor={`bc-ct-${e.quoteId}`}>Téléphone</Label><Input id={`bc-ct-${e.quoteId}`} name="contactTelephone" /></div>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div><Label htmlFor={`bc-taxe-${e.quoteId}`}>Taxe supplémentaire (libellé)</Label><Input id={`bc-taxe-${e.quoteId}`} name="extraTaxLabel" placeholder="Taxe Pub" /></div>
            <div><Label htmlFor={`bc-taux-${e.quoteId}`}>Taux (%) — 0 la retire</Label><Input id={`bc-taux-${e.quoteId}`} name="extraTaxRate" inputMode="decimal" placeholder="2" /></div>
          </div>
          <div><Label htmlFor={`bc-notes-${e.quoteId}`}>Notes</Label><Textarea id={`bc-notes-${e.quoteId}`} name="notes" className="min-h-[50px]" /></div>
          <div><Label htmlFor={`bc-motif-${e.quoteId}`}>Motif de la modification</Label><Input id={`bc-motif-${e.quoteId}`} name="motif" /></div>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Enregistrer</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setMode(null)} disabled={saving}>Annuler</Button>
          </div>
        </form>
      )}

      {mode === "supprimer" && bc && (
        <form className="space-y-2 rounded-lg border border-destructive/30 p-3" action={(f: FormData) => { f.set("promoMaterialId", id); f.set("quoteId", e.quoteId); run(() => annulerBonDeCommandePromo(f), () => setMode(null)); }}>
          <Label htmlFor={`bc-sup-${e.quoteId}`}>Pourquoi supprimer ce bon de commande ?</Label>
          <Textarea id={`bc-sup-${e.quoteId}`} name="motif" required className="min-h-[50px]" placeholder="Son numéro reste au registre (annulé), avec ce motif." />
          <div className="flex gap-2">
            <BoutonDecisif type="submit" size="sm" variant="destructive" disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Supprimer le BC</BoutonDecisif>
            <Button type="button" size="sm" variant="ghost" onClick={() => setMode(null)} disabled={saving}>Annuler</Button>
          </div>
        </form>
      )}

      {/* LES FACTURES DE CE BC — détaillées, chacune avec sa réception, son paiement et sa formalité. */}
      {bc && (e.factures.length > 0 || signe) && (
        <div className="space-y-2">
          {e.factures.map((f) => <Facture key={f.id} id={id} f={f} agir={agir} canReceive={canReceive && ouvert} options={options} />)}
          {agir && signe && resteAFacturer && mode !== "facture" && (
            <Button size="sm" variant="outline" disabled={saving} onClick={() => setMode("facture")}><Upload className="h-4 w-4" /> Déposer une facture</Button>
          )}
          {mode === "facture" && <DepotFacture id={id} e={e} onDone={() => setMode(null)} onCancel={() => setMode(null)} />}
        </div>
      )}

      <Erreur msg={err} />
      <Info msg={msg} />
    </div>
  );
}

export function PromoExecutionCard({ id, executions, canPilot, canReceive, ouvert, optionsReception }: Props) {
  const { saving, err, msg, run } = useRun();
  const [options, setOptions] = React.useState(false);
  const aGenerer = executions.filter((e) => !e.bc).length;

  return (
    <div className="space-y-3">
      {executions.length === 0 && <p className="text-sm text-muted-foreground">Aucune ligne de devis n&apos;est retenue.</p>}

      {canPilot && ouvert && aGenerer > 0 && (
        <div className="space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
          <p className="text-sm">
            {/* LES BC SE GÉNÈRENT D'EUX-MÊMES à la dernière validation (§118.204) : ce cadre n'apparaît que pour
                ce que la génération automatique n'a pas pu émettre — le geste de repli, avec livraison et taxe. */}
            <strong>{aGenerer}</strong> bon{aGenerer > 1 ? "s" : ""} de commande n&apos;{aGenerer > 1 ? "ont" : "a"} pas pu être généré{aGenerer > 1 ? "s" : ""} automatiquement à la dernière validation — un par fournisseur, composé{aGenerer > 1 ? "s" : ""} par la plateforme d&apos;après les lignes validées. Relancez la génération (le message dira ce qui bloque).
          </p>
          <form className="space-y-2" action={(f: FormData) => { f.set("promoMaterialId", id); run(() => genererBonsDeCommandePromo(f)); }}>
            {/* LA CASE DES TAXES SUPPLÉMENTAIRES, toujours visible : « Taxe Pub 2 % » sur le HT, hors base de TVA. Vide = celle de chaque devis ; 0 = aucune. */}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_9rem]">
              <div><Label htmlFor="gen-taxe">Taxe supplémentaire (libellé)</Label><Input id="gen-taxe" name="extraTaxLabel" placeholder="Taxe Pub" /></div>
              <div><Label htmlFor="gen-taux">Taux (%)</Label><Input id="gen-taux" name="extraTaxRate" inputMode="decimal" placeholder="2" /></div>
              <p className="text-xs text-muted-foreground sm:col-span-2">Calculée sur le HT, hors base de TVA. Vide : on garde celle de chaque devis ; 0 : aucune.</p>
            </div>
            {options && (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div><Label htmlFor="gen-adr">Adresse de livraison</Label><Input id="gen-adr" name="livraisonAdresse" /></div>
                <div><Label htmlFor="gen-del">Délai de livraison</Label><Input id="gen-del" name="livraisonDelai" placeholder="15 jours" /></div>
                <div className="sm:col-span-2"><Label htmlFor="gen-notes">Notes</Label><Textarea id="gen-notes" name="notes" className="min-h-[50px]" /></div>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <BoutonDecisif type="submit" size="sm" disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />} Générer les bons de commande manquants</BoutonDecisif>
              {!options && <Button type="button" size="sm" variant="ghost" onClick={() => setOptions(true)}>Livraison et notes…</Button>}
            </div>
          </form>
        </div>
      )}

      <Erreur msg={err} />
      <Info msg={msg} />

      {executions.map((e) => (
        <LigneExecution key={e.quoteId} id={id} e={e} canPilot={canPilot} canReceive={canReceive} ouvert={ouvert} options={optionsReception} />
      ))}
    </div>
  );
}

