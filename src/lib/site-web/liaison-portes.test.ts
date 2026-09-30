import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LES PORTES DE LA LIAISON AU SITE (§118.159) — tenues sur la SOURCE, parce qu'aucun banc
 * d'exécution ne voit la route qu'on ajoutera demain.
 *
 *   1. Les routes que le SITE appelle (`/api/site-web/v1/…`) vivent HORS de la session : elles
 *      sont exemptées dans `auth.config.ts`. Leur seule porte est `authentifierLeSite`, donc
 *      CHAQUE handler doit l'appeler avant de toucher la base ou le corps. Une route ajoutée sous
 *      ce dossier sans elle serait une écriture publique dans l'ERP.
 *   2. L'exemption du middleware est EXACTE : `/api/site-web/v1/`, barre finale comprise. Le CV
 *      d'une candidature (`/api/site-web/candidatures/…`) reste derrière la session.
 *   3. La valeur d'une clé ne quitte pas la couche serveur de la liaison : seuls les modules de
 *      `lib/site-web/` la lisent, plus l'écran « Site web » — et lui seulement pour le Super Admin,
 *      sur une clé EN ATTENTE. Un composant ou un autre écran qui l'importerait l'afficherait.
 *
 * On lit la source SANS ses commentaires : quatre fois dans ce dépôt un cliquet s'est accroché à
 * la prose qui le décrivait (§118.79d, §118.88, §118.112b, §118.138).
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const RACINE = process.cwd();

function sansCommentaires(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:\\"'`])\/\/[^\n]*/g, "$1");
}

function fichiers(dossier: string, filtre: (f: string) => boolean): string[] {
  const abs = join(RACINE, dossier);
  const out: string[] = [];
  const parcourir = (d: string) => {
    for (const nom of readdirSync(d)) {
      const p = join(d, nom);
      if (statSync(p).isDirectory()) parcourir(p);
      else if (filtre(p)) out.push(relative(RACINE, p));
    }
  };
  parcourir(abs);
  return out.sort();
}

const lire = (f: string) => sansCommentaires(readFileSync(join(RACINE, f), "utf8"));

/** Le corps de chaque handler HTTP exporté (`export async function GET(`…) jusqu'au suivant. */
function handlers(src: string): { nom: string; corps: string }[] {
  const re = /export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE)\s*\(/g;
  const pos = [...src.matchAll(re)].map((m) => ({ nom: m[1]!, debut: m.index! }));
  return pos.map((p, i) => ({ nom: p.nom, corps: src.slice(p.debut, pos[i + 1]?.debut ?? src.length) }));
}

/** Les fonctions importées de `@/lib/…` (hors la porte elle-même et les constantes). */
function importsDeLib(src: string): string[] {
  const noms: string[] = [];
  for (const m of src.matchAll(/import\s*\{([^}]*)\}\s*from\s*"@\/lib\/[^"]+"/g)) {
    for (const brut of m[1]!.split(",")) {
      const nom = brut.replace(/\btype\b/, "").split(/\s+as\s+/).pop()!.trim();
      if (nom && /^[a-z]/.test(nom)) noms.push(nom);
    }
  }
  return noms.filter((n) => n !== "authentifierLeSite");
}

