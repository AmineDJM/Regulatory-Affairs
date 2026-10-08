import { describe, it, expect } from "vitest";
import {
  trier, triSuivant, passe, vueDuTableau, valeursDuFiltre, lireEtat, paramsDeLEtat, urlAvecEtat, basculerValeur, retirerFiltre,
  effacerFiltres, nbFiltresActifs, lireSaisieQ, casseNom, nomCourtProduit, gradeBrutDe, ETAT_VIDE, type EtatTableau, type LigneTri,
} from "./tableau-praticiens";
import { derniere, effaceDeSource, SOURCE_EFFACEMENT } from "./moteur";
import { wilayaDuPraticien } from "./in-out";

/** Le tableau des praticiens (Direction, 08/10) : tri, filtres, état d'URL — la logique pure, sans écran ni base. */

const L = (o: Partial<LigneTri>): LigneTri => ({
  secteur: "", secteurLib: "", cdr: "", cdrLib: "", io: "", specialite: "", specialiteLib: "", nom: "", prenom: "",
  grade: "AUTRE", gradeLib: "Autre", statut: "", q1: null, q2: null, pct: null, potentiel: "", ...o,
});
const id = (x: LigneTri) => x;
const noms = (xs: LigneTri[]) => xs.map((x) => x.nom);
const etat = (o: Partial<EtatTableau>): EtatTableau => ({ ...ETAT_VIDE, ...o });

const lignes: LigneTri[] = [
  L({ nom: "Ait Ali", q1: 25, q2: 4, pct: 0.16, potentiel: "A", statut: "REFERENT", secteur: "s1", secteurLib: "Ouest", io: "IN", cdr: "e1", cdrLib: "CHU d'Oran" }),
  L({ nom: "Badla", q1: 12, q2: 3, pct: 0.25, potentiel: "NA", statut: "", secteur: "", cdr: "t:EHS EL KETTAR", cdrLib: "EHS EL KETTAR" }),
  L({ nom: "Élias", q1: null, q2: null, pct: null, potentiel: "H", statut: "DECIDEUR", secteur: "s2", secteurLib: "Centre", io: "OUT" }),
  L({ nom: "chérif", q1: 3, q2: 10, pct: 1, potentiel: "D", statut: "PRESCRIPTEUR", secteur: "s1", secteurLib: "Ouest", io: "OUT" }),
];

describe("le tri", () => {
  it("croissant → décroissant → aucun", () => {
    const a = triSuivant(null, "q1");
    expect(a).toEqual({ col: "q1", sens: "asc" });
    const b = triSuivant(a, "q1");
    expect(b).toEqual({ col: "q1", sens: "desc" });
    expect(triSuivant(b, "q1")).toBeNull();
    expect(triSuivant(b, "nom")).toEqual({ col: "nom", sens: "asc" });
  });
  it("numérique pour Q1, les vides toujours en bas (dans les deux sens)", () => {
    expect(noms(trier(lignes, { col: "q1", sens: "asc" }, id))).toEqual(["chérif", "Badla", "Ait Ali", "Élias"]);
    expect(noms(trier(lignes, { col: "q1", sens: "desc" }, id))).toEqual(["Ait Ali", "Badla", "chérif", "Élias"]);
  });
  it("le potentiel dans l'ordre H, A, B, C, D, NA", () => {
    expect(noms(trier(lignes, { col: "potentiel", sens: "asc" }, id))).toEqual(["Élias", "Ait Ali", "chérif", "Badla"]);
  });
  it("le nom : alphabétique français, sans tenir compte des accents ni de la casse", () => {
    expect(noms(trier(lignes, { col: "nom", sens: "asc" }, id))).toEqual(["Ait Ali", "Badla", "chérif", "Élias"]);
  });
  it("stable : à égalité, l'ordre du serveur", () => {
    const xs = [L({ nom: "b", q2: 1 }), L({ nom: "a", q2: 1 }), L({ nom: "c", q2: 0 })];
    expect(noms(trier(xs, { col: "q2", sens: "asc" }, id))).toEqual(["c", "b", "a"]);
  });
  it("sans tri : l'ordre d'arrivée", () => {
    expect(noms(trier(lignes, null, id))).toEqual(noms(lignes));
  });
});

