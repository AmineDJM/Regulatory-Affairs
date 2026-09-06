import { defineConfig, devices } from "@playwright/test";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * PLAYWRIGHT LIVE — Adam dans le VRAI navigateur, avec le VRAI fournisseur de modèles.
 *
 *   source <env du banc>   # DATABASE_URL = base LOCALE du banc (amd_bench), OPENAI_API_KEY
 *   BENCH_SEED_ALLOW=1 npm run adam:bench:seed   # une fois
 *   npm run build && npm run test:e2e:live
 *
 * La suite E2E ordinaire (`playwright.config.ts`) s'interdit tout appel IA : elle vérifie que
 * les écrans tiennent debout. Celle-ci fait l'inverse : elle POSE des questions et des défis à
 * Adam dans l'interface, clique sur ses cartes, et juge chaque tour par TROIS mesures que
 * l'écran ne montre pas — l'effet en base (la tâche existe, le devis est au registre, la règle
 * s'applique au tour suivant), la latence perçue (premier signe, total) et le coût du tour lu
 * dans `ModelCallLog`. Un tour qui « a l'air » réussi mais n'a rien écrit est un échec.
 *
 * Elle ne tourne QUE sur une base locale : le seed du banc n'est jamais semé ailleurs, et un
 * devis émis « pour de vrai » sur une base de production serait une faute.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const DB_URL = process.env.DATABASE_URL ?? "";
if (!/^postgres(ql)?:\/\/[^@/]*@(localhost|127\.0\.0\.1)(:\d+)?\//.test(DB_URL)) {
  throw new Error("Le banc live Playwright ne tourne que sur une base LOCALE (source l'environnement du banc : amd_bench).");
}
// MÊME source que le seed du banc : la clé de chiffrement des blobs Drive en est dérivée.
const SECRET = process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET ?? "local-test-secret-0123456789abcdef0123456789abcdef";

export default defineConfig({
  testDir: "./e2e-live",
  timeout: 240_000,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3101",
    trace: "retain-on-failure",
  },
  projects: [{
    name: "chromium",
    use: {
      ...devices["Desktop Chrome"],
      launchOptions: { executablePath: process.env.PW_CHROMIUM ?? "/opt/pw-browsers/chromium" },
    },
  }],
  webServer: {
    command: "npx next start -p 3101",
    url: "http://localhost:3101/login",
    reuseExistingServer: true,
    timeout: 120_000,
    env: {
      DATABASE_URL: DB_URL,
      NEXTAUTH_URL: "http://localhost:3101",
      NEXTAUTH_SECRET: SECRET,
      AUTH_SECRET: SECRET,
      OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? "",
      // `aiConfigured()` (la porte de l'ÉCRAN : champ de saisie actif ou non) teste la présence
      // d'une clé Anthropic, héritage de la première version d'Adam ; en production elle est
      // posée. Le banc, lui, passe par le mandataire OpenAI. Sans cette ligne, l'interface
      // s'ouvre avec un champ désactivé et « IA non configurée » — mesuré à la première passe.
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ?? "banc-live-cle-presente-mais-non-utilisee",
      NODE_USE_ENV_PROXY: "1",
      TZ: "UTC",
    },
  },
});
