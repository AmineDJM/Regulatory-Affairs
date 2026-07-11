# CURRENT_STATE_AUDIT — Regulatory Intelligence OS

> Phase 0 — audit technique. Branche `claude/hopeful-goodall-phd0nb`. Date : 2026-07-11.
> Objectif : établir, sans complaisance, ce qui est **réellement implémenté** aujourd'hui, avant toute nouvelle fonctionnalité.

## 0. Résumé exécutif (à lire d'abord)

La « première version » Regulatory / Enregistrement se compose, **en code réel**, de **quatre** éléments :

1. **Base de connaissance statique** `src/lib/regulatory/anpp-knowledge.ts` — données TS (tarifs, délais, CTD 5 modules, pré-soumission, modifications, décision, refus). **Aucune** persistance, **aucun** versionnement, **aucune** source/preuve rattachée.
2. **Page référentiel** `src/app/(app)/regulatory/enregistrement/page.tsx` — rendu **lecture seule** de cette base. Server component.
3. **Injection dans le bot** — `regulatoryKnowledgeDigest()` ajouté au system prompt de l'assistant (`src/lib/assistant.ts`) pour les utilisateurs ayant accès à `REGULATORY`.
4. **Feature flag global** `AppSetting.regEnrollmentEnabled` + bascule Super Admin (Administration → Réglages) + onglet masqué (`ModuleTabs`).

