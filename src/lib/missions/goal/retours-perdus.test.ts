import { describe, expect, it, vi } from "vitest";
import type { EtatEtape, EtatMission } from "@/lib/missions/runtime/store";
import { lireReponse } from "@/lib/missions/runtime/reponse";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * UNE PERSONNE A RÉPONDU, ET LA MISSION CONCLUT SANS SA RÉPONSE.
 *
 * ── LE FAUX SUCCÈS, MESURÉ EN LIVE (§89) ────────────────────────────────────────────────
 *
 * Khaled Mansouri répond « Prix de cession Nivolex 84 500 DZD, Trastuzex 61 200 DZD ; forecast
 * 2027 : 1 240 et 890 unités ». L'attente se règle. L'étape de consolidation REÇOIT ce texte —
 * vérifié dans `WorkerRun.input`, « 84 500 » y est — et rend :
 *
 *     « Commercial : prix de cession en DZD, forecast et hypothèses NON FOURNIS. »
 *
 * Les deux livrables sont bâtis là-dessus : 0 chiffre du jeu d'essai sur 6 dans le classeur,
 * 0 sur 6 dans le deck. Toutes les étapes vertes, les fichiers s'ouvrent, la QA passe.
 *
 * ── CE QUE CE FICHIER PIN ───────────────────────────────────────────────────────────────
 *
 * Le troisième cas est le plus important : le chiffre présent UNIQUEMENT dans l'ENTRÉE de
 * l'étape aval ne compte pas. C'est le moteur qui l'y a mis ; le compter ferait passer le
 * contrôle au vert dans le cas EXACT qu'il existe pour attraper — la tautologie de §118.17.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

vi.mock("@/lib/prisma", () => ({ prisma: { missionArtifact: { findMany: async () => [] } } }));

const REPONSE = {
  from: "Khaled Mansouri",
  body: "Prix de cession Nivolex 84 500 DZD, Trastuzex 61 200 DZD ; forecast 2027 : 1 240 et 890 unités.",
  subject: "Prix de cession et forecast",
  attachmentNames: ["retour.pdf"],
};

const etape = (o: Partial<EtatEtape> & { key: string; status: string }): EtatEtape => ({
  id: o.key, title: o.key, workstream: "default", nodeType: "CAPABILITY", capability: "read_x",
  input: {}, attempt: 1, maxAttempts: 3, idempotencyKey: null, result: null, receipt: null,
  recu: null, error: null, errorKind: null, waitFor: null, forEach: null, spec: null, dependsOn: [],
  ...o,
} as unknown as EtatEtape);

const mission = (steps: EtatEtape[]): EtatMission => ({
  id: "m1", status: "RUNNING", ownerId: "u", planVersion: 1, maxConcurrency: 4,
  acceptance: ["c'est fait"], goalRaw: "o", objective: "o", planMeta: {}, steps,
} as unknown as EtatMission);

const attente = etape({
  key: "attente:commercial", title: "Réponse de Khaled", status: "DONE", nodeType: "WAIT_EVENT",
  capability: null, result: { reveillePar: "MESSAGE_RECEIVED", ...lireReponse(REPONSE), payload: REPONSE },
});

const constat = (r: { constats: { controle: string; ok: boolean; message: string }[] }) =>
  r.constats.find((c) => c.controle === "RETOURS_PERDUS");

