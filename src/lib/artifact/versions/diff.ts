/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * « QU'EST-CE QUE TU AS CHANGÉ ? » (§52-54) — la réponse, calculée, pas racontée.
 *
 * ── POURQUOI ON NE SE CONTENTE PAS DU JOURNAL ───────────────────────────────────────────
 *
 * `ArtifactOperation` sait ce qu'on a DEMANDÉ : « ¶1 → centré ». C'est déjà bien, et c'est ce
 * que l'historique du workspace affiche. Mais cela ne dit pas ce qui a effectivement CHANGÉ
 * entre deux versions du Drive — et c'est cette seconde question qu'on pose vraiment quand on
 * compare la version 3 à la version 5 : entre les deux, quelqu'un d'autre a peut-être écrit,
 * ou une opération a échoué au rejeu.
 *
 * Ce module compare donc deux MODÈLES, objet par objet. Il ne raconte pas : il constate.
 *
 * ── CE QU'IL COMPARE, ET DANS QUELLE UNITÉ ──────────────────────────────────────────────
 *
 * Le rang HUMAIN et le texte, jamais les octets. « Le paragraphe 3 est passé de "Article 2 —
 * Durée" à "Article 2 — Durée et renouvellement" » se lit ; « 47 octets ont changé dans
 * word/document.xml » ne se lit pas.
 *
 * Module PUR : il ne fait que comparer deux structures déjà lues.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import type { ArtifactModel, PptxModel, TextStyle } from "@/lib/artifact/object-model/model";
import { abreger } from "@/lib/artifact/object-model/text";

export type NatureChangement = "ajout" | "suppression" | "texte" | "forme" | "deplacement";

export interface Changement {
  nature: NatureChangement;
  /** L'objet concerné, dans les termes de la personne : « ¶3 », « page 12 », « diapo 2 ». */
  objet: string;
  /** Ce qui a changé, en une phrase lisible. */
  quoi: string;
  avant: string | null;
  apres: string | null;
}

export interface Comparaison {
  ok: boolean;
  /** `null` quand les deux modèles ne sont pas du même format — on ne compare pas un PDF à un Word. */
  motif: string | null;
  changements: Changement[];
  /** « 3 paragraphes modifiés, 1 supprimé » — ce qu'Adam dit en une phrase. */
  resume: string;
}

const MAX_CHANGEMENTS = 60;

/** Ce qui distingue deux mises en forme, en français. Vide = elles sont identiques. */
function differenceDeStyle(a: TextStyle, b: TextStyle): string[] {
  const dits: string[] = [];
  if (a.bold !== b.bold) dits.push(b.bold ? "mis en gras" : "gras retiré");
  if (a.italic !== b.italic) dits.push(b.italic ? "mis en italique" : "italique retiré");
  if (a.underline !== b.underline) dits.push(b.underline ? "souligné" : "soulignement retiré");
  if (a.sizePt !== b.sizePt && b.sizePt !== null) dits.push(`taille ${a.sizePt ?? "par défaut"} → ${b.sizePt} pt`);
  if (a.font !== b.font && b.font !== null) dits.push(`police ${a.font ?? "par défaut"} → ${b.font}`);
  if (a.color !== b.color && b.color !== null) dits.push(`couleur → #${b.color}`);
  return dits;
}

/**
 * ALIGNE deux suites par leur CONTENU (signatures), pas par leur rang : ancres uniques des deux
 * côtés, plus longue sous-suite croissante (l'algorithme « patience »), positionnel entre deux
 * ancres. Un paragraphe inséré au milieu de mille est UNE différence, pas mille — la même idée
 * que pour les lignes d'un classeur (`sheets/diff.ts`).
 */
