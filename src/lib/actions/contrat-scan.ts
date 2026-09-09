import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Prisma } from "@prisma/client";
import { contratsDuFichier, type ContratAction, type TableEnums } from "./contrat";

/**
 * LA LECTURE DU PARC — la seule pièce qui touche au disque.
 *
 * Elle est séparée de `contrat.ts` pour la raison qui gouverne toute la frontière client :
 * `contrat.ts` est PUR et importable de partout ; un module qui lit des fichiers ne l'est
 * jamais. Ici on assume `fs` et Prisma, et on ne sert que le générateur et son cliquet.
 */

export const DOSSIER_ACTIONS = join(process.cwd(), "src", "lib", "actions");

/** Ce qui vit dans `src/lib/actions/` sans être une action : le contrat lui-même, les types. */
const HORS_PARC = new Set([
  "types.ts", "contrat.ts", "contrat-scan.ts", "contrat.genere.ts",
  "generique.ts", "executer.ts", "aiguillage.genere.ts",
]);

/** Les valeurs admises que le SCHÉMA déclare — un fait de la base, pas une liste écrite. */
export function enumsDuSchema(): TableEnums {
  return Object.fromEntries(
    Prisma.dmmf.datamodel.enums.map((e) => [e.name, e.values.map((v) => v.name)]),
  );
}

export function fichiersDActions(): string[] {
  return readdirSync(DOSSIER_ACTIONS)
    .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts") && !HORS_PARC.has(f))
    .sort();
}

/** Tous les contrats de l'ERP, dérivés de la source à l'instant où on appelle. */
export function scannerContrats(): ContratAction[] {
  const enums = enumsDuSchema();
  const out: ContratAction[] = [];
  for (const f of fichiersDActions()) {
    const source = readFileSync(join(DOSSIER_ACTIONS, f), "utf8");
    out.push(...contratsDuFichier(f.replace(/\.ts$/, ""), source, enums));
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
}
