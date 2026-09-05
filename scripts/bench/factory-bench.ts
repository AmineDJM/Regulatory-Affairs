/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE BANC DE LA FABRIQUE DE DOCUMENTS — deux cents factures, cinquante sur papier en-tête, un
 * dossier de comité à trois formats : composées, RELUES et contrôlées, chronométrées.
 *
 *   npm run factory:bench
 *
 * MESURÉ : la composition (règles, calculs, OOXML), la relecture par l'adaptateur et le contrôle
 * avant livraison de chaque pièce ; la conservation à l'octet près des pièces du papier en-tête ;
 * la construction d'un dossier (classeur recalculé, deck relu, note relue, cohérence des totaux).
 * PAS MESURÉ : l'écriture dans le Drive, la numérotation en base et la conversion PDF — elles
 * dépendent de l'hébergement et sont couvertes par `factory.test.ts` sur une vraie base.
 * Un BUDGET par section fait échouer le banc : un banc qui ne peut pas échouer n'est pas un banc.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import PizZip from "pizzip";
import { construireDocumentCommercial } from "@/lib/artifact/factory/build";
import { construireDossier } from "@/lib/artifact/factory/dossier";
import { montantEnLettres } from "@/lib/artifact/factory/lettres";
import { papierEnTeteDeDemonstration } from "@/lib/artifact/factory/word";
import type { SpecDocumentCommercial } from "@/lib/artifact/factory/commercial";
import type { DonneesCanoniques } from "@/lib/artifact/factory/canonical";
import { percentiles } from "@/lib/artifact/observability/timing";

const FACTURES = Number(process.env.FACTORY_BENCH_FACTURES ?? 200);
const SUR_PAPIER = Number(process.env.FACTORY_BENCH_PAPIER ?? 50);

interface Ligne { section: string; mesure: string; valeur: number; budget: number; unite: string }
const lignes: Ligne[] = [];
let echec = false;
function noter(section: string, mesure: string, valeur: number, budget: number, unite = "ms"): void {
  lignes.push({ section, mesure, valeur: Math.round(valeur * 10) / 10, budget, unite });
  const ok = valeur <= budget;
  if (!ok) echec = true;
  console.log(`  ${ok ? "✓" : "✗"} ${section.padEnd(22)} ${mesure.padEnd(28)} ${String(Math.round(valeur * 10) / 10).padStart(9)} ${unite}  (budget ${budget} ${unite})`);
}

const emetteur = {
  nom: "Adventum Pharma", formeJuridique: "SARL", capital: "10 000 000 DZD", adresse: "12 rue des Frères Bouadou, Bir Mourad Raïs, Alger",
  rc: "16/00-1234567B21", nif: "001916012345678", ai: "16012345678", nis: "001916012345690", telephone: "+213 21 00 00 00", email: "contact@adventum.dz",
  banque: "BNA — Agence Hydra", rib: "001 00123 0123456789 45",
};
const PRODUITS = ["Amoxicilline 1 g — boîte de 12", "Paracétamol 500 mg — boîte de 20", "Oméprazole 20 mg — boîte de 14", "Metformine 850 mg — boîte de 30", "Atorvastatine 20 mg — boîte de 28", "Bisoprolol 5 mg — boîte de 30", "Salbutamol 100 µg — flacon", "Ibuprofène 400 mg — boîte de 20", "Ceftriaxone 1 g — flacon", "Insuline glargine — stylo"];
const CLIENTS = ["Pharmacie Centrale d'Alger", "Grossiste Répartiteur de l'Est", "EPH de Sétif", "Pharmacie El Amel — Oran", "CHU Mustapha Pacha", "Pharmacie des Oliviers — Blida", "Groupe Hydrapharm", "Pharmacie Ibn Sina — Constantine"];

/** Un générateur déterministe : le banc mesure toujours les mêmes pièces. */
function facture(i: number): SpecDocumentCommercial {
  let graine = i * 2654435761 % 4294967296;
  const alea = () => { graine = (graine * 1664525 + 1013904223) % 4294967296; return graine / 4294967296; };
  const n = 3 + Math.floor(alea() * 10);
  return {
    type: i % 3 === 0 ? "FACTURE" : i % 3 === 1 ? "DEVIS" : "BON_DE_COMMANDE",
    numero: `${i % 3 === 0 ? "FA" : i % 3 === 1 ? "DEV" : "BC"}-2026-${String(i + 1).padStart(4, "0")}`,
    date: "2026-09-05", echeance: i % 3 === 0 ? "2026-10-05" : null, validiteJours: 30,
    emetteur, tiers: { nom: CLIENTS[i % CLIENTS.length], adresse: "Alger", nif: `0000160987654${String(i % 100).padStart(2, "0")}` },
    lignes: Array.from({ length: n }, (_, k) => ({
      designation: PRODUITS[(i + k) % PRODUITS.length], quantite: 1 + Math.floor(alea() * 200), unite: k % 4 === 0 ? "boîte" : null,
      prixUnitaire: Math.round(alea() * 50_000) / 10, remise: k % 5 === 0 ? 0.05 : null, tva: k % 7 === 0 ? 0.09 : null,
    })),
    modePaiement: i % 4 === 0 ? "ESPECES" : "VIREMENT", conditionsPaiement: "30 jours date de facture", signataire: { nom: "Amine Djouamai", qualite: "Gérant" },
  };
}

