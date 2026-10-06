import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import * as XLSX from "xlsx";
import { lireRegles, type Regles } from "./regles";
import { segmenterPraticien, prioriteDe, impactDesRegles, synthese, type FaitsPraticien } from "./moteur";
import { lireClasseur, reglesDuTexte, methodeDuFichier, frequencesDesFeuilles, proposerRegles, champDeLEntete, type Feuilles } from "./lecture-classeur";
import { rapprocher, clePersonne } from "./rapprochement";
import { PERMISSIONS, defaultScope } from "@/lib/rbac";
import { NAVIGATION, MODULE_LABELS } from "@/lib/labels";

/**
 * SEGMENTATION STUDIO — les cas obligatoires du cahier des charges (§73-§86), sur des faits construits ici.
 * Aucune valeur n'est codée dans le moteur : chaque seuil vient des règles du test.
 */

const RAL = "prod-ral", DTG = "prod-dtg", DEL = "prod-del";
const T0 = new Date("2026-10-01T00:00:00Z");

function regles(over: Partial<Regles> = {}, produits = [RAL]): Regles {
  const lu = lireRegles({
    produits: produits.map((productId) => ({ productId, metrique: "patients VIH / semaine", seuilPotentiel: 22, seuilAffinite: 0.1, comparaisonAffinite: ">", methodeAffinite: "SUR_10", exceptions: [] })),
    ciblage: { statutsNonCibles: [], potentielNulNonCible: true },
    h: { statuts: ["DECIDEUR"], frequence: 2 },
    priorites: { regles: [{ priorite: "P1", auMoins: { segment: "A", nombre: 2 } }, { priorite: "P1", rang1: ["A", "B"] }, { priorite: "P2", rang1: ["C", "D"] }], repli: null },
    frequences: { P1: 2, P2: 1 },
    ...over,
  });
  if (!lu.ok) throw new Error(lu.erreurs.join(" "));
  return lu.regles;
}

const faits = (o: Partial<FaitsPraticien> & { obs?: [string | null, number | null, number | null][] } = {}): FaitsPraticien => ({
  doctorId: o.doctorId ?? "dr", statut: o.statut ?? "PRESCRIPTEUR", zone: o.zone ?? "Centre", derogations: o.derogations ?? [],
  observations: o.observations ?? (o.obs ?? []).map(([productId, potentiel, prescriptionsSur10]) => ({ productId, potentiel, prescriptionsSur10, observeLe: T0 })),
});

describe("règles — rien n'est inventé", () => {
  it("un seuil absent est une ERREUR nommée, jamais un défaut (pas de « 22 » ni de « 10 % » codés)", () => {
    const r = lireRegles({ produits: [{ productId: RAL }], h: { statuts: ["DECIDEUR"] }, priorites: { regles: [] }, frequences: {} });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.erreurs.join(" ")).toMatch(/seuil de potentiel manquant/);
      expect(r.erreurs.join(" ")).toMatch(/seuil d'affinité manquant/);
      expect(r.erreurs.join(" ")).toMatch(/Fréquence des décideurs/);
    }
  });
  it("au plus trois produits par stratégie", () => {
    const r = lireRegles({ ...regles({}, [RAL, DTG, DEL]), produits: [RAL, DTG, DEL, "x"].map((productId) => ({ productId, seuilPotentiel: 1, seuilAffinite: 0.1 })) });
    expect(r.ok).toBe(false);
  });
});

