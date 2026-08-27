import { describe, expect, it } from "vitest";
import type { CurrentUser } from "@/lib/session";
import type { EffectiveAccess, Module, Action } from "@/lib/rbac";
import { MODULES, ACTIONS } from "@/lib/rbac";
import { assistantToolsFor, RESOLVER_WRITE_NAMES } from "@/lib/assistant";
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
