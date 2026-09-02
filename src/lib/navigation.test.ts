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
    // « Moyens généraux » relève de WORKSPACE, que TOUT LE MONDE a : demander un achat est un
    // geste de n'importe quel employé, et l'écran se charge ensuite de ne montrer ni budget ni
    // trésorerie à qui n'y a pas droit. « Demandes de paiement » n'a PLUS d'entrée de menu : la
    // demande se fait depuis les Demandes de validations, et le dossier passe par le centre de
    // paiement avant d'atteindre les Règlements.
    const admin = groupIntoPoles(accessible(["WORKSPACE", "FINANCES", "RH", "BUDGETS"]))
      .find((p) => p.key === "ADMINISTRATION");
    expect(admin?.children.map((c) => c.label)).toEqual([
      "Moyens généraux", "Finances", "Ressources humaines", "Budgets",
    ]);
    expect(admin?.defaultOpen).toBe(true);
  });

  it("> 5 sous-modules visibles → replié, à ouvrir au chevron", () => {
    const sm = groupIntoPoles(accessible(["SALES", "MEDICAL", "SALES_PLANNING", "FIELD_REPORTS", "SPONSORING", "MEDICAL_INFO"]))
      .find((p) => p.key === "SALES_MARKETING");
    expect(sm!.children.length).toBeGreaterThan(POLE_OPEN_THRESHOLD);
    expect(sm?.defaultOpen).toBe(false);
  });

  it("le décompte porte sur CE QUE LA PERSONNE VOIT, pas sur le total du pôle", () => {
    // Deux entrées seulement, alors que le pôle en compte davantage au total : il s'ouvre.
    // Replier pour deux lignes n'aurait aucun sens. (MEDICAL n'a qu'UNE entrée de menu —
    // « Promotion médicale » — qui porte ses deux onglets : Ma journée et l'Annuaire.)
    const sm = groupIntoPoles(accessible(["FIELD_REPORTS", "MEDICAL"])).find((p) => p.key === "SALES_MARKETING");
    expect(sm?.children.map((c) => c.label)).toEqual(["Promotion médicale", "Rapports terrain"]);
    expect(sm?.defaultOpen).toBe(true);
  });

  it("le PIPELINE est un module du pôle Regulatory — on le trouve en dépliant sa flèche", () => {
    const poles = groupIntoPoles(accessible(["REGULATORY"]));
    const reg = poles.find((p) => p.key === "REGULATORY");
    expect(reg?.children.map((c) => c.label)).toEqual(expect.arrayContaining(["Suivi des dossiers", "Pipeline"]));
    expect(poleOfPath(poles, "/regulatory/pipeline")).toBe("REGULATORY");
  });

  it("un SOUS-MODULE (capacité `children`) ouvre le pôle de son parent — la Paie sous les RH", () => {
    const rh = NAVIGATION.find((n) => n.href === "/rh")!;
    expect(rh.children?.map((c) => c.href)).toEqual(["/rh/paie"]);
    // Arriver sur la paie par un lien de notification doit ouvrir Administration, sinon on ne
    // retrouve pas dans le menu l'écran où l'on se trouve.
    expect(poleOfPath(groupIntoPoles([rh]), "/rh/paie")).toBe("ADMINISTRATION");
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
    // « dédouanement » menait à Commandes & logistique, RETIRÉ du service : l'alias est parti
    // avec l'écran. Un raccourci vers une page interdite est pire qu'un raccourci absent — on
    // tape, on est renvoyé, et l'on croit à une panne de droits.
    expect(aliasMatches("dedouanement")).toEqual([]);
    expect(aliasMatches("Événement")[0].href).toBe("/sponsoring");
    expect(aliasMatches("marche")[0].href).toBe("/pch");
  });

  it("« administration » propose la Console d'Administration sans masquer l'ambiguïté", () => {
    expect(aliasMatches("administration").some((h) => h.href === "/admin")).toBe(true);
  });

  it("ne répond pas à une saisie d'un seul caractère", () => {
    expect(aliasMatches("a")).toEqual([]);
  });
});

describe("aucune route n'a changé — les liens historiques restent valides", () => {
  it("les routes des pôles restent atteignables depuis la navigation", () => {
    // Une entrée de menu peut pointer ailleurs qu'avant (Ad & Pro ouvre désormais sur la vue
    // unifiée `/ad-pro`), mais la route historique doit rester JOIGNABLE — sinon un lien envoyé
    // par courriel il y a six mois tombe dans le vide. On accepte donc qu'elle soit portée par
    // l'entrée elle-même, par ses ONGLETS, ou par ses routes de correspondance.
    const reachable = new Set<string>();
    for (const n of NAVIGATION.filter((x) => x.pole)) {
      reachable.add(n.href);
      for (const t of n.tabs ?? []) reachable.add(t.href);
      for (const m of n.match ?? []) reachable.add(m);
    }
    for (const expected of [
      "/regulatory", "/regulatory/enregistrement", "/moyens-generaux", "/finances", "/rh",
      "/budgets", "/sales", "/medical", "/planning", "/field-reports", "/sponsoring",
      "/information-medicale", "/business-development", "/pch", "/logistics", "/stocks",
    ]) {
      expect(reachable, expected).toContain(expected);
    }
  });

  it("Ad & Pro ouvre sur la vue unifiée, sans faire disparaître les écrans par nature", () => {
    const adPro = NAVIGATION.find((n) => n.label === "Ad & Pro");
    expect(adPro?.href).toBe("/ad-pro");
    const tabs = (adPro?.tabs ?? []).map((t) => t.href);
    for (const nature of ["/sponsoring", "/congress-international", "/congress-national", "/events", "/promo-material"]) {
      expect(tabs, nature).toContain(nature);
    }
  });
});
