import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { MaterialType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { MATERIAL_TYPE } from "@/lib/labels";
import { familleDuType } from "@/lib/promo/catalogue";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE CATALOGUE, C'EST LA LISTE DES SUPPORTS (§118.173) — la migration qui le remplit, éprouvée sur
 * son TEXTE RÉEL.
 *
 * Deux propriétés, et chacune a son banc :
 *   1. LA LISTE dit la même chose que le code : chaque support (sauf « Autres ») y est, sous le
 *      libellé que le menu affichait, dans la famille que `familleDuType` lui donne. Deux
 *      classements du même support finiraient par diverger (§118.5) — et `familleDuType`, qui
 *      n'avait aucun appelant de production, a désormais un lecteur qui le tient vrai.
 *   2. LE SQL fait ce qu'il dit, joué tel qu'il est écrit dans le fichier — jamais une copie — sur
 *      une table TEMPORAIRE du même nom, dans une transaction annulée : la table temporaire passe
 *      devant la table réelle pour la session (Postgres cherche `pg_temp` en premier), donc la
 *      migration s'exécute sans rien lire ni écrire de la base partagée, et sans dépendre de ce
 *      que les bancs voisins y ont laissé.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const FICHIER = path.join(process.cwd(), "prisma/migrations/20261215090000_catalogue_supports/migration.sql");
const SQL = readFileSync(FICHIER, "utf8");

/** Les lignes `(ordre, 'TYPE', 'Nom', 'FAMILLE', exige)` de la clause VALUES. */
function supportsDuFichier(): { ordre: number; type: string; nom: string; famille: string; exige: boolean }[] {
  const out: { ordre: number; type: string; nom: string; famille: string; exige: boolean }[] = [];
  for (const m of SQL.matchAll(/\(\s*(\d+),\s*'(\w+)',\s*'((?:[^']|'')*)',\s*'(\w+)',\s*(true|false)\s*\)/g)) {
    out.push({ ordre: Number(m[1]), type: m[2], nom: m[3].replace(/''/g, "'"), famille: m[4], exige: m[5] === "true" });
  }
  return out;
}

describe("La liste des supports dit ce que le code dit", () => {
  const supports = supportsDuFichier();

  it("PRÉMISSE : le banc lit bien les lignes du fichier", () => {
    // Un motif cassé ne lirait rien, et toutes les assertions suivantes passeraient sur une liste vide.
    expect(supports.length).toBeGreaterThanOrEqual(18);
  });

  it("chaque support du menu y est, une fois — sauf « Autres », qui n'en est pas un", () => {
    const attendus = Object.values(MaterialType).filter((t) => t !== "AUTRES").sort();
    expect(supports.map((s) => s.type).sort()).toEqual(attendus);
  });

  it("sous le libellé que le menu affichait, et dans la famille que `familleDuType` lui donne", () => {
    for (const s of supports) {
      expect(s.nom, s.type).toBe(MATERIAL_TYPE[s.type]);
      expect(s.famille, s.type).toBe(familleDuType(s.type));
    }
  });

  it("seuls les supports SPÉCIFIQUES à un produit l'exigent (fiche POSO, aide de visite)", () => {
    expect(supports.filter((s) => s.exige).map((s) => s.type).sort()).toEqual(["ADV", "FICHE_POSO"]);
  });
});

/** Joue le SQL du fichier sur une table temporaire préparée par `avant`, rend ce qu'elle contient. */
async function jouer(avant: string[], rejouer = 1): Promise<{ id: string; reference: string; nom: string; famille: string; materialType: string | null; exigeProduit: boolean }[]> {
  const ANNULE = new Error("annulé — le banc ne garde rien");
  let lignes: { id: string; reference: string; nom: string; famille: string; materialType: string | null; exigeProduit: boolean }[] = [];
  try {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`CREATE TEMP TABLE "PromoCatalogueArticle" (LIKE public."PromoCatalogueArticle" INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING INDEXES) ON COMMIT DROP`);
      for (const s of avant) await tx.$executeRawUnsafe(s);
      for (let i = 0; i < rejouer; i++) await tx.$executeRawUnsafe(SQL);
      // La collation est FIXÉE dans la lecture : la requête est préparée une fois par connexion, et
      // un cas qui passe la colonne en `C` changerait son type de résultat — Postgres refuse alors
      // le plan mis en cache (« cached plan must not change result type »).
      lignes = await tx.$queryRawUnsafe(`SELECT id, reference, nom COLLATE "default" AS nom, famille::text AS famille, "materialType"::text AS "materialType", "exigeProduit" FROM "PromoCatalogueArticle" ORDER BY reference`);
      throw ANNULE;
    }, { timeout: 20_000 });
  } catch (e) {
    if (e !== ANNULE) throw e;
  }
  return lignes;
}

