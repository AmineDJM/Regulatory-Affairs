import { describe, expect, it } from "vitest";
import { scoreInfluence, suggererInfluenceur, ordreDEntree, poidsCitations, pointsVolume, type EntreeScore } from "./score";
import { relationsStructurelles, indexerPraticiens, resoudreNom, cleNom, estPharmacien, libelleCourt } from "./relations";
import { lireReponseInfluence, citationVerifiee, rapportPorteur, type RapportAnalyse } from "./extraction";

const base: EntreeScore = {
  grade: null, statut: null, decideurBesoin: false, nbCollegues: 0, orateur: [], citationsConfirmees: 0,
  citationsProposees: [], volumeEtablissement: null, tailleReseau: 0,
};

describe("score d'influence — explicable, borné, sans rien deviner", () => {
  it("un praticien sans aucun signal vaut 0 et n'a aucune raison", () => {
    expect(scoreInfluence(base)).toEqual({ score: 0, raisons: [] });
  });

  it("le chef de service : +30, orateur 2 fois +20, cité +points, volume, réseau — chaque point a sa raison", () => {
    const s = scoreInfluence({
      ...base, grade: "PROFESSEUR", decideurBesoin: true, nbCollegues: 7,
      orateur: [{ nom: "Soirée Oran" }, { nom: "Symposium SFLS" }],
      citationsConfirmees: 2, citationsProposees: [0.8, 0.6], volumeEtablissement: 1900, tailleReseau: 9,
    });
    const pts = Object.fromEntries(s.raisons.map((r) => [r.code, r.points]));
    expect(pts.HIERARCHIE).toBe(30);
    expect(pts.GRADE).toBeUndefined(); // diriger le service l'emporte sur le grade, jamais les deux
    expect(pts.ORATEUR).toBe(20);
    expect(pts.CITATIONS).toBe(Math.round((2 + 0.4 + 0.3) * 6));
    expect(pts.VOLUME).toBe(10);
    expect(pts.RESEAU).toBe(10);
    expect(s.score).toBe(s.raisons.reduce((a, r) => a + r.points, 0));
  });

  it("le score est plafonné à 100 et chaque composante à son plafond", () => {
    const s = scoreInfluence({
      ...base, statut: "DECIDEUR", orateur: Array.from({ length: 9 }, (_, i) => ({ nom: `E${i}` })),
      citationsConfirmees: 40, volumeEtablissement: 1e6, tailleReseau: 80,
    });
    expect(s.score).toBe(100);
    expect(s.raisons.find((r) => r.code === "ORATEUR")!.points).toBe(20);
    expect(s.raisons.find((r) => r.code === "CITATIONS")!.points).toBe(25);
  });

  it("lien confirmé = poids 1, proposé = confiance × 0,5 (borné)", () => {
    expect(poidsCitations(1, [1, 0.5])).toBeCloseTo(1.75);
    expect(poidsCitations(0, [7, -3, Number.NaN])).toBeCloseTo(0.5);
  });

  it("volume : paliers, rien sans donnée", () => {
    expect(pointsVolume(null)).toBe(0);
    expect(pointsVolume(0)).toBe(0);
    expect(pointsVolume(50)).toBe(2);
    expect(pointsVolume(200)).toBe(5);
    expect(pointsVolume(5000)).toBe(15);
  });

  it("« passer en Influenceur ? » : suggestion seulement quand les signaux le justifient", () => {
    const fort = scoreInfluence({ ...base, grade: "PROFESSEUR", orateur: [{ nom: "a" }, { nom: "b" }], citationsConfirmees: 3 });
    expect(fort.score).toBeGreaterThanOrEqual(50);
    expect(suggererInfluenceur("PRESCRIPTEUR", fort)).toBe(true);
    expect(suggererInfluenceur("INFLUENCEUR", fort)).toBe(false);
    expect(suggererInfluenceur("DECIDEUR", fort)).toBe(false);
    // Fort score sans signal d'influence (seulement la hiérarchie et le volume) : pas de suggestion.
    const hierarchie = scoreInfluence({ ...base, statut: "REFERENT", decideurBesoin: true, volumeEtablissement: 9000, tailleReseau: 5 });
    expect(hierarchie.score).toBeGreaterThanOrEqual(50);
    expect(suggererInfluenceur("REFERENT", hierarchie)).toBe(false);
  });

  it("ordre d'entrée : décideur, puis l'influenceur des prescripteurs, puis la pharmacie — un rôle vide est sauté", () => {
    const m = (doctorId: string, x: Partial<Parameters<typeof ordreDEntree>[0][number]> = {}) => ({
      doctorId, nom: doctorId, grade: null, statut: null, decideurBesoin: false, pharmacien: false, score: 10, influences: 0, ...x,
    });
    const ordre = ordreDEntree([m("res"), m("pharma", { pharmacien: true }), m("c", { influences: 2, score: 61 }), m("a", { decideurBesoin: true, score: 82 })]);
    expect(ordre.map((o) => o.role)).toEqual(["DECIDEUR", "INFLUENCEUR", "PHARMACIE"]);
    expect(ordre.map((o) => o.doctorId)).toEqual(["a", "c", "pharma"]);
    expect(ordreDEntree([m("x"), m("y")])).toEqual([]);
  });
});

