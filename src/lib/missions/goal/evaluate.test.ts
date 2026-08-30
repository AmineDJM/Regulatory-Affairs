import { describe, expect, it } from "vitest";
import {
  aReparer, controlerQualite, empreinteExecution, evaluerObjectif,
  type EtapeObservee, type JugeObjectif,
} from "./evaluate";
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

  it("RUN 4 : une fille CONTOURNÉE par un replan n'est pas une incohérence de comptage", () => {
    // Le défaut mesuré : « 14/14 étapes effectives abouties. 1 incohérence(s) de comptage » —
    // la fille en échec avait été contournée (nommée au journal), le parent annonçait encore
    // ses trois clés, et la mission brûlait ses replans jusqu'au plafond sans jamais conclure.
    const qa = controlerQualite(
      [
        etape("lire", "DONE", { result: { expanded: 3, keys: ["lire#a", "lire#b", "lire#c"], done: 2, failed: 1 } }),
        etape("lire#a", "DONE"),
        etape("lire#b", "DONE"),
        // lire#c : FAILED sous le plan v1, contournée au replan → hors de la vue courante.
      ],
      new Set(["lire#c"]),
    );
    expect(qa.nonVerifiables).toEqual([]);
    expect(qa.ok).toBe(true);
    expect(qa.faits).toBe(2);
  });

  it("SABOTAGE : une clé ANNONCÉE qui n'existe nulle part — ni au plan, ni contournée — bloque toujours", () => {
    // C'est le silence le plus dangereux du runtime : une personne n'a rien reçu sans
    // qu'aucune étape ne soit en échec. La réconciliation ne doit JAMAIS l'excuser.
    const qa = controlerQualite(
      [
        etape("envoi", "DONE", { result: { expanded: 3, keys: ["envoi#a", "envoi#b", "envoi#fantome"] } }),
        etape("envoi#a", "DONE"),
        etape("envoi#b", "DONE"),
      ],
      new Set(["autre#z"]),
    );
    expect(qa.ok).toBe(false);
    expect(qa.nonVerifiables[0]).toMatch(/INTROUVABLES/);
    expect(qa.nonVerifiables[0]).toMatch(/envoi#fantome/);
  });

  it("résultat ANCIEN (expanded sans keys) : les filles contournées comptent dans la réconciliation", () => {
    const qa = controlerQualite(
      [
        etape("m", "DONE", { result: { expanded: 3 } }),
        etape("m#a", "DONE"),
        etape("m#b", "DONE"),
      ],
      new Set(["m#c"]),
    );
    expect(qa.nonVerifiables).toEqual([]);
    expect(qa.ok).toBe(true);
  });

  it("des clés annoncées EN DOUBLE (résultat d'avant le correctif d'annonce) ne fabriquent pas d'incohérence", () => {
    const qa = controlerQualite([
      etape("m", "DONE", { result: { expanded: 3, keys: ["m#a", "m#a", "m#b"] } }),
      etape("m#a", "DONE"),
      etape("m#b", "DONE"),
    ]);
    expect(qa.nonVerifiables).toEqual([]);
    expect(qa.ok).toBe(true);
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
 * ON NE REJUGE PAS DEUX FOIS EXACTEMENT LA MÊME CHOSE.
 *
 * ── LA MESURE QUI A PRODUIT CE BLOC ──────────────────────────────────────────────────────
 *
 * `conclure()` tourne chaque fois que le moteur n'a plus rien à faire, et le moteur y repasse
 * plusieurs fois pour une seule mission : un humain relance depuis l'écran, une replanification
 * n'ajoute finalement rien, le battement revient. Le juge relisait alors un compte rendu
 * rigoureusement identique — dix à soixante-dix secondes de modèle, mesurées, pour réapprendre
 * une phrase déjà écrite au journal.
 *
 * ── CE QUE CES TESTS INTERDISENT, DANS LES DEUX SENS ─────────────────────────────────────
 *
 * Qu'on rappelle le juge quand rien n'a bougé — et, bien plus important, qu'on RÉUTILISE un
 * verdict quand quelque chose a bougé. Le second sens est celui qui coûterait cher : une
 * mission conclue sur les faits d'hier.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
describe("l'empreinte du jugement", () => {
  /** Un juge qui COMPTE ses appels : c'est le compteur qui prouve, pas le verdict. */
  const jugeCompteur = () => {
    const etat = { appels: 0 };
    const j: JugeObjectif = {
      juger: async () => {
        etat.appels += 1;
        return { satisfait: false, raison: "un critère sans preuve" };
      },
    };
    return { juge: j, etat };
  };

  const steps = [etape("a", "DONE"), etape("b", "DONE")];

  it("elle ne dépend QUE des trois entrées du juge — et change dès que l'une bouge", () => {
    const base = empreinteExecution("o", ["c"], "compte rendu");
    expect(empreinteExecution("o", ["c"], "compte rendu")).toBe(base);
    expect(empreinteExecution("autre objectif", ["c"], "compte rendu")).not.toBe(base);
    expect(empreinteExecution("o", ["c", "c2"], "compte rendu")).not.toBe(base);
    expect(empreinteExecution("o", ["c"], "compte rendu différent")).not.toBe(base);
  });

  it("un verdict ANTÉRIEUR identique est réutilisé — le juge n'est pas rappelé", async () => {
    const { juge, etat } = jugeCompteur();
    const premier = await evaluerObjectif({ objectif: "o", criteres: ["c"], steps, juge });
    expect(etat.appels).toBe(1);
    expect(premier.empreinte).toBeTruthy();
    expect(premier.reutilise).toBeFalsy();

    const second = await evaluerObjectif({
      objectif: "o", criteres: ["c"], steps, juge,
      anterieur: { empreinte: premier.empreinte!, satisfait: false, raison: premier.raison },
    });
    // LE COMPTEUR EST LA PREUVE : aucun appel de modèle n'a eu lieu.
    expect(etat.appels).toBe(1);
    expect(second.reutilise).toBe(true);
    expect(second.satisfait).toBe(false);
    expect(second.raison).toBe(premier.raison);
    // Et `avisModele` reste un avis de modèle : c'en est un, rendu plus tôt. Le mettre à `null`
    // ferait croire que personne n'a jugé — exactement la confusion que §20 refuse.
    expect(second.avisModele).toBe(false);
  });

  it("UNE ÉTAPE QUI BOUGE ROUVRE LE JUGEMENT — c'est le sens qui coûterait cher", async () => {
    const { juge, etat } = jugeCompteur();
    const premier = await evaluerObjectif({ objectif: "o", criteres: ["c"], steps, juge });
    expect(etat.appels).toBe(1);

    // Le verdict d'hier est présenté, mais l'exécution a changé : une étape de plus a abouti.
    const second = await evaluerObjectif({
      objectif: "o", criteres: ["c"],
      steps: [...steps, etape("c", "DONE")],
      juge,
      anterieur: { empreinte: premier.empreinte!, satisfait: true, raison: "atteint hier" },
    });
    expect(etat.appels).toBe(2);
    expect(second.reutilise).toBeFalsy();
    expect(second.raison).not.toMatch(/hier/);
  });

  it("un juge qui TOMBE ne laisse AUCUNE empreinte — sinon la panne se figerait en verdict", async () => {
    const casse: JugeObjectif = { juger: async () => { throw new Error("fournisseur indisponible"); } };
    const v = await evaluerObjectif({ objectif: "o", criteres: ["c"], steps, juge: casse });
    // Sans cette ligne, l'appelant enregistrerait une empreinte pour un jugement qui n'a pas eu
    // lieu, et le passage suivant réutiliserait un « non » de panne au lieu de rejuger.
    expect(v.empreinte).toBeNull();
    expect(v.satisfait).toBe(false);
  });

  it("le verdict antérieur ne sert JAMAIS de raccourci aux contrôles qui le précèdent", async () => {
    const { juge, etat } = jugeCompteur();
    // Une étape en échec : le contrôle arithmétique refuse AVANT que l'empreinte n'existe.
    const v = await evaluerObjectif({
      objectif: "o", criteres: ["c"],
      steps: [etape("a", "DONE"), etape("b", "FAILED")],
      juge,
      anterieur: { empreinte: "peu importe", satisfait: true, raison: "atteint" },
    });
    expect(v.satisfait).toBe(false);
    expect(v.raison).toMatch(/contrôle ne passe pas/);
    expect(etat.appels).toBe(0);
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
    // LE REPLAN LOCAL S'INTERCALE AVANT L'HUMAIN, et c'est une correction : récrire la partie
    // du plan qui cherchait au mauvais endroit est automatique et bon marché ; déranger
    // quelqu'un ne l'est pas. On ne remonte à l'humain qu'après avoir épuisé l'automatique.
    expect(prochaineStrategie("NOT_FOUND", ["AUTRE_SOURCE", "ELARGIR"])).toBe("REPLAN_LOCAL");
    expect(prochaineStrategie("NOT_FOUND", ["AUTRE_SOURCE", "ELARGIR", "REPLAN_LOCAL"]))
      .toBe("DEMANDER_HUMAIN");
  });

  it("§108 — un DROIT MANQUANT ne se réessaie pas, ne s'élargit pas, ne se contourne pas", () => {
    expect(ECHELLE.MISSING_PERMISSION).toEqual(["ESCALADER"]);
    expect(rejouable("MISSING_PERMISSION")).toBe(false);
    expect(ECHELLE.MISSING_PERMISSION).not.toContain("AUTRE_SOURCE");
    expect(ECHELLE.MISSING_PERMISSION).not.toContain("ELARGIR");
  });

  /**
   * L'ORDRE A CHANGÉ POUR `INCOMPATIBLE_RESULT`, ET C'EST UNE CORRECTION, PAS UN AJUSTEMENT.
   *
   * Ce test attendait `REPLANIFIER` en premier. Tant que l'échelle n'était consultée par
   * personne, l'ordre n'avait aucune conséquence observable. Une fois branchée au moteur, elle
   * en a une, et elle est mauvaise : le Drive rend le mauvais document → on refait tout le plan,
   * alors que l'objectif n'a pas bougé d'un mot. On consomme un des quatre plans autorisés pour
   * finir par chercher dans Legal — ce qu'un changement de grenier fait en une tentative.
   *
   * On cherche donc AILLEURS d'abord ; on ne replanifie que si aucune source ne détient la
   * chose, car là c'est bien la méthode qui est en cause.
   */
  it("une panne de fournisseur se réessaie ; un résultat incompatible cherche AILLEURS avant de replanifier", () => {
    expect(prochaineStrategie("PROVIDER_FAILURE", [])).toBe("RETRY");
    expect(rejouable("PROVIDER_FAILURE")).toBe(true);
    /**
     * ── ET L'ORDRE A ENCORE CHANGÉ, POUR LA MÊME RAISON, D'UN CRAN PLUS PROFOND ────────
     *
     * `AUTRE_SOURCE` était en tête, sur un raisonnement qui semblait juste : « le Drive rend le
     * mauvais document, essayons Legal ». Un run réel a montré ce qu'il coûte quand la cause est
     * une vraie erreur de FORME : quatre planifications et 191 secondes de modèle sur un
     * éventail dont le chemin ne résolvait pas — car changer de grenier ne change pas la forme
     * d'un résultat qu'une étape amont a déjà produit.
     *
     * Le cas « mauvais document » n'a pas disparu : il est désormais classé `NOT_FOUND`, ce
     * qu'il est réellement — la pièce cherchée n'est pas dans ce grenier. `INCOMPATIBLE_RESULT`
     * est réservé au désaccord de structure, et son échelle part du geste le moins cher :
     * ADAPTER (zéro appel), puis récrire localement, puis seulement replanifier.
     */
    expect(prochaineStrategie("INCOMPATIBLE_RESULT", [])).toBe("ADAPTER");
    expect(ECHELLE.INCOMPATIBLE_RESULT).not.toContain("AUTRE_SOURCE");
    expect(prochaineStrategie("INCOMPATIBLE_RESULT", ["ADAPTER"])).toBe("REPLAN_LOCAL");
    expect(prochaineStrategie("INCOMPATIBLE_RESULT", ["ADAPTER", "REPLAN_LOCAL"])).toBe("REPLANIFIER");
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
      dejaTentees: ["AUTRE_SOURCE", "ELARGIR", "REPLAN_LOCAL", "DEMANDER_HUMAIN"],
    })).toBe(false);
    // Épuisée : là, et là seulement, s'arrêter est honnête.
    expect(estFinPossible({
      objectifAtteint: false, kind: "NOT_FOUND",
      dejaTentees: ["AUTRE_SOURCE", "ELARGIR", "REPLAN_LOCAL", "DEMANDER_HUMAIN", "DECLARER_INCONNU"],
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
