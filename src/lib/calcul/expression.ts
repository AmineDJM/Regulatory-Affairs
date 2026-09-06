/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * UNE FORMULE SANS `eval` (mandat 5 §39) — pur.
 *
 * Le modèle écrit `marge = prix * volume - couts_fixes - couts_variables * volume` ; le code la
 * COMPILE (analyse syntaxique, précédence, fonctions connues) en une fermeture évaluée des dizaines
 * de milliers de fois. Rien n'est exécuté : une formule est une donnée, et une formule qu'on ne
 * comprend pas à coup sûr est REFUSÉE avec la position de l'erreur, jamais devinée.
 *
 *   nombres 12  3.5  1e6 · variables a  taux_tva  x1 · + - * / % ^ · ( ) · comparaisons < <= > >= == !=
 *   logique et/and/&& ou/or/|| non/not/! · fonctions : abs sqrt exp ln log log10 log2 min max somme
 *   moyenne round floor ceil pow si/if borner/clamp signe · constantes pi e
 *   Un booléen vaut 1 ou 0 ; `si(cond, a, b)` choisit.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

export type Evaluateur = (vars: Readonly<Record<string, number>>) => number;

export interface Compilee {
  ok: true;
  source: string;
  /** Les variables libres (hors constantes et fonctions), dans l'ordre d'apparition. */
  variables: string[];
  evaluer: Evaluateur;
}
export type ResultatCompilation = Compilee | { ok: false; source: string; erreur: string; position?: number };

type Jeton =
  | { type: "nombre"; valeur: number; pos: number }
  | { type: "ident"; nom: string; pos: number }
  | { type: "op"; op: string; pos: number }
  | { type: "("; pos: number }
  | { type: ")"; pos: number }
  | { type: ","; pos: number }
  | { type: "fin"; pos: number };

const CONSTANTES: Readonly<Record<string, number>> = { pi: Math.PI, e: Math.E, vrai: 1, faux: 0, true: 1, false: 0 };

const MOTS_LOGIQUES: Readonly<Record<string, string>> = { et: "&&", and: "&&", ou: "||", or: "||", non: "!", not: "!" };

type Fn = (args: number[]) => number;
const FONCTIONS: Readonly<Record<string, { arite: [number, number]; fn: Fn }>> = {
  abs: { arite: [1, 1], fn: ([x]) => Math.abs(x!) },
  sqrt: { arite: [1, 1], fn: ([x]) => Math.sqrt(x!) },
  racine: { arite: [1, 1], fn: ([x]) => Math.sqrt(x!) },
  exp: { arite: [1, 1], fn: ([x]) => Math.exp(x!) },
  ln: { arite: [1, 1], fn: ([x]) => Math.log(x!) },
  log: { arite: [1, 1], fn: ([x]) => Math.log(x!) },
  log10: { arite: [1, 1], fn: ([x]) => Math.log10(x!) },
  log2: { arite: [1, 1], fn: ([x]) => Math.log2(x!) },
  min: { arite: [1, Infinity], fn: (a) => Math.min(...a) },
  max: { arite: [1, Infinity], fn: (a) => Math.max(...a) },
  somme: { arite: [1, Infinity], fn: (a) => a.reduce((s, x) => s + x, 0) },
  sum: { arite: [1, Infinity], fn: (a) => a.reduce((s, x) => s + x, 0) },
  moyenne: { arite: [1, Infinity], fn: (a) => a.reduce((s, x) => s + x, 0) / a.length },
  avg: { arite: [1, Infinity], fn: (a) => a.reduce((s, x) => s + x, 0) / a.length },
  round: { arite: [1, 2], fn: ([x, d]) => { const f = 10 ** Math.trunc(d ?? 0); return Math.round(x! * f) / f; } },
  arrondi: { arite: [1, 2], fn: ([x, d]) => { const f = 10 ** Math.trunc(d ?? 0); return Math.round(x! * f) / f; } },
  floor: { arite: [1, 1], fn: ([x]) => Math.floor(x!) },
  ceil: { arite: [1, 1], fn: ([x]) => Math.ceil(x!) },
  pow: { arite: [2, 2], fn: ([a, b]) => a! ** b! },
  si: { arite: [3, 3], fn: ([c, a, b]) => (c ? a! : b!) },
  if: { arite: [3, 3], fn: ([c, a, b]) => (c ? a! : b!) },
  borner: { arite: [3, 3], fn: ([x, lo, hi]) => Math.min(hi!, Math.max(lo!, x!)) },
  clamp: { arite: [3, 3], fn: ([x, lo, hi]) => Math.min(hi!, Math.max(lo!, x!)) },
  signe: { arite: [1, 1], fn: ([x]) => Math.sign(x!) },
  sign: { arite: [1, 1], fn: ([x]) => Math.sign(x!) },
};

