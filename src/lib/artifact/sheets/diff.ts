import { analyser, afficher, referencesDe, type Noeud, type Ref } from "@/lib/artifact/sheets/formula";
import { a1DeCoord } from "@/lib/artifact/sheets/refs";
import type { Cellule, Classeur, Feuille } from "@/lib/artifact/sheets/model";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LA COMPARAISON SÉMANTIQUE DE DEUX CLASSEURS — ce qui a CHANGÉ, pas ce qui a BOUGÉ.
 *
 * ── LE PIÈGE D'UNE COMPARAISON CELLULE À CELLULE ─────────────────────────────────────────
 *
 * Insérez une ligne en 5 dans un tableau de mille lignes : toutes les cellules de 5 à 1000
 * « changent ». Une comparaison positionnelle rend mille différences, et la seule qui compte —
 * la ligne ajoutée — s'y noie. Deux idées, et rien d'autre :
 *
 *   1. LES LIGNES SONT ALIGNÉES PAR LEUR CONTENU, pas par leur numéro. Signature de ligne,
 *      ancres uniques des deux côtés, plus longue sous-suite croissante (l'algorithme
 *      « patience ») ; entre deux ancres, alignement positionnel. Une ligne insérée est UNE
 *      différence ; les lignes en dessous sont retrouvées.
 *   2. LES FORMULES SONT COMPARÉES EN R1C1 — relativement à leur cellule. `=B5*C5` en D5 et
 *      `=B6*C6` en D6 sont LA MÊME formule ; c'est ce qui rend une recopie ou un décalage
 *      invisibles, et une vraie modification (`*1.19` ajouté) visible.
 *
 * ── CE QU'ON DISTINGUE, PARCE QUE CE N'EST PAS LA MÊME GRAVITÉ ──────────────────────────
 *
 * Une VALEUR modifiée (une saisie), une FORMULE modifiée (la logique), une formule ÉCRASÉE par
 * une valeur (le défaut n° 1 des modèles), une valeur DEVENUE formule, un RÉSULTAT qui bouge
 * sans que la formule change (une conséquence, pas une cause). Le résumé les compte à part.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

export type GenreChangement =
  | "FORMULE_ECRASEE" | "FORMULE_MODIFIEE" | "VALEUR_MODIFIEE" | "VALEUR_DEVENUE_FORMULE"
  | "CELLULE_AJOUTEE" | "CELLULE_SUPPRIMEE" | "LIGNE_INSEREE" | "LIGNE_SUPPRIMEE"
  | "FEUILLE_AJOUTEE" | "FEUILLE_SUPPRIMEE" | "NOM_MODIFIE" | "PLAGE_AJUSTEE" | "RESULTAT_MODIFIE";

export const LIBELLE_CHANGEMENT: Record<GenreChangement, string> = {
  FORMULE_ECRASEE: "formule écrasée par une valeur", FORMULE_MODIFIEE: "formule modifiée", VALEUR_MODIFIEE: "valeur modifiée",
  VALEUR_DEVENUE_FORMULE: "valeur devenue formule", CELLULE_AJOUTEE: "cellule ajoutée", CELLULE_SUPPRIMEE: "cellule vidée",
  LIGNE_INSEREE: "ligne insérée", LIGNE_SUPPRIMEE: "ligne supprimée", FEUILLE_AJOUTEE: "feuille ajoutée", FEUILLE_SUPPRIMEE: "feuille supprimée",
  NOM_MODIFIE: "nom défini modifié", PLAGE_AJUSTEE: "plage d'agrégat ajustée (lignes insérées ou supprimées)",
  RESULTAT_MODIFIE: "résultat modifié (formule inchangée)",
};

export interface Changement {
  genre: GenreChangement;
  feuille: string;
  /** A1 dans le classeur APRÈS (ou avant, pour une suppression) ; `null` pour une feuille ou un nom. */
  cellule: string | null;
  avant: string | null;
  apres: string | null;
}

