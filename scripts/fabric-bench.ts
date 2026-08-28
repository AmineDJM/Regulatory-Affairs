/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * BANC DE LATENCE DE LA FABRIC — mesuré, jamais estimé.
 *
 *   npm run fabric:bench            (5 000 documents synthétiques)
 *   FABRIC_BENCH_N=20000 npm run fabric:bench
 *
 * ── CE QU'IL MESURE, ET COMMENT IL RESTE HONNÊTE ─────────────────────────────────────────
 *
 * Trois voies, sur le MÊME corpus, dans la MÊME base :
 *
 *   AVANT      le `contains` historique avec les index DÉSACTIVÉS pour la session
 *              (enable_indexscan/bitmapscan off) — c'est EXACTEMENT ce que la production
 *              payait avant la migration `fabric_content_indexes` : un scan séquentiel.
 *   LIKE+trgm  le même `contains`, servi par l'index trigramme — ce que paient les appelants
 *              non migrés.
 *   FTS        la voie principale de `fabric/text-search.ts` — mots, classement, préfixes.
 *
 * Le corpus est SYNTHÉTIQUE et ÉTIQUETÉ (`__fabbench`) : créé au début, supprimé à la fin,
 * jamais mêlé aux données réelles. Les chiffres dépendent de la machine — le banc imprime la
 * taille du corpus et ne compare que des voies mesurées DANS LE MÊME RUN. Ce qu'il ne mesure
 * pas, il le dit : ni le réseau applicatif, ni l'ACL nœud par nœud (identique sur les trois
 * voies, donc hors comparaison).
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