const article = (id: string, reference: string, nom: string, famille: string, materialType: string | null) =>
  `INSERT INTO "PromoCatalogueArticle" (id, reference, nom, famille, "materialType", unite, "exigeProduit", actif, "createdAt", "updatedAt")
   VALUES ('${id}', '${reference}', '${nom.replace(/'/g, "''")}', '${famille}'::"PromoFamille", ${materialType ? `'${materialType}'::"MaterialType"` : "NULL"}, 'pièce', false, true, now(), now())`;

describe("La migration, jouée sur son texte réel", () => {
  it("un catalogue vide reçoit les dix-huit supports, dans leur famille, numérotés CAT-0001 à CAT-0018", async () => {
    const l = await jouer([]);
    expect(l).toHaveLength(18);
    expect(l[0]).toMatchObject({ reference: "CAT-0001", nom: "Fiche POSO", famille: "CONSOMMABLE", materialType: "FICHE_POSO", exigeProduit: true });
    expect(l.at(-1)).toMatchObject({ reference: "CAT-0018", nom: "Vidéo", famille: "NUMERIQUE" });
    expect(l.filter((x) => x.famille === "DURABLE").map((x) => x.nom).sort()).toEqual(["Banner", "Présentoir", "Stand / Booth"]);
  });

  it("rejouée, elle ne crée RIEN", async () => {
    expect(await jouer([], 2)).toHaveLength(18);
  });

  it("un article qui porte déjà le NOM d'un support (casse, espaces et accents mis à part) n'est pas doublé", async () => {
    const l = await jouer([
      article("manuel-1", "CAT-0042", "  fiche poso ", "CONSOMMABLE", null),
      article("manuel-2", "CAT-0007", "Cle USB", "CONSOMMABLE", null),
    ]);
    expect(l).toHaveLength(2 + 16);
    expect(l.filter((x) => /poso/i.test(x.nom))).toHaveLength(1);
    expect(l.filter((x) => /cl[eé] usb/i.test(x.nom))).toHaveLength(1);
    // La série continue après la PLUS HAUTE référence, pas après le compte.
    expect(l.find((x) => x.id === "catsupport-ADV")?.reference).toBe("CAT-0043");
  });

  it("une MAJUSCULE accentuée se plie aussi — « PRÉSENTOIR » désigne le support « Présentoir »", async () => {
    // `lower` n'abaisse pas « É » sous toutes les locales : une base en `C` le laisse tel quel, et
    // c'est le cas que le pli de `translate` existe pour couvrir. La base de travail est en
    // `C.UTF-8`, où `lower` plie déjà — jouée telle quelle, cette assertion ne pouvait PAS tomber :
    // le sabotage qui retire les majuscules de `translate` est passé au vert (§118.111). La colonne
    // de la table temporaire est donc mise en collation `C`, qui reproduit la base qui en a besoin,
    // et la PRÉMISSE vérifie que `C` laisse bien la majuscule — sans elle, le jour où Postgres
    // plierait sous `C` aussi, ce cas passerait au vert sans plus rien garder (§118.104).
    const [{ l: sousC }] = await prisma.$queryRawUnsafe<{ l: string }[]>(`SELECT lower('PRÉSENTOIR' COLLATE "C") AS l`);
    expect(sousC, "PRÉMISSE : sous `C`, `lower` laisse la majuscule accentuée").toBe("prÉsentoir");
    const l = await jouer([
      `ALTER TABLE "PromoCatalogueArticle" ALTER COLUMN nom TYPE text COLLATE "C"`,
      article("manuel-majuscules", "CAT-0003", "PRÉSENTOIR", "DURABLE", null),
    ]);
    expect(l.filter((x) => /pr[ée]sentoir/i.test(x.nom))).toHaveLength(1);
    expect(l).toHaveLength(1 + 17);
  });

  it("un article créé À LA MAIN avec la nature d'un support le désigne : le support n'est pas ajouté", async () => {
    const l = await jouer([article("manuel-video", "CAT-0001", "Film Nivolex", "NUMERIQUE", "VIDEO")]);
    expect(l.some((x) => x.id === "catsupport-VIDEO")).toBe(false);
    expect(l).toHaveLength(1 + 17);
  });

  it("un article REPRIS de l'ancien stock ne désigne PAS le support — sa nature venait d'un article spécialisé", async () => {
    const l = await jouer([article("reprise_ancien", "CAT-0001", "Fiche POSO Nivolex", "CONSOMMABLE", "FICHE_POSO")]);
    expect(l.find((x) => x.id === "catsupport-FICHE_POSO")).toMatchObject({ nom: "Fiche POSO", reference: "CAT-0002" });
    expect(l).toHaveLength(1 + 18);
  });

  it("au-delà de CAT-9999, la référence s'allonge au lieu de se tronquer (§118.147)", async () => {
    const l = await jouer([article("manuel-haut", "CAT-9999", "Kakémono géant", "DURABLE", null)]);
    expect(l.find((x) => x.id === "catsupport-FICHE_POSO")?.reference).toBe("CAT-10000");
    expect(l.find((x) => x.id === "catsupport-VIDEO")?.reference).toBe("CAT-10017");
  });
});
