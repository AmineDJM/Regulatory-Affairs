"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Select, Label } from "@/components/ui/input";
import { useRafraichir } from "@/components/shared/use-rafraichir";
import { STATUTS, STATUT_LABELS, ETAT_LABELS, pct, type EtatProduit, type Statut } from "@/lib/segmentation/regles";
import type { ResultatPraticien } from "@/lib/segmentation/moteur";
import { enregistrerPotentiel, changerStatut, poserDerogation, leverDerogation, retirerDuPanel } from "@/lib/actions/segmentation-actions";

/**
 * LE PANEL DE LA STRATÉGIE — une ligne par praticien de l'annuaire : statut, segment par produit, priorité, visites.
 * Une ligne s'ouvre sur le POURQUOI de chaque résultat, l'historique du potentiel, et les gestes : renseigner le
 * potentiel (le fait — AMD calcule la conséquence), changer le statut, poser ou lever une dérogation motivée.
 */

export interface DerogationVue { id: string; nature: string; productId: string | null; valeur: string; valeurCalculee: string | null; motif: string; expireLe: string | null; source: string; creeLe: string }
export interface LigneVue {
  ficheId: string;
  doctorId: string;
  nom: string;
  grade: string;
  etablissement: string | null;
  specialite: string | null;
  statut: Statut | null;
  zone: string | null;
  derniereObservation: string | null;
  resultat: ResultatPraticien | null;
  derogations: DerogationVue[];
  historique: { potentiel: number | null; sur10: number | null; source: string; le: string; commentaire: string | null }[];
}

interface ProduitVue { productId: string; rang: number; nom: string }

const TON: Record<string, "success" | "info" | "warning" | "neutral" | "danger" | "purple"> = {
  A: "success", B: "info", C: "warning", D: "neutral", EN_ATTENTE: "purple", NON_CIBLE: "neutral",
};

function EtatBadge({ etat, derogee }: { etat: EtatProduit; derogee?: boolean }) {
  return (
    <Badge tone={TON[etat] ?? "neutral"} title={derogee ? "Dérogation posée à la main" : undefined}>
      {etat === "EN_ATTENTE" ? "En attente" : etat === "NON_CIBLE" ? "NC" : etat}{derogee ? " *" : ""}
    </Badge>
  );
}

const fraicheur = (iso: string | null): string => {
  if (!iso) return "jamais renseigné";
  const j = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return j <= 0 ? "aujourd'hui" : j === 1 ? "hier" : `il y a ${j} j`;
};