describe("moteur — A/B/C/D par produit, expliqué", () => {
  it("matrice potentiel × affinité, avec le pourquoi", () => {
    const r = regles();
    const seg = (p: number, s10: number) => segmenterPraticien(faits({ obs: [[RAL, p, s10]] }), r, T0).produits[0];
    expect(seg(27, 2).etat).toBe("A"); // 27 ≥ 22, 20 % > 10 %
    expect(seg(27, 1).etat).toBe("B"); // 10 % n'est pas > 10 %
    expect(seg(7, 3).etat).toBe("C");
    expect(seg(7, 0).etat).toBe("D");
    expect(seg(27, 2).pourquoi.join(" ")).toMatch(/Potentiel 27 ≥ 22.*haut potentiel/);
    expect(seg(27, 2).pourquoi.join(" ")).toMatch(/Donc A/);
  });

  it("§80 — potentiel MANQUANT : En attente, jamais D", () => {
    const r = segmenterPraticien(faits({ obs: [] }), regles(), T0);
    expect(r.produits[0].etat).toBe("EN_ATTENTE");
    expect(r.produits[0].pourquoi.join(" ")).toMatch(/jamais classé D/);
    expect(r.visites).toBe(0);
  });

  it("potentiel DÉCLARÉ à 0 : non ciblé (ne consulte pas), selon la règle", () => {
    expect(segmenterPraticien(faits({ obs: [[RAL, 0, 0]] }), regles(), T0).cible).toBe(false);
    const sans = regles({ ciblage: { statutsNonCibles: [], potentielNulNonCible: false } });
    expect(segmenterPraticien(faits({ obs: [[RAL, 0, 0]] }), sans, T0).produits[0].etat).toBe("D");
  });

  it("§81 — H n'est pas A++ : un décideur C/D/C reste H, sa fréquence H s'applique, ses segments restent visibles", () => {
    const r3 = regles({}, [RAL, DTG, DEL]);
    const f = faits({ statut: "DECIDEUR", obs: [[RAL, 7, 3], [DTG, null, 0], [DEL, null, 2]] });
    f.observations.push({ productId: null, potentiel: 7, prescriptionsSur10: null, observeLe: T0 });
    const r = segmenterPraticien(f, r3, T0);
    expect(r.h).toBe(true);
    expect(r.affichage).toBe("C / D / C");
    expect(r.visites).toBe(2);
    expect(r.pourquoiVisites).toMatch(/Décideur \(H\)/);
  });

  it("§82 — multi-produit A/A/B avec « au moins 2 A → P1 » donne P1, et le dit", () => {
    const p = prioriteDe(["A", "A", "B"], regles({}, [RAL, DTG, DEL]));
    expect(p.priorite).toBe("P1");
    expect(p.pourquoi).toMatch(/au moins 2 produits en A/);
  });

  it("règle explicite > score de repli ; le repli ne sert qu'aux combinaisons non couvertes", () => {
    const r = regles({ priorites: { regles: [{ priorite: "P1", combinaison: ["A", "B", "B"] }], repli: { scores: { A: 4, B: 3, C: 2, D: 1 }, poidsParRang: [1, 0.8, 0.6], paliers: [{ min: 3, priorite: "P2" }, { min: 0, priorite: "P3" }] } }, frequences: { P1: 2, P2: 1, P3: 0.5 } }, [RAL, DTG, DEL]);
    expect(prioriteDe(["B", "A", "B"], r).priorite).toBe("P1"); // combinaison, ordre indifférent
    const repli = prioriteDe(["C", "D", "D"], r);
    expect(repli.priorite).toBe("P3");
    expect(repli.pourquoi).toMatch(/score pondéré/);
  });

  it("une DÉROGATION s'applique sans effacer le calcul ; échue, elle ne compte plus", () => {
    const d = { nature: "SEGMENT" as const, productId: RAL, valeur: "A", motif: "KOL régional", expireLe: null };
    const r = segmenterPraticien(faits({ obs: [[RAL, 7, 0]], derogations: [d] }), regles(), T0);
    expect(r.produits[0].etat).toBe("A");
    expect(r.produits[0].calcule).toBe("D");
    const echue = segmenterPraticien(faits({ obs: [[RAL, 7, 0]], derogations: [{ ...d, expireLe: new Date("2026-09-01") }] }), regles(), T0);
    expect(echue.produits[0].etat).toBe("D");
  });

  it("exception par zone : le seuil de la zone l'emporte, et c'est dit", () => {
    const r = regles({ produits: [{ ...regles().produits[0], exceptions: [{ zone: "Ouest", seuilPotentiel: 10 }] }] });
    const ouest = segmenterPraticien(faits({ zone: "Ouest", obs: [[RAL, 12, 3]] }), r, T0).produits[0];
    expect(ouest.etat).toBe("A");
    expect(ouest.pourquoi.join(" ")).toMatch(/exception Ouest/);
    expect(segmenterPraticien(faits({ zone: "Centre", obs: [[RAL, 12, 3]] }), r, T0).produits[0].etat).toBe("C");
  });

  it("le potentiel le plus RÉCENT fait foi ; l'ancien reste dans l'historique", () => {
    const f = faits({ observations: [
      { productId: RAL, potentiel: 7, prescriptionsSur10: 3, observeLe: new Date("2026-01-01") },
      { productId: RAL, potentiel: 27, prescriptionsSur10: 3, observeLe: new Date("2026-09-01") },
    ] });
    expect(segmenterPraticien(f, regles(), T0).produits[0].etat).toBe("A");
  });

  it("§83 — changer l'affinité 10 → 12 % : l'IMPACT nomme qui change, de quoi à quoi, avant toute publication", () => {
    const avant = regles();
    const apres = regles({ produits: [{ ...avant.produits[0], seuilAffinite: 0.12 }] });
    const pop = [faits({ doctorId: "x", obs: [[RAL, 30, 1.1]] }), faits({ doctorId: "y", obs: [[RAL, 30, 5]] })];
    const imp = impactDesRegles(pop, avant, apres, T0);
    expect(imp.praticiens).toBe(1);
    expect(imp.changements.find((c) => c.productId === RAL)).toEqual({ doctorId: "x", productId: RAL, avant: "A", apres: "B" });
  });

  it("§84 — une version publiée ne bouge pas : les résultats de la v1 restent ceux de la v1", () => {
    const v1 = regles();
    const f = faits({ obs: [[RAL, 23, 2]] });
    const avant = segmenterPraticien(f, v1, T0).produits[0].etat;
    regles({ produits: [{ ...v1.produits[0], seuilPotentiel: 25 }] }); // la v2 est un AUTRE objet
    expect(segmenterPraticien(f, v1, T0).produits[0].etat).toBe(avant);
  });

  it("la synthèse se calcule sur les mêmes résultats que la liste", () => {
    const r = regles();
    const s = synthese([faits({ doctorId: "a", obs: [[RAL, 30, 3]] }), faits({ doctorId: "b", statut: "DECIDEUR" }), faits({ doctorId: "c", obs: [[RAL, 0, 0]] })].map((f) => segmenterPraticien(f, r, T0)));
    expect(s).toMatchObject({ praticiens: 3, cibles: 2, h: 1 });
    expect(s.parProduit[RAL]).toMatchObject({ A: 1, EN_ATTENTE: 1, NON_CIBLE: 1 });
  });
});

