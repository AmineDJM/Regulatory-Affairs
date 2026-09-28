import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * UNE DIRECTIVE DE LINT QUI NOMME UNE RÈGLE ABSENTE BLOQUE TOUT DÉPLOIEMENT (§118.155).
 *
 * Render construit par `npm run build:render`, c'est-à-dire `next lint && next build`. Localement,
 * les portes du dépôt lancent `next build`, qui IGNORE le lint (`eslint.ignoreDuringBuilds`) : une
 * erreur de lint ne se voit donc nulle part avant le serveur de déploiement. Mesuré le 28/09 : une
 * seule ligne, posée le 05/09, nommait `no-explicit-any` du plugin TypeScript — que la configuration
 * (`next/core-web-vitals`) ne charge pas. ESLint répond « Definition for rule … was not found »,
 * c'est une ERREUR, `next lint` sort en code 1, et le `&&` arrête le build. 165 commits sont partis
 * vers la branche déployée par-dessus.
 *
 * Le fait sur lequel ce banc s'arme n'est pas une liste écrite à la main : c'est la configuration
 * que CALCULE ESLint lui-même (`calculateConfigForFile`), puis la table des règles de chaque plugin
 * qu'elle charge. Un plugin ajouté demain à `.eslintrc.json` ouvre ses règles ici sans que
 * personne y pense ; un plugin retiré les ferme (§118.17).
 *
 * Ce banc ne remplace pas `next lint` (désormais une porte, CLAUDE.md) : il attrape en une seconde,
 * dans `npm test`, la seule classe d'erreur qui a déjà coûté trois semaines de déploiements.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/** Le dossier que `next lint` parcourt dans ce dépôt — tout le code y vit. */
const RACINE = "src";

/**
 * ESLint 8 ne publie pas ses types (ils vivent dans un paquet `@types` que ce dépôt n'installe pas) :
 * on le charge par `require`, en déclarant la seule surface qu'on emploie. Ajouter une dépendance
 * pour typer un banc serait une empreinte plus large que le besoin (§118.16).
 */
const req = createRequire(join(process.cwd(), "package.json"));
const { ESLint } = req("eslint") as {
  ESLint: new (o: { cwd: string }) => { calculateConfigForFile(fichier: string): Promise<{ plugins?: string[] }> };
};

function fichiers(dir: string): string[] {
  const out: string[] = [];
  for (const nom of readdirSync(dir)) {
    const p = join(dir, nom);
    if (statSync(p).isDirectory()) out.push(...fichiers(p));
    else if (/\.(ts|tsx)$/.test(nom)) out.push(p);
  }
  return out;
}

interface Directive { fichier: string; ligne: number; regle: string }

/**
 * Les directives de CE code. ESLint ne tient un commentaire pour une directive que si son texte
 * COMMENCE par le mot-clé — d'où l'ancre juste après `//` ou `/*` : une phrase qui CITE le mot-clé
 * au milieu d'un commentaire n'en est pas une.
 */
function directives(): Directive[] {
  const motif = /(\/\/|\/\*)[ \t]*eslint-(?:disable|enable)(?:-next-line|-line)?\b([^\n]*)/g;
  const out: Directive[] = [];
  for (const fichier of fichiers(RACINE)) {
    const src = readFileSync(fichier, "utf8");
    for (let m = motif.exec(src); m; m = motif.exec(src)) {
      let reste = m[2];
      if (m[1] === "/*") reste = reste.split("*/")[0];
      // « -- raison » : ESLint lit la justification après deux tirets, elle ne nomme aucune règle.
      reste = reste.split("--")[0];
      const ligne = src.slice(0, m.index).split("\n").length;
      for (const regle of reste.split(",").map((s) => s.trim()).filter(Boolean)) out.push({ fichier, ligne, regle });
    }
  }
  return out;
}

/** Le plugin d'une règle, selon la convention d'ESLint : `@s/r` → `@s`, `@s/n/r` → `@s/n`, `p/r` → `p`. */
function pluginDe(regle: string): string | null {
  const parts = regle.split("/");
  if (parts.length < 2) return null;
  if (parts[0].startsWith("@")) return parts.length >= 3 ? `${parts[0]}/${parts[1]}` : parts[0];
  return parts[0];
}

