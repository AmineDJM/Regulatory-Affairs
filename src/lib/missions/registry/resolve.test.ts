import { describe, expect, it } from "vitest";
import { consignerMesure } from "@/lib/evals/registre";
import type { CapabilityBrief, CapabilityCatalog, MissionActor } from "@/lib/missions/ports";
import type { CapabilityMeta } from "@/lib/missions/registry/capability-meta";
import { resoudreCapacites, scoreCapacite, jetonsEtendus, SYNONYMES } from "@/lib/missions/registry/resolve";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE SEUIL DE PERTINENCE COUPE-T-IL LA QUEUE — SANS COUPER LE PLANCHER ?
 *
 * ── LA MESURE QUI A PRODUIT CE FICHIER ───────────────────────────────────────────────────
 *
 * Un run réel sur Render a chiffré le gaspillage : 28 capacités montrées au planner, 3 à 5
 * réellement retenues dans le plan compilé, pour ~2 300 jetons de résumés dans un prompt qui en
 * mesurait 4 200 à 5 100. Près de la moitié de l'entrée décrivait des outils que le plan n'a pas
 * utilisés — et chacun de ces outils est une piste que le modèle examine avant de l'écarter.
 *
 * ── LE RISQUE EXACT DE CETTE OPTIMISATION ────────────────────────────────────────────────
 *
 * Réduire ce qu'on montre est trivialement facile ; le faire sans cacher une capacité NÉCESSAIRE
 * ne l'est pas. Ce dépôt connaît déjà la panne : montrer `send_email` sans montrer
 * `directory_list` produit un plan cohérent, compilable, et qui envoie un message à personne.
 * La garde qui l'empêche est le TOURNIQUET par domaine, et il admet délibérément des capacités
 * qui n'ont marqué AUCUN point — parce que « liste des gens » ne partage aucun mot avec
 * « bonne année ».
 *
 * Ce fichier vérifie donc les deux moitiés de la même décision :
 *   1. le seuil retire bien la queue (les capacités qui ont effleuré un mot sans concerner la
 *      demande) — et il le prouve par CONTRE-EXEMPLE, en refaisant la même résolution seuil
 *      désarmé, ce qui interdit qu'un jour le test passe parce que le montage a changé ;
 *   2. le seuil ne retire RIEN de ce que le tourniquet a placé, y compris à score nul.
 *
 * Le montage fixe `maxDomaines` et `parDomaine` pour que l'arithmétique soit lisible ; le seuil,
 * lui, reste à sa valeur de PRODUCTION — c'est lui qui est jugé ici.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const b = (id: string, domain: string, summary: string): CapabilityBrief => ({
  id,
  domain,
  effect: "READ",
  batchable: false,
  summary,
});

/**
 * LE MONTAGE — vingt-sept capacités réparties en trois zones nettes.
 *
 * `messagerie` et `rh` marquent haut (le domaine lui-même est dans la demande) ; `annuaire`
 * marque par une seule de ses trois capacités, et les deux autres à ZÉRO : ce sont elles que le
 * tourniquet doit sauver. Tout le reste est la QUEUE : un mot commun, aucun rapport.
 */
