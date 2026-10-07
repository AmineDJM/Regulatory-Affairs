import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/** Retours de la Direction du 07/10 sur la carte « Devis » du matériel promotionnel — gardes d'écran et d'action. */
const lire = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8");
const CARTE = "src/app/(app)/promo-material/[id]/quotes-card.tsx";

describe("« Lire le scan » : un état clair et sobre, le détail derrière un ⓘ", () => {
  it("une ligne verte « Devis lu — N lignes préremplies », plus de note de lecture à l'écran", () => {
    const src = lire(CARTE);
    expect(src).toContain("Devis lu — ");
    expect(src).toContain('label="Points à vérifier"');
    for (const ancien of ["<NoteDeLecture", "<LigneLue", "Avant d&apos;enregistrer : comparez au papier"]) expect(src, ancien).not.toContain(ancien);
  });

  it("le total HT imprimé n'est plus obligatoire — ni à l'écran, ni pour terminer", () => {
    const src = lire(CARTE);
    expect(src).toContain(">Total HT imprimé sur le devis</Label>");
    expect(src).not.toContain("Total HT imprimé sur le devis *");
    expect(src).not.toContain("total imprimé manquant");
  });

  it("UNE case « J'ai comparé les lignes au devis », lue par l'action et valant attestation de chaque ligne lue", () => {
    expect(lire(CARTE)).toContain("J&apos;ai comparé les lignes au devis");
    const action = lire("src/lib/actions/promo-devis-actions.ts");
    expect(action).toContain('fdCase(formData, "lignesComparees") === true');
    expect(action).toContain("verifiee: comparees");
    expect(action).not.toContain('"ligneVerifiee"');
  });

  it("l'action et l'article demandé sont PROPOSÉS au préremplissage", () => {
    expect(lire(CARTE)).toMatch(/proposerLigne\(\{ designation: l\.reference/);
  });
});