/** Le paquet d'un plugin, selon la même convention. */
function paquetDe(plugin: string): string {
  if (plugin.startsWith("@")) {
    const [scope, nom] = plugin.split("/");
    return nom ? `${scope}/eslint-plugin-${nom}` : `${scope}/eslint-plugin`;
  }
  return `eslint-plugin-${plugin}`;
}

/** Les règles que la configuration du dépôt connaît réellement — cœur d'ESLint et plugins CHARGÉS. */
async function reglesConnues(): Promise<{ plugins: string[]; existe: (regle: string) => boolean }> {
  const eslint = new ESLint({ cwd: process.cwd() });
  const plugins = new Set<string>();
  // Un .ts et un .tsx : la configuration peut différer selon l'extension (surcharges par motif).
  for (const f of ["src/lib/artifact/pdf/read.ts", "src/components/ui/icon.tsx"]) {
    const cfg = await eslint.calculateConfigForFile(f);
    for (const p of cfg.plugins ?? []) plugins.add(p);
  }
  const depuisConfigNext = dirname(req.resolve("eslint-config-next/package.json"));
  const tables = new Map<string, Set<string>>();
  for (const p of plugins) {
    let chemin: string;
    try { chemin = req.resolve(paquetDe(p)); } catch { chemin = req.resolve(paquetDe(p), { paths: [depuisConfigNext] }); }
    tables.set(p, new Set(Object.keys((req(chemin) as { rules?: Record<string, unknown> }).rules ?? {})));
  }
  const { builtinRules } = req("eslint/use-at-your-own-risk") as { builtinRules: Map<string, unknown> };
  return {
    plugins: [...plugins],
    existe: (regle) => {
      const plugin = pluginDe(regle);
      if (plugin === null) return builtinRules.has(regle);
      const table = tables.get(plugin);
      return table !== undefined && table.has(regle.slice(plugin.length + 1));
    },
  };
}

describe("les directives de lint ne nomment que des règles que la configuration charge", () => {
  const trouvees = directives();

  it("PRÉMISSE : la configuration calculée charge bien les plugins de Next — sinon tout serait « inconnu »", async () => {
    const { plugins } = await reglesConnues();
    expect(plugins).toContain("@next/next");
    expect(plugins).toContain("react-hooks");
  });

  it("TÉMOIN : le vérificateur sait REFUSER — sans ce cas, un vérificateur qui dit oui à tout serait vert", async () => {
    // Trouvé par sabotage : un `existe` qui rend toujours vrai laissait passer la directive du
    // 05/09 réintroduite, puisque le banc n'avait aucun cas où la réponse attendue est NON.
    // Les deux sens : sans le second, un vérificateur qui dit non à tout passerait pour armé.
    const { existe } = await reglesConnues();
    expect(existe("@typescript-eslint/no-explicit-any"), "la règle du 05/09 : plugin non chargé").toBe(false);
    expect(existe("react-hooks/exhaustive-dep"), "faute de frappe dans un plugin chargé").toBe(false);
    expect(existe("no-control-regexp"), "faute de frappe dans le cœur").toBe(false);
    expect(existe("react-hooks/exhaustive-deps")).toBe(true);
    expect(existe("@next/next/no-img-element")).toBe(true);
    expect(existe("no-control-regex")).toBe(true);
  });

  it("PLANCHER : le parcours trouve les directives du dépôt — sinon il serait vert en ne lisant rien (§118.17)", () => {
    // Mesuré au §118.155 : 34 directives (35 avant le correctif), dans 27 fichiers.
    expect(trouvees.length).toBeGreaterThanOrEqual(25);
  });

  it("aucune directive ne nomme une règle absente — ESLint en ferait une ERREUR, et Render refuserait le build", async () => {
    const { existe } = await reglesConnues();
    const fautives = trouvees
      .filter((d) => !existe(d.regle))
      .map((d) => `${d.fichier}:${d.ligne} → « ${d.regle} » (plugin ${pluginDe(d.regle) ?? "cœur d'ESLint"})`);
    expect(
      fautives,
      "Retirer la directive (la règle n'est pas active, elle ne sert à rien), ou charger son plugin dans .eslintrc.json",
    ).toEqual([]);
  });
});
