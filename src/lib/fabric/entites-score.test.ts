import { describe, expect, it } from "vitest";
import { detecterIdentifiant, normaliserRequete, plierMolecules, scorerNom, trancher, type Candidat } from "./entites-score";

const cand = (libelle: string, score: number, extra: Partial<Candidat> = {}): Candidat =>
  ({ type: "FOURNISSEUR", id: libelle, libelle, detail: null, score, preuves: ["exact"], href: null, ...extra });

describe("résolution d'entités — le scoreur pur (F9)", () => {
  it("identifiants : e-mail, domaine, référence — cherchés, pas notés", () => {
    expect(detecterIdentifiant("R.Cherif@Adventum.dz")).toEqual({ kind: "email", valeur: "r.cherif@adventum.dz" });
    expect(detecterIdentifiant("@hetero.com")).toEqual({ kind: "domaine", valeur: "hetero.com" });
    expect(detecterIdentifiant("hetero.com")).toEqual({ kind: "domaine", valeur: "hetero.com" });
    expect(detecterIdentifiant("PRD-014")).toEqual({ kind: "reference", valeur: "PRD-014" });
    expect(detecterIdentifiant("Hetero Labs")).toBeNull();
    expect(detecterIdentifiant("Lenvatinib")).toBeNull();
  });

  it("la requête se déshabille : « le dossier Lenvatinib », « chez Hetero », « Dr Haddad »", () => {
    expect(normaliserRequete("le dossier Lenvatinib")).toBe("lenvatinib");
    expect(normaliserRequete("chez Hetero Labs ?")).toBe("hetero labs");
    expect(normaliserRequete("Dr. Meriem Haddad")).toBe("meriem haddad");
    expect(plierMolecules("Velpatasvir + Sofosbuvir")).toBe(plierMolecules("sofosbuvir/velpatasvir"));
  });

  it("le score d'un nom, par épreuve décroissante", () => {
    expect(scorerNom("Hetero Labs", "HÉTÉRO LABS")).toMatchObject({ score: 1, preuve: "exact" });
    expect(scorerNom("Hetero", "Hetero Labs SARL")).toMatchObject({ preuve: "sans_generique" });
    expect(scorerNom("Cherif Raihana", "Raihana Cherif")).toMatchObject({ score: 0.95, preuve: "ordre" });
    expect(scorerNom("CHU", "Centre Hospitalo Universitaire")).toMatchObject({ preuve: "acronyme" });
    expect(scorerNom("Raihana", "Raihana Cherif").preuve).toBe("jetons");
    expect(scorerNom("Raihana", "Raihana Cherif").score).toBeGreaterThanOrEqual(0.85);
    const typo = scorerNom("Lenvatinb", "Lenvatinib");
    expect(typo.preuve).toBe("typo");
    expect(typo.score).toBeGreaterThanOrEqual(0.78);
    expect(scorerNom("Hikma", "Hetero Labs").score).toBe(0);
    expect(scorerNom("", "Hetero").score).toBe(0);
  });

  it("trancher : certain seul ou nettement devant, probable, ambigu avec question, inconnu", () => {
    expect(trancher("Hetero", [cand("Hetero Labs", 0.95)]).verdict).toBe("CERTAIN");
    expect(trancher("Hetero", [cand("Hetero Labs", 0.95), cand("Hetero Biopharma", 0.8)]).verdict).toBe("CERTAIN");
    const probable = trancher("Raihana", [cand("Raihana Cherif", 0.85, { type: "PERSONNE" }), cand("Raihana Bensalem", 0.6, { type: "PERSONNE" })]);
    expect(probable.verdict).toBe("PROBABLE");
    expect(probable.retenu?.libelle).toBe("Raihana Cherif");
    const ambigu = trancher("Nadir", [cand("Nadir Benali", 0.85, { type: "PERSONNE", detail: "RH" }), cand("Nadir Cherif", 0.85, { type: "PERSONNE", detail: "Ventes" })]);
    expect(ambigu.verdict).toBe("AMBIGU");
    expect(ambigu.retenu).toBeNull();
    expect(ambigu.question).toMatch(/Nadir Benali — RH/);
    expect(ambigu.question).toMatch(/Laquelle \?/);
    expect(trancher("Zorglub", [cand("Hetero", 0.3)]).verdict).toBe("INCONNU");
    // Un identifiant l'emporte même de peu : l'e-mail désigne, il ne ressemble pas.
    const parEmail = trancher("x@y.dz", [cand("A", 0.9, { preuves: ["email"] }), cand("B", 0.895)]);
    expect(parEmail.verdict).toBe("CERTAIN");
    expect(parEmail.retenu?.libelle).toBe("A");
  });

  it("dédoublonne (type, id) en gardant le meilleur score et l'union des preuves", () => {
    const t = trancher("Hetero", [cand("Hetero", 0.8, { id: "s1", preuves: ["jetons"] }), cand("Hetero", 0.95, { id: "s1", preuves: ["alias"] })]);
    expect(t.candidats).toHaveLength(1);
    expect(t.candidats[0].score).toBe(0.95);
    expect(t.candidats[0].preuves).toEqual(expect.arrayContaining(["jetons", "alias"]));
  });
});
