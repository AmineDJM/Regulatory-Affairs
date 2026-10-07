import { prisma } from "@/lib/prisma";
import { assurerProduitsDesDossiers, ligneDeBilan } from "@/lib/products/canonique";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * CHAQUE DOSSIER A SON PRODUIT — en ligne de commande (produit = dossier, Direction 08/10).
 *
 * Ce script n'a pas sa propre logique : il appelle `assurerProduitsDesDossiers`, le passage même
 * que le serveur lance à son démarrage et que le Super Admin relance depuis Produits 360 (⋯).
 * Idempotent. Les produits partagés par plusieurs dossiers (héritage de l'ancien catalogue) sont
 * listés, jamais scindés d'office.
 *
 *     npx tsx scripts/backfill/canonical-products.ts
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

async function main(): Promise<void> {
  const b = await assurerProduitsDesDossiers();
  console.log(ligneDeBilan(b));
  for (const p of b.produitsPartages.slice(0, 50)) console.log(`    ${p.code} (${p.nom}) — ${p.dossiers.join(", ")}`);
  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
