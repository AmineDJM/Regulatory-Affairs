import { describe, it, expect } from "vitest";
import { lireRegles, type Regles } from "./regles";
import { segmenterPraticien, cleFrequence, type FaitsPraticien } from "./moteur";
import { matriceDe, contactsDe, chargeDe, lettreProvisoire, totalMatrice, deuxDecimales, PROPOSITION } from "./charge";
import { secteurDuPraticien, type SecteurBu } from "./secteurs";

/**
 * LA LETTRE ET LA CHARGE PAR SECTEUR (Direction, 07/10) — décideur → H, NA si une réponse manque (jamais D),
 * 0 patient → non ciblé, affinité au-delà du seuil (strict), seuil propre à un secteur, fréquences par lettre et In/Out,
 * contacts et charge face à la capacité. Chaque valeur vient des règles du test.
 */

const RAL = "prod-ral";
const T0 = new Date("2026-10-07T00:00:00Z");
const OUEST = "sect-oran", CENTRE = "sect-alger";

function regles(over: Record<string, unknown> = {}): Regles {
  const lu = lireRegles({
    produits: [{ productId: RAL, metrique: "patients VIH / semaine", seuilPotentiel: 22, seuilAffinite: 0.1, comparaisonAffinite: ">", methodeAffinite: "SUR_10", exceptions: [{ zone: "Oran", secteurId: OUEST, seuilAffinite: 0.05 }], reference: { valeur: 0.0721, annee: 2026 } }],
    ciblage: { statutsNonCibles: [], potentielNulNonCible: true },
    h: { statuts: ["DECIDEUR"], frequence: 2 },
    priorites: { regles: [], repli: null },
    frequences: {},
    grille: { defaut: { H_IN: 2, H_OUT: 2, AB_IN: 2, AB_OUT: 2, CD_IN: 1, CD_OUT: 1 }, secteurs: [{ secteurId: OUEST, nom: "Oran", valeurs: { AB_IN: 3, H_IN: 3 } }] },
    capacite: { contactsParJour: 7, joursParCycle: 20 },
    ...over,
  });
  if (!lu.ok) throw new Error(lu.erreurs.join(" "));
  return lu.regles;
}

const dr = (o: Partial<FaitsPraticien> & { q?: [number | null, number | null] } = {}): FaitsPraticien => ({
  doctorId: o.doctorId ?? "dr", statut: o.statut ?? "PRESCRIPTEUR", zone: o.zone ?? null, derogations: o.derogations ?? [],
  secteurId: o.secteurId ?? CENTRE, secteurNom: o.secteurNom ?? "Alger", inOut: o.inOut ?? "IN",
  observations: o.observations ?? (o.q ? [{ productId: RAL, potentiel: o.q[0], prescriptionsSur10: o.q[1], observeLe: T0 }] : []),
});

