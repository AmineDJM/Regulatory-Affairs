/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * CE QU'UN LIVRABLE DÉCLARE (§20-21) — et la frontière exacte entre le modèle et le code.
 *
 * ── LA RÈGLE, ET LA PANNE QU'ELLE ÉVITE ─────────────────────────────────────────────────
 *
 * Le modèle fournit des DONNÉES et une STRUCTURE : des colonnes, des lignes, le fait qu'on veut
 * un total en bas et une croissance à droite. Il ne fournit JAMAIS une formule Excel.
 *
 * La raison est concrète. Une formule écrite par un modèle (« =SOMME(D2:D34) ») est juste
 * jusqu'au jour où le tableau a trente-cinq lignes, ou une colonne insérée, ou un nom de feuille
 * avec un espace. Elle donne alors `#REF!` — dans un classeur qu'on envoie à la direction, sans
 * qu'aucun test ne l'ait vu. Ici, `totals: { volume: "SUM" }` est une INTENTION ; c'est le code
 * qui compte les lignes réelles et écrit `=SUM(D2:D34)` avec le bon D et le bon 34.
 *
 * C'est l'application littérale de « pas de LLM pour remplacer une FK, une règle ou un calcul
 * déterministe ».
 *
 * ── POURQUOI LES GRAPHIQUES SONT DÉCLARÉS PAR RÉFÉRENCE DE COLONNE ──────────────────────
 *
 * Même raisonnement : un graphique déclaré par plage (« B2:B34 ») pointe dans le vide dès que
 * les données changent. Déclaré par nom de colonne, il est recalculé à la fabrication et ne peut
 * pas être périmé.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

export const FORMATS_ARTEFACT = ["XLSX", "DOCX", "PDF", "PPTX", "CSV", "ZIP"] as const;
export type FormatArtefact = (typeof FORMATS_ARTEFACT)[number];

export const TYPES_COLONNE = ["text", "number", "money", "percent", "date"] as const;
export type TypeColonne = (typeof TYPES_COLONNE)[number];

/** Les agrégats que le CODE sait écrire. La liste est fermée : ce qui n'y est pas n'existe pas. */
export const AGREGATS = ["SUM", "AVG", "COUNT", "MIN", "MAX"] as const;
export type Agregat = (typeof AGREGATS)[number];

/** Les colonnes CALCULÉES que le code sait construire, à partir d'autres colonnes. */
export const CALCULS = [
  /** (fin - début) / début, en pourcentage. Deux arguments. */
  "GROWTH",
  /** valeur / total de la colonne, en pourcentage. Un argument. */
  "SHARE",
  /** valeur / quantité. Deux arguments — le prix moyen d'un marché, littéralement. */
  "RATIO",
] as const;
export type Calcul = (typeof CALCULS)[number];

export interface ColonneSpec {
  header: string;
  key: string;
  type: TypeColonne;
  width?: number;
}

export interface ColonneCalculee {
  header: string;
  key: string;
  calcul: Calcul;
  /** Les clés de colonnes utilisées, dans l'ordre attendu par le calcul. */
  args: string[];
}

export interface FeuilleSpec {
  name: string;
  columns: ColonneSpec[];
  rows: Record<string, string | number | null>[];
  /** Les colonnes calculées, ajoutées à droite. Le code écrit la formule. */
  computed?: ColonneCalculee[];
  /** Une ligne de totaux en bas : { cleColonne: agrégat }. */
  totals?: Record<string, Agregat>;
  /** Une note sous le tableau — provenance, périmètre, date d'extraction. */
  note?: string;
}

export const TYPES_GRAPHIQUE = ["bar", "line", "pie"] as const;
export type TypeGraphique = (typeof TYPES_GRAPHIQUE)[number];

export interface GraphiqueSpec {
  /** La feuille où le graphique est posé ET d'où viennent les données. */
  sheet: string;
  kind: TypeGraphique;
  title: string;
  /** La colonne qui donne les libellés de l'axe. */
  categories: string;
  /** Les colonnes tracées. */
  series: string[];
}

export interface SectionTexte {
  heading: string;
  paragraphs: string[];
  bullets: string[];
}

export interface ArtefactSpec {
  key: string;
  title: string;
  format: FormatArtefact;
  fileName?: string;
  /** La synthèse exécutive — première section de tout livrable qui en porte une. */
  summary?: SectionTexte[];
  sheets?: FeuilleSpec[];
  charts?: GraphiqueSpec[];
  sources?: string[];
}

const texte = (v: unknown, max: number): string =>
  typeof v === "string" ? v.trim().slice(0, max) : "";

const dansListe = <T extends string>(liste: readonly T[], v: unknown, defaut: T): T =>
  typeof v === "string" && (liste as readonly string[]).includes(v) ? (v as T) : defaut;

