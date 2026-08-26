import { defineConfig, devices } from "@playwright/test";

/**
 * E2E PLAYWRIGHT — parcours RÉELS contre le build de production (`next start` sur `.next`),
 * SANS AUCUN APPEL IA : les specs couvrent l'authentification et le circuit d'invitation de
 * compte (page publique, usage unique) — des flux entièrement déterministes. La logique du
 * Chief (résolution, portes, confirmations) est verrouillée par la suite vitest (goldens) ;
 * l'E2E vérifie que les ÉCRANS tiennent debout de bout en bout.
 *
 * Lancement local : `npm run build && npm run test:e2e` (Postgres local démarré).
 * Le seed (utilisateur + invitations, préfixe __e2e__) est posé par `e2e/global-setup.ts`
 * et nettoyé à la fin — jamais de données simulées persistantes.
 */

const DB_URL = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/amd_internal_os?schema=public";

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
  timeout: 45_000,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3100",
    trace: "retain-on-failure",
  },
  // Chromium PRÉINSTALLÉ de l'environnement (/opt/pw-browsers) : on pointe l'exécutable
  // directement — jamais de `playwright install` (téléchargement bloqué/inutile).
  projects: [{
    name: "chromium",
    use: {
      ...devices["Desktop Chrome"],
      launchOptions: { executablePath: process.env.PW_CHROMIUM ?? "/opt/pw-browsers/chromium" },
    },
  }],
  webServer: {
    command: "npx next start -p 3100",
    url: "http://localhost:3100/login",
    reuseExistingServer: true,
    timeout: 120_000,
    env: {
      DATABASE_URL: DB_URL,
      NEXTAUTH_URL: "http://localhost:3100",
      NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ?? "e2e-secret-local-only",
      // LA PLANCHE DE RENDU, le temps d'une revue. Les blocs de l'espace de travail n'existent
      // qu'au bout d'un vrai tour de conversation — donc d'un appel IA, que cette suite
      // s'interdit. Cette variable ouvre une route de démonstration qui, sans elle, rend 404 :
      // en production, elle n'a pas d'adresse.
      ADAM_BLOCK_PREVIEW: "1",
    },
  },
});
