import { REG_STEPS } from "@/lib/regulatory-workflow";

/**
 * LA CTD INITIALE D'UN DOSSIER REGULATORY — les règles, pures (aucune base, aucun import lourd).
 *
 * « Lors de la création d'un dossier, on doit pouvoir mettre un dossier ZIP complet (ou un dossier
 * entier) : il est mis dans la première étape du process, bien visible, et NOMMÉ « CTD initiale ».
 * Elle pourra être supprimée, remplacée, ou recevoir des fichiers et des dossiers dans un endroit
 * particulier. »
 *
 * ── CE QUI FAIT QU'UN DOCUMENT EST LA CTD INITIALE (§118.213) ───────────────────────────────
 *
 * Un FAIT, pas une ressemblance de nom : une pièce du dossier (`REGULATORY_PRODUCT`), rattachée à
 * la PREMIÈRE étape du processus officiel (lue dans `REG_STEPS`, jamais recopiée), de catégorie
 * « CTD complet ». Aucune colonne de plus : les dossiers d'avant — dont le CTD avait déjà été posé
 * sur l'étape 1 — SONT déjà une CTD initiale, sans migration.
 *
 * La CTD est un ENSEMBLE de documents (un .zip entier, ou un dossier de trois cents fichiers avec son
 * arborescence), pas un fichier : « une seule CTD initiale vivante » veut dire un seul ensemble.
 * Le remplacer met l'ensemble précédent à la corbeille, d'un bloc, avant que le nouveau ne monte.
 *
 * ── UN DÉPÔT QUI VISE LA CTD DOIT LE DIRE ───────────────────────────────────────────────────
 *
 * Le téléverseur générique pose aussi des documents « CTD complet » : sans marque, rien ne dit si
 * la personne voulait AJOUTER à la CTD, la REMPLACER ou simplement ranger une pièce. Un dépôt qui
 * vise exactement la cible de la CTD sans porter la marque est donc refusé, avec le geste qui existe
 * (`refusDepotCtd`) ; et la marque posée sur une autre cible est refusée aussi — elle ne doit pas
 * servir à faire passer une pièce ailleurs pour la CTD.
 */

/** Le libellé d'AFFICHAGE — la reconnaissance, elle, se fait sur le fait ci-dessous. */
export const CTD_INITIALE_LIBELLE = "CTD initiale";

/** L'étape 1 du processus officiel : la LIRE, jamais la recopier. */
export const CTD_INITIALE_ETAPE: string = REG_STEPS[0].key;
export const CTD_INITIALE_CATEGORIE = "CTD_FULL";
export const CTD_INITIALE_ENTITE = "REGULATORY_PRODUCT";

/** Le type d'une entrée de corbeille de CTD (la corbeille range par chaîne). */
export const KIND_CORBEILLE_CTD = "REGULATORY_CTD";

/** Pourquoi la CTD est partie à la corbeille — écrit sur l'entrée, lu par la phrase. */
export type MotifRetraitCtd = "SUPPRIMEE" | "REMPLACEE";

/**
 * LE FAIT : cette pièce est-elle (une partie de) la CTD initiale ? Les trois conditions sont
 * nécessaires — une pièce « CTD complet » posée hors de l'étape 1 est autre chose, et une pièce
 * de l'étape 1 d'une autre catégorie (un module, un justificatif) n'est pas la CTD.
 */
export function estCtdInitiale(d: { entityType: string; stepKey: string | null; category: string }): boolean {
  return d.entityType === CTD_INITIALE_ENTITE && d.stepKey === CTD_INITIALE_ETAPE && d.category === CTD_INITIALE_CATEGORIE;
}

/**
 * LE REFUS D'UN DÉPÔT, ou `null`. `marque` = la personne a déposé DEPUIS le bloc de la CTD.
 *   • cible CTD sans marque → refus qui nomme le geste ;
 *   • marque sur une autre cible → refus qui nomme la cible attendue.
 */
export function refusDepotCtd(cible: { entityType: string; stepKey: string | null; category: string }, marque: boolean): string | null {
  const vise = estCtdInitiale(cible);
  if (vise && !marque) {
    return `La ${CTD_INITIALE_LIBELLE} se dépose depuis son bloc, sur l'étape 1 du dossier (« Réception du CTD complet ») : « Ajouter à la CTD » pour y poser des fichiers, « Remplacer la CTD » pour en envoyer une nouvelle. Pour ranger une autre pièce, choisissez une autre catégorie que « CTD complet ».`;
  }
  if (marque && !vise) {
    return `Un dépôt marqué « ${CTD_INITIALE_LIBELLE} » doit viser l'étape 1 d'un dossier réglementaire, en catégorie « CTD complet ».`;
  }
  return null;
}

/**
 * CHEMIN DE DOSSIER SÛR : jamais de « .. », jamais de chemin absolu, séparateur « / », borné à
 * 500 caractères. `null` quand il ne reste rien. UNE seule écriture — `documents.ts` la réexporte
 * sous son ancien nom, pour que le navigateur (qui choisit la destination) et le serveur (qui la
 * range) ne puissent pas diverger sur ce qu'est un chemin acceptable.
 */
export function cheminSur(brut: string | null | undefined): string | null {
  if (!brut) return null;
  const propre = brut.replace(/\\/g, "/").split("/").map((x) => x.trim()).filter((x) => x && x !== "." && x !== "..").join("/");
  return propre ? propre.slice(0, 500) : null;
}

/** Le dossier où un fichier ira : le dossier choisi, puis le dossier d'origine du fichier déposé. */
export function dossierDeDestination(base: string | null | undefined, origine: string | null | undefined): string | null {
  const b = cheminSur(base);
  const o = cheminSur(origine);
  return cheminSur([b, o].filter(Boolean).join("/"));
}

