import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import type { CurrentUser } from "@/lib/session";
import type { EffectiveAccess, Module, Action } from "@/lib/rbac";
import { buildProposal, type AssistantActionPayload } from "@/lib/assistant";

/**
 * GOLDEN OPS VAGUE 5b — PRISES EN CHARGE (personne de l'annuaire OU profil libre, décision
 * PAR personne avec pièce d'identité d'office, besoins pièce/prestation, « sans objet » ≠
 * suppression, devis multi-cases avec garde anti DOUBLE PAIEMENT, envoi Finances bloquant),
 * MATÉRIEL PROMOTIONNEL (circuit court à devis-en-main, agence retenue, chantiers parallèles,
 * règlement au montant du dossier par défaut) et STOCK à MOUVEMENTS (FUSION de la fiche
 * article, distribution gardée par le stock recalculé, suppression CRITIQUE comptée).
 */

function userWith(perms: Partial<Record<Module, Action[]>>, role: CurrentUser["role"], id: string, name: string): CurrentUser {
  const modules = new Map(
    Object.entries(perms).map(([m, actions]) => [
      m as Module,
      { module: m as Module, actions: new Set(actions as Action[]), scope: "ALL" as const },
    ]),
  );
  return {
    id, name, email: `${id}@t.dz`, role,
    access: { modules, rowGrants: new Map() } as unknown as EffectiveAccess,
    mustChangePassword: false,
  };
}

let dbOk = false;
try { await prisma.$queryRaw`SELECT 1`; dbOk = true; } catch { dbOk = false; }
const suite = dbOk ? describe : describe.skip;

const TAG = `__ops5b__${Date.now()}`;
const domainArgs = (p: { payload: unknown }) => (p.payload as Extract<AssistantActionPayload, { kind: "domain_op" }>).args;

let saId = "";
let doctorId = "";
let congressId = "";
let benefId = "";
let cellHotelId = "";
let cellTicketId = "";
let quoteId = "";
let promoId = "";
let stockItemId = "";

// Le vrai loader d'accès donne TOUT au Super Admin ; le harness construit l'accès à la
// main — on lui donne donc les permissions modules que l'écran exige.
const sa = () => userWith({
  CONGRESS_NATIONAL: ["VIEW", "CREATE", "UPDATE", "VALIDATE"],
  CONGRESS_INTERNATIONAL: ["VIEW", "CREATE", "UPDATE", "VALIDATE"],
  PROMO_MATERIAL: ["VIEW", "CREATE", "UPDATE", "DELETE"],
}, "SUPER_ADMIN", saId, `${TAG} Amine`);

