import { test, expect, type Page } from "@playwright/test";
import { E2E } from "./global-setup";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LES BLOCS RICHES, PHOTOGRAPHIÉS ET VÉRIFIÉS.
 *
 * §37 exige des captures desktop ET mobile de chaque objet ; §66 exige de les REGARDER plutôt
 * que de se contenter d'un test vert. Ce fichier produit les images ; ce qu'elles ont montré
 * est consigné dans le rapport, et les corrections qui en découlent sont dans le code.
 *
 * ── CE QUE LES ASSERTIONS PROUVENT, ET QU'UNE IMAGE NE PROUVE PAS ────────────────────────
 *
 * Une capture montre qu'un écran est joli. Elle ne montre pas qu'un filtre filtre, qu'un pli se
 * déplie, qu'un jalon manquant reste visible quand on cherche autre chose, ni qu'un tableau de
 * comparaison ne déborde pas latéralement sur un téléphone. C'est ce qui est testé ici — le
 * COMPORTEMENT, l'image jugeant le reste.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const VIEWPORTS = [
  { name: "1920", width: 1920, height: 1080 },
  { name: "1440", width: 1440, height: 900 },
  { name: "1024", width: 1024, height: 768 },
  { name: "430", width: 430, height: 932 },
  { name: "390", width: 390, height: 844 },
];

/** Les blocs riches, par le `data-planche` que la planche pose sur chaque section. */
const BLOCS = ["story", "entity360", "comparison", "mission", "alerte", "viz", "dashboard"] as const;

async function login(page: Page) {
  await page.goto("/login");
  await page.fill('input[name="email"]', E2E.email);
  await page.fill('input[name="password"]', E2E.password);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 20_000 });
}

async function ouvrirPlanche(page: Page) {
  await page.goto("/chief-of-staff?apercu=blocs");
  await page.waitForSelector("[data-planche='story']", { timeout: 20_000 });
}

