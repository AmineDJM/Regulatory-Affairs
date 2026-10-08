"use client";

import * as React from "react";
import { ChevronDown, ChevronRight, ClipboardPaste, Loader2, Paperclip, Save } from "lucide-react";
import { enregistrerStockPch } from "@/lib/actions/stock-pch-actions";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { useRafraichir } from "@/components/shared/use-rafraichir";
import { ageEnJours, analyserCollage, cleReleve, estPerime, ilYa, type LigneCollee } from "@/lib/stocks/pch-central";
import { cn, formatDate, formatNumber } from "@/lib/utils";

interface ProduitDTO { id: string; label: string; buId: string | null; buNom: string; noms: string[] }
interface EtatDTO { id: string; productId: string; scope: string; annexId: string | null; date: string; quantity: number }
interface ReleveDTO { cle: string; lignes: number; pieces: { id: string; name: string }[] }

const aujourdhui = () => new Date().toISOString().slice(0, 10);

const QUALITE: Record<LigneCollee["qualite"], { label: string; cls: string }> = {
  exact: { label: "reconnu", cls: "text-success" },
  approche: { label: "à vérifier", cls: "text-warning" },
  ambigu: { label: "plusieurs possibles", cls: "text-warning" },
  aucun: { label: "non reconnu", cls: "text-destructive" },
};

/**
 * LA SAISIE D'UN RELEVÉ PCH — une ligne par produit, groupée par BU : le dernier relevé du lieu choisi (avec son âge) et
 * la nouvelle quantité. « Coller le tableau » reconnaît nos produits dans un collage Excel ou le texte du mail, et
 * demande CONFIRMATION avant de remplir les cases. Un seul geste principal : « Enregistrer le relevé ».
 */
