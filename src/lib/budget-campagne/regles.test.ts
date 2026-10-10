import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  TRANSITIONS_CAMPAGNE, peutPasserCampagne, verifierCloture, etapeCourante, gestePermis, statutApres, issueDesVotes,
  valideursEnAttente, ecartPct, justificationRequise, lignesSansJustification, montantRetenu, aDesAjustements,
  projeter12Mois, diffVersions, resumeDiff, decisionsApresResoumission, planEnveloppe, fusionnerPrefill, droitsCampagne,
  peutPreparer, domaineParDefaut, STATUTS_CAMPAGNE,
  type ContexteGeste, type StatutProposition, type Vote, type CategorieExistante, type LignePourEnveloppe, type EntreeDroits,
} from "./regles";
import { PERMISSIONS } from "@/lib/rbac";
import { MODULE_LABELS, NAVIGATION } from "@/lib/labels";

const ctx = (statut: StatutProposition, o: Partial<ContexteGeste> = {}): ContexteGeste => ({
  statutCampagne: "OPEN", statut, revisionAutorisee: false, allowRectificatif: false, estRectificatif: false, ...o,
});

describe("la campagne — ses étapes", () => {
  it("avance d'un pas, recule d'un pas avant la clôture, jamais après", () => {
    expect(peutPasserCampagne("DRAFT", "OPEN")).toBe(true);
    expect(peutPasserCampagne("DRAFT", "REVIEW")).toBe(false);
    expect(peutPasserCampagne("OPEN", "REVIEW")).toBe(true);
    expect(peutPasserCampagne("REVIEW", "OPEN")).toBe(true);
    expect(peutPasserCampagne("REVIEW", "ARBITRAGE")).toBe(true);
    expect(peutPasserCampagne("ARBITRAGE", "CLOSED")).toBe(true);
    for (const s of STATUTS_CAMPAGNE) expect(peutPasserCampagne("CLOSED", s)).toBe(false);
    expect(TRANSITIONS_CAMPAGNE.CLOSED).toEqual([]);
  });

  it("clore exige que chaque proposition soit tranchée", () => {
    expect(verifierCloture(["ACCEPTE", "REFUSE", "ACCEPTE_AVEC_AJUSTEMENTS"]).ok).toBe(true);
    const v = verifierCloture(["ACCEPTE", "SOUMIS", "A_REVOIR"]);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.raison).toContain("2 proposition");
  });

  it("la frise : l'arbitrage tout tranché est l'étape de validation", () => {
    expect(etapeCourante("DRAFT", [])).toBe(0);
    expect(etapeCourante("OPEN", [])).toBe(1);
    expect(etapeCourante("ARBITRAGE", ["SOUMIS"])).toBe(3);
    expect(etapeCourante("ARBITRAGE", ["ACCEPTE"])).toBe(4);
    expect(etapeCourante("CLOSED", ["ACCEPTE"])).toBe(5);
  });
});

