import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * DEUX LARGEURS SUR LE MÊME ÉLÉMENT — le défaut qui casse un écran SANS RIEN DIRE.
 *
 * ── CE QUI S'EST PASSÉ ──────────────────────────────────────────────────────────────────────
 *
 * Une constante de style partagée portait `w-full` ; l'appel ajoutait `w-16` par-dessus :
 *
 *     const inputCls = "h-8 w-full …";
 *     <input className={`${inputCls} w-16`} />
 *
 * On lit « la dernière classe écrite gagne ». C'est faux : le navigateur applique la dernière
 * RÈGLE de la feuille de style, et Tailwind y émet `w-full` APRÈS `w-16`. Le champ prenait donc
 * toute la ligne, écrasait le nom du produit voisin — `flex-1 truncate`, donc réductible à
 * ZÉRO — et l'écran des affectations n'affichait plus que des rangs « P1 / P2 / P3 » flottant à
 * côté de rien. Sur téléphone, on ne savait plus quel produit était affecté à quel KAM.
 *
 * Rien ne le signalait : ni le typage, ni le lint, ni le build. L'écran s'affichait, simplement
 * il ne disait plus ce qu'il devait dire — le pire genre de panne, celle qu'on impute à la donnée.
 *
 * ── CE QUE CE FICHIER TIENT ─────────────────────────────────────────────────────────────────
 *
 * On ne teste pas « le style est joli » : on interdit la SEULE construction où la collision est
 * invisible et systématique — une constante de classes du même fichier, interpolée dans un
 * `className`, dont le suffixe redéclare la même famille de largeur ou de hauteur.
 *
 * La règle est étroite exprès. `min-w-`, `max-w-` et les variantes conditionnelles (`sm:w-…`,
 * `hover:h-…`) ne collisionnent PAS avec `w-`/`h-` : les signaler ferait un test qu'on
 * désactiverait à la première fausse alerte, et un garde qu'on désactive ne garde rien.
 */

const RACINE = path.join(process.cwd(), "src");

/** La famille d'une classe, pour les seules deux qui cassent une mise en page en silence. */
function familleDeLargeur(cls: string): "w" | "h" | null {
  // Une variante (`sm:`, `hover:`, `dark:`…) est une surcharge VOULUE, sous condition.
  if (cls.includes(":")) return null;
  if (/^w-\S+$/.test(cls)) return "w";
  if (/^h-\S+$/.test(cls)) return "h";
  return null;
}

function famillesDe(classes: string): Set<"w" | "h"> {
  const out = new Set<"w" | "h">();
  for (const c of classes.split(/\s+/)) {
    const f = familleDeLargeur(c);
    if (f) out.add(f);
  }
  return out;
}

function fichiersTsx(dir: string, acc: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) fichiersTsx(p, acc);
    else if (e.name.endsWith(".tsx")) acc.push(p);
  }
  return acc;
}

/** `const NOM = "…classes…";` — les constantes de style d'un fichier. */
const DEF = /^\s*const\s+([A-Za-z_$][\w$]*)\s*=\s*"([^"]*)"\s*;/gm;
/** `` const NOM = `${AUTRE} …`; `` — une constante COMPOSÉE à partir d'une autre. */
const DEF_TPL = /^\s*const\s+([A-Za-z_$][\w$]*)\s*=\s*`([^`]*)`\s*;/gm;
/** ``className={`${NOM} …suffixe…`}`` — l'interpolation d'une de ces constantes. */
const USAGE = /className=\{`\$\{([A-Za-z_$][\w$]*)\}([^`$]*)`\}/g;

/**
 * LES CONSTANTES COMPOSÉES COMPTENT AUTANT QUE LES AUTRES.
 *
 * Sortir la largeur d'une base et la remettre dans un dérivé (`const inp = \`${inpBase} w-full\`;`)
 * est la bonne façon de corriger la collision — mais si le garde ne suivait pas cette
 * indirection, il deviendrait AVEUGLE au fichier même qu'il vient de faire réparer, et la
 * collision pourrait revenir sans un mot. On résout donc deux niveaux : au-delà, la lisibilité
 * du style a déjà d'autres problèmes.
 */
function resoudre(constantes: Map<string, string>): Map<string, string> {
  for (let passe = 0; passe < 2; passe++) {
    for (const [nom, val] of constantes) {
      if (!val.includes("${")) continue;
      constantes.set(nom, val.replace(/\$\{([A-Za-z_$][\w$]*)\}/g, (tel, ref: string) => constantes.get(ref) ?? tel));
    }
  }
  return constantes;
}

describe("une constante de classes et son suffixe ne se disputent jamais la largeur", () => {
  it("aucun `className={`${CONST} …`}` ne redéclare la largeur ou la hauteur de CONST", () => {
    const fautes: string[] = [];

    for (const fichier of fichiersTsx(RACINE)) {
      const src = fs.readFileSync(fichier, "utf8");
      if (!src.includes("className={`${")) continue;

      const constantes = new Map<string, string>();
      for (const m of src.matchAll(DEF)) constantes.set(m[1], m[2]);
      for (const m of src.matchAll(DEF_TPL)) constantes.set(m[1], m[2]);
      if (constantes.size === 0) continue;
      resoudre(constantes);

      for (const m of src.matchAll(USAGE)) {
        const base = constantes.get(m[1]);
        if (base === undefined) continue; // constante importée : hors de portée de ce garde
        const collisions = [...famillesDe(m[2])].filter((f) => famillesDe(base).has(f));
        if (collisions.length === 0) continue;
        const ligne = src.slice(0, m.index ?? 0).split("\n").length;
        fautes.push(
          `${path.relative(process.cwd(), fichier)}:${ligne} — \`${m[1]}\` déclare déjà ` +
          `${collisions.map((f) => `\`${f}-…\``).join(" et ")}, et le suffixe le redéclare : ` +
          `« ${m[2].trim()} ». C'est la RÈGLE la plus tardive de la feuille Tailwind qui gagne, ` +
          `pas la classe écrite en dernier — sortez la largeur de la constante.`,
        );
      }
    }

    expect(fautes, `COLLISION DE CLASSES TAILWIND :\n${fautes.join("\n")}`).toEqual([]);
  });
});
