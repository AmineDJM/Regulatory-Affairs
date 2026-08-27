import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { ensureProduct } from "@/lib/products/resolve";
import { estAmbigu, produit360, produit360ParId } from "./product-360";
import { pch360, pchParProduit } from "./pch-360";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LES LECTURES 360 — ce qu'elles promettent, sur de vraies lignes.
 *
 * Trois promesses, et chacune peut se rompre en silence :
 *
 *   1. LES TOTAUX PORTENT SUR TOUT, le détail seul est borné. Un total calculé en mémoire sur
 *      les 50 lignes remontées serait faux dès la 51ᵉ — faux, et muet.
 *   2. LES CINQ MONTANTS PCH NE SE MÉLANGENT PAS. Attribué ≠ commandé ≠ livré ≠ encaissé.
 *   3. RIEN N'EST INVENTÉ. Une ligne gagnée sans prix d'attribution ne reçoit pas une valeur
 *      « plausible » : elle est comptée comme manquante et l'écrit.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

let dbOk = false;
try { await prisma.$queryRaw`SELECT 1`; dbOk = true; } catch { dbOk = false; }
const suite = dbOk ? describe : describe.skip;

const TAG = `ZZ360${Date.now()}`;
const produits: string[] = [];
const marches: string[] = [];

suite("les lectures 360", () => {
  afterAll(async () => {
    await prisma.sale.deleteMany({ where: { client: { startsWith: TAG } } }).catch(() => {});
    await prisma.pchTender.deleteMany({ where: { id: { in: marches } } }).catch(() => {});
    await prisma.product.deleteMany({ where: { id: { in: produits } } }).catch(() => {});
  });

  it("le TOTAL des ventes porte sur toutes les lignes, le détail est borné et le DIT", async () => {
    const p = await ensureProduct({ dci: `${TAG}total`, dosage: "10", dosageUnit: "mg", form: "Comprimé" });
    produits.push(p!.id);

    // 55 ventes de 100 DZD : au-delà du plafond de détail (50), sous lequel un total calculé en
    // mémoire serait silencieusement faux de 500 DZD.
    await prisma.sale.createMany({
      data: Array.from({ length: 55 }, (_, i) => ({
        product: `${TAG} produit`, client: `${TAG} client ${i}`,
        quantity: 1, unitPrice: 100, revenue: 100, productId: p!.id,
      })),
    });

    const vue = await produit360ParId(p!.id);
    expect(vue).not.toBeNull();
    expect(vue!.ventes.nombre).toBe(55);
    expect(vue!.ventes.chiffreAffairesDzd).toBe(5_500);
    expect(vue!.ventes.detail.length).toBe(50);
    expect(vue!.ventes.detailTronque).toBe(true);
    // Le fait d'être tronqué se DIT — sinon un lecteur compte 50 lignes et conclut 50 ventes.
    expect(vue!.limites.some((l) => l.includes("55 lignes"))).toBe(true);
  });

  it("une mention ambiguë REND l'ambiguïté au lieu de trancher", async () => {
    const a = await ensureProduct({ dci: `${TAG}ambi`, dosage: "40", dosageUnit: "mg", form: "Injectable" });
    const b = await ensureProduct({ dci: `${TAG}ambi`, dosage: "100", dosageUnit: "mg", form: "Injectable" });
    produits.push(a!.id, b!.id);

    const r = await produit360(`${TAG}ambi`);
    expect(estAmbigu(r)).toBe(true);
    if (estAmbigu(r)) {
      expect(r.candidats.length).toBeGreaterThanOrEqual(2);
    }
    // Le dosage précisé tranche — et rend la vue complète.
    const precis = await produit360(`${TAG}ambi 100 mg`);
    expect(estAmbigu(precis)).toBe(false);
    expect(precis).not.toBeNull();
  });

  it("PCH : attribué, commandé, livré, encaissé ne se confondent pas", async () => {
    const p = await ensureProduct({ dci: `${TAG}marche`, dosage: "1", dosageUnit: "g", form: "Injectable" });
    produits.push(p!.id);

    const t = await prisma.pchTender.create({
      data: {
        reference: `${TAG}-AO-1`, title: `${TAG} marché`, status: "IN_PROGRESS",
        cautionAmount: 500_000, cautionDeposited: false,
        lines: {
          create: [
            // Gagnée AVEC prix : 1 000 unités × 200 = 200 000 attribué.
            { designation: `${TAG} ligne gagnée`, status: "WON", quantityUnits: 1_000, awardedUnitPriceDzd: 200, productId: p!.id },
            // Gagnée SANS prix d'ATTRIBUTION, mais AVEC un prix PROPOSÉ — le cas réel : la ligne
            // a été chiffrée, elle a été gagnée, et personne n'a encore saisi le prix retenu.
            // C'est précisément là qu'un repli sur le prix proposé inventerait 75 000 DZD
            // parfaitement plausibles et faux. Sans ce prix proposé, le test passerait même avec
            // le repli en place — il ne reproduirait pas la panne.
            { designation: `${TAG} ligne sans prix`, status: "WON", quantityUnits: 500, unitPriceDzd: 150 },
            // Perdue : ne compte pas non plus.
            { designation: `${TAG} ligne perdue`, status: "LOST", quantityUnits: 900, awardedUnitPriceDzd: 300 },
          ],
        },
      },
      select: { id: true, lines: { select: { id: true, status: true, designation: true } } },
    });
    marches.push(t.id);
    const gagnee = t.lines.find((l) => l.designation.includes("gagnée"))!;

    await prisma.pchOrder.createMany({
      data: [
        { tenderId: t.id, lineId: gagnee.id, reference: `${TAG}-BC-1`, quantity: 400, value: 80_000, status: "PAID", paymentDate: new Date() },
        { tenderId: t.id, lineId: gagnee.id, reference: `${TAG}-BC-2`, quantity: 300, value: 60_000, status: "DELIVERED" },
        { tenderId: t.id, lineId: gagnee.id, reference: `${TAG}-BC-3`, quantity: 200, value: 40_000, status: "PENDING" },
        // ANNULÉ : ne compte NULLE PART.
        { tenderId: t.id, lineId: gagnee.id, reference: `${TAG}-BC-4`, quantity: 999, value: 999_999, status: "CANCELLED" },
      ],
    });

    const vue = await pch360(`${TAG}-AO-1`);
    expect(vue).not.toBeNull();
    const m = vue!.montants;

    expect(m.attribueDzd).toBe(200_000);       // la ligne sans prix et la perdue n'y sont pas
    expect(m.commandeDzd).toBe(180_000);       // 80 + 60 + 40, l'annulé exclu
    expect(m.livreDzd).toBe(140_000);          // PAID + DELIVERED
    expect(m.encaisseDzd).toBe(80_000);        // PAID seul
    expect(m.resteAEncaisserDzd).toBe(100_000);

    // Les quatre montants sont DIFFÉRENTS : c'est tout l'intérêt de les nommer.
    expect(new Set([m.attribueDzd, m.commandeDzd, m.livreDzd, m.encaisseDzd]).size).toBe(4);

    // La ligne gagnée sans prix est SIGNALÉE, pas estimée.
    expect(vue!.limites.some((l) => l.includes("sans prix d'attribution"))).toBe(true);
    // La caution non déposée est une alerte.
    expect(vue!.caution.alerte).toContain("NON DÉPOSÉE");
    // Le taux de réalisation : 900 unités commandées sur 1 000 attribuées.
    const lg = vue!.lignes.find((l) => l.id === gagnee.id)!;
    expect(lg.unitesCommandees).toBe(900);
    expect(lg.tauxDeRealisationPct).toBe(90);
    expect(lg.produit?.id).toBe(p!.id);
  });

  it("PCH : les ventes enregistrées ne sont JAMAIS additionnées aux bons de commande", async () => {
    const t = await prisma.pchTender.findFirst({ where: { reference: `${TAG}-AO-1` }, select: { id: true, lines: { select: { id: true, designation: true } } } });
    const gagnee = t!.lines.find((l) => l.designation.includes("gagnée"))!;

    await prisma.sale.create({
      data: {
        product: `${TAG} vendu`, client: `${TAG} PCH`, quantity: 400,
        unitPrice: 200, revenue: 80_000, isPch: true, tenderLineId: gagnee.id,
      },
    });

    const vue = await pch360(`${TAG}-AO-1`);
    // Le commandé n'a PAS bougé : la vente ne s'y ajoute pas. Sans cette séparation, le même
    // argent serait compté deux fois — une fois en bon, une fois en vente.
    expect(vue!.montants.commandeDzd).toBe(180_000);
    expect(vue!.ventesEnregistrees.chiffreAffairesDzd).toBe(80_000);
    // L'écart est un SIGNAL de saisie, pas une somme : 180 000 commandés, 80 000 saisis.
    expect(vue!.ventesEnregistrees.ecartAvecCommandeDzd).toBe(100_000);
  });

  it("la position d'un produit sur les marchés se lit dans l'autre sens", async () => {
    const p = await prisma.product.findFirst({ where: { dci: { startsWith: `${TAG}marche`.toUpperCase() } }, select: { id: true } })
      ?? await prisma.product.findFirst({ where: { dci: { contains: `${TAG}marche`, mode: "insensitive" } }, select: { id: true } });
    const pos = await pchParProduit(p!.id);
    expect(pos).not.toBeNull();
    expect(pos!.lignes).toBe(1);
    expect(pos!.gagnees).toBe(1);
    expect(pos!.attribueDzd).toBe(200_000);
    expect(pos!.commandeDzd).toBe(180_000);
  });

  it("un produit sans aucune trace rend une vue VIDE mais complète — jamais null par paresse", async () => {
    const p = await ensureProduct({ dci: `${TAG}vide`, dosage: "5", dosageUnit: "mg", form: "Gélule" });
    produits.push(p!.id);
    const vue = await produit360ParId(p!.id);
    expect(vue!.ventes.nombre).toBe(0);
    expect(vue!.ventes.chiffreAffairesDzd).toBe(0);
    expect(vue!.marches).toEqual([]);
    expect(vue!.terrain.nombreDeVisites).toBe(0);
    // L'absence de dossier réglementaire est DITE — elle peut vouloir dire « à l'étude », ou
    // « rapprochement pas encore fait », et ces deux-là ne se confondent pas.
    expect(vue!.limites.some((l) => l.includes("aucun dossier réglementaire"))).toBe(true);
  });
});