export interface ComparaisonClasseurs {
  /** Les changements, les plus graves d'abord, plafonnés (`maxDetails`). */
  changements: Changement[];
  total: number;
  parGenre: Partial<Record<GenreChangement, number>>;
  parFeuille: { feuille: string; changements: number; lignesInserees: number; lignesSupprimees: number }[];
  resume: string;
  limites: string[];
  metriques: { ms: number; lignesAlignees: number };
}

const ORDRE: GenreChangement[] = [
  "FORMULE_ECRASEE", "FORMULE_MODIFIEE", "FEUILLE_SUPPRIMEE", "LIGNE_SUPPRIMEE", "LIGNE_INSEREE", "FEUILLE_AJOUTEE",
  "VALEUR_MODIFIEE", "VALEUR_DEVENUE_FORMULE", "CELLULE_SUPPRIMEE", "CELLULE_AJOUTEE", "NOM_MODIFIE", "PLAGE_AJUSTEE", "RESULTAT_MODIFIE",
];
const RANG = new Map(ORDRE.map((g, i) => [g, i]));

const texte = (c: Cellule | undefined): string | null => {
  if (!c) return null;
  if (c.f) return `=${c.f}`;
  if (c.v === null) return null;
  return typeof c.v === "number" ? String(Number(c.v.toPrecision(12))) : String(c.v);
};

const memeValeur = (a: Cellule["v"], b: Cellule["v"]): boolean => {
  if (typeof a === "number" && typeof b === "number") return Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
  return a === b;
};

/** La plus longue sous-suite croissante (indices), en O(n log n). */
function plusLongueCroissante(valeurs: number[]): number[] {
  const fin: number[] = []; const prec: number[] = new Array(valeurs.length).fill(-1); const idx: number[] = [];
  for (let i = 0; i < valeurs.length; i++) {
    let lo = 0, hi = fin.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (valeurs[fin[mid]] < valeurs[i]) lo = mid + 1; else hi = mid; }
    if (lo > 0) prec[i] = fin[lo - 1];
    fin[lo] = i; idx[lo] = i;
  }
  const out: number[] = [];
  for (let k = fin.length ? fin[fin.length - 1] : -1; k !== -1; k = prec[k]) out.push(k);
  return out.reverse();
}

/**
 * DEUX FORMULES ONT-ELLES LA MÊME FORME ? Même squelette (fonctions, opérateurs, constantes), et
 * chaque référence retrouvée soit au même endroit RELATIF (R1C1 : elle a suivi la formule), soit
 * au même endroit ABSOLU (A1 : elle est restée sur la même cellule pendant que la formule
 * bougeait). `SUM(D2:D40)` en D41 et `SUM(D2:D43)` en D44 après trois lignes insérées : le début
 * D2 est le même en A1, la fin est la même en R1C1 (la ligne juste au-dessus). C'est une plage
 * AJUSTÉE — une conséquence de l'insertion, pas une décision de modifier la formule.
 */
function squelette(n: Noeud): Noeud {
  switch (n.k) {
    case "ref": return { k: "name", nom: "§" };
    case "call": return { ...n, args: n.args.map(squelette) };
    case "bin": return { ...n, g: squelette(n.g), d: squelette(n.d) };
    case "un": return { ...n, a: squelette(n.a) };
    case "pct": return { ...n, a: squelette(n.a) };
    case "array": return { ...n, lignes: n.lignes.map((l) => l.map(squelette)) };
    default: return n;
  }
}
function bornes(r: Ref, origine: { row: number; col: number }): { debut: [string, string]; fin: [string, string] } {
  const debut: Ref = { ...r, r2: r.r1, c2: r.c1, absR2: r.absR1, absC2: r.absC1, type: "cell" };
  const fin: Ref = { ...r, r1: r.r2, c1: r.c2, absR1: r.absR2, absC1: r.absC2, type: "cell" };
  return {
    debut: [afficher({ k: "ref", ref: debut }), afficher({ k: "ref", ref: debut }, origine)],
    fin: [afficher({ k: "ref", ref: fin }), afficher({ k: "ref", ref: fin }, origine)],
  };
}
/**
 * `deltaLignes(feuille)` : de combien la feuille référencée a grandi (lignes insérées moins
 * supprimées). Une fin de plage qui a bougé d'exactement ce delta — `Données!D2:D100001` devenu
 * `D2:D100002` depuis la feuille Synthèse — a SUIVI l'insertion : ni A1 ni R1C1 ne le voient, le
 * delta si.
 */
