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
import type { Cible, CommandeArtefact } from "@/lib/artifact/commands/ir";

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
 * DES OCTETS QU'UNE COMMANDE VA POSER DANS LE DOCUMENT — une image, aujourd'hui.
 *
 * La commande ne porte qu'une RÉFÉRENCE (§104.3 : l'état est un rejeu, et un journal qui
 * contiendrait des mégaoctets d'image serait rejoué à chaque ouverture). C'est le moteur qui
 * résout la référence en octets, à travers le port — donc sous les droits de la personne — et
 * qui les dépose ici juste avant d'appliquer. L'adaptateur ne sait toujours pas ce qu'est un
 * Drive, et c'est la propriété qui l'empêche d'écrire sans passer par les autorisations.
 */
export interface RessourceBinaire {
  octets: Buffer;
  /** Le nom d'origine — sert à nommer la partie du zip lisiblement, jamais à deviner le type. */
  nom: string;
}

/**
 * DES OCTETS D'IMAGE SORTIS DU DOCUMENT — pour la LIRE, jamais pour la modifier.
 *
 * Un contrat scanné, un tampon, un graphique collé dans un deck, une photo d'étiquette : le
 * document PORTE l'information et le texte du fichier n'en dit rien. L'adaptateur sait où sont
 * les octets ; il ne sait pas les lire — c'est le port de vision qui le fait, et lui seul
 * (§104.9 : `artifact/` ne connaît ni modèle, ni OCR, ni réseau).
 */
export interface ImageExtraite {
  octets: Buffer;
  /** Le nom de la partie ou du fichier — sert à deviner le type, jamais à l'affirmer. */
  nom: string;
  /** Le texte alternatif que l'auteur a mis, quand il y en a un : une lecture DÉJÀ humaine. */
  description: string | null;
  /** Où elle se trouve, en clair : « page 2 », « diapositive 3 », « feuille Ventes, B2 ». */
  ou: string;
}

/**
 * CE QUI DÉSIGNE l'image à lire. Les MÊMES champs que ceux d'une commande — et c'est voulu :
 * « la 2ᵉ image » doit atteindre le même objet qu'on lise ou qu'on remplace. Mais LIRE n'est
 * pas une opération : lui faire porter un `op` obligerait à en inventer un, et ce mensonge
 * finirait par être exécuté quelque part.
 */
export interface DesignationImage {
  cible: Cible | null;
  feuille: string | null;
  diapo: number | null;
  pages: number[] | null;
}

export type ExtractionImage =
  | { ok: true; image: ImageExtraite }
  | { ok: false; motif: string; candidats: { id: string; libelle: string }[] };

export const extractionEchec = (motif: string, candidats: { id: string; libelle: string }[] = []): ExtractionImage =>
  ({ ok: false, motif, candidats });

/**
 * UN DOCUMENT OUVERT. L'état vit ici, pas dans le runtime : c'est l'adaptateur qui sait ce qu'il
 * doit garder en mémoire entre deux commandes (un arbre XML, un classeur ExcelJS, un PDF mupdf).
 */
export interface DocumentOuvert {
  /**
   * REÇOIT les octets dont le prochain lot de commandes a besoin, indexés par référence.
   *
   * Facultatif : un adaptateur qui ne pose jamais de binaire (le PDF) ne l'implémente pas, et
   * le moteur n'a pas à savoir lesquels le font. Une référence absente de la table fait échouer
   * la commande AVEC SON MOTIF — jamais une insertion d'octets vides, qui produirait un
   * document que le lecteur annonce endommagé.
   */
  fournirRessources?(res: ReadonlyMap<string, RessourceBinaire>): void;
  format: ArtifactFormat;
  /** Le modèle courant, recalculé après chaque commande appliquée. */
  modele(): ArtifactModel;
  /** Applique UNE commande. L'adaptateur ne connaît ni les sessions, ni l'annulation. */
  appliquer(c: CommandeArtefact): EffetCommande;
  /**
   * SORT les octets d'une image du document, désignée comme n'importe quel objet (§104.7 :
   * une cible ambiguë rend des candidats, jamais « la première des quatre »).
   *
   * Facultatif, et ce n'est pas une commodité : un format qui n'a pas d'images incorporées
   * n'en implémente pas, et le moteur DIT alors précisément ce qui manque plutôt que de laisser
   * croire que la lecture a eu lieu (§34 : une limitation se nomme, jamais « pas codé »).
   */
  extraireImage?(d: DesignationImage): Promise<ExtractionImage>;
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
