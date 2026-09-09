import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@/lib/session";

vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));
let ACTEUR: CurrentUser | null = null;
vi.mock("@/lib/session", () => ({ requireUser: async () => ACTEUR, getUser: async () => ACTEUR }));

import { prisma } from "@/lib/prisma";
import { getAccess, userCan, canViewBdProjects, canManageBdProjects, type SessionUser } from "@/lib/rbac";
import { SOUS_MODULES_MAINTENUS, estCheminMaintenu, isRetiredModule } from "@/lib/modules-retired";
import { navigationFor } from "@/lib/nav-access";
import { navPaths } from "@/components/layout/sidebar";
import { executerAction } from "./executer";

let dbOk = false;
try { await prisma.$queryRaw`SELECT 1`; dbOk = true; } catch { dbOk = false; }
const suite = dbOk ? describe : describe.skip;

const TAG = "__bdmaint__";

async function acteur(id: string, role: SessionUser["role"]): Promise<CurrentUser> {
  const access = await getAccess(id, role);
  const u = await prisma.user.findUniqueOrThrow({ where: { id } });
  return { id, name: u.name, email: u.email, role, access, mustChangePassword: false };
}

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * « BD › PROJETS » SURVIT AU RETRAIT — et Market Intelligence reste fermé.
 *
 * Le défaut réparé ici a été trouvé en exécutant, pas en relisant : l'écran demandé par le
 * dirigeant vivait dans un module retiré du service, donc ses actions refusaient TOUT LE MONDE,
 * Super Admin compris, et aucun menu n'y menait. Écrit, testé, poussé — et inatteignable
 * (§118.14, §118.50).
 *
 * Ce banc tient les DEUX moitiés. Rouvrir le module entier aurait été plus simple et aurait
 * rendu onze écrans que l'entreprise a décidé d'éteindre, plus deux actions de Market
 * Intelligence, plus l'accès générique d'Adam au module : l'empreinte réelle aurait dépassé
 * l'empreinte demandée (§118.16). C'est cette seconde moitié qu'on vérifie ici.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
describe("SOUS-MODULE MAINTENU — la liste est courte, fermée, et le module reste retiré", () => {
  it("BUSINESS_DEVELOPMENT est TOUJOURS retiré — on n'a pas défait la décision de 2026-09", () => {
    expect(isRetiredModule("BUSINESS_DEVELOPMENT")).toBe(true);
  });

  it("seul « Projets » survit ; la racine et les onze autres écrans ne sont pas maintenus", () => {
    expect(SOUS_MODULES_MAINTENUS.BUSINESS_DEVELOPMENT).toEqual(["/business-development/projets"]);
    expect(estCheminMaintenu("/business-development/projets")).toBe(true);
    for (const mort of [
      "/business-development", "/business-development/marche", "/business-development/etudes",
      "/business-development/opportunites", "/business-development/marche/pricing",
    ]) expect(estCheminMaintenu(mort), mort).toBe(false);
  });
});

