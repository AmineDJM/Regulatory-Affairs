/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LES DONNÉES CANONIQUES — une seule vérité, trois formats.
 *
 * Un dossier de comité, c'est un classeur (les chiffres), un deck (la lecture) et une note (le
 * texte). Quand ils sont produits séparément, un chiffre change dans l'un et pas dans les autres,
 * et personne ne le voit avant la réunion. Ici, les trois sont DÉRIVÉS de la même structure :
 * les tableaux portent leurs lignes une fois, les colonnes calculées et les totaux sont évalués
 * une fois par le code, et le classeur — qui recalcule ses formules avec notre moteur — doit
 * retomber sur les mêmes totaux. `verifierCoherence` le vérifie, chiffre par chiffre : c'est la
 * seule comparaison INDÉPENDANTE du système (deux évaluateurs différents, un résultat).
 *
 * ── LA GRAMMAIRE DES FORMULES DE LIGNE EST VOLONTAIREMENT PETITE ────────────────────────
 *
 * `[qte]*[pu]*(1-[remise])`, `{TVA}` : quatre opérations, des parenthèses, des colonnes, des
 * paramètres, des nombres. Une formule Excel plus riche (SI, ARRONDI…) irait dans le classeur
 * mais le code ne saurait pas la contre-calculer — et un total qu'on ne peut pas vérifier n'a
 * rien à faire dans un dossier de comité. `verifierSpecCanon` la refuse en le disant.
 *
 * Module PUR.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import type { SpecClasseur, SpecColonne, SpecFeuille } from "@/lib/artifact/sheets/build";
import type { SpecDeck, SpecDiapo } from "@/lib/artifact/decks/build";
import { formaterDateFr } from "@/lib/artifact/factory/commercial";
import { paragraphe, tableau, vide, type Cellule } from "@/lib/artifact/factory/word";

export type TypeColonneCanon = "texte" | "nombre" | "montant" | "pourcentage" | "date" | "entier";

export interface ColonneCanon {
  cle: string;
  titre: string;
  type: TypeColonneCanon;
  /** Formule par ligne en termes de colonnes : `[qte]*[pu]`. Sans formule : une donnée. */
  formule?: string | null;
}

export interface TableauCanon {
  cle: string;
  titre: string;
  colonnes: ColonneCanon[];
  lignes: Record<string, string | number | null>[];
  /** Les colonnes à totaliser (somme) sur la ligne de total. */
  totaux?: string[] | null;
}

export interface SectionCanon {
  titre: string;
  texte?: string | null;
  puces?: string[] | null;
}

export interface ChiffreCanon {
  cle: string;
  libelle: string;
  valeur: number;
  format?: "montant" | "nombre" | "pourcentage" | "entier" | null;
}

export interface DonneesCanoniques {
  titre: string;
  sousTitre?: string | null;
  societe: { nom: string; couleur?: string | null };
  /** ISO `AAAA-MM-JJ`. */
  date?: string | null;
  sections: SectionCanon[];
  tableaux: TableauCanon[];
  chiffres: ChiffreCanon[];
  parametres?: { nom: string; valeur: number | string; libelle?: string; format?: string }[] | null;
  /** Ce qu'on met en pied : mentions, sources. */
  pied?: string[] | null;
}

export const FORMAT_MONTANT = "#,##0.00 \"DZD\"";
export const FORMAT_POURCENTAGE = "0.0%";

const formatExcelDe = (t: TypeColonneCanon): string | undefined =>
  t === "montant" ? FORMAT_MONTANT : t === "pourcentage" ? FORMAT_POURCENTAGE : t === "date" ? "dd/mm/yyyy" : t === "nombre" ? "#,##0.00" : t === "entier" ? "0" : undefined;

const NBSP = "\u00a0";
const grouper = (s: string): string => s.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);

/** « 41 300,50 DZD », « 12,5 % », « 1 250 » — le même rendu dans le deck et dans la note. */
export function formaterValeur(v: number | string | null | undefined, type: TypeColonneCanon | "montant" | "nombre" | "pourcentage" | "entier" = "texte"): string {
  if (v === null || v === undefined) return "";
  if (typeof v !== "number") return type === "date" ? formaterDateFr(String(v)) : String(v);
  if (!Number.isFinite(v)) return "";
  const fixe = (n: number, d: number): string => { const [e, f = ""] = Math.abs(n).toFixed(d).split("."); return `${n < 0 ? "-" : ""}${grouper(e)}${d > 0 ? `,${f}` : ""}`; };
  if (type === "montant") return `${fixe(v, 2)}${NBSP}DZD`;
  if (type === "pourcentage") return `${fixe(v * 100, 1).replace(/,0$/, "")}${NBSP}%`;
  if (type === "entier") return fixe(v, 0);
  return Number.isInteger(v) ? fixe(v, 0) : fixe(v, 2);
}