test.describe("GOD MODE — les objets riches", () => {
  test("captures de chaque bloc riche, aux cinq tailles", async ({ page }) => {
    test.slow();
    await login(page);

    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await ouvrirPlanche(page);
      await page.screenshot({ path: `e2e-screenshots/godmode-planche-${vp.name}.png`, fullPage: true });

      // La fenêtre est ALLONGÉE pour les captures d'objet isolé — et seulement pour elles. Un
      // objet plus haut que la fenêtre est rogné, et on perdrait justement l'en-tête qu'on veut
      // juger. Seule la LARGEUR décide de la mise en page (aucune règle en `vh`).
      await page.setViewportSize({ width: vp.width, height: Math.max(vp.height, 3200) });
      for (const kind of BLOCS) {
        const sections = page.locator(`[data-planche='${kind}']`);
        const n = await sections.count();
        for (let i = 0; i < n; i++) {
          await sections.nth(i).screenshot({ path: `e2e-screenshots/godmode-${kind}${n > 1 ? `-${i + 1}` : ""}-${vp.name}.png` });
        }
      }
    }
  });

  test("la story montre son TROU — un jalon manquant reste visible", async ({ page }) => {
    await login(page);
    await page.setViewportSize({ width: 1440, height: 1200 });
    await ouvrirPlanche(page);

    const story = page.locator("[data-planche='story']").first();
    // C'est l'invariant de §46 : ce qui n'a jamais eu lieu s'affiche, sinon la frise raconte une
    // histoire sans son trou — c'est-à-dire la seule partie qui intéressait le lecteur.
    await expect(story.locator("[data-etat='manque']").first()).toBeVisible();
    await expect(story.getByText(/Facture du BC n° 2/)).toBeVisible();
    // Et le retard se VOIT plutôt qu'il ne se lit.
    await expect(story.locator(".chief-story-late").first()).toBeVisible();
  });

  test("le filtre par fil filtre VRAIMENT, et garde les parents", async ({ page }) => {
    await login(page);
    await page.setViewportSize({ width: 1440, height: 1200 });
    await ouvrirPlanche(page);

    const story = page.locator("[data-planche='story']").first();
    const avant = await story.locator("[data-testid='story-event']").count();
    expect(avant).toBeGreaterThan(5);

    await story.getByRole("button", { name: /Lots perdus/ }).click();
    const apres = await story.locator("[data-testid='story-event']").count();
    // Moins d'événements — sinon le filtre est décoratif…
    expect(apres).toBeLessThan(avant);
    // …et le lot perdu, lui, est là — avec son PARENT, qui n'appartient pourtant pas au fil :
    // un lot sans son attribution ne veut rien dire.
    await expect(story.getByText(/Molécule B 40 mg/)).toBeVisible();
    await expect(story.getByText(/Marché attribué/)).toBeVisible();
  });

  test("la recherche dans la story trouve, et le vide se DIT", async ({ page }) => {
    await login(page);
    await page.setViewportSize({ width: 1440, height: 1200 });
    await ouvrirPlanche(page);

    const story = page.locator("[data-planche='story']").first();
    const champ = story.locator("[data-testid='story-search']").first();

    await champ.fill("paiement");
    await expect(story.locator("[data-found='true']").first()).toBeVisible();

    // ZÉRO RÉSULTAT SE DIT EN TOUTES LETTRES. Un « 0 » de la taille d'une pastille laisse
    // croire qu'on a raté le surlignage plutôt qu'à une absence (§54).
    await champ.fill("caution introuvable xyz");
    await expect(story.locator("[data-found='true']")).toHaveCount(0);
    await expect(story.locator(".chief-story-found[data-vide]")).toHaveText("aucun");
  });

  test("la vue 360 est REPLIÉE : deux sections ouvertes au plus", async ({ page }) => {
    await login(page);
    await page.setViewportSize({ width: 1440, height: 1200 });
    await ouvrirPlanche(page);

    const e360 = page.locator("[data-planche='entity360']").first();
    const ouvertes = e360.locator("[data-testid='e360-section'][data-open='true']");
    // C'est toute la différence entre une vue 360 et un tableau de bord : on ne montre pas
    // cinquante indicateurs d'un coup, on montre ce qui sort de l'ordinaire.
    expect(await ouvertes.count()).toBeLessThanOrEqual(2);
    expect(await ouvertes.count()).toBeGreaterThanOrEqual(1);
  });

  test("une section repliée s'ouvre au clic", async ({ page }) => {
    await login(page);
    await page.setViewportSize({ width: 1440, height: 1200 });
    await ouvrirPlanche(page);

    const e360 = page.locator("[data-planche='entity360']").first();
    // La cible est FIGÉE par son libellé avant le clic : un sélecteur sur `data-open='false'`
    // désignerait une AUTRE section une fois la première ouverte, et le test se mentirait.
    const fermee = e360.locator("[data-testid='e360-section']", { hasText: "Marchés PCH" }).first();
    await expect(fermee).toHaveAttribute("data-open", "false");
    await fermee.locator("[data-testid='e360-section-toggle']").click();
    await expect(fermee).toHaveAttribute("data-open", "true");
  });

  test("le TON d'un chiffre est vraiment porté par la couleur", async ({ page }) => {
    await login(page);
    await page.setViewportSize({ width: 1440, height: 1200 });
    await ouvrirPlanche(page);

    // Un KPI marqué « alerte » qui s'affiche en noir ment deux fois : il dit que tout va bien,
    // et il rend le marquage inutile partout ailleurs. On lit donc la couleur CALCULÉE, pas la
    // classe — une règle CSS écrasée par une autre passerait au travers d'un test de classe.
    const kpis = await page.$$eval("[data-planche='entity360'] .chief-e360-kpi", (els) =>
      els.map((e) => ({
        ton: e.getAttribute("data-ton"),
        couleur: getComputedStyle(e.querySelector(".chief-e360-kpi-value")!).color,
      })));
    const parTon = new Map(kpis.map((k) => [k.ton, k.couleur]));
    expect(parTon.get("neutre"), "un KPI neutre doit exister").toBeTruthy();
    for (const ton of ["succes", "attention", "alerte"]) {
      if (!parTon.has(ton)) continue;
      expect(parTon.get(ton), `le ton « ${ton} » n'est pas coloré`).not.toBe(parTon.get("neutre"));
    }
    // Et les tons sémantiques ne se confondent pas entre eux.
    const semantiques = [...parTon.entries()].filter(([t]) => t !== "neutre");
    expect(new Set(semantiques.map(([, c]) => c)).size,
      "deux tons sémantiques rendent la même couleur").toBe(semantiques.length);
  });

  test("aucun code technique n'atteint l'écran du PDG", async ({ page }) => {
    await login(page);
    await page.setViewportSize({ width: 1440, height: 1200 });
    await ouvrirPlanche(page);

    // L'UI est en français. « PAID », « OVERDUE », « WON » sont des valeurs d'énumération de
    // base : les afficher, c'est demander au lecteur de connaître le schéma.
    const e360 = page.locator("[data-planche='entity360']");
    for (let i = 0; i < await e360.count(); i++) {
      const texte = await e360.nth(i).innerText();
      for (const brut of ["PAID", "OVERDUE", "PARTIAL", "UNPAID", "IN_PROGRESS", "NOT_STARTED", "WON", "LOST", "SUBMITTED"]) {
        expect(texte, `« ${brut} » est un code technique, pas un libellé`).not.toContain(brut);
      }
    }
  });

  test("la comparaison ne défile PAS latéralement sur un téléphone", async ({ page }) => {
    await login(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await ouvrirPlanche(page);

    const cmp = page.locator("[data-testid='comparison']").first();
    await expect(cmp).toBeVisible();
    // Une comparaison qu'on fait glisser n'est plus une comparaison : on ne voit jamais les
    // deux colonnes ensemble. Le bloc doit tenir dans la largeur, quitte à changer de forme.
    const debord = await cmp.evaluate((el) => el.scrollWidth - el.clientWidth);
    expect(debord, "la comparaison déborde sur 390 px").toBeLessThanOrEqual(1);
  });

  test("la mission ne demande QU'UNE confirmation", async ({ page }) => {
    await login(page);
    await page.setViewportSize({ width: 1440, height: 1200 });
    await ouvrirPlanche(page);

    const mission = page.locator("[data-testid='mission']").first();
    await expect(mission.locator("[data-testid='mission-step']")).toHaveCount(3);
    const bloc = page.locator("[data-planche='mission']").first();
    await expect(bloc.locator("[data-testid='mission-confirm']")).toHaveCount(1);
  });

  test("la MÊME mission en échec montre une erreur ACTIONNABLE", async ({ page }) => {
    await login(page);
    await page.setViewportSize({ width: 1440, height: 1200 });
    await ouvrirPlanche(page);

    // La seconde planche mission est la même carte, après exécution : elle ne se duplique pas,
    // elle change d'état. On y lit ce qu'il faut FAIRE, pas un code d'erreur.
    const apres = page.locator("[data-planche='mission']").nth(1);
    await expect(apres.locator("[data-etat='echec']")).toHaveCount(1);
    await expect(apres.getByText(/choisir une autre date/)).toBeVisible();
    await expect(apres.locator("[data-testid='mission-confirm']")).toHaveCount(0);
    // §53 : une erreur ACTIONNABLE, pas seulement bien rédigée. Le geste qui répare est SOUS
    // l'erreur — ailleurs, il faudrait d'abord retrouver de quelle étape on parlait.
    const etapeKo = apres.locator("[data-etat='echec']");
    expect(await etapeKo.locator(".chief-action").count(),
      "l'étape en échec n'offre aucune issue").toBeGreaterThan(0);
  });

  test("l'alerte porte toujours une issue", async ({ page }) => {
    await login(page);
    await page.setViewportSize({ width: 1440, height: 1200 });
    await ouvrirPlanche(page);

    const alerte = page.locator("[data-testid='alerte']").first();
    await expect(alerte).toHaveAttribute("role", "status");
    // Une alerte sans action est une inquiétude, pas une information.
    expect(await alerte.locator(".chief-action").count()).toBeGreaterThan(0);
  });

  test("aucun débordement latéral, à aucune des cinq tailles", async ({ page }) => {
    test.slow();
    await login(page);
    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await ouvrirPlanche(page);
      const overflow = await page.evaluate(() =>
        document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `débordement horizontal à ${vp.name} px`).toBeLessThanOrEqual(1);
    }
  });

  test("les blocs riches sont ACCESSIBLES au clavier et aux lecteurs d'écran", async ({ page }) => {
    await login(page);
    await page.setViewportSize({ width: 1440, height: 1200 });
    await ouvrirPlanche(page);

    // Un pli qui s'ouvre doit dire s'il est ouvert : sans `aria-expanded`, un lecteur d'écran
    // annonce un bouton dont on ne sait pas ce qu'il vient de faire.
    const toggle = page.locator("[data-testid='e360-section-toggle']").first();
    await expect(toggle).toHaveAttribute("aria-expanded", /true|false/);

    const story = page.locator("[data-planche='story']").first();
    const jalon = story.locator("[data-testid='story-toggle']").first();
    if (await jalon.count()) await expect(jalon).toHaveAttribute("aria-expanded", /true|false/);
  });
});

