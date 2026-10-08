import { test, expect, type Page, type Locator } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { E2E } from "./global-setup";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * L'ANNUAIRE DES ÉTABLISSEMENTS DANS LE NAVIGATEUR (§118.172) — écrans réels, base réelle, aucun
 * appel de modèle de son fait.
 *
 * Demande de la Direction (01/10) : « répare le bouton pour rendre actif un établissement, teste
 * bien l'affichage de cet annuaire » ; chaque établissement a ses SERVICES ; les secteurs ne se
 * saisissent plus dans l'annuaire, chaque BU découpe le sien (établissements + un, certains ou tous
 * leurs services) ; les feuilles des médecins et des pharmaciens se RATTACHENT à l'annuaire pour
 * l'établissement et le service. « Fais pas mal de tests pour identifier des bugs, des
 * disparitions, des boutons qui ne marchent pas. »
 *
 * Le banc de flux prouve la RÈGLE par les vraies actions ; celui-ci prouve que chaque geste a un
 * ÉCRAN qui le déclenche (§118.50), et chaque assertion relit la BASE — un écran qui affiche
 * « Inactif » sur une ligne restée active serait le faux succès que ce lot répare. Le délégué n'a
 * pas de vue globale : c'est sa portée qui est en jeu sur la feuille (§118.104).
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/amd_internal_os?schema=public" } },
});

const P = "__e2e__etab";
const DIR_EMAIL = `${P}-dir@test.dz`;
const KAM_EMAIL = `${P}-kam@test.dz`;
const CHU = `${P} CHU Bab El Oued`;
const EPH = `${P} EPH Kouba`;
const BU = `${P} BU Onco`;
const DR_RATTACHE = `${P}RATTACHE`;
const DR_LOT = `${P}LOT`;
const DR_INCONNU = `${P}INCONNU`;
const DR_SANS = `${P}SANS`;

let chuId = "", ephId = "", kamId = "", buId = "", urgencesId = "";

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel(/e-?mail/i).fill(email);
  await page.getByLabel(/mot de passe/i).fill(E2E.password);
  await page.getByRole("button", { name: /connexion|se connecter/i }).click();
  // 60 s : la toute première connexion après un build propre est lente (§118.124b).
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 60_000 });
}

/** Naviguer PUIS attendre l'hydratation : un clic posé avant ne fait rien (§118.168). */
async function aller(page: Page, url: string) {
  await page.goto(url);
  await page.waitForLoadState("networkidle");
}

async function sansDebordement(page: Page) {
  const { scroll, largeur } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, largeur: window.innerWidth }));
  expect(scroll, `la page déborde de ${scroll - largeur} px à ${largeur} px de large`).toBeLessThanOrEqual(largeur + 1);
}

/**
 * LE RAFRAÎCHISSEMENT RALENTI (§118.172) — la seule façon de JOUER la course qu'un réseau lent
 * fabrique. Après un enregistrement, l'écran redemande ses données (`router.refresh()`, une requête
 * portant l'en-tête `RSC: 1`) ; tant qu'elles ne sont pas arrivées, il montre l'état d'AVANT. Sur
 * le poste du banc, ce délai tient en quelques millisecondes et la course ne se voit qu'au hasard —
 * elle est tombée UNE fois, sur la case « actif ». Ici la réponse est retenue : la base est déjà
 * écrite, seul l'écran attend, exactement comme au téléphone. Les préchargements de liens
 * (`Next-Router-Prefetch`) passent sans attendre : ce ne sont pas des rafraîchissements.
 */
async function ralentirRafraichissements(page: Page, ms = 2_000) {
  await page.route("**/*", async (route) => {
    const req = route.request();
    const h = req.headers();
    if (req.method() === "GET" && h["rsc"] === "1" && !h["next-router-prefetch"]) {
      const reponse = await route.fetch();
      await new Promise((r) => setTimeout(r, ms));
      await route.fulfill({ response: reponse });
      return;
    }
    await route.continue();
  });
}

/**
 * UN RAFRAÎCHISSEMENT RETENU SURVIT À SON CAS. Le dernier enregistrement d'un cas lance un
 * rafraîchissement que la retenue garde deux secondes ; le cas finit avant, la page se ferme, et la
 * retenue échouait APRÈS coup — Playwright imputait cette erreur au cas SUIVANT, qui tombait sans
 * avoir rien fait de faux. Mesuré au premier passage complet : « les SERVICES » rouge sur
 * « route.fetch: Test ended », lancé par la retenue du cas d'avant. La retenue est retirée à la fin
 * de chaque cas, et ce qu'elle avait encore en main est abandonné sans erreur.
 */