describe("la proposition — la machine à états", () => {
  it("le pôle prépare tant que c'est en préparation ou à revoir ; pas en brouillon de campagne", () => {
    expect(gestePermis("MODIFIER", ctx("EN_PREPARATION")).ok).toBe(true);
    expect(gestePermis("SOUMETTRE", ctx("A_REVOIR")).ok).toBe(true);
    expect(gestePermis("SOUMETTRE", ctx("SOUMIS")).ok).toBe(false);
    expect(gestePermis("MODIFIER", ctx("ACCEPTE")).ok).toBe(false);
    expect(gestePermis("MODIFIER", ctx("EN_PREPARATION", { statutCampagne: "DRAFT" })).ok).toBe(false);
    expect(gestePermis("MODIFIER", ctx("EN_PREPARATION", { statutCampagne: "CLOSED" })).ok).toBe(false);
  });

  it("les valideurs ne décident que sur une version soumise", () => {
    for (const g of ["DECIDER_LIGNE", "VOTER", "RENVOYER"] as const) {
      expect(gestePermis(g, ctx("SOUMIS")).ok).toBe(true);
      for (const s of ["EN_PREPARATION", "A_REVOIR", "ACCEPTE", "REFUSE"] as const) expect(gestePermis(g, ctx(s)).ok, `${g} ${s}`).toBe(false);
    }
  });

  it("plusieurs allers-retours : préparation → v1 → à revoir → v2 → à revoir → v3 → acceptée", () => {
    let statut: StatutProposition = "EN_PREPARATION";
    let version = 0;
    for (let tour = 1; tour <= 3; tour++) {
      expect(gestePermis("SOUMETTRE", ctx(statut)).ok).toBe(true);
      statut = statutApres("SOUMETTRE"); version++;
      expect(statut).toBe("SOUMIS");
      if (tour < 3) {
        expect(gestePermis("RENVOYER", ctx(statut)).ok).toBe(true);
        statut = statutApres("RENVOYER");
        expect(statut).toBe("A_REVOIR");
      }
    }
    const issue = issueDesVotes({ votes: [{ userId: "dg", decision: "ACCEPTE", at: 1 }, { userId: "sa", decision: "ACCEPTE", at: 2 }], validatorIds: ["dg", "sa"], regle: "ALL", ajustements: false });
    expect(issue).toBe("ACCEPTE");
    expect(version).toBe(3);
  });

  it("un refus se reprend (retour à revoir) ; une proposition acceptée ne se reprend pas", () => {
    expect(gestePermis("REPRENDRE", ctx("REFUSE", { statutCampagne: "ARBITRAGE" })).ok).toBe(true);
    expect(statutApres("REPRENDRE")).toBe("A_REVOIR");
    expect(gestePermis("REPRENDRE", ctx("ACCEPTE")).ok).toBe(false);
    expect(gestePermis("REPRENDRE", ctx("REFUSE", { statutCampagne: "CLOSED" })).ok).toBe(false);
  });

  it("RECTIFICATIF : interdit par défaut ; permis si le Super Admin l'autorise (ou la campagne) ; la version se re-valide", () => {
    const valide = ctx("ACCEPTE", { statutCampagne: "CLOSED" });
    expect(gestePermis("ROUVRIR_RECTIFICATIF", valide).ok).toBe(false);
    expect(gestePermis("AUTORISER_REVISION", valide).ok).toBe(true);
    expect(gestePermis("ROUVRIR_RECTIFICATIF", { ...valide, revisionAutorisee: true }).ok).toBe(true);
    expect(gestePermis("ROUVRIR_RECTIFICATIF", { ...valide, allowRectificatif: true }).ok).toBe(true);
    expect(gestePermis("ROUVRIR_RECTIFICATIF", ctx("SOUMIS", { revisionAutorisee: true })).ok).toBe(false);
    // Rouverte : à revoir, sur une campagne close — le rectificatif se prépare et se soumet quand même.
    expect(statutApres("ROUVRIR_RECTIFICATIF")).toBe("A_REVOIR");
    const rouverte = ctx("A_REVOIR", { statutCampagne: "CLOSED", estRectificatif: true });
    expect(gestePermis("MODIFIER", rouverte).ok).toBe(true);
    expect(gestePermis("SOUMETTRE", rouverte).ok).toBe(true);
    expect(gestePermis("VOTER", { ...rouverte, statut: "SOUMIS" }).ok).toBe(true);
  });
});

