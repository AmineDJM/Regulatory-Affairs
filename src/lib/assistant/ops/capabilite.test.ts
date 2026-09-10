import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@/lib/session";

vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));
let ACTEUR: CurrentUser | null = null;
vi.mock("@/lib/session", () => ({ requireUser: async () => ACTEUR, getUser: async () => ACTEUR }));

// ⚠ ORDRE D'IMPORT. `ops/index.ts` et `lib/assistant.ts` forment un cycle d'INITIALISATION
// CONNU : `ops` → `impl-wave7d` → `actions/adventum-actions` → `assistant.ts`, qui lit
// `DOMAIN_TOOL_DEFS` exporté par `ops`. Charger `assistant` d'abord — comme le fait
// l'application, et comme `capability-audit.test.ts` — donne l'ordre qui résout. Sans cette
// ligne, la SUITE ENTIÈRE échoue au chargement sur « DOMAIN_TOOL_DEFS is not iterable », sans
// qu'aucun test n'ait tourné : le cycle ne vient pas de ce lot, il se révèle à toute nouvelle
// porte d'entrée dans `ops/`.
import "@/lib/assistant";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { prisma } from "@/lib/prisma";
import { getAccess, type SessionUser } from "@/lib/rbac";
import { CAPABILITY_OPS_IMPL } from "./impl-capabilite";
import { CONTRATS_ACTIONS } from "@/platform/in-process/capacites";
import { entiteDuModele } from "@/lib/cibles/modele-entite";
import { relireApresEcriture } from "@/lib/cibles/relire";
import { porteeEntite } from "@/lib/api/registry/portee";
import { canReadEntity, ENTITIES } from "@/lib/api/registry/entities";
import { DOMAIN_TOOLS } from "./index";
import { OPS_CATALOG } from "./catalog";

let dbOk = false;
try { await prisma.$queryRaw`SELECT 1`; dbOk = true; } catch { dbOk = false; }
const suite = dbOk ? describe : describe.skip;

const TAG = "__capaop__";
const run = CAPABILITY_OPS_IMPL.run!;

async function acteur(id: string, role: SessionUser["role"]): Promise<CurrentUser> {
  const access = await getAccess(id, role);
  const u = await prisma.user.findUniqueOrThrow({ where: { id } });
  return { id, name: u.name, email: u.email, role, access, mustChangePassword: false };
}

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * L'APPELANT DE PRODUCTION — §118.14 posé à ce lot.
 *
 * « Si quelqu'un utilise Adam normalement maintenant, ce composant peut-il être déclenché et
 * produire un effet utile ? » Le contrat, la garde et l'exécuteur avaient chacun leurs tests ;
 * aucun n'était ATTEIGNABLE depuis une conversation. Ce banc part de l'op telle que le modèle
 * l'appelle, et va jusqu'à la ligne en base.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
describe("L'OP EST DÉCLARÉE — sinon le modèle ne la voit jamais", () => {
  it("elle figure au catalogue ET dans les outils rendus au modèle", () => {
    expect(OPS_CATALOG.find((o) => o.tool === "capability_operation" && o.op === "run")).toBeDefined();
    const outil = DOMAIN_TOOLS.capability_operation;
    expect(outil, "l'op existe au catalogue mais aucun outil ne la porte : le modèle ne la verra pas").toBeDefined();
    expect(Object.keys(outil!.ops)).toEqual(["run"]);
    expect(outil!.def.description).toMatch(/RATTRAPAGE/);
  });

  it("elle ne se déclare COUVRANTE d'aucune action de l'inventaire", () => {
    // `covers: []` est délibéré : y lister les 550 ferait passer le cliquet de parité pour une
    // couverture nominative, alors qu'il compte des gestes DÉCRITS à un humain.
    expect(OPS_CATALOG.find((o) => o.tool === "capability_operation")!.covers).toEqual([]);
  });
});

