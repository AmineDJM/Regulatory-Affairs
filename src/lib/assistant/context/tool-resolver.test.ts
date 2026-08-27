import { describe, expect, it } from "vitest";
// ⚠ ORDRE D'IMPORT — cycle d'initialisation documenté (`capability-audit.test.ts`).
import "@/lib/assistant";
import { assistantToolsFor, RESOLVER_WRITE_NAMES } from "@/lib/assistant";
import { routeQuery } from "./router";
import { resolveTools, classifyRequest, estSansDemande, LEVEL_CAP, type RequestLevel } from "./tool-resolver";
import { TOOL_DOMAINS_ALL, ALWAYS_ON, DISCOVERY_TOOL } from "./tool-shortlist";
import { POWER_TOOLS } from "@/lib/assistant/power-tools";
import { DOMAIN_TOOL_DEFS } from "@/lib/assistant/ops";
import { MAX_TOOLS_PER_CALL } from "@/lib/models/openai";
import { MODULES, ACTIONS, type Module, type Action } from "@/lib/rbac";
import type { CurrentUser } from "@/lib/session";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE RÉSOLVEUR D'OUTILS — ce qu'on envoie vraiment, par type de demande.
 *
 * ── POURQUOI CES CHIFFRES SONT DES TESTS ET PAS UN RAPPORT ───────────────────────────────
 *
 * Le nombre d'outils envoyés n'était mesuré nulle part. Il a fallu un HTTP 400 en production
 * pour apprendre qu'on en envoyait 161 — y compris pour « Hello ». Un chiffre que personne ne
 * vérifie dérive jusqu'à casser, et il casse toujours chez l'utilisateur.
 *
 * Les bornes ci-dessous sont celles fixées à la conception, pas relevées après coup sur ce que
 * le code produisait. Elles sont larges à dessein : ce sont des GARDE-FOUS contre la dérive,
 * pas un calibrage fin qu'il faudrait retoucher à chaque outil ajouté.
 *
 * `scripts/bench/tool-resolver-bench.ts` rejoue la même mesure en affichant le détail.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

function superAdmin(): CurrentUser {
  const modules = new Map<Module, { actions: Set<Action> }>();
  for (const m of MODULES) modules.set(m, { actions: new Set<Action>(ACTIONS) });
  return {
    id: "test", name: "Essai", email: "essai@example.invalid", role: "SUPER_ADMIN",
    access: { modules, rowGrants: [], secondaryRole: null, role: "SUPER_ADMIN", pipelineView: true, pipelineManage: true },
  } as unknown as CurrentUser;
}

const TOUS = () => assistantToolsFor(superAdmin());

/** Résout comme la production : mêmes entrées, même ensemble d'écritures. */
function resoudre(q: string) {
  return resolveTools(TOUS(), q, routeQuery(q, { modality: "text" }), { ecritures: RESOLVER_WRITE_NAMES });
}

/** Les bornes de la mission. `0` pour ce qui ne demande rien. */
const CIBLE: Record<RequestLevel, [number, number]> = {
  AUCUN: [0, 0], A: [3, 15], B: [10, 30], C: [15, 40],
};

describe("résolveur — le classement est complet, sinon il ne résout rien", () => {
  it("TOUT outil réellement envoyé est classé dans un domaine", () => {
    // C'EST LE TEST QUI REND LES AUTRES POSSIBLES. La règle de sécurité « un outil non classé
    // est conservé » faisait passer 82 outils sur 161 quoi qu'il arrive : la liste courte ne
    // raccourcissait que le tiers qu'elle connaissait. Un classement incomplet ne réduit pas
    // moins — il ne réduit PAS.
    const manquants = TOUS().map((t) => t.name).filter((n) => !(n in TOOL_DOMAINS_ALL));
    expect(manquants, "outils envoyés au modèle mais absents de la carte des domaines").toEqual([]);
  });

  it("le classement ne désigne aucun outil disparu", () => {
    const connus = new Set([
      ...TOUS().map((t) => t.name),
      ...POWER_TOOLS.map((t) => t.def.name),
      ...DOMAIN_TOOL_DEFS.map((t) => t.name),
    ]);
    const fantomes = Object.keys(TOOL_DOMAINS_ALL).filter((n) => !connus.has(n));
    expect(fantomes, "classements qui pointent vers un outil qui n'existe plus").toEqual([]);
  });
});

