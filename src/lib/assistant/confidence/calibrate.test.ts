import { describe, expect, it } from "vitest";
import { calibrer, certitudeDuFait, contradictionsDe, enjeuDe, expliquerCalibration, manquantsDe, type FaitCalibrable } from "./calibrate";

const fait = (p: Partial<FaitCalibrable> & { libelle: string }): FaitCalibrable => ({
  id: p.id ?? p.libelle, valeur: null, nature: "ERP", outil: "inspect_record", confiance: 0.95, base: "metadata", fraicheur: "TEMPS_REEL", horodatage: null, preuveNegative: null, ...p,
});

describe("calibration de confiance — le maillon faible gouverne", () => {
  it("un fait ERP frais est CERTAIN, un document indexé PROBABLE, une lecture de modèle ou le web jamais plus que PROBABLE", () => {
    expect(certitudeDuFait(fait({ libelle: "statut" }))).toBe("CERTAIN");
    expect(certitudeDuFait(fait({ libelle: "montant", base: "ocr", confiance: 0.7, nature: "DOCUMENT" }))).toBe("PROBABLE");
    expect(certitudeDuFait(fait({ libelle: "prix", base: "terra", confiance: 0.95 }))).toBe("PROBABLE");
    expect(certitudeDuFait(fait({ libelle: "prix", base: "luna", confiance: 0.6 }))).toBe("HYPOTHESE");
    expect(certitudeDuFait(fait({ libelle: "cours", nature: "EXTERNE", base: "externe", confiance: 0.5 }))).toBe("HYPOTHESE");
    expect(certitudeDuFait(fait({ libelle: "total", base: "calcul", confiance: 1 }))).toBe("CERTAIN");
  });

  it("vingt faits certains et un fait de mémoire font une HYPOTHÈSE → chercher ; tous certains → agir ; un probable → vérifier", () => {
    const certains = Array.from({ length: 20 }, (_, i) => fait({ libelle: `champ ${i}`, valeur: String(i) }));
    expect(calibrer(certains)).toMatchObject({ certitude: "CERTAIN", conduite: "AGIR" });
    expect(calibrer([...certains, fait({ libelle: "prix marché", valeur: "12", base: "terra", confiance: 0.5 })])).toMatchObject({ certitude: "HYPOTHESE", conduite: "CHERCHER" });
    const c = calibrer([...certains, fait({ libelle: "clause", valeur: "6 mois", base: "native", confiance: 0.7, nature: "DOCUMENT" })]);
    expect(c).toMatchObject({ certitude: "PROBABLE", conduite: "VERIFIER" });
    expect(c.parCertitude).toEqual({ CERTAIN: 20, PROBABLE: 1, HYPOTHESE: 0 });
    // Un enjeu FAIBLE ne fait pas vérifier un probable.
    expect(calibrer([fait({ libelle: "clause", valeur: "6 mois", base: "native", confiance: 0.7 })], { enjeu: "FAIBLE" }).conduite).toBe("AGIR");
  });

  it("deux valeurs pour un même libellé : CONTRADICTION → arbitrer, avec les deux valeurs et leurs outils", () => {
    const faits = [fait({ libelle: "Montant HT", valeur: "850 000", outil: "read_document", base: "native", confiance: 0.8 }), fait({ libelle: "montant ht", valeur: "900 000", outil: "inspect_record" }), fait({ libelle: "Devise", valeur: "DZD" })];
    expect(contradictionsDe(faits)).toEqual([{ libelle: "Montant HT", valeurs: ["850 000", "900 000"], outils: ["read_document", "inspect_record"] }]);
    const c = calibrer(faits);
    expect(c.certitude).toBe("CONTRADICTION");
    expect(c.conduite).toBe("ARBITRER");
    expect(c.motif).toMatch(/850 000 ≠ 900 000/);
    // La même valeur écrite autrement n'est pas une contradiction.
    expect(contradictionsDe([fait({ libelle: "Montant", valeur: "850 000" }), fait({ libelle: "montant", valeur: "850000", outil: "sql_query" })])).toEqual([]);
  });

  it("ce que la question exige et qu'aucun fait ne porte : MANQUANT → demander ; rien lu du tout : MANQUANT aussi", () => {
    const faits = [fait({ libelle: "Dossier", valeur: "REG-2026-014" }), fait({ libelle: "Statut", valeur: "AWAITING_ANPP" })];
    expect(manquantsDe(faits, ["REG-2026-014", "CPP", "450 000"])).toEqual(["CPP", "450 000"]);
    const c = calibrer(faits, { requis: ["CPP"] });
    expect(c).toMatchObject({ certitude: "MANQUANT", conduite: "DEMANDER", manquants: ["CPP"] });
    expect(calibrer([]).certitude).toBe("MANQUANT");
    expect(calibrer([fait({ libelle: "facture", valeur: "aucune", preuveNegative: true })]).motif).toMatch(/preuves négatives/);
  });

  it("l'enjeu se lit dans la demande : une action proposée ou un verbe d'engagement pèse, une question courte pèse peu", () => {
    expect(enjeuDe("Quel est le statut du dossier Nivolex ?")).toBe("FAIBLE");
    expect(enjeuDe("Fais le point sur les contrats Sofradis et ce qui cloche côté paiements")).toBe("NORMAL");
    expect(enjeuDe("Paie la facture Hikma", {})).toBe("ELEVE");
    expect(enjeuDe("Point sur le dossier", { propositions: 1 })).toBe("ELEVE");
    expect(enjeuDe("Point", { montantMax: 2_000_000 })).toBe("ELEVE");
    expect(expliquerCalibration(calibrer([fait({ libelle: "x", valeur: "1" })]))).toMatch(/^Certitude : certain — 1 fait\(s\) .* → agir$/);
  });
});
