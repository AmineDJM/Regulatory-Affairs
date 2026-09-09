import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  MODELES_INTERDITS, MODELES_NON_SENSIBLES,
  interdictionGenerique, validerEntree, enFormulaire, chercherCapacites, motsUtiles,
} from "./generique";
import { scannerContrats } from "./contrat-scan";
import type { ContratAction } from "./contrat";

const contrat = (p: Partial<ContratAction>): ContratAction => ({
  id: "f:a", fichier: "f", fonction: "a", appel: "formulaire", champs: [],
  porte: { module: null, verbe: null, entite: null, gardes: [] },
  ecrit: true, modelesEcrits: [], audit: false, illisible: null, ...p,
});

describe("CHEMIN GÉNÉRIQUE — l'auto-escalade est refusée par CONSTRUCTION", () => {
  const vivants = scannerContrats();

  it("LE DÉFAUT MESURÉ : les actions de droits sont refusées, nommément", () => {
    // Ces six-là étaient en tête de la liste des actions atteignables SEULEMENT par la
    // dérivation. Elles sont la raison d'être de ce module.
    const par = new Map(vivants.map((c) => [c.id, c]));
    for (const id of [
      "admin-actions:updateUserRole", "admin-actions:setSecondaryRole",
      "access-actions:setRowGrants", "access-actions:setUserActive",
      "access-actions:revokeSession", "admin-actions:createUser",
    ]) {
      const c = par.get(id);
      expect(c, `${id} a disparu du parc — le test doit être mis à jour, pas supprimé`).toBeDefined();
      expect(interdictionGenerique(c!), id).not.toBeNull();
    }
  });

  it("`updateUserRole` — le cas EXACT que les motifs de `policy/guard.ts` laissent passer", () => {
    // Le camel-case : aucun de `\brole\b`, `_role`, `role_` ne s'accroche au milieu du mot.
    // Ici c'est le MODÈLE ÉCRIT qui refuse, et le nom ne sert que de filet.
    const parLeModele = contrat({ fonction: "quelqueChoseDInoffensif", modelesEcrits: ["user"] });
    expect(interdictionGenerique(parLeModele)).toMatch(/compte, le rôle ou le mot de passe/);
    const parLeNom = contrat({ fonction: "updateUserRole", modelesEcrits: [] });
    expect(interdictionGenerique(parLeNom)).toMatch(/un droit ou un identifiant/);
  });

  it("SABOTAGE — retirer un modèle de la liste rouvre la porte (l'assertion peut tomber)", () => {
    // §118.17 : une assertion dont on ne sait pas nommer le cas qui la ferait tomber n'en est
    // pas une. Voici ce cas : une action qui écrit un modèle ABSENT de la liste passe.
    expect(interdictionGenerique(contrat({ fonction: "faireUnTruc", modelesEcrits: ["rowGrant"] }))).not.toBeNull();
    expect(interdictionGenerique(contrat({ fonction: "faireUnTruc", modelesEcrits: ["bdProject"] }))).toBeNull();
  });

  it("une action métier ORDINAIRE n'est pas refusée — un refus à tort coûte plus cher", () => {
    const ordinaires = vivants.filter((c) => !c.illisible && !interdictionGenerique(c));
    expect(ordinaires.length).toBeGreaterThan(450);
    const par = new Map(vivants.map((c) => [c.id, c]));
    for (const id of ["bd-project-actions:createBdProject", "admin-request-actions:createRequest"]) {
      expect(interdictionGenerique(par.get(id)!), id).toBeNull();
    }
  });

  it("EXHAUSTIVITÉ : tout modèle du schéma qui SENT le droit est classé, dans un sens ou l'autre", () => {
    // Le garde-fou s'arme sur un fait du SCHÉMA, pas sur ma mémoire : un modèle de droits
    // ajouté demain fait échouer ce test au lieu d'ouvrir une porte en silence (§118.17).
    const schema = readFileSync(join(process.cwd(), "prisma", "schema.prisma"), "utf8");
    const modeles = [...schema.matchAll(/^model ([A-Za-z0-9_]+)/gm)].map((m) => m[1]!);
    const suspects = modeles.filter((m) =>
      /Access|Grant|Invite|Setting|Flag|Permission|Role/.test(m) || m === "User" || /Session$/.test(m));
    const nonClasses = suspects.filter((m) => {
      const camel = m.charAt(0).toLowerCase() + m.slice(1);
      return !(camel in MODELES_INTERDITS) && !(m in MODELES_NON_SENSIBLES);
    });
    expect(
      nonClasses,
      "Modèle du schéma qui porte identité/droit/session/réglage et n'est classé nulle part.\n"
      + "→ l'ajouter à MODELES_INTERDITS (refusé au chemin générique) ou à MODELES_NON_SENSIBLES "
      + "AVEC sa raison, dans src/lib/actions/generique.ts",
    ).toEqual([]);
    expect(suspects.length).toBeGreaterThan(10);
  });

  it("chaque exception porte une RAISON — une liste sans motif n'est pas relue", () => {
    for (const [m, raison] of Object.entries(MODELES_NON_SENSIBLES)) expect(raison.length, m).toBeGreaterThan(20);
    for (const [m, raison] of Object.entries(MODELES_INTERDITS)) expect(raison.length, m).toBeGreaterThan(10);
  });

  it("le refus NOMME le remède — jamais « je ne peux pas » tout court", () => {
    const r = interdictionGenerique(contrat({ modelesEcrits: ["userAccess"] }))!;
    expect(r).toMatch(/écran d'administration/);
    expect(r).toMatch(/refus de conception, pas une limite technique/);
  });
});

describe("CHEMIN GÉNÉRIQUE — une entrée se valide contre son contrat AVANT de partir", () => {
  const c = contrat({
    champs: [
      { nom: "titre", type: "texte", obligatoire: true, valeurs: null },
      { nom: "statut", type: "texte", obligatoire: false, valeurs: ["OUVERT", "CLOS"] },
      { nom: "libre", type: "texte", obligatoire: false, valeurs: null },
      { nom: "etiquette", type: "liste", obligatoire: false, valeurs: null },
    ],
  });

  it("un champ INCONNU est refusé — l'action l'ignorerait, et « c'est fait » serait faux", () => {
    const r = validerEntree(c, { titre: "x", inexistant: "y" });
    expect(r.map((x) => x.champ)).toEqual(["inexistant"]);
    expect(r[0]!.raison).toContain("titre, statut, libre, etiquette");
  });

  it("un champ OBLIGATOIRE manquant est refusé ici, pas après un aller-retour", () => {
    expect(validerEntree(c, { statut: "OUVERT" }).map((x) => x.champ)).toEqual(["titre"]);
  });

  it("une valeur hors de l'énum DÉCLARÉ est refusée, et le refus donne les valeurs", () => {
    const r = validerEntree(c, { titre: "x", statut: "en cours" });
    expect(r[0]!.raison).toContain("OUVERT, CLOS");
  });

  it("ce dont les valeurs n'ont PAS été lues passe — une garde qui refuse l'inconnu est désarmée", () => {
    expect(validerEntree(c, { titre: "x", libre: "n'importe quoi" })).toEqual([]);
  });

  it("une action ILLISIBLE refuse tout — elle ne porte aucun champ à valider", () => {
    const mystere = contrat({ illisible: "les noms de champs sont calculés à l'exécution", champs: [] });
    expect(validerEntree(mystere, {})).toHaveLength(1);
    expect(validerEntree(mystere, {})[0]!.raison).toMatch(/calculés à l'exécution/);
  });

  it("le formulaire distingue ABSENT et VIDE, et déplie une liste", () => {
    const fd = enFormulaire({ titre: "x", vide: "", rien: null, pasla: undefined, etiquette: ["a", "b"], oui: true, non: false });
    expect(fd.get("titre")).toBe("x");
    expect(fd.get("vide")).toBe("");        // écrit : « efface »
    expect(fd.has("rien")).toBe(false);      // absent : « ne touche pas »
    expect(fd.has("pasla")).toBe(false);
    expect(fd.getAll("etiquette")).toEqual(["a", "b"]);
    expect(fd.get("oui")).toBe("on");
    expect(fd.get("non")).toBe("");
  });
});

describe("CHEMIN GÉNÉRIQUE — la découverte trouve, et dit ce qu'elle ne fera pas", () => {
  const vivants = scannerContrats();

  it("une intention en français atteint l'action, sans alias écrit à la main", () => {
    const r = chercherCapacites(vivants, "créer un projet business development");
    expect(r.map((x) => x.contrat.id)).toContain("bd-project-actions:createBdProject");
  });

  it("une capacité INTERDITE est rendue AVEC son motif, jamais tue", () => {
    // La taire ferait répondre « je ne trouve rien » là où la vérité est « je l'ai trouvée et
    // je n'y touche pas » — le « je ne peux pas » artificiel que ce dépôt a déjà payé.
    const r = chercherCapacites(vivants, "changer le rôle d'un utilisateur", 20);
    const roles = r.filter((x) => x.interdiction);
    expect(roles.length).toBeGreaterThan(0);
    expect(roles[0]!.interdiction).toMatch(/administration/);
  });

  it("une phrase sans intention ne rend RIEN — pas de faux positif qui pousse le modèle", () => {
    expect(chercherCapacites(vivants, "")).toEqual([]);
    expect(chercherCapacites(vivants, "le la les de du")).toEqual([]);
  });

  it("les mots vides sont retirés, les accents repliés", () => {
    expect(motsUtiles("Crée un dossier réglementaire pour le produit")).toEqual(
      ["cree", "dossier", "reglementaire", "produit"]);
  });
});
