import { lireClasseur, type OptionsLecture } from "@/lib/artifact/sheets/reader";
import { construireGraphe, dependantsDirects, precedentsDirects, rayonImpact, celluleDeId, idDe, type Graphe, type IdCellule } from "@/lib/artifact/sheets/graph";
import { recalculer, ErreurExcel, type Recalcul, type Scalaire } from "@/lib/artifact/sheets/evaluate";
import { auditerClasseur, resumerAudit, type Audit } from "@/lib/artifact/sheets/audit";
import { comparerClasseurs, type ComparaisonClasseurs } from "@/lib/artifact/sheets/diff";
import { a1DeCoord, a1DePlage, coordDeA1, plageDeA1, cleDe } from "@/lib/artifact/sheets/refs";
import type { Classeur, Feuille } from "@/lib/artifact/sheets/model";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LA FAÇADE EXCEL — ce qu'Adam appelle. Trois questions qu'on pose à un classeur :
 *
 *   « Vérifie ce fichier »            → `analyserClasseur`   (lecture, graphe, recalcul, audit)
 *   « D'où vient ce chiffre ? »       → `tracerCellule`      (précédents, dépendants, rayon)
 *   « Qu'est-ce qui a changé ? »      → `comparerFichiersXlsx` (deux versions, alignées)
 *
 * Tout est PUR : des octets entrent, une structure sort. Ni Drive, ni droits, ni Prisma — le
 * pont (`in-process/artifact/sheets.ts`) s'en charge, et c'est ce qui permet de tester chaque
 * question sur un classeur fabriqué en mémoire.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

export interface StructureFeuille {
  nom: string; lignes: number; colonnes: number; cellules: number; formules: number; masquee: boolean;
  /** Les en-têtes de la première ligne, quand ce sont des textes — ce qui permet de parler des colonnes. */
  entetes: string[];
}

export interface Analyse {
  classeur: Classeur;
  graphe: Graphe;
  recalcul: Recalcul;
  audit: Audit;
  structure: { feuilles: StructureFeuille[]; noms: { nom: string; refersTo: string }[]; cellules: number; formules: number; limites: string[] };
  metriques: { lectureMs: number; grapheMs: number; recalculMs: number; auditMs: number; totalMs: number };
}

export function structureDe(classeur: Classeur, graphe: Graphe): Analyse["structure"] {
  const feuilles: StructureFeuille[] = classeur.feuilles.map((f) => {
    let formules = 0;
    const entetes: string[] = [];
    for (const c of f.cellules.values()) {
      if (c.f) formules += 1;
      if (c.row === 1 && c.t === "s" && typeof c.v === "string" && entetes.length < 30) entetes[c.col - 1] = c.v;
    }
    return { nom: f.nom, lignes: f.lignes, colonnes: f.colonnes, cellules: f.cellules.size, formules, masquee: Boolean(f.masquee), entetes: entetes.map((e) => e ?? "") };
  });
  return {
    feuilles, noms: classeur.noms.map((n) => ({ nom: n.nom, refersTo: n.refersTo })),
    cellules: feuilles.reduce((s, f) => s + f.cellules, 0), formules: graphe.noeuds.size, limites: classeur.limites,
  };
}

/** LIT, RELIE, RECALCULE et AUDITE un classeur. La réponse à « vérifie ce fichier ». */
export async function analyserClasseur(octets: Buffer | Uint8Array, opts: OptionsLecture & { maintenant?: Date; maxParCode?: number } = {}): Promise<Analyse> {
  const t0 = Date.now();
  const classeur = await lireClasseur(octets, opts);
  const t1 = Date.now();
  const graphe = construireGraphe(classeur);
  const t2 = Date.now();
  const recalcul = recalculer(classeur, graphe, { maintenant: opts.maintenant });
  const t3 = Date.now();
  const audit = auditerClasseur(classeur, graphe, recalcul, { maxParCode: opts.maxParCode });
  const t4 = Date.now();
  return {
    classeur, graphe, recalcul, audit, structure: structureDe(classeur, graphe),
    metriques: { lectureMs: t1 - t0, grapheMs: t2 - t1, recalculMs: t3 - t2, auditMs: t4 - t3, totalMs: t4 - t0 },
  };
}

// ─────────────────────────── La trace d'une cellule ───────────────────────────

export interface CelluleTracee {
  ref: string;
  feuille: string;
  formule: string | null;
  /** La valeur AFFICHÉE dans le fichier. */
  valeur: string;
  /** La valeur RECALCULÉE par le moteur (formules seulement). */
  recalculee: string | null;
}