describe("résolveur — une salutation n'a besoin d'aucun outil", () => {
  it.each(["Hello", "Bonjour", "bonsoir !", "merci beaucoup", "ok parfait", "Bonjour Adam", "  "])(
    "« %s » → 0 outil", (q) => {
      const r = resoudre(q);
      expect(r.level).toBe("AUCUN");
      expect(r.tools.length).toBe(0);
    },
  );

  it("une salutation SUIVIE d'une demande n'est plus une salutation", () => {
    // Toute la sûreté du régime « zéro outil » tient là : reconnaître la formule sur la phrase
    // ENTIÈRE, jamais en sous-chaîne. Sans cela, « bonjour, où en est le dossier ? » partirait
    // sans aucun moyen de répondre.
    for (const q of [
      "Bonjour, où en est le dossier Pembrolizumab ?",
      "Merci, et le budget réglementaire ?",
      "ok, envoie-le à Amine",
    ]) {
      expect(estSansDemande(q), `« ${q} » pris pour une salutation`).toBe(false);
      expect(resoudre(q).tools.length).toBeGreaterThan(0);
    }
  });
});

describe("résolveur — le nombre d'outils tient dans la cible de son niveau", () => {
  const CAS: { q: string; niveau: RequestLevel }[] = [
    { q: "Quel est le statut du dossier Pembrolizumab ?", niveau: "A" },
    { q: "Quel est le budget restant sur les moyens généraux ?", niveau: "A" },
    { q: "Mon prochain rendez-vous ?", niveau: "A" },
    { q: "Liste des congés en attente", niveau: "A" },
    { q: "Envoie le dossier Regulatory à Amine et crée une tâche pour Khaled", niveau: "B" },
    { q: "Que dit le contrat de distribution sur le préavis de résiliation ?", niveau: "B" },
    { q: "Prépare un mail à l'ANPP et mets une relance dans l'agenda vendredi", niveau: "B" },
    { q: "Analyse pourquoi Regulatory prend du retard", niveau: "C" },
    { q: "Fais le tour de la situation des dossiers en cours", niveau: "C" },
    { q: "Audite l'ensemble des demandes bloquées et propose les actions", niveau: "C" },
  ];

  it.each(CAS)("« $q » → niveau $niveau, dans la cible", ({ q, niveau }) => {
    const r = resoudre(q);
    expect(r.level, r.reason).toBe(niveau);
    const [min, max] = CIBLE[niveau];
    expect(r.tools.length, `${r.reason} — cible ${min}–${max}`).toBeGreaterThanOrEqual(min);
    expect(r.tools.length, `${r.reason} — cible ${min}–${max}`).toBeLessThanOrEqual(max);
  });

  it("aucun niveau ne dépasse son propre plafond, découverte comprise", () => {
    // La découverte était ajoutée APRÈS la coupe : un B sortait à 31 pour un plafond de 30.
    // Un dépassement d'exactement un, invisible en lisant le code, trouvé par le banc.
    for (const { q } of CAS) {
      const r = resoudre(q);
      expect(r.tools.length, `${q} → ${r.tools.length} > ${LEVEL_CAP[r.level]}`).toBeLessThanOrEqual(LEVEL_CAP[r.level]);
    }
  });

  it("tout niveau reste très en dessous du plafond de l'API", () => {
    // Le résolveur rend les garde-fous inutiles en marche normale — c'est la preuve qu'il fait
    // son travail, et la raison pour laquelle on peut les garder sans qu'ils coûtent rien.
    for (const { q } of CAS) expect(resoudre(q).tools.length).toBeLessThan(MAX_TOOLS_PER_CALL / 2);
  });
});

