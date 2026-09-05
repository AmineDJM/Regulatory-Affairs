import { test, expect, type Page } from "@playwright/test";
import { E2E } from "./global-setup";
import { MESURE_DEBORDEMENTS, ERREURS, type Overflow } from "./measure";

/**
 * RIEN NE DÉPASSE, RIEN NE CASSE — la version DURABLE de l'audit UI.
 *
 * ── CE QUE C'EST ────────────────────────────────────────────────────────────────────────────
 *
 * Le crawler `scripts/ui-audit/run.ts` a visité toutes les routes dans Chromium à 375 px et à
 * 1440 px, et a mesuré ce qui sortait de l'écran. Ce qu'il a trouvé a été corrigé — et sans
 * cette spec, tout reviendrait au prochain écran : une grille sans colonne de base, une barre
 * d'outils sans retour à la ligne, un nombre de vingt-quatre pixels dans une carte de cent
 * soixante. Ici, un écran REPRÉSENTATIF de chaque module est rendu aux deux largeurs, et la
 * suite tombe si un élément visible dépasse, si la page affiche un texte d'erreur, ou si le
 * document répond 5xx.
 *
 * ── CE QU'ELLE NE PROMET PAS ────────────────────────────────────────────────────────────────
 *
 * Elle ne remplace pas le crawler : trente écrans, pas cent quarante, et le compte seedé est
 * DIRECTION — pas Super Admin. Le crawler reste l'outil de l'audit complet ; la spec est le
 * cliquet qui empêche de perdre ce qu'il a fait gagner.
 */

/** Un écran par module — ceux qui ont débordé, et ceux qui portent le plus de trafic. */
const ROUTES = [
  "/mon-espace", "/mon-dossier", "/mon-equipe", "/notifications", "/search",
  "/validations", "/validations/paiements", "/centre-de-paiement",
  "/finances/paiements-a-faire", "/finances/comptabilite", "/budgets", "/moyens-generaux",
  "/rh", "/rh/conges", "/formations", "/recrutement",
  "/regulatory", "/regulatory/pipeline", "/regulatory/enregistrement/corpus",
  "/legal", "/courriers", "/dossiers", "/drive", "/calendar",
  "/medical/ma-journee", "/medical/annuaire", "/information-medicale", "/promo-material",
  "/planning", "/planning/affectations", "/pch", "/events", "/sponsoring",
  "/admin", "/admin/access", "/admin/ai", "/admin/connaissance", "/admin/diagnostic",
  "/process-intelligence", "/adventum-brain",
] as const;

const VIEWPORTS = [
  { name: "mobile", width: 375, height: 812 },
  { name: "desktop", width: 1440, height: 900 },
] as const;

async function connecter(page: Page): Promise<void> {
  await page.goto("/login");
  await page.fill('input[name="email"]', E2E.email);
  await page.fill('input[name="password"]', E2E.password);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20_000 });
}

test.describe("audit UI — aucun écran ne déborde, aucun n'affiche d'erreur", () => {
  for (const vp of VIEWPORTS) {
    test(`${vp.name} (${vp.width} px) : ${ROUTES.length} écrans`, async ({ browser }) => {
      test.setTimeout(240_000);
      const ctx = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        isMobile: vp.name === "mobile", hasTouch: vp.name === "mobile", locale: "fr-FR",
      });
      const page = await ctx.newPage();
      const exceptions: string[] = [];
      page.on("pageerror", (e) => exceptions.push(e.message.slice(0, 160)));
      await connecter(page);

      const fautes: string[] = [];
      for (const route of ROUTES) {
        const resp = await page.goto(route, { waitUntil: "load" });
        await page.waitForTimeout(600);
        const status = resp?.status() ?? 0;
        // Une redirection vers un autre écran (module masqué, droit manquant) n'est pas une
        // faute : on mesure ce qui s'est AFFICHÉ, et l'on note où l'on est arrivé.
        const arrivee = new URL(page.url()).pathname;
        if (status >= 500) fautes.push(`${route} → ${status}`);
        const texte = await page.evaluate(() => document.body?.innerText?.slice(0, 4000) ?? "");
        const erreur = ERREURS.find((re) => re.test(texte));
        if (erreur) fautes.push(`${route} (${arrivee}) affiche « ${erreur.source} »`);
        const deb = (await page.evaluate(MESURE_DEBORDEMENTS)) as Overflow[];
        for (const o of deb) {
          fautes.push(`${route} (${arrivee}) : <${o.tag}> déborde (droite ${o.right} px pour ${vp.width}) — ${o.cls.slice(0, 60)} — « ${o.text.slice(0, 40)} »`);
        }
      }
      await ctx.close();

      expect(exceptions, `Exceptions non rattrapées :\n${exceptions.join("\n")}`).toEqual([]);
      expect(fautes, `Écrans en défaut (${vp.name}) :\n${fautes.join("\n")}`).toEqual([]);
    });
  }

  test("une adresse inconnue rend la page « introuvable » de l'application, en 404", async ({ page }) => {
    await connecter(page);
    const resp = await page.goto(`/cette-page-n-existe-pas-${Date.now()}`);
    expect(resp?.status()).toBe(404);
    await expect(page.getByText("Page introuvable")).toBeVisible();
    // Jamais la page anglaise de Next : c'est elle qu'on remplace.
    await expect(page.getByText(/This page could not be found/)).toHaveCount(0);
  });
});