test.afterEach(async ({ page }) => {
  await page.unrouteAll({ behavior: "ignoreErrors" });
});

/**
 * LE PREMIER CLIC NE DOIT RIEN DÉPLACER NI RECOUVRIR (§118.172). Ce qui apparaît au premier clic
 * d'un double-clic — la barre de sélection, un message — a volé le second clic DEUX fois, par deux
 * côtés : posé au-dessus du tableau, il le POUSSAIT (le second clic ouvrait la ligne du dessus) ;
 * collé au bas de l'écran, il RECOUVRAIT la ligne visée (le second clic tombait sur la barre, et
 * « le service d'une ligne sans établissement » ne disait plus rien). Le juge ne regarde donc pas
 * un symptôme mais les deux faits qui le causent : la cellule visée n'a pas bougé, et le point
 * visé est toujours le sien.
 *
 * ── IL REGARDE À DIX HAUTEURS, PAS À UNE ────────────────────────────────────────────────────────
 *
 * Sa première version amenait la cellule tout en BAS de l'écran et ne regardait que là. Rejouée
 * contre la barre collée, elle est restée VERTE, et une sonde de géométrie a dit pourquoi : une
 * barre `sticky` se tient dans la boîte de REMPLISSAGE de la zone qui défile, donc elle s'arrête
 * à 32 px (la marge basse de `main`) + 8 px du bord. Les 40 derniers pixels sont le seul endroit
 * de l'écran qu'elle ne recouvre JAMAIS — et c'est exactement là que le juge regardait : la cellule
 * du délégué, haute de 35 px, y tenait entière ; le centre d'une ligne d'établissement, haute de
 * 75 px, passait 2,5 px sous la barre. Le défaut n'est tombé que par un AUTRE cas, sur un symptôme.
 *
 * Il fait donc remonter la cellule de 30 px en 30 px, du bas de l'écran jusqu'à 300 px au-dessus —
 * une barre de 44 px ne peut pas se loger entre deux mesures —, en changeant la HAUTEUR de
 * l'écran, page tout en haut : défiler ne le permet pas toujours (une cellule proche du haut de la
 * page ne descend jamais au bas de l'écran), et page en haut, la position de la cellule ne dépend
 * plus que de cette hauteur. La colonne est d'abord amenée à l'écran : la feuille défile aussi en
 * LARGEUR, et un point hors de l'écran ne touche rien. À chaque hauteur : la cellule est
 * atteignable AVANT le clic (sinon le juge ne mesurerait rien), un clic à la souris en son centre,
 * la barre apparaît, et la cellule n'a ni bougé ni été recouverte. Puis on désélectionne : chaque
 * clic est un PREMIER clic, et le juge ne laisse aucune sélection derrière lui.
 */
const BARRE = "Actions sur la sélection";
const ECARTS_DU_BAS = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270];

