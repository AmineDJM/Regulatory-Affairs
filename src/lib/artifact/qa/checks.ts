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

// ═══════════════════════════ LE CONTRÔLE AVANT LIVRAISON ═══════════════════════════
//
// `controlerVisuel` protège la personne PENDANT qu'elle retouche : des alertes, jamais un
// blocage. Le contrôle avant LIVRAISON est autre chose : un document qui part chez un client, un
// deck qui passe en comité, un classeur qui va au conseil. Là, certains défauts sont
// BLOQUANTS — un « [à compléter] » oublié dans un contrat, une diapositive sans titre, une
// cellule en #REF! — et un appelant honnête (les constructeurs, la fabrique documentaire) ne
// livre pas tant qu'il en reste. Les autres restent des avertissements : on les dit, la personne
// décide.

export interface ControleLivraison {
  bloquants: string[];
  avertissements: string[];
  /** Vrai s'il n'y a aucun bloquant. */
  ok: boolean;
}

/** Les textes qu'un modèle ou un gabarit laisse derrière lui, et qu'un client ne doit jamais lire. */
const MARQUEURS_BROUILLON = [
  /\[\s*(?:à|a) compl[ée]ter\s*\]/i, /\[\s*(?:à|a) v[ée]rifier\s*\]/i, /\[\s*(?:nom|date|montant|client|soci[ée]t[ée])[^\]]{0,30}\]/i,
  /\bXXX+\b/, /\bTODO\b/, /\bTBD\b/, /\bTBC\b/, /lorem ipsum/i, /\{\{[^}]{1,60}\}\}/, /<\s*ins[ée]rer[^>]{0,40}>/i, /\[\.{3}\]|\[…\]/,
];
const MAX_PUCES = 7;
const MAX_MOTS_TITRE = 14;
const MAX_MOTS_PUCE = 25;
const MIN_PT_CORPS = 10;

const compterMots = (t: string): number => t.trim().split(/\s+/).filter(Boolean).length;
const marqueurDe = (t: string): string | null => {
  for (const re of MARQUEURS_BROUILLON) { const m = re.exec(t); if (m) return m[0]; }
  return null;
};

