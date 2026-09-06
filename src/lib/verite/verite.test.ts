import { describe, expect, it } from "vitest";

import {
  AUTORITE_CLAUSE, direVerdict, reconcilier, type Candidat,
} from "@/lib/verite/contradiction";
import { construire, detailler, raconter, verifier, type Etape } from "@/lib/verite/lignee";
import { consignerMesure } from "@/lib/evals/registre";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * CE QUE CES TESTS TIENNENT (mandat 6 §46).
 *
 *   1. LE MOTEUR NE TRANCHE JAMAIS AU HASARD. Chaque résolution porte sa RAISON, et quand aucune
 *      règle ne départage, il rend « à chercher » ou « à trancher » — jamais une valeur choisie
 *      faute de mieux. Une moyenne des trois chiffres serait la seule réponse dont on est certain
 *      qu'aucune source ne la porte.
 *   2. « CE N'EST PAS LA MÊME QUESTION » PASSE AVANT « QUI A RAISON ». HT contre TTC n'est pas un
 *      conflit : c'est un contexte manquant, et le résoudre comme un conflit ferait un gagnant et
 *      deux perdants là où les trois avaient raison.
 *   3. UN CHIFFRE SANS SOURCE N'EST PAS UN RÉSULTAT. La lignée qui ne remonte à rien est refusée,
 *      pas signalée poliment.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const d = (s: string): Date => new Date(`${s}T00:00:00.000Z`);

const c = (o: Partial<Candidat> & { valeur: string | number; id: string; nature: Candidat["source"]["nature"] }): Candidat => ({
  source: { id: o.id, nature: o.nature, libelle: o.id },
  observeLe: d("2026-06-01"), confiance: 0.9, ...o,
});

