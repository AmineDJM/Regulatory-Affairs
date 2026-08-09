import { describe, it, expect, beforeAll, afterAll } from "vitest";
import JSZip from "jszip";
import { prisma } from "@/lib/prisma";
import { ingestCaseArchive } from "./ingest-case";
import { experienceForSection } from "./for-section";

/**
 * LA PROMESSE COMPLÈTE DU MODULE D'ENTRAÎNEMENT, de bout en bout : un ZIP de produit passé
 * (réserves + tracker) est DÉPLIÉ, chaque pièce lisible devient un précédent, et ces précédents
 * sont SERVIS à l'analyse de N'IMPORTE QUEL dossier — l'étude de cas est un dossier à part,
 * ses leçons ne le sont pas.
 */

const TAG = `test-training-zip-${Date.now()}`;
let caseId = "";

// Long pour passer le seuil des 300 caractères : une vraie réserve ANPP l'est toujours.
const RESERVE_TXT = [
  "Réserves émises suite à l'évaluation du dossier soumis à l'enregistrement.",
  "3.2.S.4.3. Validation des Procédures analytiques :",
  "- Veuillez fournir la validation de la méthode de dosage des solvants résiduels avec tous les",
  "paramètres nécessaires conformément à ICH Q2 : il n'y a que l'exactitude qui est fournie.",
  "- Veuillez fournir la LOD et la LOQ des impuretés ainsi que les chromatogrammes du paramètre",
  "de spécificité des différentes méthodes analytiques utilisées pour le produit fini.",
  "3.2.S.7.3. Données sur la stabilité :",
  "- Veuillez poursuivre les études de stabilité couvrant toute la période de validité.",
].join("\n");

const TRACKER_TXT = [
  "Suivi des réserves ANPP — trithérapie. Priorités et statut de levée, point par point.",
  "3.2.S.3 : soumettre la section complète de caractérisation, y compris le polymorphisme,",
  "l'isomérie et les spectres d'identification avec standard de référence (IR, UV, RMN, SM).",
  "3.2.S.3.2 : profil d'impuretés complet, génotoxicité et recherche des nitrosamines (ICH M7).",
  "Module 5 : rapport complet de bioéquivalence avec données pharmacocinétiques individuelles.",
].join("\n");

async function makeZip(files: Record<string, string | Buffer>): Promise<Buffer> {
  const z = new JSZip();
  for (const [name, content] of Object.entries(files)) z.file(name, content);
  return z.generateAsync({ type: "nodebuffer" });
}

describe("ingestCaseArchive — un ZIP de produit passé, déplié pièce par pièce (intégration)", () => {
  beforeAll(async () => {
    caseId = (await prisma.regulatoryCaseStudy.create({
      data: { title: `${TAG} — trithérapie enregistrement`, outcome: "ACCEPTED_WITH_RESERVES", lesson: "L'ANPP exige la validation analytique complète, jamais l'exactitude seule." },
      select: { id: true },
    })).id;
  });

  afterAll(async () => {
    await prisma.regulatoryCaseStudy.deleteMany({ where: { id: caseId } }).catch(() => undefined); // cascade → docs
  });

  it("déplie l'archive, ingère les pièces lisibles, refuse le reste EN LE DISANT", async () => {
    const zip = await makeZip({
      "reserves/reserve en fr.txt": RESERVE_TXT,
      "reserves/tracker.txt": TRACKER_TXT,
      "reserves/script.exe": Buffer.from("MZ\x90\x00binaire"),
      "reserves/photo.bmp": Buffer.from("BM????"),
    });
    const results = await ingestCaseArchive({ caseId, filename: "dossier-reserves.zip", buffer: zip });

    const byName = (f: string) => results.find((r) => r.filename.includes(f))!;
    expect(byName("reserve en fr.txt").status).toBe("INGESTED");
    expect(byName("tracker.txt").status).toBe("INGESTED");
    // L'exécutable est bloqué par l'inspection ; le format inconnu est ignoré avec son motif.
    expect(byName("script.exe").status).toBe("FAILED");
    expect(byName("photo.bmp").status).toBe("FAILED");
    expect(byName("photo.bmp").error).toContain("ignoré");

    // Les pièces ingérées portent leurs sections CTD repérées (c'est ce qui route les précédents).
    const docs = await prisma.regulatoryCaseDoc.findMany({ where: { caseId }, select: { filename: true, sections: true } });
    expect(docs).toHaveLength(2);
    expect(docs.flatMap((d) => d.sections)).toContain("3.2.S.4.3");
  });

  it("redéposer le MÊME ZIP ne crée rien (déduplication par empreinte, pièce par pièce)", async () => {
    const zip = await makeZip({ "reserves/reserve en fr.txt": RESERVE_TXT, "reserves/tracker.txt": TRACKER_TXT });
    const results = await ingestCaseArchive({ caseId, filename: "dossier-reserves.zip", buffer: zip });
    expect(results.every((r) => r.status === "UNCHANGED")).toBe(true);
    expect(await prisma.regulatoryCaseDoc.count({ where: { caseId } })).toBe(2);
  });

  it("les leçons SERVENT À TOUS les dossiers : l'expérience de la section est servie sans aucun filtre de dossier", async () => {
    // `experienceForSection` est appelée par la revue de CHAQUE document de CHAQUE dossier —
    // elle ne reçoit que la section, jamais un identifiant de dossier ou d'étude de cas.
    // Limite large : la base de test porte les précédents d'autres suites — la promesse à
    // vérifier est « servi sans filtre de dossier », pas « premier du classement ».
    const exp = await experienceForSection("3.2.S.4.3", 50);
    const fromOurZip = exp.find((e) => e.label.includes(TAG));
    expect(fromOurZip).toBeTruthy();
    expect(fromOurZip!.label).toContain("ACCEPTÉ AVEC RÉSERVES"); // l'issue réelle accompagne le précédent
    expect(fromOurZip!.label).toContain("jamais l'exactitude seule"); // la leçon humaine aussi
    expect(fromOurZip!.snippet).toContain("solvants résiduels"); // et l'extrait verbatim de la pièce

    // Et surtout le cas RÉEL : une revue porte la section PARENTE cataloguée (3.2.S.4) — le
    // précédent au code profond doit lui être servi par préfixe.
    const parent = await experienceForSection("3.2.S.4", 50);
    expect(parent.some((e) => e.label.includes(TAG))).toBe(true);
  });

  it("une archive corrompue est refusée d'un bloc, avec son motif", async () => {
    const results = await ingestCaseArchive({ caseId, filename: "corrompu.zip", buffer: Buffer.from("pas un zip du tout") });
    expect(results).toHaveLength(1);
    expect(results[0].status).toBe("FAILED");
  });
});
