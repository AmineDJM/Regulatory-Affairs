import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LA LECTURE D'UN APPEL D'OFFRES — les POINTS D'APPEL (audit 360°, lot D1c — F2).
 *
 * Une règle vérifiée sans son appelant ne prouve rien (§118.49). Ce cliquet lit la SOURCE, sans ses
 * commentaires (§118.79d — un commentaire qui cite le code n'est pas le code), et exige :
 *  • que toute écriture HUMAINE d'une ligne de marché pose `modifieeLe` — sinon la lecture suivante
 *    du document remplacerait une ligne qu'une personne a corrigée ; les deux exceptions sont NOMMÉES
 *    (l'enrichissement, qui n'est pas une main ; la soumission, protégée par sa propre photo) ;
 *  • que l'affectation à une BU touche la ligne AVANT d'écrire l'affectation ;
 *  • que la lecture passe par le lecteur canonique, et plus jamais par l'OCR direct ;
 *  • que l'écran envoie les deux cases et montre ce que la lecture a fait.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const RACINE = path.resolve(__dirname, "../../..");
const lire = (rel: string) => readFileSync(path.join(RACINE, rel), "utf8");
/** La source SANS ses commentaires (bloc et ligne ; une URL « http:// » n'est pas un commentaire). */
const sansCommentaires = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");

/** Le texte d'un appel, de sa parenthèse ouvrante à la parenthèse qui la ferme. */
function appel(src: string, debut: number): string {
  const ouvre = src.indexOf("(", debut);
  let prof = 0;
  for (let i = ouvre; i < src.length; i++) {
    if (src[i] === "(") prof++;
    else if (src[i] === ")") { prof--; if (prof === 0) return src.slice(debut, i + 1); }
  }
  return src.slice(debut);
}

/** La fonction qui contient une position : la dernière déclaration `function NOM(` qui la précède. */
function fonctionEnglobante(src: string, pos: number): string {
  const avant = src.slice(0, pos);
  const m = [...avant.matchAll(/function\s+([A-Za-z0-9_]+)\s*\(/g)];
  return m.length ? m[m.length - 1][1] : "?";
}

/** Le corps d'une fonction nommée, jusqu'à la prochaine déclaration de premier niveau. */
function corps(src: string, nom: string): string {
  const i = src.search(new RegExp(`(?:async\\s+)?function\\s+${nom}\\s*\\(`));
  expect(i, `fonction ${nom} introuvable`).toBeGreaterThanOrEqual(0);
  const suite = src.slice(i + 1).search(/\n(?:export\s+)?(?:async\s+)?function\s+[A-Za-z0-9_]+\s*\(/);
  return suite === -1 ? src.slice(i) : src.slice(i, i + 1 + suite);
}

function fichiersTs(dir: string, acc: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = path.join(dir, e);
    if (statSync(p).isDirectory()) { if (e !== "node_modules") fichiersTs(p, acc); }
    else if (/\.(ts|tsx)$/.test(e) && !/\.(test|spec)\.tsx?$/.test(e)) acc.push(p);
  }
  return acc;
}

/** Les écritures d'une ligne de marché qui ne viennent pas d'une main — chacune avec sa raison. */
const EXCEPTIONS: Record<string, string> = {
  // L'enrichissement écrit le prix de référence, la nomenclature, le marché : ce n'est pas une personne.
  enrichLineById: "l'intelligence marché, pas une main",
  // La soumission fige la ligne par sa photo de dépôt (`submissionSnapshot`), que la lecture lit déjà (raison SOUMISE).
  submitSubmission: "protégée par sa photo de dépôt",
};

describe("toute écriture humaine d'une ligne de marché dit qu'une personne l'a touchée", () => {
  const sites = fichiersTs(path.join(RACINE, "src")).flatMap((f) => {
    const src = sansCommentaires(readFileSync(f, "utf8"));
    return [...src.matchAll(/\b(?:prisma|tx)\.pchTenderLine\.(?:update|updateMany|upsert)\s*\(/g)].map((m) => ({
      fichier: path.relative(RACINE, f), fonction: fonctionEnglobante(src, m.index!), texte: appel(src, m.index!),
    }));
  });

  it("chaque site pose `modifieeLe`, sauf les exceptions NOMMÉES — et le plancher dit que le parcours lit bien la source", () => {
    // CE QUI LE FERAIT TOMBER : un geste d'écran neuf qui écrit une ligne sans `modifieeLe` — sa correction serait
    // effacée par la relecture suivante du document, en silence.
    expect(sites.length, "des écritures de lignes de marché doivent être trouvées").toBeGreaterThanOrEqual(5);
    const fautifs = sites.filter((s) => !(s.fonction in EXCEPTIONS) && !/\bmodifieeLe\s*:/.test(s.texte));
    expect(fautifs.map((s) => `${s.fichier} › ${s.fonction}`)).toEqual([]);
    // Les exceptions existent encore là où on les attend (sinon la liste ment).
    for (const nom of Object.keys(EXCEPTIONS)) expect(sites.some((s) => s.fonction === nom), nom).toBe(true);
  });

  it("témoins du détecteur : une écriture sans `modifieeLe` est vue, un commentaire ne compte pas", () => {
    const faux = sansCommentaires(`async function geste() {\n  // modifieeLe: new Date()\n  await prisma.pchTenderLine.update({ where: { id }, data: { note } });\n}`);
    const m = /prisma\.pchTenderLine\.update\s*\(/.exec(faux)!;
    expect(/\bmodifieeLe\s*:/.test(appel(faux, m.index))).toBe(false);
    expect(fonctionEnglobante(faux, m.index)).toBe("geste");
  });
});

describe("les gestes de la lecture passent par les bons points d'appel", () => {
  const actions = sansCommentaires(lire("src/lib/actions/pch-tender-line-actions.ts"));
  const lecture = sansCommentaires(lire("src/lib/pch/lecture-ao.ts"));

  it("l'affectation à une BU touche la ligne AVANT d'écrire l'affectation", () => {
    const c = corps(actions, "setTenderLineBusinessUnits");
    const touche = c.search(/prisma\.pchTenderLine\.updateMany\s*\(/);
    expect(touche, "la ligne n'est pas touchée").toBeGreaterThan(-1);
    expect(touche).toBeLessThan(c.search(/pchTenderLineBusinessUnit\.deleteMany\s*\(/));
    expect(touche).toBeLessThan(c.search(/pchTenderLineBusinessUnit\.createMany\s*\(/));
  });

  it("plus d'OCR direct : le texte du fichier d'abord, par le lecteur canonique", () => {
    expect(actions).not.toMatch(/\bocrDocument\s*\(/);
    expect(corps(lecture, "lireDocumentAo")).toMatch(/\blireTexteOuOcr\s*\(/);
  });

  it("les deux actions passent par la demande au modèle ET par l'écrivain unique, porte du marché et interrupteur en tête", () => {
    for (const nom of ["analyzeTenderText", "analyzeTenderDocument"]) {
      const c = corps(actions, nom);
      expect(c, nom).toMatch(/\bdemanderLignesAo\s*\(/);
      expect(c, nom).toMatch(/\becrireLectureAo\s*\(/);
      expect(c, nom).not.toMatch(/pchTenderLine\.createMany/);
      // L'état d'abord (§118.18) : le marché, puis l'interrupteur, puis la clé.
      const marche = c.search(/peutAgirSurLeMarche\s*\(/);
      const interrupteur = c.search(/interrupteurIaCoupe\s*\(/);
      const cle = c.search(/aiConfigured\s*\(/);
      expect(marche, nom).toBeGreaterThan(-1);
      expect(interrupteur, nom).toBeGreaterThan(marche);
      expect(cle, nom).toBeGreaterThan(interrupteur);
    }
    // Le fichier n'est gardé qu'avec le droit d'y téléverser.
    expect(corps(actions, "analyzeTenderDocument")).toMatch(/userCan\(user,\s*MODULE,\s*"UPLOAD"\)[\s\S]*persistUploadedDocument\s*\(/);
  });

  it("l'écrivain verrouille le marché et ne supprime qu'à l'état lu", () => {
    const c = corps(lecture, "ecrireLectureAo");
    expect(c).toMatch(/FROM "PchTender" WHERE id = \$\{args\.tenderId\} FOR UPDATE/);
    expect(c).toMatch(/\(\{\s*id,\s*updatedAt\s*\}\)\s*=>\s*\(\{\s*id,\s*updatedAt\s*\}\)/);
  });
});

describe("l'écran envoie les deux cases, et montre ce que la lecture a fait", () => {
  const ecran = sansCommentaires(lire("src/app/(app)/pch/[id]/tender-lines.tsx"));
  const page = sansCommentaires(lire("src/app/(app)/pch/[id]/page.tsx"));

  it("« complète les lectures précédentes » et « océriser » partent avec la lecture ; la phrase du serveur est affichée", () => {
    // Geste par geste : le texte collé ET le fichier envoient la case, et chacun montre la phrase du serveur.
    const debutTexte = ecran.indexOf("async function analyzeText(");
    const debutFichier = ecran.indexOf("async function analyzeFile(");
    expect(debutTexte, "analyzeText introuvable").toBeGreaterThan(-1);
    expect(debutFichier, "analyzeFile introuvable").toBeGreaterThan(debutTexte);
    const texte = ecran.slice(debutTexte, debutFichier);
    const fichier = ecran.slice(debutFichier, ecran.indexOf("\n  return (", debutFichier));
    expect(texte).toMatch(/fd\.set\("complementaire", "on"\)/);
    expect(fichier).toMatch(/fd\.set\("complementaire", "on"\)/);
    expect(fichier).toMatch(/fd\.set\("forcerOcr", "on"\)/);
    expect(texte).toMatch(/texte: r\.message\b/);
    expect(fichier).toMatch(/texte: r\.message\b/);
    expect(ecran).toMatch(/role=\{bilan\.ok \? "status" : "alert"\}/);
  });

  it("les lectures précédentes sont chargées par la page et montrées dans le panneau", () => {
    expect(page).toMatch(/lecturesDuMarche\(t\.id\)/);
    expect(page).toMatch(/lectures=\{lectures\}/);
    expect(ecran).toMatch(/lectures\.liste\.map/);
  });

  it("plus aucune phrase d'Adam ne dit que les lignes s'AJOUTENT au tableau, et plus aucune ne promet l'OCR Mistral", () => {
    const parc = fichiersTs(path.join(RACINE, "src")).map((f) => readFileSync(f, "utf8"));
    expect(parc.some((s) => /s'AJOUTENT au tableau/.test(s))).toBe(false);
    expect(ecran).not.toMatch(/OCR Mistral/);
  });
});
