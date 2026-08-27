import { AGREGATS, CALCULS, FORMATS_ARTEFACT, TYPES_COLONNE, TYPES_GRAPHIQUE } from "@/lib/missions/artifacts/spec";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * CE QU'UN MODÈLE A LE DROIT DE DIRE D'UN LIVRABLE — un schéma strict, comme pour le plan.
 *
 * ── LA CONTRAINTE QUI A DICTÉ LA FORME DES LIGNES ───────────────────────────────────────
 *
 * Le mode strict interdit les objets libres. Une ligne de tableau est pourtant, naturellement,
 * un objet libre : `{ produit: "A", valeur: 120 }`. On la déclare donc comme une LISTE DE
 * VALEURS alignée sur les colonnes — `values: ["A", "120"]` — et c'est le code qui la rattache
 * aux clés et qui convertit selon le TYPE DÉCLARÉ de la colonne.
 *
 * Ce détour a un bénéfice qu'on n'avait pas cherché : le type d'une cellule ne dépend plus de
 * ce que le modèle a écrit ce jour-là. Une colonne `money` produit un nombre, toujours, même si
 * le modèle a écrit « 120 000 DZD ». C'est le code qui décide du type, comme il décide des
 * formules.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const objet = (properties: Record<string, unknown>, description?: string) => ({
  type: "object",
  ...(description ? { description } : {}),
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});

const s = (description: string) => ({ type: "string", description });
const ns = (description: string) => ({ type: ["string", "null"], description });
const enumOf = (v: readonly string[], description: string) => ({ type: "string", enum: [...v], description });

const COLONNE = objet({
  header: s("L'intitulé affiché de la colonne."),
  key: s("Un identifiant court et stable, sans espace (« valeur_2026 »)."),
  type: enumOf(TYPES_COLONNE, "text pour du texte ; number, money (DZD) ou percent pour un nombre ; date pour une date."),
});

const LIGNE = objet(
  {
    values: {
      type: "array",
      items: { type: "string" },
      description:
        "Les valeurs de la ligne, DANS L'ORDRE DES COLONNES et en même nombre. "
        + "Écris les nombres sans séparateur de milliers (« 4200000 »). Une case vide vaut \"\".",
    },
  },
  "Une ligne du tableau.",
);

const CALCULEE = objet({
  header: s("L'intitulé de la colonne calculée."),
  key: s("Son identifiant court."),
  calcul: enumOf(CALCULS, "GROWTH = (fin-début)/début sur 2 colonnes ; SHARE = part du total sur 1 colonne ; RATIO = a/b sur 2 colonnes."),
  args: {
    type: "array",
    items: { type: "string" },
    description: "Les `key` des colonnes utilisées, dans l'ordre attendu. Elles doivent EXISTER dans `columns`.",
  },
});

const TOTAL = objet({
  column: s("La `key` de la colonne à totaliser."),
  agregat: enumOf(AGREGATS, "SUM, AVG, COUNT, MIN ou MAX."),
});

const FEUILLE = objet({
  name: s("Le nom de la feuille (31 caractères maximum, sans : \\ / ? * [ ])."),
  columns: { type: "array", items: COLONNE, description: "Les colonnes, dans l'ordre." },
  rows: { type: "array", items: LIGNE, description: "Les lignes. Toutes les valeurs viennent des données fournies." },
  computed: { type: "array", items: CALCULEE, description: "Les colonnes calculées. Liste vide si aucune." },
  totals: { type: "array", items: TOTAL, description: "Les totaux en bas de tableau. Liste vide si aucun." },
  note: ns("Une note de provenance sous le tableau. null si inutile."),
});

const GRAPHIQUE = objet({
  sheet: s("Le nom de la feuille où poser le graphique et d'où viennent les données."),
  kind: enumOf(TYPES_GRAPHIQUE, "bar pour comparer, line pour une évolution, pie pour une répartition."),
  title: s("Le titre du graphique."),
  categories: s("La `key` de la colonne qui donne les libellés de l'axe."),
  series: { type: "array", items: { type: "string" }, description: "Les `key` des colonnes tracées." },
});

const SECTION = objet({
  heading: s("Le titre de la section."),
  paragraphs: { type: "array", items: { type: "string" }, description: "Les paragraphes." },
  bullets: { type: "array", items: { type: "string" }, description: "Les puces." },
});

export const SCHEMA_ARTEFACT: Record<string, unknown> = objet({
  key: s("Identifiant court du livrable."),
  title: s("Le titre du livrable, en français."),
  fileName: ns("Le nom de fichier souhaité, sans extension. null pour le déduire du titre."),
  format: enumOf(FORMATS_ARTEFACT, "Le format du fichier."),
  summary: {
    type: "array",
    items: SECTION,
    description: "La synthèse. La PREMIÈRE section donne la réponse, pas la méthode. Liste vide si le livrable est purement tabulaire.",
  },
  sheets: { type: "array", items: FEUILLE, description: "Les tableaux. Liste vide pour un document sans données." },
  charts: { type: "array", items: GRAPHIQUE, description: "Les graphiques. Liste vide si aucun n'a de sens." },
  sources: { type: "array", items: { type: "string" }, description: "D'où viennent les chiffres. Au moins une entrée dès qu'il y a des chiffres." },
});
