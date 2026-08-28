/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE RECOURS, DEPUIS LE MOTEUR — pas depuis ses propres fonctions.
 *
 * ── POURQUOI CE FICHIER EXISTE ───────────────────────────────────────────────────────────
 *
 * L'audit Frontier a montré un défaut qui ne se voyait pas : `recovery/strategy.ts` avait des
 * tests unitaires verts, et AUCUN chemin de production ne l'appelait. Saboter
 * `estFinPossible → return true` ne faisait tomber que ses propres bancs.
 *
 * Ce fichier-ci part donc d'une mission ÉCRITE EN BASE et appelle `avancer()`, le moteur réel.
 * Aucun test ici n'appelle `prochaineStrategie`, `prochaineSource` ou `deciderRecours`
 * directement : si le moteur cesse de les consulter, ces tests tombent. C'est toute la
 * différence entre « la fonction marche » et « le système s'en sert ».
 *
 * ── LE SCÉNARIO DE RÉFÉRENCE ─────────────────────────────────────────────────────────────
 *
 * « Trouve le contrat de la consultante médicale. » Le Drive rend une convention speaker :
 * même personne, même période, le mot « consultante » dans le titre. Lexicalement, c'est un
 * quasi-sosie. Structurellement, `type = SPEAKER_CONVENTION` n'est pas `CONTRAT`, et c'est ce
 * décalage-là — et lui seul — qui déclenche le recours.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { avancer, type StepOutcome } from "@/lib/missions/runtime/engine";
import type { CapabilityCall, CapabilityOutcome, CapabilityRunner, MissionActor } from "@/lib/missions/ports";
import { historiqueDe } from "@/lib/missions/recovery/coordinator";

let dbOk = false;
try { await prisma.$queryRaw`SELECT 1`; dbOk = true; } catch { dbOk = false; }
const suite = dbOk ? describe : describe.skip;

const TAG = `__recov${Date.now()}`;
const cree: string[] = [];
let compteurUsers = 0;

afterAll(async () => {
  if (!dbOk) return;
  await prisma.mission.deleteMany({ where: { id: { in: cree } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } });
});

/** Un acteur humain : ni agent, ni auto-escalade — le recours ne doit rien y changer. */
const acteur: MissionActor = { userId: "u", label: "PDG", isAgent: false };

/**
 * Une mission d'UNE étape, écrite en base comme le compilateur l'écrirait.
 *
 * `spec.attendu` porte les critères d'acceptation ; c'est la colonne que le schéma décrivait
 * déjà comme « ce que l'étape attend » et que personne ne lisait.
 */
async function missionAvecEtape(attendu: Record<string, unknown>, titre = "Trouver le contrat"): Promise<{ id: string; stepId: string }> {
  compteurUsers += 1;
  const u = await prisma.user.create({
    data: { email: `${TAG}-${compteurUsers}@test.dz`, name: "PDG", role: "DIRECTION", passwordHash: "x" },
    select: { id: true },
  });
  const m = await prisma.mission.create({
    data: {
      ownerId: u.id, title: `${TAG} ${titre}`, objective: titre, kind: "RUNTIME",
      status: "RUNNING", goalRaw: titre,
    },
    select: { id: true },
  });
  cree.push(m.id);
  const s = await prisma.missionStep.create({
    data: {
      missionId: m.id, key: "s1", title: titre, capability: "search_documents",
      nodeType: "CAPABILITY", status: "READY", input: { requete: "contrat consultante médicale" },
      spec: { attendu } as never, maxAttempts: 3,
    },
    select: { id: true },
  });
  return { id: m.id, stepId: s.id };
}

/** Un exécutant qui répond DIFFÉREMMENT selon le grenier qu'on lui désigne. */
function runnerParSource(reponses: Record<string, unknown>, defaut: unknown): CapabilityRunner & { appels: string[] } {
  const appels: string[] = [];
  return {
    appels,
    async run(call: CapabilityCall): Promise<CapabilityOutcome> {
      const source = String((call.input as Record<string, unknown>).source ?? "DEFAUT");
      appels.push(source);
      return { ok: true, output: source in reponses ? reponses[source] : defaut } as CapabilityOutcome;
    },
  };
}

const CONVENTION = { type: "SPEAKER_CONVENTION", titre: "Convention speaker — consultante médicale", id: "doc-1" };
const CONTRAT = { type: "CONTRAT", titre: "Contrat de consulting — Dr. Mouffok", id: "doc-2" };