export function SaisieStockPch({ produits, annexes, etats, releves, peutSaisir }: {
  produits: ProduitDTO[];
  annexes: { id: string; name: string }[];
  etats: EtatDTO[];
  releves: ReleveDTO[];
  peutSaisir: boolean;
}) {
  const { enCours, rafraichir } = useRafraichir();
  const [date, setDate] = React.useState(aujourdhui);
  const [annexId, setAnnexId] = React.useState("");
  const [quantites, setQuantites] = React.useState<Record<string, string>>({});
  const [ouvert, setOuvert] = React.useState<string | null>(null);
  const [collage, setCollage] = React.useState<{ texte: string; lignes: LigneCollee[] | null } | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [erreur, setErreur] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);
  const fichiers = React.useRef<HTMLInputElement>(null);

  // Le lieu choisi : la PCH centrale (scope PCH) ou une annexe (scope ANNEX + son lieu).
  const duLieu = React.useCallback((e: EtatDTO) => (annexId ? e.scope === "ANNEX" && e.annexId === annexId : e.scope === "PCH" && !e.annexId), [annexId]);
  const historique = React.useMemo(() => {
    const m = new Map<string, EtatDTO[]>();
    for (const e of etats) if (duLieu(e)) (m.get(e.productId) ?? m.set(e.productId, []).get(e.productId)!).push(e);
    return m; // ordre : le plus récent d'abord (le serveur trie)
  }, [etats, duLieu]);

  const groupes = React.useMemo(() => {
    const g = new Map<string, { nom: string; produits: ProduitDTO[] }>();
    for (const p of produits) {
      const k = p.buId ?? "-";
      (g.get(k) ?? g.set(k, { nom: p.buNom, produits: [] }).get(k)!).produits.push(p);
    }
    return [...g.entries()];
  }, [produits]);
  const uniques = React.useMemo(() => [...new Map(produits.map((p) => [p.id, p])).values()], [produits]);
  const saisies = Object.values(quantites).filter((v) => v.trim()).length;

  function analyser() {
    if (!collage) return;
    setCollage({ ...collage, lignes: analyserCollage(collage.texte, uniques.map((p) => ({ id: p.id, noms: p.noms }))) });
  }
  function choisir(i: number, productId: string) {
    if (!collage?.lignes) return;
    setCollage({ ...collage, lignes: collage.lignes.map((l, j) => (j === i ? { ...l, productId: productId || null, qualite: productId ? "exact" : "aucun" } : l)) });
  }
  function appliquer() {
    if (!collage?.lignes) return;
    const suivantes = { ...quantites };
    for (const l of collage.lignes) if (l.productId && l.quantite !== null) suivantes[l.productId] = String(l.quantite);
    setQuantites(suivantes);
    setCollage(null);
    setMessage(null);
  }

  async function enregistrer() {
    setBusy(true); setErreur(null); setMessage(null);
    const fd = new FormData();
    fd.set("date", date);
    if (annexId) fd.set("annexId", annexId);
    for (const [productId, q] of Object.entries(quantites)) {
      if (!q.trim()) continue;
      fd.append("productId", productId);
      fd.append("quantity", q.trim());
    }
    for (const f of Array.from(fichiers.current?.files ?? [])) fd.append("files", f);
    const r = await enregistrerStockPch(fd);
    setBusy(false);
    if (!r.ok) { setErreur(r.error ?? "Échec de l'enregistrement."); return; }
    setQuantites({});
    if (fichiers.current) fichiers.current.value = "";
    setMessage(r.message ?? "Relevé enregistré.");
    rafraichir();
  }

  const occupe = busy || enCours;
  const lignesCollees = collage?.lignes ?? null;
  const reconnues = lignesCollees?.filter((l) => l.productId && l.quantite !== null).length ?? 0;

  return (
    <div className="space-y-4">
      {peutSaisir && (
        <div className="surface flex flex-wrap items-end gap-3 rounded-xl p-3">
          <div className="min-w-[150px] space-y-1">
            <Label htmlFor="date-mail">Date du mail</Label>
            <Input id="date-mail" type="date" value={date} max={aujourdhui()} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="min-w-[180px] space-y-1">
            <Label htmlFor="lieu-pch">Lieu</Label>
            <Select id="lieu-pch" value={annexId} onChange={(e) => setAnnexId(e.target.value)}>
              <option value="">PCH centrale</option>
              {annexes.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </Select>
          </div>
          <div className="min-w-[200px] flex-1 space-y-1">
            <Label htmlFor="pieces-pch">Mail / PDF</Label>
            <Input id="pieces-pch" ref={fichiers} type="file" multiple accept=".pdf,.eml,.msg,.xlsx,.xls,.csv,.png,.jpg,.jpeg,.txt" />
          </div>
          <Button type="button" variant="outline" onClick={() => setCollage({ texte: "", lignes: null })} disabled={occupe}>
            <ClipboardPaste className="h-4 w-4" /> Coller le tableau
          </Button>
          <Button type="button" onClick={enregistrer} disabled={occupe || !date}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Enregistrer le relevé{saisies ? ` (${saisies})` : ""}
          </Button>
        </div>
      )}
      {erreur && <p className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">{erreur}</p>}
      {message && <p className="rounded-lg border border-success/40 bg-success/5 px-3 py-2 text-sm">{message}</p>}

      {collage && (
        <div className="surface space-y-3 rounded-xl p-3">
          {lignesCollees === null ? (
            <>
              <Label htmlFor="collage-pch">Collez les lignes (produit, quantité) depuis Excel ou le mail</Label>
              <Textarea id="collage-pch" rows={8} value={collage.texte} onChange={(e) => setCollage({ texte: e.target.value, lignes: null })} placeholder={"Darunavir 600 mg\t1 540\nRaltégravir 400 mg\t2 100"} />
              <div className="flex gap-2">
                <Button type="button" onClick={analyser} disabled={!collage.texte.trim()}>Reconnaître</Button>
                <Button type="button" variant="outline" onClick={() => setCollage(null)}>Annuler</Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm font-medium">{reconnues} ligne{reconnues > 1 ? "s" : ""} prête{reconnues > 1 ? "s" : ""} sur {lignesCollees.length} — vérifiez avant d&apos;appliquer.</p>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted-foreground">
                      <th className="px-2 py-1.5 font-medium">Collé</th>
                      <th className="px-2 py-1.5 text-right font-medium">Quantité</th>
                      <th className="px-2 py-1.5 font-medium">Produit</th>
                      <th className="px-2 py-1.5 font-medium" />
                    </tr>
                  </thead>
                  <tbody>
                    {lignesCollees.map((l, i) => (
                      <tr key={i} className="border-b border-border last:border-0">
                        <td className="max-w-[240px] truncate px-2 py-1.5 text-muted-foreground" title={l.texte}>{l.libelle}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{l.quantite === null ? "—" : formatNumber(l.quantite)}</td>
                        <td className="px-2 py-1.5">
                          <Select aria-label={`Produit pour ${l.libelle}`} value={l.productId ?? ""} onChange={(e) => choisir(i, e.target.value)}>
                            <option value="">— Ignorer —</option>
                            {uniques.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                          </Select>
                        </td>
                        <td className={cn("whitespace-nowrap px-2 py-1.5 text-xs", QUALITE[l.qualite].cls)}>{QUALITE[l.qualite].label}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex gap-2">
                <Button type="button" onClick={appliquer} disabled={reconnues === 0}>Appliquer {reconnues} quantité{reconnues > 1 ? "s" : ""}</Button>
                <Button type="button" variant="outline" onClick={() => setCollage({ texte: collage.texte, lignes: null })}>Modifier le collage</Button>
                <Button type="button" variant="ghost" onClick={() => setCollage(null)}>Annuler</Button>
              </div>
            </>
          )}
        </div>
      )}

      <div className="surface overflow-x-auto rounded-xl">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="sticky left-0 z-10 bg-card px-3 py-2 font-medium">Produit</th>
              <th className="px-3 py-2 text-right font-medium">Dernier relevé</th>
              {peutSaisir && <th className="px-3 py-2 text-right font-medium">Quantité au {date ? formatDate(date) : "—"}</th>}
            </tr>
          </thead>
          <tbody>
            {groupes.map(([cle, g]) => (
              <React.Fragment key={cle}>
                {groupes.length > 1 && (
                  <tr className="border-b border-border bg-secondary/40">
                    <td colSpan={peutSaisir ? 3 : 2} className="sticky left-0 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{g.nom}</td>
                  </tr>
                )}
                {g.produits.map((p) => {
                  const h = historique.get(p.id) ?? [];
                  const dernier = h[0] ?? null;
                  const age = ageEnJours(dernier?.date);
                  const cleLigne = `${cle}:${p.id}`;
                  return (
                    <React.Fragment key={cleLigne}>
                      <tr className="border-b border-border">
                        <td className="sticky left-0 z-10 bg-card px-3 py-2">
                          <button type="button" className="inline-flex items-center gap-1 text-left font-medium hover:text-primary disabled:hover:text-foreground"
                            onClick={() => setOuvert(ouvert === cleLigne ? null : cleLigne)} disabled={h.length === 0} aria-expanded={ouvert === cleLigne}>
                            {h.length > 0 ? (ouvert === cleLigne ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />) : <span className="w-3.5" />}
                            {p.label}
                          </button>
                        </td>
                        <td className="px-3 py-2 text-right">
                          {dernier ? (
                            <>
                              <div className="tabular-nums">{formatNumber(dernier.quantity)}</div>
                              <div className={cn("text-xs", estPerime(age) ? "font-medium text-warning" : "text-muted-foreground")}>{ilYa(age)}</div>
                            </>
                          ) : <span className="text-muted-foreground">—</span>}
                        </td>
                        {peutSaisir && (
                          <td className="px-3 py-2 text-right">
                            <Input
                              aria-label={`Quantité ${p.label}`} inputMode="numeric" className="ml-auto h-9 w-28 text-right tabular-nums"
                              value={quantites[p.id] ?? ""} onChange={(e) => setQuantites({ ...quantites, [p.id]: e.target.value })}
                            />
                          </td>
                        )}
                      </tr>
                      {ouvert === cleLigne && (
                        <tr className="border-b border-border bg-secondary/20">
                          <td colSpan={peutSaisir ? 3 : 2} className="px-3 py-2">
                            <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                              {h.slice(0, 24).map((e, i) => {
                                const avant = h[i + 1];
                                const delta = avant ? e.quantity - avant.quantity : null;
                                return (
                                  <li key={e.id} className="tabular-nums">
                                    <span className="text-muted-foreground">{formatDate(e.date)}</span> {formatNumber(e.quantity)}
                                    {delta !== null && delta !== 0 && <span className={delta < 0 ? "text-destructive" : "text-success"}> ({delta > 0 ? "+" : ""}{formatNumber(delta)})</span>}
                                  </li>
                                );
                              })}
                            </ul>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {releves.length > 0 && (
        <section className="surface rounded-xl">
          <h2 className="border-b border-border px-3 py-2 text-sm font-semibold">Relevés reçus</h2>
          <ul className="divide-y divide-border text-sm">
            {releves.slice(0, 24).map((r) => (
              <li key={r.cle} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
                <span className="font-medium">{formatDate(r.cle)}</span>
                <span className="text-xs text-muted-foreground">{r.lignes} quantité{r.lignes > 1 ? "s" : ""}{r.cle === cleReleve(new Date()) ? " · aujourd'hui" : ""}</span>
                {r.pieces.map((d) => (
                  <a key={d.id} href={`/api/documents/${d.id}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                    <Paperclip className="h-3 w-3" /> {d.name}
                  </a>
                ))}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
