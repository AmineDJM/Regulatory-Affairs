import { describe, expect, it } from "vitest";
import { disponibilite, exigeConfirmation, fiche, nomOutil, schemaOutil, validerManifest, IDENTIFIANTS_INTERDITS } from "./manifest";
import { lireChemin, remplir, trous } from "./gabarit";
import { PLUGINS } from "./plugins";

/**
 * LE MANIFESTE (§36) — la déclaration est la seule chose que le cœur lit : ce qui est faux est dit,
 * rien n'est deviné ; un nom qui ressemble à une capacité de contrôle est refusé à la déclaration.
 */
const base = {
  id: "lire_commande", plugin: "demo", version: "1.0.0", titre: "Lire une commande", description: "Lit une commande.",
  primitive: "INFORMATION", effect: "READ", domaine: "FINANCE",
  entrees: { type: "object", properties: { numero: { type: "string" } }, required: ["numero"] },
  sorties: { description: "la commande", cles: ["numero", "montant"] },
  permissions: { module: "finance", action: "view" },
  risques: { niveau: "FAIBLE", irreversible: false, externe: true },
  cout: { latence: "MEDIUM" }, dependances: { config: ["DEMO_BASE_URL", "DEMO_TOKEN"] },
  executeur: { type: "http", base: "DEMO_BASE_URL", methode: "GET", chemin: "/orders/{{entree.numero}}", auth: { type: "bearer", config: "DEMO_TOKEN" } },
};

