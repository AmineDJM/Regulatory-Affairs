import { prisma } from "@/lib/prisma";
import { identityKey } from "@/lib/products/identity";
import { ensureProduct } from "@/lib/products/resolve";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE BACKFILL — DÉTERMINISTE, ou rien.
 *
 * ── LA RÈGLE, ET POURQUOI ELLE EST PLUS IMPORTANTE QUE LE TAUX DE COUVERTURE ─────────────
 *
 * Ce script ne rapproche QUE sur une clé d'identité complète : DCI, dosage, unité, forme,
 * conditionnement. Rien d'autre. Pas de ressemblance de nom, pas de « probablement le même »,
 * pas de score.
 *
 * Un dossier sans dosage ou sans forme reste donc SANS produit canonique, et c'est le
 * comportement voulu. Rattacher au jugé, c'est écrire dans l'ERP une relation que personne n'a
 * décidée — et découvrir six mois plus tard qu'un 500 mg pointe sur un 1 g, dans un chiffre
 * d'affaires par produit que quelqu'un aura déjà présenté en réunion.
 *
 * Ce qui reste non rapproché est COMPTÉ et listé. C'est un travail humain, pas un échec.
 *
 * ── LANCEMENT ────────────────────────────────────────────────────────────────────────────
 *
 *     npx tsx scripts/backfill/canonical-products.ts           # simulation, n'écrit rien
 *     npx tsx scripts/backfill/canonical-products.ts --apply   # écrit
 *
 * La simulation est le DÉFAUT : un backfill qui écrit sans qu'on l'ait demandé est une
 * migration de données déguisée en script.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const APPLY = process.argv.includes("--apply");

interface Bilan {
  source: string;
  total: number;
  deja: number;
  rapproches: number;
  crees: number;
  sansCle: string[];
}

/** Le tuple d'identité d'un dossier réglementaire — la source la plus complète. */
async function backfillRegulatory(): Promise<Bilan> {
  const rows = await prisma.regulatoryProduct.findMany({
    select: {
      id: true, reference: true, dci: true, brandName: true, dosage: true, dosageUnit: true,
      pharmaceuticalForm: true, packaging: true, channel: true, companyId: true,
      status: true, productId: true,
    },
  });

  const bilan: Bilan = { source: "RegulatoryProduct", total: rows.length, deja: 0, rapproches: 0, crees: 0, sansCle: [] };

  for (const r of rows) {
    if (r.productId) { bilan.deja++; continue; }
    const key = identityKey({
      dci: r.dci, dosage: r.dosage, dosageUnit: r.dosageUnit,
      form: r.pharmaceuticalForm, packaging: r.packaging,
    });
    // PAS DE CLÉ = PAS DE RAPPROCHEMENT. Un dossier sans DCI exploitable reste orphelin, et se
    // traite à la main. C'est la règle centrale de ce script.
    if (!key) { bilan.sansCle.push(r.reference); continue; }

    if (!APPLY) { bilan.rapproches++; continue; }

    const p = await ensureProduct({
      dci: r.dci,
      canonicalName: r.brandName || r.dci,
      dosage: r.dosage, dosageUnit: r.dosageUnit,
      form: r.pharmaceuticalForm, packaging: r.packaging,
      channel: r.channel, companyId: r.companyId,
      // Le cycle de vie SUIT le statut réglementaire, sans rien inventer : seule une décision
      // OBTENUE prouve un enregistrement. Tout le reste — présoumission, dépôt, attente ANPP —
      // décrit un produit encore à l'étude, et le dire autrement serait annoncer un
      // enregistrement qui n'existe pas.
      lifecycle: r.status === "DECISION_OBTAINED" ? "REGISTERED" : "STUDY",
    });
    if (!p) { bilan.sansCle.push(r.reference); continue; }
    await prisma.regulatoryProduct.update({ where: { id: r.id }, data: { productId: p.id } });
    bilan.rapproches++;
    if (p.created) bilan.crees++;
  }
  return bilan;
}

