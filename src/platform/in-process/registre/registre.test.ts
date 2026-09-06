import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { getAccess, type EffectiveAccess } from "@/lib/rbac";
import type { CurrentUser } from "@/lib/session";
import type { ReasonRequest } from "@/lib/missions/ports";
import { avancerMission, lancerMission } from "@/platform/in-process/missions/runtime";
import { RaisonneurScripte, planScripte, pour } from "@/platform/in-process/missions/fake-reasoner";
import { chargerEtat } from "@/lib/missions/runtime/store";
import { executePowerTool } from "@/lib/assistant/power-tools";
import {
  feuilleDeRouteErp, ficheDe, fichesDe, interrogerRegistre, manquePour, manquesObserves,
  mesuresParCapacite, sommaireDe,
} from "./index";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE REGISTRE DEPUIS LE VRAI POINT D'ENTRÉE (§14, §44).
 *
 * Un test qui composerait des fiches à partir de mesures injectées à la main ne prouverait rien :
 * il dirait que la fonction sait additionner. La question posée ici est celle du mandat — « si
 * quelqu'un utilise Adam normalement maintenant, ce composant peut-il être déclenché et produire
 * un effet utile ? » — et on y répond en LANÇANT une mission qui échoue vraiment.
 *
 * Le chemin complet est donc : `lancerMission` → `avancerMission` → l'étape échoue → le moteur
 * journalise `STEP_FAILED` avec le manque classé DANS le détail → `manquesObserves` le relit →
 * `feuilleDeRouteErp` le range. Aucun maillon n'est simulé.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
let dbOk = false;
try { await prisma.$queryRaw`SELECT 1`; dbOk = true; } catch { dbOk = false; }
const suite = dbOk ? describe : describe.skip;

const TAG = `__reg${Date.now().toString(36)}`;
let pdg: CurrentUser;
let missionId = "";

/** Un appel réel de l'outil, tel que la conversation le fait. `null` = l'outil n'a rien rendu. */
const outil = async (input: Record<string, unknown>): Promise<Record<string, any>> =>
  JSON.parse((await executePowerTool("registre_capacites", input, pdg)) ?? "null");

const criteres = ["Le message est préparé."];
const juge = pour("mission.judge", () => ({
  ok: true,
  data: { satisfied: false, confidence: 0.8, criteria: criteres.map((c) => ({ criterion: c, status: "NON_SATISFAIT", evidenceRefs: [] })), missing: ["la préparation n'a pas eu lieu"], contradictions: [], suggestedRecovery: null },
}));

/**
 * L'ÉTAPE QUI ÉCHOUE POUR DE VRAI. `gmail_prepare_mail` porte le contrat `FICHE` : sans compte
 * Google connecté, l'outil rend une PHRASE d'excuse, le contrôle de forme la refuse, et l'étape
 * tombe avec le message d'origine. C'est exactement le défaut mesuré qui a motivé les contrats —
 * on s'en sert ici comme d'un échec reproductible, sans truquer quoi que ce soit.
 */
const plan = () => planScripte({
  goal: "Préparer un message au partenaire.",
  reasoningComplexity: "B", executionScale: "S", acceptanceCriteria: criteres, workstreams: [],
  steps: [
    {
      key: "preparation", title: "Préparer le message", nodeType: "CAPABILITY", capability: "gmail_prepare_mail",
      inputs: [
        { key: "to", kind: "TEXT", value: `${TAG}@exemple.dz` },
        { key: "subject", kind: "TEXT", value: `${TAG} essai` },
        { key: "body", kind: "TEXT", value: "Bonjour, ceci est un essai du banc du registre." },
      ],
      dependsOn: [], completionCondition: "le message est préparé",
    },
  ],
  expectedArtifacts: [], approvalStrategy: "BUNDLE", completionCriteria: criteres[0], gaps: [], rationale: "banc du registre",
});