describe("la règle des valideurs", () => {
  const v = (userId: string, decision: Vote["decision"], at: number): Vote => ({ userId, decision, at });
  it("ALL : il faut l'accord de chacun ; un refus suffit à refuser", () => {
    expect(issueDesVotes({ votes: [v("dg", "ACCEPTE", 1)], validatorIds: ["dg", "sa"], regle: "ALL", ajustements: false })).toBeNull();
    expect(issueDesVotes({ votes: [v("dg", "ACCEPTE", 1), v("sa", "ACCEPTE", 2)], validatorIds: ["dg", "sa"], regle: "ALL", ajustements: true })).toBe("ACCEPTE_AVEC_AJUSTEMENTS");
    expect(issueDesVotes({ votes: [v("dg", "ACCEPTE", 1), v("sa", "REFUSE", 2)], validatorIds: ["dg", "sa"], regle: "ALL", ajustements: false })).toBe("REFUSE");
  });
  it("ALL : le dernier avis de chacun compte (un avis se change)", () => {
    expect(issueDesVotes({ votes: [v("sa", "REFUSE", 1), v("sa", "ACCEPTE", 3), v("dg", "ACCEPTE", 2)], validatorIds: ["dg", "sa"], regle: "ALL", ajustements: false })).toBe("ACCEPTE");
  });
  it("ANY : le premier avis tranche", () => {
    expect(issueDesVotes({ votes: [v("sa", "REFUSE", 2), v("dg", "ACCEPTE", 1)], validatorIds: ["dg", "sa"], regle: "ANY", ajustements: false })).toBe("ACCEPTE");
    expect(issueDesVotes({ votes: [v("sa", "REFUSE", 1)], validatorIds: ["dg", "sa"], regle: "ANY", ajustements: false })).toBe("REFUSE");
  });
  it("seuls les valideurs DÉSIGNÉS comptent ; sans valideur rien ne se décide", () => {
    expect(issueDesVotes({ votes: [v("intrus", "ACCEPTE", 1)], validatorIds: ["dg"], regle: "ANY", ajustements: false })).toBeNull();
    expect(issueDesVotes({ votes: [v("dg", "ACCEPTE", 1)], validatorIds: [], regle: "ANY", ajustements: false })).toBeNull();
    expect(valideursEnAttente([v("dg", "ACCEPTE", 1)], ["dg", "sa"])).toEqual(["sa"]);
  });
});

describe("écarts, justification, montants retenus", () => {
  it("l'écart en % et le seuil (strictement au-delà)", () => {
    expect(ecartPct(100, 105)).toBe(5);
    expect(ecartPct(0, 10)).toBeNull();
    expect(justificationRequise(100, 105, 5)).toBe(false);
    expect(justificationRequise(100, 105.5, 5)).toBe(true);
    expect(justificationRequise(100, 94, 5)).toBe(true);
    expect(justificationRequise(0, 10, 5)).toBe(true);
    expect(justificationRequise(0, 0, 5)).toBe(false);
    expect(justificationRequise(100, 108, 10)).toBe(false);
  });
  it("les lignes à justifier sont nommées ; une justification blanche ne compte pas", () => {
    const l = [
      { key: "a", realise2026: 100, propose: 120, justification: "  " },
      { key: "b", realise2026: 100, propose: 120, justification: "2 KAM" },
      { key: "c", realise2026: 100, propose: 101, justification: null },
    ];
    expect(lignesSansJustification(l, 5)).toEqual(["a"]);
  });
  it("le retenu : refusé = 0, ajusté = le montant ajusté ; les ajustements font « avec ajustements »", () => {
    expect(montantRetenu({ propose: 29, ajuste: 26, decision: "AJUSTE" })).toBe(26);
    expect(montantRetenu({ propose: 29, ajuste: null, decision: "REFUSE" })).toBe(0);
    expect(montantRetenu({ propose: 29, ajuste: null, decision: "QUESTION" })).toBe(29);
    expect(aDesAjustements([{ propose: 29, ajuste: 29, decision: "AJUSTE" }])).toBe(false);
    expect(aDesAjustements([{ propose: 29, ajuste: 26, decision: "AJUSTE" }])).toBe(true);
  });
});

describe("la projection sur 12 mois (pré-remplissage)", () => {
  it("ramène le réalisé à une année pleine, au moins un mois compté", () => {
    expect(projeter12Mois(600, 2026, new Date(Date.UTC(2026, 6, 2)))).toBeGreaterThan(1180);
    expect(projeter12Mois(600, 2026, new Date(Date.UTC(2026, 6, 2)))).toBeLessThan(1220);
    expect(projeter12Mois(100, 2026, new Date(Date.UTC(2026, 0, 3)))).toBe(1200);
    expect(projeter12Mois(500, 2026, new Date(Date.UTC(2027, 2, 1)))).toBe(500);
    expect(projeter12Mois(0, 2026, new Date())).toBe(0);
  });
  it("une fusion rejouée n'écrase jamais un montant saisi, ni une ligne saisie", () => {
    const r = fusionnerPrefill(
      [{ key: "PAIE", source: "AUTO_PAIE", propose: 150, justification: null }, { key: "SAISIE:x", source: "SAISIE", propose: 10, justification: null }, { key: "BV_25", source: "AUTO_BV", propose: 0, justification: null }],
      [
        { key: "PAIE", label: "Masse salariale", categoryKey: null, source: "AUTO_PAIE", realise2026: 130, propose: 146 },
        { key: "BV_25", label: "BV", categoryKey: "BV_25", source: "AUTO_BV", realise2026: 5, propose: 8, justification: "x" },
        { key: "CAT:vehicules", label: "Véhicules", categoryKey: null, source: "REALISE_2026", realise2026: 24, propose: 24 },
      ],
    );
    expect(r.creer.map((l) => l.key)).toEqual(["CAT:vehicules"]);
    expect(r.maj.find((x) => x.key === "PAIE")).toEqual({ key: "PAIE", realise2026: 130, source: "AUTO_PAIE" });
    expect(r.maj.find((x) => x.key === "BV_25")).toMatchObject({ propose: 8, justification: "x" });
  });
});