export function controlerAvantLivraison(m: ArtifactModel, initiales: ProportionsInitiales = {}): ControleLivraison {
  const bloquants: string[] = [];
  const avertissements: string[] = [...controlerVisuel(m, initiales)];
  const bloquer = (s: string) => { if (bloquants.length < 20 && !bloquants.includes(s)) bloquants.push(s); };
  const avertir = (s: string) => { if (avertissements.length < 20 && !avertissements.includes(s)) avertissements.push(s); };

  if (m.kind === "DOCX") {
    if (m.paragraphs.length === 0 && m.tables.length === 0) bloquer("Le document est vide.");
    for (const p of m.paragraphs) {
      const marque = marqueurDe(p.text);
      if (marque) bloquer(`¶${p.index}${p.page ? ` (page ${p.page})` : ""} contient un reste de brouillon « ${marque} » : ${abreger(p.text, 50)}`);
    }
    for (const t of m.tables) {
      for (const c of t.cells) { const marque = marqueurDe(c.text); if (marque) bloquer(`Tableau ${t.index}, L${c.row}C${c.col} contient « ${marque} ».`); }
    }
    // Un titre sans corps : deux titres qui se suivent au même niveau, ou un titre en fin de document.
    const titres = m.paragraphs.filter((p) => p.headingLevel !== null);
    for (let i = 0; i < titres.length; i++) {
      const t = titres[i];
      const suivant = m.paragraphs[t.index]; // le paragraphe juste après (index humain = position + 1)
      if (!t.text.trim()) { avertir(`¶${t.index} est un titre vide.`); continue; }
      if (!suivant) { avertir(`Le titre « ${abreger(t.text, 40)} » (¶${t.index}) termine le document sans corps de texte.`); continue; }
      if (suivant.headingLevel !== null && suivant.headingLevel <= t.headingLevel!) avertir(`La section « ${abreger(t.text, 40)} » (¶${t.index}) n'a aucun contenu avant le titre suivant.`);
    }
    // La numérotation « Article N » : un trou ou un doublon se voit tout de suite chez un juriste.
    const articles = m.paragraphs.map((p) => ({ p, m: /^\s*(?:article|art\.)\s+(\d{1,3})\b/i.exec(p.text) })).filter((x) => x.m);
    for (let i = 1; i < articles.length; i++) {
      const prev = Number(articles[i - 1].m![1]); const cur = Number(articles[i].m![1]);
      if (cur === prev) avertir(`Deux « Article ${cur} » (¶${articles[i - 1].p.index} et ¶${articles[i].p.index}).`);
      else if (cur !== prev + 1) avertir(`La numérotation des articles saute de ${prev} à ${cur} (¶${articles[i].p.index}).`);
    }
    if (m.tables.some((t) => t.rows === 0)) avertir("Un tableau est vide.");
  }

  if (m.kind === "PPTX") {
    if (m.slides.length === 0) bloquer("La présentation ne contient aucune diapositive.");
    const titres = new Map<string, number[]>();
    for (const d of m.slides) {
      const titre = d.title.trim();
      if (!titre) bloquer(`Diapo ${d.index} : pas de titre.`);
      else {
        const cle = titre.toLowerCase();
        titres.set(cle, [...(titres.get(cle) ?? []), d.index]);
        if (compterMots(titre) > MAX_MOTS_TITRE) avertir(`Diapo ${d.index} : le titre fait ${compterMots(titre)} mots — une idée par diapositive tient en une ligne.`);
      }
      const textes = d.shapes.filter((f) => f.role === "text" && f.text.trim());
      if (textes.length <= 1 && !d.shapes.some((f) => f.role === "picture" || f.role === "table" || f.role === "chart")) {
        avertir(`Diapo ${d.index} : rien d'autre que le titre.`);
      }
      for (const f of d.shapes) {
        if (!f.text.trim()) continue;
        const marque = marqueurDe(f.text);
        if (marque) bloquer(`Diapo ${d.index}, « ${abreger(f.name, 20)} » contient un reste de brouillon « ${marque} ».`);
        if (/cliquez pour (ajouter|modifier)/i.test(f.text)) bloquer(`Diapo ${d.index} : un espace réservé n'a pas été rempli (« ${abreger(f.text, 40)} »).`);
        const lignes = f.text.split("\n").filter((l) => l.trim());
        if (lignes.length > MAX_PUCES) avertir(`Diapo ${d.index}, « ${abreger(f.name, 20)} » : ${lignes.length} lignes — au-delà de ${MAX_PUCES}, personne ne lit.`);
        const longues = lignes.filter((l) => compterMots(l) > MAX_MOTS_PUCE).length;
        if (longues > 0 && d.title.trim() !== f.text.trim()) avertir(`Diapo ${d.index}, « ${abreger(f.name, 20)} » : ${longues} puce(s) de plus de ${MAX_MOTS_PUCE} mots.`);
        if (f.style.sizePt !== null && f.style.sizePt < MIN_PT_CORPS && f.text.length > 30) avertir(`Diapo ${d.index}, « ${abreger(f.name, 20)} » : ${f.style.sizePt} pt, illisible en projection.`);
      }
    }
    for (const [titre, indices] of titres) if (indices.length > 1) avertir(`Le titre « ${abreger(titre, 40)} » revient sur les diapos ${indices.join(", ")}.`);
  }

  if (m.kind === "PDF") {
    if (m.pages.length === 0) bloquer("Le PDF ne contient aucune page.");
    const rotations = new Set(m.pages.map((p) => p.rotation));
    if (rotations.size > 1) avertir(`Les pages n'ont pas toutes la même orientation (rotations ${[...rotations].join("°, ")}°).`);
    for (const p of m.pages) { const marque = marqueurDe(p.preview); if (marque) bloquer(`Page ${p.index} contient un reste de brouillon « ${marque} ».`); }
  }

  if (m.kind === "XLSX") {
    for (const s of m.sheets) {
      const erreurs = s.cells.filter((c) => /^#(REF|DIV\/0|VALUE|NAME|N\/A|NUM|NULL)!?/i.test(c.value));
      if (erreurs.length) bloquer(`${s.name} : ${erreurs.length} cellule(s) en erreur (${erreurs.slice(0, 3).map((c) => `${c.ref}=${c.value}`).join(", ")}).`);
      for (const c of s.cells) { const marque = marqueurDe(c.value); if (marque) bloquer(`${s.name}!${c.ref} contient « ${marque} ».`); }
    }
  }

  return { bloquants, avertissements, ok: bloquants.length === 0 };
}
