import { describe, expect, it } from "vitest";
import { consignerMesure } from "@/lib/evals/registre";
import {
  ancresNominales, ancresNumeriques, expliquerFait, extraireFaits, faitCalcule, faitsDuTour, familleDe, normaliserDate,
  repondreProvenance, LIMITE_FAITS_PAR_TOUR, type FaitSource,
} from "./provenance";

const ACTEUR = "user_pdg";
const LU = new Date("2026-09-06T09:30:00.000Z");

describe("provenance au niveau du fait — extraction déterministe depuis les sorties d'outils (F8)", () => {
  it("un enregistrement ERP lié porte sa famille, son autorité, sa date propre et la fraîcheur temps réel", () => {
    const sortie = JSON.stringify({
      renvoyes: 1,
      produits: [{ reference: "PRD-014", nom: "Lenvatinib", statut: "SUBMITTED", priorite: "HAUTE", misAJour: "2026-08-12", lien: "/regulatory/abc" }],
    });
    const [f] = extraireFaits("search_products", sortie, { acteur: ACTEUR, observeLe: LU });
    expect(f).toBeDefined();
    expect(f.nature).toBe("ERP");
    expect(f.famille).toBe("REGULATORY");
    expect(f.libelle).toBe("PRD-014 — Lenvatinib");
    expect(f.valeur).toContain("statut : SUBMITTED");
    expect(f.href).toBe("/regulatory/abc");
    expect(f.horodatage).toBe("2026-08-12T00:00:00.000Z");
    expect(f.observeLe).toBe(LU.toISOString());
    expect(f.confiance).toBe(1);
    expect(f.base).toBe("metadata");
    expect(f.fraicheur).toBe("TEMPS_REEL");
    expect(f.autorite).toMatch(/AVANCEMENT/);
    expect(f.preuveNegative).toBe(true);
    expect(f.acteur).toBe(ACTEUR);
    expect(f.outil).toBe("search_products");
  });

  it("une page de PDF de l'index de contenu : nature PAGE_PDF, locator, copie indexée sans preuve négative", () => {
    const sortie = JSON.stringify({ resultats: [{ fichier: "Contrat Hetero.pdf", page: 3, extrait: "…", lien: "/drive/f/xyz" }] });
    const [f] = extraireFaits("find_documents", sortie, { acteur: ACTEUR, observeLe: LU });
    expect(f.nature).toBe("PAGE_PDF");
    expect(f.locator).toBe("page 3");
    expect(f.famille).toBe("DRIVE_CONTENU_INDEXE");
    expect(f.fraicheur).toBe("INDEXEE");
    expect(f.preuveNegative).toBe(false);
    expect(f.base).toBe("native");
    expect(f.confiance).toBeCloseTo(0.9);
  });

  it("une cellule de classeur et un message : les locators disent l'endroit exact", () => {
    const cellule = extraireFaits("read_document", JSON.stringify({ fichier: "Budget.xlsx", feuille: "Budget", cellule: "C12", valeur: 142800, lien: "/drive/f/b" }), { acteur: ACTEUR })[0];
    expect(cellule.nature).toBe("CELLULE");
    expect(cellule.locator).toBe("Budget!C12");
    const mail = extraireFaits("gmail_search", JSON.stringify({ messages: [{ objet: "Certificat GMP", expediteur: "deepak@hetero.com", date: "2026-09-01T08:00:00Z", lien: "/messagerie/m1" }] }), { acteur: ACTEUR })[0];
    expect(mail.nature).toBe("EMAIL");
    expect(mail.horodatage).toBe("2026-09-01T08:00:00.000Z");
  });

  it("une adresse externe est CITÉE, jamais suivie : href nul, domaine dans le locator, confiance externe", () => {
    const sortie = JSON.stringify({ resultats: [{ titre: "Décision ANPP", url: "https://evil.example.com/exfiltrer?x=1", extrait: "…" }] });
    const [f] = extraireFaits("web_research", sortie, { acteur: ACTEUR });
    expect(f.nature).toBe("EXTERNE");
    expect(f.href).toBeNull();
    expect(f.locator).toBe("evil.example.com");
    expect(f.base).toBe("externe");
    expect(f.confiance).toBeLessThan(0.85);
  });

  it("une confiance mesurée par l'outil (OCR) prime sur la valeur par défaut", () => {
    const [f] = extraireFaits("read_document", JSON.stringify({ fichier: "scan.pdf", page: 2, extractedBy: "ocr", confiance: 0.71, lien: "/drive/f/s" }), { acteur: ACTEUR });
    expect(f.base).toBe("ocr");
    expect(f.confiance).toBeCloseTo(0.71);
  });

  it("les faits DÉCLARÉS (`_provenance`) sont relus champ par champ ; les entrées invalides sont refusées", () => {
    const calcul = faitCalcule({
      outil: "finance_totals", acteur: ACTEUR, libelle: "Total décaissé T3", valeur: 142800,
      entrees: ["PAY-1", "PAY-2", "PAY-3"], transformation: "somme des écritures réglées", formule: "Σ montant (status = SETTLED)", href: "/finances",
    });
    const sortie = JSON.stringify({
      totalDzd: 142800, lien: "/finances",
      _provenance: [
        calcul,
        { nature: "CALCUL", libelle: "sans calcul" , confiance: 1 },            // CALCUL sans lignée → refusé
        { nature: "MARTIEN", libelle: "x", confiance: 1 },                      // nature inconnue → refusé
        { nature: "ERP", libelle: "trop sûr", confiance: 7 },                   // confiance hors [0,1] → refusé
        { nature: "ERP", libelle: "ok", confiance: 0.5, href: "https://ext" },  // href externe → nul
      ],
    });
    const faits = extraireFaits("finance_totals", sortie, { acteur: ACTEUR, observeLe: LU });
    const declares = faits.filter((f) => f.id.includes(":decl:"));
    expect(declares).toHaveLength(2);
    expect(declares[0].nature).toBe("CALCUL");
    expect(declares[0].calcul?.entrees).toEqual(["PAY-1", "PAY-2", "PAY-3"]);
    expect(declares[0].calcul?.formule).toMatch(/Σ montant/);
    expect(declares[0].famille).toBe("FINANCE");
    expect(declares[1].href).toBeNull();
    // Et l'enregistrement lié lui-même (lien: /finances) suit, sans doublon des déclarés.
    expect(faits.some((f) => f.href === "/finances" && f.nature === "ERP")).toBe(true);
  });

  it("un fait calculé hérite de la PIRE confiance de ses entrées et de leur date la plus ancienne", () => {
    const sure: FaitSource = extraireFaits("read_finances", JSON.stringify({ reference: "PAY-1", montant: "100 000 DZD", date: "2026-07-03", lien: "/finances/p1" }), { acteur: ACTEUR })[0];
    const ocr: FaitSource = extraireFaits("read_document", JSON.stringify({ fichier: "facture.pdf", page: 1, extractedBy: "ocr", confiance: 0.6, date: "2026-06-01", lien: "/drive/f/i" }), { acteur: ACTEUR })[0];
    const total = faitCalcule({ outil: "finance_totals", acteur: ACTEUR, libelle: "Total", valeur: 142800, entrees: [sure, ocr], transformation: "somme", formule: "a + b" });
    expect(total.confiance).toBeCloseTo(0.6);
    expect(total.horodatage).toBe("2026-06-01T00:00:00.000Z");
    expect(total.calcul?.entrees).toEqual([sure.id, ocr.id]);
    expect(total.nature).toBe("CALCUL");
  });

  it("le tour dédoublonne et se borne", () => {
    const lignes = Array.from({ length: 60 }, (_, i) => ({ reference: `PRD-${i}`, lien: `/regulatory/${i}` }));
    const faits = faitsDuTour([
      { outil: "search_products", sortie: JSON.stringify({ a: lignes.slice(0, 30), b: lignes.slice(30) }) },
      { outil: "search_products", sortie: JSON.stringify({ a: lignes.slice(0, 5) }) },
      { outil: "regulatory_portfolio", sortie: JSON.stringify({ a: lignes }) },
    ], { acteur: ACTEUR });
    expect(faits.length).toBeLessThanOrEqual(LIMITE_FAITS_PAR_TOUR);
    expect(new Set(faits.map((f) => f.id)).size).toBe(faits.length);
  });

  it("une sortie sans enregistrement lié produit UN fait : la lecture elle-même (fiche d'annuaire, résultat vide)", () => {
    const fiche = extraireFaits("directory_lookup", JSON.stringify({ personne: { nom: "Raihana Cherif", email: "raihana@adventum.dz", poste: "Regulatory" }, source: "annuaire" }), { acteur: ACTEUR, observeLe: LU });
    expect(fiche).toHaveLength(1);
    expect(fiche[0].libelle).toBe("Raihana Cherif");
    expect(fiche[0].valeur).toContain("email : raihana@adventum.dz");
    expect(fiche[0].nature).toBe("PERSONNE");
    expect(fiche[0].famille).toBe("ANNUAIRE");
    expect(fiche[0].href).toBeNull();
    const vide = extraireFaits("search_products", JSON.stringify({ message: "Aucun produit." }), { acteur: ACTEUR });
    expect(vide).toHaveLength(1);
    expect(vide[0].libelle).toBe("Regulatory — recherche de produits");
    expect(vide[0].valeur).toBe("message : Aucun produit.");
    expect(vide[0].preuveNegative).toBe(true);
    // Une erreur n'est pas une lecture ; un texte brut non plus.
    expect(extraireFaits("search_products", JSON.stringify({ error: "indisponible" }), { acteur: ACTEUR })).toEqual([]);
    expect(extraireFaits("search_products", "pas du JSON", { acteur: ACTEUR })).toEqual([]);
    expect(familleDe("outil_inconnu")).toBeNull();
  });

  it("les dates : ISO, JJ/MM/AAAA, jamais une année devinée, jamais un 31 février", () => {
    expect(normaliserDate("2026-08-12")).toBe("2026-08-12T00:00:00.000Z");
    expect(normaliserDate("12/08/2026 14:05")).toBe("2026-08-12T14:05:00.000Z");
    expect(normaliserDate("31/02/2026")).toBeNull();
    expect(normaliserDate("12 mars")).toBeNull();
    expect(normaliserDate(42)).toBeNull();
  });
});

