# Graphe AMD — Phase 0 : audit du dépôt (02/10/2026)

> Compte rendu de la phase 0 du chantier décrit au §118.177 de `CLAUDE.md`. La spécification d’origine est dans `docs/graphe-amd/SPEC.md`.

Méthode : quatre explorations en lecture seule (données maîtres ; annuaire et force de vente ;
consommation / AO / finances ; recherche / 360 / permissions / audit / cycles), puis vérification à
la main de chaque constat lourd avant de m'appuyer dessus.

## Ce qui EXISTE et sera RÉUTILISÉ (ne rien recréer sous un autre nom)

| Spec | Objet existant | État |
|---|---|---|
| Product canonique | `Product`, `ProductAlias`, `products/identity.ts` (clé d'identité pure), `resolve.ts` (`ensureProduct`, `resolveProductMention`, `addProductAlias`) | Mince et juste, mais **aucun écran ni aucune action ne le crée ni ne le lie** (seul un script manuel `scripts/backfill/canonical-products.ts`). Base locale : 0 produit canonique. |
| Profils produit | `RegulatoryProduct`, `PromoProduct`, `BdProduct` (chacun `productId` nullable) | Profils voulus (le dossier porte ce qui a été DÉPOSÉ). |
| Product × BU | `PromoProduct` (une ligne par BU et par produit, `businessUnitId` + `productId`) | C'est l'affectation de fait ; ni dates d'effet, ni spécialités cibles, ni classement BU. |
| Classement P1-P3 | `PromotionAssignment` (KAM × PromoProduct × `PromoCycle`, position 1-3) | Par KAM et par cycle mensuel, pas par stratégie de BU. |
| BusinessUnit | `BusinessUnit` (sous-département budgétaire, superviseur, chef, canal), écran `/planning/business-units` | Aucune relation à une spécialité. |
| Specialty | `MedicalSpecialty` (nom unique, couleur) | Une seule spécialité par praticien ; la feuille d'annuaire écrit du TEXTE et efface la clé ; aucun écran de gestion (seulement des ops d'Adam, en pause). |
| HCP | `MedicalDoctor` (établissement + service en FK, `delegateId`, `potential/influence/affinity` en `SegmentLevel` choisi par un humain) | Pas de potentiel factuel, pas d'historique, pas de BU. |
| HCO | `MedicalInstitution` + `MedicalInstitutionService` | Bon socle ; pas d'alias pour la résolution d'imports. |
| Territoire | `SalesSector` (+ établissements, services, KAM affectés) | **Deux définitions du panel d'un KAM** (secteur ∪ `delegateId` pour planifier ; `delegateId` seul pour le cockpit, Ma journée, les alertes et la portée d'accès). |
| Cycle | `PromoCycle` (mensuel), `TourPlan` (semaine → semestre), `SalesRepMonthlyKpi` | `CLOSED` jamais écrit ; `ensureCycle` écrit à l'affichage ; les deux mailles ne sont pas reliées. |
| Visite | `MedicalVisit`, `MedicalVisitProduct`, `PromoMessage`, `FieldReport`, verrou de 48 h (`fenetreRapport`) | Pas de rôle primaire / secondaire par produit. |
| Réglages SFE | `SfeSettings` (fréquence par palier, capacité, poids P1-P3) | Global, écrasé sur place, aucune version. |
| Modèles de versions | `CoachingGrid` (versions immuables), `TourPlan` (figé à la soumission), `WorkflowDefinitionVersion`, `AuditLog` (old/new) | À réutiliser comme MOTIFS pour règles et cycles. |
| Marché | `market/data.ts` (NDJSON statiques IQVIA / PCH / nomenclature), normaliseurs `galenic.ts`, `text.ts`, `molecule.ts` | Aucune consommation hospitalière en base, aucun pipeline d'import. |
| Imports | `AnppReserveBatch` (lot + sha256 unique), `directory-mapping.ts` (la machine propose, la personne décide) | Motifs pour le pipeline de consommation. |
| AO | `PchTender` → lignes → BU → offres → `PchContractLine` → commandes → livraisons ; `loadMarket360` | `PchTenderLine.productId` **jamais écrit** (seul `ourProductId`, id de dossier). |
| Ventes | `Sale` (`productId`, `tenderLineId` existent) | Jamais écrits ; import CSV sans contrôle de doublon. |
| Finances | `ExpenseOrder`, `FinanceTransaction`, `DepartmentBudget*`, `budget/imputation.ts`, `AdProProductAllocation`, `ProductAssignment.allocationPct` | Aucune dimension analytique BU / produit ; allocation par produit sans écrivain. |
| 360 / recherche | `produit360`, `metrics.ts`, `story.ts`, `globalSearch`, `searchEverything` (Adam) | Pas de page produit canonique, pas de 360 BU ni praticien ; la recherche ne connaît pas `Product`. |
| Audit | `recordAudit`, `recordFieldChanges`, `BusinessEvent` | `EntityType` sans BU, produit, plan de tournée, secteur, établissement. |