const CAPACITES: readonly CapabilityBrief[] = [
  // ── messagerie — le domaine central de la demande ─────────────────────────────────────
  b("send_message", "messagerie", "Envoie un message ERP à une personne."),
  b("draft_message", "messagerie", "Prépare un message sans l'envoyer."),
  b("message_history", "messagerie", "Relit l'historique des messages d'un fil."),
  b("message_template", "messagerie", "Applique un modèle de message enregistré."),
  b("message_export", "messagerie", "Exporte les messages d'une période."),

  // ── rh — le second domaine nommé par la demande ───────────────────────────────────────
  b("employee_list", "rh", "Liste les salariés actifs."),
  b("employee_contract", "rh", "Ouvre le contrat d'un salarié."),
  b("employee_absence", "rh", "Relit les absences d'une période."),
  b("employee_payroll", "rh", "Prépare un bulletin de paie."),

  // ── annuaire — UNE capacité marque, DEUX ne marquent rien, et elles sont utiles ───────
  b("directory_list", "annuaire", "Liste les personnes de l'annuaire."),
  b("directory_card", "annuaire", "Ouvre la fiche d'une personne."),
  b("directory_org_chart", "annuaire", "Affiche l'organigramme."),

  // ── LA QUEUE — un mot de la demande apparaît dans le résumé, et c'est tout ────────────
  b("invoice_reminder", "comptabilite", "Relance une facture par message."),
  b("payment_status", "comptabilite", "Donne l'état d'un paiement d'un salarié."),
  b("stock_alert", "logistique", "Signale un stock bas par message."),
  b("delivery_track", "logistique", "Suit une livraison et prévient le salarié."),
  b("document_send", "drive", "Envoie un document par message."),
  b("document_classify", "drive", "Classe un document reçu par message."),
  b("task_create", "taches", "Crée une tâche pour un salarié."),
  b("task_remind", "taches", "Rappelle une tâche par message."),
  b("meeting_book", "agenda", "Réserve une réunion et prévient chaque salarié."),
  b("meeting_notes", "agenda", "Rédige le compte rendu et l'envoie par message."),

  // ── LE HORS-SUJET COMPLET — score nul, hors des domaines retenus ─────────────────────
  b("batch_release", "qualite", "Libère un lot pharmaceutique."),
  b("stability_study", "qualite", "Ouvre une étude de stabilité."),
  b("customs_declare", "import", "Dépose une déclaration douanière."),
  b("tender_open", "pch", "Ouvre un appel d'offres."),
  b("price_history", "pch", "Retrace l'historique de prix d'un produit."),
];

const ACTEUR: MissionActor = { userId: "u-1", label: "Le PDG", isAgent: false };

const catalogue: CapabilityCatalog = {
  has: (name) => CAPACITES.some((c) => c.id === name),
  allowed: () => true,
  meta: (name) =>
    ({
      id: name,
      domain: CAPACITES.find((c) => c.id === name)?.domain ?? "inconnu",
      effect: "READ",
      idempotent: true,
      batchable: false,
      latency: "LOW",
      confirmation: "NEVER",
      contrat: "LIBRE",
      declared: false,
      primitive: "INFORMATION",
    }) satisfies CapabilityMeta,
  brief: () => [...CAPACITES],
};

const DEMANDE = "envoie à chacun des salariés un message de bonne année sur la messagerie";

/** Le même montage des deux côtés : seules les deux options du seuil changent. */
const STRUCTURE = { maxDomaines: 3, parDomaine: 3, limite: 20 } as const;
const SEUIL_DESARME = { ...STRUCTURE, seuilRelatif: 0, seuilMinimum: 0 } as const;

const idsMontres = (opts: Parameters<typeof resoudreCapacites>[3]): string[] =>
  resoudreCapacites(DEMANDE, catalogue, ACTEUR, opts).capacites.map((c) => c.id);

