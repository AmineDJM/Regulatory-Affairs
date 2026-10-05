import { describe, expect, it } from "vitest";
import { repererEntetes } from "@/lib/pieces-lues/entetes";
import { candidatsFournisseur, identiteLue, normaliserNif, normaliserRc, type ContactAnnuaire } from "@/lib/pieces-lues/fournisseur";
import { PHRASE_FOURNISSEUR_A_CREER } from "@/lib/pieces-lues/phrases";
import { lireStructureModele } from "@/lib/pieces-lues/structure";

const ANNUAIRE: ContactAnnuaire[] = [
  { id: "insigne", nom: "INSIGNE CONSEIL", nif: "001916012345678", rc: "16/00-1234567B21" },
  { id: "imprim", nom: "Imprimerie du Centre", nif: "000016055554444", rc: null },
  { id: "kaki", nom: "Kakemono Pro", nif: null, rc: null },
];

describe("candidatsFournisseur — proposer l'émetteur, sans choisir ce qui n'est pas sûr, sans rien créer", () => {
  it("NIF avec espaces : certain — c'est la seule fiche que l'écran peut préremplir", () => {
    const r = candidatsFournisseur({ nifs: ["001 916 012 345 678"] }, ANNUAIRE);
    expect(r).toMatchObject({ statut: "CERTAIN", retenu: "insigne", candidats: [{ id: "insigne", nom: "INSIGNE CONSEIL", par: "NIF" }], aCreer: null });
    expect(r.phrase).toMatch(/reconnu par son NIF/);
  });

  it("RC identique, casse, espaces et séparateurs mis à part : certain", () => {
    const r = candidatsFournisseur({ rcs: ["16/00-1234567 b 21"] }, ANNUAIRE);
    expect(r).toMatchObject({ statut: "CERTAIN", retenu: "insigne", candidats: [{ par: "RC" }] });
  });

  it("homonymes à égalité : aucun choix — deux fiches du même nom ne désignent personne", () => {
    const annuaire = [...ANNUAIRE, { id: "insigne-bis", nom: "Insigne Conseil SPA" }];
    const r = candidatsFournisseur({ nom: "Insigne Conseil SARL" }, annuaire);
    expect(r).toMatchObject({ statut: "AMBIGU", retenu: null });
    expect(r.candidats.map((c) => c.id)).toEqual(["insigne", "insigne-bis"]);
    expect(r.phrase).toMatch(/aucune n'est choisie/);
  });

  it("le nom seul : PROBABLE — proposé, jamais retenu (le BC prendrait l'adresse et le NIF d'un homonyme)", () => {
    const r = candidatsFournisseur({ nom: "Kakémono Pro EURL" }, ANNUAIRE);
    expect(r).toMatchObject({ statut: "PROBABLE", retenu: null, candidats: [{ id: "kaki", par: "NOM" }] });
    expect(r.phrase).toMatch(/par son nom seulement/);
  });

  it("deux fiches répondent à leurs identifiants : AMBIGU — sauf quand l'un est celui du GROUPE (le client)", () => {
    const lu = { nifs: ["001916012345678", "000016055554444"] };
    expect(candidatsFournisseur(lu, ANNUAIRE)).toMatchObject({ statut: "AMBIGU", retenu: null });
    const r = candidatsFournisseur(lu, ANNUAIRE, { nifs: ["000 016 055 554 444"] });
    expect(r).toMatchObject({ statut: "CERTAIN", retenu: "insigne" });
  });

  it("aucune fiche : « à créer par une personne » — rien n'est créé, tous les identifiants lus (hors groupe) sont proposés", () => {
    const r = candidatsFournisseur({ nom: "Nouvelle Agence", nifs: ["099 916 012 345 678", "000016098765432"], rcs: ["16/22-7654321B22"] }, ANNUAIRE, { nifs: ["000016098765432"] });
    expect(r).toEqual({
      statut: "AUCUN", retenu: null, candidats: [], phrase: PHRASE_FOURNISSEUR_A_CREER,
      aCreer: { nom: "Nouvelle Agence", nifs: ["099916012345678"], rcs: ["16227654321B22"] },
    });
  });

  it("normaliserNif et normaliserRc : la forme qui se compare, ou rien", () => {
    expect(normaliserNif("001 916 012 345 678")).toBe("001916012345678");
    expect(normaliserNif("001.916.012.345.678")).toBe("001916012345678");
    expect(normaliserNif("12345")).toBeNull();
    expect(normaliserNif("NIF 001916012345678")).toBeNull();
    expect(normaliserRc("16/00-1234567 B 21")).toBe("16001234567B21");
    expect(normaliserRc("B 21")).toBeNull();
  });

  it("identiteLue réunit l'émetteur lu par le modèle et TOUS les identifiants du repérage", () => {
    const piece = lireStructureModele({ lignes: [], fournisseur: { nom: "Insigne Conseil", nif: "", rc: "16/00-1234567B21", nis: "", ai: "", adresse: "" } });
    const entetes = repererEntetes("NIF : 001 916 012 345 678\nClient NIF : 000016098765432");
    const id = identiteLue(piece, entetes);
    expect(id.nom).toBe("Insigne Conseil");
    expect(id.nifs).toEqual([null, "001916012345678", "000016098765432"]);
    expect(candidatsFournisseur(id, ANNUAIRE)).toMatchObject({ statut: "CERTAIN", retenu: "insigne" });
    expect(identiteLue(null, null)).toEqual({ nom: null, nifs: [null], rcs: [null] });
  });
});