// ── Classeurs hétérogènes ──
const CLASSEUR_1: Feuilles = {
  PF: [
    ["A partir de 22 Patients Par Semaine le Médecin est considéré comme haut Potentiel"],
    ["Pour un ratio > a 10% nous pouvons considérer que le médecin possède une Affinité au produit"],
    ["Exception pour le PF de l'Ouest ou ce ratio a été revu à la baisse"],
    [],
    ["Region", "CDR", "Specialité", "Nom", "Prenom", "Grade", "Statut", "Question 1\nCombien de patients vous consultez par semaine pour HIV", "Question 2\nSur 10 Patients Consultés combien sont mis sous raltegravir", "%", "Potentiel"],
    ["Centre", "CHU HCA", "Infectiologie", "Bouhabel", "Maamar", "Prof chef de service", "Decideur", null, null, null, "H"],
    ["Centre", "EHS EL KETTAR", "Infectiologie", "Rezig", "Ahlem", "Assistant", "Influenceur", 30, 4, 4 / 30, "A"],
    ["Est", "CHU Setif", "Infectiologie", "Kadi", "Dahbia", "Assistant", "Prescripteur", 45, 2, 2 / 45, "B"],
    ["Est", "CHU Setif", "Infectiologie", "Amrani", "Sara", "Résident", "Prescripteur", 0, 0, 0, "NA"],
    ["Ouest", "CHU d'Oran", "Infectiologie", "Benali", "Karim", "Assistant", "Réfèrent", 12, 3, 3 / 12, "A"],
    ["Ouest", "CHU d'Oran", "Infectiologie", "Haddad", "Lina", "Assistant", "Prescripteur", 7, 0, 0, "D"],
  ],
  KAM: [
    [null, null, " H, A & B", "In", 39, 2, 78],
    [null, null, null, "Out", 18, 2, 36],
    [null, null, "C & D", "In", 3, 1, 3],
    [null, null, null, "Out", 10, 1, 10],
  ],
};
const CLASSEUR_2: Feuilles = {
  Feuille1: [
    ["Zone", "Etablissement", "Spécialité", "Nom", "Prénom", "Grade", "Rôle", "Patients par semaine", "Sur 10 patients, combien sous raltegravir", "Classement"],
    ["Centre", "CHU HCA", "Infectiologie", "Bouhabel", "Maamar", "Prof chef de service", "Décideur", null, null, "H"],
    ["Centre", "EHS EL KETTAR", "Infectiologie", "Rezig", "Ahlem", "Assistant", "Influenceur", 30, 4, "A"],
  ],
};

