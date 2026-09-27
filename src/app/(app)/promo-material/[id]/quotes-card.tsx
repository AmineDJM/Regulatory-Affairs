"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, FileText, Loader2, Pencil, Plus, Send, Trash2, Undo2 } from "lucide-react";
import {
  enregistrerDevisPromo, supprimerDevisPromo, terminerRetranscriptionPromo, choisirLignesPromo, demanderCorrectionDevisPromo,
} from "@/lib/actions/promo-devis-actions";
import { totauxDeLaSelection, totauxDuDevis, totalLigneHT, ecartDeRetranscription, formatDzd, type DevisLu } from "@/lib/promo-material/devis";
import type { PartyOption } from "@/lib/contacts/parties";
import { PartyPicker } from "@/components/directory/party-picker";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label, Textarea } from "@/components/ui/input";
import type { ActionResult } from "@/lib/actions/types";

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
 */

export interface DevisAffiche extends DevisLu {
  quoteDate: string | null;
  note: string | null;
  documentName: string | null;
}

interface Props {
  id: string;
  quotes: DevisAffiche[];
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

interface LigneSaisie { reference: string; unit: string; quantity: string; unitPrice: string }
const LIGNE_VIDE: LigneSaisie = { reference: "", unit: "", quantity: "", unitPrice: "" };
const nombre = (s: string) => Number(s.replace(/\s/g, "").replace(",", "."));

function EditeurDevis({ id, devis, parties, canCreateContact, onDone }: {
  id: string; devis: DevisAffiche | null; parties?: PartyOption[]; canCreateContact: boolean; onDone: () => void;
}) {
  const { saving, err, run } = useRun();
  const [lignes, setLignes] = React.useState<LigneSaisie[]>(() =>
    devis && devis.lines.length
      ? devis.lines.map((l) => ({ reference: l.reference, unit: l.unit ?? "", quantity: String(l.quantity), unitPrice: String(l.unitPrice) }))
      : [{ ...LIGNE_VIDE }, { ...LIGNE_VIDE }, { ...LIGNE_VIDE }],
  );
  const maj = (i: number, k: keyof LigneSaisie, v: string) => setLignes((ls) => ls.map((l, j) => (j === i ? { ...l, [k]: v } : l)));
  const totalHT = lignes.reduce((s, l) => {
    const q = nombre(l.quantity); const p = nombre(l.unitPrice);
    return Number.isFinite(q) && Number.isFinite(p) ? s + totalLigneHT({ quantity: q, unitPrice: p }) : s;
  }, 0);

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
          <Label>Fournisseur (annuaire) *</Label>
          <div className="mt-1"><PartyPicker name="supplierId" arity={1} options={parties} canCreate={canCreateContact} defaultValue={devis?.supplierId ? [devis.supplierId] : []} placeholder="Choisir l'agence ou le partenaire" /></div>
        </div>
        <div><Label htmlFor={`dv-ref-${devis?.id ?? "n"}`}>N° du devis</Label><Input id={`dv-ref-${devis?.id ?? "n"}`} name="reference" defaultValue={devis?.reference ?? ""} placeholder="26/0576" /></div>
        <div><Label htmlFor={`dv-date-${devis?.id ?? "n"}`}>Date du devis</Label><Input id={`dv-date-${devis?.id ?? "n"}`} name="quoteDate" type="date" defaultValue={devis?.quoteDate?.slice(0, 10) ?? ""} /></div>
        <div><Label htmlFor={`dv-tva-${devis?.id ?? "n"}`}>TVA (%)</Label><Input id={`dv-tva-${devis?.id ?? "n"}`} name="tvaRate" inputMode="decimal" defaultValue={String(devis?.tvaRate ?? 19)} /></div>
        <div><Label htmlFor={`dv-annonce-${devis?.id ?? "n"}`}>Total HT imprimé sur le devis</Label><Input id={`dv-annonce-${devis?.id ?? "n"}`} name="announcedTotal" inputMode="decimal" defaultValue={devis?.announcedTotal != null ? String(devis.announcedTotal) : ""} placeholder="pour contrôler la retranscription" /></div>
        <div><Label htmlFor={`dv-taxel-${devis?.id ?? "n"}`}>Taxe additionnelle (libellé)</Label><Input id={`dv-taxel-${devis?.id ?? "n"}`} name="extraTaxLabel" defaultValue={devis?.extraTaxLabel ?? ""} placeholder="Taxe Pub" /></div>
        <div><Label htmlFor={`dv-taxer-${devis?.id ?? "n"}`}>Taxe additionnelle (%)</Label><Input id={`dv-taxer-${devis?.id ?? "n"}`} name="extraTaxRate" inputMode="decimal" defaultValue={devis?.extraTaxRate != null ? String(devis.extraTaxRate) : ""} placeholder="vide = aucune" /></div>
        <div className="sm:col-span-2">
          <Label htmlFor={`dv-scan-${devis?.id ?? "n"}`}>Scan du devis {devis?.documentName ? <span className="font-normal text-muted-foreground">(actuel : {devis.documentName})</span> : "*"}</Label>
          <Input id={`dv-scan-${devis?.id ?? "n"}`} name="scan" type="file" accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx" />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th className="py-1 pr-2 font-medium">Référence / désignation</th>
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
              return (
                <tr key={i} className="align-top">
                  <td className="py-1 pr-2"><Input name="ligneReference" value={l.reference} onChange={(e) => maj(i, "reference", e.target.value)} aria-label={`Référence ligne ${i + 1}`} /></td>
                  <td className="py-1 pr-2"><Input name="ligneUnite" value={l.unit} onChange={(e) => maj(i, "unit", e.target.value)} aria-label={`Unité ligne ${i + 1}`} placeholder="pièce" className="w-24" /></td>
                  <td className="py-1 pr-2"><Input name="ligneQuantite" value={l.quantity} onChange={(e) => maj(i, "quantity", e.target.value)} inputMode="decimal" aria-label={`Quantité ligne ${i + 1}`} className="w-24" /></td>
                  <td className="py-1 pr-2"><Input name="lignePrix" value={l.unitPrice} onChange={(e) => maj(i, "unitPrice", e.target.value)} inputMode="decimal" aria-label={`Prix unitaire ligne ${i + 1}`} className="w-32" /></td>
                  <td className="py-1 pr-2 text-right tabular-nums">{t != null ? formatDzd(t) : "—"}</td>
                  <td className="py-1">
                    <Button type="button" size="sm" variant="ghost" onClick={() => setLignes((ls) => ls.filter((_, j) => j !== i))} aria-label={`Retirer la ligne ${i + 1}`}><Trash2 className="h-4 w-4" /></Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={4} className="pt-2">
                <Button type="button" size="sm" variant="outline" onClick={() => setLignes((ls) => [...ls, { ...LIGNE_VIDE }])}><Plus className="h-4 w-4" /> Ajouter une ligne</Button>
              </td>
              <td className="pt-2 text-right font-medium tabular-nums">{formatDzd(totalHT)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
      <div><Label htmlFor={`dv-note-${devis?.id ?? "n"}`}>Note</Label><Textarea id={`dv-note-${devis?.id ?? "n"}`} name="note" defaultValue={devis?.note ?? ""} className="min-h-[50px]" /></div>
      <Erreur msg={err} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Enregistrer le devis</Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDone} disabled={saving}>Annuler</Button>
      </div>
    </form>
  );
}

// ───────────────────────── La carte ─────────────────────────

export function PromoQuotesCard({ id, quotes, canTranscribe, canSelect, manques, parties, canCreateContact, seuilDg }: Props) {
  const { saving, err, msg, run } = useRun();
  const [edition, setEdition] = React.useState<string | "nouveau" | null>(null);
  const [choisies, setChoisies] = React.useState<Set<string>>(() => new Set(quotes.flatMap((q) => q.lines.filter((l) => l.selected).map((l) => l.id))));
  const [correction, setCorrection] = React.useState(false);

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

  return (
    <div className="space-y-4">
      {quotes.length === 0 && !canTranscribe && (
        <p className="text-sm text-muted-foreground">Aucun devis retranscrit pour l&apos;instant.</p>
      )}

      {quotes.map((q) => {
        const t = totauxDuDevis(q);
        const ecart = ecartDeRetranscription(q);
        const toutCoche = q.lines.length > 0 && q.lines.every((l) => choisies.has(l.id));
        if (edition === q.id) {
          return <EditeurDevis key={q.id} id={id} devis={q} parties={parties} canCreateContact={canCreateContact} onDone={() => setEdition(null)} />;
        }
        return (
          <div key={q.id} className="rounded-lg border border-border">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
              <div className="min-w-0">
                <p className="truncate font-medium">{q.supplierName}</p>
                <p className="text-xs text-muted-foreground">
                  {q.reference ? `Devis n° ${q.reference}` : "Devis sans numéro"}{q.quoteDate ? ` · ${new Date(q.quoteDate).toLocaleDateString("fr-FR")}` : ""} · TVA {q.tvaRate} %{q.extraTaxRate ? ` · ${q.extraTaxLabel ?? "Taxe"} ${q.extraTaxRate} %` : ""}
                  {q.documentName ? <> · <FileText className="inline h-3 w-3" /> {q.documentName}</> : <> · <span className="text-amber-600">scan manquant</span></>}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {canSelect && (
                  <label className="flex items-center gap-1.5 text-xs">
                    <input type="checkbox" checked={toutCoche} onChange={(e) => toutLeDevis(q, e.target.checked)} /> Tout le devis
                  </label>
                )}
                {canTranscribe && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => setEdition(q.id)} disabled={saving}><Pencil className="h-4 w-4" /> Corriger</Button>
                    <Button size="sm" variant="ghost" disabled={saving} aria-label={`Retirer le devis de ${q.supplierName}`}
                      onClick={() => { if (confirm(`Retirer le devis de ${q.supplierName} ?`)) { const f = new FormData(); f.set("promoMaterialId", id); f.set("quoteId", q.id); run(() => supprimerDevisPromo(f)); } }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
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
                      <tr key={l.id} className={`border-t border-border ${retenue ? "bg-emerald-500/5" : ""}`}>
                        {canSelect && (
                          <td className="px-3 py-1.5"><input type="checkbox" checked={retenue} onChange={() => bascule(l.id)} aria-label={`Retenir ${l.reference}`} /></td>
                        )}
                        <td className="px-3 py-1.5">{l.reference}{!canSelect && retenue && <Badge tone="success" className="ml-2">retenue</Badge>}</td>
                        <td className="px-3 py-1.5 text-muted-foreground">{l.unit ?? "—"}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">{l.quantity.toLocaleString("fr-FR")}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">{formatDzd(l.unitPrice)}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">{formatDzd(totalLigneHT(l))}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
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

      {canTranscribe && edition === "nouveau" && (
        <EditeurDevis id={id} devis={null} parties={parties} canCreateContact={canCreateContact} onDone={() => setEdition(null)} />
      )}

      <Erreur msg={err} />
      <Info msg={msg} />

      {canTranscribe && edition === null && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => setEdition("nouveau")} disabled={saving}><Plus className="h-4 w-4" /> Retranscrire un devis</Button>
            <Button size="sm" onClick={() => { const f = new FormData(); f.set("promoMaterialId", id); run(() => terminerRetranscriptionPromo(f)); }} disabled={saving || manques.length > 0}>
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
          {!correction ? (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="success" onClick={() => envoyerChoix(true)} disabled={saving || selection.lignes === 0}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Valider ma sélection
              </Button>
              <Button size="sm" variant="outline" onClick={() => envoyerChoix(false)} disabled={saving}>Enregistrer sans valider</Button>
              <Button size="sm" variant="ghost" onClick={() => setCorrection(true)} disabled={saving}><Undo2 className="h-4 w-4" /> Demander une correction</Button>
            </div>
          ) : (
            <form action={(f: FormData) => { f.set("promoMaterialId", id); run(() => demanderCorrectionDevisPromo(f), () => setCorrection(false)); }} className="space-y-2">
              <Label htmlFor="promo-correction">Ce qui est à corriger dans la retranscription</Label>
              <Textarea id="promo-correction" name="motif" required className="min-h-[50px]" placeholder="Ex. le prix unitaire des présentoirs est 2 500 DZD, pas 25 000." />
              <div className="flex gap-2">
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
