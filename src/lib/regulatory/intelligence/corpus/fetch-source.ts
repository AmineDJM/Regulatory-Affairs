import { createHash } from "node:crypto";
import { extractText } from "@/lib/regulatory/intelligence/extract/extract-text";
import { splitIntoSections, type ImportedSection } from "./import";
import type { CatalogSource } from "./catalog";

/**
 * TÉLÉCHARGEMENT ET LECTURE D'UNE SOURCE RÉGLEMENTAIRE.
 *
 * Les sources ne se ressemblent pas : l'ANPP publie des PDF derrière une page « Télécharger »,
 * l'ICH sert des PDF directs, l'EMA rend des pages HTML dont il faut extraire l'article. On
 * traite donc trois cas, dans cet ordre :
 *   1. **PDF direct** → extraction du texte ;
 *   2. **DOCX** → extraction du texte ;
 *   3. **page HTML** → on cherche d'abord un lien de téléchargement PDF ; à défaut, on lit le
 *      texte de la page.
 *
 * ⚠️ Cette fonction n'écrit RIEN en base et n'approuve rien. Elle rapporte ce qu'elle a lu, avec
 * l'empreinte du contenu. L'activation d'une version reste une décision humaine (le corpus a
 * déjà son circuit d'approbation) : une ligne directrice qui fait foi ne s'active pas toute seule.
 */

export interface FetchedSource {
  ok: boolean;
  /** URL réellement lue (peut différer si un lien PDF a été suivi). */
  finalUrl?: string;
  contentType?: string;
  /** Empreinte du CONTENU : c'est elle qui dit si le document a changé depuis la dernière fois. */
  sha256?: string;
  text?: string;
  sections?: ImportedSection[];
  bytes?: number;
  error?: string;
}

const UA = "AMD-Internal-OS/1.0 (veille réglementaire Adventum Pharma)";
const MAX_BYTES = 80 * 1024 * 1024; // 80 Mo : au-delà, ce n'est plus une ligne directrice

/**
 * Cherche dans une page HTML le lien de téléchargement du PDF.
 *
 * L'ANPP place le fichier derrière un bouton « Télécharger » : la page elle-même ne contient
 * pas le texte réglementaire. Sans cette étape, on indexerait un menu de site au lieu d'une
 * ligne directrice. Fonction PURE — testée sans réseau.
 */
