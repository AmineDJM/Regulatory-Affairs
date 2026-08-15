import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { ENTITIES, getEntity, entityNames } from "./entities";
import { MODULES } from "@/lib/rbac";

/**
 * LE REGISTRE DOIT CORRESPONDRE AU SCHÉMA RÉEL.
 *
 * Un nom de modèle ou de champ inventé ne se voit ni au typecheck (les champs sont des chaînes)
 * ni à la lecture : il casse en production, sur la première requête d'un agent. Ce test lit le
 * schéma Prisma et refuse tout écart — c'est la garantie que la carte exposée aux agents décrit
 * bien la base, et pas ce qu'on croyait s'en souvenir.
 */

const schema = fs.readFileSync(path.join(process.cwd(), "prisma", "schema.prisma"), "utf8");

/** Champs déclarés d'un modèle (scalaires ET relations). */
function fieldsOf(model: string): Set<string> {
  const re = new RegExp(`^model\\s+${model}\\s*\\{([\\s\\S]*?)^\\}`, "m");
  const m = re.exec(schema);
  if (!m) return new Set();
  const out = new Set<string>();
  for (const line of m[1].split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("//") || t.startsWith("@@")) continue;
    const f = /^(\w+)\s+\w+/.exec(t);
    if (f) out.add(f[1]);
  }
  return out;
}

describe("registre des entités — cohérence avec le schéma Prisma", () => {
  it("expose au moins les objets centraux de l'ERP", () => {
    expect(entityNames()).toContain("regulatory_dossier");
    expect(ENTITIES.length).toBeGreaterThanOrEqual(20);
  });

  it("n'a pas deux entrées pour le même nom", () => {
    expect(new Set(entityNames()).size).toBe(ENTITIES.length);
  });

  it("nomme des modèles qui EXISTENT dans le schéma", () => {
    const missing = ENTITIES.filter((e) => fieldsOf(e.model).size === 0).map((e) => `${e.name} → ${e.model}`);
    expect(missing).toEqual([]);
  });

  it("ne déclare que des champs qui existent — sinon la requête casse chez l'agent", () => {
    const bad: string[] = [];
    for (const e of ENTITIES) {
      const fields = fieldsOf(e.model);
      const declared = [
        ...e.listFields, ...(e.detailFields ?? []), ...e.searchFields,
        ...(e.referenceField ? [e.referenceField] : []),
        ...(e.statusField ? [e.statusField] : []),
        ...Object.values(e.related ?? {}),
        ...Object.keys(e.orderBy ?? {}),
      ];
      for (const f of declared) if (!fields.has(f)) bad.push(`${e.name} (${e.model}) → ${f}`);
    }
    expect(bad).toEqual([]);
  });

  it("rattache chaque objet à un module RBAC connu", () => {
    const bad = ENTITIES.filter((e) => !(MODULES as readonly string[]).includes(e.module)).map((e) => e.name);
    expect(bad).toEqual([]);
  });

  it("porte une description utile à un agent qui ne connaît pas l'ERP", () => {
    const thin = ENTITIES.filter((e) => e.description.trim().length < 40).map((e) => e.name);
    expect(thin).toEqual([]);
  });

  it("retrouve une entrée par son nom, et rend null sur l'inconnu", () => {
    expect(getEntity("regulatory_dossier")?.model).toBe("RegulatoryProduct");
    expect(getEntity("nawak")).toBeNull();
  });
});
