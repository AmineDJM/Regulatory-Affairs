/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE CONTRAT D'ADAPTATEUR (§45) — ce que tout format doit savoir faire, et rien de plus.
 *
 * Quatre formats, un seul contrat : le runtime ne sait pas s'il pilote du Word ou du PDF. C'est
 * ce qui empêche la dérive vers un `if (format === "DOCX")` semé dans quinze fichiers, et c'est
 * ce qui rend un cinquième format additif plutôt que chirurgical.
 *
 * ── CE QUE LE CONTRAT NE CONTIENT PAS, DÉLIBÉRÉMENT ─────────────────────────────────────
 *
 * Pas de `save()`. Un adaptateur produit des OCTETS (`serialiser`) ; où ces octets vont — quelle
 * version, quel Drive, quels droits — n'est pas son affaire et ne doit surtout pas l'être : un
 * adaptateur qui saurait écrire dans le Drive serait un adaptateur capable de contourner les
 * autorisations. La sauvegarde vit dans `versions/save.ts`, derrière un port.
 *
 * Pas de `render()` non plus : le rendu dépend de l'écran, pas du format de fichier. Un
 * adaptateur rend un MODÈLE ; `render/` en fait des pages.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import type { ArtifactFormat, ArtifactModel } from "@/lib/artifact/object-model/model";
import type { CommandeArtefact } from "@/lib/artifact/commands/ir";

/** Ce qu'une commande a produit — dit à la personne ce qui a bougé, en une phrase. */
export interface EffetCommande {
  ok: boolean;
  /** « Titre centré. », « Pages 12, 14 et 18 supprimées. » */
  resume: string;
  /** Renseigné si `ok` est faux : pourquoi, en clair, sans jargon. */
  motif: string | null;
  /** Identifiants des objets touchés — le workspace s'en sert pour les mettre en évidence. */
  touches: string[];
  /** Candidats à départager quand la cible était ambiguë (§32). */
  candidats: { id: string; libelle: string }[];
}

export const effetOk = (resume: string, touches: string[] = []): EffetCommande =>
  ({ ok: true, resume, motif: null, touches, candidats: [] });

export const effetEchec = (motif: string, candidats: { id: string; libelle: string }[] = []): EffetCommande =>
  ({ ok: false, resume: "", motif, touches: [], candidats });

/** Ce que `valider` rend — un document qu'on ne peut pas rouvrir n'est pas sauvegardable. */
export interface Validation {
  ok: boolean;
  problemes: string[];
}

/**
 * UN DOCUMENT OUVERT. L'état vit ici, pas dans le runtime : c'est l'adaptateur qui sait ce qu'il
 * doit garder en mémoire entre deux commandes (un arbre XML, un classeur ExcelJS, un PDF mupdf).
 */
export interface DocumentOuvert {
  format: ArtifactFormat;
  /** Le modèle courant, recalculé après chaque commande appliquée. */
  modele(): ArtifactModel;
  /** Applique UNE commande. L'adaptateur ne connaît ni les sessions, ni l'annulation. */
  appliquer(c: CommandeArtefact): EffetCommande;
  /** Rend les octets du document dans son format d'origine. */
  serialiser(): Promise<Buffer>;
  /** Rouvre les octets produits pour vérifier qu'ils sont lisibles (§48, sauvegarde atomique). */
  valider(): Promise<Validation>;
}

export interface AdaptateurArtefact {
  format: ArtifactFormat;
  /** Types MIME reconnus — sert à router un fichier du Drive vers le bon adaptateur. */
  mimes: readonly string[];
  extensions: readonly string[];
  ouvrir(octets: Buffer): Promise<DocumentOuvert>;
}