export interface Trace {
  ok: boolean;
  motif?: string;
  cellule?: CelluleTracee;
  /** Les cellules et plages que la formule LIT, avec leur valeur — le premier niveau de « d'où ça vient ». */
  precedents: { cellules: CelluleTracee[]; plages: { ref: string; feuille: string; taille: number; apercu: string }[] };
  /** Ce qui lit cette cellule, directement. */
  dependants: CelluleTracee[];
  /** Tout ce qui change si cette cellule change : nombre de formules, par feuille. */
  rayon: { formules: number; parFeuille: { feuille: string; formules: number }[]; tronque: boolean };
  /** Une explication en français, prête à être dite. */
  explication: string;
}

export const texteValeur = (v: Scalaire | undefined | null): string => {
  if (v === undefined || v === null) return "(vide)";
  if (v instanceof ErreurExcel) return v.code;
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : String(Number(v.toPrecision(12)));
  if (typeof v === "boolean") return v ? "VRAI" : "FAUX";
  return v;
};

/** « Ventes!D12 » ou « D12 » (feuille par défaut) → feuille + coordonnées. */
export function resoudreRef(classeur: Classeur, ref: string, feuilleDefaut?: string | null): { feuille: Feuille; row: number; col: number } | null {
  const m = /^(?:'([^']+)'|([^!]+))!(.+)$/.exec(ref.trim());
  const nomFeuille = m ? (m[1] ?? m[2]) : feuilleDefaut ?? null;
  const a1 = (m ? m[3] : ref).trim().replace(/\$/g, "");
  const coord = coordDeA1(a1);
  if (!coord) return null;
  const feuille = nomFeuille
    ? classeur.feuilles.find((f) => f.nom.toLowerCase() === nomFeuille.toLowerCase())
    : classeur.feuilles[0];
  return feuille ? { feuille, ...coord } : null;
}

function tracee(classeur: Classeur, recalcul: Recalcul | null, id: IdCellule): CelluleTracee {
  const { feuille, row, col } = celluleDeId(id);
  const f = classeur.feuilles.find((x) => x.index === feuille);
  const c = f?.cellules.get(cleDe(row, col));
  const rc = recalcul?.valeurs.get(id);
  return {
    ref: `${f?.nom ?? feuille}!${a1DeCoord(row, col)}`, feuille: f?.nom ?? String(feuille), formule: c?.f ?? null,
    valeur: c ? (c.t === "e" ? String(c.v) : texteValeur(c.v as Scalaire)) : "(vide)",
    recalculee: c?.f ? texteValeur(rc) : null,
  };
}

/**
 * TRACE une cellule : ce qu'elle lit, qui la lit, et jusqu'où va son influence. La réponse à
 * « d'où vient ce 41,3 M ? » et à « si je change ce taux, qu'est-ce qui bouge ? ».
 */