async function premierClicStable(page: Page, cible: Locator) {
  const ecran = page.viewportSize()!;
  const barre = page.getByRole("toolbar", { name: BARRE });
  const deselectionner = async () => {
    if (await barre.isVisible()) {
      await barre.getByRole("button", { name: "Désélectionner" }).click();
      await expect(barre).toBeHidden();
    }
  };
  const enHaut = () => cible.evaluate((el) => {
    el.scrollIntoView({ block: "nearest", inline: "center" });
    const zone = el.closest("main");
    if (zone) zone.scrollTop = 0;
  });
  /** Où est la cellule, à quelle distance du bas de la zone qui défile, et qui reçoit le clic en `point`. */
  const mesurer = (point: readonly [number, number] | null) => cible.evaluate((el, point) => {
    const r = el.getBoundingClientRect();
    const zone = el.closest("main");
    const barreBasse = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--app-chrome-bottom")) || 0;
    const bas = (zone ? zone.getBoundingClientRect().bottom : window.innerHeight) - barreBasse;
    const [x, y] = point ?? [(r.left + r.right) / 2, (r.top + r.bottom) / 2];
    const touche = document.elementFromPoint(x, y);
    return {
      haut: r.top, hauteur: r.height, x, y, duBas: Math.round(bas - y),
      atteignable: touche !== null && el.contains(touche),
      touche: touche ? `<${touche.tagName.toLowerCase()} class="${String((touche as HTMLElement).className).slice(0, 60)}">` : "rien",
    };
  }, point);
  try {
    await deselectionner();
    for (const ecart of ECARTS_DU_BAS) {
      await enHaut();
      const ici = await mesurer(null);
      const voulu = ici.hauteur / 2 + 2 + ecart;
      await page.setViewportSize({ width: ecran.width, height: Math.max(240, Math.round(page.viewportSize()!.height + voulu - ici.duBas)) });
      await enHaut();
      const avant = await mesurer(null);
      expect(avant.atteignable, `PRÉCONDITION — à ${avant.duBas} px du bas, la cellule n'est pas atteignable AVANT le clic (le point touche ${avant.touche}) : le juge ne mesurerait rien`).toBe(true);
      await page.mouse.click(avant.x, avant.y);
      // La barre est bien APPARUE : sans elle, ce juge ne mesurerait rien.
      await expect(barre).toBeVisible();
      const apres = await mesurer([avant.x, avant.y]);
      expect(Math.abs(apres.haut - avant.haut), `à ${avant.duBas} px du bas de l'écran, le premier clic a DÉPLACÉ la cellule visée`).toBeLessThan(1);
      expect(apres.atteignable, `à ${avant.duBas} px du bas de l'écran, ce qui est apparu au premier clic RECOUVRE la cellule visée (le point touche ${apres.touche}) : le second clic tomberait dessus`).toBe(true);
      await deselectionner();
    }
  } finally {
    await deselectionner().catch(() => {});
    await page.setViewportSize(ecran);
  }
}

/**
 * LE JUGE DU PREMIER CLIC SAIT DIRE NON (§118.17). Ses deux défauts sont REJOUÉS sans reconstruire
 * l'application : une feuille de style posée dans la page remet la barre là où elle a déjà été —
 * collée au bas de l'écran, puis remontée au-dessus du tableau. Le juge doit tomber, et sur la
 * BONNE assertion. Sans ce cas, sa capacité à échouer ne se vérifierait qu'une fois, à la main, par
 * une série de sabotages qu'on ne relance pas — et sa première version, verte sur le défaut qu'elle
 * existait pour attraper, montre ce que vaut un juge qu'on n'a jamais vu tomber. Le juge passe sur
 * la vraie page (les cas qui l'appellent le prouvent) : s'il tombe ici, c'est sur la barre déplacée.
 */
const BARRE_COLLEE = `div:has(> [role="toolbar"][aria-label="${BARRE}"]) { position: sticky !important; bottom: calc(var(--app-chrome-bottom, 0px) + 0.5rem) !important; z-index: 20 !important; }`;
const BARRE_AU_DESSUS = `div:has(> div > [role="toolbar"][aria-label="${BARRE}"]) { display: flex !important; flex-direction: column !important; } div:has(> [role="toolbar"][aria-label="${BARRE}"]) { order: -1 !important; }`;

async function leJugeSaitDireNon(page: Page, cible: Locator) {
  for (const [style, motif] of [[BARRE_COLLEE, /RECOUVRE/], [BARRE_AU_DESSUS, /DÉPLACÉ/]] as const) {
    const feuille = await page.addStyleTag({ content: style });
    await expect(premierClicStable(page, cible)).rejects.toThrow(motif);
    await feuille.evaluate((e) => (e as Element).remove());
  }
}

/** Attendre qu'un fait soit VRAI EN BASE — l'écran peut afficher avant que l'écriture soit faite. */
async function enBase<T>(lire: () => Promise<T>, attendu: T, message: string) {
  await expect.poll(lire, { message, timeout: 15_000 }).toEqual(attendu);
}

/** La cellule d'une colonne, sur la ligne d'un praticien — repérée par l'EN-TÊTE, pas par un rang écrit à la main. */
async function cellule(page: Page, ligne: string, entete: string): Promise<Locator> {
  const entetes = (await page.locator("table thead th").allTextContents()).map((t) => t.trim());
  const rang = entetes.indexOf(entete);
  expect(rang, `colonne « ${entete} » absente de la feuille : ${entetes.join(" | ")}`).toBeGreaterThan(0);
  return page.locator("table tbody tr").filter({ hasText: ligne }).first().locator("td").nth(rang);
}

