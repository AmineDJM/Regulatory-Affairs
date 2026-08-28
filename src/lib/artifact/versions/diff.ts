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

import type { ArtifactModel, TextStyle } from "@/lib/artifact/object-model/model";
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

export function comparer(avant: ArtifactModel, apres: ArtifactModel): Comparaison {
  if (avant.kind !== apres.kind) {
    return { ok: false, motif: `on ne compare pas un ${avant.kind} à un ${apres.kind}`, changements: [], resume: "" };
  }
  const c: Changement[] = [];

  if (avant.kind === "DOCX" && apres.kind === "DOCX") {
    const n = Math.max(avant.paragraphs.length, apres.paragraphs.length);
    for (let i = 0; i < n && c.length < MAX_CHANGEMENTS; i += 1) {
      const a = avant.paragraphs[i];
      const b = apres.paragraphs[i];
      if (a && !b) { c.push({ nature: "suppression", objet: `¶${a.index}`, quoi: "paragraphe supprimé", avant: abreger(a.text, 70), apres: null }); continue; }
      if (!a && b) { c.push({ nature: "ajout", objet: `¶${b.index}`, quoi: "paragraphe ajouté", avant: null, apres: abreger(b.text, 70) }); continue; }
      if (!a || !b) continue;
      if (a.text !== b.text) {
        c.push({ nature: "texte", objet: `¶${b.index}`, quoi: "texte modifié", avant: abreger(a.text, 70), apres: abreger(b.text, 70) });
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
      // QUELLES pages ont disparu, et pas seulement combien : c'est la question qu'on pose.
      const restants = new Set(apres.pages.map((p) => p.preview).filter(Boolean));
      const partis = avant.pages.filter((p) => p.preview && !restants.has(p.preview)).map((p) => p.index);
      if (partis.length) {
        c.push({ nature: "suppression", objet: "pages", quoi: `pages retirées : ${partis.slice(0, 20).join(", ")}`, avant: partis.join(", "), apres: null });
      }
    }
    for (let i = 0; i < Math.min(avant.pages.length, apres.pages.length) && c.length < MAX_CHANGEMENTS; i += 1) {
      if (avant.pages[i].rotation !== apres.pages[i].rotation) {
        c.push({ nature: "forme", objet: `page ${i + 1}`, quoi: `rotation ${avant.pages[i].rotation}° → ${apres.pages[i].rotation}°`, avant: null, apres: null });
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
    for (let i = 0; i < Math.min(avant.slides.length, apres.slides.length) && c.length < MAX_CHANGEMENTS; i += 1) {
      const a = avant.slides[i];
      const b = apres.slides[i];
      for (let k = 0; k < Math.min(a.shapes.length, b.shapes.length) && c.length < MAX_CHANGEMENTS; k += 1) {
        const fa = a.shapes[k];
        const fb = b.shapes[k];
        if (fa.text !== fb.text) {
          c.push({ nature: "texte", objet: `diapo ${b.index} · ${fb.name}`, quoi: "texte modifié", avant: abreger(fa.text, 60), apres: abreger(fb.text, 60) });
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