suite("registre des capacités — composé du réel, alimenté par de vrais échecs", () => {
  beforeAll(async () => {
    const u = await prisma.user.create({ data: { name: `${TAG} PDG`, email: `${TAG}pdg@amd.dz`, passwordHash: "x", role: "SUPER_ADMIN" }, select: { id: true, name: true, email: true, role: true } });
    pdg = { id: u.id, name: u.name, email: u.email, role: u.role, access: (await getAccess(u.id, u.role)) as EffectiveAccess, mustChangePassword: false };

    const cerveau = new RaisonneurScripte([pour("mission.plan", () => ({ ok: true, data: plan() })), juge]);
    const r = await lancerMission(pdg, "Prépare un message au partenaire.", { reasoner: cerveau, sansEnquete: true });
    if (!r.ok) throw new Error(r.error);
    missionId = r.missionId;
    let etat = await chargerEtat(missionId);
    for (let tour = 0; tour < 12 && etat && !["COMPLETED", "FAILED", "CANCELLED", "BLOCKED", "PARTIAL"].includes(etat.status); tour++) {
      await avancerMission(pdg, missionId, { reasoner: cerveau });
      etat = await chargerEtat(missionId);
    }
  }, 180_000);

  afterAll(async () => {
    await prisma.mission.deleteMany({ where: { ownerId: pdg.id } }).catch(() => {});
    await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } }).catch(() => {});
  }, 60_000);

  it("l'échec d'une étape porte son MANQUE classé dans le journal — pas une seconde table", async () => {
    const evts = await prisma.missionEvent.findMany({ where: { missionId, kind: "STEP_FAILED" }, select: { summary: true, detail: true } });
    expect(evts.length, "aucune étape en échec : le banc n'a rien à classer").toBeGreaterThan(0);
    const detail = evts[0]!.detail as { manque?: { nature?: string; ou?: string; suite?: string; preuve?: string; dette?: boolean } };
    expect(detail.manque, `détail sans manque : ${JSON.stringify(evts[0]!.detail)}`).toBeTruthy();
    expect(typeof detail.manque!.nature).toBe("string");
    // Le manque désigne la CAPACITÉ, pas le titre de l'étape : c'est ce qui rend la feuille de
    // route actionnable (« chez gmail_prepare_mail »), et non une liste de phrases.
    expect(detail.manque!.ou).toBe("gmail_prepare_mail");
    expect(detail.manque!.preuve).toBeTruthy();
    expect(detail.manque!.suite).toBeTruthy();
  });

  it("la feuille de route est une LECTURE du journal, et sépare la dette de l'exploitation", async () => {
    const manques = await manquesObserves({ depuis: new Date(Date.now() - 3_600_000) });
    expect(manques.length).toBeGreaterThan(0);
    expect(manques.every((m) => typeof m.quand === "string" && m.quand.length > 0)).toBe(true);

    const f = await feuilleDeRouteErp({ depuis: new Date(Date.now() - 3_600_000) });
    expect(f.total).toBeGreaterThan(0);
    const toutes = [...f.dette, ...f.exploitation];
    expect(toutes.some((l) => l.capacites.includes("gmail_prepare_mail"))).toBe(true);
    // Chaque ligne porte sa suite : une feuille de route sans « quoi faire » n'en est pas une.
    expect(toutes.every((l) => l.suite.length > 0 && l.occurrences >= 1 && l.priorite >= 1)).toBe(true);
    // Le tri est décroissant par priorité — sinon la lecture ne dit pas par où commencer.
    for (const groupe of [f.dette, f.exploitation]) {
      for (let i = 1; i < groupe.length; i += 1) expect(groupe[i - 1]!.priorite).toBeGreaterThanOrEqual(groupe[i]!.priorite);
    }
  });

  it("la fiabilité est MESURÉE sur les étapes réelles — et vaut null pour ce qui n'a jamais tourné", async () => {
    const mesures = await mesuresParCapacite({ depuis: new Date(Date.now() - 3_600_000) });
    const m = mesures.get("gmail_prepare_mail");
    expect(m, "la capacité exécutée doit être mesurée").toBeTruthy();
    expect(m!.appels).toBeGreaterThan(0);
    expect(m!.echecs).toBeGreaterThan(0);
    expect(m!.dernierEchec).toBeTruthy();

    const fiche = await ficheDe(pdg, "gmail_prepare_mail");
    expect(fiche).toBeTruthy();
    expect(fiche!.fiabilite.echantillon).toBeGreaterThan(0);
    expect(fiche!.fiabilite.taux).not.toBeNull();
    expect(fiche!.fiabilite.manque?.nature).toBeTruthy();
    // La dépense d'une capacité Google est un QUOTA, pas une facture inventée.
    expect(fiche!.depense.classe).toBe("QUOTA");
    expect(fiche!.depense.mesureUsd).toBeNull();
    expect(fiche!.dependances.join(" ")).toContain("Google");

    // Une capacité que la mission n'a pas touchée reste NON MESURÉE, pas « fiable ».
    const jamais = await ficheDe(pdg, "directory_lookup");
    expect(jamais!.fiabilite.taux).toBeNull();
    expect(jamais!.limites.join(" ")).toContain("INCONNUE");
  });

  it("le registre couvre TOUT le catalogue réel et dit ce qu'il ignore", async () => {
    const fiches = await fichesDe(pdg);
    expect(fiches.length).toBeGreaterThan(100);
    expect(new Set(fiches.map((f) => f.id)).size).toBe(fiches.length);
    // Chaque fiche porte les douze rubriques du mandat, jamais vides par accident.
    for (const f of fiches.slice(0, 40)) {
      expect(f.resume.length).toBeGreaterThan(3);
      expect(f.evenements.length).toBeGreaterThan(0);
      expect(f.dependances.length).toBeGreaterThan(0);
      expect(f.limites.length).toBeGreaterThan(0);
      expect(["AUCUN", "FAIBLE", "MOYEN", "ELEVE", "CRITIQUE"]).toContain(f.risque.niveau);
    }
    const s = await sommaireDe(pdg);
    expect(s.total).toBe(fiches.length);
    expect(s.jamaisExecutees + s.mesurees).toBe(s.total);
    expect(s.mesurees).toBeGreaterThan(0);
  });

  it("« vous n'y avez pas droit » ne se confond pas avec « rien ne sait le faire »", async () => {
    const viewer = await prisma.user.create({ data: { name: `${TAG} Viewer`, email: `${TAG}viewer@amd.dz`, passwordHash: "x", role: "VIEWER" }, select: { id: true, name: true, email: true, role: true } });
    const lecteur: CurrentUser = { id: viewer.id, name: viewer.name, email: viewer.email, role: viewer.role, access: (await getAccess(viewer.id, viewer.role)) as EffectiveAccess, mustChangePassword: false };

    const fiches = await fichesDe(lecteur);
    const refusees = fiches.filter((f) => f.autorisee === false);
    expect(refusees.length, "un VIEWER doit avoir des capacités hors de sa portée").toBeGreaterThan(0);
    // Le PDG, lui, les a : c'est bien le DROIT qui décide, pas le registre.
    const pourPdg = await fichesDe(pdg);
    const nomsPdg = new Set(pourPdg.filter((f) => f.autorisee).map((f) => f.id));
    expect(refusees.some((f) => nomsPdg.has(f.id))).toBe(true);

    // Et l'interrogation ÉCARTE en le disant, au lieu de rendre une liste vide muette.
    const r = await interrogerRegistre(lecteur, { texte: refusees[0]!.resume.slice(0, 60), autoriseeSeulement: true });
    const nomsRendus = new Set(r.resultats.map((f) => f.id));
    expect(nomsRendus.has(refusees[0]!.id)).toBe(false);
  });

  it("le manque se détecte AVANT de tenter, et il est nommé", async () => {
    const absente = await manquePour(pdg, "faire signer électroniquement ce contrat via DocuSign");
    expect(absente, "aucune capacité de signature électronique n'existe : le manque doit être nommé").toBeTruthy();
    expect(absente!.nature).toBe("CAPACITE_ABSENTE");
    expect(absente!.dette).toBe(true);

    // Et il ne fabrique pas de dette là où une capacité répond.
    expect(await manquePour(pdg, "chercher un document dans le drive")).toBeNull();
  });

  it("l'outil `registre_capacites` répond depuis le vrai registre d'outils", async () => {
    const cherche = await outil({ question: "chercher", besoin: "chercher un document dans le drive" });
    expect(cherche.ok).toBe(true);
    expect(cherche.examinees).toBeGreaterThan(100);
    expect(cherche.capacites.length).toBeGreaterThan(0);
    expect(cherche.capacites[0]).toHaveProperty("fiabilite");

    const fiche = await outil({ question: "fiche", capacite: "gmail_prepare_mail" });
    expect(fiche.ok).toBe(true);
    expect(fiche.contrat_de_sortie).toBe("FICHE");
    expect(String(fiche.fiabilite)).toMatch(/%|inconnue/);

    const manque = await outil({ question: "manque", besoin: "signer électroniquement un contrat via DocuSign" });
    expect(manque.ok).toBe(true);
    expect(manque.manque?.nature).toBe("CAPACITE_ABSENTE");
    expect(manque.a_dire).toContain("Ce n'est pas");

    const route = await outil({ question: "feuille_de_route", jours: 1 });
    expect(route.ok).toBe(true);
    expect(route.echecs_observes).toBeGreaterThan(0);

    const sommaire = await outil({ question: "sommaire" });
    expect(sommaire.ok).toBe(true);
    expect(sommaire.capacites).toBeGreaterThan(100);
    expect(String(sommaire.jamais_executees)).toContain("INCONNUE");
  });

  it("une capacité inconnue rend une réponse UTILE, pas une pile", async () => {
    const r = await outil({ question: "fiche", capacite: "capacite_qui_nexiste_pas" });
    expect(r.ok).toBe(false);
    expect(r.erreur).toContain("capacite_qui_nexiste_pas");
    expect(r.suite).toBeTruthy();
  });
});
