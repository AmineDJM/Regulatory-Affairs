import { describe, it, expect } from "vitest";
import {
  CHANNELS, CHANNEL_LABELS, buSetupComplete, buSetupProgress, buSetupSteps,
  channelCovers, channelLabel, estBuHospitaliere, isChannel, nextBuStep,
} from "./sfe-setup";

const vide = {
  supervisorId: null, channel: "BOTH", repCount: 0, productCount: 0,
  kamsActifs: 0, kamsSansTerritoire: [] as string[],
  referentCount: 0, referentsSansRole: 0, specialtyCount: 0,
};

describe("le montage d'une BU — l'ordre, et ce qui manque", () => {
  it("une BU neuve annonce SON étape suivante, pas une liste de reproches", () => {
    const suivante = nextBuStep(vide);
    expect(suivante?.key).toBe("SUPERVISEUR");
    expect(buSetupComplete(vide)).toBe(false);
  });

  it("l'ordre est celui du montage : superviseur → terrain → spécialités → KAM → territoires → référents → produits", () => {
    expect(buSetupSteps(vide).map((s) => s.key)).toEqual(["SUPERVISEUR", "CANAL", "SPECIALITES", "KAM", "TERRITOIRES", "REFERENTS", "PRODUITS"]);
  });

  it("LES SPÉCIALITÉS (§118.183) : au moins une — la principale n'est PAS exigée", () => {
    // Le cas qui ferait tomber une garde trop large : une BU sans aucune spécialité ne franchit pas
    // l'étape ; celui qui ferait tomber une garde trop étroite : trois spécialités sans principale la
    // franchissent — la principale sert l'affichage, elle ne restreint rien.
    const etape = (n: number) => buSetupSteps({ ...vide, supervisorId: "u1", specialtyCount: n }).find((s) => s.key === "SPECIALITES")!;
    expect(etape(0).done).toBe(false);
    expect(etape(3).done).toBe(true);
    expect(nextBuStep({ ...vide, supervisorId: "u1" })?.key).toBe("SPECIALITES");
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
      kamsActifs: 4, kamsSansTerritoire: [], referentCount: 1, referentsSansRole: 0,
      specialtyCount: 3,
    };
    expect(nextBuStep(pleine)).toBeNull();
    expect(buSetupComplete(pleine)).toBe(true);
    expect(buSetupProgress(pleine)).toEqual({ done: 7, total: 7 });
  });

  it("un référent qui NE PORTE PAS le rôle ne franchit PAS l'étape", () => {
    /*
     * LE CAS QU'UN SABOTAGE A NOMMÉ : ramener l'étape à `referentCount > 0` ne faisait tomber
     * AUCUN test, parce que tous mes décors portaient `referentsSansRole: 0` — une assertion sur
     * une conjonction ne prouve rien tant que le jeu d'essai n'exerce qu'un seul de ses termes
     * (§118.117).
     *
     * La panne qu'il couvre est silencieuse : une gamme affiche un référent, l'écran la compte
     * montée, et la personne désignée est prévenue sans pouvoir rien trancher.
     */
    const avecUnMute = { ...vide, supervisorId: "u1", referentCount: 1, referentsSansRole: 1 };
    expect(buSetupSteps(avecUnMute).find((s) => s.key === "REFERENTS")?.done).toBe(false);
    expect(buSetupSteps({ ...avecUnMute, referentsSansRole: 0 }).find((s) => s.key === "REFERENTS")?.done).toBe(true);
    // …et la RAISON dit laquelle des deux pannes on tient, jamais « incomplet » (§118.30).
    expect(buSetupSteps(avecUnMute).find((s) => s.key === "REFERENTS")?.why).toContain("ne porte pas le rôle");
    expect(buSetupSteps({ ...vide, supervisorId: "u1" }).find((s) => s.key === "REFERENTS")?.why)
      .toContain("Aucun référent");
  });

  it("la jauge compte les étapes franchies, dans l'ordre ou non", () => {
    // Le TOTAL est SEPT depuis que les spécialités d'une BU se choisissent ici (§118.183), après les
    // référents Direction Marketing (§118.144).
    expect(buSetupProgress(vide)).toEqual({ done: 1, total: 7 });
    expect(buSetupProgress({ ...vide, productCount: 5 })).toEqual({ done: 2, total: 7 });
  });
});

