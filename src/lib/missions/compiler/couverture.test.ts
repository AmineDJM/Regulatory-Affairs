import { describe, expect, it } from "vitest";
import { compile } from "./compile";
import { exigencesFermes, formatsLivrablesDemandes } from "@/lib/missions/planner/primitives";
import type { CapabilityBrief, CapabilityCatalog, MissionActor } from "@/lib/missions/ports";
import type { MissionPlan, PlannedStep } from "@/lib/missions/planner/contract";
import { capabilityMeta } from "@/lib/missions/registry/capability-meta";
import { consignerMesure } from "@/lib/evals/registre";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE PLAN COUVRE-T-IL CE QUE LA DEMANDE EXIGE ? (§56)
 *
 * ── LE DÉFAUT, ET C'ÉTAIT LA DERNIÈRE CAUSE BLOQUANTE ───────────────────────────────────
 *
 * Les deux seuls contrôles de couverture du compilateur étaient « au moins une étape » et
 * « au moins un critère d'acceptation ». Un plan « lire → répondre » compilait donc sans
 * réserve pour une demande qui réclamait un chiffre ou une pièce. L'absence n'était constatée
 * qu'à la toute fin, par le contrôle arithmétique, après que toutes les étapes avaient tourné
 * et coûté — et pas du tout si le modèle avait omis d'annoncer un livrable. Au banc :
 * STATISTIQUES 0/17, REPRESENTATION 2/17.
 *
 * ── LES TROIS CONDITIONS, ET CHACUNE ÉVITE UN REFUS À TORT ──────────────────────────────
 *
 *   1. la demande exige la primitive de façon SÛRE ;
 *   2. le catalogue en offre une à CET acteur — sinon c'est un manque à déclarer, pas une
 *      faute de plan, et refuser boucherait la seule issue honnête ;
 *   3. aucune étape ne la porte — un nœud ARTIFACT comptant comme DOCUMENT, puisque c'est
 *      lui qui fabrique le fichier.
 *
 * Le quatrième garde-fou est ailleurs : sous plafond de lecture, DOCUMENT et ACTION ne peuvent
 * pas être exigés. Exiger d'une mission à qui l'on vient d'interdire de produire qu'elle
 * produise serait une contradiction, et une contradiction qui BOUCLE.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const pdg: MissionActor = { userId: "u", label: "PDG", isAgent: false };

/** Un catalogue dont chaque capacité porte une primitive explicite — c'est ce qui est jugé. */
function catalogueDe(primitives: Record<string, string>): CapabilityCatalog {
  const noms = Object.keys(primitives);
  const briefs: CapabilityBrief[] = noms.map((id) => ({
    id, domain: "test", primitive: primitives[id], effect: "ANALYZE", batchable: false, summary: id,
  }));
  return {
    has: (n) => noms.includes(n),
    allowed: () => true,
    meta: (n) => ({ ...capabilityMeta(n), primitive: (primitives[n] ?? "INFORMATION") as never }),
    brief: () => briefs,
  };
}

const AVEC_CALCUL = catalogueDe({
  directory_list: "INFORMATION", run_analysis: "CALCUL", chart_advice: "REPRESENTATION",
});
const SANS_CALCUL = catalogueDe({ directory_list: "INFORMATION" });

function plan(steps: PlannedStep[]): MissionPlan {
  return {
    objective: "o", complexity: "B", scale: "S",
    workstreams: [{ id: "default", title: "d", outcome: "fait" }],
    steps, acceptance: ["c'est fait"],
  };
}

const lecture: PlannedStep = { key: "lire", title: "Lire", capability: "directory_list", input: {} };
const calcul: PlannedStep = { key: "calcul", title: "Calculer", capability: "run_analysis", input: {}, dependsOn: ["lire"] };
const messages = (r: ReturnType<typeof compile>): string => (r.ok ? "" : r.issues.map((i) => `${i.code} ${i.message}`).join(" | "));

const DEMANDE_CHIFFREE = "Combien de dossiers réglementaires sont en retard ?";

