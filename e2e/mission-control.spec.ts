import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { E2E } from "./global-setup";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE CENTRE DE MISSIONS, DE BOUT EN BOUT — écrans réels, base réelle, zéro appel de modèle.
 *
 * ── CE QUE CETTE SPEC PROUVE, ET QU'AUCUN TEST UNITAIRE NE PEUT PROUVER ─────────────────
 *
 * Que les écrans EXISTENT et TIENNENT sur une vraie mission longue. Une vue qui rend le bon
 * objet et un écran qui l'affiche sont deux choses différentes : le lot précédent a livré un
 * `VueMission.horizon` parfaitement testé que RIEN n'affichait — sept jalons calculés, et une
 * page qui montrait « 4/5 étapes » du sous-plan courant.
 *
 * Le décor est posé ici, pas dans le seed global : il est propre à cette spec, il est retiré à
 * la fin, et il porte exactement les cas qui font mentir un tableau de bord —
 *
 *   • un ÉVENTAIL (un modèle, trois filles) : le compte doit dire 3, jamais 1 ;
 *   • une étape CONTOURNÉE par le plan courant : elle ne doit pas gonfler le dénominateur ;
 *   • sept JALONS dont cinq sans sous-plan : l'avancement se lit en jalons ;
 *   • une lecture VIEILLE de trois semaines : le faux succès silencieux (§118.41) ;
 *   • trente lignes de comptabilité de moteur : le journal doit les écarter et le DIRE ;
 *   • un ACCORD en attente : décidable depuis le centre, sans ouvrir la mission.
 *
 * ── UNE PRÉCAUTION D'EXPLOITATION, APPRISE EN LA SUBISSANT ──────────────────────────────
 *
 * Le serveur que Playwright démarre fait tourner l'ORDONNANCEUR de l'ERP contre la MÊME base
 * que la suite unitaire. Lancer `vitest` pendant qu'il vit fait balayer par ce battement des
 * missions que d'autres tests viennent de créer : `attention.test.ts` a compté deux
 * notifications au lieu d'une, pour une mission qu'il croyait à lui seul. Ce n'est pas un
 * défaut du produit — c'est le produit qui fait son travail sur une base partagée. On ne fait
 * donc pas tourner les deux en même temps.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/amd_internal_os?schema=public" } },
});

