import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { saveFile, readFileByKey, deleteFileByKey, validateDriveUpload } from "./storage";

/** Pur (sans base) : le Drive accepte les fichiers généraux, refuse les exécutables. */
describe("validateDriveUpload — Drive = stockage général", () => {
  it("accepte documents et médias courants", () => {
    expect(validateDriveUpload("rapport.pdf", 1000)).toBeNull();
    expect(validateDriveUpload("demo.mp4", 1000)).toBeNull();
    expect(validateDriveUpload("audio.mp3", 1000)).toBeNull();
    expect(validateDriveUpload("archive.zip", 1000)).toBeNull();
    expect(validateDriveUpload("deck.pptx", 1000)).toBeNull();
  });
  it("refuse les exécutables / scripts", () => {
    expect(validateDriveUpload("virus.exe", 1000)).toBeTruthy();
    expect(validateDriveUpload("script.sh", 1000)).toBeTruthy();
    expect(validateDriveUpload("macro.js", 1000)).toBeTruthy();
  });
  it("refuse les fichiers vides et trop volumineux", () => {
    expect(validateDriveUpload("x.pdf", 0)).toBeTruthy();
    expect(validateDriveUpload("huge.pdf", 999 * 1024 * 1024)).toBeTruthy();
  });
});

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
