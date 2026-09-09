/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LES COLONNES DU TABLEAU REGULATORY — un seul catalogue, lu par l'écran ET par Adam.
 *
 * « Dans Regulatory, supprime la colonne "classe thérapeutique", garde que "segment
 * thérapeutique" » : pour qu'Adam puisse obéir, il lui faut résoudre un libellé français vers
 * une clé de colonne. Ce catalogue est donc l'endroit où le NOM et la CLÉ se rencontrent — une
 * seule fois. Écrire la table des libellés à côté de l'aiguillage de rendu ferait deux listes
 * qui divergeraient à la première colonne ajoutée : le tableau montrerait « Projet » et Adam
 * répondrait « colonne inconnue » (§118.5).
 *
 * Module PUR — ZÉRO import. Il est lu par un composant `"use client"` (le tableau) ET par
 * `assistant/admin-write.ts` (côté serveur) : le moindre import lourd ferait entrer `fs` dans
 * le bundle du navigateur, l'erreur que ce dépôt a déjà payée deux fois.
 *
 * ── POURQUOI UN RÉGLAGE DE PLATEFORME, ET PAS UNE PRÉFÉRENCE DE NAVIGATEUR ────────────────
 *
 * Le tableau a DÉJÀ un réglage de colonnes, local au navigateur (`amd-reg-hidden-cols`) : il
 * répond à « je ne veux pas voir ça sur MON écran ». La demande ici est autre — « cette colonne
 * n'a pas lieu d'être dans cette maison » — et elle vaut pour tout le monde, sur les DEUX
 * sous-modules (Suivi de dossiers et Pipeline), et elle doit survivre au vidage du cache. C'est
 * donc un réglage de la plateforme, au même titre que les segments thérapeutiques.
 *
 * Les deux se CUMULENT et ne se contredisent pas : le réglage retire la colonne du tableau,
 * la préférence locale n'agit que sur ce qui reste.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

export interface ColonneRegulatory {
  key: string;
  /** L'en-tête tel qu'il s'affiche — et tel qu'une personne le nommera à Adam. */
  header: string;
  /**
   * Une colonne INAMOVIBLE ne se masque jamais.
   *
   * Même raison que la console d'administration parmi les modules masquables : la référence
   * IDENTIFIE la ligne. Sans elle on ne sait plus de quel dossier on parle, et l'on ne peut pas
   * revenir en arrière depuis le tableau lui-même. Une garde qu'on ne peut pas défaire de
   * l'intérieur n'est pas une garde, c'est une porte fermée à clé de l'extérieur.
   */
  inamovible?: true;
  /** Autre façon dont on la nomme à l'oral — l'écran affiche `header`, la personne dit ça. */
  alias?: readonly string[];
}

/**
 * L'ORDRE EST CELUI DU TABLEAU. Le composant construit ses colonnes EN PARCOURANT cette liste :
 * ajouter une colonne ici et oublier son rendu fait échouer le typecheck, pas l'écran.
 */
export const COLONNES_REGULATORY = [
  { key: "reference", header: "Référence", inamovible: true },
  { key: "dci", header: "DCI / Marque", alias: ["dci", "marque", "nom commercial"] },
  { key: "dosage", header: "Dosage / Forme", alias: ["dosage", "forme", "forme galénique"] },
  { key: "packaging", header: "Conditionnement" },
  { key: "therapeuticClass", header: "Classe thérapeutique", alias: ["classe"] },
  { key: "company", header: "Entité", alias: ["société", "societe"] },
  // LE PROJET BD — le classement demandé par la direction : chaque dossier peut appartenir à un
  // projet stratégique nommé dans Business Development. Voisin de l'entité, parce que les deux
  // répondent à la même question : à quel ensemble ce dossier appartient-il ?
  { key: "project", header: "Projet", alias: ["projet bd", "projet stratégique", "projet strategique"] },
  { key: "segments", header: "Segments thérapeutiques", alias: ["segment thérapeutique", "segment therapeutique", "segments"] },
  { key: "category", header: "Catégorie" },
  { key: "supplier", header: "Fournisseur" },
  { key: "manufacturingStatus", header: "Statut", alias: ["niveau industriel"] },
  { key: "priority", header: "Priorité" },
  { key: "status", header: "Niveau de process", alias: ["statut réglementaire", "statut reglementaire", "avancement"] },
  { key: "responsible", header: "Chargé du dossier", alias: ["responsable", "charge du dossier"] },
  { key: "dossierReceived", header: "Dossier reçu", alias: ["dossier recu"] },
  { key: "targetSubmissionDate", header: "Date cible dépôt", alias: ["date cible depot", "cible dépôt"] },
  { key: "targetDate", header: "Date cible enreg.", alias: ["date cible enregistrement", "cible enreg"] },
  // `as const satisfies` et non une annotation de type : l'annotation EFFACERAIT les littéraux,
  // et `CleColonneRegulatory` retomberait sur `string` — le `Record` du tableau cesserait alors
  // d'être exhaustif, ce qui est précisément la garantie qu'on vient chercher ici.
] as const satisfies readonly ColonneRegulatory[];