describe("§78 — deux classeurs aux en-têtes différents donnent le MÊME format canonique", () => {
  it("colonnes reconnues, lignes identiques", () => {
    const a = lireClasseur(CLASSEUR_1)!, b = lireClasseur(CLASSEUR_2)!;
    const canon = (l: ReturnType<typeof lireClasseur>) => l!.lignes.slice(0, 2).map(({ zone, etablissement, specialite, nom, prenom, statut, potentiel, sur10, segmentFichier }) => ({ zone, etablissement, specialite, nom, prenom, statut, potentiel, sur10, segmentFichier }));
    expect(canon(a)).toEqual(canon(b));
    expect(a.produitMentionne).toBe("raltegravir");
    expect(b.produitMentionne).toBe("raltegravir");
    expect(a.metrique).toBe("patients HIV / semaine");
    expect(a.lignes[0].ligne).toBe(6); // la ligne Excel, pour la traçabilité
  });
  it("« Potentiel » rempli de A/B/C/D/H/NA est reconnu comme le CLASSEMENT, pas comme le potentiel", () => {
    expect(champDeLEntete("Question 1 Combien de patients vous consultez par semaine pour HIV")).toBe("potentiel");
    const a = lireClasseur(CLASSEUR_1)!;
    expect(a.entete.find((c) => c.texte === "Potentiel")?.champ).toBe("segment");
  });
  it("aucune feuille de segmentation : rien n'est inventé", () => {
    expect(lireClasseur({ X: [["a", "b"], [1, 2]] })).toBeNull();
  });
});

describe("règles lues dans la feuille — proposées, jamais imposées", () => {
  it("seuils, comparaison, zone en exception", () => {
    const t = reglesDuTexte(lireClasseur(CLASSEUR_1)!.texte);
    expect(t).toMatchObject({ seuilPotentiel: 22, seuilAffinite: 0.1, comparaisonAffinite: ">", zonesEnException: ["Ouest"] });
  });
  it("la méthode d'affinité se DÉDUIT des pourcentages du fichier", () => {
    expect(methodeDuFichier(lireClasseur(CLASSEUR_1)!.lignes).methode).toBe("RATIO_FICHIER");
  });
  it("fréquences par groupe lues dans la feuille des KAM", () => {
    const f = frequencesDesFeuilles(CLASSEUR_1);
    expect(f.h).toBe(2);
    expect(f.groupes).toEqual([{ segments: ["A", "B"], frequence: 2 }, { segments: ["C", "D"], frequence: 1 }]);
  });
  it("la proposition v1 reproduit le fichier et DÉDUIT l'exception annoncée (montrée comme telle)", () => {
    const lecture = lireClasseur(CLASSEUR_1)!;
    const p = proposerRegles(lecture, CLASSEUR_1, RAL);
    expect(p.erreurs).toEqual([]);
    expect(p.provenance.join(" ")).toMatch(/Exception Ouest .*DÉDUITS/);
    expect(p.concordance.divergences).toEqual([]);
    expect(p.concordance.identiques).toBe(p.concordance.total);
  });
  it("sans seuil écrit, la proposition le DEMANDE au lieu de l'inventer", () => {
    const sans: Feuilles = { PF: CLASSEUR_1.PF.slice(4) };
    const p = proposerRegles(lireClasseur(sans)!, sans, RAL);
    expect(p.erreurs.join(" ")).toMatch(/seuil de potentiel manquant/);
  });
});