describe("un retour humain recueilli ne se perd pas en silence", () => {
  it("la consolidation qui déclare « non fournis » ce qu'elle a reçu est REFUSÉE", async () => {
    const { controleComplet } = await import("@/lib/missions/goal/qa");
    const r = await controleComplet(mission([
      attente,
      etape({
        key: "consolider", status: "DONE", nodeType: "WORKER", capability: null,
        input: { donnees: "{{attente:commercial}}" },
        result: { consolidation: "Commercial : prix de cession en DZD, forecast et hypothèses non fournis." },
      }),
    ]));
    const c = constat(r)!;
    expect(c.ok).toBe(false);
    expect(c.message).toContain("84500");
    expect(r.aRejouer).toContain("attente:commercial");
  });

  it("la même consolidation qui PORTE les chiffres passe", async () => {
    const { controleComplet } = await import("@/lib/missions/goal/qa");
    const r = await controleComplet(mission([
      attente,
      etape({
        key: "consolider", status: "DONE", nodeType: "WORKER", capability: null,
        result: { consolidation: "Nivolex : prix de cession 84 500 DZD. Trastuzex : 61 200 DZD." },
      }),
    ]));
    expect(constat(r)!.ok).toBe(true);
  });

  it("LE CHIFFRE PRÉSENT SEULEMENT DANS L'ENTRÉE NE COMPTE PAS — sinon le contrôle est vide", async () => {
    const { controleComplet } = await import("@/lib/missions/goal/qa");
    const r = await controleComplet(mission([
      attente,
      etape({
        key: "consolider", status: "DONE", nodeType: "WORKER", capability: null,
        // Le moteur a injecté la réponse ici. La sortie, elle, n'en garde rien.
        input: { donnees: REPONSE.body },
        result: { consolidation: "aucun retour n'est fourni" },
      }),
    ]));
    expect(constat(r)!.ok).toBe(false);
  });

  it("un envoi EXTERNE qui transmet le chiffre à quelqu'un compte comme une survie", async () => {
    const { controleComplet } = await import("@/lib/missions/goal/qa");
    const r = await controleComplet(mission([
      attente,
      etape({
        key: "transmettre", status: "DONE", capability: "send_message",
        input: { to: "yacine@amd.dz", body: REPONSE.body },
        result: { envoye: true }, receipt: "rec-1",
        recu: { effect: "EXTERNAL_COMMUNICATION", issue: "SUCCES" } as unknown as EtatEtape["recu"],
      }),
    ]));
    expect(constat(r)!.ok).toBe(true);
  });

  it("une ÉCRITURE ERP qui pose le chiffre compte aussi — le fait a quitté la mission", async () => {
    const { controleComplet } = await import("@/lib/missions/goal/qa");
    const r = await controleComplet(mission([
      attente,
      etape({
        key: "poser-prix", status: "DONE", capability: "update_record",
        // Ce que l'écriture reçoit EST ce qu'elle écrit ; sa sortie n'est qu'un accusé.
        input: { entite: "PRODUIT:nivolex", champ: "prixCession", valeur: "84 500" },
        result: { updated: true }, receipt: "rec-2",
        recu: { effect: "INTERNAL_REVERSIBLE_WRITE", issue: "SUCCES" } as unknown as EtatEtape["recu"],
      }),
    ]));
    expect(constat(r)!.ok).toBe(true);
  });

  it("une attente sans aucun chiffre ne peut rien perdre — le contrôle ne l'invente pas", async () => {
    const { controleComplet } = await import("@/lib/missions/goal/qa");
    const r = await controleComplet(mission([
      etape({
        key: "attente:accord", status: "DONE", nodeType: "WAIT_EVENT", capability: null,
        result: { reveillePar: "MESSAGE_RECEIVED", ...lireReponse({ from: "Amel", body: "C'est bon pour moi." }) },
      }),
      etape({ key: "suite", status: "DONE", nodeType: "WORKER", capability: null, result: { note: "vu" } }),
    ]));
    expect(constat(r)!.ok).toBe(true);
  });
});

describe("la parole d'une personne se lit au premier niveau, toujours les mêmes clés", () => {
  it("un message donne qui a parlé, ce qu'il a dit et ce qu'il a joint", () => {
    expect(lireReponse(REPONSE)).toEqual({
      reponseDe: "Khaled Mansouri",
      contenu: `Prix de cession et forecast — ${REPONSE.body}`,
      pieces: ["retour.pdf"],
    });
  });

  it("les trois clés existent MÊME quand rien n'est lisible — c'est la valeur qui dit l'absence", () => {
    for (const rien of [null, undefined, 42, "texte", [], {}]) {
      expect(lireReponse(rien)).toEqual({ reponseDe: null, contenu: "", pieces: [] });
    }
  });
});
