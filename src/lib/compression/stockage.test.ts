import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import { prisma } from "@/lib/prisma";
import { getBlob, infoBlob, putBlob, putBlobFromFile, releaseBlob, sha256 } from "@/lib/drive-storage";
import { decider, decompresser } from "./flux";
import { GAIN_MIN } from "./politique";

/**
 * LA COMPRESSION AU REPOS, PAR LES VRAIS POINTS D'ENTRÉE (`putBlob`, `putBlobFromFile`, `getBlob`)
 * sur la vraie base. Chaque cas nomme ce qui le ferait tomber (§118.17) ; la série de sabotages de
 * §118.214 les rejoue un à un.
 */

const ids: string[] = [];
const fichiers: string[] = [];
const marque = crypto.randomBytes(6).toString("hex"); // chaque cas écrit un contenu UNIQUE : pas de déduplication avec un voisin

const csv = (lignes: number, graine = marque) => {
  const out: string[] = ["id;lot;produit;resultat;commentaire"];
  for (let i = 0; i < lignes; i++) out.push(`${i};L${100000 + (i % 977)};produit-${i % 13};${(Math.sin(i) * 100).toFixed(3)};note ${graine} ${i % 29}`);
  return Buffer.from(out.join("\n"));
};

async function ligne(blobId: string) {
  return prisma.fileBlob.findUniqueOrThrow({ where: { id: blobId }, select: { codec: true, storedSize: true, size: true, sha256: true, data: true, storageKey: true } });
}

beforeAll(async () => { await prisma.$queryRaw`SELECT 1`; });
afterEach(() => { delete process.env.REG_BLOB_CHUNK_MB; });
afterAll(async () => {
  for (const id of ids) await releaseBlob(id).catch(() => undefined);
  await prisma.fileBlob.deleteMany({ where: { id: { in: ids } } }).catch(() => undefined);
  for (const f of fichiers) fs.rmSync(f, { force: true });
});

describe("compression au repos — aller-retour exact", () => {
  it("un CSV est stocké compressé, et RELU octet pour octet — l'empreinte reste celle du clair", async () => {
    const plain = csv(40_000);
    const r = await putBlob(plain);
    ids.push(r.blobId);
    const l = await ligne(r.blobId);
    expect(l.codec).toBe("br");
    expect(l.size).toBe(plain.length);
    expect(l.sha256).toBe(sha256(plain));
    expect(l.storedSize!).toBeLessThan(plain.length * (1 - GAIN_MIN));
    expect(r.storedSize).toBe(l.storedSize);
    const lu = await getBlob(r.blobId);
    expect(lu).not.toBeNull();
    expect(lu!.equals(plain)).toBe(true);
    // Ce que la base tient réellement est PLUS PETIT que le clair (le chiffrement ajoute 16 octets de tag).
    expect(Buffer.from(l.data!).length).toBe(l.storedSize! + 16);
    expect(Buffer.from(l.data!).length).toBeLessThan(plain.length);
  }, 120_000);

  it("`infoBlob` rend l'empreinte du clair, la taille du clair et le codec — sans lire le fichier", async () => {
    const plain = csv(8_000, `${marque}-info`);
    const r = await putBlob(plain);
    ids.push(r.blobId);
    const info = await infoBlob(r.blobId);
    expect(info).toEqual({ sha256: sha256(plain), size: plain.length, codec: "br", storedSize: r.storedSize });
  });

  it("un contenu DÉJÀ compressé (ZIP, JPEG, MP4) reste brut — jamais recompressé, jamais gonflé", async () => {
    const aleatoire = crypto.randomBytes(300_000);
    for (const [tete, nom] of [
      [Buffer.from([0x50, 0x4b, 0x03, 0x04]), "zip"],
      [Buffer.from([0xff, 0xd8, 0xff, 0xe0]), "jpeg"],
      [Buffer.from("0000001866747970", "hex"), "mp4"],
    ] as const) {
      const plain = Buffer.concat([tete, aleatoire.subarray(0, 250_000), Buffer.from(`${nom}-${marque}`)]);
      const r = await putBlob(plain);
      ids.push(r.blobId);
      const l = await ligne(r.blobId);
      expect(l.codec, nom).toBeNull();
      expect(l.storedSize, nom).toBeNull();
      expect((await getBlob(r.blobId))!.equals(plain), nom).toBe(true);
      expect(Buffer.from(l.data!).length, nom).toBe(plain.length + 16); // exactement comme avant la compression
    }
  });

  it("des octets incompressibles quelconques restent bruts (l'essai sur échantillon les écarte)", async () => {
    const plain = Buffer.concat([crypto.randomBytes(400_000), Buffer.from(marque)]);
    const d = await decider(plain);
    expect(d).toEqual({ compresse: false, raison: "echantillon-incompressible" });
    const r = await putBlob(plain);
    ids.push(r.blobId);
    expect((await ligne(r.blobId)).codec).toBeNull();
  });

  it("un petit fichier (< 4 Ko) n'est pas compressé : le gain absolu ne vaut pas la décompression", async () => {
    const plain = csv(60, `${marque}-petit`);
    expect(plain.length).toBeLessThan(4096);
    const r = await putBlob(plain);
    ids.push(r.blobId);
    const l = await ligne(r.blobId);
    expect(l.codec).toBeNull();
    expect((await getBlob(r.blobId))!.equals(plain)).toBe(true);
  });

  it("un échantillon prometteur dont le fichier ENTIER n'économise pas GAIN_MIN reste brut (gain réel, pas estimé)", async () => {
    // 30 Ko très répétitifs au début (l'échantillon les voit), 370 Ko aléatoires derrière : ~7,5 % de gain réel.
    const plain = Buffer.concat([Buffer.alloc(30_000, "abcdefgh"), crypto.randomBytes(370_000)]);
    const d = await decider(plain);
    expect(d).toEqual({ compresse: false, raison: "gain-insuffisant" });
  });

  it("deux dépôts du même contenu : un seul blob, déjà compressé, relu identique (la déduplication se décide sur le clair)", async () => {
    const plain = csv(12_000, `${marque}-dedup`);
    const a = await putBlob(plain);
    const b = await putBlob(plain);
    ids.push(a.blobId);
    expect(b.deduplicated).toBe(true);
    expect(b.blobId).toBe(a.blobId);
    expect((await getBlob(b.blobId))!.equals(plain)).toBe(true);
  });
});