/** Le type des clés, dérivé de la liste : un `Record` dessus est EXHAUSTIF par le typecheck. */
export type CleColonneRegulatory = (typeof COLONNES_REGULATORY)[number]["key"];

/**
 * LA MÊME LISTE, VUE ÉLARGIE. `as const` fige chaque entrée dans son type exact — utile pour
 * l'union des clés, inutilisable pour lire `inamovible` sur une entrée qui ne la porte pas.
 * Même tableau, pas une copie : il n'y a rien qui puisse diverger.
 */
const CATALOGUE: readonly ColonneRegulatory[] = COLONNES_REGULATORY;

/** Ce qui ne se masque jamais. */
export const COLONNES_INAMOVIBLES: readonly string[] =
  CATALOGUE.filter((c) => c.inamovible).map((c) => c.key);

const sansAccent = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

/**
 * DU LIBELLÉ À LA CLÉ — et `null` sur ce qu'on ne reconnaît pas à coup sûr.
 *
 * On accepte la clé écrite telle quelle, l'en-tête, et les alias déclarés. On ne fait AUCUNE
 * correspondance approximative : « statut » désigne la colonne du niveau industriel, « statut
 * réglementaire » celle du niveau de process — les rapprocher par ressemblance masquerait un
 * jour la mauvaise, en annonçant que c'est fait (§104.7).
 */
export function resoudreColonne(libelle: string): string | null {
  const q = sansAccent(libelle);
  if (!q) return null;
  for (const c of CATALOGUE) {
    if (sansAccent(c.key) === q || sansAccent(c.header) === q) return c.key;
    for (const a of c.alias ?? []) if (sansAccent(a) === q) return c.key;
  }
  return null;
}

/**
 * CLÉ → EN-TÊTE, pour les cartes de confirmation d'Adam.
 *
 * `renderSettingValue` prend une table de libellés : sans elle, la carte annoncerait
 * « therapeuticClass → (aucun) » à quelqu'un qui vient de dire « supprime la classe
 * thérapeutique ». Un code brut dans la phrase qu'on confirme, c'est une confirmation qu'on
 * donne sans avoir lu.
 */
export const LIBELLES_COLONNES: Record<string, string> =
  Object.fromEntries(CATALOGUE.map((c) => [c.key, c.header]));

/** L'en-tête d'une clé — pour l'écrire dans une carte de confirmation, jamais un code brut. */
export function enTeteColonne(key: string): string {
  return CATALOGUE.find((c) => c.key === key)?.header ?? key;
}

export type LectureColonnes =
  | { ok: true; cles: string[] }
  | { ok: false; error: string };

/**
 * LIT UNE LISTE DE COLONNES ÉCRITE EN CLAIR, et refuse ce qu'elle ne comprend pas.
 *
 * Une liste VIDE est légitime : « remets toutes les colonnes ». Un libellé inconnu, lui, ne
 * s'ignore JAMAIS en silence — Adam annoncerait « c'est fait » sur une colonne qui n'a pas
 * bougé, et c'est le faux succès que ce dépôt chasse partout.
 */
export function lireColonnesMasquees(texte: string): LectureColonnes {
  const morceaux = texte.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean);
  const cles: string[] = [];
  const inconnues: string[] = [];
  const refusees: string[] = [];
  for (const m of morceaux) {
    const k = resoudreColonne(m);
    if (!k) { inconnues.push(m); continue; }
    if (COLONNES_INAMOVIBLES.includes(k)) { refusees.push(m); continue; }
    cles.push(k);
  }
  if (inconnues.length > 0) {
    return {
      ok: false,
      error: `Colonne(s) inconnue(s) : ${inconnues.join(", ")}. Colonnes du tableau Regulatory : ${CATALOGUE.map((c) => c.header).join(", ")}.`,
    };
  }
  if (refusees.length > 0) {
    return {
      ok: false,
      error: `Impossible de masquer : ${refusees.join(", ")}. La référence identifie la ligne — sans elle, on ne sait plus de quel dossier on parle et l'on ne peut pas revenir en arrière depuis le tableau.`,
    };
  }
  return { ok: true, cles: [...new Set(cles)] };
}

/** Les colonnes RÉELLEMENT affichées, réglage de plateforme appliqué. */
export const colonnesVisibles = (masquees: readonly string[]): readonly ColonneRegulatory[] =>
  CATALOGUE.filter((c) => c.inamovible || !masquees.includes(c.key));
