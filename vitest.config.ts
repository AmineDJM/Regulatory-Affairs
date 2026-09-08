import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // next-auth est laissé à Node en tant que dépendance externe, et Node échoue à résoudre son
    // `import "next/server"` — ce qui faisait ÉCHOUER LE CHARGEMENT de suites entières : leurs
    // tests ne s'exécutaient pas du tout, sans que le total en rende compte. Traité par Vite,
    // l'import est résolu normalement.
    server: { deps: { inline: [/next-auth/, /@auth\//] } },
    /**
     * ═════════════════════════════════════════════════════════════════════════════════════
     * LES PLAFONDS DE TEMPS SONT CEUX D'UNE SUITE QUI PARLE À POSTGRES, pas ceux de Vitest.
     *
     * Les défauts (5 s par test, 10 s par hook) ont été choisis pour des tests purs. Ici, 685
     * fichiers tournent en parallèle et beaucoup sèment une vingtaine de lignes en base avant
     * de commencer. Mesuré : un test à 1,5 s tout seul dépasse 5 s sous la charge complète, et
     * un `beforeAll` de semis dépasse 10 s — la suite passe au rouge sans qu'aucune assertion
     * n'ait échoué. Un rouge qui ne veut rien dire est pire qu'un vert lent : il apprend à ne
     * plus lire le rouge, et le jour où une vraie régression tombe, elle ressemble à celui-là.
     *
     * Le contre-argument est réel — un plafond généreux laisse un blocage durer plus longtemps
     * avant d'être vu. D'où le facteur : le test le plus lent de la suite fait environ 2 s, on
     * garde un ordre de grandeur au-dessus. Rien n'est masqué : un test qui ne rend jamais la
     * main échoue toujours, un peu plus tard.
     * ═════════════════════════════════════════════════════════════════════════════════════
     */
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});