const MARQUE = "__e2e__ Homologation Nivolex 2027";
const CIBLE = "Deepak";
let missionId = "";

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel(/e-?mail/i).fill(E2E.email);
  await page.getByLabel(/mot de passe/i).fill(E2E.password);
  await page.getByRole("button", { name: /connexion|se connecter/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 20_000 });
}

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  const u = await prisma.user.findUnique({ where: { email: E2E.email }, select: { id: true } });
  if (!u) throw new Error("le seed E2E n'a pas posé son utilisateur");

  const m = await prisma.mission.create({
    data: {
      kind: "RUNTIME", ownerId: u.id, title: MARQUE, status: "WAITING_INPUT",
      objective: "Obtenir l'homologation Nivolex pour 2027",
      goalRaw: "Obtenir l'homologation Nivolex pour 2027", acceptance: [] as never,
      priority: 2, costUsd: 0.4213, modelCalls: 37,
    },
    select: { id: true },
  });
  missionId = m.id;

  // SEPT JALONS — deux franchis, un actif avec son sous-plan, quatre encore de simples
  // intentions. C'est l'état NORMAL d'une mission longue, et l'écran doit le dire.
  const jalons: { ordre: number; statut: string; planVersion: number }[] = [
    { ordre: 1, statut: "DONE", planVersion: 1 },
    { ordre: 2, statut: "DONE", planVersion: 1 },
    { ordre: 3, statut: "ACTIVE", planVersion: 2 },
    { ordre: 4, statut: "PENDING", planVersion: 0 },
    { ordre: 5, statut: "PENDING", planVersion: 0 },
    { ordre: 6, statut: "PENDING", planVersion: 0 },
    { ordre: 7, statut: "PENDING", planVersion: 0 },
  ];
  for (const j of jalons) {
    await prisma.missionMilestone.create({
      data: {
        missionId, ordre: j.ordre, titre: `__e2e__ jalon ${j.ordre}`,
        resultat: `le résultat ${j.ordre} est constatable en base`,
        statut: j.statut, planVersion: j.planVersion,
      },
    });
  }

  // L'ÉVENTAIL : un modèle, trois filles. Le compte doit voir 3 étapes réelles, pas 1.
  await prisma.missionStep.create({
    data: { missionId, key: "demander", title: "Demander les chiffres", nodeType: "CAPABILITY", capability: "send_message", status: "DONE", forEach: { from: "personnes", path: "retenu", as: "p" } as never },
  });
  for (const [i, qui] of ["khaled", "amel", "deepak"].entries()) {
    await prisma.missionStep.create({
      data: { missionId, key: `demander#${qui}`, title: `Demander à ${qui}`, nodeType: "CAPABILITY", capability: "send_message", status: i === 2 ? "FAILED" : "DONE" },
    });
  }
  // L'étape que le plan courant a CONTOURNÉE — elle ne doit pas gonfler le dénominateur.
  await prisma.missionStep.create({
    data: { missionId, key: "vieille", title: "Étape d'un plan précédent", nodeType: "CAPABILITY", capability: "directory_list", status: "PENDING", supersededAt: new Date() },
  });
  // L'étape qui NOMME Deepak — c'est elle que l'aperçu de modification doit trouver.
  await prisma.missionStep.create({
    data: { missionId, key: "relire", title: `Relire la réponse de ${CIBLE}`, nodeType: "WORKER", status: "PENDING", input: { texte: `réponse de ${CIBLE}` } as never },
  });
  // L'ATTENTE HUMAINE, avec de qui et depuis quand.
  await prisma.missionStep.create({
    data: {
      missionId, key: "attente-khaled", title: "Prix de cession Nivolex", nodeType: "WAIT_INPUT",
      status: "WAITING", waitFor: { type: "INPUT", from: "Khaled Mansouri" } as never,
      recovery: { nudges: ["j+2", "j+5"] } as never,
    },
  });
  // L'ACCORD en attente — décidable depuis le centre.
  await prisma.missionApproval.create({
    data: {
      missionId, scope: "envoi", scopeHash: "__e2e__hash",
      summary: "__e2e__ Envoyer le dossier d'homologation à l'ANPP", level: "CRITICAL",
      stepKeys: ["depot"], status: "PENDING",
    },
  });
  // LA LECTURE QUI A DE L'ÂGE : un forecast lu il y a trois semaines (§118.41).
  await prisma.missionInput.create({
    data: {
      missionId, cle: "forecast Nivolex 2027", source: "FINANCE:forecast", empreinte: "__e2e__abc",
      confiance: "TROUVE", retrievedAt: new Date(Date.now() - 21 * 86_400_000),
    },
  });
  // LE BRUIT DU MOTEUR, et la seule ligne qui explique quelque chose.
  for (let i = 0; i < 30; i++) {
    await prisma.missionEvent.create({ data: { missionId, kind: "STATE_CHANGED", summary: "le moteur prend la main" } });
  }
  await prisma.missionEvent.create({
    data: { missionId, kind: "GAP_DECLARED", summary: "__e2e__ aucun modèle de dossier ANPP approuvé" },
  });
  /**
   * UN LIVRABLE CONTRÔLÉ, avec son rapport. Le `qaReport` est ce que la fabrique écrit quand
   * elle OUVRE le fichier produit ; l'écran doit en montrer le contenu et l'avertissement,
   * faute de quoi « vérifié » est un mot que rien ne distingue d'un fichier vide.
   */
  await prisma.missionArtifact.create({
    data: {
      missionId, key: "dossier", title: "__e2e__ Dossier ANPP", format: "DOCX",
      fileName: "__e2e__dossier.docx", byteSize: 4096, status: "VERIFIED", driveNodeId: "node-e2e",
      qaReport: {
        ok: true,
        points: [
          { nom: "livrable", ok: true, detail: "rien qui bloque l'envoi" },
          { nom: "contenu", ok: true, detail: "12 paragraphe(s) non vides, 2 tableau(x), 0 image(s), 4 page(s) — {}" },
        ],
        avertissements: ["__e2e__ la numérotation des articles saute de 1 à 3 (¶7)."],
        nonVerifie: [],
      },
    },
  });
});

