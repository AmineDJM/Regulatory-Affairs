import { describe, it, expect } from "vitest";
import {
  dossierReceived, dossierReceivedLabel, dossierReceivedOptions,
  DOSSIER_RECEIVED_YES, DOSSIER_RECEIVED_NO, DOSSIER_RECEIVED_HINT,
} from "./dossier-received";

describe("« Dossier reçu » se constate, il ne se coche pas", () => {
  it("C'EST L'ARCHIVE QUI RÉPOND — pas un dossier d'enregistrement simplement ouvert", () => {
    // On ouvre un dossier pour PRÉPARER la réception, souvent des semaines avant que le
    // fournisseur envoie quoi que ce soit. Ce qui compte est le fichier qu'on a en main.
    expect(dossierReceived({ hasArchive: true })).toBe(true);
    expect(dossierReceived({ hasArchive: false })).toBe(false);
    expect(dossierReceived(null)).toBe(false);
    expect(dossierReceived(undefined)).toBe(false);
  });

  it("DEUX RÉPONSES, ET DEUX SEULEMENT — « Yes » ou « No »", () => {
    expect(dossierReceivedLabel(true)).toBe(DOSSIER_RECEIVED_YES);
    expect(dossierReceivedLabel(false)).toBe(DOSSIER_RECEIVED_NO);
    expect([DOSSIER_RECEIVED_YES, DOSSIER_RECEIVED_NO]).toEqual(["Yes", "No"]);
  });

  it("le filtre propose « No » D'ABORD — ce qu'on cherche, c'est ce qui manque", () => {
    expect(dossierReceivedOptions().map((o) => o.value)).toEqual(["No", "Yes"]);
    expect(dossierReceivedOptions().every((o) => o.label === o.value)).toBe(true);
  });

  it("et l'écran DIT pourquoi la colonne ne se modifie pas", () => {
    // Sans cette phrase, on cherche le bouton, on ne le trouve pas, on croit à un droit manquant.
    expect(DOSSIER_RECEIVED_HINT).toMatch(/non modifiable/i);
    expect(DOSSIER_RECEIVED_HINT).toMatch(/CTD/);
    expect(DOSSIER_RECEIVED_HINT).toMatch(/Enregistrement/);
  });
});