async function nettoyer() {
  const users = await prisma.user.findMany({ where: { email: { startsWith: P } }, select: { id: true } });
  const ids = users.map((u) => u.id);
  await prisma.medicalDoctor.deleteMany({ where: { OR: [{ name: { startsWith: P } }, { lastName: { startsWith: P } }] } });
  // Les secteurs partent avec leur BU (Cascade), leurs liens et leurs services avec eux.
  await prisma.businessUnit.deleteMany({ where: { name: { startsWith: P } } });
  await prisma.medicalInstitution.deleteMany({ where: { name: { startsWith: P } } });
  await prisma.salesRepProfile.deleteMany({ where: { repId: { in: ids } } });
  await prisma.notification.deleteMany({ where: { userId: { in: ids } } });
  await prisma.auditLog.deleteMany({ where: { actorId: { in: ids } } }).catch(() => {});
  await prisma.userAccess.deleteMany({ where: { userId: { in: ids } } }).catch(() => {});
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
}

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  await nettoyer();
  const hash = await bcrypt.hash(E2E.password, 10);
  const creer = (email: string, name: string, role: string) =>
    prisma.user.create({ data: { email, name, passwordHash: hash, role: role as never } });
  await creer(DIR_EMAIL, `${P} Direction`, "DIRECTION");
  kamId = (await creer(KAM_EMAIL, `${P} KAM Est`, "MEDICAL_DELEGATE")).id;
  chuId = (await prisma.medicalInstitution.create({
    data: { name: CHU, type: "CHU", wilaya: "Alger", phone: "021 00 00 01", notes: "pavillon B" },
  })).id;
  ephId = (await prisma.medicalInstitution.create({ data: { name: EPH, type: "EPH", wilaya: "Alger" } })).id;
  urgencesId = (await prisma.medicalInstitutionService.create({ data: { institutionId: ephId, name: "Urgences" } })).id;
  // LES FICHES D'AVANT LE LIEN : un établissement tapé à la main, sans identifiant.
  const doc = (lastName: string, institution: string | null) =>
    prisma.medicalDoctor.create({ data: { name: lastName, lastName, firstName: "Test", wilaya: "Alger", delegateId: kamId, institution } });
  await doc(DR_RATTACHE, CHU.toLowerCase());
  await doc(DR_LOT, EPH);
  await doc(DR_INCONNU, `${P} Clinique Inconnue`);
  await doc(DR_SANS, null);
  buId = (await prisma.businessUnit.create({ data: { name: BU } })).id;
  await prisma.salesRepProfile.create({ data: { repId: kamId, businessUnitId: buId } });
});

test.afterAll(async () => {
  await nettoyer();
  await prisma.$disconnect();
});

test("le bouton de la ligne DÉSACTIVE puis RÉACTIVE — et ne touche à rien d'autre", async ({ page }) => {
  page.on("dialog", (d) => d.accept());
  await login(page, DIR_EMAIL);
  await aller(page, "/annuaires/etablissements");
  await page.getByLabel("Chercher un établissement").fill(P);
  const ligne = page.locator("table tbody tr").filter({ hasText: CHU });
  await expect(ligne).toBeVisible();
  // L'annuaire des établissements a la même barre de sélection que la feuille des praticiens, et
  // ses boutons de ligne sont visés juste après un clic de sélection : même juge, même dock.
  await premierClicStable(page, ligne.locator("td").first());

  await page.getByRole("button", { name: `Désactiver ${CHU}` }).click();
  await enBase(async () => (await prisma.medicalInstitution.findUniqueOrThrow({ where: { id: chuId } })).isActive, false, "désactivé en base");
  await expect(ligne.getByText("Inactif")).toBeVisible();

  // LE DÉFAUT RAPPORTÉ : rendre actif ne faisait rien.
  await page.getByRole("button", { name: `Réactiver ${CHU}` }).click();
  await enBase(async () => (await prisma.medicalInstitution.findUniqueOrThrow({ where: { id: chuId } })).isActive, true, "réactivé en base");
  await expect(ligne.getByText("Inactif")).toHaveCount(0);

  // Le geste n'envoie que l'état : type, wilaya, téléphone et notes sont intacts.
  const apres = await prisma.medicalInstitution.findUniqueOrThrow({ where: { id: chuId } });
  expect([apres.type, apres.wilaya, apres.phone, apres.notes]).toEqual(["CHU", "Alger", "021 00 00 01", "pavillon B"]);
});