test.afterAll(async () => {
  /**
   * ON SUSPEND AVANT DE SUPPRIMER. Le décor est une mission VIVANTE : le battement du serveur
   * peut être en train de la faire avancer au moment du nettoyage, et la supprimer sous ses
   * pieds lui fait écrire au journal d'une mission qui n'existe plus (contrainte de clé
   * étrangère, attrapée et journalée par le moteur). La pause est LUE par `avancer` : elle
   * ferme la fenêtre au lieu de la subir.
   */
  if (missionId) {
    await prisma.mission.update({ where: { id: missionId }, data: { status: "PAUSED" } }).catch(() => {});
    await prisma.mission.delete({ where: { id: missionId } }).catch(() => {});
  }
  await prisma.$disconnect();
});

test("le PARC montre la mission, en jalons, avec ce qui attend une personne en tête", async ({ page }) => {
  await login(page);
  await page.goto("/centre-de-missions");

  const ligne = page.locator("[data-testid='mission-control-row']", { hasText: MARQUE });
  await expect(ligne).toBeVisible({ timeout: 20_000 });

  /**
   * L'AVANCEMENT SE LIT EN JALONS. Si l'écran affichait les étapes, il dirait « 3/5 » — les
   * étapes du sous-plan courant — sur une mission qui a quatre jalons pas même écrits.
   */
  await expect(ligne.locator("[data-testid='mission-control-jalons']")).toContainText("2/7 jalons");
  await expect(ligne.locator("[data-testid='mission-control-etapes']")).toHaveCount(0);

  // Elle attend un élément d'une personne : la ligne le dit, avec depuis quand.
  await expect(ligne).toHaveAttribute("data-attend", "ELEMENT");
  await expect(ligne.locator("[data-testid='mission-control-attente']")).toContainText(/Prix de cession/);

  // La priorité posée s'affiche ; « priorité 0 » sur les autres lignes, non.
  await expect(ligne).toContainText("priorité 2");

  // L'ACCORD est décidable ICI, sans ouvrir la mission — le trou que ce lot ferme.
  const accords = page.locator("[data-testid='centre-accords']");
  await expect(accords).toContainText("__e2e__ Envoyer le dossier d'homologation à l'ANPP");
  await expect(accords).toContainText("décision critique");
  await expect(accords.getByRole("button", { name: /autorise/i }).first()).toBeVisible();
});

