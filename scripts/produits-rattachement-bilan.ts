/**
 * PRODUITS 360 — CHAQUE DOSSIER A SON PRODUIT, en ligne de commande (Direction, 08/10 : « un seul catalogue »).
 *
 * Le même passage que celui du démarrage du serveur et du geste « Vérifier le catalogue » du Super Admin
 * (Produits 360 › ⋯) : `assurerProduitsDesDossiers` (`products/canonique.ts`), idempotent — rejoué, il ne fait
 * que ce qui reste. Chaque dossier non verrouillé reçoit SON produit, identité complète ou non ; les produits
 * encore partagés par plusieurs dossiers sont LISTÉS, jamais scindés d'office.
 *
 *   npx tsx scripts/produits-rattachement-bilan.ts
 */
import { prisma } from "../src/lib/prisma";
import { assurerProduitsDesDossiers, ligneDeBilan } from "../src/lib/products/canonique";

async function main() {
  const avant = await prisma.regulatoryProduct.count({ where: { productId: null, isLocked: false } });
  const bilan = await assurerProduitsDesDossiers();
  console.info(`[PRODUITS 360] ${avant} dossier(s) sans produit avant.`);
  console.info(ligneDeBilan(bilan));
  for (const p of bilan.produitsPartages) console.info(`  PARTAGÉ ${p.code} (${p.nom}) : ${p.dossiers.join(", ")}`);
  console.info(`  sans produit après : ${await prisma.regulatoryProduct.count({ where: { productId: null, isLocked: false } })}`);
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