export function tracerCellule(classeur: Classeur, graphe: Graphe, recalcul: Recalcul | null, ref: string, opts: { feuille?: string | null; maxListe?: number } = {}): Trace {
  const vide: Trace = { ok: false, precedents: { cellules: [], plages: [] }, dependants: [], rayon: { formules: 0, parFeuille: [], tronque: false }, explication: "" };
  const cible = resoudreRef(classeur, ref, opts.feuille);
  if (!cible) return { ...vide, motif: `Je ne trouve pas la cellule « ${ref} » — donne la feuille et l'adresse, par exemple « Ventes!D12 ».` };
  const max = opts.maxListe ?? 12;
  const id = idDe(cible.feuille.index, cible.row, cible.col);
  const cellule = tracee(classeur, recalcul, id);
  const noeud = graphe.noeuds.get(id);

  const precedents: Trace["precedents"] = { cellules: [], plages: [] };
  if (noeud) {
    const p = precedentsDirects(graphe, id);
    precedents.cellules = p.cellules.slice(0, max).map((x) => tracee(classeur, recalcul, x));
    for (const { feuille, plage } of p.plages.slice(0, max)) {
      const f = classeur.feuilles.find((x) => x.index === feuille);
      if (!f) continue;
      const valeurs: string[] = [];
      let n = 0;
      for (let r = plage.r1; r <= Math.min(plage.r2, f.lignes) && valeurs.length < 4; r++) {
        for (let c = plage.c1; c <= Math.min(plage.c2, f.colonnes) && valeurs.length < 4; c++) {
          const cell = f.cellules.get(cleDe(r, c));
          if (cell && cell.v !== null) { valeurs.push(texteValeur((recalcul?.valeurs.get(idDe(feuille, r, c)) ?? cell.v) as Scalaire)); n++; }
        }
      }
      const taille = (Math.min(plage.r2, f.lignes) - plage.r1 + 1) * (Math.min(plage.c2, f.colonnes) - plage.c1 + 1);
      precedents.plages.push({ ref: `${f.nom}!${a1DePlage(plage)}`, feuille: f.nom, taille: Math.max(taille, n), apercu: valeurs.join(", ") + (taille > 4 ? ", …" : "") });
    }
  }
  const dependants = dependantsDirects(graphe, cible.feuille.index, cible.row, cible.col).slice(0, max).map((x) => tracee(classeur, recalcul, x));
  const r = rayonImpact(graphe, cible.feuille.index, cible.row, cible.col);
  const parFeuille = new Map<number, number>();
  for (const x of r.formules) { const { feuille } = celluleDeId(x); parFeuille.set(feuille, (parFeuille.get(feuille) ?? 0) + 1); }
  const rayon: Trace["rayon"] = {
    formules: r.formules.length, tronque: r.tronque,
    parFeuille: [...parFeuille.entries()].map(([feuille, formules]) => ({ feuille: classeur.feuilles.find((x) => x.index === feuille)?.nom ?? String(feuille), formules })).sort((a, b) => b.formules - a.formules),
  };

  const parts: string[] = [];
  if (cellule.formule) {
    parts.push(`${cellule.ref} vaut ${cellule.valeur}${cellule.recalculee && cellule.recalculee !== cellule.valeur ? ` (recalculé : ${cellule.recalculee})` : ""}, par la formule =${cellule.formule}.`);
    const lus = [...precedents.cellules.map((c) => `${c.ref} = ${c.valeur}`), ...precedents.plages.map((p) => `${p.ref} (${p.taille} cellule(s) : ${p.apercu})`)];
    if (lus.length) parts.push(`Elle lit ${lus.join(" ; ")}.`);
  } else {
    parts.push(`${cellule.ref} est une valeur saisie : ${cellule.valeur}.`);
  }
  parts.push(rayon.formules === 0 ? "Aucune formule n'en dépend." : `${rayon.formules} formule(s) en dépendent${rayon.parFeuille.length > 1 ? ` (${rayon.parFeuille.map((f) => `${f.feuille} : ${f.formules}`).join(", ")})` : ""}${dependants.length ? ` — directement : ${dependants.slice(0, 5).map((d) => d.ref).join(", ")}` : ""}.`);
  return { ok: true, cellule, precedents, dependants, rayon, explication: parts.join(" ") };
}

/** Deux fichiers `.xlsx` → ce qui a changé. */
export async function comparerFichiersXlsx(avant: Buffer | Uint8Array, apres: Buffer | Uint8Array, opts: { maxDetails?: number } = {}): Promise<ComparaisonClasseurs> {
  const [a, b] = await Promise.all([lireClasseur(avant), lireClasseur(apres)]);
  return comparerClasseurs(a, b, opts);
}

/** La lecture d'une plage en clair — « montre-moi Ventes!A1:F20 » — sans passer par le Live Office. */
export function lirePlage(classeur: Classeur, ref: string, opts: { feuille?: string | null; maxCellules?: number } = {}): { ok: boolean; motif?: string; feuille?: string; plage?: string; lignes?: (string | null)[][]; tronque?: boolean } {
  const m = /^(?:'([^']+)'|([^!]+))!(.+)$/.exec(ref.trim());
  const nomFeuille = m ? (m[1] ?? m[2]) : opts.feuille ?? null;
  const a1 = (m ? m[3] : ref).trim().replace(/\$/g, "");
  const plage = plageDeA1(a1);
  const feuille = nomFeuille ? classeur.feuilles.find((f) => f.nom.toLowerCase() === nomFeuille.toLowerCase()) : classeur.feuilles[0];
  if (!plage || !feuille) return { ok: false, motif: `Plage « ${ref} » introuvable.` };
  const max = opts.maxCellules ?? 2_000;
  const r2 = Math.min(plage.r2, feuille.lignes); const c2 = Math.min(plage.c2, feuille.colonnes);
  const lignes: (string | null)[][] = [];
  let n = 0; let tronque = false;
  for (let r = plage.r1; r <= r2 && !tronque; r++) {
    const ligne: (string | null)[] = [];
    for (let c = plage.c1; c <= c2; c++) {
      if (n++ >= max) { tronque = true; break; }
      const cell = feuille.cellules.get(cleDe(r, c));
      ligne.push(cell && cell.v !== null ? (cell.t === "e" ? String(cell.v) : texteValeur(cell.v as Scalaire)) : null);
    }
    lignes.push(ligne);
  }
  return { ok: true, feuille: feuille.nom, plage: a1DePlage({ r1: plage.r1, c1: plage.c1, r2, c2 }), lignes, tronque };
}

export { resumerAudit };
