import { describe, it, expect } from "vitest";
import { actionsOfModule, isRowScoped, rolesReaching, buildAccessSheet, type PermissionMatrix } from "./rbac-sheet";
import { PERMISSIONS, MODULES, ACTIONS, defaultScope, type Module } from "./rbac";
import { MODULE_LABELS } from "./labels";

const ORDER = ["VIEW", "CREATE", "UPDATE", "DELETE", "VALIDATE", "EXPORT", "UPLOAD"];

const matrix: PermissionMatrix = {
  ADMIN_ROLE: { REGULATORY: ["VIEW", "CREATE", "UPDATE", "DELETE", "VALIDATE", "EXPORT", "UPLOAD"], LECTURE: ["VIEW"] },
  ASSISTANT: { REGULATORY: ["VIEW", "CREATE"] },
  VIEWER: { LECTURE: ["VIEW"] },
};

describe("Les colonnes viennent des droits réels, pas d'une liste écrite à la main", () => {
  it("ne montre que les actions qu'au moins un rôle possède", () => {
    expect(actionsOfModule("REGULATORY", matrix, ORDER))
      .toEqual(["CREATE", "UPDATE", "DELETE", "VALIDATE", "EXPORT", "UPLOAD"]);
  });

  it("un module en lecture seule n'affiche AUCUNE case — cocher « Valider » n'y ouvrirait rien", () => {
    expect(actionsOfModule("LECTURE", matrix, ORDER)).toEqual([]);
  });

  it("« Voir » n'est jamais une case : il est implicite dès que le module n'est pas bloqué", () => {
    expect(actionsOfModule("REGULATORY", matrix, ORDER)).not.toContain("VIEW");
  });

  it("garde l'ordre canonique des actions — des colonnes mouvantes rendent la feuille illisible", () => {
    const shuffled: PermissionMatrix = { R: { M: ["UPLOAD", "CREATE", "VALIDATE"] } };
    expect(actionsOfModule("M", shuffled, ORDER)).toEqual(["CREATE", "VALIDATE", "UPLOAD"]);
  });

  it("un module inconnu ne fabrique pas de colonnes", () => {
    expect(actionsOfModule("N_EXISTE_PAS", matrix, ORDER)).toEqual([]);
  });
});

describe("La portée ne se propose que là où elle existe", () => {
  const scopeOf = (role: string, module: string) =>
    module === "REGULATORY" && role === "ASSISTANT" ? "ASSIGNED" : "ALL";

  it("propose le choix dès qu'UN rôle est restreint aux lignes assignées", () => {
    expect(isRowScoped("REGULATORY", ["ADMIN_ROLE", "ASSISTANT"], scopeOf)).toBe(true);
  });

  it("ne le propose pas là où tout le monde voit tout : ce serait un cloisonnement imaginaire", () => {
    expect(isRowScoped("LECTURE", ["ADMIN_ROLE", "ASSISTANT"], scopeOf)).toBe(false);
  });
});

describe("Un module que personne n'atteint se dit, plutôt que de se chercher", () => {
  it("compte les rôles qui y ont accès par défaut", () => {
    expect(rolesReaching("REGULATORY", matrix)).toBe(2);
    expect(rolesReaching("LECTURE", matrix)).toBe(2);
    expect(rolesReaching("FANTOME", matrix)).toBe(0);
  });
});

describe("Branchée sur les VRAIES règles de l'application", () => {
  const sheet = buildAccessSheet(
    MODULES, MODULE_LABELS as Record<string, string>,
    PERMISSIONS as unknown as PermissionMatrix, ACTIONS,
    Object.keys(PERMISSIONS),
    (role, module) => defaultScope(role as Parameters<typeof defaultScope>[0], module as Module),
  );

  it("couvre exactement les modules déclarés — ni un de plus, ni un de moins", () => {
    expect(sheet).toHaveLength(MODULES.length);
    expect(sheet.map((s) => s.value)).toEqual([...MODULES]);
  });

  it("chaque module porte un libellé lisible", () => {
    expect(sheet.every((s) => s.label.length > 0)).toBe(true);
  });

  it("LE MODULE HORS SERVICE est signalé — un droit accordé sur un module masqué n'ouvre rien", () => {
    // Sans réglage, aucun module n'est hors service : la feuille reste utilisable telle quelle.
    expect(sheet.every((s) => s.hidden === false)).toBe(true);

    // Avec un module masqué, la feuille le DIT — c'est ce qui évite de régler des accès qui
    // s'enregistrent sans rien ouvrir, puis de conclure que la matrice est cassée.
    const avecMasque = buildAccessSheet(
      MODULES, MODULE_LABELS as Record<string, string>,
      PERMISSIONS as unknown as PermissionMatrix, ACTIONS,
      Object.keys(PERMISSIONS),
      (role, module) => defaultScope(role as Parameters<typeof defaultScope>[0], module as Module),
      ["PCH"],
    );
    expect(avecMasque.find((s) => s.value === "PCH")?.hidden).toBe(true);
    // Et lui seul : masquer un module n'en masque pas d'autres au passage.
    expect(avecMasque.filter((s) => s.hidden).map((s) => s.value)).toEqual(["PCH"]);
    // Le masquage ne touche NI les capacités réglables NI la portée : ce n'est pas un droit.
    const avant = sheet.find((s) => s.value === "PCH")!;
    const apres = avecMasque.find((s) => s.value === "PCH")!;
    expect(apres.actions).toEqual(avant.actions);
    expect(apres.roleCount).toBe(avant.roleCount);
  });

  it("retrouve les modules réellement cloisonnés par ligne, sans qu'on les ait listés", () => {
    const rowScoped = sheet.filter((s) => s.rowScoped).map((s) => s.value);
    // Ceux-là le sont par construction dans `defaultScope` — le test tomberait si la règle
    // changeait sans que la feuille suive, ce qui est précisément l'accident à empêcher.
    for (const m of ["REGULATORY", "SALES", "MEDICAL", "DRIVE", "DOSSIERS", "SUPPORT", "DIRECTIVES"]) {
      expect(rowScoped).toContain(m);
    }
  });

  it("aucun module n'affiche une action qu'aucun rôle ne possède", () => {
    for (const spec of sheet) {
      for (const action of spec.actions) {
        const held = Object.keys(PERMISSIONS).some((r) =>
          ((PERMISSIONS as unknown as PermissionMatrix)[r]?.[spec.value] ?? []).includes(action));
        expect(held, `${spec.value} · ${action}`).toBe(true);
      }
    }
  });
});