export function findPdfLink(html: string, baseUrl: string): string | null {
  const candidates: string[] = [];
  // 1) Liens dont l'URL finit par .pdf
  for (const m of html.matchAll(/href\s*=\s*["']([^"']+\.pdf(?:\?[^"']*)?)["']/gi)) candidates.push(m[1]);
  // 2) Liens de téléchargement typiques de l'ANPP (/download/…)
  for (const m of html.matchAll(/href\s*=\s*["']([^"']*\/download\/[^"']+)["']/gi)) candidates.push(m[1]);
  // 3) Liens dont le libellé contient « Télécharger »
  for (const m of html.matchAll(/<a[^>]+href\s*=\s*["']([^"']+)["'][^>]*>(?:(?!<\/a>).)*t[ée]l[ée]charger(?:(?!<\/a>).)*<\/a>/gis)) {
    candidates.push(m[1]);
  }
  if (candidates.length === 0) return null;

  // On préfère un vrai .pdf, sinon le premier lien de téléchargement.
  const best = candidates.find((c) => /\.pdf(\?|$)/i.test(c)) ?? candidates[0];
  try {
    return new URL(best, baseUrl).toString();
  } catch {
    return null;
  }
}

/** Extension déduite du type MIME et de l'URL — l'un rattrape l'autre quand il est absent. */
export function extOf(url: string, contentType: string): string {
  const ct = contentType.toLowerCase();
  if (ct.includes("pdf")) return "pdf";
  if (ct.includes("wordprocessingml") || ct.includes("msword")) return "docx";
  if (ct.includes("spreadsheet") || ct.includes("excel")) return "xlsx";
  if (ct.includes("html")) return "html";
  const m = url.toLowerCase().match(/\.([a-z0-9]{2,5})(?:\?|$)/);
  return m ? m[1] : "html";
}

/**
 * Réduit une page HTML à son texte lisible. On retire d'abord scripts, styles, navigation et
 * pieds de page : sans cela, le corpus se remplirait de menus et le RAG remonterait des liens.
 * Fonction PURE — testée.
 */
export function htmlToText(html: string): string {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<nav\b[\s\S]*?<\/nav>/gi, " ")
    .replace(/<header\b[\s\S]*?<\/header>/gi, " ")
    .replace(/<footer\b[\s\S]*?<\/footer>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, "\n")
    // Balises en tenant compte des attributs entre guillemets : un attribut peut contenir un
    // « > » (data-*, JSON inline). Sans cela, la fin de l'attribut se retrouverait dans le texte
    // du corpus, et le RAG citerait du balisage.
    .replace(/<[a-zA-Z!/?][^>"']*(?:(?:"[^"]*"|'[^']*')[^>"']*)*>/g, " ")
    .replace(/<[^>]+>/g, " ") // filet : balise malformée
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCharCode(Number(d)))
    .replace(/[ \t]+/g, " ")
    // Chaque ligne est nettoyée de son indentation HTML : sans cela, le découpage en sections
    // verrait des titres décalés et ne les reconnaîtrait pas.
    .split("\n").map((l) => l.trim()).join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function get(url: string): Promise<{ ok: boolean; status: number; buffer?: Buffer; contentType: string; finalUrl: string; error?: string }> {
  try {
    const res = await fetch(url, {
      headers: { "user-agent": UA, accept: "application/pdf,application/octet-stream,text/html;q=0.9,*/*;q=0.8" },
      redirect: "follow",
      signal: AbortSignal.timeout(120_000),
    });
    const contentType = res.headers.get("content-type") ?? "";
    if (!res.ok) return { ok: false, status: res.status, contentType, finalUrl: res.url || url, error: `HTTP ${res.status}` };
    const ab = await res.arrayBuffer();
    if (ab.byteLength > MAX_BYTES) return { ok: false, status: res.status, contentType, finalUrl: res.url || url, error: "Fichier trop volumineux." };
    return { ok: true, status: res.status, buffer: Buffer.from(ab), contentType, finalUrl: res.url || url };
  } catch (err) {
    console.error("[corpus] téléchargement impossible", url, err);
    return { ok: false, status: 0, contentType: "", finalUrl: url, error: "Réseau inaccessible ou délai dépassé." };
  }
}

/**
 * Télécharge une source et en tire son texte découpé en sections.
 * Ne lève jamais : tout échec revient en résultat structuré.
 */
export async function fetchSource(source: Pick<CatalogSource, "code" | "url" | "ingestible">): Promise<FetchedSource> {
  if (!source.ingestible) {
    return { ok: false, error: "Source sous licence ou page d'index : elle est référencée, jamais ingérée." };
  }

  const first = await get(source.url);
  if (!first.ok || !first.buffer) return { ok: false, error: first.error ?? "Téléchargement impossible." };

  let buffer: Buffer = first.buffer;
  let finalUrl = first.finalUrl;
  let contentType = first.contentType;
  let ext = extOf(finalUrl, contentType);

  // Page HTML → suivre le lien de téléchargement, sinon on indexerait un menu de site.
  if (ext === "html") {
    const pdf = findPdfLink(buffer.toString("utf8"), finalUrl);
    if (pdf && pdf !== finalUrl) {
      const second = await get(pdf);
      if (second.ok && second.buffer) {
        buffer = second.buffer;
        finalUrl = second.finalUrl;
        contentType = second.contentType;
        ext = extOf(finalUrl, contentType);
      }
    }
  }

  let text = "";
  try {
    if (ext === "html") {
      text = htmlToText(buffer.toString("utf8"));
    } else {
      const extracted = await extractText(ext, buffer);
      text = extracted.text ?? "";
    }
  } catch (e) {
    console.error("[corpus] extraction impossible", source.code, e);
    return { ok: false, error: "Le document a été téléchargé mais n'a pas pu être lu." };
  }

  const clean = text.trim();
  if (clean.length < 500) {
    return { ok: false, error: `Contenu trop court (${clean.length} caractères) : le document n'a probablement pas été atteint.` };
  }

  return {
    ok: true,
    finalUrl,
    contentType,
    sha256: createHash("sha256").update(clean).digest("hex"),
    text: clean,
    sections: splitIntoSections(clean),
    bytes: buffer.length,
  };
}
