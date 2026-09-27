import { describe, expect, it } from "vitest";
import {
  centreDeLOrigine, etatDepuisValidation, etatDepuisVisa, etatDepuisPoste,
  blocageParLeBC, reserveBC, reserveSansPorte, gesteAiguillage, chantierBCClos,
  type PorteBC,
} from "./regle";

/**
 * LA RÈGLE DES BONS DE COMMANDE, PURE (§118.148).
 *
 * « Concernant les BC, ils doivent tous passer soit par le centre de validation Ad&Pro si la
 * demande est depuis Ad&Pro, soit par le centre de validation normal. » Chaque cas nomme le
 * défaut qu'il ferait tomber : une assertion dont on ne sait pas nommer le cas qui la ferait
 * échouer n'en est pas une (§118.17).
 */

const AD_PRO = new Set(["SPONSORING", "EVENT", "CONGRESS_NATIONAL", "AD_PRO_ITEM"]);
const porte = (p: Partial<PorteBC>): PorteBC => ({ centre: "VALIDATION", etat: "EN_ATTENTE", source: "DOCUMENT", note: null, ...p });

describe("centreDeLOrigine — quel centre ?", () => {
  it("un BC sans origine va au centre de validations", () => {
    expect(centreDeLOrigine([], AD_PRO)).toBe("VALIDATION");
  });
  it("un maillon Ad & Pro suffit, même au bout d'un chemin qui transite par le secrétariat", () => {
    expect(centreDeLOrigine(["DOCUMENT_REQUEST", "AD_PRO_ITEM"], AD_PRO)).toBe("AD_PRO");
    expect(centreDeLOrigine(["PAYMENT_REQUEST", "EXPENSE_ORDER", "SPONSORING"], AD_PRO)).toBe("AD_PRO");
  });
  it("un chemin sans aucun maillon Ad & Pro reste au centre de validations", () => {
    expect(centreDeLOrigine(["DOCUMENT_REQUEST", "ADMIN_REQUEST", "PCH_ORDER"], AD_PRO)).toBe("VALIDATION");
  });
});

describe("lecture des états", () => {
  it("une validation RETIRÉE ne dit plus rien — ni validée, ni en attente", () => {
    expect(etatDepuisValidation("CANCELLED")).toBeNull();
    expect(etatDepuisValidation("PENDING")).toBe("EN_ATTENTE");
    expect(etatDepuisValidation("APPROVED")).toBe("VALIDE");
    expect(etatDepuisValidation("REJECTED")).toBe("REFUSE");
    expect(etatDepuisValidation("CHANGES_REQUESTED")).toBe("A_REVOIR");
  });
  it("un visa d'état inconnu ATTEND — le sens sûr, jamais « validé »", () => {
    expect(etatDepuisVisa("APPROVED")).toBe("VALIDE");
    expect(etatDepuisVisa("REFUSED")).toBe("REFUSE");
    expect(etatDepuisVisa("PENDING")).toBe("EN_ATTENTE");
    expect(etatDepuisVisa("QUELQUE_CHOSE")).toBe("EN_ATTENTE");
  });
  it("le poste : un BC émis a forcément été validé ; « aucun BC demandé » n'est pas une porte", () => {
    expect(etatDepuisPoste("NONE")).toBeNull();
    expect(etatDepuisPoste("REQUESTED")).toBe("EN_ATTENTE");
    expect(etatDepuisPoste("DIRECTION_OK")).toBe("VALIDE");
    expect(etatDepuisPoste("ISSUED")).toBe("VALIDE");
    expect(etatDepuisPoste("REFUSED")).toBe("REFUSE");
  });
});