describe("les filtres", () => {
  it("liste à choix multiple (secteur, « sans secteur » compris)", () => {
    expect(noms(lignes.filter((l) => passe(l, etat({ listes: { secteur: ["s1"] } }))))).toEqual(["Ait Ali", "chérif"]);
    expect(noms(lignes.filter((l) => passe(l, etat({ listes: { secteur: ["", "s2"] } }))))).toEqual(["Badla", "Élias"]);
  });
  it("In / Out, statut, potentiel", () => {
    expect(noms(lignes.filter((l) => passe(l, etat({ listes: { io: ["OUT"] } }))))).toEqual(["Élias", "chérif"]);
    expect(noms(lignes.filter((l) => passe(l, etat({ listes: { potentiel: ["A", "H"] }, textes: {} }))))).toEqual(["Ait Ali", "Élias"]);
    expect(noms(lignes.filter((l) => passe(l, etat({ listes: { statut: [""] } }))))).toEqual(["Badla"]);
  });
  it("texte « contient » sans accents ni casse", () => {
    expect(noms(lignes.filter((l) => passe(l, etat({ textes: { nom: "eli" } }))))).toEqual(["Élias"]);
  });
  it("plages : Q1 min / max, le % en pourcentage (arrondi affiché), les vides exclus", () => {
    expect(noms(lignes.filter((l) => passe(l, etat({ plages: { q1: { min: 10, max: null } } }))))).toEqual(["Ait Ali", "Badla"]);
    expect(noms(lignes.filter((l) => passe(l, etat({ plages: { pct: { min: 16, max: 25 } } }))))).toEqual(["Ait Ali", "Badla"]);
    expect(noms(lignes.filter((l) => passe(l, etat({ plages: { q2: { min: null, max: 3 } } }))))).toEqual(["Badla"]);
  });
  it("la recherche globale porte sur le nom, le CDR, la spécialité, le secteur", () => {
    expect(noms(lignes.filter((l) => passe(l, etat({ q: "kettar" }))))).toEqual(["Badla"]);
    expect(noms(lignes.filter((l) => passe(l, etat({ q: "ouest" }))))).toEqual(["Ait Ali", "chérif"]);
  });
  it("filtrer puis trier", () => {
    expect(noms(vueDuTableau(lignes, etat({ listes: { secteur: ["s1"] }, tri: { col: "q1", sens: "desc" } }), id))).toEqual(["Ait Ali", "chérif"]);
  });
  it("les valeurs proposées : comptées, le vide en dernier, les lettres dans leur ordre", () => {
    const v = valeursDuFiltre(lignes, "secteur", (l) => l.secteurLib || "Sans secteur");
    expect(v).toEqual([{ valeur: "s2", libelle: "Centre", n: 1 }, { valeur: "s1", libelle: "Ouest", n: 2 }, { valeur: "", libelle: "Sans secteur", n: 1 }]);
    expect(valeursDuFiltre(lignes, "potentiel", (l) => l.potentiel).map((x) => x.valeur)).toEqual(["H", "A", "D", "NA"]);
  });
  it("puces : basculer, retirer une valeur, tout effacer, compter", () => {
    let e = basculerValeur(ETAT_VIDE, "statut", "REFERENT");
    e = basculerValeur(e, "statut", "DECIDEUR");
    e = { ...e, textes: { nom: "a" }, plages: { q1: { min: 2, max: null } } };
    expect(nbFiltresActifs(e)).toBe(3);
    expect(retirerFiltre(e, "statut", "REFERENT").listes.statut).toEqual(["DECIDEUR"]);
    expect(nbFiltresActifs(retirerFiltre(e, "q1"))).toBe(2);
    expect(basculerValeur(e, "statut", "DECIDEUR").listes.statut).toEqual(["REFERENT"]);
    const vide = effacerFiltres({ ...e, q: "x", tri: { col: "nom", sens: "asc" } });
    expect(nbFiltresActifs(vide)).toBe(0);
    expect(vide.q).toBe("x");
    expect(vide.tri).toEqual({ col: "nom", sens: "asc" });
  });
});