/**
 * UNE CELLULE, TYPÉE PAR SA COLONNE — jamais par ce que le modèle a écrit ce jour-là.
 *
 * Une colonne `money` reçoit « 4 200 000 DZD » et rend `4200000`. Sans cette conversion, la
 * cellule resterait du texte, la somme du bas vaudrait zéro, et le classeur afficherait un total
 * faux sans qu'aucune formule ne soit en erreur — le pire des cas, parce qu'il est silencieux.
 *
 * Un texte qui ne contient AUCUN chiffre dans une colonne numérique reste `null` : le forcer à
 * zéro inventerait une valeur, et un zéro inventé se propage dans les totaux et les moyennes.
 */
function normaliserCellule(v: unknown, type: TypeColonne): string | number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "boolean") return v ? "oui" : "non";

  if (type === "number" || type === "money" || type === "percent") {
    if (typeof v === "number") return Number.isFinite(v) ? v : null;
    const brut = String(v).trim();
    if (brut === "") return null;
    // Espaces (y compris insécables), symboles, devise ; virgule décimale française.
    const nettoye = brut
      .replace(/[\s  ]/g, "")
      .replace(/[^\d,.\-+eE]/g, "")
      .replace(/,(\d{1,2})$/, ".$1")
      .replace(/,/g, "");
    if (nettoye === "" || !/\d/.test(nettoye)) return null;
    const n = Number(nettoye);
    if (!Number.isFinite(n)) return null;
    // Un pourcentage écrit « 12,5 » vaut 0,125 dans une cellule au format `0.0%`.
    return type === "percent" && Math.abs(n) > 1 ? n / 100 : n;
  }

  if (typeof v === "number") return String(v);
  return String(v).slice(0, 500);
}

/**
 * VALIDE ET BORNE UNE SPEC VENUE DU MODÈLE.
 *
 * Tout est borné : nombre de feuilles, de colonnes, de lignes, longueur des chaînes. Une spec
 * non bornée est une porte ouverte à un classeur de deux gigaoctets fabriqué par une boucle
 * malheureuse — et le processus qui le fabrique est celui qui sert les autres missions.
 */
