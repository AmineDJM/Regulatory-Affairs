/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE CONTRÔLE QUALITÉ VISUEL (§26-27) — sans appeler un modèle de vision à chaque frappe.
 *
 * ── LA RÈGLE ÉCONOMIQUE QUI DICTE LA FORME ──────────────────────────────────────────────
 *
 * §27 est explicite : « pas d'appel vision après chaque touche ». Une passe de vision coûte une
 * seconde et quelques centimes ; sur une conversation de trente retouches, c'est une minute
 * d'attente et un budget pour rien. On fait donc l'inverse : des HEURISTIQUES arithmétiques,
 * gratuites, qui tournent après CHAQUE lot de commandes, et qui ne se prononcent que sur ce
 * qu'on peut mesurer sans dessiner.
 *
 * Ce que ces contrôles savent voir, ils le voient toujours ; ce qu'ils ne savent pas voir, ils
 * ne l'inventent pas. Un contrôle qui dirait « ça a l'air bien » sans avoir regardé serait pire
 * que pas de contrôle : il donnerait une garantie fausse.
 *
 * ── CE QUI EST DÉTECTÉ, ET POURQUOI CHACUN EST LÀ ───────────────────────────────────────
 *
 *   Débordement de forme      une forme PowerPoint qui sort de la diapositive est invisible à
 *                             la projection, et la personne croit qu'Adam l'a supprimée.
 *   Chevauchement             deux formes superposées à plus de 60 % : l'une masque l'autre.
 *   Photo déformée            un rapport largeur/hauteur qui a bougé de plus de 15 % après un
 *                             redimensionnement : c'est le défaut le plus visible et le plus
 *                             facile à produire par inadvertance.
 *   Texte trop long           un titre de 40 pt sur 12 cm ne tient pas ; on le dit.
 *   Tableau incohérent        des lignes de longueurs différentes viennent d'une insertion ratée.
 *   Document vide             zéro paragraphe après une suppression : la personne doit le savoir
 *                             AVANT de sauvegarder.
 *   Page blanche              une page PDF sans texte APRÈS une opération sur les pages.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import type { ArtifactModel } from "@/lib/artifact/object-model/model";
import { abreger } from "@/lib/artifact/object-model/text";

/** Combien de constats on remonte au plus — au-delà, la liste cesse d'être lisible. */
const MAX_ALERTES = 8;

/** Chevauchement au-delà duquel on considère qu'une forme en masque une autre. */
const SEUIL_CHEVAUCHEMENT = 0.6;
/** Dérive de proportions au-delà de laquelle une image est visiblement déformée. */
const SEUIL_DEFORMATION = 0.15;

export interface ProportionsInitiales {
  /** Rapport largeur / hauteur des images à l'OUVERTURE — la déformation se juge par rapport à lui. */
  [idImage: string]: number;
}

