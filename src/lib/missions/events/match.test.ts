import { describe, expect, it } from "vitest";
import { correspond, echue, lireAttente, type FaitObserve } from "./match";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LA CORRESPONDANCE EST LA DÉCISION LA PLUS DANGEREUSE DU ROUTEUR.
 *
 * Une mission réveillée à tort reprend son cours et peut envoyer un e-mail. Les cas NÉGATIFS
 * comptent donc davantage que les positifs : ce sont eux qui empêchent la réponse d'un
 * fournisseur de débloquer une mission qui attendait celle d'un salarié.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const fait = (f: Partial<FaitObserve> = {}): FaitObserve => ({
  type: "EMAIL_RECEIVED",
  actorId: null,
  entityType: null,
  entityId: null,
  relatedRefs: [],
  payload: {},
  missionId: null,
  ...f,
});

describe("correspondance d'un fait avec une attente", () => {
  it("le type doit correspondre", () => {
    expect(correspond({ event: "EMAIL_RECEIVED" }, fait())).toBe(true);
    expect(correspond({ event: "DOCUMENT_UPLOADED" }, fait())).toBe(false);
  });

  it("le type est comparé sans se soucier de la casse ni des espaces", () => {
    expect(correspond({ event: "  email_received " }, fait())).toBe(true);
  });

  it("UNE ATTENTE SANS TYPE N'ATTRAPE RIEN — l'inverse du « pas de filtre = tout passe »", () => {
    expect(correspond({}, fait())).toBe(false);
    expect(correspond({ from: "redouane" }, fait({ actorId: "redouane" }))).toBe(false);
  });

  it("l'émetteur est cherché dans l'acteur ET dans les champs connus de la charge utile", () => {
    const a = { event: "EMAIL_RECEIVED", from: "redouane" };
    expect(correspond(a, fait({ actorId: "redouane" }))).toBe(true);
    expect(correspond(a, fait({ payload: { fromAddress: "redouane" } }))).toBe(true);
    expect(correspond(a, fait({ payload: { senderEmail: "REDOUANE" } }))).toBe(true);
    expect(correspond(a, fait({ payload: { employeeId: "redouane" } }))).toBe(true);
  });

  it("l'inclusion marche sur une adresse complète", () => {
    expect(correspond(
      { event: "EMAIL_RECEIVED", from: "redouane" },
      fait({ payload: { from: "Redouane B. <redouane@adventum.dz>" } }),
    )).toBe(true);
  });

  it("UN NOM TROP COURT NE VAUT PAS INCLUSION : « ali » ne réveille pas « natalie@… »", () => {
    expect(correspond(
      { event: "EMAIL_RECEIVED", from: "ali" },
      fait({ payload: { from: "natalie@adventum.dz" } }),
    )).toBe(false);
    // Mais l'égalité exacte reste acceptée, quelle que soit la longueur.
    expect(correspond({ event: "EMAIL_RECEIVED", from: "ali" }, fait({ actorId: "ali" }))).toBe(true);
  });

  it("un émetteur qui ne correspond à rien ne réveille pas", () => {
    expect(correspond(
      { event: "EMAIL_RECEIVED", from: "redouane" },
      fait({ actorId: "khaled", payload: { from: "khaled@adventum.dz" } }),
    )).toBe(false);
  });

  it("l'entité est comparée à l'entité principale ET aux références liées", () => {
    const a = { event: "DOCUMENT_UPLOADED", entity: "EMPLOYEE:e-42" };
    expect(correspond(a, fait({ type: "DOCUMENT_UPLOADED", entityType: "EMPLOYEE", entityId: "e-42" }))).toBe(true);
    expect(correspond(a, fait({ type: "DOCUMENT_UPLOADED", relatedRefs: ["EMPLOYEE:e-42"] }))).toBe(true);
    expect(correspond(a, fait({ type: "DOCUMENT_UPLOADED", entityType: "EMPLOYEE", entityId: "e-43" }))).toBe(false);
  });

  it("toutes les conditions posées doivent être remplies, pas seulement l'une d'elles", () => {
    const a = { event: "DOCUMENT_UPLOADED", from: "redouane", entity: "EMPLOYEE:e-42" };
    // Le bon émetteur, la mauvaise entité.
    expect(correspond(a, fait({
      type: "DOCUMENT_UPLOADED", actorId: "redouane", entityType: "EMPLOYEE", entityId: "e-99",
    }))).toBe(false);
    // La bonne entité, le mauvais émetteur.
    expect(correspond(a, fait({
      type: "DOCUMENT_UPLOADED", actorId: "khaled", entityType: "EMPLOYEE", entityId: "e-42",
    }))).toBe(false);
    // Les deux.
    expect(correspond(a, fait({
      type: "DOCUMENT_UPLOADED", actorId: "redouane", entityType: "EMPLOYEE", entityId: "e-42",
    }))).toBe(true);
  });

  it("une charge utile qui n'est pas un objet ne fait pas planter la comparaison", () => {
    expect(correspond({ event: "EMAIL_RECEIVED", from: "x" }, fait({ payload: "du texte" }))).toBe(false);
    expect(correspond({ event: "EMAIL_RECEIVED", from: "x" }, fait({ payload: null }))).toBe(false);
    expect(correspond({ event: "EMAIL_RECEIVED" }, fait({ payload: ["a"] }))).toBe(true);
  });
});

