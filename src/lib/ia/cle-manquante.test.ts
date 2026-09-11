import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { courtIaNonConfiguree, phraseIaNonConfiguree } from "./cle-manquante";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * AUCUN ÉCRAN NE NOMME LA CLÉ DE RAISONNEMENT DE MÉMOIRE (§118.128).
 *
 * LE DÉFAUT MESURÉ : huit écrans annonçaient « Ajoutez la clé ANTHROPIC_API_KEY » sur un
 * déploiement qui tourne chez OpenAI. L'administrateur pose la variable que l'écran nomme, rien
 * ne change, et il conclut que le produit est cassé — un refus qui nomme un remède FAUX est pire
 * qu'un refus qui n'en nomme aucun (§118.121).
 *
 * Et `cleModeleRequise()` existait POUR ÇA, avec un en-tête qui annonçait « évite la quatrième
 * recopie ». Il y en avait huit : le mécanisme était écrit, juste, et le chemin naturel passait à
 * côté (§118.14). Réparer les huit à la main ne protège pas la neuvième — il faut l'endroit où
 * TOUTES les instances passent (§118.58), et ici c'est une règle sur la SOURCE.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const RACINES = ["src/app", "src/components"];

function ecrans(): string[] {
  const out: string[] = [];
  const marche = (dir: string): void => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) marche(p);
      else if (e.name.endsWith(".tsx")) out.push(p);
    }
  };
  for (const r of RACINES) marche(join(process.cwd(), r));
  return out;
}

describe("le nom de la clé d'IA ne se recopie plus dans un écran", () => {
  const fichiers = ecrans();

  it("la prémisse : le parc d'écrans est lu", () => {
    // Sans elle, un balayage cassé rendrait 0 fichier et les deux cas suivants passeraient au
    // vert sur du vide — la tautologie que §118.17 nomme.
    expect(fichiers.length).toBeGreaterThan(200);
  });

  it("AUCUN écran ne nomme la clé du fournisseur de RAISONNEMENT", () => {
    // Règle ABSOLUE, prose comprise : trois fois dans ce dépôt un cliquet s'est accroché au
    // commentaire qui le décrivait (§118.79d, §118.88, §118.112b). Ici on inverse le piège —
    // le littéral est interdit PARTOUT, donc la documentation ne peut pas le citer, donc aucune
    // exception n'est à écrire. Le nom se lit dans le registre (`cleModeleRequise`) et voyage en
    // prop ou dans une réponse de route.
    const fautifs = fichiers
      .filter((f) => readFileSync(f, "utf8").includes("ANTHROPIC_API_KEY"))
      .map((f) => f.replace(process.cwd() + "/", ""));
    expect(
      fautifs,
      `ces écrans gravent un nom de clé que le registre seul connaît — passer par cleModeleRequise() côté serveur, et le recevoir en prop côté client :\n${fautifs.join("\n")}`,
    ).toEqual([]);
  });

  it("la clé de TRANSCRIPTION reste nommable, et seulement là où elle est lue", () => {
    // `whisper` n'existe que chez OpenAI : il n'y a aucun choix de registre à lire, donc nommer
    // `OPENAI_API_KEY` y est JUSTE. Interdire par symétrie remplacerait un nom exact par une
    // périphrase — un refus à tort, plus coûteux que le défaut corrigé (§118.27). L'exception
    // porte donc sur un FAIT du fichier : il parle de transcription.
    const fautifs = fichiers
      .filter((f) => {
        const src = readFileSync(f, "utf8");
        return src.includes("OPENAI_API_KEY") && !src.includes("sttConfigured");
      })
      .map((f) => f.replace(process.cwd() + "/", ""));
    expect(
      fautifs,
      `ces écrans nomment OPENAI_API_KEY hors du contexte de transcription — le fournisseur de raisonnement se lit dans le registre :\n${fautifs.join("\n")}`,
    ).toEqual([]);
  });
});

describe("la phrase du refus", () => {
  it("nomme le geste EXACT quand la clé est connue", () => {
    const p = phraseIaNonConfiguree("OPENAI_API_KEY", "l'assistant");
    expect(p).toContain("OPENAI_API_KEY");
    expect(p).toContain("Render");
    expect(p).toContain("l'assistant");
  });

  it("ne FABRIQUE aucun nom quand il n'a pas traversé", () => {
    // Ce qui la ferait tomber : un repli qui écrit « ANTHROPIC_API_KEY » par défaut — le défaut
    // qu'on répare, réintroduit par son propre repli.
    for (const vide of [null, undefined, "", "   "]) {
      const p = phraseIaNonConfiguree(vide, "l'assistant");
      expect(p).not.toContain("API_KEY");
      expect(p).toContain("fournisseur de raisonnement");
      expect(courtIaNonConfiguree(vide)).not.toContain("API_KEY");
    }
  });

  it("la forme courte reste une ligne, pour une infobulle", () => {
    expect(courtIaNonConfiguree("OPENAI_API_KEY")).toBe("IA non configurée (OPENAI_API_KEY absente)");
    expect(courtIaNonConfiguree("OPENAI_API_KEY").includes("\n")).toBe(false);
  });
});
