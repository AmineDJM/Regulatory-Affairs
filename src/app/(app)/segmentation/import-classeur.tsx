"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRafraichir } from "@/components/shared/use-rafraichir";
import { apercuImportSegmentation, importerSegmentation } from "@/lib/actions/segmentation-actions";

type Apercu = Extract<Awaited<ReturnType<typeof apercuImportSegmentation>>, { ok: true }>;
type Bilan = Extract<Awaited<ReturnType<typeof importerSegmentation>>, { ok: true }>;

/**
 * IMPORTER UN CLASSEUR — d'abord l'APERÇU (rien n'est écrit) : colonnes reconnues, praticiens retrouvés dans
 * l'annuaire, créés, ambigus, doublons, référentiels à créer, règles lues dans la feuille et leur concordance avec
 * les classements du fichier. Ensuite seulement, l'import. Le fichier est lu sur le serveur, pas sur le poste.
 */
export function ImportClasseur({ strategieId, aDesRegles }: { strategieId: string; aDesRegles: boolean }) {
  const { enCours, rafraichir } = useRafraichir();
  const [fichier, setFichier] = React.useState<File | null>(null);
  const [apercu, setApercu] = React.useState<Apercu | null>(null);
  const [bilan, setBilan] = React.useState<Bilan | null>(null);
  const [erreur, setErreur] = React.useState<string | null>(null);
  const [envoi, setEnvoi] = React.useState(false);

  const fd = () => { const f = new FormData(); f.set("strategieId", strategieId); if (fichier) f.set("fichier", fichier); return f; };

  async function analyser() {
    setEnvoi(true); setErreur(null); setApercu(null); setBilan(null);
    const r = await apercuImportSegmentation(fd());
    setEnvoi(false);
    if (!r.ok) setErreur(r.error); else setApercu(r);
  }
  async function importer() {
    setEnvoi(true); setErreur(null);
    const r = await importerSegmentation(fd());
    setEnvoi(false);
    if (!r.ok) { setErreur(r.error); return; }
    setBilan(r); setApercu(null); rafraichir();
  }

  const reglesBloquent = !aDesRegles && (!apercu?.regles || apercu.regles.erreurs.length > 0);

  return (
    <div className="space-y-4">
      <div className="surface flex flex-col gap-3 p-3 sm:flex-row sm:flex-wrap sm:items-end sm:p-4">
        <Input type="file" accept=".xlsx,.xls,.xlsm,.csv" onChange={(e) => { setFichier(e.target.files?.[0] ?? null); setApercu(null); setBilan(null); }} className="w-full sm:w-80" />
        {!apercu && <Button type="button" disabled={!fichier || envoi} onClick={analyser}>{envoi ? "Lecture…" : "Analyser le fichier"}</Button>}
        {apercu && !apercu.dejaImporte && <Button type="button" disabled={envoi || enCours || reglesBloquent} onClick={importer}>{envoi ? "Import…" : `Importer ${apercu.lignes - apercu.ambigus.length - apercu.doublons.length} praticien(s)`}</Button>}
      </div>
      {erreur && <p className="text-sm text-destructive">{erreur}</p>}
      {bilan && (
        <p className="rounded-md border border-success/30 bg-success/5 p-3 text-sm [overflow-wrap:anywhere]">
          Import terminé : {bilan.crees} praticien(s) créé(s) dans l&apos;annuaire, {bilan.misAJour} fiche(s) existante(s) complétée(s), {bilan.observations} potentiel(s) historisé(s){bilan.etablissementsCrees ? `, ${bilan.etablissementsCrees} établissement(s) créé(s)` : ""}{bilan.specialitesCreees ? `, ${bilan.specialitesCreees} spécialité(s) créée(s)` : ""}{bilan.reglePubliee ? `, règles v${bilan.reglePubliee} publiées` : ""}.
        </p>
      )}
      {apercu && (
        <div className="surface space-y-3 p-3 text-sm [overflow-wrap:anywhere] sm:p-4">
          {apercu.dejaImporte && <p className="font-medium text-destructive">Ce fichier a déjà été importé dans cette stratégie : rien ne sera ajouté une seconde fois.</p>}
          <p>Feuille « {apercu.feuille} » · {apercu.lignes} ligne(s) · <b>{apercu.existants}</b> praticien(s) déjà dans l&apos;annuaire (complétés, jamais écrasés) · <b>{apercu.nouveaux}</b> à créer · {apercu.observations} potentiel(s) · {apercu.nonCiblesDuFichier} NA dans le fichier (lettres recalculées par les règles).</p>
          {apercu.regionsSecteurs.length > 0 && <p>Régions rangées dans le secteur du même nom : {apercu.regionsSecteurs.join(", ")}.</p>}
          {apercu.regionsSansSecteur.length > 0 && <p className="text-warning">Régions sans secteur de ce nom dans la BU (secteur déduit de l&apos;établissement) : {apercu.regionsSansSecteur.join(", ")}.</p>}
          <p className="text-xs text-muted-foreground">Colonnes : {apercu.colonnes.map((c) => `${c.texte.split("\n")[0].slice(0, 40)} → ${c.champ ?? "ignorée"}`).join(" · ")}</p>
          {!apercu.produitConcorde && <p className="text-warning">Le fichier parle de « {apercu.produitMentionne} », qui ne ressemble pas au produit #1 de la stratégie. Vérifiez avant d&apos;importer.</p>}
          {apercu.etablissementsACreer.length > 0 && <p>Établissements créés dans l&apos;annuaire : {apercu.etablissementsACreer.join(", ")}.</p>}
          {apercu.etablissementsAmbigus.length > 0 && <p className="text-warning">Établissements ambigus (non rattachés) : {apercu.etablissementsAmbigus.join(", ")}.</p>}
          {apercu.specialitesACreer.length > 0 && <p>Spécialités créées : {apercu.specialitesACreer.join(", ")}.</p>}
          {apercu.ambigus.length > 0 && <p className="text-warning">À trancher (plusieurs fiches du même nom, rien n&apos;est écrit) : {apercu.ambigus.map((a) => `${a.nom} (l. ${a.ligne})`).join(", ")}.</p>}
          {apercu.doublons.length > 0 && <p className="text-warning">Doublons dans le fichier (ignorés, jamais additionnés) : {apercu.doublons.map((d) => `${d.nom} (l. ${d.ligne}, déjà l. ${d.ligneOrigine})`).join(", ")}.</p>}
          {apercu.conflits.length > 0 && <ul className="list-disc pl-5 text-xs text-muted-foreground">{apercu.conflits.map((c, i) => <li key={i}>{c}</li>)}</ul>}
          {apercu.anomalies.length > 0 && <ul className="list-disc pl-5 text-xs text-muted-foreground">{apercu.anomalies.map((c, i) => <li key={i}>{c}</li>)}</ul>}
          {apercu.regles && (
            <div className="space-y-1 border-t border-border pt-3">
              <p className="font-semibold">Règles v1 proposées (publiées avec l&apos;import, modifiables ensuite)</p>
              <ul className="list-disc pl-5 text-xs">{apercu.regles.provenance.map((p, i) => <li key={i}>{p}</li>)}</ul>
              {apercu.regles.erreurs.length > 0 && <p className="text-destructive">À compléter : {apercu.regles.erreurs.join(" ")} Publiez d&apos;abord les règles (onglet Règles), puis importez.</p>}
              {apercu.regles.concordance.total > 0 && (
                <p>Concordance avec les classements du fichier : <b>{apercu.regles.concordance.identiques}/{apercu.regles.concordance.total}</b>.</p>
              )}
              {apercu.regles.concordance.divergences.length > 0 && (
                <ul className="list-disc pl-5 text-xs text-muted-foreground">
                  {apercu.regles.concordance.divergences.map((d) => <li key={d.ligne}>Ligne {d.ligne} · {d.nom} : fichier {d.fichier}, règles {d.calcule}</li>)}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