export function alignerSequences(a: string[], b: string[]): { paires: [number, number][]; seulsA: number[]; seulsB: number[] } {
  const compteA = new Map<string, number>(); const compteB = new Map<string, number>();
  for (const s of a) if (s) compteA.set(s, (compteA.get(s) ?? 0) + 1);
  for (const s of b) if (s) compteB.set(s, (compteB.get(s) ?? 0) + 1);
  const posB = new Map<string, number>();
  b.forEach((s, j) => { if (s && compteA.get(s) === 1 && compteB.get(s) === 1) posB.set(s, j); });
  const ancresA: number[] = []; const ancresB: number[] = [];
  a.forEach((s, i) => { const j = s ? posB.get(s) : undefined; if (j !== undefined) { ancresA.push(i); ancresB.push(j); } });
  // Plus longue sous-suite croissante des indices B (O(n log n)).
  const fin: number[] = []; const prec: number[] = new Array(ancresB.length).fill(-1);
  for (let i = 0; i < ancresB.length; i++) {
    let lo = 0, hi = fin.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (ancresB[fin[mid]] < ancresB[i]) lo = mid + 1; else hi = mid; }
    if (lo > 0) prec[i] = fin[lo - 1];
    fin[lo] = i;
  }
  const garde: number[] = [];
  for (let k = fin.length ? fin[fin.length - 1] : -1; k !== -1; k = prec[k]) garde.push(k);
  garde.reverse();
  const ancres: [number, number][] = garde.map((k) => [ancresA[k], ancresB[k]]);
  ancres.push([a.length, b.length]);
  const paires: [number, number][] = []; const seulsA: number[] = []; const seulsB: number[] = [];
  let ia = 0, ib = 0;
  for (const [aa, ab] of ancres) {
    while (ia < aa && ib < ab) { paires.push([ia, ib]); ia++; ib++; }
    while (ia < aa) { seulsA.push(ia); ia++; }
    while (ib < ab) { seulsB.push(ib); ib++; }
    if (aa < a.length && ab < b.length) { paires.push([aa, ab]); ia = aa + 1; ib = ab + 1; }
  }
  return { paires, seulsA, seulsB };
}

/** Le FRAGMENT qui a changé entre deux textes (préfixe et suffixe communs retirés), par mots. */
export function fragmentModifie(avant: string, apres: string): { avant: string; apres: string } {
  const a = avant.split(/(\s+)/); const b = apres.split(/(\s+)/);
  let debut = 0;
  while (debut < a.length && debut < b.length && a[debut] === b[debut]) debut++;
  let finA = a.length, finB = b.length;
  while (finA > debut && finB > debut && a[finA - 1] === b[finB - 1]) { finA--; finB--; }
  return { avant: a.slice(debut, finA).join("").trim(), apres: b.slice(debut, finB).join("").trim() };
}

const signatureTexte = (t: string): string => t.replace(/\s+/g, " ").trim().toLowerCase();