function memeForme(a: Noeud, oa: { row: number; col: number }, b: Noeud, ob: { row: number; col: number }, deltaLignes: (feuille: string | null) => number): boolean {
  if (afficher(squelette(a)) !== afficher(squelette(b))) return false;
  const ra = referencesDe(a); const rb = referencesDe(b);
  if (ra.length !== rb.length) return false;
  for (let i = 0; i < ra.length; i++) {
    const x = bornes(ra[i], oa); const y = bornes(rb[i], ob);
    const meme = (p: [string, string], q: [string, string]) => p[0] === q[0] || p[1] === q[1];
    if (!meme(x.debut, y.debut)) return false;
    if (meme(x.fin, y.fin)) continue;
    const delta = deltaLignes(rb[i].feuille);
    const finSuivie = ra[i].type === "range" && rb[i].type === "range" && ra[i].c2 === rb[i].c2 && delta !== 0 && rb[i].r2 - ra[i].r2 === delta;
    if (!finSuivie) return false;
  }
  return true;
}

interface FeuilleIndexee { feuille: Feuille; lignes: Map<number, Map<number, Cellule>>; signatures: string[]; n: number }

function indexer(f: Feuille, r1c1: (c: Cellule) => string | null): FeuilleIndexee {
  const lignes = new Map<number, Map<number, Cellule>>();
  for (const c of f.cellules.values()) (lignes.get(c.row) ?? lignes.set(c.row, new Map()).get(c.row)!).set(c.col, c);
  const signatures: string[] = new Array(f.lignes + 1).fill("");
  for (const [row, cells] of lignes) {
    const parts = [...cells.values()].sort((a, b) => a.col - b.col).map((c) => `${c.col}=${c.f ? `F${r1c1(c) ?? c.f}` : `${c.t}:${String(c.v)}`}`);
    signatures[row] = parts.join("|");
  }
  return { feuille: f, lignes, signatures, n: f.lignes };
}

/** Aligne les lignes de deux feuilles : paires (rowA, rowB), lignes de A sans vis-à-vis, lignes de B sans vis-à-vis. */
function alignerLignes(a: FeuilleIndexee, b: FeuilleIndexee): { paires: [number, number][]; seulesA: number[]; seulesB: number[] } {
  const compteA = new Map<string, number>(); const compteB = new Map<string, number>();
  for (let r = 1; r <= a.n; r++) if (a.signatures[r]) compteA.set(a.signatures[r], (compteA.get(a.signatures[r]) ?? 0) + 1);
  for (let r = 1; r <= b.n; r++) if (b.signatures[r]) compteB.set(b.signatures[r], (compteB.get(b.signatures[r]) ?? 0) + 1);
  const posB = new Map<string, number>();
  for (let r = 1; r <= b.n; r++) { const s = b.signatures[r]; if (s && compteA.get(s) === 1 && compteB.get(s) === 1) posB.set(s, r); }
  const ancresA: number[] = []; const ancresB: number[] = [];
  for (let r = 1; r <= a.n; r++) { const s = a.signatures[r]; const rb = s ? posB.get(s) : undefined; if (rb !== undefined) { ancresA.push(r); ancresB.push(rb); } }
  const garde = plusLongueCroissante(ancresB);
  const ancres: [number, number][] = garde.map((i) => [ancresA[i], ancresB[i]]);
  ancres.push([a.n + 1, b.n + 1]);

  const paires: [number, number][] = []; const seulesA: number[] = []; const seulesB: number[] = [];
  let ra = 1, rb = 1;
  for (const [aa, ab] of ancres) {
    // Entre deux ancres : positionnel, le surplus est inséré / supprimé.
    while (ra < aa && rb < ab) { paires.push([ra, rb]); ra++; rb++; }
    while (ra < aa) { seulesA.push(ra); ra++; }
    while (rb < ab) { seulesB.push(rb); rb++; }
    if (aa <= a.n && ab <= b.n) { paires.push([aa, ab]); ra = aa + 1; rb = ab + 1; }
  }
  return { paires, seulesA, seulesB };
}

