import { describe, expect, it } from "vitest";
import { aReparer, controlerQualite, evaluerObjectif, type EtapeObservee, type JugeObjectif } from "./evaluate";
import {
  CERTITUDES, ECHELLE, ERROR_KINDS, estFinPossible, presenter, prochaineStrategie,
  rejouable, utilisablePourAgir,
} from "@/lib/missions/recovery/strategy";
import { CIBLES, ORDRE, compteRendu, prochaineSource } from "@/lib/missions/recovery/sources";

const etape = (key: string, status: EtapeObservee["status"], extra: Partial<EtapeObservee> = {}): EtapeObservee => ({
  key, title: key, status, nodeType: "CAPABILITY", receipt: null,
  attempt: status === "FAILED" ? 3 : 1, maxAttempts: 3, result: null, ...extra,
});

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * §22 — LE CONTRÔLE QUALITÉ EST DE L'ARITHMÉTIQUE, ET ELLE NE SE DISCUTE PAS.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
describe("contrôle qualité", () => {
  it("compte les étapes EFFECTIVES et ignore les nœuds de contrôle", () => {
    const qa = controlerQualite([
      etape("a", "DONE"),
      etape("b", "DONE"),
      etape("porte", "DONE", { nodeType: "APPROVAL" }),
      etape("fin", "DONE", { nodeType: "JOIN" }),
    ]);
    // Deux effectives, pas quatre : la réussite d'une jonction ne prouve rien sur l'objectif.
    expect(qa.attendus).toBe(2);
    expect(qa.faits).toBe(2);
    expect(qa.ok).toBe(true);
  });

  it("31 envois sur 33 : le compte est 31/33, jamais 1/1", () => {
    const steps: EtapeObservee[] = [
      etape("voeux", "DONE", { result: { expanded: 33 } }),
      ...Array.from({ length: 31 }, (_, i) => etape(`voeux#e${i}`, "DONE")),
      etape("voeux#e31", "FAILED"),
      etape("voeux#e32", "FAILED"),
    ];
    const qa = controlerQualite(steps);
    expect(qa.attendus).toBe(33);
    expect(qa.faits).toBe(31);
    expect(qa.ok).toBe(false);
    expect(qa.manquants.map((m) => m.key)).toEqual(["voeux#e31", "voeux#e32"]);
    expect(qa.resume).toMatch(/31\/33/);
  });

  it("le MODÈLE d'un éventail déployé n'est pas compté en double", () => {
    const qa = controlerQualite([
      etape("m", "DONE", { result: { expanded: 2 } }),
      etape("m#a", "DONE"),
      etape("m#b", "DONE"),
    ]);
    expect(qa.attendus).toBe(2);
  });

  it("DÉNONCE un éventail qui annonce plus d'itérations qu'il n'en existe", () => {
    const qa = controlerQualite([
      etape("m", "DONE", { result: { expanded: 33 } }),
      etape("m#a", "DONE"),
    ]);
    expect(qa.ok).toBe(false);
    expect(qa.nonVerifiables[0]).toMatch(/annonce 33 itérations mais 1 existent/);
  });

  it("une étape SAUTÉE sort du dénominateur : ni succès, ni manque", () => {
    const qa = controlerQualite([etape("a", "DONE"), etape("b", "SKIPPED")]);
    expect(qa.attendus).toBe(1);
    expect(qa.faits).toBe(1);
    expect(qa.ok).toBe(true);
  });

  it("distingue un échec réparable d'un échec définitif dans le motif", () => {
    const qa = controlerQualite([
      etape("a", "FAILED", { attempt: 1, maxAttempts: 3 }),
      etape("b", "FAILED", { attempt: 3, maxAttempts: 3 }),
    ]);
    expect(qa.manquants[0].pourquoi).toMatch(/réparable/);
    expect(qa.manquants[1].pourquoi).toMatch(/épuisées/);
  });

  it("une mission sans étape effective ne passe PAS le contrôle par défaut", () => {
    expect(controlerQualite([etape("j", "DONE", { nodeType: "JOIN" })]).ok).toBe(false);
    expect(controlerQualite([]).ok).toBe(false);
  });

  it("ne rend à réparer QUE les manquantes — pas les 31 déjà parties", () => {
    const steps: EtapeObservee[] = [
      ...Array.from({ length: 31 }, (_, i) => etape(`v#${i}`, "DONE")),
      etape("v#31", "FAILED"),
    ];
    expect(aReparer(controlerQualite(steps))).toEqual(["v#31"]);
  });
});

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * §20 — CE QUI EMPÊCHE UNE MISSION DE SE DÉCLARER FINIE PARCE QU'ELLE A FINI DE TOURNER.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
describe("satisfaction de l'objectif", () => {
  const juge = (satisfait: boolean, raison = "vérifié"): JugeObjectif => ({
    juger: async () => ({ satisfait, raison }),
  });

  it("tant que la mission travaille, la question ne se pose pas", async () => {
    const v = await evaluerObjectif({
      objectif: "o", criteres: ["c"], steps: [etape("a", "RUNNING")], juge: juge(true),
    });
    expect(v.satisfait).toBe(false);
    expect(v.raison).toMatch(/pas fini de travailler/);
  });

  it("un contrôle qui ne passe pas est un NON QUE RIEN NE RENVERSE — pas même un juge enthousiaste", async () => {
    const v = await evaluerObjectif({
      objectif: "o", criteres: ["c"],
      steps: [etape("a", "DONE"), etape("b", "FAILED")],
      juge: juge(true, "tout va bien"),
    });
    expect(v.satisfait).toBe(false);
    expect(v.avisModele).toBeNull();
    expect(v.raison).toMatch(/contrôle ne passe pas/);
  });

  it("sans critère d'acceptation, on ne peut PAS conclure « oui »", async () => {
    const v = await evaluerObjectif({
      objectif: "o", criteres: [], steps: [etape("a", "DONE")], juge: juge(true),
    });
    expect(v.satisfait).toBe(false);
    expect(v.raison).toMatch(/Aucun critère/);
  });

  it("SANS JUGE, la mission n'est PAS déclarée atteinte — même tout vert", async () => {
    const v = await evaluerObjectif({ objectif: "o", criteres: ["c"], steps: [etape("a", "DONE")] });
    expect(v.satisfait).toBe(false);
    expect(v.raison).toMatch(/aucun juge/);
    // Et le rapport ne cache pas que le travail, lui, a abouti.
    expect(v.raison).toMatch(/1\/1/);
  });

  it("UN JUGE QUI TOMBE NE VAUT PAS UN OUI — une panne ne conclut pas une mission", async () => {
    const casse: JugeObjectif = { juger: async () => { throw new Error("fournisseur indisponible"); } };
    const v = await evaluerObjectif({ objectif: "o", criteres: ["c"], steps: [etape("a", "DONE")], juge: casse });
    expect(v.satisfait).toBe(false);
    expect(v.avisModele).toBeNull();
    expect(v.raison).toMatch(/fournisseur indisponible/);
  });

  it("tout vert ET un juge convaincu : alors seulement, oui", async () => {
    const v = await evaluerObjectif({
      objectif: "écrire à tout le monde", criteres: ["chacun a reçu son message"],
      steps: [etape("a", "DONE"), etape("b", "DONE")], juge: juge(true, "les 2 messages sont partis"),
    });
    expect(v.satisfait).toBe(true);
    expect(v.avisModele).toBe(true);
  });

  it("un juge qui dit non fait foi, même quand tout est vert", async () => {
    const v = await evaluerObjectif({
      objectif: "o", criteres: ["c"], steps: [etape("a", "DONE")],
      juge: juge(false, "le message ne parle pas du sujet demandé"),
    });
    expect(v.satisfait).toBe(false);
    expect(v.raison).toMatch(/ne parle pas du sujet/);
  });
});

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * §74-78 — NE JAMAIS S'ARRÊTER À LA PREMIÈRE DIFFICULTÉ.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
describe("échelle de récupération", () => {
  it("chaque cause a une échelle non vide", () => {
    for (const k of ERROR_KINDS) {
      expect(ECHELLE[k], `${k} sans échelle`).toBeDefined();
      expect(ECHELLE[k].length, `${k} sans recours`).toBeGreaterThan(0);
    }
  });

  it("« pas trouvé » cherche AILLEURS avant de renoncer (§77)", () => {
    expect(prochaineStrategie("NOT_FOUND", [])).toBe("AUTRE_SOURCE");
    expect(prochaineStrategie("NOT_FOUND", ["AUTRE_SOURCE"])).toBe("ELARGIR");
    expect(prochaineStrategie("NOT_FOUND", ["AUTRE_SOURCE", "ELARGIR"])).toBe("DEMANDER_HUMAIN");
    expect(prochaineStrategie("NOT_FOUND", ["AUTRE_SOURCE", "ELARGIR", "DEMANDER_HUMAIN"]))
      .toBe("DECLARER_INCONNU");
  });

  it("§108 — un DROIT MANQUANT ne se réessaie pas, ne s'élargit pas, ne se contourne pas", () => {
    expect(ECHELLE.MISSING_PERMISSION).toEqual(["ESCALADER"]);
    expect(rejouable("MISSING_PERMISSION")).toBe(false);
    expect(ECHELLE.MISSING_PERMISSION).not.toContain("AUTRE_SOURCE");
    expect(ECHELLE.MISSING_PERMISSION).not.toContain("ELARGIR");
  });

  it("une panne de fournisseur se réessaie ; un résultat incompatible se replanifie", () => {
    expect(prochaineStrategie("PROVIDER_FAILURE", [])).toBe("RETRY");
    expect(rejouable("PROVIDER_FAILURE")).toBe(true);
    expect(prochaineStrategie("INCOMPATIBLE_RESULT", [])).toBe("REPLANIFIER");
    expect(rejouable("INCOMPATIBLE_RESULT")).toBe(false);
  });

  it("une ambiguïté DEMANDE, elle ne devine pas", () => {
    expect(prochaineStrategie("AMBIGUOUS_ENTITY", [])).toBe("DEMANDER_HUMAIN");
    expect(ECHELLE.AMBIGUOUS_ENTITY).not.toContain("ELARGIR");
  });

  it("§76 — ON NE PEUT PAS CONCLURE tant qu'il reste un recours", () => {
    expect(estFinPossible({ objectifAtteint: false, kind: "NOT_FOUND", dejaTentees: [] })).toBe(false);
    expect(estFinPossible({
      objectifAtteint: false, kind: "NOT_FOUND",
      dejaTentees: ["AUTRE_SOURCE", "ELARGIR", "DEMANDER_HUMAIN"],
    })).toBe(false);
    // Épuisée : là, et là seulement, s'arrêter est honnête.
    expect(estFinPossible({
      objectifAtteint: false, kind: "NOT_FOUND",
      dejaTentees: ["AUTRE_SOURCE", "ELARGIR", "DEMANDER_HUMAIN", "DECLARER_INCONNU"],
    })).toBe(true);
  });

  it("§76 — sans cause identifiée et sans objectif atteint, on ne conclut PAS", () => {
    expect(estFinPossible({ objectifAtteint: false, kind: null, dejaTentees: [] })).toBe(false);
  });

  it("un objectif atteint conclut, évidemment", () => {
    expect(estFinPossible({ objectifAtteint: true, kind: "NOT_FOUND", dejaTentees: [] })).toBe(true);
  });
});

