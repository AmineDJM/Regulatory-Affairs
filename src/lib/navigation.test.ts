import { describe, it, expect } from "vitest";
import { groupIntoPoles, itemsOfGroup, poleOfPath, aliasMatches, POLE_OPEN_THRESHOLD, NAV_POLES } from "./navigation";
import { NAVIGATION, type NavItem } from "./labels";
import { MODULES } from "./rbac";

/** Les entrées telles que le layout les livre : DÉJÀ filtrées par le RBAC. */
const accessible = (modules: string[]): NavItem[] =>
  NAVIGATION.filter((n) => (n.tabs ? n.tabs.some((t) => modules.includes(t.module)) : modules.includes(n.module)));

describe("pôles — projection du RBAC, jamais une source de droit", () => {
  it("un pôle n'apparaît QUE s'il a au moins un sous-module accessible", () => {
    const poles = groupIntoPoles(accessible(["FIELD_REPORTS"]));
    expect(poles.map((p) => p.key)).toEqual(["SALES_MARKETING"]);
    expect(poles[0].children.map((c) => c.label)).toEqual(["Rapports terrain"]);
  });

  it("un sous-module interdit est ABSENT, pas masqué", () => {
    const poles = groupIntoPoles(accessible(["FIELD_REPORTS"]));
    const labels = poles.flatMap((p) => p.children.map((c) => c.label));
    expect(labels).not.toContain("Ventes");
    expect(labels).not.toContain("Ad & Pro");
    expect(labels).not.toContain("Information médicale");
  });

  it("sans aucun droit, il n'y a aucun pôle — pas un titre vide", () => {
    expect(groupIntoPoles([])).toEqual([]);
  });

  it("≤ 5 sous-modules visibles → ouvert par défaut", () => {
    const admin = groupIntoPoles(accessible(["GENERAL_MEANS", "FINANCES", "RH", "BUDGETS"]))
      .find((p) => p.key === "ADMINISTRATION");
    expect(admin?.children).toHaveLength(4);
    expect(admin?.defaultOpen).toBe(true);
  });

  it("> 5 sous-modules visibles → replié, à ouvrir au chevron", () => {
    const sm = groupIntoPoles(accessible(["SALES", "MEDICAL", "SALES_PLANNING", "FIELD_REPORTS", "SPONSORING", "MEDICAL_INFO"]))
      .find((p) => p.key === "SALES_MARKETING");
    expect(sm!.children.length).toBeGreaterThan(POLE_OPEN_THRESHOLD);
    expect(sm?.defaultOpen).toBe(false);
  });

  it("le décompte porte sur CE QUE LA PERSONNE VOIT, pas sur le total du pôle", () => {
    // Deux sous-modules de Sales & Marketing seulement : le pôle s'ouvre, alors qu'il en compte
    // six au total. Replier pour deux lignes n'aurait aucun sens.
    const sm = groupIntoPoles(accessible(["FIELD_REPORTS", "MEDICAL"])).find((p) => p.key === "SALES_MARKETING");
    expect(sm?.children).toHaveLength(2);
    expect(sm?.defaultOpen).toBe(true);
  });

  it("garde l'ordre des pôles déclaré, quel que soit l'ordre des droits", () => {
    const keys = groupIntoPoles(accessible([...MODULES])).map((p) => p.key);
    expect(keys).toEqual(NAV_POLES.map((p) => p.key).filter((k) => keys.includes(k)));
  });
});

describe("groupes historiques", () => {
  it("Pilotage, Transverse et Système ne contiennent aucune entrée de pôle", () => {
    const all = accessible([...MODULES]);
    for (const g of ["Pilotage", "Transverse", "Système"] as const) {
      expect(itemsOfGroup(all, g).every((i) => !i.pole)).toBe(true);
    }
  });

  it("« Console d'Administration » est dans Système, et l'administration d'entreprise dans les pôles", () => {
    const all = accessible([...MODULES]);
    expect(itemsOfGroup(all, "Système").map((i) => i.label)).toContain("Console d'Administration");
    const admin = groupIntoPoles(all).find((p) => p.key === "ADMINISTRATION");
    expect(admin?.children.map((c) => c.label)).toEqual(
      expect.arrayContaining(["Moyens généraux", "Finances", "Ressources humaines", "Budgets"]),
    );
  });
});

describe("poleOfPath — le tiroir de la page courante s'ouvre tout seul", () => {
  const poles = groupIntoPoles(accessible([...MODULES]));

  it("retrouve le pôle d'une route, y compris sur une sous-page", () => {
    expect(poleOfPath(poles, "/regulatory")).toBe("REGULATORY");
    expect(poleOfPath(poles, "/pch/abc123")).toBe("BUSINESS_DEV");
    expect(poleOfPath(poles, "/logistics")).toBe("SUPPLY_CHAIN");
    expect(poleOfPath(poles, "/moyens-generaux")).toBe("ADMINISTRATION");
  });

  it("préfère la correspondance la plus PRÉCISE", () => {
    // « /regulatory/enregistrement » appartient au même pôle, mais par une entrée distincte.
    expect(poleOfPath(poles, "/regulatory/enregistrement")).toBe("REGULATORY");
  });

  it("rend null hors des pôles plutôt que d'en ouvrir un au hasard", () => {
    expect(poleOfPath(poles, "/mon-travail")).toBeNull();
    expect(poleOfPath(poles, "/inconnu")).toBeNull();
  });
});

describe("alias de recherche — les anciens noms restent trouvables", () => {
  it("« congrès international » mène toujours à Ad & Pro", () => {
    const hits = aliasMatches("congrès international");
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].href).toBe("/sponsoring");
  });

  it("ignore la casse et les accents — personne ne tape les accents dans une recherche", () => {
    expect(aliasMatches("CONGRES").length).toBeGreaterThan(0);
    expect(aliasMatches("dedouanement")[0].href).toBe("/logistics");
    expect(aliasMatches("Événement")[0].href).toBe("/sponsoring");
  });

  it("« administration » propose la Console d'Administration sans masquer l'ambiguïté", () => {
    expect(aliasMatches("administration").some((h) => h.href === "/admin")).toBe(true);
  });

  it("ne répond pas à une saisie d'un seul caractère", () => {
    expect(aliasMatches("a")).toEqual([]);
  });
});

describe("aucune route n'a changé — les liens historiques restent valides", () => {
  it("les routes des pôles sont celles qui existaient avant la refonte", () => {
    const hrefs = NAVIGATION.filter((n) => n.pole).map((n) => n.href);
    for (const expected of [
      "/regulatory", "/regulatory/enregistrement", "/moyens-generaux", "/finances", "/rh",
      "/budgets", "/sales", "/medical", "/planning", "/field-reports", "/sponsoring",
      "/information-medicale", "/business-development", "/pch", "/logistics", "/stocks",
    ]) {
      expect(hrefs).toContain(expected);
    }
  });
});
