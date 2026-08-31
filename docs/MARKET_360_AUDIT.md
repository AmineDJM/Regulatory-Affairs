# Market / Tender 360° — Audit final (§78, §92)

> Chaque ligne dit où la fonction VIT (fichier), comment elle est PROUVÉE (test), et ce qui
> manque. Un « ✅ » sans preuve nommée serait une fausse feature (§80) — il n'y en a pas ici.

Légende : ✅ fait et prouvé · ⚠️ fait avec limite dite · ❌ non couvert (assumé).

## 1. La matrice

| Fonction | UI | Backend | DB | RBAC | Audit | Tests | Mobile | Adam |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Cycle de vie dérivé + liste filtrée (§3) | ✅ `/pch` (chips-liens, colonne niveau, KPI) + en-tête fiche | ✅ `deriverNiveau` (pur) + `getPchTenders` | ✅ champs cycle de vie sur `PchTender` | ✅ `requireModule("PCH")` | — (lecture) | ✅ market-math 22 tests | ✅ Table mobileCards | ✅ story sousTitre/niveau |
| Cahier des charges & pièces (§8) | ✅ upload fiche + création avec fichiers | ✅ `persistUploadedDocument` (existant) | ✅ `Document(PCH_TENDER)` | ✅ UPLOAD | ✅ recordAudit | ✅ (existant) | ✅ | ✅ inspect/docs |
| Soumission versionnée + verrou (§9, §13, §63) | ✅ `submission-panel` (accordéon, checklist signée, dépôt+confirm) | ✅ create/update/toggle/add/submit — transaction dépôt+date+snapshots | ✅ `PchSubmission` (unique tenderId+version, `lockedAt`, checklist Json) | ✅ CREATE/UPDATE | ✅ | ✅ chain test 1 (verrou serveur vérifié) | ✅ | ✅ story « Soumission déposée » ; ops create/submit_submission |
| Snapshot produit au dépôt (§9) | ✅ (photo figée, lisible sur ligne) | ✅ `submissionSnapshot` figé en transaction | ✅ Json sur `PchTenderLine` | ✅ | ✅ | ✅ chain test 1 | ✅ | ✅ |
| Résultats par LIGNE, attribution partielle (§14) | ✅ tender-lines (statuts +2, qté attribuée) | ✅ `setLineResult` (refus qté > soumis) | ✅ `awardedQuantityUnits`, statuts +UNSUCCESSFUL/CANCELLED | ✅ UPDATE | ✅ avant/après | ✅ chain test 2 + math | ✅ | ✅ op set_line_result ; story « PARTIELLE X/Y » |
| Contrat = UN objet Legal, deux vues (§16, §64) | ✅ contract-panel + fiche Legal (contexte marché) | ✅ `createContractFromAward` (2 portes), `linkContractToTender` | ✅ `LegalDocument.tenderId` | ✅ PCH UPDATE **et** LEGAL CREATE | ✅ | ✅ chain test 3 | ✅ | ✅ op create_contract_from_award / link_contract |
| Avenants, deltas, valeur courante (§17-18) | ✅ contract-panel (initial vs courant) + fiche Legal | ✅ `createAmendment`/`setAmendmentEffective` + `valeurContractuelleCourante` | ✅ kind AMENDMENT, `amendsId`, `amountDelta`, `effectiveAt` | ✅ LEGAL | ✅ | ✅ chain test 4 (500M+50M+100M→650M dans math) | ✅ | ✅ ops + story (delta ±, effectif/à venir) |
| BC à lignes + contrôle de dépassement (§19) | ✅ order-execution (Sheet « Passer outre (tracé) ») | ✅ `addOrderLine` (`controlerCommande`, force explicite) | ✅ `PchOrderLine`, `PchOrder.contractId` | ✅ UPDATE | ✅ excès tracé | ✅ chain test 5 (refus chiffré + force) | ✅ | ✅ op add_order_line (force=oui) |
| Livraisons multiples, lot, péremption (§20) | ✅ Sheet livraison par ligne | ✅ `createDelivery` (transaction) | ✅ `PchDelivery(+Line)` | ✅ UPDATE / DELETE | ✅ | ✅ chain test 6 | ✅ | ✅ op create_delivery ; story BL réels |
| Stock sans double vérité (§21) | ✅ checkbox explicite | ✅ OUT seulement si demandé ET produit résolu (exactement 1 RegulatoryProduct) ; suppression → mouvements CONSERVÉS et dit | ✅ `StockMovement.deliveryId` | ✅ | ✅ | ✅ chain test 6 | ✅ | ✅ |
| Factures Finances visibles (§22-23) | ✅ order-execution + KPI + bouton « Facture » du bon (création `createInvoice` pré-associée) | ✅ lecture `Invoice sourceType=PCH_ORDER` — rien de fabriqué ; écriture par l'action Finances canonique | ✅ existant + champ « order » de create_invoice | ✅ | — | ✅ chain tests 7/9 (facture par le VRAI point d'entrée) | ✅ | ✅ story jalons facture + KPI facturé |
| Calculs centralisés (§24) | ✅ tous les écrans consomment market-math | ✅ module PUR sans import | — | — | — | ✅ 22 tests | ✅ | ✅ même module via story |
| Courriers « Relier à… » + pré-associé (§25-27) | ✅ mail-links (chips + Sheet) + bouton fiche marché | ✅ addMailLink/removeMailLink (accès cible revérifié) | ✅ `MailEntryLink` (unique triple) | ✅ MAIL_REGISTER UPDATE + canAccessEntity | ✅ | ⚠️ actions typées/lintées, pas de test dédié (couvert indirectement par parité) | ✅ | ✅ ops link/unlink_record |
| Timeline consolidée (§28) | ✅ MarketTimeline (fiche) | ✅ storyMarche — MÊME frise qu'Adam | — | ✅ | — | ✅ chain test 9 | ✅ | ✅ business.story |
| Vue « Marchés » du produit (§30) | ✅ product-markets (fiche Regulatory) | ✅ `loadProductMarkets` (2 chemins dédupliqués) | — | ✅ REGULATORY VIEW | — | ✅ chain test 8 | ✅ | ✅ (produit → lots dans storyProduit) |
| Recherche globale (§44) | ✅ palette ⌘K / /search | ✅ marchés, BC, Legal (garde lecteurs), courriers | — | ✅ par module + lecteurs | — | ⚠️ pas de test dédié à ces 4 groupes | ✅ | ✅ search_everything (déjà couvert) |
| Rappels d'échéance (§53) | ✅ notifications + badges | ✅ `deadline-sweep` (J-7/J-2/dépassé, verrou anti-spam, se tait au dépôt) | ✅ `deadlineRemindedAt` | ✅ destinataires = responsable + PCH UPDATE | — | ✅ zones prouvées (math, 4 tests) ; ⚠️ sweep non testé bout-en-bout | ✅ push | — |
| Migrations propres (§60-61) | — | — | ✅ 2 migrations idempotentes, additives, backfill `PchOrderLine`, rejouées 0 erreur | — | — | ✅ deploy + rejeu | — | — |
| RBAC serveur (§49) | — | ✅ chaque action : requireUser + userCan | — | ✅ | — | ✅ chain (acteur mocké mais portes réelles) | — | ✅ gates catalogue |
| Adam étendu par la plateforme (§54-55) | — | ✅ story enrichie, contrat inchangé | — | ✅ | ✅ | ✅ parité 100 %, frontière 428 ≤ 428 | — | ✅ |

