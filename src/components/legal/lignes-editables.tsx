"use client";

import * as React from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * LES LIGNES D'UNE PIÈCE ÉMISE, À L'ÉCRAN — une seule saisie pour la révision d'un devis ou d'un BC (§118.194) et
 * pour l'avoir d'une facture (§118.195) : deux éditeurs des mêmes lignes finiraient par envoyer des pourcentages
 * différents, et la fabrique calculerait autre chose que ce que l'écran montre.
 *
 * Les lignes gardent ce que l'écran n'édite pas (détails, remise, TVA, sections) : elles repartent telles qu'elles
 * ont été lues, avec la seule différence de ce qu'on a changé. Les totaux ne se calculent pas ici : c'est la
 * fabrique qui les calcule, et la phrase du résultat les dit (§118.5).
 */

export interface LigneRevisable {
  designation: string;
  details: string[];
  quantite: number;
  prixUnitaire: number;
  remise: number | null;
  tva: number | null;
  section: boolean;
}

export interface LigneEcran { id: number; designation: string; details: string; quantite: string; prix: string; remise: string; tva: string; section: boolean }

let compteur = 1;
export const versEcran = (l: LigneRevisable): LigneEcran => ({
  id: compteur++,
  designation: l.designation,
  details: l.details.join("\n"),
  quantite: l.section ? "" : String(l.quantite),
  prix: l.section ? "" : String(l.prixUnitaire),
  // Remise et TVA voyagent en POURCENTAGE, comme dans le compositeur : le lecteur serveur est le même.
  remise: l.remise != null ? String(Math.round(l.remise * 10000) / 100) : "",
  tva: l.tva != null ? String(Math.round(l.tva * 10000) / 100) : "",
  section: l.section,
});

export const ligneVide = (): LigneEcran => versEcran({ designation: "", details: [], quantite: 1, prixUnitaire: 0, remise: null, tva: null, section: false });

/** Les lignes, en listes parallèles — le format que `lireLignes` (serveur) attend. */
export function ajouterLignes(fd: FormData, lignes: LigneEcran[]): void {
  for (const l of lignes) {
    fd.append("ligneDesignation", l.designation);
    fd.append("ligneDetails", l.details);
    fd.append("ligneQuantite", l.quantite);
    fd.append("lignePrix", l.prix);
    fd.append("ligneRemise", l.remise);
    fd.append("ligneTva", l.tva);
    fd.append("ligneSection", l.section ? "1" : "0");
  }
}

export function LignesEditables({ lignes, onChange }: { lignes: LigneEcran[]; onChange: (lignes: LigneEcran[]) => void }) {
  const maj = (id: number, patch: Partial<LigneEcran>) => onChange(lignes.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">Lignes</p>
        <Button type="button" size="sm" variant="outline" onClick={() => onChange([...lignes, ligneVide()])}>
          <Plus className="h-4 w-4" aria-hidden /> Ajouter une ligne
        </Button>
      </div>
      {lignes.map((l, i) => (
        <div key={l.id} className="grid grid-cols-[1fr_1fr_auto] gap-2 rounded-lg border border-border p-2 sm:grid-cols-[1fr_6rem_8rem_auto]">
          <Input aria-label={`Désignation de la ligne ${i + 1}`} value={l.designation} onChange={(e) => maj(l.id, { designation: e.target.value })} placeholder={l.section ? "Titre de section" : "Désignation"} className="col-span-3 sm:col-span-1" />
          {l.section ? <span className="col-span-2 self-center text-xs text-muted-foreground">Titre de section — sans quantité ni prix.</span> : (
            <>
              <Input aria-label={`Quantité de la ligne ${i + 1}`} inputMode="decimal" value={l.quantite} onChange={(e) => maj(l.id, { quantite: e.target.value })} placeholder="Qté" />
              <Input aria-label={`Prix unitaire HT de la ligne ${i + 1}`} inputMode="decimal" value={l.prix} onChange={(e) => maj(l.id, { prix: e.target.value })} placeholder="PU HT" />
            </>
          )}
          <button type="button" className="justify-self-end rounded p-2 text-muted-foreground hover:bg-secondary sm:p-1" aria-label={`Retirer la ligne ${i + 1}`} onClick={() => onChange(lignes.filter((x) => x.id !== l.id))}>
            <Trash2 className="h-4 w-4" aria-hidden />
          </button>
        </div>
      ))}
    </div>
  );
}
