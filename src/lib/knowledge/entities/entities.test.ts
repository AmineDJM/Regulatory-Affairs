import { describe, expect, it } from "vitest";
import { editDistance, typoBudget, typoSimilarity, rankOrgCandidates, resolveOrg } from "@/lib/name-match";
import { entityKey, moleculesOf } from "./project";
import { extractMentions, mentionConfidence } from "./extract";
import { isDecisive, DECISIVE_SCORE, type EntityCandidate } from "./contract";
import { extractDates, documentDateOf, detectLanguage, extractAmounts } from "../facts";

/**
 * LE RÉSOLVEUR D'ENTITÉS — la partie PURE, celle où vit la logique délicate.
 *
 * Ce qui est vérifié ici n'est pas « ça marche » mais « ça refuse de se tromper » : une faute de
 * frappe se rattrape, deux sociétés homonymes restent deux sociétés, et une chaîne trop courte
 * n'est jamais assimilée à une autre par charité.
 */

describe("distance d'édition", () => {
  it("compte une TRANSPOSITION pour une seule opération", () => {
    // C'est l'erreur de frappe la plus courante au clavier. Sans la transposition, elle coûte 2 —
    // le même prix qu'un mot réellement différent, ce qui la rend indétectable.
    expect(editDistance("kwaltiy", "kwality")).toBe(1);
  });

  it("s'arrête net quand la borne est dépassée, au lieu de calculer pour rien", () => {
    expect(editDistance("adventum", "pharmagene", 2)).toBeGreaterThan(2);
  });

  it("rend 0 pour deux chaînes identiques et la longueur pour une chaîne vide", () => {
    expect(editDistance("sanofi", "sanofi")).toBe(0);
    expect(editDistance("", "abc", 5)).toBe(3);
  });

  it("écarte immédiatement deux chaînes de longueurs trop éloignées", () => {
    expect(editDistance("ab", "abcdefghij", 2)).toBeGreaterThan(2);
  });
});

describe("budget de fautes selon la longueur", () => {
  it("n'autorise AUCUNE faute sur une chaîne courte", () => {
    // « SAI » et « SAT » sont à distance 1 et n'ont rien à voir : sur trois lettres, une lettre
    // porte le sens. Tolérer ici confondrait des organisations différentes.
    expect(typoBudget(3)).toBe(0);
    expect(typoSimilarity("SAI", "SAT")).toBe(0);
  });

  it("tolère d'autant plus que le mot est long", () => {
    expect(typoBudget(6)).toBe(1);
    expect(typoBudget(10)).toBe(2);
    expect(typoBudget(20)).toBe(3);
  });

  it("rapproche une DCI mal tapée de la vraie", () => {
    expect(typoSimilarity("pembrolizumb", "pembrolizumab")).toBeGreaterThan(0.9);
  });

  it("ignore le générique corporate dans la comparaison", () => {
    // « Pharma » ne doit ni aider ni nuire : c'est le cœur du nom qui décide.
    expect(typoSimilarity("Kwlaity Pharma", "Kwality")).toBeGreaterThan(0.8);
  });
});

describe("classement des candidats", () => {
  it("place la faute de frappe AU-DESSUS du simple recouvrement de mots", () => {
    const ranked = rankOrgCandidates("Kwlaity Pharma", ["Kwality Pharma", "Pharma Plus"]);
    expect(ranked[0].value).toBe("Kwality Pharma");
    expect(ranked[0].why).toBe("faute de frappe probable");
  });

  it("n'invente pas une faute de frappe entre deux mots juste voisins", () => {
    const ranked = rankOrgCandidates("Biotech", ["Biocare"]);
    const typo = ranked.find((r) => r.why === "faute de frappe probable");
    expect(typo).toBeUndefined();
  });

  it("garde les règles historiques intactes — acronyme, identité de cœur, exactitude", () => {
    expect(rankOrgCandidates("SAI", ["Société Algérienne d'Infectiologie"])[0].score).toBe(0.88);
    expect(rankOrgCandidates("SD", ["SD Pharmaceuticals"])[0].score).toBe(0.95);
    expect(rankOrgCandidates("kwality pharma", ["Kwality Pharma"])[0].score).toBe(1);
  });

  it("refuse de trancher entre deux sociétés qui se valent", () => {
    const r = resolveOrg("Pharma Group", ["Pharma Group Alger", "Pharma Group Oran"]);
    expect(r.kind).toBe("ambiguous");
  });
});

describe("politique de décision", () => {
  const cand = (id: string, score: number): EntityCandidate => ({
    entityId: id, kind: "company", canonicalName: id, refType: null, refId: null,
    companyId: null, score, why: "", matchedAlias: id,
  });

  it("exige un score fort ET un écart net", () => {
    expect(isDecisive(cand("a", 0.95), cand("b", 0.9))).toBe(false); // fort mais serré
    expect(isDecisive(cand("a", 0.7), null)).toBe(false); // seul mais faible
    expect(isDecisive(cand("a", 0.95), cand("b", 0.5))).toBe(true);
  });

  it("ne voit pas d'ambiguïté entre deux GRAPHIES de la même entité", () => {
    // Le même objet trouvé par deux alias n'est pas un choix à faire.
    expect(isDecisive(cand("a", 0.95), cand("a", 0.9))).toBe(true);
  });

  it("le seuil reste au niveau documenté", () => {
    expect(DECISIVE_SCORE).toBe(0.82);
  });
});