describe("Les routes que le site appelle", () => {
  const routes = fichiers("src/app/api/site-web/v1", (f) => f.endsWith("route.ts"));

  it("PLANCHER : les routes sont trouvées (un parcours cassé rendrait le cliquet vert en ne lisant rien)", () => {
    expect(routes.length, routes.join(", ")).toBeGreaterThanOrEqual(2);
  });

  it("chaque handler appelle authentifierLeSite AVANT la base, le corps analysé ou toute autre fonction de l'ERP", () => {
    const fautes: string[] = [];
    let vus = 0;
    for (const f of routes) {
      const src = lire(f);
      const autres = importsDeLib(src);
      for (const h of handlers(src)) {
        vus += 1;
        const porte = h.corps.indexOf("authentifierLeSite(");
        if (porte < 0) { fautes.push(`${f} ${h.nom} : aucune authentification`); continue; }
        const avant = h.corps.slice(0, porte);
        for (const interdit of ["prisma.", "JSON.parse(", ...autres.map((n) => `${n}(`)]) {
          if (avant.includes(interdit)) fautes.push(`${f} ${h.nom} : « ${interdit} » avant la porte`);
        }
        // Le refus doit ARRÊTER le handler : le résultat est lu et rendu tel quel.
        if (!/if\s*\(\s*!auth\.ok\s*\)\s*return/.test(h.corps)) fautes.push(`${f} ${h.nom} : le refus de la porte n'arrête pas le handler`);
      }
    }
    expect(vus).toBeGreaterThanOrEqual(2);
    expect(fautes, fautes.join("\n")).toEqual([]);
  });

  it("l'exemption du middleware est EXACTE — `/api/site-web/v1/`, barre finale comprise, et rien d'autre du module", () => {
    const conf = lire("src/auth.config.ts");
    const exemptions = [...conf.matchAll(/startsWith\("(\/api\/site-web[^"]*)"\)/g)].map((m) => m[1]);
    expect(exemptions).toEqual(["/api/site-web/v1/"]);
  });

  it("hors de `v1/`, chaque route du module est derrière la SESSION", () => {
    const autres = fichiers("src/app/api/site-web", (f) => f.endsWith("route.ts") && !f.includes("/site-web/v1/"));
    expect(autres.length).toBeGreaterThanOrEqual(1);
    const fautes = autres.filter((f) => !/\b(getCurrentUser|requireUser)\s*\(/.test(lire(f)));
    expect(fautes, fautes.join("\n")).toEqual([]);
  });
});

describe("La valeur d'une clé ne quitte pas la couche serveur", () => {
  const LECTEURS = /\b(cleEnAttente|cleActive)\b/;
  const importeurs = fichiers("src", (f) => /\.(ts|tsx)$/.test(f) && !/\.test\.tsx?$/.test(f))
    .filter((f) => {
      const src = lire(f);
      return /from\s*"(@\/lib\/site-web\/cles|\.\/cles)"/.test(src) && LECTEURS.test(src.match(/import\s*\{[^}]*\}\s*from\s*"(?:@\/lib\/site-web\/cles|\.\/cles)"/)?.[0] ?? "");
    });

  it("seuls les modules de `lib/site-web/` et l'écran « Site web » lisent une clé", () => {
    const hors = importeurs.filter((f) => !f.startsWith("src/lib/site-web/") && f !== "src/app/(app)/site-web/page.tsx");
    expect(hors, hors.join("\n")).toEqual([]);
    // PRÉMISSE : l'écran est bien trouvé — sans quoi la règle suivante ne mesurerait rien.
    expect(importeurs).toContain("src/app/(app)/site-web/page.tsx");
  });

  it("l'écran ne relit la clé EN ATTENTE que pour le Super Admin — jamais la clé active", () => {
    const page = lire("src/app/(app)/site-web/page.tsx");
    expect(page).not.toMatch(/\bcleActive\s*\(/);
    const appel = page.indexOf("cleEnAttente(");
    expect(appel).toBeGreaterThan(-1);
    const avant = page.slice(0, appel);
    const garde = avant.lastIndexOf("if (gere && liaison.attente)");
    expect(garde, "la lecture de la clé doit être dans le bloc gardé").toBeGreaterThan(-1);
    // Rien ne ferme le bloc entre la garde et l'appel.
    expect(avant.slice(garde).split("{").length - avant.slice(garde).split("}").length).toBeGreaterThanOrEqual(1);
    expect(page).toMatch(/const\s+gere\s*=\s*peutGererLaLiaison\(user\)/);
  });

  it("aucun composant ne reçoit une clé : la carte ne prend que le bloc, déjà composé côté serveur", () => {
    const carte = lire("src/app/(app)/site-web/carte-liaison.tsx");
    expect(carte).not.toMatch(/from\s*"@\/lib\/site-web\/cles"/);
    const composants = fichiers("src/components", (f) => /\.(ts|tsx)$/.test(f));
    const fautes = composants.filter((f) => /from\s*"@\/lib\/site-web\/cles"/.test(lire(f)));
    expect(fautes, fautes.join("\n")).toEqual([]);
  });
});
