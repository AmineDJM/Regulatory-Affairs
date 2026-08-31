import { describe, it, expect } from "vitest";
import {
  CHANNELS, CHANNEL_LABELS, buSetupComplete, buSetupProgress, buSetupSteps,
  channelCovers, channelLabel, isChannel, nextBuStep,
} from "./sfe-setup";

const vide = { supervisorId: null, channel: "BOTH", repCount: 0, productCount: 0 };

describe("le montage d'une BU — l'ordre, et ce qui manque", () => {
  it("une BU neuve annonce SON étape suivante, pas une liste de reproches", () => {
    const suivante = nextBuStep(vide);
    expect(suivante?.key).toBe("SUPERVISEUR");
    expect(buSetupComplete(vide)).toBe(false);
  });

  it("l'ordre est celui du montage : superviseur → terrain → KAM → produits", () => {
    expect(buSetupSteps(vide).map((s) => s.key)).toEqual(["SUPERVISEUR", "CANAL", "KAM", "PRODUITS"]);
  });

  it("chaque étape dit CE QU'ON PERD tant qu'elle manque — jamais « obligatoire »", () => {
    for (const s of buSetupSteps(vide)) {
      expect(s.why.length, s.key).toBeGreaterThan(30);
      expect(s.why.toLowerCase()).not.toContain("obligatoire");
      // Le libellé est un geste, pas un constat.
      expect(s.label).toMatch(/^(Désigner|Choisir|Rattacher|Ajouter)/);
    }
  });

  it("LE CANAL NE BLOQUE PAS — il a un défaut qui n'exclut rien, on veut juste le voir", () => {
    expect(buSetupSteps(vide).find((s) => s.key === "CANAL")?.done).toBe(true);
    const sansSuperviseur = nextBuStep({ ...vide, repCount: 3, productCount: 2 });
    expect(sansSuperviseur?.key).toBe("SUPERVISEUR");
  });

  it("une BU complète ne réclame plus rien", () => {
    const pleine = { supervisorId: "u1", channel: "HOSPITAL", repCount: 4, productCount: 3 };
    expect(nextBuStep(pleine)).toBeNull();
    expect(buSetupComplete(pleine)).toBe(true);
    expect(buSetupProgress(pleine)).toEqual({ done: 4, total: 4 });
  });

  it("la jauge compte les étapes franchies, dans l'ordre ou non", () => {
    expect(buSetupProgress(vide)).toEqual({ done: 1, total: 4 });
    expect(buSetupProgress({ ...vide, productCount: 5 })).toEqual({ done: 2, total: 4 });
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