describe("le seuil de pertinence — ce qu'il coupe, et ce qu'il ne coupe pas", () => {
  it("COUPE la queue : une capacité qui n'a effleuré qu'un mot n'est plus montrée", () => {
    const avec = idsMontres(STRUCTURE);
    const sans = idsMontres(SEUIL_DESARME);

    // LE CONTRE-EXEMPLE EST LA MOITIÉ QUI COMPTE. Sans lui, ce test passerait encore le jour où
    // le seuil serait retiré — il suffirait que le montage soit trop petit pour atteindre la
    // limite. Ici la même résolution, seuil désarmé, MONTRE la capacité que le seuil retire.
    expect(sans).toContain("invoice_reminder");
    expect(avec).not.toContain("invoice_reminder");
    expect(avec.length).toBeLessThan(sans.length);

    // Et la queue coupée est bien la QUEUE : tout ce qui disparaît a un score faible.
    const demande = jetonsEtendus(DEMANDE);
    const meilleur = Math.max(...CAPACITES.map((c) => scoreCapacite(c, demande)));
    for (const id of sans.filter((x) => !avec.includes(x))) {
      const brief = CAPACITES.find((c) => c.id === id)!;
      expect(scoreCapacite(brief, demande), id).toBeLessThan(meilleur * 0.25);
    }
  });

  it("NE COUPE PAS le plancher : une capacité à score NUL d'un domaine retenu reste montrée", () => {
    const demande = jetonsEtendus(DEMANDE);
    const carte = CAPACITES.find((c) => c.id === "directory_card")!;

    // La prémisse d'abord : si un jour cette capacité se mettait à marquer ASSEZ pour passer le
    // seuil de remplissage, le test ci-dessous deviendrait vrai pour une raison sans rapport
    // avec le tourniquet. Ce qu'il faut garantir n'est donc pas « score nul » mais « score sous
    // le seuil » — depuis que le rattrapage par préfixe existe aussi sur le résumé, « fiche
    // d'une PERSONNE » attrape un demi-point sur « PERSONNEL », ce qui est un vrai rapprochement
    // et non du bruit. Le seuil de remplissage vaut max(seuilMinimum, 25 % du meilleur).
    const meilleurScore = Math.max(...CAPACITES.map((c) => scoreCapacite(c, demande)));
    const seuilRemplissage = Math.max(2, meilleurScore * 0.25);
    expect(scoreCapacite(carte, demande)).toBeLessThan(seuilRemplissage);

    const avec = idsMontres(STRUCTURE);
    // C'est la panne connue de ce dépôt : montrer de quoi écrire sans montrer à QUI. Le seuil
    // s'applique au remplissage, jamais au tourniquet — cette ligne est ce qui le tient.
    expect(avec).toContain("directory_list");
    expect(avec).toContain("directory_card");
    expect(avec).toContain("directory_org_chart");
  });

  it("NE COUPE PAS une capacité IMPOSÉE, même sous le seuil", () => {
    // Une reprise ou un replan ciblé sait ce dont il a besoin ; le résolveur n'a pas à en juger.
    const avec = idsMontres({ ...STRUCTURE, imposees: ["invoice_reminder"] });
    expect(avec).toContain("invoice_reminder");
  });

  it("le seuil est RELATIF, et il ne mord QUE sur le remplissage", () => {
    // Le seuil vaut `max(minimum, relatif × meilleur)`. Relatif, parce qu'une demande écrite avec
    // les mots exacts du catalogue marque haut partout et une demande orale marque bas partout :
    // un seuil absolu trancherait au mauvais endroit dans l'un des deux cas.
    //
    // Le durcir doit couper DAVANTAGE — mais seulement dans la boucle de remplissage. Ici deux
    // capacités marquent 3 : `employee_absence`, placée par le tourniquet, et `employee_payroll`,
    // qui n'entrait que par le remplissage. À seuil 0,5 × 9 = 4,5, la seconde tombe et la
    // première reste. C'est exactement la frontière que l'optimisation ne doit pas franchir.
    const demande = jetonsEtendus(DEMANDE);
    const score = (id: string) => scoreCapacite(CAPACITES.find((c) => c.id === id)!, demande);
    expect(score("employee_absence")).toBe(score("employee_payroll"));

    const strict = idsMontres({ ...STRUCTURE, seuilRelatif: 0.5 });
    expect(strict).toContain("employee_absence");
    expect(strict).not.toContain("employee_payroll");
    expect(idsMontres(STRUCTURE)).toContain("employee_payroll");
  });

  it("le résolveur reste une RÉDUCTION : jamais plus que la limite, jamais tout le catalogue", () => {
    const r = resoudreCapacites(DEMANDE, catalogue, ACTEUR, STRUCTURE);
    expect(r.metriques.plannerCapabilitiesExposed).toBeLessThanOrEqual(STRUCTURE.limite);
    expect(r.metriques.plannerCapabilitiesExposed).toBeLessThan(r.metriques.capacitesAutorisees);
    expect(r.metriques.capacitesAutorisees).toBe(CAPACITES.length);
    expect(r.metriques.jetonsEvites).toBeGreaterThan(0);
  });
});

