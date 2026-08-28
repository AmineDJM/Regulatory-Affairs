/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LES SABOTAGES DU LIVE OFFICE (§95) — casser exprès, et vérifier qu'un test hurle.
 *
 * ── POURQUOI CE SCRIPT EXISTE ───────────────────────────────────────────────────────────
 *
 * Une suite verte ne prouve rien tant qu'on n'a pas vu ce qu'elle attrape. Un test qui vérifie
 * « le titre est centré » alors que la fonction ne fait rien passe tout de même si l'assertion
 * regarde ailleurs. Le seul moyen de le savoir est d'INTRODUIRE le défaut et de regarder si la
 * suite tombe.
 *
 * Chaque sabotage ci-dessous est un défaut PLAUSIBLE — pas une absurdité. Ce sont ceux qu'un
 * développeur pressé introduit vraiment :
 *
 *   1. l'oubli du −1 sur un numéro de page ;
 *   2. la suppression de pages en ordre croissant ;
 *   3. l'annulation qui ne rejoue pas ;
 *   4. la police qui n'est plus écrite ;
 *   5. la sauvegarde qui n'écrit pas de version ;
 *   6. un identifiant de session régénéré à chaque tour ;
 *   7. l'idempotence vérifiée APRÈS application (le vrai défaut trouvé en construisant).
 *
 * ── COMMENT LE LIRE ─────────────────────────────────────────────────────────────────────
 *
 *   npx tsx scripts/bench/office-sabotage.ts
 *
 * Le script modifie un fichier, lance les tests visés, RESTAURE le fichier, et dit si la suite
 * a bien échoué. Un sabotage qui passe est un TROU dans les tests, et le script sort en erreur.
 * La restauration passe par `git checkout` du seul fichier touché : elle a lieu même en cas
 * d'interruption, parce qu'elle est dans un `finally`.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

interface Sabotage {
  nom: string;
  /** Ce qu'on prétend casser, en une phrase — c'est ce qui se lit dans le rapport. */
  defaut: string;
  fichier: string;
  cherche: string;
  remplace: string;
  /** Les fichiers de test qui DOIVENT tomber. */
  tests: string[];
}

const SABOTAGES: Sabotage[] = [
  {
    nom: "PDF — décalage d'un rang",
    defaut: "on oublie le −1 : « supprime la page 12 » supprime la 13",
    fichier: "src/lib/artifact/adapters/pdf/adapter.ts",
    cherche: "for (const p of [...demandees].sort((a, b) => b - a)) this.doc.deletePage(p - 1);",
    remplace: "for (const p of [...demandees].sort((a, b) => b - a)) this.doc.deletePage(p);",
    tests: ["src/lib/artifact/object-model/numbering.test.ts"],
  },
  {
    nom: "PDF — suppression en ordre croissant",
    defaut: "supprimer la 12 avant la 14 décale la 14 vers la 13 : on efface la 15",
    fichier: "src/lib/artifact/adapters/pdf/adapter.ts",
    cherche: "for (const p of [...demandees].sort((a, b) => b - a)) this.doc.deletePage(p - 1);",
    remplace: "for (const p of [...demandees].sort((a, b) => a - b)) this.doc.deletePage(p - 1);",
    tests: ["src/lib/artifact/object-model/numbering.test.ts"],
  },
  {
    nom: "Annulation — la révision n'avance plus, donc le cache resservi",
    defaut: "« annule » marque l'opération mais l'écran garde l'état d'avant : rien ne bouge",
    fichier: "src/lib/artifact/runtime/engine.ts",
    cherche: "  const revision = session.revision + 1;\n  oublierSession(session.id);",
    remplace: "  const revision = session.revision;\n  void oublierSession;",
    tests: ["src/lib/artifact/runtime/engine.test.ts"],
  },
  {
    nom: "Word — la police n'est plus écrite",
    defaut: "« mets-le en Aptos » ne change rien, et Adam répond que c'est fait",
    fichier: "src/lib/artifact/adapters/docx/adapter.ts",
    cherche: '    for (const a of ["w:ascii", "w:hAnsi", "w:cs", "w:eastAsia"]) setAttr(f, a, c.police);',
    remplace: "    void f;",
    tests: ["src/lib/artifact/runtime/engine.test.ts", "src/lib/artifact/adapters/fidelity.test.ts"],
  },
  {
    nom: "Sauvegarde — aucune version n'est écrite au Drive",
    defaut: "« sauvegarde » répond « enregistré » sans rien écrire",
    fichier: "src/lib/artifact/runtime/engine.ts",
    cherche: "    const ecrite = await ctx.ports.documents.ecrireVersion(ctx.acteur.id, session.nodeId, octets, {",
    remplace: "    const ecrite = { version: 2, taille: 0 } as never as Awaited<ReturnType<typeof ctx.ports.documents.ecrireVersion>>;\n    const _inutilise = await Promise.resolve({\n      _: (session.nodeId, octets) && ({",
    tests: ["src/lib/artifact/runtime/engine.test.ts"],
  },
  {
    nom: "Session — un identifiant neuf à chaque ouverture",
    defaut: "« centre le titre » après « affiche-moi le contrat » ouvre un SECOND document",
    fichier: "src/lib/artifact/runtime/engine.ts",
    cherche: "  const dejaOuverte = await ctx.magasin.ouverte(ctx.acteur.id, nodeId);\n  const session = dejaOuverte ?? await ctx.magasin.creer({",
    remplace: "  const dejaOuverte = null as Awaited<ReturnType<typeof ctx.magasin.ouverte>>;\n  const session = dejaOuverte ?? await ctx.magasin.creer({",
    tests: ["src/lib/artifact/runtime/engine.test.ts"],
  },
  {
    nom: "Idempotence — vérifiée APRÈS application",
    defaut: "un double clic supprime le 2ᵉ paragraphe PUIS le 3ᵉ, en répondant « déjà fait »",
    fichier: "src/lib/artifact/runtime/engine.ts",
    cherche: "    if (clesConnues.has(cle)) {",
    remplace: "    if (false && clesConnues.has(cle)) {",
    tests: ["src/lib/artifact/runtime/engine.test.ts"],
  },
  {
    nom: "Excel — le style est modifié sur place au lieu d'être dérivé",
    defaut: "mettre UNE cellule en gras met en gras les 200 qui partageaient son style",
    fichier: "src/lib/artifact/adapters/xlsx/adapter.ts",
    cherche: "    const signature = serializeXml(copie);\n    const deja = xfs.findIndex((x) => serializeXml(x) === signature);\n    if (deja >= 0) return deja;",
    remplace: "    const signature = serializeXml(copie);\n    void signature;\n    if (source) { source.attrs = new Map(copie.attrs); source.children = copie.children; markDirty(source); return idx; }",
    tests: ["src/lib/artifact/adapters/fidelity.test.ts"],
  },
  {
    nom: "Word — l'arbre XML est toujours reconstruit",
    defaut: "on perd la tranche de source : styles, en-têtes et images ne survivent plus",
    fichier: "src/lib/artifact/object-model/xml.ts",
    cherche: "export function serializeXml(node: XmlNode): string {\n  if (node.raw !== null) return node.raw;",
    remplace: "export function serializeXml(node: XmlNode): string {\n  if (node.raw !== null && node.type !== \"element\") return node.raw;",
    tests: ["src/lib/artifact/adapters/fidelity.test.ts"],
  },
];

