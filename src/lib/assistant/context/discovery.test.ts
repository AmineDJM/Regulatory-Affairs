import { describe, it, expect } from "vitest";
import { runDiscovery, DISCOVERY_TOOL_NAME } from "./discovery";
import { TOOL_DOMAINS, DISCOVERY_TOOL, shortlistTools } from "./tool-shortlist";
import { routeQuery } from "./router";

/**
 * L'ÉCHAPPATOIRE DOIT ÊTRE RÉELLE.
 *
 * La liste courte n'est acceptable QUE si « je n'ai pas d'outil pour ça » ne peut jamais être
 * vrai. Ces cas vérifient les deux moitiés de cette promesse : la découverte rend bien les
 * outils du domaine demandé, ET elle ne rend jamais un outil auquel la personne n'a pas droit.
 */

const tool = (name: string, description = "Fait quelque chose. Détail secondaire.") => ({ name, description });

/** Une liste « ouverte à cette personne » réduite, mais représentative de plusieurs domaines. */
const AVAILABLE = [
  tool("gmail_search", "Cherche dans la messagerie. Renvoie les fils récents."),
  tool("gmail_read_thread", "Ouvre un fil de discussion."),
  tool("read_calendar", "Lit l'agenda de la personne connectée."),
  tool("directory_lookup", "Trouve les coordonnées d'une personne."),
  tool("directory_list", "Liste le registre du personnel."),
  tool("search_everything", "Recherche fédérée dans tout l'ERP."),
  DISCOVERY_TOOL,
];

describe("la découverte rend les outils du domaine demandé", () => {
  it("un domaine connu ne rend QUE ce domaine", () => {
    const r = runDiscovery({ domain: "CALENDAR" }, AVAILABLE);
    expect(r.domain).toBe("CALENDAR");
    expect(r.unlock).toContain("read_calendar");
    expect(r.unlock).not.toContain("gmail_read_thread");
  });

  it("la casse et les espaces du modèle ne cassent rien", () => {
    expect(runDiscovery({ domain: "  mail " }, AVAILABLE).domain).toBe("MAIL");
    expect(runDiscovery({ domain: "Mail" }, AVAILABLE).unlock).toContain("gmail_search");
  });

  it("sans domaine — ou avec un domaine inventé — on rend tout ce qui est ouvert", () => {
    for (const input of [{}, { domain: "PLOMBERIE" }, { domain: 42 }]) {
      const r = runDiscovery(input as Record<string, unknown>, AVAILABLE);
      expect(r.domain).toBeNull();
      expect(r.unlock).toContain("gmail_search");
      expect(r.unlock).toContain("read_calendar");
      expect(r.unlock).toContain("directory_lookup");
    }
  });

  it("elle ne se propose jamais elle-même — une boucle de découverte serait un tour perdu", () => {
    expect(runDiscovery({}, AVAILABLE).unlock).not.toContain(DISCOVERY_TOOL_NAME);
    expect(runDiscovery({}, AVAILABLE).text).not.toContain(`\`${DISCOVERY_TOOL_NAME}\``);
  });

  it("le texte rendu nomme les outils EXACTEMENT — un nom approximatif est inappelable", () => {
    const r = runDiscovery({ domain: "MAIL" }, AVAILABLE);
    expect(r.text).toContain("`gmail_search`");
    for (const name of r.unlock) expect(r.text).toContain(`\`${name}\``);
  });

  it("la description est raccourcie à sa première phrase — la liste doit rester lisible", () => {
    const r = runDiscovery({ domain: "CALENDAR" }, AVAILABLE);
    expect(r.text).toContain("Lit l'agenda de la personne connectée");
    expect(r.text).not.toContain("Détail secondaire");
  });
});

describe("elle n'accorde AUCUN droit — c'est la garantie qui la rend sûre", () => {
  it("un outil absent de la liste ouverte n'est ni nommé ni déverrouillé", () => {
    // La personne n'a pas les outils RH : la découverte ne doit pas lui apprendre qu'ils existent.
    const r = runDiscovery({ domain: "HR" }, AVAILABLE);
    expect(r.text).not.toContain("read_payroll");
    expect(r.unlock).not.toContain("read_payroll");
    expect(r.unlock.every((n) => AVAILABLE.some((t) => t.name === n))).toBe(true);
  });

  it("réclamer TOUT ne révèle pas plus que ce qui est déjà ouvert", () => {
    const r = runDiscovery({}, AVAILABLE);
    const openNames = new Set(AVAILABLE.map((t) => t.name));
    for (const n of r.unlock) expect(openNames.has(n)).toBe(true);
  });

  it("une liste ouverte vide donne une réponse honnête, pas une liste inventée", () => {
    const r = runDiscovery({ domain: "MAIL" }, [DISCOVERY_TOOL]);
    expect(r.unlock).toEqual([]);
    expect(r.text).toContain("Aucun outil supplémentaire");
    expect(r.text).toContain("MAIL");
  });
});

describe("un outil NON classé reste toujours atteignable", () => {
  it("il est rendu quel que soit le domaine demandé", () => {
    const inconnu = tool("outil_tout_neuf", "Un outil ajouté sans classement de domaine.");
    const withNew = [...AVAILABLE, inconnu];
    // Un oubli de classement doit coûter des tokens, jamais une capacité.
    expect(runDiscovery({ domain: "MAIL" }, withNew).unlock).toContain("outil_tout_neuf");
    expect(runDiscovery({ domain: "FINANCE" }, withNew).unlock).toContain("outil_tout_neuf");
    expect(runDiscovery({}, withNew).unlock).toContain("outil_tout_neuf");
    expect(TOOL_DOMAINS["outil_tout_neuf"]).toBeUndefined();
  });
});

describe("la découverte répare vraiment ce que la liste courte a coupé", () => {
  it("ce que la liste courte a écarté, la découverte le rend — le tour est réparable", () => {
    // Une question de fond sur les congés : le domaine part sur RH, la vraie réponse est dans
    // la messagerie. C'est exactement le mauvais aiguillage que l'échappatoire doit réparer.
    const route = routeQuery("Comment expliquer que les demandes de congé traînent autant ?");
    const short = new Set(shortlistTools(AVAILABLE, route).map((t) => t.name));
    expect(short.has("gmail_read_thread")).toBe(false);

    const rescued = runDiscovery({ domain: "MAIL" }, AVAILABLE);
    expect(rescued.unlock).toContain("gmail_read_thread");
    // Après déverrouillage, l'outil coupé est de nouveau dans la liste de la conversation.
    const reopened = new Set([...short, ...rescued.unlock]);
    expect(reopened.has("gmail_read_thread")).toBe(true);
  });

  it("l'outil de découverte accompagne TOUTE liste courte — sinon rien n'est réparable", () => {
    // Sur une route déterministe la liste est VIDE (aucun modèle ne choisit d'outil) : il n'y a
    // alors rien à réparer. Partout ailleurs, l'échappatoire doit être présente.
    for (const q of [
      "Comment expliquer que les demandes de congé traînent autant ?",
      "Résume la situation du portefeuille réglementaire.",
      "Pourquoi les paiements sont-ils en retard ce mois-ci ?",
    ]) {
      const names = shortlistTools(AVAILABLE, routeQuery(q)).map((t) => t.name);
      expect(names.length).toBeGreaterThan(0);
      expect(names).toContain(DISCOVERY_TOOL_NAME);
    }
  });
});
