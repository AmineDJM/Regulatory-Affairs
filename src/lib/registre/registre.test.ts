import { describe, expect, it } from "vitest";

import {
  AUCUNE_MESURE, composerFiche, detecterManque, interroger, sommaireRegistre,
  type FicheCapacite, type MatiereFiche, type Mesures,
} from "@/lib/registre/fiche";
import { classer, feuilleDeRoute, SENS_MANQUE, type Manque } from "@/lib/registre/manques";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * CE QUE CES TESTS TIENNENT (mandat 6 §44).
 *
 * Deux invariants, et ils sont plus importants que la couverture :
 *
 *   1. UNE CAPACITÉ NON MESURÉE N'EST PAS UNE CAPACITÉ FIABLE. Le jour où `taux` vaudra `1`
 *      par défaut, le registre deviendra un catalogue publicitaire et le planificateur choisira
 *      les capacités jamais essayées en premier.
 *   2. « RIEN NE SAIT FAIRE ÇA » ET « VOUS N'Y AVEZ PAS DROIT » NE SE CONFONDENT PAS. Le premier
 *      est une dette technique, le second une décision de sécurité qui a fonctionné. Les ranger
 *      ensemble, c'est la raison pour laquelle une feuille de route ne sort jamais des incidents.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const matiere = (o: Partial<MatiereFiche> & { id: string }): MatiereFiche => ({
  domaine: "platform", primitive: "INFORMATION", effet: "READ", rejouable: true, groupable: true,
  confirmation: "NEVER", latence: "LOW", contrat: "COLLECTION", declaree: true, ...o,
});

const mesures = (o: Partial<Mesures>): Mesures => ({ ...AUCUNE_MESURE, ...o });

describe("registre — le classement des manques", () => {
  it("distingue une permission d'une panne : la première n'est PAS une dette", () => {
    const droit = classer("Action refusée : vous n'êtes pas autorisé sur le module Finance.", { capacite: "read_finances" });
    expect(droit.nature).toBe("PERMISSION");
    expect(droit.dette).toBe(false);
    expect(droit.ou).toBe("read_finances");

    const panne = classer("Le service Gmail est indisponible (délai dépassé).", { capacite: "gmail_search" });
    expect(panne.nature).toBe("SOURCE_INACCESSIBLE");
    expect(panne.dette).toBe(true);
  });

  it("nomme les natures qui appellent du code — format, moteur, rendu, capacité absente", () => {
    expect(classer("Le format .xls n'est pas pris en charge par le lecteur.").nature).toBe("FORMAT_DE_FICHIER");
    expect(classer("Le solveur a dépassé sa limite d'itérations.").nature).toBe("MOTEUR_DE_CALCUL");
    expect(classer("Aucune figure : ce type de graphique est inconnu du renderer.").nature).toBe("RENDU");
    expect(classer("Aucun outil ne sait interroger la base IQVIA.").nature).toBe("CAPACITE_ABSENTE");
    for (const n of ["FORMAT_DE_FICHIER", "MOTEUR_DE_CALCUL", "RENDU", "CAPACITE_ABSENTE"] as const) {
      expect(SENS_MANQUE[n].defaut).toBe(true);
    }
  });

  it("rend INDETERMINE plutôt qu'une nature inventée — un manque mal rangé est pire qu'un manque visible", () => {
    const m = classer("zzz qqq 12345");
    expect(m.nature).toBe("INDETERMINE");
    expect(m.confiance).toBeLessThan(0.5);
    expect(m.dette).toBe(true);
  });

  it("garde la preuve : le message d'origine voyage avec le classement", () => {
    const m = classer("HTTP 503 sur le connecteur DocuSign", { capacite: "docusign_send" });
    expect(m.nature).toBe("API_EXTERNE");
    expect(m.preuve).toContain("DocuSign");
  });

  it("la feuille de route range par fréquence pondérée et SÉPARE la dette de l'exploitation", () => {
    const manques: (Manque & { quand?: string })[] = [
      ...Array.from({ length: 2 }, () => classer("Aucun outil ne sait faire la signature électronique.", { capacite: "signature" })),
      ...Array.from({ length: 5 }, () => classer("Le compte Google n'est pas connecté.", { capacite: "gmail_search" })),
      ...Array.from({ length: 4 }, () => classer("Vous n'êtes pas autorisé sur ce dossier.", { capacite: "read_finances" })),
    ].map((m, i) => ({ ...m, quand: `2026-0${(i % 9) + 1}-01T10:00:00.000Z` }));

    const f = feuilleDeRoute(manques);
    expect(f.total).toBe(11);
    // La permission (4 occurrences) est réelle, mais elle n'est PAS du code à écrire.
    expect(f.exploitation.map((l) => l.nature)).toContain("PERMISSION");
    expect(f.dette.map((l) => l.nature)).not.toContain("PERMISSION");
    // Une capacité absente vue 2 fois (× 3) passe devant une panne vue 5 fois (× 1)… non :
    // 6 contre 5, donc oui — et c'est la pondération qui le décide, pas la fréquence brute.
    expect(f.dette[0]!.nature).toBe("CAPACITE_ABSENTE");
    expect(f.dette[0]!.priorite).toBe(6);
    expect(f.dette[1]!.nature).toBe("SOURCE_INACCESSIBLE");
    expect(f.dette[1]!.priorite).toBe(5);
    // Les bornes temporelles sortent des instants réellement fournis.
    expect(f.dette[0]!.depuis).toMatch(/^2026-/);
  });

  it("compte les non classés — un registre qui ne saurait pas ce qu'il ignore serait inutile", () => {
    const f = feuilleDeRoute([classer("blabla"), classer("permission refusée")]);
    expect(f.nonClasses).toBe(1);
  });
});