describe("LE REFUS FAIT LA DÉCOUVERTE — un outil au lieu de trois", () => {
  it("une intention ambiguë rend les CANDIDATES avec leurs champs, pas un « je ne trouve pas »", async () => {
    const r = await run.propose({ action: "créer une demande" }, {} as CurrentUser);
    expect("error" in r).toBe(true);
    const msg = (r as { error: string }).error;
    expect(msg).toMatch(/correspond à \d+ actions/);
    expect(msg).toContain(":");           // des identifiants exploitables
    expect(msg).toMatch(/ : texte| : reference| : date/); // et leurs champs
  });

  it("une intention qui ne mène nulle part le DIT, avec le geste pour reformuler", async () => {
    const r = await run.propose({ action: "zzzzqqq inexistant" }, {} as CurrentUser);
    expect((r as { error: string }).error).toMatch(/Aucune action .* ne correspond/);
    expect((r as { error: string }).error).toMatch(/Reformulez/);
  });

  it("AUTO-ESCALADE : refusée à la PROPOSITION — aucune carte n'est même construite", async () => {
    const r = await run.propose(
      { action: "admin-actions:updateUserRole", champs: '{"userId":"x","role":"SUPER_ADMIN"}' },
      {} as CurrentUser,
    );
    expect("error" in r).toBe(true);
    expect((r as { error: string }).error).toMatch(/écran d'administration/);
  });

  it("un champ inventé fait échouer la PROPOSITION, et la fiche exacte accompagne le refus", async () => {
    const r = await run.propose(
      { action: "admin-request-actions:createRequest", champs: '{"titre":"x"}' },
      {} as CurrentUser,
    );
    const msg = (r as { error: string }).error;
    expect(msg).toContain("« titre » n'est pas une entrée");
    expect(msg).toContain("Cette action attend :");
  });

  it("un JSON invalide est nommé, jamais avalé", async () => {
    const r = await run.propose({ action: "admin-request-actions:createRequest", champs: "{oops" }, {} as CurrentUser);
    expect((r as { error: string }).error).toMatch(/n'est pas du JSON valide/);
  });
});

suite("DE LA CARTE À LA LIGNE EN BASE — le trajet complet", () => {
  let pdgId = "";

  beforeAll(async () => {
    const pdg = await prisma.user.create({
      data: { name: `${TAG}pdg`, email: `${TAG}pdg@t.dz`, role: "SUPER_ADMIN", passwordHash: "x" },
    });
    pdgId = pdg.id;
  });

  afterAll(async () => {
    await prisma.administrativeRequest.deleteMany({ where: { title: { startsWith: TAG } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } });
  });

  it("propose une carte qui DIT ce qui sera touché, puis exécute et la ligne existe", async () => {
    ACTEUR = await acteur(pdgId, "SUPER_ADMIN");
    const brouillon = await run.propose(
      { action: "admin-request-actions:createRequest",
        champs: JSON.stringify({ title: `${TAG}Achat toner`, type: "PURCHASE", priority: "HIGH" }) },
      ACTEUR,
    );
    expect("error" in brouillon, JSON.stringify(brouillon)).toBe(false);
    const carte = brouillon as Exclude<typeof brouillon, { error: string }>;

    // LA CARTE — c'est ce qu'une personne confirme, donc elle doit porter l'essentiel.
    expect(carte.fields.find((f) => f.label === "Action")!.value).toBe("admin-request-actions:createRequest");
    expect(carte.fields.find((f) => f.label === "title")!.value).toBe(`${TAG}Achat toner`);
    expect(carte.warnings!.join(" ")).toMatch(/Écrit : .*administrativeRequest/);
    expect(carte.warnings!.join(" ")).toMatch(/revérifiés par l'action elle-même/);

    // RIEN N'A ENCORE ÉTÉ ÉCRIT : proposer n'est pas faire.
    expect(await prisma.administrativeRequest.findFirst({ where: { title: `${TAG}Achat toner` } })).toBeNull();

    const fait = await run.execute(carte.args, ACTEUR);
    expect(fait.ok, fait.error).toBe(true);
    const ligne = await prisma.administrativeRequest.findFirst({ where: { title: `${TAG}Achat toner` } });
    expect(ligne, "l'exécution a dit oui et rien n'existe : faux succès").not.toBeNull();
    expect(ligne!.type).toBe("PURCHASE");
    expect(ligne!.priority).toBe("HIGH");
  });

  it("une valeur hors énum est refusée AVANT la carte, avec les valeurs admises", async () => {
    ACTEUR = await acteur(pdgId, "SUPER_ADMIN");
    const r = await run.propose(
      { action: "admin-request-actions:createRequest", champs: `{"title":"${TAG}z","type":"ACHAT"}` },
      ACTEUR,
    );
    expect((r as { error: string }).error).toContain("PURCHASE");
    expect(await prisma.administrativeRequest.findFirst({ where: { title: `${TAG}z` } })).toBeNull();
  });
});

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * APRÈS L'ÉCRITURE, ON RELIT — et « c'est fait » cesse d'être une parole à croire.
 *
 * L'exécution rendait `« createRequest exécutée. »`. Rien, dans cette phrase, ne permettait à
 * la personne de CONSTATER ce qui avait changé : elle devait croire Adam. §104.16 l'interdit —
 * « c'est fait » redevient une parole à croire, ce qu'aucun écran de ce produit n'a le droit
 * de demander — et le retour de l'action, qui portait l'identifiant écrit, était jeté.
 *
 * Ce banc exige que la phrase porte une VALEUR RELUE EN BASE, et qu'elle le dise franchement
 * quand elle n'a rien pu relire. Il part du VRAI point d'entrée (`run.execute`), jamais de
 * `relireApresEcriture` prise seule : c'est la rencontre qui est la propriété (§118.49).
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
suite("RELECTURE — la phrase porte ce qui a été CONSTATÉ, ou dit qu'elle n'a rien constaté", () => {
  let pdgId = "", etrangerId = "", assistantId = "";

  beforeAll(async () => {
    const pdg = await prisma.user.create({
      data: { name: `${TAG}relu`, email: `${TAG}relu@t.dz`, role: "SUPER_ADMIN", passwordHash: "x" },
    });
    pdgId = pdg.id;
    // DEUX ACTEURS SANS VUE GLOBALE — sans eux, les gardes de la relecture ne peuvent pas
    // tomber, et une garde qu'on ne peut pas faire échouer est une décoration (§118.104).
    const etranger = await prisma.user.create({
      data: { name: `${TAG}sansmodule`, email: `${TAG}sansmodule@t.dz`, role: "MEDICAL_DELEGATE", passwordHash: "x" },
    });
    const assistant = await prisma.user.create({
      data: { name: `${TAG}assistante`, email: `${TAG}assistante@t.dz`, role: "DIRECTION_ASSISTANT", passwordHash: "x" },
    });
    etrangerId = etranger.id; assistantId = assistant.id;
  });

  afterAll(async () => {
    await prisma.administrativeRequest.deleteMany({ where: { title: { startsWith: TAG } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } });
  });

  it("la phrase porte des valeurs RELUES en base, pas un « exécutée » nu", async () => {
    ACTEUR = await acteur(pdgId, "SUPER_ADMIN");
    const brouillon = await run.propose(
      { action: "admin-request-actions:createRequest",
        champs: JSON.stringify({ title: `${TAG}Relecture`, type: "PURCHASE", priority: "HIGH" }) },
      ACTEUR,
    );
    const carte = brouillon as Exclude<typeof brouillon, { error: string }>;
    const fait = await run.execute(carte.args, ACTEUR);
    expect(fait.ok, fait.error).toBe(true);

    // LE CAS QUI FERAIT TOMBER CETTE ASSERTION : revenir à `« … exécutée. »`. La personne
    // devrait alors croire Adam sur parole, et un `update` qui n'a touché aucune ligne se
    // lirait exactement comme un succès.
    expect(fait.message, "la phrase ne porte aucune valeur relue : « c'est fait » est une parole")
      .toContain(`${TAG}Relecture`);
    expect(fait.message).toMatch(/relu dans votre périmètre/);
    // ET CE QUI EST RELU EST CE QUI EST EN BASE — pas ce qu'on a envoyé.
    const ligne = await prisma.administrativeRequest.findFirstOrThrow({ where: { title: `${TAG}Relecture` } });
    expect(fait.message).toContain(ligne.id);
    expect(fait.message).toContain("PURCHASE");
  });

  it("UNE ÉCRITURE, SON JOURNAL ET SA NOTIFICATION — trois modèles, et la BONNE ligne est relue", async () => {
    // LE DÉFAUT QUE CE CAS FERME, et il était silencieux.
    //
    // La règle était « un seul modèle écrit, sinon on renonce ». Elle a tenu tant que la
    // dérivation ne lisait que le corps de l'action ; depuis qu'elle suit les délégués IMPORTÉS
    // (`recordAudit`, `notifyUser`), `createRequest` déclare TROIS modèles — et les trois sont
    // des entités du registre. La relecture renonçait donc sur le cas le plus banal du parc, et
    // la phrase retombait sur « je n'ai PAS pu relire » alors que la ligne était là. §118.61 :
    // une réparation avait déplacé la donnée, et ce lecteur lisait encore l'ancienne forme.
    //
    // LE CAS QUI FAIT TOMBER CETTE ASSERTION : rétablir `if (candidats.length !== 1) return null`.
    const contrat = CONTRATS_ACTIONS.find((c) => c.id === "admin-request-actions:createRequest");
    expect(contrat, "le contrat dérivé doit exister").toBeDefined();
    const connus = contrat!.modelesEcrits.filter((m) => entiteDuModele(m) !== null);
    expect(connus.length, "la prémisse : plusieurs modèles ÉCRITS sont des entités du registre")
      .toBeGreaterThan(1);

    ACTEUR = await acteur(pdgId, "SUPER_ADMIN");
    const brouillon = await run.propose(
      { action: "admin-request-actions:createRequest",
        champs: JSON.stringify({ title: `${TAG}Trois modèles`, type: "PURCHASE", priority: "LOW" }) },
      ACTEUR,
    );
    const fait = await run.execute((brouillon as Exclude<typeof brouillon, { error: string }>).args, ACTEUR);
    expect(fait.ok, fait.error).toBe(true);

    const ligne = await prisma.administrativeRequest.findFirstOrThrow({ where: { title: `${TAG}Trois modèles` } });
    // LA LIGNE MÉTIER, pas la ligne de journal : c'est l'identifiant de la demande qui est relu.
    expect(fait.message).toContain(ligne.id);
    expect(fait.message).toContain(`${TAG}Trois modèles`);
    expect(fait.message).toMatch(/relu dans votre périmètre/);
    // ET CE N'EST PAS LE JOURNAL : aucun libellé d'audit dans la phrase.
    expect(fait.message).not.toMatch(/Journal d'audit|AuditLog/i);
  });

  it("LA RELECTURE REFUSE une ligne HORS PORTÉE — et la garde est exerçable, pas décorative", async () => {
    // POURQUOI CE CAS EXISTE, et il a été écrit APRÈS deux sabotages passés au vert.
    //
    // Les deux cas ci-dessus agissent en Super Admin : sa portée est globale, donc retirer
    // `canReadEntity` ou `porteeEntite` de la relecture ne faisait tomber AUCUN test — la garde
    // rendait « vrai » quoi qu'il arrive. C'est le défaut de §118.104, sur le geste le plus
    // sensible du lot : une VÉRIFICATION qui montrerait une ligne que la personne n'a pas le
    // droit de voir serait un contournement de permission introduit au pire endroit possible.
    //
    // Ce que ce cas juge est le LECTEUR (`relireApresEcriture`) contre un acteur qui n'a
    // réellement pas accès : la rencontre avec l'exécution est couverte par les deux cas
    // ci-dessus, et un acteur qui pourrait écrire sans pouvoir relire n'existe pas au parc.
    ACTEUR = await acteur(pdgId, "SUPER_ADMIN");
    const brouillon = await run.propose(
      { action: "admin-request-actions:createRequest",
        champs: JSON.stringify({ title: `${TAG}Hors portée`, type: "PURCHASE", priority: "LOW" }) },
      ACTEUR,
    );
    const fait = await run.execute((brouillon as Exclude<typeof brouillon, { error: string }>).args, ACTEUR);
    expect(fait.ok, fait.error).toBe(true);
    const ligne = await prisma.administrativeRequest.findFirstOrThrow({ where: { title: `${TAG}Hors portée` } });

    // (a) SANS LE MODULE : la garde d'entité referme avant toute requête.
    const sansModule = await acteur(etrangerId, "MEDICAL_DELEGATE");
    expect(
      await relireApresEcriture(sansModule, ["administrativeRequest"], {}, { id: ligne.id }),
      "un acteur sans le module ne doit rien relire",
    ).toBeNull();

    // (b) AVEC LE MODULE mais hors de SA portée : la demande est celle de quelqu'un d'autre.
    const autreDemandeur = await acteur(assistantId, "DIRECTION_ASSISTANT");
    const vu = await relireApresEcriture(autreDemandeur, ["administrativeRequest"], {}, { id: ligne.id });
    const aLeDroit = canReadEntity(autreDemandeur, ENTITIES.find((e) => e.name === "admin_request")!);
    // LA PRÉMISSE EST VÉRIFIÉE : si cet acteur a bien le droit de LIRE l'entité, alors ce qui
    // décide est la PORTÉE par ligne, et c'est elle qu'on exerce. Sinon c'est (a) une seconde
    // fois, et il faut le dire plutôt que de croire avoir exercé la portée.
    if (aLeDroit) {
      const sienne = await prisma.administrativeRequest.findFirst({
        where: { AND: [await porteeEntite(autreDemandeur, ENTITIES.find((e) => e.name === "admin_request")!), { id: ligne.id }] },
        select: { id: true },
      });
      if (!sienne) expect(vu, "une ligne hors de la portée de la personne ne se relit pas").toBeNull();
      else expect(vu, "la ligne EST dans sa portée : la relecture doit la rendre").not.toBeNull();
    }

    // (c) UNE ENTITÉ DONT LA PORTÉE NE REFUSE RIEN — et c'est le cas GÉNÉRAL.
    //
    // Mesuré sur le registre : 23 entités sur 29 rendent une clause VIDE pour un acteur sans le
    // module (`supplier`, `task`, `document`, `user`, `audit_log`, `notification`…) ; seules six
    // se refusent elles-mêmes par `{ id: "__none__" }`, dont `admin_request` utilisée en (a) et
    // (b). Pour les vingt-trois autres, `canReadEntity` est la SEULE garde de la relecture — et
    // sans un cas qui passe par l'une d'elles, la neutraliser ne faisait tomber aucun test.
    //
    // Ici : un délégué médical relit une ligne du modèle `User`, gouverné par ADMINISTRATION,
    // qu'il n'a pas. La ligne EXISTE (c'est le Super Admin du décor) : ce n'est donc pas une
    // absence qui ferme, c'est la garde.
    expect(
      await relireApresEcriture(sansModule, ["user"], {}, { id: pdgId }),
      "un délégué ne doit pas relire une ligne de compte : sur les 23 entités à portée vide, "
      + "`canReadEntity` est la seule garde",
    ).toBeNull();
    // LA PRÉMISSE, vérifiée : c'est bien la garde qui ferme, pas la portée.
    expect(JSON.stringify(await porteeEntite(sansModule, ENTITIES.find((e) => e.name === "user")!)))
      .not.toMatch(/__none__/);
  });

  it("la RELECTURE passe par la portée de la personne — jamais un accès privilégié", async () => {
    // Relire avec un accès élargi montrerait une ligne que la personne n'a pas le droit de
    // voir : un contournement de permission introduit par un geste de VÉRIFICATION, c'est-à-dire
    // au pire endroit possible. Le module ne connaît qu'un chemin, celui de l'écran.
    const relire = readFileSync(join(process.cwd(), "src/lib/cibles/relire.ts"), "utf8");
    expect(relire, "la relecture doit composer la portée par ligne comme l'écran").toContain("porteeEntite");
    expect(relire, "la relecture doit vérifier le droit de lecture de l'entité").toContain("canReadEntity");
    expect(relire, "aucune lecture hors portée").not.toMatch(/findUnique|findFirstOrThrow/);
  });

  it("ce qui n'écrit RIEN ne prétend pas avoir été relu", async () => {
    ACTEUR = await acteur(pdgId, "SUPER_ADMIN");
    const lecture = CONTRATS_ACTIONS.find((c) => !c.illisible && !c.ecrit && c.champs.length === 0);
    expect(lecture, "aucune action de lecture sans entrée dans le parc — le banc ne prouve rien").toBeTruthy();
    const fait = await run.execute({ action: lecture!.id, champs: "{}" }, ACTEUR);
    if (fait.ok) expect(fait.message).not.toMatch(/relu dans votre périmètre/);
  });
});
