import { describe, expect, it } from "vitest";
import { CATALOGUE, RESUME_POUR_PLANNER, catalogueDe, estTypeConnu, normaliserType, typesPour } from "./catalogue";
import { SEUIL_DOUTE, SEUIL_SUR, decider, estRef, nettoyer, normaliserLot } from "./ingestion";

/**
 * L'INGESTION UNIVERSELLE (§37), la part pure : identifier → normaliser → décider. Sans base,
 * sans réseau — la forme canonique d'un fait, quel que soit le fournisseur qui l'a nommé.
 */
const ok = (n: ReturnType<typeof normaliserLot>[number]) => { if (!n.ok) throw new Error(n.rejet); return n.fait; };

describe("le catalogue — un type canonique, des sources, des entités", () => {
  it("connaît les faits de l'ERP et des systèmes externes, et normalise l'écriture d'un fournisseur", () => {
    expect(CATALOGUE.length).toBeGreaterThanOrEqual(30);
    expect(new Set(CATALOGUE.map((t) => t.type)).size).toBe(CATALOGUE.length);
    expect(normaliserType("Signature Completed")).toBe("SIGNATURE_COMPLETED");
    expect(normaliserType(" envelope-completed ")).toBe("ENVELOPE_COMPLETED");
    expect(estTypeConnu("payment received")).toBe(true);
    expect(estTypeConnu("warehouse.temperature")).toBe(false);
    expect(catalogueDe("TENDER_AWARDED")?.sourceDomain).toBe("PCH");
    expect(typesPour("docusign")).toEqual(expect.arrayContaining(["SIGNATURE_SENT", "SIGNATURE_COMPLETED", "SIGNATURE_DECLINED", "CONTRACT_SIGNED"]));
    expect(RESUME_POUR_PLANNER).toContain("SIGNATURE_COMPLETED");
    expect(RESUME_POUR_PLANNER).toContain("EMAIL_RECEIVED");
  });
});

