import { colonneDepuisLettres, COLONNES_MAX, lettresDeColonne, LIGNES_MAX } from "@/lib/artifact/sheets/refs";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * L'ANALYSEUR DE FORMULES EXCEL — jetons, arbre, références, forme R1C1.
 *
 * ── POURQUOI UN ANALYSEUR ET PAS UNE EXPRESSION RÉGULIÈRE ────────────────────────────────
 *
 * `adapters/xlsx/adapter.ts` décale des références A1 avec une expression régulière, et le dit
 * lui-même : pas de feuille croisée, pas d'INDIRECT. Un graphe de dépendances, un audit de
 * cohérence ou un recalcul ne peuvent pas vivre sur une approximation : « B5*1.19 » et
 * « 'Taux'!B5*C2 » doivent être LUS, pas devinés. L'analyseur rend un arbre ; tout le reste
 * (références, R1C1, décalage, évaluation) parcourt l'arbre.
 *
 * ── CE QU'IL LIT ─────────────────────────────────────────────────────────────────────────
 *
 * Nombres, textes, booléens, erreurs (#DIV/0!…), références (A1, $A$1, A1:B2, A:A, 3:3,
 * Feuil1!A1, 'Ma feuille'!A1:B2, [1]Externe!A1), noms définis, fonctions, opérateurs Excel
 * avec leurs priorités (le moins unaire lie plus fort que ^ : -2^2 = 4), le pourcentage postfixé,
 * les constantes de tableau {1,2;3,4}, les séparateurs « , » ET « ; » (Excel français).
 *
 * Ce qu'il ne lit PAS, et rend `null` (doctrine du décodeur : ne jamais deviner) : l'opérateur
 * d'intersection (l'espace), les références structurées de tableau (Tableau1[Colonne]), les
 * plages construites (INDEX(...):A1).
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

export interface Ref {
  feuille: string | null;
  externe: boolean;
  r1: number; c1: number; r2: number; c2: number;
  absR1: boolean; absC1: boolean; absR2: boolean; absC2: boolean;
  type: "cell" | "range" | "col" | "row";
}

export type Noeud =
  | { k: "num"; v: number }
  | { k: "str"; v: string }
  | { k: "bool"; v: boolean }
  | { k: "err"; v: string }
  | { k: "ref"; ref: Ref }
  | { k: "name"; nom: string }
  | { k: "call"; fn: string; args: Noeud[] }
  | { k: "bin"; op: string; g: Noeud; d: Noeud }
  | { k: "un"; op: string; a: Noeud }
  | { k: "pct"; a: Noeud }
  | { k: "array"; lignes: Noeud[][] };

type Jeton =
  | { t: "num"; v: number } | { t: "str"; v: string } | { t: "bool"; v: boolean } | { t: "err"; v: string }
  | { t: "ref"; v: Ref } | { t: "name"; v: string } | { t: "func"; v: string }
  | { t: "op"; v: string } | { t: "lpar" } | { t: "rpar" } | { t: "sep" } | { t: "lbrace" } | { t: "rbrace" } | { t: "rowsep" };

export const ERREURS_EXCEL = ["#DIV/0!", "#N/A", "#VALUE!", "#REF!", "#NAME?", "#NUM!", "#NULL!", "#SPILL!", "#CALC!"] as const;