## Défauts trouvés (vérifiés à la main) et où ils se corrigent

Corrigés TOUT DE SUITE (phase 0, §118.177) — chacun avec un test qui le reproduit :
1. **Recherche globale** — l'enquête famille par famille (23 familles, chacune comparée à son écran de liste) a trouvé bien plus que les deux fuites d'abord repérées : 15 familles sans le cloisonnement par entité, les dossiers CTD sans la permission du module ni l'entité activée, les directives sans leur publication, les messages des groupes quittés, les documents de modules invisibles, les annuaires fermés, la gamme Regulatory, et des tâches que la fiche refuse ensuite. Chaque liste a désormais UNE clause, lue par l'écran et par la recherche (`queries/visibilite-listes.ts`).
2. **Écrans** — `regulatoryVisibleWhere` perdait portée par ligne et verrou dès qu'une gamme s'appliquait (étalement) ; l'analyse CTD (33 appels) et l'écran des départements lisaient le cookie d'entité tel quel.
3. **Saisie rapide de visite (« Ma journée », et `log_visit` d'Adam qui l'appelle)** : accepte n'importe quelle date passée et n'importe quel produit ; la planification acceptait « réalisée ». Une règle aux quatre portes.
4. **Import de l'annuaire : « D » lu comme « Moyen »** (et tout texte non reconnu aussi, en écrasant le niveau connu) ; « A+ » jamais lu.

Corrigés dans leur phase :
5. Panel du KAM à deux définitions (phase 1B).
6. Spécialité : texte qui efface la clé ; aucun écran de gestion (phase 1B).
7. Produit canonique jamais créé ni lié par l'application ; `PchTenderLine.productId` et `Sale.productId` jamais écrits (phase 1A).
8. Types d'entité d'audit manquants ; plans de tournée audités sous `VISIT` (phase 1B).
9. Budget des BU : la prose dit « lit le tout », le code ne compte que le matériel promotionnel et mélange les natures de budget (phase 11).
10. `ensureCycle` écrit à l'affichage ; `PromoCycle.CLOSED` jamais écrit (phase 10).
11. Réimport CSV des ventes : double comptage silencieux (phase 11).
12. Indicateurs PCH : en-tête de commande contre lignes (phase 11).

À signaler (décisions de la Direction, pas du code) :
- **Le fichier de segmentation Adventum est absent** du dépôt et de son historique (seul `data/selection-pf-produits.xlsx`, le portefeuille réglementaire). Les tests 73-86 seront écrits sur les exemples du cahier des charges ; l'import du fichier sera branché quand il sera fourni.
- « Directeur des opérations » (spec §69) : deux rôles dans le dépôt (`DIRECTION` « Direction des opérations », vue globale, et `OPERATIONS_DIRECTOR`). Lecture retenue : les deux administrent BU, segmentation et cycles (comme la grille de coaching, §118.157), avec le geste qui la retourne écrit à côté.
- Adam est en pause (Super Admin seul) : la phase 14 livre les explications « Pourquoi ? » et la recherche de façon DÉTERMINISTE, sans toucher à Adam.
- `NATIONAL_SALES` voit tous les praticiens (portée ALL sur MEDICAL) : la spec dit « BU Manager : sa BU ». L'annuaire est un référentiel (§118.147) ; la segmentation, elle, sera bornée à la BU.

## Plan des lots

P0 audit + 4 corrections · P1A produit canonique branché · P1B spécialités, panel unique du KAM, types
d'audit · P2 BU multi-spécialité (module dédié, création guidée) · P3 Product × BU × spécialités cibles
+ ciblage · P4 annuaire maître (HCP / HCO reliés) · P5 Consumption Intelligence · P6 affinité · P7
potentiel factuel historisé · P8 Segmentation Studio · P9 priorités multi-produits · P10 cycles,
règles de visite, capacité · P11 AO / Regulatory / finance, coûts direct / alloué / non alloué · P12
vues 360 + recherche · P13 cockpits + écran CAM · P14 explications + recherche (sans Adam) · clôture
(tests 73-86, quality gate global).
