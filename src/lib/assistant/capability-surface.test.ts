import { describe, expect, it } from "vitest";
import type { CurrentUser } from "@/lib/session";
import type { EffectiveAccess, Module, Action } from "@/lib/rbac";
import { MODULES, ACTIONS } from "@/lib/rbac";
import { assistantToolsFor, RESOLVER_WRITE_NAMES } from "@/lib/assistant";
import { BUSINESS_CAPABILITIES } from "./business-capabilities";
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