/**
 * COMPARE deux classeurs lus par `lireClasseur` — typiquement deux versions du même fichier.
 * Pur et synchrone ; cent mille lignes en moins d'une seconde (mesuré par `sheets-bench`).
 */
export function comparerClasseurs(avant: Classeur, apres: Classeur, opts: { maxDetails?: number } = {}): ComparaisonClasseurs {
  const debut = Date.now();
  const maxDetails = opts.maxDetails ?? 200;
  const parGenre: Partial<Record<GenreChangement, number>> = {};
  const parFeuille: ComparaisonClasseurs["parFeuille"] = [];
  const details: Changement[] = [];
  const limites: string[] = [];
  let lignesAlignees = 0;
  const arbres = new Map<string, Noeud | null>();
  const r1c1 = (c: Cellule): string | null => {
    if (!c.f) return null;
    let a = arbres.get(c.f);
    if (a === undefined) { a = analyser(c.f); arbres.set(c.f, a); }
    return a ? afficher(a, { row: c.row, col: c.col }) : null;
  };
  const noter = (ch: Changement) => {
    parGenre[ch.genre] = (parGenre[ch.genre] ?? 0) + 1;
    details.push(ch);
  };

  const parNomA = new Map(avant.feuilles.map((f) => [f.nom.toLowerCase(), f]));
  const parNomB = new Map(apres.feuilles.map((f) => [f.nom.toLowerCase(), f]));
  // De combien chaque feuille a grandi — pour reconnaître une plage qui a SUIVI une insertion.
  const deltaParFeuille = new Map<string, number>();
  for (const fb of apres.feuilles) { const fa = parNomA.get(fb.nom.toLowerCase()); if (fa) deltaParFeuille.set(fb.nom.toLowerCase(), fb.lignes - fa.lignes); }
  for (const f of avant.feuilles) if (!parNomB.has(f.nom.toLowerCase())) noter({ genre: "FEUILLE_SUPPRIMEE", feuille: f.nom, cellule: null, avant: `${f.cellules.size} cellule(s)`, apres: null });
  for (const f of apres.feuilles) if (!parNomA.has(f.nom.toLowerCase())) noter({ genre: "FEUILLE_AJOUTEE", feuille: f.nom, cellule: null, avant: null, apres: `${f.cellules.size} cellule(s)` });

  for (const fb of apres.feuilles) {
    const fa = parNomA.get(fb.nom.toLowerCase());
    if (!fa) continue;
    const A = indexer(fa, r1c1); const B = indexer(fb, r1c1);
    const { paires, seulesA, seulesB } = alignerLignes(A, B);
    lignesAlignees += paires.length;
    const compteur = { feuille: fb.nom, changements: 0, lignesInserees: seulesB.length, lignesSupprimees: seulesA.length };
    const apercu = (idx: FeuilleIndexee, row: number) => [...(idx.lignes.get(row)?.values() ?? [])].sort((x, y) => x.col - y.col).slice(0, 4).map((c) => texte(c) ?? "").join(" · ");
    for (const r of seulesA) { noter({ genre: "LIGNE_SUPPRIMEE", feuille: fb.nom, cellule: `${r}:${r}`, avant: apercu(A, r), apres: null }); compteur.changements++; }
    for (const r of seulesB) { noter({ genre: "LIGNE_INSEREE", feuille: fb.nom, cellule: `${r}:${r}`, avant: null, apres: apercu(B, r) }); compteur.changements++; }

    for (const [ra, rb] of paires) {
      const la = A.lignes.get(ra); const lb = B.lignes.get(rb);
      if (!la && !lb) continue;
      const cols = new Set<number>([...(la?.keys() ?? []), ...(lb?.keys() ?? [])]);
      for (const col of cols) {
        const ca = la?.get(col); const cb = lb?.get(col);
        const cellule = a1DeCoord(rb, col);
        const videA = !ca || (ca.v === null && !ca.f); const videB = !cb || (cb.v === null && !cb.f);
        if (videA && videB) continue;
        let genre: GenreChangement | null = null;
        if (videA) genre = "CELLULE_AJOUTEE";
        else if (videB) genre = "CELLULE_SUPPRIMEE";
        else if (ca!.f && cb!.f) {
          const ma = r1c1(ca!); const mb = r1c1(cb!);
          if ((ma ?? ca!.f) !== (mb ?? cb!.f)) {
            const aa = arbres.get(ca!.f); const ab = arbres.get(cb!.f);
            const deltaDe = (feuille: string | null) => deltaParFeuille.get((feuille ?? fb.nom).toLowerCase()) ?? 0;
            genre = aa && ab && memeForme(aa, { row: ca!.row, col: ca!.col }, ab, { row: cb!.row, col: cb!.col }, deltaDe) ? "PLAGE_AJUSTEE" : "FORMULE_MODIFIEE";
          } else if (!memeValeur(ca!.v, cb!.v)) genre = "RESULTAT_MODIFIE";
        } else if (ca!.f && !cb!.f) genre = "FORMULE_ECRASEE";
        else if (!ca!.f && cb!.f) genre = "VALEUR_DEVENUE_FORMULE";
        else if (!memeValeur(ca!.v, cb!.v)) genre = "VALEUR_MODIFIEE";
        if (!genre) continue;
        compteur.changements++;
        noter({
          genre, feuille: fb.nom, cellule,
          avant: genre === "RESULTAT_MODIFIE" ? String(ca!.v) : texte(ca),
          apres: genre === "RESULTAT_MODIFIE" ? String(cb!.v) : texte(cb),
        });
      }
    }
    if (compteur.changements > 0) parFeuille.push(compteur);
  }

  // Les noms définis.
  const nomsA = new Map(avant.noms.map((n) => [n.nom.toLowerCase(), n])); const nomsB = new Map(apres.noms.map((n) => [n.nom.toLowerCase(), n]));
  for (const [k, nb] of nomsB) { const na = nomsA.get(k); if (na && na.refersTo !== nb.refersTo) noter({ genre: "NOM_MODIFIE", feuille: "—", cellule: nb.nom, avant: na.refersTo, apres: nb.refersTo }); }

  details.sort((x, y) => (RANG.get(x.genre)! - RANG.get(y.genre)!) || x.feuille.localeCompare(y.feuille) || (x.cellule ?? "").localeCompare(y.cellule ?? "", undefined, { numeric: true }));
  const total = details.length;
  if (total > maxDetails) limites.push(`${total - maxDetails} changement(s) non détaillé(s) — les compteurs par genre restent exacts`);
  return {
    changements: details.slice(0, maxDetails), total, parGenre, parFeuille,
    resume: resumerComparaison(parGenre, parFeuille, total),
    limites, metriques: { ms: Date.now() - debut, lignesAlignees },
  };
}

function resumerComparaison(parGenre: Partial<Record<GenreChangement, number>>, parFeuille: ComparaisonClasseurs["parFeuille"], total: number): string {
  if (total === 0) return "Aucune différence : mêmes feuilles, mêmes valeurs, mêmes formules.";
  const morceaux = ORDRE.filter((g) => parGenre[g]).map((g) => `${parGenre[g]} ${LIBELLE_CHANGEMENT[g]}${parGenre[g]! > 1 ? "s" : ""}`);
  const feuilles = parFeuille.map((f) => f.feuille);
  return `${total} changement(s)${feuilles.length ? ` sur ${feuilles.join(", ")}` : ""} : ${morceaux.join(" ; ")}.`;
}
