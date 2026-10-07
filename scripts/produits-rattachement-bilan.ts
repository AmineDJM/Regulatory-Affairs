/**
 * PRODUITS 360 — LE RATTACHEMENT DES DOSSIERS AU CATALOGUE, en ligne de commande (Direction, 07/10 : « Produit =
 * dossier réglementaire »).
 *
 * Le même geste que le bouton « Rattacher tout l'existant » du Super Admin (Regulatory › Rattachement au catalogue),
 * pour un déploiement : `rattacherTout` (`products/canonique.ts`), idempotent — rejoué, il ne fait que ce qui reste.
 * Par défaut il SIMULE et affiche le bilan ; `--appliquer` écrit. Un dossier à l'identité incomplète n'est JAMAIS
 * rattaché au jugé : il est listé avec ce qui lui manque.
 *
 *   npx tsx scripts/produits-rattachement-bilan.ts            # bilan, rien n'est écrit
 *   npx tsx scripts/produits-rattachement-bilan.ts --appliquer
 */
import { prisma } from "../src/lib/prisma";
import { rattacherTout } from "../src/lib/products/canonique";
import { phraseManques } from "../src/lib/products/identity";

async function main() {
  const appliquer = process.argv.includes("--appliquer");
  const sansProduit = await prisma.regulatoryProduct.count({ where: { productId: null } });
  const bilan = await rattacherTout({ appliquer });
  const d = bilan.dossiers;
  console.info(`[PRODUITS 360] ${appliquer ? "APPLIQUÉ" : "SIMULATION"} — ${d.total} dossier(s), ${sansProduit} sans produit avant.`);
  console.info(`  déjà rattachés ${d.deja} · rejoignent un produit ${d.rattaches} · créent leur produit ${d.crees} · corrigés ${d.corriges}`);
  console.info(`  profils BU/BD qui suivent ${bilan.profilsSuivis} · clés remises à jour ${bilan.clesMisesAJour} · conflits ${bilan.conflits.length}`);
  for (const i of d.incomplets) console.info(`  À COMPLÉTER ${i.reference} (${i.dci}) : il manque ${phraseManques(i.manques)}`);
  for (const c of bilan.conflits) console.info(`  DOUBLON ${c.cle} : ${c.produits.map((p) => p.code).join(", ")}`);
  if (appliquer) console.info(`  sans produit après : ${await prisma.regulatoryProduct.count({ where: { productId: null } })}`);
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
