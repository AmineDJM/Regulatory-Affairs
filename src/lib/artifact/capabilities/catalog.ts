/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LES CAPACITÉS LIVE OFFICE (§56) — la liste, et le schéma STRICT que le modèle doit remplir.
 *
 * ── POURQUOI LE SCHÉMA EST ICI ET PAS DANS `assistant/` ─────────────────────────────────
 *
 * Parce que le schéma décrit le domaine, pas l'assistant. Un webhook, un cron ou une route HTTP
 * doivent pouvoir piloter un document sans passer par une conversation, avec exactement la même
 * validation. C'est aussi ce qui fait que `boundary.test.ts` reste satisfait : Adam consomme,
 * il ne définit pas.
 *
 * ── SORTIES STRUCTURÉES STRICTES ────────────────────────────────────────────────────────
 *
 * `strict: true` impose `additionalProperties: false` et un `required` qui liste TOUTES les
 * propriétés. Un champ facultatif s'écrit donc `["string", "null"]` — jamais en le retirant de
 * `required`. C'est laborieux et c'est le prix d'un modèle qui ne peut pas inventer un champ.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import { OPS } from "@/lib/artifact/commands/ir";

/**
 * LA LISTE EST UN ENGAGEMENT, PAS UN CATALOGUE D'INTENTIONS.
 *
 * `capabilities.test.ts` exige de CHAQUE entrée un point d'entrée nommé, réellement exporté.
 * Une capacité qu'on ne peut pas déclencher n'a donc pas le droit de figurer ici — c'est la
 * seule façon d'empêcher la liste de devenir une promesse que le code ne tient pas.
 *
 * ── CE QUI N'Y EST PAS, ET POURQUOI ─────────────────────────────────────────────────────
 *
 * `artifact.export` y a figuré, et en a été RETIRÉ. Il annonçait « exporter en PDF » : pour
 * un Word, un Excel ou un PowerPoint, cela suppose un moteur de rendu bureautique
 * (LibreOffice), absent de l'image de déploiement — et impossible à y ajouter, le service
 * tournant en `runtime: node` sans couche système. Ce qui existe vraiment — la rastérisation
 * d'une page PDF — est le rendu interne du workspace, pas un export : rien ne se télécharge.
 * Mieux vaut une liste plus courte et vraie qu'une entrée qui échoue à l'usage.
 */
export const CAPACITES_ARTEFACT = [
  "artifact.open",
  "artifact.inspect",
  "artifact.edit",
  "artifact.undo",
  "artifact.redo",
  "artifact.save",
  "artifact.save_as",
  "artifact.compare",
  "artifact.close",
  // L'Excel God Mode : des LECTURES en flux, sans la borne du Live Office (voir `sheets/analyse.ts`).
  "artifact.sheet_audit",
  "artifact.sheet_trace",
  "artifact.sheet_diff",
  "artifact.sheet_read",
  "artifact.sheet_build",
  // Les documents longs : lire un PDF de 500 pages (natif + OCR ciblé), construire un deck vérifié,
  // contrôler avant livraison, inspecter une tranche d'un long document.
  "artifact.pdf_read",
  "artifact.pdf_search",
  "artifact.deck_build",
  "artifact.qa",
] as const;

export type CapaciteArtefact = (typeof CAPACITES_ARTEFACT)[number];

/** Ce qu'une capacité fait, en une phrase — sert au registre d'actions et à l'aide. */
export const LIBELLE_CAPACITE: Record<CapaciteArtefact, string> = {
  "artifact.open": "Ouvrir un document Word, Excel, PowerPoint ou PDF dans le workspace",
  "artifact.inspect": "Lire la structure du document ouvert (paragraphes, pages, feuilles, formes)",
  "artifact.edit": "Modifier le document ouvert par une ou plusieurs commandes",
  "artifact.undo": "Annuler la dernière modification",
  "artifact.redo": "Rétablir la modification annulée",
  "artifact.save": "Enregistrer une nouvelle version dans le Drive",
  "artifact.save_as": "Enregistrer sous un nouveau nom, sans toucher à l'original",
  "artifact.compare": "Comparer deux versions et dire ce qui a changé",
  "artifact.close": "Fermer le document ouvert",
  "artifact.sheet_audit": "Vérifier un classeur Excel : structure, recalcul indépendant, audit des formules (sans limite de taille)",
  "artifact.sheet_trace": "Expliquer une cellule : d'où vient sa valeur, qui en dépend, rayon d'impact",
  "artifact.sheet_diff": "Comparer deux versions d'un classeur : lignes insérées, valeurs, formules modifiées ou écrasées",
  "artifact.sheet_read": "Lire une plage d'un grand classeur en clair",
  "artifact.sheet_build": "Construire un classeur vérifié (formules recalculées, valeurs écrites, audit propre) depuis une spécification",
  "artifact.pdf_read": "Lire le texte natif d'une plage de pages d'un PDF (500+ pages), avec OCR ciblé des pages scannées",
  "artifact.pdf_search": "Chercher une expression dans tout un PDF et rendre les pages avec un extrait",
  "artifact.deck_build": "Construire un deck « une idée par diapositive » (jusqu'à 250), relu et contrôlé avant écriture",
  "artifact.qa": "Contrôler un document avant livraison : bloquants (brouillon, titre absent, erreur) et avertissements",
};

