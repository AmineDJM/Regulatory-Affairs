import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * GARDE-FOU DU MENU CONTEXTUEL DU DRIVE.
 *
 * Le menu « ⋮ » d'une ligne du Drive est un PORTAIL monté seulement tant qu'il est ouvert :
 *
 *     {open && pos && createPortal(<div …>{children(close)}</div>, document.body)}
 *
 * Tout ce que ce menu rend disparaît donc à la fermeture. Un panneau (`<Sheet>`) rendu par une
 * entrée de menu est ainsi démonté par le clic même qui devait l'ouvrir : on clique, et il ne se
 * passe RIEN. Aucune erreur, aucune trace — l'action est simplement morte.
 *
 * Ce n'est pas théorique : « Déclarer dans Legal » était inopérante depuis sa livraison pour
 * exactement cette raison, pendant que « Renommer », « Déplacer » et « Gérer l'accès »
 * fonctionnaient — leurs panneaux, eux, sont rendus par la LIGNE.
 *
 * Le test relit le fichier, isole la région du menu, et refuse tout composant qui y rendrait un
 * panneau. Le typecheck ne peut pas voir cela, et l'écran ne le signale pas.
 */

const NODE_ACTIONS = path.join(process.cwd(), "src/app/(app)/drive/node-actions.tsx");
const DRIVE_DIR = path.dirname(NODE_ACTIONS);

/** Le corps du `<Kebab>` : tout ce qui est monté DANS le portail. */
function kebabRegion(src: string): string {
  const start = src.indexOf("<Kebab");
  const end = src.indexOf("</Kebab>");
  if (start === -1 || end === -1) throw new Error("Le menu <Kebab> a disparu de node-actions.tsx — ce garde-fou doit être revu.");
  return src.slice(start, end);
}

/** Les composants (majuscule) rendus dans une région JSX. */
function componentsIn(region: string): string[] {
  return [...new Set([...region.matchAll(/<([A-Z][A-Za-z0-9_]*)/g)].map((m) => m[1]))];
}

/** Le fichier local d'où vient un composant importé, s'il est local. */
function localSourceOf(src: string, component: string): string | null {
  const re = new RegExp(`import\\s*\\{[^}]*\\b${component}\\b[^}]*\\}\\s*from\\s*["']([^"']+)["']`);
  const spec = src.match(re)?.[1];
  if (!spec || !spec.startsWith(".")) return null;
  const base = path.resolve(DRIVE_DIR, spec);
  for (const cand of [`${base}.tsx`, `${base}.ts`, path.join(base, "index.tsx")]) {
    if (existsSync(cand)) return cand;
  }
  return null;
}

describe("Menu du Drive — rien de ce qui doit SURVIVRE au clic ne peut vivre dans le portail", () => {
  const src = readFileSync(NODE_ACTIONS, "utf8");

  it("le menu est bien un portail démonté à la fermeture (l'hypothèse du test tient)", () => {
    expect(src).toContain("createPortal");
    expect(src).toMatch(/\{open && pos &&/);
  });

  it("aucun panneau n'est rendu DIRECTEMENT dans le menu", () => {
    expect(kebabRegion(src)).not.toContain("<Sheet");
  });

  it("aucun composant rendu dans le menu ne rend un panneau de son côté", () => {
    const region = kebabRegion(src);
    const offenders = componentsIn(region)
      .map((name) => ({ name, file: localSourceOf(src, name) }))
      .filter((c) => c.file && readFileSync(c.file, "utf8").includes("<Sheet"))
      .map((c) => `${c.name} (${path.relative(process.cwd(), c.file as string)})`);

    expect(
      offenders,
      `Ce(s) composant(s) rendent un <Sheet> DEPUIS le menu contextuel : le clic qui ferme le menu\n` +
        `les démonte, et l'action ne fait rien du tout. Rendez le panneau depuis la LIGNE\n` +
        `(NodeActions), comme « Renommer » et « Gérer l'accès ».\n\n  ${offenders.join("\n  ")}\n`,
    ).toEqual([]);
  });

  it("le panneau « Déclarer dans Legal » est bien rendu par la ligne", () => {
    const afterKebab = src.slice(src.indexOf("</Kebab>"));
    expect(afterKebab).toContain("<SendToLegalSheet");
  });
});
