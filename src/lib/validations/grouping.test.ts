import { describe, it, expect } from "vitest";
import { groupValidations, groupStatus, pieceSummary, type GroupableValidation } from "./grouping";

const v = (over: Partial<GroupableValidation> & { id: string }): GroupableValidation => ({
  reference: `VAL-${over.id}`,
  title: `Demande ${over.id}`,
  status: "PENDING",
  createdAt: "2026-08-01T10:00:00.000Z",
  scope: "OBJECT",
  parentKey: null,
  ...over,
});

describe("Le statut d'un ensemble ne se lit jamais sur la pièce la plus avancée", () => {
  it("reste EN ATTENTE tant qu'une seule pièce attend — c'est tout le bug", () => {
    expect(groupStatus(["APPROVED", "APPROVED", "PENDING"])).toBe("PENDING");
  });

  it("un refus l'emporte sur des acceptations : la demande ne passe pas telle quelle", () => {
    expect(groupStatus(["APPROVED", "REJECTED"])).toBe("REJECTED");
  });

  it("une modification demandée se signale, faute de refus", () => {
    expect(groupStatus(["APPROVED", "CHANGES_REQUESTED"])).toBe("CHANGES_REQUESTED");
  });

  it("« acceptée » ne se dit QUE lorsque tout l'est", () => {
    expect(groupStatus(["APPROVED", "APPROVED"])).toBe("APPROVED");
  });

  it("un ensemble vide n'est pas « accepté » par défaut", () => {
    expect(groupStatus([])).toBe("PENDING");
  });
});

describe("Le décompte se dit en clair, pour qu'on n'ait rien à deviner", () => {
  it("annonce combien de pièces, et où elles en sont", () => {
    expect(pieceSummary([{ status: "APPROVED" }, { status: "APPROVED" }, { status: "PENDING" }]))
      .toBe("3 pièces — 2 acceptées, 1 en attente");
  });

  it("accorde le singulier", () => {
    expect(pieceSummary([{ status: "REJECTED" }])).toBe("1 pièce — 1 refusée");
  });

  it("ne dit rien quand il n'y a pas de pièce à compter", () => {
    expect(pieceSummary([])).toBe("");
  });
});

describe("Une demande = une demande", () => {
  const items = [
    v({ id: "piece-facture", scope: "DOCUMENT", parentKey: "ADMIN_REQUEST:dem1", status: "APPROVED", title: "Pièce « Facture » — DEM-2026-007", documentName: "Facture", createdAt: "2026-08-03T10:00:00.000Z" }),
    v({ id: "piece-bc", scope: "DOCUMENT", parentKey: "ADMIN_REQUEST:dem1", status: "PENDING", title: "Pièce « Bon de commande » — DEM-2026-007", documentName: "Bon de commande", createdAt: "2026-08-02T10:00:00.000Z" }),
    v({ id: "autre", title: "Courrier à signer", createdAt: "2026-08-01T10:00:00.000Z" }),
  ];

  it("réunit les validations de pièces sous LEUR demande, au lieu d'en faire trois demandes", () => {
    const groups = groupValidations(items);
    expect(groups).toHaveLength(2);
    expect(groups[0].pieces).toHaveLength(2);
    expect(groups[1].pieces).toHaveLength(0);
  });

  it("affiche « en attente » sur le groupe alors qu'une pièce est acceptée", () => {
    // Exactement la confusion à supprimer : la facture est acceptée, la demande ne l'est pas.
    const g = groupValidations(items)[0];
    expect(g.pieces.some((p) => p.status === "APPROVED")).toBe(true);
    expect(g.status).toBe("PENDING");
    expect(g.summary).toBe("2 pièces — 1 acceptée, 1 en attente");
  });

  it("garde l'ancienneté de la plus ancienne du groupe", () => {
    expect(groupValidations(items)[0].createdAt).toBe("2026-08-02T10:00:00.000Z");
  });

  it("une demande sans objet parent reste seule — la fondre serait aussi trompeur", () => {
    const g = groupValidations(items)[1];
    expect(g.title).toBe("Courrier à signer");
    expect(g.main?.id).toBe("autre");
  });

  it("la demande ENTIÈRE donne son titre au groupe et porte le statut", () => {
    const withMain = [
      v({ id: "main", parentKey: "ADMIN_REQUEST:dem1", title: "Achat de fournitures", status: "APPROVED" }),
      v({ id: "p1", scope: "DOCUMENT", parentKey: "ADMIN_REQUEST:dem1", status: "PENDING", title: "Pièce « Devis »" }),
    ];
    const g = groupValidations(withMain)[0];
    expect(g.title).toBe("Achat de fournitures");
    expect(g.main?.id).toBe("main");
    expect(g.status).toBe("PENDING"); // la demande n'est pas close tant qu'une pièce attend
  });

  it("n'invente pas de groupe et ne perd aucune demande", () => {
    const groups = groupValidations(items);
    const seen = groups.flatMap((g) => [...(g.main ? [g.main.id] : []), ...g.pieces.map((p) => p.id)]);
    expect(seen.sort()).toEqual(items.map((i) => i.id).sort());
  });

  it("préserve l'ordre d'arrivée des demandes", () => {
    expect(groupValidations(items).map((g) => g.key)).toEqual(["ADMIN_REQUEST:dem1", "self:autre"]);
  });
});
