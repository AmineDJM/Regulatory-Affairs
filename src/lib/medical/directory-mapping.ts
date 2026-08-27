import { DIRECTORY_COLUMNS, normalizeHeader, matchColumn, type DirectoryField } from "./directory-sheet";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LA CORRESPONDANCE DES COLONNES — proposée par la machine, tranchée par la personne.
 *
 * ── POURQUOI LA RECONNAISSANCE AUTOMATIQUE NE SUFFIT PAS ─────────────────────────────────
 *
 * `matchColumn` reconnaît « N° Tél. » et « Téléphone ». Elle ne reconnaîtra jamais « Colonne 3 »,
 * « Champ libre 2 », ni le fichier d'un partenaire qui appelle « Contact » ce que nous appelons
 * « Délégué ». Jusqu'ici ces colonnes tombaient dans « non reconnues » : l'import annonçait leur
 * nom dans un message de fin, et leur contenu était PERDU. Une donnée qu'on a lue, comprise, puis
 * jetée en le signalant poliment reste une donnée jetée.
 *
 * Ce module rend donc une PROPOSITION — pas une décision. Chaque en-tête du fichier reçoit une
 * cible suggérée et l'ORIGINE de la suggestion, pour qu'on puisse juger sur pièce plutôt que
 * faire confiance. La personne corrige ce qui est faux, complète ce qui manque, écarte le reste.
 *
 * ── LA RÈGLE QUI ÉVITE L'ÉCRASEMENT SILENCIEUX ───────────────────────────────────────────
 *
 * Une cible ne se prend qu'UNE fois. Deux colonnes du fichier dirigées vers « Téléphone », c'est
 * une des deux qui écrase l'autre — et on ne sait pas laquelle. `validateMapping` le refuse en
 * NOMMANT le conflit, plutôt que de choisir à la place de quelqu'un.
 *
 * Module PUR — aucun accès base, aucune lecture de fichier.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/** Le préfixe distingue une colonne du tronc commun d'une colonne propre à l'annuaire. */
export const STD = "std:";
export const CUS = "cus:";

export type ColumnKind = "TEXT" | "NUMBER" | "DATE" | "CHOICE";

/** Une colonne d'annuaire telle qu'elle est stockée (colonnes sur mesure). */
export interface CustomColumn {
  key: string;
  label: string;
  kind: ColumnKind;
  options?: string | null;
}

/** Une cible possible pour une colonne du fichier. */
export interface TargetColumn {
  /** `std:phone` ou `cus:dernier_congres`. */
  id: string;
  label: string;
  kind: ColumnKind;
  options?: string[];
}

/**
 * CLÉ TECHNIQUE D'UNE COLONNE SUR MESURE, dérivée de son libellé.
 *
 * Elle est calculée UNE fois, à la création, puis figée : c'est ce qui permet de renommer
 * « Congrès » en « Dernier congrès » sans perdre les valeurs déjà saisies. Un préfixe `c_` évite
 * qu'une clé commence par un chiffre et qu'elle entre jamais en collision avec un champ du tronc
 * commun — `phone` sur mesure et `phone` standard ne doivent pas désigner la même chose.
 */
export function columnKeyFrom(label: string): string {
  const base = normalizeHeader(label).replace(/\s+/g, "_").slice(0, 40);
  return base ? `c_${base}` : `c_${Date.now().toString(36)}`;
}

/** Une clé libre de conflit dans cet annuaire — on suffixe plutôt que de refuser. */
export function uniqueColumnKey(label: string, existing: readonly string[]): string {
  const base = columnKeyFrom(label);
  if (!existing.includes(base)) return base;
  for (let i = 2; i < 500; i++) {
    const candidate = `${base}_${i}`;
    if (!existing.includes(candidate)) return candidate;
  }
  return `${base}_${Date.now().toString(36)}`;
}

