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
  },
});