describe("blocageParLeBC — la facture qui découle d'un BC non validé ne part pas au règlement", () => {
  it("un BC sans porte (antérieur à la règle) ne bloque RIEN — sinon tout le registre gèlerait", () => {
    expect(blocageParLeBC(null, "BC-1")).toBeNull();
  });
  it("un BC validé ne bloque rien", () => {
    expect(blocageParLeBC(porte({ etat: "VALIDE" }), "BC-1")).toBeNull();
  });
  it("en attente : le refus NOMME le BC et le centre", () => {
    const r = blocageParLeBC(porte({ centre: "AD_PRO" }), "BC-2026-012");
    expect(r).toContain("BC-2026-012");
    expect(r).toContain("centre de validation Ad & Pro");
  });
  it("à revoir : le motif du centre voyage dans le refus", () => {
    expect(blocageParLeBC(porte({ etat: "A_REVOIR", note: "prix unitaire faux" }), "BC-3")).toContain("prix unitaire faux");
  });
  it("refusé : la facture ne part pas, et la phrase le dit", () => {
    expect(blocageParLeBC(porte({ etat: "REFUSE" }), null)).toMatch(/refusé/);
  });
});

describe("reserveBC — la phrase qui annonce un BC ne le fait pas passer pour validé (§118.32)", () => {
  it("se tait sur un BC validé ou sans porte — une réserve permanente cesse d'être lue", () => {
    expect(reserveBC(null)).toBeNull();
    expect(reserveBC(porte({ etat: "VALIDE" }))).toBeNull();
  });
  it("en attente : ne pas l'envoyer au fournisseur, en nommant le centre", () => {
    const r = reserveBC(porte({ centre: "VALIDATION" }));
    expect(r).toMatch(/ne l'envoyez pas au fournisseur/);
    expect(r).toContain("centre de validations");
  });
});

/**
 * UN BC SANS PORTE LE DIT, ET DIT POURQUOI (§118.148). Deux causes, deux gestes : personne ne siège
 * (il faut un Super Admin), ou l'écriture a échoué (on rattrape d'un clic). La fabrique et les
 * actions Legal portaient deux rédactions de la première et aucune de la seconde.
 */
describe("reserveSansPorte — l'aiguillage qui n'a rien posé ne se tait pas", () => {
  it("aucun siège : ce n'est PAS validé, et il faut un Super Admin", () => {
    const r = reserveSansPorte({ sansSiege: true });
    expect(r).toMatch(/n'est PAS validé/);
    expect(r).toMatch(/Super Admin/);
  });
  it("un échec : ce n'est PAS validé, et le rattrapage est nommé", () => {
    const r = reserveSansPorte({ enEchec: true });
    expect(r).toMatch(/erreur technique/);
    expect(r).toMatch(/n'est PAS validé/);
    expect(r).toMatch(/« Adresser au centre »/);
  });
  it("une porte a été posée : rien à dire ici — c'est `reserveBC` qui parle", () => {
    expect(reserveSansPorte({})).toBeNull();
    expect(reserveSansPorte({ sansSiege: false, enEchec: false })).toBeNull();
  });
});

describe("gesteAiguillage — que faire de la porte quand le BC change ?", () => {
  it("aucune porte → la POSER", () => {
    expect(gesteAiguillage({ actuelle: null, centreVoulu: "VALIDATION" })).toEqual({ geste: "POSER" });
  });
  it("porte du POSTE → RIEN : poser une seconde porte ferait valider deux fois le même engagement", () => {
    expect(gesteAiguillage({ actuelle: porte({ centre: "AD_PRO", source: "POSTE" }), centreVoulu: "AD_PRO" })).toEqual({ geste: "RIEN" });
  });
  it("en attente dans l'AUTRE centre → TRANSFÉRER (rattaché à une fiche Ad & Pro après coup)", () => {
    expect(gesteAiguillage({ actuelle: porte({ centre: "VALIDATION" }), centreVoulu: "AD_PRO" })).toEqual({ geste: "TRANSFERER" });
  });
  it("en attente, montant changé par la personne → ACTUALISER ; relu sans modification → RIEN", () => {
    expect(gesteAiguillage({ actuelle: porte({}), centreVoulu: "VALIDATION", montantAvant: 100, montantApres: 120, modifie: true })).toEqual({ geste: "ACTUALISER" });
    expect(gesteAiguillage({ actuelle: porte({}), centreVoulu: "VALIDATION", montantAvant: 100, montantApres: 120 })).toEqual({ geste: "RIEN" });
  });
  it("VALIDÉ puis RELEVÉ → ROUVRIR, en disant de combien (§118.16)", () => {
    const g = gesteAiguillage({ actuelle: porte({ etat: "VALIDE" }), centreVoulu: "VALIDATION", montantAvant: 100_000, montantApres: 150_000, modifie: true });
    expect(g.geste).toBe("ROUVRIR");
    expect(g.geste === "ROUVRIR" ? g.motif : "").toContain("100");
  });
  it("VALIDÉ puis BAISSÉ → RIEN : un geste qui réduit ne rouvre rien", () => {
    expect(gesteAiguillage({ actuelle: porte({ etat: "VALIDE" }), centreVoulu: "VALIDATION", montantAvant: 150, montantApres: 100, modifie: true })).toEqual({ geste: "RIEN" });
  });
  it("VALIDÉ sur un montant d'abord INCONNU qu'on renseigne → RIEN : la saisie recopie la pièce validée", () => {
    expect(gesteAiguillage({ actuelle: porte({ etat: "VALIDE" }), centreVoulu: "VALIDATION", montantAvant: null, montantApres: 100, modifie: true })).toEqual({ geste: "RIEN" });
  });
  it("À REVOIR puis modifié → ROUVRIR (c'est la resoumission demandée) ; relu seulement → RIEN", () => {
    expect(gesteAiguillage({ actuelle: porte({ etat: "A_REVOIR" }), centreVoulu: "VALIDATION", modifie: true }).geste).toBe("ROUVRIR");
    expect(gesteAiguillage({ actuelle: porte({ etat: "A_REVOIR" }), centreVoulu: "VALIDATION" })).toEqual({ geste: "RIEN" });
  });
  it("REFUSÉ → RIEN, même retouché, même rattaché ailleurs : un refus ne se contourne pas", () => {
    expect(gesteAiguillage({ actuelle: porte({ etat: "REFUSE" }), centreVoulu: "AD_PRO", montantAvant: 10, montantApres: 99, modifie: true })).toEqual({ geste: "RIEN" });
  });
  it("une décision prise n'est jamais DÉPLACÉE d'un centre à l'autre", () => {
    expect(gesteAiguillage({ actuelle: porte({ etat: "VALIDE", centre: "VALIDATION" }), centreVoulu: "AD_PRO" })).toEqual({ geste: "RIEN" });
  });
});

describe("chantierBCClos — le chantier « bon de commande » ne se clôt plus d'un clic", () => {
  it("sans BC : refus qui nomme le geste qui en enregistre un", () => {
    const r = chantierBCClos([]);
    expect(r.ok).toBe(false);
    expect(r.ok ? "" : r.raison).toContain("Pièces liées");
  });
  it("un BC jamais vu par un centre : refus qui nomme « Adresser au centre »", () => {
    const r = chantierBCClos([{ reference: "BC-9", porte: null }]);
    expect(r.ok).toBe(false);
    expect(r.ok ? "" : r.raison).toMatch(/Adressez-le au centre/);
  });
  it("UN seul BC encore en attente tient le chantier ouvert — « deux sur trois » n'est pas fait", () => {
    const r = chantierBCClos([
      { reference: "BC-1", porte: porte({ etat: "VALIDE" }) },
      { reference: "BC-2", porte: porte({ etat: "EN_ATTENTE" }) },
    ]);
    expect(r.ok).toBe(false);
    expect(r.ok ? "" : r.raison).toContain("BC-2");
    expect(r.ok ? "" : r.raison).not.toContain("BC-1");
  });
  it("tous validés → le chantier se clôt", () => {
    expect(chantierBCClos([{ reference: "BC-1", porte: porte({ etat: "VALIDE" }) }]).ok).toBe(true);
  });
});