describe("registre — la fiche d'une capacité", () => {
  it("une capacité jamais exécutée a une fiabilité INCONNUE, pas parfaite", () => {
    const f = composerFiche(matiere({ id: "product_economics", domaine: "regulatory" }));
    expect(f.fiabilite.taux).toBeNull();
    expect(f.fiabilite.echantillon).toBe(0);
    expect(f.limites.join(" ")).toContain("INCONNUE");
    expect(f.latence.p50Ms).toBeNull();
  });

  it("mesurée, elle porte son taux ET son échantillon — et le petit échantillon est dit", () => {
    const f = composerFiche(matiere({ id: "gmail_search", domaine: "mail" }),);
    expect(f.depense.classe).toBe("QUOTA");

    const mesuree = composerFiche(matiere({
      id: "gmail_search", domaine: "mail",
      mesures: mesures({ appels: 3, succes: 2, echecs: 1, p50Ms: 820, p90Ms: 2100, dernierEchec: "Le compte Google n'est pas connecté." }),
    }));
    expect(mesuree.fiabilite.taux).toBeCloseTo(2 / 3, 5);
    expect(mesuree.limites.join(" ")).toContain("3 appel(s) seulement");
    expect(mesuree.latence.p50Ms).toBe(820);
    // LA FICHE PORTE LE DIAGNOSTIC du dernier échec — elle ne se contente pas de le citer.
    expect(mesuree.fiabilite.manque?.nature).toBe("SOURCE_INACCESSIBLE");
  });

  it("la mesure peut AGGRAVER le risque, jamais l'adoucir", () => {
    const sain = composerFiche(matiere({ id: "search_drive", domaine: "drive" }));
    expect(sain.risque.niveau).toBe("AUCUN");

    const cassee = composerFiche(matiere({
      id: "search_drive", domaine: "drive",
      mesures: mesures({ appels: 10, succes: 3, echecs: 7 }),
    }));
    expect(cassee.risque.niveau).toBe("ELEVE");
    expect(cassee.risque.raisons.join(" ")).toContain("3/10");

    // Une capacité destructive qui n'a jamais raté reste CRITIQUE.
    const destructive = composerFiche(matiere({
      id: "delete_node", effet: "DESTRUCTIVE", rejouable: false, confirmation: "ALWAYS",
      mesures: mesures({ appels: 50, succes: 50 }),
    }));
    expect(destructive.risque.niveau).toBe("CRITIQUE");
    expect(destructive.fiabilite.taux).toBe(1);
  });

  it("dit ce qu'elle ne garantit pas : contrat LIBRE, non groupable, non déclarée", () => {
    const f = composerFiche(matiere({
      id: "outil_exotique", contrat: "LIBRE", groupable: false, rejouable: false, declaree: false,
      effet: "EXTERNAL_COMMUNICATION",
    }));
    const limites = f.limites.join(" | ");
    expect(limites).toContain("aucun contrat de sortie");
    expect(limites).toContain("non groupable");
    expect(limites).toContain("non rejouable");
    expect(limites).toContain("non déclarée");
    expect(f.qualification).toBe("DERIVEE");
  });

  it("dit ce qu'elle laisse et ce dont elle dépend", () => {
    const lecture = composerFiche(matiere({ id: "directory_lookup", domaine: "directory" }));
    expect(lecture.evenements).toEqual(["STEP_STARTED", "STEP_DONE", "STEP_FAILED"]);
    expect(lecture.dependances).toEqual(["la base de l'entreprise (Postgres)"]);

    const envoi = composerFiche(matiere({
      id: "send_email", domaine: "mail", effet: "EXTERNAL_COMMUNICATION",
      rejouable: false, confirmation: "POLICY_ENGINE",
    }));
    expect(envoi.evenements).toContain("APPROVAL_REQUESTED");
    expect(envoi.dependances[0]).toContain("Google");
    expect(envoi.dependances.join(" ")).toContain("une personne");
  });

  it("la dépense est classée, jamais un montant inventé", () => {
    expect(composerFiche(matiere({ id: "read_finances", domaine: "finance" })).depense).toMatchObject({ classe: "NUL", mesureUsd: null });
    expect(composerFiche(matiere({ id: "web_research", domaine: "web" })).depense.classe).toBe("FACTURE");
    const paye = composerFiche(matiere({ id: "web_research", domaine: "web", mesures: mesures({ appels: 4, succes: 4, coutUsd: 0.12 }) }));
    expect(paye.depense.mesureUsd).toBeCloseTo(0.12, 5);
  });
});