export function parserSpec(brut: Record<string, unknown>): ArtefactSpec | { error: string } {
  const key = texte(brut.key, 80);
  const title = texte(brut.title, 200);
  if (!key) return { error: "Le livrable doit porter une `key`." };
  if (!title) return { error: "Le livrable doit porter un `title`." };
  const format = dansListe(FORMATS_ARTEFACT, brut.format, "XLSX");

  const sheets: FeuilleSpec[] = [];
  for (const rawSheet of (Array.isArray(brut.sheets) ? brut.sheets : []).slice(0, 12)) {
    if (!rawSheet || typeof rawSheet !== "object") continue;
    const s = rawSheet as Record<string, unknown>;
    // Les caractères interdits par Excel dans un nom de feuille : : \ / ? * [ ]
    const name = texte(s.name, 31).replace(/[:\\/?*[\]]/g, "-") || `Feuille ${sheets.length + 1}`;
    const columns: ColonneSpec[] = [];
    for (const rawCol of (Array.isArray(s.columns) ? s.columns : []).slice(0, 40)) {
      if (!rawCol || typeof rawCol !== "object") continue;
      const c = rawCol as Record<string, unknown>;
      const cle = texte(c.key, 60);
      if (!cle) continue;
      columns.push({
        header: texte(c.header, 80) || cle,
        key: cle,
        type: dansListe(TYPES_COLONNE, c.type, "text"),
        width: typeof c.width === "number" && c.width > 0 ? Math.min(80, c.width) : undefined,
      });
    }
    if (columns.length === 0) continue;

    const cles = new Set(columns.map((c) => c.key));
    const rows: Record<string, string | number | null>[] = [];
    for (const rawRow of (Array.isArray(s.rows) ? s.rows : []).slice(0, 20_000)) {
      if (!rawRow || typeof rawRow !== "object") continue;
      const r = rawRow as Record<string, unknown>;

      // DEUX FORMES DE LIGNE, une seule sortie.
      //
      // `{ produit: "A", valeur: 120 }` vient du CODE (une étape amont a déjà les bonnes clés).
      // `{ values: ["A", "120"] }` vient du MODÈLE : le mode strict interdit les objets libres,
      // donc la ligne arrive comme une liste alignée sur les colonnes. La convertir ici plutôt
      // qu'au point d'appel évite d'avoir deux chemins de validation, donc deux comportements.
      const parValeurs = Array.isArray(r.values) ? (r.values as unknown[]) : null;
      const ligne: Record<string, string | number | null> = {};
      for (const [i, c] of columns.entries()) {
        const v = parValeurs ? parValeurs[i] : r[c.key];
        ligne[c.key] = normaliserCellule(v, c.type);
      }
      rows.push(ligne);
    }

    const computed: ColonneCalculee[] = [];
    for (const rawC of (Array.isArray(s.computed) ? s.computed : []).slice(0, 10)) {
      if (!rawC || typeof rawC !== "object") continue;
      const c = rawC as Record<string, unknown>;
      const cle = texte(c.key, 60);
      const args = (Array.isArray(c.args) ? c.args : []).map((a) => texte(a, 60)).filter(Boolean);
      // UNE COLONNE CALCULÉE QUI RÉFÉRENCE UNE COLONNE ABSENTE EST ÉCARTÉE, jamais fabriquée
      // avec une plage vide : c'est très exactement ainsi qu'on obtient un `#REF!`.
      if (!cle || args.length === 0 || !args.every((a) => cles.has(a))) continue;
      computed.push({
        header: texte(c.header, 80) || cle,
        key: cle,
        calcul: dansListe(CALCULS, c.calcul, "SHARE"),
        args,
      });
    }

    // Les totaux arrivent, eux aussi, sous deux formes : une table `{ colonne: agrégat }` côté
    // code, une liste `[{ column, agregat }]` côté modèle (mode strict, encore une fois).
    const totals: Record<string, Agregat> = {};
    const accepterTotal = (k: string, v: unknown) => {
      if (!cles.has(k) && !computed.some((c) => c.key === k)) return;
      totals[k] = dansListe(AGREGATS, v, "SUM");
    };
    if (Array.isArray(s.totals)) {
      for (const t of s.totals) {
        if (!t || typeof t !== "object") continue;
        const o = t as Record<string, unknown>;
        accepterTotal(texte(o.column, 60), o.agregat);
      }
    } else if (s.totals && typeof s.totals === "object") {
      for (const [k, v] of Object.entries(s.totals as Record<string, unknown>)) accepterTotal(k, v);
    }

    sheets.push({
      name, columns, rows,
      computed: computed.length > 0 ? computed : undefined,
      totals: Object.keys(totals).length > 0 ? totals : undefined,
      note: texte(s.note, 400) || undefined,
    });
  }

  const charts: GraphiqueSpec[] = [];
  for (const rawCh of (Array.isArray(brut.charts) ? brut.charts : []).slice(0, 8)) {
    if (!rawCh || typeof rawCh !== "object") continue;
    const c = rawCh as Record<string, unknown>;
    const sheetName = texte(c.sheet, 31);
    const feuille = sheets.find((f) => f.name === sheetName);
    if (!feuille) continue;
    const toutes = [...feuille.columns.map((x) => x.key), ...(feuille.computed ?? []).map((x) => x.key)];
    const categories = texte(c.categories, 60);
    const series = (Array.isArray(c.series) ? c.series : []).map((x) => texte(x, 60)).filter((x) => toutes.includes(x));
    // MÊME RÈGLE QUE POUR LES CALCULS : un graphique dont les colonnes n'existent pas est ÉCARTÉ.
    // Un graphique vide dans un classeur envoyé à la direction est pire que pas de graphique.
    if (!toutes.includes(categories) || series.length === 0) continue;
    charts.push({
      sheet: feuille.name,
      kind: dansListe(TYPES_GRAPHIQUE, c.kind, "bar"),
      title: texte(c.title, 120) || "Graphique",
      categories,
      series,
    });
  }

  const summary: SectionTexte[] = [];
  for (const rawS of (Array.isArray(brut.summary) ? brut.summary : []).slice(0, 20)) {
    if (!rawS || typeof rawS !== "object") continue;
    const s = rawS as Record<string, unknown>;
    const heading = texte(s.heading, 160);
    if (!heading) continue;
    summary.push({
      heading,
      paragraphs: (Array.isArray(s.paragraphs) ? s.paragraphs : []).map((p) => texte(p, 2200)).filter(Boolean).slice(0, 20),
      bullets: (Array.isArray(s.bullets) ? s.bullets : []).map((b) => texte(b, 400)).filter(Boolean).slice(0, 20),
    });
  }

  if (format === "XLSX" && sheets.length === 0) {
    return { error: "Un classeur sans aucune feuille exploitable : donner `sheets` avec des colonnes et des lignes." };
  }
  if ((format === "DOCX" || format === "PDF" || format === "PPTX") && summary.length === 0 && sheets.length === 0) {
    return { error: "Un document sans section ni tableau : donner `summary` ou `sheets`." };
  }

  return {
    key, title, format,
    fileName: texte(brut.fileName, 160) || undefined,
    summary: summary.length > 0 ? summary : undefined,
    sheets: sheets.length > 0 ? sheets : undefined,
    charts: charts.length > 0 ? charts : undefined,
    sources: (Array.isArray(brut.sources) ? brut.sources : []).map((x) => texte(x, 300)).filter(Boolean).slice(0, 40),
  };
}

/** Le nom de fichier, assaini. Un nom de fichier venu d'un modèle ne traverse jamais tel quel. */
export function nomFichier(spec: ArtefactSpec): string {
  const ext = spec.format.toLowerCase();
  const base = (spec.fileName ?? spec.title)
    .replace(/\.[a-z0-9]{2,5}$/i, "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9 _-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120) || "Livrable";
  return `${base}.${ext}`;
}
