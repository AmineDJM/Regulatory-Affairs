import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  estDecisionnaire, estKam, parcoursAdPro, queueCoupee, slugDecisionnaire,
  SLUG_DIRECTION, SLUG_MARKETING, SLUG_PRELIMINAIRE,
} from "./parcours";
import { WORKFLOW_CATEGORIES } from "./types";

const SPINE = [SLUG_PRELIMINAIRE, SLUG_MARKETING, SLUG_DIRECTION];

/**
 * LES DEUX PARCOURS Ad & Pro. Chaque cas nomme la situation qui le ferait tomber — une assertion
 * dont on ne sait pas nommer ce cas n'est pas une assertion (§118.17).
 */
describe("le parcours d'une demande Ad & Pro dépend de qui la pose", () => {
  it("un KAM : son superviseur national filtre, Direction Marketing TRANCHE", () => {
    // Ce qui le ferait tomber : rendre `sortie: null`. La demande du KAM repartirait vers la
    // Direction, qui n'est pas dans son parcours — un demandeur qui attend, et une Direction qui
    // croit avoir un dossier à traiter.
    expect(parcoursAdPro({ rang: 0, kam: true })).toEqual({ entree: SLUG_PRELIMINAIRE, sortie: SLUG_MARKETING });
  });

  it("tout autre demandeur, National Sales compris : Direction Marketing puis Direction", () => {
    expect(parcoursAdPro({ rang: 1, kam: true })).toEqual({ entree: SLUG_MARKETING, sortie: null });
    expect(parcoursAdPro({ rang: 0, kam: false })).toEqual({ entree: SLUG_MARKETING, sortie: null });
  });

  it("Direction Marketing ne s'arbitre pas sa propre demande — elle va à la Direction", () => {
    expect(parcoursAdPro({ rang: 2, kam: false })).toEqual({ entree: SLUG_DIRECTION, sortie: null });
  });

  it("la Direction tranche, et peut demander un arbitrage AVANT — sans y être tenue", () => {
    expect(parcoursAdPro({ rang: 3, kam: false })).toEqual({ entree: SLUG_DIRECTION, sortie: null });
    expect(parcoursAdPro({ rang: 3, kam: false, viaMarketing: true })).toEqual({ entree: SLUG_MARKETING, sortie: null });
  });

  it("LE RANG L'EMPORTE SUR LE MÉTIER — le cas qui a dicté la forme de ce module", () => {
    // Un délégué médical qui porte AUSSI Direction Marketing est un KAM au sens du texte, mais
    // sa demande ne peut pas être arbitrée par lui-même. Une sortie décidée sur le seul fait
    // « c'est un KAM » l'aurait bornée à une étape SITUÉE AVANT celle où la demande se trouve :
    // la vue aurait masqué l'étape courante, et l'écran n'aurait montré aucune action à prendre.
    expect(parcoursAdPro({ rang: 2, kam: true })).toEqual({ entree: SLUG_DIRECTION, sortie: null });
    expect(parcoursAdPro({ rang: 3, kam: true })).toEqual({ entree: SLUG_DIRECTION, sortie: null });
  });

  it("le rôle SECONDAIRE compte : un collègue qui exerce aussi comme délégué est un KAM", () => {
    expect(estKam({ role: "MEDICAL_DELEGATE" })).toBe(true);
    expect(estKam({ role: "SALES_USER", secondaryRole: "MEDICAL_DELEGATE" })).toBe(true);
    expect(estKam({ role: "NATIONAL_SALES" }), "le National Sales fait le même métier mais c'est LUI le superviseur").toBe(false);
    expect(estKam(null)).toBe(false);
  });
});

describe("la borne de sortie — et ce qu'elle laisse passer", () => {
  it("elle NOMME l'étape quand la définition la porte", () => {
    expect(slugDecisionnaire({ role: "MEDICAL_DELEGATE" }, SPINE, 0)).toBe(SLUG_MARKETING);
    expect(slugDecisionnaire({ role: "DIRECTION_ASSISTANT" }, SPINE, 0)).toBeNull();
  });

  it("un circuit REMODELÉ qui n'a plus d'étape « marketing » retombe sur le comportement d'avant", () => {
    // Une garde qui refuse ce qu'elle ne comprend pas est désactivée dans la semaine (§118.16).
    // Ce qui le ferait tomber : borner sur une étape absente — le moteur chercherait alors une
    // étape décisionnaire qui n'existe pas et n'en trouverait jamais.
    expect(slugDecisionnaire({ role: "MEDICAL_DELEGATE" }, ["etape-a", "etape-b"], 0)).toBeNull();
    expect(slugDecisionnaire({ role: "MEDICAL_DELEGATE" }, [], 0)).toBeNull();
  });

  it("un demandeur INCONNU ne borne rien : on ne raccourcit jamais un circuit sur une absence de donnée", () => {
    expect(slugDecisionnaire(null, SPINE, 0)).toBeNull();
    expect(slugDecisionnaire(undefined, SPINE, 0)).toBeNull();
  });

  it("« cette étape tranche-t-elle ? » se lit à UN endroit, et se taît sans borne", () => {
    expect(estDecisionnaire(SLUG_MARKETING, SLUG_MARKETING)).toBe(true);
    expect(estDecisionnaire(SLUG_DIRECTION, SLUG_MARKETING)).toBe(false);
    expect(estDecisionnaire(SLUG_MARKETING, null), "sans borne, aucune étape ne tranche prématurément").toBe(false);
  });
});

describe("la queue coupée — ce que la demande n'atteindra jamais", () => {
  it("elle nomme les étapes situées APRÈS la borne", () => {
    expect(queueCoupee(SPINE, SLUG_MARKETING)).toEqual([SLUG_DIRECTION]);
    expect(queueCoupee(SPINE, SLUG_PRELIMINAIRE)).toEqual([SLUG_MARKETING, SLUG_DIRECTION]);
  });

  it("sans borne, ou sur une borne inconnue, RIEN n'est coupé", () => {
    // Ce qui le ferait tomber : rendre la définition entière sur une borne inconnue. L'écran
    // n'afficherait plus AUCUNE étape, et le moteur hériterait d'émissions qui ne sont pas dues.
    expect(queueCoupee(SPINE, null)).toEqual([]);
    expect(queueCoupee(SPINE, "etape-qui-n-existe-pas")).toEqual([]);
    expect(queueCoupee(SPINE, SLUG_DIRECTION), "la dernière étape ne coupe rien").toEqual([]);
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
