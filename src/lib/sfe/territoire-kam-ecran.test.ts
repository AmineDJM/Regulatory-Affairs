import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { kamsSansTerritoire, nomDuTerritoire } from "./territoire-kam";
import { diagnosticPanelVide } from "./panel-diagnostic";
import { choixDepuisLiens, etablissementsSansService, remplirFormulaire } from "@/app/(app)/business-units/choix-etablissements";

/**
 * LE TERRITOIRE D'UN KAM À L'ÉCRAN (04/10/2026) — les règles pures que l'écran lit, et les POINTS
 * D'APPEL (§118.49) : vérifier une règle sans son appelant ne prouverait rien, et ces écrans sont
 * des composants client qu'aucun banc unitaire ne rend.
 */

const lire = (p: string) => readFileSync(path.join(process.cwd(), p), "utf8")
  .split("\n").filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*") && !l.trim().startsWith("/*")).join("\n");

describe("les KAM sans territoire — ce que l'étape de montage nomme", () => {
  const kams = [
    { repId: "a", name: "Amel", isActive: true },
    { repId: "b", name: "Bilal", isActive: true },
    { repId: "c", name: "Chérif", isActive: false },
    { repId: "d", name: "Dalila", isActive: true },
  ];
  it("un territoire SANS établissement compte pour rien ; un KAM INACTIF ne bloque pas", () => {
    expect(kamsSansTerritoire(kams, [{ repId: "a", etablissements: 2 }, { repId: "b", etablissements: 0 }])).toEqual(["Bilal", "Dalila"]);
  });
  it("le nom d'un territoire, nu ou suffixé de la fin de l'identifiant", () => {
    expect(nomDuTerritoire(" Leila Sahridj ", "cuid123456", false)).toBe("Territoire — Leila Sahridj");
    expect(nomDuTerritoire("Leila Sahridj", "cuid123456", true)).toBe("Territoire — Leila Sahridj · 123456");
    expect(nomDuTerritoire(null, "x", false)).toBe("Territoire — KAM");
  });
});

describe("le formulaire du territoire — la sélection COMPLÈTE et sa couverture", () => {
  it("chaque établissement coché part ; seuls les restreints portent une couverture", () => {
    const choix = choixDepuisLiens([
      { institutionId: "chu", tousLesServices: true, serviceIds: [] },
      { institutionId: "eph", tousLesServices: false, serviceIds: ["cardio"] },
    ]);
    const f = new FormData();
    f.append("institutionIds", "ancien");
    remplirFormulaire(f, choix);
    expect(f.getAll("institutionIds")).toEqual(["chu", "eph"]);
    expect(JSON.parse(String(f.get("couverture")))).toEqual({ eph: ["cardio"] });
  });
  it("un établissement restreint SANS service est signalé — l'action le refuserait", () => {
    const choix = choixDepuisLiens([{ institutionId: "eph", tousLesServices: false, serviceIds: [] }]);
    expect(etablissementsSansService(choix)).toEqual(["eph"]);
  });
});

describe("un panel vide dit sa cause — l'ordre où elle se répare", () => {
  const base = { bu: "Onco", secteurs: [], praticiensRattaches: 0, horsServicesChoisis: 0, praticiensEnTexte: 0 };
  it("une BU absente passe avant tout", () => {
    expect(diagnosticPanelVide({ ...base, bu: null, secteurTexte: "Est" }).cause).toBe("SANS_BU");
  });
  it("un secteur actif dans SA BU masque un secteur d'une autre BU", () => {
    const s = { nom: "x", bu: "Onco", dansSaBu: true, actif: true, etablissements: 1 };
    expect(diagnosticPanelVide({ ...base, secteurs: [s, { ...s, bu: "Cardio", dansSaBu: false }] }).cause).toBe("AUCUN_PRATICIEN");
  });
});

describe("les points d'appel — ce que l'écran montre est ce que le panel lit", () => {
  it("l'écran BU n'a plus de section « Secteurs de la BU », et la ligne du KAM porte son territoire", () => {
    // LE MONTAGE EST DÉCOUPÉ EN ÉTAPES (07/10) : la ligne du KAM vit à l'étape « KAM », son territoire à l'étape
    // « Secteurs » — les deux dans `bu-etapes.tsx`, montées par `bu-manager.tsx`.
    const bu = lire("src/app/(app)/business-units/bu-manager.tsx") + lire("src/app/(app)/business-units/bu-etapes.tsx");
    expect(bu).not.toMatch(/Secteurs de la BU/);
    expect(bu).not.toMatch(/createSector|updateSector|deleteSector/);
    // Le texte « Secteur » ne se montre ni ne repart dans une BU hospitalière.
    expect(bu).toMatch(/\{!hospitaliere && \(\s*<input[^>]*placeholder="Secteur"/);
    expect(bu).toMatch(/if \(!hospitaliere\) fd\.set\("region"/);
    // Le territoire ne se choisit que dans une BU hospitalière ; une BU de ville renvoie au texte de la ligne.
    expect(bu).toMatch(/!hospitaliere \? <p[^>]*>BU de ville/);
    expect(bu).toMatch(/<TerritoireKam buId=\{bu\.id\} kam=\{k\}/);
    const page = lire("src/app/(app)/business-units/montage.tsx");
    expect(page).toMatch(/repId: \{ not: null \}, isActive: true/);
  });
  it("le panneau du territoire envoie la sélection par `remplirFormulaire` à l'action du territoire", () => {
    const t = lire("src/app/(app)/business-units/territoire-kam.tsx");
    expect(t).toMatch(/remplirFormulaire\(fd, choix\)/);
    expect(t).toMatch(/run\(enregistrerTerritoireKam, fd\)/);
  });
  it("le plan de tournée affiche la VRAIE cause d'un panel vide", () => {
    const page = lire("src/app/(app)/medical/plan-de-tournee/page.tsx");
    expect(page).toMatch(/diagnostiquerPanelVide\(plan\.repId\)/);
    expect(page).toMatch(/panelVide=\{panelVide\}/);
    const ecran = lire("src/app/(app)/medical/plan-de-tournee/planificateur.tsx");
    expect(ecran).toMatch(/\{panelVide \?\?/);
  });
});