/**
 * LES PROFILS QUI POINTENT DÉJÀ SUR UN DOSSIER héritent de SON produit — c'est le
 * rapprochement le plus sûr du lot, puisqu'un humain a déjà validé le lien profil → dossier.
 *
 * Ceux qui ne pointent sur aucun dossier restent orphelins : un `BdProduct` à l'étude n'a
 * souvent qu'une DCI et un nom de marque, ce qui ne suffit pas à une clé complète.
 */
async function backfillParDossier(
  source: string,
  read: () => Promise<{ id: string; ref: string; regulatoryProductId: string | null; productId: string | null }[]>,
  write: (id: string, productId: string) => Promise<unknown>,
): Promise<Bilan> {
  const rows = await read();
  const bilan: Bilan = { source, total: rows.length, deja: 0, rapproches: 0, crees: 0, sansCle: [] };

  const dossiers = rows.map((r) => r.regulatoryProductId).filter((x): x is string => Boolean(x));
  const map = new Map(
    (await prisma.regulatoryProduct.findMany({
      where: { id: { in: dossiers } },
      select: { id: true, productId: true },
    })).map((d) => [d.id, d.productId]),
  );

  for (const r of rows) {
    if (r.productId) { bilan.deja++; continue; }
    const pid = r.regulatoryProductId ? map.get(r.regulatoryProductId) : null;
    if (!pid) { bilan.sansCle.push(r.ref); continue; }
    if (APPLY) await write(r.id, pid);
    bilan.rapproches++;
  }
  return bilan;
}

function afficher(b: Bilan): void {
  const orphelins = b.sansCle.length;
  console.log(
    `  ${b.source.padEnd(20)} ${String(b.total).padStart(5)} lignes · ${String(b.deja).padStart(4)} déjà liées · `
    + `${String(b.rapproches).padStart(4)} rapprochées${b.crees ? ` (${b.crees} produits créés)` : ""} · `
    + `${String(orphelins).padStart(4)} sans clé`,
  );
  if (orphelins > 0) {
    console.log(`      à traiter à la main : ${b.sansCle.slice(0, 12).join(", ")}${orphelins > 12 ? `… (+${orphelins - 12})` : ""}`);
  }
}

async function main(): Promise<void> {
  console.log(`\n══ BACKFILL PRODUIT CANONIQUE — ${APPLY ? "ÉCRITURE" : "SIMULATION (rien n'est écrit)"} ══\n`);

  const bilans = [
    await backfillRegulatory(),
    await backfillParDossier(
      "PromoProduct",
      async () => (await prisma.promoProduct.findMany({
        select: { id: true, name: true, regulatoryProductId: true, productId: true },
      })).map((r) => ({ id: r.id, ref: r.name, regulatoryProductId: r.regulatoryProductId, productId: r.productId })),
      (id, productId) => prisma.promoProduct.update({ where: { id }, data: { productId } }),
    ),
    await backfillParDossier(
      "BdProduct",
      async () => (await prisma.bdProduct.findMany({
        select: { id: true, dci: true, regulatoryProductId: true, productId: true },
      })).map((r) => ({ id: r.id, ref: r.dci, regulatoryProductId: r.regulatoryProductId, productId: r.productId })),
      (id, productId) => prisma.bdProduct.update({ where: { id }, data: { productId } }),
    ),
  ];

  for (const b of bilans) afficher(b);

  const orphelins = bilans.reduce((n, b) => n + b.sansCle.length, 0);
  console.log(
    `\n${orphelins} ligne(s) sans rapprochement sûr — c'est un travail humain, pas un échec.`
    + `\nLe script ne rapproche QUE sur une clé d'identité complète : rattacher au jugé écrirait`
    + `\ndans l'ERP une relation que personne n'a décidée.`,
  );
  if (!APPLY) console.log("\nRien n'a été écrit. Relancer avec --apply pour appliquer.");
  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