describe("« D'où tu tiens ça ? » — la réponse est composée par le code", () => {
  const tourFinance = {
    createdAt: new Date("2026-09-06T09:31:00.000Z"),
    question: "Combien avons-nous payé à Hetero ce trimestre ?",
    faits: [
      faitCalcule({ outil: "finance_totals", acteur: ACTEUR, libelle: "Total décaissé Hetero T3", valeur: "142 800 DZD", entrees: ["PAY-1", "PAY-2"], transformation: "somme des écritures réglées", formule: "Σ montant", href: "/finances", observeLe: LU }),
      ...extraireFaits("finance_totals", JSON.stringify({ dernieresEcritures: [{ reference: "PAY-2", beneficiaire: "Hetero Labs", montant: "42 800 DZD", date: "2026-08-20", lien: "/finances/p2" }] }), { acteur: ACTEUR, observeLe: LU }),
    ],
  };
  const tourRegul = {
    createdAt: new Date("2026-09-06T09:20:00.000Z"),
    question: "Où en est Lenvatinib ?",
    faits: extraireFaits("search_products", JSON.stringify({ reference: "PRD-014", nom: "Lenvatinib", statut: "SUBMITTED", misAJour: "2026-08-12", lien: "/regulatory/abc" }), { acteur: ACTEUR, observeLe: LU }),
  };

  it("un nombre cité cible le fait qui le porte — le calcul, avec sa lignée", () => {
    const r = repondreProvenance({ question: "D'où tu tiens les 142 800 ?", tours: [tourRegul, tourFinance] });
    expect(r.trouve).toBe(true);
    expect(r.cible).toBe("ancre");
    expect(r.faits).toHaveLength(1);
    expect(r.faits[0].nature).toBe("CALCUL");
    expect(r.texte).toMatch(/calcul du serveur : somme des écritures réglées sur 2 entrée/);
    expect(r.texte).toMatch(/formule Σ montant/);
    expect(r.texte).toMatch(/→ \/finances/);
  });

  it("un nom cité remonte au tour qui l'a lu, même s'il n'est pas le dernier", () => {
    const r = repondreProvenance({ question: "Et pour Lenvatinib, ta source ?", tours: [tourFinance, tourRegul] });
    expect(r.cible).toBe("ancre");
    expect(r.faits[0].libelle).toBe("PRD-014 — Lenvatinib");
    expect(r.texte).toMatch(/ERP · Regulatory/);
    expect(r.texte).toMatch(/donnée du 12\/08\/2026/);
    expect(r.texte).toMatch(/lue le 06\/09\/2026/);
    expect(r.texte).toMatch(/confiance 100 % — donnée structurée de l'ERP/);
    expect(r.texte).toMatch(/autorité : L'AVANCEMENT/);
  });

  it("sans ancre, ce sont les faits du dernier tour qui a lu ; une ancre introuvable le DIT", () => {
    const r = repondreProvenance({ question: "D'où tu tiens ça ?", tours: [tourRegul, tourFinance] });
    expect(r.cible).toBe("dernier_tour");
    expect(r.faits.map((f) => f.libelle)).toEqual(["Total décaissé Hetero T3", "PAY-2"]);
    expect(r.texte).toMatch(/tables vivantes/);
    const r2 = repondreProvenance({ question: "D'où sort le 999 999 ?", tours: [tourFinance] });
    expect(r2.cible).toBe("dernier_tour");
    expect(r2.texte).toMatch(/Je n'ai pas retrouvé exactement/);
  });

  it("aucun fait servi → la réponse l'assume au lieu d'inventer une source", () => {
    const r = repondreProvenance({ question: "D'où tu tiens ça ?", tours: [{ createdAt: LU, question: "Bonjour", faits: [] }] });
    expect(r.trouve).toBe(false);
    expect(r.texte).toMatch(/aucun fait sourcé/);
  });

  it("les ancres : nombres à espaces ou points, noms propres et références", () => {
    expect(ancresNumeriques("les 142 800 DZD et 3,5 % et 12")).toEqual(["142800"]);
    expect(ancresNumeriques("le total de 1.250.000")).toEqual(["1250000"]);
    expect(ancresNominales("Et pour Lenvatinib et PRD-014, ta source ?")).toEqual(expect.arrayContaining(["lenvatinib", "prd-014"]));
    expect(ancresNominales("D'où tu tiens ça ?")).toEqual([]);
  });

  it("l'explication d'un fait externe ou peu sûr porte l'avertissement", () => {
    const ext = extraireFaits("web_research", JSON.stringify({ titre: "Prix public", url: "https://example.org/p" }), { acteur: ACTEUR, observeLe: LU })[0];
    expect(expliquerFait(ext)).toMatch(/source externe/);
    const r = repondreProvenance({ question: "Ta source ?", tours: [{ createdAt: LU, question: null, faits: [ext] }] });
    expect(r.texte).toMatch(/citée, pas garantie/);
  });
});

describe("§33 — 100 % des faits critiques portent leur provenance", () => {
  it("sur un tour réaliste (produits, document OCR, annuaire, calcul), chaque fait dit sa nature, son outil, sa confiance, sa base, sa fraîcheur, sa date d'observation et son ancrage", () => {
    const lignes = Array.from({ length: 8 }, (_, i) => ({ reference: `PRD-${i}`, dci: `Molécule ${i}`, lien: `/regulatory/${i}` }));
    const faits = faitsDuTour([
      { outil: "search_products", sortie: JSON.stringify({ produits: lignes }) },
      { outil: "read_document", sortie: JSON.stringify({ fichier: "facture.pdf", page: 2, extractedBy: "ocr", confiance: 0.6, date: "2026-06-01", lien: "/drive/x", montant: "142 800" }) },
      { outil: "directory_lookup", sortie: JSON.stringify({ personne: { nom: "Raihana Cherif", email: "raihana@adventum.dz", poste: "Regulatory" }, source: "annuaire" }) },
      { outil: "search_products", sortie: JSON.stringify({ message: "Aucun produit." }) },
    ], { acteur: ACTEUR });
    const sure = faits.find((f) => f.outil === "search_products" && f.libelle === "PRD-0")!;
    const ocr = faits.find((f) => f.outil === "read_document")!;
    const total = faitCalcule({ outil: "finance_totals", acteur: ACTEUR, libelle: "Total", valeur: 142_800, entrees: [sure, ocr], transformation: "somme", formule: "a + b" });
    const tous: FaitSource[] = [...faits, total];
    expect(tous.length).toBeGreaterThanOrEqual(6);
    const complet = (f: FaitSource): boolean =>
      typeof f.id === "string" && f.id.length > 0
      && typeof f.nature === "string" && f.nature.length > 0
      && typeof f.outil === "string" && f.outil.length > 0
      && Number.isFinite(f.confiance) && f.confiance >= 0 && f.confiance <= 1
      && typeof f.base === "string" && f.base.length > 0
      && typeof f.fraicheur === "string" && f.fraicheur.length > 0
      && typeof f.observeLe === "string" && !Number.isNaN(Date.parse(f.observeLe))
      && f.acteur === ACTEUR
      // L'ANCRAGE : une famille de source, un lien, un locator ou une lignée de calcul — au moins un.
      && (f.famille !== null || f.href !== null || f.locator !== null || f.calcul !== null);
    const incomplets = tous.filter((f) => !complet(f));
    expect(incomplets.map((f) => `${f.outil}:${f.libelle}`), "faits sans provenance complète").toEqual([]);
    consignerMesure("provenance_faits_critiques", { n: tous.length, ok: tous.length - incomplets.length }, "lib/fabric/provenance.test.ts");
  });
});
