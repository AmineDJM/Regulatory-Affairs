/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LA LECTURE D'UN CORPS D'ARTICLE EN MARKDOWN — PURE, zéro import (le navigateur la charge).
 *
 * Le site rend le Markdown, construit le sommaire à partir des `##`, calcule le temps de lecture.
 * L'ERP n'a pas à refaire ce rendu ; il doit en revanche refuser AVANT l'envoi ce que le contrat
 * interdit, et montrer à l'auteur la STRUCTURE que le site va en tirer :
 *
 *   • « Ne pas mettre de `#` (titre de niveau 1) dans le corps : le `title` le fournit. » Deux
 *     titres de niveau 1 sur une page, c'est deux sujets principaux pour un moteur de recherche,
 *     et un sommaire dont la première entrée n'est pas à sa place. On le détecte sous ses TROIS
 *     formes — `# Titre`, le titre souligné de `===`, la balise `<h1>` — et JAMAIS dans un bloc
 *     de code, où `# commentaire` n'est pas un titre.
 *   • Le sommaire : ce que le lecteur verra dans la colonne latérale.
 *   • Un aperçu en BLOCS STRUCTURÉS (titres, paragraphes, listes, citations, code, liens), rendu
 *     par des éléments React — jamais par du HTML injecté : un corps d'article est une donnée, et
 *     un lien `javascript:` tapé ou collé ne doit rien exécuter dans l'ERP.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

export interface TitreMarkdown {
  niveau: number;
  texte: string;
  /** Numéro de ligne HUMAIN (1 = la première). */
  ligne: number;
  forme: "diese" | "souligne" | "html";
}

const FENCE = /^ {0,3}(`{3,}|~{3,})/;
const ATX = /^ {0,3}(#{1,6})(?:[ \t]+|$)(.*)$/;
const SETEXT_1 = /^ {0,3}=+[ \t]*$/;
const SETEXT_2 = /^ {0,3}-+[ \t]*$/;
const LISTE = /^\s*(?:[-*+]|\d{1,9}[.)])\s+/;
const CITATION = /^\s*>/;
const HTML_H1 = /<h1(?:\s|>|\/)/i;

/** Une ligne est-elle un paragraphe (le seul contexte où `===` fait un titre) ? */
function estParagraphe(l: string): boolean {
  return l.trim().length > 0 && !ATX.test(l) && !LISTE.test(l) && !CITATION.test(l) && !FENCE.test(l)
    && !/^( {4,}|\t)/.test(l);
}

function lignesDe(md: string): string[] {
  return md.replace(/\r\n?/g, "\n").split("\n");
}

/**
 * TOUS LES TITRES du corps, dans l'ordre, hors blocs de code.
 */
export function titres(md: string): TitreMarkdown[] {
  const out: TitreMarkdown[] = [];
  const ls = lignesDe(md);
  let cloture: string | null = null;
  let precedente: string | null = null; // la ligne précédente, si elle était un paragraphe

  for (let i = 0; i < ls.length; i += 1) {
    const l = ls[i]!;
    const fence = FENCE.exec(l);
    if (cloture) {
      // Seule une barrière du MÊME caractère, au moins aussi longue et sans rien derrière, ferme.
      if (fence && fence[1]![0] === cloture[0] && fence[1]!.length >= cloture.length && l.trim() === fence[1]) cloture = null;
      precedente = null;
      continue;
    }
    if (fence) { cloture = fence[1]!; precedente = null; continue; }
    if (l.trim() === "") { precedente = null; continue; }
    // Une ligne indentée de quatre espaces qui ne prolonge pas un paragraphe est du CODE : ce
    // qu'elle contient n'est jamais un titre, pas même une balise.
    const indentee = /^( {4,}|\t)/.test(l);
    if (indentee && precedente === null) continue;

    const atx = ATX.exec(l);
    if (atx) {
      const texte = (atx[2] ?? "").replace(/[ \t]+#+[ \t]*$/, "").replace(/^#+[ \t]*$/, "").trim();
      out.push({ niveau: atx[1]!.length, texte, ligne: i + 1, forme: "diese" });
      precedente = null;
      continue;
    }
    if (precedente !== null && SETEXT_1.test(l)) {
      out.push({ niveau: 1, texte: precedente.trim(), ligne: i, forme: "souligne" });
      precedente = null;
      continue;
    }
    if (precedente !== null && SETEXT_2.test(l)) {
      out.push({ niveau: 2, texte: precedente.trim(), ligne: i, forme: "souligne" });
      precedente = null;
      continue;
    }
    if (HTML_H1.test(l)) {
      out.push({ niveau: 1, texte: l.replace(/<[^>]*>/g, "").trim(), ligne: i + 1, forme: "html" });
    }
    precedente = estParagraphe(l) || (precedente !== null && indentee) ? l : null;
  }
  return out;
}

/**
 * LES TITRES DE NIVEAU 1 INTERDITS, en phrases de refus — la ligne EXACTE et le geste qui lève
 * le refus (§118.30). Plusieurs : les trois premiers sont nommés, le reste est compté.
 */
export function refusTitresNiveau1(md: string): string[] {
  const h1 = titres(md).filter((t) => t.niveau === 1);
  if (h1.length === 0) return [];
  const cites = h1.slice(0, 3).map((t) => {
    const forme = t.forme === "diese" ? `« # ${t.texte} »` : t.forme === "souligne" ? `« ${t.texte} » souligné de « === »` : `la balise « <h1> »`;
    return `ligne ${t.ligne} : ${forme}`;
  });
  const reste = h1.length > 3 ? ` (et ${h1.length - 3} autre${h1.length - 3 > 1 ? "s" : ""})` : "";
  return [
    `Le corps contient ${h1.length > 1 ? `${h1.length} titres` : "un titre"} de niveau 1 — ${cites.join(" ; ")}${reste}. `
    + "Le titre de l'article le fournit déjà : remplacez « # » par « ## », et « ## » par « ### » en dessous.",
  ];
}

