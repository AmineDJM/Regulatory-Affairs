import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  dgRequis, estDecisionnaire, estIgnoree, estKam, etapesNonAtteintes, parcoursAdPro, parcoursEffectif,
  seuilFranchissement,
  SLUG_DG, SLUG_DIRECTION, SLUG_MARKETING, SLUG_PRELIMINAIRE,
} from "./parcours";
import { WORKFLOW_CATEGORIES } from "./types";

/** LA COLONNE VERTÉBRALE, DANS L'ORDRE — Direction des opérations AVANT Direction Marketing. */
const SPINE = [SLUG_PRELIMINAIRE, SLUG_DG, SLUG_DIRECTION, SLUG_MARKETING];

/**
 * LES TROIS BRANCHES Ad & Pro. Chaque cas nomme la situation qui le ferait tomber — une assertion
 * dont on ne sait pas nommer ce cas n'est pas une assertion (§118.17).
 */
describe("le parcours d'une demande Ad & Pro dépend de qui la pose", () => {
  it("un KAM : son superviseur national filtre, et LUI SEUL", () => {
    // Ce qui le ferait tomber : laisser `final` sur sa route, comme avant le 22/09/2026. La
    // Direction des opérations validerait une demande que la Direction a voulu lui épargner, et
    // le demandeur attendrait un guichet de plus.
    expect(parcoursAdPro({ rang: 0, kam: true }))
      .toEqual({ entree: SLUG_PRELIMINAIRE, decision: null, ignorees: [SLUG_DIRECTION] });
  });

  it("le National Sales lui-même : la Direction des opérations, pas son propre préliminaire", () => {
    // Ce qui le ferait tomber : garder `preliminary`. Il s'approuverait lui-même — une
    // validation qui ne mesure rien. Ou retirer `final` : plus aucun filtre au-dessus de lui.
    expect(parcoursAdPro({ rang: 1, kam: true }))
      .toEqual({ entree: SLUG_DG, decision: null, ignorees: [SLUG_PRELIMINAIRE] });
  });

  it("tout autre demandeur : DIRECT chez Direction Marketing, aucun filtre hiérarchique", () => {
    // Ce qui le ferait tomber : garder `final`. Un chef de service verrait sa demande partir
    // chez la Direction des opérations, que la Direction a explicitement retirée de sa route.
    expect(parcoursAdPro({ rang: 0, kam: false }))
      .toEqual({ entree: SLUG_DG, decision: null, ignorees: [SLUG_PRELIMINAIRE, SLUG_DIRECTION] });
  });

  it("Direction Marketing ne TRANCHE pas sa propre demande — la Direction le fait à sa place", () => {
    // Ce qui le ferait tomber : `decision: null`. La demande de Direction Marketing reviendrait à
    // Direction Marketing, c'est-à-dire à elle-même.
    expect(parcoursAdPro({ rang: 2, kam: false }))
      .toEqual({ entree: SLUG_DG, decision: SLUG_DIRECTION, ignorees: [SLUG_PRELIMINAIRE] });
  });

  it("la porte du DG reste DEVANT Direction Marketing quand c'est elle qui demande", () => {
    // Une rallonge d'un million ne se décide pas plus bas parce qu'elle vient d'en haut :
    // l'entrée est la porte du DG, pas l'étape de la Direction.
    expect(parcoursAdPro({ rang: 2, kam: false }).entree).toBe(SLUG_DG);
  });

  it("la Direction, le DG, le Super Admin : il ne reste que la décision de Direction Marketing", () => {
    // Tout ce qui précède est soit leur propre accord, soit une porte dont ils sont la clé.
    expect(parcoursAdPro({ rang: 3, kam: false }))
      .toEqual({ entree: SLUG_MARKETING, decision: null, ignorees: [SLUG_PRELIMINAIRE, SLUG_DG, SLUG_DIRECTION] });
  });

  it("LE RANG L'EMPORTE SUR LE MÉTIER — le cas qui a dicté la forme de ce module", () => {
    // Un délégué médical qui porte AUSSI Direction Marketing est un KAM au sens du texte, mais
    // sa demande ne peut pas être tranchée par lui-même. Une sortie décidée sur le seul fait
    // « c'est un KAM » l'aurait laissée revenir à son propre bureau.
    expect(parcoursAdPro({ rang: 2, kam: true }))
      .toEqual({ entree: SLUG_DG, decision: SLUG_DIRECTION, ignorees: [SLUG_PRELIMINAIRE] });
    expect(parcoursAdPro({ rang: 3, kam: true }).entree).toBe(SLUG_MARKETING);
  });

  it("LA PROPRIÉTÉ QUI A REMPLACÉ LA CONTIGUÏTÉ : l'entrée n'est JAMAIS ignorée", () => {
    // La garantie que le tamis ne peut pas rendre une demande mort-née. Sans elle, une branche
    // ajoutée demain pourrait poser la demande sur une étape que son propre parcours saute :
    // personne pour la franchir, aucune étape en échec, le module mort (§118.113).
    //
    // C'est aussi la seule chose qui remplace la contiguïté perdue. La contiguïté était
    // VÉRIFIABLE par construction ; celle-ci se vérifie par un test, donc il faut le tenir.
    for (const rang of [0, 1, 2, 3, 4]) {
      for (const kam of [true, false]) {
        const p = parcoursAdPro({ rang, kam });
        expect(p.ignorees, `rang ${rang} kam=${kam} : l'entrée ${p.entree} est sautée par son propre parcours`)
          .not.toContain(p.entree);
        if (p.decision !== null) {
          expect(p.ignorees, `rang ${rang} kam=${kam} : la borne ${p.decision} est sautée par son propre parcours`)
            .not.toContain(p.decision);
        }
      }
    }
  });

  it("le tamis ne nomme QUE des étapes de la colonne vertébrale", () => {
    // Ce qui le ferait tomber : y écrire un slug inventé. Il ne sauterait rien aujourd'hui, et
    // sauterait l'étape le jour où quelqu'un lui donne ce nom — un saut que personne n'a décidé.
    for (const rang of [0, 1, 2, 3]) {
      for (const kam of [true, false]) {
        for (const slug of parcoursAdPro({ rang, kam }).ignorees) {
          expect(SPINE, `rang ${rang} kam=${kam}`).toContain(slug);
        }
      }
    }
  });

  it("le rôle SECONDAIRE compte : un collègue qui exerce aussi comme délégué est un KAM", () => {
    expect(estKam({ role: "MEDICAL_DELEGATE" })).toBe(true);
    expect(estKam({ role: "SALES_USER", secondaryRole: "MEDICAL_DELEGATE" })).toBe(true);
    expect(estKam({ role: "NATIONAL_SALES" }), "le National Sales fait le même métier mais c'est LUI le superviseur").toBe(false);
    expect(estKam(null)).toBe(false);
  });
});