test.describe("REPRÉSENTATIONS (§35) — dix-sept formes, un rendu", () => {
  test("la planche rend chaque forme en SVG ou en HTML, le tableau de bord en grille, et rien ne déborde à 390 px", async ({ page }) => {
    await login(page);
    await page.setViewportSize({ width: 1440, height: 1200 });
    await ouvrirPlanche(page);

    const formes = await page.locator("[data-planche='viz'] figure.chief-viz").evaluateAll((els) => els.map((e) => e.getAttribute("data-viz")));
    // Dix-sept formes distinctes, et pas un composant React par forme : un seul attribut les distingue.
    expect(new Set(formes).size).toBeGreaterThanOrEqual(17);
    expect(await page.locator("[data-planche='viz'] svg.chief-viz-svg:visible").count()).toBeGreaterThanOrEqual(12);
    // Une barre porte sa valeur exacte : ce qui se voit se relit.
    await expect(page.locator("[data-planche='viz'] figure[data-viz='barres'] rect title").first()).toHaveText(/Tâches : \d+/);
    // Le tableau de bord : quatre tuiles, chacune un bloc ordinaire.
    const bord = page.locator("[data-planche='dashboard']").first();
    await expect(bord.locator(".chief-tuile")).toHaveCount(4);
    await expect(bord.locator(".chief-tuile .chief-gauge").first()).toBeVisible();

    // 390 px : les séries passent en liste proportionnelle, le SVG large se cache, le document ne déborde pas.
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator("[data-planche='viz'] figure[data-viz='barres'] .chief-viz-mini").first()).toBeVisible();
    await expect(page.locator("[data-planche='viz'] figure[data-viz='barres'] .chief-only-wide svg").first()).toBeHidden();
    const deborde = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(deborde).toBeLessThanOrEqual(0);
  });
});