function dossier(): DonneesCanoniques {
  const regions = ["Alger", "Oran", "Constantine", "Sétif", "Annaba", "Blida", "Tlemcen", "Béjaïa", "Batna", "Ouargla"];
  return {
    titre: "Revue commerciale T3 2026", sousTitre: "Comité de direction", societe: { nom: "Adventum Pharma", couleur: "0B2545" }, date: "2026-09-05",
    sections: Array.from({ length: 10 }, (_, i) => ({ titre: `Axe ${i + 1} — lecture du trimestre`, puces: Array.from({ length: 5 }, (_, k) => `Constat ${k + 1} de l'axe ${i + 1}, chiffré et daté`) })),
    chiffres: Array.from({ length: 8 }, (_, i) => ({ cle: `k${i}`, libelle: `Indicateur clé n° ${i + 1}`, valeur: 1_000_000 * (i + 1), format: "montant" as const })),
    parametres: [{ nom: "TVA", valeur: 0.19, libelle: "Taux de TVA", format: "0%" }],
    tableaux: Array.from({ length: 6 }, (_, t) => ({
      cle: `t${t}`, titre: `Ventes gamme ${t + 1}`,
      colonnes: [
        { cle: "region", titre: "Région", type: "texte" as const }, { cle: "qte", titre: "Quantité", type: "entier" as const }, { cle: "pu", titre: "P.U.", type: "montant" as const },
        { cle: "ht", titre: "HT", type: "montant" as const, formule: "[qte]*[pu]" }, { cle: "ttc", titre: "TTC", type: "montant" as const, formule: "[ht]*(1+{TVA})" },
      ],
      lignes: Array.from({ length: 300 }, (_, i) => ({ region: `${regions[i % regions.length]} ${Math.floor(i / regions.length) + 1}`, qte: 10 + ((i * 7) % 90), pu: 100 + ((i * 13) % 400) })),
      totaux: ["qte", "ht", "ttc"],
    })),
  };
}

async function main(): Promise<void> {
  console.log(`\nBanc de la fabrique — ${FACTURES} pièces, ${SUR_PAPIER} sur papier en-tête, 1 dossier à trois formats\n`);

  // 1 — Les pièces, sans papier.
  const t1: number[] = [];
  let ko = 0;
  for (let i = 0; i < FACTURES; i += 1) {
    const d = performance.now();
    const r = await construireDocumentCommercial(facture(i));
    t1.push(performance.now() - d);
    if (!r.verification.ok) { ko += 1; if (ko <= 3) console.log(`    pièce ${i} refusée : ${r.verification.bloquants.join(" ; ")}`); }
  }
  const p1 = percentiles(t1);
  noter("pièces", `${FACTURES} composées + relues P50`, p1.p50, 60);
  noter("pièces", "P95", p1.p95, 150);
  noter("pièces", "total", t1.reduce((s, x) => s + x, 0), 20_000);
  noter("pièces", "refusées", ko, 0, "pièce(s)");

  // 2 — Sur papier en-tête : le temps, et la fidélité des pièces du ZIP à chaque fois.
  const papier = papierEnTeteDeDemonstration();
  const avant = new PizZip(papier);
  const pieces = Object.keys(avant.files).filter((n) => !avant.files[n].dir && n !== "word/document.xml");
  const t2: number[] = [];
  let alterees = 0;
  for (let i = 0; i < SUR_PAPIER; i += 1) {
    const d = performance.now();
    const r = await construireDocumentCommercial(facture(i), { base: papier });
    t2.push(performance.now() - d);
    if (!r.verification.ok) ko += 1;
    const apres = new PizZip(r.octets);
    for (const n of pieces) if (Buffer.compare(avant.file(n)!.asNodeBuffer(), apres.file(n)!.asNodeBuffer()) !== 0) alterees += 1;
  }
  const p2 = percentiles(t2);
  noter("papier en-tête", `${SUR_PAPIER} pièces P50`, p2.p50, 80);
  noter("papier en-tête", "P95", p2.p95, 200);
  noter("papier en-tête", "pièces du ZIP altérées", alterees, 0, "pièce(s)");

  // 3 — Le dossier : 6 tableaux × 300 lignes, 10 sections, 8 chiffres.
  const d3 = performance.now();
  const doss = await construireDossier(dossier());
  const ms3 = performance.now() - d3;
  noter("dossier 3 formats", "construction + vérifications", ms3, 15_000);
  noter("dossier 3 formats", "bloquants", doss.bloquants.length, 0, "bloquant(s)");
  noter("dossier 3 formats", "totaux comparés (attendu 18)", 18 - (doss.coherence?.totauxCompares ?? 0), 0, "manquant(s)");
  console.log(`    classeur ${Math.round(doss.classeur.octets.length / 1024)} Ko (${doss.classeur.verification?.formules ?? 0} formules), deck ${Math.round(doss.deck.octets.length / 1024)} Ko (${doss.deck.verification?.diapos ?? 0} diapos), note ${Math.round(doss.note.octets.length / 1024)} Ko (${doss.note.verification?.pages ?? 0} pages estimées)`);

  // 4 — Les montants en lettres : dix mille, sans une exception.
  const d4 = performance.now();
  for (let i = 0; i < 10_000; i += 1) montantEnLettres((i * 9973.37) % 999_999_999);
  noter("lettres", "10 000 montants", performance.now() - d4, 300);

  console.log("\n| Section | Mesure | Valeur | Budget |\n|---|---|---:|---:|");
  for (const l of lignes) console.log(`| ${l.section} | ${l.mesure} | ${l.valeur} ${l.unite} | ${l.budget} ${l.unite} |`);
  console.log(echec ? "\n✗ Au moins un budget est dépassé." : "\n✓ Tous les budgets sont tenus.");
  if (echec) process.exitCode = 1;
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