/** LE SOMMAIRE que le site construira : les `##`, et les `###` en sous-niveau. */
export function sommaire(md: string): { niveau: 2 | 3; texte: string; ligne: number }[] {
  return titres(md)
    .filter((t): t is TitreMarkdown & { niveau: 2 | 3 } => t.niveau === 2 || t.niveau === 3)
    .map((t) => ({ niveau: t.niveau, texte: t.texte, ligne: t.ligne }));
}

/** Mots et minutes de lecture (200 mots/minute) — une estimation pour l'auteur ; le site calcule la sienne. */
export function lecture(md: string): { mots: number; minutes: number } {
  const brut = md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_`~-]/g, " ");
  const mots = brut.split(/\s+/).filter((m) => /[\p{L}\p{N}]/u.test(m)).length;
  return { mots, minutes: mots === 0 ? 0 : Math.max(1, Math.ceil(mots / 200)) };
}

// ───────────────────────────── L'aperçu structuré ─────────────────────────────

export type Segment =
  | { t: "texte"; v: string }
  | { t: "gras"; v: string }
  | { t: "italique"; v: string }
  | { t: "code"; v: string }
  | { t: "lien"; v: string; href: string };

export type BlocApercu =
  | { t: "titre"; niveau: number; segments: Segment[] }
  | { t: "paragraphe"; segments: Segment[] }
  | { t: "liste"; ordonnee: boolean; elements: Segment[][] }
  | { t: "citation"; segments: Segment[] }
  | { t: "code"; texte: string }
  | { t: "separateur" };

/**
 * UN LIEN N'EST SUIVI QUE S'IL EST SÛR : web, courriel, ancre, chemin du site. Le reste (dont
 * `javascript:` et `data:`) est rendu comme du TEXTE — visible, donc corrigeable par l'auteur,
 * et inerte.
 */
export function lienSur(href: string): boolean {
  const h = href.trim();
  return /^https?:\/\/[^\s]+$/i.test(h) || /^mailto:[^\s]+$/i.test(h) || /^\/(?!\/)[^\s]*$/.test(h) || /^#[^\s]*$/.test(h);
}

const JETON = /(\*\*[^*\n]+\*\*|__[^_\n]+__|`[^`\n]+`|\[[^\]\n]+\]\([^)\s]+\)|\*[^*\s][^*\n]*\*|_[^_\s][^_\n]*_)/;