describe("registre — l'interrogation pendant une mission", () => {
  const catalogue: FicheCapacite[] = [
    composerFiche(matiere({ id: "search_drive", domaine: "drive", resume: "Cherche un document dans le Drive.", mesures: mesures({ appels: 20, succes: 20, p50Ms: 300 }) })),
    composerFiche(matiere({ id: "read_document", domaine: "drive", resume: "Lis le contenu d'un document.", contrat: "CONTENU" })),
    composerFiche(matiere({ id: "send_email", domaine: "mail", resume: "Envoie un e-mail préparé.", effet: "EXTERNAL_COMMUNICATION", rejouable: false, confirmation: "POLICY_ENGINE", primitive: "ACTION" })),
    composerFiche(matiere({ id: "export_excel", domaine: "drive", resume: "Exporte un tableau en classeur Excel.", effet: "INTERNAL_REVERSIBLE_WRITE", primitive: "DOCUMENT", groupable: false })),
    composerFiche(matiere({ id: "read_finances", domaine: "finance", resume: "Lis les finances de la société.", autorisee: false })),
  ];

  it("trouve par les mots de la demande, pas par une table codée en dur", () => {
    const r = interroger(catalogue, { texte: "je veux lire un document du drive" });
    expect(r.resultats.map((f) => f.id)).toContain("read_document");
    expect(r.examinees).toBe(5);
  });

  it("ÉCARTE avec sa raison : le plafond d'effet n'est pas une absence de capacité", () => {
    const r = interroger(catalogue, { texte: "envoie un e-mail", effetMax: "PREPARE" });
    expect(r.resultats).toHaveLength(0);
    expect(r.ecartees).toHaveLength(1);
    expect(r.ecartees[0]).toMatchObject({ id: "send_email", nature: "PLAFOND" });
    expect(r.ecartees[0]!.raison).toContain("PREPARE");
  });

  it("écarte ce qui n'est pas groupable quand la mission exige un éventail", () => {
    const r = interroger(catalogue, { texte: "export excel", groupable: true });
    expect(r.resultats).toHaveLength(0);
    expect(r.ecartees[0]).toMatchObject({ id: "export_excel", nature: "FORME" });
  });

  it("le droit de la personne écarte, et il le dit", () => {
    const r = interroger(catalogue, { texte: "finances", autoriseeSeulement: true });
    expect(r.resultats).toHaveLength(0);
    expect(r.ecartees[0]).toMatchObject({ id: "read_finances", nature: "DROIT" });
  });

  it("une capacité mesurée à 100 % passe devant une capacité jamais essayée, à pertinence égale", () => {
    const jamais = composerFiche(matiere({ id: "drive_autre", domaine: "drive", resume: "Cherche un document dans le Drive." }));
    const r = interroger([jamais, catalogue[0]!], { texte: "cherche document drive" });
    expect(r.resultats[0]!.id).toBe("search_drive");
    expect(r.resultats[1]!.id).toBe("drive_autre");
  });

  it("mais une capacité jamais essayée passe devant une capacité qui échoue — l'inconnu n'est pas le pire", () => {
    const jamais = composerFiche(matiere({ id: "drive_neuf", domaine: "drive", resume: "Cherche un document dans le Drive." }));
    const cassee = composerFiche(matiere({ id: "drive_casse", domaine: "drive", resume: "Cherche un document dans le Drive.", mesures: mesures({ appels: 10, succes: 2, echecs: 8 }) }));
    const r = interroger([cassee, jamais], { texte: "cherche document drive" });
    expect(r.resultats[0]!.id).toBe("drive_neuf");
  });

  it("détecte le manque AVANT l'échec, et distingue la dette du droit", () => {
    const absente = detecterManque("faire signer électroniquement le contrat par DocuSign", catalogue);
    expect(absente?.nature).toBe("CAPACITE_ABSENTE");
    expect(absente?.dette).toBe(true);

    const plafond = detecterManque("envoie un e-mail au partenaire", catalogue, { effetMax: "PREPARE" });
    expect(plafond?.nature).toBe("PERMISSION");
    expect(plafond?.dette).toBe(false);

    // Et quand une capacité répond, il n'y a AUCUN manque : la détection ne fabrique pas de dette.
    expect(detecterManque("cherche un document", catalogue)).toBeNull();
  });
});

describe("registre — le sommaire dit ce qu'on ignore", () => {
  it("compte les capacités jamais exécutées, sans contrat et sans schéma", () => {
    const fiches = [
      composerFiche(matiere({ id: "a", contrat: "LIBRE" })),
      composerFiche(matiere({ id: "b", declaree: false, entrees: [{ nom: "query", type: "texte", requis: true }] })),
      composerFiche(matiere({ id: "c", mesures: mesures({ appels: 8, succes: 4, echecs: 4 }) })),
      composerFiche(matiere({ id: "d", effet: "DESTRUCTIVE", rejouable: false })),
    ];
    const s = sommaireRegistre(fiches);
    expect(s.total).toBe(4);
    expect(s.mesurees).toBe(1);
    expect(s.jamaisExecutees).toBe(3);
    expect(s.sansContrat).toBe(1);
    expect(s.sansSchemaEntree).toBe(3);
    expect(s.declarees).toBe(3);
    expect(s.fragiles).toEqual([{ id: "c", taux: 0.5, echantillon: 8 }]);
    expect(s.aRisque).toEqual([{ id: "d", niveau: "CRITIQUE" }]);
  });
});