test("le juge du premier clic sait dire NON, sur l'annuaire des établissements : barre collée → RECOUVRE, barre au-dessus → DÉPLACÉ", async ({ page }) => {
  await login(page, DIR_EMAIL);
  await aller(page, "/annuaires/etablissements");
  await page.getByLabel("Chercher un établissement").fill(P);
  const ligne = page.locator("table tbody tr").filter({ hasText: CHU });
  await expect(ligne).toBeVisible();
  await leJugeSaitDireNon(page, ligne.locator("td").first());
});

test("la case « actif » de la fiche décoche ET recoche — le témoin caché ne gagne plus", async ({ page }) => {
  await login(page, DIR_EMAIL);
  await aller(page, "/annuaires/etablissements");
  // LA COURSE QUE CE BANC A TROUVÉE (§118.172) : rouvrir la fiche avant que l'écran ait reçu ses
  // nouvelles données montrait l'état d'AVANT — case encore cochée — et l'enregistrer aurait
  // RÉACTIVÉ l'établissement qu'on venait de désactiver. Ralentie, elle se joue à chaque passage.
  await ralentirRafraichissements(page);
  await page.getByLabel("Chercher un établissement").fill(P);

  await page.getByRole("button", { name: `Modifier ${CHU}` }).click();
  const fiche = page.getByRole("dialog", { name: `Modifier « ${CHU} »` });
  const actif = fiche.getByRole("checkbox", { name: /Établissement actif/ });
  await expect(actif).toBeChecked();
  await actif.uncheck();
  await fiche.getByRole("button", { name: "Enregistrer" }).click();
  await enBase(async () => (await prisma.medicalInstitution.findUniqueOrThrow({ where: { id: chuId } })).isActive, false, "décoché → inactif");

  await page.getByRole("button", { name: `Modifier ${CHU}` }).click();
  const fiche2 = page.getByRole("dialog", { name: `Modifier « ${CHU} »` });
  await expect(fiche2.getByRole("checkbox", { name: /Établissement actif/ })).not.toBeChecked();
  await fiche2.getByRole("checkbox", { name: /Établissement actif/ }).check();
  await fiche2.getByRole("button", { name: "Enregistrer" }).click();
  // C'était CE cas qui échouait : la case cochée partait APRÈS le témoin « off », et le serveur lisait « off ».
  await enBase(async () => (await prisma.medicalInstitution.findUniqueOrThrow({ where: { id: chuId } })).isActive, true, "recoché → actif");
  const apres = await prisma.medicalInstitution.findUniqueOrThrow({ where: { id: chuId } });
  expect([apres.type, apres.wilaya, apres.phone]).toEqual(["CHU", "Alger", "021 00 00 01"]);
  // Et l'ÉCRAN finit par le dire : le geste revient quand ses données sont à jour, et la fiche
  // rouverte montre ce qu'on vient d'enregistrer — pas seulement la base.
  await page.getByRole("button", { name: `Modifier ${CHU}` }).click();
  await expect(page.getByRole("dialog", { name: `Modifier « ${CHU} »` }).getByRole("checkbox", { name: /Établissement actif/ })).toBeChecked();
});

test("les SERVICES d'un établissement : ajouter d'un coup, renommer, supprimer", async ({ page }) => {
  page.on("dialog", (d) => d.accept());
  await login(page, DIR_EMAIL);
  await aller(page, "/annuaires/etablissements");
  await page.getByLabel("Chercher un établissement").fill(P);

  await page.getByRole("button", { name: `Services de ${CHU}` }).click();
  const panneau = page.getByRole("dialog", { name: `Services — ${CHU}` });
  await panneau.getByLabel("Ajouter un ou plusieurs services").fill("Cardiologie, Pneumologie, cardiologie");
  await panneau.getByRole("button", { name: /Ajouter/ }).click();
  // La répétition est DITE, pas recréée.
  await expect(panneau.getByRole("status")).toContainText("2 service(s) ajouté(s)");
  await expect(panneau.getByRole("status")).toContainText("Répété(s) dans la saisie");
  await enBase(
    async () => (await prisma.medicalInstitutionService.findMany({ where: { institutionId: chuId }, orderBy: { name: "asc" } })).map((s) => s.name),
    ["Cardiologie", "Pneumologie"], "deux services en base",
  );
  const liste = panneau.getByRole("list", { name: `Services de ${CHU}` });
  await expect(liste.getByText("Cardiologie", { exact: true })).toBeVisible();
  await expect(liste.getByText("Pneumologie", { exact: true })).toBeVisible();

  await panneau.getByRole("button", { name: "Renommer le service Pneumologie" }).click();
  await panneau.getByLabel("Nouveau nom du service Pneumologie").fill("Pneumo-phtisiologie");
  await panneau.getByRole("button", { name: "Enregistrer le nom" }).click();
  await enBase(
    async () => (await prisma.medicalInstitutionService.findMany({ where: { institutionId: chuId }, orderBy: { name: "asc" } })).map((s) => s.name),
    ["Cardiologie", "Pneumo-phtisiologie"], "renommé en base",
  );

  await panneau.getByRole("button", { name: "Supprimer le service Pneumo-phtisiologie" }).click();
  await enBase(
    async () => (await prisma.medicalInstitutionService.findMany({ where: { institutionId: chuId } })).map((s) => s.name),
    ["Cardiologie"], "supprimé en base",
  );
  await expect(liste.getByText("Pneumo-phtisiologie")).toHaveCount(0);
});

