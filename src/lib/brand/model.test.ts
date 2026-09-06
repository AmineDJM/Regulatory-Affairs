import { describe, expect, it } from "vitest";
import { MARQUE_VIDE, charteDe, contraste, lireMarque, mentionsDe, normaliserHex, resumerMarque, signatairePour, texteSur, validerMarque } from "./model";

/**
 * LE REGISTRE DE MARQUE, le vocabulaire pur : une modification partielle s'applique champ par
 * champ, ce qui est invalide est REFUSÉ ET NOMMÉ, le contraste se calcule, les mentions se
 * composent depuis l'identité légale sans jamais l'inventer, et la lecture d'un JSON quelconque
 * revient à vide plutôt que d'échouer.
 */
describe("couleurs et contraste", () => {
  it("normalise les hexadécimaux, refuse le reste", () => {
    expect(normaliserHex("#0b6e4f")).toBe("0B6E4F");
    expect(normaliserHex("abc")).toBe("AABBCC");
    expect(normaliserHex("bleu")).toBeNull();
    expect(normaliserHex("#12345")).toBeNull();
  });
  it("calcule le contraste WCAG et choisit le texte lisible", () => {
    expect(contraste("000000", "FFFFFF")).toBe(21);
    expect(contraste("FFFFFF", "FFFFFF")).toBe(1);
    expect(texteSur("0B2545")).toBe("FFFFFF");
    expect(texteSur("FFEE88")).toBe("000000");
  });
  it("la charte : marque > pastille de la société > défaut, avec l'alerte quand l'accent est trop clair", () => {
    expect(charteDe(MARQUE_VIDE, "#2563eb")).toMatchObject({ accent: "2563EB", origineAccent: "societe", policeTitres: "Calibri" });
    expect(charteDe(MARQUE_VIDE, null)).toMatchObject({ accent: "0B2545", origineAccent: "defaut" });
    const { marque } = validerMarque(MARQUE_VIDE, { couleurAccent: "#0B6E4F", policeTitres: "Georgia" });
    expect(charteDe(marque, "#2563eb")).toMatchObject({ accent: "0B6E4F", origineAccent: "marque", policeTitres: "Georgia", policeTexte: "Calibri", alertes: [] });
    const pale = validerMarque(MARQUE_VIDE, { couleurAccent: "#FFEE88" }).marque;
    expect(charteDe(pale, null).alertes.join(" ")).toMatch(/trop clair/);
  });
});

describe("valider une modification", () => {
  it("applique ce qui est valide et NOMME ce qui ne l'est pas — le lot ne s'arrête pas", () => {
    const v = validerMarque(MARQUE_VIDE, {
      couleurs: { accent: "bleu", secondaire: "#1B7F79" }, polices: { texte: "Calibri", titres: "Comic Sans MS" },
      email: "pas-un-email", siteWeb: "adventum.dz", mentionsLegales: ["Société au capital de 10 000 000 DZD", "  "],
      signatures: { defaut: { nom: "Yacine Benali", qualite: "Directeur Général" }, parType: { devis: { nom: "Amel Haddad", qualite: "Directrice commerciale" }, memo: { nom: "X" } } },
    });
    expect(v.marque.couleurs).toEqual({ accent: null, secondaire: "1B7F79" });
    expect(v.marque.polices).toEqual({ titres: "Comic Sans MS", texte: "Calibri" });
    expect(v.marque.coordonnees.siteWeb).toBe("adventum.dz");
    expect(v.marque.coordonnees.email).toBeNull();
    expect(v.marque.mentionsLegales).toEqual(["Société au capital de 10 000 000 DZD"]);
    expect(v.marque.signatures.defaut).toEqual({ nom: "Yacine Benali", qualite: "Directeur Général" });
    expect(v.marque.signatures.parType.DEVIS).toEqual({ nom: "Amel Haddad", qualite: "Directrice commerciale" });
    expect(v.refus).toEqual(expect.arrayContaining([
      expect.stringMatching(/couleur accent « bleu »/), expect.stringMatching(/e-mail « pas-un-email »/),
      expect.stringMatching(/Comic Sans MS » acceptée, mais absente des polices sûres/), expect.stringMatching(/type de pièce « memo » inconnu/),
    ]));
    expect(v.champsModifies).toEqual(expect.arrayContaining(["couleur secondaire", "police des texte", "siteWeb", "mentions légales", "signataire par défaut", "signataire des devis"]));
    expect(v.marque.misAJourLe).toBeTruthy();
  });
  it("null efface, une chaîne vide efface, l'absence ne touche pas", () => {
    const base = validerMarque(MARQUE_VIDE, { couleurAccent: "#0B6E4F", telephone: "021 00 00 00", signatairesParType: { FACTURE: { nom: "A" } } }).marque;
    const v = validerMarque(base, { couleurAccent: null, telephone: "", signatairesParType: { FACTURE: null } });
    expect(v.marque.couleurs.accent).toBeNull();
    expect(v.marque.coordonnees.telephone).toBeNull();
    expect(v.marque.signatures.parType.FACTURE).toBeUndefined();
    expect(validerMarque(base, {}).marque.couleurs.accent).toBe("0B6E4F");
    expect(validerMarque(base, "n'importe quoi").refus[0]).toMatch(/objet est attendu/);
  });
  it("plus de huit mentions : les premières restent, l'excédent est dit", () => {
    const v = validerMarque(MARQUE_VIDE, { mentions: Array.from({ length: 10 }, (_, i) => `mention ${i}`).join("\n") });
    expect(v.marque.mentionsLegales).toHaveLength(8);
    expect(v.refus[0]).toMatch(/10 mentions : 8 au plus/);
  });
});

