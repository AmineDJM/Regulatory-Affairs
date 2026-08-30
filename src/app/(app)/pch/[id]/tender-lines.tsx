"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Loader2, Sparkles, Wand2, Package, Upload, TrendingUp, ShoppingCart, BadgeCheck, Download, Factory, Ship } from "lucide-react";
import { addTenderLine, updateTenderLine, deleteTenderLine, analyzeTenderText, analyzeTenderDocument, enrichTenderLine, enrichAllTenderLines, createOrderFromLine } from "@/lib/actions/pch-tender-line-actions";
import type { PchTenderLineDTO } from "@/lib/queries/pch";

type Res = { ok: boolean; error?: string };
const inp = "h-8 w-full rounded-md border border-input bg-background px-2 text-sm focus:border-primary focus:outline-none";
const LINE_STATUS: { value: string; label: string }[] = [
  { value: "PENDING", label: "À étudier" }, { value: "QUOTED", label: "Chiffré" },
  { value: "SUBMITTED", label: "Soumissionné" }, { value: "WON", label: "Gagné" }, { value: "LOST", label: "Perdu" },
  { value: "UNSUCCESSFUL", label: "Infructueux" }, { value: "CANCELLED", label: "Lot annulé" },
];
const fmt = (n: number | null) => (n == null ? "—" : new Intl.NumberFormat("fr-FR").format(n));