test("l'ÉCRAN de la mission montre l'horizon, les attentes, l'âge des lectures et le journal filtré", async ({ page }) => {
  await login(page);
  await page.goto(`/missions/${missionId}`);

  const panneau = page.locator("[data-testid='mission-panel']");
  await expect(panneau).toBeVisible({ timeout: 20_000 });

  // L'HORIZON — sept jalons, et le sous-titre qui compte en jalons.
  const horizon = page.locator("[data-testid='mission-horizon']");
  await expect(horizon).toContainText("2/7 jalons");
  await expect(page.locator("[data-testid='mission-jalon']")).toHaveCount(7);
  /**
   * « 0 étape » sur un jalon non compilé n'est pas un défaut : c'est une INTENTION. L'écran le
   * dit en toutes lettres, sans quoi la personne lit un travail oublié.
   */
  await expect(horizon).toContainText(/n'existe que comme intention/);
  await expect(panneau).toContainText(/jalon 3\/7/);

  // LES ATTENTES — toutes, avec de qui et combien de relances déjà parties.
  const attentes = page.locator("[data-testid='mission-attentes']");
  await expect(attentes).toContainText("Khaled Mansouri");
  await expect(attentes).toContainText("2 relance(s)");

  // LA LECTURE ÂGÉE — le faux succès qui n'a aucune signature d'échec.
  await expect(page.locator("[data-testid='mission-lectures']")).toContainText(/forecast Nivolex 2027/);

  // LES ÉTAPES CONTOURNÉES sont dites, sans compter dans le ratio.
  await expect(page.locator("[data-testid='mission-contournees']")).toContainText("1 étape(s)");

  // LE JOURNAL — la ligne utile visible, le bruit écarté et COMPTÉ.
  await page.locator("[data-testid='mission-journal'] summary").click();
  const journal = page.locator("[data-testid='mission-journal']");
  await expect(journal).toContainText("aucun modèle de dossier ANPP approuvé");
  await expect(journal).toContainText(/30 ligne\(s\) de comptabilité du moteur écartées/);

  // LE COÛT — zéro serait une valeur ; ici c'est 37 appels.
  await expect(page.locator("[data-testid='mission-cout']")).toContainText("37 appel(s)");
});

test("le LIVRABLE dit ce qu'il contient, et son lien OUVRE le document", async ({ page }) => {
  /**
   * ═══════════════════════════════════════════════════════════════════════════════════════════
   * CE QUE CETTE SPEC EXISTE POUR ATTRAPER.
   *
   * L'écran affichait « vérifié » — un mot que rien ne distingue d'un fichier qui s'ouvre et ne
   * contient rien —, et son lien menait à la FICHE du fichier au Drive. Un livrable qu'on ne
   * peut que télécharger n'est pas inspecté : on le range dans un coin et on le croit.
   * ═══════════════════════════════════════════════════════════════════════════════════════════
   */
  await login(page);
  await page.goto(`/missions/${missionId}`);

  const livrable = page.getByTestId("mission-livrable").first();
  await expect(livrable).toBeVisible();

  // CE QU'IL CONTIENT, pas sa taille.
  await expect(livrable.getByTestId("livrable-contenu"))
    .toHaveText("12 paragraphe(s) non vides, 2 tableau(x), 0 image(s), 4 page(s)");
  // L'AVERTISSEMENT est dit sans bloquer.
  await expect(livrable.getByTestId("livrable-avertissement")).toContainText("saute de 1 à 3");

  // ET LE LIEN OUVRE LE DOCUMENT dans le workspace, où l'on VOIT les pages.
  const lien = livrable.getByRole("link");
  await expect(lien).toHaveAttribute("href", "/office/live/node-e2e");
  await expect(lien).toHaveAttribute("data-ouvrable", "1");
});

test("MODIFIER : l'aperçu dit l'empreinte EXACTE avant d'écrire quoi que ce soit", async ({ page }) => {
  await login(page);
  await page.goto(`/missions/${missionId}`);

  await page.locator("[data-testid='mission-modification'] summary").click();
  await page.getByLabel("Cible de la modification").fill(CIBLE);
  await page.getByLabel("Remplaçant").fill("Amel");
  await page.getByRole("button", { name: /Voir l'effet exact/i }).click();

  const apercu = page.locator("[data-testid='mission-modification-apercu']");
  await expect(apercu).toBeVisible({ timeout: 20_000 });
  await expect(apercu).toContainText(/étape\(s\) à refaire/);
  await expect(apercu).toContainText(/préservée\(s\)/);

  /**
   * L'APERÇU N'ÉCRIT RIEN — c'est la propriété qui le rend sûr à appeler autant de fois qu'on
   * reformule sa phrase. On le vérifie EN BASE, pas sur l'écran : un aperçu qui invaliderait en
   * douce serait indiscernable d'un aperçu honnête tant qu'on ne regarde que la page.
   *
   * ── POURQUOI ON NE REGARDE PAS LE STATUT D'UNE ÉTAPE ────────────────────────────────
   *
   * On l'a fait, et c'était une assertion FAUSSE : la mission du décor est VIVANTE, le
   * battement du serveur la fait avancer, et l'étape `relire` passait légitimement de PENDING
   * à FAILED entre les deux lectures. Le banc accusait l'aperçu d'une écriture que le moteur
   * avait faite — et l'aurait faite aussi sans lui. On vérifie donc les marques que SEULE une
   * modification pose, et qu'aucun tour de moteur ne peut produire : la consigne ajoutée à
   * l'objectif, le jalon rouvert (`planVersion` remis à zéro), et l'événement au journal.
   */
  const m = await prisma.mission.findUnique({
    where: { id: missionId }, select: { goalRaw: true, replanBloque: true },
  });
  expect(m?.goalRaw).toBe("Obtenir l'homologation Nivolex pour 2027");

  const jalon3 = await prisma.missionMilestone.findFirst({
    where: { missionId, ordre: 3 }, select: { planVersion: true, statut: true },
  });
  expect(jalon3?.planVersion, "un jalon a été rouvert par un simple APERÇU").toBe(2);

  const modifs = await prisma.missionEvent.count({
    where: { missionId, kind: { in: ["MISSION_MODIFIED", "MODIFICATION_REFUSEE"] } },
  });
  expect(modifs, "l'aperçu a écrit au journal ce que seule une modification écrit").toBe(0);
});

test("sur un TÉLÉPHONE, rien ne déborde", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const page = await ctx.newPage();
  await login(page);
  await page.goto("/centre-de-missions");
  await expect(page.locator("[data-testid='mission-control-row']").first()).toBeVisible({ timeout: 20_000 });

  const deborde = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(deborde, "le centre de missions déborde horizontalement sur 375 px").toBeLessThanOrEqual(1);
  await ctx.close();
});
