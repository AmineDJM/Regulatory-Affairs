"use client";

import * as React from "react";
import { Loader2, ScanSearch, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRafraichir } from "@/components/shared/use-rafraichir";
import { appliquerRattachementCanonique, simulerRattachementCanonique } from "@/lib/actions/produit-canonique-actions";
import type { BilanRattachement } from "@/lib/products/canonique";
import { phraseManques } from "@/lib/products/identity";

/**
 * LE RATTACHEMENT DE L'EXISTANT (Super Admin) — l'aperçu d'abord, l'écriture ensuite.
 *
 * Les dossiers créés avant le produit canonique n'en ont pas. Le geste les rattache tous, sur leur
 * identité complète et sur rien d'autre ; la simulation dit, AVANT le clic, combien seraient
 * rattachés, combien créeraient leur produit, et lesquels restent incomplets et pourquoi. Un
 * rattachement de masse qui écrit sans qu'on l'ait vu serait une migration de données déguisée.
 */
export function RattachementGlobal() {
  const { enCours, rafraichir } = useRafraichir();
  const [etape, setEtape] = React.useState<"repos" | "simulation" | "application">("repos");
  const [bilan, setBilan] = React.useState<BilanRattachement | null>(null);
  const [erreur, setErreur] = React.useState<string | null>(null);

  async function simuler() {
    setEtape("simulation"); setErreur(null);
    const r = await simulerRattachementCanonique();
    setEtape("repos");
    if (!r.ok) { setErreur(r.error); return; }
    setBilan(r.bilan);
  }

  async function appliquer() {
    if (!window.confirm("Rattacher tous les dossiers à l'identité complète à leur produit canonique ?")) return;
    setEtape("application"); setErreur(null);
    const r = await appliquerRattachementCanonique();
    setEtape("repos");
    if (!r.ok) { setErreur(r.error); return; }
    setBilan(r.bilan);
    rafraichir();
  }

  const occupe = etape !== "repos" || enCours;
  const aFaire = bilan ? bilan.dossiers.rattaches + bilan.dossiers.crees + bilan.dossiers.corriges + bilan.profilsSuivis + bilan.clesMisesAJour : 0;

  return (
    <section className="surface space-y-3 p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold">Rattacher l&apos;existant</h2>
          <p className="text-xs text-muted-foreground">
            Chaque dossier à l&apos;identité complète (DCI, dosage, forme, conditionnement) rejoint son produit canonique ; les autres restent à compléter.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button size="sm" variant="outline" disabled={occupe} onClick={simuler}>
            {etape === "simulation" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ScanSearch className="h-3.5 w-3.5" />} Simuler
          </Button>
          {bilan?.simulation && aFaire > 0 && (
            <Button size="sm" disabled={occupe} onClick={appliquer}>
              {etape === "application" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />} Appliquer
            </Button>
          )}
        </div>
      </div>

      {erreur && <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{erreur}</p>}

      {bilan && (
        <div className="space-y-2 text-sm" role="status">
          <p className="font-medium">
            {bilan.simulation ? "Ce que ferait le rattachement (rien n'est encore écrit) :" : "Rattachement effectué :"}
          </p>
          <ul className="grid grid-cols-1 gap-1 text-xs sm:grid-cols-2">
            <li>{bilan.dossiers.total} dossier(s) au total, {bilan.dossiers.deja} déjà rattaché(s)</li>
            <li>{bilan.dossiers.crees} produit(s) {bilan.simulation ? "à créer" : "créé(s)"}</li>
            <li>{bilan.dossiers.rattaches} dossier(s) {bilan.simulation ? "à rattacher" : "rattaché(s)"} à un produit existant</li>
            <li>{bilan.dossiers.corriges} dossier(s) dont l&apos;identité a changé</li>
            <li>{bilan.profilsSuivis} produit(s) de BU ou de BD qui suivent leur dossier</li>
            <li>{bilan.clesMisesAJour} clé(s) d&apos;identité remise(s) à jour</li>
          </ul>
          {bilan.conflits.length > 0 && (
            <div className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs">
              <p className="font-medium text-warning">{bilan.conflits.length} identité(s) portée(s) par plusieurs produits — doublons à réunir à la main :</p>
              <ul className="mt-1 space-y-0.5">
                {bilan.conflits.slice(0, 10).map((c) => (
                  <li key={c.cle}>{c.produits.map((p) => `${p.code} (${p.canonicalName})`).join(" · ")}</li>
                ))}
              </ul>
            </div>
          )}
          {bilan.dossiers.incomplets.length > 0 && (
            <details className="text-xs">
              <summary className="cursor-pointer text-muted-foreground">
                {bilan.dossiers.incomplets.length} dossier(s) incomplet(s), non rattaché(s)
              </summary>
              <ul className="mt-1 space-y-0.5">
                {bilan.dossiers.incomplets.slice(0, 50).map((d) => (
                  <li key={d.id}>{d.reference} — {d.dci} : il manque {phraseManques(d.manques)}</li>
                ))}
                {bilan.dossiers.incomplets.length > 50 && <li className="text-muted-foreground">… et {bilan.dossiers.incomplets.length - 50} autre(s), listés plus bas.</li>}
              </ul>
            </details>
          )}
          {bilan.promoSansProduit.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {bilan.promoSansProduit.length} produit(s) de BU sans dossier : à rattacher à leur dossier dans « Rapprochement des catalogues ».
            </p>
          )}
        </div>
      )}
    </section>
  );
}
