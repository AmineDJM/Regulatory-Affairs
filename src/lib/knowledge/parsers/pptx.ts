import JSZip from "jszip";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * PPTX — LE FORMAT QUI MANQUAIT.
 *
 * ── POURQUOI IL MANQUAIT, ET CE QUE ÇA COÛTAIT ───────────────────────────────────────────
 *
 * Le parseur lourd du projet ne connaît que `pdf | docx | xlsx`. Une présentation arrivait donc
 * dans l'ERP comme un fichier opaque : invisible à la recherche par contenu, et candidate à la
 * VISION — c'est-à-dire au barreau le plus cher de l'échelle, pour un format dont le texte est
 * pourtant parfaitement lisible par le code.
 *
 * Un .pptx est une archive ZIP. Le texte des diapositives vit dans `ppt/slides/slideN.xml`, les
 * commentaires du présentateur dans `ppt/notesSlides/notesSlideN.xml`. Il n'y a rien à
 * « comprendre » : il y a à ouvrir.
 *
 * ── CE QUE CE PARSEUR REND, ET POURQUOI PAR DIAPOSITIVE ──────────────────────────────────
 *
 * Une diapositive est une unité de sens complète — c'est la frontière que l'auteur a lui-même
 * posée. Rendre un bloc unique interdirait de citer « diapositive 7 », qui est exactement la
 * précision qu'on attend quand on cherche un chiffre dans une présentation de 40 pages.
 *
 * LES NOTES SONT GARDÉES, séparément. Elles disent souvent ce que la diapositive tait (l'ordre
 * de grandeur, la réserve, la source) — les jeter reviendrait à indexer le décor sans le propos.
 *
 * ── CE QU'IL NE FAIT PAS ─────────────────────────────────────────────────────────────────
 *
 * Il ne lit pas les IMAGES d'une diapositive. Une diapositive faite d'un seul graphique rend
 * donc peu de texte : elle est SIGNALÉE comme telle (`visualSlides`), et c'est le routage qui
 * décidera de la regarder — pour celle-là seulement, jamais pour le fichier entier (§8).
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

export interface PptxSlide {
  /** Numéro affiché à l'utilisateur (1-based) — celui qu'il faudra citer. */
  index: number;
  /** Le premier bloc de texte : dans la pratique, le titre neuf fois sur dix. */
  title: string | null;
  text: string;
  notes: string | null;
}

export interface PptxParsed {
  slides: PptxSlide[];
  /** Diapositives dont le texte est trop pauvre pour dire quoi que ce soit — probablement visuelles. */
  visualSlides: string[];
}

/** Sous ce nombre de caractères, une diapositive ne dit rien : elle montre. */
const VISUAL_THRESHOLD = 25;

/**
 * `slide12.xml` → 12. Le tri par NOM de fichier mettrait « slide10 » avant « slide2 » et
 * renverrait une présentation dans le désordre — avec des citations fausses à la clé.
 */
export function slideNumber(path: string): number {
  const m = /(\d+)\.xml$/.exec(path);
  return m ? Number(m[1]) : 0;
}

/**
 * EXTRAIT LE TEXTE D'UN XML OFFICE.
 *
 * `<a:t>` porte les fragments de texte. Un même paragraphe est souvent éclaté en plusieurs
 * fragments (un changement de casse ou de couleur suffit) : on les recolle SANS séparateur à
 * l'intérieur d'un paragraphe `<a:p>`, et on saute une ligne ENTRE les paragraphes. Coller
 * naïvement tous les `<a:t>` avec un espace produirait « P e m b r o l i z u m a b ».
 */
export function textFromSlideXml(xml: string): string {
  const paragraphs = xml.split(/<a:p[\s>]/).slice(1);
  const lines: string[] = [];
  for (const p of paragraphs) {
    const runs = [...p.matchAll(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g)].map((m) => decodeXml(m[1]));
    const line = runs.join("").trim();
    if (line) lines.push(line);
  }
  return lines.join("\n").trim();
}

function decodeXml(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, "&"); // en dernier : sinon « &amp;lt; » se décoderait deux fois
}

/**
 * OUVRE UNE PRÉSENTATION. Ne lève jamais : un fichier corrompu rend une présentation vide, et
 * c'est le routage qui décidera d'aller la regarder — une exception ici ferait échouer toute
 * l'ingestion pour un seul fichier abîmé.
 */
export async function parsePptx(buffer: Buffer): Promise<PptxParsed> {
  try {
    const zip = await JSZip.loadAsync(buffer);

    const slidePaths = Object.keys(zip.files)
      .filter((p) => /^ppt\/slides\/slide\d+\.xml$/.test(p))
      .sort((a, b) => slideNumber(a) - slideNumber(b));

    const slides: PptxSlide[] = [];
    const visualSlides: string[] = [];

    for (const path of slidePaths) {
      const n = slideNumber(path);
      const xml = await zip.file(path)?.async("string");
      if (!xml) continue;
      const text = textFromSlideXml(xml);

      const notesXml = await zip.file(`ppt/notesSlides/notesSlide${n}.xml`)?.async("string");
      // La zone de notes recopie le numéro de diapositive : ce n'est pas une note, c'est du
      // gabarit. On l'écarte, sinon chaque diapositive « note » son propre numéro.
      const notesRaw = notesXml ? textFromSlideXml(notesXml) : "";
      const notes = notesRaw.replace(/^\s*\d+\s*$/gm, "").trim();

      const lines = text.split("\n").filter(Boolean);
      slides.push({
        index: n,
        title: lines[0]?.slice(0, 200) ?? null,
        text,
        notes: notes || null,
      });

      if (text.length < VISUAL_THRESHOLD) visualSlides.push(String(n));
    }

    return { slides, visualSlides };
  } catch {
    return { slides: [], visualSlides: [] };
  }
}

/** Le texte complet, prêt à indexer — la diapositive et ses notes restent distinguables. */
export function pptxToText(parsed: PptxParsed): string {
  return parsed.slides
    .map((s) => {
      const head = `— Diapositive ${s.index}${s.title ? ` : ${s.title}` : ""} —`;
      const body = [s.text, s.notes ? `[Notes] ${s.notes}` : ""].filter(Boolean).join("\n");
      return `${head}\n${body}`.trim();
    })
    .filter((b) => b.length > 0)
    .join("\n\n");
}