test("la feuille du délégué RATTACHE l'établissement puis le service — et le texte « à rattacher » disparaît", async ({ page }) => {
  await login(page, KAM_EMAIL);
  await aller(page, "/medical/annuaire");
  const cardio = await prisma.medicalInstitutionService.findFirstOrThrow({ where: { institutionId: chuId, name: "Cardiologie" } });

  const etab = await cellule(page, DR_RATTACHE, "Établissement");
  await expect(etab).toContainText("à rattacher");
  await etab.dblclick();
  const menuEtab = etab.getByRole("combobox", { name: "Établissement" });
  // Le nom PROCHE du texte saisi est proposé en tête : le geste le plus probable est un clic. Le
  // groupe porte le texte d'avant dans son libellé, et l'option la wilaya après le nom.
  await expect(menuEtab.locator("optgroup[label^='Proche du texte saisi'] option")).toHaveText([`${CHU} · Alger`]);
  await menuEtab.selectOption(chuId);
  await enBase(async () => (await prisma.medicalDoctor.findFirstOrThrow({ where: { lastName: DR_RATTACHE } })).institutionId, chuId, "lien posé en base");
  await expect(etab).not.toContainText("à rattacher");
  await expect(etab).toContainText(CHU);

  // Le menu du service ne propose QUE ceux de l'établissement de la ligne.
  await page.reload();
  await page.waitForLoadState("networkidle");
  const svc = await cellule(page, DR_RATTACHE, "Service");
  await svc.dblclick();
  const menuSvc = svc.getByRole("combobox", { name: "Service" });
  await expect(menuSvc.locator("option")).toHaveText(["— Aucun service —", "Cardiologie"]);
  await menuSvc.selectOption(cardio.id);
  await enBase(async () => (await prisma.medicalDoctor.findFirstOrThrow({ where: { lastName: DR_RATTACHE } })).serviceId, cardio.id, "service posé en base");

  // CHANGER D'ÉTABLISSEMENT RETIRE LE SERVICE : un service n'existe que dans son hôpital.
  await page.reload();
  await page.waitForLoadState("networkidle");
  const etab2 = await cellule(page, DR_RATTACHE, "Établissement");
  await etab2.dblclick();
  await etab2.getByRole("combobox", { name: "Établissement" }).selectOption(ephId);
  await enBase(
    async () => { const d = await prisma.medicalDoctor.findFirstOrThrow({ where: { lastName: DR_RATTACHE } }); return [d.institutionId, d.serviceId]; },
    [ephId, null], "service retiré avec l'ancien hôpital",
  );
});

test("le service d'une ligne SANS établissement dit pourquoi au lieu d'ouvrir un menu vide", async ({ page }) => {
  await login(page, KAM_EMAIL);
  await aller(page, "/medical/annuaire");
  const svc = await cellule(page, DR_SANS, "Service");
  // C'est CE cas qui a pris la barre collée au bas de l'écran en flagrant délit : la ligne est la
  // dernière de la feuille, la barre apparue au premier clic la recouvrait, et le second clic ne
  // l'atteignait plus — aucun message, aucun menu. Le juge ne laisse aucune sélection derrière lui :
  // le double-clic qui suit est un VRAI premier clic, la barre apparaît entre ses deux clics.
  await premierClicStable(page, svc);
  await svc.dblclick();
  await expect(page.getByText("Choisissez d'abord l'établissement de cette ligne")).toBeVisible();
  await expect(svc.getByRole("combobox")).toHaveCount(0);
});

