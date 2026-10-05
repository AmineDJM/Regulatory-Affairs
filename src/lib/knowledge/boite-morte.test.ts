import { describe, it, expect } from "vitest";
import { causeNormalisee, extensionDe, regrouperEchecs, MOTIF_ABSENT, type TravailMort } from "./boite-morte";
import { estPanneTemporaire, PanneTemporaire, delaiReportMs, REPORTS_MAX } from "./panne";
import { advances, isRetrievable, normaliserMoyen, compterParMoyen, MOYENS_MODELE, JOB_KINDS_MODELE } from "./contract";
import { etapeDepuisLesFaits, coutVectorisationUsd } from "./rattrapage";
import { kindsReclamables, JOB_KINDS_CODE } from "./worker";
import { sansTexteDefinitif } from "./ingest";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LA COUCHE DE CONNAISSANCE, CE QUE L'ÉCRAN DE PRODUCTION A MONTRÉ — les règles PURES.
 *
 *   • « luna_vision » et « hybride » à côté de « Luna — vision » : un vocabulaire fermé à
 *     l'écriture, et les anciennes lignes regroupées à la lecture ;
 *   • une panne de l'ENVIRONNEMENT n'est pas un échec du document ;
 *   • la boîte morte regroupée par cause, pour qu'un défaut répété se lise comme UNE ligne ;
 *   • « sans texte lisible » est un état, pas une panne.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

describe("un moyen d'extraction, une écriture", () => {
  it("les anciennes écritures rejoignent leur moyen ; un moyen inconnu n'est rangé sous aucun autre", () => {
    expect(normaliserMoyen("luna_vision")).toBe("luna");
    expect(normaliserMoyen("hybride")).toBe("hybrid");
    expect(normaliserMoyen("native")).toBe("native");
    expect(normaliserMoyen("bidule")).toBeNull();
    expect(normaliserMoyen(null)).toBeNull();
  });

  it("la répartition FUSIONNE les deux écritures d'un même moyen — une ligne, pas deux", () => {
    const r = compterParMoyen([
      { moyen: "luna", n: 208 }, { moyen: "luna_vision", n: 28 }, { moyen: "hybride", n: 9 },
      { moyen: "native", n: 540 }, { moyen: null, n: 2 }, { moyen: "bidule", n: 1 },
    ]);
    expect(r).toEqual({ luna: 236, hybrid: 9, native: 540, inconnu: 2, bidule: 1 });
    expect(r).not.toHaveProperty("luna_vision");
    expect(r).not.toHaveProperty("hybride");
  });

  it("l'hybride a demandé un modèle : il compte dans la part ambre, pas dans « compris par le code »", () => {
    expect(MOYENS_MODELE.has("hybrid")).toBe(true);
    expect(MOYENS_MODELE.has("native")).toBe(false);
  });
});

describe("une panne de l'environnement n'est pas un échec du document", () => {
  it("clé absente, interrupteur coupé, débit, panne du fournisseur, réseau, base : temporaire", () => {
    for (const m of [
      "Clé OPENAI_API_KEY non configurée.",
      "L'IA est coupée par l'interrupteur général (Administration › Contrôle de l'IA) : aucun appel n'est parti.",
      "Erreur IA (HTTP 429) : Rate limit reached",
      "Erreur IA (HTTP 503) : overloaded",
      "Erreur IA (HTTP 401) : Incorrect API key provided",
      "Appel à l'IA impossible (réseau ou délai dépassé).",
      "fetch failed",
      "Can't reach database server at localhost:5432",
      "embeddings indisponibles", // l'ancien motif de l'étage `embed`, encore en boîte morte
    ]) {
      expect(estPanneTemporaire(m), m).toBe(true);
    }
    expect(estPanneTemporaire(new PanneTemporaire("n'importe quoi"))).toBe(true);
  });

  it("un défaut du DOCUMENT (format, fichier absent, réponse illisible) n'est PAS temporaire", () => {
    for (const m of [
      "Erreur IA (HTTP 400) : Invalid image",
      "Fichier introuvable dans le stockage (version ou contenu absent).",
      "Lecture visuelle : réponse inexploitable (JSON illisible).",
      "Cannot read properties of undefined",
      "",
    ]) {
      expect(estPanneTemporaire(m), m || "(vide)").toBe(false);
    }
  });

  it("l'attente croît et se borne ; au-delà de REPORTS_MAX, la panne est déclarée persistante", () => {
    expect(delaiReportMs(0)).toBe(15 * 60_000);
    expect(delaiReportMs(1)).toBe(30 * 60_000);
    expect(delaiReportMs(REPORTS_MAX)).toBe(6 * 60 * 60_000);
  });

  it("sans modèle disponible, seuls les travaux qui ne coûtent rien sont réclamés", () => {
    expect(kindsReclamables(true)).toBeUndefined();
    const code = kindsReclamables(false)!;
    expect(code).toEqual([...JOB_KINDS_CODE]);
    for (const k of JOB_KINDS_MODELE) expect(code).not.toContain(k);
    expect(code).toEqual(expect.arrayContaining(["parse", "classify", "entities"]));
  });
});