export function controlerVisuel(m: ArtifactModel, initiales: ProportionsInitiales = {}): string[] {
  const alertes: string[] = [];
  const ajouter = (s: string) => { if (alertes.length < MAX_ALERTES && !alertes.includes(s)) alertes.push(s); };

  if (m.kind === "DOCX") {
    if (m.paragraphs.length === 0 && m.tables.length === 0) {
      ajouter("Le document ne contient plus aucun contenu.");
    }
    // Largeur utile en centimètres — un caractère de N points occupe environ N × 0,019 cm.
    const utile = m.pageWidthCm - m.marginLeftCm - m.marginRightCm;
    for (const p of m.paragraphs) {
      const taille = p.style.sizePt;
      if (!taille || !p.text) continue;
      const largeurEstimee = p.text.length * taille * 0.019;
      // Un TITRE (une seule ligne attendue) qui déborde est un vrai défaut ; un paragraphe de
      // corps, lui, passe simplement à la ligne — le signaler serait du bruit.
      const estTitre = /^(Heading|Titre|Title)/i.test(p.styleName ?? "") || (p.index === 1 && taille >= 16);
      if (estTitre && largeurEstimee > utile * 1.05) {
        ajouter(`Le titre « ${abreger(p.text, 30)} » ne tient probablement pas sur une ligne à ${taille} pt.`);
      }
    }
    for (const t of m.tables) {
      const parLigne = new Map<number, number>();
      for (const c of t.cells) parLigne.set(c.row, (parLigne.get(c.row) ?? 0) + 1);
      const tailles = new Set(parLigne.values());
      if (tailles.size > 1) ajouter(`Le tableau ${t.index} a des lignes de largeurs différentes.`);
    }
    for (const img of m.images) {
      const ref = initiales[img.id];
      if (!ref || !img.heightCm) continue;
      const actuel = img.widthCm / img.heightCm;
      if (Math.abs(actuel - ref) / ref > SEUIL_DEFORMATION) {
        ajouter(`L'image ${img.index} est déformée par rapport à ses proportions d'origine.`);
      }
    }
    return alertes;
  }

  if (m.kind === "PPTX") {
    for (const d of m.slides) {
      for (const f of d.shapes) {
        if (f.xCm + f.widthCm > m.slideWidthCm + 0.2 || f.yCm + f.heightCm > m.slideHeightCm + 0.2) {
          ajouter(`Diapo ${d.index} : « ${abreger(f.name, 24)} » dépasse du cadre de la diapositive.`);
        }
        if (f.xCm < -0.2 || f.yCm < -0.2) {
          ajouter(`Diapo ${d.index} : « ${abreger(f.name, 24)} » sort du cadre par la gauche ou par le haut.`);
        }
        if (f.text && f.style.sizePt && f.widthCm > 0 && f.heightCm > 0) {
          const parLigne = Math.max(1, Math.floor((f.widthCm / (f.style.sizePt * 0.019)) || 1));
          const lignes = Math.ceil(f.text.length / parLigne);
          // Une ligne de N points occupe environ N × 0,049 cm de haut (interligne compris).
          if (lignes * f.style.sizePt * 0.049 > f.heightCm * 1.25) {
            ajouter(`Diapo ${d.index} : le texte de « ${abreger(f.name, 24)} » déborde de sa zone.`);
          }
        }
      }
      const visibles = d.shapes.filter((f) => f.widthCm > 0 && f.heightCm > 0);
      for (let i = 0; i < visibles.length; i += 1) {
        for (let j = i + 1; j < visibles.length; j += 1) {
          const a = visibles[i];
          const b = visibles[j];
          const largeur = Math.min(a.xCm + a.widthCm, b.xCm + b.widthCm) - Math.max(a.xCm, b.xCm);
          const hauteur = Math.min(a.yCm + a.heightCm, b.yCm + b.heightCm) - Math.max(a.yCm, b.yCm);
          if (largeur <= 0 || hauteur <= 0) continue;
          const commun = largeur * hauteur;
          const plusPetit = Math.min(a.widthCm * a.heightCm, b.widthCm * b.heightCm);
          if (plusPetit > 0 && commun / plusPetit > SEUIL_CHEVAUCHEMENT) {
            ajouter(`Diapo ${d.index} : « ${abreger(a.name, 20)} » et « ${abreger(b.name, 20)} » se recouvrent.`);
          }
        }
      }
    }
    return alertes;
  }

  if (m.kind === "PDF") {
    if (m.pages.length === 0) ajouter("Le PDF ne contient plus aucune page.");
    const blanches = m.pages.filter((p) => !p.preview.trim()).map((p) => p.index);
    // Un PDF SCANNÉ n'a de texte sur aucune page : ce n'est pas un défaut, c'est sa nature.
    // On ne signale donc les pages blanches que si le document en a, par ailleurs, de pleines.
    if (blanches.length > 0 && blanches.length < m.pages.length) {
      ajouter(`Page${blanches.length > 1 ? "s" : ""} sans texte : ${blanches.slice(0, 10).join(", ")}${blanches.length > 10 ? "…" : ""}.`);
    }
    return alertes;
  }

  // XLSX — les défauts de tableur sont arithmétiques, pas visuels.
  for (const s of m.sheets) {
    const erreurs = s.cells.filter((c) => /^#(REF|DIV\/0|VALUE|NAME|N\/A|NUM|NULL)!?/i.test(c.value));
    if (erreurs.length) {
      ajouter(`${s.name} : ${erreurs.length} cellule(s) en erreur (${erreurs.slice(0, 3).map((c) => `${c.ref}=${c.value}`).join(", ")}).`);
    }
    // Une formule qui se référence elle-même boucle : Excel le refuse à l'ouverture.
    const circulaires = s.cells.filter((c) => c.formula && c.formula.toUpperCase().includes(c.ref.toUpperCase()));
    if (circulaires.length) {
      ajouter(`${s.name} : référence circulaire en ${circulaires.slice(0, 3).map((c) => c.ref).join(", ")}.`);
    }
  }
  return alertes;
}

/** Les proportions des images à l'ouverture — à mémoriser pour juger la déformation ensuite. */
export function proportionsInitiales(m: ArtifactModel): ProportionsInitiales {
  const out: ProportionsInitiales = {};
  if (m.kind !== "DOCX") return out;
  for (const img of m.images) {
    if (img.heightCm > 0) out[img.id] = img.widthCm / img.heightCm;
  }
  return out;
}