describe("rétrocompatibilité : méthode absente = brut", () => {
  it("une ligne d'avant (codec et storedSize nuls) se lit telle quelle", async () => {
    const plain = csv(50, `${marque}-ancien`); // petit : stocké brut, comme tout fichier d'avant la compression
    const r = await putBlob(plain);
    ids.push(r.blobId);
    const l = await ligne(r.blobId);
    expect(l.codec).toBeNull();
    expect(l.storedSize).toBeNull();
    expect((await getBlob(r.blobId))!.equals(plain)).toBe(true);
  });

  it("un codec que cette version ne connaît pas est REFUSÉ à la lecture — jamais servi tel quel", async () => {
    const plain = csv(9_000, `${marque}-codec`);
    const r = await putBlob(plain);
    ids.push(r.blobId);
    await prisma.fileBlob.update({ where: { id: r.blobId }, data: { codec: "zz" } });
    await expect(getBlob(r.blobId)).rejects.toThrow(/Codec de stockage inconnu « zz »/);
    await prisma.fileBlob.update({ where: { id: r.blobId }, data: { codec: "br" } });
    expect((await getBlob(r.blobId))!.equals(plain)).toBe(true);
  });

  it("un contenu décompressé qui ne retombe pas sur l'empreinte est REFUSÉ (corruption)", async () => {
    const plain = csv(9_000, `${marque}-empreinte`);
    const r = await putBlob(plain);
    ids.push(r.blobId);
    const vraie = (await ligne(r.blobId)).sha256;
    await prisma.fileBlob.update({ where: { id: r.blobId }, data: { sha256: "0".repeat(64) } });
    await expect(getBlob(r.blobId)).rejects.toThrow(/Empreinte/);
    await prisma.fileBlob.update({ where: { id: r.blobId }, data: { sha256: vraie } });
  });

  it("`decompresser` borne la sortie : une taille déclarée trop petite lève, une « bombe » ne gonfle pas", async () => {
    const plain = Buffer.alloc(2_000_000, "a");
    const d = await decider(plain);
    expect(d.compresse).toBe(true);
    if (!d.compresse) return;
    await expect(decompresser("br", d.octets, 1000)).rejects.toThrow();
    await expect(decompresser("br", d.octets, plain.length)).resolves.toHaveLength(plain.length);
  });
});

describe("tranches en base (gros contenu)", () => {
  it("un contenu compressé de plus d'une tranche s'écrit en tranches et se relit exactement", async () => {
    process.env.REG_BLOB_CHUNK_MB = "1";
    // base64 d'octets aléatoires : ~25 % de gain, donc compressé (~3,9 Mo) ET plus grand qu'une tranche d'1 Mo.
    const plain = Buffer.from(crypto.randomBytes(5_000_000).toString("base64"));
    const r = await putBlob(plain);
    ids.push(r.blobId);
    const l = await ligne(r.blobId);
    expect(l.codec).toBe("br");
    expect(l.data).toBeNull();
    const n = await prisma.fileBlobChunk.count({ where: { blobId: r.blobId } });
    expect(n).toBeGreaterThan(1);
    expect((await getBlob(r.blobId))!.equals(plain)).toBe(true);
    // Intégrité des tranches : une tranche manquante ne rend PAS un fichier tronqué.
    await prisma.fileBlobChunk.deleteMany({ where: { blobId: r.blobId, idx: 1 } });
    expect(await getBlob(r.blobId)).toBeNull();
  });
});