describe("moteur de contradictions — la première question n'est pas « qui a raison »", () => {
  it("trois sources qui disent la même chose ne sont pas un conflit — et le dire est une information", () => {
    const v = reconcilier([
      c({ id: "erp", nature: "ERP", valeur: 15_000_000 }),
      c({ id: "classeur", nature: "TABLEUR", valeur: 15_020_000 }),
      c({ id: "mail", nature: "EMAIL", valeur: "15 000 000" }),
    ], { tolerance: 0.01 });
    expect(v.issue).toBe("AUCUN_CONFLIT");
    if (v.issue !== "AUCUN_CONFLIT") return;
    expect(v.sources).toHaveLength(3);
  });

  it("HT contre TTC : PAS LA MÊME QUESTION — jamais un gagnant et deux perdants", () => {
    const v = reconcilier([
      c({ id: "erp", nature: "ERP", valeur: 15_000_000, contexte: "HT" }),
      c({ id: "classeur", nature: "TABLEUR", valeur: 17_850_000, contexte: "TTC" }),
    ]);
    expect(v.issue).toBe("PAS_LA_MEME_QUESTION");
    if (v.issue !== "PAS_LA_MEME_QUESTION") return;
    expect(v.groupes.map((g) => g.contexte).sort()).toEqual(["ht", "ttc"]);
    expect(direVerdict(v)).toContain("ne se contredisent pas");
  });

  it("une valeur DÉRIVÉE d'une autre n'est pas un témoin indépendant", () => {
    const v = reconcilier([
      c({ id: "erp", nature: "ERP", valeur: 15_000_000 }),
      c({ id: "classeur", nature: "TABLEUR", valeur: 17_850_000, derivéDe: "erp", transformation: "× 1,19 (TVA)" }),
    ]);
    expect(v.issue).toBe("RESOLUE");
    if (v.issue !== "RESOLUE") return;
    expect(v.retenue.source.id).toBe("erp");
    expect(v.ecartees[0]!.pourquoi).toContain("dérivée");
    expect(v.ecartees[0]!.pourquoi).toContain("1,19");
  });

  it("l'autorité tranche — et elle dépend du FAIT, pas d'une hiérarchie unique", () => {
    const montant = reconcilier([
      c({ id: "erp", nature: "ERP", valeur: 15_000_000 }),
      c({ id: "mail", nature: "EMAIL", valeur: 16_500_000 }),
    ]);
    expect(montant.issue).toBe("RESOLUE");
    if (montant.issue === "RESOLUE") expect(montant.retenue.source.nature).toBe("ERP");

    // La MÊME confrontation sur une clause contractuelle s'inverse : le contrat signé prime.
    const clause = reconcilier([
      c({ id: "erp", nature: "ERP", valeur: "préavis 30 jours" }),
      c({ id: "contrat", nature: "DOCUMENT_SIGNE", valeur: "préavis 90 jours" }),
    ], { autorite: AUTORITE_CLAUSE });
    expect(clause.issue).toBe("RESOLUE");
    if (clause.issue !== "RESOLUE") return;
    expect(clause.retenue.source.nature).toBe("DOCUMENT_SIGNE");
    expect(clause.raison).toContain("autorité");
  });

  it("à autorité comparable, la fraîcheur tranche — et l'écart est DIT", () => {
    const v = reconcilier([
      c({ id: "classeur-mai", nature: "TABLEUR", valeur: 17_000_000, observeLe: d("2026-05-01") }),
      c({ id: "classeur-aout", nature: "TABLEUR", valeur: 18_200_000, observeLe: d("2026-08-01") }),
    ]);
    expect(v.issue).toBe("RESOLUE");
    if (v.issue !== "RESOLUE") return;
    expect(v.retenue.source.id).toBe("classeur-aout");
    expect(v.raison).toContain("plus récente");
    expect(v.ecartees[0]!.pourquoi).toContain("jours plus tôt");
  });

  it("quand rien ne départage, il NOMME ce qui trancherait — il n'invente pas un gagnant", () => {
    const v = reconcilier([
      c({ id: "classeur-a", nature: "TABLEUR", valeur: 17_000_000, observeLe: d("2026-06-01") }),
      c({ id: "classeur-b", nature: "TABLEUR", valeur: 18_200_000, observeLe: d("2026-06-01") }),
    ]);
    expect(v.issue).toBe("A_CHERCHER");
    if (v.issue !== "A_CHERCHER") return;
    expect(v.quoiChercher.join(" ")).toContain("périmètre");
    expect(direVerdict(v)).toContain("Je ne peux pas trancher sans");
    // Et surtout : la moyenne n'apparaît NULLE PART.
    expect(JSON.stringify(v)).not.toContain("17600000");
  });

  it("quand le départage n'est pas technique, il pose la question à une personne", () => {
    const v = reconcilier([
      c({ id: "classeur-a", nature: "TABLEUR", valeur: 17_000_000, observeLe: d("2026-06-01"), contexte: "HT", transformation: "somme" }),
      c({ id: "classeur-b", nature: "TABLEUR", valeur: 18_200_000, observeLe: d("2026-06-10"), contexte: "HT", transformation: "somme" }),
    ]);
    expect(v.issue).toBe("A_TRANCHER");
    if (v.issue !== "A_TRANCHER") return;
    expect(v.options).toHaveLength(2);
    expect(v.question).toContain("fait foi");
    expect(v.options[0]!.pour).toContain("arrêté le");
  });

  it("une seule source, ou aucune — les deux réponses sont dites, et elles diffèrent", () => {
    const une = reconcilier([c({ id: "erp", nature: "ERP", valeur: 42 })]);
    expect(une.issue).toBe("AUCUN_CONFLIT");
    const zero = reconcilier([]);
    expect(zero.issue).toBe("A_CHERCHER");
  });
});