> ⚠️ **Point critique d'honnêteté.** Tout le reste décrit comme « déjà créé » dans le brief (upload ZIP, décompression JSZip du dossier CTD, inventaire, extraction, détection OCR, classification CTD, renommage, complétude, analyse `callClaude`, rapport, formulaire pré-soumission rempli, calcul du bordereau, interface 3 volets, liaisons produit/BV/Drive) **n'existe PAS en code**. Cela existe uniquement comme **maquette de conception visuelle** (l'artifact HTML publié). L'onglet affiche une carte « Analyseur CTD — bientôt ». **Il n'y a aujourd'hui : aucun upload de dossier CTD, aucune décompression réglementaire, aucune extraction, aucun OCR, aucune classification, aucun appel IA d'analyse de dossier, aucune donnée persistée de dossier.**

Verdict : socle de connaissance + porte d'entrée UI **réels et solides** ; **le moteur réglementaire reste à construire intégralement**.

## 1. Stack réel constaté (vs hypothèses du brief)

| Élément | Brief suppose | **Réalité du dépôt** |
|---|---|---|
| Fichiers | S3 / R2 | **Blobs Postgres chiffrés** (`FileBlob`, adressage par contenu SHA-256) via `src/lib/drive-storage.ts` (`putBlob`/`getBlob`/`releaseBlob`). Un commentaire du schéma évoque « S3/R2/Supabase » mais **rien n'est branché sur S3**. |
| SDK IA | (implicite) | **Aucun SDK.** `src/lib/ai.ts` appelle `POST {ANTHROPIC_BASE_URL}/v1/messages` en **`fetch` brut**. Modèle depuis `AI_MODEL` (défaut interne). `callClaude` (boucle outils) + `askClaude` (texte). |
| Jobs asynchrones | BullMQ / Redis / Temporal | **Absent.** Aucune file. Jobs planifiés = `src/lib/scheduled.ts` (verrou process, déclenché par requêtes). Traitements lourds exécutés **dans le process web**. |
| Recherche vectorielle | pgvector | **Absent.** Recherche = `contains`/`ILIKE` Prisma. Pas d'embeddings. |
| Extraction documents | (implicite riche) | **Partiel.** `mammoth` (DOCX→texte/HTML), `xlsx` (Excel). **PDF : aucune extraction de texte** (les PDF sont rendus en iframe, jamais lus). **OCR : absent** (pas de `tesseract`, pas de service). |
| OnlyOffice | oui | **Réel** — `src/lib/onlyoffice.ts` (jetons signés), `office-convert.ts`, `office-templates.ts`. |
| E-mail | Infomaniak IMAP/SMTP | **Réel** — `src/lib/mail.ts` (pool + disjoncteur + cache), `mail-actions.ts`. |
| RBAC rôles secondaires | pris en compte | **Réel** — `hasRole`, `anyRoleFilter`, `hasGlobalView` évaluent `role` **ET** `secondaryRole`. |
| Multi-organisation | Adventum / Pharmagen / consolidé | **Réel** — modèle `Company`, cookie `amd-company`, `currentCompanyWhere()`. **Mais** pas de feature flag par organisation. |

## 2. Distinction demandée par le brief (§2)

| Catégorie | Constat |
|---|---|
| **Interface réelle** | Page référentiel (lecture seule) + bascule admin + onglet masqué. L'interface « analyseur 3 volets » est **uniquement** dans l'artifact de conception. |
| **Données simulées** | La KB `anpp-knowledge.ts` est **réelle** (issue des textes officiels) mais **statique/non sourcée par preuve**. Aucune donnée de dossier fictive n'est en base (conforme « aucune donnée simulée »). |
| **Services réellement fonctionnels** | KB, référentiel, injection bot, flag. Réutilisables : Drive/blobs, OnlyOffice, mail, notifications, tâches, audit, RBAC, Company. |
| **Appels IA réels** | `ai.ts` fonctionne (assistant, résumés réunions, rapports voix). **Aucun** appel IA d'analyse de dossier CTD n'existe. |
| **Données persistées** | Aucune entité « dossier CTD / document classé / finding / fait / règle / réserve ». `AppSetting.regEnrollmentEnabled` persiste le flag. |
| **Traitements asynchrones** | Aucun pour Regulatory. `scheduled.ts` (rappels réunions, etc.) est le seul mécanisme, non adapté aux jobs lourds. |
| **Tests** | `regulatory-workflow.test.ts`, `rbac.test.ts`, `rbac-access.test.ts`, `storage.test.ts`, `office-templates.test.ts` (~130 tests). **Aucun test** sur la KB, le référentiel, ni (a fortiori) l'analyseur inexistant. |
| **Sécurité** | RBAC + `canAccessEntity` (IDOR), blobs chiffrés, jetons OnlyOffice signés, en-têtes de sécurité. **Ingestion ZIP réglementaire sécurisée : inexistante** (aucun dossier CTD n'entre encore). `drive-zip.ts` fait du **téléchargement** (jszip en mémoire), pas de l'ingestion contrôlée. |
| **Architecture temporaire** | `anpp-knowledge.ts` = source de dev à migrer vers un corpus versionné. Flag global à faire évoluer en flag par organisation. |
| **Dette technique** | Voir §5. |

## 3. Réutilisable immédiatement (à NE PAS réinventer)

- **Stockage chiffré** : `drive-storage.ts` (`putBlob`/`getBlob`/`releaseBlob`, dédup SHA-256, ref-count) → parfait pour `ORIGINAL` immuable + copies de travail.
- **RBAC** : `rbac.ts` (`userCan`, `hasRole`, `anyRoleFilter`, `hasGlobalView`, `RowGrant`, `UserAccess`) — rôles secondaires déjà gérés.
- **Multi-org** : `Company` + `currentCompanyWhere()` + cookie scope.
- **Audit** : `audit.ts` `recordAudit({actorId, action, module, entityType, entityId, summary, field, oldValue, newValue})`.
- **Documents** : `Document` + `storage.ts` (`persistUploadedDocument`, `validateDocumentUpload`), route `/api/documents/upload` (lot/dossier parallèle).
- **OnlyOffice** : génération/édition (`office-templates.ts`, `onlyoffice.ts`) → documents générés.
- **Mail** : `mail.ts`/`mail-actions.ts` → brouillons fournisseurs (jamais d'envoi auto).
- **Notifications / tâches** : `notify.ts`, modèle `Task`.
- **IA** : `ai.ts` `callClaude`/`askClaude` (à étendre : routage modèle, sorties structurées Zod, budgets, journal d'exécution).
- **Workflow ANPP existant** : `regulatory-workflow.ts` (22 étapes, testé) + `RegulatoryProduct` → cible d'intégration, pas de doublon.

## 4. Traitement ZIP actuel — limites (brief §4.18-19)

- `drive-zip.ts` **construit** des archives (téléchargement Drive) avec `jszip` **en mémoire** (garde-fou 800 Mo). Il ne **décompresse pas** de dossier reçu.
- **Aucun** contrôle anti-ZIP-bomb, path traversal, profondeur, ratio, exécutables/macros, chiffrement, timeout/quota mémoire dédié à l'ingestion.
- **Tout tournerait dans le process web Next.js** — inacceptable pour des dossiers CTD volumineux (centaines de Mo, centaines de fichiers). **Isolation requise** (worker/queue) — voir GAP & TARGET.

## 5. Dette technique / risques identifiés

1. **KB non sourcée** : conclusions sans preuve documentaire ni source versionnée (viole les principes §3.2/§3.3 dès qu'on analyse).
2. **Flag global** au lieu de par-organisation (§5 du brief).
3. **RBAC module×action** ≠ permissions fines `regulatory.*` demandées (§5) → besoin d'une couche de permissions.
4. **Pas d'isolation des traitements lourds** ni d'idempotence/reprise.
5. **Pas d'extraction PDF ni d'OCR** — cœur de « lire les documents ».
6. **Pas de sorties IA structurées/validées** ni de protection prompt-injection.
7. **Pas de modèle de données réglementaire** (dossier, document, fait, règle, finding, réserve, source…).

## 6. Conclusion de l'audit

La maquette est un **bon socle de connaissance et une porte d'entrée UI**, à **conserver et refactoriser** (la KB migre vers un corpus versionné ; le flag devient par-organisation ; le référentiel reste). **Le système réglementaire lui-même est à construire intégralement**, par phases (voir `IMPLEMENTATION_ROADMAP.md`), en réutilisant au maximum l'ERP existant et **sans jamais** déclarer « terminé » ce qui serait fictif, non persisté, non protégé par RBAC ou non testé.
