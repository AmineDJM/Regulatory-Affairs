# IMPLEMENTATION_ROADMAP — Regulatory Intelligence OS

> Phase 0. Livraison **par phases cohérentes**, jamais un commit massif. **Un rapport après chaque phase** (gabarit §44 du brief). Chaque phase passe la porte : `tsc` + `tests` + `build` verts, RBAC + org-scope + audit + statut DRAFT respectés, aucune donnée fictive.

## Règle de « fait »
Une capacité n'est « terminée » que si : persistée · protégée par RBAC (rôles secondaires inclus) · isolée par organisation · tracée à l'audit · testée · réellement fonctionnelle (pas seulement visuelle) · sans donnée fictive.

## Phase 0 — Audit ✅ (ce lot)
Docs `CURRENT_STATE_AUDIT`, `GAP_ANALYSIS`, `TARGET_ARCHITECTURE`, `IMPLEMENTATION_ROADMAP`, `SECURITY_RISK_ASSESSMENT`. Aucun changement de comportement runtime.

## Phase 1 — Fondations
- `RegulatoryFeatureAccess` **par organisation** (remplace le flag global, migration douce) + bascule Super Admin par `Company`.
- Couche **permissions `regulatory.*`** mappée sur rôles/UserAccess + **tests de non-régression rôle secondaire**.
- **Modèle de données** (squelette des ~40 modèles, `organizationId` + audit + version) + migrations idempotentes.
- **Stockage immuable** (ORIGINAL/WORKING/APPROVED) sur `FileBlob` + SHA-256.
- **Manifest** (`RegulatoryManifestEntry`).
- **Ingestion ZIP sécurisée** (anti-bomb, path traversal, ratio, profondeur, exécutables, chiffrement, timeout, quotas, nettoyage temp) — voir `SECURITY_RISK_ASSESSMENT`.
- **Infra jobs** (`RegulatoryJob` + runner + statuts + idempotence).
- **Livrable démontrable** : déposer un ZIP → sécurisé, inventorié, original figé, manifest visible, job tracé. Aucune analyse encore.
- **Décisions requises avant P2** : OCR (fournisseur), extraction PDF (dépendance), file (Postgres vs Redis).

## Phase 2 — Traitement documentaire
Extraction PDF/DOCX/XLSX/CSV/XML/TXT/images ; **OCR réel** (fr/en/ar) ; par page ; tableaux ; statuts (`TEXT_EXTRACTED`/`OCR_REQUIRED`/`LOW_CONFIDENCE`/`CORRUPTED`/…) ; scores de confiance ; **jamais analyser un doc mal extrait** ; **viewer** documentaire (volet central) avec surlignage/position.

## Phase 3 — CTD
Taxonomie CTD **versionnée** (Module 1 Algérie + 2-5, sections/sous-sections, obligatoire/conditionnel/facultatif, alias, applicabilité) ; **classification** persistée (section proposée + score + justification + alternatives) ; arbre CTD réel ; `NOT_APPLICABLE` conservé + justifié ; **revue humaine** ; renommage de la **copie de travail** (original intact).

## Phase 4 — Digital Twin
Extraction de **faits sourcés** (`RegulatoryFact` : valeur, unité, source doc/page/section, extrait, confiance, statut) ; occurrences ; **détection de conflits** (toutes occurrences, clic → page) ; **analyse d'impact** d'un changement de valeur.

## Phase 5 — Corpus & RAG
`RegulatorySource(+Version/Section)`, statuts (DRAFT→ACTIVE→SUPERSEDED…), **hiérarchie des normes** (loi > arrêté > lignes ANPP > ICH > OMS > EMA…), obligation ALG vs recommandation ; **RAG** (FTS + **pgvector** + filtres juridiction/date/procédure/CTD + citations exactes) ; **migration de `anpp-knowledge.ts`** vers le corpus (conservé comme seed) ; « exigence non confirmée » si pas de source.

## Phase 6 — Moteur de règles
`RegulatoryRule(+Version/Run)` : présence/absence, lisibilité, expiration, signature, autorité, concordances (DCI, dosage, forme, fabricant, adresse, durée de conservation, stockage, taille de lot, spécif/méthode), CPP/GMP/CLV valides, bioéquivalence/biowaiver, stabilité (lots/durée), conditionnement. **Déterministe, versionné, reproductible** ; produit `RegulatoryFinding` + `RegulatoryEvidence` ; l'IA explique sans altérer le résultat.

## Phase 7 — Agents IA
Orchestrateur + 12 agents (§16) ; **sorties structurées Zod** ; **model routing** (FAST/EXPERT/CHALLENGER/TRANSLATION) ; budgets/timeouts/journal (`RegulatoryModelRun`, `RegulatoryPromptVersion`) ; **protection prompt-injection** + tests ; **Challenger obligatoire** avant rapport final ; **statut DRAFT — HUMAN REVIEW** sur toute production.

## Phase 8 — Corrections fournisseur
Génération des demandes ; **brouillon** e-mail Infomaniak (jamais d'envoi auto) ; réception nouvelle version ; **comparaison V1→V2** (fichiers/faits/findings, côte à côte) ; réouverture/résolution proposée ; extension du **portail fournisseur** existant.

## Phase 9 — Documents & soumission
Templates versionnés (pré-soumission, courriers, déclarations, rapports, checklist, index annexes…) via **OnlyOffice** ; filigrane DRAFT + traçabilité ; **content blocks** réutilisables ; **B.V.** (estimation vs demande vs officiel vs quittance) ; **Final Submission Gate** (blocage réel sur bloqueur critique) + validation **pharmacien DT** + gel de version + export package.

## Phase 10 — Réserves
Upload lettre ANPP ; extraction **exacte** des réserves ; décomposition ; **matrice** réserve→sous-demande→réponse→preuve→annexe→responsable→statut ; réponses ligne par ligne ; courrier ; suivi.

## Phase 11 — Cycle de vie
Séquences eCTD (NEW/REPLACE/DELETE/APPEND/REFERENCE) ; variations, renouvellement, transfert, retrait ; **obligations** post-enregistrement (CPP/GMP/certificats, engagements) ; **précédents** ; **Reviewer ANPP simulator** (non prédictif) ; **change intelligence** (impact des nouvelles sources).

## Phase 12 — Validation
Golden dataset annoté (dossier synthétique : CPP expiré, fabricant incohérent, durée divergente, doc absent, mal classé, faux doublon, PDF scanné, BE incomplète, prompt-injection, V2 corrective) ; suites sécurité/RBAC/CTD/règles/IA/E2E ; observabilité (coûts IA, OCR, jobs) ; docs `URS/FRS/DESIGN/TRACEABILITY/RISK/VALIDATION_PLAN/REPORT`.

## Séquencement & dépendances
P1 → (P2 nécessite décision OCR/PDF) → P3 → P4 → P5 (pgvector) → P6 → P7 → P8 → P9 → P10 → P11 → P12. P6 et P7 peuvent se paralléliser partiellement (règles déterministes indépendantes des agents). Audit + statut DRAFT + org-scope = **transverses** dès P1.
