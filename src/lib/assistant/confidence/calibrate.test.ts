import { describe, expect, it } from "vitest";
import { calibrer, certitudeDuFait, contradictionsDe, enjeuDe, expliquerCalibration, manquantsDe, perimesDe, type FaitCalibrable } from "./calibrate";

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

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE FAIT PÉRIMÉ — le faux succès sans aucune signature d'échec.
 *
 * Un fait lu dans une COPIE indexée il y a six mois portait `base: "metadata"` et une confiance
 * de 0,95 : il sortait CERTAIN, la réponse s'annonçait « FAIT VÉRIFIÉ », et Adam agissait sur
 * une donnée que la source a peut-être révisée depuis. La date était pourtant là, dans
 * `horodatage` — déclarée sur l'interface, et lue par personne.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
const MAINTENANT = new Date("2026-09-08T12:00:00.000Z");
const ilYA = (heures: number) => new Date(MAINTENANT.getTime() - heures * 3_600_000).toISOString();

describe("une copie indexée vieillit ; une lecture en temps réel, non", () => {
  it("une copie de document vieille de six mois n'est plus CERTAINE — elle est PÉRIMÉE, et on RELIT", () => {
    const vieux = fait({
      libelle: "Clause de résiliation", valeur: "6 mois", nature: "DOCUMENT", outil: "search_drive",
      fraicheur: "INDEXEE", horodatage: ilYA(24 * 180), base: "metadata", confiance: 0.95,
    });
    const c = calibrer([vieux], { maintenant: MAINTENANT });
    expect(c.certitude).toBe("PERIME");
    expect(c.conduite, "on sait EXACTEMENT où retourner : on relit, on ne cherche pas ailleurs").toBe("RELIRE");
    expect(c.perimes).toHaveLength(1);
    expect(c.motif).toContain("copie indexée");
    expect(c.motif).toContain("180 jours");
  });

  it("une lecture en TEMPS RÉEL ne périme JAMAIS de la date de sa donnée", () => {
    /**
     * CE QUI FERAIT TOMBER CE TEST : dater la péremption sur `horodatage` sans regarder la
     * fraîcheur. Une facture de 2024 EST de 2024 — la table était vivante au moment de la
     * lecture. La déclarer périmée enverrait relire l'ERP pour toutes les données anciennes,
     * et la garde serait retirée dans la semaine (§118.16).
     */
    const facture = fait({
      libelle: "Facture FA-2024-118", valeur: "850 000 DZD", nature: "ERP", outil: "inspect_record",
      fraicheur: "TEMPS_REEL", horodatage: ilYA(24 * 600),
    });
    const c = calibrer([facture], { maintenant: MAINTENANT });
    expect(c.certitude).toBe("CERTAIN");
    expect(c.perimes).toEqual([]);
  });

  it("une copie SANS date lisible n'est jamais déclarée périmée", () => {
    const sansDate = fait({
      libelle: "Note interne", nature: "DOCUMENT", fraicheur: "INDEXEE", horodatage: null,
    });
    expect(perimesDe([sansDate], MAINTENANT)).toEqual([]);
    const bidon = fait({ libelle: "Note", nature: "DOCUMENT", fraicheur: "INDEXEE", horodatage: "hier matin" });
    expect(perimesDe([bidon], MAINTENANT)).toEqual([]);
  });

  it("une date FUTURE est une saisie fautive, pas une péremption", () => {
    const futur = fait({
      libelle: "Échéance", nature: "DOCUMENT", fraicheur: "INDEXEE",
      horodatage: new Date(MAINTENANT.getTime() + 86_400_000).toISOString(),
    });
    expect(perimesDe([futur], MAINTENANT)).toEqual([]);
  });

  it("un CALCUL se juge sur le budget le plus large, jamais sur celui de l'inconnu", () => {
    /**
     * CE QUI FERAIT TOMBER CE TEST : ranger CALCUL dans « AUTRE » (48 h). Un total bâti sur des
     * documents indexés — `faitCalcule` le date par sa donnée la plus ancienne — serait annoncé
     * périmé au bout de deux jours, quand les documents eux-mêmes tiennent trente. La carte
     * porterait une réserve presque toujours, et on cesserait de la lire.
     */
    const copie = { fraicheur: "INDEXEE" as const, outil: "run_python", nature: "CALCUL" };
    const troisJours = fait({ libelle: "Engagement total", ...copie, horodatage: ilYA(72) });
    expect(perimesDe([troisJours], MAINTENANT), "un total de trois jours n'est pas à relire").toEqual([]);
    const quaranteJours = fait({ libelle: "Engagement total", ...copie, horodatage: ilYA(40 * 24) });
    expect(perimesDe([quaranteJours], MAINTENANT)).toHaveLength(1);
    expect(perimesDe([quaranteJours], MAINTENANT)[0].seuilH, "le seuil d'un document, pas celui de l'inconnu").toBe(720);
  });

  it("le seuil suit la NATURE : un chiffre financier vieillit en un jour, un document en trente", () => {
    const cinqJours = { fraicheur: "INDEXEE", horodatage: ilYA(24 * 5), base: "metadata" as const };
    // Un document de cinq jours tient (seuil 720 h) ; le même âge sur une réunion ne tient pas
    // au-delà de sa semaine, et sur une source non classée, pas au-delà de 48 h.
    expect(perimesDe([fait({ libelle: "contrat", nature: "DOCUMENT", ...cinqJours })], MAINTENANT)).toEqual([]);
    expect(perimesDe([fait({ libelle: "cours", nature: "EXTERNE", ...cinqJours })], MAINTENANT)).toHaveLength(1);
  });

  it("le PÉRIMÉ passe après le probable et avant l'hypothèse — le maillon faible gouverne", () => {
    const certain = fait({ libelle: "statut", valeur: "déposé" });
    const perime = fait({
      libelle: "clause", valeur: "6 mois", nature: "DOCUMENT", fraicheur: "INDEXEE", horodatage: ilYA(24 * 90),
    });
    const hypothese = fait({ libelle: "prix marché", valeur: "12", base: "terra", confiance: 0.5 });

    expect(calibrer([certain, perime], { maintenant: MAINTENANT }).certitude).toBe("PERIME");
    // Une HYPOTHÈSE est plus faible qu'une copie datée : la mémoire d'un modèle passe devant.
    expect(calibrer([certain, perime, hypothese], { maintenant: MAINTENANT }).certitude).toBe("HYPOTHESE");
    // Et un MANQUANT passe devant les deux : il n'y a rien à relire.
    expect(calibrer([perime], { requis: ["142 800"], maintenant: MAINTENANT }).certitude).toBe("MANQUANT");
  });

  it("plusieurs copies vieilles : le motif nomme la plus ancienne et les compte", () => {
    const faits = [
      fait({ libelle: "clause A", nature: "DOCUMENT", fraicheur: "INDEXEE", horodatage: ilYA(24 * 40) }),
      fait({ libelle: "clause B", nature: "DOCUMENT", fraicheur: "INDEXEE", horodatage: ilYA(24 * 200) }),
    ];
    const c = calibrer(faits, { maintenant: MAINTENANT });
    expect(c.motif).toContain("2 copies indexées");
    expect(c.motif).toContain("clause B");
    expect(c.perimes[0].libelle, "la plus vieille vient en tête").toBe("clause B");
  });
});
