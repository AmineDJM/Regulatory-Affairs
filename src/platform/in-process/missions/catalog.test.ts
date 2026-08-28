import { describe, expect, it } from "vitest";
import type { CurrentUser } from "@/lib/session";
import { MODULES, type Action, type EffectiveAccess, type Module } from "@/lib/rbac";
import { DECLARED } from "@/lib/missions/registry/capability-meta";
import { catalogueDe, acteurDe } from "@/platform/in-process/missions/catalog";
import { resoudreCapacites } from "@/lib/missions/registry/resolve";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE CATALOGUE EST-IL CELUI DE LA PERSONNE — et les capacités déclarées EXISTENT-ELLES ?
 *
 * ── LA PANNE QUI A PRODUIT CE FICHIER ────────────────────────────────────────────────────
 *
 * `capability-meta.ts` déclarait `send_erp_message`, `notify_person`, `create_task_request` et
 * `prepare_mail`. Aucun de ces quatre outils n'existe. Rien ne tombait : `capabilityMeta` dérive
 * prudemment un nom inconnu, et la dérivation prudente marque `batchable: false`.
 *
 * La conséquence n'était pas théorique. Le compilateur aurait REFUSÉ le déploiement en éventail
 * de la mission la plus banale du produit — « écris à chaque salarié » — avec un message parlant
 * d'une capacité qui n'existe nulle part. Quatre tests du runtime passaient au vert sur ces
 * noms-là : ils prouvaient que le moteur savait exécuter un outil imaginaire.
 *
 * ── CE QUE CE FICHIER INTERDIT DÉSORMAIS ─────────────────────────────────────────────────
 *
 * Qu'une capacité soit DÉCLARÉE sans exister. C'est la seule table du runtime qui prétend
 * décrire le monde extérieur ; une entrée fausse y est plus dangereuse qu'une entrée absente,
 * parce qu'une entrée absente est traitée avec prudence tandis qu'une entrée fausse fait foi.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

function utilisateur(role: CurrentUser["role"], modules: readonly Module[] = MODULES): CurrentUser {
  const actions: Action[] = ["VIEW", "CREATE", "UPDATE", "DELETE", "VALIDATE", "EXPORT", "UPLOAD"];
  const carte = new Map(
    modules.map((m) => [m, { module: m, actions: new Set(actions), scope: "ALL" as const }]),
  );
  return {
    id: `u-${role}`,
    name: role === "SUPER_ADMIN" ? "Le PDG" : "Un collègue",
    email: `${role.toLowerCase()}@amd.dz`,
    role,
    access: { modules: carte, rowGrants: new Map() } as unknown as EffectiveAccess,
    mustChangePassword: false,
  };
}

describe("le catalogue réel — ce qu'une mission peut atteindre", () => {
  it("TOUTE capacité DÉCLARÉE existe réellement dans le registre d'outils", () => {
    const pdg = utilisateur("SUPER_ADMIN");
    const catalogue = catalogueDe(pdg);
    const fantomes = Object.keys(DECLARED).filter((nom) => !catalogue.has(nom));

    expect(
      fantomes,
      `Ces capacités sont déclarées dans capability-meta.ts mais n'existent dans AUCUN outil : `
      + `${fantomes.join(", ")}. Une déclaration fausse fait AUTORITÉ (elle court-circuite la `
      + `dérivation prudente) : elle est donc plus dangereuse qu'une absence de déclaration.`,
    ).toEqual([]);
  });

  it("le catalogue d'une personne EST la liste de ses outils — ni plus, ni moins", () => {
    const pdg = utilisateur("SUPER_ADMIN");
    const catalogue = catalogueDe(pdg);
    expect(catalogue.taille).toBeGreaterThan(50);

    // Chaque brief correspond à un outil que le catalogue reconnaît. Si l'un ne l'était pas, le
    // planner pourrait proposer une capacité que le compilateur refuserait ensuite — un plan
    // refusé pour une raison que le planner ne pouvait pas anticiper.
    for (const b of catalogue.brief(acteurDe(pdg))) {
      expect(catalogue.has(b.id), b.id).toBe(true);
      expect(b.summary.length, b.id).toBeGreaterThan(3);
    }
  });

  it("UN CATALOGUE NE SERT QU'À SON PROPRIÉTAIRE — un autre acteur n'obtient rien", () => {
    const pdg = utilisateur("SUPER_ADMIN");
    const catalogue = catalogueDe(pdg);
    const intrus = { userId: "quelqu-un-dautre", label: "Intrus", isAgent: false };

    // C'est la garde qui empêche un catalogue mis en cache par erreur d'accorder les droits de
    // la personne précédente. Sans elle, l'élévation de privilège serait invisible.
    expect(catalogue.allowed("directory_list", intrus)).toBe(false);
    expect(catalogue.brief(intrus)).toEqual([]);
    expect(catalogue.allowed("directory_list", acteurDe(pdg))).toBe(true);
  });

  it("UN COMPTE SANS DROITS a un catalogue strictement plus petit que celui du PDG", () => {
    const pdg = catalogueDe(utilisateur("SUPER_ADMIN"));
    const viewer = catalogueDe(utilisateur("VIEWER", []));

    expect(viewer.taille).toBeLessThan(pdg.taille);
    // La liste RH complète est une EXTRACTION : elle se réserve à ceux qui ont déjà le personnel.
    expect(viewer.has("directory_list")).toBe(false);
    expect(pdg.has("directory_list")).toBe(true);
  });

  it("§3 — le résolveur montre une FRACTION du catalogue, et les bons domaines", () => {
    const pdg = utilisateur("SUPER_ADMIN");
    const catalogue = catalogueDe(pdg);
    const r = resoudreCapacites(
      "Pour tous les salariés actifs, envoie individuellement à chacun un message de bonne année sur la messagerie ERP.",
      catalogue,
      acteurDe(pdg),
    );

    // LE POINT DE §3 : on ne déverse pas le catalogue. La borne est stricte, pas décorative.
    expect(r.metriques.plannerCapabilitiesExposed).toBeLessThan(r.metriques.capacitesAutorisees);
    expect(r.metriques.plannerCapabilitiesExposed).toBeLessThanOrEqual(28);
    expect(r.metriques.jetonsEvites).toBeGreaterThan(0);

    // Et les capacités NÉCESSAIRES sont bien là — sinon l'économie serait payée d'un plan faux.
    const montrees = r.capacites.map((c) => c.id);
    expect(montrees).toContain("send_message");
    expect(montrees.some((m) => m === "directory_list" || m === "search_people")).toBe(true);
  });

  it("une demande DOCUMENTAIRE ne montre pas les mêmes capacités qu'une demande d'ENVOI", () => {
    const pdg = utilisateur("SUPER_ADMIN");
    const catalogue = catalogueDe(pdg);
    const envoi = resoudreCapacites("envoie un message à chaque salarié", catalogue, acteurDe(pdg));
    const drive = resoudreCapacites("cherche les courriers non classés dans le Drive", catalogue, acteurDe(pdg));

    // Si le résolveur rendait la même chose pour deux demandes sans rapport, il ne résoudrait
    // rien : il ferait seulement semblant de réduire.
    const a = new Set(envoi.capacites.map((c) => c.id));
    const b = new Set(drive.capacites.map((c) => c.id));
    const communes = [...a].filter((x) => b.has(x)).length;
    expect(communes).toBeLessThan(Math.min(a.size, b.size));
  });
});
