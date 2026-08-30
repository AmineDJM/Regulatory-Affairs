import { describe, it, expect } from "vitest";
import fs from "node:fs";
import { scanBoundary, ADAM_PATHS, BRIDGE_PATHS } from "./boundary-scan";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE CLIQUET DE FRONTIÈRE — la dette peut baisser, jamais monter.
 *
 * ── POURQUOI UN BUDGET PLUTÔT QU'UN INTERDIT ─────────────────────────────────────────────
 *
 * Le jour où cette frontière a été posée, Adam importait l'ERP à 425 endroits. Interdire d'un
 * coup aurait laissé deux options : casser le produit, ou désactiver le test. Les deux sont des
 * façons de ne pas faire la migration.
 *
 * Un BUDGET, lui, se tient : le chiffre du jour est enregistré, il ne peut que descendre. Chaque
 * lot qui migre une tranche le fait baisser et l'abaisse ici ; personne ne peut le remonter sans
 * le voir. C'est ce qui transforme « on devrait découpler Adam » en un travail fini un jour.
 *
 * ── LES DEUX RÈGLES ──────────────────────────────────────────────────────────────────────
 *
 *   1. `src/platform/**` — LA FRONTIÈRE elle-même — est à ZÉRO, strictement, sauf le pont.
 *      C'est la propriété qui rend le contrat portable : elle ne se négocie pas.
 *   2. Le périmètre historique a un plafond qui ne peut que baisser.
 *
 * ── SI CE TEST ÉCHOUE ────────────────────────────────────────────────────────────────────
 *
 * Il ne demande PAS de relever le plafond. Il dit qu'un nouvel import traverse la frontière :
 *   • le besoin est une LECTURE ou une ACTION → passer par `PlatformPort` ;
 *   • le besoin est un FAIT à connaître → s'abonner aux événements ;
 *   • le besoin est vraiment nouveau → l'ajouter au CONTRAT, ce qui est une décision explicite.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/**
 * LE PLAFOND. Mesuré le jour où la frontière a été posée.
 *
 * ⚠ NE JAMAIS L'AUGMENTER. Le baisser en migrant une tranche, oui — c'est le geste attendu.
 */
/**
 * 424 → 426 (2026-08-28, Information Fabric F2/F3) : DEUX franchissements assumés, tous deux
 * vers `src/lib/fabric/` — une FAÇADE transverse déclarée dans `domains.ts`, au même titre que
 * `queries/`. `document-discovery` consomme la recherche de contenu indexée, `source-map`
 * consomme le registre des sources. C'est le chemin VOULU (L3 → L2), de la même nature que les
 * seize imports `queries/` déjà comptés dans cette dette — pas un nouveau couplage à l'ERP.
 * Le plafond reste un cliquet : tout franchissement suivant devra se justifier ici, nommément.
 */
/**
 * 426 → 430 (2026-08-28, Information Fabric F5) : QUATRE franchissements, tous dans le SEUL
 * nouveau fichier `assistant/hot-alerts.ts` — le consommateur des états chauds précalculés :
 * `prisma` (lecture des sessions récentes pour savoir QUI réchauffer), `rbac` (droits relus
 * en base pour le réchauffage sans session — même geste que le balayage des missions),
 * `session` (le type CurrentUser), et la façade `fabric` (le mécanisme d'état chaud, L3 → L2
 * voulu). Un fichier de domaine Adam qui consomme la plateforme, de la même nature que ses
 * voisins — pas un couplage nouveau. Les AUTRES fichiers touchés par F5 n'ajoutent rien :
 * what-if / executive-brief passent par hot-alerts (interne Adam), ledger et scheduled sont
 * côté ERP.
 */
/**
 * 430 → 428 (2026-08-30, Market 360° Lot 3) : DEUX franchissements assumés dans le SEUL nouveau
 * fichier `assistant/ops/impl-market360.ts` — les ops de la chaîne marché (soumission, résultat
 * par lot, contrat, avenants, lignes, livraisons) : `prisma` (résolution des entités avant la
 * carte de confirmation) et `actions/pch-market-actions` (les actions CANONIQUES de l'écran) —
 * de la même nature exacte que ses voisins `impl-wave*.ts`, pas un couplage nouveau. Et QUATRE
 * imports MORTS retirés (`CurrentUser` importé sans aucun usage dans directory-tools,
 * investigation, impl-wave7, impl-wave7c) : la dette mesurée baisse de 430 à 428, le plafond
 * suit — c'est le geste attendu du cliquet.
 */
const DEBT_CEILING = 428;

describe("frontière Adam ↔ ERP", () => {
  const report = scanBoundary();

  it("le code NEUF d'Adam ne connaît pas l'ERP — zéro, hors le pont", () => {
    const neuf = report.violations.filter(
      (v) => v.from.startsWith("src/platform/") && !BRIDGE_PATHS.some((b) => v.from.startsWith(b)),
    );
    // Message explicite : un échec ici doit se corriger sans avoir à lire ce fichier.
    expect(
      neuf.map((v) => `${v.from} → ${v.to}`),
      "src/platform/ (hors pont) doit rester sans dépendance ERP",
    ).toEqual([]);
  });

  it("la dette historique ne remonte pas", () => {
    expect(
      report.violations.length,
      `La frontière a été franchie ${report.violations.length} fois (plafond ${DEBT_CEILING}). `
      + "Un NOUVEL import d'Adam vers l'ERP a été ajouté : passer par le contrat de plateforme "
      + "plutôt que relever ce plafond.",
    ).toBeLessThanOrEqual(DEBT_CEILING);
  });

  it("le plafond enregistré reste crédible — il colle à la mesure du jour", () => {
    // Un plafond très au-dessus de la réalité laisserait rentrer des dizaines d'imports sans
    // rien signaler : le cliquet existerait sans mordre. On exige qu'il reste serré.
    expect(DEBT_CEILING - report.violations.length).toBeLessThanOrEqual(25);
  });

  it("le CONTRAT lui-même n'importe rien — c'est ce qui le rend portable", () => {
    // La propriété qui permettra à Adam de partir avec ce fichier sans le modifier.
    const contrat = fs.readFileSync("src/platform/contract.ts", "utf8");
    const imports = [...contrat.matchAll(/(?:^|\n)\s*import\s/g)];
    expect(imports.length, "contract.ts doit rester sans aucun import").toBe(0);
  });

  it("le pont est UNIQUE — un second pont serait la fin de la frontière", () => {
    expect(BRIDGE_PATHS).toHaveLength(1);
    expect(BRIDGE_PATHS[0]).toBe("src/platform/in-process/");
  });

  it("le périmètre d'Adam couvre bien tout le produit", () => {
    // Un périmètre qui oublierait un dossier rendrait le cliquet aveugle sur cette partie.
    for (const p of ["src/lib/assistant/", "src/lib/comms/", "src/components/chief/", "src/platform/"]) {
      expect(ADAM_PATHS).toContain(p);
    }
    expect(report.adamFiles).toBeGreaterThan(100);
  });
});