const RE_A1 = /^(\$?)([A-Za-z]{1,3})(\$?)(\d+)/;
const RE_COLS = /^(\$?)([A-Za-z]{1,3}):(\$?)([A-Za-z]{1,3})(?![A-Za-z0-9_(])/;
const RE_ROWS = /^(\$?)(\d+):(\$?)(\d+)(?![\d.A-Za-z_])/;
const RE_NUM = /^(\d+\.?\d*(?:[eE][+-]?\d+)?|\.\d+(?:[eE][+-]?\d+)?)/;
const RE_IDENT = /^[A-Za-z_À-ɏ][A-Za-z0-9_.À-ɏ]*/;

function lireRefA1(texte: string, feuille: string | null, externe: boolean): { ref: Ref; longueur: number } | null {
  const cols = RE_COLS.exec(texte);
  if (cols) {
    const c1 = colonneDepuisLettres(cols[2]); const c2 = colonneDepuisLettres(cols[4]);
    if (c1 <= COLONNES_MAX && c2 <= COLONNES_MAX) {
      return { longueur: cols[0].length, ref: { feuille, externe, r1: 1, r2: LIGNES_MAX, c1: Math.min(c1, c2), c2: Math.max(c1, c2), absR1: true, absR2: true, absC1: cols[1] === "$", absC2: cols[3] === "$", type: "col" } };
    }
  }
  const rows = RE_ROWS.exec(texte);
  if (rows) {
    const r1 = Number(rows[2]); const r2 = Number(rows[4]);
    if (r1 >= 1 && r2 >= 1 && r1 <= LIGNES_MAX && r2 <= LIGNES_MAX) {
      return { longueur: rows[0].length, ref: { feuille, externe, r1: Math.min(r1, r2), r2: Math.max(r1, r2), c1: 1, c2: COLONNES_MAX, absR1: rows[1] === "$", absR2: rows[3] === "$", absC1: true, absC2: true, type: "row" } };
    }
  }
  const a = RE_A1.exec(texte);
  if (!a) return null;
  const c1 = colonneDepuisLettres(a[2]); const r1 = Number(a[4]);
  if (c1 > COLONNES_MAX || r1 < 1 || r1 > LIGNES_MAX) return null;
  let longueur = a[0].length;
  let ref: Ref = { feuille, externe, r1, c1, r2: r1, c2: c1, absC1: a[1] === "$", absR1: a[3] === "$", absC2: a[1] === "$", absR2: a[3] === "$", type: "cell" };
  const reste = texte.slice(longueur);
  if (reste.startsWith(":")) {
    const b = RE_A1.exec(reste.slice(1));
    if (b) {
      const c2 = colonneDepuisLettres(b[2]); const r2 = Number(b[4]);
      if (c2 <= COLONNES_MAX && r2 >= 1 && r2 <= LIGNES_MAX) {
        longueur += 1 + b[0].length;
        const hautGauche = r1 <= r2 && c1 <= c2;
        ref = {
          feuille, externe,
          r1: Math.min(r1, r2), c1: Math.min(c1, c2), r2: Math.max(r1, r2), c2: Math.max(c1, c2),
          absC1: hautGauche ? a[1] === "$" : b[1] === "$", absR1: hautGauche ? a[3] === "$" : b[3] === "$",
          absC2: hautGauche ? b[1] === "$" : a[1] === "$", absR2: hautGauche ? b[3] === "$" : a[3] === "$",
          type: "range",
        };
      }
    }
  }
  // Un identifiant qui CONTINUE (A1B, AB12x) n'est pas une référence mais un nom.
  const suite = texte.charAt(longueur);
  if (/[A-Za-z0-9_.]/.test(suite)) return null;
  return { ref, longueur };
}

/** Découpe une formule (sans le « = ») en jetons. `null` si un caractère n'est pas reconnu. */
export function tokeniser(formule: string): Jeton[] | null {
  const s = formule.startsWith("=") ? formule.slice(1) : formule;
  const out: Jeton[] = [];
  let i = 0;
  let profondeurAccolade = 0;
  while (i < s.length) {
    const ch = s[i];
    if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") { i++; continue; }
    if (ch === "\"") {
      let j = i + 1; let v = "";
      while (j < s.length) {
        if (s[j] === "\"") { if (s[j + 1] === "\"") { v += "\""; j += 2; continue; } break; }
        v += s[j]; j++;
      }
      if (j >= s.length) return null;
      out.push({ t: "str", v }); i = j + 1; continue;
    }
    if (ch === "#") {
      const err = ERREURS_EXCEL.find((e) => s.startsWith(e, i));
      if (!err) return null;
      out.push({ t: "err", v: err }); i += err.length; continue;
    }
    if (ch === "(") { out.push({ t: "lpar" }); i++; continue; }
    if (ch === ")") { out.push({ t: "rpar" }); i++; continue; }
    if (ch === "{") { out.push({ t: "lbrace" }); profondeurAccolade++; i++; continue; }
    if (ch === "}") { out.push({ t: "rbrace" }); profondeurAccolade--; i++; continue; }
    if (ch === ",") { out.push({ t: "sep" }); i++; continue; }
    if (ch === ";") { out.push(profondeurAccolade > 0 ? { t: "rowsep" } : { t: "sep" }); i++; continue; }
    if (ch === "<" && s[i + 1] === ">") { out.push({ t: "op", v: "<>" }); i += 2; continue; }
    if ((ch === "<" || ch === ">") && s[i + 1] === "=") { out.push({ t: "op", v: ch + "=" }); i += 2; continue; }
    if ("+-*/^&=<>%".includes(ch)) { out.push({ t: "op", v: ch }); i++; continue; }
    // ── Feuille externe [1]Feuil!A1 ──
    let externe = false; let feuille: string | null = null; let j = i;
    if (s[j] === "[") {
      const fin = s.indexOf("]", j);
      if (fin < 0) return null;
      externe = true; j = fin + 1;
    }
    if (s[j] === "'") {
      let k = j + 1; let nom = "";
      while (k < s.length) { if (s[k] === "'") { if (s[k + 1] === "'") { nom += "'"; k += 2; continue; } break; } nom += s[k]; k++; }
      if (s[k] !== "'" || s[k + 1] !== "!") return null;
      feuille = nom; j = k + 2;
    } else {
      const ident = RE_IDENT.exec(s.slice(j));
      if (ident && s[j + ident[0].length] === "!") { feuille = ident[0]; j += ident[0].length + 1; }
    }
    if (feuille !== null || externe) {
      const r = lireRefA1(s.slice(j), feuille, externe);
      if (r) { out.push({ t: "ref", v: r.ref }); i = j + r.longueur; continue; }
      // Un nom défini local à une feuille : Feuil1!MonNom.
      const ident = RE_IDENT.exec(s.slice(j));
      if (feuille !== null && ident) { out.push({ t: "name", v: `${feuille}!${ident[0]}` }); i = j + ident[0].length; continue; }
      return null;
    }
    const num = RE_NUM.exec(s.slice(i));
    if (num && !/^\d+:\d+/.test(s.slice(i))) {
      // Un nombre suivi d'une lettre (3A) n'est pas un nombre : laisser la référence/le nom décider.
      const apres = s.charAt(i + num[0].length);
      if (!/[A-Za-z_]/.test(apres)) { out.push({ t: "num", v: Number(num[0]) }); i += num[0].length; continue; }
    }
    const ref = lireRefA1(s.slice(i), null, false);
    if (ref) { out.push({ t: "ref", v: ref.ref }); i += ref.longueur; continue; }
    const ident = RE_IDENT.exec(s.slice(i));
    if (ident) {
      const mot = ident[0];
      const suivant = s.charAt(i + mot.length);
      if (suivant === "(") { out.push({ t: "func", v: mot.toUpperCase() }); i += mot.length + 1; continue; }
      const maj = mot.toUpperCase();
      if (maj === "TRUE" || maj === "FALSE") { out.push({ t: "bool", v: maj === "TRUE" }); i += mot.length; continue; }
      out.push({ t: "name", v: mot }); i += mot.length; continue;
    }
    return null;
  }
  return out;
}

class Analyseur {
  private i = 0;
  constructor(private readonly jetons: Jeton[]) {}

  private voir(): Jeton | undefined { return this.jetons[this.i]; }
  private prendre(): Jeton | undefined { return this.jetons[this.i++]; }

  expression(minBp = 0): Noeud {
    let gauche = this.prefixe();
    for (;;) {
      const j = this.voir();
      if (!j || j.t !== "op") break;
      if (j.v === "%") { this.prendre(); gauche = { k: "pct", a: gauche }; continue; }
      const bp = BP[j.v];
      if (bp === undefined || bp < minBp) break;
      this.prendre();
      // Excel : ^ est associatif à GAUCHE (2^3^2 = 64), comme tous les autres.
      const droite = this.expression(bp + 1);
      gauche = { k: "bin", op: j.v, g: gauche, d: droite };
    }
    return gauche;
  }

  private prefixe(): Noeud {
    const j = this.prendre();
    if (!j) throw new Error("formule tronquée");
    switch (j.t) {
      case "num": return { k: "num", v: j.v };
      case "str": return { k: "str", v: j.v };
      case "bool": return { k: "bool", v: j.v };
      case "err": return { k: "err", v: j.v };
      case "ref": return { k: "ref", ref: j.v };
      case "name": return { k: "name", nom: j.v };
      case "func": return this.appel(j.v);
      case "lpar": {
        const e = this.expression(0);
        const f = this.prendre();
        if (!f || f.t !== "rpar") throw new Error("parenthèse fermante attendue");
        return e;
      }
      case "lbrace": return this.tableau();
      case "op":
        if (j.v === "-" || j.v === "+") {
          // Le moins unaire lie plus fort que ^ : -2^2 vaut 4 dans Excel.
          const a = this.expression(BP_UNAIRE);
          return j.v === "-" ? { k: "un", op: "-", a } : a;
        }
        throw new Error(`opérateur inattendu « ${j.v} »`);
      default:
        throw new Error("jeton inattendu");
    }
  }

  private appel(fn: string): Noeud {
    const args: Noeud[] = [];
    if (this.voir()?.t === "rpar") { this.prendre(); return { k: "call", fn, args }; }
    for (;;) {
      // Un argument vide (IF(A1,,B1)) est permis : il vaut « omis ».
      if (this.voir()?.t === "sep") { args.push({ k: "name", nom: "" }); this.prendre(); continue; }
      args.push(this.expression(0));
      const j = this.prendre();
      if (!j) throw new Error("parenthèse fermante attendue");
      if (j.t === "rpar") break;
      if (j.t !== "sep") throw new Error("séparateur attendu");
      if (this.voir()?.t === "rpar") { args.push({ k: "name", nom: "" }); this.prendre(); break; }
    }
    return { k: "call", fn, args };
  }

  private tableau(): Noeud {
    const lignes: Noeud[][] = [[]];
    for (;;) {
      const j = this.voir();
      if (!j) throw new Error("accolade fermante attendue");
      if (j.t === "rbrace") { this.prendre(); break; }
      if (j.t === "sep") { this.prendre(); continue; }
      if (j.t === "rowsep") { this.prendre(); lignes.push([]); continue; }
      lignes[lignes.length - 1].push(this.expression(0));
    }
    return { k: "array", lignes };
  }

  fini(): boolean { return this.i >= this.jetons.length; }
}

const BP: Record<string, number> = { "=": 1, "<": 1, ">": 1, "<=": 1, ">=": 1, "<>": 1, "&": 2, "+": 3, "-": 3, "*": 4, "/": 4, "^": 5 };
const BP_UNAIRE = 6;

/** Analyse une formule. `null` quand elle n'est pas lue À COUP SÛR — jamais un arbre approximatif. */
export function analyser(formule: string): Noeud | null {
  const jetons = tokeniser(formule);
  if (!jetons || jetons.length === 0) return null;
  try {
    const a = new Analyseur(jetons);
    const n = a.expression(0);
    return a.fini() ? n : null;
  } catch {
    return null;
  }
}

/** Toutes les références d'un arbre, dans l'ordre de lecture. */
export function referencesDe(n: Noeud, out: Ref[] = []): Ref[] {
  switch (n.k) {
    case "ref": out.push(n.ref); break;
    case "call": for (const a of n.args) referencesDe(a, out); break;
    case "bin": referencesDe(n.g, out); referencesDe(n.d, out); break;
    case "un": case "pct": referencesDe(n.a, out); break;
    case "array": for (const l of n.lignes) for (const x of l) referencesDe(x, out); break;
    default: break;
  }
  return out;
}

/** Les fonctions appelées, en majuscules, sans doublon. */
export function fonctionsDe(n: Noeud, out = new Set<string>()): Set<string> {
  switch (n.k) {
    case "call": out.add(n.fn); for (const a of n.args) fonctionsDe(a, out); break;
    case "bin": fonctionsDe(n.g, out); fonctionsDe(n.d, out); break;
    case "un": case "pct": fonctionsDe(n.a, out); break;
    case "array": for (const l of n.lignes) for (const x of l) fonctionsDe(x, out); break;
    default: break;
  }
  return out;
}

/** Les noms définis utilisés (hors arguments omis). */
export function nomsDe(n: Noeud, out = new Set<string>()): Set<string> {
  switch (n.k) {
    case "name": if (n.nom) out.add(n.nom); break;
    case "call": for (const a of n.args) nomsDe(a, out); break;
    case "bin": nomsDe(n.g, out); nomsDe(n.d, out); break;
    case "un": case "pct": nomsDe(n.a, out); break;
    case "array": for (const l of n.lignes) for (const x of l) nomsDe(x, out); break;
    default: break;
  }
  return out;
}

function citerFeuille(nom: string): string {
  return /^[A-Za-z_À-ɏ][A-Za-z0-9_.À-ɏ]*$/.test(nom) ? nom : `'${nom.replace(/'/g, "''")}'`;
}

function afficherRef(r: Ref, origine?: { row: number; col: number }): string {
  const prefixe = r.feuille !== null ? `${r.externe ? "[ext]" : ""}${citerFeuille(r.feuille)}!` : (r.externe ? "[ext]!" : "");
  if (!origine) {
    const cell = (row: number, col: number, absR: boolean, absC: boolean) => `${absC ? "$" : ""}${lettresDeColonne(col)}${absR ? "$" : ""}${row}`;
    if (r.type === "col") return `${prefixe}${r.absC1 ? "$" : ""}${lettresDeColonne(r.c1)}:${r.absC2 ? "$" : ""}${lettresDeColonne(r.c2)}`;
    if (r.type === "row") return `${prefixe}${r.absR1 ? "$" : ""}${r.r1}:${r.absR2 ? "$" : ""}${r.r2}`;
    if (r.type === "cell") return prefixe + cell(r.r1, r.c1, r.absR1, r.absC1);
    return `${prefixe}${cell(r.r1, r.c1, r.absR1, r.absC1)}:${cell(r.r2, r.c2, r.absR2, r.absC2)}`;
  }
  // ── R1C1 : les parts relatives deviennent des décalages depuis l'origine ──
  const R = (row: number, abs: boolean) => (abs ? `R${row}` : row === origine.row ? "R" : `R[${row - origine.row}]`);
  const C = (col: number, abs: boolean) => (abs ? `C${col}` : col === origine.col ? "C" : `C[${col - origine.col}]`);
  if (r.type === "col") return `${prefixe}${C(r.c1, r.absC1)}:${C(r.c2, r.absC2)}`;
  if (r.type === "row") return `${prefixe}${R(r.r1, r.absR1)}:${R(r.r2, r.absR2)}`;
  if (r.type === "cell") return `${prefixe}${R(r.r1, r.absR1)}${C(r.c1, r.absC1)}`;
  return `${prefixe}${R(r.r1, r.absR1)}${C(r.c1, r.absC1)}:${R(r.r2, r.absR2)}${C(r.c2, r.absC2)}`;
}

/**
 * RÉÉCRIT un arbre en texte. Avec `origine`, en forme R1C1 : deux formules « du même motif »
 * (=B2*C2 en D2 et =B3*C3 en D3) donnent le MÊME texte — c'est ce qui rend l'audit de cohérence
 * et la comparaison sémantique possibles sans deviner.
 */
export function afficher(n: Noeud, origine?: { row: number; col: number }): string {
  switch (n.k) {
    case "num": return Number.isInteger(n.v) ? String(n.v) : String(n.v);
    case "str": return `"${n.v.replace(/"/g, "\"\"")}"`;
    case "bool": return n.v ? "TRUE" : "FALSE";
    case "err": return n.v;
    case "ref": return afficherRef(n.ref, origine);
    case "name": return n.nom;
    case "call": return `${n.fn}(${n.args.map((a) => afficher(a, origine)).join(",")})`;
    case "bin": return `${afficher(n.g, origine)}${n.op}${afficher(n.d, origine)}`;
    case "un": return `-${afficher(n.a, origine)}`;
    case "pct": return `${afficher(n.a, origine)}%`;
    case "array": return `{${n.lignes.map((l) => l.map((x) => afficher(x, origine)).join(",")).join(";")}}`;
  }
}

/** La forme R1C1 canonique d'une formule vue depuis sa cellule — `null` si la formule n'est pas lue. */
export function formeR1C1(formule: string, origine: { row: number; col: number }): string | null {
  const n = analyser(formule);
  return n ? afficher(n, origine) : null;
}

/**
 * DÉCALE les références RELATIVES d'un arbre (formule partagée traduite, ligne insérée). Une
 * référence absolue ne bouge pas ; une référence qui sortirait de la feuille devient #REF!.
 */
export function decaler(n: Noeud, dRow: number, dCol: number): Noeud {
  const bouge = (r: Ref): Noeud => {
    const r1 = r.absR1 ? r.r1 : r.r1 + dRow; const r2 = r.absR2 ? r.r2 : r.r2 + dRow;
    const c1 = r.absC1 ? r.c1 : r.c1 + dCol; const c2 = r.absC2 ? r.c2 : r.c2 + dCol;
    if (r1 < 1 || c1 < 1 || r2 > LIGNES_MAX || c2 > COLONNES_MAX) return { k: "err", v: "#REF!" };
    return { k: "ref", ref: { ...r, r1, r2, c1, c2 } };
  };
  switch (n.k) {
    case "ref": return bouge(n.ref);
    case "call": return { ...n, args: n.args.map((a) => decaler(a, dRow, dCol)) };
    case "bin": return { ...n, g: decaler(n.g, dRow, dCol), d: decaler(n.d, dRow, dCol) };
    case "un": return { ...n, a: decaler(n.a, dRow, dCol) };
    case "pct": return { ...n, a: decaler(n.a, dRow, dCol) };
    case "array": return { ...n, lignes: n.lignes.map((l) => l.map((x) => decaler(x, dRow, dCol))) };
    default: return n;
  }
}

/** Traduit une formule PARTAGÉE écrite en `maitre` pour la cellule `cible`. */
export function traduireFormulePartagee(formule: string, maitre: { row: number; col: number }, cible: { row: number; col: number }): string | null {
  const n = analyser(formule);
  if (!n) return null;
  return afficher(decaler(n, cible.row - maitre.row, cible.col - maitre.col));
}

/** Les fonctions dont la valeur change sans qu'aucune entrée ne change — l'audit les nomme. */
export const FONCTIONS_VOLATILES: ReadonlySet<string> = new Set(["NOW", "TODAY", "RAND", "RANDBETWEEN", "OFFSET", "INDIRECT", "CELL", "INFO"]);
