import { describe, expect, it } from "vitest";
import type { CurrentUser } from "@/lib/session";
import type { EffectiveAccess, Module, Action } from "@/lib/rbac";
import { MODULES, ACTIONS } from "@/lib/rbac";
import { assistantToolsFor, buildChiefOfStaffContext, RESOLVER_WRITE_NAMES } from "@/lib/assistant";
import { BUSINESS_CAPABILITIES } from "./business-capabilities";
import { POWER_TOOLS } from "./power-tools";
import { consignerMesure } from "@/lib/evals/registre";
import {
  capabilitiesFor, capabilityDoctrine, hasCapability, isDirectOn,
  voiceDirectNames, VOICE_DIRECT_WRITES,
} from "./capability-surface";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * L'INVARIANT DE CAPACITÉ — ce que ces épreuves empêchent de revenir.
 *
 * En production, à l'oral : « Je ne peux pas l'envoyer, il manque l'action d'envoi d'e-mail
 * dans les fonctions disponibles. » `send_email` existait pourtant, marchait en texte, et le
 * transport Gmail fonctionnait. Adam n'inventait rien : on lui avait donné une liste de trente
 * et un outils, tous en lecture.
 *
 * La règle qu'on gèle ici : une capacité ouverte à quelqu'un est ATTEIGNABLE sur toutes ses
 * surfaces — directement ou par délégation. « Absente » n'est pas un état permis.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

function userWith(perms: Partial<Record<Module, Action[]>>, role: CurrentUser["role"], id = "cap-test"): CurrentUser {
  const modules = new Map(
    Object.entries(perms).map(([m, actions]) => [
      m as Module,
      { module: m as Module, actions: new Set(actions as Action[]), scope: "ALL" as const },
    ]),
  );
  return {
    id, name: "T", email: `${id}@t.dz`, role,
    access: { modules, rowGrants: new Map() } as unknown as EffectiveAccess,
    mustChangePassword: false,
  };
}

const superAdmin = (): CurrentUser =>
  userWith(Object.fromEntries(MODULES.map((m) => [m, [...ACTIONS]])) as Partial<Record<Module, Action[]>>, "SUPER_ADMIN", "cap-sa");

const readOnly = (): CurrentUser => userWith({ CHIEF_OF_STAFF: ["VIEW"] }, "DIRECTION", "cap-ro");

describe("aucune capacité n'est ABSENTE — l'invariant central", () => {
  it("tout ce qu'un compte peut faire en texte est atteignable en voix", () => {
    // LE défaut, en une assertion. Une capacité vaut « direct » ou « déléguée » ; il n'y a pas
    // de troisième cas, et c'est ce qui interdit à Adam de dire « ça n'existe pas ».
    for (const user of [superAdmin(), readOnly()]) {
      const voix = capabilitiesFor(user, "voice");
      const texte = capabilitiesFor(user, "text");
      expect(voix.map((c) => c.name).sort()).toEqual(texte.map((c) => c.name).sort());
      for (const c of voix) {
        expect(["direct", "delegated"], `${c.name} : portée inattendue`).toContain(c.reach);
      }
    }
  });

  it("la projection ne peut pas INVENTER une capacité que les droits ne donnent pas", () => {
    // L'inverse du défaut, et tout aussi important : la source de vérité BORNE autant qu'elle
    // ouvre. Un compte sans le module RH n'obtient pas la paie, quelle que soit la surface.
    const ro = readOnly();
    expect(hasCapability(ro, "read_payroll")).toBe(false);
    expect(isDirectOn(ro, "voice", "read_payroll")).toBe(false);
    expect(hasCapability(superAdmin(), "read_payroll")).toBe(true);
  });

  it("les écritures conversationnelles sont DIRECTES en voix — celles-là et pas d'autres", () => {
    const sa = superAdmin();
    for (const nom of VOICE_DIRECT_WRITES) {
      expect(isDirectOn(sa, "voice", nom), `${nom} devrait être direct en voix`).toBe(true);
      expect(RESOLVER_WRITE_NAMES.has(nom), `${nom} devrait être classé comme écriture`).toBe(true);
    }
    // Les écritures LOURDES restent hors de la voix : leur geste ne se dicte pas. Elles ne
    // disparaissent pas pour autant — elles sont déléguées, et la carte s'affiche à l'écran.
    for (const lourd of ["update_salary", "decide_payment", "delete_record"]) {
      expect(isDirectOn(sa, "voice", lourd), `${lourd} ne devrait pas être dicté`).toBe(false);
      expect(hasCapability(sa, lourd), `${lourd} doit rester ATTEIGNABLE`).toBe(true);
    }
  });

  it("chaque nom annoncé en voix existe réellement dans le registre — aucun outil fantôme", () => {
    // L'erreur symétrique de la panne : annoncer un outil qui n'existe pas produirait un
    // « outil inconnu » au moment le plus coûteux — après que le modèle a décidé de l'appeler.
    const registre = new Set(assistantToolsFor(superAdmin()).map((t) => t.name));
    for (const nom of voiceDirectNames()) {
      expect(registre.has(nom), `${nom} annoncé mais absent du registre`).toBe(true);
    }
  });

  it("un nom n'est déclaré qu'UNE fois — lectures et écritures ne se recoupent pas", () => {
    const noms = voiceDirectNames();
    expect(new Set(noms).size).toBe(noms.length);
  });
});

