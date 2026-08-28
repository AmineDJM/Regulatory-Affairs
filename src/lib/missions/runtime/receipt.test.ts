import { describe, expect, it } from "vitest";
import {
  attestationEffets, compterResultats, empreinte, fabriquerRecu, issueDe, lireRecu,
  preuveNegative, requeteDe, type ExecutionReceipt,
} from "@/lib/missions/runtime/receipt";
import { EFFECT_RANK, type Effect } from "@/lib/missions/registry/capability-meta";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE REÇU D'EXÉCUTION — et la règle qui décide de tout : `null` n'est pas `0`.
 *
 * ── LES TROIS REFUS QUI ONT PRODUIT CE FICHIER ──────────────────────────────────────────
 *
 * Un run Render, trois scénarios, trois refus du juge, et la même cause :
 *
 *   « Aucun message n'est envoyé »   → SANS PREUVE, alors que la mission n'avait fait que lire
 *   « rien sur Zorbamyxine-K7 »      → 0 résultat non citable comme preuve d'absence
 *   une étape de contrôle FAILED     → « contredit » un critère, sans qu'on sache ce qui a été mesuré
 *
 * Dans les trois cas la mission a brûlé des replanifications à faire RÉÉCRIRE EN PROSE, par un
 * modèle, un fait que le code détenait. Ces tests gardent les faits.
 *
 * ── LE DANGER QUE CE FICHIER SURVEILLE EN PRIORITÉ ──────────────────────────────────────
 *
 * Fabriquer de la preuve d'absence. Un compte à `0` autorise le juge à conclure « il n'y a
 * rien ». Si `0` pouvait sortir d'un résultat qu'on n'a pas su lire, on lui ferait signer une
 * absence qu'on n'a jamais constatée — un défaut bien pire que celui qu'on corrige.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

describe("compter les résultats — et refuser de deviner", () => {
  it("un tableau nu se compte", () => {
    expect(compterResultats([1, 2, 3])).toBe(3);
    expect(compterResultats([])).toBe(0);
  });

  it("une SEULE liste dans l'objet se compte, à un ou deux niveaux", () => {
    expect(compterResultats({ items: [1, 2] })).toBe(2);
    expect(compterResultats({ data: { resultats: ["a"] } })).toBe(1);
  });

  it("DEUX listes = AMBIGU : on rend `null`, jamais un compte plausible", () => {
    // En choisir une donnerait un chiffre crédible et faux, qui servirait ensuite de preuve.
    expect(compterResultats({ fichiers: [1, 2], dossiers: [3] })).toBeNull();
  });

  it("un COMPTE EXPLICITE est cru quand il n'y a pas de liste — la capacité a répondu elle-même", () => {
    expect(compterResultats({ count: 0, message: "Aucun fichier ne correspond." })).toBe(0);
    expect(compterResultats({ total: 12 })).toBe(12);
  });

  it("DE LA PROSE NE SE COMPTE PAS — c'est le défaut `search_drive` du run réel", () => {
    // « Aucun fichier ne correspond » est humainement juste et machinalement muet. Le compter
    // à zéro serait exactement l'erreur : on n'a pas mesuré, on a lu une phrase.
    expect(compterResultats("Aucun fichier ne correspond.")).toBeNull();
    expect(compterResultats({ message: "Aucun fichier ne correspond." })).toBeNull();
    expect(compterResultats(null)).toBeNull();
  });
});

describe("l'issue — trois états, et le troisième est un aveu", () => {
  it("un échec reste un échec quel que soit le contenu", () => {
    expect(issueDe(false, 0)).toBe("ECHEC");
    expect(issueDe(false, 12)).toBe("ECHEC");
  });

  it("ZÉRO RÉSULTAT MESURÉ est VIDE — c'est LUI la preuve d'absence", () => {
    expect(issueDe(true, 0)).toBe("VIDE");
  });

  it("un compte NON MESURÉ est INDETERMINE, jamais VIDE", () => {
    // La distinction qui porte tout le fichier. `INDETERMINE` ne prouve rien ; `VIDE` prouve
    // une absence. Les confondre ferait signer au juge une absence jamais constatée.
    expect(issueDe(true, null)).toBe("INDETERMINE");
    expect(issueDe(true, null)).not.toBe("VIDE");
  });
});