describe("lecture, mentions, signataires, résumé", () => {
  it("lit settings.marque avec tolérance — un JSON étranger revient à vide, le logo est relu tel quel", () => {
    expect(lireMarque(null)).toEqual(MARQUE_VIDE);
    expect(lireMarque({ autre: 1 })).toEqual(MARQUE_VIDE);
    const m = lireMarque({ marque: { couleurs: { accent: "0B6E4F" }, logo: { blobId: "b1", nom: "logo.png", mime: "image/png", taille: 1234, largeurCm: 3.5 }, misAJourLe: "2026-09-06T00:00:00.000Z" } });
    expect(m.couleurs.accent).toBe("0B6E4F");
    expect(m.logo).toEqual({ blobId: "b1", nom: "logo.png", mime: "image/png", taille: 1234, largeurCm: 3.5 });
    expect(m.misAJourLe).toBe("2026-09-06T00:00:00.000Z");
    expect(lireMarque({ marque: { logo: { blobId: "b2", nom: "l.png", largeurCm: 40 } } }).logo?.largeurCm).toBe(8);
  });
  it("les mentions : coordonnées choisies (sinon la carte Legal), puis les mentions libres — jamais une identité inventée", () => {
    const identite = { nom: "Adventum Pharma", adresse: "Alger", telephone: "021 11 11 11", email: "contact@adventum.dz" };
    expect(mentionsDe(MARQUE_VIDE, identite)).toEqual(["Tél. 021 11 11 11 — contact@adventum.dz"]);
    const m = validerMarque(MARQUE_VIDE, { telephone: "021 22 22 22", siteWeb: "https://adventum.dz", mentions: ["Agrément n° 42"] }).marque;
    expect(mentionsDe(m, identite)).toEqual(["Tél. 021 22 22 22 — contact@adventum.dz — adventum.dz", "Agrément n° 42"]);
    expect(mentionsDe(MARQUE_VIDE, { nom: "X" })).toEqual([]);
  });
  it("le signataire : celui du type, sinon le défaut, sinon le repli du profil", () => {
    const m = validerMarque(MARQUE_VIDE, { signataire: { nom: "DG" }, signatairesParType: { DEVIS: { nom: "Commercial", qualite: "Directeur commercial" } } }).marque;
    expect(signatairePour(m, "DEVIS", null)?.nom).toBe("Commercial");
    expect(signatairePour(m, "FACTURE", null)?.nom).toBe("DG");
    expect(signatairePour(MARQUE_VIDE, "FACTURE", { nom: "Profil", qualite: null })?.nom).toBe("Profil");
    expect(signatairePour(MARQUE_VIDE, "LETTRE", null)).toBeNull();
  });
  it("le résumé dit l'origine de l'accent, les polices, le logo, les signataires et les alertes", () => {
    const m = validerMarque(MARQUE_VIDE, { couleurAccent: "#FFEE88", signataire: { nom: "DG" } }).marque;
    const r = resumerMarque(m, charteDe(m, null));
    expect(r).toMatch(/accent FFEE88 \(registre de marque\)/);
    expect(r).toMatch(/aucun logo déposé/);
    expect(r).toMatch(/signataire DG/);
    expect(r).toMatch(/⚠/);
  });
});