describe("échéance d'une attente", () => {
  const t0 = new Date("2026-01-01T00:00:00Z");
  const j = (n: number) => new Date(t0.getTime() + n * 24 * 3600 * 1000);

  it("sans échéance, une attente n'expire jamais", () => {
    expect(echue({ event: "X" }, t0, j(3650))).toBe(false);
  });

  it("l'échéance ne se déclenche qu'APRÈS le délai", () => {
    expect(echue({ event: "X", withinDays: 5 }, t0, j(4))).toBe(false);
    expect(echue({ event: "X", withinDays: 5 }, t0, j(5))).toBe(false);
    expect(echue({ event: "X", withinDays: 5 }, t0, j(6))).toBe(true);
  });
});

describe("relecture d'une attente venue de la base", () => {
  it("retype ce qui est utilisable et écarte le reste", () => {
    expect(lireAttente({ event: "EMAIL_RECEIVED", from: " redouane ", withinDays: 5 }))
      .toEqual({ event: "EMAIL_RECEIVED", from: "redouane", entity: undefined, withinDays: 5 });
  });

  it("rend null sur ce qui n'est pas une attente", () => {
    expect(lireAttente(null)).toBeNull();
    expect(lireAttente("texte")).toBeNull();
    expect(lireAttente([])).toBeNull();
    expect(lireAttente({})).toBeNull();
    expect(lireAttente({ withinDays: 5 })).toBeNull();
  });

  it("écarte une échéance absurde plutôt que de la propager", () => {
    expect(lireAttente({ event: "X", withinDays: -3 })?.withinDays).toBeUndefined();
    expect(lireAttente({ event: "X", withinDays: "cinq" })?.withinDays).toBeUndefined();
  });

  it("une attente relue vide n'attrape rien : la stricte est conservée jusqu'au bout", () => {
    const a = lireAttente({ event: "", from: "  " });
    expect(a).toBeNull();
  });
});

/* ═══════════ ATTENTES v2 — temps, e-mail typé, compositions (chantier Run 4) ═══════════ */

import { decomposer, echueTemporelle, etatAttente, lireProgres, pieceRepond } from "@/lib/missions/events/match";

const T0 = new Date("2026-08-29T10:00:00.000Z");

describe("WAIT_FOR_TIME — une branche `until` se règle par l'horloge, jamais par un fait", () => {
  it("échue quand l'instant passe, pas avant — l'horloge est un paramètre", () => {
    const a = { until: "2026-08-30T09:00:00.000Z" };
    expect(echueTemporelle(a, T0)).toBe(false);
    expect(echueTemporelle(a, new Date("2026-08-30T09:00:00.000Z"))).toBe(true);
    expect(echueTemporelle(a, new Date("2026-09-15T00:00:00.000Z"))).toBe(true);
  });

  it("un fait n'y peut RIEN : « reviens demain » ne se règle pas sur le premier e-mail venu", () => {
    expect(correspond({ until: "2026-08-30T09:00:00.000Z" }, fait({ type: "EMAIL_RECEIVED" }))).toBe(false);
  });

  it("une échéance illisible n'échoit jamais — mieux vaut dormir que se réveiller au hasard", () => {
    expect(echueTemporelle({ until: "demain" }, new Date("2099-01-01"))).toBe(false);
  });
});