describe("rapprochement avec l'annuaire — jamais de doublon, jamais de devinette", () => {
  const lignes = lireClasseur(CLASSEUR_1)!.lignes;
  it("clé de personne : casse, accents, ordre, « Ep » mis de côté", () => {
    expect(clePersonne("Zertal Ep Kechai", "Amel")).toBe(clePersonne("amel", "ZERTAL kechai"));
    expect(clePersonne("Dr Bouhabel Maamar")).toBe(clePersonne("Bouhabel", "Maamar"));
  });
  it("fiche existante retrouvée ; homonymes départagés par l'établissement ; sinon ambigu ; doublon du fichier signalé", () => {
    const etab = (n: string | null) => (n === "EHS EL KETTAR" ? "etab-kettar" : n === "CHU Setif" ? "etab-setif" : null);
    const connus = [
      { id: "d1", name: "Maamar Bouhabel", lastName: "Bouhabel", firstName: "Maamar", institutionId: null },
      { id: "d2", name: "Ahlem Rezig", lastName: "Rezig", firstName: "Ahlem", institutionId: "etab-kettar" },
      { id: "d3", name: "Ahlem Rezig", lastName: "Rezig", firstName: "Ahlem", institutionId: "etab-autre" },
      { id: "d4", name: "Dahbia Kadi", lastName: "Kadi", firstName: "Dahbia", institutionId: "x" },
      { id: "d5", name: "Dahbia Kadi", lastName: "Kadi", firstName: "Dahbia", institutionId: "y" },
    ];
    const avecDoublon = [...lignes, { ...lignes[1], ligne: 99 }];
    const r = rapprocher(avecDoublon, connus, etab);
    expect(r.get(6)).toEqual({ statut: "existant", doctorId: "d1", autreEtablissement: false });
    expect(r.get(7)).toEqual({ statut: "existant", doctorId: "d2", autreEtablissement: false });
    expect(r.get(8)?.statut).toBe("ambigu");
    expect(r.get(9)).toEqual({ statut: "nouveau" });
    expect(r.get(99)).toEqual({ statut: "doublon", ligneOrigine: 7 });
  });
});

describe("§86 — permissions : un KAM ne touche ni aux règles, ni à la stratégie", () => {
  it("défauts par rôle", () => {
    expect(PERMISSIONS.MEDICAL_DELEGATE.SEGMENTATION).toEqual(["VIEW", "UPDATE"]);
    expect(PERMISSIONS.MEDICAL_DELEGATE.SEGMENTATION).not.toContain("VALIDATE");
    expect(PERMISSIONS.MEDICAL_DELEGATE.SEGMENTATION).not.toContain("CREATE");
    expect(defaultScope("MEDICAL_DELEGATE", "SEGMENTATION")).toBe("ASSIGNED");
    expect(PERMISSIONS.OPERATIONS_DIRECTOR.SEGMENTATION).toContain("VALIDATE");
    expect(PERMISSIONS.MEDICAL_PROMOTION_MANAGER.SEGMENTATION).not.toContain("VALIDATE");
    expect(PERMISSIONS.COORDINATOR.SEGMENTATION).toBeUndefined();
  });
  it("module à part, au menu, réglable dans la console", () => {
    expect(MODULE_LABELS.SEGMENTATION).toBe("Segmentation Studio");
    expect(NAVIGATION.find((n) => n.href === "/segmentation")?.module).toBe("SEGMENTATION");
  });
});

// Le classeur réel de la Direction, quand il est présent sur le poste (jamais versionné : il nomme des praticiens).
const REEL = process.env.SEGMENTATION_FICHIER ?? "";
describe.skipIf(!REEL || !existsSync(REEL))("classeur réel « Segmentation Finale »", () => {
  it("les règles proposées reproduisent les classements du fichier, à quelques lignes près nommées", () => {
    const wb = XLSX.read(readFileSync(REEL), { type: "buffer" });
    const feuilles: Feuilles = Object.fromEntries(wb.SheetNames.map((n) => [n, XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[n], { header: 1, defval: null, blankrows: true, raw: true })]));
    const lecture = lireClasseur(feuilles)!;
    const p = proposerRegles(lecture, feuilles, RAL);
    console.log(lecture.feuille, lecture.lignes.length, p.provenance, p.concordance.identiques, "/", p.concordance.total, p.concordance.divergences);
    expect(p.erreurs).toEqual([]);
    expect(p.concordance.identiques / p.concordance.total).toBeGreaterThan(0.98);
  });
});
