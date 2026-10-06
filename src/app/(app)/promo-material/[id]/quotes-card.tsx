"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, FileText, Loader2, Pencil, Plus, RotateCcw, ScanText, Send, Trash2, Undo2 } from "lucide-react";
import {
  enregistrerDevisPromo, supprimerDevisPromo, terminerRetranscriptionPromo, choisirLignesPromo, demanderCorrectionDevisPromo,
  redemanderDevisPromo, lireScanDevisPromo, rangerDevisPromo,
} from "@/lib/actions/promo-devis-actions";
import type { LectureDevisPromo, LignePreremplie } from "@/lib/pieces-lues/prerempli-devis-promo";
import { LigneLue } from "@/components/pieces/ligne-lue";
import { NoteDeLecture } from "@/components/pieces/note-de-lecture";
import { totauxDeLaSelection, totauxDuDevis, totalLigneHT, ecartDeRetranscription, formatDzd, type DevisLu } from "@/lib/promo-material/devis";
import { ACTIONS, ACTION_LABEL, type PromoAction } from "@/lib/promo-material/actions-fournisseur";
import { libelleArticleDemande, libellesPromusDeLArticle, rapprocher, type ArticleDemandeLu } from "@/lib/promo-material/achats";
import type { PartyOption } from "@/lib/contacts/parties";
import { PartyPicker } from "@/components/directory/party-picker";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label, Textarea } from "@/components/ui/input";
import type { ActionResult } from "@/lib/actions/types";
import { BoutonDecisif } from "@/components/ui/bouton-decisif";

/**
 * LES DEVIS DU DOSSIER — le tableau interne de l'entreprise (§118.152).
 *
 * Trois lectures du MÊME tableau, et c'est le serveur qui dit laquelle :
 *   • l'assistante RETRANSCRIT (étape « devis demandés ») : un devis par agence, ses lignes,
 *     son scan, son total imprimé — et l'écart entre ce total et la somme des lignes se VOIT ;
 *   • le demandeur CHOISIT (étape « choix des lignes ») : un devis entier, ou des lignes de
 *     plusieurs devis, avec le montant retenu calculé à mesure — TVA et taxe de CHAQUE devis ;
 *   • les autres LISENT, lignes retenues en évidence.
 *
 * Les totaux affichés sont calculés par le MÊME module que le serveur (`promo-material/devis`) :
 * l'écran et l'action ne peuvent pas annoncer deux montants retenus différents pour le même choix.
 *
 * LE SCAN SE LIT (lot D2-E). Choisi dans l'éditeur, il est lu sur-le-champ — localement, et ses lignes
 * par l'IA si la Direction l'a permis — et la lecture PRÉREMPLIT l'éditeur : chaque ligne venue du scan
 * porte son badge et une case « vérifiée », le total la sienne, et l'enregistrement attend qu'elles
 * soient toutes cochées. Le serveur refait la même exigence : la case n'est pas une politesse d'écran.
 * Des lignes déjà saisies ne sont jamais remplacées sans un clic.
 */

export interface DevisAffiche extends DevisLu {
  quoteDate: string | null;
  note: string | null;
  documentName: string | null;
}