describe("clé d'identité", () => {
  it("désigne la FICHE quand il y en a une", () => {
    expect(entityKey("product", "RegulatoryProduct", "abc", "keytruda")).toBe("product:RegulatoryProduct:abc");
  });

  it("se replie sur le nom quand il n'y a pas de fiche — sinon deux NULL feraient deux entités", () => {
    expect(entityKey("molecule", null, null, "pembrolizumab")).toBe("molecule:name:pembrolizumab");
  });
});

describe("molécules d'un dossier", () => {
  it("découpe une association sur les séparateurs explicites", () => {
    expect(moleculesOf("Amoxicilline + Acide clavulanique", null)).toEqual([
      "Amoxicilline", "Acide clavulanique",
    ]);
  });

  it("ne casse JAMAIS sur l'espace — « acide clavulanique » est un seul nom", () => {
    expect(moleculesOf("Acide clavulanique", null)).toEqual(["Acide clavulanique"]);
  });

  it("préfère la liste structurée quand elle existe", () => {
    expect(moleculesOf("A + B", [{ name: "Pembrolizumab" }])).toEqual(["Pembrolizumab"]);
    expect(moleculesOf("A + B", ["Metformine", "Sitagliptine"])).toEqual(["Metformine", "Sitagliptine"]);
  });
});

describe("repérage des mentions", () => {
  it("trouve une référence interne et la classe en premier", () => {
    const m = extractMentions("Voir le dossier REG-2026-041 pour Adventum Pharma.");
    expect(m[0]).toMatchObject({ text: "REG-2026-041", form: "reference" });
  });

  it("garde les raisons sociales entières, petits mots compris", () => {
    const m = extractMentions("La Société Algérienne d'Infectiologie a répondu.");
    expect(m.some((x) => x.text.includes("Algérienne"))).toBe(true);
  });

  it("écarte un mot capitalisé qui n'est qu'un début de phrase", () => {
    const m = extractMentions("Cordialement");
    expect(m).toHaveLength(0);
  });

  it("compte les répétitions — un nom qui structure le document survit à la coupe", () => {
    const m = extractMentions("Sanofi. Sanofi. Sanofi. Bayer.");
    const sanofi = m.find((x) => x.text === "Sanofi");
    const bayer = m.find((x) => x.text === "Bayer");
    expect(sanofi!.count).toBeGreaterThan(bayer!.count);
  });

  it("respecte la borne du nombre de mentions", () => {
    const text = Array.from({ length: 200 }, (_, i) => `Societe Numero${i}`).join(". ");
    expect(extractMentions(text, 40).length).toBeLessThanOrEqual(40);
  });

  it("croit davantage une référence qu'un sigle", () => {
    expect(mentionConfidence("reference")).toBeGreaterThan(mentionConfidence("acronym"));
  });
});

describe("faits lisibles par le code seul", () => {
  it("lit une date au format français, JJ/MM", () => {
    expect(extractDates("Fait le 03/04/2026")).toEqual(["2026-04-03"]);
  });

  it("rattrape un format américain quand le jour dépasse 12", () => {
    expect(extractDates("Dated 04/25/2026")).toEqual(["2026-04-25"]);
  });

  it("refuse une date impossible au lieu de la reporter au mois suivant", () => {
    // JavaScript transformerait « 31 février » en 3 mars. C'est exactement ce qu'on interdit.
    expect(extractDates("31/02/2026")).toEqual([]);
  });

  it("lit une date écrite en toutes lettres", () => {
    expect(extractDates("prend effet le 1er avril 2026")).toEqual(["2026-04-01"]);
  });

  it("ne devine JAMAIS une année absente", () => {
    expect(extractDates("réunion le 12 mars")).toEqual([]);
  });

  it("prend la date d'émission dans l'en-tête, pas une échéance de la dernière page", () => {
    const doc = `Alger, le 15/01/2026\n\nObjet : contrat\n${"blabla ".repeat(400)}\nÉchéance : 31/12/2030`;
    expect(documentDateOf(doc)?.toISOString().slice(0, 10)).toBe("2026-01-15");
  });

  it("reconnaît l'arabe par son ALPHABET, pas par du vocabulaire", () => {
    expect(detectLanguage("هذا مستند باللغة العربية للاختبار")).toBe("ar");
  });

  it("distingue français et anglais, et se tait quand rien ne tranche", () => {
    expect(detectLanguage("le contrat est signé par les parties pour la durée qui est dans le document")).toBe("fr");
    expect(detectLanguage("the agreement shall be signed by the parties for the term that is in this document")).toBe("en");
    expect(detectLanguage("Adventum")).toBeNull();
  });

  it("lit un montant en dinars avec séparateur de milliers", () => {
    const [a] = extractAmounts("Montant : 1 500 000 DA");
    expect(a).toMatchObject({ value: 1_500_000, currency: "DZD" });
  });

  it("ne confond pas un séparateur de milliers avec des décimales", () => {
    // « 1.500 » est mille cinq cents ici, pas un virgule cinq : trois chiffres après le point.
    expect(extractAmounts("1.500 EUR")[0].value).toBe(1500);
    expect(extractAmounts("1.50 EUR")[0].value).toBe(1.5);
  });
});