function testsPassent(fichiers: string[]): boolean {
  try {
    execFileSync("npx", ["vitest", "run", ...fichiers], {
      stdio: "pipe",
      env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/amd_internal_os?schema=public" },
    });
    return true;
  } catch {
    return false;
  }
}

function main(): void {
  console.log("SABOTAGES DU LIVE OFFICE — chaque défaut DOIT faire tomber la suite (§95)\n");
  const trous: string[] = [];
  let n = 0;

  for (const s of SABOTAGES) {
    n += 1;
    const avant = readFileSync(s.fichier, "utf8");
    if (!avant.includes(s.cherche)) {
      // Le motif a disparu : le sabotage ne teste plus rien. C'est un TROU, pas un succès —
      // un script de sabotage qui ne sabote rien donnerait une assurance fausse.
      trous.push(`${s.nom} — motif introuvable dans ${s.fichier} (script à remettre à jour)`);
      console.log(`  ${n}. ${s.nom}\n     ⚠ MOTIF INTROUVABLE — le sabotage n'a rien modifié.`);
      continue;
    }
    try {
      writeFileSync(s.fichier, avant.replace(s.cherche, s.remplace));
      const passe = testsPassent(s.tests);
      console.log(`  ${n}. ${s.nom}`);
      console.log(`     défaut : ${s.defaut}`);
      console.log(`     ${passe ? "✗ LA SUITE PASSE — trou de couverture" : "✓ la suite tombe"}`);
      if (passe) trous.push(`${s.nom} : ${s.defaut}`);
    } finally {
      // Restauration inconditionnelle : on écrit le contenu d'origine relu en mémoire, sans
      // dépendre de git — le script doit être sûr même sur un arbre de travail sale.
      writeFileSync(s.fichier, avant);
    }
  }

  console.log(`\n${SABOTAGES.length - trous.length}/${SABOTAGES.length} sabotages attrapés.`);
  if (trous.length) {
    console.log("\nTROUS DE COUVERTURE :");
    for (const t of trous) console.log(`  • ${t}`);
    process.exit(1);
  }
  console.log("Aucun trou : chaque défaut plausible fait tomber au moins un test.");
}

main();