describe("la lettre d'un praticien", () => {
  const r = regles();
  const lettre = (f: FaitsPraticien) => segmenterPraticien(f, r, T0).lettre;

  it("un décideur est H d'office, même sans réponse", () => {
    expect(lettre(dr({ statut: "DECIDEUR" }))).toBe("H");
    expect(lettre(dr({ statut: "DECIDEUR", q: [3, 0] }))).toBe("H");
  });
  it("A, B, C, D selon le potentiel (≥ 22) et l'affinité (> 10 %, strict)", () => {
    expect(lettre(dr({ q: [27, 2] }))).toBe("A");
    expect(lettre(dr({ q: [22, 1] }))).toBe("B"); // 22 ≥ 22 ; 10 % n'est pas > 10 %
    expect(lettre(dr({ q: [7, 3] }))).toBe("C");
    expect(lettre(dr({ q: [7, 0] }))).toBe("D");
  });
  it("une réponse manque → NA, jamais D — même avec 0 patient", () => {
    expect(lettre(dr({ q: [27, null] }))).toBe("NA");
    expect(lettre(dr({ q: [null, 3] }))).toBe("NA");
    expect(lettre(dr({ q: [0, null] }))).toBe("NA");
    expect(lettre(dr())).toBe("NA");
  });
  it("0 patient avec les deux réponses → non ciblé", () => {
    const res = segmenterPraticien(dr({ q: [0, 0] }), r, T0);
    expect(res.lettre).toBe("NC");
    expect(res.cible).toBe(false);
  });
  it("seuil propre à un secteur (par son identifiant) : 6 % passe à Oran, pas ailleurs", () => {
    expect(lettre(dr({ q: [27, 0.6], secteurId: OUEST, secteurNom: "Oran" }))).toBe("A");
    expect(lettre(dr({ q: [27, 0.6] }))).toBe("B");
  });
  it("règle d'avant les secteurs : l'exception « Ouest » se reconnaît encore par la zone ou le nom du secteur", () => {
    const vieille = regles({ produits: [{ productId: RAL, seuilPotentiel: 22, seuilAffinite: 0.1, exceptions: [{ zone: "Ouest", seuilAffinite: 0.05 }] }] });
    expect(segmenterPraticien(dr({ q: [27, 0.6], zone: "Ouest" }), vieille, T0).lettre).toBe("A");
    expect(segmenterPraticien(dr({ q: [27, 0.6], secteurId: "x", secteurNom: "Ouest" }), vieille, T0).lettre).toBe("A");
    expect(segmenterPraticien(dr({ q: [27, 0.6] }), vieille, T0).lettre).toBe("B");
  });
  it("une lettre forcée s'applique, la calculée reste lisible ; « non ciblé » forcé sort le praticien", () => {
    const forceH = segmenterPraticien(dr({ q: [7, 0], derogations: [{ nature: "SEGMENT", productId: RAL, valeur: "H", motif: "KOL", expireLe: null }] }), r, T0);
    expect(forceH).toMatchObject({ lettre: "H", lettreCalculee: "D", h: true, lettreForcee: { valeur: "H", motif: "KOL" } });
    const nc = segmenterPraticien(dr({ q: [30, 3], derogations: [{ nature: "CIBLAGE", productId: null, valeur: "NON_CIBLE", motif: "Parti", expireLe: null }] }), r, T0);
    expect(nc).toMatchObject({ lettre: "NC", lettreCalculee: "A", cible: false, visites: 0 });
  });
});

describe("les visites par la grille (lettre × In/Out × secteur)", () => {
  const r = regles();
  const visites = (f: FaitsPraticien) => segmenterPraticien(f, r, T0).visites;
  it("défaut : H, A & B 2 ; C & D 1 ; NA et non ciblé 0", () => {
    expect(visites(dr({ q: [27, 2] }))).toBe(2);
    expect(visites(dr({ q: [7, 0], inOut: "OUT" }))).toBe(1);
    expect(visites(dr({ q: [27, null] }))).toBe(0);
    expect(visites(dr({ q: [0, 0] }))).toBe(0);
  });
  it("le secteur a sa fréquence (Oran A & B In = 3), Out garde le défaut ; wilaya inconnue = Out", () => {
    expect(visites(dr({ q: [27, 2], secteurId: OUEST, secteurNom: "Oran" }))).toBe(3);
    expect(visites(dr({ q: [27, 2], secteurId: OUEST, secteurNom: "Oran", inOut: "OUT" }))).toBe(2);
    expect(cleFrequence("A", null)).toBe("AB_OUT");
  });
  it("H se règle à part, jamais sous A & B", () => {
    const g = { defaut: { H_IN: 3, H_OUT: 2, AB_IN: 2, AB_OUT: 2, CD_IN: 1, CD_OUT: 1 }, secteurs: [] };
    expect(segmenterPraticien(dr({ statut: "DECIDEUR" }), regles({ grille: g }), T0).visites).toBe(3);
    const faux = lireRegles({ ...regles(), grille: { ...g, defaut: { ...g.defaut, H_IN: 1 } } });
    expect(faux.ok).toBe(false);
    if (!faux.ok) expect(faux.erreurs.join(" ")).toMatch(/décideurs \(H\) ne peut pas être sous/);
  });
  it("une case vide de la grille par défaut est une erreur nommée", () => {
    const r2 = lireRegles({ ...regles(), grille: { defaut: { H_IN: 2 }, secteurs: [] } });
    expect(r2.ok).toBe(false);
  });
  it("le repère national se relit", () => {
    expect(r.produits[0].reference).toEqual({ valeur: 0.0721, annee: 2026 });
  });
});

