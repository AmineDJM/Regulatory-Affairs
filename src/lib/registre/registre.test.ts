import { describe, expect, it } from "vitest";

import {
  AUCUNE_MESURE, composerFiche, detecterManque, interroger, sommaireRegistre,
  MOTS_POUR_CONCLURE, PERTINENCE_POUR_CONCLURE,
  type FicheCapacite, type MatiereFiche, type Mesures,
} from "@/lib/registre/fiche";
import { classer, feuilleDeRoute, SENS_MANQUE, type Manque } from "@/lib/registre/manques";
import { consignerMesure } from "@/lib/evals/registre";

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

describe("registre — la couverture de la demande, et le faux « ça n'existe pas »", () => {
  /**
   * LE DÉFI RÉEL QUI A RÉVÉLÉ LE DÉFAUT.
   *
   * Une question d'ordonnancement posée à Adam en conditions réelles. Il a répondu « INCONNU :
   * le moteur d'ordonnancement requis n'est pas disponible » — alors que `calcul_ordonnancement`
   * était dans sa surface, autorisé, et calcule exactement le chemin critique. Il ne l'a pas
   * inventé : il a INTERROGÉ le registre, et le registre lui a dit que rien ne savait le faire.
   *
   * On reproduit la matière exacte : les deux mots de la demande sont dans le résumé, aucun dans
   * le nom. Deux points, il en fallait trois.
   */
  const ordonnancement = composerFiche(matiere({
    id: "calcul_ordonnancement", domaine: "calcul", primitive: "CALCUL", effet: "ANALYZE",
    resume: "Ordonnancement de projet : calcule le chemin critique, les marges et le calendrier sous ressources.",
  }));
  const bruit: FicheCapacite[] = [
    composerFiche(matiere({ id: "search_drive", domaine: "drive", resume: "Cherche un document dans le Drive." })),
    composerFiche(matiere({ id: "send_email", domaine: "mail", resume: "Envoie un e-mail préparé." })),
  ];
  const catalogue = [ordonnancement, ...bruit];

  it("LE TEST QUI COMPTE : deux mots sur deux dans un résumé, c'est la demande ENTIÈRE — pas un manque", () => {
    // Sous l'ancienne règle : 1 point + 1 point = 2, sous le seuil de 3 → « CAPACITE_ABSENTE ».
    expect(detecterManque("chemin critique", catalogue)).toBeNull();
    const r = interroger(catalogue, { texte: "chemin critique", pertinenceMin: PERTINENCE_POUR_CONCLURE, motsMin: MOTS_POUR_CONCLURE });
    expect(r.resultats.map((f) => f.id)).toEqual(["calcul_ordonnancement"]);
  });

  it("les deux surfaces ne peuvent plus se contredire : ce que `chercher` classe PREMIER n'est jamais « absent »", () => {
    // C'est l'invariant, pas l'exemple. Une capacité que la recherche met en tête ne peut pas
    // être déclarée inexistante par la détection de manque : ce sont les deux réponses du MÊME
    // outil à la MÊME phrase, et Adam croit la seconde.
    for (const besoin of ["chemin critique", "ordonnancement du projet", "calcule les marges", "envoie un e-mail"]) {
      const large = interroger(catalogue, { texte: besoin });
      const premier = large.resultats[0];
      if (!premier) continue;
      const m = detecterManque(besoin, catalogue);
      const couverture = besoin.split(/[^\p{L}\p{N}]+/u).filter((x) => x.length > 2).length;
      if (couverture >= 2 && premier.id === "calcul_ordonnancement") {
        expect(m, `« ${besoin} » : trouvée première ET déclarée absente`).toBeNull();
      }
    }
  });

  it("la couverture ne se déclenche pas sur UN seul mot : « toute la demande » ne prouverait rien", () => {
    // Un mot isolé cité dans un résumé couvrirait 100 % de la demande. Le plancher de deux mots
    // est ce qui empêche la porte de tout ouvrir.
    const r = interroger([ordonnancement], { texte: "calendrier", pertinenceMin: PERTINENCE_POUR_CONCLURE, motsMin: MOTS_POUR_CONCLURE });
    expect(r.resultats).toHaveLength(0);
  });

  it("un tiers de la demande n'est PAS une réponse : le vrai manque se nomme encore", () => {
    // Six mots, un seul croisé : la couverture vaut 17 %, très loin du seuil. Sans cela, la
    // détection de manque serait devenue incapable de nommer une dette.
    const m = detecterManque("faire signer électroniquement ce contrat via DocuSign", catalogue);
    expect(m?.nature).toBe("CAPACITE_ABSENTE");
  });

  it("la recherche large est INCHANGÉE : couvrir 75 % de la demande implique déjà un point", () => {
    // La porte de couverture n'ajoute rien à `chercher` (seuil 1) — elle ne relâche que le
    // verdict d'absence. Si ce test tombait, la porte aurait débordé sur la recherche.
    for (const besoin of ["chemin critique", "document drive", "e-mail"]) {
      const avec = interroger(catalogue, { texte: besoin }).resultats.map((f) => f.id);
      const sansPorte = catalogue.filter((f) => {
        const mots = besoin.split(/[^\p{L}\p{N}]+/u).map((x) => x.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()).filter((x) => x.length > 2);
        const hay = `${f.id} ${f.domaine} ${f.resume}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
        return mots.some((mm) => new RegExp(`(^|[^\\p{L}\\p{N}])${mm}`, "u").test(hay));
      }).map((f) => f.id);
      expect(avec.sort()).toEqual(sansPorte.sort());
    }
  });
});

describe("registre — les écartées se trient, sinon la bonne est invisible", () => {
  /**
   * LE DÉFAUT MESURÉ, ET IL ANNULAIT TOUT LE §44 EN PRATIQUE.
   *
   * Une déléguée demande d'exécuter une requête SQL. `sql_query` EXISTE, elle n'y a pas droit :
   * le registre le voyait parfaitement et rangeait la capacité en écartée/DROIT. Mais les
   * écartées sortaient dans l'ordre du CATALOGUE — `sql_query` arrivait en position 20 sur 38,
   * derrière dix-neuf exclusions sans le moindre rapport avec la question. L'outil n'en affiche
   * que dix. La seule exclusion qui répondait n'atteignait jamais le modèle, et Adam concluait
   * « aucune capacité SQL n'est disponible » — la phrase exacte que le §44 existe pour empêcher.
   *
   * Le mécanisme marchait ; c'est l'ORDRE qui le rendait inutile. Une distinction juste, affichée
   * après vingt lignes de bruit, ne vaut pas mieux qu'une distinction jamais calculée.
   */
  const interdite = (id: string, resume: string) => composerFiche(matiere({ id, resume, autorisee: false }));
  const catalogue: FicheCapacite[] = [
    // Dix-neuf capacités interdites SANS rapport, placées AVANT — comme dans le vrai catalogue.
    ...Array.from({ length: 19 }, (_, i) => interdite(`lecture_rh_${i}`, `Lit une donnée de paie et de congés (${i}).`)),
    interdite("sql_query", "Bac à sable SQL : exécute une requête en lecture seule sur une copie."),
  ];

  it("LE TEST QUI COMPTE : l'écartée qui répond à la question passe DEVANT, pas en vingtième", () => {
    const r = interroger(catalogue, { texte: "exécuter une requête SQL", autoriseeSeulement: true });
    expect(r.resultats).toHaveLength(0);
    // Ce que l'appelant affiche : les dix premières. `sql_query` doit y être — en tête.
    expect(r.ecartees[0]).toMatchObject({ id: "sql_query", nature: "DROIT" });
    expect(r.ecartees.slice(0, 10).map((e) => e.id)).toContain("sql_query");
  });

  it("le tri est stable : deux appels identiques rendent le même ordre", () => {
    const a = interroger(catalogue, { texte: "exécuter une requête SQL", autoriseeSeulement: true }).ecartees.map((e) => e.id);
    const b = interroger(catalogue, { texte: "exécuter une requête SQL", autoriseeSeulement: true }).ecartees.map((e) => e.id);
    expect(a).toEqual(b);
  });

  it("un droit refusé n'est TOUJOURS pas une dette technique", () => {
    // L'invariant d'origine reste : le tri change l'ordre, jamais la nature.
    const m = detecterManque("exécuter une requête SQL", catalogue, { autoriseeSeulement: true });
    expect(m?.nature).toBe("PERMISSION");
    expect(m?.dette).toBe(false);
    // ET LE TRI SERT ICI AUSSI : le manque est construit à partir de la PREMIÈRE bloquante.
    // Non trié, il aurait nommé une capacité de paie au hasard — un manque juste par sa nature
    // et faux par son objet, ce qui envoie la personne demander le mauvais droit.
    expect(m?.ou).toBe("sql_query");
    expect(m?.preuve).toContain("sql_query");
  });
});

describe("mesure consignée — §44", () => {
  it("chaque échec nomme ce qui manque, et l'indéterminé est compté à part", () => {
    const cas: [string, string][] = [
      ["Le compte Google n'est pas connecté.", "SOURCE_INACCESSIBLE"],
      ["connect ECONNREFUSED 127.0.0.1:41000", "SOURCE_INACCESSIBLE"],
      ["droit refusé : canViewFinance", "PERMISSION"],
      ["Aucun outil ne sait signer électroniquement.", "CAPACITE_ABSENTE"],
      ["Ce type de graphique est inconnu du renderer.", "RENDU"],
      ["Aucune ligne trouvée.", "DONNEE_MANQUANTE"],
      ["Entrée invalide : champ obligatoire manquant.", "MODELE"],
    ];
    const ok = cas.filter(([m, att]) => classer(m, { etape: "test" }).nature === att).length;
    consignerMesure("manque_nomme", { n: cas.length, ok }, "lib/registre/registre.test.ts",
      "sept signatures réelles classées, dont la panne de transport qui repartait en INDETERMINE");
  });

  it("l'exclusion pertinente est visible dans les dix premières, pas noyée", () => {
    const interdite = (id: string, resume: string) => composerFiche(matiere({ id, resume, autorisee: false }));
    const catalogue: FicheCapacite[] = [
      ...Array.from({ length: 19 }, (_, i) => interdite(`bruit_${i}`, `Lit une donnée de paie et de congés (${i}).`)),
      interdite("sql_query", "Bac à sable SQL : exécute une requête en lecture seule sur une copie."),
      interdite("read_finances", "Lit le budget et les paiements de la société."),
    ];
    const cas: [string, string][] = [
      ["exécuter une requête SQL", "sql_query"],
      ["lire le budget de la société", "read_finances"],
      ["consulter les congés", "bruit_0"],
    ];
    const vus = cas.filter(([besoin, attendu]) =>
      interroger(catalogue, { texte: besoin, autoriseeSeulement: true }).ecartees.slice(0, 10).some((e) => e.id === attendu));
    consignerMesure("ecartee_pertinente_en_tete", { n: cas.length, ok: vus.length }, "lib/registre/registre.test.ts",
      "l'écartée qui répond entre dans les dix affichées, sur un catalogue où dix-neuf exclusions sans rapport la précédaient");
    expect(vus).toHaveLength(cas.length);
  });

  it("aucune capacité trouvée par la recherche n'est déclarée absente par la détection de manque", () => {
    // La contradiction MESURÉE sur un défi réel : `chercher` classait `calcul_ordonnancement`
    // première sur « chemin critique » pendant que `manque` répondait CAPACITE_ABSENTE.
    const catalogue: FicheCapacite[] = [
      composerFiche(matiere({ id: "calcul_ordonnancement", domaine: "calcul", primitive: "CALCUL", resume: "Ordonnancement de projet : calcule le chemin critique, les marges et le calendrier sous ressources." })),
      composerFiche(matiere({ id: "calcul_montecarlo", domaine: "calcul", primitive: "CALCUL", resume: "Simulation Monte-Carlo : percentiles, downside, probabilité de perte." })),
      composerFiche(matiere({ id: "send_email", domaine: "mail", primitive: "ACTION", resume: "Envoie un e-mail préparé au destinataire." })),
    ];
    const besoins = ["chemin critique", "ordonnancement du projet", "simulation Monte-Carlo", "envoie un e-mail", "calendrier sous ressources"];
    const contradictions = besoins.filter((b) => {
      const premier = interroger(catalogue, { texte: b }).resultats[0];
      return premier !== undefined && detecterManque(b, catalogue)?.nature === "CAPACITE_ABSENTE";
    });
    consignerMesure("capacite_jamais_absente_a_tort", { n: besoins.length, ok: besoins.length - contradictions.length },
      "lib/registre/registre.test.ts",
      contradictions.length ? `contradictions : ${contradictions.join(", ")}` : "aucune contradiction entre « chercher » et « manque »");
    expect(contradictions).toEqual([]);
  });
});