describe("le rappel du résolveur — ce qu'on ne MONTRE pas ne peut pas être planifié", () => {
  /**
   * ═══════════════════════════════════════════════════════════════════════════════════════
   * LE DÉFAUT QUI DOMINAIT LE BANC DES DEUX CENTS MISSIONS.
   *
   * Familles STATISTIQUES 0/17, LEGAL 0/14, COMPOSITION 0/16, REPRESENTATION 2/17, et une cause
   * en tête de toutes les autres : « le plan ne prévoit pas CALCUL ». On a d'abord lu cela comme
   * quatre-vingt-six échecs de raisonnement du planificateur. C'en était UN, structurel : la
   * capacité de calcul n'était pas dans la liste qu'on lui montrait.
   *
   * Trois causes s'additionnaient, et aucune n'était le modèle :
   *   1. le RÉSUMÉ était coupé à 220 caractères, et les mots distinctifs d'une capacité sont
   *      presque toujours à la fin (corrigé dans `catalog.ts` : la queue de mots) ;
   *   2. le rattrapage par PRÉFIXE ne s'appliquait qu'au nom et au domaine, et seulement quand
   *      le score valait zéro — or le vocabulaire métier vit dans le résumé ;
   *   3. personne ne demande « une significativité » : on demande si l'écart est « significatif
   *      ou du bruit ». Ces mots-là n'existaient dans aucun résumé, et le dictionnaire de
   *      SYNONYMES — prévu exactement pour ce cas — ne les portait pas.
   *
   * Ce test tient la PROPRIÉTÉ, pas les trois corrections : une demande formulée dans les mots
   * d'une personne doit faire remonter la capacité qui y répond.
   * ═══════════════════════════════════════════════════════════════════════════════════════
   */
  const stat = b("calcul_statistiques", "calcul", "Statistiques et apprentissage. Banc statistique : quartiles, corrélations, régression, significativité, anomalies, série temporelle, prévision.");
  const rendu = b("render_view", "representation", "Affiche une représentation : tableau, barres, lignes, graphique, carte, répartition.");
  const doc = b("draft_deliverable", "document", "Rédige un livrable : rapport, note de synthèse, courrier.");
  // LE LEURRE EST ALPHABÉTIQUEMENT PREMIER, ET C'EST VOULU. Le tri départage les ex æquo par
  // identifiant : sans lui, un catalogue où TOUT vaut zéro sacrerait « calcul_statistiques »
  // gagnante par ordre alphabétique, et ce test passerait sans rien mesurer. La première
  // version de ce bloc avait exactement ce défaut — elle passait même en retirant les deux
  // corrections qu'elle prétendait tenir.
  const bruit = [
    b("aaa_leurre", "logistique", "Lit les stocks et les mouvements."),
    b("list_emails", "mail", "Liste les e-mails reçus."),
    b("create_task", "taches", "Crée une tâche assignée."),
  ];
  const CATALOGUE = [stat, rendu, doc, ...bruit];

  /** La gagnante, et `null` si RIEN n'a marqué — un score nul n'est pas un choix. */
  const gagnante = (demande: string): { id: string; s: number } | null => {
    const d = jetonsEtendus(demande);
    const top = [...CATALOGUE].map((c) => ({ id: c.id, s: scoreCapacite(c, d) }))
      .sort((x, y) => y.s - x.s || x.id.localeCompare(y.id))[0]!;
    return top.s > 0 ? top : null;
  };

  it("LE TEST QUI COMPTE : les mots d'une personne trouvent le moteur, pas ceux d'un statisticien", () => {
    // Aucune de ces phrases n'emploie un mot du résumé. Toutes doivent pourtant y mener.
    for (const demande of [
      "Est-ce que nos délais se dégradent vraiment, ou est-ce que l'écart est significatif ou du bruit ?",
      "Y a-t-il un lien entre le prix et le volume vendu ?",
      "Repère les mois anormaux, ceux qui sortent de l'ordinaire.",
    ]) {
      const g = gagnante(demande);
      expect(g, `« ${demande} » ne marque RIEN`).not.toBeNull();
      expect(g!.id, demande).toBe("calcul_statistiques");
      expect(g!.s, `${demande} : marque, mais à zéro`).toBeGreaterThan(0);
    }
  });

  it("« montre-moi » veut une REPRÉSENTATION, « rédige » veut un DOCUMENT", () => {
    for (const [demande, attendue] of [
      ["Fais-moi un tableau de bord par statut", "render_view"],
      ["Rédige une note de synthèse sur ce contrat", "draft_deliverable"],
    ] as const) {
      const g = gagnante(demande);
      expect(g, `« ${demande} » ne marque RIEN`).not.toBeNull();
      expect(g!.id, demande).toBe(attendue);
      expect(g!.s).toBeGreaterThan(0);
    }
  });

  it("le rattrapage par PRÉFIXE vaut aussi dans le résumé, et il vaut moins qu'un mot exact", () => {
    // La famille de mots que la découpe sépare : « temporel » et « temporelle ». Le
    // rattrapage ne s'appliquait qu'au nom et au domaine, et seulement à score nul — donc jamais
    // là où vit le vocabulaire métier. Sans lui, aucun demi-point ; avec lui, la capacité entre
    // dans la course sans pour autant dépasser une correspondance exacte.
    // « temporel » n'est PAS une entrée du dictionnaire : on mesure donc le préfixe seul, et pas
    // un synonyme déguisé. Le résumé porte « temporelle ».
    expect(SYNONYMES.temporel, "« temporel » doit rester hors du dictionnaire pour ce test").toBeUndefined();
    const seulPrefixe = jetonsEtendus("temporel");
    const seulExact = jetonsEtendus("temporelle");
    const parPrefixe = scoreCapacite(stat, seulPrefixe);
    const parExact = scoreCapacite(stat, seulExact);
    expect(parPrefixe, "un préfixe partagé doit marquer").toBeGreaterThan(0);
    expect(parPrefixe, "un préfixe ne doit JAMAIS peser autant qu'un mot exact").toBeLessThan(parExact);
  });

  it("mesure consignée — §43 : le rappel du résolveur sur les mots d'une personne", () => {
    const cas: [string, string][] = [
      ["Est-ce que l'écart est significatif ou du bruit ?", "calcul_statistiques"],
      ["Y a-t-il un lien entre le prix et le volume vendu ?", "calcul_statistiques"],
      ["Repère les mois anormaux, ceux qui sortent de l'ordinaire.", "calcul_statistiques"],
      ["Est-ce que la tendance se dégrade ?", "calcul_statistiques"],
      ["Fais-moi un tableau de bord par statut", "render_view"],
      ["Montre-moi la répartition en graphique", "render_view"],
      ["Rédige une note de synthèse sur ce contrat", "draft_deliverable"],
      ["Prépare un rapport pour le comité", "draft_deliverable"],
    ];
    const trouves = cas.filter(([demande, attendue]) => gagnante(demande)?.id === attendue);
    consignerMesure("capacite_montree_au_planificateur", { n: cas.length, ok: trouves.length },
      "lib/missions/registry/resolve.test.ts",
      `${trouves.length}/${cas.length} demandes en langue courante font remonter la capacité qui y répond`);
    expect(trouves).toHaveLength(cas.length);
  });

  it("le dictionnaire ne traduit JAMAIS vers un nom de capacité", () => {
    // La règle du fichier : il traduit du français vers du français. Une entrée qui pointerait
    // vers `calcul_statistiques` serait la table codée en dur que tout ce module refuse — elle
    // vieillirait en silence le jour où la capacité serait renommée ou scindée.
    const idsConnus = new Set(CATALOGUE.map((c) => c.id));
    for (const [mot, cibles] of Object.entries(SYNONYMES)) {
      for (const cible of cibles) {
        expect(idsConnus.has(cible), `« ${mot} » → « ${cible} » est un nom de capacité`).toBe(false);
        expect(cible).not.toMatch(/_/);
      }
    }
  });
});