describe("§107 — la persévérance n'autorise pas l'invention", () => {
  it("seul un résultat TROUVÉ autorise à agir", () => {
    expect(utilisablePourAgir("TROUVE")).toBe(true);
    for (const c of CERTITUDES.filter((x) => x !== "TROUVE")) {
      expect(utilisablePourAgir(c), `${c} ne doit pas autoriser une action`).toBe(false);
    }
  });

  it("un candidat est ANNONCÉ comme tel, jamais présenté comme un fait", () => {
    expect(presenter("CANDIDAT", "contrat de mars", "le Drive")).toMatch(/probable.*à confirmer/);
    expect(presenter("DEDUIT", "23 salariés")).toMatch(/déduit.*non confirmé/);
    expect(presenter("TROUVE", "contrat n°42", "Legal")).toBe("contrat n°42 (Legal)");
    expect(presenter("INCONNU", "peu importe")).toBe("introuvable en l'état");
  });
});

describe("§77 — le routeur de sources", () => {
  it("un contrat commence par Legal, puis descend vers là où les choses atterrissent", () => {
    expect(prochaineSource("CONTRAT", [])).toBe("LEGAL");
    expect(prochaineSource("CONTRAT", ["LEGAL"])).toBe("DRIVE");
    expect(prochaineSource("CONTRAT", ["LEGAL", "DRIVE"])).toBe("HR");
  });

  it("chaque cible a un ordre, et le journal des événements est TOUJOURS le dernier recours", () => {
    for (const c of CIBLES) {
      const ordre = ORDRE[c];
      expect(ordre.length, `${c} sans ordre`).toBeGreaterThan(0);
      if (c !== "TRACE") {
        expect(ordre[ordre.length - 1], `${c} : le journal devrait clore la liste`).toBe("BUSINESS_EVENTS");
      }
    }
  });

  it("aucun ordre ne contient de doublon", () => {
    for (const c of CIBLES) expect(new Set(ORDRE[c]).size).toBe(ORDRE[c].length);
  });

  it("épuisées, les sources rendent null — et c'est la seule façon honnête de dire « pas trouvé »", () => {
    expect(prochaineSource("CONTRAT", [...ORDRE.CONTRAT])).toBeNull();
  });

  it("le compte rendu NOMME les greniers ouverts et ceux qui restent", () => {
    expect(compteRendu("CONTRAT", [])).toMatch(/Aucune recherche/);
    expect(compteRendu("CONTRAT", ["LEGAL", "DRIVE"]))
      .toMatch(/Cherché dans le module Legal, le Drive.*Il reste les RH/);
    expect(compteRendu("CONTRAT", [...ORDRE.CONTRAT]))
      .toMatch(/toutes les sources connues pour ce type/);
  });
});
