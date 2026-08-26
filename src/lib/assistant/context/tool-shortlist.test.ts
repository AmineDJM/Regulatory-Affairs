import { describe, it, expect } from "vitest";
import { POWER_TOOLS } from "@/lib/assistant/power-tools";
import { TOOL_DOMAINS, ALWAYS_ON, DISCOVERY_TOOL, shortlistNames, shortlistTools } from "./tool-shortlist";
import { routeQuery } from "./router";
import { measureToolDefs } from "./tokens";
import { GOLDEN_CORPUS } from "./golden-corpus";

/**
 * LE CLIQUET DE PARITÉ.
 *
 * Réduire la liste d'outils est une optimisation ; la réduire SANS FILET est une perte de
 * capacité déguisée. Ce fichier est le filet, et il tient sur une idée : le jour où quelqu'un
 * ajoute un outil sans le classer, la CI doit tomber — pas Adam.
 */

describe("parité : aucun outil ne disparaît en silence", () => {
  const registre = POWER_TOOLS.map((t) => t.def.name).sort();

  it("TOUT outil du registre est classé dans un domaine", () => {
    const manquants = registre.filter((n) => !(n in TOOL_DOMAINS));
    // Si ce test tombe, ce n'est pas un détail : c'est un outil qu'Adam ne verra plus dans son
    // domaine. Le classer prend dix secondes ; le diagnostiquer en production prend une journée.
    expect(manquants).toEqual([]);
  });

  it("aucun classement ne désigne un outil qui n'existe plus", () => {
    const fantomes = Object.keys(TOOL_DOMAINS).filter((n) => !registre.includes(n));
    expect(fantomes).toEqual([]);
  });

  it("un outil NON classé serait conservé, pas écarté — le défaut penche du bon côté", () => {
    const tools = [{ name: "outil_tout_neuf_non_classe" }, { name: "read_payroll" }];
    const kept = shortlistTools(tools, { route: "STRUCTURED_QUERY", domain: "MAIL" }).map((t) => t.name);
    expect(kept).toContain("outil_tout_neuf_non_classe");
    expect(kept).not.toContain("read_payroll");
  });
});

describe("le socle rend toute question possible, même sur un domaine mal deviné", () => {
  const domaines = ["MAIL", "CALENDAR", "REGULATORY", "FINANCE", "HR", "DRIVE", "LEGAL", "MISSION", "DIRECTORY", "ADMIN", "GENERAL"] as const;

  it.each(domaines)("domaine %s : recherche universelle, fiche, personne", (domain) => {
    const names = shortlistNames({ route: "STRUCTURED_QUERY", domain });
    for (const socle of ALWAYS_ON) expect(names).toContain(socle);
  });

  it("et la découverte est toujours proposée", () => {
    const kept = shortlistTools(POWER_TOOLS.map((t) => t.def), { route: "ACTION", domain: "FINANCE" });
    expect(kept.map((t) => t.name)).toContain(DISCOVERY_TOOL.name);
  });

  it("la découverte dit explicitement de ne pas répondre « je ne peux pas »", () => {
    // C'est le défaut historique d'Adam : renvoyer vers un module au lieu d'aller chercher.
    expect(DISCOVERY_TOOL.description).toMatch(/je n'ai pas d'outil/i);
  });
});

describe("la liste courte est vraiment courte, et vraiment ciblée", () => {
  it("une question de messagerie ne charge pas la paie", () => {
    const names = shortlistNames({ route: "STRUCTURED_QUERY", domain: "MAIL" });
    expect(names).toContain("gmail_search");
    expect(names).not.toContain("read_payroll");
    expect(names).not.toContain("regulatory_portfolio");
  });

  it("une question réglementaire ne charge pas la messagerie", () => {
    const names = shortlistNames({ route: "STRUCTURED_QUERY", domain: "REGULATORY" });
    expect(names).toContain("regulatory_portfolio");
    expect(names).not.toContain("gmail_organize");
  });

  it("le raisonnement profond voit large — il traverse les domaines par nature", () => {
    const profond = shortlistNames({ route: "DEEP_REASONING", domain: "REGULATORY" });
    const simple = shortlistNames({ route: "STRUCTURED_QUERY", domain: "REGULATORY" });
    expect(profond.length).toBeGreaterThan(simple.length);
    expect(profond).toContain("what_changed");
    expect(profond).toContain("company_state");
  });

  it("une route déterministe n'envoie AUCUN schéma : elle n'appelle aucun modèle", () => {
    expect(shortlistNames({ route: "FAST_DETERMINISTIC", domain: "MAIL" })).toEqual([]);
    expect(shortlistTools(POWER_TOOLS.map((t) => t.def), { route: "FAST_DETERMINISTIC", domain: "MAIL" })).toEqual([]);
  });
});

describe("le gain, mesuré", () => {
  const defs = POWER_TOOLS.map((t) => t.def);
  const complet = measureToolDefs(defs);

  it("une question de domaine coûte une fraction du catalogue complet", () => {
    const mail = measureToolDefs(shortlistTools(defs, { route: "STRUCTURED_QUERY", domain: "MAIL" }));
    // Le catalogue entier pèse ~23 000 tokens estimés. Une question de boîte mail n'a aucune
    // raison de payer les 77 descriptions.
    expect(mail.tokens).toBeLessThan(complet.tokens * 0.45);
  });

  it("sur le banc entier, la réduction est substantielle et se calcule", () => {
    let avant = 0;
    let apres = 0;
    for (const c of GOLDEN_CORPUS) {
      const r = routeQuery(c.utterance, c.ctx ?? {});
      avant += complet.tokens;
      apres += measureToolDefs(shortlistTools(defs, r)).tokens;
    }
    const reduction = 1 - apres / avant;
    // Mesuré, pas espéré : le test échoue si l'aiguillage cesse de rapporter.
    expect(reduction).toBeGreaterThan(0.5);
  });
});
