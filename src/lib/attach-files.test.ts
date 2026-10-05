import { describe, expect, it } from "vitest";
import { validateAttachments } from "@/lib/attach-files";

describe("un champ fichier laissé vide n'est pas une pièce", () => {
  it("zéro octet SANS nom, ou nommé « undefined » par l'action serveur : rien à contrôler", async () => {
    expect(await validateAttachments([new File([], "")])).toBeNull();
    expect(await validateAttachments([new File([], "undefined")])).toBeNull();
    expect(await validateAttachments([])).toBeNull();
  });

  it("un fichier vide qui porte un VRAI nom reste refusé, et dit son nom", async () => {
    const r = await validateAttachments([new File([], "lettre.pdf")]);
    expect(r).toContain("« lettre.pdf » est vide (0 octet).");
  });
});