describe("un plan qui n'a pas l'étape que la demande réclame est refusé", () => {
  it("LE CAS QUI DOMINAIT STATISTIQUES : lire puis répondre, pour une demande chiffrée", () => {
    const r = compile(plan([lecture]), AVEC_CALCUL, pdg, { primitivesRequises: exigencesFermes(DEMANDE_CHIFFREE) });
    expect(r.ok).toBe(false);
    expect(messages(r)).toContain("MISSING_PRIMITIVE");
    expect(messages(r)).toContain("CALCUL");
    // Le refus laisse TOUJOURS l'issue honnête ouverte : dire le manque plutôt que conclure sans.
    expect(messages(r)).toContain("gaps");
  });

  it("le même plan, avec l'étape de calcul, compile", () => {
    const r = compile(plan([lecture, calcul]), AVEC_CALCUL, pdg, { primitivesRequises: exigencesFermes(DEMANDE_CHIFFREE) });
    expect(r.ok, messages(r)).toBe(true);
  });

  it("LE TEST QUI COMPTE : sans capacité de calcul disponible, on n'exige RIEN", () => {
    // Sinon la mission boucle : le refus repart au planificateur, qui ne peut pas y répondre
    // puisque rien dans son catalogue ne calcule. Ce n'est plus une faute de plan, c'est un
    // manque — et le déclarer est la bonne réponse, pas une réécriture de plus.
    const r = compile(plan([lecture]), SANS_CALCUL, pdg, { primitivesRequises: exigencesFermes(DEMANDE_CHIFFREE) });
    expect(r.ok, messages(r)).toBe(true);
  });

  it("un nœud ARTIFACT couvre DOCUMENT : c'est LUI qui fabrique le fichier", () => {
    const avecDoc = catalogueDe({ directory_list: "INFORMATION", create_report: "DOCUMENT" });
    const artefact: PlannedStep = { key: "piece", title: "Produire", nodeType: "ARTIFACT", dependsOn: ["lire"], input: {} };
    const r = compile(plan([lecture, artefact]), avecDoc, pdg, { primitivesRequises: ["DOCUMENT"] });
    expect(r.ok, messages(r)).toBe(true);
  });

  it("sous plafond de LECTURE, on n'exige ni pièce ni action — sans quoi le refus boucle", () => {
    // « Lis ce document et fais-m'en un rapport » en lecture seule : la mission s'est vu dire
    // qu'elle ne produirait AUCUN fichier. Lui reprocher de ne pas en produire n'a pas d'issue.
    const avecDoc = catalogueDe({ directory_list: "INFORMATION", create_report: "DOCUMENT" });
    const r = compile(plan([lecture]), avecDoc, pdg, { primitivesRequises: ["DOCUMENT"], effetMax: "ANALYZE" });
    expect(r.ok, messages(r)).toBe(true);
  });

  /**
   * LE COMPILATEUR DIT TOUT CE QU'IL SAIT EN UNE FOIS — mesuré sur la chaîne humaine live.
   *
   * Cette vérification était gardée par `issues.length === 0`. Conséquence observée : plan 1
   * refusé sur la FORME d'une attente, le planificateur corrige exactement ce qu'on lui
   * reproche, et le plan 2 découvre alors un MISSING_PRIMITIVE dont personne ne lui avait
   * parlé. Deux essais, deux reproches distincts, mission morte avant d'exister — tuée par
   * l'ORDRE des objections du compilateur, pas par l'incompétence du modèle.
   *
   * Un compilateur qui distille ses reproches fait payer un aller-retour de planification par
   * objection. Il les dit ensemble.
   */
  it("un plan qui a DEUX défauts indépendants s'en voit reprocher DEUX, pas un seul", () => {
    const avecDoc = catalogueDe({ directory_list: "INFORMATION", create_report: "DOCUMENT" });
    // Défaut 1 : une attente d'événement qui ne dit pas QUEL événement (forme).
    // Défaut 2 : la demande réclame une pièce, aucune étape ne la produit (couverture).
    const r = compile(plan([
      lecture,
      { key: "w", title: "Son retour", nodeType: "WAIT_EVENT", dependsOn: ["lire"] } as PlannedStep,
    ]), avecDoc, pdg, { primitivesRequises: ["DOCUMENT"] });
    expect(r.ok).toBe(false);
    expect(messages(r)).toContain("INVALID_SHAPE");
    expect(messages(r)).toContain("MISSING_PRIMITIVE");
  });

  /**
   * LA PRUDENCE RESTE, DÉPLACÉE : une capacité INVENTÉE n'apporte pas sa primitive.
   *
   * Sans cette condition, lever la garde aurait ouvert un trou : `create_report_pro`, nom
   * plausible et inexistant, se serait vu dériver DOCUMENT de son propre nom et aurait
   * « couvert » l'exigence — le manque réel disparaissant derrière une invention.
   */
  it("une capacité que le catalogue ne connaît pas ne couvre RIEN", () => {
    const avecDoc = catalogueDe({ directory_list: "INFORMATION", create_report: "DOCUMENT" });
    const r = compile(plan([
      lecture,
      { key: "faux", title: "Produire", capability: "create_report_pro", input: {}, dependsOn: ["lire"] } as PlannedStep,
    ]), avecDoc, pdg, { primitivesRequises: ["DOCUMENT"] });
    expect(r.ok).toBe(false);
    expect(messages(r)).toContain("UNKNOWN_CAPABILITY");
    expect(messages(r)).toContain("MISSING_PRIMITIVE");
  });

  /**
   * AUTANT DE PIÈCES QUE LA DEMANDE EN NOMME — la fausse cardinalité, un cran plus haut.
   *
   * MESURÉ live : « fais-moi un fichier Excel ET une présentation PowerPoint » a produit UNE
   * étape de livrable — le PowerPoint. Le classeur n'existait nulle part, et la couverture (§56)
   * n'avait rien à redire : elle demande qu'UNE étape porte DOCUMENT, et une suffisait. C'est
   * « 33 destinataires dans une étape au lieu de 33 étapes » (§118.3) appliqué aux pièces.
   */
  it("deux formats nommés exigent deux étapes qui produisent une pièce", () => {
    const avecDoc = catalogueDe({ directory_list: "INFORMATION", create_report: "DOCUMENT" });
    const DEUX = "Consolide et fais-moi un fichier Excel et une présentation PowerPoint.";
    const formats = formatsLivrablesDemandes(DEUX);
    expect(formats).toEqual(["Excel", "PowerPoint"]);

    const art = (key: string): PlannedStep =>
      ({ key, title: key, nodeType: "ARTIFACT", dependsOn: ["lire"], input: {} } as unknown as PlannedStep);

    const une = compile(plan([lecture, art("piece1")]), avecDoc, pdg,
      { primitivesRequises: exigencesFermes(DEUX), formatsLivrables: formats });
    expect(une.ok).toBe(false);
    expect(messages(une)).toContain("Excel, PowerPoint");
    /**
     * LE CODE DU REFUS COMPTE AUTANT QUE LE REFUS. Il a porté `MISSING_PRIMITIVE`, et la
     * tolérance « une exigence de couverture ne tue pas une mission » (§118.29) l'a laissé
     * passer au run suivant : le classeur demandé n'a jamais existé, la mission a conclu
     * PARTIAL. Deux pièces demandées et une planifiée est une CARDINALITÉ fausse — elle tue le
     * plan, comme « 33 destinataires dans un seul envoi ».
     */
    expect(messages(une)).toContain("CARDINALITY");
    expect(messages(une)).not.toContain("MISSING_PRIMITIVE");

    const deux = compile(plan([lecture, art("piece1"), art("piece2")]), avecDoc, pdg,
      { primitivesRequises: exigencesFermes(DEUX), formatsLivrables: formats });
    expect(deux.ok, messages(deux)).toBe(true);
  });

  /**
   * ET ELLE SE TAIT PARTOUT AILLEURS. Une garde de cardinalité qui se déclenche sur une phrase
   * ordinaire ferait refuser des plans corrects — elle serait retirée dans la semaine.
   */
  it("un seul format, aucun format, ou une pièce déjà existante : aucune exigence de nombre", () => {
    expect(formatsLivrablesDemandes("Fais-moi un fichier Excel des dossiers en retard.")).toEqual([]);
    expect(formatsLivrablesDemandes("Où en est le dossier Mouffok ?")).toEqual([]);
    // Pas de verbe de production : on ne FABRIQUE pas, on transmet.
    expect(formatsLivrablesDemandes("Envoie-moi l'Excel et le PowerPoint que Yacine a préparés.")).toEqual([]);
  });

  /**
   * ═════════════════════════════════════════════════════════════════════════════════════
   * UNE ÉTAPE CONDITIONNELLE PROPOSE ; ELLE NE PROMET PAS (§118.67)
   *
   * MESURÉ, mission `cmttakgtd…`, banc réel, neuf versions de plan. Les DEUX étapes ARTIFACT
   * étaient conditionnées à la complétude des données amont :
   *
   *   produire:registre-tracabilite-initial     SKIPPED
   *     « condition non remplie — normaliser:retour-initial.donneesCompletes : false ≠ true »
   *   produire:registre-tracabilite-correction  SKIPPED
   *     « condition non remplie — normaliser:retour-correction.donneesCompletes : false ≠ true »
   *
   * Une personne n'a pas tout donné. Zéro fichier, ZÉRO étape en échec, mission non bloquée,
   * journal muet : le faux succès parfait. Le compilateur avait validé la couverture parce
   * qu'il comptait un nœud ARTIFACT sans jamais regarder sa condition.
   * ═════════════════════════════════════════════════════════════════════════════════════
   */
  describe("un livrable CONDITIONNEL ne couvre pas une exigence FERME", () => {
    const avecDoc = catalogueDe({ directory_list: "INFORMATION", create_report: "DOCUMENT" });
    const art = (key: string, when?: unknown): PlannedStep =>
      ({ key, title: key, nodeType: "ARTIFACT", dependsOn: ["lire"], input: {}, ...(when ? { when } : {}) } as unknown as PlannedStep);

    it("LE CAS MESURÉ : deux pièces, deux conditions indépendantes, aucune garantie", () => {
      const r = compile(plan([
        lecture,
        art("produire:registre-initial", { step: "lire", path: "donneesCompletes", op: "eq", value: "true" }),
        art("produire:registre-correction", { step: "lire", path: "autreChamp", op: "eq", value: "true" }),
      ]), avecDoc, pdg, { primitivesRequises: ["DOCUMENT"] });
      expect(r.ok).toBe(false);
      expect(messages(r)).toContain("MISSING_PRIMITIVE");
      // LE REFUS MONTRE CE QU'IL A LU, et nomme le remède — sans quoi le planificateur
      // ajouterait une TROISIÈME étape tout aussi conditionnelle (§118.30).
      expect(messages(r)).toContain("TOUTES conditionnelles");
      expect(messages(r)).toContain("produire:registre-initial");
      expect(messages(r)).toContain("donneesCompletes");
      expect(messages(r)).toContain("retire la condition");
    });

    it("une pièce INCONDITIONNELLE couvre, comme avant", () => {
      const r = compile(plan([lecture, art("piece")]), avecDoc, pdg, { primitivesRequises: ["DOCUMENT"] });
      expect(r.ok, messages(r)).toBe(true);
    });

    /**
     * LE REFUS À TORT QU'IL FALLAIT ÉVITER (§118.27). La règle 18 du planificateur IMPOSE la
     * forme conditionnelle pour l'alternative d'une attente composée : relance en TIMEOUT,
     * suite en EVENT. Refuser cette forme-là aurait cassé la seule manière juste d'écrire
     * « si pas de réponse vendredi… », et 25 tests d'architecture l'avaient déjà dit une fois.
     */
    it("deux pièces sur les DEUX issues d'une même attente : une partira, donc c'est couvert", () => {
      const attente: PlannedStep =
        ({ key: "attendre:khaled", title: "Son retour", nodeType: "WAIT_EVENT", dependsOn: ["lire"],
           waitFor: { anyOf: [{ event: "MESSAGE_RECEIVED", from: "Khaled" }, { until: "2026-09-12T17:00:00Z" }] } } as unknown as PlannedStep);
      const r = compile(plan([
        lecture, attente,
        ({ key: "produire:avec", title: "Avec sa réponse", nodeType: "ARTIFACT", dependsOn: ["attendre:khaled"], input: {},
           when: { step: "attendre:khaled", outcome: "EVENT" } } as unknown as PlannedStep),
        ({ key: "produire:sans", title: "Sans sa réponse", nodeType: "ARTIFACT", dependsOn: ["attendre:khaled"], input: {},
           when: { step: "attendre:khaled", outcome: "TIMEOUT" } } as unknown as PlannedStep),
      ]), avecDoc, pdg, { primitivesRequises: ["DOCUMENT"] });
      expect(r.ok, messages(r)).toBe(true);
    });

    /**
     * DEUX FORMATS DEMANDÉS, DEUX BRANCHES QUI S'EXCLUENT : une seule partira. Le plan est
     * exécutable — c'est donc une exigence de COUVERTURE (§118.29), pas une cardinalité fausse.
     * Confondre les deux ferait mourir une mission là où un aller-retour suffit.
     */
    it("deux étapes écrites mais une seule garantie : COUVERTURE, jamais CARDINALITY", () => {
      const DEUX = "Consolide et fais-moi un fichier Excel et une présentation PowerPoint.";
      const attente: PlannedStep =
        ({ key: "attendre:khaled", title: "Son retour", nodeType: "WAIT_EVENT", dependsOn: ["lire"],
           waitFor: { anyOf: [{ event: "MESSAGE_RECEIVED", from: "Khaled" }, { until: "2026-09-12T17:00:00Z" }] } } as unknown as PlannedStep);
      const r = compile(plan([
        lecture, attente,
        ({ key: "produire:excel", title: "Excel", nodeType: "ARTIFACT", dependsOn: ["attendre:khaled"], input: {},
           when: { step: "attendre:khaled", outcome: "EVENT" } } as unknown as PlannedStep),
        ({ key: "produire:ppt", title: "PowerPoint", nodeType: "ARTIFACT", dependsOn: ["attendre:khaled"], input: {},
           when: { step: "attendre:khaled", outcome: "TIMEOUT" } } as unknown as PlannedStep),
      ]), avecDoc, pdg, { primitivesRequises: exigencesFermes(DEUX), formatsLivrables: formatsLivrablesDemandes(DEUX) });
      expect(r.ok).toBe(false);
      expect(messages(r)).toContain("MISSING_PRIMITIVE");
      expect(messages(r)).toContain("1 seulement partira");
      expect(messages(r)).not.toContain("CARDINALITY");
    });

    it("deux formats, deux pièces INCONDITIONNELLES : rien à redire", () => {
      const DEUX = "Consolide et fais-moi un fichier Excel et une présentation PowerPoint.";
      const r = compile(plan([lecture, art("produire:excel"), art("produire:ppt")]), avecDoc, pdg,
        { primitivesRequises: exigencesFermes(DEUX), formatsLivrables: formatsLivrablesDemandes(DEUX) });
      expect(r.ok, messages(r)).toBe(true);
    });

    /**
     * LA GARDE SE TAIT QUAND RIEN N'EST EXIGÉ. Une demande qui ne réclame aucune pièce laisse
     * le planificateur libre de conditionner son livrable : c'est son droit, et une garde qui
     * se déclenche sur un plan correct est retirée dans la semaine.
     */
    it("aucune exigence ferme : un livrable conditionnel passe sans un mot", () => {
      const r = compile(plan([
        lecture,
        art("produire:annexe", { step: "lire", path: "gros", op: "eq", value: "true" }),
      ]), avecDoc, pdg, {});
      expect(r.ok, messages(r)).toBe(true);
    });
  });

  it("aucune exigence : le compilateur se comporte exactement comme avant", () => {
    expect(compile(plan([lecture]), AVEC_CALCUL, pdg).ok).toBe(true);
    expect(compile(plan([lecture]), AVEC_CALCUL, pdg, { primitivesRequises: [] }).ok).toBe(true);
  });
});