interface Props {
  id: string;
  quotes: DevisAffiche[];
  /** Les articles DEMANDÉS — chaque ligne de devis s'y rapproche, ou est « en plus » (§118.165). */
  articles: ArticleDemandeLu[];
  /** L'assistante peut retranscrire (tranché au serveur : son rôle ET l'étape). */
  canTranscribe: boolean;
  /** Le demandeur peut choisir (tranché au serveur : lui ET l'étape). */
  canSelect: boolean;
  /** Ce qui empêche encore de déclarer la retranscription terminée — dit par le serveur. */
  manques: string[];
  parties?: PartyOption[];
  canCreateContact: boolean;
  /** Le seuil du DG, pour dire au demandeur si son choix passera par le Directeur Général. */
  seuilDg: number | null;
  /** Les fichiers « devis » déposés sur la demande SANS devis du circuit (§118.204) — à ranger. */
  aRanger?: { id: string; nom: string; deposePar: string | null; le: string }[];
  /** Tranché au serveur (`refusDeRangement` + qui retranscrit) : la personne peut-elle les ranger ICI ? */
  peutRanger?: boolean;
  /** Pourquoi pas à cette étape — la phrase même de l'action. */
  refusRangement?: string | null;
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

// ───────────────────────── L'éditeur d'un devis (assistante) ─────────────────────────

interface LigneSaisie {
  reference: string; unit: string; quantity: string; unitPrice: string; action: string; article: string;
  /** Le rang de la ligne lue sur le scan dont elle vient ; `null` : saisie à la main. */
  lue: number | null;
  /** « Vérifiée sur le papier » — exigée par le serveur pour toute ligne venue du scan. */
  verifiee: boolean;
}
/** L'intitulé d'un champ de ligne, visible seulement au téléphone (ligne en carte) : au bureau, l'en-tête du tableau le porte. */
const intituleMobile = "mb-1 block text-xs font-medium text-muted-foreground sm:hidden";
/** Un bouton au libellé long passe à la ligne au lieu de sortir de l'écran (le bouton est `nowrap` par défaut). */
const aLaLigne = "h-auto min-h-9 whitespace-normal py-1.5 sm:h-auto sm:min-h-8";
const LIGNE_VIDE: LigneSaisie ={ reference: "", unit: "", quantity: "", unitPrice: "", action: "", article: "", lue: null, verifiee: false };
const nombre = (s: string) => Number(s.replace(/\s/g, "").replace(",", "."));
/** Une rangée inutilisée : le serveur l'ignore, et elle ne demande aucune case. */
const ligneVide = (l: LigneSaisie) => !l.reference.trim() && !l.quantity.trim() && !l.unitPrice.trim();
/** Une ligne lue, telle que l'éditeur la reçoit : sa case n'est PAS cochée — c'est le geste de la personne. */
const depuisLecture = (l: LignePreremplie): LigneSaisie => ({
  ...LIGNE_VIDE, reference: l.reference, unit: l.unit ?? "",
  quantity: l.quantity != null ? String(l.quantity) : "", unitPrice: l.unitPrice != null ? String(l.unitPrice) : "",
  lue: l.rang, verifiee: false,
});

interface EnteteSaisie { reference: string; quoteDate: string; tvaRate: string; announcedTotal: string; extraTaxLabel: string; extraTaxRate: string }

function EditeurDevis({ id, devis, articles, parties, canCreateContact, onDone }: {
  id: string; devis: DevisAffiche | null; articles: ArticleDemandeLu[]; parties?: PartyOption[]; canCreateContact: boolean; onDone: () => void;
}) {
  const { saving, err, run } = useRun();
  const [lignes, setLignes] = React.useState<LigneSaisie[]>(() =>
    devis && devis.lines.length
      ? devis.lines.map((l) => ({
          ...LIGNE_VIDE, reference: l.reference, unit: l.unit ?? "", quantity: String(l.quantity), unitPrice: String(l.unitPrice),
          action: l.action ?? "", article: l.requestItemId ?? "",
        }))
      : [{ ...LIGNE_VIDE }, { ...LIGNE_VIDE }, { ...LIGNE_VIDE }],
  );
  const [entete, setEntete] = React.useState<EnteteSaisie>(() => ({
    reference: devis?.reference ?? "", quoteDate: devis?.quoteDate?.slice(0, 10) ?? "", tvaRate: devis?.tvaRate != null ? String(devis.tvaRate) : "",
    announcedTotal: devis?.announcedTotal != null ? String(devis.announcedTotal) : "",
    extraTaxLabel: devis?.extraTaxLabel ?? "", extraTaxRate: devis?.extraTaxRate != null ? String(devis.extraTaxRate) : "",
  }));
  const majEntete = (k: keyof EnteteSaisie, v: string) => setEntete((e) => ({ ...e, [k]: v }));
  // Le fournisseur : le sélecteur garde son propre état — préremplir, c'est le remonter avec une autre valeur.
  const [fournisseur, setFournisseur] = React.useState<{ ids: string[]; cle: number }>(() => ({ ids: devis?.supplierId ? [devis.supplierId] : [], cle: 0 }));
  // LA LECTURE DU SCAN : la proposition, et si elle a été APPLIQUÉE à l'éditeur (alors seulement elle se confirme).
  const [lecture, setLecture] = React.useState<LectureDevisPromo | null>(null);
  const [appliquee, setAppliquee] = React.useState(false);
  const [enLecture, setEnLecture] = React.useState(false);
  const [erreurLecture, setErreurLecture] = React.useState<string | null>(null);
  const [totalVerifie, setTotalVerifie] = React.useState(false);
  const [scanChoisi, setScanChoisi] = React.useState(false);
  const scanRef = React.useRef<HTMLInputElement>(null);

  const maj = (i: number, k: "reference" | "unit" | "quantity" | "unitPrice" | "action" | "article", v: string) =>
    setLignes((ls) => ls.map((l, j) => (j === i ? { ...l, [k]: v } : l)));
  const coche = (i: number, v: boolean) => setLignes((ls) => ls.map((l, j) => (j === i ? { ...l, verifiee: v } : l)));
  const totalHT = lignes.reduce((s, l) => {
    const q = nombre(l.quantity); const p = nombre(l.unitPrice);
    return Number.isFinite(q) && Number.isFinite(p) ? s + totalLigneHT({ quantity: q, unitPrice: p }) : s;
  }, 0);
  const lueParRang = new Map((lecture?.prerempli.lignes ?? []).map((l) => [l.rang, l]));
  const resteACocher = appliquee ? lignes.filter((l) => l.lue !== null && !l.verifiee && !ligneVide(l)).length : 0;
  const confirmable = !appliquee || (resteACocher === 0 && totalVerifie);

  /** Reporter la lecture dans l'éditeur : ses lignes (s'il y en a), son en-tête, son fournisseur reconnu. */
  const appliquer = (l: LectureDevisPromo) => {
    const p = l.prerempli;
    if (p.lignes.length > 0) setLignes(p.lignes.map(depuisLecture));
    else setLignes((ls) => ls.map((x) => ({ ...x, lue: null, verifiee: false })));
    setEntete((e) => ({
      reference: p.reference ?? e.reference,
      quoteDate: p.quoteDate ?? e.quoteDate,
      tvaRate: p.tvaRate != null ? String(p.tvaRate) : e.tvaRate,
      announcedTotal: p.announcedTotal != null ? String(p.announcedTotal) : e.announcedTotal,
      extraTaxLabel: p.extraTaxLabel ?? e.extraTaxLabel,
      extraTaxRate: p.extraTaxRate != null ? String(p.extraTaxRate) : e.extraTaxRate,
    }));
    // Le fournisseur n'est prérempli que s'il est reconnu à coup sûr ET proposé ici.
    if (p.fournisseurId && (parties ?? []).some((o) => o.id === p.fournisseurId)) {
      setFournisseur((f) => ({ ids: [p.fournisseurId as string], cle: f.cle + 1 }));
    }
    setTotalVerifie(false);
    setAppliquee(true);
  };

  /** LIRE LE SCAN choisi — la lecture n'écrit rien ; des lignes déjà saisies ne sont pas remplacées sans un clic. */
  const lireLeScan = async (fichier: File) => {
    setEnLecture(true); setErreurLecture(null);
    const f = new FormData();
    f.set("promoMaterialId", id);
    f.set("scan", fichier);
    const r = await lireScanDevisPromo(f);
    setEnLecture(false);
    if (!r.ok || !r.lecture) { setLecture(null); setAppliquee(false); setErreurLecture(r.error ?? "Lecture impossible."); return; }
    const nouvelle = r.lecture;
    setLecture(nouvelle);
    if (lignes.every(ligneVide) || appliquee) {
      // Rien de saisi, ou des lignes venues d'une lecture précédente : la nouvelle lecture les remplace.
      appliquer(nouvelle);
    } else {
      // Des lignes saisies à la main : elles restent, et ne sont rattachées à aucune lecture.
      setAppliquee(false);
      setLignes((ls) => ls.map((x) => ({ ...x, lue: null, verifiee: false })));
    }
  };

  return (
    <form
      className="space-y-3 rounded-lg border border-border p-3"
      action={(f: FormData) => {
        f.set("promoMaterialId", id);
        if (devis) f.set("quoteId", devis.id);
        run(() => enregistrerDevisPromo(f), onDone);
      }}
    >
      <p className="text-sm font-medium">{devis ? `Corriger le devis de ${devis.supplierName}` : "Retranscrire un devis"}</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor={`dv-scan-${devis?.id ?? "n"}`}>Scan du devis {devis?.documentName ? <span className="font-normal text-muted-foreground [overflow-wrap:anywhere]">(actuel : {devis.documentName})</span> : "*"}</Label>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Input
              ref={scanRef} id={`dv-scan-${devis?.id ?? "n"}`} name="scan" type="file" accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx" className="max-w-md"
              onChange={(e) => { const fichier = e.currentTarget.files?.[0] ?? null; setScanChoisi(Boolean(fichier)); if (fichier) void lireLeScan(fichier); }}
            />
            <Button type="button" size="sm" variant="outline" disabled={!scanChoisi || enLecture || saving}
              onClick={() => { const fichier = scanRef.current?.files?.[0]; if (fichier) void lireLeScan(fichier); }}>
              {enLecture ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanText className="h-4 w-4" />} Lire le scan
            </Button>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Choisi, le scan est lu sur ce serveur : la lecture propose, vous comparez au papier et cochez chaque ligne.</p>
        </div>
        {erreurLecture && <div className="sm:col-span-2"><Erreur msg={erreurLecture} /></div>}
        {lecture && (
          <div className="space-y-2 sm:col-span-2">
            <NoteDeLecture
              nomFichier={lecture.nomFichier} noteMethode={lecture.noteMethode} sansLignes={lecture.sansLignes} coupe={lecture.coupe}
              controle={lecture.controle} fournisseur={lecture.fournisseur.phrase} reserves={lecture.prerempli.reserves} suspectes={lecture.suspectes}
            />
            {!appliquee && (
              <Button type="button" size="sm" variant="outline" className={aLaLigne} onClick={() => appliquer(lecture)}>
                <ScanText className="h-4 w-4" /> Reprendre la lecture (remplace les lignes saisies)
              </Button>
            )}
          </div>
        )}
        {appliquee && lecture && <input type="hidden" name="lectureId" value={lecture.lectureId} />}
        <div className="sm:col-span-2">
          <Label>Fournisseur (annuaire) *</Label>
          <div className="mt-1"><PartyPicker key={`fournisseur-${fournisseur.cle}`} name="supplierId" arity={1} options={parties} canCreate={canCreateContact} defaultValue={fournisseur.ids} placeholder="Choisir l'agence ou le partenaire" /></div>
        </div>
        <div><Label htmlFor={`dv-ref-${devis?.id ?? "n"}`}>N° du devis</Label><Input id={`dv-ref-${devis?.id ?? "n"}`} name="reference" value={entete.reference} onChange={(e) => majEntete("reference", e.target.value)} placeholder="26/0576" /></div>
        <div><Label htmlFor={`dv-date-${devis?.id ?? "n"}`}>Date du devis</Label><Input id={`dv-date-${devis?.id ?? "n"}`} name="quoteDate" type="date" value={entete.quoteDate} onChange={(e) => majEntete("quoteDate", e.target.value)} /></div>
        <div><Label htmlFor={`dv-tva-${devis?.id ?? "n"}`}>TVA (%)</Label><Input id={`dv-tva-${devis?.id ?? "n"}`} name="tvaRate" inputMode="decimal" placeholder="Telle qu'imprimée (vide = pas de TVA)" value={entete.tvaRate} onChange={(e) => majEntete("tvaRate", e.target.value)} /></div>
        {/* EXIGÉ POUR TERMINER, pas pour enregistrer — comme le scan : on peut poser les lignes avant
            d'avoir le papier sous les yeux, mais « Retranscription terminée » refuse un devis sans son
            total imprimé, contre lequel les lignes se contrôlent à un dinar près. */}
        <div>
          <Label htmlFor={`dv-annonce-${devis?.id ?? "n"}`}>Total HT imprimé sur le devis *</Label>
          <Input id={`dv-annonce-${devis?.id ?? "n"}`} name="announcedTotal" inputMode="decimal" value={entete.announcedTotal} onChange={(e) => majEntete("announcedTotal", e.target.value)} placeholder="contrôle la retranscription" />
          {appliquee && (
            <label className="mt-1 flex min-h-9 items-center gap-2 text-xs sm:min-h-0 sm:gap-1.5">
              <input type="hidden" name="totalVerifie" value="0" />
              <input type="checkbox" className="h-4 w-4 sm:h-auto sm:w-auto" name="totalVerifie" value="1" checked={totalVerifie} onChange={(e) => setTotalVerifie(e.target.checked)} />
              total vérifié sur le papier
            </label>
          )}
        </div>
        <div><Label htmlFor={`dv-taxel-${devis?.id ?? "n"}`}>Taxe additionnelle (libellé)</Label><Input id={`dv-taxel-${devis?.id ?? "n"}`} name="extraTaxLabel" value={entete.extraTaxLabel} onChange={(e) => majEntete("extraTaxLabel", e.target.value)} placeholder="Taxe Pub" /></div>
        <div><Label htmlFor={`dv-taxer-${devis?.id ?? "n"}`}>Taxe additionnelle (%)</Label><Input id={`dv-taxer-${devis?.id ?? "n"}`} name="extraTaxRate" inputMode="decimal" value={entete.extraTaxRate} onChange={(e) => majEntete("extraTaxRate", e.target.value)} placeholder="vide = aucune" /></div>
      </div>

      {/* AU TÉLÉPHONE, UNE LIGNE DE DEVIS = UNE CARTE (classe `mobile-cards`) : chaque champ sous son intitulé,
          pleine largeur. Huit colonnes de saisie qui glissent de côté ne se remplissent pas au pouce. */}
      <div className="sm:overflow-x-auto">
        <table className="mobile-cards w-full text-sm sm:min-w-[880px]">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th className="py-1 pr-2 font-medium">Référence / désignation</th>
              <th className="py-1 pr-2 font-medium">Action *</th>
              <th className="py-1 pr-2 font-medium">Article demandé</th>
              <th className="py-1 pr-2 font-medium">Unité</th>
              <th className="py-1 pr-2 font-medium">Quantité</th>
              <th className="py-1 pr-2 font-medium">Prix unitaire HT</th>
              <th className="py-1 pr-2 text-right font-medium">Prix total HT</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {lignes.map((l, i) => {
              const q = nombre(l.quantity); const p = nombre(l.unitPrice);
              const t = Number.isFinite(q) && Number.isFinite(p) && l.quantity && l.unitPrice ? totalLigneHT({ quantity: q, unitPrice: p }) : null;
              const lue = l.lue !== null ? lueParRang.get(l.lue) : undefined;
              return (
                <React.Fragment key={i}>
                  <tr className="align-top">
                    <td className="py-1 pr-2">
                      <div className="w-full">
                        <span aria-hidden className={intituleMobile}>Ligne {i + 1} · Référence / désignation</span>
                        <Input name="ligneReference" value={l.reference} onChange={(e) => maj(i, "reference", e.target.value)} aria-label={`Référence ligne ${i + 1}`} />
                      </div>
                      {/* Deux champs cachés par rangée, ALIGNÉS sur les autres : la ligne lue dont elle vient, et sa case. */}
                      <input type="hidden" name="ligneLue" value={l.lue ?? ""} />
                      <input type="hidden" name="ligneVerifiee" value={l.verifiee ? "1" : "0"} />
                    </td>
                    <td className="py-1 pr-2">
                      <div className="w-full">
                        <span aria-hidden className={intituleMobile}>Action *</span>
                        <select name="ligneAction" value={l.action} onChange={(e) => maj(i, "action", e.target.value)} aria-label={`Action ligne ${i + 1}`}
                          className="h-10 w-full rounded-md border border-input bg-background px-2 text-base sm:h-9 sm:w-36 sm:text-sm">
                          <option value="">Action…</option>
                          {ACTIONS.map((a) => <option key={a} value={a}>{ACTION_LABEL[a]}</option>)}
                        </select>
                      </div>
                    </td>
                    <td className="py-1 pr-2">
                      <div className="w-full">
                        <span aria-hidden className={intituleMobile}>Article demandé</span>
                        <select name="ligneArticle" value={l.article} onChange={(e) => maj(i, "article", e.target.value)} aria-label={`Article demandé ligne ${i + 1}`}
                          className="h-10 w-full rounded-md border border-input bg-background px-2 text-base sm:h-9 sm:w-48 sm:text-sm">
                          <option value="">En plus (non demandé)</option>
                          {articles.map((a) => <option key={a.id} value={a.id}>{libelleArticleDemande(a)}</option>)}
                        </select>
                      </div>
                    </td>
                    <td className="py-1 pr-2">
                      <div className="w-full">
                        <span aria-hidden className={intituleMobile}>Unité</span>
                        <Input name="ligneUnite" value={l.unit} onChange={(e) => maj(i, "unit", e.target.value)} aria-label={`Unité ligne ${i + 1}`} placeholder="pièce" className="w-full sm:w-24" />
                      </div>
                    </td>
                    <td className="py-1 pr-2">
                      <div className="w-full">
                        <span aria-hidden className={intituleMobile}>Quantité</span>
                        <Input name="ligneQuantite" value={l.quantity} onChange={(e) => maj(i, "quantity", e.target.value)} inputMode="decimal" aria-label={`Quantité ligne ${i + 1}`} className="w-full sm:w-24" />
                      </div>
                    </td>
                    <td className="py-1 pr-2">
                      <div className="w-full">
                        <span aria-hidden className={intituleMobile}>Prix unitaire HT</span>
                        <Input name="lignePrix" value={l.unitPrice} onChange={(e) => maj(i, "unitPrice", e.target.value)} inputMode="decimal" aria-label={`Prix unitaire ligne ${i + 1}`} className="w-full sm:w-32" />
                      </div>
                    </td>
                    <td data-label="Prix total HT" className="py-1 pr-2 text-right tabular-nums">{t != null ? formatDzd(t) : "—"}</td>
                    <td className="py-1">
                      <Button type="button" size="sm" variant="ghost" onClick={() => setLignes((ls) => ls.filter((_, j) => j !== i))} aria-label={`Retirer la ligne ${i + 1}`}><Trash2 className="h-4 w-4" /><span className="sm:hidden">Retirer la ligne</span></Button>
                    </td>
                  </tr>
                  {appliquee && lecture && l.lue !== null && (
                    <tr>
                      <td colSpan={8} className="pb-2 pr-2">
                        <div className="w-full">
                          <LigneLue
                            id={`dv-lue-${devis?.id ?? "n"}-${i}`} methode={lecture.methode} confiance={lecture.confiance}
                            verifiee={l.verifiee} onVerifiee={(v) => coche(i, v)} notes={lue?.notes ?? []} suspecte={lue?.suspecte ?? []}
                          />
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
          {/* `block` au téléphone : la feuille de style des cartes ne traite pas le pied de tableau. */}
          <tfoot className="block sm:table-footer-group">
            <tr>
              <td colSpan={6} className="pt-2">
                <Button type="button" size="sm" variant="outline" className="w-full sm:w-auto" onClick={() => setLignes((ls) => [...ls, { ...LIGNE_VIDE }])}><Plus className="h-4 w-4" /> Ajouter une ligne</Button>
              </td>
              <td data-label="Total HT" className="pt-2 text-right font-medium tabular-nums">{formatDzd(totalHT)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
      <div><Label htmlFor={`dv-note-${devis?.id ?? "n"}`}>Note</Label><Textarea id={`dv-note-${devis?.id ?? "n"}`} name="note" defaultValue={devis?.note ?? ""} className="min-h-[50px]" /></div>
      <Erreur msg={err} />
      {appliquee && !confirmable && (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          Avant d&apos;enregistrer : comparez au papier et cochez {resteACocher > 0 ? `${resteACocher} ligne${resteACocher > 1 ? "s" : ""} lue${resteACocher > 1 ? "s" : ""}` : ""}{resteACocher > 0 && !totalVerifie ? " et " : ""}{!totalVerifie ? "le total" : ""}.
        </p>
      )}
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Button type="submit" size="sm" disabled={saving || enLecture || !confirmable}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Enregistrer le devis</Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDone} disabled={saving}>Annuler</Button>
      </div>
    </form>
  );
}

// ───────────────────────── La carte ─────────────────────────

export function PromoQuotesCard({ id, quotes, articles, canTranscribe, canSelect, manques, parties, canCreateContact, seuilDg, aRanger = [], peutRanger = false, refusRangement = null }: Props) {
  const { saving, err, msg, run } = useRun();
  const [edition, setEdition] = React.useState<string | "nouveau" | null>(null);
  const [choisies, setChoisies] = React.useState<Set<string>>(() => new Set(quotes.flatMap((q) => q.lines.filter((l) => l.selected).map((l) => l.id))));
  const [correction, setCorrection] = React.useState(false);
  const [redemande, setRedemande] = React.useState(false);
  const [cherche, setCherche] = React.useState("");

  // Le montant RETENU, calculé à mesure — avec la sélection de l'écran, pas celle de la base.
  const affiches: DevisLu[] = quotes.map((q) => ({ ...q, lines: q.lines.map((l) => ({ ...l, selected: canSelect ? choisies.has(l.id) : l.selected })) }));
  const selection = totauxDeLaSelection(affiches);
  const bascule = (lineId: string) => setChoisies((s) => { const n = new Set(s); if (n.has(lineId)) n.delete(lineId); else n.add(lineId); return n; });
  const toutLeDevis = (q: DevisAffiche, oui: boolean) => setChoisies((s) => { const n = new Set(s); for (const l of q.lines) { if (oui) n.add(l.id); else n.delete(l.id); } return n; });
  const envoyerChoix = (valider: boolean) => {
    const f = new FormData(); f.set("promoMaterialId", id); if (valider) f.set("valider", "1");
    for (const lid of choisies) f.append("lineIds", lid);
    run(() => choisirLignesPromo(f));
  };
  const auDg = seuilDg != null && seuilDg > 0 && selection.lignes > 0 && selection.ttc > seuilDg;
  const nomArticle = new Map(articles.map((a) => { const promus = libellesPromusDeLArticle(a); return [a.id, `${a.reference} ${a.nom}${promus.length ? ` — ${promus.join(", ")}` : ""}`]; }));
  // LE RAPPROCHEMENT — calculé par le module pur, avec la sélection de l'écran (§118.165).
  const rapprochement = articles.length > 0 && quotes.length > 0 ? rapprocher(articles, affiches) : null;

  return (
    <div className="space-y-4">
      {/* LES DEVIS DÉPOSÉS SANS FOURNISSEUR (§118.204) — « les fiches doivent être automatiques » : un fichier
          « devis » de la demande devient un devis du circuit d'un geste, l'agence choisie dans l'annuaire. Le
          fichier n'est pas retéléversé : le devis le DÉSIGNE. Plus de « Créer sa fiche » ici. */}
      {aRanger.length > 0 && (
        <div className="space-y-2 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3">
          <p className="text-sm font-medium">Devis déposés sans fournisseur ({aRanger.length})</p>
          <p className="text-xs text-muted-foreground">
            {peutRanger
              ? "Choisissez l'agence à qui appartient chaque devis : il entre dans le tableau sans être téléversé une seconde fois, puis ses lignes se retranscrivent (« Corriger »)."
              : refusRangement ?? "L'assistante de direction (ou la Direction) les range comme devis d'une agence."}
          </p>
          <ul className="space-y-2">
            {aRanger.map((d) => (
              <li key={d.id} className="space-y-1.5 rounded-md border border-border bg-background p-2">
                <p className="flex flex-wrap items-center gap-2 text-sm">
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <a className="min-w-0 font-medium [overflow-wrap:anywhere] hover:underline" href={`/api/documents/${d.id}`} target="_blank" rel="noreferrer">{d.nom}</a>
                  <span className="text-xs text-muted-foreground">{d.deposePar ? `déposé par ${d.deposePar}, ` : ""}le {new Date(d.le).toLocaleDateString("fr-FR")}</span>
                </p>
                {peutRanger && (
                  <form
                    className="flex flex-wrap items-end gap-2"
                    action={(f: FormData) => { f.set("promoMaterialId", id); f.set("documentId", d.id); run(() => rangerDevisPromo(f)); }}
                  >
                    <div className="w-full min-w-0 sm:w-auto sm:min-w-[14rem] sm:flex-1">
                      <PartyPicker name="supplierId" arity={1} options={parties} canCreate={canCreateContact} placeholder="L'agence ou le partenaire de ce devis" />
                    </div>
                    <Button type="submit" size="sm" className={`w-full sm:w-auto ${aLaLigne}`} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Ranger comme devis de cette agence</Button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {quotes.length === 0 && !canTranscribe && (
        <p className="text-sm text-muted-foreground">Aucun devis retranscrit pour l&apos;instant.</p>
      )}

      {quotes.map((q) => {
        const t = totauxDuDevis(q);
        const ecart = ecartDeRetranscription(q);
        const toutCoche = q.lines.length > 0 && q.lines.every((l) => choisies.has(l.id));
        if (edition === q.id) {
          return <EditeurDevis key={q.id} id={id} devis={q} articles={articles} parties={parties} canCreateContact={canCreateContact} onDone={() => setEdition(null)} />;
        }
        return (
          <div key={q.id} className="rounded-lg border border-border">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
              <div className="min-w-0">
                <p className="truncate font-medium">{q.supplierName}</p>
                <p className="text-xs text-muted-foreground [overflow-wrap:anywhere]">
                  {q.reference ? `Devis n° ${q.reference}` : "Devis sans numéro"}{q.quoteDate ? ` · ${new Date(q.quoteDate).toLocaleDateString("fr-FR")}` : ""} · TVA {q.tvaRate} %{q.extraTaxRate ? ` · ${q.extraTaxLabel ?? "Taxe"} ${q.extraTaxRate} %` : ""}
                  {q.documentName ? <> · <FileText className="inline h-3 w-3" /> {q.documentName}</> : <> · <span className="text-amber-600">scan manquant</span></>}
                  {/* Dit à celle qui peut le saisir, à l'étape où il compte : sur un dossier déjà passé au
                      choix, un « total manquant » d'avant la règle serait un bruit qu'on cesse de lire. */}
                  {canTranscribe && q.announcedTotal == null && <> · <span className="text-amber-600">total imprimé manquant</span></>}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {canSelect && (
                  <label className="flex min-h-9 items-center gap-2 text-xs sm:min-h-0 sm:gap-1.5">
                    <input type="checkbox" className="h-4 w-4 sm:h-auto sm:w-auto" checked={toutCoche} onChange={(e) => toutLeDevis(q, e.target.checked)} /> Tout le devis
                  </label>
                )}
                {canTranscribe && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => setEdition(q.id)} disabled={saving}><Pencil className="h-4 w-4" /> Corriger</Button>
                    <BoutonDecisif size="sm" variant="ghost" disabled={saving} aria-label={`Retirer le devis de ${q.supplierName}`}
                      onClick={() => { const f = new FormData(); f.set("promoMaterialId", id); f.set("quoteId", q.id); run(() => supprimerDevisPromo(f)); }}>
                      <Trash2 className="h-4 w-4" />
                    </BoutonDecisif>
                  </>
                )}
              </div>
            </div>
            <div className="p-2 sm:overflow-x-auto sm:p-0">
              <table className="mobile-cards w-full text-sm sm:min-w-[520px]">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground">
                    {canSelect && <th className="w-8 px-3 py-1.5" />}
                    <th className="px-3 py-1.5 font-medium">Référence</th>
                    <th className="px-3 py-1.5 font-medium">Unité</th>
                    <th className="px-3 py-1.5 text-right font-medium">Quantité</th>
                    <th className="px-3 py-1.5 text-right font-medium">Prix unitaire HT</th>
                    <th className="px-3 py-1.5 text-right font-medium">Prix total HT</th>
                  </tr>
                </thead>
                <tbody>
                  {q.lines.map((l) => {
                    const retenue = canSelect ? choisies.has(l.id) : l.selected;
                    return (
                      <tr key={l.id} className={`border-t border-border ${retenue ? "!bg-emerald-500/5" : ""}`}>
                        {canSelect && (
                          <td data-label="Retenir" className="px-3 py-1.5"><input type="checkbox" className="h-5 w-5 sm:h-auto sm:w-auto" checked={retenue} onChange={() => bascule(l.id)} aria-label={`Retenir ${l.reference}`} /></td>
                        )}
                        <td className="px-3 py-1.5 font-medium sm:font-normal">
                          <div className="w-full">
                            {l.reference}{!canSelect && retenue && <Badge tone="success" className="ml-2">retenue</Badge>}
                            <span className="mt-0.5 flex flex-wrap gap-1 text-xs font-normal">
                              {l.action && <Badge tone="info">{ACTION_LABEL[l.action as PromoAction]}</Badge>}
                              {l.requestItemId
                                ? <span className="text-muted-foreground">{nomArticle.get(l.requestItemId) ?? "article demandé"}</span>
                                : articles.length > 0 && <span className="text-amber-700 dark:text-amber-400">en plus (non demandé)</span>}
                            </span>
                          </div>
                        </td>
                        <td data-label="Unité" className="px-3 py-1.5 text-muted-foreground">{l.unit ?? "—"}</td>
                        <td data-label="Quantité" className="px-3 py-1.5 text-right tabular-nums">{l.quantity.toLocaleString("fr-FR")}</td>
                        <td data-label="Prix unitaire HT" className="px-3 py-1.5 text-right tabular-nums">{formatDzd(l.unitPrice)}</td>
                        <td data-label="Prix total HT" className="px-3 py-1.5 text-right tabular-nums">{formatDzd(totalLigneHT(l))}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="block sm:table-footer-group">
                  <tr className="border-t border-border text-xs">
                    <td colSpan={canSelect ? 5 : 4} className="px-3 py-1.5 text-right text-muted-foreground">
                      Total du devis — HT {formatDzd(t.ht)} · TVA {formatDzd(t.tva)}{t.taxe ? ` · ${q.extraTaxLabel ?? "Taxe"} ${formatDzd(t.taxe)}` : ""}
                    </td>
                    <td className="px-3 py-1.5 text-right font-medium tabular-nums">{formatDzd(t.ttc)} TTC</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            {ecart && (
              <p className="border-t border-border px-3 py-1.5 text-xs text-amber-700 dark:text-amber-400">
                Écart de retranscription : les lignes font {formatDzd(ecart.calcule)} HT, le devis annonce {formatDzd(ecart.annonce)}.
              </p>
            )}
          </div>
        );
      })}

      {rapprochement && (
        <div className="space-y-2 rounded-lg border border-border p-3 [overflow-wrap:anywhere]">
          <p className="text-sm font-medium">Rapprochement avec la demande</p>
          <div className="space-y-2">
            {rapprochement.articles.map(({ article, lignes, actionsSansDevis }) => (
              <div key={article.id} className="rounded-md bg-muted/40 px-3 py-2 text-sm">
                <p className="font-medium">{libelleArticleDemande(article)}</p>
                {lignes.length === 0
                  ? <p className="text-xs text-amber-700 dark:text-amber-400">Aucune ligne de devis ne chiffre encore cet article.</p>
                  : (
                    <ul className="mt-1 space-y-0.5 text-xs">
                      {lignes.map((l) => (
                        <li key={l.ligneId} className={l.retenue ? "font-medium text-emerald-700 dark:text-emerald-400" : "text-muted-foreground"}>
                          {l.fournisseur} — {l.action ? `${ACTION_LABEL[l.action]} · ` : ""}{l.reference} · {l.quantite.toLocaleString("fr-FR")} × {formatDzd(l.prixUnitaire)} = {formatDzd(l.totalHT)} HT{l.retenue ? " · retenue" : ""}
                        </li>
                      ))}
                    </ul>
                  )}
                {actionsSansDevis.length > 0 && lignes.length > 0 && (
                  <p className="text-xs text-amber-700 dark:text-amber-400">Pas encore chiffré : {actionsSansDevis.map((a) => ACTION_LABEL[a].toLowerCase()).join(", ")}.</p>
                )}
              </div>
            ))}
            {rapprochement.enPlus.length > 0 && (
              <div className="rounded-md border border-dashed border-border px-3 py-2 text-xs">
                <p className="font-medium">En plus de la demande — {rapprochement.enPlus.length} ligne{rapprochement.enPlus.length > 1 ? "s" : ""}, qui peuvent être retenues :</p>
                <ul className="mt-1 space-y-0.5 text-muted-foreground">
                  {rapprochement.enPlus.map((l) => (
                    <li key={l.ligneId}>{l.fournisseur} — {l.action ? `${ACTION_LABEL[l.action]} · ` : ""}{l.reference} · {formatDzd(l.totalHT)} HT{l.retenue ? " · retenue" : ""}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {canTranscribe && edition === "nouveau" && (
        <EditeurDevis id={id} devis={null} articles={articles} parties={parties} canCreateContact={canCreateContact} onDone={() => setEdition(null)} />
      )}

      <Erreur msg={err} />
      <Info msg={msg} />

      {canTranscribe && edition === null && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" className="w-full sm:w-auto" onClick={() => setEdition("nouveau")} disabled={saving}><Plus className="h-4 w-4" /> Déposer un devis</Button>
            <Button size="sm" className="w-full sm:w-auto" onClick={() => { const f = new FormData(); f.set("promoMaterialId", id); run(() => terminerRetranscriptionPromo(f)); }} disabled={saving || manques.length > 0}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Retranscription terminée
            </Button>
          </div>
          {manques.length > 0 && (
            <ul className="list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">
              {manques.map((m) => <li key={m}>{m}</li>)}
            </ul>
          )}
        </div>
      )}

      {canSelect && (
        <div className="space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
          <p className="text-sm">
            Retenu : <strong>{selection.lignes}</strong> ligne{selection.lignes > 1 ? "s" : ""} sur {selection.devis} devis —{" "}
            <strong className="tabular-nums">{formatDzd(selection.ttc)} TTC</strong>
            <span className="text-muted-foreground"> (HT {formatDzd(selection.ht)})</span>
          </p>
          <p className="text-xs text-muted-foreground">
            Votre choix part ensuite à la Direction Marketing{auDg ? ", puis au Directeur Général (au-dessus du seuil)" : ""}. Les bons de commande seront générés d&apos;après ces lignes, un par fournisseur.
          </p>
          {!correction && !redemande ? (
            <div className="flex flex-wrap gap-2">
              <BoutonDecisif size="sm" variant="success" onClick={() => envoyerChoix(true)} disabled={saving || selection.lignes === 0}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Valider ma sélection
              </BoutonDecisif>
              <Button size="sm" variant="outline" onClick={() => envoyerChoix(false)} disabled={saving}>Enregistrer sans valider</Button>
              <Button size="sm" variant="ghost" onClick={() => setCorrection(true)} disabled={saving}><Undo2 className="h-4 w-4" /> Demander une correction</Button>
              <Button size="sm" variant="ghost" onClick={() => setRedemande(true)} disabled={saving}><RotateCcw className="h-4 w-4" /> Redemander des devis</Button>
            </div>
          ) : redemande ? (
            <form action={(f: FormData) => { f.set("promoMaterialId", id); run(() => redemanderDevisPromo(f), () => { setRedemande(false); setCherche(""); }); }} className="space-y-2">
              <Label htmlFor="promo-redemande">Ce que vous cherchez</Label>
              <Textarea id="promo-redemande" name="note" value={cherche} onChange={(e) => setCherche(e.target.value)} className="min-h-[50px]" placeholder="Ex. d'autres imprimeurs, 2 000 exemplaires au lieu de 5 000, livraison avant le 15." />
              <p className="text-xs text-muted-foreground">Une nouvelle demande part à l&apos;assistante ; les devis déjà reçus restent, pour comparer.</p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button type="submit" size="sm" disabled={saving || !cherche.trim()}>Envoyer la demande</Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setRedemande(false)} disabled={saving}>Annuler</Button>
              </div>
            </form>
          ) : (
            <form action={(f: FormData) => { f.set("promoMaterialId", id); run(() => demanderCorrectionDevisPromo(f), () => setCorrection(false)); }} className="space-y-2">
              <Label htmlFor="promo-correction">Ce qui est à corriger dans la retranscription</Label>
              <Textarea id="promo-correction" name="motif" required className="min-h-[50px]" placeholder="Ex. le prix unitaire des présentoirs est 2 500 DZD, pas 25 000." />
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button type="submit" size="sm" disabled={saving}>Renvoyer à l&apos;assistante</Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setCorrection(false)} disabled={saving}>Annuler</Button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