// ─────────────────────────── L'évaluation des formules de ligne, par le CODE ───────────────────────────

const JETON = /\[[^\]]+\]|\{[^}]+\}|\d+(?:[.,]\d+)?|[()+\-*/]/g;

/** La formule est-elle dans la grammaire que le code sait contre-calculer ? */
export function formuleVerifiable(formule: string): boolean {
  const expr = formule.trim().replace(/^=/, "").replace(/\s+/g, "");
  if (!expr) return false;
  const jetons = expr.match(JETON) ?? [];
  return jetons.join("") === expr;
}

/**
 * Évalue une formule de ligne (`[qte]*[pu]*(1-[remise])`, `{TVA}`) sur une ligne : c'est la
 * référence contre laquelle le classeur recalculé sera comparé. `null` si la formule sort de
 * la grammaire ou si le résultat n'est pas un nombre fini.
 */
export function evaluerFormuleLigne(formule: string, ligne: Record<string, string | number | null>, parametres: Record<string, number>): number | null {
  if (!formuleVerifiable(formule)) return null;
  const expr = formule.trim().replace(/^=/, "").replace(/\s+/g, "");
  const jetons = expr.match(JETON) ?? [];
  const js = jetons.map((j) => {
    if (j.startsWith("[")) {
      const v = ligne[j.slice(1, -1)];
      if (typeof v === "number") return `(${v})`;
      if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v.replace(",", ".")))) return `(${Number(v.replace(",", "."))})`;
      return "(0)";
    }
    if (j.startsWith("{")) { const v = parametres[j.slice(1, -1)]; return typeof v === "number" ? `(${v})` : "(0)"; }
    return j.replace(",", ".");
  }).join("");
  if (!/^[\d.()+\-*/]+$/.test(js)) return null;
  try {
    const r = Function(`"use strict"; return (${js});`)() as number;
    return Number.isFinite(r) ? Math.round(r * 1e6) / 1e6 : null;
  } catch { return null; }
}

/** Les lignes d'un tableau, colonnes calculées COMPRISES, et ses totaux — calculés par le code. */
export function calculerTableau(t: TableauCanon, parametres: Record<string, number> = {}): { lignes: Record<string, string | number | null>[]; totaux: Record<string, number> } {
  const lignes = t.lignes.map((l) => {
    const out: Record<string, string | number | null> = { ...l };
    for (const c of t.colonnes) if (c.formule) out[c.cle] = evaluerFormuleLigne(c.formule, out, parametres);
    return out;
  });
  const totaux: Record<string, number> = {};
  for (const cle of t.totaux ?? []) totaux[cle] = Math.round(lignes.reduce((s, l) => s + (typeof l[cle] === "number" ? (l[cle] as number) : 0), 0) * 1e6) / 1e6;
  return { lignes, totaux };
}

export const parametresNumeriques = (canon: DonneesCanoniques): Record<string, number> =>
  Object.fromEntries((canon.parametres ?? []).filter((p) => typeof p.valeur === "number").map((p) => [p.nom, p.valeur as number]));

// ─────────────────────────── La validité ───────────────────────────

export interface VerificationCanon { bloquants: string[]; avertissements: string[] }

const MAX_TABLEAUX = 100;
const MAX_LIGNES = 50_000;

