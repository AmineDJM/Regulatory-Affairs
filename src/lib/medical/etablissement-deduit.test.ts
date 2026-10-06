import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { deduireEtablissement, complementDeFiche, serviceDeLaSpecialite, type EtablissementPourDeduction } from "./etablissement-deduit";

/**
 * RATTACHEMENT AUTOMATIQUE (Direction, 06/10) — wilaya à un seul hôpital → rattaché ; plusieurs → à trancher ;
 * spécialité qui n'est un service que d'un seul hôpital de la wilaya → celui-là ; service = spécialité.
 */

const E = (id: string, wilaya: string, services: string[] = [], type = "CHU", isActive = true): EtablissementPourDeduction =>
  ({ id, name: id, wilaya, type, isActive, services: services.map((s, i) => ({ id: `${id}-s${i}`, name: s })) });

const REF = [
  E("chu-tlemcen", "Tlemcen", ["Infectiologie", "Cardiologie"]),
  E("chu-oran", "Oran", ["Infectiologie", "Pneumologie"]),
  E("ehu-oran", "Oran", ["Cardiologie"], "EHS"),
  E("eph-oran", "Oran", ["Pédiatrie"], "EPH"),
  E("clinique-oran", "Oran", ["Infectiologie"], "CLINIQUE_PRIVEE"),
  E("eph-ferme", "Mostaganem", ["Infectiologie"], "EPH", false),
  E("chu-alger-1", "Alger", ["Infectiologie"]),
  E("chu-alger-2", "Alger", ["Infectiologie"]),
];

describe("déduire l'établissement", () => {
  it("wilaya à UN SEUL établissement hospitalier → rattaché (et son service de la spécialité)", () => {
    expect(deduireEtablissement({ wilaya: "Tlemcen", specialite: "Infectiologie" }, REF)).toMatchObject({ statut: "unique", institutionId: "chu-tlemcen", serviceId: "chu-tlemcen-s0" });
    expect(deduireEtablissement({ wilaya: "TLEMCEN", specialite: null }, REF)).toMatchObject({ statut: "unique", institutionId: "chu-tlemcen", serviceId: null });
  });
  it("spécialité qui n'est un service que d'UN hôpital de la wilaya → celui-là, même si la wilaya en compte plusieurs", () => {
    expect(deduireEtablissement({ wilaya: "Oran", specialite: "Infectiologie" }, REF)).toMatchObject({ statut: "unique", institutionId: "chu-oran", serviceId: "chu-oran-s0" });
    expect(deduireEtablissement({ wilaya: "Oran", specialite: "pédiatrie" }, REF)).toMatchObject({ statut: "unique", institutionId: "eph-oran" });
  });
  it("plusieurs hôpitaux possibles → À TRANCHER, avec les candidats", () => {
    expect(deduireEtablissement({ wilaya: "Oran", specialite: "Dermatologie" }, REF)).toMatchObject({ statut: "a_trancher", candidats: ["chu-oran", "ehu-oran", "eph-oran"] });
    expect(deduireEtablissement({ wilaya: "Alger", specialite: "Infectiologie" }, REF)).toMatchObject({ statut: "a_trancher", candidats: ["chu-alger-1", "chu-alger-2"] });
  });
  it("une clinique ne compte pas ; un établissement désactivé non plus ; sans wilaya, rien", () => {
    expect(deduireEtablissement({ wilaya: "Mostaganem", specialite: "Infectiologie" }, REF).statut).toBe("aucun");
    expect(deduireEtablissement({ wilaya: null, specialite: "Infectiologie" }, REF).statut).toBe("aucun");
  });
});

describe("service = spécialité", () => {
  it("le service qui porte le nom de la spécialité (casse et accents mis à part), jamais un autre", () => {
    expect(serviceDeLaSpecialite(REF[1], "INFECTIOLOGIE")).toBe("chu-oran-s0");
    expect(serviceDeLaSpecialite(REF[1], "Infectio")).toBeNull();
  });
  it("une fiche rattachée sans service reçoit celui de sa spécialité", () => {
    expect(complementDeFiche({ institutionId: "chu-oran", serviceId: null, wilaya: "Oran", specialite: "Pneumologie" }, REF)).toMatchObject({ serviceId: "chu-oran-s1" });
    expect(complementDeFiche({ institutionId: "chu-oran", serviceId: "x", wilaya: "Oran", specialite: "Pneumologie" }, REF)).toBeNull();
  });
  it("à trancher n'écrit rien ; un établissement déjà écrit à la main n'est pas remplacé par une déduction", () => {
    expect(complementDeFiche({ institutionId: null, serviceId: null, wilaya: "Alger", specialite: "Infectiologie" }, REF)).toBeNull();
    expect(complementDeFiche({ institutionId: null, institutionTexte: "Clinique El Azhar", serviceId: null, wilaya: "Tlemcen", specialite: null }, REF)).toBeNull();
  });
});

describe("branchements", () => {
  it("la cellule, l'ajout, l'import et le geste en lot appliquent la MÊME règle", () => {
    const a = readFileSync("src/lib/actions/medical-directory-actions.ts", "utf8");
    expect(a.match(/completerRattachement\(/g)?.length).toBeGreaterThanOrEqual(4);
    expect(a).toContain('if (field === "wilaya" || field === "specialty" || field === "institution") await completerRattachement([id], user.id);');
  });
  it("l'annuaire D'UNE spécialité masque la colonne Spécialité ; la vue de toutes la garde", () => {
    const f = readFileSync("src/app/(app)/annuaires/feuille-praticiens.tsx", "utf8");
    expect(f).toContain('colonnesMasquees={specialiteDeLAnnuaire ? ["specialty"] : []}');
    expect(f).toContain("feuille.specialiteOuverte !== SANS_SPECIALITE");
  });
});