/**
 * LA PORTE DU DIRECTEUR GÉNÉRAL — un seuil GLOBAL, sauf réglage explicite de l'étape.
 *
 * Deux sources, et l'ordre entre elles est la règle : un seuil écrit à la main sur l'étape est
 * une décision prise pour CE circuit, que la valeur globale ne doit pas écraser en silence.
 */
describe("le seuil de franchissement", () => {
  it("un seuil écrit sur l'étape l'emporte TOUJOURS sur le seuil global", () => {
    // Ce qui le ferait tomber : inverser la priorité. Le Super Admin qui règle « 50 000 » sur le
    // circuit Sponsoring verrait sa valeur remplacée par le seuil global au premier battement.
    expect(seuilFranchissement(SLUG_DG, 50_000, 1_000_000)).toBe(50_000);
    expect(seuilFranchissement("une-etape-sur-mesure", 50_000, 1_000_000)).toBe(50_000);
  });

  it("le seuil GLOBAL ne gouverne QUE la porte du DG", () => {
    // Ce qui le ferait tomber : l'appliquer à toute étape sans seuil. Toutes les validations
    // sous un million seraient franchies automatiquement — le circuit entier disparaîtrait.
    expect(seuilFranchissement(SLUG_DG, null, 1_000_000)).toBe(1_000_000);
    expect(seuilFranchissement(SLUG_DIRECTION, null, 1_000_000)).toBeNull();
    expect(seuilFranchissement(SLUG_MARKETING, null, 1_000_000)).toBeNull();
  });

  it("un seuil nul, négatif ou absent ne franchit RIEN", () => {
    expect(seuilFranchissement(SLUG_DG, null, 0)).toBeNull();
    expect(seuilFranchissement(SLUG_DG, null, null)).toBeNull();
    expect(seuilFranchissement(SLUG_DG, -1, null)).toBeNull();
  });

  it("un montant INCONNU fait passer par le DG — on ne franchit pas une porte de contrôle sur un trou", () => {
    // L'erreur coûte une validation de trop ; l'erreur inverse laisserait sortir une dépense
    // d'un million sans que personne en haut l'ait vue.
    expect(dgRequis(null, 1_000_000)).toBe(true);
    expect(dgRequis(0, 1_000_000)).toBe(true);
    expect(dgRequis(999_999, 1_000_000)).toBe(false);
    expect(dgRequis(1_000_000, 1_000_000), "« à partir de » se lit STRICTEMENT au-dessus du seuil réglé").toBe(false);
    expect(dgRequis(1_000_001, 1_000_000)).toBe(true);
    expect(dgRequis(5_000_000, 0), "aucun seuil réglé ⇒ aucune porte du DG").toBe(false);
  });
});