async function main(): Promise<void> {
  const { prisma } = await import("@/lib/prisma");
  const { chercherContenu } = await import("@/lib/fabric/text-search");

  const N = Math.max(500, Math.min(Number(process.env.FABRIC_BENCH_N) || 5000, 100_000));
  const TAG = "__fabbench";
  const ITERS = 30;

  /**
   * ── LA SÉLECTIVITÉ DU CORPUS EST CONTRÔLÉE, ET C'EST LE POINT ─────────────────────────
   *
   * La première version de ce banc tirait chaque document d'un vocabulaire de 22 mots :
   * presque TOUT correspondait à TOUT, et le « scan séquentiel » d'avant paraissait rapide —
   * il s'arrêtait après 15 lignes en descendant l'index de récence, puisque la 15e
   * correspondance arrivait tout de suite. Un banc à sélectivité irréaliste ne mesure pas la
   * production : en production, la douleur vient des requêtes RARES (le scan lit tout pour
   * trouver trois lignes) et des mots FRÉQUENTS (le rang se calcule sur des milliers).
   *
   * Ici : un vocabulaire de bourrage large (dérivé de l'indice, ~4 000 formes), des termes
   * RARES plantés dans ~2 % des documents, un terme FRÉQUENT (« contrat ») dans ~50 %.
   */
  const RARES = ["pembrolizumab", "tenofovir", "zorbamyxine", "nivolumab"];
  const phrase = (i: number): string => {
    const bourrage = Array.from({ length: 60 }, (_, k) => `mot${(i * 31 + k * 17) % 4000}`).join(" ");
    const rare = i % 50 === 0 ? ` ${RARES[Math.floor(i / 50) % RARES.length]} oncologie` : "";
    const frequent = i % 2 === 0 ? " contrat du laboratoire partenaire" : " note interne de suivi";
    return `document ${i} reference ref-${i}-x${frequent}${rare} ${bourrage}`;
  };

  console.log(`\n── Corpus synthétique : ${N} documents (étiquette ${TAG}) ──`);
  await prisma.driveTextIndex.deleteMany({ where: { node: { name: { startsWith: TAG } } } });
  await prisma.driveNode.deleteMany({ where: { name: { startsWith: TAG } } });

  const t0 = Date.now();
  for (let lot = 0; lot < N; lot += 500) {
    const taille = Math.min(500, N - lot);
    const noeuds = await prisma.$transaction(
      Array.from({ length: taille }, (_, k) =>
        prisma.driveNode.create({ data: { name: `${TAG}-${lot + k}.pdf`, type: "FILE" }, select: { id: true } })),
    );
    await prisma.driveTextIndex.createMany({
      data: noeuds.map((n, k) => {
        const texte = phrase(lot + k);
        return { nodeId: n.id, versionId: "bench", text: texte, textFold: texte, docKind: (lot + k) % 3 === 0 ? "facture" : "rapport" };
      }),
    });
  }
  console.log(`   semé en ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  await prisma.$executeRawUnsafe(`ANALYZE "DriveTextIndex"`);

  const REQUETES: string[][] = [
    ["pembrolizumab"],          // RARE (~0,5 %) — là où le scan d'avant lisait tout pour rien
    ["pembro"],                 // préfixe d'un mot rare
    ["contrat", "laboratoire"], // FRÉQUENT (~50 %) — là où le classement doit rester borné
    ["zorbamyxine", "oncologie"], // conjonction rare
  ];

  const pct = (xs: number[], p: number): number => {
    const s = [...xs].sort((a, b) => a - b);
    return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
  };

  async function mesurer(nom: string, f: (tokens: string[]) => Promise<unknown>): Promise<void> {
    const lignes: string[] = [];
    for (const tokens of REQUETES) {
      const durees: number[] = [];
      for (let i = 0; i < ITERS; i++) {
        const d = Date.now();
        await f(tokens);
        durees.push(Date.now() - d);
      }
      lignes.push(`     ${tokens.join("+").padEnd(34)} P50 ${String(pct(durees, 50)).padStart(5)} ms   P95 ${String(pct(durees, 95)).padStart(5)} ms`);
    }
    console.log(`\n   ${nom}`);
    for (const l of lignes) console.log(l);
  }

  // ── AVANT : le contains historique, index coupés = l'état pré-F2, à l'identique. ────────
  await mesurer("AVANT — contains, scan séquentiel (état pré-migration)", async (tokens) => {
    return prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe("SET LOCAL enable_indexscan = off");
      await tx.$executeRawUnsafe("SET LOCAL enable_bitmapscan = off");
      const clauses = tokens.map((_, i) => `"textFold" LIKE $${i + 1}`).join(" AND ");
      return tx.$queryRawUnsafe(
        `SELECT "nodeId" FROM "DriveTextIndex" WHERE (${clauses}) ORDER BY "updatedAt" DESC LIMIT 15`,
        ...tokens.map((x) => `%${x}%`),
      );
    });
  });

  // ── LIKE + trigramme : le même contains, servi par l'index — les appelants non migrés. ──
  await mesurer("LIKE + index trigramme (appelants non migrés)", async (tokens) => {
    const clauses = tokens.map((_, i) => `"textFold" LIKE $${i + 1}`).join(" AND ");
    return prisma.$queryRawUnsafe(
      `SELECT "nodeId" FROM "DriveTextIndex" WHERE (${clauses}) ORDER BY "updatedAt" DESC LIMIT 15`,
      ...tokens.map((x) => `%${x}%`),
    );
  });

  // ── FTS : la voie principale de la fabric, telle que `find_documents` l'appelle. ────────
  await mesurer("FTS — fabric/text-search (voie principale)", (tokens) =>
    chercherContenu("drive", tokens, { limit: 15 }));

  console.log(`\n── Nettoyage ──`);
  await prisma.driveTextIndex.deleteMany({ where: { node: { name: { startsWith: TAG } } } });
  await prisma.driveNode.deleteMany({ where: { name: { startsWith: TAG } } });
  console.log("   corpus synthétique supprimé.\n");
  console.log("Non mesuré ici (et dit) : réseau applicatif, ACL nœud par nœud (identique sur");
  console.log("les trois voies), extraction/OCR (payés à l'ingestion, pas à la question).\n");
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });

// Portée de MODULE : sans import statique, ce script partagerait la portée globale de
// smoke-provider.ts et leurs `main` se percuteraient au typecheck.
export {};
