import { prisma } from "@/lib/prisma";
import { phraseManques } from "@/lib/products/identity";
import { rattacherTout } from "@/lib/products/canonique";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE RATTACHEMENT DES PRODUITS CANONIQUES, EN LIGNE DE COMMANDE — DÉTERMINISTE, ou rien.
 *
 * Ce script n'a plus sa propre logique (§118.178) : il appelle `rattacherTout`, la fonction même
 * que le geste « Rattacher l'existant » du catalogue produits (Super Admin) déclenche. Deux
 * implémentations du même rattachement auraient fini par rattacher différemment — et celle-ci, qui
 * acceptait une clé calculée sur la seule DCI tout en annonçant « clé complète », aurait été la
 * fausse.
 *
 * Un dossier ne rejoint un produit que sur son identité COMPLÈTE (DCI, dosage, unité, forme,
 * conditionnement) ; ce qui reste incomplet est LISTÉ avec ce qui manque. C'est un travail humain,
 * pas un échec.
 *
 *     npx tsx scripts/backfill/canonical-products.ts           # simulation, n'écrit rien
 *     npx tsx scripts/backfill/canonical-products.ts --apply   # écrit
 *
 * La simulation est le DÉFAUT : un rattachement qui écrit sans qu'on l'ait demandé est une
 * migration de données déguisée en script.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const APPLY = process.argv.includes("--apply");

async function main(): Promise<void> {
  console.log(`\n══ PRODUITS CANONIQUES — ${APPLY ? "ÉCRITURE" : "SIMULATION (rien n'est écrit)"} ══\n`);
  const b = await rattacherTout({ appliquer: APPLY });
  const d = b.dossiers;
  console.log(`  dossiers           ${d.total} · ${d.deja} déjà rattachés · ${d.rattaches} rattachés · ${d.crees} produits créés · ${d.corriges} corrigés`);
  console.log(`  profils BU / BD    ${b.profilsSuivis} suivent leur dossier`);
  console.log(`  clés mises à jour  ${b.clesMisesAJour}`);
  if (b.conflits.length) {
    console.log(`\n  ${b.conflits.length} identité(s) portée(s) par plusieurs produits — doublons à réunir à la main :`);
    for (const c of b.conflits.slice(0, 20)) console.log(`    ${c.produits.map((p) => `${p.code} (${p.canonicalName})`).join(" · ")}`);
  }
  if (d.incomplets.length) {
    console.log(`\n  ${d.incomplets.length} dossier(s) incomplet(s) — à compléter à la main :`);
    for (const x of d.incomplets.slice(0, 30)) console.log(`    ${x.reference} — ${x.dci} : il manque ${phraseManques(x.manques)}`);
    if (d.incomplets.length > 30) console.log(`    … (+${d.incomplets.length - 30})`);
  }
  if (b.promoSansProduit.length) console.log(`\n  ${b.promoSansProduit.length} produit(s) de BU sans dossier — à rattacher dans le rapprochement des catalogues.`);
  if (!APPLY) console.log("\nRien n'a été écrit. Relancer avec --apply pour appliquer.");
  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
