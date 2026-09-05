import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { executePowerTool, powerToolsFor } from "@/lib/assistant/power-tools";
import { executiveBriefing } from "@/lib/assistant/executive-tools";
import { ensureProduct } from "@/lib/products/resolve";
import type { CurrentUser } from "@/lib/session";
import { BUSINESS_CAPABILITIES } from "./business-capabilities";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LES CAPACITÉS MÉTIER — la promesse est « une question, un appel ». On la vérifie.
 *
 * Une capacité qui rend les bons chiffres mais oblige quand même le modèle à en appeler quatre
 * autres pour comprendre la réponse n'a rien remplacé. Ces tests figent donc la SUFFISANCE de
 * la réponse : les définitions y sont, les limites y sont, l'ambiguïté remonte en question.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

let dbOk = false;
try { await prisma.$queryRaw`SELECT 1`; dbOk = true; } catch { dbOk = false; }
const suite = dbOk ? describe : describe.skip;

const TAG = `ZZCAP${Date.now()}`;
const produits: string[] = [];
const marches: string[] = [];

/** Un compte qui a les droits de LECTURE concernés — jamais un rôle en dur. */
function lecteur(): CurrentUser {
  return {
    id: "u-cap", name: "Lecteur", email: "cap@test.local", role: "SUPER_ADMIN",
    access: {
      modules: new Map([
        ["REGULATORY", { scope: "ALL", actions: new Set(["VIEW"]) }],
        ["PCH", { scope: "ALL", actions: new Set(["VIEW"]) }],
      ]),
      companies: [], allCompanies: true,
    },
  } as unknown as CurrentUser;
}

describe("les capacités métier — la forme", () => {
  it("le nom d'outil est accepté par le fournisseur : pas de point, pas d'espace", () => {
    // Les capacités ont été spécifiées `product.getEconomics` ; le point est refusé côté API.
    // Ce test empêche de recopier la spécification telle quelle et d'obtenir un HTTP 400 en
    // production, sur TOUS les appels — pas seulement sur celui qui utilise l'outil.
    for (const c of BUSINESS_CAPABILITIES) {
      expect(c.def.name, c.def.name).toMatch(/^[a-zA-Z0-9_-]{1,64}$/);
    }
  });

  it("chaque capacité annonce CE QU'ELLE REMPLACE — sinon le modèle ne saura pas la préférer", () => {
    const eco = BUSINESS_CAPABILITIES.find((c) => c.def.name === "product_economics")!;
    // La description est le seul endroit où le modèle apprend qu'un raccourci existe. Sans elle,
    // il continuerait la séquence en quatre appels qu'il connaît déjà.
    expect(eco.def.description).toContain("REMPLACE");
    expect(eco.def.description).toMatch(/en un appel/i);
  });

  it("LA DOCTRINE dit au modèle de PRÉFÉRER la capacité — sinon il refait la séquence longue", () => {
    // Une capacité déclarée mais jamais préférée n'économise rien : le modèle continue la
    // séquence qu'il connaît. La consigne d'outils est le seul endroit où il apprend qu'un
    // raccourci existe, et ce test empêche qu'une réécriture de prompt la fasse disparaître
    // sans que personne ne s'en aperçoive — la régression serait silencieuse et coûteuse.
    // La DOCTRINE (le prompt) nomme la préférence — et rien de plus : le prompt porte le
    // jugement, pas le mode d'emploi. Les RÈGLES qui rendent les chiffres utilisables vivent
    // dans la description de l'outil, là où elles suivent le modèle quel qu'il soit.
    const doctrine = executiveBriefing(lecteur());
    expect(doctrine).toContain("product_economics");
    expect(doctrine).toContain("pch_market_status");
    expect(doctrine).toMatch(/PAS la\s+séquence/);
    const outils = powerToolsFor(lecteur());
    const eco = outils.find((t) => t.name === "product_economics")!;
    const pch = outils.find((t) => t.name === "pch_market_status")!;
    expect(eco.description).toMatch(/chacun avec SA DÉFINITION/i);
    expect(eco.description).toMatch(/REMPLACE la séquence/);
    expect(eco.description).toMatch(/jamais zéro/i);
    expect(pch.description).toMatch(/chacun avec sa définition/i);
  });

  it("les capacités sont dans le registre et suivent les DROITS", () => {
    const noms = powerToolsFor(lecteur()).map((t) => t.name);
    expect(noms).toContain("product_economics");
    expect(noms).toContain("pch_market_status");

    // Sans le droit PCH, la lecture PCH disparaît — la capacité ne crée aucun accès.
    const sansPch = {
      ...lecteur(),
      access: { modules: new Map([["REGULATORY", { scope: "ALL", actions: new Set(["VIEW"]) }]]), companies: [], allCompanies: true },
    } as unknown as CurrentUser;
    expect(powerToolsFor(sansPch).map((t) => t.name)).not.toContain("pch_market_status");
  });
});