test("le juge du premier clic sait dire NON, sur la feuille du délégué : barre collée → RECOUVRE, barre au-dessus → DÉPLACÉ", async ({ page }) => {
  await login(page, KAM_EMAIL);
  await aller(page, "/medical/annuaire");
  await leJugeSaitDireNon(page, await cellule(page, DR_SANS, "Service"));
});

test("deux choix rapides dans la même cellule : le DERNIER fait foi — et le service suit l'établissement qu'on vient de choisir", async ({ page }) => {
  await login(page, KAM_EMAIL);
  await aller(page, "/medical/annuaire");
  await ralentirRafraichissements(page);
  const lireLien = async () => (await prisma.medicalDoctor.findFirstOrThrow({ where: { lastName: DR_SANS } })).institutionId;

  const etab = await cellule(page, DR_SANS, "Établissement");
  await etab.dblclick();
  await etab.getByRole("combobox", { name: "Établissement" }).selectOption(chuId);
  await enBase(lireLien, chuId, "premier choix écrit");

  // AVANT que l'écran ait reçu ses nouvelles données : le service propose ceux de l'établissement
  // QU'ON VIENT DE CHOISIR — l'écran lisait la ligne d'avant et répondait « choisissez d'abord
  // l'établissement » à la personne qui venait de le faire.
  const svc = await cellule(page, DR_SANS, "Service");
  await svc.dblclick();
  await expect(svc.getByRole("combobox", { name: "Service" }).locator("option")).toHaveText(["— Aucun service —", "Cardiologie"]);
  await page.keyboard.press("Escape");

  // REVENIR EN ARRIÈRE N'EST PAS UN NON-ÉVÉNEMENT : le choix « aucun » était comparé à la ligne
  // d'AVANT (déjà « aucun »), rien ne partait, et la base gardait le CHU pendant que l'écran
  // affichait le contraire.
  await etab.dblclick();
  await etab.getByRole("combobox", { name: "Établissement" }).selectOption("");
  await enBase(lireLien, null, "le dernier choix fait foi en base");
});

test("« Rattacher les établissements » relie le nom qui désigne UN établissement, et laisse l'inconnu", async ({ page }) => {
  page.on("dialog", (d) => d.accept());
  await login(page, KAM_EMAIL);
  await aller(page, "/medical/annuaire");
  const bouton = page.getByRole("button", { name: /Rattacher les établissements \(\d+\)/ });
  await expect(bouton).toBeVisible();
  await bouton.click();
  await enBase(async () => (await prisma.medicalDoctor.findFirstOrThrow({ where: { lastName: DR_LOT } })).institutionId, ephId, "nom exact rattaché");
  // L'inconnu n'est JAMAIS rattaché au plus ressemblant.
  const inconnu = await prisma.medicalDoctor.findFirstOrThrow({ where: { lastName: DR_INCONNU } });
  expect([inconnu.institutionId, inconnu.institution]).toEqual([null, `${P} Clinique Inconnue`]);
  await expect(await cellule(page, DR_INCONNU, "Établissement")).toContainText("à rattacher");
});