export function verifierSpecCanon(canon: DonneesCanoniques): VerificationCanon {
  const bloquants: string[] = [];
  const avertissements: string[] = [];
  if (!canon.titre?.trim()) bloquants.push("Le dossier n'a pas de titre.");
  if (!canon.societe?.nom?.trim()) bloquants.push("Le dossier ne dit pas pour quelle société il est produit.");
  const sections = canon.sections ?? [];
  const tableaux = canon.tableaux ?? [];
  const chiffres = canon.chiffres ?? [];
  if (sections.length === 0 && tableaux.length === 0 && chiffres.length === 0) bloquants.push("Le dossier est vide : ni section, ni tableau, ni chiffre.");
  if (tableaux.length > MAX_TABLEAUX) bloquants.push(`${tableaux.length} tableaux : au-delà de ${MAX_TABLEAUX}, scinder le dossier.`);
  const cles = new Set<string>();
  const noms = new Set<string>();
  tableaux.forEach((t, i) => {
    const ou = `Tableau ${i + 1}${t.titre ? ` « ${t.titre} »` : ""}`;
    if (!t.titre?.trim()) bloquants.push(`${ou} : sans titre.`);
    if (!t.cle?.trim()) bloquants.push(`${ou} : sans clé.`);
    else if (cles.has(t.cle)) bloquants.push(`${ou} : clé « ${t.cle} » déjà utilisée.`);
    cles.add(t.cle);
    const nom = nomFeuilleDe(t.titre ?? "");
    if (noms.has(nom.toLowerCase())) bloquants.push(`${ou} : deux tableaux donneraient la même feuille Excel « ${nom} ».`);
    noms.add(nom.toLowerCase());
    if (!Array.isArray(t.colonnes) || t.colonnes.length === 0) bloquants.push(`${ou} : sans colonne.`);
    const clesCol = new Set<string>();
    for (const c of t.colonnes ?? []) {
      if (!c.cle?.trim() || !/^[A-Za-z0-9_À-ſ]+$/.test(c.cle)) bloquants.push(`${ou} : clé de colonne invalide « ${c.cle} » (lettres, chiffres, _).`);
      if (clesCol.has(c.cle)) bloquants.push(`${ou} : colonne « ${c.cle} » en double.`);
      clesCol.add(c.cle);
      if (c.formule && !formuleVerifiable(c.formule)) bloquants.push(`${ou}, colonne « ${c.cle} » : la formule « ${c.formule} » sort de la grammaire vérifiable (+ - * / parenthèses, [colonne], {paramètre}).`);
      if (c.formule) {
        for (const m of c.formule.matchAll(/\[([^\]]+)\]/g)) if (!(t.colonnes ?? []).some((x) => x.cle === m[1])) bloquants.push(`${ou}, colonne « ${c.cle} » : la formule cite une colonne inconnue [${m[1]}].`);
        for (const m of c.formule.matchAll(/\{([^}]+)\}/g)) if (!(canon.parametres ?? []).some((p) => p.nom === m[1])) bloquants.push(`${ou}, colonne « ${c.cle} » : la formule cite un paramètre inconnu {${m[1]}}.`);
      }
    }
    for (const cle of t.totaux ?? []) if (!clesCol.has(cle)) bloquants.push(`${ou} : total demandé sur une colonne inconnue « ${cle} ».`);
    if (!Array.isArray(t.lignes)) bloquants.push(`${ou} : lignes absentes.`);
    else if (t.lignes.length > MAX_LIGNES) bloquants.push(`${ou} : ${t.lignes.length} lignes — au-delà de ${MAX_LIGNES}, ce n'est plus un dossier de comité.`);
    else if (t.lignes.length > 11) avertissements.push(`${ou} : ${t.lignes.length} lignes — la diapositive n'en montrera que 11, le classeur les porte toutes.`);
  });
  chiffres.forEach((c, i) => {
    if (!c.libelle?.trim()) bloquants.push(`Chiffre clé ${i + 1} : sans libellé.`);
    if (typeof c.valeur !== "number" || !Number.isFinite(c.valeur)) bloquants.push(`Chiffre clé ${i + 1} « ${c.libelle} » : valeur non numérique.`);
  });
  sections.forEach((s, i) => {
    if (!s.titre?.trim()) bloquants.push(`Section ${i + 1} : sans titre.`);
    if (!s.texte?.trim() && !(s.puces ?? []).some((p) => p?.trim())) bloquants.push(`Section ${i + 1} « ${s.titre} » : vide.`);
  });
  return { bloquants, avertissements };
}

// ─────────────────────────── Excel ───────────────────────────

