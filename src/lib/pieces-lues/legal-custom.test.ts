import { describe, expect, it } from "vitest";
import { HISTORIQUE_MAX, lectureConfirmee, lectureLegaleConfirmee, lignesDeLaPiece, type LectureLegale } from "./legal-custom";

/**
 * LES LIGNES D'UNE PIÈCE LEGAL — émise, ou lue et CONFIRMÉE ; jamais une proposition (lot D2-D, P9).
 * Ce qui ferait tomber ces cas : une lecture sans date ou sans auteur rendue comme confirmée, une liste
 * de lignes amputée d'une ligne illisible rendue quand même, la provenance perdue, et une pièce émise
 * dont les lignes de la fabrique céderaient la place à une lecture.
 */

const LIGNES = [
  { designation: "Fiche posologique A4", quantite: 2000, unite: "U", prixUnitaire: 45, remise: null, tva: 0.19, reference: null, section: false },
  { designation: "Kakémono 80x200", quantite: 2, unite: null, prixUnitaire: 15000, remise: 0.1, tva: null, reference: "KK-80", section: false },
];

const confirmee = (over: Partial<LectureLegale> = {}): LectureLegale => ({
  lectureId: "lec-1", jeton: "j-1", confirmeeLe: "2026-09-12T10:00:00.000Z", confirmeePar: "u-legal",
  noteMethode: "Lue par OCR (Tesseract, confiance 71 %).", lignes: LIGNES, taxes: [{ libelle: "Taxe Pub", taux: 0.02 }],
  tvaDefaut: 0.19, historique: [{ le: "2026-09-12T10:00:00.000Z", par: "u-legal", resume: "2 lignes confirmées" }],
  ...over,
});

describe("lectureConfirmee — une confirmation, ou rien", () => {
  it("relit une lecture confirmée, au format que ce module définit", () => {
    expect(lectureConfirmee({ lecture: confirmee(), intelligence: { versionId: "v1" } })).toEqual(confirmee());
  });

  it("sans date de confirmation, sans auteur ou sans jeton : c'est une PROPOSITION — rien n'est rendu", () => {
    for (const k of ["confirmeeLe", "confirmeePar", "jeton"] as const) {
      const { [k]: _, ...reste } = confirmee();
      expect(lectureConfirmee({ lecture: reste }), k).toBeNull();
    }
    expect(lectureConfirmee({ lecture: { ...confirmee(), confirmeeLe: "pas une date" } })).toBeNull();
  });

  it("une ligne illisible rend TOUTE la lecture illisible — une liste amputée serait pire qu'aucune", () => {
    expect(lectureConfirmee({ lecture: { ...confirmee(), lignes: [...LIGNES, { designation: "Prix effacé", quantite: 1, prixUnitaire: "?" }] } })).toBeNull();
  });
});

describe("lignesDeLaPiece — la seule lecture des lignes d'une pièce Legal, avec sa provenance", () => {
  const fabrique = {
    type: "BON_DE_COMMANDE", numero: "BC-2026-0007", version: 2,
    spec: { lignes: [{ designation: "Impression — Fiche posologique", quantite: 500, prixUnitaire: 225, tva: 0.19 }], tvaDefaut: 0.19, remiseGlobale: null, taxes: [{ libelle: "Taxe Pub", taux: 0.02 }] },
  };

  it("une pièce ÉMISE : les lignes de sa fabrique — même si une lecture traîne à côté", () => {
    const r = lignesDeLaPiece({ fabrique, lecture: confirmee() });
    expect(r?.provenance).toBe("EMISE");
    expect(r?.lignes.map((l) => l.designation)).toEqual(["Impression — Fiche posologique"]);
    expect(r?.taxes).toEqual([{ libelle: "Taxe Pub", taux: 0.02 }]);
    expect(r?.phrase).toContain("BC-2026-0007");
  });

  it("une pièce DÉPOSÉE dont la lecture est confirmée : ses lignes, et la provenance le dit (méthode comprise)", () => {
    const r = lignesDeLaPiece({ lecture: confirmee() });
    expect(r?.provenance).toBe("LECTURE_CONFIRMEE");
    expect(r?.lignes).toEqual(LIGNES);
    expect(r?.phrase).toContain("confirmées une à une");
    expect(r?.phrase).toContain("Lue par OCR");
  });

  it("une proposition NON confirmée ne rend JAMAIS de lignes — ni une pièce sans rien", () => {
    const { confirmeeLe: _, ...proposition } = confirmee();
    expect(lignesDeLaPiece({ lecture: proposition })).toBeNull();
    expect(lignesDeLaPiece({})).toBeNull();
    expect(lignesDeLaPiece(null)).toBeNull();
  });
});

describe("lectureLegaleConfirmee — composer ce qui s'écrit sous custom.lecture", () => {
  it("reprend l'historique de la précédente, ajoute l'évènement, borne à HISTORIQUE_MAX — et se relit", () => {
    const longue = confirmee({ historique: Array.from({ length: HISTORIQUE_MAX }, (_, i) => ({ le: "2026-09-01T00:00:00.000Z", par: "u", resume: `ancien ${i}` })) });
    const nouvelle = lectureLegaleConfirmee({
      precedente: longue, lectureId: "lec-2", jeton: "j-2", le: "2026-09-13T09:00:00.000Z", par: "u-fin",
      noteMethode: "Texte natif du fichier, lu sans OCR.", lignes: LIGNES, taxes: [], tvaDefaut: 0.19, resume: "relecture confirmée",
    });
    expect(nouvelle.historique).toHaveLength(HISTORIQUE_MAX);
    expect(nouvelle.historique.at(-1)).toEqual({ le: "2026-09-13T09:00:00.000Z", par: "u-fin", resume: "relecture confirmée" });
    expect(nouvelle.historique[0]!.resume).toBe("ancien 1");
    expect(lectureConfirmee({ lecture: nouvelle })).toEqual(nouvelle);
  });
});
