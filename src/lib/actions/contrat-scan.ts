import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Prisma } from "@prisma/client";
import { contratsDuFichier, type ContratAction, type TableEnums, type TableRelations } from "./contrat";

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

/**
 * CE QUE LE SCHÉMA DIT DES RÉFÉRENCES — `"CareBeneficiary.doctorId" → "MedicalDoctor"`.
 *
 * C'est ce qui permet à une personne d'écrire « Nivolex » là où l'action attend un `cuid`. La
 * table est DÉRIVÉE du DMMF, comme les énums : une table écrite à la main serait fausse le jour
 * où quelqu'un ajoute une relation, en silence (§118.73).
 *
 * Deux sortes d'entrées, et la seconde évite un cas particulier dans le module pur : la clé
 * PROPRE de chaque modèle (`"DriveNode.id" → "DriveNode"`), pour que le champ `id` d'une action
 * qui écrit un seul modèle se résolve par la même règle que tous les autres.
 *
 * Une relation à clé COMPOSÉE (plusieurs colonnes) est ignorée : un seul champ n'y désigne pas
 * une ligne, et prétendre le contraire ferait résoudre vers la mauvaise (§118.16).
 */
export function relationsDuSchema(): TableRelations {
  const table: Record<string, string> = {};
  for (const m of Prisma.dmmf.datamodel.models) {
    table[`${m.name}.id`] = m.name;
    for (const f of m.fields) {
      if (f.kind === "object" && f.relationFromFields?.length === 1) {
        table[`${m.name}.${f.relationFromFields[0]}`] = f.type;
      }
    }
  }
  return table;
}

export function fichiersDActions(): string[] {
  return readdirSync(DOSSIER_ACTIONS)
    .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts") && !HORS_PARC.has(f))
    .sort();
}

/** Tous les contrats de l'ERP, dérivés de la source à l'instant où on appelle. */
export function scannerContrats(): ContratAction[] {
  const enums = enumsDuSchema();
  const relations = relationsDuSchema();
  const out: ContratAction[] = [];
  for (const f of fichiersDActions()) {
    const source = readFileSync(join(DOSSIER_ACTIONS, f), "utf8");
    out.push(...contratsDuFichier(f.replace(/\.ts$/, ""), source, enums, relations));
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
}