describe("matrice, contacts et charge d'un secteur", () => {
  const m = matriceDe([
    { lettre: "H", inOut: "IN" }, { lettre: "A", inOut: "IN" }, { lettre: "B", inOut: "OUT" }, { lettre: "B", inOut: null },
    { lettre: "C", inOut: "IN" }, { lettre: "D", inOut: "OUT" }, { lettre: "NA", inOut: "IN" }, { lettre: "NC", inOut: "IN" },
  ]);
  it("NC n'entre pas ; In / Out inconnu compté Out ; NA compté", () => {
    expect(m.B).toEqual({ IN: 0, OUT: 2 });
    expect(totalMatrice(m)).toEqual({ IN: 4, OUT: 3, total: 7 });
  });
  it("contacts = nombre × fréquence ; H partage la ligne de A & B quand sa fréquence est la même", () => {
    const c = contactsDe(m, PROPOSITION.grille);
    expect(c.lignes.map((l) => l.libelle)).toEqual(["H, A & B — In", "H, A & B — Out", "C & D — In", "C & D — Out"]);
    expect(c.total).toBe(2 * 2 + 2 * 2 + 1 + 1);
    const separe = contactsDe(m, { ...PROPOSITION.grille, H_IN: 3 });
    expect(separe.lignes[0]).toMatchObject({ libelle: "H — In", nombre: 1, frequence: 3, contacts: 3 });
    expect(separe.total).toBe(3 + 0 + 2 + 4 + 1 + 1);
  });
  it("charge : vert ≤ 90 %, orange ≤ 100 %, rouge au-delà ; par jour et par KAM", () => {
    const cap = { contactsParJour: 7, joursParCycle: 20 };
    expect(chargeDe(126, cap, 1)).toMatchObject({ capacite: 140, taux: 90, ton: "ok" });
    expect(chargeDe(140, cap, 1).ton).toBe("attention");
    expect(chargeDe(141, cap, 1).ton).toBe("depasse");
    expect(deuxDecimales(chargeDe(334, cap, 3).parJour)).toBe("5,57");
    expect(chargeDe(10, cap, 0).ton).toBe("depasse");
  });
});

describe("la lettre provisoire de l'écran suit la même règle", () => {
  const base = { hStatuts: ["DECIDEUR" as const], seuilPotentiel: 22, seuilAffinite: 0.1, comparaison: ">" as const, potentielNulNonCible: true };
  it("H, NA, NC, A/B/C/D", () => {
    expect(lettreProvisoire({ ...base, statut: "DECIDEUR", q1: null, q2: null })).toBe("H");
    expect(lettreProvisoire({ ...base, statut: "PRESCRIPTEUR", q1: 0, q2: null })).toBe("NA");
    expect(lettreProvisoire({ ...base, statut: "PRESCRIPTEUR", q1: 0, q2: 0 })).toBe("NC");
    expect(lettreProvisoire({ ...base, statut: "PRESCRIPTEUR", q1: 22, q2: 1 })).toBe("B");
    expect(lettreProvisoire({ ...base, statut: "INFLUENCEUR", q1: 25, q2: 3 })).toBe("A");
  });
});

describe("le secteur d'un praticien", () => {
  const s = (id: string, o: Partial<SecteurBu> = {}): SecteurBu => ({ id, nom: id, actif: true, ville: null, pivot: null, kams: [], etablissements: [], ...o });
  const secteurs = [
    s("alger", { etablissements: [{ institutionId: "mustapha", tous: true, services: [] }], kams: [{ id: "k1", nom: "Amel" }] }),
    s("oran", { etablissements: [{ institutionId: "chu-oran", tous: false, services: ["infectio"] }], kams: [{ id: "k2", nom: "Yacine" }] }),
    s("ferme", { actif: false, etablissements: [{ institutionId: "eph", tous: true, services: [] }] }),
  ];
  it("par l'établissement entier, par le service choisi, sinon par le KAM de rattachement ; jamais deviné", () => {
    expect(secteurDuPraticien({ institutionId: "mustapha", serviceId: null, delegateId: null }, secteurs)?.id).toBe("alger");
    expect(secteurDuPraticien({ institutionId: "chu-oran", serviceId: "infectio", delegateId: null }, secteurs)?.id).toBe("oran");
    expect(secteurDuPraticien({ institutionId: "chu-oran", serviceId: "cardio", delegateId: null }, secteurs)).toBeNull();
    expect(secteurDuPraticien({ institutionId: null, serviceId: null, delegateId: "k2" }, secteurs)?.id).toBe("oran");
    expect(secteurDuPraticien({ institutionId: "eph", serviceId: null, delegateId: null }, secteurs)).toBeNull();
  });
});