test("le territoire d'un KAM, sur SA ligne : le CHU pour la seule Cardiologie, l'EPH en entier — et le filtre ne retire rien", async ({ page }) => {
  // 04/10/2026 : « Secteurs de la BU » a quitté l'écran ; le territoire se choisit sur la ligne du KAM
  // (BU hospitalière — la BU du banc est « les deux », le défaut).
  await login(page, DIR_EMAIL);
  await aller(page, "/business-units");
  await page.getByRole("button", { name: new RegExp(BU) }).first().click();
  await expect(page.getByText(/Secteurs de la BU/)).toHaveCount(0);
  await page.getByRole("button", { name: `Territoire de ${P} KAM Est` }).click();
  const fiche = page.getByRole("dialog", { name: `Territoire de ${P} KAM Est` });
  await fiche.getByRole("checkbox", { name: `Couvrir ${CHU}` }).check();
  await fiche.getByRole("checkbox", { name: `Tous les services de ${CHU}` }).uncheck();
  // « Aucun service » n'est pas un choix : le bouton refuse, et l'écran dit pourquoi.
  await expect(fiche.getByRole("alert")).toContainText(CHU);
  await expect(fiche.getByRole("button", { name: "Enregistrer le territoire" })).toBeDisabled();
  await fiche.getByRole("checkbox", { name: `Cardiologie — ${CHU}` }).check();
  await fiche.getByRole("checkbox", { name: `Couvrir ${EPH}` }).check();
  // LE DÉFAUT D'AVANT : filtrer puis enregistrer retirait du territoire tout ce qu'on ne voyait plus.
  await fiche.getByLabel("Filtrer les établissements").fill("zzz-rien");
  await expect(fiche.getByText("Aucun établissement ne correspond à ce filtre.")).toBeVisible();
  await fiche.getByRole("button", { name: "Enregistrer le territoire" }).click();

  const cardio = await prisma.medicalInstitutionService.findFirstOrThrow({ where: { institutionId: chuId, name: "Cardiologie" } });
  await enBase(async () => {
    const sec = await prisma.salesSector.findFirst({
      where: { businessUnitId: buId, repId: kamId },
      select: { reps: { select: { repId: true } }, institutions: { select: { institutionId: true, tousLesServices: true, services: { select: { serviceId: true } } } } },
    });
    if (!sec) return null;
    const parEtab = Object.fromEntries(sec.institutions.map((l) => [l.institutionId, [l.tousLesServices, l.services.map((s) => s.serviceId)]]));
    return { reps: sec.reps.map((r) => r.repId), parEtab };
  }, { reps: [kamId], parEtab: { [chuId]: [false, [cardio.id]], [ephId]: [true, []] } }, "territoire écrit avec sa couverture");

  // ROUVRIR montre ce qui est enregistré — la restriction n'est pas perdue à l'affichage.
  await page.getByRole("button", { name: `Territoire de ${P} KAM Est` }).click();
  const edition = page.getByRole("dialog", { name: `Territoire de ${P} KAM Est` });
  await expect(edition.getByRole("checkbox", { name: `Couvrir ${CHU}` })).toBeChecked();
  await expect(edition.getByRole("checkbox", { name: `Tous les services de ${CHU}` })).not.toBeChecked();
  await expect(edition.getByRole("checkbox", { name: `Cardiologie — ${CHU}` })).toBeChecked();
  await expect(edition.getByRole("checkbox", { name: `Tous les services de ${EPH}` })).toBeChecked();
  // La ligne du KAM DIT ce que son territoire couvre.
  await edition.getByRole("button", { name: "Annuler" }).click();
  await expect(page.getByText(`${CHU} (Cardiologie)`)).toBeVisible();
});

test("rouvrir un territoire JUSTE après l'avoir enregistré montre ce qu'on vient d'enregistrer — pas l'état d'avant", async ({ page }) => {
  await login(page, DIR_EMAIL);
  await aller(page, "/business-units");
  await ralentirRafraichissements(page);
  await page.getByRole("button", { name: new RegExp(BU) }).first().click();
  const lireTous = async () => (await prisma.salesSectorInstitution.findFirstOrThrow({
    where: { institutionId: chuId, sector: { businessUnitId: buId, repId: kamId } },
  })).tousLesServices;

  // Rendre au CHU « tous ses services ».
  await page.getByRole("button", { name: `Territoire de ${P} KAM Est` }).click();
  const edition = page.getByRole("dialog", { name: `Territoire de ${P} KAM Est` });
  await edition.getByRole("checkbox", { name: `Tous les services de ${CHU}` }).check();
  await edition.getByRole("button", { name: /Enregistrer/ }).click();
  await enBase(lireTous, true, "couverture élargie en base");

  // LA COURSE : le panneau naît de la couverture qu'il lit à l'ouverture. Rouvert sur l'état
  // d'AVANT, il remontrait la restriction — et l'enregistrer la RÉÉCRIVAIT.
  await page.getByRole("button", { name: `Territoire de ${P} KAM Est` }).click();
  const encore = page.getByRole("dialog", { name: `Territoire de ${P} KAM Est` });
  await expect(encore.getByRole("checkbox", { name: `Tous les services de ${CHU}` })).toBeChecked();
  await encore.getByRole("button", { name: /Enregistrer/ }).click();
  await enBase(lireTous, true, "rien n'a été réécrit à l'état d'avant");
});

test("au téléphone : l'annuaire des établissements ne déborde pas, et le panneau des services s'ouvre", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await login(page, DIR_EMAIL);
  await aller(page, "/annuaires/etablissements");
  await page.getByLabel("Chercher un établissement").fill(P);
  await sansDebordement(page);
  await page.getByRole("button", { name: `Services de ${EPH}` }).click();
  const panneau = page.getByRole("dialog", { name: `Services — ${EPH}` });
  await expect(panneau.getByText("Urgences", { exact: true })).toBeVisible();
  await sansDebordement(page);
  expect(urgencesId).not.toBe("");
});
