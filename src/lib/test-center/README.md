# Adventum Autonomous Test Center — architecture

Système de **certification autonome** d'AMD Internal OS : découvre, teste, comprend et
critique la plateforme (fonctionnel, métier, technique, sécurité, UX/UI, perf, cohérence
des données, IA). Construit **par phases**, chacune vérifiée avant la suivante. Priorité
absolue : **sécurité des données → isolation du test → exactitude → nettoyage garanti →
couverture réelle → qualité → UX → perf → recommandations IA**.

## 1. Cartographie de l'existant (réel, vérifié)

| Brique | Où | Réutilisé par le Test Center |
|---|---|---|
| RBAC (rôles, modules, `can`, `hasGlobalView`, `anyRoleFilter`, scopes) | `src/lib/rbac.ts` | matrice rôles × modules, gating |
| Navigation / modules / `moduleForPath` | `src/lib/labels.ts` (`NAVIGATION`, `MODULES`, `ADMIN_TABS`) | découverte des routes de menu |
| Pages App Router (117) | `src/app/(app)/**/page.tsx` | découverte des routes (dev/CI) |
| Validateurs d'upload (allowlist/blocklist) | `src/lib/storage.ts` | torture-test fichiers |
| Moteur de workflow Ad & Pro | `src/lib/workflow/` | workflows métier E2E (phase 2) |
| Infra IA (Claude, OCR) | `src/lib/ai.ts`, `ai-settings.ts` | évaluateur IA + tests prompt-injection |
| Multi-entité | modèle `Company` (`companyId String?` sur User/…) | isolation inter-entités (phase 2) |
| Audit | `src/lib/audit.ts` (`recordAudit`) | traçabilité de chaque run |
| Diagnostic + auto-testeur (déjà livrés) | `src/lib/platform-audit/`, `scripts/auto-test/` | **smoke** de la phase 1 |
| Modèles Prisma (~140) | `prisma/schema.prisma` | vérificateur de cohérence base |

## 2. Risques identifiés (et parades)

- **Suppression de données réelles** → un run ne supprime **que** les IDs présents dans son
  **manifeste** (`TestArtifact`), jamais par nom/préfixe (§9 du cahier). Suppression en ordre
  **inverse de dépendance** + **vérification post-nettoyage** (chaque ID est réinterrogé).
- **Exécution en production** → `READ_ONLY_AUDIT` par défaut hors staging ; toute action
  synthétique en prod exige Super Admin + confirmation + phrase de sécurité + périmètre.
- **Effets de bord externes** (mail, push, paiement, réglementaire) → transports simulés,
  destinataires réservés, aucun envoi réel, aucune écriture irréversible.
- **Fuite de secrets/PII dans les rapports** → redaction systématique (`redact.ts`).
- **Run interrompu / crash** → statut `RUNNING`/`CLEANUP_INCOMPLETE` détecté au démarrage,
  **reprise de nettoyage** manuelle (jamais automatique sur run ambigu).

## 3. Architecture (modulaire, typée)

```
src/lib/test-center/
  types.ts       — enums, config de run, spec d'artefact, findings
  redact.ts      — expurge secrets/PII des logs & rapports
  guard.ts       — gardes (mode, environnement, prod read-only, phrase de sécurité)
  manifest.ts    — TestManifest : record() + cleanup(reverse-deps) + verifyClean()
  synthetic.ts   — fabrique de données synthétiques (utilisateurs par rôle) via manifeste
  smoke.ts       — tests smoke (santé + cohérence RBAC/nav) — phase 1
  runner.ts      — cycle de run : préflight → exécution → nettoyage → vérif → clôture
  recovery.ts    — détection & reprise des runs interrompus
```
Actions : `src/lib/actions/test-center-actions.ts` (Super Admin). UI : `/admin/test-center`.

## 4. Schéma Prisma (phase 1)

- **`TestRun`** — id, mode, environnement, statut, cleanupStatus, initiateur, commit/branche,
  config, dates, score, compteurs (créées/supprimées/critiques), progression, résumé.
- **`TestArtifact`** (le **manifeste**) — testRunId, resourceType, model, **recordId** (ID réel),
  blobKey, dependsOn[], deleteMethod, deletedAt, cleanupResult. **Source de vérité du nettoyage.**
- **`TestFinding`** — testRunId, gravité, catégorie, module/route/rôle, titre, détail, preuve,
  suggestion, confiance.

Enums : `TestRunMode`, `TestRunStatus`, `TestCleanupStatus`, `TestSeverity`.

## 5. Plan de phases

- **Phase 1 (ce lot)** — `TestRun` + manifeste + isolation + **nettoyage garanti & vérifié** +
  récupération + **smoke tests** + dashboard minimal Super Admin. *La fondation de sûreté.*
- **Phase 2** — cartographie automatique complète, comptes synthétiques par rôle, multi-entité,
  workflows fonctionnels E2E.
- **Phase 3** — torture fichiers, OCR/IA, sécurité, prompt-injection.
- **Phase 4** — UX/responsive/accessibilité (crawler navigateur), performance.
- **Phase 5** — chaos, comparaison de runs, certification pré-production.

## 6. Preuve de couverture

Chaque run mesure et **liste explicitement** ce qui est testé et ce qui ne l'est pas
(routes découvertes/testées, rôles, entités, modes) — jamais de « 100 % » sans preuve.
La couverture se lit `page × rôle × entité × appareil × état × action × attendu × réel`.

## 7. Protocole de nettoyage (garanti)

`freeze → sessions → jobs → notifications → messages → enfants → documents/versions →
blobs → objets métier → utilisateurs → entités → vérif manifeste → re-requête base+stockage →
confirmation d'absence → rapport`. Échec ⇒ run `CLEANUP_INCOMPLETE`, alerte, bouton de
reprise, **jamais** de suppression « compensatoire ».
