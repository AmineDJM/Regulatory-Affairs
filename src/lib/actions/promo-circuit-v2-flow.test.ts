import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@/lib/session";

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
let ACTOR: CurrentUser | null = null;
vi.mock("@/lib/session", () => ({ requireUser: async () => ACTOR }));

// ⚠ ORDRE D'IMPORT (documenté dans `assistant/capability-audit.test.ts`) : `ops/index.ts` et
// `lib/assistant.ts` forment un cycle d'INITIALISATION. `assistant` se charge le PREMIER, comme dans
// l'application — avant toute action qui, par la fabrique, remonterait le cycle par l'autre bout.
import "@/lib/assistant";
import { DOMAIN_TOOLS } from "@/lib/assistant/ops";
import { prisma } from "@/lib/prisma";
import { getAccess, userCan, type SessionUser } from "@/lib/rbac";
import { getAppSettings } from "@/lib/settings";
import { canAccessEntity } from "@/lib/entity-access";
import { canEditCompanyId, getMyCompanies } from "@/lib/company";
import { resolveDriveAccess, canViewDrive } from "@/lib/drive";
import { createPromoMaterial, submitQuotes, cancelPromoMaterial } from "./promo-material-actions";
import { validatePromoStep, refusePromoStep, completePromoTrack } from "./promo-circuit-actions";
import {
  demanderDevisPromo, enregistrerDevisPromo, terminerRetranscriptionPromo, choisirLignesPromo, demanderCorrectionDevisPromo,
} from "./promo-devis-actions";
import {
  genererBonsDeCommandePromo, marquerBonDeCommandeEnvoye, deposerFacturePromo, demanderPaiementFacturePromo,
  annulerBonDeCommandePromo, receptionnerLigneFacturePromo,
} from "./promo-execution-actions";
import { enregistrerArticleDemandePromo } from "./promo-demande-actions";
import { deciderVisaCentreAdPro } from "./ad-pro-centre-actions";
import { signerBonDeCommande } from "./bc-signature-actions";
import { decidePayment } from "./payment-centre-actions";
import { validateursDeLaDemande, peutOuvrirLeDossierPromo } from "@/lib/queries/promo-circuit";
import { getAdProCreateData } from "@/lib/queries/ad-pro";
import { executionDuDossier } from "@/lib/queries/promo-execution";
import { emettreDocumentDrive } from "@/platform/in-process/artifact/factory";
import { portsArtefact } from "@/platform/in-process/artifact/ports";
import { designerDossierPromo } from "@/platform/in-process/promo";
import { fichierEmisDeLaPiece } from "@/lib/queries/legal-fichier";
import { fichiersEmis } from "@/lib/legal/fichiers-emis";
import { etatDuBC } from "@/lib/bons-de-commande/etat";

let dbOk = false;
try { await prisma.$queryRaw`SELECT 1`; dbOk = true; } catch { dbOk = false; }
const suite = dbOk ? describe : describe.skip;

const TAG = `__promov2__${Date.now().toString(36)}`;

async function actorFor(id: string): Promise<CurrentUser> {
  const u = await prisma.user.findUniqueOrThrow({ where: { id } });
  const access = await getAccess(id, u.role);
  return { id, name: u.name, email: u.email, role: u.role, secondaryRole: u.secondaryRole, access, mustChangePassword: false };
}
const form = (fields: Record<string, string | string[]>): FormData => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    if (Array.isArray(v)) for (const x of v) fd.append(k, x); else fd.set(k, v);
  }
  return fd;
};
const pdf = (nom: string) => new File([new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52])], nom, { type: "application/pdf" });
const etatDe = (id: string) => prisma.promoMaterial.findUniqueOrThrow({ where: { id }, select: { circuitState: true, circuitVersion: true, chosenAmount: true, chosenAgency: true, status: true, tracksDone: true } });

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE CIRCUIT DU MATÉRIEL PROMOTIONNEL PAR DEVIS RETRANSCRITS — par les VRAIS points d'entrée (§118.152).
 *
 * Le parcours entier d'un membre de la Direction Marketing : sa directrice valide la demande, il
 * demande les devis, l'assistante les retranscrit ligne à ligne, il retient des lignes de DEUX
 * devis, sa directrice valide le devis, le DG au-dessus du seuil, puis deux BC générés par la
 * plateforme (un par fournisseur), validés au centre Ad & Pro, signés par les Finances, une
 * facture par BC (fichier obligatoire), le paiement au centre de paiement, et la demande de visa
 * qui part avec chaque paiement. Les chantiers se CONSTATENT sur les pièces.
 *
 * Les acteurs n'ont pas de vue globale (§118.104) — sauf ceux dont c'est le rôle d'arbitrer. Le
 * N+1 d'un délégué, qui n'a PAS le module, ouvre la fiche qu'on lui demande de valider.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