describe("l'état dans l'URL (partageable)", () => {
  const e: EtatTableau = {
    q: "ali", tri: { col: "potentiel", sens: "desc" },
    listes: { secteur: ["s1", ""], potentiel: ["A"] }, textes: { prenom: "sli" }, plages: { q1: { min: 5, max: null }, pct: { min: null, max: 20.5 } },
  };
  it("aller-retour exact", () => {
    expect(lireEtat(new URLSearchParams(paramsDeLEtat(e)))).toEqual(e);
  });
  it("les autres paramètres de la page restent ; l'état vide ne laisse rien", () => {
    const u = urlAvecEtat("?s=abc&vue=praticiens&f_nom=old&tri=q1.asc", e);
    const sp = new URLSearchParams(u);
    expect(sp.get("s")).toBe("abc");
    expect(sp.get("vue")).toBe("praticiens");
    expect(sp.get("f_nom")).toBeNull();
    expect(sp.get("tri")).toBe("potentiel.desc");
    expect(sp.get("f_secteur")).toBe("s1|_");
    expect(urlAvecEtat("?s=abc&q=x&f_q1=1..", ETAT_VIDE)).toBe("?s=abc");
  });
  it("les paramètres de la page serveur (objet) se lisent aussi ; l'illisible est ignoré", () => {
    const lu = lireEtat({ s: "x", tri: "inconnu.asc", f_q2: "abc", f_statut: ["DECIDEUR|REFERENT"], q: undefined });
    expect(lu.tri).toBeNull();
    expect(lu.plages.q2).toBeUndefined();
    expect(lu.listes.statut).toEqual(["DECIDEUR", "REFERENT"]);
    expect(lu.q).toBe("");
    expect(lireEtat(undefined)).toEqual(ETAT_VIDE);
  });
});

describe("la saisie et les libellés", () => {
  it("Q2 : entier de 0 à 10 ; vide = effacée ; Q1 : nombre positif (virgule acceptée)", () => {
    expect(lireSaisieQ("", "q2")).toEqual({ ok: true, valeur: null });
    expect(lireSaisieQ(" 7 ", "q2")).toEqual({ ok: true, valeur: 7 });
    expect(lireSaisieQ("11", "q2").ok).toBe(false);
    expect(lireSaisieQ("2,5", "q2").ok).toBe(false);
    expect(lireSaisieQ("-1", "q1").ok).toBe(false);
    expect(lireSaisieQ("12,5", "q1")).toEqual({ ok: true, valeur: 12.5 });
    expect(lireSaisieQ("abc", "q1").ok).toBe(false);
  });
  it("la spécialité en casse propre ; un texte déjà mixte est gardé", () => {
    expect(casseNom("INFECTIOLOGIE")).toBe("Infectiologie");
    expect(casseNom("MALADIES  INFECTIEUSES")).toBe("Maladies infectieuses");
    expect(casseNom("Hématologie")).toBe("Hématologie");
    expect(casseNom(null)).toBe("");
  });
  it("le produit #1 en court", () => {
    expect(nomCourtProduit("raltegravir 400 mg · comprimé pelliculé")).toBe("Raltegravir 400 mg");
    expect(nomCourtProduit("RALTÉGRAVIR 400MG · COMPRIMÉ")).toBe("Raltégravir 400 mg");
    expect(nomCourtProduit("Isentress 400 mg")).toBe("Isentress 400 mg");
    expect(nomCourtProduit(null)).toBe("");
  });
  it("le grade hors liste, relu des commentaires de l'import", () => {
    expect(gradeBrutDe("Grade : KOL")).toBe("KOL");
    expect(gradeBrutDe("Note libre\nGrade : Retraité")).toBe("Retraité");
    expect(gradeBrutDe("rien")).toBeNull();
  });
});

describe("effacer une réponse (NA) et la wilaya d'In / Out", () => {
  const t = (j: number) => new Date(2026, 9, j);
  it("un effacement plus récent rend le champ vide ; une saisie plus récente le remplit de nouveau", () => {
    const obs = [
      { productId: "p1", potentiel: 25, prescriptionsSur10: 4, observeLe: t(1) },
      { productId: "p1", potentiel: null, prescriptionsSur10: null, observeLe: t(2), efface: effaceDeSource(SOURCE_EFFACEMENT.prescriptionsSur10) },
    ];
    expect(derniere(obs, "prescriptionsSur10", "p1")).toBeNull();
    expect(derniere(obs, "potentiel", "p1")?.valeur).toBe(25);
    expect(derniere([...obs, { productId: "p1", potentiel: null, prescriptionsSur10: 6, observeLe: t(3) }], "prescriptionsSur10", "p1")?.valeur).toBe(6);
    expect(effaceDeSource("TERRAIN")).toBeNull();
  });
  it("la wilaya : la sienne, sinon celle de l'établissement, sinon le nom de l'établissement", () => {
    expect(wilayaDuPraticien({ wilaya: "Oran", wilayaEtablissement: "Alger" })).toBe("Oran");
    expect(wilayaDuPraticien({ wilaya: "", wilayaEtablissement: "Alger" })).toBe("Alger");
    expect(wilayaDuPraticien({ wilaya: null, etablissement: "CHU Tidjani Damerdji de Tlemcen" })).toBe("Tlemcen");
    expect(wilayaDuPraticien({ wilaya: null, etablissement: null })).toBeNull();
  });
});
