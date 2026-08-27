import { MAX_MENTIONS_PER_ITEM } from "./contract";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * REPÉRER LES MENTIONS — du code, pas un modèle.
 *
 * ── POURQUOI AUCUN MODÈLE ICI ────────────────────────────────────────────────────────────
 *
 * §2 : « ne jamais appeler un modèle pour une donnée que le code sait déjà comprendre ». Repérer
 * « les suites de mots capitalisés, les sigles et les références » est de la reconnaissance de
 * forme — un modèle ferait la même chose, plus lentement, contre facturation, et avec le droit
 * d'inventer un nom qui n'est pas dans le texte.
 *
 * ── CE QUE CETTE FONCTION EST AUTORISÉE À FAIRE DE TRAVERS ───────────────────────────────
 *
 * Sur-repérer. Elle rend des candidats, pas des faits : « Monsieur », « Cordialement » ou un
 * début de phrase capitalisé sortiront d'ici, et ne résoudront vers RIEN — coût : une lecture
 * d'index, déjà dédoublonnée. L'erreur inverse serait grave : une mention manquée est un lien
 * qui n'existera jamais, et personne ne saura qu'il manque.
 *
 * ── CE QU'ELLE NE FAIT PAS ───────────────────────────────────────────────────────────────
 *
 * Elle ne décide RIEN. Le rapprochement appartient au résolveur, l'écriture d'un lien à
 * l'appelant, et le seuil de certitude au contrat. Ici, on lit du texte et on rend des chaînes.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/**
 * Mots qui commencent une phrase ou une formule et se retrouvent capitalisés sans désigner
 * personne. Les écarter tôt évite d'aller les chercher en base des milliers de fois.
 *
 * La liste reste COURTE et grammaticale — jamais des noms propres. Retirer ici « Sanofi » parce
 * qu'il revient souvent reviendrait à décider, dans un fichier d'analyse de texte, ce dont
 * l'entreprise a le droit de parler.
 */
const NOISE = new Set([
  "le", "la", "les", "un", "une", "des", "du", "de", "au", "aux", "ce", "cet", "cette", "ces",
  "il", "elle", "ils", "elles", "nous", "vous", "je", "tu", "on", "et", "ou", "mais", "donc",
  "monsieur", "madame", "mesdames", "messieurs", "cher", "chere", "chers", "bonjour", "bonsoir",
  "cordialement", "salutations", "merci", "objet", "reference", "date", "page", "annexe",
  "pour", "par", "dans", "sur", "avec", "sans", "sous", "vers", "chez", "afin", "selon",
  "apres", "avant", "depuis", "pendant", "lors", "suite", "concerne", "veuillez", "priere",
  "the", "and", "for", "with", "from", "dear", "regards", "best", "please", "subject",
]);

/**
 * UNE RÉFÉRENCE INTERNE — « REG-2026-041 », « BC-2025-17 ». Un identifiant est le meilleur
 * repère qui soit : unique par construction, insensible à l'orthographe, jamais ambigu.
 */
const REFERENCE_RE = /\b[A-Z]{2,6}[-/]\d{2,4}[-/]\d{1,6}\b/g;

/** UN SIGLE — « ANPP », « CTD », « DCI ». Trois à six capitales, chiffres tolérés à l'intérieur. */
const ACRONYM_RE = /\b[A-Z][A-Z0-9]{2,5}\b/g;

/**
 * UNE SUITE DE MOTS CAPITALISÉS — « Adventum Pharma », « Société Algérienne d'Infectiologie ».
 *
 * Les petits mots de liaison sont AUTORISÉS À L'INTÉRIEUR (« d' », « de », « et ») parce qu'ils
 * appartiennent aux raisons sociales françaises ; couper dessus donnerait « Société Algérienne »
 * puis « Infectiologie », c'est-à-dire deux mentions dont aucune n'est le nom.
 */
const PROPER_RE = /\b[A-ZÀ-Þ][\wÀ-ÿ'’-]*(?:\s+(?:d[eu']|des|et|la|le|von|van|of|&)?\s*[A-ZÀ-Þ][\wÀ-ÿ'’-]*){0,4}/g;

/** Une mention repérée, avec ce qui l'entoure — le contexte sert à contester le lien plus tard. */
export interface Mention {
  text: string;
  /** `reference` est le plus sûr : c'est un identifiant, pas un nom. */
  form: "reference" | "acronym" | "proper";
  /** Combien de fois le texte la cite. Une mention unique dans 40 pages pèse moins qu'un leitmotiv. */
  count: number;
}

/**
 * REPÈRE LES MENTIONS D'UN TEXTE, les plus citées d'abord.
 *
 * L'ordre compte : la borne `MAX_MENTIONS_PER_ITEM` coupe la queue, et il vaut mieux couper les
 * noms cités une fois que ceux qui structurent le document.
 */
export function extractMentions(text: string, max = MAX_MENTIONS_PER_ITEM): Mention[] {
  if (!text) return [];
  const counts = new Map<string, { text: string; form: Mention["form"]; count: number }>();

  const add = (raw: string, form: Mention["form"]) => {
    const t = raw.trim().replace(/[\s,;:.]+$/, "");
    if (t.length < 2) return;
    const key = `${form}:${t.toLowerCase()}`;
    const prev = counts.get(key);
    if (prev) { prev.count += 1; return; }
    counts.set(key, { text: t, form, count: 1 });
  };

  for (const m of text.matchAll(REFERENCE_RE)) add(m[0], "reference");
  for (const m of text.matchAll(ACRONYM_RE)) add(m[0], "acronym");
  for (const m of text.matchAll(PROPER_RE)) {
    const t = m[0].trim();
    // Un mot capitalisé SEUL et grammatical ne désigne personne. Un groupe de plusieurs mots
    // survit même s'il commence par « Le » : « Le Petit Pharmacien » est un nom, pas une phrase.
    const words = t.split(/\s+/);
    if (words.length === 1 && NOISE.has(stripAccents(t.toLowerCase()))) continue;
    add(t, "proper");
  }

  // Une référence bat un sigle, qui bat un nom propre : c'est l'ordre de la CERTITUDE, et il
  // décide qui survit à la coupe quand un document est bavard.
  const rank: Record<Mention["form"], number> = { reference: 0, acronym: 1, proper: 2 };
  return [...counts.values()]
    .sort((a, b) => rank[a.form] - rank[b.form] || b.count - a.count || a.text.localeCompare(b.text))
    .slice(0, max);
}

function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/**
 * LA CONFIANCE D'UNE MENTION, avant même de savoir vers quoi elle pointe.
 *
 * Une référence trouvée dans le texte EST l'objet : rien à interpréter. Un sigle est ambigu par
 * nature. Un nom propre dépend entièrement de ce que le résolveur en fera. Ce facteur multiplie
 * le score de résolution — il ne le remplace pas.
 */
export function mentionConfidence(form: Mention["form"]): number {
  return form === "reference" ? 1 : form === "acronym" ? 0.75 : 0.9;
}
