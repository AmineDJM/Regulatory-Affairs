import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Annuaires : « supprimer » une ligne l'ARCHIVE (réversible) — gardes de SOURCE. Le flux complet sur
 * base (archiver puis restaurer) n'a pas pu tourner ici faute de PostgreSQL local ; la migration, elle,
 * a été exécutée sur PGlite.
 */
const lire = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8");
const sansCommentaires = (s: string) =>
  s.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const actions = sansCommentaires(lire("src/lib/actions/medical-directory-actions.ts"));
const corps = (nom: string) => {
  const i = actions.indexOf(`export async function ${nom}`);
  expect(i, nom).toBeGreaterThan(-1);
  const suite = actions.indexOf("\nexport ", i + 10);
  return actions.slice(i, suite === -1 ? undefined : suite);
};

describe("archivage réversible des praticiens", () => {
  it("la migration est additive et idempotente (aucune fiche touchée)", () => {
    const sql = sansCommentaires(lire("prisma/migrations/20270113100000_annuaire_archivage/migration.sql").replace(/^--.*$/gm, ""));
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS "archivedAt"/);
    expect(sql).not.toMatch(/\b(DELETE|DROP|UPDATE|TRUNCATE)\b/i);
  });

  it("« supprimer » archive : plus aucun deleteMany sur les praticiens", () => {
    const sup = corps("deleteDirectoryDoctors");
    expect(sup).toContain("updateMany");
    expect(sup).toContain("archivedAt: new Date()");
    expect(sup).not.toContain("deleteMany");
  });

  it("la restauration remet archivedAt à null, derrière le même droit", () => {
    const res = corps("restaurerDirectoryDoctors");
    expect(res).toContain("archivedAt: null, archivedById: null");
    expect(res).toContain('peutAnnuaire(user, "MEDECINS", "DELETE")');
    expect(res).toContain('canAccessEntity(user, "DOCTOR", id, "DELETE")');
  });

  it("la feuille, l'export et la recherche n'incluent que les fiches actives", () => {
    const q = sansCommentaires(lire("src/lib/queries/annuaires.ts"));
    expect(q).toContain("{ archivedAt: null },"); // clausePraticiensVisibles
    expect(q).toMatch(/archiveWhere = archives \? \{ archivedAt: \{ not: null \} \} : \{ archivedAt: null \}/);
  });

  it("la vue Archivés et l'annuaire par spécialité sont montés sur la feuille des médecins", () => {
    const f = sansCommentaires(lire("src/app/(app)/annuaires/feuille-praticiens.tsx"));
    expect(f).toContain("<BarreSpecialites");
    expect(f).toContain('avecSpecialites={grade === "medecins"}');
    expect(f).toContain("archives={feuille.archives}");
  });
});
