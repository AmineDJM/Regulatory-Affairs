import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * PAS DE `loading.tsx` AU-DESSUS D'UNE PAGE QUI PEUT REDIRIGER — le garde d'une panne mesurée.
 *
 * ── CE QUI S'EST PASSÉ ─────────────────────────────────────────────────────────────────────
 *
 * Un `app/(app)/loading.tsx` a été ajouté pour donner une forme à l'attente. Il enveloppe chaque
 * page dans une frontière Suspense — et sous cette frontière, un `redirect()` de page n'est
 * plus une réponse HTTP : la coque est déjà partie, la redirection voyage dans le flux et le
 * navigateur doit la rejouer à l'hydratation. Sur Next 14.2 en PRODUCTION (pas en
 * développement), cette hydratation d'une frontière tombée en erreur casse la comptabilité des
 * hooks du routeur (« Rendered more hooks than during the previous render », React #310,
 * vercel/next.js#63121). L'audit navigateur a compté vingt-six écrans — `/aujourdhui`,
 * `/finances`, `/medical`, `/office`, `/drive/[id]`, `/regulatory/[id]`… — qui affichaient
 * « Application error » à la place de leur redirection. Le typecheck, le lint, les tests et le
 * build n'ont rien vu : seul le rendu dans un navigateur, sur le build de production, le montre.
 *
 * ── LA RÈGLE ───────────────────────────────────────────────────────────────────────────────
 *
 * Presque toutes nos pages peuvent rediriger : `requireModule` renvoie vers l'écran d'accueil
 * quand le module est masqué ou le droit absent, et les alias d'écran (`/aujourdhui`,
 * `/finances`, `/medical`…) ne font que ça. Un `loading.tsx` n'est donc admis que dans un
 * sous-arbre dont AUCUNE page ne peut rediriger. Le retour visuel de navigation vit dans
 * `components/layout/nav-progress.tsx`, qui n'a besoin d'aucune frontière — et le second test
 * vérifie qu'il est bien MONTÉ dans la coque : une capacité sans appelant n'existe pas (§118-14).
 */

const APP = path.resolve(__dirname, "../../app");

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const PAGE = /^page\.(tsx|ts|jsx|js)$/;
const LOADING = /^loading\.(tsx|ts|jsx|js)$/;

/** Une page peut rediriger si elle appelle `redirect(` elle-même ou passe par la session (qui le fait). */
function peutRediriger(src: string): boolean {
  return /\bredirect\s*\(/.test(src) || /from\s+["']@\/lib\/session["']/.test(src);
}

describe("frontière Suspense et redirections (Next 14.2, vercel/next.js#63121)", () => {
  const fichiers = walk(APP);

  it("aucun loading.tsx n'enveloppe une page capable de redirect()", () => {
    const loadings = fichiers.filter((f) => LOADING.test(path.basename(f)));
    const fautes: string[] = [];
    for (const l of loadings) {
      const racine = path.dirname(l);
      const pages = fichiers.filter((f) => PAGE.test(path.basename(f)) && f.startsWith(racine + path.sep));
      const redirigent = pages.filter((p) => peutRediriger(fs.readFileSync(p, "utf8")));
      if (redirigent.length > 0) {
        fautes.push(`${path.relative(APP, l)} enveloppe ${redirigent.length} page(s) qui peuvent rediriger, dont ${path.relative(APP, redirigent[0])}`);
      }
    }
    expect(fautes, `Un loading.tsx (frontière Suspense) au-dessus d'un redirect() casse la page en production :\n${fautes.join("\n")}`).toEqual([]);
  });

  it("le retour visuel de navigation est monté dans la coque de l'application", () => {
    const layout = fs.readFileSync(path.join(APP, "(app)", "layout.tsx"), "utf8");
    expect(layout).toMatch(/import \{ NavProgress \} from "@\/components\/layout\/nav-progress"/);
    expect(layout).toMatch(/<NavProgress \/>/);
  });

  it("le balayage voit bien les pages de l'application (sinon le garde ne garde rien)", () => {
    const pages = fichiers.filter((f) => PAGE.test(path.basename(f)) && f.includes(`${path.sep}(app)${path.sep}`));
    expect(pages.length).toBeGreaterThan(100);
    // La page témoin de la panne mesurée : un alias d'écran, qui ne fait que rediriger.
    expect(peutRediriger(fs.readFileSync(path.join(APP, "(app)", "aujourdhui", "page.tsx"), "utf8"))).toBe(true);
  });
});
