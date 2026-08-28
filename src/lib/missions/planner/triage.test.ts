import { describe, expect, it } from "vitest";
import { BUDGETS, budgetsDe, PROFILS, trier } from "@/lib/missions/planner/triage";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE TRIAGE — et l'asymétrie qui le gouverne.
 *
 * Se tromper vers le HAUT coûte ce qu'on payait déjà. Se tromper vers le BAS cache une capacité
 * au planificateur et produit un plan qui ne peut pas aboutir. Les deux erreurs n'ont pas le
 * même prix, donc les tests ne les traitent pas pareil : on éprouve surtout que les demandes
 * lourdes ne descendent JAMAIS.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

describe("le triage classe ce qu'il reconnaît, et rien d'autre", () => {
  it("une lecture nue en trois mots est DIRECTE", () => {
    expect(trier("Liste les congés en cours").profil).toBe("DIRECT");
    expect(trier("effectif du service").profil).toBe("DIRECT");
  });

  it("un ARBITRAGE descend au plus bas à SIMPLE — jamais à DIRECT", () => {
    // « pourquoi » et « lequel » demandent un jugement. Une lecture nue n'y répond pas, et le
    // chemin direct prétendrait le contraire.
    expect(trier("Lequel des dossiers est le plus urgent").profil).toBe("SIMPLE");
    expect(trier("Pourquoi ce dossier est bloqué").profil).toBe("SIMPLE");
  });

  it("une ÉCRITURE est au moins MOYENNE, même en trois mots", () => {
    const t = trier("Envoie le rapport");
    expect(t.ecriture).toBe(true);
    expect(["MOYEN", "COMPLEXE"]).toContain(t.profil);
  });

  it("un ÉVENTAIL est au moins MOYEN — « à chacun » multiplie l'exécution", () => {
    expect(trier("le point pour chacun des salaries").eventail).toBe(true);
    expect(trier("le point pour chacun des salaries").profil).not.toBe("DIRECT");
  });

  it("écriture ET éventail ensemble font COMPLEXE : c'est le cas « 33 messages »", () => {
    const t = trier("Envoie un message de bonne année à chacun des salariés");
    expect(t.profil).toBe("COMPLEXE");
  });

  it("une demande MULTI-SOURCES est COMPLEXE — elle impose elle-même d'explorer", () => {
    const t = trier(
      "Retrouve le document le plus récent. Commence par le Drive ; si tu n'y trouves pas de quoi "
      + "conclure, va chercher dans les autres sources disponibles.",
    );
    expect(t.multisource).toBe(true);
    expect(t.profil).toBe("COMPLEXE");
  });

  it("un ENCHAÎNEMENT compte, même sans écriture", () => {
    expect(trier("Lis le dossier puis résume-le").enchainement).toBe(true);
    expect(trier("Lis le dossier puis résume-le").profil).not.toBe("DIRECT");
  });
});

describe("ce que le triage NE fait pas", () => {
  it("il ne rend jamais DIRECT sur une phrase longue, même sans aucun signal", () => {
    // La longueur n'est pas un signal de difficulté ; c'est un signal d'INCERTITUDE. Une phrase
    // de vingt mots signifiants contient probablement une nuance que les marqueurs n'ont pas vue.
    const longue = "point situation dossiers produits marches documents fournisseurs contrats "
      + "budgets stocks equipes clients partenaires livraisons factures reglements echeances relances";
    const t = trier(longue);
    expect(t.motsUtiles).toBeGreaterThan(14);
    expect(t.profil).not.toBe("DIRECT");
  });

  it("il NOMME toujours ce qui a décidé — une décision muette ne se relit pas", () => {
    for (const d of ["Liste les congés", "Envoie le rapport", "Lequel est le plus urgent"]) {
      expect(trier(d).raisons.length, d).toBeGreaterThan(0);
    }
  });

  it("il est PUR : deux appels sur la même phrase rendent le même verdict", () => {
    const a = trier("Fais le point sur les tâches ouvertes");
    const b = trier("Fais le point sur les tâches ouvertes");
    expect(a).toEqual(b);
  });
});

describe("les budgets", () => {
  it("MOYEN et COMPLEXE gardent EXACTEMENT les valeurs d'avant ce lot", () => {
    /**
     * Ce test n'est pas de la prudence, c'est la condition de la mesure. Les trois scénarios du
     * banc Render sont MOYEN ou COMPLEXE ; si leurs budgets bougeaient en même temps que le
     * chemin direct arrivait, l'écart avant/après ne dirait plus lequel des deux l'a produit.
     */
    expect(BUDGETS.MOYEN.limite).toBe(28);
    expect(BUDGETS.MOYEN.maxDomaines).toBe(5);
    expect(BUDGETS.MOYEN.maxOutputTokens).toBe(8000);
    expect(BUDGETS.COMPLEXE.limite).toBe(28);
    expect(BUDGETS.COMPLEXE.maxDomaines).toBe(5);
  });

  it("le PLANCHER PAR DOMAINE n'est jamais réduit — c'est lui qui garde `directory_list`", () => {
    // Un run réel l'a montré : sans ce plancher, « envoie un message à chaque salarié » remplit
    // ses places avec de la messagerie et l'annuaire arrive vingt-neuvième. Le plan qui en sort
    // est cohérent et inexécutable.
    for (const p of PROFILS) expect(budgetsDe(p).parDomaine, p).toBe(3);
  });

  it("un profil léger montre MOINS de capacités, jamais moins de domaines que deux", () => {
    expect(BUDGETS.SIMPLE.limite).toBeLessThan(BUDGETS.MOYEN.limite);
    expect(BUDGETS.SIMPLE.maxDomaines).toBeGreaterThanOrEqual(2);
  });

  it("aucun profil ne touche au rôle de modèle — le champ n'existe pas", () => {
    // La garantie est STRUCTURELLE : un budget qui ne porte pas de rôle ne peut pas en changer.
    // C'est la traduction en type de « ne gagne pas de temps en baissant le cerveau ».
    for (const p of PROFILS) {
      expect(Object.keys(budgetsDe(p)).sort())
        .toEqual(["limite", "maxDomaines", "maxOutputTokens", "parDomaine"]);
    }
  });
});