describe("attentes e-mail TYPÉES — fil, objet, pièce jointe (§23, §26)", () => {
  const mail = (payload: Record<string, unknown>) =>
    fait({ type: "EMAIL_RECEIVED", payload: { from: "sarah@partenaire.dz", ...payload } });

  it("le FIL exact bat toute heuristique : bon threadId → oui, autre fil → non", () => {
    const a = { event: "EMAIL_RECEIVED", threadId: "thr-77" };
    expect(correspond(a, mail({ threadId: "thr-77" }))).toBe(true);
    expect(correspond(a, mail({ threadId: "thr-99" }))).toBe(false);
    expect(correspond(a, mail({}))).toBe(false);
  });

  it("l'objet s'inclut (≥ 4 caractères), insensible à la casse", () => {
    const a = { event: "EMAIL_RECEIVED", subject: "contrat Beker" };
    expect(correspond(a, mail({ subject: "RE: Contrat BEKER — version signée" }))).toBe(true);
    expect(correspond(a, mail({ subject: "Facture mars" }))).toBe(false);
  });

  it("§26 — « je te l'envoie demain » SANS pièce ne règle PAS une attente qui exige la pièce", () => {
    const a = { event: "EMAIL_RECEIVED", from: "sarah", attachment: true as const };
    expect(correspond(a, mail({ subject: "Je te l'envoie demain", hasAttachments: false }))).toBe(false);
    expect(correspond(a, mail({ subject: "Voici", attachments: ["contrat.pdf"] }))).toBe(true);
  });

  it("le motif de pièce filtre par nom : « contrat » et « *.pdf » attrapent contrat.pdf, pas photo.png", () => {
    expect(pieceRepond("contrat", ["contrat.pdf"])).toBe(true);
    expect(pieceRepond("*.pdf", ["contrat.pdf"])).toBe(true);
    expect(pieceRepond("*.pdf", ["photo.png"])).toBe(false);
    expect(pieceRepond("", ["contrat.pdf"])).toBe(false);
    const a = { event: "EMAIL_RECEIVED", attachment: "contrat" };
    expect(correspond(a, mail({ attachments: ["Contrat_Beker_v2.PDF"] }))).toBe(true);
    expect(correspond(a, mail({ attachments: ["photo.png"] }))).toBe(false);
  });
});