describe("validerManifest — tout ce qui est faux est dit", () => {
  it("accepte un manifeste complet et dérive le nom d'outil", () => {
    const v = validerManifest(base);
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(nomOutil(v.manifest)).toBe("demo_lire_commande");
    expect(exigeConfirmation(v.manifest)).toBe(false);
    expect(schemaOutil(v.manifest).properties).not.toHaveProperty("confirmer");
  });

  it("refuse : slug invalide, effet inconnu ou SECURITY_ADMIN, URL absolue dans le chemin, valeur en guise de nom de configuration, nom de contrôle", () => {
    const issuesDe = (patch: Record<string, unknown>) => { const v = validerManifest({ ...base, ...patch }); return v.ok ? [] : v.issues; };
    expect(issuesDe({ id: "Lire-Commande" }).join(" ")).toMatch(/slug/);
    expect(issuesDe({ effect: "MAGIQUE" }).join(" ")).toMatch(/effect/);
    expect(issuesDe({ effect: "SECURITY_ADMIN" }).join(" ")).toMatch(/SECURITY_ADMIN/);
    expect(issuesDe({ executeur: { ...base.executeur, chemin: "https://evil.example/x" } }).join(" ")).toMatch(/URL absolue/);
    expect(issuesDe({ dependances: { config: ["https://api.example.com"] } }).join(" ")).toMatch(/NOMS de variables/);
    expect(issuesDe({ id: "mission_control_total" }).join(" ")).toMatch(/interdit/);
    expect(issuesDe({ id: "approve_all" }).join(" ")).toMatch(/interdit/);
    expect(IDENTIFIANTS_INTERDITS.test("teach_me")).toBe(true);
    expect(IDENTIFIANTS_INTERDITS.test("tva_19")).toBe(false);
  });

  it("un code sans exemple ni validation n'a rien qui le juge : refusé ; avec un exemple, accepté", () => {
    const sans = validerManifest({ ...base, plugin: "adam", id: "tva", executeur: { type: "code", langage: "js", code: "return data.montant * 1.19;" } });
    expect(sans.ok).toBe(false);
    if (!sans.ok) expect(sans.issues.join(" ")).toMatch(/exemple/);
    const avec = validerManifest({ ...base, plugin: "adam", id: "tva", executeur: { type: "code", langage: "js", code: "return data.montant * 1.19;", exemple: { montant: 100 } } });
    expect(avec.ok).toBe(true);
    if (avec.ok) expect(nomOutil(avec.manifest)).toBe("skill_tva");
  });

  it("un playbook : alias uniques, douze étapes au plus, jamais un outil de contrôle", () => {
    const pb = (etapes: unknown[]) => validerManifest({ ...base, plugin: "teach", id: "point_du_matin", executeur: { type: "playbook", etapes } });
    expect(pb([{ alias: "a", outil: "directory_list", args: {} }, { alias: "a", outil: "list_tasks", args: {} }]).ok).toBe(false);
    expect(pb([{ alias: "a", outil: "teach_adam", args: {} }]).ok).toBe(false);
    expect(pb(Array.from({ length: 13 }, (_, i) => ({ alias: `e${i}`, outil: "directory_list", args: {} }))).ok).toBe(false);
    const ok = pb([{ alias: "annuaire", outil: "directory_list", args: { limit: 5 } }]);
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(nomOutil(ok.manifest)).toBe("playbook_point_du_matin");
  });

  it("un effet qui écrit exige la confirmation : le schéma gagne `confirmer`, la fiche le dit ; la disponibilité nomme les clés manquantes", () => {
    const v = validerManifest({ ...base, id: "creer_commande", effect: "FINANCIAL_COMMITMENT", executeur: { ...base.executeur, methode: "POST", corps: { numero: "{{entree.numero}}" } } });
    if (!v.ok) throw new Error(v.issues.join(" ; "));
    expect(exigeConfirmation(v.manifest)).toBe(true);
    expect(schemaOutil(v.manifest).properties).toHaveProperty("confirmer");
    const dispo = disponibilite(v.manifest, { DEMO_BASE_URL: "https://demo.example" });
    expect(dispo).toEqual({ ok: false, manquantes: ["DEMO_TOKEN"] });
    const f = fiche(v.manifest, dispo);
    expect(f).toMatch(/confirmer: true/);
    expect(f).toMatch(/NON CONFIGURÉ.*DEMO_TOKEN/);
    expect(f).not.toMatch(/https:\/\//);
  });
});

describe("les connecteurs déclarés — tous valides, tous nommés, aucun secret dans un manifeste", () => {
  it("DocuSign, SAP, HubSpot, IQVIA et PCH passent la validation, avec des noms d'outil distincts", () => {
    const noms = new Set<string>();
    for (const p of PLUGINS) {
      const v = validerManifest(p);
      expect(v.ok, `${p.plugin}/${p.id} : ${v.ok ? "" : v.issues.join(" ; ")}`).toBe(true);
      if (v.ok) noms.add(nomOutil(v.manifest));
    }
    expect(noms.size).toBe(PLUGINS.length);
    expect([...noms]).toEqual(expect.arrayContaining(["docusign_envoyer_pour_signature", "sap_lire_commande_achat", "hubspot_rechercher_contact", "iqvia_ventes_molecule", "pch_appels_d_offres", "slack_envoyer_message", "teams_envoyer_message", "whatsapp_envoyer_message", "sms_envoyer_message"]));
    expect(new Set(PLUGINS.map((p) => p.plugin)).size).toBe(9);
    // Aucune URL ni jeton en dur : la configuration est nommée, jamais écrite.
    expect(JSON.stringify(PLUGINS)).not.toMatch(/https?:\/\/|Bearer [A-Za-z0-9]/);
  });
  it("les écritures externes sont déclarées comme telles et exigent confirmation", () => {
    for (const p of PLUGINS) {
      if (/envoyer|creer|deposer/.test(p.id)) expect(exigeConfirmation(p)).toBe(true);
      else expect(exigeConfirmation(p)).toBe(false);
    }
  });
});

describe("l'exécuteur HTTP — authentification basique, corps de formulaire, base qui est la cible (§37)", () => {
  it("accepte un chemin vide (webhook), une auth basique par NOMS de configuration et un corps de formulaire ; refuse une forme de corps inconnue", () => {
    const ok = validerManifest({ ...base, id: "envoyer_message", plugin: "sms", effect: "EXTERNAL_COMMUNICATION", dependances: { config: ["SMS_BASE_URL", "SMS_SID", "SMS_TOKEN"] },
      executeur: { type: "http", base: "SMS_BASE_URL", methode: "POST", chemin: "", auth: { type: "basic", utilisateur: "SMS_SID", motDePasse: "SMS_TOKEN" }, corpsForme: "formulaire", corps: { To: "{{entree.numero}}" } } });
    expect(ok.ok, ok.ok ? "" : ok.issues.join(" ; ")).toBe(true);
    if (ok.ok && ok.manifest.executeur.type === "http") { expect(ok.manifest.executeur.chemin).toBe(""); expect(ok.manifest.executeur.corpsForme).toBe("formulaire"); expect(ok.manifest.executeur.auth?.type).toBe("basic"); }
    const mauvais = validerManifest({ ...base, executeur: { ...base.executeur, corpsForme: "xml" } });
    expect(mauvais.ok).toBe(false);
    if (!mauvais.ok) expect(mauvais.issues.join(" ")).toMatch(/corpsForme/);
    const sansSlash = validerManifest({ ...base, executeur: { ...base.executeur, chemin: "orders" } });
    expect(sansSlash.ok).toBe(false);
  });
});

describe("les gabarits — un trou garde son type, un texte est interpolé, un manque est compté", () => {
  it("remplit chaînes, objets et tableaux ; lit des chemins avec index", () => {
    const ctx = { entree: { numero: "45", lignes: [{ q: 2 }], montant: 1200 }, config: { COMPTE: "acc-1" } };
    expect(remplir("/orders/{{entree.numero}}?c={{config.COMPTE}}", ctx)).toEqual({ valeur: "/orders/45?c=acc-1", manquants: [] });
    expect(remplir({ montant: "{{entree.montant}}", lignes: "{{entree.lignes}}", label: "n° {{entree.numero}}" }, ctx).valeur).toEqual({ montant: 1200, lignes: [{ q: 2 }], label: "n° 45" });
    expect(remplir("{{entree.absent}}", ctx)).toEqual({ valeur: undefined, manquants: ["entree.absent"] });
    expect(lireChemin(ctx, "entree.lignes[0].q")).toBe(2);
    expect(trous({ a: "{{x.y}}", b: ["{{z}}", "{{x.y}}"] })).toEqual(["x.y", "z"]);
  });
});