describe("le parcours EFFECTIF — les deux faits, filtrés contre la définition réelle", () => {
  it("il NOMME la borne et le tamis quand la définition les porte", () => {
    expect(parcoursEffectif({ role: "PRODUCT_MANAGER" }, SPINE, 2))
      .toEqual({ entree: SLUG_DG, decision: SLUG_DIRECTION, ignorees: [SLUG_PRELIMINAIRE] });
    expect(parcoursEffectif({ role: "MEDICAL_DELEGATE" }, SPINE, 0))
      .toEqual({ entree: SLUG_PRELIMINAIRE, decision: null, ignorees: [SLUG_DIRECTION] });
  });

  it("un circuit REMODELÉ qui n'a plus ces étapes retombe sur la chaîne ENTIÈRE", () => {
    // Une garde qui refuse ce qu'elle ne comprend pas est désactivée dans la semaine (§118.16).
    // Ce qui le ferait tomber : garder le tamis non filtré. Une étape absente aujourd'hui, mais
    // AJOUTÉE demain par un Super Admin, serait sautée en silence — sa décision défaite sans une
    // ligne pour le dire, alors qu'une validation de trop se voit et se franchit (§118.27).
    expect(parcoursEffectif({ role: "PRODUCT_MANAGER" }, ["etape-a", "etape-b"], 2))
      .toEqual({ entree: SLUG_DG, decision: null, ignorees: [] });
    expect(parcoursEffectif({ role: "PRODUCT_MANAGER" }, [], 2))
      .toEqual({ entree: SLUG_DG, decision: null, ignorees: [] });
  });

  it("un circuit PARTIEL ne garde que ce qu'il porte vraiment", () => {
    // Un circuit sans porte du DG : le tamis d'un demandeur ordinaire ne doit nommer que `final`.
    expect(parcoursEffectif({ role: "FINANCE_MANAGER" }, [SLUG_DIRECTION, SLUG_MARKETING], 0).ignorees)
      .toEqual([SLUG_DIRECTION]);
  });

  it("un demandeur INCONNU : `estKam` rend faux, donc le parcours d'un demandeur ordinaire", () => {
    // On ne raccourcit jamais une DÉCISION sur une absence de donnée — et le moteur, lui, ne
    // fabrique aucun parcours sans demandeur (il écrit `null` et la chaîne entière s'applique).
    expect(parcoursEffectif(null, SPINE, 0).decision).toBeNull();
    expect(parcoursEffectif(undefined, SPINE, 0).decision).toBeNull();
  });

  it("« cette étape tranche-t-elle ? » se lit à UN endroit, et se taît sans borne", () => {
    expect(estDecisionnaire(SLUG_DIRECTION, SLUG_DIRECTION)).toBe(true);
    expect(estDecisionnaire(SLUG_MARKETING, SLUG_DIRECTION)).toBe(false);
    expect(estDecisionnaire(SLUG_MARKETING, null), "sans borne, aucune étape ne tranche prématurément").toBe(false);
  });

  it("« cette étape est-elle hors route ? » se lit à UN endroit, et se taît sur un tamis vide", () => {
    expect(estIgnoree(SLUG_DIRECTION, [SLUG_DIRECTION])).toBe(true);
    expect(estIgnoree(SLUG_DIRECTION, [])).toBe(false);
    expect(estIgnoree(SLUG_DG, [SLUG_PRELIMINAIRE, SLUG_DIRECTION])).toBe(false);
  });
});