export function comparer(avant: ArtifactModel, apres: ArtifactModel): Comparaison {
  if (avant.kind !== apres.kind) {
    return { ok: false, motif: `on ne compare pas un ${avant.kind} à un ${apres.kind}`, changements: [], resume: "" };
  }
  const c: Changement[] = [];

  if (avant.kind === "DOCX" && apres.kind === "DOCX") {
    // Les paragraphes sont ALIGNÉS par leur texte : une insertion au milieu ne décale pas tout.
    const { paires, seulsA, seulsB } = alignerSequences(avant.paragraphs.map((p) => signatureTexte(p.text)), apres.paragraphs.map((p) => signatureTexte(p.text)));
    for (const i of seulsA) { if (c.length >= MAX_CHANGEMENTS) break; const a = avant.paragraphs[i]; c.push({ nature: "suppression", objet: `¶${a.index}`, quoi: "paragraphe supprimé", avant: abreger(a.text, 70), apres: null }); }
    for (const j of seulsB) { if (c.length >= MAX_CHANGEMENTS) break; const b = apres.paragraphs[j]; c.push({ nature: "ajout", objet: `¶${b.index}${b.page ? ` (page ${b.page})` : ""}`, quoi: "paragraphe ajouté", avant: null, apres: abreger(b.text, 70) }); }
    for (const [i, j] of paires) {
      if (c.length >= MAX_CHANGEMENTS) break;
      const a = avant.paragraphs[i];
      const b = apres.paragraphs[j];
      if (a.text !== b.text) {
        const frag = fragmentModifie(a.text, b.text);
        const court = frag.avant.length + frag.apres.length < a.text.length + b.text.length;
        c.push({
          nature: "texte", objet: `¶${b.index}${b.page ? ` (page ${b.page})` : ""}`,
          quoi: court ? `texte modifié : « ${abreger(frag.avant || "∅", 40)} » → « ${abreger(frag.apres || "∅", 40)} »` : "texte modifié",
          avant: abreger(a.text, 70), apres: abreger(b.text, 70),
        });
      }
      const forme = differenceDeStyle(a.style, b.style);
      if (a.alignment !== b.alignment) {
        forme.unshift(`alignement ${a.alignment ?? "par défaut"} → ${b.alignment ?? "par défaut"}`);
      }
      if (a.indentLeftCm !== b.indentLeftCm) forme.push(`retrait gauche → ${b.indentLeftCm ?? 0} cm`);
      if (a.spacingBeforePt !== b.spacingBeforePt) forme.push(`espacement avant → ${b.spacingBeforePt ?? 0} pt`);
      if (forme.length) {
        c.push({ nature: "forme", objet: `¶${b.index}`, quoi: forme.join(", "), avant: null, apres: null });
      }
    }
    // Les tableaux : on compare cellule par cellule, à rang égal.
    for (let t = 0; t < Math.max(avant.tables.length, apres.tables.length) && c.length < MAX_CHANGEMENTS; t += 1) {
      const a = avant.tables[t];
      const b = apres.tables[t];
      if (a && !b) { c.push({ nature: "suppression", objet: `tableau ${a.index}`, quoi: "tableau supprimé", avant: a.header.join(" · "), apres: null }); continue; }
      if (!a && b) { c.push({ nature: "ajout", objet: `tableau ${b.index}`, quoi: "tableau ajouté", avant: null, apres: b.header.join(" · ") }); continue; }
      if (!a || !b) continue;
      if (a.rows !== b.rows) {
        c.push({ nature: b.rows > a.rows ? "ajout" : "suppression", objet: `tableau ${b.index}`, quoi: `${a.rows} → ${b.rows} lignes`, avant: String(a.rows), apres: String(b.rows) });
      }
      const parRef = new Map(a.cells.map((x) => [`${x.row}.${x.col}`, x.text]));
      for (const cel of b.cells) {
        if (c.length >= MAX_CHANGEMENTS) break;
        const ancien = parRef.get(`${cel.row}.${cel.col}`);
        if (ancien !== undefined && ancien !== cel.text) {
          c.push({ nature: "texte", objet: `tableau ${b.index} L${cel.row}C${cel.col}`, quoi: "cellule modifiée", avant: abreger(ancien, 40), apres: abreger(cel.text, 40) });
        }
      }
    }
  }

  if (avant.kind === "PDF" && apres.kind === "PDF") {
    if (avant.pages.length !== apres.pages.length) {
      c.push({
        nature: apres.pages.length > avant.pages.length ? "ajout" : "suppression",
        objet: "document", quoi: `${avant.pages.length} → ${apres.pages.length} pages`,
        avant: String(avant.pages.length), apres: String(apres.pages.length),
      });
    }
    // QUELLES pages ont bougé, pas seulement combien : alignées par leur texte.
    const { paires, seulsA, seulsB } = alignerSequences(avant.pages.map((p) => signatureTexte(p.preview)), apres.pages.map((p) => signatureTexte(p.preview)));
    if (seulsA.length) c.push({ nature: "suppression", objet: "pages", quoi: `pages retirées : ${seulsA.slice(0, 20).map((i) => avant.pages[i].index).join(", ")}${seulsA.length > 20 ? "…" : ""}`, avant: seulsA.map((i) => avant.pages[i].index).join(", "), apres: null });
    if (seulsB.length) c.push({ nature: "ajout", objet: "pages", quoi: `pages ajoutées : ${seulsB.slice(0, 20).map((j) => apres.pages[j].index).join(", ")}${seulsB.length > 20 ? "…" : ""}`, avant: null, apres: seulsB.map((j) => apres.pages[j].index).join(", ") });
    for (const [i, j] of paires) {
      if (c.length >= MAX_CHANGEMENTS) break;
      if (avant.pages[i].rotation !== apres.pages[j].rotation) {
        c.push({ nature: "forme", objet: `page ${apres.pages[j].index}`, quoi: `rotation ${avant.pages[i].rotation}° → ${apres.pages[j].rotation}°`, avant: null, apres: null });
      }
      if (avant.pages[i].index !== apres.pages[j].index && seulsA.length === 0 && seulsB.length === 0 && c.length < MAX_CHANGEMENTS) {
        c.push({ nature: "deplacement", objet: `page ${avant.pages[i].index}`, quoi: `déplacée en position ${apres.pages[j].index}`, avant: String(avant.pages[i].index), apres: String(apres.pages[j].index) });
      }
    }
  }

  if (avant.kind === "XLSX" && apres.kind === "XLSX") {
    for (const feuille of apres.sheets) {
      if (c.length >= MAX_CHANGEMENTS) break;
      const ancienne = avant.sheets.find((s) => s.name === feuille.name);
      if (!ancienne) { c.push({ nature: "ajout", objet: `feuille ${feuille.name}`, quoi: "feuille ajoutée", avant: null, apres: feuille.name }); continue; }
      const parRef = new Map(ancienne.cells.map((x) => [x.ref, x]));
      for (const cel of feuille.cells) {
        if (c.length >= MAX_CHANGEMENTS) break;
        const ancien = parRef.get(cel.ref);
        if (!ancien) { c.push({ nature: "ajout", objet: `${feuille.name}!${cel.ref}`, quoi: "cellule remplie", avant: null, apres: abreger(cel.value, 40) }); continue; }
        if (ancien.value !== cel.value) {
          c.push({ nature: "texte", objet: `${feuille.name}!${cel.ref}`, quoi: "valeur modifiée", avant: abreger(ancien.value, 40), apres: abreger(cel.value, 40) });
        } else if (ancien.formula !== cel.formula && cel.formula) {
          c.push({ nature: "texte", objet: `${feuille.name}!${cel.ref}`, quoi: "formule modifiée", avant: ancien.formula, apres: cel.formula });
        } else {
          const forme = differenceDeStyle(ancien.style, cel.style);
          if (ancien.fill !== cel.fill && cel.fill) forme.push(`fond → #${cel.fill}`);
          if (ancien.numFmt !== cel.numFmt && cel.numFmt) forme.push(`format ${cel.numFmt}`);
          if (forme.length) c.push({ nature: "forme", objet: `${feuille.name}!${cel.ref}`, quoi: forme.join(", "), avant: null, apres: null });
        }
      }
      for (const ancien of ancienne.cells) {
        if (c.length >= MAX_CHANGEMENTS) break;
        if (ancien.value && !feuille.cells.some((x) => x.ref === ancien.ref)) {
          c.push({ nature: "suppression", objet: `${feuille.name}!${ancien.ref}`, quoi: "cellule vidée", avant: abreger(ancien.value, 40), apres: null });
        }
      }
    }
    for (const s of avant.sheets) {
      if (!apres.sheets.some((x) => x.name === s.name)) {
        c.push({ nature: "suppression", objet: `feuille ${s.name}`, quoi: "feuille supprimée", avant: s.name, apres: null });
      }
    }
  }

  if (avant.kind === "PPTX" && apres.kind === "PPTX") {
    if (avant.slides.length !== apres.slides.length) {
      c.push({
        nature: apres.slides.length > avant.slides.length ? "ajout" : "suppression",
        objet: "présentation", quoi: `${avant.slides.length} → ${apres.slides.length} diapositives`,
        avant: String(avant.slides.length), apres: String(apres.slides.length),
      });
    }
    const signature = (d: PptxModel["slides"][number]) => `${signatureTexte(d.title)}|${d.shapes.length}`;
    const { paires, seulsA, seulsB } = alignerSequences(avant.slides.map(signature), apres.slides.map(signature));
    for (const i of seulsA) { if (c.length >= MAX_CHANGEMENTS) break; c.push({ nature: "suppression", objet: `diapo ${avant.slides[i].index}`, quoi: "diapositive supprimée", avant: abreger(avant.slides[i].title, 50), apres: null }); }
    for (const j of seulsB) { if (c.length >= MAX_CHANGEMENTS) break; c.push({ nature: "ajout", objet: `diapo ${apres.slides[j].index}`, quoi: "diapositive ajoutée", avant: null, apres: abreger(apres.slides[j].title, 50) }); }
    for (const [i, j] of paires) {
      if (c.length >= MAX_CHANGEMENTS) break;
      const a = avant.slides[i];
      const b = apres.slides[j];
      if (a.index !== b.index && seulsA.length === 0 && seulsB.length === 0) {
        c.push({ nature: "deplacement", objet: `diapo ${a.index}`, quoi: `déplacée en position ${b.index}`, avant: String(a.index), apres: String(b.index) });
      }
      for (let k = 0; k < Math.min(a.shapes.length, b.shapes.length) && c.length < MAX_CHANGEMENTS; k += 1) {
        const fa = a.shapes[k];
        const fb = b.shapes[k];
        if (fa.text !== fb.text) {
          const frag = fragmentModifie(fa.text, fb.text);
          c.push({ nature: "texte", objet: `diapo ${b.index} · ${fb.name}`, quoi: `texte modifié : « ${abreger(frag.avant || "∅", 30)} » → « ${abreger(frag.apres || "∅", 30)} »`, avant: abreger(fa.text, 60), apres: abreger(fb.text, 60) });
        }
        // Un dixième de centimètre est un arrondi de conversion EMU, pas un déplacement.
        if (Math.abs(fa.xCm - fb.xCm) > 0.05 || Math.abs(fa.yCm - fb.yCm) > 0.05) {
          c.push({
            nature: "deplacement", objet: `diapo ${b.index} · ${fb.name}`,
            quoi: `déplacée de ${(fb.xCm - fa.xCm).toFixed(1)} ; ${(fb.yCm - fa.yCm).toFixed(1)} cm`,
            avant: `${fa.xCm} ; ${fa.yCm}`, apres: `${fb.xCm} ; ${fb.yCm}`,
          });
        }
        const forme = differenceDeStyle(fa.style, fb.style);
        if (forme.length) c.push({ nature: "forme", objet: `diapo ${b.index} · ${fb.name}`, quoi: forme.join(", "), avant: null, apres: null });
      }
      if (a.shapes.length !== b.shapes.length) {
        c.push({
          nature: b.shapes.length > a.shapes.length ? "ajout" : "suppression",
          objet: `diapo ${b.index}`, quoi: `${a.shapes.length} → ${b.shapes.length} formes`,
          avant: String(a.shapes.length), apres: String(b.shapes.length),
        });
      }
    }
  }

  return { ok: true, motif: null, changements: c, resume: resumerChangements(c) };
}

/** « 3 textes modifiés, 1 suppression, 2 mises en forme » — et « rien » quand c'est vrai. */
export function resumerChangements(changements: Changement[]): string {
  if (changements.length === 0) return "Aucune différence entre ces deux versions.";
  const compte = new Map<NatureChangement, number>();
  for (const c of changements) compte.set(c.nature, (compte.get(c.nature) ?? 0) + 1);
  const mots: Record<NatureChangement, [string, string]> = {
    ajout: ["ajout", "ajouts"],
    suppression: ["suppression", "suppressions"],
    texte: ["texte modifié", "textes modifiés"],
    forme: ["mise en forme", "mises en forme"],
    deplacement: ["déplacement", "déplacements"],
  };
  const bouts = [...compte.entries()].map(([n, k]) => `${k} ${mots[n][k > 1 ? 1 : 0]}`);
  return bouts.join(", ") + ".";
}