/** Le nom d'onglet Excel d'un tableau : ≤ 28 caractères, sans caractères interdits. */
export function nomFeuilleDe(titre: string): string {
  return titre.replace(/[\\/*?:[\]]/g, " ").replace(/\s+/g, " ").trim().slice(0, 28).trim() || "Tableau";
}

export function versClasseur(canon: DonneesCanoniques): SpecClasseur {
  const feuilles: SpecFeuille[] = canon.tableaux.map((t) => ({
    nom: nomFeuilleDe(t.titre),
    colonnes: t.colonnes.map((c): SpecColonne => ({ cle: c.cle, titre: c.titre, formule: c.formule ?? undefined, format: formatExcelDe(c.type) })),
    lignes: t.lignes,
    totaux: t.totaux && t.totaux.length ? Object.fromEntries(t.totaux.map((cle) => [cle, "SUM" as const])) : undefined,
  }));
  if (canon.chiffres.length > 0) {
    feuilles.push({
      nom: "Chiffres clés",
      colonnes: [{ cle: "libelle", titre: "Indicateur" }, { cle: "valeur", titre: "Valeur", format: "#,##0.00" }],
      lignes: canon.chiffres.map((c) => ({ libelle: c.libelle, valeur: c.valeur })),
    });
  }
  return { feuilles, parametres: canon.parametres ?? undefined, auteur: canon.societe.nom };
}

// ─────────────────────────── PowerPoint ───────────────────────────

const MAX_LIGNES_DIAPO = 11;

export function versDeck(canon: DonneesCanoniques): SpecDeck {
  const diapos: SpecDiapo[] = [];
  for (const s of canon.sections) {
    const puces = (s.puces ?? []).filter((p) => p?.trim()).slice(0, 6);
    diapos.push({
      titre: s.titre,
      puces: puces.length ? puces : undefined,
      texte: !puces.length && s.texte ? s.texte.split(/\s+/).slice(0, 90).join(" ") : undefined,
      notes: s.texte ?? undefined,
    });
  }
  for (const c of canon.chiffres) diapos.push({ titre: c.libelle, chiffre: { valeur: formaterValeur(c.valeur, c.format ?? "nombre"), legende: canon.sousTitre ?? canon.titre } });
  const params = parametresNumeriques(canon);
  for (const t of canon.tableaux) {
    const { lignes, totaux } = calculerTableau(t, params);
    const colonnes = t.colonnes.slice(0, 8);
    const corps = lignes.slice(0, MAX_LIGNES_DIAPO).map((l) => colonnes.map((c) => formaterValeur(l[c.cle], c.type)));
    if (Object.keys(totaux).length) corps.push(colonnes.map((c, i) => (i === 0 ? "Total" : totaux[c.cle] !== undefined ? formaterValeur(totaux[c.cle], c.type) : "")));
    diapos.push({
      titre: lignes.length > MAX_LIGNES_DIAPO ? `${t.titre} (${MAX_LIGNES_DIAPO} premières lignes sur ${lignes.length})` : t.titre,
      tableau: { colonnes: colonnes.map((c) => c.titre), lignes: corps.slice(0, 12) },
      notes: lignes.length > MAX_LIGNES_DIAPO ? `Le tableau complet (${lignes.length} lignes) est dans l'annexe Excel.` : undefined,
    });
  }
  return { titre: canon.titre, sousTitre: canon.sousTitre ?? undefined, auteur: canon.societe.nom, diapos, theme: canon.societe.couleur ? { couleur: canon.societe.couleur } : undefined };
}

// ─────────────────────────── Word ───────────────────────────

const MAX_LIGNES_NOTE = 60;
const GRIS = "595959";

/** Les blocs de la NOTE : mêmes chiffres que le deck et le classeur, mise en page de lecture. */
export function versDocument(canon: DonneesCanoniques): string[] {
  const accent = (canon.societe.couleur ?? "0B2545").replace(/^#/, "");
  const blocs: string[] = [paragraphe(canon.titre, { style: "Titre", couleur: accent })];
  if (canon.sousTitre) blocs.push(paragraphe(canon.sousTitre, { italique: true, couleur: GRIS, taillePt: 12 }));
  blocs.push(paragraphe([canon.societe.nom, canon.date ? formaterDateFr(canon.date) : null].filter(Boolean).join(" — "), { couleur: GRIS, taillePt: 9, apresPt: 10 }));
  for (const s of canon.sections) {
    blocs.push(paragraphe(s.titre, { style: "Titre1" }));
    for (const p of (s.texte ?? "").split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean)) blocs.push(paragraphe(p, { alignement: "both" }));
    for (const puce of (s.puces ?? []).filter((x) => x?.trim())) blocs.push(paragraphe(`–  ${puce.trim()}`, { apresPt: 2 }));
  }
  if (canon.chiffres.length) {
    blocs.push(paragraphe("Chiffres clés", { style: "Titre1" }));
    blocs.push(tableau(
      [["Indicateur", "Valeur"], ...canon.chiffres.map((c): Cellule[] => [c.libelle, formaterValeur(c.valeur, c.format ?? "nombre")])],
      { colonnes: [{ largeurCm: 11 }, { largeurCm: 5, alignement: "right" }], entete: true, couleurEntete: accent, taillePt: 10 },
    ));
    blocs.push(vide(4));
  }
  const params = parametresNumeriques(canon);
  for (const t of canon.tableaux) {
    const { lignes, totaux } = calculerTableau(t, params);
    const colonnes = t.colonnes.slice(0, 8);
    blocs.push(paragraphe(t.titre, { style: "Titre2" }));
    const largeur = 16 / colonnes.length;
    const corps: Cellule[][] = [
      colonnes.map((c) => c.titre),
      ...lignes.slice(0, MAX_LIGNES_NOTE).map((l) => colonnes.map((c): Cellule => formaterValeur(l[c.cle], c.type))),
    ];
    if (Object.keys(totaux).length) corps.push(colonnes.map((c, i): Cellule => ({ contenu: i === 0 ? "Total" : totaux[c.cle] !== undefined ? formaterValeur(totaux[c.cle], c.type) : "", gras: true })));
    blocs.push(tableau(corps, {
      colonnes: colonnes.map((c) => ({ largeurCm: Math.round(largeur * 100) / 100, alignement: c.type === "texte" || c.type === "date" ? "left" : "right" })),
      entete: true, couleurEntete: accent, taillePt: 9,
    }));
    if (lignes.length > MAX_LIGNES_NOTE) blocs.push(paragraphe(`${lignes.length - MAX_LIGNES_NOTE} lignes supplémentaires dans le classeur Excel joint.`, { italique: true, couleur: GRIS, taillePt: 9 }));
    blocs.push(vide(4));
  }
  if (canon.pied?.length) blocs.push(paragraphe(canon.pied.join("\n"), { taillePt: 8, couleur: GRIS, avantPt: 12 }));
  return blocs;
}

// ─────────────────────────── Cohérence inter-formats ───────────────────────────

export interface RapportCoherence {
  ok: boolean;
  /** Le nombre de totaux comparés entre le classeur recalculé et le calcul du code. */
  totauxCompares: number;
  ecarts: string[];
}

/**
 * LES TOTAUX DU CLASSEUR RECALCULÉ doivent être ceux que le code a calculés depuis les données
 * canoniques — sinon l'un des deux ment. `valeursClasseur` vient de `construireClasseurVerifie`
 * (`Feuille!A1` → valeur). Zéro total comparé est un ÉCHEC, pas un succès : un dossier sans
 * rien à vérifier n'a pas prouvé sa cohérence.
 */
export function verifierCoherence(canon: DonneesCanoniques, valeursClasseur: Map<string, unknown>): RapportCoherence {
  const ecarts: string[] = [];
  let totauxCompares = 0;
  const params = parametresNumeriques(canon);
  for (const t of canon.tableaux) {
    const { totaux } = calculerTableau(t, params);
    const nomFeuille = nomFeuilleDe(t.titre);
    const rowTotal = t.lignes.length + 2;
    for (const [cle, attendu] of Object.entries(totaux)) {
      const j = t.colonnes.findIndex((c) => c.cle === cle);
      if (j < 0) continue;
      const ref = `${nomFeuille}!${lettre(j + 1)}${rowTotal}`;
      const v = valeursClasseur.get(ref);
      totauxCompares += 1;
      if (typeof v !== "number" || Math.abs(v - attendu) > 1e-6 * Math.max(1, Math.abs(attendu))) ecarts.push(`${ref} : classeur ${String(v)} ≠ canonique ${attendu}`);
    }
  }
  const aDesTotaux = canon.tableaux.some((t) => (t.totaux ?? []).length > 0);
  if (aDesTotaux && totauxCompares === 0) ecarts.push("aucun total n'a pu être comparé");
  return { ok: ecarts.length === 0, totauxCompares, ecarts };
}

function lettre(col: number): string {
  let s = ""; let v = col;
  while (v > 0) { const r = (v - 1) % 26; s = String.fromCharCode(65 + r) + s; v = Math.floor((v - r) / 26); }
  return s;
}