describe("chemin fichier : en flux, mémoire bornée", () => {
  const ecrire = (nom: string, buf: Buffer) => { const p = path.join(os.tmpdir(), `amd-test-${marque}-${nom}`); fs.writeFileSync(p, buf); fichiers.push(p); return p; };
  const residus = () => fs.readdirSync(os.tmpdir()).filter((f) => f.startsWith("amd-cmp-"));

  it("un fichier compressible est stocké compressé, relu identique, et AUCUN fichier temporaire ne reste", async () => {
    const plain = csv(60_000, `${marque}-fichier`);
    const avant = residus().length;
    const r = await putBlobFromFile(ecrire("a.csv", plain));
    ids.push(r.blobId);
    const l = await ligne(r.blobId);
    expect(l.codec).toBe("br");
    expect(l.size).toBe(plain.length);
    expect(r.storedSize).toBe(l.storedSize);
    expect((await getBlob(r.blobId))!.equals(plain)).toBe(true);
    expect(residus().length).toBe(avant);
  });

  it("un fichier déjà compressé reste brut sur le chemin fichier aussi", async () => {
    const plain = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), crypto.randomBytes(300_000), Buffer.from(marque)]);
    const r = await putBlobFromFile(ecrire("b.zip", plain));
    ids.push(r.blobId);
    expect((await ligne(r.blobId)).codec).toBeNull();
    expect((await getBlob(r.blobId))!.equals(plain)).toBe(true);
  });

  it("par tranches en base : le fichier compressé relit exactement", async () => {
    process.env.REG_BLOB_CHUNK_MB = "1";
    const plain = Buffer.from(crypto.randomBytes(4_000_000).toString("base64"));
    const r = await putBlobFromFile(ecrire("c.txt", plain));
    ids.push(r.blobId);
    const l = await ligne(r.blobId);
    expect(l.codec).toBe("br");
    expect(await prisma.fileBlobChunk.count({ where: { blobId: r.blobId } })).toBeGreaterThan(1);
    expect((await getBlob(r.blobId))!.equals(plain)).toBe(true);
  });

  it("une empreinte fournie qui ne correspond pas au fichier : le contenu est stocké BRUT (la relecture refuse de compresser)", async () => {
    const plain = csv(20_000, `${marque}-sha`);
    const p = ecrire("d.csv", plain);
    const r = await putBlobFromFile(p, { sha256: "f".repeat(64) });
    ids.push(r.blobId);
    expect((await ligne(r.blobId)).codec).toBeNull(); // la vérification en flux a échoué : pas de contenu compressé non vérifié
  });

  it("MÉMOIRE BORNÉE : 160 Mo de CSV passent en flux sans que le pic dépasse une fraction du fichier", async () => {
    // Le fichier est écrit en flux (jamais entier en mémoire dans le test non plus).
    const p = path.join(os.tmpdir(), `amd-test-${marque}-gros.csv`);
    fichiers.push(p);
    const fd = fs.openSync(p, "w");
    const bloc = csv(120_000, `${marque}-gros`);
    let ecrit = 0;
    while (ecrit < 160 * 1024 * 1024) {
      // un en-tête de bloc unique : deux blocs consécutifs ne sont pas identiques
      fs.writeSync(fd, Buffer.concat([Buffer.from(`# bloc ${ecrit}\n`), bloc, Buffer.from("\n")]));
      ecrit = fs.fstatSync(fd).size;
    }
    fs.closeSync(fd);
    const taille = fs.statSync(p).size;
    // Les tranches en base sont écrites par Prisma, dont le moteur natif multiplie la taille d'un
    // paramètre bytea : mesuré, la croissance de la mémoire suit la TRANCHE (16 Mo par défaut), pas
    // le fichier. Le cas la ramène à 4 Mo pour isoler ce qui nous appartient — la compression.
    process.env.REG_BLOB_CHUNK_MB = "4";
    global.gc?.();
    const base = process.memoryUsage().rss;
    let pic = base;
    const t = setInterval(() => { pic = Math.max(pic, process.memoryUsage().rss); }, 20);
    let r;
    try { r = await putBlobFromFile(p); } finally { clearInterval(t); }
    ids.push(r.blobId);
    const l = await ligne(r.blobId);
    expect(l.codec).toBe("br");
    expect(l.storedSize!).toBeLessThan(taille * 0.5);
    // Charger le fichier entier coûterait ≥ 160 Mo d'un seul tenant ; le flux en tient une fraction.
    const croissance = pic - base;
    expect(croissance, `pic de mémoire +${Math.round(croissance / 1048576)} Mo pour un fichier de ${Math.round(taille / 1048576)} Mo`).toBeLessThan(taille * 0.75);
    expect(residus().length).toBe(0);
    // Relu : la taille et l'empreinte du clair d'origine.
    const lu = await getBlob(r.blobId);
    expect(lu!.length).toBe(taille);
    expect(sha256(lu!)).toBe(l.sha256);
  }, 120_000);
});