suite("Matériel promotionnel — circuit 2 de bout en bout", () => {
  const u: Record<string, string> = {};
  let companyId = "", fourA = "", fourB = "", pmId = "", kamPmId = "", catPresentoir = "", catStand = "", catCarnet = "";
  const emp: Record<string, string> = {};
  let seuilDg = 0;

  beforeAll(async () => {
    const mk = async (k: string, role: SessionUser["role"]) => {
      u[k] = (await prisma.user.create({ data: { name: `${TAG} ${k}`, email: `${TAG}${k}@t.dz`, role, passwordHash: "x" } })).id;
    };
    await mk("ops", "DIRECTION");
    await mk("dir", "PRODUCT_MANAGER");
    await mk("cp", "MEDICAL_PROMOTION_MANAGER");
    await mk("asst", "DIRECTION_ASSISTANT");
    await mk("dg", "GENERAL_MANAGER");
    await mk("fin", "FINANCE_BUDGET_MANAGER");
    await mk("pharma", "MEDICAL_INFO_PHARMACIST");
    await mk("ns", "NATIONAL_SALES");
    await mk("ns2", "NATIONAL_SALES");
    await mk("kam", "MEDICAL_DELEGATE");
    await mk("dehors", "SALES_USER");
    const c = await prisma.company.create({ data: { name: `${TAG} Pharma`, shortName: TAG.slice(0, 12), color: "#1B7F79" } });
    companyId = c.id;
    // L'ORGANIGRAMME — la chaîne canonique : chef de produit → directrice marketing → Direction
    // des opérations ; délégué → superviseur national → Direction des opérations. Tous SALARIÉS de
    // la société : c'est ce qui leur en ouvre la LECTURE, et rien de plus — aucun n'a le droit
    // nominatif de l'ENGAGER (`UserCompanyAccess.canEdit`), comme dans la vraie vie.
    const e = async (k: string, managerKey: string | null) => {
      emp[k] = (await prisma.employee.create({
        data: { fullName: `${TAG} ${k}`, userId: u[k], managerId: managerKey ? emp[managerKey] : null, companyId },
      })).id;
    };
    await e("ops", null);
    await e("dir", "ops");
    await e("cp", "dir");
    await e("ns", "ops");
    await e("kam", "ns");
    await e("asst", null);
    await prisma.companyLegalIdentity.create({
      data: {
        companyId, legalName: `${TAG} Pharma SARL`, legalForm: "SARL", shareCapital: "10 000 000 DZD", rcNumber: "16/00-1234567B21", nif: "001916012345678",
        nis: "001916012345690", taxArticle: "16012345678", headOffice: "12 rue des Frères Bouadou, Alger", phone: "+213 21 00 00 00", email: "contact@t.dz",
        bankName: "BNA", bankAgency: "Hydra", rib: "001 00123 0123456789 45", managerName: "Direction", managerTitle: "Gérant",
      },
    });
    fourA = (await prisma.companyContact.create({ data: { name: `${TAG} Imprimerie Atlas`, address: "Zone industrielle", city: "Alger", rc: "16/00-111", nif: "0001", companyId: null } })).id;
    fourB = (await prisma.companyContact.create({ data: { name: `${TAG} Stands Sahel`, address: "Rue 5", city: "Oran", rc: "31/00-222", nif: "0002", companyId: null } })).id;
    seuilDg = (await getAppSettings()).adProDgThreshold ?? 0;
    // LE CATALOGUE (§118.165) — la demande s'y pioche : un présentoir (durable), un stand (durable,
    // reçu « en plus »), un carnet (consommable).
    const cat = async (suffixe: string, nom: string, famille: "CONSOMMABLE" | "DURABLE") =>
      (await prisma.promoCatalogueArticle.create({ data: { reference: `${TAG}-${suffixe}`, nom: `${TAG} ${nom}`, famille } })).id;
    catPresentoir = await cat("PLV", "Présentoir PLV", "DURABLE");
    catStand = await cat("STAND", "Stand modulaire", "DURABLE");
    catCarnet = await cat("CARNET", "Carnet bilan", "CONSOMMABLE");
  }, 60_000);

  afterAll(async () => {
    const pms = (await prisma.promoMaterial.findMany({ where: { title: { startsWith: TAG } }, select: { id: true, adminRequestId: true } }));
    const pmIds = pms.map((p) => p.id);
    const pieces = (await prisma.legalDocument.findMany({ where: { OR: [{ companyId }, { sourceType: "PROMO_MATERIAL", sourceId: { in: pmIds } }] }, select: { id: true } })).map((d) => d.id);
    const decls = (await prisma.medicalInfoDeclaration.findMany({ where: { sourceType: "LEGAL_DOCUMENT", sourceId: { in: pieces } }, select: { id: true } })).map((d) => d.id);
    await prisma.medicalInfoDeclaration.deleteMany({ where: { id: { in: decls } } }).catch(() => {});
    const ordres = (await prisma.expenseOrder.findMany({ where: { sourceType: "LEGAL_DOCUMENT", sourceId: { in: pieces } }, select: { id: true } })).map((o) => o.id);
    const dossiers = (await prisma.paymentRequest.findMany({ where: { expenseOrderId: { in: ordres } }, select: { id: true } })).map((d) => d.id);
    await prisma.paymentRequestEvent.deleteMany({ where: { requestId: { in: dossiers } } }).catch(() => {});
    await prisma.paymentRequest.deleteMany({ where: { id: { in: dossiers } } }).catch(() => {});
    await prisma.paymentCentreMessage.deleteMany({ where: { orderId: { in: ordres } } }).catch(() => {});
    await prisma.legalDocument.updateMany({ where: { id: { in: pieces } }, data: { expenseOrderId: null } }).catch(() => {});
    await prisma.expenseOrder.deleteMany({ where: { id: { in: ordres } } }).catch(() => {});
    const vIds = (await prisma.validationRequest.findMany({ where: { entityType: "LEGAL_DOCUMENT", entityId: { in: pieces } }, select: { id: true } })).map((v) => v.id);
    await prisma.validationStep.deleteMany({ where: { requestId: { in: vIds } } }).catch(() => {});
    await prisma.validationRequest.deleteMany({ where: { id: { in: vIds } } }).catch(() => {});
    await prisma.adProGateVisa.deleteMany({ where: { entityType: "LEGAL_DOCUMENT", entityId: { in: pieces } } }).catch(() => {});
    await prisma.document.deleteMany({ where: { OR: [{ entityType: "LEGAL_DOCUMENT", entityId: { in: pieces } }, { entityType: "PROMO_MATERIAL", entityId: { in: pmIds } }] } }).catch(() => {});
    await prisma.promoQuote.updateMany({ where: { promoMaterialId: { in: pmIds } }, data: { purchaseOrderId: null } }).catch(() => {});
    await prisma.legalDocument.updateMany({ where: { id: { in: pieces } }, data: { chainFromId: null } }).catch(() => {});
    await prisma.legalDocument.deleteMany({ where: { id: { in: pieces } } }).catch(() => {});
    await prisma.comment.deleteMany({ where: { entityType: "PROMO_MATERIAL", entityId: { in: pmIds } } }).catch(() => {});
    await prisma.promoMaterial.deleteMany({ where: { id: { in: pmIds } } }).catch(() => {});
    // Le stock reçu (§118.165), puis le catalogue — un article demandé retient son article du catalogue.
    await prisma.promoStockMovement.deleteMany({ where: { item: { companyId } } }).catch(() => {});
    await prisma.promoStockLot.deleteMany({ where: { item: { companyId } } }).catch(() => {});
    await prisma.promoStockItem.deleteMany({ where: { companyId } }).catch(() => {});
    await prisma.promoCatalogueArticle.deleteMany({ where: { reference: { startsWith: TAG } } }).catch(() => {});
    await prisma.administrativeRequest.deleteMany({ where: { linkedEntityType: "PROMO_MATERIAL", linkedEntityId: { in: pmIds } } }).catch(() => {});
    const ids = Object.values(u);
    await prisma.fileVersion.deleteMany({ where: { node: { ownerId: { in: ids } } } }).catch(() => {});
    await prisma.driveNode.deleteMany({ where: { ownerId: { in: ids }, type: "FILE" } }).catch(() => {});
    await prisma.driveNode.deleteMany({ where: { ownerId: { in: ids } } }).catch(() => {});
    await prisma.documentSequence.deleteMany({ where: { companyId } }).catch(() => {});
    await prisma.companyContact.deleteMany({ where: { name: { startsWith: TAG } } }).catch(() => {});
    await prisma.employee.updateMany({ where: { fullName: { startsWith: TAG } }, data: { managerId: null } }).catch(() => {});
    await prisma.employee.deleteMany({ where: { fullName: { startsWith: TAG } } }).catch(() => {});
    await prisma.notification.deleteMany({ where: { userId: { in: ids } } }).catch(() => {});
    await prisma.auditLog.deleteMany({ where: { actorId: { in: ids } } }).catch(() => {});
    await prisma.userAccess.deleteMany({ where: { userId: { in: ids } } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: { in: ids } } }).catch(() => {});
    await prisma.company.delete({ where: { id: companyId } }).catch(() => {});
  }, 60_000);

  it("PRÉMISSES : le N+1 d'un délégué n'a le module qu'en « ses lignes » ; le chef de produit n'a pas Legal ; les Finances n'ont pas Legal", async () => {
    // §118.153 : le National Sales DEMANDE lui aussi du matériel promotionnel — il a le module,
    // mais en portée « ses lignes ». Le dossier de SON KAM n'y est pas : c'est la porte de la fiche
    // (le N+1 nommé) qui le lui ouvre, et c'est elle que ce banc mesure.
    const ns = await actorFor(u.ns);
    expect(userCan(ns, "PROMO_MATERIAL", "VIEW")).toBe(true);
    expect(ns.access.modules.get("PROMO_MATERIAL")?.scope, "sans cela, la porte de la fiche ne se mesurerait pas").toBe("ASSIGNED");
    expect(userCan(await actorFor(u.cp), "LEGAL", "VIEW")).toBe(false);
    expect(userCan(await actorFor(u.cp), "PROMO_MATERIAL", "CREATE")).toBe(true);
    expect(userCan(await actorFor(u.fin), "LEGAL", "VIEW")).toBe(false);
    expect(userCan(await actorFor(u.fin), "FINANCES", "VIEW")).toBe(true);
    // Ni le demandeur ni l'assistante ne peuvent ENGAGER la société — ils la VOIENT, en salariés.
    // Sans cette prémisse, la génération des BC passerait par le droit nominatif et le banc ne
    // mesurerait pas la délégation qu'il existe pour mesurer.
    for (const k of ["cp", "asst"]) {
      expect(await canEditCompanyId(u[k], companyId), `${k} ne doit pas pouvoir engager la société`).toBe(false);
      expect((await getMyCompanies(u[k])).map((c) => c.id)).toContain(companyId);
    }
    expect((await getMyCompanies(u.dehors)).map((c) => c.id)).not.toContain(companyId);
  });

  it("LA RÈGLE, lue sur l'organigramme : directrice pour le marketing, N+1 pour le délégué, personne pour la directrice ni pour la Direction des opérations", async () => {
    const cp = await validateursDeLaDemande(u.cp);
    expect(cp.validateur).toMatchObject({ kind: "PERSONNE", userId: u.dir, qualite: "DIRECTRICE_MARKETING" });
    expect(cp.directriceId).toBe(u.dir);
    const kam = await validateursDeLaDemande(u.kam);
    expect(kam.validateur).toMatchObject({ kind: "PERSONNE", userId: u.ns, qualite: "N_PLUS_1" });
    const dir = await validateursDeLaDemande(u.dir);
    expect(dir.validateur.kind).toBe("AUCUNE");
    expect(dir.demandeurEstCheffe).toBe(true);
    expect((await validateursDeLaDemande(u.ops)).validateur.kind).toBe("AUCUNE");
  });

  it("L'ASSISTANTE QUI RETRANSCRIT : une assistante de direction active — ni un collègue quelconque, ni le demandeur", async () => {
    // Le menu proposait TOUT compte actif : le demandeur pouvait nommer un collègue pour recopier
    // les prix qu'il retiendra ensuite. L'action est la garde, pas le menu — une requête forgée
    // ignore un menu.
    ACTOR = await actorFor(u.cp);
    const collegue = await createPromoMaterial(undefined, form({ title: `${TAG} Refus collègue`, assistantId: u.dehors, companyId }));
    expect(collegue.ok).toBe(false);
    expect(collegue.error).toMatch(/n'est pas une assistante de direction active/);
    const soiMeme = await createPromoMaterial(undefined, form({ title: `${TAG} Refus soi-même`, assistantId: u.cp, companyId }));
    expect(soiMeme.ok).toBe(false);
    expect(soiMeme.error).toMatch(/votre propre demande/);
    expect(await prisma.promoMaterial.count({ where: { title: { in: [`${TAG} Refus collègue`, `${TAG} Refus soi-même`] } } })).toBe(0);

    // LE RÔLE SECONDAIRE COMPTE — c'est la lecture canonique (`hasRole`, `anyRoleFilter`) : une
    // assistante qui porte le rôle en second n'en est pas moins l'assistante.
    u.asst2 = (await prisma.user.create({
      data: { name: `${TAG} asst2`, email: `${TAG}asst2@t.dz`, role: "MEDICAL_PROMOTION_MANAGER", secondaryRole: "DIRECTION_ASSISTANT", passwordHash: "x" },
    })).id;
    const secondaire = await createPromoMaterial(undefined, form({ title: `${TAG} Secondaire`, assistantId: u.asst2, companyId }));
    expect(secondaire.ok, secondaire.ok ? "" : secondaire.error).toBe(true);

    // LE CAS QUI DISCRIMINE la garde « jamais soi-même » : une demandeuse qui EST assistante (rôle
    // secondaire) et se nomme. Sans cette garde, le contrôle de rôle la laisserait passer — elle
    // retranscrirait les prix qu'elle retiendra ensuite.
    ACTOR = await actorFor(u.asst2);
    const elleMeme = await createPromoMaterial(undefined, form({ title: `${TAG} Refus elle-même`, assistantId: u.asst2, companyId }));
    expect(elleMeme.ok).toBe(false);
    expect(elleMeme.error).toMatch(/votre propre demande/);
    expect(await prisma.promoMaterial.count({ where: { title: `${TAG} Refus elle-même` } })).toBe(0);
    ACTOR = await actorFor(u.cp);

    // L'ÉCRAN ne propose que les assistantes, par la même lecture — et rien quand la nature
    // n'est pas demandée.
    const ids = (await getAdProCreateData(u.cp, ["PROMO_MATERIAL"])).assistants.map((a) => a.id);
    expect(ids).toEqual(expect.arrayContaining([u.asst, u.asst2]));
    expect(ids).not.toContain(u.dehors);
    expect(ids).not.toContain(u.cp);
    expect((await getAdProCreateData(u.cp, ["EVENT"])).assistants).toEqual([]);

    // Ce décor ne doit rien laisser aux cas suivants : le dossier et l'assistante secondaire partent.
    await prisma.notification.deleteMany({ where: { link: `/promo-material/${secondaire.id}` } });
    await prisma.auditLog.deleteMany({ where: { entityId: secondaire.id! } }).catch(() => {});
    await prisma.promoMaterial.delete({ where: { id: secondaire.id! } });
    await prisma.user.delete({ where: { id: u.asst2 } });
    delete u.asst2;
    // PLAFOND LOCAL (§118.124b) : 704 ms seul, au-delà des 20 000 ms globales dans la suite complète
    // (832 fichiers, quatre cœurs, la même base) — ce cas écrit et relit une dizaine de comptes et un
    // dossier entier. Le plafond répond à « est-il bloqué ? », jamais à « est-il lent ? » ; le global
    // ne bouge pas.
  }, 60_000);

  it("CRÉATION : circuit 2, validateur FIGÉ, et c'est lui — pas tout le monde — qui est prévenu", async () => {
    ACTOR = await actorFor(u.cp);
    const r = await createPromoMaterial(undefined, form({ title: `${TAG} Présentoirs Nivolex`, assistantId: u.asst, companyId, amount: "900000" }));
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    pmId = r.id!;
    const pm = await prisma.promoMaterial.findUniqueOrThrow({ where: { id: pmId } });
    expect(pm).toMatchObject({ circuitVersion: 2, circuitState: "REVIEW_REQUEST", requestValidatorId: u.dir, requestValidation: true, marketingValidatorId: u.dir });
    // Aucune demande au secrétariat à la création : on ne fait pas travailler les agences sur une demande non validée.
    expect(pm.adminRequestId).toBeNull();
    expect(await prisma.notification.count({ where: { userId: u.dir, link: `/promo-material/${pmId}` } })).toBe(1);
  });

  it("VALIDER LA DEMANDE : ni le demandeur, ni un tiers — la directrice figée", async () => {
    ACTOR = await actorFor(u.cp);
    expect((await validatePromoStep(form({ id: pmId }))).ok).toBe(false);
    ACTOR = await actorFor(u.dehors);
    expect((await validatePromoStep(form({ id: pmId }))).ok).toBe(false);
    ACTOR = await actorFor(u.dir);
    const r = await validatePromoStep(form({ id: pmId }));
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    expect((await etatDe(pmId)).circuitState).toBe("QUOTE_TO_REQUEST");
  });

  it("DEMANDER LES DEVIS : le demandeur, une fois les articles posés ; la demande au secrétariat porte le lien canonique", async () => {
    ACTOR = await actorFor(u.asst);
    expect((await demanderDevisPromo(form({ promoMaterialId: pmId }))).ok, "l'assistante ne demande pas à la place du demandeur").toBe(false);
    ACTOR = await actorFor(u.cp);
    // §118.165 : sans article demandé, l'assistante ne saurait pas quels devis chercher.
    const sansArticle = await demanderDevisPromo(form({ promoMaterialId: pmId }));
    expect(sansArticle.ok).toBe(false);
    expect(sansArticle.ok ? "" : sansArticle.error).toMatch(/articles à faire chiffrer/);
    const art = await enregistrerArticleDemandePromo(form({ promoMaterialId: pmId, catalogueId: catPresentoir, quantite: "100", actions: ["FABRICATION"], commentaire: "Sol, 160 cm" }));
    expect(art.ok, art.ok ? "" : art.error).toBe(true);
    const r = await demanderDevisPromo(form({ promoMaterialId: pmId, note: "Trois agences au moins" }));
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    const pm = await prisma.promoMaterial.findUniqueOrThrow({ where: { id: pmId }, select: { circuitState: true, adminRequestId: true } });
    expect(pm.circuitState).toBe("QUOTE_REQUESTED");
    const dem = await prisma.administrativeRequest.findUniqueOrThrow({ where: { id: pm.adminRequestId! } });
    expect(dem).toMatchObject({ type: "QUOTE", linkedEntityType: "PROMO_MATERIAL", linkedEntityId: pmId, assignedToId: u.asst });
    // La demande au secrétariat DIT les articles : l'assistante sait quoi chercher sans ouvrir la fiche.
    expect(dem.description).toMatch(/Présentoir PLV.*100.*fabrication.*Sol, 160 cm/s);
    // Un double clic ne fait pas une seconde demande.
    expect((await demanderDevisPromo(form({ promoMaterialId: pmId }))).ok).toBe(false);
    expect(await prisma.administrativeRequest.count({ where: { linkedEntityType: "PROMO_MATERIAL", linkedEntityId: pmId } })).toBe(1);
  });

  it("RETRANSCRIRE : l'assistante, pas le demandeur ; un écart avec le total imprimé bloque la fin, et se DIT", async () => {
    ACTOR = await actorFor(u.cp);
    const refus = await enregistrerDevisPromo(form({ promoMaterialId: pmId, supplierId: fourA, ligneReference: "X", ligneQuantite: "1", lignePrix: "1", ligneAction: "IMPRESSION" }));
    expect(refus.ok, "celui qui recopie les prix n'est pas celui qui les retient").toBe(false);

    ACTOR = await actorFor(u.asst);
    const article = (await prisma.promoRequestItem.findFirstOrThrow({ where: { promoMaterialId: pmId } })).id;
    // §118.165 : une ligne sans ACTION est refusée — c'est elle qui dira à la réception si ce qui arrive entre au stock.
    const sansAction = form({ promoMaterialId: pmId, supplierId: fourA, ligneReference: ["Présentoir"], ligneQuantite: ["1"], lignePrix: ["1"] });
    sansAction.set("scan", pdf("x.pdf"));
    const refusAction = await enregistrerDevisPromo(sansAction);
    expect(refusAction.ok).toBe(false);
    expect(refusAction.ok ? "" : refusAction.error).toMatch(/action/);
    const fd = form({
      promoMaterialId: pmId, supplierId: fourA, reference: "A-26/057", quoteDate: "2026-09-20", tvaRate: "19", announcedTotal: "999999",
      ligneReference: ["Présentoir PLV sol", "Kakemono 80×200"], ligneUnite: ["pièce", "pièce"], ligneQuantite: ["100", "40"], lignePrix: ["10000", "5000"],
      ligneAction: ["FABRICATION", "IMPRESSION"], ligneArticle: [article, ""],
    });
    fd.set("scan", pdf("devis-atlas.pdf"));
    const a = await enregistrerDevisPromo(fd);
    expect(a.ok, a.ok ? "" : a.error).toBe(true);
    const fdB = form({
      promoMaterialId: pmId, supplierId: fourB, reference: "S-114", tvaRate: "19", extraTaxLabel: "Taxe Pub", extraTaxRate: "2",
      ligneReference: ["Stand modulaire 3×3"], ligneQuantite: ["1"], lignePrix: ["300000"], ligneAction: ["FABRICATION"],
    });
    fdB.set("scan", pdf("devis-sahel.pdf"));
    const b = await enregistrerDevisPromo(fdB);
    expect(b.ok, b.ok ? "" : b.error).toBe(true);

    const trop = await terminerRetranscriptionPromo(form({ promoMaterialId: pmId }));
    expect(trop.ok).toBe(false);
    expect(trop.ok ? "" : trop.error).toMatch(/Atlas.*annonce/);

    // La correction : le total imprimé était 1 200 000 HT (100 × 10 000 + 40 × 5 000).
    const fix = form({
      promoMaterialId: pmId, quoteId: a.id!, supplierId: fourA, reference: "A-26/057", tvaRate: "19", announcedTotal: "1200000",
      ligneReference: ["Présentoir PLV sol", "Kakemono 80×200"], ligneUnite: ["pièce", "pièce"], ligneQuantite: ["100", "40"], lignePrix: ["10000", "5000"],
      ligneAction: ["FABRICATION", "IMPRESSION"], ligneArticle: [article, ""],
    });
    expect((await enregistrerDevisPromo(fix)).ok).toBe(true);
    const fin = await terminerRetranscriptionPromo(form({ promoMaterialId: pmId }));
    expect(fin.ok, fin.ok ? "" : fin.error).toBe(true);
    expect((await etatDe(pmId)).circuitState).toBe("REVIEW_REQUESTER");
    const pm = await prisma.promoMaterial.findUniqueOrThrow({ where: { id: pmId }, select: { adminRequestId: true } });
    expect((await prisma.administrativeRequest.findUniqueOrThrow({ where: { id: pm.adminRequestId! } })).status).toBe("DONE");
  });

  it("CHOISIR : « valider les lignes de plusieurs devis » — le montant retenu est FIGÉ au TTC, chaque devis avec SA taxe", async () => {
    const lignes = await prisma.promoQuoteLine.findMany({ where: { quote: { promoMaterialId: pmId } }, select: { id: true, reference: true } });
    const presentoir = lignes.find((l) => l.reference === "Présentoir PLV sol")!.id;
    const stand = lignes.find((l) => l.reference === "Stand modulaire 3×3")!.id;

    ACTOR = await actorFor(u.asst);
    expect((await choisirLignesPromo(form({ promoMaterialId: pmId, lineIds: [presentoir] }))).ok, "le choix revient au demandeur").toBe(false);

    ACTOR = await actorFor(u.cp);
    const vide = await choisirLignesPromo(form({ promoMaterialId: pmId, valider: "1" }));
    expect(vide.ok).toBe(false);
    // PAR ADAM, par son VRAI point d'entrée : « je retiens le présentoir et le stand, valide ».
    // La carte montre ce que le clic fixera AVANT le clic ; l'exécution passe par la même action.
    const reference = (await prisma.promoMaterial.findUniqueOrThrow({ where: { id: pmId }, select: { reference: true } })).reference;
    const cp = await actorFor(u.cp);
    const carte = await DOMAIN_TOOLS.promo_operation.ops.choose_promo_lines.impl.propose({ reference, lines: "Présentoir; Sahel : Stand modulaire", mode: "valider" }, cp);
    if ("error" in carte) throw new Error(carte.error);
    expect(carte.fields.find((f) => f.label === "Total retenu")?.value).toMatch(/1\s553\s000/);
    expect(carte.args.lineIds?.split(",").sort()).toEqual([presentoir, stand].sort());
    const r = await DOMAIN_TOOLS.promo_operation.ops.choose_promo_lines.impl.execute(carte.args, cp);
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    const pm = await etatDe(pmId);
    // Atlas : 1 000 000 HT + 19 % = 1 190 000 ; Sahel : 300 000 + 57 000 TVA + 6 000 Taxe Pub = 363 000.
    expect(Number(pm.chosenAmount)).toBe(1_553_000);
    expect(pm.chosenAgency).toContain("Atlas");
    expect(pm.chosenAgency).toContain("Sahel");
    expect(pm.circuitState).toBe("REVIEW_MANAGER");
  });

  it("DIRECTION MARKETING : la directrice du demandeur valide ; le DG ensuite, au-dessus du seuil", async () => {
    ACTOR = await actorFor(u.ns2);
    expect((await validatePromoStep(form({ id: pmId }))).ok).toBe(false);
    ACTOR = await actorFor(u.dir);
    const r = await validatePromoStep(form({ id: pmId }));
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    const dgAttendu = seuilDg > 0 && 1_553_000 > seuilDg;
    expect((await etatDe(pmId)).circuitState).toBe(dgAttendu ? "REVIEW_DG" : "IN_EXECUTION");
    if (dgAttendu) {
      ACTOR = await actorFor(u.dir);
      expect((await validatePromoStep(form({ id: pmId }))).ok, "la directrice ne tranche pas l'étape du DG").toBe(false);
      ACTOR = await actorFor(u.dg);
      const g = await validatePromoStep(form({ id: pmId }));
      expect(g.ok, g.ok ? "" : g.error).toBe(true);
    }
    expect((await etatDe(pmId)).circuitState).toBe("IN_EXECUTION");
  });

  it("L'ANCIEN PARCOURS NE PILOTE PAS CE DOSSIER, et on ne l'annule pas avec des BC engagés", async () => {
    ACTOR = await actorFor(u.asst);
    const r = await submitQuotes(form({ id: pmId }));
    expect(r.ok).toBe(false);
    expect(r.ok ? "" : r.error).toMatch(/Suivi du circuit/);
  });

  it("LA DÉLÉGATION vaut pour la société NOMMÉE, et seulement pour qui la VOIT — aucun numéro consommé sur un refus", async () => {
    const avant = await prisma.legalDocument.count({ where: { companyId } });
    const bc = { type: "BON_DE_COMMANDE" as const, tiers: { nom: "Tiers du banc", adresse: "Alger", nif: "0003" }, lignes: [{ designation: "Présentoir", quantite: 1, prixUnitaire: 1000 }] };
    const delegation = { source: { type: "PROMO_MATERIAL" as const, id: pmId }, delegation: "banc — délégation" };
    // Sans société nommée : pas de repli sur celle de la personne qui clique.
    const sansSociete = await emettreDocumentDrive(await actorFor(u.asst), { ...bc, societe: null }, delegation);
    expect(sansSociete.ok).toBe(false);
    if (!sansSociete.ok) expect(sansSociete.motif).toMatch(/ne nomme aucune société/);
    // Quelqu'un que le groupe tient HORS de la société : la délégation ne lui ouvre pas l'entité.
    const horsSociete = await emettreDocumentDrive(await actorFor(u.dehors), { ...bc, societe: companyId }, delegation);
    expect(horsSociete.ok).toBe(false);
    // Et SANS délégation, l'assistante — qui voit la société sans pouvoir l'engager ni écrire dans
    // Legal — reste refusée : la délégation est le seul chemin, pas un assouplissement général.
    const sansDelegation = await emettreDocumentDrive(await actorFor(u.asst), { ...bc, societe: companyId });
    expect(sansDelegation.ok).toBe(false);
    expect(await prisma.legalDocument.count({ where: { companyId } })).toBe(avant);
  });

  it("GÉNÉRER LES BC : un par fournisseur retenu, composés par la plateforme, tagués au dossier — et idempotents", async () => {
    ACTOR = await actorFor(u.dehors);
    expect((await genererBonsDeCommandePromo(form({ promoMaterialId: pmId }))).ok).toBe(false);
    ACTOR = await actorFor(u.asst);
    const r = await genererBonsDeCommandePromo(form({ promoMaterialId: pmId, livraisonAdresse: "Siège, Alger" }));
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    const bcs = await prisma.legalDocument.findMany({ where: { sourceType: "PROMO_MATERIAL", sourceId: pmId, kind: "PURCHASE_ORDER" } });
    expect(bcs).toHaveLength(2);
    expect(bcs.map((b) => Number(b.amount)).sort((x, y) => x - y)).toEqual([363_000, 1_190_000]);
    // Encore : rien de nouveau.
    const encore = await genererBonsDeCommandePromo(form({ promoMaterialId: pmId }));
    expect(encore.ok).toBe(true);
    expect(await prisma.legalDocument.count({ where: { sourceType: "PROMO_MATERIAL", sourceId: pmId, kind: "PURCHASE_ORDER" } })).toBe(2);

    ACTOR = await actorFor(u.cp);
    const annul = await cancelPromoMaterial(form({ id: pmId }));
    expect(annul.ok, "un dossier avec des BC générés ne s'annule pas en laissant les commandes vivantes").toBe(false);
  }, 120_000);

  it("LE FICHIER DU BC s'ouvre sous la porte de la PIÈCE : le demandeur et les Finances le lisent, pas un tiers", async () => {
    const bc = await prisma.legalDocument.findFirstOrThrow({ where: { sourceType: "PROMO_MATERIAL", sourceId: pmId, kind: "PURCHASE_ORDER" }, select: { id: true, custom: true } });
    const f = fichiersEmis(bc.custom);
    expect(f.docx).toBeTruthy();
    // PRÉMISSE : l'assistante a émis, le fichier vit dans SON Drive — le demandeur ne l'y lit pas.
    const cp = await actorFor(u.cp);
    expect(canViewDrive(await resolveDriveAccess(cp, f.docx!)), "sans cela, la route de la pièce ne répare rien").toBe(false);
    expect(await fichierEmisDeLaPiece(cp, bc.id, "docx")).toEqual({ nodeId: f.docx });
    expect(await fichierEmisDeLaPiece(await actorFor(u.fin), bc.id, "docx")).toEqual({ nodeId: f.docx });
    expect(await fichierEmisDeLaPiece(await actorFor(u.dehors), bc.id, "docx")).toBeNull();
  });

  it("CENTRE puis SIGNATURE : pas d'envoi ni de facture avant la signature des Finances", async () => {
    const execution = await executionDuDossier(pmId);
    const [q1] = execution.filter((e) => e.bc);

    // MODIFIER LE DÉLAI SEUL, PAR ADAM : l'adresse posée à la génération RESTE (§118.152). Le
    // formulaire n'est pas pré-rempli et Adam ne nomme que ce qui change — écrire `null` pour
    // chaque champ absent effaçait l'adresse de livraison, sans un mot.
    const reference = (await prisma.promoMaterial.findUniqueOrThrow({ where: { id: pmId }, select: { reference: true } })).reference;
    const cp = await actorFor(u.cp);
    ACTOR = cp;
    const carte = await DOMAIN_TOOLS.promo_operation.ops.update_promo_bc.impl.propose({ reference, supplier: q1.fournisseur, delay: "15 jours" }, cp);
    if ("error" in carte) throw new Error(carte.error);
    const modif = await DOMAIN_TOOLS.promo_operation.ops.update_promo_bc.impl.execute(carte.args, cp);
    expect(modif.ok, modif.ok ? "" : modif.error).toBe(true);
    const spec = ((await prisma.legalDocument.findUniqueOrThrow({ where: { id: q1.bc!.id }, select: { custom: true } })).custom as { fabrique: { spec: { livraison?: unknown } } }).fabrique.spec;
    expect(spec.livraison).toEqual({ adresse: "Siège, Alger", delai: "15 jours" });
    // La délégation ouvre LA pièce, jamais le Drive de l'émettrice : nommer la pièce q1 pour écrire
    // le fichier d'une AUTRE pièce est refusé par le port, qui vérifie que le fichier est le sien.
    const autreBc = execution.filter((e) => e.bc && e.bc.id !== q1.bc!.id)[0];
    const autreFichier = fichiersEmis((await prisma.legalDocument.findUniqueOrThrow({ where: { id: autreBc.bc!.id }, select: { custom: true } })).custom).docx!;
    await expect(portsArtefact.documents.ecrireVersion(u.cp, autreFichier, Buffer.from("x"), { mime: "application/octet-stream", resume: "banc", piece: q1.bc!.id }))
      .rejects.toThrow(/pas le droit de modifier/);

    ACTOR = await actorFor(u.cp);
    expect((await marquerBonDeCommandeEnvoye(form({ promoMaterialId: pmId, quoteId: q1.quoteId }))).ok).toBe(false);
    const avant = form({ promoMaterialId: pmId, quoteId: q1.quoteId, reference: "F-1", amount: "1000" });
    avant.set("file", pdf("f1.pdf"));
    expect((await deposerFacturePromo(avant)).ok).toBe(false);

    for (const e of execution.filter((x) => x.bc)) {
      const etat = await etatDuBC(e.bc!.id);
      if (etat?.etape === "A_VALIDER") {
        ACTOR = await actorFor(u.dg);
        const v = await deciderVisaCentreAdPro(form({ entityType: "LEGAL_DOCUMENT", entityId: e.bc!.id, approve: "1" }));
        expect(v.ok, v.ok ? "" : v.error).toBe(true);
      }
      ACTOR = await actorFor(u.fin);
      const s = await signerBonDeCommande(form({ id: e.bc!.id }));
      expect(s.ok, s.ok ? "" : s.error).toBe(true);
      expect((await etatDuBC(e.bc!.id))?.etape).toBe("SIGNE");
    }
    ACTOR = await actorFor(u.cp);
    expect((await marquerBonDeCommandeEnvoye(form({ promoMaterialId: pmId, quoteId: q1.quoteId }))).ok).toBe(true);
    ACTOR = await actorFor(u.cp);
    const chantier = await completePromoTrack(form({ id: pmId, track: "PURCHASE_ORDER" }));
    expect(chantier.ok, chantier.ok ? "" : chantier.error).toBe(true);
  }, 120_000);

  it("FACTURES : une par BC, fichier obligatoire, jamais au-delà du montant du BC", async () => {
    const execution = await executionDuDossier(pmId);
    ACTOR = await actorFor(u.cp);
    for (const e of execution.filter((x) => x.bc)) {
      const sansFichier = await deposerFacturePromo(form({ promoMaterialId: pmId, quoteId: e.quoteId, reference: `F-${e.fournisseur.slice(-5)}`, amount: String(e.bc!.montant) }));
      expect(sansFichier.ok).toBe(false);
      expect(sansFichier.ok ? "" : sansFichier.error).toMatch(/fichier/);
      const trop = form({ promoMaterialId: pmId, quoteId: e.quoteId, reference: "F-TROP", amount: String((e.bc!.montant ?? 0) + 5000) });
      trop.set("file", pdf("trop.pdf"));
      expect((await deposerFacturePromo(trop)).ok, "on ne paie pas plus que la commande validée").toBe(false);
      const ok = form({ promoMaterialId: pmId, quoteId: e.quoteId, reference: `F-${e.quoteId.slice(-4)}`, amount: String(e.bc!.montant), invoiceDate: "2026-09-25" });
      ok.set("file", pdf("facture.pdf"));
      const r = await deposerFacturePromo(ok);
      expect(r.ok, r.ok ? "" : r.error).toBe(true);
    }
    // Les Finances lisent la facture (et son fichier) : la même porte que la fiche Legal.
    const facture = await prisma.legalDocument.findFirstOrThrow({ where: { kind: "INVOICE", sourceType: "PROMO_MATERIAL", sourceId: pmId } });
    expect(await canAccessEntity(await actorFor(u.fin), "LEGAL_DOCUMENT", facture.id, "VIEW")).toBe(true);
    expect(await canAccessEntity(await actorFor(u.cp), "LEGAL_DOCUMENT", facture.id, "VIEW")).toBe(true);
    expect(await canAccessEntity(await actorFor(u.dehors), "LEGAL_DOCUMENT", facture.id, "VIEW")).toBe(false);
  }, 120_000);

  it("PAIEMENT : au centre de paiement, et la demande de visa part AVEC — une fois, sans montant", async () => {
    const factures = await prisma.legalDocument.findMany({ where: { kind: "INVOICE", sourceType: "PROMO_MATERIAL", sourceId: pmId } });
    expect(factures).toHaveLength(2);
    ACTOR = await actorFor(u.cp);
    expect((await demanderPaiementFacturePromo(form({ promoMaterialId: pmId, invoiceId: factures[0].id }))).ok, "la formalité est obligatoire").toBe(false);
    // §118.165 : le paiement attend la RÉCEPTION — puis le demandeur coche ce qui est arrivé. Le
    // présentoir entre dans l'article demandé ; le stand, « en plus », choisit son article ici.
    const attente = await demanderPaiementFacturePromo(form({ promoMaterialId: pmId, invoiceId: factures[0].id, formalite: "AD_VISA" }));
    expect(attente.ok).toBe(false);
    expect(attente.ok ? "" : attente.error).toMatch(/pas reçue.*ne pourra pas être fait ultérieurement/s);
    const lignes = await prisma.promoFactureLigne.findMany({ where: { facture: { legalDocument: { sourceId: pmId } } }, select: { id: true, designation: true } });
    expect(lignes).toHaveLength(2);
    for (const l of lignes) {
      const enPlus = l.designation.startsWith("Stand");
      const r = await receptionnerLigneFacturePromo(form({ promoMaterialId: pmId, ligneId: l.id, ...(enPlus ? { catalogueId: catStand } : {}) }));
      expect(r.ok, r.ok ? "" : r.error).toBe(true);
    }
    const stock = await prisma.promoStockItem.findMany({ where: { companyId }, select: { catalogueId: true, lots: { select: { origine: true, coutUnitaire: true } } } });
    expect(stock.map((s) => s.catalogueId).sort()).toEqual([catPresentoir, catStand].sort());
    expect(stock.flatMap((s) => s.lots).every((l) => l.origine === "ACHAT")).toBe(true);
    for (const f of factures) {
      const r = await demanderPaiementFacturePromo(form({ promoMaterialId: pmId, invoiceId: f.id, formalite: "AD_VISA" }));
      expect(r.ok, r.ok ? "" : r.error).toBe(true);
      expect(r.message ?? "").toMatch(/centre de paiement/);
    }
    const encore = await demanderPaiementFacturePromo(form({ promoMaterialId: pmId, invoiceId: factures[0].id, formalite: "AD_VISA" }));
    expect(encore.ok, "un second clic ne demande pas le même paiement deux fois").toBe(false);
    const ordres = await prisma.expenseOrder.findMany({ where: { sourceType: "LEGAL_DOCUMENT", sourceId: { in: factures.map((f) => f.id) } } });
    expect(ordres).toHaveLength(2);
    expect(ordres.every((o) => o.centralStatus === "AWAITING")).toBe(true);
    const decls = await prisma.medicalInfoDeclaration.findMany({ where: { sourceType: "LEGAL_DOCUMENT", sourceId: { in: factures.map((f) => f.id) } } });
    expect(decls).toHaveLength(2);
    expect(decls.every((d) => d.declarationKind === "AD_VISA" && d.amount === null)).toBe(true);

    // Le pharmacien OUVRE le dossier dont il instruit le visa — sans le module.
    const pharma = await actorFor(u.pharma);
    expect(await peutOuvrirLeDossierPromo(pharma, { id: pmId, requesterId: u.cp, assistantId: u.asst })).toBe(true);
    // … et les Finances, qui LISENT l'information médicale pour les bons de versement, n'y entrent pas par là.
    expect(await peutOuvrirLeDossierPromo(await actorFor(u.dehors), { id: pmId, requesterId: u.cp, assistantId: u.asst })).toBe(false);

    // Le chantier « paiements » ne se clôt pas sur un paiement DEMANDÉ : il faut un paiement RÉGLÉ.
    ACTOR = await actorFor(u.cp);
    const tot = await completePromoTrack(form({ id: pmId, track: "PAYMENT" }));
    expect(tot.ok).toBe(false);
    expect(tot.ok ? "" : tot.error).toMatch(/pas encore réglé/);
    // Le visa, lui, est constaté : une demande par paiement.
    const visa = await completePromoTrack(form({ id: pmId, track: "AD_VISA" }));
    expect(visa.ok, visa.ok ? "" : visa.error).toBe(true);

    // Le centre autorise, les Finances règlent : le chantier se clôt, et le dossier avec.
    for (const o of ordres) {
      ACTOR = await actorFor(u.ops);
      const d = await decidePayment(form({ id: o.id, decision: "APPROVE" }));
      expect(d.ok, d.ok ? "" : d.error).toBe(true);
      await prisma.expenseOrder.update({ where: { id: o.id }, data: { status: "PAID", paidDate: new Date() } });
    }
    ACTOR = await actorFor(u.cp);
    const paye = await completePromoTrack(form({ id: pmId, track: "PAYMENT" }));
    expect(paye.ok, paye.ok ? "" : paye.error).toBe(true);
    expect((await etatDe(pmId)).circuitState).toBe("COMPLETED");
  }, 120_000);

  it("LE N+1 D'UN DÉLÉGUÉ : il ouvre la fiche et ses pièces hors de sa portée de module, et c'est lui seul qui tranche", async () => {
    const figes = await validateursDeLaDemande(u.kam);
    const pm = await prisma.promoMaterial.create({
      data: {
        reference: `${TAG}-KAM`, title: `${TAG} Carnets bilan`, status: "PROSPECTION_REQUESTED",
        circuitState: "REVIEW_REQUEST", circuitVersion: 2, requesterId: u.kam, createdById: u.kam, updatedById: u.kam,
        requestValidation: true, requestValidatorId: figes.validateur.kind === "PERSONNE" ? figes.validateur.userId : null,
        marketingValidatorId: figes.directriceId,
      },
    });
    kamPmId = pm.id;
    const ns = await actorFor(u.ns);
    expect(await peutOuvrirLeDossierPromo(ns, pm)).toBe(true);
    expect(await canAccessEntity(ns, "PROMO_MATERIAL", pm.id, "VIEW")).toBe(true);
    expect(await canAccessEntity(await actorFor(u.ns2), "PROMO_MATERIAL", pm.id, "VIEW")).toBe(false);
    ACTOR = await actorFor(u.ns2);
    expect((await validatePromoStep(form({ id: pm.id }))).ok, "un autre superviseur n'est pas SON N+1").toBe(false);
    ACTOR = ns;
    const r = await validatePromoStep(form({ id: pm.id }));
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    expect((await etatDe(pm.id)).circuitState).toBe("QUOTE_TO_REQUEST");
  });

  it("DEMANDER UNE CORRECTION : le dossier revient à l'assistante, la sélection est effacée, le motif est au fil", async () => {
    ACTOR = await actorFor(u.kam);
    expect((await enregistrerArticleDemandePromo(form({ promoMaterialId: kamPmId, catalogueId: catCarnet, quantite: "500", actions: ["IMPRESSION"] }))).ok).toBe(true);
    const r0 = await demanderDevisPromo(form({ promoMaterialId: kamPmId }));
    expect(r0.ok, r0.ok ? "" : r0.error).toBe(true);
    ACTOR = await actorFor(u.asst);
    const fd = form({ promoMaterialId: kamPmId, supplierId: fourA, ligneReference: ["Carnet A5"], ligneQuantite: ["500"], lignePrix: ["120"], ligneAction: ["IMPRESSION"] });
    fd.set("scan", pdf("devis.pdf"));
    expect((await enregistrerDevisPromo(fd)).ok).toBe(true);
    expect((await terminerRetranscriptionPromo(form({ promoMaterialId: kamPmId }))).ok).toBe(true);
    const ligne = await prisma.promoQuoteLine.findFirstOrThrow({ where: { quote: { promoMaterialId: kamPmId } } });
    ACTOR = await actorFor(u.kam);
    expect((await choisirLignesPromo(form({ promoMaterialId: kamPmId, lineIds: [ligne.id] }))).ok).toBe(true);
    expect((await demanderCorrectionDevisPromo(form({ promoMaterialId: kamPmId }))).ok, "sans motif, l'assistante reprendrait à l'identique").toBe(false);
    const c = await demanderCorrectionDevisPromo(form({ promoMaterialId: kamPmId, motif: "Le prix unitaire est 12 DZD, pas 120" }));
    expect(c.ok, c.ok ? "" : c.error).toBe(true);
    expect((await etatDe(kamPmId)).circuitState).toBe("QUOTE_REQUESTED");
    expect((await prisma.promoQuoteLine.findUniqueOrThrow({ where: { id: ligne.id } })).selected).toBe(false);

    // ADAM, SOUS LA PORTE DE LA FICHE. Le N+1 du délégué ouvre CE dossier et pas celui du chef de
    // produit : désigné par le fragment commun aux deux, il n'en reçoit qu'UN — l'autre n'est pas
    // même listé. Un autre superviseur n'en reçoit aucun, et le refus ne cite aucun titre.
    expect(await designerDossierPromo(await actorFor(u.ns), TAG)).toMatchObject({ id: kamPmId });
    const autre = await designerDossierPromo(await actorFor(u.ns2), TAG);
    expect("error" in autre && autre.error).toMatch(/parmi ceux qui vous sont ouverts/);
    expect(JSON.stringify(autre)).not.toMatch(/Présentoirs|Carnets/);
    // Un geste hors étape n'est pas OFFERT : le dossier attend la retranscription, pas un choix.
    const horsEtape = await DOMAIN_TOOLS.promo_operation.ops.choose_promo_lines.impl.propose({ reference: `${TAG}-KAM`, supplier: "Atlas" }, await actorFor(u.kam));
    expect("error" in horsEtape && horsEtape.error).toMatch(/n'attend pas le choix des lignes.*retranscription/i);
    expect(await prisma.comment.count({ where: { entityType: "PROMO_MATERIAL", entityId: kamPmId, body: { contains: "12 DZD" } } })).toBe(1);
  });

  it("REFUSER : motif obligatoire, et le refus arrête le circuit", async () => {
    ACTOR = await actorFor(u.asst);
    const ligne = await prisma.promoQuoteLine.findFirstOrThrow({ where: { quote: { promoMaterialId: kamPmId } }, include: { quote: true } });
    const fix = form({ promoMaterialId: kamPmId, quoteId: ligne.quoteId, supplierId: fourA, ligneReference: ["Carnet A5"], ligneQuantite: ["500"], lignePrix: ["12"], ligneAction: ["IMPRESSION"] });
    expect((await enregistrerDevisPromo(fix)).ok).toBe(true);
    expect((await terminerRetranscriptionPromo(form({ promoMaterialId: kamPmId }))).ok).toBe(true);
    ACTOR = await actorFor(u.kam);
    expect((await refusePromoStep(form({ id: kamPmId }))).ok).toBe(false);
    const r = await refusePromoStep(form({ id: kamPmId, reason: "Budget réaffecté" }));
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    expect((await etatDe(kamPmId)).circuitState).toBe("REFUSED");
    ACTOR = await actorFor(u.asst);
    expect((await genererBonsDeCommandePromo(form({ promoMaterialId: kamPmId }))).ok).toBe(false);
  });

  it("SUPPRIMER UN BC d'un dossier terminé est refusé ; le motif est toujours exigé", async () => {
    const [e] = (await executionDuDossier(pmId)).filter((x) => x.bc);
    ACTOR = await actorFor(u.cp);
    const r = await annulerBonDeCommandePromo(form({ promoMaterialId: pmId, quoteId: e.quoteId, motif: "erreur" }));
    expect(r.ok).toBe(false);
  });
});
