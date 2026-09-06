import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { consignerMesure } from "@/lib/evals/registre";
import { prisma } from "@/lib/prisma";
import { consignerProvenance, relireProvenance, repondreDouTuTiensCa } from "./provenance-store";
import { extraireFaits, faitCalcule } from "./provenance";

/**
 * LA PROVENANCE PERSISTÉE — écriture par tour, relecture indexée, cloisonnement, et le budget
 * du mandat : « d'où tu tiens ça ? » se relit en moins de 500 ms au P95 (mesuré ici sur la base
 * locale, hors réseau — ce que la mesure NE couvre pas est dit).
 */
const U1 = "__prov_test__u1";
const U2 = "__prov_test__u2";
const T1 = "__prov_test__thread1";

async function nettoyer() {
  await prisma.assistantProvenance.deleteMany({ where: { userId: { startsWith: "__prov_test__" } } });
}

describe("provenance-store — consigner, relire, répondre", () => {
  beforeAll(nettoyer);
  afterAll(async () => { await nettoyer(); await prisma.$disconnect(); });

  it("consigne un tour avec ses faits, un tour vide aussi, et relit dans l'ordre inverse", async () => {
    const faitsA = extraireFaits("search_products", JSON.stringify({ produits: [{ reference: "PRD-014", nom: "Lenvatinib", statut: "SUBMITTED", misAJour: "2026-08-12", lien: "/regulatory/abc" }] }), { acteur: U1 });
    const a = await consignerProvenance({ userId: U1, threadId: T1, question: "Où en est Lenvatinib ?", faits: faitsA });
    expect(a.id).not.toBeNull();
    expect(a.nombre).toBe(1);
    await new Promise((r) => setTimeout(r, 5));
    const total = faitCalcule({ outil: "finance_totals", acteur: U1, libelle: "Total décaissé Hetero T3", valeur: "142 800 DZD", entrees: ["PAY-1", "PAY-2"], transformation: "somme", formule: "Σ montant", href: "/finances" });
    await consignerProvenance({ userId: U1, threadId: T1, question: "Combien payé à Hetero ?", faits: [total] });
    await new Promise((r) => setTimeout(r, 5));
    const vide = await consignerProvenance({ userId: U1, threadId: T1, question: "Merci !", faits: [] });
    expect(vide.nombre).toBe(0);

    const tours = await relireProvenance(U1, { threadId: T1 });
    expect(tours.map((t) => t.faits.length)).toEqual([0, 1, 1]);
    expect(tours[0].question).toBe("Merci !");
  });

  it("sans ancre, le DERNIER tour fait foi — même vide ; avec une ancre, on remonte jusqu'au fait", async () => {
    const r0 = await repondreDouTuTiensCa(U1, "D'où tu tiens ça ?", { threadId: T1 });
    expect(r0.trouve).toBe(false);
    expect(r0.texte).toMatch(/aucun fait sourcé/);

    const r1 = await repondreDouTuTiensCa(U1, "D'où tu tiens les 142 800 ?", { threadId: T1 });
    expect(r1.trouve).toBe(true);
    expect(r1.cible).toBe("ancre");
    expect(r1.faits[0].nature).toBe("CALCUL");
    expect(r1.texte).toMatch(/formule Σ montant/);

    const r2 = await repondreDouTuTiensCa(U1, "Et pour Lenvatinib, ta source ?", { threadId: T1 });
    expect(r2.cible).toBe("ancre");
    expect(r2.texte).toMatch(/ERP · Regulatory/);
  });

  it("le fil inconnu retombe sur la personne ; une autre personne ne voit RIEN", async () => {
    const r = await repondreDouTuTiensCa(U1, "D'où tu tiens les 142 800 ?", { threadId: "__prov_test__autre_fil" });
    expect(r.trouve).toBe(true);
    expect(await relireProvenance(U2)).toEqual([]);
    const r2 = await repondreDouTuTiensCa(U2, "D'où tu tiens les 142 800 ?");
    expect(r2.trouve).toBe(false);
  });

  it("budget : la relecture tient sous 500 ms au P95 (base locale, 40 lectures)", async () => {
    // Un registre chargé : quarante tours de quarante faits pour la même personne.
    const gros = Array.from({ length: 40 }, (_, i) => ({ reference: `PRD-${i}`, nom: `Produit ${i}`, statut: "SUBMITTED", misAJour: "2026-08-12", lien: `/regulatory/${i}` }));
    const faits = extraireFaits("regulatory_portfolio", JSON.stringify({ produits: gros }), { acteur: U1, max: 40 });
    for (let t = 0; t < 40; t++) await consignerProvenance({ userId: U1, threadId: T1, question: `tour ${t}`, faits });
    const durees: number[] = [];
    for (let i = 0; i < 40; i++) {
      const r = await repondreDouTuTiensCa(U1, i % 2 ? "D'où tu tiens ça ?" : "D'où tu sors PRD-7 ?", { threadId: T1 });
      durees.push(r.ms);
      expect(r.trouve).toBe(true);
    }
    durees.sort((a, b) => a - b);
    const p95 = durees[Math.floor(durees.length * 0.95) - 1] ?? durees[durees.length - 1];
    console.log(`   · provenance lookup : P50 ${durees[Math.floor(durees.length / 2)]} ms · P95 ${p95} ms (base locale, sans réseau)`);
    expect(p95).toBeLessThan(500);
    consignerMesure("provenance_lookup_p95", { valeur: p95 }, "lib/fabric/provenance-store.test.ts");
  });
});