describe("le reçu fabriqué", () => {
  const base = {
    capability: "search_drive", effect: "READ" as Effect, source: "drive",
    input: { query: "Zorbamyxine-K7" },
    debut: new Date("2026-08-28T14:32:00Z"), fin: new Date("2026-08-28T14:32:05Z"),
  };

  it("porte la requête RÉELLEMENT partie — sans elle, « 0 résultat » ne prouve rien", () => {
    // « Nous n'avons rien trouvé » est inutile si l'on ignore ce qui a été cherché.
    expect(fabriquerRecu({ ...base, ok: true, sortie: { items: [] } }).query).toBe("Zorbamyxine-K7");
    expect(requeteDe({ question: "  contrat  " })).toBe("contrat");
    expect(requeteDe({ limit: 20 })).toBeNull();
  });

  it("une recherche VIDE devient une preuve d'absence citable", () => {
    const r = fabriquerRecu({ ...base, ok: true, sortie: { items: [] } });
    expect(r.issue).toBe("VIDE");
    expect(r.resultCount).toBe(0);
    const ligne = preuveNegative("recherche:drive", r);
    expect(ligne).toContain("0 résultat");
    expect(ligne).toContain("Zorbamyxine-K7");
    expect(ligne).toContain("drive");
  });

  it("une recherche NON MESURABLE ne produit AUCUNE preuve négative", () => {
    // La garde la plus importante du fichier : la prose de `search_drive` ne doit pas se
    // transformer en preuve d'absence par accident.
    const r = fabriquerRecu({ ...base, ok: true, sortie: "Aucun fichier ne correspond." });
    expect(r.issue).toBe("INDETERMINE");
    expect(preuveNegative("recherche:drive", r)).toBeNull();
  });

  it("un échec produit quand même un reçu — une piste explorée sans succès n'est pas une piste non explorée", () => {
    const r = fabriquerRecu({ ...base, ok: false, sortie: null });
    expect(r.issue).toBe("ECHEC");
    expect(r.resultHash).toBeNull();
    expect(preuveNegative("x", r)).toBeNull();
  });

  it("l'empreinte sépare deux résultats différents et réunit deux identiques", () => {
    expect(empreinte({ a: 1 })).toBe(empreinte({ a: 1 }));
    expect(empreinte({ a: 1 })).not.toBe(empreinte({ a: 2 }));
  });
});

describe("relire un reçu de la base — sans jamais inventer un zéro", () => {
  it("un reçu bien formé se relit à l'identique", () => {
    const r = fabriquerRecu({
      capability: "list_conges", effect: "READ", source: "hr", input: {},
      ok: true, sortie: { items: [1] },
      debut: new Date("2026-08-28T10:00:00Z"), fin: new Date("2026-08-28T10:00:01Z"),
    });
    expect(lireRecu(JSON.parse(JSON.stringify(r)))).toEqual(r);
  });

  it("UN `resultCount` CORROMPU DEVIENT `null`, JAMAIS `0`", () => {
    // Le relire à zéro fabriquerait une preuve d'absence à partir d'une donnée abîmée — et
    // personne ne verrait la différence dans le verdict.
    const abime = {
      capability: "x", effect: "READ", source: null, query: null,
      startedAt: "2026-08-28T10:00:00Z", completedAt: "2026-08-28T10:00:01Z",
      issue: "VIDE", resultCount: "zéro", resultHash: null,
    };
    expect(lireRecu(abime)?.resultCount).toBeNull();
  });

  it("ce qui n'est pas un reçu rend `null` — pas un reçu vide", () => {
    expect(lireRecu(null)).toBeNull();
    expect(lireRecu({ issue: "MAGIE" })).toBeNull();
    expect(lireRecu([1, 2])).toBeNull();
  });
});

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * L'ATTESTATION D'EFFETS — le critère qui ne pouvait PAS être satisfait
 *
 * Run Render, scénario RECOURS : « Aucun message n'est envoyé et aucune donnée n'est modifiée »
 * → critère SANS PREUVE. La mission tournait sous plafond ANALYZE et n'avait exécuté que des
 * lectures. Le juge n'avait rien pour le savoir : on lui demandait de certifier une négation
 * sur la foi d'une phrase.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
describe("l'attestation d'effets rend « je n'ai rien modifié » démontrable", () => {
  const recu = (effect: Effect): ExecutionReceipt => ({
    capability: "x", effect, source: null, query: null,
    startedAt: "2026-08-28T10:00:00Z", completedAt: "2026-08-28T10:00:01Z",
    issue: "SUCCES", resultCount: 1, resultHash: "h",
  });
  const rang = (e: Effect) => EFFECT_RANK[e];

  it("que des lectures ⇒ l'attestation l'AFFIRME, et nomme le plafond", () => {
    const t = attestationEffets([recu("READ"), recu("READ"), recu("ANALYZE")], rang, "ANALYZE");
    expect(t).toContain("AUCUNE écriture");
    expect(t).toContain("plafond de la mission : ANALYZE");
    expect(t).toContain("effet maximal atteint : ANALYZE");
  });

  it("un seul envoi ⇒ elle le DIT, elle ne l'arrondit pas", () => {
    // Le contre-exemple indispensable : si l'attestation disait « aucune écriture » dès qu'elle
    // en voit peu, elle deviendrait un blanc-seing et le juge signerait n'importe quoi.
    const t = attestationEffets([recu("READ"), recu("EXTERNAL_COMMUNICATION")], rang, "SECURITY_ADMIN");
    expect(t).not.toContain("AUCUNE écriture");
    expect(t).toContain("1 appel(s) d'effet supérieur à ANALYZE");
  });

  it("aucun appel ⇒ elle le dit aussi, au lieu de laisser croire à une vertu", () => {
    expect(attestationEffets([], rang, "ANALYZE")).toContain("aucun appel de capacité");
  });

  it("elle dit toujours le PLAFOND — « rien écrit » et « rien permis » ne se valent pas", () => {
    // Une mission plafonnée en lecture qui n'a rien écrit n'a aucun mérite ; une mission qui
    // pouvait tout écrire et n'a rien écrit en a un. Le juge doit pouvoir les distinguer.
    expect(attestationEffets([recu("READ")], rang, "ANALYZE")).toContain("ANALYZE");
    expect(attestationEffets([recu("READ")], rang, "DESTRUCTIVE")).toContain("DESTRUCTIVE");
  });
});