describe("compositions anyOf / allOf — l'état se calcule, la progression se PERSISTE", () => {
  const contratDeSarah = { event: "EMAIL_RECEIVED", from: "sarah", attachment: "contrat" };
  const devisDeMehdi = { event: "EMAIL_RECEIVED", from: "mehdi", attachment: "devis" };
  const mailDe = (qui: string, piece: string) =>
    fait({ type: "EMAIL_RECEIVED", payload: { from: `${qui}@x.dz`, attachments: [piece] } });

  it("OU (§27) : « dès que Sarah OU Mehdi envoie » — le premier des deux règle tout", () => {
    const a = { anyOf: [contratDeSarah, devisDeMehdi] };
    const e = etatAttente(a, [], mailDe("mehdi", "devis-2026.pdf"), T0);
    expect(e.complete).toBe(true);
    expect(e.reglees).toEqual([1]);
  });

  it("ET (§27) : le contrat SEUL ne suffit pas ; contrat PUIS devis (progression relue) conclut", () => {
    const a = { allOf: [contratDeSarah, devisDeMehdi] };
    const apresContrat = etatAttente(a, [], mailDe("sarah", "contrat.pdf"), T0);
    expect(apresContrat.complete).toBe(false);
    expect(apresContrat.reglees).toEqual([0]);
    // …redémarrage entre les deux : la progression revient DE LA BASE, pas de la mémoire.
    const apresDevis = etatAttente(a, apresContrat.reglees, mailDe("mehdi", "devis.xlsx"), T0);
    expect(apresDevis.complete).toBe(true);
    expect(apresDevis.reglees).toEqual([0, 1]);
  });

  it("§42 — le MÊME fait rejoué ne progresse pas deux fois : l'état est idempotent", () => {
    const a = { allOf: [contratDeSarah, devisDeMehdi] };
    const une = etatAttente(a, [], mailDe("sarah", "contrat.pdf"), T0);
    const deux = etatAttente(a, une.reglees, mailDe("sarah", "contrat.pdf"), T0);
    expect(deux.nouvelles).toEqual([]);
    expect(deux.reglees).toEqual(une.reglees);
    expect(deux.complete).toBe(false);
  });

  it("ET mixte : « le contrat ET demain 10 h » — le fait règle l'une, l'horloge règle l'autre", () => {
    const a = { allOf: [contratDeSarah, { until: "2026-08-30T09:00:00.000Z" }] };
    const apresMail = etatAttente(a, [], mailDe("sarah", "contrat.pdf"), T0);
    expect(apresMail.complete).toBe(false);
    const apresTemps = etatAttente(a, apresMail.reglees, null, new Date("2026-08-30T09:00:01.000Z"));
    expect(apresTemps.complete).toBe(true);
  });

  it("§43 — un événement EN RETARD règle quand même : la correspondance ne dépend pas de l'ordre d'arrivée", () => {
    const a = { allOf: [contratDeSarah, devisDeMehdi] };
    // Le devis est arrivé AVANT le contrat (ordre inverse du plan) : même conclusion.
    const e1 = etatAttente(a, [], mailDe("mehdi", "devis.pdf"), T0);
    const e2 = etatAttente(a, e1.reglees, mailDe("sarah", "contrat.pdf"), T0);
    expect(e2.complete).toBe(true);
  });

  it("decomposer : une attente simple est UNE branche en mode ANY", () => {
    expect(decomposer({ event: "X" })).toEqual({ mode: "ANY", branches: [{ event: "X" }] });
  });

  it("lireProgres relit la progression sans confiance — et rejette le reste", () => {
    expect(lireProgres({ attenteProgres: [0, 2] })).toEqual([0, 2]);
    expect(lireProgres({ attenteProgres: ["a", -1, 1.5, 3] })).toEqual([3]);
    expect(lireProgres(null)).toEqual([]);
    expect(lireProgres({ autre: true })).toEqual([]);
  });

  it("lireAttente relit les compositions à PROFONDEUR 1 — l'imbriqué au-delà est écarté, jamais deviné", () => {
    const lu = lireAttente({
      allOf: [
        { event: "EMAIL_RECEIVED", from: "sarah", attachment: "contrat" },
        { until: "2026-09-01T09:00:00.000Z" },
        { anyOf: [{ event: "X" }] },
      ],
    });
    expect(lu?.allOf).toHaveLength(2);
    expect(lu?.allOf?.[0].attachment).toBe("contrat");
    expect(lu?.allOf?.[1].until).toBe("2026-09-01T09:00:00.000Z");
  });

  it("lireAttente accepte une attente PUREMENT temporelle — c'est le WAIT_FOR_TIME", () => {
    expect(lireAttente({ until: "2026-09-01T10:00:00.000Z" })?.until).toBe("2026-09-01T10:00:00.000Z");
  });
});

describe("l'émetteur d'un fait EXTERNE (§37) — le système ou le nom du signataire désignent aussi bien que l'adresse", () => {
  it("« from: DocuSign » et « from: Karim Mouffok » règlent la même signature ; « from: Nadia » non", () => {
    const fait = { type: "SIGNATURE_COMPLETED", actorId: null, relatedRefs: ["DOCUMENT:ckdoc1"], payload: { from: "k@mouffok.dz", fromName: "Karim Mouffok", systeme: "docusign", source: "docusign", subject: "Contrat Consulting Mouffok" } };
    expect(correspond({ event: "SIGNATURE_COMPLETED", from: "DocuSign" }, fait)).toBe(true);
    expect(correspond({ event: "SIGNATURE_COMPLETED", from: "Karim Mouffok" }, fait)).toBe(true);
    expect(correspond({ event: "SIGNATURE_COMPLETED", from: "k@mouffok.dz", entity: "DOCUMENT:ckdoc1" }, fait)).toBe(true);
    expect(correspond({ event: "SIGNATURE_COMPLETED", from: "Nadia" }, fait)).toBe(false);
    expect(correspond({ event: "SIGNATURE_COMPLETED", entity: "DOCUMENT:autre" }, fait)).toBe(false);
  });
});
