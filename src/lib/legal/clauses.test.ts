import { describe, expect, it } from "vitest";
import { comparerClauses, extraireClauses, obligationsDe, risquesDe } from "./clauses";

/**
 * LES CLAUSES, lues sur un contrat français réaliste : les valeurs sortent avec leur extrait et
 * leur confiance, les obligations se datent depuis la fin du contrat, un avenant se compare en
 * VALEURS, et ce que le texte ne dit pas n'apparaît pas.
 */
const CONTRAT = `
CONTRAT DE DISTRIBUTION EXCLUSIVE

Article 3 — Durée. Le présent contrat est conclu pour une durée de trois (3) ans à compter de sa date de signature.
Il sera reconduit tacitement par périodes successives de douze (12) mois, sauf dénonciation par l'une des parties
par lettre recommandée avec accusé de réception moyennant un préavis de six (6) mois avant l'échéance.

Article 4 — Exclusivité. Le Fournisseur confère au Distributeur, à titre exclusif, la distribution des Produits sur le territoire de l'Algérie.

Article 7 — Paiement. Les factures sont payables à 60 jours date de facture par virement bancaire.

Article 9 — Pénalités. Tout retard de livraison donnera lieu à une pénalité de 0,5 % du montant de la commande par jour de retard,
plafonnée à 10 % du montant total de la commande.

Article 12 — Confidentialité. Les parties s'engagent à garder confidentielles les informations échangées pendant la durée du contrat et pendant deux (2) ans après son terme.

Article 14 — Résiliation. Chaque partie pourra résilier le présent contrat en cas de manquement grave non réparé dans un délai de trente (30) jours suivant mise en demeure.

Article 16 — Droit applicable. Le présent contrat est régi par le droit algérien. Tout litige sera soumis aux tribunaux d'Alger.
`;

describe("extraire les clauses", () => {
  const clauses = extraireClauses(CONTRAT);
  const par = (t: string) => clauses.find((c) => c.type === t);

  it("lit la durée, la reconduction tacite et le préavis avec leurs valeurs", () => {
    expect(par("DUREE")).toMatchObject({ confiance: "SURE", valeurs: { mois: 36 } });
    expect(par("RENOUVELLEMENT")).toMatchObject({ confiance: "SURE", valeurs: { tacite: true, mois: 12 } });
    expect(par("PREAVIS")).toMatchObject({ confiance: "SURE", valeurs: { mois: 6 } });
  });
  it("lit l'exclusivité et son territoire, le paiement, la pénalité avec taux, période et plafond", () => {
    expect(par("EXCLUSIVITE")?.valeurs.territoire).toMatch(/algerie/);
    expect(par("PAIEMENT")).toMatchObject({ confiance: "SURE", valeurs: { jours: 60 } });
    expect(par("PENALITE")).toMatchObject({ confiance: "SURE", valeurs: { taux: 0.005, periodeTaux: "jour", plafond: 0.1 } });
  });
  it("lit la confidentialité après terme, la résiliation, le droit applicable — et chaque clause porte son extrait", () => {
    expect(par("CONFIDENTIALITE")?.valeurs.mois).toBe(24);
    expect(par("RESILIATION")?.valeurs.jours).toBe(30);
    expect(par("DROIT_APPLICABLE")?.valeurs.droit).toMatch(/droit algerien/);
    for (const c of clauses) { expect(c.extrait.length).toBeGreaterThan(10); expect(c.position).toBeGreaterThanOrEqual(0); }
  });
  it("ce que le texte ne dit pas n'est pas inventé ; un mot-clé sans valeur est signalé", () => {
    expect(par("NON_CONCURRENCE")).toBeUndefined();
    const vague = extraireClauses("Article 5. Le contrat se renouvelle par tacite reconduction. Un préavis devra être respecté par les parties.");
    expect(vague.find((c) => c.type === "PREAVIS")).toMatchObject({ confiance: "A_VERIFIER", alerte: expect.stringMatching(/sans durée/) });
    expect(vague.find((c) => c.type === "RENOUVELLEMENT")).toMatchObject({ valeurs: { tacite: true }, alerte: expect.stringMatching(/sans période/) });
    expect(extraireClauses("")).toEqual([]);
  });
  it("une absence d'exclusivité est lue comme telle, une reconduction exclue aussi", () => {
    const c = extraireClauses("Article 2. La présente distribution est consentie à titre non exclusif. Article 3. Le contrat ne sera pas reconduit à son terme.");
    expect(c.find((x) => x.type === "EXCLUSIVITE")?.alerte).toMatch(/absence d'exclusivité/);
    expect(c.find((x) => x.type === "RENOUVELLEMENT")?.valeurs.tacite).toBe(false);
  });
});

describe("obligations, comparaison, risques", () => {
  const clauses = extraireClauses(CONTRAT);
  it("les obligations se datent depuis la fin du contrat : dénonciation à fin − préavis, exclusivité au terme, confidentialité après", () => {
    const o = obligationsDe(clauses, { endDate: "2027-03-31" });
    const den = o.find((x) => x.cle === "denonciation")!;
    expect(den.echeance).toBe("2026-09-30");
    expect(den.sinon).toMatch(/12 mois/);
    expect(o.find((x) => x.cle === "exclusivite")?.echeance).toBe("2027-03-31");
    expect(o.find((x) => x.cle === "confidentialite")?.echeance).toBe("2029-03-31");
    expect(obligationsDe(clauses, { endDate: null }).find((x) => x.cle === "denonciation")?.echeance).toBeNull();
  });
  it("un avenant se compare en VALEURS : durée, pénalité, exclusivité", () => {
    const avenant = extraireClauses(CONTRAT.replace("trois (3) ans", "cinq (5) ans").replace("0,5 % du montant", "1 % du montant").replace("Article 4 — Exclusivité. Le Fournisseur confère au Distributeur, à titre exclusif, la distribution des Produits sur le territoire de l'Algérie.", "Article 4 — Distribution. Le Fournisseur confère au Distributeur la distribution des Produits."));
    const ch = comparerClauses(clauses, avenant);
    expect(ch.find((c) => c.type === "DUREE")).toMatchObject({ sens: "MODIFIEE", avant: "36 mois", apres: "60 mois" });
    expect(ch.find((c) => c.type === "PENALITE")).toMatchObject({ sens: "MODIFIEE" });
    expect(ch.find((c) => c.type === "EXCLUSIVITE")).toMatchObject({ sens: "RETIREE" });
    expect(ch.some((c) => c.type === "PAIEMENT")).toBe(false);
  });
  it("les risques nomment leur clause : pas de plafond de pénalité, tacite sans préavis, droit étranger", () => {
    const sansPlafond = extraireClauses("Article 9. Tout retard donnera lieu à une pénalité de 1 % par jour de retard. Article 3. Le contrat est reconduit tacitement. Le présent contrat est régi par le droit français.");
    const r = risquesDe(sansPlafond);
    expect(r.map((x) => x.type)).toEqual(expect.arrayContaining(["PENALITE", "RENOUVELLEMENT", "DROIT_APPLICABLE", "RESPONSABILITE"]));
    expect(r.find((x) => x.type === "PENALITE")?.gravite).toBe("HAUTE");
    expect(risquesDe(clauses).some((x) => x.type === "PENALITE" && /sans plafond/.test(x.message))).toBe(false);
  });
});