/** La cible d'une commande, en schéma strict. */
const SCHEMA_CIBLE = {
  type: "object",
  additionalProperties: false,
  properties: {
    id: { type: ["string", "null"], description: "Identifiant stable rendu par artifact.inspect (p3, t1, s2.sh1, page7). Le plus sûr." },
    index: { type: ["integer", "null"], description: "Rang HUMAIN, 1 = le premier. « le troisième paragraphe » → 3." },
    contient: { type: ["string", "null"], description: "Un fragment du texte recherché : « rémunération »." },
    role: { type: ["string", "null"], enum: ["titre", "premier", "dernier", null], description: "Rôle : titre, premier, dernier." },
    page: { type: ["integer", "null"], description: "La page où chercher (Word, 1 = la première) : « le 3e paragraphe de la page 12 » → page 12, index 3. Le rang se compte DANS la page." },
  },
  required: ["id", "index", "contient", "role", "page"],
} as const;

const N = ["number", "null"] as const;
const I = ["integer", "null"] as const;
const S = ["string", "null"] as const;
const B = ["boolean", "null"] as const;

/** Le schéma d'UNE commande. Tout est nullable ; `compile.ts` exige ensuite ce qu'il faut. */
export const SCHEMA_COMMANDE = {
  type: "object",
  additionalProperties: false,
  properties: {
    op: { type: "string", enum: [...OPS], description: "L'opération à appliquer." },
    cible: { ...SCHEMA_CIBLE, description: "L'objet visé (paragraphe, tableau, image, forme)." },
    cible2: { ...SCHEMA_CIBLE, description: "Second objet, pour les opérations qui en prennent deux." },
    alignement: { type: S, enum: ["left", "center", "right", "justify", null] },
    gras: { type: B }, italique: { type: B }, souligne: { type: B },
    taillePt: { type: N, description: "Taille de police en POINTS (16 = 16 pt)." },
    police: { type: S, description: "Nom de police tel qu'on le dit : Aptos, Calibri, Times New Roman." },
    couleur: { type: S, description: "Six chiffres hexadécimaux SANS dièse : 1B7F79." },
    xCm: { type: N }, yCm: { type: N },
    dxCm: { type: N, description: "Déplacement horizontal en cm. Négatif = vers la gauche." },
    dyCm: { type: N, description: "Déplacement vertical en cm. Négatif = vers le haut." },
    largeurCm: { type: N }, hauteurCm: { type: N },
    avantPt: { type: N, description: "Espacement AVANT le paragraphe, en points. Le réduire remonte le bloc." },
    apresPt: { type: N },
    gaucheCm: { type: N, description: "Retrait gauche en cm. Le réduire décale le texte vers la gauche." },
    droiteCm: { type: N },
    texte: { type: S }, chercher: { type: S }, remplacer: { type: S },
    formule: { type: S, description: "Formule Excel, avec ou sans le signe égal." },
    formatNombre: { type: S, description: "Format de nombre Excel : « #,##0 \"DZD\" », « 0,00 % »." },
    remplissage: { type: S, description: "Couleur de fond d'une cellule, six chiffres hexadécimaux." },
    feuille: { type: S, description: "Nom de la feuille Excel. Vide = la première." },
    plage: { type: S, description: "Cellule ou plage Excel : B4, ou B4:D20." },
    ligne: { type: I, description: "Numéro de ligne, 1 = la première." },
    colonne: { type: I, description: "Numéro de colonne, 1 = A." },
    pages: { type: ["array", "null"], items: { type: "integer" }, description: "Pages PDF, 1 = la première." },
    ordre: { type: ["array", "null"], items: { type: "integer" }, description: "Nouvel ordre complet des pages." },
    diapo: { type: I, description: "Numéro de diapositive, 1 = la première." },
    versIndex: { type: I, description: "Position d'arrivée d'une diapositive déplacée." },
    position: { type: S, enum: ["avant", "apres", null] },
    direction: { type: S, enum: ["haut", "bas", "asc", "desc", null] },
    pas: { type: I }, degres: { type: I, enum: [90, 180, 270, -90, -180, -270, null] },
    opacite: { type: N }, tout: { type: B },
    nom: { type: S, description: "Nom d'une nouvelle feuille, ou nouveau nom." },
  },
  required: [
    "op", "cible", "cible2", "alignement", "gras", "italique", "souligne", "taillePt", "police",
    "couleur", "xCm", "yCm", "dxCm", "dyCm", "largeurCm", "hauteurCm", "avantPt", "apresPt",
    "gaucheCm", "droiteCm", "texte", "chercher", "remplacer", "formule", "formatNombre",
    "remplissage", "feuille", "plage", "ligne", "colonne", "pages", "ordre", "diapo", "versIndex",
    "position", "direction", "pas", "degres", "opacite", "tout", "nom",
  ],
} as const;

/** Le schéma de l'outil `artifact.edit` — un lot de commandes, plus une phrase pour la personne. */
export const SCHEMA_EDITION = {
  type: "object",
  additionalProperties: false,
  properties: {
    commandes: {
      type: "array",
      items: SCHEMA_COMMANDE,
      description: "Les modifications à appliquer, dans l'ordre. Une phrase peut en produire plusieurs.",
    },
  },
  required: ["commandes"],
} as const;