describe("les étapes non atteintes — la queue coupée ET le tamis", () => {
  it("elle nomme les étapes situées APRÈS la borne", () => {
    expect(etapesNonAtteintes(SPINE, SLUG_DIRECTION, [])).toEqual([SLUG_MARKETING]);
    expect(etapesNonAtteintes(SPINE, SLUG_PRELIMINAIRE, [])).toEqual([SLUG_DG, SLUG_DIRECTION, SLUG_MARKETING]);
  });

  it("elle nomme AUSSI les étapes sautées au MILIEU — le cas que la queue seule ratait", () => {
    // LE CAS QUI COMPTE, et c'est celui d'un KAM : AUCUNE borne (Direction Marketing est la
    // dernière étape) et pourtant `final` sautée. Ce qui le ferait tomber : revenir à la queue
    // seule. Un Super Admin qui aurait posé l'ordre de dépense sur l'étape de la Direction
    // verrait l'émission se perdre — budget accordé, rien d'engagé, aucune étape en échec.
    expect(etapesNonAtteintes(SPINE, null, [SLUG_DIRECTION])).toEqual([SLUG_DIRECTION]);
    expect(etapesNonAtteintes(SPINE, null, [SLUG_PRELIMINAIRE, SLUG_DIRECTION]))
      .toEqual([SLUG_PRELIMINAIRE, SLUG_DIRECTION]);
  });

  it("queue et tamis se RÉUNISSENT sans doublon, dans l'ordre de la colonne", () => {
    expect(etapesNonAtteintes(SPINE, SLUG_DIRECTION, [SLUG_PRELIMINAIRE, SLUG_MARKETING]))
      .toEqual([SLUG_PRELIMINAIRE, SLUG_MARKETING]);
  });

  it("l'étape qui TRANCHE n'est jamais rendue, même sur une paire incohérente", () => {
    // Elle EST atteinte : c'est elle qui hérite. La paire serait fautive (une borne qui figure
    // aussi dans son propre tamis), mais rien ne doit faire hériter une étape d'elle-même — le
    // montant serait émis deux fois au même endroit.
    expect(etapesNonAtteintes(SPINE, SLUG_DIRECTION, [SLUG_DIRECTION])).toEqual([SLUG_MARKETING]);
  });

  it("sans borne ni tamis, ou sur une borne inconnue, RIEN n'est retiré", () => {
    // Ce qui le ferait tomber : rendre la définition entière sur une borne inconnue. L'écran
    // n'afficherait plus AUCUNE étape, et le moteur hériterait d'émissions qui ne sont pas dues.
    expect(etapesNonAtteintes(SPINE, null, [])).toEqual([]);
    expect(etapesNonAtteintes(SPINE, "etape-qui-n-existe-pas", [])).toEqual([]);
    expect(etapesNonAtteintes(SPINE, SLUG_MARKETING, []), "la dernière étape ne coupe rien").toEqual([]);
    expect(etapesNonAtteintes(SPINE, null, ["etape-qui-n-existe-pas"])).toEqual([]);
  });
});

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE CLIQUET DE LA MIGRATION — parce que sa première version était FAUSSE, et silencieuse.
 *
 * Elle filtrait sur `category IN ('SPONSORING','CONGRESS_INTERNATIONAL','CONGRESS_NATIONAL',
 * 'EVENT')`. La quatrième valeur n'existe pas : la catégorie s'appelle `EVENTS` — `EVENT` est
 * l'EntityType de son entité source. Mesuré en base : la définition « Événements » n'a PAS été
 * migrée, et la migration a rapporté un succès.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
