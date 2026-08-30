import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { getAccess } from "@/lib/rbac";
import type { CurrentUser } from "@/lib/session";
import { inProcessPlatform, principalOf } from "./in-process/adapter";
import type { Destination } from "./contract";

let dbOk = false;
try { await prisma.$queryRaw`SELECT 1`; dbOk = true; } catch { dbOk = false; }
const suite = dbOk ? describe : describe.skip;

const TAG = "__navdest__";

/**
 * LA PORTE DE SORTIE D'ADAM — depuis la VRAIE porte.
 *
 * Ce qui se vérifie ici n'est PAS le filtre de navigation : il est prouvé à part, à sec, dans
 * `lib/navigation.test.ts`. C'est le BRANCHEMENT — la lecture existe-t-elle vraiment dans le
 * contrat, l'adaptateur la sert-il, et rend-elle la liste de CETTE personne ?
 *
 * Le risque qu'on ferme est précis : une liste constante. Un sélecteur de modules qui montre les
 * mêmes entrées à tout le monde n'est pas une commodité, c'est une fuite — il annonce à un
 * délégué médical l'existence de la console d'administration, et lui fait cliquer sur une porte
 * qui se refermera. D'où la comparaison entre deux comptes de droits différents.
 */
suite("Adam — les destinations viennent de la plateforme, filtrées par personne", () => {
  let adminId = "";
  let delegateId = "";

  const actorFor = async (id: string, role: "SUPER_ADMIN" | "MEDICAL_DELEGATE"): Promise<CurrentUser> => {
    const access = await getAccess(id, role);
    const u = await prisma.user.findUniqueOrThrow({ where: { id } });
    return { id, name: u.name, email: u.email, role, access, mustChangePassword: false };
  };

  const destinationsOf = async (id: string, role: "SUPER_ADMIN" | "MEDICAL_DELEGATE"): Promise<readonly Destination[]> => {
    const r = await inProcessPlatform.query(principalOf(await actorFor(id, role)), { kind: "navigation.destinations" });
    return r.kind === "navigation.destinations" ? r.destinations : [];
  };

  beforeAll(async () => {
    const [a, d] = await Promise.all([
      prisma.user.create({ data: { name: `${TAG}admin`, email: `${TAG}admin@t.dz`, role: "SUPER_ADMIN", passwordHash: "x" } }),
      prisma.user.create({ data: { name: `${TAG}deleg`, email: `${TAG}deleg@t.dz`, role: "MEDICAL_DELEGATE", passwordHash: "x" } }),
    ]);
    adminId = a.id;
    delegateId = d.id;
  }, 60_000);

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } }).catch(() => {});
  }, 60_000);

  it("rend des destinations, et chacune est une adresse ouvrable", async () => {
    const dests = await destinationsOf(adminId, "SUPER_ADMIN");
    expect(dests.length).toBeGreaterThan(0);
    for (const d of dests) {
      expect(d.href.startsWith("/")).toBe(true);
      expect(d.label.trim()).not.toBe("");
      // Le groupe sert de titre de section : une entrée sans groupe s'afficherait sous un
      // intitulé vide, ce qui est pire que pas de section du tout.
      expect(d.group.trim()).not.toBe("");
    }
  }, 60_000);

  it("un délégué médical ne se voit PAS proposer la console d'administration", async () => {
    const dests = await destinationsOf(delegateId, "MEDICAL_DELEGATE");
    expect(dests.some((d) => d.module === "ADMIN")).toBe(false);
    // Ni le PIPELINE, dont la garde ne s'ouvre que pour qui voit des dossiers verrouillés.
    expect(dests.some((d) => d.href === "/regulatory/pipeline")).toBe(false);
  }, 60_000);

  it("la liste dépend de la personne — ce n'est pas une constante déguisée", async () => {
    const [admin, delegate] = await Promise.all([
      destinationsOf(adminId, "SUPER_ADMIN"),
      destinationsOf(delegateId, "MEDICAL_DELEGATE"),
    ]);
    expect(admin.length).toBeGreaterThan(delegate.length);
    // Et ce que le délégué voit, l'administrateur le voit aussi : le filtre RETIRE des entrées,
    // il ne remplace pas une liste par une autre. La comparaison porte sur le MODULE et non sur
    // l'adresse — voir le cas des entrées fusionnées, juste en dessous.
    const adminModules = new Set(admin.map((d) => d.module));
    for (const d of delegate) expect(adminModules.has(d.module)).toBe(true);
  }, 60_000);

  it("une entrée fusionnée mène au premier onglet que CETTE personne peut ouvrir", async () => {
    const [admin, delegate] = await Promise.all([
      destinationsOf(adminId, "SUPER_ADMIN"),
      destinationsOf(delegateId, "MEDICAL_DELEGATE"),
    ]);
    // « Ad & Pro » réunit plusieurs sous-modules en onglets. L'administrateur les a tous et
    // arrive sur le premier ; le délégué médical n'a que les congrès et arrive donc AILLEURS.
    // Envoyer tout le monde sur `n.href` — l'adresse déclarée — ouvrirait au délégué un onglet
    // qu'il n'a pas le droit de voir, c'est-à-dire un renvoi ou un écran vide.
    const adPro = (list: readonly Destination[]) => list.find((d) => d.label === "Ad & Pro")?.href;
    expect(adPro(admin)).toBe("/ad-pro");
    expect(adPro(delegate)).toBe("/congress-international");
  }, 60_000);
});