/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * CE QUE LA DEMANDE EXIGE EST-IL SEULEMENT VISIBLE ? (§56)
 *
 * ── LE DÉFAUT, ET IL EXPLIQUE STATISTIQUES 0/17 À LUI SEUL ──────────────────────────────
 *
 * La consigne du planificateur ordonne « un calcul sur des lignes lues se fait avec
 * `run_analysis` ou `run_code`, jamais de tête ». Or la VISIBILITÉ de ces capacités n'était
 * garantie par rien, et trois mécanismes se liguaient contre elles :
 *
 *   • `domaineDeduit` ne reconnaît ni `run_analysis`, ni `run_code`, ni `sql_query`, ni
 *     `calcul_statistiques` : toutes retombent sur le domaine « autre » ;
 *   • le tourniquet ne retient que deux à cinq domaines, et « autre » ne gagne jamais les points
 *     de domaine ;
 *   • leurs identifiants sont anglais quand la demande est française.
 *
 * Une demande de statistiques pouvait donc n'avoir AUCUNE capacité de calcul sous les yeux —
 * après quoi le planificateur écrivait, honnêtement, qu'il manquait une capacité.
 *
 * Le plancher force la MEILLEURE capacité de chaque primitive exigée. Il n'ouvre aucun droit :
 * il puise dans ce que le catalogue de la personne contient déjà.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