/** Toutes les cibles offertes pour cet annuaire : le tronc commun, puis ses colonnes propres. */
export function targetsFor(custom: readonly CustomColumn[]): TargetColumn[] {
  const std: TargetColumn[] = DIRECTORY_COLUMNS.map((c) => ({
    id: `${STD}${c.key}`,
    label: c.header,
    kind: "TEXT",
  }));
  const cus: TargetColumn[] = custom.map((c) => ({
    id: `${CUS}${c.key}`,
    label: c.label,
    kind: c.kind,
    ...(c.options ? { options: c.options.split("|").map((o) => o.trim()).filter(Boolean) } : {}),
  }));
  return [...std, ...cus];
}

/** D'où vient une suggestion. Affiché : on ne demande pas de faire confiance sans montrer. */
export type MatchOrigin = "exact" | "alias" | "approche" | "aucune";

export interface HeaderProposal {
  index: number;
  header: string;
  /** La cible proposée (`std:…` / `cus:…`), ou `null` = ne pas importer cette colonne. */
  target: string | null;
  origin: MatchOrigin;
  /** Un échantillon de valeurs, pour juger sans ouvrir le fichier à côté. */
  sample: string[];
}

const SAMPLE_MAX = 3;

function echantillon(rows: readonly (readonly unknown[])[], index: number): string[] {
  const out: string[] = [];
  for (const row of rows) {
    const v = String(row?.[index] ?? "").replace(/\s+/g, " ").trim();
    if (v) out.push(v.length > 40 ? `${v.slice(0, 39)}…` : v);
    if (out.length >= SAMPLE_MAX) break;
  }
  return out;
}

/**
 * LA PROPOSITION, en-tête par en-tête.
 *
 * L'ordre des tentatives va du plus sûr au plus permissif, et l'ORIGINE est rendue pour que
 * l'écran puisse distinguer « c'est écrit dessus » de « on a deviné ». Un import où tout paraît
 * également certain est un import qu'on relit mal.
 *
 * Les colonnes SUR MESURE sont candidates au même titre que le tronc commun : le second import
 * d'un fichier récurrent retrouve donc tout seul les colonnes qu'on avait créées au premier.
 */
export function proposeMapping(
  headers: readonly unknown[],
  rows: readonly (readonly unknown[])[],
  custom: readonly CustomColumn[] = [],
): HeaderProposal[] {
  const pris = new Set<string>();
  const out: HeaderProposal[] = [];

  const parLibelleCustom = new Map(custom.map((c) => [normalizeHeader(c.label), c.key]));

  headers.forEach((h, index) => {
    const header = String(h ?? "").trim();
    const n = normalizeHeader(h);
    const sample = echantillon(rows, index);

    const proposer = (target: string, origin: MatchOrigin): boolean => {
      if (pris.has(target)) return false;
      pris.add(target);
      out.push({ index, header, target, origin, sample });
      return true;
    };

    if (!header) {
      out.push({ index, header, target: null, origin: "aucune", sample });
      return;
    }

    // 1. Une colonne sur mesure portant EXACTEMENT ce libellé — la plus spécifique gagne :
    //    si quelqu'un a créé « Contact » dans cet annuaire, c'est celle-là qu'il veut.
    const cle = parLibelleCustom.get(n);
    if (cle && proposer(`${CUS}${cle}`, "exact")) return;

    // 2. Le tronc commun, par son en-tête canonique puis par ses alias connus.
    const champ: DirectoryField | null = matchColumn(h);
    if (champ) {
      const canonique = DIRECTORY_COLUMNS.find((c) => c.key === champ);
      const origin: MatchOrigin = canonique && normalizeHeader(canonique.header) === n ? "exact" : "alias";
      if (proposer(`${STD}${champ}`, origin)) return;
    }

    // 3. Rien de sûr. On ne devine PAS : la colonne est proposée « à ne pas importer », et c'est
    //    à l'écran de la rattacher ou d'en faire une colonne neuve. Deviner ici mettrait des
    //    numéros de téléphone dans « Commentaires » sans que personne ne s'en aperçoive.
    out.push({ index, header, target: null, origin: "aucune", sample });
  });

  return out;
}

export interface MappingProblem {
  kind: "doublon" | "sans-nom";
  message: string;
}