suite("BD › PROJETS — atteignable, et par les VRAIS points d'entrée", () => {
  let pdgId = "", regulatoryId = "", etrangerId = "", projetId = "";

  beforeAll(async () => {
    const [pdg, reg, etr] = await Promise.all([
      prisma.user.create({ data: { name: `${TAG}pdg`, email: `${TAG}pdg@t.dz`, role: "SUPER_ADMIN", passwordHash: "x" } }),
      prisma.user.create({ data: { name: `${TAG}reg`, email: `${TAG}reg@t.dz`, role: "HEAD_OF_REGULATORY", passwordHash: "x" } }),
      prisma.user.create({ data: { name: `${TAG}etr`, email: `${TAG}etr@t.dz`, role: "COORDINATOR", passwordHash: "x" } }),
    ]);
    pdgId = pdg.id; regulatoryId = reg.id; etrangerId = etr.id;
  });

  afterAll(async () => {
    await prisma.bdProject.deleteMany({ where: { name: { startsWith: TAG } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } });
  });

  it("LE DÉFAUT RÉPARÉ : le Super Admin CRÉE un projet, et la ligne est en base", async () => {
    // Avant ce lot, cet appel rendait « Non autorisé. » et ne créait rien — pour tout le monde.
    ACTEUR = await acteur(pdgId, "SUPER_ADMIN");
    const r = await executerAction(ACTEUR, "bd-project-actions:createBdProject", {
      name: `${TAG}Oncologie 2027`, status: "IN_PROGRESS",
    });
    expect(r.ok, JSON.stringify(r)).toBe(true);
    const ligne = await prisma.bdProject.findFirst({ where: { name: `${TAG}Oncologie 2027` } });
    expect(ligne, "aucune ligne : le succès annoncé serait un faux succès").not.toBeNull();
    expect(ligne!.status).toBe("IN_PROGRESS");
    projetId = ligne!.id;
  });

  it("le Super Admin RENOMME — la porte par ligne passe aussi", async () => {
    ACTEUR = await acteur(pdgId, "SUPER_ADMIN");
    const r = await executerAction(ACTEUR, "bd-project-actions:updateBdProject", {
      id: projetId, name: `${TAG}Oncologie 2028`,
    });
    expect(r.ok, JSON.stringify(r)).toBe(true);
    expect((await prisma.bdProject.findUniqueOrThrow({ where: { id: projetId } })).name)
      .toBe(`${TAG}Oncologie 2028`);
  });

  it("NOMMER un projet reste au Super Admin — c'est la demande, mot pour mot", async () => {
    const reg = await acteur(regulatoryId, "HEAD_OF_REGULATORY");
    expect(canViewBdProjects(reg)).toBe(true);      // il LIT le registre…
    expect(canManageBdProjects(reg)).toBe(false);   // …il ne le NOMME pas
    ACTEUR = reg;
    const r = await executerAction(ACTEUR, "bd-project-actions:createBdProject", { name: `${TAG}interdit` });
    expect(r.ok).toBe(false);
    expect(await prisma.bdProject.findFirst({ where: { name: `${TAG}interdit` } })).toBeNull();
  });

  it("qui ne voit pas Regulatory ne voit pas le registre — la porte n'est pas ouverte à tous", async () => {
    const etr = await acteur(etrangerId, "COORDINATOR");
    expect(canViewBdProjects(etr)).toBe(false);
    expect(canManageBdProjects(etr)).toBe(false);
  });

  it("MARKET INTELLIGENCE RESTE FERMÉ — la moitié de la règle qu'on aurait pu perdre", async () => {
    // Rouvrir le module aurait rendu ces deux actions-là en prime. Elles doivent refuser le
    // Super Admin lui-même : c'est ce qui prouve que l'empreinte n'a pas débordé.
    const pdg = await acteur(pdgId, "SUPER_ADMIN");
    expect(userCan(pdg, "BUSINESS_DEVELOPMENT", "CREATE")).toBe(false);
    ACTEUR = pdg;
    const r = await executerAction(ACTEUR, "bd-actions:createBD", {
      dci: `${TAG}molecule`, brandName: `${TAG}marque`,
    });
    expect(r.ok, "createBD (Market Intelligence) ne doit PAS être rouvert").toBe(false);
  });

  it("LE MENU y mène — sans quoi tout ce qui précède serait du code mort (§118.50)", async () => {
    const pdg = await acteur(pdgId, "SUPER_ADMIN");
    const nav = await navigationFor(pdg);
    // On juge les DESTINATIONS (`href`), pas `navPaths` : celui-ci mêle les alias de
    // surlignage (`match`), et « Explorateur produits » — module bien vivant — garde
    // légitimement `/business-development/marche/produits` parmi les siens. Les confondre
    // ferait échouer ce test sur une entrée qui n'a rien à voir avec le retrait.
    const destinations = (items: typeof nav): string[] =>
      items.flatMap((i) => [i.href, ...destinations(i.children ?? [])]);
    const cibles = destinations(nav);
    expect(cibles, "aucune entrée de menu ne mène à Projets").toContain("/business-development/projets");
    expect(cibles.filter((c) => c.startsWith("/business-development")))
      .toEqual(["/business-development/projets"]);
    // Et l'adresse racine du module retiré n'est revenue NULLE PART, alias compris.
    expect(nav.flatMap(navPaths)).not.toContain("/business-development");
  });
});
