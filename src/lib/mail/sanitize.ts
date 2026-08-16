/**
 * LE CORPS D'UN MAIL EST DU CODE ÉCRIT PAR UN INCONNU.
 *
 * C'est la surface d'attaque la plus évidente d'une messagerie : n'importe qui sur Terre peut
 * envoyer du HTML à une boîte de l'entreprise, et ce HTML sera affiché dans une application qui,
 * elle, contient les dossiers réglementaires, la paie et les contrats. Un `<script>` qui s'exécute
 * dans ce contexte lit la session.
 *
 * Deux protections, et il faut les DEUX :
 *   1. **assainir** — c'est ce module : on retire tout ce qui exécute, charge ou pointe ailleurs ;
 *   2. **isoler** — l'écran rend le résultat dans une `iframe sandbox`, sans même la permission de
 *      lancer des scripts. Assainir seul serait parier qu'on n'a rien oublié.
 *
 * On travaille par LISTE BLANCHE : tout ce qui n'est pas explicitement autorisé disparaît. Une
 * liste noire est toujours en retard d'une astuce.
 *
 * Module PUR — testé.
 */

/** Balises conservées : de la mise en forme, jamais du comportement. */
const ALLOWED_TAGS = new Set([
  "p", "br", "div", "span", "a", "b", "strong", "i", "em", "u", "s", "sub", "sup",
  "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "pre", "code",
  "ul", "ol", "li", "dl", "dt", "dd",
  "table", "thead", "tbody", "tfoot", "tr", "td", "th", "caption", "col", "colgroup",
  "hr", "img", "figure", "figcaption", "small",
]);

/**
 * Balises dont on retire le CONTENU aussi, pas seulement les chevrons.
 *
 * Retirer `<script>` en laissant `alert(1)` afficherait le code à l'écran ; c'est laid, mais
 * surtout `<style>` laissé en texte casserait la mise en page. Pour ces quatre-là, tout part.
 */
const DROP_WITH_CONTENT = ["script", "style", "iframe", "object", "embed", "noscript", "template", "svg", "math"];

/** Attributs conservés, par balise. Tout le reste tombe — y compris chaque `on…`. */
const ALLOWED_ATTRS: Record<string, Set<string>> = {
  a: new Set(["href", "title"]),
  img: new Set(["src", "alt", "title", "width", "height"]),
  td: new Set(["colspan", "rowspan", "align"]),
  th: new Set(["colspan", "rowspan", "align"]),
  "*": new Set(["dir", "lang"]),
};

/** Schémas d'URL admis. `javascript:` et `data:` (hors images) exécutent ou exfiltrent. */
function safeUrl(raw: string, allowData: boolean): string | null {
  const v = raw.trim().replace(/[\u0000-\u001F\u007F]/g, "");
  if (/^https?:\/\//i.test(v)) return v;
  if (/^mailto:/i.test(v)) return v;
  if (/^cid:/i.test(v)) return v; // image intégrée : résolue plus tard, jamais chargée telle quelle
  if (allowData && /^data:image\/(png|jpe?g|gif|webp);base64,[a-z0-9+/=\s]+$/i.test(v)) return v;
  return null;
}

function escapeText(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Assainit un corps HTML de message.
 *
 * L'analyse est volontairement simple et défensive : on ne cherche pas à réparer du HTML tordu, on
 * garde ce qu'on reconnaît. Un mail mal formé s'affiche appauvri — jamais dangereux.
 */
export function sanitizeMailHtml(input: string | null | undefined): string {
  if (!input) return "";
  let html = String(input);

  // 1. Commentaires (dont les commentaires conditionnels d'Outlook, qui peuvent cacher du balisage).
  html = html.replace(/<!--[\s\S]*?-->/g, "");

  // 2. Balises dangereuses AVEC leur contenu.
  for (const tag of DROP_WITH_CONTENT) {
    html = html.replace(new RegExp(`<${tag}\\b[\\s\\S]*?<\\/${tag}\\s*>`, "gi"), "");
    html = html.replace(new RegExp(`<${tag}\\b[^>]*\\/?>`, "gi"), "");
  }

  // 3. Chaque balise restante est réécrite depuis zéro, avec ses seuls attributs autorisés.
  html = html.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g, (_m, rawName: string, rawAttrs: string) => {
    const name = rawName.toLowerCase();
    if (!ALLOWED_TAGS.has(name)) return "";
    if (_m.startsWith("</")) return `</${name}>`;

    const allowed = ALLOWED_ATTRS[name] ?? new Set<string>();
    const common = ALLOWED_ATTRS["*"];
    const kept: string[] = [];

    const attrRe = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/g;
    let m: RegExpExecArray | null;
    while ((m = attrRe.exec(rawAttrs)) !== null) {
      const attr = m[1].toLowerCase();
      const value = m[3] ?? m[4] ?? m[5] ?? "";
      // `on*` : toute la famille des gestionnaires d'évènement, d'un coup et sans exception.
      if (attr.startsWith("on")) continue;
      if (!allowed.has(attr) && !common.has(attr)) continue;
      if (attr === "href" || attr === "src") {
        const url = safeUrl(value, attr === "src");
        if (!url) continue;
        kept.push(`${attr}="${escapeText(url).replace(/"/g, "&quot;")}"`);
        continue;
      }
      kept.push(`${attr}="${escapeText(value).replace(/"/g, "&quot;")}"`);
    }

    // Un lien assaini s'ouvre dans un nouvel onglet, sans donner la main à la page d'arrivée.
    if (name === "a") kept.push('target="_blank"', 'rel="noopener noreferrer nofollow"');
    return `<${name}${kept.length ? ` ${kept.join(" ")}` : ""}>`;
  });

  return html;
}

/** Version texte d'un corps HTML — pour l'aperçu de liste et pour citer dans une réponse. */
export function htmlToText(html: string | null | undefined): string {
  if (!html) return "";
  return String(html)
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style)\b[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