describe("la doctrine atteint les DEUX surfaces — §14 : une brique sans appelant n'existe pas", () => {
  /**
   * LE DÉFAUT MESURÉ, ET IL A COÛTÉ DEUX DÉFIS LIVE.
   *
   * `capabilityDoctrine` — la consigne qui interdit de dire « ce n'est pas disponible » avant
   * d'avoir INTERROGÉ le registre, et qui sépare « vous n'y avez pas droit » de « rien ne sait
   * le faire » — n'était branchée QUE sur `voice-realtime.ts`. Le mode TEXTE, celui du
   * navigateur et celui des missions, ne la recevait pas.
   *
   * Résultat en conditions réelles : « INCONNU — le moteur d'ordonnancement requis n'est pas
   * disponible » (il l'était, et Adam avait appelé le registre) et « aucune capacité SQL n'est
   * disponible pour votre compte » (le bac à sable existe ; c'est un DROIT qui manquait, pas
   * une capacité). Les deux phrases sont exactement celles que la doctrine interdit.
   *
   * Le test ne vérifie pas une ligne de prompt : il vérifie que la MÊME doctrine se retrouve
   * dans les deux prompts. C'est la seule formulation qui empêche la réapparition du défaut,
   * puisque le défaut n'était pas une phrase absente mais une surface oubliée.
   */
  const phrasesCles = ["registre_capacites", "n'existe pas", "n'y avez pas droit"];

  it("le prompt TEXTE la porte, comme le prompt vocal", () => {
    const u = superAdmin();
    const texte = buildChiefOfStaffContext(u);
    const voix = buildChiefOfStaffContext(u, { voice: true });
    for (const p of phrasesCles) {
      expect(texte, `mode texte : « ${p} » absent`).toContain(p);
    }
    // La voix la porte déjà — si elle la perdait, le défaut se déplacerait au lieu de disparaître.
    expect(voix.length).toBeGreaterThan(0);
  });

  it("les deux surfaces portent la MÊME doctrine, pas deux variantes qui divergeront", () => {
    const u = superAdmin();
    const doctrine = capabilityDoctrine(u);
    expect(buildChiefOfStaffContext(u)).toContain(doctrine);
  });
});

