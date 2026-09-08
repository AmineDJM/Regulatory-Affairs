import { describe, expect, it } from "vitest";
import fs from "node:fs";
import { ecartDeContrat } from "./contrat-sortie";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE CONTRAT D'UNE CAPACITÉ QU'ON N'A PAS ÉCRITE.
 *
 * Réparer quinze capacités à la main ne protège pas la seizième, et surtout pas une capacité
 * qu'Adam CRÉE (micro-outil promu, connecteur déclaré par manifeste, playbook enseigné) : le
 * cœur n'est pas modifié pour qu'un skill existe, donc il n'y a aucun endroit où aller corriger
 * sa forme. Ce qu'il DÉCLARE, en revanche, le code peut le vérifier.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
describe("une capacité tient le contrat qu'elle a annoncé", () => {
  it("annoncer { montant, devise } et rendre { erreur } est un écart NOMMÉ", () => {
    const e = ecartDeContrat({ outil: "facture_docusign", clesDeclarees: ["montant", "devise"], resultat: { erreur: "x" }, ok: true });
    expect(e).not.toBeNull();
    expect(e!.manquantes).toEqual(["montant", "devise"]);
    expect(e!.phrase).toMatch(/CONTRAT NON TENU/);
    expect(e!.phrase, "le modèle doit savoir quoi NE PAS référencer").toMatch(/Ne PAS référencer ces clés/);
  });

  it("ne COMBLE jamais : la phrase dit que rien n'a été ajouté", () => {
    /**
     * CE QUI FERAIT TOMBER CE TEST : « réparer » en ajoutant les clés manquantes à `null`. Le
     * plan croirait alors tenir une valeur que la capacité n'a jamais produite — un faux succès
     * strictement pire que l'écart qu'on signale.
     */
    const e = ecartDeContrat({ outil: "x", clesDeclarees: ["a"], resultat: { b: 1 }, ok: true });
    expect(e!.phrase).toMatch(/rien n'a été comblé/);
    expect(Object.keys({ b: 1 }), "le résultat lui-même reste intact").toEqual(["b"]);
  });

  it("se tait quand le contrat est tenu, et quand il n'y a pas de contrat", () => {
    expect(ecartDeContrat({ outil: "x", clesDeclarees: ["a", "b"], resultat: { a: 1, b: 2, c: 3 }, ok: true })).toBeNull();
    expect(ecartDeContrat({ outil: "x", clesDeclarees: [], resultat: { z: 1 }, ok: true })).toBeNull();
    expect(ecartDeContrat({ outil: "x", resultat: { z: 1 }, ok: true })).toBeNull();
  });

  it("se tait sur un ÉCHEC annoncé — un refus n'a pas à porter les clés du succès", () => {
    expect(ecartDeContrat({ outil: "x", clesDeclarees: ["montant"], resultat: { motif: "service indisponible" }, ok: false })).toBeNull();
  });

  it("se tait sur ce qu'il ne sait pas lire — une garde qui refuse l'inconnu est retirée", () => {
    // §118.16 : `null` sur tout ce qui n'est pas un objet lisible.
    for (const r of ["une chaîne", 42, null, [1, 2, 3], undefined]) {
      expect(ecartDeContrat({ outil: "x", clesDeclarees: ["a"], resultat: r, ok: true }), String(r)).toBeNull();
    }
  });

  it("le runtime des skills l'APPELLE — sinon c'est du code mort (§118.14, §118.49)", () => {
    const src = fs.readFileSync("src/platform/in-process/skills/index.ts", "utf8");
    expect(src, "le point d'appel a disparu").toContain("ecartDeContrat({");
    expect(src, "le contrat doit venir du MANIFESTE, pas d'une liste écrite à la main").toContain("clesDeclarees: m.sorties.cles");
    expect(src, "l'écart doit VOYAGER avec la sortie").toMatch(/_contrat: ecart\.phrase/);
  });

  it("le module est PUR — il vit au socle et les deux côtés peuvent le lire", () => {
    const src = fs.readFileSync("src/lib/skills/contrat-sortie.ts", "utf8");
    expect(src.split("\n").filter((l) => l.startsWith("import "))).toEqual([]);
  });
});