describe("les versions", () => {
  it("le diff et son résumé exact", () => {
    const d = diffVersions(
      [{ key: "a", label: "Déplacements", propose: 19_000_000 }, { key: "b", label: "Véhicules", propose: 29_000_000 }],
      [{ key: "a", label: "Déplacements", propose: 17_500_000 }, { key: "c", label: "Formation", propose: 1_000_000 }],
    );
    expect(d.modifiees).toEqual([{ key: "a", label: "Déplacements", de: 19_000_000, a: 17_500_000 }]);
    expect(d.ajoutees.map((l) => l.key)).toEqual(["c"]);
    expect(d.retirees.map((l) => l.key)).toEqual(["b"]);
    const s = resumeDiff(1, 2, d).replace(/[  ]/g, " ");
    expect(s).toContain("v1 → v2");
    expect(s).toContain("19 000 000 → 17 500 000");
  });
  it("après resoumission : question rendue, montant changé à revoir, inchangé garde sa décision", () => {
    const r = decisionsApresResoumission(new Map([["a", 10], ["b", 20], ["c", 30]]), [
      { key: "a", propose: 10, decision: "ACCEPTE", ajuste: null },
      { key: "b", propose: 25, decision: "AJUSTE", ajuste: 18 },
      { key: "c", propose: 30, decision: "QUESTION", ajuste: null },
    ]);
    expect(r).toEqual([
      { key: "a", decision: "ACCEPTE", ajuste: null },
      { key: "b", decision: null, ajuste: null },
      { key: "c", decision: null, ajuste: null },
    ]);
  });
});

describe("l'enveloppe de l'année — idempotente", () => {
  const lignes: LignePourEnveloppe[] = [
    { key: "BV_25", label: "BV 25 %", categoryKey: "BV_25", categoryLineId: null, montant: 8 },
    { key: "VEH", label: "Véhicules", categoryKey: null, categoryLineId: null, montant: 26 },
    { key: "ZERO", label: "Rien", categoryKey: null, categoryLineId: null, montant: 0 },
  ];
  it("crée les catégories une fois ; rejouée sur son résultat, ne fait plus rien", () => {
    const p1 = planEnveloppe(lignes, []);
    expect(p1.creer).toEqual([{ key: "BV_25", nom: "BV 25 %", cle: "BV_25", allocated: 8 }, { key: "VEH", nom: "Véhicules", cle: null, allocated: 26 }]);
    expect(p1.total).toBe(34);
    // Ce que l'écriture produit :
    const cats: CategorieExistante[] = p1.creer.map((c, i) => ({ id: `c${i}`, name: c.nom, cle: c.cle, allocated: c.allocated, parentId: null }));
    const liees = lignes.map((l) => ({ ...l, categoryLineId: cats.find((c) => c.name === l.label)?.id ?? null }));
    const p2 = planEnveloppe(liees, cats, cats.map((c) => c.id));
    expect(p2.creer).toEqual([]);
    expect(p2.majCategories).toEqual([]);
    expect(p2.liens).toEqual([]);
    // Même sans les liens gardés (une ligne perdue), on retrouve par clé ou par nom — jamais de doublon.
    const p3 = planEnveloppe(lignes, cats);
    expect(p3.creer).toEqual([]);
    expect(p3.liens.length).toBe(2);
  });
  it("le rectificatif met à jour les allocations et met à zéro une catégorie dont la ligne a disparu", () => {
    const cats: CategorieExistante[] = [
      { id: "c0", name: "BV 25 %", cle: "BV_25", allocated: 8, parentId: null },
      { id: "c1", name: "Véhicules", cle: null, allocated: 26, parentId: null },
    ];
    const p = planEnveloppe([{ key: "BV_25", label: "BV 25 %", categoryKey: "BV_25", categoryLineId: "c0", montant: 10 }], cats, ["c0", "c1"]);
    expect(p.majCategories).toEqual([
      { categoryId: "c0", key: "BV_25", nom: "BV 25 %", de: 8, a: 10 },
      { categoryId: "c1", key: null, nom: "Véhicules", de: 26, a: 0 },
    ]);
    expect(p.creer).toEqual([]);
  });
});

