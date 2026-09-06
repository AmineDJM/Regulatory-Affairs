import type { Domain } from "./router";
import { DISCOVERY_TOOL, domainesDe } from "./tool-shortlist";

/**
 * « JE N'AI PAS D'OUTIL POUR ÇA » NE DOIT JAMAIS ÊTRE VRAI.
 *
 * La liste courte réduit les schémas envoyés au modèle de 23 316 à quelques milliers de tokens.
 * Sans échappatoire, ce serait une amputation : le jour où le routeur se trompe de domaine, une
 * capacité disparaît sans que personne le sache.
 *
 * `list_more_tools` est cette échappatoire, et ce fichier est son EXÉCUTION — jusqu'ici, l'outil
 * n'était qu'une déclaration sans code derrière, c'est-à-dire une promesse non tenue.
 *
 * CE QU'IL FAIT, ET CE QU'IL NE FAIT PAS :
 *   • il rend la liste des outils d'un domaine, avec leur nom exact ;
 *   • il signale à l'appelant quels outils AJOUTER à la conversation en cours, pour que le tour
 *     suivant puisse les appeler pour de vrai ;
 *   • il n'accorde AUCUN droit. Chaque outil revérifie la permission à l'exécution — la liste
 *     envoyée au modèle est une suggestion, jamais une autorisation. Ouvrir la liste ne
 *     débloque donc rien qui n'était pas déjà ouvert.
 *
 * CHAQUE APPEL EST UN SIGNAL, PAS UNE ROUTINE. Un modèle qui réclame le catalogue complet, c'est
 * le routeur qui s'est trompé de domaine : l'appel est compté comme « outil manquant » et pèse
 * dans la garde de repli (§8). L'échappatoire répare le tour ; le compteur répare le routeur.
 */

export const DISCOVERY_TOOL_NAME = DISCOVERY_TOOL.name;

const KNOWN_DOMAINS: Domain[] = [
  "MAIL", "CALENDAR", "REGULATORY", "FINANCE", "HR",
  "DRIVE", "LEGAL", "MISSION", "DIRECTORY", "ADMIN", "TEACH", "SOURCES", "QUALITE", "DATA", "GENERAL",
];

export interface DiscoveryResult {
  /** Ce qu'on rend au modèle, en clair. */
  text: string;
  /** Les outils à AJOUTER à la conversation pour le reste de la boucle. */
  unlock: string[];
  /** Le domaine effectivement servi — `null` quand la demande portait sur tout. */
  domain: Domain | null;
}

/**
 * Exécute la découverte. `available` est la liste des outils réellement ouverts à CETTE personne
 * (droits déjà appliqués en amont) : on ne révèle jamais l'existence d'un outil auquel elle n'a
 * pas accès — ce serait renseigner la structure de l'ERP à quelqu'un qui n'y a pas droit.
 */
export function runDiscovery(
  input: Record<string, unknown>,
  available: { name: string; description?: string }[],
): DiscoveryResult {
  const askedRaw = typeof input.domain === "string" ? input.domain.trim().toUpperCase() : "";
  const domain = (KNOWN_DOMAINS as string[]).includes(askedRaw) ? (askedRaw as Domain) : null;

  const openNames = new Set(available.map((t) => t.name));
  const matches = available.filter((t) => {
    if (t.name === DISCOVERY_TOOL_NAME) return false;
    // LA CARTE COMPLÈTE, pas la carte historique. Avec `TOOL_DOMAINS` (la première moitié du
    // classement), une demande « HR » d'une déléguée rouvrait 72 outils : tout ce que cette
    // carte-là ignorait passait pour « non classé », donc montré. Mesuré au banc sur une question
    // de salaire refusée à bon droit — deux appels et 47 000 jetons pour dire non.
    const domains = domainesDe(t.name);
    // Un outil NON classé est montré dans tous les cas : c'est le comportement sûr, le même que
    // dans la liste courte. Un oubli de classement ne doit pas rendre un outil introuvable — et
    // le résolveur exige (par un test) que tout outil envoyé soit classé, donc ce cas reste rare.
    if (!domains) return true;
    return domain === null || domains.includes(domain);
  });

  if (matches.length === 0) {
    return {
      text: domain
        ? `Aucun outil supplémentaire pour le domaine ${domain} : tout ce qui vous est ouvert est déjà présenté.`
        : "Aucun outil supplémentaire : tout ce qui vous est ouvert est déjà présenté.",
      unlock: [],
      domain,
    };
  }

  const lines = matches.map((t) => {
    const short = (t.description ?? "").split(/[.·]/)[0].trim().slice(0, 110);
    return short ? `- \`${t.name}\` — ${short}` : `- \`${t.name}\``;
  });

  return {
    domain,
    unlock: matches.map((t) => t.name).filter((n) => openNames.has(n)),
    text: [
      domain ? `OUTILS DU DOMAINE ${domain} :` : "TOUS LES OUTILS QUI VOUS SONT OUVERTS :",
      ...lines,
      "",
      "Ils sont désormais appelables dans cette conversation. Choisissez le plus précis : "
      + "une source canonique répond mieux qu'une recherche générale.",
    ].join("\n"),
  };
}
