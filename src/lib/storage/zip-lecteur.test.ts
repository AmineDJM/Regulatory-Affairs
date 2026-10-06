import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { listerZip, lireEntreeZip, fluxEntreeZip, sourceTampon, cheminSur, ErreurZip } from "./zip-lecteur";

async function archive(fichiers: Record<string, string | Buffer>, compression: "DEFLATE" | "STORE" = "DEFLATE", commentaire?: string): Promise<Buffer> {
  const z = new JSZip();
  for (const [nom, contenu] of Object.entries(fichiers)) z.file(nom, contenu);
  return z.generateAsync({ type: "nodebuffer", compression, comment: commentaire });
}

describe("lecteur de ZIP par plages", () => {
  it("liste les entrées et en lit une, compressée ou non", async () => {
    for (const mode of ["DEFLATE", "STORE"] as const) {
      const buf = await archive({ "Module 1/lettre.txt": "bonjour ".repeat(500), "Module 3/3.2.P/données.xml": "<a/>", "vide.txt": "x" }, mode);
      const src = sourceTampon(buf);
      const { entrees, tronque } = await listerZip(src);
      expect(tronque).toBe(false);
      const fichiers = entrees.filter((e) => !e.dossier).map((e) => e.chemin).sort();
      expect(fichiers).toEqual(["Module 1/lettre.txt", "Module 3/3.2.P/données.xml", "vide.txt"]);
      const e = entrees.find((x) => x.chemin === "Module 1/lettre.txt")!;
      expect((await lireEntreeZip(src, e)).toString()).toBe("bonjour ".repeat(500));
      const x = entrees.find((y) => y.chemin.endsWith("données.xml"))!;
      expect((await lireEntreeZip(src, x)).toString()).toBe("<a/>");
    }
  });

  it("retrouve la fin du répertoire derrière un commentaire d'archive", async () => {
    const buf = await archive({ "a.txt": "A" }, "DEFLATE", "c".repeat(5000));
    const { entrees } = await listerZip(sourceTampon(buf));
    expect(entrees.map((e) => e.chemin)).toEqual(["a.txt"]);
  });

  it("ne lit que les plages nécessaires : jamais l'archive entière", async () => {
    const gros = Buffer.alloc(3 * 1024 * 1024, 7); // incompressible-ish n'est pas nécessaire : on compte les lectures
    const buf = await archive({ "gros.bin": gros, "petit.txt": "ok" }, "STORE");
    const lus: number[] = [];
    const src = { taille: buf.length, lire: async (d: number, l: number) => { lus.push(l); return buf.subarray(d, d + l); } };
    const { entrees } = await listerZip(src);
    const p = entrees.find((e) => e.chemin === "petit.txt")!;
    expect((await lireEntreeZip(src, p)).toString()).toBe("ok");
    expect(Math.max(...lus)).toBeLessThan(buf.length / 2); // le gros fichier n'a jamais été lu
  });

  it("refuse ce qui n'est pas un ZIP, une entrée trop grosse et une entrée chiffrée — en le disant", async () => {
    await expect(listerZip(sourceTampon(Buffer.from("pas un zip du tout, vraiment pas")))).rejects.toThrow(ErreurZip);
    const buf = await archive({ "a.txt": "x".repeat(1000) });
    const src = sourceTampon(buf);
    const { entrees } = await listerZip(src);
    await expect(lireEntreeZip(src, entrees[0], 10)).rejects.toThrow(/trop volumineuse/);
    await expect(lireEntreeZip(src, { ...entrees[0], chiffree: true })).rejects.toThrow(/mot de passe/);
    await expect(lireEntreeZip(src, { ...entrees[0], methode: 99 })).rejects.toThrow(/non prise en charge/);
  });

  it("refuse de gonfler plus que la taille annoncée (bombe)", async () => {
    const buf = await archive({ "a.txt": "x".repeat(100_000) });
    const src = sourceTampon(buf);
    const { entrees } = await listerZip(src);
    // L'archive annonce 10 octets : la décompression, plafonnée à cette taille, ne doit pas passer.
    await expect(lireEntreeZip(src, { ...entrees[0], taille: 10 })).rejects.toThrow();
  });

  it("neutralise les chemins qui remontent l'arborescence", () => {
    expect(cheminSur("../../etc/passwd")).toBe("etc/passwd");
    expect(cheminSur("/abs\\sous/./x.txt")).toBe("abs/sous/x.txt");
  });

  it("lit une archive Zip64 (champs saturés + bloc étendu)", async () => {
    const nom = Buffer.from("Module 5/étude.txt", "utf8");
    const donnees = Buffer.from("contenu zip64");
    const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6);
    local.writeUInt32LE(donnees.length, 18); local.writeUInt32LE(donnees.length, 22); local.writeUInt16LE(nom.length, 26);
    const partieLocale = Buffer.concat([local, nom, donnees]);
    const extra = Buffer.alloc(4 + 24); extra.writeUInt16LE(1, 0); extra.writeUInt16LE(24, 2);
    extra.writeBigUInt64LE(BigInt(donnees.length), 4); extra.writeBigUInt64LE(BigInt(donnees.length), 12); extra.writeBigUInt64LE(0n, 20);
    const c = Buffer.alloc(46); c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(45, 4); c.writeUInt16LE(45, 6); c.writeUInt16LE(0x0800, 8);
    c.writeUInt32LE(0xffffffff, 20); c.writeUInt32LE(0xffffffff, 24); c.writeUInt16LE(nom.length, 28); c.writeUInt16LE(extra.length, 30); c.writeUInt32LE(0xffffffff, 42);
    const central = Buffer.concat([c, nom, extra]);
    const debutCentral = partieLocale.length;
    const fin64 = Buffer.alloc(56); fin64.writeUInt32LE(0x06064b50, 0); fin64.writeBigUInt64LE(44n, 4);
    fin64.writeBigUInt64LE(1n, 24); fin64.writeBigUInt64LE(1n, 32); fin64.writeBigUInt64LE(BigInt(central.length), 40); fin64.writeBigUInt64LE(BigInt(debutCentral), 48);
    const loc = Buffer.alloc(20); loc.writeUInt32LE(0x07064b50, 0); loc.writeBigUInt64LE(BigInt(debutCentral + central.length), 8); loc.writeUInt32LE(1, 16);
    const fin = Buffer.alloc(22); fin.writeUInt32LE(0x06054b50, 0); fin.writeUInt16LE(0xffff, 8); fin.writeUInt16LE(0xffff, 10); fin.writeUInt32LE(0xffffffff, 12); fin.writeUInt32LE(0xffffffff, 16);
    const zip = Buffer.concat([partieLocale, central, fin64, loc, fin]);
    const src = sourceTampon(zip);
    const { entrees } = await listerZip(src);
    expect(entrees).toHaveLength(1);
    expect(entrees[0].chemin).toBe("Module 5/étude.txt");
    expect((await lireEntreeZip(src, entrees[0])).toString()).toBe("contenu zip64");
  });
});