/**
 * LA CORRESPONDANCE EST-ELLE UTILISABLE ?
 *
 * Deux refus seulement, et chacun a coûté quelque chose ailleurs :
 *
 *   • DEUX COLONNES VERS LA MÊME CIBLE — l'une écrase l'autre, et rien ne dit laquelle.
 *   • AUCUNE COLONNE DE NOM — une fiche sans nom n'est pas une fiche. C'est le seul champ dont
 *     l'absence rend l'import entier inutile, et il vaut mieux le dire avant d'écrire que
 *     rapporter « 0 ligne importée » après.
 */
export function validateMapping(mapping: readonly (string | null)[]): MappingProblem[] {
  const problemes: MappingProblem[] = [];
  const vus = new Map<string, number>();

  mapping.forEach((t, i) => {
    if (!t) return;
    const deja = vus.get(t);
    if (deja !== undefined) {
      problemes.push({
        kind: "doublon",
        message: `Les colonnes ${deja + 1} et ${i + 1} visent la même cible : l'une écraserait l'autre.`,
      });
    } else {
      vus.set(t, i);
    }
  });

  const aNom = vus.has(`${STD}name`) || vus.has(`${STD}lastName`);
  if (!aNom) {
    problemes.push({
      kind: "sans-nom",
      message: "Aucune colonne n'est rattachée au nom : une fiche sans nom ne peut pas être créée.",
    });
  }

  return problemes;
}

/** Le champ standard visé par une cible, ou `null` si ce n'en est pas une. */
export function stdFieldOf(target: string | null): DirectoryField | null {
  if (!target || !target.startsWith(STD)) return null;
  const key = target.slice(STD.length);
  return DIRECTORY_COLUMNS.some((c) => c.key === key) ? (key as DirectoryField) : null;
}

/** La clé de colonne sur mesure visée par une cible, ou `null`. */
export function customKeyOf(target: string | null): string | null {
  if (!target || !target.startsWith(CUS)) return null;
  const key = target.slice(CUS.length);
  return key || null;
}

/**
 * LA LIGNE DU FICHIER, RÉORDONNÉE selon la correspondance retenue.
 *
 * Rend une ligne au format attendu par `parseDirectoryRow` (les colonnes du tronc commun à leur
 * place canonique) PLUS les valeurs sur mesure à part. Passer par la forme canonique évite de
 * réécrire la reconnaissance des grades, secteurs et wilayas : elle est déjà écrite, déjà testée,
 * et deux exemplaires auraient divergé à la première correction.
 */
export function applyMapping(
  row: readonly unknown[],
  mapping: readonly (string | null)[],
): { standard: Record<string, unknown>; custom: Record<string, string> } {
  const standard: Record<string, unknown> = {};
  const custom: Record<string, string> = {};

  mapping.forEach((target, i) => {
    if (!target) return;
    const brut = row[i];
    const std = stdFieldOf(target);
    if (std) {
      standard[std] = brut;
      return;
    }
    const cle = customKeyOf(target);
    if (cle) {
      const v = String(brut ?? "").replace(/\s+/g, " ").trim();
      // Une cellule vide n'écrase pas une valeur déjà saisie : un réimport partiel ne doit pas
      // vider les colonnes que le fichier ne porte pas.
      if (v) custom[cle] = v;
    }
  });

  return { standard, custom };
}

/**
 * LES EN-TÊTES CANONIQUES, dans l'ordre où `parseDirectorySheet` les attend.
 *
 * C'est le pont entre la correspondance choisie et le parseur existant : on reconstruit une
 * feuille « propre » (une colonne par champ du tronc commun, nommée canoniquement) et on la
 * donne au parseur, qui n'a alors plus rien à deviner.
 */
export function canonicalHeaderRow(): string[] {
  return DIRECTORY_COLUMNS.map((c) => c.header);
}

/** La ligne standard, remise dans l'ordre canonique de `canonicalHeaderRow`. */
export function toCanonicalRow(standard: Record<string, unknown>): unknown[] {
  return DIRECTORY_COLUMNS.map((c) => standard[c.key] ?? "");
}
