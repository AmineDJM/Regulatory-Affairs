import { describe, it, expect } from "vitest";
import { identiteEmetteurDuTexte, fusionnerIdentite, identiteUtilisable, IDENTITE_VIDE } from "./emetteur";

// Le texte natif du devis réel qui refusait de générer son bon de commande (Direction, 06/10), tel que le PDF le rend.
const DEVIS_HOTEL = "\n\na\nFacture proforma \nAdresse: \nRue de l'ALN, Sétif 19000, Algérie \nTel: \n036 81 41 41 (42)\nRaison sociale:\n SPA PROMBATI HOTEL\nFax: \n036 81 41 00\nNIF:\n 00081900878679319002\nEmail: \nreservation@parkmallhotel.com\nRIB N°: \n00400364400003094607\nSite Web: \nwww.parkmallhotel.com\nN° du Registre de commerce: \n08B0087867-19/02\nProforma N°: mbouh606Client: SARL ADVENTUM PHARMA\nDate: 07/09/2026Tel:\nSponsoring \nQTE\nPrix unitaire \nNJ\nMontant TTC\nDéjeuner Lunch Box10030001DZD 300,000.00 \nPause café10010001\nDZD 100,000.00 \nTotal évènement TTC\nDZD 400,000.00 \nGRAND TOTAL  \n400,000.00 DZD\n";

describe("l'identité de l'émetteur est RECOPIÉE du papier", () => {
  it("le devis de l'hôtel : nom, adresse, NIF, RC, RIB, téléphone et e-mail, valeurs sur la ligne suivante", () => {
    const id = identiteEmetteurDuTexte(DEVIS_HOTEL);
    expect(id.nom).toBe("SPA PROMBATI HOTEL");
    expect(id.adresse).toBe("Rue de l'ALN, Sétif 19000, Algérie");
    expect(id.nif).toBe("00081900878679319002");
    expect(id.rc).toBe("08B0087867-19/02");
    expect(id.rib).toBe("00400364400003094607");
    expect(id.telephone).toBe("036 81 41 41 (42)");
    expect(id.email).toBe("reservation@parkmallhotel.com");
    expect(identiteUtilisable(id)).toBe(true);
  });

  it("valeurs sur la même ligne, accents et majuscules indifférents", () => {
    const id = identiteEmetteurDuTexte("RAISON SOCIALE : Imprimerie El Djazair SARL\nAdresse : 12 rue Didouche, Alger\nN.I.F : 000 116 001 234 567\nR.C : 16/00-1234567B12\nTél : 021 23 45 67");
    expect(id).toMatchObject({ nom: "Imprimerie El Djazair SARL", adresse: "12 rue Didouche, Alger", nif: "000116001234567", rc: "16/00-1234567B12", telephone: "021 23 45 67" });
  });

  it("rien n'est deviné : sans étiquette, le champ reste vide ; le client n'est jamais pris pour l'émetteur", () => {
    expect(identiteEmetteurDuTexte("Bonjour\nVoici notre offre")).toEqual(IDENTITE_VIDE);
    const id = identiteEmetteurDuTexte("Client : SARL ADVENTUM PHARMA\nAdresse de livraison : Alger");
    expect(id.nom).toBeNull();
    expect(id.adresse).toBeNull();
  });

  it("une étiquette sans valeur ne prend pas l'étiquette suivante pour valeur", () => {
    const id = identiteEmetteurDuTexte("Adresse:\nTel:\n0555 12 34 56");
    expect(id.adresse).toBeNull();
    expect(id.telephone).toBe("0555 12 34 56");
  });

  it("un NIF ou un RIB trop courts ne sont pas des identifiants", () => {
    const id = identiteEmetteurDuTexte("NIF: 1234\nRIB: 12");
    expect(id.nif).toBeNull();
    expect(id.rib).toBeNull();
  });

  it("le papier l'emporte, le modèle complète", () => {
    const f = fusionnerIdentite({ ...IDENTITE_VIDE, nom: "Papier" }, { nom: "Modèle", nif: "000116001234567" });
    expect(f.nom).toBe("Papier");
    expect(f.nif).toBe("000116001234567");
    expect(identiteUtilisable(fusionnerIdentite(IDENTITE_VIDE, null))).toBe(false);
  });
});