suite("les capacités métier — la réponse", () => {
  afterAll(async () => {
    await prisma.sale.deleteMany({ where: { client: { startsWith: TAG } } }).catch(() => {});
    await prisma.pchTender.deleteMany({ where: { id: { in: marches } } }).catch(() => {});
    await prisma.product.deleteMany({ where: { id: { in: produits } } }).catch(() => {});
  });

  it("UN SEUL APPEL rend les chiffres ET leurs définitions — rien à aller rechercher", async () => {
    const p = await ensureProduct({ dci: `${TAG}eco`, dosage: "50", dosageUnit: "mg", form: "Comprimé" });
    produits.push(p!.id);
    await prisma.sale.create({
      data: { product: `${TAG}p`, client: `${TAG}c`, quantity: 2, unitPrice: 500, revenue: 1_000, productId: p!.id, paymentStatus: "PAID" },
    });

    const brut = await executePowerTool("product_economics", { produit: p!.code }, lecteur());
    const out = JSON.parse(brut!);

    // Le chiffre EST là…
    const encaisse = out.metriques.find((m: { nom: string }) => m.nom === "collectedRevenue");
    expect(encaisse.valeur).toBe(1_000);
    // …et sa DÉFINITION voyage avec lui. C'est ce qui évite « le CA, c'est lequel déjà ? ».
    expect(encaisse.definition).toContain("RÉGLÉ");

    // Le portefeuille, les marchés et les limites sont dans la MÊME réponse : le modèle n'a
    // aucune raison de rappeler un autre outil pour compléter.
    expect(out).toHaveProperty("portefeuille");
    expect(out).toHaveProperty("marches");
    expect(out).toHaveProperty("limites");
    expect(out.produit.code).toBe(p!.code);
  });

  it("l'ambiguïté remonte en QUESTION — la capacité ne choisit pas à la place de l'humain", async () => {
    const a = await ensureProduct({ dci: `${TAG}amb`, dosage: "40", dosageUnit: "mg", form: "Injectable" });
    const b = await ensureProduct({ dci: `${TAG}amb`, dosage: "100", dosageUnit: "mg", form: "Injectable" });
    produits.push(a!.id, b!.id);

    const r = await executePowerTool("product_economics", { produit: `${TAG}amb` }, lecteur());
    // Pas un JSON de chiffres : une phrase à poser. Trancher seul mettrait le chiffre d'affaires
    // du 40 mg sous le nom du 100 mg, sans que personne ne le voie.
    expect(r).toMatch(/plusieurs produits/i);
    expect(r).toContain(a!.code);
    expect(r).toContain(b!.code);
  });

  it("un produit inconnu le DIT, et distingue « pas trouvé » de « pas rapproché »", async () => {
    const r = await executePowerTool("product_economics", { produit: `${TAG}nexistepas` }, lecteur());
    expect(r).toMatch(/Aucun produit/i);
    // La nuance compte : un produit peut exister dans l'ERP sans être encore rapproché au
    // catalogue canonique, et répondre « il n'existe pas » serait faux.
    expect(r).toMatch(/pas encore rapproché/i);
  });

  it("le marché rend les CINQ montants en un appel, chacun défini", async () => {
    const t = await prisma.pchTender.create({
      data: {
        reference: `${TAG}-AO`, status: "IN_PROGRESS",
        lines: { create: [{ designation: `${TAG} l`, status: "WON", quantityUnits: 100, awardedUnitPriceDzd: 300 }] },
        orders: { create: [{ reference: `${TAG}-B1`, quantity: 50, value: 15_000, status: "PAID", paymentDate: new Date() }] },
      },
      select: { id: true },
    });
    marches.push(t.id);

    const out = JSON.parse((await executePowerTool("pch_market_status", { marche: `${TAG}-AO` }, lecteur()))!);
    expect(out.montants.attribueDzd).toBe(30_000);
    expect(out.montants.commandeDzd).toBe(15_000);
    expect(out.montants.encaisseDzd).toBe(15_000);
    // Les définitions accompagnent les montants dans la réponse elle-même.
    expect(Object.keys(out.montants.definitions)).toContain("attribue");
    // Les ventes commerciales sont un bloc SÉPARÉ — jamais fondu dans les montants du marché.
    expect(out).toHaveProperty("ventesEnregistrees");
  });

  it("la lecture PCH est REFUSÉE à qui n'a pas le droit, même si le modèle l'appelle", async () => {
    const sansPch = {
      ...lecteur(),
      access: { modules: new Map([["REGULATORY", { scope: "ALL", actions: new Set(["VIEW"]) }]]), companies: [], allCompanies: true },
    } as unknown as CurrentUser;
    const r = await executePowerTool("pch_market_status", { marche: `${TAG}-AO` }, sansPch);
    expect(r).toMatch(/ne vous est pas ouvert/i);
  });
});
