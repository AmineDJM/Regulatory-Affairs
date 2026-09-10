import { describe, it, expect } from "vitest";
import {
  CHANNELS, CHANNEL_LABELS, buSetupComplete, buSetupProgress, buSetupSteps,
  channelCovers, channelLabel, isChannel, nextBuStep,
} from "./sfe-setup";

const vide = {
  supervisorId: null, channel: "BOTH", repCount: 0, productCount: 0,
  sectorCount: 0, sectorsWithoutInstitution: 0, repsWithSector: 0,
};

describe("le montage d'une BU — l'ordre, et ce qui manque", () => {
  it("une BU neuve annonce SON étape suivante, pas une liste de reproches", () => {
    const suivante = nextBuStep(vide);
    expect(suivante?.key).toBe("SUPERVISEUR");
    expect(buSetupComplete(vide)).toBe(false);
  });

  it("l'ordre est celui du montage : superviseur → terrain → KAM → secteurs → produits", () => {
    expect(buSetupSteps(vide).map((s) => s.key)).toEqual(["SUPERVISEUR", "CANAL", "KAM", "SECTEURS", "PRODUITS"]);
  });

  it("chaque étape dit CE QU'ON PERD tant qu'elle manque — jamais « obligatoire »", () => {
    for (const s of buSetupSteps(vide)) {
      expect(s.why.length, s.key).toBeGreaterThan(30);
      expect(s.why.toLowerCase()).not.toContain("obligatoire");
      // Le libellé est un geste, pas un constat.
      expect(s.label).toMatch(/^(Désigner|Choisir|Rattacher|Découper|Ajouter)/);
    }
  });

  it("LE CANAL NE BLOQUE PAS — il a un défaut qui n'exclut rien, on veut juste le voir", () => {
    expect(buSetupSteps(vide).find((s) => s.key === "CANAL")?.done).toBe(true);
    const sansSuperviseur = nextBuStep({ ...vide, repCount: 3, productCount: 2 });
    expect(sansSuperviseur?.key).toBe("SUPERVISEUR");
  });

  it("une BU complète ne réclame plus rien", () => {
    const pleine = {
      supervisorId: "u1", channel: "HOSPITAL", repCount: 4, productCount: 3,
      sectorCount: 2, sectorsWithoutInstitution: 0, repsWithSector: 4,
    };
    expect(nextBuStep(pleine)).toBeNull();
    expect(buSetupComplete(pleine)).toBe(true);
    expect(buSetupProgress(pleine)).toEqual({ done: 5, total: 5 });
  });

  it("la jauge compte les étapes franchies, dans l'ordre ou non", () => {
    expect(buSetupProgress(vide)).toEqual({ done: 1, total: 5 });
    expect(buSetupProgress({ ...vide, productCount: 5 })).toEqual({ done: 2, total: 5 });
  });
});

/**
 * LES SECTEURS — trois pannes distinctes derrière « la BU a des secteurs », et le cas qui
 * ferait tomber chaque assertion est nommé à côté d'elle.
 */
describe("les secteurs d'une BU — un KAM sans territoire a un panel VIDE", () => {
  const secteur = (o: Partial<typeof vide>) => ({ ...vide, supervisorId: "u1", productCount: 2, ...o });
  const etape = (o: Partial<typeof vide>) => buSetupSteps(secteur(o)).find((s) => s.key === "SECTEURS")!;

  it("aucun secteur : l'étape n'est pas franchie, et la raison le DIT", () => {
    const e = etape({ repCount: 3 });
    expect(e.done).toBe(false);
    expect(e.why).toContain("panel est vide");
  });

  it("UN SECTEUR VIDE compte pour rien — un nom de territoire sans territoire", () => {
    // Ce cas est celui qui ferait passer une garde écrite « sectorCount > 0 » : deux secteurs
    // existent, l'un ne contient aucun établissement, et le KAM qu'on y affecte ne voit rien.
    const e = etape({ repCount: 2, sectorCount: 2, sectorsWithoutInstitution: 1, repsWithSector: 2 });
    expect(e.done).toBe(false);
    expect(e.why).toContain("1 secteur ne contient aucun établissement");
  });

  it("UN KAM SANS SECTEUR fait tomber l'étape, même si la BU a des secteurs pleins", () => {
    // Le cas qui trompe : la BU a l'air montée, quatre personnes ne voient aucun médecin.
    const e = etape({ repCount: 5, sectorCount: 1, sectorsWithoutInstitution: 0, repsWithSector: 1 });
    expect(e.done).toBe(false);
    expect(e.why).toContain("4 KAM sur 5");
  });

  it("tous les KAM couverts par des secteurs pleins : l'étape est franchie", () => {
    const e = etape({ repCount: 2, sectorCount: 1, sectorsWithoutInstitution: 0, repsWithSector: 2 });
    expect(e.done).toBe(true);
  });

  it("une BU SANS KAM n'a rien de couvert — la jauge ne s'en félicite pas", () => {
    // Sans cette ligne, `sectorsWithoutInstitution === 0 && repsWithSector >= repCount` serait
    // VRAI sur une BU vide (0 >= 0), et la jauge annoncerait un territoire couvert qui n'existe
    // pas. L'étape KAM reste celle qu'on réclame.
    expect(etape({ repCount: 0 }).done).toBe(false);
    expect(nextBuStep(secteur({ repCount: 0 }))?.key).toBe("KAM");
  });

  it("le secteur devient l'étape réclamée dès que les KAM sont là", () => {
    expect(nextBuStep(secteur({ repCount: 3 }))?.key).toBe("SECTEURS");
  });
});

describe("le terrain d'une BU couvre — ou ne couvre pas — celui d'un produit", () => {
  it("« les deux » couvre tout", () => {
    expect(channelCovers("BOTH", "RETAIL")).toBe(true);
    expect(channelCovers("BOTH", "HOSPITAL")).toBe(true);
    expect(channelCovers("BOTH", "BOTH")).toBe(true);
  });

  it("une BU de ville ne couvre PAS un produit hospitalier — ni un produit « les deux »", () => {
    expect(channelCovers("RETAIL", "HOSPITAL")).toBe(false);
    // Le piège : la moitié hospitalière du produit ne serait promue par personne.
    expect(channelCovers("RETAIL", "BOTH")).toBe(false);
    expect(channelCovers("RETAIL", "RETAIL")).toBe(true);
  });

  it("une valeur inconnue ne déclenche pas une fausse alerte", () => {
    expect(channelCovers("AUTRE", "RETAIL")).toBe(true);
    expect(channelCovers("RETAIL", "AUTRE")).toBe(true);
  });

  it("chaque canal porte un libellé français, et « les deux » vient en premier", () => {
    expect(CHANNELS[0]).toBe("BOTH");
    for (const c of CHANNELS) expect(CHANNEL_LABELS[c].length).toBeGreaterThan(0);
    expect(channelLabel("HOSPITAL")).toBe("Hospitalière");
    expect(channelLabel("RETAIL")).toBe("Gamme de ville");
    // Un code inconnu se rend tel quel plutôt que de devenir « — ».
    expect(channelLabel("INCONNU")).toBe("INCONNU");
    expect(isChannel("BOTH")).toBe(true);
    expect(isChannel("INCONNU")).toBe(false);
  });
});