describe("liens structurels — calculés sans Luna", () => {
  it("le responsable dirige les autres médecins ; la pharmacie a son lien ; pas de chef = pas de hiérarchie", () => {
    const liens = relationsStructurelles([
      { doctorId: "chef", serviceId: "s1", grade: "CHEF_DE_SERVICE", statut: null, decideurBesoin: false, pharmacien: false },
      { doctorId: "b", serviceId: "s1", grade: "MAITRE_ASSISTANT", statut: "PRESCRIPTEUR", decideurBesoin: false, pharmacien: false },
      { doctorId: "ph", serviceId: "s1", grade: "PHARMACIEN", statut: null, decideurBesoin: false, pharmacien: true },
      { doctorId: "x", serviceId: "s2", grade: "ASSISTANT", statut: null, decideurBesoin: false, pharmacien: false },
      { doctorId: "y", serviceId: "s2", grade: "ASSISTANT", statut: null, decideurBesoin: false, pharmacien: false },
    ], new Map([["EVENT:e1", ["z", "b", "z"]], ["EVENT:e2", ["solo"]]]));
    const cles = liens.map((l) => `${l.from}>${l.to}:${l.type}`).sort();
    expect(cles).toEqual(["b>z:CO_ORATEUR", "chef>b:HIERARCHIE", "chef>ph:PHARMACIE_SERVICE"]);
  });

  it("pharmacien : par le titre ou la spécialité", () => {
    expect(estPharmacien("PHARMACIEN", null)).toBe(true);
    expect(estPharmacien("AUTRE", "Pharmacie hospitalière")).toBe(true);
    expect(estPharmacien("PROFESSEUR", "Infectiologie")).toBe(false);
  });
});

