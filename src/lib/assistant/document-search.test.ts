import { describe, expect, it } from "vitest";
import "@/lib/assistant";
// L'outil ET sa garde vivent dans `document-discovery` : ce module fait déjà la découverte
// de documents et porte déjà la dépendance au Drive.
import { KNOWLEDGE_TOOLS } from "./document-discovery";
import { inProcessPlatform, principalOf } from "@/platform/in-process/adapter";
import { ALWAYS_ON, TOOL_DOMAINS_ALL } from "./context/tool-shortlist";
import { POWER_TOOLS } from "./power-tools";
import { MODULES, ACTIONS, type Module, type Action } from "@/lib/rbac";
import type { CurrentUser } from "@/lib/session";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LA RECHERCHE DANS LE CONTENU — et sa garde d'accès, qui est la seule partie dangereuse.
 *
 * Un outil qui lit le CONTENU des documents est exactement l'endroit où une fuite se produit
 * sans bruit : l'écran protège un contrat à lecteurs nommés, et la recherche en rend l'extrait.
 * Les tests de garde ci-dessous comptent plus que ceux de pertinence.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

function utilisateur(role: "SUPER_ADMIN" | "EMPLOYEE"): CurrentUser {
  const modules = new Map<Module, { actions: Set<Action> }>();
  for (const m of MODULES) modules.set(m, { actions: new Set<Action>(ACTIONS) });
  return {
    id: `test-${role}`, name: "Essai", email: "essai@example.invalid", role,
    access: { modules, rowGrants: [], secondaryRole: null, role, pipelineView: true, pipelineManage: true },
  } as unknown as CurrentUser;
}

const item = (id: string, sourceType: string, sourceId = id) => ({ itemId: id, sourceType, sourceId });

describe("garde d'accès — ce qu'on ne sait pas vérifier, on le refuse", () => {
  it("une source dont la garde n'est pas écrite ici n'est JAMAIS rendue", async () => {
    // L'index accepte quinze types de source ; seul le Drive a sa garde traduite. Laisser
    // passer les autres « par défaut » ferait fuir par la recherche ce que l'écran protège —
    // une pièce RH, un courrier restreint, un contrat à lecteurs nommés.
    // La garde vit désormais DANS LE PONT (`platform/in-process`), avec le reste du contrat :
    // on la juge donc par la porte, comme un appelant réel. Aucun document du corpus d'essai
    // n'appartient à ce compte, donc rien ne doit remonter.
    const r = await inProcessPlatform.query(principalOf(utilisateur("EMPLOYEE")),
      { kind: "document.search", question: "contre-indication renale de la metformine" });
    expect(r.kind).toBe("document.search");
    if (r.kind === "document.search") expect(r.extracts, "des sources non gardées ont été rendues").toEqual([]);
  });

  it("LE CACHE NE FAIT PAS FUIR — la réponse de l'un n'est jamais resservie à l'autre", async () => {
    // LE DÉFAUT QUE CE TEST FIGE, et il a été mesuré, pas imaginé. La clé de cache portait le
    // périmètre « sur le papier » (companyId, types, période) mais PAS l'identité — et
    // `companyId` est le plus souvent absent. Le Super Admin demandait « la posologie de la
    // metformine » et recevait 5 extraits ; un employé sans aucun accès posait la même question
    // juste après et recevait les 5 mêmes. Le filtre d'accès avait bien fait son travail : il
    // n'avait simplement jamais été consulté, la réponse venant du cache.
    //
    // L'ORDRE COMPTE : le privilégié DOIT passer en premier, sinon le test ne prouve rien.
    const question = "quelle est la contre-indication renale de la metformine";
    const admin = await inProcessPlatform.query(principalOf(utilisateur("SUPER_ADMIN")), { kind: "document.search", question });
    const employe = await inProcessPlatform.query(principalOf(utilisateur("EMPLOYEE")), { kind: "document.search", question });

    if (admin.kind !== "document.search" || employe.kind !== "document.search") throw new Error("mauvaise forme");
    expect(admin.extracts.length, "le témoin doit trouver quelque chose, sinon le test ne prouve rien").toBeGreaterThan(0);
    expect(employe.extracts, "des extraits ont fuité par le cache").toEqual([]);
  });

  it("le Super Admin, lui, obtient des extraits — même règle que `resolveDriveAccess`", async () => {
    // Le pendant du test précédent : si AUCUN rôle ne voyait rien, la garde « marcherait » en
    // ne rendant jamais rien, ce qui ne prouverait pas qu'elle distingue quoi que ce soit.
    const r = await inProcessPlatform.query(principalOf(utilisateur("SUPER_ADMIN")),
      { kind: "document.search", question: "contre-indication renale de la metformine" });
    expect(r.kind).toBe("document.search");
    if (r.kind === "document.search") expect(r.extracts.length).toBeGreaterThan(0);
  });
});

describe("search_documents — enregistré, classé, et dans le socle", () => {
  it("l'outil est bien dans le registre de pouvoirs", () => {
    // Un outil défini mais non enregistré n'existe pas : c'est ce qui est arrivé à l'entonnoir
    // entier, écrit, testé, mesuré — et jamais appelé.
    expect(POWER_TOOLS.map((t) => t.def.name)).toContain("search_documents");
  });

  it("il est classé, sinon le résolveur ne saurait pas quand l'envoyer", () => {
    expect(TOOL_DOMAINS_ALL).toHaveProperty("search_documents");
  });

  it("il fait partie du SOCLE, comme `search_everything`", () => {
    // L'une trouve OÙ le document est rangé, l'autre trouve la PHRASE. Avoir la première sans
    // la seconde laissait « que dit le contrat sur… ? » sans aucun moyen d'aboutir, quel que
    // soit le domaine détecté — et alors même que la réponse était indexée.
    expect(ALWAYS_ON as readonly string[]).toContain("search_documents");
    expect(ALWAYS_ON as readonly string[]).toContain("search_everything");
  });

  it("il refuse une question vide plutôt que de chercher n'importe quoi", async () => {
    const out = await KNOWLEDGE_TOOLS[0]!.run({ question: "  " }, utilisateur("EMPLOYEE"));
    expect(out).toMatch(/question/i);
  });

  it("l'absence de résultat DIT ce qui a été cherché", async () => {
    // « aucun extrait » et « je n'ai pas cherché » se ressemblent pour qui lit la réponse, et
    // ne se corrigent pas de la même façon.
    const out = await KNOWLEDGE_TOOLS[0]!.run(
      { question: "zzzqqq introuvable xyzzy plugh" },
      utilisateur("EMPLOYEE"),
    );
    expect(out).toMatch(/document\(s\) examiné\(s\)|indisponible/);
  });
});
