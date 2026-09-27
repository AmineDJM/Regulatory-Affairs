import { describe, expect, it } from "vitest";
import { buildRef, enSerie, nextRefNumber } from "./refs";

const tick = () => new Promise<void>((r) => setTimeout(r, 0));

describe("références séquentielles", () => {
  it("le prochain numéro vient du MAXIMUM, pas du compte — un trou ne fait pas revenir un numéro", () => {
    expect(nextRefNumber(["VAL-2026-001", "VAL-2026-007", "VAL-2026-003"])).toBe(8);
    expect(buildRef("VAL", 2026, [])).toBe("VAL-2026-001");
    expect(buildRef("VAL", 2026, ["VAL-2026-999"])).toBe("VAL-2026-1000");
  });
});

/**
 * UNE SÉRIE, UNE CRÉATION À LA FOIS (§118.148). La propriété est celle d'une lecture-écriture :
 * chacun lit le maximum, attend (l'aller-retour vers la base), puis écrit maximum + 1. Sans file,
 * les vingt-cinq concurrents lisent TOUS la même valeur et le compteur finit à 1 — c'est le cas
 * exact des demandes de validation de vingt-cinq BC émis d'un coup, et celui qui ferait tomber
 * la première assertion si `enSerie` cessait de sérialiser.
 */
describe("enSerie — la file d'une série de références", () => {
  it("vingt-cinq lectures-écritures concurrentes n'en perdent aucune", async () => {
    let compteur = 0;
    const vus: number[] = [];
    await Promise.all(Array.from({ length: 25 }, () => enSerie("banc:compteur", async () => {
      const lu = compteur;
      await tick();
      await tick();
      compteur = lu + 1;
      vus.push(compteur);
    })));
    expect(compteur).toBe(25);
    expect(vus).toEqual(Array.from({ length: 25 }, (_, i) => i + 1));
  });

  it("un échec ne bloque pas la file — le suivant passe, et l'échec reste à SON appelant", async () => {
    const ordre: string[] = [];
    const premier = enSerie("banc:echec", async () => { ordre.push("premier"); throw new Error("panne"); });
    const second = enSerie("banc:echec", async () => { ordre.push("second"); return "ok"; });
    await expect(premier).rejects.toThrow("panne");
    await expect(second).resolves.toBe("ok");
    expect(ordre).toEqual(["premier", "second"]);
  });

  it("deux séries ne s'attendent pas — la file n'est pas un verrou global", async () => {
    let libererA: () => void = () => undefined;
    const bloqueA = new Promise<void>((r) => { libererA = r; });
    const a = enSerie("banc:a", async () => { await bloqueA; return "a"; });
    // B termine pendant que A est encore bloquée : un verrou global le ferait attendre pour toujours.
    await expect(enSerie("banc:b", async () => "b")).resolves.toBe("b");
    libererA();
    await expect(a).resolves.toBe("a");
  });
});
