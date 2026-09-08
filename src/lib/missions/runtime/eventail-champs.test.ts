import { describe, expect, it } from "vitest";
import { vueParentEventail } from "@/lib/missions/runtime/worker";
import type { EtatEtape, EtatMission } from "@/lib/missions/runtime/store";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE PARENT D'UN ÉVENTAIL DOIT RENDRE CE QUE SES FILLES ONT LU.
 *
 * ── LE DÉFAUT, MESURÉ EN LIVE ───────────────────────────────────────────────────────────
 *
 * Plan : « lis les contrats Hetero » puis « consolide `{{lire:contrats.texte}}` ». Écrit
 * JUSTE — `read_document` rend bien `{ nom, lien, texte }`. Mais l'étape se démultiplie (un
 * document, une fille), et le parent ne rend plus le document : il rend la comptabilité du
 * déploiement. La référence tombe sur « l'étape a abouti mais ne rend pas « texte » », et
 * TOUTE la descendance meurt — 24 étapes sur une seule mission.
 *
 * Le planificateur ne peut pas savoir, en écrivant le plan, si la recherche amont rendra un
 * document ou vingt. C'est §118.20 vu du côté du déploiement, et c'est au MOTEUR de le fermer.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
const etape = (over: Partial<EtatEtape> & { key: string }): EtatEtape => ({
  id: over.key, title: over.key, workstream: "default", nodeType: "CAPABILITY",
  capability: "read_document", input: {}, status: "DONE", attempt: 1, maxAttempts: 3,
  idempotencyKey: null, result: null, receipt: null, recu: null, error: null, errorKind: null,
  waitFor: null, forEach: null, spec: null, recovery: null, needsIdempotencyKey: false,
  planVersion: 1, contournee: false, dependsOn: [], ...over,
});

const mission = (steps: EtatEtape[]): EtatMission => ({
  id: "m", status: "RUNNING", ownerId: "u", planVersion: 1, maxConcurrency: 4,
  acceptance: [], goalRaw: "o", objective: "o", planMeta: {}, horizonOuvert: false, steps,
});

describe("la vue d'un parent d'éventail", () => {
  const filles = [
    etape({ key: "lire#a.txt", result: { nom: "a.txt", lien: "/drive/1", texte: "CONTRAT A" } }),
    etape({ key: "lire#b.txt", result: { nom: "b.txt", lien: "/drive/2", texte: "CONTRAT B" } }),
  ];
  const parent = etape({
    key: "lire",
    result: { expanded: 2, done: 2, failed: 0, keys: ["lire#a.txt", "lire#b.txt"] },
  });
  const m = mission([parent, ...filles]);

  it("REMONTE chaque champ des filles comme une liste — c'est ce qui sauve `{{lire.texte}}`", () => {
    const vue = vueParentEventail(parent, m);
    expect(vue?.texte).toEqual(["CONTRAT A", "CONTRAT B"]);
    expect(vue?.nom).toEqual(["a.txt", "b.txt"]);
  });

  it("garde la COMPTABILITÉ intacte — elle est le contrat du moteur", () => {
    const vue = vueParentEventail(parent, m);
    expect(vue?.expanded).toBe(2);
    expect(vue?.done).toBe(2);
    expect(vue?.failed).toBe(0);
    expect(vue?.keys).toEqual(["lire#a.txt", "lire#b.txt"]);
    expect(vue?.resultats).toBeDefined();
  });

  it("un champ de fille qui porterait le nom d'un champ de comptabilité NE L'ÉCRASE PAS", () => {
    /**
     * CE QUI FERAIT TOMBER CE TEST : un `{ ...remontes, ...base }` inversé. `done` cesserait
     * d'être le compte du déploiement pour devenir une liste de valeurs de filles, et tout ce
     * qui lit la comptabilité — la réconciliation des éventails, le contrôle qualité — se
     * mettrait à lire autre chose que ce qu'il croit lire.
     */
    const m2 = mission([
      parent,
      etape({ key: "lire#a.txt", result: { done: "oui", texte: "A" } }),
      etape({ key: "lire#b.txt", result: { done: "non", texte: "B" } }),
    ]);
    const vue = vueParentEventail(parent, m2);
    expect(vue?.done, "la comptabilité a été écrasée par un champ de fille").toBe(2);
    expect(vue?.texte).toEqual(["A", "B"]);
  });

  it("rend `null` sur une étape ORDINAIRE — son résultat ne bouge pas d'un bit", () => {
    const simple = etape({ key: "seule", result: { nom: "x", texte: "T" } });
    expect(vueParentEventail(simple, mission([simple]))).toBeNull();
  });

  it("une fille qui n'a rien rendu ne fabrique pas de trou : elle est simplement absente", () => {
    const m3 = mission([
      parent,
      etape({ key: "lire#a.txt", result: { texte: "A" } }),
      etape({ key: "lire#b.txt", status: "FAILED", result: null }),
    ]);
    const vue = vueParentEventail(parent, m3);
    expect(vue?.texte).toEqual(["A"]);
  });
});
