import { describe, expect, it } from "vitest";
import type { CurrentUser } from "@/lib/session";
import { executePowerTool, POWER_TOOLS, powerToolsFor } from "./power-tools";
import { VIEW_TOOLS } from "./view-tools";
import { TOOL_DOMAINS } from "./context/tool-shortlist";
import { composeWorkspace, stripDisplayPayload } from "./workspace/compose";
import { primitiveDeduite } from "@/lib/missions/registry/capability-meta";

/**
 * `render_view` (§35) — la représentation à la demande : le modèle nomme, le code charge, agrège,
 * choisit la forme, vérifie ce qui tromperait, compose le bloc et n'en montre au modèle qu'un
 * résumé chiffré. Sans base : les lignes viennent de la conversation.
 */
const salarie = { id: "view-tools-salarie", name: "Salarié", email: "v@test.dz", role: "VIEWER", access: { modules: new Map() } } as unknown as CurrentUser;
const lignes = [
  { societe: "Adventum", categorie: "Marketing", mois: "2026-03", montant: 150_000 },
  { societe: "Adventum", categorie: "Marketing", mois: "2026-01", montant: 120_000 },
  { societe: "Pharmalliance", categorie: "Marketing", mois: "2026-02", montant: 80_000 },
  { societe: "Adventum", categorie: "IT", mois: "2026-02", montant: 40_000 },
  { societe: "Pharmalliance", categorie: "IT", mois: "2026-03", montant: 10_000 },
];
const appeler = async (input: Record<string, unknown>) => JSON.parse((await executePowerTool("render_view", input, salarie))!) as Record<string, unknown> & { _blocs?: Record<string, unknown>[] };

describe("render_view — branché, ouvert, classé", () => {
  it("est dans POWER_TOOLS et la liste courte (DATA + GENERAL), ouvert sans droit propre, et porte la primitive REPRÉSENTATION", () => {
    const noms = POWER_TOOLS.map((t) => t.def.name);
    for (const t of VIEW_TOOLS) expect(noms).toContain(t.def.name);
    expect(TOOL_DOMAINS.render_view).toEqual(["DATA", "GENERAL"]);
    expect(powerToolsFor(salarie).map((t) => t.name)).toContain("render_view");
    expect(primitiveDeduite("render_view", "READ")).toBe("REPRESENTATION");
  });
});

describe("render_view — des lignes à une figure", () => {
  it("auto : le code choisit la forme, agrège, et rend un bloc viz que le modèle ne voit pas — il reçoit un aperçu chiffré", async () => {
    const brut = (await executePowerTool("render_view", { lignes, question: "les dépenses par société", titre: "Dépenses" }, salarie))!;
    const out = JSON.parse(brut);
    expect(out.ok).toBe(true);
    expect(["barres", "barres_empilees"]).toContain(out.type);
    expect(out.apercu[0]).toMatchObject({ categorie: "Adventum" });
    expect(out.raison).toMatch(/barres/);
    expect(out._blocsDecoratifs).toBe(true);
    const b = composeWorkspace("render_view", brut)?.blocks[0];
    if (b?.kind !== "viz") throw new Error("bloc viz attendu");
    expect(b.source).toMatch(/lignes fournies/);
    expect((b.donnees.series ?? []).reduce((s0, x) => s0 + (x.valeurs[0] ?? 0), 0)).toBe(310_000);
    const vu = JSON.parse(stripDisplayPayload(brut));
    expect(vu._blocs).toBeUndefined();
    expect(vu.apercu).toBeTruthy();
    expect(vu.affichage).toMatch(/à l'écran/);
  });

  it("une forme demandée : courbe par mois ; secteurs à neuf parts regroupe et le dit ; des barres sans zéro sont TROMPEUSES", async () => {
    const courbe = await appeler({ type: "courbe", lignes, x: "mois", y: ["montant"] });
    expect(courbe.type).toBe("courbe");
    expect((courbe._blocs?.[0]?.donnees as { categories: string[] }).categories).toEqual(["2026-01", "2026-02", "2026-03"]);
    const beaucoup = Array.from({ length: 9 }, (_, i) => ({ poste: `P${i}`, montant: 100 - i * 10 }));
    const sect = await appeler({ type: "secteurs", lignes: beaucoup, x: "poste", y: ["montant"] });
    expect((sect._blocs?.[0]?.donnees as { categories: string[] }).categories).toHaveLength(6);
    expect((sect.notes as string[]).join(" ")).toMatch(/Autres/);
    const tronque = await appeler({ type: "barres", lignes, x: "societe", y: ["montant"], axeYdepartZero: false });
    expect((tronque.alertes as string[]).join(" ")).toMatch(/TROMPEUR.*zéro/);
  });

  it("des données déjà structurées : un réseau, relu par le lecteur ; des données invalides sont refusées en nommant l'attendu", async () => {
    const g = await appeler({ type: "graphe", titre: "Qui avec qui", donnees: { noeuds: [{ id: "a", label: "Amine" }, { id: "b", label: "Raihana" }], arcs: [{ de: "a", a: "b", poids: 3 }] } });
    expect(g.ok).toBe(true);
    expect(g.noeuds).toBe(2);
    expect(g._blocs?.[0]?.type).toBe("graphe");
    const ko = await appeler({ type: "gantt", donnees: { noeuds: [] } });
    expect(ko.ok).toBe(false);
    expect(ko.erreur).toMatch(/attendu taches/);
  });

  it("une forme inconnue est refusée avec la liste des formes ; une colonne introuvable aussi, avec les colonnes", async () => {
    const f = await appeler({ type: "camembert_3d", lignes });
    expect(f.ok).toBe(false);
    expect(f.formes).toContain("heatmap");
    const c = await appeler({ type: "barres", lignes, x: "region" });
    expect(c.ok).toBe(false);
    expect(c.erreur).toMatch(/introuvable.*colonnes disponibles/);
  });

  it("tuiles : un tableau de bord composé — source partagée, une tuile invalide DITE, la grille relue par composeWorkspace", async () => {
    const out = await appeler({
      titre: "Bord", lignes,
      tuiles: [
        { type: "barres", titre: "Par société", x: "societe", y: ["montant"] },
        { type: "courbe", titre: "Par mois", x: "mois", y: ["montant"] },
        { type: "gantt", titre: "cassée" },
        { type: "cartes", titre: "Indicateurs", donnees: { cartes: [{ titre: "Total", valeur: "400 000 DZD" }] } },
      ],
    });
    expect(out.ok).toBe(true);
    expect(out.forme).toBe("dashboard");
    expect(out.tuiles).toHaveLength(3);
    expect((out.tuilesRefusees as string[])[0]).toMatch(/cassée/);
    const b = composeWorkspace("render_view", JSON.stringify(out))?.blocks[0];
    if (b?.kind !== "dashboard") throw new Error("dashboard attendu");
    expect(b.tuiles.map((t) => t.kind)).toEqual(["viz", "viz", "viz"]);
  });

  it("run_analysis rend AUSSI le graphique recommandé, sous le tableau — le modèle apprend qu'ils sont à l'écran", async () => {
    const out = JSON.parse((await executePowerTool("run_analysis", {
      source: { lignes },
      etapes: [{ op: "regrouper", par: ["societe"], mesures: [{ colonne: "montant", agregat: "sum", alias: "total" }] }],
      question: "les dépenses par société",
    }, salarie))!);
    expect((out._blocs as { kind: string }[]).map((b) => b.kind)).toEqual(["table", "viz"]);
    expect(out.rendu).toMatch(/graphique/);
  });
});