describe("normaliser — chaque fournisseur ramené à UNE forme", () => {
  it("DocuSign Connect : une enveloppe complète devient SIGNATURE_COMPLETED, avec la référence ERP du champ personnalisé, l'émetteur et l'objet", () => {
    const [n] = normaliserLot("docusign", {
      event: "envelope-completed", generatedDateTime: "2026-09-01T10:05:00Z",
      data: {
        envelopeId: "env-001",
        envelopeSummary: {
          status: "completed", emailSubject: "Contrat Consulting Mouffok", completedDateTime: "2026-09-01T10:00:00Z",
          recipients: { signers: [{ name: "Karim Mouffok", email: "k@mouffok.dz", status: "completed" }] },
          customFields: { textCustomFields: [{ name: "erpRef", value: "LEGAL_DOCUMENT:ckdoc000001" }, { name: "autre", value: "x" }] },
        },
      },
    });
    const f = ok(n!);
    expect(f.type).toBe("SIGNATURE_COMPLETED");
    expect(f.sourceDomain).toBe("LEGAL");
    expect(f.externalId).toBe("env-001:envelope-completed");
    expect(f.refs).toEqual(["LEGAL_DOCUMENT:ckdoc000001"]);
    expect(f.emetteur).toEqual({ email: "k@mouffok.dz", nom: "Karim Mouffok", systeme: "docusign" });
    expect(f.mentions).toEqual(expect.arrayContaining(["Contrat Consulting Mouffok", "Karim Mouffok"]));
    expect(f.occurredAt?.toISOString()).toBe("2026-09-01T10:00:00.000Z");
    expect(f.payload.from).toBe("k@mouffok.dz");
    expect(f.confidentiel).toBe(false);
    // Un événement non suivi est REJETÉ avec la raison — jamais inventé.
    const [rejet] = normaliserLot("docusign", { event: "envelope-resent", data: { envelopeId: "env-001" } });
    expect(rejet!.ok).toBe(false);
  });

  it("SAP : une commande d'achat créée ; HubSpot : un lot de transactions ; PCH : une attribution ; IQVIA : une période ; e-signature : un document signé", () => {
    const sap = ok(normaliserLot("sap", { event: "PurchaseOrder.Created", eventId: "sap-1", PurchaseOrder: "4500001234", Supplier: "Hetero Labs", amount: 125000, currency: "DZD", erpRef: "SUPPLIER:cksup00000001" })[0]!);
    expect(sap.type).toBe("PURCHASE_ORDER_CREATED");
    expect(sap.externalId).toBe("sap-1");
    expect(sap.refs).toEqual(["SUPPLIER:cksup00000001"]);
    expect(sap.mentions).toEqual(["4500001234", "Hetero Labs"]);
    expect(sap.payload).toMatchObject({ numero: "4500001234", fournisseur: "Hetero Labs", montant: 125000, devise: "DZD" });

    const hub = normaliserLot("hubspot", [
      { subscriptionType: "deal.propertyChange", objectId: 42, propertyName: "dealstage", propertyValue: "closedwon", occurredAt: 1756720000000, eventId: 77 },
      { subscriptionType: "ticket.creation", objectId: 1 },
    ]);
    expect(hub).toHaveLength(2);
    expect(ok(hub[0]!)).toMatchObject({ type: "CRM_DEAL_UPDATED", externalId: "77", sourceDomain: "SALES" });
    expect(hub[1]!.ok).toBe(false);

    const pch = ok(normaliserLot("pch", { event: "tender.awarded", tender: { reference: "AO-2026-12", title: "Oncologie — lot 3" }, awardedTo: "Adventum Pharma" })[0]!);
    expect(pch).toMatchObject({ type: "TENDER_AWARDED", externalId: "AO-2026-12:tender.awarded" });
    expect(pch.mentions).toEqual(expect.arrayContaining(["AO-2026-12", "Adventum Pharma"]));

    const iq = ok(normaliserLot("iqvia", { period: "2026-Q2", dataset: "ventes", molecules: ["trastuzumab", "bevacizumab"], country: "DZ" })[0]!);
    expect(iq).toMatchObject({ type: "MARKET_DATA_UPDATED", externalId: "ventes:2026-Q2" });
    expect(iq.mentions).toEqual(["trastuzumab", "bevacizumab"]);

    const sig = ok(normaliserLot("signature", { event: "completed", documentId: "doc-9", title: "NDA Kwality", signer: { name: "Nadia", email: "n@kwality.dz" }, reference: "LEGAL_DOCUMENT:ckdoc000009" })[0]!);
    expect(sig).toMatchObject({ type: "SIGNATURE_COMPLETED", externalId: "doc-9:completed", refs: ["LEGAL_DOCUMENT:ckdoc000009"] });
    expect(sig.emetteur.email).toBe("n@kwality.dz");
  });

  it("générique : un type du catalogue entre sous son nom ; un type inconnu entre comme WEBHOOK_RECEIVED avec son nom brut ; l'entité devient une référence", () => {
    const connu = ok(normaliserLot("generic", { type: "payment received", externalId: "pay-1", entity: { type: "invoice", id: "ckinv0000001" }, from: { email: "banque@x.dz", name: "Banque" }, payload: { montant: 1000, apiKey: "SECRET-123" }, occurredAt: "2026-09-02T08:00:00Z" })[0]!);
    expect(connu).toMatchObject({ type: "PAYMENT_RECEIVED", externalId: "pay-1", refs: ["INVOICE:ckinv0000001"], sourceDomain: "FINANCES" });
    expect(connu.payload.montant).toBe(1000);
    expect(JSON.stringify(connu.payload)).not.toMatch(/SECRET-123|apiKey/);
    expect(connu.payload.from).toBe("banque@x.dz");

    const inconnu = ok(normaliserLot("generic", { type: "warehouse.temperature", id: "t-1", payload: { celsius: 9.5 } })[0]!);
    expect(inconnu.type).toBe("WEBHOOK_RECEIVED");
    expect(inconnu.payload.typeBrut).toBe("warehouse.temperature");
    expect(inconnu.payload.typeCatalogue).toBe("WEBHOOK_RECEIVED");

    const confidentiel = ok(normaliserLot("generic", { type: "DOCUMENT_UPLOADED", id: "d-1", payload: { objet: "Avenant salaire de Mme K." } })[0]!);
    expect(confidentiel.confidentiel).toBe(true);
  });

  it("source inconnue, charge vide, élément qui n'est pas un objet : dits, jamais devinés", () => {
    expect(normaliserLot("fax", { a: 1 })[0]).toMatchObject({ ok: false });
    expect(normaliserLot("generic", [])[0]).toMatchObject({ ok: false, rejet: "charge vide" });
    expect(normaliserLot("generic", ["texte"])[0]).toMatchObject({ ok: false });
  });
});