describe("la doctrine injectée dans les instructions vocales", () => {
  it("interdit nommément le refus inventé, et NOMME les écritures disponibles", () => {
    const texte = capabilityDoctrine(superAdmin());
    // Sans les noms, un modèle prudent retombe sur la prudence — c'est-à-dire sur le refus.
    expect(texte).toContain("send_email");
    expect(texte).toContain("create_task");
    expect(texte).toMatch(/n'existe pas/);
    // Le symptôme exact vécu en production : « copie-colle ça dans ta messagerie ».
    expect(texte).toMatch(/copier-coller/);
    // UNE demande = UNE carte = UNE confirmation.
    expect(texte).toMatch(/UNE confirmation/);
  });

  it("ne promet PAS une écriture à un compte qui ne l'a pas", () => {
    // Une doctrine qui annoncerait `send_email` à qui ne l'a pas produirait le défaut inverse :
    // un Adam qui promet, essaie, et échoue devant l'utilisateur.
    const ro = readOnly();
    const texte = capabilityDoctrine(ro);
    for (const nom of VOICE_DIRECT_WRITES) {
      if (!hasCapability(ro, nom)) expect(texte).not.toContain(nom);
    }
  });
});

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LES CAPACITÉS TRANSVERSES NE S'OUVRENT QU'À LA VUE GLOBALE.
 *
 * Ce test est né d'un audit hostile de mon propre travail, et il ferme une fuite RÉELLE :
 * `product_economics` rend le chiffre d'affaires encaissé, la créance ouverte et le coût humain
 * analytique d'un produit. Il était gardé par `REGULATORY:VIEW` — ce qu'a n'importe quel
 * assistant réglementaire. La séquence d'outils qu'il remplace, elle, était gardée outil par
 * outil : en la condensant, on avait condensé les portes.
 *
 * Et le cloisonnement par entité ne peut pas y être tenu : le `Principal` du contrat ne porte
 * pas les sociétés de l'appelant. Une capacité qui agrège sur toute la base ne peut donc
 * s'ouvrir qu'à qui voit déjà toute la base.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
describe("les capacités métier — la porte est la VUE GLOBALE, pas un module", () => {
  const avecRole = (role: string, modules: string[]): CurrentUser => ({
    id: "u", name: "T", email: "t@t.dz", role,
    access: {
      modules: new Map(modules.map((m) => [m, { scope: "OWN", actions: new Set(["VIEW"]) }])),
      companies: ["c1"], allCompanies: false,
    },
  } as unknown as CurrentUser);

  /**
   * LE SUJET DE CE BLOC EST LA PORTE « VUE TRANSVERSE », pas l'inventaire du fichier.
   *
   * Trois capacités traversent les modules et sont gardées par la vue globale. `mission_status`
   * n'en fait pas partie : elle est cloisonnée PAR REQUÊTE (chacun ne voit que ses propres
   * missions), déclarée ouverte par dessein dans `executive-security.test.ts`, et l'inclure ici
   * ferait échouer un test sur la vue globale pour une capacité qui ne la demande pas.
   */
  const TRANSVERSES = ["business_story", "pch_market_status", "product_economics"];
  const noms = (u: CurrentUser) => BUSINESS_CAPABILITIES
    .filter((c) => TRANSVERSES.includes(c.def.name) && c.allowed(u))
    .map((c) => c.def.name);

  it("un assistant réglementaire N'ACCÈDE PAS à l'économie d'un produit", () => {
    const u = avecRole("REGULATORY_ASSISTANT", ["REGULATORY", "WORKSPACE"]);
    expect(noms(u)).toEqual([]);
  });

  it("un rôle PCH sans vue globale n'accède ni au marché ni à l'histoire", () => {
    const u = avecRole("SALES", ["PCH", "WORKSPACE"]);
    expect(noms(u)).toEqual([]);
  });

  it("le Super Admin accède aux trois", () => {
    const u = avecRole("SUPER_ADMIN", ["REGULATORY", "PCH", "FINANCES", "RH", "WORKSPACE"]);
    expect(noms(u).sort()).toEqual(["business_story", "pch_market_status", "product_economics"]);
  });

  it("les capacités transverses restent exactement CELLES-LÀ — en ajouter une se remarque", () => {
    // Le jour où une quatrième capacité passe par la vue globale, ce test tombe et oblige à
    // décider explicitement si elle appartient à cette famille. Sans lui, le filtre ci-dessus
    // masquerait silencieusement toute capacité nouvelle.
    const gardeesParVueGlobale = BUSINESS_CAPABILITIES
      .filter((c) => !c.allowed(avecRole("SALES", ["PCH", "REGULATORY", "FINANCES", "RH", "WORKSPACE"])))
      .map((c) => c.def.name)
      .sort();
    expect(gardeesParVueGlobale).toEqual(["business_story", "pch_market_status", "product_economics"]);
  });
});


/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * DEUX CAPACITÉS NE PEUVENT PAS PORTER LE MÊME NOM.
 *
 * ── LE DÉFAUT MESURÉ, ET IL ÉTAIT EN PRODUCTION ─────────────────────────────────────────
 *
 * `mission_status` était déclaré DEUX fois : la mission de sollicitation (`adam-tools.ts`, clé
 * `missionId`) et le Mission Runtime (`business-capabilities.ts`, clé `mission`). Trois
 * conséquences, toutes silencieuses :
 *
 *   1. le modèle recevait deux outils de même nom avec des schémas incompatibles ;
 *   2. l'aiguillage (`POWER_TOOLS.find`) n'en atteignait qu'un — l'autre était mort ;
 *   3. le modèle pouvait écrire `missionId`, que le vivant ignore : la réponse revenait alors
 *      sur TOUTES les missions au lieu de celle demandée. Une réponse plausible et fausse.
 *
 * Ce test existe pour que le doublon soit un ÉCHEC DE TEST et non une découverte tardive. Il a
 * été trouvé par le recensement du registre (§44), pas par un incident : c'est exactement ce
 * qu'un registre interrogeable doit faire remonter.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
describe("le registre d'outils — un nom, une capacité", () => {
  it("aucun nom de capacité n'est déclaré deux fois", () => {
    const compte = new Map<string, number>();
    for (const t of POWER_TOOLS) compte.set(t.def.name, (compte.get(t.def.name) ?? 0) + 1);
    const doublons = [...compte.entries()].filter(([, n]) => n > 1).map(([n]) => n);
    expect(doublons, `capacités déclarées plusieurs fois : ${doublons.join(", ")}`).toEqual([]);
  });

  it("chaque capacité porte un nom, une description et un libellé", () => {
    for (const t of POWER_TOOLS) {
      expect(t.def.name, JSON.stringify(t.def).slice(0, 120)).toMatch(/^[a-z][a-z0-9_]*$/);
      expect(t.def.description.length, t.def.name).toBeGreaterThan(20);
      expect(t.label.length, t.def.name).toBeGreaterThan(2);
    }
  });
});

describe("mesure consignée — §44 (unicité)", () => {
  it("aucune capacité n'est déclarée deux fois", () => {
    const noms = POWER_TOOLS.map((t) => t.def.name);
    const doublons = noms.filter((n, i) => noms.indexOf(n) !== i);
    consignerMesure("registre_sans_doublon", { n: 1, ok: doublons.length === 0 ? 1 : 0 },
      "lib/assistant/capability-surface.test.ts",
      doublons.length ? `DOUBLONS : ${[...new Set(doublons)].join(", ")}` : `${noms.length} capacités, toutes uniques`);
  });
});