export function TenderLines({ tenderId, lines, canEdit, aiConfigured }: { tenderId: string; lines: PchTenderLineDTO[]; canEdit: boolean; aiConfigured: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [analyzing, setAnalyzing] = React.useState(false);
  const [text, setText] = React.useState("");
  const [showAnalyze, setShowAnalyze] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  async function run(fn: () => Promise<Res>) {
    if (busy) return; setBusy(true);
    const r = await fn(); setBusy(false);
    if (!r.ok) { window.alert(r.error ?? "Action impossible."); return; }
    router.refresh();
  }
  async function analyzeText() {
    if (!text.trim()) return;
    setAnalyzing(true);
    const fd = new FormData(); fd.set("tenderId", tenderId); fd.set("text", text.trim());
    const r: Res = await analyzeTenderText(fd);
    setAnalyzing(false);
    if (!r.ok) { window.alert(r.error ?? "Analyse impossible."); return; }
    setText(""); setShowAnalyze(false); router.refresh();
  }
  async function analyzeFile() {
    const f = fileRef.current?.files?.[0];
    if (!f) { window.alert("Choisissez d'abord le document de l'appel d'offres."); return; }
    setAnalyzing(true);
    const fd = new FormData(); fd.set("tenderId", tenderId); fd.set("file", f);
    const r: Res = await analyzeTenderDocument(fd);
    setAnalyzing(false);
    if (!r.ok) { window.alert(r.error ?? "Analyse impossible."); return; }
    if (fileRef.current) fileRef.current.value = "";
    setShowAnalyze(false); router.refresh();
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-base font-semibold"><Package className="h-4 w-4 text-primary" /> Produits du marché ({lines.length})</h3>
        {canEdit && (
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setShowAnalyze((s) => !s)} disabled={!aiConfigured}
              className="inline-flex items-center gap-1.5 rounded-lg border border-input px-3 py-1.5 text-sm font-medium hover:bg-secondary disabled:opacity-50" title={aiConfigured ? "Extraire les produits du document (OCR Mistral → IA)" : "IA non configurée"}>
              <Wand2 className="h-4 w-4" /> Analyser le document (IA)
            </button>
            <button type="button" disabled={busy || lines.length === 0} onClick={() => { const fd = new FormData(); fd.set("tenderId", tenderId); run(() => enrichAllTenderLines(fd)); }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-input px-3 py-1.5 text-sm font-medium hover:bg-secondary disabled:opacity-50"
              title="Rejouer l'intelligence marché sur TOUTES les lignes : prix de référence, nomenclature, concurrents, production locale ou importée">
              <Sparkles className="h-4 w-4" /> Enrichir tout
            </button>
            <button type="button" disabled={busy} onClick={() => { const fd = new FormData(); fd.set("tenderId", tenderId); run(() => addTenderLine(fd)); }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-input px-3 py-1.5 text-sm font-medium hover:bg-secondary disabled:opacity-60"><Plus className="h-4 w-4" /> Ajouter</button>
          </div>
        )}
        {lines.length > 0 && (
          <a href={`/api/pch/export?id=${tenderId}`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-input px-3 py-1.5 text-sm font-medium hover:bg-secondary"
            title="Tableau Excel : produits demandés (unité, conditionnement, boîtes, prix de référence) + analyse de marché">
            <Download className="h-4 w-4" /> Tableau Excel
          </a>
        )}
      </div>

      {showAnalyze && (
        <div className="space-y-3 rounded-lg border border-border bg-card p-3">
          {/* 1) Téléversement direct du document → OCR Mistral → extraction IA */}
          <div className="space-y-2">
            <p className="text-xs font-medium">Téléverser le document (PDF ou image) — OCR Mistral automatique</p>
            <div className="flex flex-wrap items-center gap-2">
              <input ref={fileRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.tif,.tiff" disabled={analyzing}
                className="text-xs file:mr-2 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-xs file:font-medium" />
              <button type="button" onClick={analyzeFile} disabled={analyzing} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
                {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Analyser le fichier
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2 text-[0.6875rem] uppercase tracking-wide text-muted-foreground"><span className="h-px flex-1 bg-border" /> ou coller le texte <span className="h-px flex-1 bg-border" /></div>
          {/* 2) Texte déjà extrait (OCR externe) */}
          <div className="space-y-2">
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} placeholder="Texte de l'appel d'offres (issu d'un OCR)…"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none" />
            <div className="flex gap-2">
              <button type="button" onClick={analyzeText} disabled={analyzing || !text.trim()} className="inline-flex items-center gap-1.5 rounded-lg border border-input px-3 py-2 text-sm font-medium hover:bg-secondary disabled:opacity-60">
                {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Extraire du texte
              </button>
              <button type="button" onClick={() => setShowAnalyze(false)} disabled={analyzing} className="rounded-lg border border-input px-3 py-2 text-sm hover:bg-secondary">Fermer</button>
            </div>
          </div>
        </div>
      )}

      {lines.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">Aucun produit. {canEdit && "Analysez le document ou ajoutez des lignes manuellement."}</p>
      ) : (
        <div className="space-y-2">
          {lines.map((l) => <LineCard key={l.id} tenderId={tenderId} line={l} canEdit={canEdit} busy={busy} run={run} />)}
        </div>
      )}
    </div>
  );
}

function LineCard({ tenderId, line, canEdit, busy, run }: { tenderId: string; line: PchTenderLineDTO; canEdit: boolean; busy: boolean; run: (fn: () => Promise<Res>) => void }) {
  const [s, setS] = React.useState({
    designation: line.designation, dci: line.dci ?? "", dosage: line.dosage ?? "", form: line.form ?? "",
    quantityUnits: String(line.quantityUnits || ""), unitsPerBox: line.unitsPerBox != null ? String(line.unitsPerBox) : "",
    unitLabel: line.unitLabel ?? "",
    haveProduct: line.haveProduct, unitPriceDzd: line.unitPriceDzd != null ? String(line.unitPriceDzd) : "",
    status: line.status, awardedUnitPriceDzd: line.awardedUnitPriceDzd != null ? String(line.awardedUnitPriceDzd) : "",
    awardedQuantityUnits: line.awardedQuantityUnits != null ? String(line.awardedQuantityUnits) : "",
    suppliersInfo: line.suppliersInfo ?? "", note: line.note ?? "",
  });
  const boxes = (() => { const q = Number(s.quantityUnits) || 0; const n = Number(s.unitsPerBox) || 0; return n > 0 ? Math.ceil(q / n) : null; })();

  function save() {
    const fd = new FormData();
    fd.set("id", line.id); fd.set("tenderId", tenderId);
    fd.set("designation", s.designation); fd.set("dci", s.dci); fd.set("dosage", s.dosage); fd.set("form", s.form);
    fd.set("quantityUnits", s.quantityUnits); fd.set("unitsPerBox", s.unitsPerBox); fd.set("unitLabel", s.unitLabel);
    if (s.haveProduct) fd.set("haveProduct", "on");
    fd.set("unitPriceDzd", s.unitPriceDzd); fd.set("status", s.status); fd.set("awardedUnitPriceDzd", s.awardedUnitPriceDzd);
    fd.set("awardedQuantityUnits", s.awardedQuantityUnits);
    fd.set("suppliersInfo", s.suppliersInfo); fd.set("note", s.note);
    run(() => updateTenderLine(fd));
  }

  if (!canEdit) {
    return (
      <div className="rounded-lg border border-border bg-card p-3 text-sm">
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium">{line.designation}</span>
          <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">{LINE_STATUS.find((x) => x.value === line.status)?.label ?? line.status}</span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{[line.dci, line.dosage, line.form].filter(Boolean).join(" · ") || "—"} · {fmt(line.quantityUnits)} {line.unitLabel ? `${line.unitLabel}(s)` : "unités"}{line.boxesNeeded ? ` = ${fmt(line.boxesNeeded)} boîtes` : ""}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {line.ourProduct && <span className="inline-flex items-center gap-1 rounded bg-primary/10 px-2 py-0.5 text-[0.6875rem] text-primary"><BadgeCheck className="h-3 w-3" /> {line.ourProduct}</span>}
          {line.refPriceDzd != null && <span className="rounded bg-secondary px-2 py-0.5 text-[0.6875rem]" title={line.refPriceSource ?? undefined}>Prix réf. PCH : {fmt(line.refPriceDzd)} DZD</span>}
          {line.fulfillmentPct != null && <span className="rounded bg-success/15 px-2 py-0.5 text-[0.6875rem] text-success">Vendu : {fmt(line.soldUnits)}/{fmt(line.quantityUnits)} ({line.fulfillmentPct}%)</span>}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border border-border bg-card p-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-12">
        <input className={`${inp} sm:col-span-6`} value={s.designation} onChange={(e) => setS({ ...s, designation: e.target.value })} onBlur={save} placeholder="Désignation produit" />
        <input className={`${inp} sm:col-span-3`} value={s.dci} onChange={(e) => setS({ ...s, dci: e.target.value })} onBlur={save} placeholder="DCI" />
        <select className={`${inp} sm:col-span-3`} value={s.status} onChange={(e) => { setS({ ...s, status: e.target.value }); }} onBlur={save}>
          {LINE_STATUS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <input className={`${inp} sm:col-span-3`} value={s.dosage} onChange={(e) => setS({ ...s, dosage: e.target.value })} onBlur={save} placeholder="Dosage" />
        <input className={`${inp} sm:col-span-3`} value={s.form} onChange={(e) => setS({ ...s, form: e.target.value })} onBlur={save} placeholder="Forme" />
        <div className="flex items-center gap-1 sm:col-span-3">
          <input className={inp} inputMode="numeric" value={s.quantityUnits} onChange={(e) => setS({ ...s, quantityUnits: e.target.value })} onBlur={save} placeholder="Quantité" />
          {/* Un appel d'offres ne parle pas toujours de comprimés : flacon, seringue, ampoule… */}
          <input className={`${inp} w-28`} value={s.unitLabel} onChange={(e) => setS({ ...s, unitLabel: e.target.value })} onBlur={save} placeholder="comprimé…" title="Nature de l'unité demandée" />
        </div>
        <div className="flex items-center gap-1 sm:col-span-3">
          <input className={inp} inputMode="numeric" value={s.unitsPerBox} onChange={(e) => setS({ ...s, unitsPerBox: e.target.value })} onBlur={save} placeholder="Boîte de N" />
          <span className="whitespace-nowrap text-xs font-medium text-primary">{boxes != null ? `= ${fmt(boxes)} bt` : ""}</span>
        </div>
        <label className="flex items-center gap-1.5 text-xs sm:col-span-3"><input type="checkbox" checked={s.haveProduct} onChange={(e) => { setS({ ...s, haveProduct: e.target.checked }); }} onBlur={save} className="h-4 w-4 rounded border-input" /> Nous l'avons</label>
        <input className={`${inp} sm:col-span-3`} inputMode="decimal" value={s.unitPriceDzd} onChange={(e) => setS({ ...s, unitPriceDzd: e.target.value })} onBlur={save} placeholder="Prix unité (DZD)" />
        <input className={`${inp} sm:col-span-3`} inputMode="decimal" value={s.awardedUnitPriceDzd} onChange={(e) => setS({ ...s, awardedUnitPriceDzd: e.target.value })} onBlur={save} placeholder="Prix attribué (DZD)" />
        {/* L'ATTRIBUTION PARTIELLE : vide = tout le soumis est gagné ; un chiffre = ce que
            l'organisme a réellement attribué (8 000 soumis, 4 000 gagnés). */}
        <input className={`${inp} sm:col-span-3`} inputMode="numeric" value={s.awardedQuantityUnits} onChange={(e) => setS({ ...s, awardedQuantityUnits: e.target.value })} onBlur={save} placeholder="Qté attribuée (si partielle)" title="Quantité attribuée — vide = quantité soumise entière" />
        <input className={`${inp} sm:col-span-6`} value={s.suppliersInfo} onChange={(e) => setS({ ...s, suppliersInfo: e.target.value })} onBlur={save} placeholder="Nos fournisseurs + prix / notes marché" />
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        {line.ourProduct && <span className="inline-flex items-center gap-1 rounded bg-primary/10 px-2 py-0.5 text-primary" title={line.registeredOurs ? "Produit enregistré chez nous" : undefined}><BadgeCheck className="h-3.5 w-3.5" /> {line.ourProduct}{line.registeredOurs ? " · enregistré" : ""}</span>}
        {line.refPriceDzd != null && <span className="rounded bg-secondary px-2 py-0.5" title={line.refPriceSource ?? undefined}>Prix réf. PCH : <strong>{fmt(line.refPriceDzd)}</strong> DZD</span>}
        {line.competitorCount != null && <span className="rounded bg-secondary px-2 py-0.5">Concurrents : <strong>{line.competitorCount}</strong></span>}
        <span className={`rounded px-2 py-0.5 ${line.registeredNomenclature ? "bg-success/15 text-success" : "bg-secondary text-muted-foreground"}`}>Nomenclature : {line.registeredNomenclature ? `oui (${line.nomLines ?? 0})` : "non"}</span>
        {line.marketEstimateDzd != null && <span className="rounded bg-secondary px-2 py-0.5">Marché ≈ {fmt(line.marketEstimateDzd)} DZD</span>}
        <MarketBadges line={line} />
        <div className="ml-auto flex items-center gap-1.5">
          <button type="button" disabled={busy} onClick={() => { const fd = new FormData(); fd.set("id", line.id); fd.set("tenderId", tenderId); run(() => enrichTenderLine(fd)); }}
            className="inline-flex items-center gap-1 rounded px-2 py-1 text-primary hover:bg-primary/10" title="Verrou prix Réception 2025 + concurrents + nomenclature + notre produit"><Sparkles className="h-3.5 w-3.5" /> Enrichir</button>
          <button type="button" disabled={busy} onClick={() => { if (window.confirm(`Supprimer « ${line.designation} » ?`)) { const fd = new FormData(); fd.set("id", line.id); fd.set("tenderId", tenderId); run(() => deleteTenderLine(fd)); } }}
            className="rounded p-1 text-destructive hover:bg-destructive/10"><Trash2 className="h-3.5 w-3.5" /></button>
        </div>
      </div>

      {line.status === "WON" && <SalesBlock tenderId={tenderId} line={line} canEdit={canEdit} busy={busy} run={run} />}
    </div>
  );
}

/**
 * PAYSAGE CONCURRENTIEL de la ligne, calculé par l'intelligence marché sur le triplet
 * molécule + dosage + forme : où est le marché (ville ou hôpital), qui le tient, et
 * s'il est fourni par des fabricants locaux ou des importateurs. Ne s'affiche que
 * lorsque l'enrichissement a réellement trouvé quelque chose — jamais de case vide.
 */
function MarketBadges({ line }: { line: PchTenderLineDTO }) {
  const hasSplit = line.marketVillePct != null && line.marketHopitalPct != null;
  const origin = line.marketOrigin;
  const concentration = line.marketHhi == null ? null : line.marketHhi >= 2500 ? "concentré" : line.marketHhi >= 1500 ? "modéré" : "fragmenté";
  if (!hasSplit && !origin && !line.competitorsTop && !concentration) return null;
  return (
    <>
      {hasSplit && (
        <span className="rounded bg-secondary px-2 py-0.5" title="Répartition du marché de cette molécule">
          Ville {Math.round(line.marketVillePct as number)} % · Hôpital {Math.round(line.marketHopitalPct as number)} %
        </span>
      )}
      {origin && (
        <span
          className={`inline-flex items-center gap-1 rounded px-2 py-0.5 ${origin === "LOCAL" ? "bg-success/15 text-success" : origin === "IMPORT" ? "bg-primary/10 text-primary" : "bg-secondary"}`}
          title="Origine dominante des acteurs qui pèsent sur ce marché (nomenclature)"
        >
          {origin === "IMPORT" ? <Ship className="h-3 w-3" /> : <Factory className="h-3 w-3" />}
          {origin === "LOCAL" ? "Fabriqué local" : origin === "IMPORT" ? "Importé" : "Local + importé"}
        </span>
      )}
      {concentration && <span className="rounded bg-secondary px-2 py-0.5" title={`HHI ${line.marketHhi}`}>Marché {concentration}</span>}
      {line.competitorsTop && (
        <span className="max-w-[22rem] truncate rounded bg-secondary px-2 py-0.5" title={line.competitorsTop}>
          {line.competitorsTop}
        </span>
      )}
    </>
  );
}

/** Ventes réelles : bons de commande (fractions) rattachés à une ligne GAGNÉE + taux de réalisation. */
function SalesBlock({ tenderId, line, canEdit, busy, run }: { tenderId: string; line: PchTenderLineDTO; canEdit: boolean; busy: boolean; run: (fn: () => Promise<Res>) => void }) {
  const [qty, setQty] = React.useState("");
  const [ref, setRef] = React.useState("");
  const pct = line.fulfillmentPct ?? 0;

  function addOrder() {
    const q = Number(qty) || 0;
    if (q <= 0) { window.alert("Indiquez la quantité vendue (fraction)."); return; }
    const fd = new FormData();
    fd.set("lineId", line.id); fd.set("tenderId", tenderId);
    fd.set("quantity", qty); fd.set("reference", ref);
    run(() => createOrderFromLine(fd));
    setQty(""); setRef("");
  }

  return (
    <div className="space-y-2 rounded-md border border-success/30 bg-success/5 p-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="inline-flex items-center gap-1 font-medium text-success"><TrendingUp className="h-3.5 w-3.5" /> Ventes réelles — bons de commande</span>
        <span className="text-muted-foreground">{fmt(line.soldUnits)} / {fmt(line.quantityUnits)} unités · {line.orderCount} bon(s) de commande</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
        <div className="h-full rounded-full bg-success transition-all" style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <p className="text-right text-[0.6875rem] font-medium text-success">{pct}% réalisé</p>
      {canEdit && (
        <div className="flex flex-wrap items-center gap-1.5">
          <input className={`${inp} w-32`} inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="Quantité vendue" />
          <input className={`${inp} min-w-[8rem] flex-1`} value={ref} onChange={(e) => setRef(e.target.value)} placeholder="N° bon de commande (optionnel)" />
          <button type="button" disabled={busy} onClick={addOrder} className="inline-flex items-center gap-1 rounded-lg bg-success px-2.5 py-1.5 text-xs font-medium text-white hover:bg-success/90 disabled:opacity-60"><ShoppingCart className="h-3.5 w-3.5" /> Enregistrer la vente</button>
        </div>
      )}
      <p className="text-[0.6875rem] text-muted-foreground">Chaque bon de commande devient une <strong>vente réelle</strong> (fraction de la quantité attribuée) et apparaît dans « Bons de commande » ci-dessous, avec son suivi logistique.</p>
    </div>
  );
}
