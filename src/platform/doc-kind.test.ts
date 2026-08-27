import { describe, expect, it } from "vitest";
import { classifyDocument, DOC_KIND_LABEL } from "./doc-kind";

/**
 * CLASSIFICATION DOCUMENTAIRE — le nom est un INDICE (1 pt), le contenu est la PREUVE (3 pts).
 * Un scan mal nommé se classe par son texte ; un nom seul ne suffit pas quand un contenu
 * lisible existe ; « unknown » est un verdict honnête.
 */

describe("classifyDocument — le contenu prime sur le nom", () => {
  it("un scan MAL NOMMÉ se classe par son contenu (contrat de travail)", () => {
    const text = "Le présent contrat de travail est conclu en CDI entre la société et M. Benali, engagé en qualité de chargé des affaires réglementaires. La période d'essai est fixée à six mois.";
    expect(classifyDocument("scan_0234.pdf", text)).toBe("employment_contract");
  });

  it("contrat de travail bat contrat commercial (spécificité à preuve comparable)", () => {
    const text = "Contrat de travail — entre les soussignés, la société d'une part et le salarié d'autre part. Période d'essai de trois mois.";
    expect(classifyDocument("document.pdf", text)).toBe("employment_contract");
  });

  it("facture, devis, bon de commande, fiche de poste — chacun par ses marqueurs de contenu", () => {
    expect(classifyDocument("f.pdf", "FACTURE N° 2026-118 — Montant TTC : 4 800 000 DZD. Net à payer sous 30 jours.")).toBe("invoice");
    expect(classifyDocument("d.pdf", "DEVIS — offre de prix pour impression de brochures. Validité de l'offre : 30 jours.")).toBe("quote");
    expect(classifyDocument("bc.pdf", "BON DE COMMANDE — nous vous passons commande de 500 unités.")).toBe("purchase_order");
    expect(classifyDocument("fp.docx", "Fiche de poste — Missions principales : suivi des dossiers. Rattachement hiérarchique : Direction. Profil recherché : pharmacien.")).toBe("job_description");
  });

  it("avenant et document réglementaire", () => {
    expect(classifyDocument("x.pdf", "AVENANT n°2 au contrat de travail — le présent avenant modifie le contrat initial ; les autres clauses demeurent inchangées.")).toBe("amendment");
    expect(classifyDocument("y.pdf", "Décision d'enregistrement ANPP — autorisation de mise sur le marché du produit, AMM n° 1234.")).toBe("regulatory_document");
  });

  it("un NOM seul ne suffit pas quand un contenu lisible existe — mais reste un témoignage sans contenu", () => {
    // Contenu lisible sans marqueur : le nom « facture » (1 pt) < minimum (2) → unknown.
    expect(classifyDocument("facture_scan.pdf", "Photo de vacances au bord de la mer, rien d'autre.")).toBe("unknown");
    // Aucun contenu (scan illisible) : le nom est le seul témoignage → invoice, minimum 1.
    expect(classifyDocument("facture_scan.pdf", "")).toBe("invoice");
  });

  it("« unknown » est un verdict honnête, et chaque nature a un libellé français", () => {
    expect(classifyDocument("notes.txt", "Réunion de lundi : penser à acheter du café.")).toBe("unknown");
    expect(Object.keys(DOC_KIND_LABEL).length).toBe(12);
  });
});