export const FONCTIONS_CONNUES: readonly string[] = Object.keys(FONCTIONS);

function lexer(src: string): Jeton[] | { erreur: string; position: number } {
  const jetons: Jeton[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i]!;
    if (/\s/.test(c)) { i += 1; continue; }
    if (/[0-9.]/.test(c)) {
      const m = /^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/i.exec(src.slice(i));
      if (!m || m[0] === ".") return { erreur: `Nombre mal formé à la position ${i + 1}`, position: i };
      jetons.push({ type: "nombre", valeur: Number(m[0]), pos: i });
      i += m[0].length;
      continue;
    }
    if (/[A-Za-z_À-ɏ]/.test(c)) {
      const m = /^[A-Za-z_À-ɏ][A-Za-z0-9_À-ɏ]*/.exec(src.slice(i))!;
      const brut = m[0];
      const logique = MOTS_LOGIQUES[brut.toLowerCase()];
      if (logique) jetons.push({ type: "op", op: logique, pos: i });
      else jetons.push({ type: "ident", nom: brut, pos: i });
      i += brut.length;
      continue;
    }
    const deux = src.slice(i, i + 2);
    if (["<=", ">=", "==", "!=", "&&", "||", "**"].includes(deux)) { jetons.push({ type: "op", op: deux === "**" ? "^" : deux, pos: i }); i += 2; continue; }
    if ("+-*/%^<>!".includes(c)) { jetons.push({ type: "op", op: c, pos: i }); i += 1; continue; }
    if (c === "=") { jetons.push({ type: "op", op: "==", pos: i }); i += 1; continue; }
    if (c === "(") { jetons.push({ type: "(", pos: i }); i += 1; continue; }
    if (c === ")") { jetons.push({ type: ")", pos: i }); i += 1; continue; }
    if (c === "," || c === ";") { jetons.push({ type: ",", pos: i }); i += 1; continue; }
    return { erreur: `Caractère inattendu « ${c} » à la position ${i + 1}`, position: i };
  }
  jetons.push({ type: "fin", pos: src.length });
  return jetons;
}

type Noeud = (v: Readonly<Record<string, number>>) => number;

class Analyseur {
  private i = 0;
  readonly variables: string[] = [];
  constructor(private readonly jetons: Jeton[], private readonly src: string) {}

  private courant(): Jeton { return this.jetons[this.i]!; }
  private avancer(): Jeton { const j = this.jetons[this.i]!; this.i += 1; return j; }
  private erreur(msg: string, pos: number): never { throw Object.assign(new Error(msg), { position: pos }); }
  private estOp(op: string): boolean { const j = this.courant(); return j.type === "op" && j.op === op; }

  analyser(): Noeud {
    const n = this.ou();
    if (this.courant().type !== "fin") this.erreur(`Symbole inattendu à la position ${this.courant().pos + 1} : « ${this.src.slice(this.courant().pos, this.courant().pos + 8)} »`, this.courant().pos);
    return n;
  }

