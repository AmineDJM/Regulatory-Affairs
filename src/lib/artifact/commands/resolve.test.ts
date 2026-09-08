import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CIBLE_VIDE, cibleIndex, cibleTexte } from "@/lib/artifact/commands/ir";
import { LIBELLES_CONNUS, resoudre } from "@/lib/artifact/commands/resolve";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LA LANGUE DES REFUS — parce qu'un refus qu'on lit de travers est un refus qu'on croit moins.
 *
 * « ce document ne contient aucun image » est passé en production. Le refus était JUSTE : il
 * n'y avait pas d'image, et rien n'a été modifié. Mais c'est la phrase que la personne lit, et
 * c'est celle qu'un modèle reprend dans sa réponse. Ces tests tiennent l'accord, et surtout
 * ils tiennent la LISTE : un libellé nouveau ne peut pas prendre le masculin en silence.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const objets = (n: number, textes: string[] = []) =>
  Array.from({ length: n }, (_, i) => ({ id: `o${i + 1}`, index: i + 1, texte: textes[i] ?? "" }));

describe("l'accord des refus", () => {
  it("un nom féminin s'accorde partout où il est précédé d'un déterminant", () => {
    const vide = resoudre(cibleIndex(1), [], { libelle: "image" });
    expect(vide.etat).toBe("ABSENT");
    expect(vide.etat === "ABSENT" && vide.motif).toBe("ce document ne contient aucune image");

    const sansCible = resoudre(CIBLE_VIDE, objets(3), { libelle: "image" });
    expect(sansCible.etat === "ABSENT" && sansCible.motif).toBe("il faut dire quelle image");

    const id = resoudre({ ...CIBLE_VIDE, id: "zz" }, objets(3), { libelle: "forme" });
    expect(id.etat === "ABSENT" && id.motif).toContain("la forme « zz »");

    const ambigu = resoudre(cibleTexte("tampon"), objets(2, ["tampon A", "tampon B"]), { libelle: "image" });
    expect(ambigu.etat).toBe("AMBIGU");
    expect(ambigu.etat === "AMBIGU" && ambigu.motif).toContain("laquelle ?");

    const rien = resoudre(cibleTexte("visa"), objets(2, ["a", "b"]), { libelle: "image" });
    expect(rien.etat === "ABSENT" && rien.motif).toBe("aucune image ne contient « visa »");
  });

  it("un nom masculin garde ses accords — la correction n'a pas inversé le défaut", () => {
    const vide = resoudre(cibleIndex(1), [], { libelle: "paragraphe" });
    expect(vide.etat === "ABSENT" && vide.motif).toBe("ce document ne contient aucun paragraphe");
    const ambigu = resoudre(cibleTexte("art"), objets(2, ["article 1", "article 2"]), { libelle: "tableau" });
    expect(ambigu.etat === "AMBIGU" && ambigu.motif).toContain("lequel ?");
  });

  it("un libellé INCONNU retombe au masculin sans jamais lever d'erreur", () => {
    // Une garde qui ferait échouer la résolution sur un mot non répertorié transformerait un
    // détail de langue en panne. On accepte l'accord par défaut, et le test suivant empêche
    // qu'un tel mot existe dans le dépôt.
    const r = resoudre(cibleIndex(9), objets(2), { libelle: "chose-inconnue" });
    expect(r.etat).toBe("ABSENT");
  });
});

/** Tous les `.ts` de `src/lib/artifact`, hors tests. */
function fichiers(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) { fichiers(p, out); continue; }
    if (p.endsWith(".ts") && !p.endsWith(".test.ts")) out.push(p);
  }
  return out;
}

describe("la liste des libellés est complète", () => {
  it("chaque `libelle` passé à `resoudre` dans le dépôt a un genre déclaré", () => {
    /**
     * CE QUI FERAIT TOMBER CE TEST : ajouter `resoudre(..., { libelle: "colonne" })` sans
     * inscrire « colonne » dans les listes. Le refus dirait « aucun colonne » — le défaut
     * qu'on vient de corriger, revenu par la porte d'à côté.
     */
    const manquants: string[] = [];
    for (const f of fichiers("src/lib/artifact")) {
      const src = readFileSync(f, "utf8");
      for (const m of src.matchAll(/resoudre\([\s\S]{0,400}?libelle:\s*"([^"]+)"/g)) {
        if (!LIBELLES_CONNUS.has(m[1])) manquants.push(`${f} → « ${m[1]} »`);
      }
    }
    expect(manquants, "libellé sans genre déclaré dans resolve.ts").toEqual([]);
  });

  it("le test précédent VOIT réellement les appels — sinon il serait vert sur du vide", () => {
    // §118.17 : une assertion dont on ne sait pas nommer le cas qui la ferait tomber n'en est
    // pas une. Ici, le cas est « le motif de recherche ne trouve plus rien ».
    let trouves = 0;
    for (const f of fichiers("src/lib/artifact")) {
      trouves += [...readFileSync(f, "utf8").matchAll(/resoudre\([\s\S]{0,400}?libelle:\s*"([^"]+)"/g)].length;
    }
    expect(trouves).toBeGreaterThanOrEqual(4);
  });
});
