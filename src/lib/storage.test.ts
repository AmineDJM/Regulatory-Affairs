import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { saveFile, readFileByKey, deleteFileByKey } from "./storage";

let dbOk = false;
try { await prisma.$queryRaw`SELECT 1`; dbOk = true; } catch { dbOk = false; }
const suite = dbOk ? describe : describe.skip;

const KEY = "__storagetest__/hello.docx";

/**
 * Le stockage des documents doit être **durable en base** (et non sur le disque
 * local éphémère de Render) : c'est ce qui corrige l'« erreur de téléchargement »
 * à l'ouverture d'un .docx après un redéploiement.
 */
suite("Stockage durable des documents (FileBlob)", () => {
  afterAll(async () => {
    await deleteFileByKey(KEY).catch(() => {});
  });

  it("écrit puis relit exactement les mêmes octets (aller-retour)", async () => {
    const bytes = Buffer.from("PK contenu docx de test — éàü", "utf8");
    await saveFile(KEY, bytes);
    const back = await readFileByKey(KEY);
    expect(Buffer.compare(back, bytes)).toBe(0);
  });

  it("réécrire une clé remplace le contenu (et ne casse pas la relecture)", async () => {
    const v2 = Buffer.from("seconde version du document", "utf8");
    await saveFile(KEY, v2);
    const back = await readFileByKey(KEY);
    expect(back.toString("utf8")).toBe("seconde version du document");
  });

  it("supprimer la clé rend le fichier introuvable", async () => {
    await deleteFileByKey(KEY);
    await expect(readFileByKey(KEY)).rejects.toBeTruthy();
  });
});