  private ou(): Noeud {
    let g = this.et();
    while (this.estOp("||")) { this.avancer(); const d = this.et(); const gg = g; g = (v) => (gg(v) || d(v) ? 1 : 0); }
    return g;
  }
  private et(): Noeud {
    let g = this.comparaison();
    while (this.estOp("&&")) { this.avancer(); const d = this.comparaison(); const gg = g; g = (v) => (gg(v) && d(v) ? 1 : 0); }
    return g;
  }
  private comparaison(): Noeud {
    let g = this.additif();
    for (;;) {
      const j = this.courant();
      if (j.type !== "op" || !["<", "<=", ">", ">=", "==", "!="].includes(j.op)) return g;
      this.avancer();
      const d = this.additif();
      const gg = g;
      switch (j.op) {
        case "<": g = (v) => (gg(v) < d(v) ? 1 : 0); break;
        case "<=": g = (v) => (gg(v) <= d(v) ? 1 : 0); break;
        case ">": g = (v) => (gg(v) > d(v) ? 1 : 0); break;
        case ">=": g = (v) => (gg(v) >= d(v) ? 1 : 0); break;
        case "==": g = (v) => (Math.abs(gg(v) - d(v)) < 1e-12 ? 1 : 0); break;
        default: g = (v) => (Math.abs(gg(v) - d(v)) < 1e-12 ? 0 : 1);
      }
    }
  }
  private additif(): Noeud {
    let g = this.multiplicatif();
    for (;;) {
      if (this.estOp("+")) { this.avancer(); const d = this.multiplicatif(); const gg = g; g = (v) => gg(v) + d(v); }
      else if (this.estOp("-")) { this.avancer(); const d = this.multiplicatif(); const gg = g; g = (v) => gg(v) - d(v); }
      else return g;
    }
  }
  private multiplicatif(): Noeud {
    let g = this.unaire();
    for (;;) {
      if (this.estOp("*")) { this.avancer(); const d = this.unaire(); const gg = g; g = (v) => gg(v) * d(v); }
      else if (this.estOp("/")) { this.avancer(); const d = this.unaire(); const gg = g; g = (v) => gg(v) / d(v); }
      else if (this.estOp("%")) { this.avancer(); const d = this.unaire(); const gg = g; g = (v) => gg(v) % d(v); }
      else return g;
    }
  }
  private unaire(): Noeud {
    if (this.estOp("-")) { this.avancer(); const d = this.unaire(); return (v) => -d(v); }
    if (this.estOp("+")) { this.avancer(); return this.unaire(); }
    if (this.estOp("!")) { this.avancer(); const d = this.unaire(); return (v) => (d(v) ? 0 : 1); }
    return this.puissance();
  }
  private puissance(): Noeud {
    const base = this.primaire();
    if (this.estOp("^")) { this.avancer(); const exp = this.unaire(); return (v) => base(v) ** exp(v); }
    return base;
  }
  private primaire(): Noeud {
    const j = this.avancer();
    if (j.type === "nombre") { const x = j.valeur; return () => x; }
    if (j.type === "(") {
      const n = this.ou();
      if (this.courant().type !== ")") this.erreur(`Parenthèse fermante attendue à la position ${this.courant().pos + 1}`, this.courant().pos);
      this.avancer();
      return n;
    }
    if (j.type === "ident") {
      if (this.courant().type === "(") {
        this.avancer();
        const def = FONCTIONS[j.nom.toLowerCase()];
        if (!def) this.erreur(`Fonction inconnue « ${j.nom} » (connues : ${FONCTIONS_CONNUES.join(", ")})`, j.pos);
        const args: Noeud[] = [];
        if (this.courant().type !== ")") {
          for (;;) {
            args.push(this.ou());
            if (this.courant().type === ",") { this.avancer(); continue; }
            break;
          }
        }
        if (this.courant().type !== ")") this.erreur(`Parenthèse fermante attendue après les arguments de ${j.nom}`, this.courant().pos);
        this.avancer();
        if (args.length < def.arite[0] || args.length > def.arite[1]) {
          this.erreur(`${j.nom} attend ${def.arite[0] === def.arite[1] ? def.arite[0] : `${def.arite[0]} à ${def.arite[1] === Infinity ? "n" : def.arite[1]}`} argument(s), ${args.length} donné(s)`, j.pos);
        }
        const fn = def.fn;
        if (args.length === 1) { const a = args[0]!; return (v) => fn([a(v)]); }
        if (args.length === 2) { const a = args[0]!, b = args[1]!; return (v) => fn([a(v), b(v)]); }
        if (args.length === 3) { const a = args[0]!, b = args[1]!, c = args[2]!; return (v) => fn([a(v), b(v), c(v)]); }
        return (v) => fn(args.map((a) => a(v)));
      }
      const cst = CONSTANTES[j.nom.toLowerCase()];
      if (cst !== undefined && !this.variables.includes(j.nom)) { return () => cst; }
      const nom = j.nom;
      if (!this.variables.includes(nom)) this.variables.push(nom);
      return (v) => { const x = v[nom]; return x === undefined ? NaN : x; };
    }
    if (j.type === "fin") this.erreur("Formule incomplète : une valeur est attendue à la fin", j.pos);
    this.erreur(`Symbole inattendu à la position ${j.pos + 1}`, j.pos);
  }
}