/**
 * LES TERRITOIRES DES KAM (04/10/2026) — dans une BU hospitalière, chacun choisit sur sa ligne les
 * établissements qu'il couvre. Le cas qui ferait tomber chaque assertion est nommé à côté d'elle.
 */
describe("les territoires des KAM — un KAM sans territoire a un panel VIDE", () => {
  // Une BU AU STADE des territoires : supervisée, avec ses spécialités (§118.183) et ses produits.
  const bu = (o: Partial<typeof vide>) => ({ ...vide, supervisorId: "u1", productCount: 2, specialtyCount: 1, channel: "HOSPITAL", ...o });
  const etape = (o: Partial<typeof vide>) => buSetupSteps(bu(o)).find((s) => s.key === "TERRITOIRES")!;

  it("une BU hospitalière, ou « les deux » — jamais une BU de ville, ni une valeur inconnue", () => {
    expect(estBuHospitaliere("HOSPITAL")).toBe(true);
    expect(estBuHospitaliere("BOTH")).toBe(true);
    expect(estBuHospitaliere("RETAIL")).toBe(false);
    expect(estBuHospitaliere("AUTRE")).toBe(false);
  });

  it("des KAM actifs SANS territoire : l'étape n'est pas franchie, et la raison les NOMME", () => {
    const e = etape({ repCount: 3, kamsActifs: 3, kamsSansTerritoire: ["Leila Sahridj", "Amel Haddad"] });
    expect(e.done).toBe(false);
    expect(e.why).toContain("Leila Sahridj, Amel Haddad");
    expect(e.why).toContain("« Territoire »");
    expect(e.label).toBe("Choisir les territoires des KAM");
  });

  it("au-delà de trois noms, la raison COMPTE le reste au lieu de l'avaler", () => {
    const e = etape({ repCount: 5, kamsActifs: 5, kamsSansTerritoire: ["A", "B", "C", "D", "E"] });
    expect(e.why).toContain("A, B, C et 2 autre(s)");
  });

  it("tous les KAM actifs ont un territoire : l'étape est franchie — « les deux » compris", () => {
    expect(etape({ repCount: 2, kamsActifs: 2 }).done).toBe(true);
    expect(etape({ repCount: 2, kamsActifs: 2, channel: "BOTH" }).done).toBe(true);
    expect(etape({ repCount: 2, kamsActifs: 2, channel: "BOTH", kamsSansTerritoire: ["X"] }).done).toBe(false);
  });

  it("aucun KAM ACTIF n'a rien de couvert — la jauge ne s'en félicite pas", () => {
    // Sans `kamsActifs > 0`, une liste « sans territoire » VIDE franchirait l'étape sur une BU vide.
    expect(etape({ repCount: 0 }).done).toBe(false);
    expect(etape({ repCount: 2, kamsActifs: 0 }).done).toBe(false);
    expect(nextBuStep(bu({ repCount: 0 }))?.key).toBe("KAM");
  });

  it("une BU DE VILLE n'exige pas de territoire, et sa raison le DIT", () => {
    const e = etape({ channel: "RETAIL", repCount: 2, kamsActifs: 2, kamsSansTerritoire: ["X", "Y"] });
    expect(e.done).toBe(true);
    expect(e.why).toContain("n'est pas exigée");
  });

  it("le territoire devient l'étape réclamée dès que les KAM sont là", () => {
    expect(nextBuStep(bu({ repCount: 3, kamsActifs: 3, kamsSansTerritoire: ["X"] }))?.key).toBe("TERRITOIRES");
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