describe("mesure consignée — de la demande au refus, par le chemin complet", () => {
  it("les demandes qui exigent une primitive absente du plan sont toutes refusées", () => {
    /**
     * On part de la PHRASE, pas d'une liste de primitives écrite à la main : c'est la chaîne
     * réelle (lire la demande → exiger → refuser) qui est mesurée. La seconde moitié du jeu
     * vérifie qu'un plan complet, ou une demande sans exigence, passe toujours.
     */
    const refusables: [string, PlannedStep[]][] = [
      ["Combien de contrats arrivent à échéance ?", [lecture]],
      ["Calcule le total des pénalités", [lecture]],
      ["Quel est le taux de rejet de nos dossiers ?", [lecture]],
      ["Donne-moi la moyenne des délais par service", [lecture]],
      ["Fais un graphique des immatriculations", [lecture, calcul]],
    ];
    const acceptables: [string, PlannedStep[]][] = [
      ["Combien de contrats arrivent à échéance ?", [lecture, calcul]],
      ["Qui est responsable du dossier Mouffok ?", [lecture]],
      ["Retrouve le contrat signé avec Sanofi", [lecture]],
      ["Attends le devis du fournisseur avant de conclure", [lecture]],
    ];
    const opts = (d: string) => ({ primitivesRequises: exigencesFermes(d) });
    const refuses = refusables.filter(([d, st]) => !compile(plan(st), AVEC_CALCUL, pdg, opts(d)).ok).length;
    const passes = acceptables.filter(([d, st]) => compile(plan(st), AVEC_CALCUL, pdg, opts(d)).ok).length;

    consignerMesure("plan_couvre_objectif", { n: refusables.length + acceptables.length, ok: refuses + passes },
      "lib/missions/compiler/couverture.test.ts",
      "plans jugés correctement sur la couverture des primitives que la demande exige — refus quand il manque, passage quand tout y est");

    expect(refusables.filter(([d, st]) => compile(plan(st), AVEC_CALCUL, pdg, opts(d)).ok).map(([d]) => d)).toEqual([]);
    expect(acceptables.filter(([d, st]) => !compile(plan(st), AVEC_CALCUL, pdg, opts(d)).ok).map(([d]) => d)).toEqual([]);
  });
});
