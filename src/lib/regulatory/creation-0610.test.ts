import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/**
 * CRÉATION D'UN DOSSIER REGULATORY (Direction, 06/10) :
 *   • dans le SUIVI, la CTD initiale est obligatoire (écran ET serveur) ; au PIPELINE, elle peut venir plus tard ;
 *   • une molécule déjà présente propose ce qui existe (ouvrir le dossier, partir du produit) ou un nouveau produit ;
 *   • un bouton, Super Admin SEUL, met au pipeline tous les dossiers non entamés.
 */

const code = (rel: string) => readFileSync(rel, "utf8");

describe("CTD initiale obligatoire dans le suivi", () => {
  const actions = code("src/lib/actions/regulatory-actions.ts");
  it("le serveur refuse un dossier du suivi sans CTD, pas un dossier né au pipeline", () => {
    expect(actions).toContain('if (!lockOnCreate && !(Number(str(formData, "ctdFichiers") ?? "0") > 0)) {');
    expect(actions).toContain("Joignez la CTD initiale");
  });
  it("le formulaire porte le nombre de fichiers et retient la création sans CTD hors pipeline", () => {
    const f = code("src/app/(app)/regulatory/new-product.tsx");
    expect(f).toContain('<input type="hidden" name="ctdFichiers" value={String(ctd.length)} />');
    expect(f).toContain("const ctdManquante = !lockOnCreate && ctd.length === 0;");
    expect(f).toContain("disabled={submitting || doublon.blocking || ctdManquante}");
  });
  it("l'assistant, qui ne joint pas de fichier, crée au pipeline", () => {
    expect(code("src/lib/assistant/ops/impl-regulatory.ts")).toContain('fd.set("lock", "1");');
  });
});

describe("molécule déjà présente : proposer l'existant, ou un nouveau produit", () => {
  it("l'avis liste les dossiers visibles et les produits du référentiel ; on ouvre, on part d'un produit, ou on crée", () => {
    const actions = code("src/lib/actions/regulatory-actions.ts");
    expect(actions).toContain("existants: ExistantDeLaMolecule[]");
    const b = code("src/app/(app)/regulatory/dci-duplicate-banner.tsx");
    expect(b).toContain("Ouvrir ce dossier");
    expect(b).toContain("Partir de ce produit");
    expect(b).toContain("Créer un nouveau produit");
  });
});

describe("mettre au pipeline les dossiers non entamés — Super Admin seul", () => {
  it("le serveur réserve le geste au Super Admin et ne vise que les dossiers dont aucune étape n'a commencé", () => {
    const a = code("src/lib/actions/regulatory-actions.ts");
    const corps = a.slice(a.indexOf("export async function mettreAuPipelineNonEntames"));
    expect(corps).toContain('if (user.role !== "SUPER_ADMIN") return { ok: false, error: "Réservé au Super Admin." };');
    expect(a).toContain('const NON_ENTAMES: Prisma.RegulatoryProductWhereInput = { isLocked: false, steps: { none: { status: { not: "NOT_STARTED" } } } };');
  });
  it("le bouton n'est rendu qu'au Super Admin", () => {
    expect(code("src/app/(app)/regulatory/page.tsx")).toContain('{user.role === "SUPER_ADMIN" && <MettreAuPipeline />}');
  });
});
