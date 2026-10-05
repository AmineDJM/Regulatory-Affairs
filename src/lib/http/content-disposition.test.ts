import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
import { contentDisposition } from "./content-disposition";
import { refusTeleversement } from "@/lib/files/politique-televersement";

describe("contentDisposition — le nom accentué survit au téléchargement (constat 12)", () => {
  it("porte un repli ASCII ET le nom exact en UTF-8 (RFC 5987)", () => {
    const h = contentDisposition("Évaluation (finale) d'été.pdf");
    expect(h).toBe(`attachment; filename="Evaluation (finale) d'ete.pdf"; filename*=UTF-8''%C3%89valuation%20%28finale%29%20d%27%C3%A9t%C3%A9.pdf`);
  });
  it("retire guillemets et retours à la ligne (pas d'en-tête injecté)", () => {
    expect(contentDisposition('a"b\r\nSet-Cookie: x.txt', "inline")).toMatch(/^inline; filename="abSet-Cookie: x\.txt"; filename\*=UTF-8''/);
  });
});

describe("cliquet : aucune route ne nomme un fichier par `filename=` seul", () => {
  const fichiers = (dir: string): string[] => readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? fichiers(p) : p.endsWith(".ts") ? [p] : [];
  });
  it("chaque Content-Disposition passe par contentDisposition() ou porte filename*=", () => {
    const fautifs: string[] = [];
    const routes = fichiers(join(process.cwd(), "src/app/api"));
    expect(routes.length).toBeGreaterThan(100); // plancher : un parcours cassé ne rendrait pas ce banc vert
    for (const f of routes) {
      for (const ligne of readFileSync(f, "utf8").split("\n")) {
        if (/["']Content-Disposition["']\s*:/.test(ligne) && /filename=/.test(ligne) && !/filename\*=/.test(ligne)) fautifs.push(`${f}: ${ligne.trim()}`);
      }
    }
    expect(fautifs).toEqual([]);
  });
});

describe("une seule politique de types (constat 9)", () => {
  it(".rar, .7z, .msg passent partout ; un exécutable est refusé partout", () => {
    for (const ok of ["a.rar", "a.7z", "a.msg", "a.odt", "a.dwg"]) expect(refusTeleversement(ok, 10, 25)).toBeNull();
    expect(refusTeleversement("a.exe", 10, 25)).toMatch(/Type de fichier non autorisé \(\.exe\)/);
  });
  it("dit la taille du fichier ET la limite ; dit le fichier vide", () => {
    expect(refusTeleversement("a.pdf", 30 * 1024 * 1024, 25)).toBe("Fichier trop volumineux (30 Mo pour un maximum de 25 Mo).");
    expect(refusTeleversement("a.pdf", 0, 25)).toBe("Fichier vide (0 octet).");
  });
});