describe("la boîte morte, regroupée par cause", () => {
  const mort = (id: string, kind: string, lastError: string | null, nom: string | null, sourceId = id): TravailMort => ({
    id, kind, lastError, itemId: `i-${id}`, nom, sourceType: "drive_file", sourceId,
  });

  it("le même défaut sur deux documents donne UNE cause : identifiants, nombres et citations retirés", () => {
    expect(causeNormalisee("Fichier « Rapport 2026.pdf » : 12 pages illisibles (job cmabcdefghijklmnopqrstu)"))
      .toBe(causeNormalisee("Fichier « Autre.pdf » : 3 pages illisibles (job cmzyxwvutsrqponmlkjihgf)"));
    expect(causeNormalisee("Erreur IA (HTTP 429) : retry after 20s")).toBe("Erreur IA (HTTP 429) : retry after #s");
    expect(causeNormalisee("Erreur IA (HTTP 429) : x")).not.toBe(causeNormalisee("Erreur IA (HTTP 400) : x"));
    expect(causeNormalisee(null)).toBe(MOTIF_ABSENT);
  });

  it("l'extension se lit à coup sûr, sinon « — »", () => {
    expect(extensionDe("Scan.PDF")).toBe("pdf");
    expect(extensionDe("archive")).toBe("—");
    expect(extensionDe(".bashrc")).toBe("—");
    expect(extensionDe(null)).toBe("—");
  });

  it("étape × cause × type : les plus nombreux d'abord, des exemples cliquables, la nature de la cause", () => {
    const g = regrouperEchecs([
      mort("a", "embed", "embeddings indisponibles", "A.pdf"),
      mort("b", "embed", "embeddings indisponibles", "B.pdf"),
      mort("c", "embed", "embeddings indisponibles", "C.docx"),
      mort("d", "vision", "Erreur IA (HTTP 400) : Invalid image", "D.png", "noeud-d#v2"),
      mort("e", "embed", "embeddings indisponibles", "E.pdf"),
      mort("f", "embed", "embeddings indisponibles", "F.pdf"),
    ]);
    expect(g.map((x) => [x.kind, x.extension, x.count])).toEqual([
      ["embed", "pdf", 4], ["embed", "docx", 1], ["vision", "png", 1],
    ]);
    expect(g[0].temporaire).toBe(true);
    expect(g[0].exemples).toHaveLength(3); // assez pour vérifier, pas assez pour noyer
    expect(g[0].ids).toEqual(["a", "b", "e", "f"]);
    expect(g[2].temporaire).toBe(false);
    // Une version close (`#v2`) ouvre le même nœud du Drive.
    expect(g[2].exemples[0].href).toBe("/drive/noeud-d");
  });
});

describe("« sans texte lisible » est un état, pas une panne", () => {
  it("un élément retrouvable ne devient jamais « sans texte » ; un « sans texte » peut encore devenir lisible", () => {
    expect(advances("READY", "EMPTY")).toBe(false);
    expect(advances("INDEXED", "EMPTY")).toBe(false);
    expect(advances("RECEIVED", "EMPTY")).toBe(true);
    expect(advances("EMPTY", "INDEXED")).toBe(true);
    expect(advances("EMPTY", "RECEIVED")).toBe(false);
    expect(isRetrievable("EMPTY")).toBe(false);
  });

  it("à l'ingestion : lu sans texte et sans vision à attendre → EMPTY ; une vision demandée, un objet structuré → non", () => {
    expect(sansTexteDefinitif({ extractedBy: "native", deepJobs: ["classify", "entities"] })).toBe(true);
    expect(sansTexteDefinitif({ extractedBy: "luna", deepJobs: ["classify", "entities", "vision"] })).toBe(false);
    expect(sansTexteDefinitif({ extractedBy: "metadata", deepJobs: ["entities"] })).toBe(false);
    expect(sansTexteDefinitif({})).toBe(false);
  });

  it("l'étape d'un élément « en échec » se déduit de ses FAITS", () => {
    expect(etapeDepuisLesFaits({ texte: true, moyen: "native", relie: true })).toBe("READY");
    expect(etapeDepuisLesFaits({ texte: true, moyen: "native", relie: false })).toBe("INDEXED");
    expect(etapeDepuisLesFaits({ texte: false, moyen: "metadata", relie: true })).toBe("READY");
    expect(etapeDepuisLesFaits({ texte: false, moyen: "native", relie: true })).toBe("EMPTY");
    expect(etapeDepuisLesFaits({ texte: false, moyen: "luna", relie: false })).toBe("RECEIVED");
    expect(etapeDepuisLesFaits({ texte: false, moyen: null, relie: false })).toBe("RECEIVED");
  });
});

describe("le coût de la vectorisation se dit avant de partir", () => {
  it("≈ 4 caractères par jeton, tarif de l'encodeur, arrondi au cent supérieur", () => {
    expect(coutVectorisationUsd(0)).toBe(0);
    // 72 398 morceaux × ~1 200 caractères ≈ 87 M caractères ≈ 21,7 M jetons ≈ 0,44 $
    expect(coutVectorisationUsd(86_877_600)).toBe(0.44);
    expect(coutVectorisationUsd(1)).toBe(0.01);
  });
});