suite("§86 — le recours local, vu depuis le moteur", () => {
  it("un document PLAUSIBLE MAIS FAUX ne termine pas l'étape : le moteur change de grenier et trouve le bon", async () => {
    const { id, stepId } = await missionAvecEtape({ type: "CONTRAT", cible: "CONTRAT" });
    // Legal rend le vrai contrat ; partout ailleurs, la convention speaker.
    const runner = runnerParSource({ LEGAL: CONTRAT }, CONVENTION);

    await avancer(id, acteur, { runner, maxTours: 20 });

    const step = await prisma.missionStep.findUniqueOrThrow({
      where: { id: stepId },
      select: { status: true, result: true, recovery: true },
    });

    // L'étape aboutit — et sur le BON document.
    expect(step.status).toBe("DONE");
    expect((step.result as { type: string }).type).toBe("CONTRAT");

    // Et elle y est arrivée en changeant de source, pas en réessayant la même.
    const h = historiqueDe(step.recovery);
    expect(h.tentees).toContain("AUTRE_SOURCE");
    expect(h.sources.length).toBeGreaterThan(0);
    // L'ordre des greniers pour un CONTRAT commence par LEGAL — le moteur l'a bien consulté.
    expect(runner.appels).toContain("LEGAL");
  });

  it("le premier résultat n'est JAMAIS retenu quand il est incompatible — knownMismatchStopRate = 0", async () => {
    const { id, stepId } = await missionAvecEtape({ type: "CONTRAT", cible: "CONTRAT" });
    // Aucune source ne détient le contrat : partout la convention.
    const runner = runnerParSource({}, CONVENTION);

    await avancer(id, acteur, { runner, maxTours: 30 });

    const step = await prisma.missionStep.findUniqueOrThrow({
      where: { id: stepId }, select: { status: true, result: true, errorKind: true, error: true, recovery: true },
    });

    // Le point du test : l'étape n'a PAS conclu sur la convention speaker.
    expect(step.status).not.toBe("DONE");
    expect(step.errorKind).toBe("INCOMPATIBLE_RESULT");
    // Et le blocage NOMME les greniers ouverts (§24) plutôt que de dire « impossible ».
    const h = historiqueDe(step.recovery);
    expect(h.sources.length).toBeGreaterThanOrEqual(2);
  });

  it("NOT_FOUND : une source vide n'arrête pas la recherche", async () => {
    const { id, stepId } = await missionAvecEtape({ type: "CONTRAT", cible: "CONTRAT" });
    const runner = runnerParSource({ HR: CONTRAT }, { items: [] });

    await avancer(id, acteur, { runner, maxTours: 30 });

    const step = await prisma.missionStep.findUniqueOrThrow({
      where: { id: stepId }, select: { status: true, result: true, recovery: true },
    });
    expect(step.status).toBe("DONE");
    expect((step.result as { type: string }).type).toBe("CONTRAT");
    expect(historiqueDe(step.recovery).sources).toContain("HR");
  });

  it("INSUFFICIENT_DATA : quatre pièces sur cinq n'est pas un succès", async () => {
    const { id, stepId } = await missionAvecEtape({ nombre: 5, cible: "CONTRAT" }, "Récupérer les 5 contrats");
    const quatre = { items: [1, 2, 3, 4] };
    const cinq = { items: [1, 2, 3, 4, 5] };
    const runner = runnerParSource({ DRIVE: cinq }, quatre);

    await avancer(id, acteur, { runner, maxTours: 30 });

    const step = await prisma.missionStep.findUniqueOrThrow({
      where: { id: stepId }, select: { status: true, result: true },
    });
    expect(step.status).toBe("DONE");
    expect((step.result as { items: number[] }).items).toHaveLength(5);
  });

  it("la boucle est impossible : une source n'est jamais visitée deux fois", async () => {
    const { id, stepId } = await missionAvecEtape({ type: "CONTRAT", cible: "CONTRAT" });
    const runner = runnerParSource({}, CONVENTION);

    await avancer(id, acteur, { runner, maxTours: 40 });

    const step = await prisma.missionStep.findUniqueOrThrow({ where: { id: stepId }, select: { recovery: true } });
    const h = historiqueDe(step.recovery);
    const vues = h.journal.map((j) => j.source).filter(Boolean);
    expect(new Set(vues).size).toBe(vues.length); // aucun doublon
    // Et la persévérance reste BORNÉE : pas de recours infini.
    expect(h.journal.length).toBeLessThanOrEqual(6);
  });

  it("MISSING_PERMISSION ne se contourne pas : aucune autre source n'est essayée", async () => {
    const { id, stepId } = await missionAvecEtape({ type: "CONTRAT", cible: "CONTRAT" });
    const runner: CapabilityRunner = {
      async run(): Promise<CapabilityOutcome> {
        return { ok: false, error: { kind: "MISSING_PERMISSION", message: "accès refusé", retryable: false } } as CapabilityOutcome;
      },
    };

    await avancer(id, acteur, { runner, maxTours: 20 });

    const step = await prisma.missionStep.findUniqueOrThrow({
      where: { id: stepId }, select: { status: true, errorKind: true, recovery: true },
    });
    expect(step.errorKind).toBe("MISSING_PERMISSION");
    // §108 — un droit ne s'obtient pas en insistant. Aucun grenier alternatif n'a été ouvert.
    expect(historiqueDe(step.recovery).sources).toEqual([]);
  });

  it("un résultat SANS critère d'acceptation passe tel quel — on ne fabrique pas d'exigence", async () => {
    const { id, stepId } = await missionAvecEtape({}, "Étape sans critère");
    const runner = runnerParSource({}, CONVENTION);

    await avancer(id, acteur, { runner, maxTours: 10 });

    const step = await prisma.missionStep.findUniqueOrThrow({ where: { id: stepId }, select: { status: true, recovery: true } });
    expect(step.status).toBe("DONE");
    expect(historiqueDe(step.recovery).journal).toEqual([]);
  });

  it("la reprise après panne ne rouvre pas un grenier déjà visité", async () => {
    const { id, stepId } = await missionAvecEtape({ type: "CONTRAT", cible: "CONTRAT" });

    // Premier passage : le moteur ouvre LEGAL, qui ne rend pas le bon type.
    const r1 = runnerParSource({}, CONVENTION);
    await avancer(id, acteur, { runner: r1, maxTours: 2 });
    const apres1 = historiqueDe(
      (await prisma.missionStep.findUniqueOrThrow({ where: { id: stepId }, select: { recovery: true } })).recovery,
    );
    expect(apres1.sources.length).toBeGreaterThan(0);

    // « Crash » : nouveau moteur, nouvel exécutant. L'historique vient de la BASE, pas de la
    // mémoire du processus — c'est ce qui rend la persévérance reprenable.
    const r2 = runnerParSource({}, CONVENTION);
    await avancer(id, acteur, { runner: r2, maxTours: 4 });
    expect(r2.appels).not.toContain(apres1.sources[0]);
  });
});