describe("rapprochement d'un nom écrit dans un rapport", () => {
  const index = indexerPraticiens([
    { id: "d1", name: "Benali Karim", lastName: "Benali", firstName: "Karim", institutionId: "chu-oran" },
    { id: "d2", name: "Benali Samia", lastName: "Benali", firstName: "Samia", institutionId: "ehs-kettar" },
    { id: "d3", name: "Haddad Omar", lastName: "Haddad", firstName: "Omar", institutionId: "ehs-kettar" },
  ]);

  it("nom complet unique : SÛR (titre et accents mis de côté)", () => {
    expect(resoudreNom("Pr Karim BENALI", index, null)).toEqual({ statut: "SUR", doctorId: "d1" });
    expect(cleNom("Pr. Hàddad Omar")).toBe("haddad omar");
  });

  it("nom de famille seul : SÛR dans l'établissement du rapport, À VÉRIFIER ailleurs, ambigu sans fiche retenue", () => {
    expect(resoudreNom("Dr Benali", index, "ehs-kettar")).toEqual({ statut: "SUR", doctorId: "d2" });
    expect(resoudreNom("Dr Haddad", index, "chu-oran")).toEqual({ statut: "A_VERIFIER", doctorId: "d3", candidats: ["d3"] });
    const amb = resoudreNom("Dr Benali", index, "autre");
    expect(amb?.statut).toBe("A_VERIFIER");
    expect(amb && "doctorId" in amb ? amb.doctorId : "x").toBeNull();
    expect(resoudreNom("Pr Inconnu", index, null)).toBeNull();
    expect(resoudreNom("Dr", index, null)).toBeNull();
  });

  it("libellé court du graphe", () => {
    expect(libelleCourt("Benali Karim", "PROFESSEUR")).toBe("Pr Benali");
    expect(libelleCourt("Dr Haddad Omar", "ASSISTANT")).toBe("Dr Haddad");
  });
});

describe("relecture de Luna — la citation doit être un extrait exact du rapport", () => {
  const lot: RapportAnalyse[] = [{
    id: "r1", doctorId: "d3", doctorNom: "Haddad Omar", institutionId: "ehs-kettar", institutionNom: "EHS El Kettar",
    texte: "Visite du Dr Haddad. Il suit   l'avis du Pr Benali pour les switchs.\nDemande de documentation.",
  }];

  it("garde une mention prouvée (espaces normalisés), jette une citation inventée, un type inconnu, un rapport inconnu", () => {
    const lu = lireReponseInfluence({
      mentions: [
        { rapportId: "r1", influenceur: "Pr Benali", influence: "@visite", type: "SUIT_AVIS", confiance: 0.9, citation: "Il suit l'avis du Pr Benali pour les switchs." },
        { rapportId: "r1", influenceur: "Pr Benali", influence: "@visite", type: "SUIT_AVIS", confiance: 0.9, citation: "Le Pr Benali décide de tout dans ce service." },
        { rapportId: "r1", influenceur: "Pr Benali", influence: "@visite", type: "AMI", confiance: 0.9, citation: "Il suit l'avis du Pr Benali" },
        { rapportId: "r9", influenceur: "Pr Benali", influence: "@visite", type: "SUIT_AVIS", confiance: 0.9, citation: "Il suit l'avis du Pr Benali" },
        { rapportId: "r1", influenceur: "@visite", influence: "@visite", type: "COMITE", confiance: 0.9, citation: "Il suit l'avis du Pr Benali" },
      ],
    }, lot);
    expect(lu).toHaveLength(1);
    expect(lu![0]).toMatchObject({ rapportId: "r1", influenceur: "Pr Benali", influence: "@visite", type: "SUIT_AVIS", confiance: 0.9 });
    expect(lot[0].texte.replace(/\s+/g, " ")).toContain(lu![0].citation);
  });

  it("réponse hors forme → null ; confiance bornée", () => {
    expect(lireReponseInfluence(null, lot)).toBeNull();
    expect(lireReponseInfluence({ liens: [] }, lot)).toBeNull();
    const lu = lireReponseInfluence({ mentions: [{ rapportId: "r1", influenceur: "Pr Benali", influence: "@visite", type: "SUIT_AVIS", confiance: 7, citation: "« Il suit l'avis du Pr Benali »" }] }, lot);
    expect(lu?.[0].confiance).toBe(1);
  });

  it("citationVerifiee / rapportPorteur", () => {
    expect(citationVerifiee("court", "court")).toBeNull();
    expect(citationVerifiee("Demande de documentation.", lot[0].texte)).toBe("Demande de documentation.");
    expect(rapportPorteur("Commande de 20 boîtes, stock correct.")).toBe(false);
    expect(rapportPorteur("Le chef de service décide des achats.")).toBe(true);
  });
});