describe("une grosse entrée se lit EN FLUX (Direction, 06/10 : « trop volumineuse pour être ouverte ici »)", () => {
  const lireTout = async (flux: NodeJS.ReadableStream): Promise<Buffer> => {
    const morceaux: Buffer[] = [];
    for await (const m of flux) morceaux.push(Buffer.from(m as Buffer));
    return Buffer.concat(morceaux);
  };
  it("rend les mêmes octets que la lecture d'un bloc — compressée ou non, lue par petits morceaux", async () => {
    const contenu = Buffer.from(Array.from({ length: 300_000 }, (_, i) => String.fromCharCode(65 + ((i * 7) % 26))).join(""));
    for (const mode of ["DEFLATE", "STORE"] as const) {
      const src = sourceTampon(await archive({ "Module 5/FILE 4 FINAL.pdf": contenu }, mode));
      const e = (await listerZip(src)).entrees.find((x) => !x.dossier)!;
      expect((await lireTout(await fluxEntreeZip(src, e, 4096))).equals(contenu)).toBe(true);
    }
  });
  it("une entrée qui gonfle au-delà de sa taille annoncée est arrêtée", async () => {
    const src = sourceTampon(await archive({ "a.txt": "a".repeat(100_000) }));
    const e = { ...(await listerZip(src)).entrees[0], taille: 10 };
    await expect(lireTout(await fluxEntreeZip(src, e, 1024))).rejects.toThrow(/taille décompressée/);
  });
});