describe("la migration Ad&Pro ne peut pas manquer une catégorie", () => {
  const brut = fs.readFileSync(
    path.join(process.cwd(), "prisma/migrations/20261106090000_adpro_direction_marketing/migration.sql"),
    "utf8",
  );

  /**
   * ON JUGE LE CODE, PAS LES COMMENTAIRES — et ce test l'a appris sur lui-même.
   *
   * L'en-tête de cette migration CITE la liste fautive pour documenter le défaut qu'elle répare.
   * Les deux assertions ci-dessous s'y sont accrochées au premier passage : elles mesuraient ma
   * PROSE et non l'instruction SQL. C'est le défaut du cliquet des lecteurs de champ (§118.79d) et
   * de la garde de sortie (§118.88), une troisième fois — un test qui accroche les exemples de sa
   * propre documentation ne mesure pas ce qu'il croit mesurer. On retire donc les commentaires.
   */
  const sql = brut.replace(/--[^\n]*/g, "");

  it("elle ne filtre sur AUCUNE liste de catégories — un nom à tenir à jour est un nom qu'on oublie", () => {
    // Ce qui le ferait tomber : réintroduire un filtre par catégorie. Toute `WorkflowDefinition`
    // est un circuit Ad & Pro (`WORKFLOW_CATEGORIES` n'en contient que quatre), donc le filtre
    // n'apportait rien qu'une occasion de se tromper.
    expect(WORKFLOW_CATEGORIES.length, "si un cinquième circuit apparaît, cette hypothèse doit être relue").toBe(4);
    expect(sql, "cibler par catégorie ⇒ une catégorie peut être manquée en silence").not.toMatch(/category"?\s+IN\s*\(/i);
  });

  it("toute catégorie qu'elle NOMMERAIT quand même doit être une vraie catégorie", () => {
    // Filet de la même famille, dans l'autre sens : si quelqu'un cite une catégorie dans cette
    // migration (un commentaire ne compte pas — on lit les littéraux SQL), elle doit exister.
    const citees = [...sql.matchAll(/'([A-Z][A-Z_]{3,})'/g)].map((m) => m[1]!);
    const ressemblantes = citees.filter((c) => /SPONSOR|CONGRESS|EVENT/.test(c));
    for (const c of ressemblantes) {
      expect(WORKFLOW_CATEGORIES as readonly string[], `« ${c} » n'est pas une catégorie de workflow`).toContain(c);
    }
  });

  it("elle est IDEMPOTENTE : chaque écriture porte sa condition d'arrêt", () => {
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS");
    // Les deux étapes réécrites sur place se bornent par un pouvoir qui disparaît après le
    // premier passage — sans cela, un second passage réécrirait un réglage que le Super Admin
    // aurait modifié entre-temps.
    expect(sql).toContain(`'SET_AMOUNT' = ANY ("powers")`);
    expect(sql).toContain(`'ASSIGN' = ANY ("powers")`);
  });

  it("le renommage du slug emporte l'HISTORIQUE — sinon les avis confidentiels passés s'ouvrent", () => {
    // Le caviardage se fait par slug. Renommer l'étape sans renommer ses événements passés
    // rendrait tous les avis historiques visibles du demandeur du jour au lendemain.
    expect(sql).toMatch(/UPDATE "WorkflowStepEvent"[\s\S]*?"stepSlug" = 'marketing'/);
    expect(sql).toMatch(/UPDATE "WorkflowInstance" SET "currentSlug" = 'marketing'/);
  });
});

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LA MIGRATION DE L'INVERSION (§118.138) — ce qu'elle DOIT faire, et ce qu'elle doit ÉPARGNER.
 *
 * `defaults.ts` n'est semé que là où rien n'existe : changer la graine seule aurait laissé la
 * production sur l'ancien circuit, en silence (§118.107). La migration est donc la moitié qui
 * compte, et elle se lit ici sur le CODE — les commentaires sont retirés, parce qu'un test qui
 * accroche la prose de ce qu'il vérifie ne mesure pas ce qu'il croit (§118.79d).
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
describe("la migration Ad&Pro — l'ordre s'inverse, Direction Marketing tranche", () => {
  const brut = fs.readFileSync(
    path.join(process.cwd(), "prisma/migrations/20261116090000_adpro_ordre_marketing_final/migration.sql"),
    "utf8",
  );
  const sql = brut.replace(/--[^\n]*/g, "");

  it("elle pose le SEUIL du Directeur Général, et de façon idempotente", () => {
    expect(sql).toMatch(/ALTER TABLE "AppSetting"[\s\S]*?ADD COLUMN IF NOT EXISTS "adProDgThreshold"/);
  });

  it("elle INSÈRE la porte du DG, et une seule fois", () => {
    // Ce qui le ferait tomber : retirer la condition `NOT EXISTS … slug = 'dg'`. Un second
    // passage créerait une deuxième porte du DG dans chaque circuit.
    expect(sql).toMatch(/INSERT INTO "WorkflowStep"/);
    expect(sql).toMatch(/NOT EXISTS \(SELECT 1 FROM "WorkflowStep" s WHERE s\."definitionId" = d\."id" AND s\."slug" = 'dg'\)/);
  });

  it("L'ORDRE est écrit en toutes lettres : préliminaire, DG, Direction, Direction Marketing", () => {
    const pos = sql.slice(sql.indexOf("SET \"position\" = CASE"));
    for (const [slug, rang] of [["preliminary", "0"], ["dg", "1"], ["final", "2"], ["marketing", "3"]] as const) {
      expect(pos, `${slug} doit prendre le rang ${rang}`).toMatch(new RegExp(`WHEN '${slug}'\\s+THEN ${rang}`));
    }
  });

  it("les ÉMISSIONS financières quittent la Direction pour l'étape qui fixe le montant", () => {
    // Les laisser sur la Direction émettrait l'ordre de dépense AVANT que le montant ne soit
    // arrêté : l'argent engagé sur un chiffre que personne n'a encore fixé.
    //
    // ON DÉCOUPE PAR INSTRUCTION, et c'est la première version de ce test qui l'a appris : une
    // fenêtre de caractères avant le mot « marketing » attrapait le WHERE de l'INSERT, pas
    // l'UPDATE — elle mesurait la liste de colonnes d'à côté.
    const instructions = sql.split(";").map((i) => i.trim()).filter(Boolean);
    const updateDe = (slug: string) => {
      const u = instructions.find((i) => i.startsWith("UPDATE \"WorkflowStep\"") && i.includes(`s."slug" = '${slug}'`));
      expect(u, `un UPDATE doit viser l'étape « ${slug} »`).toBeTruthy();
      return u!;
    };
    const marketing = updateDe("marketing");
    expect(marketing).toMatch(/"emitExpenseOrder" = TRUE/);
    expect(marketing).toMatch(/"emitDeclaration"\s+= TRUE/);
    expect(marketing).toMatch(/"requireAmount"\s+= TRUE/);
    expect(marketing).toMatch(/"requireCategory"\s+= TRUE/);
    expect(marketing, "elle DÉCIDE, donc son avis n'est plus caviardé").toMatch(/"confidential"\s+= FALSE/);
    const direction = updateDe("final");
    expect(direction).toMatch(/"emitExpenseOrder" = FALSE/);
    expect(direction).toMatch(/"emitDeclaration"\s+= FALSE/);
    expect(direction, "le montant n'est plus de son ressort").toMatch(/"requireAmount"\s+= FALSE/);
  });

  it("elle ÉPARGNE les circuits que le Super Admin a remodelés", () => {
    // Renuméroter les positions d'un circuit remodelé déplacerait SON étape derrière l'étape
    // décisive, donc la rendrait inatteignable — en silence. Chaque écriture porte la garde.
    // L'alias diffère selon l'instruction (`s.` dans l'INSERT, `x.` dans les UPDATE) : ne
    // reconnaître qu'un seul aurait compté UNE garde sur quatre et laissé l'assertion passer.
    const gardes = [...sql.matchAll(/[sx]\."slug" NOT IN \('preliminary','dg','final','marketing'\)/g)];
    expect(gardes.length, "une garde par UPDATE plus celle de l'INSERT").toBeGreaterThanOrEqual(3);
  });

  it("elle ne touche NI aux instances NI à leur borne de sortie", () => {
    // `finalSlug = 'marketing'` et « pas de borne » donnent le MÊME parcours dès que `marketing`
    // est la dernière étape : réécrire ce champ n'aurait rien changé et aurait touché une donnée
    // que le moteur fige délibérément à la naissance.
    expect(sql).not.toMatch(/UPDATE "WorkflowInstance"/);
    expect(sql, "aucun montant ni aucune décision déjà pris ne sont recalculés").not.toMatch(/"amountGranted"|"finalAmount"/);
  });

  it("la graine et la migration racontent LE MÊME circuit", () => {
    // Deux vérités sur l'ordre des étapes divergeraient : un déploiement neuf n'aurait pas le
    // même circuit qu'un déploiement migré, et personne ne s'en apercevrait (§118.5).
    const graine = fs.readFileSync(path.join(process.cwd(), "src/lib/workflow/defaults.ts"), "utf8");
    const ordreGraine = ["SLUG_PRELIMINAIRE", "SLUG_DG", "SLUG_DIRECTION", "SLUG_MARKETING"]
      .map((c) => graine.indexOf(`slug: ${c},`));
    expect(ordreGraine.every((i) => i > 0), "les quatre étapes sont semées").toBe(true);
    expect([...ordreGraine].sort((a, b) => a - b), "dans cet ordre").toEqual(ordreGraine);
  });
});