export function segments(texte: string): Segment[] {
  const out: Segment[] = [];
  let reste = texte;
  while (reste.length > 0) {
    const m = JETON.exec(reste);
    if (!m) { out.push({ t: "texte", v: reste }); break; }
    if (m.index > 0) out.push({ t: "texte", v: reste.slice(0, m.index) });
    const j = m[0];
    if (j.startsWith("**") || j.startsWith("__")) out.push({ t: "gras", v: j.slice(2, -2) });
    else if (j.startsWith("`")) out.push({ t: "code", v: j.slice(1, -1) });
    else if (j.startsWith("[")) {
      const lien = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(j)!;
      if (lienSur(lien[2]!)) out.push({ t: "lien", v: lien[1]!, href: lien[2]!.trim() });
      else out.push({ t: "texte", v: j });
    } else out.push({ t: "italique", v: j.slice(1, -1) });
    reste = reste.slice(m.index + j.length);
  }
  return out;
}

const REGLE = /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/;
const PUCE = /^\s*[-*+]\s+(.*)$/;
const NUMERO = /^\s*\d{1,9}[.)]\s+(.*)$/;

/** L'APERÇU d'un corps : des blocs typés, jamais du HTML. */
export function apercu(md: string): BlocApercu[] {
  const blocs: BlocApercu[] = [];
  const ls = lignesDe(md);
  let paragraphe: string[] = [];
  type ListeEnCours = { ordonnee: boolean; elements: string[] } | null;
  let liste: ListeEnCours = null;
  let citation: string[] = [];

  const vider = () => {
    if (paragraphe.length) { blocs.push({ t: "paragraphe", segments: segments(paragraphe.join(" ").trim()) }); paragraphe = []; }
    if (liste) { blocs.push({ t: "liste", ordonnee: liste.ordonnee, elements: liste.elements.map((e) => segments(e)) }); liste = null; }
    if (citation.length) { blocs.push({ t: "citation", segments: segments(citation.join(" ").trim()) }); citation = []; }
  };

  for (let i = 0; i < ls.length; i += 1) {
    const l = ls[i]!;
    const fence = FENCE.exec(l);
    if (fence) {
      vider();
      const code: string[] = [];
      i += 1;
      while (i < ls.length && !(ls[i]!.trim().startsWith(fence[1]!.slice(0, 3)) && ls[i]!.trim().replace(/[`~]/g, "") === "")) {
        code.push(ls[i]!);
        i += 1;
      }
      blocs.push({ t: "code", texte: code.join("\n") });
      continue;
    }
    if (l.trim() === "") { vider(); continue; }
    const atx = ATX.exec(l);
    if (atx) {
      vider();
      const texte = (atx[2] ?? "").replace(/[ \t]+#+[ \t]*$/, "").trim();
      blocs.push({ t: "titre", niveau: atx[1]!.length, segments: segments(texte) });
      continue;
    }
    if (paragraphe.length && (SETEXT_1.test(l) || SETEXT_2.test(l))) {
      const texte = paragraphe.join(" ").trim();
      paragraphe = [];
      vider();
      blocs.push({ t: "titre", niveau: SETEXT_1.test(l) ? 1 : 2, segments: segments(texte) });
      continue;
    }
    if (REGLE.test(l)) { vider(); blocs.push({ t: "separateur" }); continue; }
    const puce = PUCE.exec(l);
    const numero = NUMERO.exec(l);
    if (puce || numero) {
      const ordonnee = Boolean(numero && !puce);
      if (paragraphe.length || citation.length) { const l2: ListeEnCours = liste; liste = null; vider(); liste = l2; }
      if (liste && liste.ordonnee !== ordonnee) vider();
      if (!liste) liste = { ordonnee, elements: [] };
      liste.elements.push(((puce ?? numero)![1] ?? "").trim());
      continue;
    }
    if (CITATION.test(l)) {
      if (paragraphe.length || liste) vider();
      citation.push(l.replace(/^\s*>\s?/, ""));
      continue;
    }
    if (liste) {
      // Une ligne indentée sous une puce la prolonge ; sinon la liste est finie.
      if (/^\s{2,}\S/.test(l) && liste.elements.length) { liste.elements[liste.elements.length - 1] += ` ${l.trim()}`; continue; }
      vider();
    }
    if (citation.length) vider();
    paragraphe.push(l.trim());
  }
  vider();
  return blocs;
}
