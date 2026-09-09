import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@/lib/session";

vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));
let ACTEUR: CurrentUser | null = null;
vi.mock("@/lib/session", () => ({ requireUser: async () => ACTEUR, getUser: async () => ACTEUR }));

import { prisma } from "@/lib/prisma";
import { getAccess, type SessionUser } from "@/lib/rbac";
import { executerAction, resoudreFonction, echecDeclare } from "./executer";
import { CONTRATS_ACTIONS } from "./contrat.genere";
import { interdictionGenerique } from "./generique";

let dbOk = false;
try { await prisma.$queryRaw`SELECT 1`; dbOk = true; } catch { dbOk = false; }
const suite = dbOk ? describe : describe.skip;

const TAG = "__exegen__";

async function acteur(id: string, role: SessionUser["role"]): Promise<CurrentUser> {
  const access = await getAccess(id, role);
  const u = await prisma.user.findUniqueOrThrow({ where: { id } });
  return { id, name: u.name, email: u.email, role, access, mustChangePassword: false };
}

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE CHEMIN GÉNÉRIQUE, DE BOUT EN BOUT — et la question de §118.14 posée au parc entier.
 *
 * « Ce composant peut-il être déclenché et produire un effet utile ? » Un test qui vérifierait
 * `executerAction` sur une action fabriquée répondrait non. On part donc du contrat DÉRIVÉ,
 * on appelle l'action RÉELLE de l'écran, et on constate EN BASE.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
describe("AIGUILLAGE — chaque action décrite existe VRAIMENT dans son module", () => {
  it("les 715 se résolvent — le contrôle d'appelant que le compilateur ne fait pas ici", async () => {
    // §118.49 : un test qui vérifie le corps d'une fonction sans vérifier son appelant ne teste
    // rien. Ici l'artefact PRÉTEND que 715 fonctions existent ; on les résout toutes.
    const perdues: string[] = [];
    for (const c of CONTRATS_ACTIONS) {
      if (!(await resoudreFonction(c.fichier, c.fonction))) perdues.push(c.id);
    }
    expect(
      perdues,
      `Actions décrites mais introuvables dans leur module → \`npm run actions:contrat\` :\n${perdues.join("\n")}`,
    ).toEqual([]);
  }, 120_000);
});

