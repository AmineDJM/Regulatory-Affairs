import { describe, expect, it } from "vitest";
import { reserveDeMarque } from "@/lib/assistant/office-capabilities";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * « LE BC ADVENTUM GÉNÉRIQUE EST UN ÉCHEC QUALITATIF, MÊME SI LE DOCX ÉTAIT VALIDE. »
 *
 * MESURÉ en émettant un vrai BC Adventum par le chemin de production :
 *
 *   papiers en-tête : []          profil : letterheadId null, footerNote null, signataire null
 *   résultat : { ok: true, reference: "BC-2026-0001", surPapierEnTete: false,
 *                avertissements: ["Identité de l'émetteur incomplète : l'adresse du siège,
 *                                  le numéro de registre…"] }
 *
 * Le code SAVAIT. Mais la phrase rendue au modèle disait « pièce inscrite au registre Legal »
 * sans une réserve, et c'est la phrase qu'un modèle reprend. On remet donc un document
 * générique en le présentant comme fini — le défaut de confiance le plus cher, celui qui ne se
 * voit qu'en ouvrant le fichier devant un tiers.
 *
 * La réserve ne juge ni le style ni la mise en page : deux FAITS, et le geste exact qui les
 * lève. Silence total quand les deux sont en règle — sinon elle deviendrait du bruit, et on
 * cesserait de la lire.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
describe("une pièce qui n'a pas l'air officielle le dit dans sa phrase", () => {
  const societe = { nom: "Adventum Pharma" };

  it("sans papier en-tête ni identité : la réserve nomme les DEUX et le geste qui les lève", () => {
    const r = reserveDeMarque({
      surPapierEnTete: false, societe,
      avertissements: ["Identité de l'émetteur incomplète : l'adresse du siège, le numéro de registre de commerce — à renseigner dans la carte d'identité légale de la société."],
    });
    expect(r).toContain("ne ressemble PAS encore à un document officiel");
    expect(r).toContain("aucun papier en-tête");
    expect(r).toContain("Administration › Marque");
    expect(r).toContain("carte d'identité légale");
  });

  it("sur papier en-tête et identité complète : SILENCE — sinon la réserve devient du bruit", () => {
    expect(reserveDeMarque({ surPapierEnTete: true, societe, avertissements: [] })).toBe("");
    // Un avertissement d'une AUTRE nature ne déclenche rien : la réserve ne parle que d'identité.
    expect(reserveDeMarque({ surPapierEnTete: true, societe, avertissements: ["Le PDF rend le texte et les tableaux."] })).toBe("");
  });

  it("papier en-tête présent mais identité incomplète : une seule réserve, la bonne", () => {
    const r = reserveDeMarque({
      surPapierEnTete: true, societe,
      avertissements: ["Identité de l'émetteur incomplète : le NIF — à renseigner dans la carte d'identité légale de la société."],
    });
    expect(r).toContain("le NIF");
    expect(r).not.toContain("papier en-tête");
  });
});