describe("résolveur — ce qu'il garde, et ce qu'il refuse de perdre", () => {
  it("le socle est TOUJOURS là dès qu'il y a une demande", () => {
    // Avec ces quatre-là, aucune question ne devient impossible — seulement plus lente.
    for (const q of ["Quel est le statut du dossier Pembrolizumab ?", "Analyse pourquoi Regulatory prend du retard"]) {
      const noms = resoudre(q).tools.map((t) => t.name);
      for (const socle of ALWAYS_ON) expect(noms, `${q} : ${socle} manquant`).toContain(socle);
    }
  });

  it("la découverte accompagne A, B et C — la restriction reste réversible", () => {
    // C'est la condition posée depuis le début : un ordre de présentation, pas une amputation.
    for (const q of ["Mon prochain rendez-vous ?", "Envoie le dossier à Amine et crée une tâche", "Analyse pourquoi ça traîne"]) {
      expect(resoudre(q).tools.map((t) => t.name)).toContain(DISCOVERY_TOOL.name);
    }
  });

  it("un A ne se voit PAS décrire les outils qui écrivent", () => {
    // On ne décrit pas comment supprimer un dossier à quelqu'un qui demande où il en est.
    const noms = resoudre("Quel est le statut du dossier Pembrolizumab ?").tools.map((t) => t.name);
    const ecritures = noms.filter((n) => RESOLVER_WRITE_NAMES.has(n));
    expect(ecritures, "des écritures décrites pour une simple lecture").toEqual([]);
  });

  it("un B, lui, obtient les écritures des domaines qu'il cite", () => {
    const noms = resoudre("Envoie le dossier Regulatory à Amine et crée une tâche pour Khaled").tools.map((t) => t.name);
    expect(noms.some((n) => RESOLVER_WRITE_NAMES.has(n)), "un B sans aucune écriture ne peut rien faire").toBe(true);
  });

  it("plusieurs domaines cités sont TOUS servis", () => {
    // « le contrat et le budget » touche LEGAL et FINANCE. N'en charger qu'un rendrait la
    // moitié de la demande impossible à servir.
    const r = resoudre("Prépare un mail à l'ANPP et mets une relance dans l'agenda vendredi");
    expect(r.domains.length).toBeGreaterThan(1);
    expect(r.domains).toContain("MAIL");
    expect(r.domains).toContain("CALENDAR");
  });

  it("aucun domaine reconnu ne veut PAS dire demande étroite", () => {
    // La faute symétrique de celle corrigée le même jour dans le routeur de connaissance :
    // l'absence de signal prise pour un signal d'absence. « Audite l'ensemble des demandes
    // bloquées » repartait avec le socle seul — cinq outils pour un audit.
    const r = resoudre("Audite l'ensemble des demandes bloquées et propose les actions");
    expect(r.domains.length).toBe(0);
    expect(r.tools.length, "un audit sans domaine reconnu doit rester large").toBeGreaterThanOrEqual(15);
  });
});

describe("résolveur — le classement du niveau", () => {
  it("dans le doute, on MONTE : un routeur incertain ne fait pas descendre le niveau", () => {
    // L'asymétrie de `triage.ts`, conservée : un B traité comme un A perd un outil ; un C
    // traité comme un A perd la réponse.
    expect(classifyRequest("charabia indéchiffrable zzz", { route: "HYBRID_RETRIEVAL", confidence: 0.1 })).not.toBe("AUCUN");
  });

  it("le niveau est déterministe — deux appels identiques donnent la même liste", () => {
    // Une liste dont l'ordre ou le contenu bouge d'un tour à l'autre rend toute mesure fausse,
    // et rend surtout le cache de prompt inutile.
    const a = resoudre("Quel est le statut du dossier Pembrolizumab ?").tools.map((t) => t.name);
    const b = resoudre("Quel est le statut du dossier Pembrolizumab ?").tools.map((t) => t.name);
    expect(a).toEqual(b);
  });
});