suite("ops vague 5b — prises en charge, matériel promotionnel, stock", () => {
  beforeAll(async () => {
    const s = await prisma.user.create({ data: { name: `${TAG} Amine`, email: `${TAG}s@t.dz`, passwordHash: "x", role: "SUPER_ADMIN" } });
    saId = s.id;

    const doctor = await prisma.medicalDoctor.create({ data: { name: `${TAG} Pr Benali` } });
    doctorId = doctor.id;

    const congress = await prisma.congressNational.create({
      data: { name: `${TAG} Congrès SFC 2026`, requestStatus: "APPROVED" },
    });
    congressId = congress.id;

    const benef = await prisma.careBeneficiary.create({
      data: { congressNationalId: congress.id, firstName: "Karim", lastName: `${TAG}Ziani`, status: "PROPOSED", position: 0 },
    });
    benefId = benef.id;
    const [hotel, ticket] = await Promise.all([
      prisma.careCell.create({ data: { beneficiaryId: benef.id, kind: "SERVICE", serviceKind: "HOTEL", label: "Hôtel 3 nuits", status: "REQUESTED", position: 0 } }),
      prisma.careCell.create({ data: { beneficiaryId: benef.id, kind: "SERVICE", serviceKind: "TICKET", label: "Billet d'avion", status: "REQUESTED", position: 1 } }),
    ]);
    cellHotelId = hotel.id;
    cellTicketId = ticket.id;
    await prisma.careCell.create({ data: { beneficiaryId: benef.id, kind: "DOCUMENT", label: "Passeport", status: "REQUESTED", position: 2 } });

    const quote = await prisma.careQuote.create({
      data: { congressNationalId: congress.id, supplier: `${TAG} Agence Atlas`, amountDzd: 180_000, status: "PENDING" },
    });
    quoteId = quote.id;

    const promo = await prisma.promoMaterial.create({
      data: { reference: `${TAG}-MP-1`, title: `${TAG} Présentoir Cardio`, status: "PROSPECTION_REQUESTED", requesterId: s.id },
    });
    promoId = promo.id;

    const item = await prisma.promoStockItem.create({
      data: { name: `${TAG} Présentoir comptoir`, reference: "REF-01", unit: "pièce", location: "Magasin Alger", alertThreshold: 10, notes: "lot 2025" },
    });
    stockItemId = item.id;
    await prisma.promoStockMovement.create({ data: { itemId: item.id, kind: "RECEIPT", delta: 100, reason: "Livraison initiale" } });
  });

  afterAll(async () => {
    await prisma.promoStockMovement.deleteMany({ where: { item: { name: { startsWith: TAG } } } }).catch(() => {});
    await prisma.promoStockItem.deleteMany({ where: { name: { startsWith: TAG } } }).catch(() => {});
    await prisma.promoMaterial.deleteMany({ where: { reference: { startsWith: TAG } } }).catch(() => {});
    await prisma.careQuote.deleteMany({ where: { supplier: { startsWith: TAG } } }).catch(() => {});
    await prisma.careCell.deleteMany({ where: { beneficiary: { lastName: { startsWith: TAG } } } }).catch(() => {});
    await prisma.careBeneficiary.deleteMany({ where: { lastName: { startsWith: TAG } } }).catch(() => {});
    await prisma.congressNational.deleteMany({ where: { name: { startsWith: TAG } } }).catch(() => {});
    await prisma.medicalDoctor.deleteMany({ where: { name: { startsWith: TAG } } }).catch(() => {});
    await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } }).catch(() => {});
  });

  describe("prises en charge — personnes et décisions PAR personne", () => {
    it("add_care_person : le praticien de l'ANNUAIRE se résout (doctorId) ; un inconnu devient PROFIL LIBRE (lastName)", async () => {
      const fromDirectory = await buildProposal("care_operation", {
        op: "add_care_person", target: "Congrès SFC", person: `${TAG} Pr Benali`,
      }, sa());
      expect("error" in fromDirectory).toBe(false);
      if (!("error" in fromDirectory)) {
        expect(domainArgs(fromDirectory).doctorId).toBe(doctorId);
        expect(domainArgs(fromDirectory).lastName).toBeNull();
        expect(domainArgs(fromDirectory).scope).toBe("NATIONAL");
        expect(domainArgs(fromDirectory).requestId).toBe(congressId);
      }

      const free = await buildProposal("care_operation", {
        op: "add_care_person", target: "Congrès SFC", person: `${TAG} Invitée Libre`, role: "Chef de service", institution: "CHU Mustapha",
      }, sa());
      expect("error" in free).toBe(false);
      if (!("error" in free)) {
        expect(domainArgs(free).doctorId).toBeNull();
        expect(domainArgs(free).lastName).toBe(`${TAG} Invitée Libre`);
        expect(domainArgs(free).jobTitle).toBe("Chef de service");
      }
    });

    it("decide_care_person : ACCORDER par personne — la pièce d'identité d'office est annoncée ; la personne se résout par nom", async () => {
      const p = await buildProposal("care_operation", {
        op: "decide_care_person", target: "Congrès SFC", person: "Ziani", decision: "accorder",
      }, sa());
      expect("error" in p).toBe(false);
      if (!("error" in p)) {
        expect(domainArgs(p).id).toBe(benefId);
        expect(domainArgs(p).decision).toBe("APPROVED");
        expect(p.warnings.join(" ")).toMatch(/pièce d'identité/);
      }
    });

    it("la porte du catalogue refuse un délégué sans droits congrès — même règle que l'écran", async () => {
      const delegate = userWith({}, "MEDICAL_DELEGATE", "d1", "Délégué");
      const p = await buildProposal("care_operation", {
        op: "decide_care_person", target: "Congrès SFC", person: "Ziani", decision: "accorder",
      }, delegate);
      expect("error" in p && p.error).toMatch(/droit/);
    });

    it("remove_care_person : le retrait prévient qu'une prestation ENGAGÉE le fera refuser (écarter plutôt)", async () => {
      const p = await buildProposal("care_operation", {
        op: "remove_care_person", target: "Congrès SFC", person: "Ziani",
      }, sa());
      expect("error" in p).toBe(false);
      if (!("error" in p)) expect(p.warnings.join(" ")).toMatch(/ENGAGÉE/);
    });
  });

  describe("prises en charge — besoins (pièces / prestations) et devis", () => {
    it("add_care_cell : « hôtel » en mode prestation → SERVICE/HOTEL ; une attestation sans mode → DOCUMENT", async () => {
      const service = await buildProposal("care_operation", {
        op: "add_care_cell", target: "Congrès SFC", person: "Ziani", label: "Hôtel congrès", mode: "prestation",
      }, sa());
      expect("error" in service).toBe(false);
      if (!("error" in service)) {
        expect(domainArgs(service).kind).toBe("SERVICE");
        expect(domainArgs(service).serviceKind).toBe("HOTEL");
        expect(domainArgs(service).beneficiaryId).toBe(benefId);
      }

      const doc = await buildProposal("care_operation", {
        op: "add_care_cell", target: "Congrès SFC", person: "Ziani", label: "Attestation de participation",
      }, sa());
      expect("error" in doc).toBe(false);
      if (!("error" in doc)) expect(domainArgs(doc).kind).toBe("DOCUMENT");
    });

    it("set_care_cell_status : « sans objet » → WAIVED, en disant que ce n'est PAS une suppression", async () => {
      const p = await buildProposal("care_operation", {
        op: "set_care_cell_status", target: "Congrès SFC", person: "Ziani", label: "Passeport", status: "sans objet",
      }, sa());
      expect("error" in p).toBe(false);
      if (!("error" in p)) {
        expect(domainArgs(p).status).toBe("WAIVED");
        expect(p.warnings.join(" ")).toMatch(/PAS une suppression/);
      }
    });

    it("create_care_quote : le devis désigne les CASES couvertes (multi, virgules) ; un libellé inconnu est refusé en listant les éléments", async () => {
      const p = await buildProposal("care_operation", {
        op: "create_care_quote", target: "Congrès SFC", supplier: "Air Algérie Voyages", amount: "150000", label: "Hôtel, Billet",
      }, sa());
      expect("error" in p).toBe(false);
      if (!("error" in p)) {
        const ids = String(domainArgs(p).cellIds).split(",");
        expect(ids).toContain(cellHotelId);
        expect(ids).toContain(cellTicketId);
        expect(domainArgs(p).amountDzd).toBe("150000");
      }

      const unknown = await buildProposal("care_operation", {
        op: "create_care_quote", target: "Congrès SFC", supplier: "X", amount: "1000", label: "Limousine",
      }, sa());
      expect("error" in unknown && unknown.error).toMatch(/Hôtel 3 nuits/);
    });

    it("decide_care_quote : ACCEPTER crée l'ordre de dépense et annonce la garde anti DOUBLE PAIEMENT", async () => {
      const p = await buildProposal("care_operation", {
        op: "decide_care_quote", target: "Congrès SFC", supplier: "Atlas", decision: "accepter",
      }, sa());
      expect("error" in p).toBe(false);
      if (!("error" in p)) {
        expect(domainArgs(p).id).toBe(quoteId);
        expect(domainArgs(p).decision).toBe("ACCEPTED");
        expect(p.warnings.join(" ")).toMatch(/double paiement/i);
      }
    });

    it("send_care_to_finance : l'envoi annonce le REFUS bloquant tant qu'il manque une pièce ou une décision", async () => {
      const p = await buildProposal("care_operation", {
        op: "send_care_to_finance", target: "Congrès SFC",
      }, sa());
      expect("error" in p).toBe(false);
      if (!("error" in p)) expect(p.warnings.join(" ")).toMatch(/REFUSE tant que/);
    });
  });

  describe("matériel promotionnel — circuit court et marches", () => {
    it("start_promo_circuit : « devis en main » saute la demande de devis (hasQuote)", async () => {
      const p = await buildProposal("promo_operation", {
        op: "start_promo_circuit", reference: `${TAG}-MP-1`, mode: "devis déjà en main",
      }, sa());
      expect("error" in p).toBe(false);
      if (!("error" in p)) {
        expect(domainArgs(p).id).toBe(promoId);
        expect(domainArgs(p).hasQuote).toBe("1");
      }
    });

    it("choose_promo_agency : l'agence retenue et son montant partent tels quels (geste du demandeur)", async () => {
      const p = await buildProposal("promo_operation", {
        op: "choose_promo_agency", reference: `${TAG}-MP-1`, supplier: "Imprimerie Étoile", amount: "90000",
      }, sa());
      expect("error" in p).toBe(false);
      if (!("error" in p)) {
        expect(domainArgs(p).chosenAgency).toBe("Imprimerie Étoile");
        expect(domainArgs(p).chosenAmount).toBe("90000");
      }
    });

    it("complete_promo_track : « visa publicitaire » → chantier AD_VISA (les trois avancent en parallèle)", async () => {
      const p = await buildProposal("promo_operation", {
        op: "complete_promo_track", reference: `${TAG}-MP-1`, track: "visa publicitaire",
      }, sa());
      expect("error" in p).toBe(false);
      if (!("error" in p)) {
        expect(domainArgs(p).track).toBe("AD_VISA");
        expect(p.warnings.join(" ")).toMatch(/parallèle/);
      }
    });

    it("settle_promo : sans montant donné, le règlement annonce le montant retenu du dossier par DÉFAUT", async () => {
      const p = await buildProposal("promo_operation", {
        op: "settle_promo", reference: `${TAG}-MP-1`,
      }, sa());
      expect("error" in p).toBe(false);
      if (!("error" in p)) {
        expect(domainArgs(p).amount).toBeNull();
        expect(p.fields.map((f) => f.value).join(" ")).toMatch(/défaut/);
      }
    });
  });

  describe("stock du matériel promo — la quantité ne se saisit jamais", () => {
    it("update_stock_item : FUSION — changer le SEUL seuil rejoue référence, unité, emplacement et notes", async () => {
      const p = await buildProposal("promo_operation", {
        op: "update_stock_item", name: `${TAG} Présentoir comptoir`, threshold: "25",
      }, sa());
      expect("error" in p).toBe(false);
      if (!("error" in p)) {
        const a = domainArgs(p);
        expect(a.id).toBe(stockItemId);
        expect(a.alertThreshold).toBe("25");
        expect(a.reference).toBe("REF-01");
        expect(a.unit).toBe("pièce");
        expect(a.location).toBe("Magasin Alger");
        expect(a.notes).toBe("lot 2025");
      }
    });

    it("record_stock_movement : une DISTRIBUTION porte destinataire et motif, la garde du stock recalculé est annoncée", async () => {
      const p = await buildProposal("promo_operation", {
        op: "record_stock_movement", name: `${TAG} Présentoir comptoir`, mode: "distribution", quantity: "40", person: "Yasmine déléguée",
      }, sa());
      expect("error" in p).toBe(false);
      if (!("error" in p)) {
        expect(domainArgs(p).kind).toBe("DISTRIBUTION");
        expect(domainArgs(p).quantity).toBe("40");
        expect(domainArgs(p).recipient).toBe("Yasmine déléguée");
        expect(p.warnings.join(" ")).toMatch(/recalculé/);
      }
    });

    it("delete_stock_item : CRITIQUE — confirmation par le nom exact, mouvements emportés comptés", async () => {
      const p = await buildProposal("promo_operation", {
        op: "delete_stock_item", name: `${TAG} Présentoir comptoir`,
      }, sa());
      expect("error" in p).toBe(false);
      if (!("error" in p)) {
        expect(p.confirmText).toBe(`${TAG} Présentoir comptoir`);
        expect(p.fields.map((f) => f.value).join(" ")).toContain("1");
      }
    });
  });
});
