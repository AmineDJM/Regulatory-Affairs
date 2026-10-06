"use client";

import * as React from "react";
import { Loader2, FileText, FileDown, Wand2, Pencil, ScanText, CheckCircle2, AlertTriangle, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import type { DevisDePosteVue } from "@/lib/queries/ad-pro-devis-poste";
import type { BcDePoste } from "@/lib/ad-pro/pieces-poste";
import { LIBELLE_ETAPE_BC } from "@/lib/bons-de-commande/regle";
import { lienFichierEmis } from "@/lib/legal/fichiers-emis";
import { refusDepassement } from "@/lib/ad-pro/devis-poste";
import {
  validerLignesDuDevis, enregistrerLignesDuDevis, lireLesLignesDuDevis, genererBonDeCommandePoste,
} from "@/lib/actions/ad-pro-item-actions";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LES LIGNES D'UN DEVIS DE POSTE ET LE BON DE COMMANDE QU'ELLES FONT GÉNÉRER (§118.206).
 *
 * Deux morceaux de la carte d'un poste :
 *
 *   • `BlocBonDeCommande` — le contenu de la case « Bon de commande » : les BC du poste (un PAR DEVIS quand ils sont
 *     générés), chacun avec son Word et son PDF, et les deux gestes — « Générer » avec un petit CTA, ou « Joindre un
 *     BC existant » (la demande à l'assistante, qui l'uploade). Il ne propose QUE ce que l'action acceptera (§118.83) :
 *     la même règle (`refusGenerationBC`, `refusDepassement`) est lue ici et par l'action.
 *   • `PanneauLignesDevis` — les lignes d'UN devis : référence ou désignation, unité, quantité, prix unitaire, total ;
 *     une case « validée » par ligne (« S'il oublie une référence, il peut juste la cocher »), la correction à la main,
 *     et la relecture du fichier. Une ligne lue par Luna est une PROPOSITION : elle ne se valide que complète, et après
 *     l'attestation « j'ai comparé au devis ».
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

type Run = (key: string, fn: () => Promise<{ ok: boolean; error?: string; message?: string }>, okText: string) => Promise<void>;

const dzd = (n: number): string => formatCurrency(n);

/** Les liens d'un BC généré : son Word et son PDF, sous la porte de la pièce — téléchargeables l'un et l'autre. */
function LiensBC({ bc }: { bc: BcDePoste }) {
  if (!bc.emis.docx && !bc.emis.pdf) return null;
  const lien = "inline-flex items-center gap-0.5 text-primary hover:underline";
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2">
      {bc.emis.docx && <a className={lien} href={lienFichierEmis(bc.id, "docx", true)} aria-label={`Télécharger le Word de ${bc.reference ?? bc.titre}`}><FileDown className="h-3 w-3" /> Word</a>}
      {bc.emis.pdf && <a className={lien} href={lienFichierEmis(bc.id, "pdf")} target="_blank" rel="noreferrer" aria-label={`Ouvrir le PDF de ${bc.reference ?? bc.titre}`}><FileText className="h-3 w-3" /> PDF</a>}
    </span>
  );
}

function phraseEtat(d: DevisDePosteVue): { texte: string; ton: "ok" | "attente" | "alerte" } | null {
  switch (d.etat) {
    case "A_GENERER": return { texte: "BC à générer", ton: "attente" };
    case "A_REGENERER": return { texte: `BC à régénérer (${d.nbAjoutees > 0 ? `+${d.nbAjoutees}` : ""}${d.nbAjoutees > 0 && d.nbRetirees > 0 ? " " : ""}${d.nbRetirees > 0 ? `−${d.nbRetirees}` : ""} ligne${d.nbAjoutees + d.nbRetirees > 1 ? "s" : ""})`, ton: "attente" };
    case "A_JOUR": return { texte: "BC à jour", ton: "ok" };
    case "FIGE": return { texte: "BC figé — voir ci-dessous", ton: "alerte" };
    case "A_ANNULER": return { texte: "plus aucune ligne validée", ton: "alerte" };
    default: return null;
  }
}

export function BlocBonDeCommande({ itemId, bcs, devis, accorde, refusGeneration, peutGenerer, peutJoindre, busy, run, onJoindre, repli }: {
  itemId: string;
  bcs: BcDePoste[];
  devis: DevisDePosteVue[];
  accorde: number | null;
  /** Pourquoi la génération n'est pas ouverte (`refusGenerationBC`) — `null` : elle l'est. Seul le demandeur la voit. */
  refusGeneration: string | null;
  peutGenerer: boolean;
  peutJoindre: boolean;
  busy: string | null;
  run: Run;
  onJoindre: () => void;
  /** Ce que la case montrait avant (demande chez l'assistante, déposé, centre…) quand aucun BC n'est encore rattaché. */
  repli: React.ReactNode;
}) {
  const vivants = devis.filter((d) => !d.annule);
  const aFaire = vivants.filter((d) => d.etat === "A_GENERER" || d.etat === "A_REGENERER");
  const depasse = refusDepassement(
    vivants.reduce((s, d) => s + Math.round(d.totalValideTtc * 100), 0) / 100, accorde,
    vivants.reduce((s, d) => s + Math.round(d.totalValideHt * 100), 0) / 100,
    vivants.filter((d) => d.nbValidees > 0).every((d) => d.entete.tvaRate !== null),
  );
  const enCours = busy !== null && busy.startsWith("gen:") && busy.endsWith(`:${itemId}`);
  const generer = (pieceId: string | null) => {
    const fd = new FormData();
    fd.set("id", itemId);
    if (pieceId) fd.set("pieceId", pieceId);
    void run(`gen:${pieceId ?? "tous"}:${itemId}`, () => genererBonDeCommandePoste(fd), "Bon de commande généré.");
  };
  const ouverte = peutGenerer && refusGeneration === null && !depasse;
  const figes = vivants.filter((d) => (d.etat === "FIGE" || d.etat === "A_ANNULER") && d.refus);

  return (
    <>
      {bcs.length === 0 ? repli : bcs.map((bc) => {
        const source = vivants.find((d) => d.bc?.id === bc.id);
        const etape = bc.etape ?? "HORS_CIRCUIT";
        return (
          <div key={bc.id} className="min-w-0 space-y-0.5">
            <div className="flex min-w-0 items-start gap-1.5">
              <FileText className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <span className="block truncate font-medium" title={bc.titre}>{bc.reference ?? bc.titre}</span>
                <p className="text-muted-foreground">
                  {bc.montant != null ? <span className="tabular-nums">{dzd(bc.montant)}</span> : "montant non saisi"}
                  {source && <> · devis {source.reference ?? source.titre}</>}
                </p>
                <p className={etape === "SIGNE" ? "text-success" : etape === "REFUSE" ? "text-destructive" : "text-muted-foreground"}>{LIBELLE_ETAPE_BC[etape]}</p>
                <LiensBC bc={bc} />
              </div>
            </div>
          </div>
        );
      })}

      {vivants.some((d) => d.structure && (d.nbValidees > 0 || d.bc)) && (
        <ul className="space-y-0.5 border-t border-border/60 pt-1">
          {vivants.filter((d) => d.structure && (d.nbValidees > 0 || d.bc)).map((d) => {
            const e = phraseEtat(d);
            const actionnable = ouverte && (d.etat === "A_GENERER" || d.etat === "A_REGENERER");
            return (
              <li key={d.pieceId} className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span className="min-w-0 flex-1 truncate" title={d.titre}>
                  {d.reference ?? d.titre} — {d.nbValidees} ligne{d.nbValidees > 1 ? "s" : ""} validée{d.nbValidees > 1 ? "s" : ""} · <span className="tabular-nums">{d.entete.tvaRate === null ? `${dzd(d.totalValideHt)} · sans TVA (aucune sur le devis)` : `${dzd(d.totalValideTtc)} TTC`}</span>
                </span>
                {e && !(actionnable && aFaire.length === 1) && <span className={e.ton === "ok" ? "text-success" : e.ton === "alerte" ? "text-destructive" : "text-warning"}>{e.texte}</span>}
                {actionnable && aFaire.length > 1 && (
                  <button type="button" onClick={() => generer(d.pieceId)} disabled={enCours} className="text-primary hover:underline disabled:opacity-50">
                    {d.etat === "A_REGENERER" ? "Régénérer" : "Générer"}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {figes.map((d) => <p key={d.pieceId} className="flex gap-1 text-destructive"><AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> {d.refus}</p>)}
      {depasse && aFaire.length > 0 && <p className="flex gap-1 text-warning"><AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> {depasse}</p>}
      {peutGenerer && aFaire.length > 0 && refusGeneration && <p className="text-muted-foreground">{refusGeneration}</p>}

      {(ouverte && aFaire.length > 0) || peutJoindre ? (
        <div className="flex flex-wrap items-center gap-2 pt-0.5">
          {ouverte && aFaire.length === 1 && (
            <Button size="sm" onClick={() => generer(aFaire[0].pieceId)} disabled={enCours}>
              {enCours ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
              {aFaire[0].etat === "A_REGENERER" ? "Régénérer le BC" : "Générer le BC"}
            </Button>
          )}
          {ouverte && aFaire.length > 1 && (
            <Button size="sm" onClick={() => generer(null)} disabled={enCours}>
              {enCours ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
              Générer tous les BC ({aFaire.length})
            </Button>
          )}
          {peutJoindre && (
            <button type="button" onClick={onJoindre} className="inline-flex items-center gap-1 text-primary hover:underline">
              <Paperclip className="h-3 w-3" /> Joindre un BC existant
            </button>
          )}
        </div>
      ) : null}
    </>
  );
}

// ───────────────────────── Les lignes d'un devis ─────────────────────────

interface LigneSaisie { id: string; reference: string; unit: string; quantity: string; unitPrice: string }

const saisieDe = (l: DevisDePosteVue["lignes"][number]): LigneSaisie => ({
  id: l.id, reference: l.reference, unit: l.unit ?? "", quantity: l.quantity != null ? String(l.quantity) : "", unitPrice: l.unitPrice != null ? String(l.unitPrice) : "",
});

const champ = "w-full rounded border border-border bg-background px-1.5 py-1 text-xs outline-none focus:border-primary/60";

export function PanneauLignesDevis({ itemId, devis, peutEditer, busy, run, onClose }: {
  itemId: string;
  devis: DevisDePosteVue;
  peutEditer: boolean;
  busy: string | null;
  run: Run;
  onClose: () => void;
}) {
  const [coches, setCoches] = React.useState<Set<string>>(() => new Set(devis.lignes.filter((l) => l.validee).map((l) => l.id)));
  const [compare, setCompare] = React.useState(false);
  const [edition, setEdition] = React.useState(false);
  const [rows, setRows] = React.useState<LigneSaisie[]>(() => devis.lignes.map(saisieDe));
  const [tva, setTva] = React.useState(devis.entete.tvaRate !== null ? String(devis.entete.tvaRate) : "");
  const [taxeLibelle, setTaxeLibelle] = React.useState(devis.entete.extraTaxLabel ?? "");
  const [taxeTaux, setTaxeTaux] = React.useState(devis.entete.extraTaxRate != null ? String(devis.entete.extraTaxRate) : "");
  const [totalImprime, setTotalImprime] = React.useState(devis.entete.announcedTotal != null ? String(devis.entete.announcedTotal) : "");

  // L'état se recale sur le devis rechargé : une validation faite ailleurs ne reste pas affichée comme cochée ici.
  const signature = devis.lignes.map((l) => `${l.id}:${l.validee ? 1 : 0}:${l.quantity}:${l.unitPrice}`).join("|");
  React.useEffect(() => {
    setCoches(new Set(devis.lignes.filter((l) => l.validee).map((l) => l.id)));
    setRows(devis.lignes.map(saisieDe));
    setCompare(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  const gele = Boolean(devis.bc && (devis.bc.signe || devis.bc.facture));
  const porteUnBc = devis.bc !== null;
  const dejaValidees = new Set(devis.lignes.filter((l) => l.validee).map((l) => l.id));
  const changees = devis.lignes.some((l) => coches.has(l.id) !== dejaValidees.has(l.id));
  const nouvellesLues = devis.lignes.some((l) => coches.has(l.id) && !dejaValidees.has(l.id) && l.lue !== null);
  const occupe = busy !== null && busy.endsWith(`:${devis.pieceId}`);

  const fd = (extra: Record<string, string> = {}) => {
    const f = new FormData();
    f.set("id", itemId);
    f.set("pieceId", devis.pieceId);
    for (const [k, v] of Object.entries(extra)) f.set(k, v);
    return f;
  };
  const valider = () => {
    const f = fd();
    for (const l of devis.lignes) if (coches.has(l.id)) f.append("ligneId", l.id);
    if (compare) f.set("compare", "1");
    void run(`val:${devis.pieceId}`, () => validerLignesDuDevis(f), "Lignes validées.");
  };
  const enregistrer = () => {
    const f = fd({ tvaRate: tva, extraTaxLabel: taxeLibelle, extraTaxRate: taxeTaux, announcedTotal: totalImprime });
    for (const r of rows) {
      f.append("ligneId", r.id); f.append("ligneReference", r.reference); f.append("ligneUnite", r.unit);
      f.append("ligneQuantite", r.quantity); f.append("lignePrix", r.unitPrice);
    }
    void run(`edit:${devis.pieceId}`, async () => {
      const r = await enregistrerLignesDuDevis(f);
      if (r.ok) setEdition(false);
      return r;
    }, "Lignes enregistrées.");
  };
  const relire = () => void run(`lire:${devis.pieceId}`, () => lireLesLignesDuDevis(fd()), "Devis relu.");

  const modifier = (i: number, k: keyof LigneSaisie, v: string) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  const ajouter = () => setRows((rs) => [...rs, { id: "", reference: "", unit: "", quantity: "", unitPrice: "" }]);

  const totalCoche = devis.lignes
    .filter((l) => coches.has(l.id) && l.totalHt != null)
    .reduce((s, l) => s + Math.round((l.totalHt as number) * 100), 0) / 100;

  return (
    <div className="space-y-2 rounded-lg border border-border bg-background p-2.5 text-xs" aria-label={`Lignes du devis ${devis.reference ?? devis.titre}`}>
      <div className="flex flex-wrap items-center gap-2">
        <p className="min-w-0 flex-1 font-medium text-foreground">Lignes du devis {devis.reference ?? devis.titre}{devis.fournisseur ? ` — ${devis.fournisseur}` : ""}</p>
        <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">Fermer</button>
      </div>
      {devis.entete.lectureNote && (
        <p className="text-muted-foreground">
          Lignes lues par la plateforme — {devis.entete.lectureNote}
          {devis.lignes.every((l) => l.validee) ? " Toutes validées automatiquement." : " Certaines sont à vérifier : comparez-les au devis avant de les valider."}
        </p>
      )}

      {!devis.structure && !edition && (
        <p className="text-muted-foreground">Ce devis n&apos;a pas encore de lignes. Faites-le lire, ou saisissez-les depuis le papier.</p>
      )}

      {devis.structure && !edition && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[34rem] text-left">
            <thead className="text-[0.6875rem] text-muted-foreground">
              <tr><th className="w-8 py-1">Valider</th><th>Référence / désignation</th><th>Unité</th><th className="text-right">Qté</th><th className="text-right">PU HT</th><th className="text-right">Total HT</th></tr>
            </thead>
            <tbody>
              {devis.lignes.map((l) => {
                const empeche = Boolean(l.refusValidation || l.valideeAilleurs || gele);
                return (
                  <tr key={l.id} className="border-t border-border/50 align-top">
                    <td className="py-1">
                      <input
                        type="checkbox" checked={coches.has(l.id)} disabled={empeche && !coches.has(l.id) ? true : gele}
                        title={l.valideeAilleurs ? `Déjà validée pour « ${l.valideeAilleurs} »` : l.refusValidation ?? undefined}
                        aria-label={`Valider la ligne ${l.reference}`}
                        onChange={(e) => setCoches((cur) => { const n = new Set(cur); if (e.target.checked) n.add(l.id); else n.delete(l.id); return n; })}
                      />
                    </td>
                    <td className="py-1 pr-2">
                      <span className="font-medium text-foreground">{l.reference}</span>
                      {l.aVerifier && <span className="block text-warning">{l.aVerifier}</span>}
                      {l.valideeAilleurs && <span className="block text-muted-foreground">Validée pour « {l.valideeAilleurs} »</span>}
                      {l.refusValidation && !l.valideeAilleurs && <span className="block text-warning">{l.refusValidation}</span>}
                      {l.bcReference && <span className="block text-muted-foreground">Sur le BC {l.bcReference}</span>}
                    </td>
                    <td className="py-1">{l.unit ?? "—"}</td>
                    <td className="py-1 text-right tabular-nums">{l.quantity ?? "?"}</td>
                    <td className="py-1 text-right tabular-nums">{l.unitPrice != null ? dzd(l.unitPrice) : "?"}</td>
                    <td className="py-1 text-right tabular-nums">{l.totalHt != null ? dzd(l.totalHt) : "?"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {edition && (
        <div className="space-y-1.5">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[34rem] text-left">
              <thead className="text-[0.6875rem] text-muted-foreground"><tr><th>Référence / désignation</th><th className="w-20">Unité</th><th className="w-20">Qté</th><th className="w-24">PU HT</th></tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={`${r.id}-${i}`} className="align-top">
                    <td className="pr-1"><input className={champ} value={r.reference} onChange={(e) => modifier(i, "reference", e.target.value)} aria-label={`Référence de la ligne ${i + 1}`} /></td>
                    <td className="pr-1"><input className={champ} value={r.unit} onChange={(e) => modifier(i, "unit", e.target.value)} aria-label={`Unité de la ligne ${i + 1}`} /></td>
                    <td className="pr-1"><input className={champ} inputMode="decimal" value={r.quantity} onChange={(e) => modifier(i, "quantity", e.target.value)} aria-label={`Quantité de la ligne ${i + 1}`} /></td>
                    <td><input className={champ} inputMode="decimal" value={r.unitPrice} onChange={(e) => modifier(i, "unitPrice", e.target.value)} aria-label={`Prix unitaire HT de la ligne ${i + 1}`} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="button" onClick={ajouter} className="text-primary hover:underline">+ Ajouter une ligne</button>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <label className="space-y-0.5">TVA imprimée (%)<input className={champ} inputMode="decimal" value={tva} onChange={(e) => setTva(e.target.value)} placeholder="non indiquée" /></label>
            <label className="space-y-0.5">Taxe supplémentaire<input className={champ} value={taxeLibelle} onChange={(e) => setTaxeLibelle(e.target.value)} placeholder="Taxe Pub" /></label>
            <label className="space-y-0.5">Taux de la taxe (%)<input className={champ} inputMode="decimal" value={taxeTaux} onChange={(e) => setTaxeTaux(e.target.value)} /></label>
            <label className="space-y-0.5">Total HT imprimé<input className={champ} inputMode="decimal" value={totalImprime} onChange={(e) => setTotalImprime(e.target.value)} /></label>
          </div>
          <p className="text-muted-foreground">Une quantité ou un prix laissé vide reste à compléter : la ligne ne se valide pas. Une ligne dont le contenu change n&apos;est plus validée.</p>
        </div>
      )}

      {devis.structure && !edition && (
        <div className="space-y-1">
          <p className="tabular-nums text-foreground">
            Total du devis lu : {dzd(devis.totalDevisHt)} HT
            {devis.entete.announcedTotal != null && <> · imprimé : {dzd(devis.entete.announcedTotal)}</>}
            {" · "}validé : {dzd(totalCoche)} HT
          </p>
          {devis.entete.tvaRate === null && (
            <p className="text-muted-foreground">
              Aucune TVA indiquée sur le devis : les montants sont ceux du papier, sans TVA ajoutée.
            </p>
          )}
          {devis.ecartTotal && (
            <p className="flex gap-1 text-warning">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> Les lignes lues font {dzd(devis.ecartTotal.calcule)} HT, le devis imprime {dzd(devis.ecartTotal.annonce)} : une ligne manque peut-être, ou un chiffre est faux.
            </p>
          )}
          {gele && devis.refus && <p className="text-destructive">{devis.refus}</p>}
          {nouvellesLues && (
            <label className="flex items-start gap-1.5">
              <input type="checkbox" checked={compare} onChange={(e) => setCompare(e.target.checked)} className="mt-0.5" />
              <span>J&apos;ai comparé ces lignes au devis (elles viennent de la lecture du fichier).</span>
            </label>
          )}
        </div>
      )}

      {peutEditer && (
        <div className="flex flex-wrap items-center gap-2">
          {/* UN SEUL BOUTON PRINCIPAL À LA FOIS (Direction, 06/10) : « Valider » n'existe que s'il reste quelque
              chose à valider — un devis bien lu est déjà validé d'office, et la carte ne propose alors que
              « Générer le BC ». */}
          {!edition && devis.structure && changees && (
            <Button size="sm" onClick={valider} disabled={occupe || !changees || gele || (nouvellesLues && !compare)}>
              {busy === `val:${devis.pieceId}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />} Valider les lignes cochées
            </Button>
          )}
          {edition ? (
            <>
              <Button size="sm" onClick={enregistrer} disabled={occupe}>{busy === `edit:${devis.pieceId}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Pencil className="h-3.5 w-3.5" />} Enregistrer les lignes</Button>
              <Button size="sm" variant="ghost" onClick={() => { setEdition(false); setRows(devis.lignes.map(saisieDe)); }}>Annuler</Button>
            </>
          ) : (
            <>
              <button type="button" disabled={porteUnBc} title={porteUnBc ? "Un bon de commande porte déjà ce devis : annulez-le d'abord." : undefined} onClick={() => setEdition(true)} className="inline-flex items-center gap-1 text-primary hover:underline disabled:text-muted-foreground disabled:no-underline">
                <Pencil className="h-3 w-3" /> {devis.structure ? "Corriger les lignes" : "Saisir les lignes"}
              </button>
              {!porteUnBc && !devis.lignes.some((l) => l.validee || l.valideeAilleurs) && (
                <button type="button" onClick={relire} disabled={occupe} className="inline-flex items-center gap-1 text-primary hover:underline disabled:opacity-50">
                  {busy === `lire:${devis.pieceId}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <ScanText className="h-3 w-3" />} {devis.structure ? "Relire le devis" : "Lire le devis"}
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