describe("le plancher de visibilité — une demande chiffrée voit de quoi calculer", () => {
  /** Un catalogue où la capacité de calcul est TOUT ce qu'il y a de moins trouvable au score. */
  const catalogueSourd: CapabilityCatalog = {
    has: () => true,
    allowed: () => true,
    meta: (id) => ({ id, domain: "autre", effect: "READ", batchable: false, idempotent: true } as CapabilityMeta),
    brief: () => [
      { ...b("dossiers_liste", "regulatory", "Liste des dossiers réglementaires en retard, échéances, statuts"), primitive: "INFORMATION" },
      { ...b("dossier_fiche", "regulatory", "Fiche détaillée d'un dossier réglementaire en retard"), primitive: "INFORMATION" },
      { ...b("dossier_pieces", "regulatory", "Pièces attachées à un dossier réglementaire"), primitive: "INFORMATION" },
      { ...b("dossier_historique", "regulatory", "Historique des mouvements d'un dossier"), primitive: "INFORMATION" },
      // Aucun mot commun avec une demande française : ni « calcul », ni « combien », ni « total ».
      { ...b("run_analysis", "autre", "Run an analysis over rows"), primitive: "CALCUL" },
      { ...b("chart_advice", "autre", "Advise on chart type"), primitive: "REPRESENTATION" },
    ],
  };
  const acteur: MissionActor = { userId: "u", label: "PDG", isAgent: false };
  const DEMANDE = "Combien de dossiers réglementaires sont en retard, et quel est le taux ?";

  it("LE TEST QUI COMPTE : sans plancher, la capacité de calcul n'est PAS montrée", () => {
    // Le contre-exemple d'abord : il interdit qu'un jour ce test passe parce que le montage a
    // changé et que `run_analysis` se serait mise à marquer des points toute seule.
    const sans = resoudreCapacites(DEMANDE, catalogueSourd, acteur, { limite: 4, maxDomaines: 2 });
    expect(sans.capacites.map((c) => c.id)).not.toContain("run_analysis");
  });

  it("avec le plancher, elle l'est — et rien n'a été ouvert au-delà des droits", () => {
    const avec = resoudreCapacites(DEMANDE, catalogueSourd, acteur, {
      limite: 4, maxDomaines: 2, primitivesRequises: ["CALCUL"],
    });
    expect(avec.capacites.map((c) => c.id)).toContain("run_analysis");
    // La limite reste STRICTE : le plancher prend une place, il n'en ajoute pas.
    expect(avec.capacites.length).toBeLessThanOrEqual(4);
    // Et il ne fait apparaître que ce que le catalogue contenait déjà.
    const connus = new Set(catalogueSourd.brief(acteur).map((x) => x.id));
    for (const c of avec.capacites) expect(connus.has(c.id)).toBe(true);
  });

  it("une primitive exigée que la personne n'a PAS n'invente rien", () => {
    const avec = resoudreCapacites(DEMANDE, catalogueSourd, acteur, {
      limite: 4, maxDomaines: 2, primitivesRequises: ["DOCUMENT"],
    });
    expect(avec.capacites.every((c) => c.primitive !== "DOCUMENT")).toBe(true);
  });

  it("une primitive déjà couverte par le score ne consomme pas une place de plus", () => {
    const avec = resoudreCapacites(DEMANDE, catalogueSourd, acteur, {
      limite: 6, maxDomaines: 3, primitivesRequises: ["CALCUL", "CALCUL"],
    });
    expect(avec.capacites.filter((c) => c.id === "run_analysis")).toHaveLength(1);
  });
});