export interface DocCtd {
  name: string;
  folder?: string | null;
  sizeBytes: number | null;
}

/** Un nœud de l'arborescence de la CTD : ses sous-dossiers, ses fichiers, ce qu'ils pèsent. */
export interface NoeudCtd<T extends DocCtd = DocCtd> {
  nom: string;
  chemin: string;
  dossiers: NoeudCtd<T>[];
  fichiers: T[];
  /** Tous les fichiers sous ce nœud, sous-dossiers compris. */
  nbFichiers: number;
  octets: number;
}

/**
 * L'ARBORESCENCE de la CTD, lue sur `folder` : « CTD/Module 1 » + « a.pdf » → CTD › Module 1 › a.pdf.
 * Les dossiers se trient par nom, les fichiers aussi ; la racine porte les fichiers sans dossier.
 */
export function arborescenceCtd<T extends DocCtd>(docs: readonly T[]): NoeudCtd<T> {
  const racine: NoeudCtd<T> = { nom: "", chemin: "", dossiers: [], fichiers: [], nbFichiers: 0, octets: 0 };
  const index = new Map<string, NoeudCtd<T>>([["", racine]]);
  const noeud = (chemin: string): NoeudCtd<T> => {
    const connu = index.get(chemin);
    if (connu) return connu;
    const i = chemin.lastIndexOf("/");
    const parent = noeud(i < 0 ? "" : chemin.slice(0, i));
    const n: NoeudCtd<T> = { nom: i < 0 ? chemin : chemin.slice(i + 1), chemin, dossiers: [], fichiers: [], nbFichiers: 0, octets: 0 };
    parent.dossiers.push(n);
    index.set(chemin, n);
    return n;
  };
  for (const d of docs) {
    const dossier = cheminSur(d.folder) ?? "";
    const n = noeud(dossier);
    n.fichiers.push(d);
    // Le compte et le poids remontent à TOUS les ancêtres : « Module 1 (12 fichiers) » se lit sans déplier.
    let c = dossier;
    for (;;) {
      const a = index.get(c)!;
      a.nbFichiers += 1;
      a.octets += d.sizeBytes ?? 0;
      if (c === "") break;
      const i = c.lastIndexOf("/");
      c = i < 0 ? "" : c.slice(0, i);
    }
  }
  const trier = (n: NoeudCtd<T>) => {
    n.dossiers.sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
    n.fichiers.sort((a, b) => a.name.localeCompare(b.name, "fr"));
    n.dossiers.forEach(trier);
  };
  trier(racine);
  return racine;
}

/** Tous les dossiers de la CTD, préfixes compris (« A/B » donne « A » et « A/B »), triés — la liste des destinations. */
export function dossiersDeLaCtd(docs: readonly { folder?: string | null }[]): string[] {
  const tous = new Set<string>();
  for (const d of docs) {
    const dossier = cheminSur(d.folder);
    if (!dossier) continue;
    const segs = dossier.split("/");
    for (let i = 1; i <= segs.length; i++) tous.add(segs.slice(0, i).join("/"));
  }
  return [...tous].sort((a, b) => a.localeCompare(b, "fr"));
}

/** Ce que la CTD contient, en une ligne de chiffres. */
export function resumeCtd(docs: readonly DocCtd[]): { fichiers: number; dossiers: number; octets: number; archives: number } {
  return {
    fichiers: docs.length,
    dossiers: dossiersDeLaCtd(docs).length,
    octets: docs.reduce((s, d) => s + (d.sizeBytes ?? 0), 0),
    archives: docs.filter((d) => /\.zip$/i.test(d.name)).length,
  };
}

/**
 * RENOMMER UN DOSSIER de la CTD : le nouveau nom d'UN segment (« Module 1 » → « Module 1 corrigé »),
 * le dossier gardant son parent. Refus qui nomme la cause : un nom vide, un séparateur dans le nom,
 * un dossier qui existe déjà à cet endroit (deux dossiers fondus en un perdraient leur distinction).
 */
export function refusRenommageDossier(ancien: string, nouveauNom: string, existants: readonly string[]): string | null {
  const a = cheminSur(ancien);
  if (!a) return "Dossier à renommer introuvable.";
  const nom = nouveauNom.trim();
  if (!nom || nom === "." || nom === "..") return "Le nouveau nom du dossier ne peut pas être vide.";
  if (/[\\/]/.test(nom)) return "Le nouveau nom ne peut pas contenir de « / » : il renomme UN dossier, il ne le déplace pas.";
  const cible = cheminRenomme(a, nom);
  if (cible === a) return null;
  if (existants.some((e) => e === cible)) return `Un dossier « ${cible} » existe déjà dans la CTD.`;
  return null;
}

/** Le chemin d'un dossier une fois son DERNIER segment renommé. */
export function cheminRenomme(ancien: string, nouveauNom: string): string {
  const i = ancien.lastIndexOf("/");
  return cheminSur(i < 0 ? nouveauNom : `${ancien.slice(0, i)}/${nouveauNom}`) ?? ancien;
}

/**
 * Le dossier d'un document après le renommage de `ancien` en `nouveau` : le dossier lui-même ou l'un
 * de ses descendants suit ; tout autre reste identique. `null` ne bouge jamais.
 */
export function dossierApresRenommage(folder: string | null, ancien: string, nouveau: string): string | null {
  const f = cheminSur(folder);
  if (!f) return f;
  if (f === ancien) return nouveau;
  if (f.startsWith(`${ancien}/`)) return `${nouveau}${f.slice(ancien.length)}`;
  return f;
}
