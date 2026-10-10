import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { lienLigneCentreAdPro, ancreLigneCentre, CHEMIN_CENTRE_AD_PRO } from "./ad-pro";
import { lienBonDeCommande, ancreBonDeCommande, CHEMIN_BONS_DE_COMMANDE } from "./bons-de-commande";
import { lienFormation, ancreFormation, CHEMIN_FORMATIONS } from "./formations";
import {
  lienRemiseCaisse, lienRallongeCaisse, lienCaisseAvance, ancreRemise, ancreRallonge, ANCRE_CAISSE_AVANCE, CHEMIN_MOYENS_GENERAUX,
} from "./moyens-generaux";
import { lienDemandeBudgetDepartement, lienCibleEnveloppe, ancreCategorieBudget, ancreDemandeBudget } from "./budgets";
import { lienRapportsDeDelegue } from "./rapports-terrain";
import { reécriteLienNotification } from "@/lib/notifications/lien-actuel";

/**
 * LES NOTIFICATIONS ARRIVENT SUR LA LIGNE — pas seulement sur l'écran. Chaque écran qui n'ouvrait pas
 * l'objet exact lit un paramètre d'adresse et pose l'ancre sur la ligne visée ; l'adresse et l'ancre
 * se calculent au même endroit (`chemins/*`), et ce banc vérifie les deux bouts.
 */

describe("les adresses ouvrent l'objet exact", () => {
  it("Centre Ad & Pro : ?ligne=<id>, sans id l'écran entier", () => {
    expect(lienLigneCentreAdPro("abc")).toBe(`${CHEMIN_CENTRE_AD_PRO}?ligne=abc`);
    expect(lienLigneCentreAdPro(null)).toBe(CHEMIN_CENTRE_AD_PRO);
  });
  it("Bons de commande : ?bc=<id>", () => {
    expect(lienBonDeCommande("doc1")).toBe(`${CHEMIN_BONS_DE_COMMANDE}?bc=doc1`);
    expect(lienBonDeCommande(undefined)).toBe(CHEMIN_BONS_DE_COMMANDE);
  });
  it("Formations : ?formation=<id>", () => {
    expect(lienFormation("t1")).toBe(`${CHEMIN_FORMATIONS}?formation=t1`);
    expect(lienFormation()).toBe(CHEMIN_FORMATIONS);
  });
  it("Moyens généraux : la remise, la rallonge, ou à défaut la caisse d'avance", () => {
    expect(lienRemiseCaisse("r1")).toBe(`${CHEMIN_MOYENS_GENERAUX}?cible=${ancreRemise("r1")}`);
    expect(lienRallongeCaisse("t1")).toBe(`${CHEMIN_MOYENS_GENERAUX}?cible=${ancreRallonge("t1")}`);
    expect(lienRemiseCaisse(null)).toBe(lienCaisseAvance());
    expect(lienCaisseAvance()).toBe(`${CHEMIN_MOYENS_GENERAUX}?cible=${ANCRE_CAISSE_AVANCE}`);
  });
  it("Rapports terrain : ?delegue=<compte> pour « Voir ses rapports »", () => {
    expect(lienRapportsDeDelegue("u1")).toBe("/medical/rapports?delegue=u1");
  });
  it("Budgets : la demande de dotation (avec son exercice) et la catégorie d'une enveloppe", () => {
    expect(lienDemandeBudgetDepartement("q1", 2026)).toBe("/budgets/departements?year=2026&demande=q1");
    expect(lienDemandeBudgetDepartement()).toBe("/budgets/departements");
    expect(lienCibleEnveloppe("/budget-marketing", "e1", ancreCategorieBudget("c1")))
      .toBe("/budget-marketing?env=e1&cible=categorie-budget-c1");
  });
});

describe("une notification déjà en base garde sa cible à l'affichage", () => {
  it.each([
    lienLigneCentreAdPro("abc"),
    lienBonDeCommande("doc1"),
    lienFormation("t1"),
    lienRemiseCaisse("r1"),
    lienDemandeBudgetDepartement("q1", 2026),
  ])("%s n'est pas réécrit", (lien) => {
    expect(reécriteLienNotification(lien)).toBe(lien);
  });
  it("l'ancienne adresse des BC garde le paramètre ?bc= en route", () => {
    expect(reécriteLienNotification("/finances/bons-de-commande?bc=doc1")).toBe("/bons-de-commande?bc=doc1");
  });
});

describe("l'écran pose l'ancre que l'adresse vise", () => {
  const lire = (f: string) => readFileSync(f, "utf8");
  it.each([
    ["src/app/(app)/centre-ad-pro/centre-board.tsx", "ancreLigneCentre(", ancreLigneCentre("x")],
    ["src/app/(app)/bons-de-commande/file-bc.tsx", "ancreBonDeCommande(", ancreBonDeCommande("x")],
    ["src/app/(app)/formations/training-board.tsx", "ancreFormation(", ancreFormation("x")],
    ["src/app/(app)/moyens-generaux/cash-panel.tsx", "ancreRemise(", ancreRemise("x")],
    ["src/app/(app)/moyens-generaux/cash-panel.tsx", "ancreRallonge(", ancreRallonge("x")],
    ["src/app/(app)/budgets/departements/department-budget-table.tsx", "ancreDemandeBudget(", ancreDemandeBudget("x")],
    ["src/app/(app)/budgets/vues-budget.tsx", "ancreCategorieBudget(", ancreCategorieBudget("x")],
    ["src/app/(app)/budgets/vue-regulatory.tsx", "ancreCategorieBudget(", ancreCategorieBudget("x")],
  ])("%s pose %s", (fichier, appel, exemple) => {
    expect(lire(fichier)).toContain(appel);
    expect(exemple).toMatch(/-x$/);
  });
  it.each([
    "src/app/(app)/centre-ad-pro/centre-board.tsx",
    "src/app/(app)/bons-de-commande/file-bc.tsx",
    "src/app/(app)/formations/training-board.tsx",
    "src/app/(app)/moyens-generaux/page.tsx",
    "src/app/(app)/budgets/departements/department-budget-table.tsx",
    "src/app/(app)/budgets/vues-budget.tsx",
  ])("%s fait venir la ligne sous les yeux (SurlignerCible)", (fichier) => {
    expect(lire(fichier)).toContain("<SurlignerCible");
  });
});