/** Compile une formule ; `null` sur une chaîne vide. Ne devine jamais : toute ambiguïté est une erreur positionnée. */
export function compiler(source: string): ResultatCompilation {
  const src = String(source ?? "").trim();
  if (!src) return { ok: false, source: src, erreur: "Formule vide" };
  if (src.length > 5_000) return { ok: false, source: src, erreur: "Formule trop longue (5 000 caractères au plus)" };
  const jetons = lexer(src);
  if (!Array.isArray(jetons)) return { ok: false, source: src, erreur: jetons.erreur, position: jetons.position };
  try {
    const a = new Analyseur(jetons, src);
    const noeud = a.analyser();
    return { ok: true, source: src, variables: a.variables, evaluer: noeud };
  } catch (e) {
    const err = e as Error & { position?: number };
    return { ok: false, source: src, erreur: err.message, position: err.position };
  }
}

/** Évalue une formule une fois (pratique pour un test ou une vérification) ; `NaN` si la formule ne compile pas. */
export function evaluer(source: string, vars: Readonly<Record<string, number>> = {}): number {
  const c = compiler(source);
  return c.ok ? c.evaluer(vars) : NaN;
}

/**
 * Ordonne des formules nommées par dépendances (une formule peut utiliser le résultat d'une autre).
 * Refuse un cycle et une variable qui n'est ni une entrée, ni une constante, ni une formule.
 */
export function compilerSysteme(
  formules: Readonly<Record<string, string>>,
  connues: readonly string[],
): { ok: true; ordre: { nom: string; compilee: Compilee }[]; inconnues: string[] } | { ok: false; erreur: string } {
  const noms = Object.keys(formules);
  const compilees = new Map<string, Compilee>();
  for (const nom of noms) {
    const c = compiler(formules[nom]!);
    if (!c.ok) return { ok: false, erreur: `Formule « ${nom} » : ${c.erreur}` };
    compilees.set(nom, c);
  }
  const inconnues = new Set<string>();
  for (const [nom, c] of compilees) for (const v of c.variables) if (!connues.includes(v) && !compilees.has(v)) inconnues.add(`${v} (dans ${nom})`);
  if (inconnues.size) return { ok: false, erreur: `Variable(s) inconnue(s) : ${[...inconnues].join(", ")} — déclarer une entrée, une constante ou une formule de ce nom.` };
  // Tri topologique (Kahn) sur les dépendances entre formules.
  const deps = new Map<string, Set<string>>(noms.map((n) => [n, new Set(compilees.get(n)!.variables.filter((v) => compilees.has(v) && v !== n))]));
  for (const n of noms) if (compilees.get(n)!.variables.includes(n)) return { ok: false, erreur: `La formule « ${n} » se référence elle-même.` };
  const ordre: { nom: string; compilee: Compilee }[] = [];
  const restants = new Set(noms);
  while (restants.size) {
    const prets = [...restants].filter((n) => [...deps.get(n)!].every((d) => !restants.has(d)));
    if (!prets.length) return { ok: false, erreur: `Cycle entre formules : ${[...restants].join(" → ")}` };
    for (const n of prets) { ordre.push({ nom: n, compilee: compilees.get(n)! }); restants.delete(n); }
  }
  return { ok: true, ordre, inconnues: [] };
}