describe("nettoyer et décider — aucun secret, des seuils, jamais un rattachement silencieux", () => {
  it("retire les secrets à toute profondeur, borne les textes et la profondeur", () => {
    const propre = nettoyer({ token: "x", data: { Authorization: "Bearer y", ok: 1, long: "a".repeat(3000), plus: { p: { q: { r: { s: { t: 1 } } } } } } }) as Record<string, unknown>;
    expect(propre.token).toBeUndefined();
    const data = propre.data as Record<string, unknown>;
    expect(data.Authorization).toBeUndefined();
    expect(data.ok).toBe(1);
    expect((data.long as string).length).toBeLessThan(2100);
    expect(JSON.stringify(propre)).toContain("[profondeur]");
  });

  it("une référence est TYPE:id ; une chaîne libre n'en est pas une", () => {
    expect(estRef("LEGAL_DOCUMENT:ckabc123")).toBe(true);
    expect(estRef("legal_document:1")).toBe(false);
    expect(estRef("Karim Mouffok")).toBe(false);
  });

  it("des références sûres rattachent ; un candidat ≥ 0,85 rattache ; entre 0,5 et 0,85 c'est À VÉRIFIER ; en dessous, rien ; sans mention, c'est sûr", () => {
    expect(SEUIL_SUR).toBe(0.85); expect(SEUIL_DOUTE).toBe(0.5);
    expect(decider(["SUPPLIER:a"], [])).toMatchObject({ decision: "SURE", confiance: 1, refs: ["SUPPLIER:a"] });
    expect(decider([], [{ mention: "Hetero Labs Ltd", ref: "SUPPLIER:a", libelle: "Hetero Labs Ltd", confiance: 0.97 }])).toMatchObject({ decision: "SURE", refs: ["SUPPLIER:a"], confiance: 0.97 });
    const doute = decider([], [{ mention: "Hetero", ref: "SUPPLIER:a", libelle: "Hetero Labs Ltd", confiance: 0.7 }, { mention: "Hetero", ref: "SUPPLIER:b", libelle: "Hetero Biopharma", confiance: 0.68 }]);
    expect(doute.decision).toBe("A_VERIFIER");
    expect(doute.refs).toEqual([]);
    expect(doute.aVerifier).toHaveLength(2);
    expect(decider([], [{ mention: "x", ref: "SUPPLIER:c", libelle: "X", confiance: 0.3 }])).toMatchObject({ decision: "SANS_ASSOCIATION", refs: [] });
    expect(decider([], [])).toMatchObject({ decision: "SURE", confiance: 1, refs: [] });
    // Sûr ET douteux à la fois : on rattache le sûr, on garde le douteux À VÉRIFIER — il n'est pas perdu.
    const mixte = decider(["LEGAL_DOCUMENT:d"], [{ mention: "Hetero", ref: "SUPPLIER:a", libelle: "Hetero Labs Ltd", confiance: 0.7 }]);
    expect(mixte).toMatchObject({ decision: "SURE", refs: ["LEGAL_DOCUMENT:d"] });
    expect(mixte.aVerifier).toHaveLength(1);
  });
});