suite("EXÉCUTION GÉNÉRIQUE — l'action de l'écran, appelée par son contrat", () => {
  let pdgId = "", assistantId = "", demandeId = "";

  beforeAll(async () => {
    const [pdg, assistant] = await Promise.all([
      prisma.user.create({ data: { name: `${TAG}pdg`, email: `${TAG}pdg@t.dz`, role: "SUPER_ADMIN", passwordHash: "x" } }),
      prisma.user.create({ data: { name: `${TAG}ass`, email: `${TAG}ass@t.dz`, role: "VIEWER", passwordHash: "x" } }),
    ]);
    pdgId = pdg.id; assistantId = assistant.id;
  });

  afterAll(async () => {
    await prisma.administrativeRequest.deleteMany({ where: { title: { startsWith: TAG } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } });
  });

  it("CRÉE réellement — contrat dérivé, zéro fiche écrite, et la ligne est EN BASE", async () => {
    ACTEUR = await acteur(pdgId, "SUPER_ADMIN");
    const r = await executerAction(ACTEUR, "admin-request-actions:createRequest", {
      title: `${TAG}Demande générique`, type: "PURCHASE", priority: "HIGH",
      description: "créée par le chemin générique",
    });
    expect(r.ok, JSON.stringify(r)).toBe(true);

    const ligne = await prisma.administrativeRequest.findFirst({ where: { title: `${TAG}Demande générique` } });
    expect(ligne, "aucune ligne en base : le succès annoncé serait un faux succès").not.toBeNull();
    expect(ligne!.type).toBe("PURCHASE");
    expect(ligne!.priority).toBe("HIGH");
    expect(ligne!.description).toBe("créée par le chemin générique");
    demandeId = ligne!.id;
  });

  it("MODIFIE réellement, par l'action de l'écran", async () => {
    ACTEUR = await acteur(pdgId, "SUPER_ADMIN");
    const r = await executerAction(ACTEUR, "admin-request-actions:updateRequestStatus", {
      id: demandeId, status: "IN_PROGRESS",
    });
    expect(r.ok, JSON.stringify(r)).toBe(true);
    const ligne = await prisma.administrativeRequest.findUniqueOrThrow({ where: { id: demandeId } });
    expect(ligne.status).toBe("IN_PROGRESS");
  });

  it("LA PORTE DE L'ACTION tient — l'exécuteur n'est pas une porte dérobée", async () => {
    // L'exécuteur ne vérifie AUCUN droit lui-même : c'est l'action qui refuse, comme au clic.
    // Et le refus remonte en ÉCHEC (`motif: "refusee"`), pas en succès : c'est §118.25 par le
    // VRAI point d'entrée, là où le test unitaire ci-dessus n'exerce que la lecture du retour.
    ACTEUR = await acteur(assistantId, "VIEWER");
    const r = await executerAction(ACTEUR, "admin-request-actions:updateRequestStatus", {
      id: demandeId, status: "DONE",
    });
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.motif, JSON.stringify(r)).toBe("refusee");
    const ligne = await prisma.administrativeRequest.findUniqueOrThrow({ where: { id: demandeId } });
    expect(ligne.status).toBe("IN_PROGRESS"); // rien n'a bougé
  });

  it("§118.25 — l'échec déclaré est lu sur les ÉCRITURES, et seulement sur elles", () => {
    // La première version de ce banc affirmait `r.ok === true` sur un appel ayant rendu
    // « Non autorisé. » sans rien créer : `ok` disait « l'appel a eu lieu », et l'échec dormait
    // dans `retour`. Le faux succès était dans le banc avant d'être dans le produit.
    const ecrivante = { ecrit: true } as Parameters<typeof echecDeclare>[0];
    expect(echecDeclare(ecrivante, { ok: false, error: "Non autorisé." })).toBe("Non autorisé.");
    expect(echecDeclare(ecrivante, { ok: false })).toMatch(/sans donner de motif/);
    expect(echecDeclare(ecrivante, { ok: true, id: "x" })).toBeNull();

    // LA RESTRICTION, et c'est la moitié de la règle : sur une LECTURE, `ok: false` peut être
    // une réponse légitime (« non conforme »), et refuser à tort est strictement pire que le
    // défaut qu'on corrige. Sans cette ligne, la restriction serait écrite et non tenue.
    const lisante = { ecrit: false } as Parameters<typeof echecDeclare>[0];
    expect(echecDeclare(lisante, { ok: false, error: "non conforme" })).toBeNull();

    // Et ce qu'on ne lit pas à coup sûr ne devient pas un échec (§118.16).
    expect(echecDeclare(ecrivante, "une chaîne")).toBeNull();
    expect(echecDeclare(ecrivante, undefined)).toBeNull();
  });

  it("AUTO-ESCALADE : refusée AVANT tout appel — le module n'est même pas chargé", async () => {
    ACTEUR = await acteur(pdgId, "SUPER_ADMIN");
    const avant = await prisma.user.findUniqueOrThrow({ where: { id: assistantId } });
    const r = await executerAction(ACTEUR, "admin-actions:updateUserRole", {
      userId: assistantId, role: "SUPER_ADMIN",
    });
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.motif).toBe("interdite");
    expect(r.ok === false && r.message).toMatch(/écran d'administration/);
    // Le PDG a pourtant TOUS les droits : le refus n'est pas une question de permission, c'est
    // une propriété d'Adam. La ligne n'a pas bougé.
    expect((await prisma.user.findUniqueOrThrow({ where: { id: assistantId } })).role).toBe(avant.role);
  });

  it("un champ INVENTÉ est refusé avant l'appel — jamais ignoré en silence", async () => {
    ACTEUR = await acteur(pdgId, "SUPER_ADMIN");
    const r = await executerAction(ACTEUR, "admin-request-actions:createRequest", {
      title: `${TAG}xx`, type: "PURCHASE", champInexistant: "42",
    });
    expect(r.ok === false && r.motif).toBe("entree");
    expect(await prisma.administrativeRequest.findFirst({ where: { title: `${TAG}xx` } })).toBeNull();
  });

  it("une valeur hors énum est refusée AVEC les valeurs admises", async () => {
    ACTEUR = await acteur(pdgId, "SUPER_ADMIN");
    const r = await executerAction(ACTEUR, "admin-request-actions:createRequest", {
      title: `${TAG}yy`, type: "ACHAT URGENT",
    });
    expect(r.ok === false && r.message).toContain("PURCHASE");
    expect(await prisma.administrativeRequest.findFirst({ where: { title: `${TAG}yy` } })).toBeNull();
  });

  it("une action INCONNUE le dit — pas de « je ne peux pas » vague", async () => {
    ACTEUR = await acteur(pdgId, "SUPER_ADMIN");
    const r = await executerAction(ACTEUR, "n-existe-pas:duTout", {});
    expect(r.ok === false && r.motif).toBe("inconnue");
  });

  it("DETTE MESURÉE — les actions d'un module RETIRÉ refusent tout le monde", async () => {
    // Trouvé en écrivant ce banc : `BUSINESS_DEVELOPMENT` est retiré du service (2026-09,
    // « Market Intelligence »), donc `getAccess` ne l'accorde à personne — Super Admin compris —
    // et ses 34 actions rendent « Non autorisé. » quoi qu'il arrive. Ce n'est PAS un défaut du
    // chemin générique : c'est la garde de `modules-retired.ts` qui fonctionne. Mais l'écran
    // « BD › Projets » demandé par le dirigeant vit dans ce module, donc il est INATTEIGNABLE.
    // Le test constate le fait pour qu'il cesse d'être invisible ; la décision de rouvrir le
    // module appartient au dirigeant, pas au code.
    ACTEUR = await acteur(pdgId, "SUPER_ADMIN");
    const r = await executerAction(ACTEUR, "bd-project-actions:createBdProject", { name: `${TAG}dette` });
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.motif).toBe("refusee");
    expect(await prisma.bdProject.findFirst({ where: { name: `${TAG}dette` } })).toBeNull();
    console.info("[MODULE_RETIRE] BUSINESS_DEVELOPMENT est retiré : « BD › Projets » et ses actions refusent tout le monde.");
  });

  it("MESURE — combien d'actions le chemin générique ouvre réellement", () => {
    const lisibles = CONTRATS_ACTIONS.filter((c) => !c.illisible);
    const ouvertes = lisibles.filter((c) => !interdictionGenerique(c));
    console.info(
      `[CHEMIN_GENERIQUE] ${ouvertes.length} actions ouvertes sur ${CONTRATS_ACTIONS.length} — `
      + `${lisibles.length - ouvertes.length} refusées par conception, `
      + `${CONTRATS_ACTIONS.length - lisibles.length} non descriptibles`,
    );
    expect(ouvertes.length).toBeGreaterThan(500);
  });
});