export function Panel({ strategieId, produits, lignes, zones, reglesPubliees, peutModifier, peutDeroger }: {
  strategieId: string; produits: ProduitVue[]; lignes: LigneVue[]; zones: string[];
  reglesPubliees: boolean; peutModifier: boolean; peutDeroger: boolean;
}) {
  const [q, setQ] = React.useState("");
  const [zone, setZone] = React.useState("");
  const [etat, setEtat] = React.useState("");
  const [statut, setStatut] = React.useState("");
  const [ouverte, setOuverte] = React.useState<string | null>(null);
  const p1 = produits[0]?.productId;

  const visibles = lignes.filter((l) => {
    if (q && !`${l.nom} ${l.etablissement ?? ""} ${l.specialite ?? ""}`.toLowerCase().includes(q.toLowerCase())) return false;
    if (zone && l.zone !== zone) return false;
    if (statut === "H" ? !l.resultat?.h : statut && l.statut !== statut) return false;
    if (etat && l.resultat?.produits.find((p) => p.productId === p1)?.etat !== etat) return false;
    return true;
  });

  if (lignes.length === 0) {
    return <p className="surface p-5 text-sm text-muted-foreground">Le panel est vide. Importez le classeur de segmentation (onglet Import) ou ajoutez des praticiens de l&apos;annuaire.</p>;
  }

  return (
    <div className="space-y-3">
      {!reglesPubliees && <p className="rounded-md border border-warning/30 bg-warning/5 p-3 text-sm">Aucune règle publiée : les segments ne se calculent pas encore (onglet Règles).</p>}
      <div className="flex flex-wrap items-end gap-2">
        <Input placeholder="Rechercher un praticien, un établissement…" value={q} onChange={(e) => setQ(e.target.value)} className="w-64" />
        <Select value={zone} onChange={(e) => setZone(e.target.value)} className="w-36">
          <option value="">Toutes les zones</option>
          {zones.map((z) => <option key={z} value={z}>{z}</option>)}
        </Select>
        <Select value={statut} onChange={(e) => setStatut(e.target.value)} className="w-40">
          <option value="">Tous les statuts</option>
          <option value="H">Décideurs (H)</option>
          {STATUTS.map((s) => <option key={s} value={s}>{STATUT_LABELS[s]}</option>)}
        </Select>
        {produits[0] && (
          <Select value={etat} onChange={(e) => setEtat(e.target.value)} className="w-48">
            <option value="">{produits[0].nom} : tous</option>
            {(["A", "B", "C", "D", "EN_ATTENTE", "NON_CIBLE"] as const).map((k) => <option key={k} value={k}>{ETAT_LABELS[k]}</option>)}
          </Select>
        )}
        <span className="text-xs text-muted-foreground">{visibles.length} / {lignes.length}</span>
      </div>
      <div className="surface overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Praticien</th>
              <th className="px-3 py-2">Statut</th>
              <th className="px-3 py-2">Zone</th>
              {produits.map((p) => <th key={p.productId} className="px-3 py-2">#{p.rang} {p.nom}</th>)}
              <th className="px-3 py-2">Priorité</th>
              <th className="px-3 py-2">Visites</th>
              <th className="px-3 py-2">Potentiel</th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((l) => (
              <React.Fragment key={l.doctorId}>
                <tr className="cursor-pointer border-b border-border/60 hover:bg-secondary/40" onClick={() => setOuverte(ouverte === l.doctorId ? null : l.doctorId)}>
                  <td className="px-3 py-2">
                    <Link href={`/praticiens/${l.doctorId}`} onClick={(e) => e.stopPropagation()} className="font-medium hover:underline">{l.nom}</Link>
                    <div className="text-xs text-muted-foreground">{[l.etablissement, l.specialite].filter(Boolean).join(" · ")}</div>
                  </td>
                  <td className="px-3 py-2">
                    {l.resultat?.h && <Badge tone="purple" className="mr-1">H</Badge>}
                    {l.statut ? STATUT_LABELS[l.statut] : "—"}
                  </td>
                  <td className="px-3 py-2">{l.zone ?? "—"}</td>
                  {produits.map((p) => {
                    const r = l.resultat?.produits.find((x) => x.productId === p.productId);
                    return <td key={p.productId} className="px-3 py-2">{r ? <EtatBadge etat={r.etat} derogee={!!r.derogation} /> : "—"}</td>;
                  })}
                  <td className="px-3 py-2">{l.resultat ? (l.resultat.cible ? l.resultat.priorite ?? "—" : "Non ciblé") : "—"}</td>
                  <td className="px-3 py-2">{l.resultat?.visites ?? "—"}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{fraicheur(l.derniereObservation)}</td>
                </tr>
                {ouverte === l.doctorId && (
                  <tr className="border-b border-border bg-secondary/20">
                    <td colSpan={6 + produits.length} className="px-3 py-3">
                      <Fiche strategieId={strategieId} ligne={l} produits={produits} peutModifier={peutModifier} peutDeroger={peutDeroger} />
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Fiche({ strategieId, ligne, produits, peutModifier, peutDeroger }: { strategieId: string; ligne: LigneVue; produits: ProduitVue[]; peutModifier: boolean; peutDeroger: boolean }) {
  const { enCours, rafraichir } = useRafraichir();
  const [message, setMessage] = React.useState<string | null>(null);
  const [envoi, setEnvoi] = React.useState(false);
  const r = ligne.resultat;
  const occupe = envoi || enCours;

  async function agir(f: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    setEnvoi(true); setMessage(null);
    try {
      const res = await f();
      if (!res.ok) setMessage(res.error); else rafraichir();
    } finally { setEnvoi(false); }
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div className="space-y-3">
        {r ? (
          <>
            {r.produits.map((p) => (
              <div key={p.productId}>
                <p className="text-xs font-semibold">{produits.find((x) => x.productId === p.productId)?.nom} — pourquoi {ETAT_LABELS[p.etat]} ?</p>
                <ul className="list-disc pl-5 text-xs text-muted-foreground">{p.pourquoi.map((t, i) => <li key={i}>{t}</li>)}</ul>
                {p.affinite !== null && <p className="text-xs text-muted-foreground">Affinité calculée : {pct(p.affinite)}</p>}
              </div>
            ))}
            <p className="text-xs"><span className="font-semibold">Priorité :</span> {r.pourquoiPriorite}</p>
            <p className="text-xs"><span className="font-semibold">Visites :</span> {r.pourquoiVisites}</p>
          </>
        ) : <p className="text-xs text-muted-foreground">Règles non publiées : aucun calcul.</p>}
        <div>
          <p className="text-xs font-semibold">Historique du potentiel</p>
          {ligne.historique.length === 0 && <p className="text-xs text-muted-foreground">Aucune donnée terrain.</p>}
          {ligne.historique.map((h, i) => (
            <p key={i} className="text-xs text-muted-foreground">
              {new Date(h.le).toLocaleDateString("fr-FR")} · {h.potentiel ?? "—"} patients · {h.sur10 ?? "—"}/10 · {h.source === "IMPORT" ? "import" : h.source === "TERRAIN" ? "terrain" : "saisie"}{h.commentaire ? ` · ${h.commentaire}` : ""}
            </p>
          ))}
        </div>
        {ligne.derogations.length > 0 && (
          <div>
            <p className="text-xs font-semibold">Dérogations en vigueur</p>
            {ligne.derogations.map((d) => (
              <div key={d.id} className="flex items-center gap-2 text-xs">
                <span>{d.nature === "CIBLAGE" ? (d.valeur === "CIBLE" ? "Ciblé" : "Non ciblé") : `${produits.find((p) => p.productId === d.productId)?.nom ?? ""} ${d.valeur}`} (calculé : {d.valeurCalculee ?? "—"}) — {d.motif}{d.expireLe ? ` · jusqu'au ${new Date(d.expireLe).toLocaleDateString("fr-FR")}` : ""}</span>
                {peutDeroger && <Button size="sm" variant="ghost" disabled={occupe} onClick={() => agir(() => leverDerogation(d.id))}>Lever</Button>}
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="space-y-4">
        {message && <p className="text-xs text-destructive">{message}</p>}
        {peutModifier && <FormPotentiel strategieId={strategieId} doctorId={ligne.doctorId} produits={produits} occupe={occupe} agir={agir} />}
        {peutModifier && <FormStatut strategieId={strategieId} ligne={ligne} occupe={occupe} agir={agir} />}
        {peutDeroger && <FormDerogation strategieId={strategieId} doctorId={ligne.doctorId} produits={produits} occupe={occupe} agir={agir} />}
        {peutDeroger && (
          <button type="button" className="text-xs text-muted-foreground underline" disabled={occupe} onClick={() => agir(() => retirerDuPanel(strategieId, ligne.doctorId))}>
            Retirer du panel
          </button>
        )}
      </div>
    </div>
  );
}

type Agir = (f: () => Promise<{ ok: true } | { ok: false; error: string }>) => Promise<void>;

function FormPotentiel({ strategieId, doctorId, produits, occupe, agir }: { strategieId: string; doctorId: string; produits: ProduitVue[]; occupe: boolean; agir: Agir }) {
  const [productId, setProductId] = React.useState(produits[0]?.productId ?? "");
  const [potentiel, setPotentiel] = React.useState("");
  const [sur10, setSur10] = React.useState("");
  return (
    <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); void agir(() => enregistrerPotentiel({ strategieId, doctorId, productId, potentiel, sur10 })); }}>
      <p className="text-xs font-semibold">Mettre à jour le potentiel</p>
      <div className="flex flex-wrap items-end gap-2">
        {produits.length > 1 && (
          <Select value={productId} onChange={(e) => setProductId(e.target.value)} className="w-40">
            {produits.map((p) => <option key={p.productId} value={p.productId}>{p.nom}</option>)}
          </Select>
        )}
        <div><Label className="text-xs">Patients / semaine</Label><Input inputMode="decimal" value={potentiel} onChange={(e) => setPotentiel(e.target.value)} className="w-28" /></div>
        <div><Label className="text-xs">Sur 10, sous le produit</Label><Input inputMode="decimal" value={sur10} onChange={(e) => setSur10(e.target.value)} className="w-28" /></div>
        <Button size="sm" type="submit" disabled={occupe || (!potentiel && !sur10)}>Enregistrer</Button>
      </div>
    </form>
  );
}

function FormStatut({ strategieId, ligne, occupe, agir }: { strategieId: string; ligne: LigneVue; occupe: boolean; agir: Agir }) {
  const [statut, setStatut] = React.useState<string>(ligne.statut ?? "");
  const [zone, setZone] = React.useState(ligne.zone ?? "");
  const change = statut !== (ligne.statut ?? "") || zone !== (ligne.zone ?? "");
  return (
    <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); void agir(() => changerStatut({ strategieId, doctorId: ligne.doctorId, statut: statut || null, zone })); }}>
      <p className="text-xs font-semibold">Statut et zone</p>
      <div className="flex flex-wrap items-end gap-2">
        <Select value={statut} onChange={(e) => setStatut(e.target.value)} className="w-40">
          <option value="">Non renseigné</option>
          {STATUTS.map((s) => <option key={s} value={s}>{STATUT_LABELS[s]}</option>)}
        </Select>
        <Input value={zone} onChange={(e) => setZone(e.target.value)} placeholder="Zone" className="w-28" />
        {change && <Button size="sm" type="submit" disabled={occupe}>Enregistrer</Button>}
      </div>
    </form>
  );
}

function FormDerogation({ strategieId, doctorId, produits, occupe, agir }: { strategieId: string; doctorId: string; produits: ProduitVue[]; occupe: boolean; agir: Agir }) {
  const [cible, setCible] = React.useState("SEGMENT:" + (produits[0]?.productId ?? ""));
  const [valeur, setValeur] = React.useState("A");
  const [motif, setMotif] = React.useState("");
  const [expire, setExpire] = React.useState("");
  const ciblage = cible === "CIBLAGE";
  return (
    <form className="space-y-2" onSubmit={(e) => {
      e.preventDefault();
      void agir(() => poserDerogation({ strategieId, doctorId, nature: ciblage ? "CIBLAGE" : "SEGMENT", productId: ciblage ? null : cible.slice(8), valeur: ciblage ? (valeur === "CIBLE" ? "CIBLE" : "NON_CIBLE") : valeur, motif, expireLe: expire || null }));
    }}>
      <p className="text-xs font-semibold">Déroger au calcul (motif obligatoire)</p>
      <div className="flex flex-wrap items-end gap-2">
        <Select value={cible} onChange={(e) => { setCible(e.target.value); setValeur(e.target.value === "CIBLAGE" ? "NON_CIBLE" : "A"); }} className="w-40">
          {produits.map((p) => <option key={p.productId} value={`SEGMENT:${p.productId}`}>Segment {p.nom}</option>)}
          <option value="CIBLAGE">Ciblage</option>
        </Select>
        <Select value={valeur} onChange={(e) => setValeur(e.target.value)} className="w-32">
          {ciblage ? (<><option value="NON_CIBLE">Non ciblé</option><option value="CIBLE">Ciblé</option></>) : ["A", "B", "C", "D"].map((s) => <option key={s} value={s}>{s}</option>)}
        </Select>
        <Input value={motif} onChange={(e) => setMotif(e.target.value)} placeholder="Motif" className="w-56" />
        <Input type="date" value={expire} onChange={(e) => setExpire(e.target.value)} className="w-40" title="Échéance (facultative)" />
        <Button size="sm" variant="outline" type="submit" disabled={occupe || motif.trim().length < 3}>Poser</Button>
      </div>
    </form>
  );
}