describe("les droits — le cadrage reste privé", () => {
  const base: EntreeDroits = { userId: "u", estSuperAdmin: false, estDG: false, voitTout: false, peutPiloter: false, validatorIds: ["dg", "sa"], polesTenus: [] };
  it("un responsable de pôle prépare SON pôle et ne voit ni la vue Direction ni le cadrage", () => {
    const e = { ...base, polesTenus: ["dep-ops"] };
    const d = droitsCampagne(e);
    expect(d.voitVueDG).toBe(false);
    expect(d.voitLeCadrage).toBe(false);
    expect(peutPreparer(e, "dep-ops")).toBe(true);
    expect(peutPreparer(e, "dep-mkt")).toBe(false);
  });
  it("les Finances (lecture, portée tout) voient la Direction sans le cadrage", () => {
    const d = droitsCampagne({ ...base, voitTout: true });
    expect(d.voitVueDG).toBe(true);
    expect(d.voitLeCadrage).toBe(false);
  });
  it("le DG, les valideurs et le Super Admin voient le cadrage ; seul le Super Admin autorise une révision", () => {
    expect(droitsCampagne({ ...base, estDG: true }).voitLeCadrage).toBe(true);
    expect(droitsCampagne({ ...base, userId: "sa" }).voitLeCadrage).toBe(true);
    expect(droitsCampagne({ ...base, estSuperAdmin: true }).peutAutoriserRevision).toBe(true);
    expect(droitsCampagne({ ...base, estDG: true, peutPiloter: true }).peutAutoriserRevision).toBe(false);
  });
  it("le domaine d'un pôle se devine de son nom", () => {
    expect(domaineParDefaut("Direction Marketing")).toBe("MARKETING");
    expect(domaineParDefaut("Regulatory Affairs")).toBe("REGULATORY");
    expect(domaineParDefaut("Operations & Sales")).toBe("OPERATIONS");
    expect(domaineParDefaut("Ressources humaines")).toBe("GENERAL");
  });
});

describe("le module dans les accès et le menu", () => {
  it("défauts : Direction et DG pilotent, les Finances lisent, les autres rien", () => {
    for (const r of ["DIRECTION", "GENERAL_MANAGER", "SUPER_ADMIN"] as const) expect(PERMISSIONS[r].BUDGET_CAMPAIGN, r).toEqual(expect.arrayContaining(["VIEW", "CREATE", "UPDATE"]));
    expect(PERMISSIONS.FINANCE_BUDGET_MANAGER.BUDGET_CAMPAIGN).toEqual(["VIEW", "EXPORT"]);
    for (const r of ["OPERATIONS_DIRECTOR", "HEAD_OF_REGULATORY", "PRODUCT_MANAGER", "MEDICAL_DELEGATE", "VIEWER"] as const) expect(PERMISSIONS[r].BUDGET_CAMPAIGN, r).toBeUndefined();
  });
  it("libellé, entrée de menu, et la page garde sa porte", () => {
    expect(MODULE_LABELS.BUDGET_CAMPAIGN).toBe("Campagne budgétaire");
    expect(NAVIGATION.find((n) => n.href === "/budget-campagne")?.module).toBe("BUDGET_CAMPAIGN");
    expect(readFileSync(join(process.cwd(), "src/app/(app)/budget-campagne/page.tsx"), "utf8")).toContain('requireModule("BUDGET_CAMPAIGN")');
  });
});