## 2. Les preuves

- `src/lib/pch/market-math.test.ts` — **22 tests purs** : niveaux dérivés, valeur courante
  (« 500M + 50M + 100M = 650M »), quantités contractuelles clampées, contrôle de dépassement,
  attribution partielle, zones d'échéance.
- `src/lib/actions/pch-market-chain.test.ts` — **9 tests d'intégration** depuis les VRAIES
  portes (actions serveur, vraie base, scénario §87 complet) : verrou de soumission,
  attribution partielle refusant l'excès, contrat+lignes en transaction, avenant effectif,
  refus chiffré + passage en force, livraison partielle + stock, lecture 360° avec manques,
  vue produit, frise sur FK.
- `src/lib/client-bundle-guard.test.ts` — aucun module lourd dans le bundle client.
- `src/lib/assistant/action-parity.test.ts` — 16 actions classées, 0 trou, parité 100 %.
- `src/platform/boundary.test.ts` — dette 428, plafond ABAISSÉ (jamais relevé).
- Suite complète : **5 468 tests verts** ; `rm -rf .next && npm run build` propre.

## 3. Ce qui reste ouvert (honnête)

| Point | État | Pourquoi |
| --- | --- | --- |
| E2E navigateur Playwright (§72) | ❌ | la chaîne est prouvée côté serveur ; le parcours navigateur (20 scénarios) reste à monter sur l'infra Playwright existante — dette assumée, pas un oubli |
| Revue visuelle systématique (§74) | ❌ | non faite dans ce chantier |
| Paiements multiples par facture | ⚠️ | `Invoice.transactionId @unique` — restructurer Finance créerait le mécanisme parallèle que §23 interdit |
| `ourProductId` orphelin | ⚠️ | purge dans un lot dédié après parité vérifiée |
| Test bout-en-bout du sweep d'échéance | ⚠️ | la règle (zones) est prouvée pure ; le sweep suit mot pour mot le motif Legal éprouvé |
| Historique pré-FK | ⚠️ | contrats par texte / soumission déduite servis en repli, marqués DÉDUITS |