/**
 * LE TEST QUI GARDE LE BRANCHEMENT LUI-MÊME.
 *
 * Les cas ci-dessus vérifient un COMPORTEMENT ; celui-ci vérifie que ce comportement passe
 * bien par les briques nommées. Sans lui, on pourrait réimplémenter le recours dans le moteur
 * et laisser `recovery/` re-mourir sans que rien ne tombe.
 */
suite("le moteur consulte bien l'échelle, et pas une copie", () => {
  it("l'historique persisté porte des noms de STRATÉGIES et de SOURCES du module recovery", async () => {
    const { id, stepId } = await missionAvecEtape({ type: "CONTRAT", cible: "CONTRAT" });
    await avancer(id, acteur, { runner: runnerParSource({}, CONVENTION), maxTours: 30 });

    const h = historiqueDe(
      (await prisma.missionStep.findUniqueOrThrow({ where: { id: stepId }, select: { recovery: true } })).recovery,
    );
    const { STRATEGIES } = await import("@/lib/missions/recovery/strategy");
    const { SOURCES } = await import("@/lib/missions/recovery/sources");
    for (const s of h.tentees) expect(STRATEGIES).toContain(s);
    for (const s of h.sources) expect(SOURCES).toContain(s);
    expect(h.journal.length).toBeGreaterThan(0);
  });

  it("un événement STEP_RECOVERY est journalisé — la persévérance est observable (§70)", async () => {
    const { id } = await missionAvecEtape({ type: "CONTRAT", cible: "CONTRAT" });
    await avancer(id, acteur, { runner: runnerParSource({ LEGAL: CONTRAT }, CONVENTION), maxTours: 20 });

    const evts = await prisma.missionEvent.findMany({ where: { missionId: id, kind: "STEP_RECOVERY" } });
    expect(evts.length).toBeGreaterThan(0);
    // §73 — c'est un événement de RUNTIME, pas un BusinessEvent.
    expect(evts[0].summary).toMatch(/AUTRE_SOURCE|ELARGIR|RETRY/);
  });
});

/** Une garde de type : le moteur doit continuer d'accepter les sorties d'étape existantes. */
const _typeOk: StepOutcome = { status: "DONE", result: CONTRAT };
void _typeOk;