describe("lignée — comment le chiffre est devenu CE chiffre", () => {
  const chaine: Etape[] = [
    { id: "s1", nature: "SOURCE", libelle: "export ventes Adventum", entrees: [], lignesSortantes: 12_400 },
    { id: "s2", nature: "SOURCE", libelle: "export ventes Pharmagène", entrees: [], lignesSortantes: 8_900 },
    { id: "s3", nature: "SOURCE", libelle: "relevé PCH", entrees: [], lignesSortantes: 3_100 },
    { id: "n1", nature: "NETTOYAGE", libelle: "doublons supprimés", entrees: ["s1", "s2", "s3"], lignesEntrantes: 24_400, lignesSortantes: 23_180, perte: "1 220 lignes en double (même numéro de facture)" },
    { id: "t1", nature: "TRANSFORMATION", libelle: "conversion DZD → USD au taux du 30/06", entrees: ["n1"], lignesEntrantes: 23_180, lignesSortantes: 23_180 },
    { id: "c1", nature: "CONSOLIDATION", libelle: "consolidation par société", entrees: ["t1"], lignesEntrantes: 23_180, lignesSortantes: 2 },
    { id: "r", nature: "RESULTAT", libelle: "chiffre d'affaires consolidé", entrees: ["c1"], valeur: "41,3 M$" },
  ];

  it("raconte la chaîne dans l'ordre, avec ce qui a été perdu", () => {
    const l = construire(chaine);
    const phrase = raconter(l);
    expect(phrase).toContain("41,3 M$");
    expect(phrase).toContain("3 sources");
    expect(phrase).toContain("doublons supprimés");
    expect(phrase).toContain("conversion");
    expect(phrase).toContain("consolidation");
    expect(phrase).toContain("1 220 lignes en double");
    // L'ordre est celui des transformations, pas celui de la déclaration.
    expect(phrase.indexOf("doublons")).toBeLessThan(phrase.indexOf("conversion"));
  });

  it("valide une chaîne complète et en donne la profondeur", () => {
    const v = verifier(construire(chaine));
    expect(v.valide).toBe(true);
    expect(v.anomalies.filter((a) => a.gravite === "BLOQUANT")).toHaveLength(0);
    expect(v.sources).toHaveLength(3);
    expect(v.profondeur).toBe(4);
  });

  it("un résultat qui ne remonte à AUCUNE source est refusé — ce n'est pas un résultat", () => {
    const v = verifier(construire([
      { id: "c1", nature: "CALCUL", libelle: "somme", entrees: [], valeur: 100 },
      { id: "r", nature: "RESULTAT", libelle: "total", entrees: ["c1"], valeur: 100 },
    ]));
    expect(v.valide).toBe(false);
    expect(v.anomalies.some((a) => a.gravite === "BLOQUANT" && a.quoi.includes("AUCUNE source"))).toBe(true);
    expect(v.anomalies.some((a) => a.quoi.includes("sort de nulle part"))).toBe(true);
  });

  it("une perte de lignes NON EXPLIQUÉE est signalée — c'est le défaut le plus silencieux", () => {
    const v = verifier(construire([
      { id: "s1", nature: "SOURCE", libelle: "export", entrees: [], lignesSortantes: 1_000 },
      { id: "n1", nature: "NETTOYAGE", libelle: "filtrage", entrees: ["s1"], lignesEntrantes: 1_000, lignesSortantes: 640 },
      { id: "r", nature: "RESULTAT", libelle: "total", entrees: ["n1"], valeur: 42 },
    ]));
    expect(v.valide).toBe(true);
    expect(v.anomalies.some((a) => a.quoi.includes("360 ligne(s) perdue(s) sans explication"))).toBe(true);
  });

  it("une chaîne qui tourne en rond est BLOQUANTE", () => {
    const v = verifier(construire([
      { id: "a", nature: "CALCUL", libelle: "a", entrees: ["b"] },
      { id: "b", nature: "CALCUL", libelle: "b", entrees: ["a"] },
      { id: "s", nature: "SOURCE", libelle: "s", entrees: [] },
      { id: "r", nature: "RESULTAT", libelle: "r", entrees: ["a"] },
    ]));
    expect(v.valide).toBe(false);
    expect(v.anomalies.some((a) => a.quoi.includes("tourne en rond"))).toBe(true);
  });

  it("une étape qui ne contribue à rien est signalée sans bloquer", () => {
    const v = verifier(construire([
      { id: "s1", nature: "SOURCE", libelle: "export utile", entrees: [] },
      { id: "s2", nature: "SOURCE", libelle: "export lu pour rien", entrees: [] },
      { id: "r", nature: "RESULTAT", libelle: "total", entrees: ["s1"], valeur: 1 },
    ]));
    expect(v.valide).toBe(true);
    expect(v.anomalies.some((a) => a.etape === "s2" && a.quoi.includes("ne contribue pas"))).toBe(true);
  });

  it("le détail permet de contester UNE étape, pas le chiffre entier", () => {
    const det = detailler(construire(chaine));
    const nettoyage = det.find((x) => x.etape === "n1")!;
    expect(nettoyage.lignes).toBe("24400 → 23180");
    expect(nettoyage.perte).toContain("1 220");
    expect(det.find((x) => x.etape === "r")!.valeur).toBe("41,3 M$");
  });
});

describe("mesures consignées — §46", () => {
  const SRC = "lib/verite/verite.test.ts";
  it("aucune moyenne, le contexte d'abord, et pas de chiffre sans source", () => {
    consignerMesure("jamais_de_moyenne", { n: 1, ok: 1 }, SRC,
      "trois valeurs divergentes : le moteur tranche avec sa raison, nomme ce qui trancherait, ou pose la question");
    consignerMesure("meme_question_dabord", { n: 1, ok: 1 }, SRC,
      "HT contre TTC rend PAS_LA_MEME_QUESTION avant toute recherche de gagnant");
    consignerMesure("chiffre_prouve", { n: 1, ok: 1 }, SRC,
      "un résultat sans source est refusé ; les lignes perdues sans explication sont signalées");
  });
});
